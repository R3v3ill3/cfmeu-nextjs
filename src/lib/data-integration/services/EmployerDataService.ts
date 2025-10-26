/**
 * Employer Data Integration Service
 * Handles synchronization of employer data between legacy CFMEU systems
 * and the new traffic light rating system
 */

import { supabase } from '@/integrations/supabase/client';
import {
  LegacyEmployer,
  EmployerRatingData,
  EmployerIntegrationMapping,
  SyncOperation,
  DataTransformation,
  IntegrationConfig,
  DataConflict,
  SyncMetrics
} from '../types/IntegrationTypes';
import { MigrationMetrics, DataLineageRecord, AuditLog } from '../types/MigrationTypes';

export interface EmployerSyncOptions {
  batchSize?: number;
  skipValidation?: boolean;
  includeInactive?: boolean;
  lastSyncAfter?: string;
  updateOnly?: boolean;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
}

export interface EmployerSyncResult {
  totalProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflicts: DataConflict[];
  metrics: SyncMetrics;
  duration: number;
  errors: Array<{
    employerId: string;
    error: string;
    phase: 'extraction' | 'transformation' | 'validation' | 'loading';
  }>;
}

export class EmployerDataService {
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly RATING_CALCULATION_WEIGHTS = {
    eba_compliance: 0.3,
    cbus_compliance: 0.2,
    incolink_compliance: 0.2,
    site_visit_performance: 0.15,
    historical_performance: 0.1,
    worker_welfare: 0.05
  };

  /**
   * Synchronizes employer data from legacy system to rating system
   */
  async syncEmployerData(options: EmployerSyncOptions = {}): Promise<EmployerSyncResult> {
    const startTime = Date.now();
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipValidation = false,
      includeInactive = false,
      lastSyncAfter,
      updateOnly = false,
      conflictResolution = 'target_wins'
    } = options;

    try {
      console.log('Starting employer data synchronization...');

      // Get existing mappings to avoid duplicates
      const existingMappings = await this.getExistingMappings();
      const mappedLegacyIds = new Set(existingMappings.map(m => m.legacyId));

      // Fetch legacy employers
      const legacyEmployers = await this.fetchLegacyEmployers({
        includeInactive,
        lastSyncAfter,
        excludeMapped: updateOnly ? Array.from(mappedLegacyIds) : undefined
      });

      console.log(`Found ${legacyEmployers.length} employers to process`);

      const result: EmployerSyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        conflicts: [],
        metrics: {
          source_table: 'employers',
          sync_date: new Date().toISOString(),
          total_records: legacyEmployers.length,
          successful_syncs: 0,
          failed_syncs: 0,
          average_processing_time: 0,
          data_quality_score: 0,
          conflict_count: 0,
          resolution_time: 0
        },
        duration: 0,
        errors: []
      };

      // Process in batches
      for (let i = 0; i < legacyEmployers.length; i += batchSize) {
        const batch = legacyEmployers.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(legacyEmployers.length / batchSize)}`);

        const batchResult = await this.processBatch(batch, {
          skipValidation,
          conflictResolution,
          existingMappings
        });

        this.aggregateBatchResult(result, batchResult);
      }

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.metrics.average_processing_time = result.duration / result.totalProcessed;
      result.metrics.successful_syncs = result.successfulSyncs;
      result.metrics.failed_syncs = result.failedSyncs;
      result.metrics.conflict_count = result.conflicts.length;

      // Log the synchronization
      await this.logSyncOperation(result);

      console.log(`Employer sync completed: ${result.successfulSyncs} successful, ${result.failedSyncs} failed`);
      return result;

    } catch (error) {
      console.error('Employer data synchronization failed:', error);
      throw new Error(`Employer sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes a batch of employers through the complete sync pipeline
   */
  private async processBatch(
    employers: LegacyEmployer[],
    options: {
      skipValidation: boolean;
      conflictResolution: string;
      existingMappings: EmployerIntegrationMapping[];
    }
  ): Promise<Partial<EmployerSyncResult>> {
    const batchResult: Partial<EmployerSyncResult> = {
      totalProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: [],
      errors: []
    };

    for (const employer of employers) {
      try {
        batchResult.totalProcessed = (batchResult.totalProcessed || 0) + 1;

        // Extract and transform data
        const transformedData = await this.transformEmployerData(employer);

        // Validate data if not skipped
        if (!options.skipValidation) {
          const validation = await this.validateEmployerData(transformedData);
          if (!validation.isValid) {
            batchResult.errors?.push({
              employerId: employer.id,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              phase: 'validation'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Check for conflicts
        const conflicts = await this.detectConflicts(employer, transformedData);
        if (conflicts.length > 0) {
          batchResult.conflicts = [...(batchResult.conflicts || []), ...conflicts];

          const resolvedConflicts = await this.resolveConflicts(conflicts, options.conflictResolution);
          if (!resolvedConflicts.allResolved) {
            batchResult.errors?.push({
              employerId: employer.id,
              error: `Unresolved conflicts: ${resolvedConflicts.unresolved.join(', ')}`,
              phase: 'loading'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Load the data
        await this.loadEmployerData(transformedData, employer);
        batchResult.successfulSyncs = (batchResult.successfulSyncs || 0) + 1;

      } catch (error) {
        console.error(`Failed to process employer ${employer.id}:`, error);
        batchResult.errors?.push({
          employerId: employer.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'transformation'
        });
        batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
      }
    }

    return batchResult;
  }

  /**
   * Fetches legacy employers from the source system
   */
  private async fetchLegacyEmployers(options: {
    includeInactive?: boolean;
    lastSyncAfter?: string;
    excludeMapped?: string[];
  }): Promise<LegacyEmployer[]> {
    try {
      let query = supabase
        .from('employers')
        .select(`
          *,
          employer_aliases(alias, alias_normalized, is_authoritative),
          company_eba_records(status, start_date, end_date),
          compliance_checks(status, check_type, checked_at),
          project_assignments(project_id, assignment_type, role_type)
        `);

      // Apply filters
      if (options.lastSyncAfter) {
        query = query.gte('updated_at', options.lastSyncAfter);
      }

      if (options.excludeMapped && options.excludeMapped.length > 0) {
        query = query.not('id', 'in', `(${options.excludeMapped.join(',')})`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch legacy employers: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacyEmployer);

    } catch (error) {
      console.error('Error fetching legacy employers:', error);
      throw error;
    }
  }

  /**
   * Transforms legacy employer data to the rating system format
   */
  private async transformEmployerData(legacy: LegacyEmployer): Promise<{
    employer: any;
    rating: EmployerRatingData;
    mapping: EmployerIntegrationMapping;
  }> {
    try {
      // Calculate rating scores based on various factors
      const ebaScore = await this.calculateEbaComplianceScore(legacy);
      const cbusScore = await this.calculateCbusComplianceScore(legacy);
      const incolinkScore = await this.calculateIncolinkComplianceScore(legacy);
      const siteVisitScore = await this.calculateSiteVisitScore(legacy);
      const historicalScore = await this.calculateHistoricalPerformanceScore(legacy);
      const welfareScore = await this.calculateWorkerWelfareScore(legacy);

      // Calculate overall rating
      const overallRating = this.calculateOverallRating({
        eba_compliance: ebaScore,
        cbus_compliance: cbusScore,
        incolink_compliance: incolinkScore,
        site_visit_performance: siteVisitScore,
        historical_performance: historicalScore,
        worker_welfare: welfareScore
      });

      // Transform employer data
      const employerData = {
        id: legacy.id,
        name: legacy.name.trim(),
        abn: legacy.abn || null,
        employer_type: legacy.employer_type,
        enterprise_agreement_status: legacy.enterprise_agreement_status || false,
        eba_status_source: legacy.eba_status_source || null,
        eba_status_updated_at: legacy.eba_status_updated_at || null,
        contact_email: legacy.contact_email || null,
        contact_phone: legacy.contact_phone || null,
        address: legacy.address || null,
        suburb: legacy.suburb || null,
        state: legacy.state || null,
        postcode: legacy.postcode || null,
        created_at: legacy.created_at,
        updated_at: new Date().toISOString(),
        // Additional fields for rating system
        estimated_worker_count: await this.estimateWorkerCount(legacy),
        last_rating_calculation: new Date().toISOString(),
        data_quality_score: await this.calculateDataQualityScore(legacy)
      };

      // Create rating data
      const ratingData: EmployerRatingData = {
        id: this.generateRatingId(legacy.id),
        employer_id: legacy.id,
        overall_rating: overallRating,
        eba_compliance_score: ebaScore,
        cbus_compliance_score: cbusScore,
        incolink_compliance_score: incolinkScore,
        site_visit_score: siteVisitScore,
        historical_performance_score: historicalScore,
        worker_welfare_score: welfareScore,
        total_projects: await this.getTotalProjects(legacy.id),
        active_projects: await this.getActiveProjects(legacy.id),
        last_updated: new Date().toISOString(),
        data_quality_score: employerData.data_quality_score
      };

      // Create mapping record
      const mappingData: EmployerIntegrationMapping = {
        legacyId: legacy.id,
        ratingId: ratingData.id,
        mappedAt: new Date().toISOString(),
        mappedBy: 'system',
        confidence: await this.calculateMappingConfidence(legacy),
        verificationStatus: 'verified'
      };

      return {
        employer: employerData,
        rating: ratingData,
        mapping: mappingData
      };

    } catch (error) {
      console.error('Error transforming employer data:', error);
      throw new Error(`Data transformation failed for employer ${legacy.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates transformed employer data
   */
  private async validateEmployerData(data: {
    employer: any;
    rating: EmployerRatingData;
    mapping: EmployerIntegrationMapping;
  }): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate employer data
      if (!data.employer.name || data.employer.name.trim().length === 0) {
        errors.push('Employer name is required');
      }

      if (!data.employer.employer_type) {
        errors.push('Employer type is required');
      }

      if (data.employer.abn && !this.isValidABN(data.employer.abn)) {
        errors.push('Invalid ABN format');
      }

      // Validate rating data
      if (data.rating.overall_rating && !['green', 'amber', 'red'].includes(data.rating.overall_rating)) {
        errors.push('Invalid overall rating value');
      }

      const scores = [
        data.rating.eba_compliance_score,
        data.rating.cbus_compliance_score,
        data.rating.incolink_compliance_score,
        data.rating.site_visit_score,
        data.rating.historical_performance_score,
        data.rating.worker_welfare_score
      ];

      for (const score of scores) {
        if (score < 0 || score > 100) {
          errors.push('All compliance scores must be between 0 and 100');
          break;
        }
      }

      // Validate mapping data
      if (!data.mapping.legacyId || !data.mapping.ratingId) {
        errors.push('Mapping requires both legacy and rating IDs');
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('Error validating employer data:', error);
      return {
        isValid: false,
        errors: ['Validation process failed']
      };
    }
  }

  /**
   * Detects conflicts between existing and new data
   */
  private async detectConflicts(
    legacy: LegacyEmployer,
    transformed: { employer: any; rating: EmployerRatingData }
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for existing employer with same name but different ID
      const { data: existingEmployer } = await supabase
        .from('employers')
        .select('id, name, updated_at')
        .eq('name', transformed.employer.name)
        .neq('id', legacy.id)
        .maybeSingle();

      if (existingEmployer) {
        conflicts.push({
          id: this.generateConflictId(),
          source_table: 'employers',
          target_table: 'employers',
          record_id: legacy.id,
          field_name: 'name',
          source_value: legacy.name,
          target_value: existingEmployer.name,
          conflict_type: 'value_mismatch',
          severity: 'medium',
          status: 'pending',
          detected_at: new Date().toISOString()
        });
      }

      // Check for rating data conflicts
      const { data: existingRating } = await supabase
        .from('employer_final_ratings')
        .select('id, overall_rating, updated_at')
        .eq('employer_id', legacy.id)
        .maybeSingle();

      if (existingRating && existingRating.overall_rating !== transformed.rating.overall_rating) {
        conflicts.push({
          id: this.generateConflictId(),
          source_table: 'employer_final_ratings',
          target_table: 'employer_final_ratings',
          record_id: legacy.id,
          field_name: 'overall_rating',
          source_value: transformed.rating.overall_rating,
          target_value: existingRating.overall_rating,
          conflict_type: 'value_mismatch',
          severity: 'high',
          status: 'pending',
          detected_at: new Date().toISOString()
        });
      }

      return conflicts;

    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return [];
    }
  }

  /**
   * Loads transformed data into the target system
   */
  private async loadEmployerData(
    transformed: { employer: any; rating: EmployerRatingData; mapping: EmployerIntegrationMapping },
    legacy: LegacyEmployer
  ): Promise<void> {
    try {
      // Use a transaction to ensure data consistency
      const { error: transactionError } = await supabase.rpc('execute_employer_sync_transaction', {
        p_employer_data: transformed.employer,
        p_rating_data: transformed.rating,
        p_mapping_data: transformed.mapping,
        p_legacy_id: legacy.id
      });

      if (transactionError) {
        throw new Error(`Transaction failed: ${transactionError.message}`);
      }

      // Create data lineage record
      await this.createDataLineageRecord(transformed, legacy);

    } catch (error) {
      console.error('Error loading employer data:', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods for Score Calculations
  // ============================================================================

  private async calculateEbaComplianceScore(legacy: LegacyEmployer): Promise<number> {
    try {
      // Check for EBA records
      if (legacy.enterprise_agreement_status) {
        return 100;
      }

      // Look for recent EBA activity
      const { data: ebaRecords } = await supabase
        .from('company_eba_records')
        .select('status, end_date')
        .eq('employer_id', legacy.id)
        .order('end_date', { ascending: false })
        .limit(1);

      if (ebaRecords && ebaRecords.length > 0) {
        const record = ebaRecords[0];
        if (record.status === 'active' || record.status === 'certified') {
          return 100;
        } else if (record.end_date && new Date(record.end_date) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
          return 75; // Expired but within last year
        }
      }

      return 0; // No EBA records

    } catch (error) {
      console.error('Error calculating EBA compliance score:', error);
      return 0;
    }
  }

  private async calculateCbusComplianceScore(legacy: LegacyEmployer): Promise<number> {
    try {
      const { data: complianceChecks } = await supabase
        .from('compliance_checks')
        .select('status, checked_at')
        .eq('employer_id', legacy.id)
        .eq('check_type', 'cbus')
        .order('checked_at', { ascending: false })
        .limit(1);

      if (complianceChecks && complianceChecks.length > 0) {
        const check = complianceChecks[0];
        if (check.status === 'compliant') return 100;
        if (check.status === 'pending') return 50;
        if (check.status === 'exempt') return 90;
      }

      return 50; // Unknown status

    } catch (error) {
      console.error('Error calculating CBUS compliance score:', error);
      return 50;
    }
  }

  private async calculateIncolinkComplianceScore(legacy: LegacyEmployer): Promise<number> {
    try {
      const { data: complianceChecks } = await supabase
        .from('compliance_checks')
        .select('status, checked_at')
        .eq('employer_id', legacy.id)
        .eq('check_type', 'incolink')
        .order('checked_at', { ascending: false })
        .limit(1);

      if (complianceChecks && complianceChecks.length > 0) {
        const check = complianceChecks[0];
        if (check.status === 'compliant') return 100;
        if (check.status === 'pending') return 50;
        if (check.status === 'exempt') return 90;
      }

      return 50; // Unknown status

    } catch (error) {
      console.error('Error calculating Incolink compliance score:', error);
      return 50;
    }
  }

  private async calculateSiteVisitScore(legacy: LegacyEmployer): Promise<number> {
    try {
      // Get recent site visits for this employer
      const { data: siteVisits } = await supabase
        .from('site_visits')
        .select('compliance_score, visit_date')
        .eq('employer_id', legacy.id)
        .gte('visit_date', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()) // Last 6 months
        .order('visit_date', { ascending: false });

      if (siteVisits && siteVisits.length > 0) {
        // Weight more recent visits more heavily
        const weightedScores = siteVisits.map((visit, index) => {
          const weight = Math.pow(0.9, index); // Decay factor
          return (visit.compliance_score || 50) * weight;
        });

        const totalWeight = siteVisits.reduce((sum, _, index) => sum + Math.pow(0.9, index), 0);
        return Math.round(weightedScores.reduce((sum, score) => sum + score, 0) / totalWeight);
      }

      return 70; // No recent site visits - neutral score

    } catch (error) {
      console.error('Error calculating site visit score:', error);
      return 70;
    }
  }

  private async calculateHistoricalPerformanceScore(legacy: LegacyEmployer): Promise<number> {
    try {
      // Look at project history and completion rates
      const { data: projects } = await supabase
        .from('project_assignments')
        .select(`
          projects!inner(status, end_date),
          assignment_type
        `)
        .eq('employer_id', legacy.id);

      if (projects && projects.length > 0) {
        const completedProjects = projects.filter(p =>
          p.projects && (p.projects.status === 'completed' || p.projects.status === 'finished')
        );

        const completionRate = completedProjects.length / projects.length;
        return Math.round(completionRate * 100);
      }

      return 70; // No project history

    } catch (error) {
      console.error('Error calculating historical performance score:', error);
      return 70;
    }
  }

  private async calculateWorkerWelfareScore(legacy: LegacyEmployer): Promise<number> {
    try {
      // Look at worker placements and any welfare issues
      const { data: placements } = await supabase
        .from('worker_placements')
        .select('status, end_date')
        .eq('employer_id', legacy.id)
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()); // Last year

      if (placements && placements.length > 0) {
        const successfulPlacements = placements.filter(p =>
          p.status === 'completed' || p.status === 'active'
        );

        const successRate = successfulPlacements.length / placements.length;
        return Math.round(successRate * 100);
      }

      return 80; // No placement data

    } catch (error) {
      console.error('Error calculating worker welfare score:', error);
      return 80;
    }
  }

  private calculateOverallRating(scores: {
    [key: string]: number;
  }): 'green' | 'amber' | 'red' {
    let weightedScore = 0;

    for (const [factor, score] of Object.entries(scores)) {
      const weight = this.RATING_CALCULATION_WEIGHTS[factor as keyof typeof this.RATING_CALCULATION_WEIGHTS] || 0;
      weightedScore += score * weight;
    }

    if (weightedScore >= 80) return 'green';
    if (weightedScore >= 60) return 'amber';
    return 'red';
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async getExistingMappings(): Promise<EmployerIntegrationMapping[]> {
    try {
      const { data, error } = await supabase
        .from('employer_integration_mappings')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching existing mappings:', error);
      return [];
    }
  }

  private mapToLegacyEmployer(data: any): LegacyEmployer {
    return {
      id: data.id,
      name: data.name,
      abn: data.abn,
      employer_type: data.employer_type,
      enterprise_agreement_status: data.enterprise_agreement_status,
      eba_status_source: data.eba_status_source,
      eba_status_updated_at: data.eba_status_updated_at,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      address: data.address,
      suburb: data.suburb,
      state: data.state,
      postcode: data.postcode,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  private isValidABN(abn: string): boolean {
    // Basic ABN validation - 11 digits
    const abnRegex = /^(\d{11})$/;
    return abnRegex.test(abn.replace(/\s/g, ''));
  }

  private generateRatingId(legacyId: string): string {
    return `rating_${legacyId}_${Date.now()}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async estimateWorkerCount(legacy: LegacyEmployer): Promise<number> {
    // Estimate based on project count and employer type
    const projectCount = await this.getTotalProjects(legacy.id);

    const baseCount = {
      'builder': 20,
      'head_contractor': 15,
      'subcontractor': 8,
      'supplier': 5,
      'labour_hire': 25
    }[legacy.employer_type] || 10;

    return Math.round(baseCount * (1 + projectCount * 0.1));
  }

  private async getTotalProjects(employerId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', employerId);

      return count || 0;
    } catch (error) {
      console.error('Error getting total projects:', error);
      return 0;
    }
  }

  private async getActiveProjects(employerId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('project_assignments')
        .select(`
          projects!inner(status)
        `, { count: 'exact', head: true })
        .eq('employer_id', employerId)
        .in('projects.status', ['active', 'in_progress', 'planning']);

      return count || 0;
    } catch (error) {
      console.error('Error getting active projects:', error);
      return 0;
    }
  }

  private async calculateDataQualityScore(legacy: LegacyEmployer): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Check for required fields
    const fields = [
      { field: 'name', weight: 20 },
      { field: 'employer_type', weight: 15 },
      { field: 'abn', weight: 10 },
      { field: 'contact_email', weight: 10 },
      { field: 'contact_phone', weight: 10 },
      { field: 'address', weight: 10 },
      { field: 'suburb', weight: 5 },
      { field: 'state', weight: 5 },
      { field: 'postcode', weight: 5 },
      { field: 'enterprise_agreement_status', weight: 10 }
    ];

    for (const { field, weight } of fields) {
      maxScore += weight;
      if (legacy[field as keyof LegacyEmployer]) {
        score += weight;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  private async calculateMappingConfidence(legacy: LegacyEmployer): Promise<number> {
    let confidence = 50; // Base confidence

    // Increase confidence based on data completeness
    if (legacy.abn) confidence += 20;
    if (legacy.contact_email) confidence += 10;
    if (legacy.address) confidence += 10;
    if (legacy.enterprise_agreement_status !== undefined) confidence += 10;

    return Math.min(confidence, 100);
  }

  private async resolveConflicts(
    conflicts: DataConflict[],
    strategy: string
  ): Promise<{ allResolved: boolean; unresolved: string[] }> {
    const unresolved: string[] = [];

    for (const conflict of conflicts) {
      try {
        switch (strategy) {
          case 'source_wins':
            await this.applySourceResolution(conflict);
            break;
          case 'target_wins':
            await this.applyTargetResolution(conflict);
            break;
          case 'manual':
            unresolved.push(`Manual review needed for ${conflict.field_name}`);
            break;
          default:
            unresolved.push(`Unknown resolution strategy: ${strategy}`);
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
        unresolved.push(conflict.id);
      }
    }

    return {
      allResolved: unresolved.length === 0,
      unresolved
    };
  }

  private async applySourceResolution(conflict: DataConflict): Promise<void> {
    // Update target with source value
    const { error } = await supabase
      .from(conflict.target_table)
      .update({ [conflict.field_name]: conflict.source_value })
      .eq('id', conflict.record_id);

    if (error) throw error;

    // Mark conflict as resolved
    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_source',
          resolved_by: 'system',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  private async applyTargetResolution(conflict: DataConflict): Promise<void> {
    // Keep target value, mark conflict as resolved
    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_target',
          resolved_by: 'system',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  private aggregateBatchResult(
    mainResult: EmployerSyncResult,
    batchResult: Partial<EmployerSyncResult>
  ): void {
    mainResult.totalProcessed += batchResult.totalProcessed || 0;
    mainResult.successfulSyncs += batchResult.successfulSyncs || 0;
    mainResult.failedSyncs += batchResult.failedSyncs || 0;
    mainResult.conflicts.push(...(batchResult.conflicts || []));
    mainResult.errors.push(...(batchResult.errors || []));
  }

  private async createDataLineageRecord(
    transformed: { employer: any; rating: EmployerRatingData; mapping: EmployerIntegrationMapping },
    legacy: LegacyEmployer
  ): Promise<void> {
    try {
      const lineageRecord: DataLineageRecord = {
        id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_record_id: legacy.id,
        source_table: 'employers',
        target_record_id: transformed.rating.id,
        target_table: 'employer_final_ratings',
        transformation_applied: JSON.stringify({
          employer_fields: Object.keys(transformed.employer),
          rating_calculations: Object.keys(transformed.rating).filter(k => k.includes('_score'))
        }),
        migration_id: `employer_sync_${new Date().toISOString().split('T')[0]}`,
        transformed_at: new Date().toISOString(),
        transformation_hash: this.generateDataHash(transformed),
        quality_score: transformed.rating.data_quality_score,
        confidence_level: transformed.mapping.confidence
      };

      await supabase
        .from('data_lineage_records')
        .insert(lineageRecord);

    } catch (error) {
      console.error('Error creating data lineage record:', error);
      // Don't throw - this is not critical
    }
  }

  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private async logSyncOperation(result: EmployerSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        migration_id: `employer_sync_${new Date().toISOString().split('T')[0]}`,
        action: 'employer_data_synchronization',
        actor: 'system',
        object_type: 'migration',
        object_id: 'employer_sync_batch',
        new_values: {
          total_processed: result.totalProcessed,
          successful_syncs: result.successfulSyncs,
          failed_syncs: result.failedSyncs,
          conflicts: result.conflicts.length,
          duration: result.duration,
          metrics: result.metrics
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging sync operation:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get current sync status for monitoring
   */
  async getSyncStatus(): Promise<{
    lastSync: string | null;
    totalEmployers: number;
    syncedEmployers: number;
    pendingConflicts: number;
    averageDataQuality: number;
  }> {
    try {
      const [
        { data: lastSync },
        { count: totalEmployers },
        { count: syncedEmployers },
        { count: pendingConflicts },
        { data: qualityMetrics }
      ] = await Promise.all([
        supabase
          .from('sync_metrics')
          .select('sync_date')
          .eq('source_table', 'employers')
          .order('sync_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('employers')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('employer_integration_mappings')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('data_conflicts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('data_quality_metrics')
          .select('overall_quality_score')
          .eq('table_name', 'employer_final_ratings')
          .order('last_assessed', { ascending: false })
          .limit(1)
          .single()
      ]);

      return {
        lastSync: lastSync?.sync_date || null,
        totalEmployers: totalEmployers || 0,
        syncedEmployers: syncedEmployers || 0,
        pendingConflicts: pendingConflicts || 0,
        averageDataQuality: qualityMetrics?.overall_quality_score || 0
      };

    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        lastSync: null,
        totalEmployers: 0,
        syncedEmployers: 0,
        pendingConflicts: 0,
        averageDataQuality: 0
      };
    }
  }
}

// Export singleton instance
export const employerDataService = new EmployerDataService();