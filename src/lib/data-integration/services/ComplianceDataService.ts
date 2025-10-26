/**
 * Compliance Data Integration Service
 * Handles synchronization of compliance data (CBUS, Incolink, Workers' Comp, etc.)
 * between legacy CFMEU systems and the traffic light rating system
 */

import { supabase } from '@/integrations/supabase/client';
import {
  LegacyComplianceCheck,
  ComplianceRatingFactor,
  SyncOperation,
  DataTransformation,
  IntegrationConfig,
  DataConflict,
  SyncMetrics
} from '../types/IntegrationTypes';
import { MigrationMetrics, DataLineageRecord, AuditLog } from '../types/MigrationTypes';

export interface ComplianceSyncOptions {
  batchSize?: number;
  skipValidation?: boolean;
  includeExpired?: boolean;
  lastSyncAfter?: string;
  complianceTypes?: Array<'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super'>;
  employerIds?: string[];
  updateFactorsOnly?: boolean;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
}

export interface ComplianceSyncResult {
  totalProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  factorsUpdated: number;
  conflicts: DataConflict[];
  metrics: SyncMetrics;
  duration: number;
  errors: Array<{
    checkId?: string;
    employerId?: string;
    error: string;
    phase: 'extraction' | 'transformation' | 'validation' | 'loading';
  }>;
  complianceSummary: {
    byType: Record<string, {
      total: number;
      compliant: number;
      nonCompliant: number;
      pending: number;
      exempt: number;
    }>;
    overallComplianceRate: number;
    highRiskEmployers: number;
    expiringSoon: number;
  };
}

export class ComplianceDataService {
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly COMPLIANCE_WEIGHTS = {
    cbus: 0.30,
    incolink: 0.30,
    workers_comp: 0.20,
    tax: 0.10,
    super: 0.10
  };

  private readonly COMPLIANCE_DECAY_PERIODS = {
    cbus: 90, // days
    incolink: 90,
    workers_comp: 365,
    tax: 365,
    super: 365
  };

  /**
   * Synchronizes compliance data from legacy system to rating system
   */
  async syncComplianceData(options: ComplianceSyncOptions = {}): Promise<ComplianceSyncResult> {
    const startTime = Date.now();
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipValidation = false,
      includeExpired = false,
      lastSyncAfter,
      complianceTypes,
      employerIds,
      updateFactorsOnly = false,
      conflictResolution = 'target_wins'
    } = options;

    try {
      console.log('Starting compliance data synchronization...');

      const result: ComplianceSyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        factorsUpdated: 0,
        conflicts: [],
        metrics: {
          source_table: 'compliance_checks',
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
        complianceSummary: {
          byType: {},
          overallComplianceRate: 0,
          highRiskEmployers: 0,
          expiringSoon: 0
        }
      };

      if (!updateFactorsOnly) {
        // Sync raw compliance checks
        const complianceChecks = await this.fetchComplianceChecks({
          includeExpired,
          lastSyncAfter,
          complianceTypes,
          employerIds
        });

        console.log(`Found ${complianceChecks.length} compliance checks to process`);
        result.metrics.total_records = complianceChecks.length;

        // Process in batches
        for (let i = 0; i < complianceChecks.length; i += batchSize) {
          const batch = complianceChecks.slice(i, i + batchSize);
          console.log(`Processing compliance batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(complianceChecks.length / batchSize)}`);

          const batchResult = await this.processComplianceBatch(batch, {
            skipValidation,
            conflictResolution
          });

          this.aggregateBatchResult(result, batchResult);
        }
      }

      // Update compliance rating factors
      console.log('Updating compliance rating factors...');
      const factorResult = await this.updateComplianceFactors({
        employerIds,
        complianceTypes,
        batchSize
      });

      this.aggregateFactorResult(result, factorResult);

      // Calculate compliance summary
      result.complianceSummary = await this.calculateComplianceSummary(employerIds, complianceTypes);

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.metrics.average_processing_time = result.duration / Math.max(result.totalProcessed, 1);
      result.metrics.successful_syncs = result.successfulSyncs + result.factorsUpdated;
      result.metrics.failed_syncs = result.failedSyncs;
      result.metrics.conflict_count = result.conflicts.length;

      // Log the synchronization
      await this.logComplianceSyncOperation(result);

      console.log(`Compliance sync completed: ${result.successfulSyncs} checks, ${result.factorsUpdated} factors updated`);
      return result;

    } catch (error) {
      console.error('Compliance data synchronization failed:', error);
      throw new Error(`Compliance sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches compliance checks from the source system
   */
  private async fetchComplianceChecks(options: {
    includeExpired?: boolean;
    lastSyncAfter?: string;
    complianceTypes?: Array<'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super'>;
    employerIds?: string[];
  }): Promise<LegacyComplianceCheck[]> {
    try {
      let query = supabase
        .from('compliance_checks')
        .select(`
          *,
          employers!inner(
            name,
            employer_type,
            enterprise_agreement_status
          )
        `);

      // Apply filters
      if (!options.includeExpired) {
        query = query.or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString());
      }

      if (options.lastSyncAfter) {
        query = query.gte('updated_at', options.lastSyncAfter);
      }

      if (options.complianceTypes && options.complianceTypes.length > 0) {
        query = query.in('check_type', options.complianceTypes);
      }

      if (options.employerIds && options.employerIds.length > 0) {
        query = query.in('employer_id', options.employerIds);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch compliance checks: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacyComplianceCheck);

    } catch (error) {
      console.error('Error fetching compliance checks:', error);
      throw error;
    }
  }

  /**
   * Processes a batch of compliance checks through the sync pipeline
   */
  private async processComplianceBatch(
    checks: LegacyComplianceCheck[],
    options: {
      skipValidation: boolean;
      conflictResolution: string;
    }
  ): Promise<Partial<ComplianceSyncResult>> {
    const batchResult: Partial<ComplianceSyncResult> = {
      totalProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: [],
      errors: []
    };

    for (const check of checks) {
      try {
        batchResult.totalProcessed = (batchResult.totalProcessed || 0) + 1;

        // Transform compliance data
        const transformedData = await this.transformComplianceData(check);

        // Validate data if not skipped
        if (!options.skipValidation) {
          const validation = await this.validateComplianceData(transformedData);
          if (!validation.isValid) {
            batchResult.errors?.push({
              checkId: check.id,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              phase: 'validation'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Check for conflicts
        const conflicts = await this.detectComplianceConflicts(check, transformedData);
        if (conflicts.length > 0) {
          batchResult.conflicts = [...(batchResult.conflicts || []), ...conflicts];

          const resolvedConflicts = await this.resolveComplianceConflicts(conflicts, options.conflictResolution);
          if (!resolvedConflicts.allResolved) {
            batchResult.errors?.push({
              checkId: check.id,
              error: `Unresolved conflicts: ${resolvedConflicts.unresolved.join(', ')}`,
              phase: 'loading'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Load the data
        await this.loadComplianceData(transformedData, check);
        batchResult.successfulSyncs = (batchResult.successfulSyncs || 0) + 1;

      } catch (error) {
        console.error(`Failed to process compliance check ${check.id}:`, error);
        batchResult.errors?.push({
          checkId: check.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'transformation'
        });
        batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
      }
    }

    return batchResult;
  }

  /**
   * Updates compliance rating factors for all employers
   */
  private async updateComplianceFactors(options: {
    employerIds?: string[];
    complianceTypes?: Array<'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super'>;
    batchSize: number;
  }): Promise<Partial<ComplianceSyncResult>> {
    const result: Partial<ComplianceSyncResult> = {
      factorsUpdated: 0,
      errors: []
    };

    try {
      // Get employers to update
      const employers = await this.getEmployersForFactorUpdate(options.employerIds);
      console.log(`Updating compliance factors for ${employers.length} employers`);

      // Process employers in batches
      for (let i = 0; i < employers.length; i += options.batchSize) {
        const batch = employers.slice(i, i + options.batchSize);

        for (const employer of batch) {
          try {
            const factors = await this.calculateEmployerComplianceFactors(employer.id, options.complianceTypes);

            for (const factor of factors) {
              await this.saveComplianceFactor(factor);
              result.factorsUpdated = (result.factorsUpdated || 0) + 1;
            }

            // Trigger rating recalculation
            await supabase.rpc('trigger_employer_rating_recalculation', {
              p_employer_id: employer.id
            });

          } catch (error) {
            console.error(`Failed to update compliance factors for employer ${employer.id}:`, error);
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
      console.error('Error updating compliance factors:', error);
      throw error;
    }
  }

  /**
   * Transforms compliance check data to the rating system format
   */
  private async transformComplianceData(legacy: LegacyComplianceCheck): Promise<{
    check: any;
    factor: ComplianceRatingFactor;
  }> {
    try {
      // Transform compliance check
      const checkData = {
        id: legacy.id,
        employer_id: legacy.employer_id,
        check_type: legacy.check_type,
        status: legacy.status,
        checked_at: legacy.checked_at,
        expiry_date: legacy.expiry_date || null,
        details: legacy.details || {},
        checked_by: legacy.checked_by || null,
        created_at: legacy.checked_at, // Use checked_at as created_at for historical data
        updated_at: new Date().toISOString(),
        // Additional fields for rating system
        compliance_score: this.calculateComplianceScore(legacy.status),
        days_until_expiry: legacy.expiry_date ? this.calculateDaysUntilExpiry(legacy.expiry_date) : null,
        is_expiring_soon: legacy.expiry_date ? this.isExpiringSoon(legacy.expiry_date) : false,
        verification_required: this.requiresVerification(legacy),
        source_confidence: await this.calculateSourceConfidence(legacy)
      };

      // Create rating factor
      const factorData: ComplianceRatingFactor = {
        employer_id: legacy.employer_id,
        factor_type: legacy.check_type,
        score: checkData.compliance_score,
        weight: this.COMPLIANCE_WEIGHTS[legacy.check_type] || 0.1,
        last_checked: legacy.checked_at,
        status: this.determineFactorStatus(legacy.status, legacy.expiry_date),
        trend_history: await this.getComplianceTrendHistory(legacy.employer_id, legacy.check_type)
      };

      return {
        check: checkData,
        factor: factorData
      };

    } catch (error) {
      console.error('Error transforming compliance data:', error);
      throw new Error(`Compliance transformation failed for ${legacy.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates compliance factors for an employer
   */
  private async calculateEmployerComplianceFactors(
    employerId: string,
    complianceTypes?: Array<'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super'>
  ): Promise<ComplianceRatingFactor[]> {
    const types = complianceTypes || ['cbus', 'incolink', 'workers_comp', 'tax', 'super'];
    const factors: ComplianceRatingFactor[] = [];

    for (const type of types) {
      try {
        // Get most recent compliance check for this type
        const { data: latestCheck } = await supabase
          .from('compliance_checks')
          .select('*')
          .eq('employer_id', employerId)
          .eq('check_type', type)
          .order('checked_at', { ascending: false })
          .limit(1)
          .single();

        if (latestCheck) {
          const factor: ComplianceRatingFactor = {
            employer_id: employerId,
            factor_type: type,
            score: this.calculateComplianceScore(latestCheck.status),
            weight: this.COMPLIANCE_WEIGHTS[type] || 0.1,
            last_checked: latestCheck.checked_at,
            status: this.determineFactorStatus(latestCheck.status, latestCheck.expiry_date),
            trend_history: await this.getComplianceTrendHistory(employerId, type)
          };

          factors.push(factor);
        } else {
          // No compliance data - create default factor
          const factor: ComplianceRatingFactor = {
            employer_id: employerId,
            factor_type: type,
            score: 0, // No data is treated as non-compliant
            weight: this.COMPLIANCE_WEIGHTS[type] || 0.1,
            last_checked: new Date().toISOString(),
            status: 'inactive',
            trend_history: []
          };

          factors.push(factor);
        }
      } catch (error) {
        console.error(`Error calculating compliance factor for ${employerId}, type ${type}:`, error);
      }
    }

    return factors;
  }

  /**
   * Gets compliance trend history for an employer
   */
  private async getComplianceTrendHistory(
    employerId: string,
    complianceType: string
  ): Promise<Array<{ date: string; score: number; status: string }>> {
    try {
      const { data: history } = await supabase
        .from('compliance_checks')
        .select('status, checked_at')
        .eq('employer_id', employerId)
        .eq('check_type', complianceType)
        .order('checked_at', { ascending: false })
        .limit(12); // Last 12 checks

      return (history || []).map(check => ({
        date: check.checked_at,
        score: this.calculateComplianceScore(check.status),
        status: check.status
      }));

    } catch (error) {
      console.error('Error getting compliance trend history:', error);
      return [];
    }
  }

  /**
   * Calculates overall compliance summary
   */
  private async calculateComplianceSummary(
    employerIds?: string[],
    complianceTypes?: Array<'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super'>
  ): Promise<ComplianceSyncResult['complianceSummary']> {
    try {
      const types = complianceTypes || ['cbus', 'incolink', 'workers_comp', 'tax', 'super'];
      const byType: Record<string, any> = {};
      let totalChecks = 0;
      let totalCompliant = 0;
      let highRiskEmployers = 0;
      let expiringSoon = 0;

      for (const type of types) {
        let query = supabase
          .from('compliance_checks')
          .select('status, expiry_date, employer_id', { count: 'exact' })
          .eq('check_type', type);

        if (employerIds && employerIds.length > 0) {
          query = query.in('employer_id', employerIds);
        }

        const { data: checks, count } = await query;

        const typeSummary = {
          total: count || 0,
          compliant: 0,
          nonCompliant: 0,
          pending: 0,
          exempt: 0
        };

        if (checks) {
          for (const check of checks) {
            totalChecks++;
            if (check.status === 'compliant') {
              typeSummary.compliant++;
              totalCompliant++;
            } else if (check.status === 'non_compliant') {
              typeSummary.nonCompliant++;
            } else if (check.status === 'pending') {
              typeSummary.pending++;
            } else if (check.status === 'exempt') {
              typeSummary.exempt++;
              totalCompliant++; // Treat exempt as compliant for overall rate
            }

            if (check.expiry_date && this.isExpiringSoon(check.expiry_date)) {
              expiringSoon++;
            }
          }
        }

        byType[type] = typeSummary;
      }

      // Calculate high-risk employers (multiple non-compliant checks)
      if (employerIds && employerIds.length > 0) {
        const { data: riskData } = await supabase
          .from('compliance_checks')
          .select('employer_id, status')
          .in('employer_id', employerIds)
          .eq('status', 'non_compliant');

        const nonCompliantCounts = new Map<string, number>();
        if (riskData) {
          for (const check of riskData) {
            const current = nonCompliantCounts.get(check.employer_id) || 0;
            nonCompliantCounts.set(check.employer_id, current + 1);
          }
        }

        highRiskEmployers = Array.from(nonCompliantCounts.values()).filter(count => count >= 2).length;
      }

      const overallComplianceRate = totalChecks > 0 ? (totalCompliant / totalChecks) * 100 : 0;

      return {
        byType,
        overallComplianceRate: Math.round(overallComplianceRate * 10) / 10,
        highRiskEmployers,
        expiringSoon
      };

    } catch (error) {
      console.error('Error calculating compliance summary:', error);
      return {
        byType: {},
        overallComplianceRate: 0,
        highRiskEmployers: 0,
        expiringSoon: 0
      };
    }
  }

  // ============================================================================
  // Helper Methods for Compliance Calculations
  // ============================================================================

  private calculateComplianceScore(status: string): number {
    const scoreMap: Record<string, number> = {
      'compliant': 100,
      'exempt': 95,
      'pending': 60,
      'non_compliant': 0,
      'expired': 0,
      'suspended': 20
    };

    return scoreMap[status] || 0;
  }

  private calculateDaysUntilExpiry(expiryDate: string): number {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private isExpiringSoon(expiryDate: string, daysThreshold: number = 30): boolean {
    const daysUntil = this.calculateDaysUntilExpiry(expiryDate);
    return daysUntil > 0 && daysUntil <= daysThreshold;
  }

  private requiresVerification(compliance: LegacyComplianceCheck): boolean {
    // Require verification for expired or non-compliant statuses
    if (compliance.status === 'non_compliant' || compliance.status === 'expired') {
      return true;
    }

    // Require verification if expiring soon
    if (compliance.expiry_date && this.isExpiringSoon(compliance.expiry_date)) {
      return true;
    }

    // Require verification for old checks (older than decay period)
    const decayPeriod = this.COMPLIANCE_DECAY_PERIODS[compliance.check_type] || 90;
    const checkDate = new Date(compliance.checked_at);
    const cutoffDate = new Date(Date.now() - decayPeriod * 24 * 60 * 60 * 1000);

    return checkDate < cutoffDate;
  }

  private determineFactorStatus(
    status: string,
    expiryDate?: string | null
  ): 'active' | 'inactive' | 'pending' {
    if (status === 'pending') return 'pending';

    const now = new Date();
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry < now) return 'inactive';
    }

    return status === 'compliant' || status === 'exempt' ? 'active' : 'inactive';
  }

  private async calculateSourceConfidence(compliance: LegacyComplianceCheck): Promise<number> {
    let confidence = 50; // Base confidence

    // Increase confidence based on data completeness
    if (compliance.checked_by) confidence += 20;
    if (compliance.details) confidence += 15;
    if (compliance.expiry_date) confidence += 15;

    // Increase confidence based on recency
    const daysSinceCheck = this.calculateDaysSince(compliance.checked_at);
    if (daysSinceCheck <= 30) confidence += 20;
    else if (daysSinceCheck <= 90) confidence += 10;
    else if (daysSinceCheck <= 180) confidence += 5;

    return Math.min(confidence, 100);
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

      const { data, error } = await query;

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error getting employers for factor update:', error);
      return [];
    }
  }

  // ============================================================================
  // Validation and Conflict Resolution Methods
  // ============================================================================

  private async validateComplianceData(data: {
    check: any;
    factor: ComplianceRatingFactor;
  }): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate check data
    if (!data.check.employer_id) {
      errors.push('Employer ID is required');
    }

    if (!data.check.check_type) {
      errors.push('Compliance type is required');
    }

    if (!data.check.status) {
      errors.push('Compliance status is required');
    }

    const validStatuses = ['compliant', 'non_compliant', 'pending', 'exempt'];
    if (!validStatuses.includes(data.check.status)) {
      errors.push('Invalid compliance status');
    }

    if (!this.isValidDate(data.check.checked_at)) {
      errors.push('Invalid check date format');
    }

    if (data.check.expiry_date && !this.isValidDate(data.check.expiry_date)) {
      errors.push('Invalid expiry date format');
    }

    // Validate factor data
    if (data.factor.score < 0 || data.factor.score > 100) {
      errors.push('Compliance score must be between 0 and 100');
    }

    if (data.factor.weight < 0 || data.factor.weight > 1) {
      errors.push('Compliance weight must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async detectComplianceConflicts(
    legacy: LegacyComplianceCheck,
    transformed: { check: any; factor: ComplianceRatingFactor }
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for existing compliance check with same employer and type
      const { data: existingCheck } = await supabase
        .from('compliance_checks')
        .select('id, status, checked_at, expiry_date')
        .eq('employer_id', legacy.employer_id)
        .eq('check_type', legacy.check_type)
        .neq('id', legacy.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      if (existingCheck) {
        // Check if there's a status conflict
        if (existingCheck.status !== legacy.status) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'compliance_checks',
            target_table: 'compliance_checks',
            record_id: legacy.id,
            field_name: 'status',
            source_value: legacy.status,
            target_value: existingCheck.status,
            conflict_type: 'value_mismatch',
            severity: this.getConflictSeverity(legacy.status, existingCheck.status),
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }

        // Check if source data is more recent
        const sourceDate = new Date(legacy.checked_at);
        const targetDate = new Date(existingCheck.checked_at);

        if (sourceDate < targetDate) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'compliance_checks',
            target_table: 'compliance_checks',
            record_id: legacy.id,
            field_name: 'checked_at',
            source_value: legacy.checked_at,
            target_value: existingCheck.checked_at,
            conflict_type: 'value_mismatch',
            severity: 'medium',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

      return conflicts;

    } catch (error) {
      console.error('Error detecting compliance conflicts:', error);
      return [];
    }
  }

  private getConflictSeverity(sourceStatus: string, targetStatus: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical if one is compliant and other is non_compliant
    if ((sourceStatus === 'compliant' && targetStatus === 'non_compliant') ||
        (sourceStatus === 'non_compliant' && targetStatus === 'compliant')) {
      return 'critical';
    }

    // High if one is exempt and other is non_compliant
    if ((sourceStatus === 'exempt' && targetStatus === 'non_compliant') ||
        (sourceStatus === 'non_compliant' && targetStatus === 'exempt')) {
      return 'high';
    }

    // Medium if one is pending and other is definitive
    if ((sourceStatus === 'pending' && ['compliant', 'non_compliant', 'exempt'].includes(targetStatus)) ||
        (targetStatus === 'pending' && ['compliant', 'non_compliant', 'exempt'].includes(sourceStatus))) {
      return 'medium';
    }

    return 'low';
  }

  private async resolveComplianceConflicts(
    conflicts: DataConflict[],
    strategy: string
  ): Promise<{ allResolved: boolean; unresolved: string[] }> {
    const unresolved: string[] = [];

    for (const conflict of conflicts) {
      try {
        switch (strategy) {
          case 'source_wins':
            await this.applySourceComplianceResolution(conflict);
            break;
          case 'target_wins':
            await this.applyTargetComplianceResolution(conflict);
            break;
          case 'manual':
            unresolved.push(`Manual review needed for compliance ${conflict.field_name}`);
            break;
          default:
            unresolved.push(`Unknown resolution strategy: ${strategy}`);
        }
      } catch (error) {
        console.error(`Failed to resolve compliance conflict ${conflict.id}:`, error);
        unresolved.push(conflict.id);
      }
    }

    return {
      allResolved: unresolved.length === 0,
      unresolved
    };
  }

  private async applySourceComplianceResolution(conflict: DataConflict): Promise<void> {
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

  private async applyTargetComplianceResolution(conflict: DataConflict): Promise<void> {
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

  private async loadComplianceData(
    transformed: { check: any; factor: ComplianceRatingFactor },
    legacy: LegacyComplianceCheck
  ): Promise<void> {
    try {
      // Use transaction to ensure data consistency
      const { error } = await supabase.rpc('upsert_compliance_data', {
        p_check_data: transformed.check,
        p_factor_data: transformed.factor,
        p_legacy_id: legacy.id
      });

      if (error) throw error;

      await this.createComplianceDataLineage(transformed, legacy);

    } catch (error) {
      console.error('Error loading compliance data:', error);
      throw error;
    }
  }

  private async saveComplianceFactor(factor: ComplianceRatingFactor): Promise<void> {
    try {
      const { error } = await supabase
        .from('compliance_rating_factors')
        .upsert({
          ...factor,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Error saving compliance factor:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapToLegacyComplianceCheck(data: any): LegacyComplianceCheck {
    return {
      id: data.id,
      employer_id: data.employer_id,
      check_type: data.check_type,
      status: data.status,
      checked_at: data.checked_at,
      expiry_date: data.expiry_date,
      details: data.details,
      checked_by: data.checked_by
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
    mainResult: ComplianceSyncResult,
    batchResult: Partial<ComplianceSyncResult>
  ): void {
    mainResult.totalProcessed += batchResult.totalProcessed || 0;
    mainResult.successfulSyncs += batchResult.successfulSyncs || 0;
    mainResult.failedSyncs += batchResult.failedSyncs || 0;
    mainResult.conflicts.push(...(batchResult.conflicts || []));
    mainResult.errors.push(...(batchResult.errors || []));
  }

  private aggregateFactorResult(
    mainResult: ComplianceSyncResult,
    factorResult: Partial<ComplianceSyncResult>
  ): void {
    mainResult.factorsUpdated += factorResult.factorsUpdated || 0;
    mainResult.errors.push(...(factorResult.errors || []));
  }

  private async createComplianceDataLineage(
    transformed: { check: any; factor: ComplianceRatingFactor },
    legacy: LegacyComplianceCheck
  ): Promise<void> {
    try {
      const lineageRecord: DataLineageRecord = {
        id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_record_id: legacy.id,
        source_table: 'compliance_checks',
        target_record_id: transformed.check.id,
        target_table: 'compliance_checks',
        transformation_applied: JSON.stringify({
          check_fields: Object.keys(transformed.check),
          factor_calculations: {
            score: transformed.factor.score,
            weight: transformed.factor.weight,
            status: transformed.factor.status
          }
        }),
        migration_id: `compliance_sync_${new Date().toISOString().split('T')[0]}`,
        transformed_at: new Date().toISOString(),
        transformation_hash: this.generateDataHash(transformed.check),
        quality_score: transformed.check.source_confidence,
        confidence_level: transformed.check.source_confidence
      };

      await supabase
        .from('data_lineage_records')
        .insert(lineageRecord);

    } catch (error) {
      console.error('Error creating compliance data lineage record:', error);
    }
  }

  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private async logComplianceSyncOperation(result: ComplianceSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        migration_id: `compliance_sync_${new Date().toISOString().split('T')[0]}`,
        action: 'compliance_data_synchronization',
        actor: 'system',
        object_type: 'migration',
        object_id: 'compliance_sync_batch',
        new_values: {
          checks_processed: result.totalProcessed,
          factors_updated: result.factorsUpdated,
          successful_syncs: result.successfulSyncs,
          failed_syncs: result.failedSyncs,
          conflicts: result.conflicts.length,
          duration: result.duration,
          compliance_summary: result.complianceSummary
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging compliance sync operation:', error);
    }
  }

  /**
   * Get compliance alerts for monitoring
   */
  async getComplianceAlerts(): Promise<{
    expiringSoon: Array<{
      employerId: string;
      employerName: string;
      complianceType: string;
      expiryDate: string;
      daysUntilExpiry: number;
    }>;
    nonCompliant: Array<{
      employerId: string;
      employerName: string;
      complianceType: string;
      lastChecked: string;
    }>;
    missingData: Array<{
      employerId: string;
      employerName: string;
      missingTypes: string[];
    }>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Get expiring soon compliance
      const { data: expiringSoon } = await supabase
        .from('compliance_checks')
        .select(`
          employer_id,
          check_type,
          expiry_date,
          employers!inner(name)
        `)
        .lte('expiry_date', thirtyDaysFromNow.toISOString())
        .gt('expiry_date', now.toISOString())
        .in('status', ['compliant', 'exempt']);

      // Get non-compliant employers
      const { data: nonCompliant } = await supabase
        .from('compliance_checks')
        .select(`
          employer_id,
          check_type,
          checked_at,
          employers!inner(name)
        `)
        .eq('status', 'non_compliant')
        .order('checked_at', { ascending: false });

      // Get employers missing compliance data
      const { data: allEmployers } = await supabase
        .from('employers')
        .select('id, name')
        .limit(500); // Limit for performance

      const missingData: Array<{
        employerId: string;
        employerName: string;
        missingTypes: string[];
      }> = [];

      for (const employer of allEmployers || []) {
        const { data: employerChecks } = await supabase
          .from('compliance_checks')
          .select('check_type')
          .eq('employer_id', employer.id);

        const existingTypes = (employerChecks || []).map(c => c.check_type);
        const allTypes = ['cbus', 'incolink', 'workers_comp', 'tax', 'super'];
        const missingTypes = allTypes.filter(type => !existingTypes.includes(type));

        if (missingTypes.length > 0) {
          missingData.push({
            employerId: employer.id,
            employerName: employer.name,
            missingTypes
          });
        }
      }

      return {
        expiringSoon: (expiringSoon || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          complianceType: item.check_type,
          expiryDate: item.expiry_date,
          daysUntilExpiry: this.calculateDaysUntilExpiry(item.expiry_date)
        })),
        nonCompliant: (nonCompliant || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          complianceType: item.check_type,
          lastChecked: item.checked_at
        })),
        missingData
      };

    } catch (error) {
      console.error('Error getting compliance alerts:', error);
      return {
        expiringSoon: [],
        nonCompliant: [],
        missingData: []
      };
    }
  }

  /**
   * Get current compliance sync status for monitoring
   */
  async getComplianceSyncStatus(): Promise<{
    lastSync: string | null;
    totalChecks: number;
    activeFactors: number;
    complianceRate: number;
    highRiskCount: number;
    alertsCount: number;
  }> {
    try {
      const [
        { data: lastSync },
        { count: totalChecks },
        { count: activeFactors },
        { data: complianceSummary },
        alerts
      ] = await Promise.all([
        supabase
          .from('sync_metrics')
          .select('sync_date')
          .eq('source_table', 'compliance_checks')
          .order('sync_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('compliance_checks')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('compliance_rating_factors')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('compliance_summary')
          .select('overall_compliance_rate')
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single(),
        this.getComplianceAlerts()
      ]);

      return {
        lastSync: lastSync?.sync_date || null,
        totalChecks: totalChecks || 0,
        activeFactors: activeFactors || 0,
        complianceRate: complianceSummary?.overall_compliance_rate || 0,
        highRiskCount: alerts.nonCompliant.filter(n =>
          alerts.nonCompliant.filter(item => item.employerId === n.employerId).length >= 2
        ).length,
        alertsCount: alerts.expiringSoon.length + alerts.nonCompliant.length + alerts.missingData.length
      };

    } catch (error) {
      console.error('Error getting compliance sync status:', error);
      return {
        lastSync: null,
        totalChecks: 0,
        activeFactors: 0,
        complianceRate: 0,
        highRiskCount: 0,
        alertsCount: 0
      };
    }
  }
}

// Export singleton instance
export const complianceDataService = new ComplianceDataService();