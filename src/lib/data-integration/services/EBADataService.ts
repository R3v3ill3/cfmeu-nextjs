/**
 * EBA Data Integration Service
 * Handles synchronization of Enterprise Bargaining Agreement data
 * between legacy CFMEU systems and the traffic light rating system
 */

import { supabase } from '@/integrations/supabase/client';
import {
  LegacyEbaRecord,
  EbaRatingFactor,
  SyncOperation,
  DataTransformation,
  IntegrationConfig,
  DataConflict,
  SyncMetrics
} from '../types/IntegrationTypes';
import { MigrationMetrics, DataLineageRecord, AuditLog } from '../types/MigrationTypes';

export interface EbaSyncOptions {
  batchSize?: number;
  skipValidation?: boolean;
  includeExpired?: boolean;
  lastSyncAfter?: string;
  employerIds?: string[];
  ebaTypes?: string[];
  updateFactorsOnly?: boolean;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
  includeHistorical?: boolean;
  historicalYears?: number;
}

export interface EbaSyncResult {
  totalProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  factorsUpdated: number;
  conflicts: DataConflict[];
  metrics: SyncMetrics;
  duration: number;
  errors: Array<{
    ebaId?: string;
    employerId?: string;
    error: string;
    phase: 'extraction' | 'transformation' | 'validation' | 'loading';
  }>;
  ebaSummary: {
    byType: Record<string, {
      total: number;
      active: number;
      expired: number;
      pending: number;
      averageCoverage: number;
    }>;
    overallMetrics: {
      totalAgreements: number;
      activeRate: number;
      averageCoverage: number;
      expiringNextQuarter: number;
      employersWithEba: number;
      employersWithoutEba: number;
    };
    coverageByEmployerSize: Record<string, {
      employerCount: number;
      withEba: number;
      averageCoverage: number;
    }>;
  };
}

export class EbaDataService {
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly EBA_COVERAGE_THRESHOLDS = {
    excellent: 95,
    good: 80,
    adequate: 60,
    poor: 40
  };

  private readonly EBA_WEIGHTS = {
    certification_status: 0.35,
    coverage_level: 0.25,
    time_to_expiry: 0.20,
    worker_count: 0.10,
    verification_level: 0.10
  };

  private readonly EBA_STATUS_MAPPINGS: Record<string, 'certified' | 'negotiating' | 'expired' | 'none'> = {
    'active': 'certified',
    'certified': 'certified',
    'current': 'certified',
    'negotiating': 'negotiating',
    'pending': 'negotiating',
    'under_negotiation': 'negotiating',
    'expired': 'expired',
    'lapsed': 'expired',
    'terminated': 'expired',
    'none': 'none',
    'no_eba': 'none',
    'unknown': 'none'
  };

  /**
   * Synchronizes EBA data from legacy system to rating system
   */
  async syncEbaData(options: EbaSyncOptions = {}): Promise<EbaSyncResult> {
    const startTime = Date.now();
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipValidation = false,
      includeExpired = false,
      lastSyncAfter,
      employerIds,
      ebaTypes,
      updateFactorsOnly = false,
      conflictResolution = 'target_wins',
      includeHistorical = false,
      historicalYears = 3
    } = options;

    try {
      console.log('Starting EBA data synchronization...');

      const result: EbaSyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        factorsUpdated: 0,
        conflicts: [],
        metrics: {
          source_table: 'company_eba_records',
          sync_date: new Date().toISOString(),
          total_records: 0,
          successful_syncs: 0,
          failed_syncs: 0,
          average_processing_time: 0,
          data_quality_score: 0,
          conflict_count: 0,
          resolution_time: 0
        },
        duration: 0,
        errors: [],
        ebaSummary: {
          byType: {},
          overallMetrics: {
            totalAgreements: 0,
            activeRate: 0,
            averageCoverage: 0,
            expiringNextQuarter: 0,
            employersWithEba: 0,
            employersWithoutEba: 0
          },
          coverageByEmployerSize: {}
        }
      };

      if (!updateFactorsOnly) {
        // Sync EBA records
        const ebaRecords = await this.fetchEbaRecords({
          includeExpired,
          lastSyncAfter,
          employerIds,
          ebaTypes,
          includeHistorical,
          historicalYears
        });

        console.log(`Found ${ebaRecords.length} EBA records to process`);
        result.metrics.total_records = ebaRecords.length;

        // Process in batches
        for (let i = 0; i < ebaRecords.length; i += batchSize) {
          const batch = ebaRecords.slice(i, i + batchSize);
          console.log(`Processing EBA batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ebaRecords.length / batchSize)}`);

          const batchResult = await this.processEbaBatch(batch, {
            skipValidation,
            conflictResolution
          });

          this.aggregateBatchResult(result, batchResult);
        }
      }

      // Update EBA rating factors
      console.log('Updating EBA rating factors...');
      const factorResult = await this.updateEbaFactors({
        employerIds,
        batchSize
      });

      this.aggregateFactorResult(result, factorResult);

      // Calculate EBA summary
      result.ebaSummary = await this.calculateEbaSummary(employerIds);

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.metrics.average_processing_time = result.duration / Math.max(result.totalProcessed, 1);
      result.metrics.successful_syncs = result.successfulSyncs + result.factorsUpdated;
      result.metrics.failed_syncs = result.failedSyncs;
      result.metrics.conflict_count = result.conflicts.length;

      // Log the synchronization
      await this.logEbaSyncOperation(result);

      console.log(`EBA sync completed: ${result.successfulSyncs} records, ${result.factorsUpdated} factors updated`);
      return result;

    } catch (error) {
      console.error('EBA data synchronization failed:', error);
      throw new Error(`EBA sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches EBA records from the source system
   */
  private async fetchEbaRecords(options: {
    includeExpired?: boolean;
    lastSyncAfter?: string;
    employerIds?: string[];
    ebaTypes?: string[];
    includeHistorical?: boolean;
    historicalYears?: number;
  }): Promise<LegacyEbaRecord[]> {
    try {
      let query = supabase
        .from('company_eba_records')
        .select(`
          *,
          employers!inner(
            name,
            employer_type,
            estimated_worker_count
          )
        `);

      // Apply filters
      if (!options.includeExpired) {
        query = query.or('end_date.is.null,end_date.gte.' + new Date().toISOString());
      }

      if (options.lastSyncAfter) {
        query = query.gte('updated_at', options.lastSyncAfter);
      }

      if (options.employerIds && options.employerIds.length > 0) {
        query = query.in('employer_id', options.employerIds);
      }

      if (options.ebaTypes && options.ebaTypes.length > 0) {
        query = query.in('eba_type', options.ebaTypes);
      }

      if (options.includeHistorical && options.historicalYears) {
        const historicalDate = new Date(Date.now() - options.historicalYears * 365 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', historicalDate.toISOString());
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch EBA records: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacyEbaRecord);

    } catch (error) {
      console.error('Error fetching EBA records:', error);
      throw error;
    }
  }

  /**
   * Processes a batch of EBA records through the sync pipeline
   */
  private async processEbaBatch(
    ebaRecords: LegacyEbaRecord[],
    options: {
      skipValidation: boolean;
      conflictResolution: string;
    }
  ): Promise<Partial<EbaSyncResult>> {
    const batchResult: Partial<EbaSyncResult> = {
      totalProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: [],
      errors: []
    };

    for (const ebaRecord of ebaRecords) {
      try {
        batchResult.totalProcessed = (batchResult.totalProcessed || 0) + 1;

        // Transform EBA data
        const transformedData = await this.transformEbaData(ebaRecord);

        // Validate data if not skipped
        if (!options.skipValidation) {
          const validation = await this.validateEbaData(transformedData);
          if (!validation.isValid) {
            batchResult.errors?.push({
              ebaId: ebaRecord.id,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              phase: 'validation'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Check for conflicts
        const conflicts = await this.detectEbaConflicts(ebaRecord, transformedData);
        if (conflicts.length > 0) {
          batchResult.conflicts = [...(batchResult.conflicts || []), ...conflicts];

          const resolvedConflicts = await this.resolveEbaConflicts(conflicts, options.conflictResolution);
          if (!resolvedConflicts.allResolved) {
            batchResult.errors?.push({
              ebaId: ebaRecord.id,
              error: `Unresolved conflicts: ${resolvedConflicts.unresolved.join(', ')}`,
              phase: 'loading'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Load the data
        await this.loadEbaData(transformedData, ebaRecord);
        batchResult.successfulSyncs = (batchResult.successfulSyncs || 0) + 1;

      } catch (error) {
        console.error(`Failed to process EBA record ${ebaRecord.id}:`, error);
        batchResult.errors?.push({
          ebaId: ebaRecord.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'transformation'
        });
        batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
      }
    }

    return batchResult;
  }

  /**
   * Updates EBA rating factors for all employers
   */
  private async updateEbaFactors(options: {
    employerIds?: string[];
    batchSize: number;
  }): Promise<Partial<EbaSyncResult>> {
    const result: Partial<EbaSyncResult> = {
      factorsUpdated: 0,
      errors: []
    };

    try {
      // Get employers to update
      const employers = await this.getEmployersForFactorUpdate(options.employerIds);
      console.log(`Updating EBA factors for ${employers.length} employers`);

      // Process employers in batches
      for (let i = 0; i < employers.length; i += options.batchSize) {
        const batch = employers.slice(i, i + options.batchSize);

        for (const employer of batch) {
          try {
            const factor = await this.calculateEmployerEbaFactor(employer.id);

            if (factor) {
              await this.saveEbaFactor(factor);
              result.factorsUpdated = (result.factorsUpdated || 0) + 1;
            }

            // Trigger rating recalculation
            await supabase.rpc('trigger_employer_rating_recalculation', {
              p_employer_id: employer.id
            });

          } catch (error) {
            console.error(`Failed to update EBA factors for employer ${employer.id}:`, error);
            result.errors?.push({
              employerId: employer.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              phase: 'loading'
            });
          }
        }
      }

      return result;

    } catch (error) {
      console.error('Error updating EBA factors:', error);
      throw error;
    }
  }

  /**
   * Transforms EBA record data to the rating system format
   */
  private async transformEbaData(legacy: LegacyEbaRecord): Promise<{
    eba: any;
    factor: EbaRatingFactor;
  }> {
    try {
      // Transform EBA record
      const ebaData = {
        id: legacy.id,
        employer_id: legacy.employer_id,
        eba_type: legacy.eba_type,
        status: legacy.status,
        start_date: legacy.start_date || null,
        end_date: legacy.end_date || null,
        coverage: legacy.coverage || 'unknown',
        last_updated: legacy.last_updated,
        source: legacy.source || 'legacy_system',
        verification_status: legacy.verification_status || 'unverified',
        created_at: legacy.last_updated, // Use last_updated as created_at for historical data
        updated_at: new Date().toISOString(),
        // Additional fields for rating system
        coverage_level: await this.calculateCoverageLevel(legacy.coverage),
        days_until_expiry: legacy.end_date ? this.calculateDaysUntilExpiry(legacy.end_date) : null,
        is_expiring_soon: legacy.end_date ? this.isExpiringSoon(legacy.end_date) : false,
        worker_coverage_estimate: await this.estimateWorkerCoverage(legacy),
        data_quality_score: await this.calculateEbaDataQuality(legacy),
        verification_confidence: await this.calculateVerificationConfidence(legacy)
      };

      // Create rating factor
      const factorData: EbaRatingFactor = {
        employer_id: legacy.employer_id,
        eba_status: this.normalizeEbaStatus(legacy.status),
        certification_date: this.getCertificationDate(legacy),
        expiry_date: legacy.end_date || null,
        coverage_level: ebaData.coverage_level,
        worker_count: await this.getWorkerCount(legacy.employer_id),
        compliance_score: await this.calculateEbaComplianceScore(legacy),
        last_verified: legacy.last_updated,
        verification_source: legacy.source || 'legacy_system'
      };

      return {
        eba: ebaData,
        factor: factorData
      };

    } catch (error) {
      console.error('Error transforming EBA data:', error);
      throw new Error(`EBA transformation failed for ${legacy.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates EBA factor for an employer
   */
  private async calculateEmployerEbaFactor(employerId: string): Promise<EbaRatingFactor | null> {
    try {
      // Get most recent EBA record for this employer
      const { data: latestEba } = await supabase
        .from('company_eba_records')
        .select('*')
        .eq('employer_id', employerId)
        .order('end_date', { ascending: false, nullsFirst: false })
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (latestEba) {
        const factor: EbaRatingFactor = {
          employer_id: employerId,
          eba_status: this.normalizeEbaStatus(latestEba.status),
          certification_date: this.getCertificationDate(latestEba),
          expiry_date: latestEba.end_date || null,
          coverage_level: await this.calculateCoverageLevel(latestEba.coverage),
          worker_count: await this.getWorkerCount(employerId),
          compliance_score: await this.calculateEbaComplianceScore(latestEba),
          last_verified: latestEba.last_updated,
          verification_source: latestEba.source || 'legacy_system'
        };

        return factor;
      } else {
        // No EBA data - create default factor
        const factor: EbaRatingFactor = {
          employer_id: employerId,
          eba_status: 'none',
          certification_date: null,
          expiry_date: null,
          coverage_level: 0,
          worker_count: await this.getWorkerCount(employerId),
          compliance_score: 0, // No EBA is treated as non-compliant
          last_verified: new Date().toISOString(),
          verification_source: 'system_default'
        };

        return factor;
      }
    } catch (error) {
      console.error(`Error calculating EBA factor for ${employerId}:`, error);
      return null;
    }
  }

  /**
   * Calculates EBA summary statistics
   */
  private async calculateEbaSummary(employerIds?: string[]): Promise<EbaSyncResult['ebaSummary']> {
    try {
      let query = supabase
        .from('company_eba_records')
        .select(`
          id,
          eba_type,
          status,
          coverage,
          end_date,
          employer_id,
          employers!inner(
            name,
            employer_type,
            estimated_worker_count
          )
        `);

      if (employerIds && employerIds.length > 0) {
        query = query.in('employer_id', employerIds);
      }

      const { data: ebaRecords } = await query;

      const summary: EbaSyncResult['ebaSummary'] = {
        byType: {},
        overallMetrics: {
          totalAgreements: 0,
          activeRate: 0,
          averageCoverage: 0,
          expiringNextQuarter: 0,
          employersWithEba: 0,
          employersWithoutEba: 0
        },
        coverageByEmployerSize: {}
      };

      if (!ebaRecords || ebaRecords.length === 0) {
        return summary;
      }

      // Calculate by EBA type
      const typeGroups = this.groupBy(ebaRecords, 'eba_type');
      for (const [ebaType, typeRecords] of Object.entries(typeGroups)) {
        const coverageLevels = await Promise.all(
          typeRecords.map(record => this.calculateCoverageLevel(record.coverage))
        );
        const activeCount = typeRecords.filter(r => this.isActiveEba(r.status, r.end_date)).length;

        summary.byType[ebaType] = {
          total: typeRecords.length,
          active: activeCount,
          expired: typeRecords.filter(r => r.status === 'expired' || (r.end_date && new Date(r.end_date) < new Date())).length,
          pending: typeRecords.filter(r => ['negotiating', 'pending'].includes(r.status)).length,
          averageCoverage: coverageLevels.reduce((sum, level) => sum + level, 0) / coverageLevels.length
        };
      }

      // Calculate overall metrics
      const now = new Date();
      const nextQuarter = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const activeEbas = ebaRecords.filter(r => this.isActiveEba(r.status, r.end_date));
      const allCoverageLevels = await Promise.all(
        ebaRecords.map(record => this.calculateCoverageLevel(record.coverage))
      );

      const employersWithEba = new Set(ebaRecords.map(r => r.employer_id));

      // Get total unique employers
      let totalEmployers = 0;
      if (employerIds && employerIds.length > 0) {
        totalEmployers = employerIds.length;
      } else {
        const { count } = await supabase
          .from('employers')
          .select('*', { count: 'exact', head: true });
        totalEmployers = count || 0;
      }

      summary.overallMetrics = {
        totalAgreements: ebaRecords.length,
        activeRate: (activeEbas.length / Math.max(ebaRecords.length, 1)) * 100,
        averageCoverage: allCoverageLevels.reduce((sum, level) => sum + level, 0) / allCoverageLevels.length,
        expiringNextQuarter: ebaRecords.filter(r =>
          r.end_date && new Date(r.end_date) <= nextQuarter && new Date(r.end_date) > now
        ).length,
        employersWithEba: employersWithEba.size,
        employersWithoutEba: totalEmployers - employersWithEba.size
      };

      // Calculate coverage by employer size
      const employerSizeGroups = this.groupBy(ebaRecords, r => {
        const workerCount = r.employers?.estimated_worker_count || 0;
        if (workerCount >= 100) return 'large';
        if (workerCount >= 20) return 'medium';
        return 'small';
      });

      for (const [size, sizeRecords] of Object.entries(employerSizeGroups)) {
        const uniqueEmployers = new Set(sizeRecords.map(r => r.employer_id));
        const coverageLevels = await Promise.all(
          sizeRecords.map(record => this.calculateCoverageLevel(record.coverage))
        );

        summary.coverageByEmployerSize[size] = {
          employerCount: uniqueEmployers.size,
          withEba: uniqueEmployers.size,
          averageCoverage: coverageLevels.reduce((sum, level) => sum + level, 0) / coverageLevels.length
        };
      }

      return summary;

    } catch (error) {
      console.error('Error calculating EBA summary:', error);
      return {
        byType: {},
        overallMetrics: {
          totalAgreements: 0,
          activeRate: 0,
          averageCoverage: 0,
          expiringNextQuarter: 0,
          employersWithEba: 0,
          employersWithoutEba: 0
        },
        coverageByEmployerSize: {}
      };
    }
  }

  // ============================================================================
  // Helper Methods for EBA Calculations
  // ============================================================================

  private normalizeEbaStatus(status: string): 'certified' | 'negotiating' | 'expired' | 'none' {
    return this.EBA_STATUS_MAPPINGS[status.toLowerCase()] || 'none';
  }

  private getCertificationDate(eba: LegacyEbaRecord): string | null {
    if (eba.status === 'certified' || eba.status === 'active') {
      return eba.start_date || null;
    }
    return null;
  }

  private async calculateCoverageLevel(coverage?: string): Promise<number> {
    if (!coverage || coverage === 'unknown' || coverage === 'none') return 0;

    const coverageMap: Record<string, number> = {
      'full': 100,
      'comprehensive': 95,
      'complete': 90,
      'partial': 60,
      'limited': 40,
      'minimal': 20,
      'site_specific': 30,
      'project_specific': 25,
      'trade_specific': 35
    };

    // Normalize coverage string
    const normalizedCoverage = coverage.toLowerCase().replace(/[^a-z_]/g, '');
    return coverageMap[normalizedCoverage] || 50;
  }

  private async calculateEbaComplianceScore(eba: LegacyEbaRecord): Promise<number> {
    let score = 0;

    // Certification status (35% weight)
    const statusScore = this.getStatusScore(eba.status);
    score += statusScore * this.EBA_WEIGHTS.certification_status;

    // Coverage level (25% weight)
    const coverageLevel = await this.calculateCoverageLevel(eba.coverage);
    score += coverageLevel * this.EBA_WEIGHTS.coverage_level;

    // Time to expiry (20% weight)
    const timeScore = this.getTimeToExpiryScore(eba.end_date);
    score += timeScore * this.EBA_WEIGHTS.time_to_expiry;

    // Worker count (10% weight)
    const workerScore = await this.getWorkerCountScore(eba.employer_id);
    score += workerScore * this.EBA_WEIGHTS.worker_count;

    // Verification level (10% weight)
    const verificationScore = this.getVerificationScore(eba.verification_status);
    score += verificationScore * this.EBA_WEIGHTS.verification_level;

    return Math.round(score);
  }

  private getStatusScore(status: string): number {
    const statusScores: Record<string, number> = {
      'certified': 100,
      'active': 95,
      'current': 90,
      'negotiating': 60,
      'pending': 50,
      'under_negotiation': 55,
      'expired': 0,
      'lapsed': 0,
      'terminated': 0,
      'none': 0,
      'no_eba': 0,
      'unknown': 0
    };

    return statusScores[status.toLowerCase()] || 0;
  }

  private getTimeToExpiryScore(endDate?: string | null): number {
    if (!endDate) return 50; // No expiry date

    const now = new Date();
    const expiry = new Date(endDate);
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 0; // Expired
    if (daysUntil < 30) return 20; // Expiring soon
    if (daysUntil < 90) return 60; // Expiring within 3 months
    if (daysUntil < 365) return 85; // Good time remaining
    if (daysUntil < 730) return 100; // Excellent time remaining
    return 90; // Very long term (may need verification)
  }

  private async getWorkerCountScore(employerId: string): Promise<number> {
    const workerCount = await this.getWorkerCount(employerId);

    if (workerCount >= 100) return 100;
    if (workerCount >= 50) return 90;
    if (workerCount >= 20) return 80;
    if (workerCount >= 10) return 70;
    if (workerCount >= 5) return 60;
    return 50;
  }

  private getVerificationScore(verificationStatus?: string | null): number {
    if (!verificationStatus) return 50;

    const verificationScores: Record<string, number> = {
      'verified': 100,
      'certified': 95,
      'confirmed': 90,
      'validated': 85,
      'self_declared': 60,
      'reported': 50,
      'unverified': 30,
      'unknown': 20
    };

    return verificationScores[verificationStatus.toLowerCase()] || 50;
  }

  private async getWorkerCount(employerId: string): Promise<number> {
    try {
      const { data: employer } = await supabase
        .from('employers')
        .select('estimated_worker_count')
        .eq('id', employerId)
        .single();

      return employer?.estimated_worker_count || 10; // Default estimate
    } catch (error) {
      console.error('Error getting worker count:', error);
      return 10;
    }
  }

  private async estimateWorkerCoverage(eba: LegacyEbaRecord): Promise<number> {
    const workerCount = await this.getWorkerCount(eba.employer_id);
    const coverageLevel = await this.calculateCoverageLevel(eba.coverage);

    return Math.round((coverageLevel / 100) * workerCount);
  }

  private async calculateEbaDataQuality(eba: LegacyEbaRecord): Promise<number> {
    let score = 0;
    let maxScore = 0;

    const fields = [
      { field: 'eba_type', weight: 15 },
      { field: 'status', weight: 20 },
      { field: 'start_date', weight: 15 },
      { field: 'end_date', weight: 15 },
      { field: 'coverage', weight: 15 },
      { field: 'verification_status', weight: 10 },
      { field: 'source', weight: 10 }
    ];

    for (const { field, weight } of fields) {
      maxScore += weight;
      if (eba[field as keyof LegacyEbaRecord]) {
        score += weight;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  private async calculateVerificationConfidence(eba: LegacyEbaRecord): Promise<number> {
    let confidence = 50; // Base confidence

    // Increase confidence based on data completeness
    if (eba.verification_status) confidence += 20;
    if (eba.end_date) confidence += 15;
    if (eba.coverage && eba.coverage !== 'unknown') confidence += 15;

    // Increase confidence based on source reliability
    const sourceReliability: Record<string, number> = {
      'official_register': 30,
      'government': 25,
      'union_records': 20,
      'employer_declaration': 15,
      'self_reported': 10,
      'legacy_system': 5
    };

    confidence += sourceReliability[eba.source?.toLowerCase() || ''] || 0;

    // Increase confidence based on recency
    const daysSinceUpdate = this.calculateDaysSince(eba.last_updated);
    if (daysSinceUpdate <= 30) confidence += 20;
    else if (daysSinceUpdate <= 90) confidence += 10;
    else if (daysSinceUpdate <= 180) confidence += 5;

    return Math.min(confidence, 100);
  }

  private calculateDaysUntilExpiry(endDate: string): number {
    const expiry = new Date(endDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private isExpiringSoon(endDate: string, daysThreshold: number = 90): boolean {
    const daysUntil = this.calculateDaysUntilExpiry(endDate);
    return daysUntil > 0 && daysUntil <= daysThreshold;
  }

  private isActiveEba(status: string, endDate?: string | null): boolean {
    const normalizedStatus = this.normalizeEbaStatus(status);
    if (normalizedStatus !== 'certified') return false;

    if (endDate) {
      return new Date(endDate) > new Date();
    }

    return true;
  }

  private calculateDaysSince(date: string): number {
    const past = new Date(date);
    const now = new Date();
    const diffTime = now.getTime() - past.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async getEmployersForFactorUpdate(employerIds?: string[]): Promise<Array<{ id: string }>> {
    try {
      let query = supabase
        .from('employers')
        .select('id');

      if (employerIds && employerIds.length > 0) {
        query = query.in('id', employerIds);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error getting employers for factor update:', error);
      return [];
    }
  }

  private groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  // ============================================================================
  // Validation and Conflict Resolution Methods
  // ============================================================================

  private async validateEbaData(data: {
    eba: any;
    factor: EbaRatingFactor;
  }): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate EBA data
    if (!data.eba.employer_id) {
      errors.push('Employer ID is required');
    }

    if (!data.eba.eba_type) {
      errors.push('EBA type is required');
    }

    if (!data.eba.status) {
      errors.push('EBA status is required');
    }

    const validStatuses = ['certified', 'negotiating', 'expired', 'none'];
    if (!validStatuses.includes(data.factor.eba_status)) {
      errors.push('Invalid normalized EBA status');
    }

    if (data.eba.start_date && !this.isValidDate(data.eba.start_date)) {
      errors.push('Invalid start date format');
    }

    if (data.eba.end_date && !this.isValidDate(data.eba.end_date)) {
      errors.push('Invalid end date format');
    }

    if (data.eba.start_date && data.eba.end_date) {
      const start = new Date(data.eba.start_date);
      const end = new Date(data.eba.end_date);
      if (end < start) {
        errors.push('End date must be after start date');
      }
    }

    // Validate factor data
    if (data.factor.coverage_level < 0 || data.factor.coverage_level > 100) {
      errors.push('Coverage level must be between 0 and 100');
    }

    if (data.factor.compliance_score < 0 || data.factor.compliance_score > 100) {
      errors.push('Compliance score must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async detectEbaConflicts(
    legacy: LegacyEbaRecord,
    transformed: { eba: any; factor: EbaRatingFactor }
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for existing EBA record
      const { data: existingEba } = await supabase
        .from('company_eba_records')
        .select('id, status, end_date, coverage')
        .eq('id', legacy.id)
        .single();

      if (existingEba) {
        // Check for status conflicts
        if (existingEba.status !== legacy.status) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'company_eba_records',
            target_table: 'company_eba_records',
            record_id: legacy.id,
            field_name: 'status',
            source_value: legacy.status,
            target_value: existingEba.status,
            conflict_type: 'value_mismatch',
            severity: this.getEbaConflictSeverity(legacy.status, existingEba.status),
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }

        // Check for coverage conflicts
        if (existingEba.coverage !== legacy.coverage) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'company_eba_records',
            target_table: 'company_eba_records',
            record_id: legacy.id,
            field_name: 'coverage',
            source_value: legacy.coverage,
            target_value: existingEba.coverage,
            conflict_type: 'value_mismatch',
            severity: 'medium',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

      return conflicts;

    } catch (error) {
      console.error('Error detecting EBA conflicts:', error);
      return [];
    }
  }

  private getEbaConflictSeverity(sourceStatus: string, targetStatus: string): 'low' | 'medium' | 'high' | 'critical' {
    const sourceNormalized = this.normalizeEbaStatus(sourceStatus);
    const targetNormalized = this.normalizeEbaStatus(targetStatus);

    // Critical if one is certified and other is none/expired
    if ((sourceNormalized === 'certified' && ['none', 'expired'].includes(targetNormalized)) ||
        (targetNormalized === 'certified' && ['none', 'expired'].includes(sourceNormalized))) {
      return 'critical';
    }

    // High if one is certified and other is negotiating
    if ((sourceNormalized === 'certified' && targetNormalized === 'negotiating') ||
        (targetNormalized === 'certified' && sourceNormalized === 'negotiating')) {
      return 'high';
    }

    // Medium if status difference is significant
    if (sourceNormalized !== targetNormalized) {
      return 'medium';
    }

    return 'low';
  }

  private async resolveEbaConflicts(
    conflicts: DataConflict[],
    strategy: string
  ): Promise<{ allResolved: boolean; unresolved: string[] }> {
    const unresolved: string[] = [];

    for (const conflict of conflicts) {
      try {
        switch (strategy) {
          case 'source_wins':
            await this.applySourceEbaResolution(conflict);
            break;
          case 'target_wins':
            await this.applyTargetEbaResolution(conflict);
            break;
          case 'manual':
            unresolved.push(`Manual review needed for EBA ${conflict.field_name}`);
            break;
          default:
            unresolved.push(`Unknown resolution strategy: ${strategy}`);
        }
      } catch (error) {
        console.error(`Failed to resolve EBA conflict ${conflict.id}:`, error);
        unresolved.push(conflict.id);
      }
    }

    return {
      allResolved: unresolved.length === 0,
      unresolved
    };
  }

  private async applySourceEbaResolution(conflict: DataConflict): Promise<void> {
    const { error } = await supabase
      .from(conflict.target_table)
      .update({ [conflict.field_name]: conflict.source_value })
      .eq('id', conflict.record_id);

    if (error) throw error;

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

  private async applyTargetEbaResolution(conflict: DataConflict): Promise<void> {
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

  // ============================================================================
  // Data Loading Methods
  // ============================================================================

  private async loadEbaData(
    transformed: { eba: any; factor: EbaRatingFactor },
    legacy: LegacyEbaRecord
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('upsert_eba_data', {
        p_eba_data: transformed.eba,
        p_factor_data: transformed.factor,
        p_legacy_id: legacy.id
      });

      if (error) throw error;

      await this.createEbaDataLineage(transformed, legacy);

    } catch (error) {
      console.error('Error loading EBA data:', error);
      throw error;
    }
  }

  private async saveEbaFactor(factor: EbaRatingFactor): Promise<void> {
    try {
      const { error } = await supabase
        .from('eba_rating_factors')
        .upsert({
          ...factor,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Error saving EBA factor:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapToLegacyEbaRecord(data: any): LegacyEbaRecord {
    return {
      id: data.id,
      employer_id: data.employer_id,
      eba_type: data.eba_type,
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date,
      coverage: data.coverage,
      last_updated: data.last_updated,
      source: data.source,
      verification_status: data.verification_status
    };
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private aggregateBatchResult(
    mainResult: EbaSyncResult,
    batchResult: Partial<EbaSyncResult>
  ): void {
    mainResult.totalProcessed += batchResult.totalProcessed || 0;
    mainResult.successfulSyncs += batchResult.successfulSyncs || 0;
    mainResult.failedSyncs += batchResult.failedSyncs || 0;
    mainResult.conflicts.push(...(batchResult.conflicts || []));
    mainResult.errors.push(...(batchResult.errors || []));
  }

  private aggregateFactorResult(
    mainResult: EbaSyncResult,
    factorResult: Partial<EbaSyncResult>
  ): void {
    mainResult.factorsUpdated += factorResult.factorsUpdated || 0;
    mainResult.errors.push(...(factorResult.errors || []));
  }

  private async createEbaDataLineage(
    transformed: { eba: any; factor: EbaRatingFactor },
    legacy: LegacyEbaRecord
  ): Promise<void> {
    try {
      const lineageRecord: DataLineageRecord = {
        id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_record_id: legacy.id,
        source_table: 'company_eba_records',
        target_record_id: transformed.eba.id,
        target_table: 'company_eba_records',
        transformation_applied: JSON.stringify({
          eba_fields: Object.keys(transformed.eba),
          factor_calculations: {
            eba_status: transformed.factor.eba_status,
            coverage_level: transformed.factor.coverage_level,
            compliance_score: transformed.factor.compliance_score
          }
        }),
        migration_id: `eba_sync_${new Date().toISOString().split('T')[0]}`,
        transformed_at: new Date().toISOString(),
        transformation_hash: this.generateDataHash(transformed.eba),
        quality_score: transformed.eba.data_quality_score,
        confidence_level: transformed.eba.verification_confidence
      };

      await supabase
        .from('data_lineage_records')
        .insert(lineageRecord);

    } catch (error) {
      console.error('Error creating EBA data lineage record:', error);
    }
  }

  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private async logEbaSyncOperation(result: EbaSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        migration_id: `eba_sync_${new Date().toISOString().split('T')[0]}`,
        action: 'eba_data_synchronization',
        actor: 'system',
        object_type: 'migration',
        object_id: 'eba_sync_batch',
        new_values: {
          records_processed: result.totalProcessed,
          factors_updated: result.factorsUpdated,
          successful_syncs: result.successfulSyncs,
          failed_syncs: result.failedSyncs,
          conflicts: result.conflicts.length,
          duration: result.duration,
          eba_summary: result.ebaSummary
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging EBA sync operation:', error);
    }
  }

  /**
   * Get EBA alerts for monitoring
   */
  async getEbaAlerts(): Promise<{
    expiringSoon: Array<{
      employerId: string;
      employerName: string;
      ebaType: string;
      expiryDate: string;
      daysUntilExpiry: number;
      coverage: number;
    }>;
    expiredAgreements: Array<{
      employerId: string;
      employerName: string;
      ebaType: string;
      expiryDate: string;
      daysExpired: number;
    }>;
    employersWithoutEba: Array<{
      employerId: string;
      employerName: string;
      employerType: string;
      estimatedWorkers: number;
    }>;
    verificationRequired: Array<{
      employerId: string;
      employerName: string;
      ebaType: string;
      lastVerified: string;
      verificationSource: string;
    }>;
  }> {
    try {
      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Get expiring soon EBAs
      const { data: expiringSoon } = await supabase
        .from('company_eba_records')
        .select(`
          employer_id,
          eba_type,
          end_date,
          coverage,
          employers!inner(name)
        `)
        .lte('end_date', ninetyDaysFromNow.toISOString())
        .gt('end_date', now.toISOString())
        .in('status', ['certified', 'active']);

      // Get expired EBAs (last 90 days)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const { data: expiredAgreements } = await supabase
        .from('company_eba_records')
        .select(`
          employer_id,
          eba_type,
          end_date,
          employers!inner(name)
        `)
        .lte('end_date', now.toISOString())
        .gte('end_date', ninetyDaysAgo.toISOString())
        .in('status', ['certified', 'active', 'expired']);

      // Get employers without EBA
      const { data: employersWithoutEba } = await supabase
        .from('employers')
        .select(`
          id,
          name,
          employer_type,
          estimated_worker_count
        `)
        .not('id', 'in', (
          await supabase
            .from('company_eba_records')
            .select('employer_id')
            .in('status', ['certified', 'active', 'negotiating'])
        ).data?.map(e => e.employer_id) || [])
        .limit(100);

      // Get EBAs requiring verification
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const { data: verificationRequired } = await supabase
        .from('company_eba_records')
        .select(`
          employer_id,
          eba_type,
          last_updated,
          source,
          employers!inner(name)
        `)
        .lt('last_updated', sixMonthsAgo.toISOString())
        .in('status', ['certified', 'active']);

      return {
        expiringSoon: (expiringSoon || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          ebaType: item.eba_type,
          expiryDate: item.end_date,
          daysUntilExpiry: this.calculateDaysUntilExpiry(item.end_date),
          coverage: this.calculateCoverageLevel(item.coverage)
        })),
        expiredAgreements: (expiredAgreements || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          ebaType: item.eba_type,
          expiryDate: item.end_date,
          daysExpired: -this.calculateDaysUntilExpiry(item.end_date)
        })),
        employersWithoutEba: (employersWithoutEba || []).map(item => ({
          employerId: item.id,
          employerName: item.name,
          employerType: item.employer_type,
          estimatedWorkers: item.estimated_worker_count || 0
        })),
        verificationRequired: (verificationRequired || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          ebaType: item.eba_type,
          lastVerified: item.last_updated,
          verificationSource: item.source
        }))
      };

    } catch (error) {
      console.error('Error getting EBA alerts:', error);
      return {
        expiringSoon: [],
        expiredAgreements: [],
        employersWithoutEba: [],
        verificationRequired: []
      };
    }
  }

  /**
   * Get current EBA sync status for monitoring
   */
  async getEbaSyncStatus(): Promise<{
    lastSync: string | null;
    totalAgreements: number;
    activeAgreements: number;
    averageCoverage: number;
    employersWithEba: number;
    alertsCount: number;
  }> {
    try {
      const [
        { data: lastSync },
        { count: totalAgreements },
        { count: activeAgreements },
        { data: coverageData },
        { count: employersWithEba },
        alerts
      ] = await Promise.all([
        supabase
          .from('sync_metrics')
          .select('sync_date')
          .eq('source_table', 'company_eba_records')
          .order('sync_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('company_eba_records')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('company_eba_records')
          .select('*', { count: 'exact', head: true })
          .in('status', ['certified', 'active'])
          .or('end_date.is.null,end_date.gte.' + new Date().toISOString()),
        supabase
          .from('eba_summary')
          .select('average_coverage')
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('company_eba_records')
          .select('employer_id', { count: 'exact', head: true })
          .in('status', ['certified', 'active', 'negotiating']),
        this.getEbaAlerts()
      ]);

      return {
        lastSync: lastSync?.sync_date || null,
        totalAgreements: totalAgreements || 0,
        activeAgreements: activeAgreements || 0,
        averageCoverage: coverageData?.average_coverage || 0,
        employersWithEba: employersWithEba || 0,
        alertsCount: alerts.expiringSoon.length + alerts.expiredAgreements.length +
                   alerts.employersWithoutEba.length + alerts.verificationRequired.length
      };

    } catch (error) {
      console.error('Error getting EBA sync status:', error);
      return {
        lastSync: null,
        totalAgreements: 0,
        activeAgreements: 0,
        averageCoverage: 0,
        employersWithEba: 0,
        alertsCount: 0
      };
    }
  }
}

// Export singleton instance
export const ebaDataService = new EbaDataService();