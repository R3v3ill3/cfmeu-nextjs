import { supabase } from '@/integrations/supabase/client';
import { 
  FwcLookupJob, 
  FwcLookupJobOptions, 
  FwcLookupResult, 
  FwcLookupError,
  FWCSearchResult,
  FwcLookupJobSummary
} from '@/types/fwcLookup';

/**
 * Service for managing FWC lookup jobs and background processing
 */
export class FwcLookupService {
  private static instance: FwcLookupService;
  private activeJobs = new Map<string, FwcLookupJob>();
  private jobQueue: FwcLookupJob[] = [];
  private isProcessing = false;
  private maxConcurrentJobs = 1; // Process one job at a time to avoid overwhelming FWC

  static getInstance(): FwcLookupService {
    if (!FwcLookupService.instance) {
      FwcLookupService.instance = new FwcLookupService();
    }
    return FwcLookupService.instance;
  }

  /**
   * Create a new FWC lookup job
   */
  async createFwcLookupJob(
    employerIds: string[],
    options: FwcLookupJobOptions = {}
  ): Promise<FwcLookupJob> {
    const jobId = `fwc-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Filter out employers that already have FWC data if requested
    let filteredEmployerIds = employerIds;
    if (options.skipExisting) {
      filteredEmployerIds = await this.filterEmployersWithoutFwcData(employerIds);
    }

    const job: FwcLookupJob = {
      id: jobId,
      employerIds: filteredEmployerIds,
      status: 'pending',
      priority: options.priority || 'normal',
      progress: {
        completed: 0,
        total: filteredEmployerIds.length
      },
      results: [],
      errors: [],
      createdAt: new Date(),
      estimatedDuration: filteredEmployerIds.length * 45, // 45 seconds per employer
      batchSize: options.batchSize || 5
    };

    // Store job in database for persistence
    await this.saveJobToDatabase(job, options);
    
    // Add to queue
    this.jobQueue.push(job);
    this.activeJobs.set(jobId, job);
    
    // Start processing if not already running
    this.processJobQueue();
    
    return job;
  }

  /**
   * Get job status and progress
   */
  getJob(jobId: string): FwcLookupJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): FwcLookupJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    job.status = 'cancelled';
    job.completedAt = new Date();
    
    await this.updateJobInDatabase(job);
    this.activeJobs.delete(jobId);
    
    return true;
  }

  /**
   * Process the job queue
   */
  private async processJobQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      while (this.jobQueue.length > 0) {
        const job = this.jobQueue.shift()!;
        
        if ((job as FwcLookupJob).status === 'cancelled') {
          this.activeJobs.delete(job.id);
          continue;
        }
        
        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single FWC lookup job
   */
  private async processJob(job: FwcLookupJob): Promise<void> {
    job.status = 'processing';
    job.startedAt = new Date();
    
    await this.updateJobInDatabase(job);
    
    try {
      // Get employer details for processing
      const { data: employers, error } = await supabase
        .from('employers')
        .select('id, name')
        .in('id', job.employerIds);
        
      if (error) {
        throw new Error(`Failed to fetch employers: ${error.message}`);
      }
      
      if (!employers) {
        throw new Error('No employers found for processing');
      }
      
      // Process employers in batches to avoid overwhelming the FWC service
      const batches = this.chunkArray(employers, job.batchSize);
      
      for (const batch of batches) {
        if ((job as FwcLookupJob).status === 'cancelled') break;
        
        // Process batch with concurrency limit
        const batchPromises = batch.map(employer => 
          this.processSingleEmployer(job, employer.id, employer.name)
        );
        
        await Promise.allSettled(batchPromises);
        
        // Update progress
        job.progress.completed = Math.min(
          job.progress.completed + batch.length, 
          job.progress.total
        );
        
        await this.updateJobInDatabase(job);
        
        // Add delay between batches to be respectful of FWC servers
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(2000); // 2 second delay between batches
        }
      }
      
      job.status = 'completed';
      job.completedAt = new Date();
      
    } catch (error) {
      console.error('Job processing failed:', error);
      job.status = 'failed';
      job.errors.push({
        employerId: 'N/A',
        employerName: 'Job Processing',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: true
      });
    }
    
    await this.updateJobInDatabase(job);
    
    // Clean up completed/failed jobs after a delay
    setTimeout(() => {
      this.activeJobs.delete(job.id);
    }, 300000); // Keep for 5 minutes
  }

  /**
   * Process FWC lookup for a single employer
   */
  private async processSingleEmployer(
    job: FwcLookupJob, 
    employerId: string, 
    employerName: string
  ): Promise<void> {
    const startTime = Date.now();
    job.progress.currentEmployer = employerName;
    
    try {
      // Call the FWC search API
      const response = await fetch('/api/fwc-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: employerName })
      });
      
      const data = await response.json();
      const processingTime = Date.now() - startTime;
      
      if (response.ok && data.results?.length > 0) {
        const result: FwcLookupResult = {
          employerId,
          employerName,
          success: true,
          fwcResults: data.results,
          selectedResult: data.results[0], // Auto-select the first/best result
          processingTime
        };
        
        job.results.push(result);
        
        // Update the employer's EBA record with FWC data
        await this.updateEmployerEbaRecord(employerId, data.results[0]);
        
      } else {
        // No results found
        const result: FwcLookupResult = {
          employerId,
          employerName,
          success: false,
          fwcResults: [],
          processingTime,
          error: data.error || 'No EBA results found'
        };
        
        job.results.push(result);
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      job.errors.push({
        employerId,
        employerName,
        error: errorMessage,
        timestamp: new Date(),
        retryable: !errorMessage.includes('timeout')
      });
      
      const result: FwcLookupResult = {
        employerId,
        employerName,
        success: false,
        fwcResults: [],
        processingTime,
        error: errorMessage
      };
      
      job.results.push(result);
    }
  }

  /**
   * Update employer EBA record with FWC data
   */
  private async updateEmployerEbaRecord(
    employerId: string, 
    fwcResult: FWCSearchResult
  ): Promise<void> {
    try {
      // Check if EBA record exists
      const { data: existingRecord } = await supabase
        .from('company_eba_records')
        .select('id')
        .eq('employer_id', employerId)
        .maybeSingle();
      
      const updateData = {
        fwc_document_url: fwcResult.documentUrl,
        fwc_lodgement_number: fwcResult.lodgementNumber,
        fwc_certified_date: fwcResult.approvedDate,
        nominal_expiry_date: fwcResult.expiryDate,
        comments: existingRecord ? 
          `Updated from FWC search. Agreement: ${fwcResult.title}. Status: ${fwcResult.status}.` :
          `Auto-imported from FWC search. Agreement: ${fwcResult.title}. Status: ${fwcResult.status}.`
      };
      
      if (existingRecord) {
        // Update existing record
        await supabase
          .from('company_eba_records')
          .update(updateData)
          .eq('id', existingRecord.id);
      } else {
        // Create new record
        await supabase
          .from('company_eba_records')
          .insert({
            employer_id: employerId,
            eba_file_number: fwcResult.title.substring(0, 100),
            ...updateData
          });
      }
      
      // Update employer EBA status
      await supabase
        .from('employers')
        .update({ enterprise_agreement_status: true })
        .eq('id', employerId);
        
    } catch (error) {
      console.error('Failed to update EBA record:', error);
      // Don't throw - this is a secondary operation
    }
  }

  /**
   * Filter employers that don't have FWC document URLs
   */
  private async filterEmployersWithoutFwcData(employerIds: string[]): Promise<string[]> {
    try {
      const { data: employersWithFwc } = await supabase
        .from('company_eba_records')
        .select('employer_id')
        .in('employer_id', employerIds)
        .not('fwc_document_url', 'is', null);
      
      const employersWithFwcSet = new Set(
        (employersWithFwc || []).map(record => record.employer_id)
      );
      
      return employerIds.filter(id => !employersWithFwcSet.has(id));
    } catch (error) {
      console.warn('Failed to filter employers with FWC data:', error);
      return employerIds; // Return all if filtering fails
    }
  }

  /**
   * Get job summary statistics
   */
  getJobSummary(jobId: string): FwcLookupJobSummary | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;
    
    const successfulLookups = job.results.filter(r => r.success).length;
    const failedLookups = job.results.filter(r => !r.success).length;
    const totalProcessingTime = job.results.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = job.results.length > 0 ? 
      totalProcessingTime / job.results.length : 0;
    
    const totalDuration = job.completedAt && job.startedAt ? 
      job.completedAt.getTime() - job.startedAt.getTime() : 0;
    
    return {
      jobId: job.id,
      totalEmployers: job.progress.total,
      processedEmployers: job.progress.completed,
      successfulLookups,
      failedLookups,
      skippedEmployers: job.progress.total - job.results.length,
      averageProcessingTime,
      totalDuration,
      status: job.status
    };
  }

  /**
   * Save job to database for persistence
   */
  private async saveJobToDatabase(job: FwcLookupJob, options: FwcLookupJobOptions): Promise<void> {
    try {
      await supabase
        .from('fwc_lookup_jobs')
        .insert({
          id: job.id,
          employer_ids: job.employerIds,
          status: job.status,
          priority: job.priority,
          progress_completed: job.progress.completed,
          progress_total: job.progress.total,
          batch_size: job.batchSize,
          created_at: job.createdAt.toISOString(),
          estimated_duration: job.estimatedDuration,
          options: options
        });
    } catch (error) {
      console.error('Failed to save job to database:', error);
      // Don't throw - job can still run in memory
    }
  }

  /**
   * Update job in database
   */
  private async updateJobInDatabase(job: FwcLookupJob): Promise<void> {
    try {
      await supabase
        .from('fwc_lookup_jobs')
        .update({
          status: job.status,
          progress_completed: job.progress.completed,
          current_employer: job.progress.currentEmployer,
          started_at: job.startedAt?.toISOString(),
          completed_at: job.completedAt?.toISOString()
        })
        .eq('id', job.id);
    } catch (error) {
      console.error('Failed to update job in database:', error);
      // Don't throw - job can still run in memory
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
