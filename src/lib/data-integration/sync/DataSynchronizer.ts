/**
 * Main Data Synchronization Engine
 * Orchestrates the synchronization of all data sources and provides
 * centralized coordination for the CFMEU rating system data integration
 */

import { supabase } from '@/integrations/supabase/client';
import { employerDataService, EmployerSyncResult } from '../services/EmployerDataService';
import { projectDataService, ProjectSyncResult } from '../services/ProjectDataService';
import { complianceDataService, ComplianceSyncResult } from '../services/ComplianceDataService';
import { siteVisitDataService, SiteVisitSyncResult } from '../services/SiteVisitDataService';
import { ebaDataService, EbaSyncResult } from '../services/EBADataService';

import {
  DataSource,
  SyncOperation,
  SyncMetrics,
  DataConflict,
  ExternalDataSource,
  ApiSyncResult
} from '../types/IntegrationTypes';

import {
  MigrationPipeline,
  MigrationPhase,
  DataValidationReport,
  AuditLog,
  RecoveryPoint
} from '../types/MigrationTypes';

export interface SyncConfiguration {
  syncId: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: {
    frequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
    timezone: string;
    retryAttempts: number;
    retryDelay: number; // in minutes
  };
  sources: {
    employers: boolean;
    projects: boolean;
    compliance: boolean;
    siteVisits: boolean;
    eba: boolean;
  };
  options: {
    batchSize: number;
    skipValidation: boolean;
    conflictResolution: 'source_wins' | 'target_wins' | 'manual';
    includeHistorical: boolean;
    historicalYears: number;
    parallelProcessing: boolean;
    maxConcurrentSyncs: number;
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onConflict: boolean;
    recipients: string[];
  };
}

export interface OverallSyncResult {
  syncId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  phase: string;
  results: {
    employers?: EmployerSyncResult;
    projects?: ProjectSyncResult;
    compliance?: ComplianceSyncResult;
    siteVisits?: SiteVisitSyncResult;
    eba?: EbaSyncResult;
  };
  summary: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    totalConflicts: number;
    overallDuration: number;
    dataQualityScore: number;
  };
  errors: Array<{
    source: string;
    phase: string;
    error: string;
    timestamp: string;
  }>;
  metrics: SyncMetrics[];
  alerts: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    source: string;
    timestamp: string;
  }>;
}

export class DataSynchronizer {
  private activeSyncs: Map<string, OverallSyncResult> = new Map();
  private syncQueue: Array<{ config: SyncConfiguration; priority: number }> = [];
  private maxConcurrentSyncs = 3;
  private syncHistory: OverallSyncResult[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  /**
   * Initialize the synchronizer with default configurations
   */
  async initialize(): Promise<void> {
    console.log('Initializing Data Synchronizer...');

    try {
      // Load existing sync configurations
      await this.loadSyncConfigurations();

      // Set up monitoring and alerting
      await this.setupMonitoring();

      // Start sync scheduler
      this.startSyncScheduler();

      // Clean up old history
      this.cleanupHistory();

      console.log('Data Synchronizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Data Synchronizer:', error);
      throw error;
    }
  }

  /**
   * Execute a complete synchronization of all enabled data sources
   */
  async executeFullSync(config: SyncConfiguration): Promise<OverallSyncResult> {
    const syncId = config.syncId || this.generateSyncId();

    console.log(`Starting full synchronization: ${syncId}`);

    const syncResult: OverallSyncResult = {
      syncId,
      startedAt: new Date().toISOString(),
      status: 'running',
      phase: 'initialization',
      results: {},
      summary: {
        totalProcessed: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        totalConflicts: 0,
        overallDuration: 0,
        dataQualityScore: 0
      },
      errors: [],
      metrics: [],
      alerts: []
    };

    this.activeSyncs.set(syncId, syncResult);

    try {
      // Create recovery point
      await this.createRecoveryPoint(syncId);

      // Determine sync order based on dependencies
      const syncOrder = this.determineSyncOrder(config);

      // Execute syncs in order
      for (const { source, options } of syncOrder) {
        if (!config.sources[source as keyof typeof config.sources]) {
          console.log(`Skipping ${source} - disabled in configuration`);
          continue;
        }

        syncResult.phase = `syncing_${source}`;
        console.log(`Executing ${source} sync...`);

        try {
          const result = await this.executeSourceSync(source, options, config.options);
          syncResult.results[source as keyof typeof syncResult.results] = result;

          // Update summary
          this.updateSyncSummary(syncResult, result);

          // Check for critical errors
          if (this.hasCriticalErrors(result)) {
            syncResult.alerts.push({
              type: 'error',
              message: `Critical errors detected in ${source} sync`,
              source,
              timestamp: new Date().toISOString()
            });

            if (config.options.skipValidation) {
              console.warn(`Critical errors in ${source} but continuing due to skip validation`);
            } else {
              throw new Error(`Critical errors in ${source} sync`);
            }
          }

        } catch (error) {
          console.error(`Failed to sync ${source}:`, error);
          syncResult.errors.push({
            source,
            phase: 'sync_execution',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });

          // Decide whether to continue or abort
          if (this.shouldAbortSync(source, error, config)) {
            throw new Error(`Aborting sync due to critical failure in ${source}`);
          }
        }
      }

      // Final validation and cleanup
      syncResult.phase = 'validation';
      await this.performFinalValidation(syncResult);

      syncResult.phase = 'cleanup';
      await this.performCleanup(syncResult);

      // Calculate final metrics
      syncResult.summary.overallDuration = Date.now() - new Date(syncResult.startedAt).getTime();
      syncResult.summary.dataQualityScore = await this.calculateOverallDataQuality(syncResult);

      syncResult.status = 'completed';
      syncResult.completedAt = new Date().toISOString();

      console.log(`Full synchronization completed: ${syncId}`);

      // Send notifications
      if (config.notifications.onSuccess) {
        await this.sendSuccessNotification(config, syncResult);
      }

    } catch (error) {
      console.error(`Full synchronization failed: ${syncId}`, error);

      syncResult.status = 'failed';
      syncResult.completedAt = new Date().toISOString();
      syncResult.errors.push({
        source: 'system',
        phase: 'sync_execution',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      // Send failure notification
      if (config.notifications.onFailure) {
        await this.sendFailureNotification(config, syncResult, error);
      }

      // Attempt rollback if critical
      if (this.shouldRollback(error)) {
        await this.attemptRollback(syncId);
      }
    }

    // Store in history and cleanup active sync
    this.syncHistory.push(syncResult);
    this.activeSyncs.delete(syncId);

    // Log the sync operation
    await this.logSyncOperation(config, syncResult);

    return syncResult;
  }

  /**
   * Execute a specific data source sync
   */
  private async executeSourceSync(
    source: string,
    options: any,
    globalOptions: SyncConfiguration['options']
  ): Promise<any> {
    const mergedOptions = { ...globalOptions, ...options };

    switch (source) {
      case 'employers':
        return await employerDataService.syncEmployerData(mergedOptions);

      case 'projects':
        return await projectDataService.syncProjectData(mergedOptions);

      case 'compliance':
        return await complianceDataService.syncComplianceData(mergedOptions);

      case 'siteVisits':
        return await siteVisitDataService.syncSiteVisitData(mergedOptions);

      case 'eba':
        return await ebaDataService.syncEbaData(mergedOptions);

      default:
        throw new Error(`Unknown data source: ${source}`);
    }
  }

  /**
   * Determine the optimal order for synchronization based on dependencies
   */
  private determineSyncOrder(config: SyncConfiguration): Array<{ source: string; options: any }> {
    // Standard dependency order: Employers -> EBA -> Compliance -> Projects -> Site Visits
    const order = [
      { source: 'employers', options: { updateOnly: false } },
      { source: 'eba', options: { updateFactorsOnly: false } },
      { source: 'compliance', options: { updateFactorsOnly: false } },
      { source: 'projects', options: { updateAssignmentsOnly: false } },
      { source: 'siteVisits', options: { updateImpactsOnly: false } }
    ];

    return order.filter(item => config.sources[item.source as keyof typeof config.sources]);
  }

  /**
   * Update sync summary with results from a source
   */
  private updateSyncSummary(syncResult: OverallSyncResult, result: any): void {
    if (!result) return;

    syncResult.summary.totalProcessed += result.totalProcessed || 0;
    syncResult.summary.totalSuccessful += result.successfulSyncs || 0;
    syncResult.summary.totalFailed += result.failedSyncs || 0;
    syncResult.summary.totalConflicts += (result.conflicts?.length || 0) + (result.factorsUpdated || 0);

    // Add metrics if available
    if (result.metrics) {
      syncResult.metrics.push(result.metrics);
    }
  }

  /**
   * Check if sync result has critical errors
   */
  private hasCriticalErrors(result: any): boolean {
    if (!result) return false;

    // Check for high failure rate
    const totalProcessed = result.totalProcessed || 0;
    const failedSyncs = result.failedSyncs || 0;

    if (totalProcessed > 0 && (failedSyncs / totalProcessed) > 0.5) {
      return true;
    }

    // Check for critical conflicts
    const criticalConflicts = result.conflicts?.filter((c: any) => c.severity === 'critical') || [];
    if (criticalConflicts.length > 10) {
      return true;
    }

    return false;
  }

  /**
   * Determine if sync should be aborted based on error
   */
  private shouldAbortSync(source: string, error: any, config: SyncConfiguration): boolean {
    // Always abort on system-level errors
    if (source === 'system') return true;

    // Don't abort if validation is skipped
    if (config.options.skipValidation) return false;

    // Abort on database connection errors
    if (error instanceof Error && error.message.includes('database')) {
      return true;
    }

    // Abort on authentication errors
    if (error instanceof Error && error.message.includes('authentication')) {
      return true;
    }

    return false;
  }

  /**
   * Perform final validation of all synced data
   */
  private async performFinalValidation(syncResult: OverallSyncResult): Promise<void> {
    console.log('Performing final validation...');

    try {
      // Validate data consistency across sources
      await this.validateCrossSourceConsistency(syncResult);

      // Validate rating calculations
      await this.validateRatingCalculations(syncResult);

      // Check for orphaned records
      await this.checkForOrphanedRecords(syncResult);

      console.log('Final validation completed');

    } catch (error) {
      console.error('Final validation failed:', error);
      syncResult.errors.push({
        source: 'system',
        phase: 'final_validation',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Perform cleanup operations after sync
   */
  private async performCleanup(syncResult: OverallSyncResult): Promise<void> {
    console.log('Performing cleanup operations...');

    try {
      // Clean up temporary data
      await this.cleanupTemporaryData(syncResult);

      // Update materialized views
      await this.updateMaterializedViews();

      // Refresh caches
      await this.refreshCaches();

      console.log('Cleanup operations completed');

    } catch (error) {
      console.error('Cleanup operations failed:', error);
      syncResult.errors.push({
        source: 'system',
        phase: 'cleanup',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Calculate overall data quality score
   */
  private async calculateOverallDataQuality(syncResult: OverallSyncResult): Promise<number> {
    try {
      const qualityScores: number[] = [];

      // Get data quality metrics from each source
      for (const [source, result] of Object.entries(syncResult.results)) {
        if (result && result.metrics) {
          qualityScores.push(result.metrics.data_quality_score || 0);
        }
      }

      if (qualityScores.length === 0) return 0;

      // Calculate weighted average
      const totalWeight = qualityScores.length;
      const weightedSum = qualityScores.reduce((sum, score) => sum + score, 0);

      return Math.round(weightedSum / totalWeight);

    } catch (error) {
      console.error('Error calculating overall data quality:', error);
      return 0;
    }
  }

  /**
   * Create a recovery point for rollback capability
   */
  private async createRecoveryPoint(syncId: string): Promise<void> {
    try {
      const recoveryPoint: RecoveryPoint = {
        id: `recovery_${syncId}`,
        migration_id: syncId,
        timestamp: new Date().toISOString(),
        table_snapshots: [],
        metadata: {
          sync_type: 'full_sync',
          created_by: 'data_synchronizer'
        },
        size_bytes: 0,
        compressed: false,
        retention_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      await supabase
        .from('recovery_points')
        .insert(recoveryPoint);

    } catch (error) {
      console.error('Error creating recovery point:', error);
      // Don't fail the sync for recovery point issues
    }
  }

  /**
   * Attempt rollback to previous recovery point
   */
  private async attemptRollback(syncId: string): Promise<void> {
    console.log(`Attempting rollback for sync: ${syncId}`);

    try {
      const { data: recoveryPoint } = await supabase
        .from('recovery_points')
        .select('*')
        .eq('migration_id', syncId)
        .single();

      if (!recoveryPoint) {
        console.warn('No recovery point found for sync:', syncId);
        return;
      }

      // In a real implementation, this would execute rollback steps
      console.log('Rollback functionality would be implemented here');

    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }

  /**
   * Load existing sync configurations from database
   */
  private async loadSyncConfigurations(): Promise<void> {
    try {
      const { data: configs } = await supabase
        .from('sync_configurations')
        .select('*')
        .eq('enabled', true);

      if (configs) {
        for (const config of configs) {
          // Add to queue based on schedule
          this.syncQueue.push({
            config: config as SyncConfiguration,
            priority: this.calculatePriority(config)
          });
        }
      }

      // Sort queue by priority
      this.syncQueue.sort((a, b) => b.priority - a.priority);

    } catch (error) {
      console.error('Error loading sync configurations:', error);
    }
  }

  /**
   * Calculate priority for sync configuration
   */
  private calculatePriority(config: SyncConfiguration): number {
    let priority = 0;

    // Higher priority for real-time syncs
    if (config.schedule.frequency === 'real_time') priority += 100;

    // Higher priority for critical data sources
    if (config.sources.employers) priority += 30;
    if (config.sources.compliance) priority += 25;
    if (config.sources.eba) priority += 20;
    if (config.sources.projects) priority += 15;
    if (config.sources.siteVisits) priority += 10;

    return priority;
  }

  /**
   * Setup monitoring and alerting
   */
  private async setupMonitoring(): Promise<void> {
    console.log('Setting up monitoring and alerting...');

    // Setup database triggers for monitoring
    await this.setupMonitoringTriggers();

    // Setup health checks
    await this.setupHealthChecks();

    // Setup performance monitoring
    await this.setupPerformanceMonitoring();
  }

  /**
   * Start the sync scheduler
   */
  private startSyncScheduler(): void {
    console.log('Starting sync scheduler...');

    // Check for scheduled syncs every minute
    setInterval(async () => {
      await this.processScheduledSyncs();
    }, 60 * 1000);
  }

  /**
   * Process scheduled syncs
   */
  private async processScheduledSyncs(): Promise<void> {
    if (this.activeSyncs.size >= this.maxConcurrentSyncs) {
      return; // Too many active syncs
    }

    const now = new Date();
    const readySyncs = this.syncQueue.filter(item => this.isSyncReady(item.config, now));

    for (const { config } of readySyncs.slice(0, this.maxConcurrentSyncs - this.activeSyncs.size)) {
      try {
        // Execute sync in background
        this.executeFullSync(config).catch(error => {
          console.error(`Scheduled sync failed for ${config.syncId}:`, error);
        });
      } catch (error) {
        console.error(`Failed to start scheduled sync for ${config.syncId}:`, error);
      }
    }
  }

  /**
   * Check if sync is ready to run based on schedule
   */
  private isSyncReady(config: SyncConfiguration, now: Date): boolean {
    if (config.schedule.frequency === 'manual') return false;
    if (config.schedule.frequency === 'real_time') return true;

    // Check if enough time has passed since last sync
    // This would need to be implemented based on actual sync history
    return true;
  }

  /**
   * Clean up old sync history
   */
  private cleanupHistory(): void {
    if (this.syncHistory.length > this.MAX_HISTORY_SIZE) {
      this.syncHistory = this.syncHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Validate cross-source data consistency
   */
  private async validateCrossSourceConsistency(syncResult: OverallSyncResult): Promise<void> {
    // Implementation would check for consistency between different data sources
    console.log('Validating cross-source consistency...');
  }

  /**
   * Validate rating calculations
   */
  private async validateRatingCalculations(syncResult: OverallSyncResult): Promise<void> {
    // Implementation would verify that rating calculations are correct
    console.log('Validating rating calculations...');
  }

  /**
   * Check for orphaned records
   */
  private async checkForOrphanedRecords(syncResult: OverallSyncResult): Promise<void> {
    // Implementation would check for records without proper references
    console.log('Checking for orphaned records...');
  }

  /**
   * Clean up temporary data
   */
  private async cleanupTemporaryData(syncResult: OverallSyncResult): Promise<void> {
    // Implementation would clean up any temporary data created during sync
    console.log('Cleaning up temporary data...');
  }

  /**
   * Update materialized views
   */
  private async updateMaterializedViews(): Promise<void> {
    try {
      // Update key materialized views
      await supabase.rpc('refresh_employer_search_view');
      await supabase.rpc('refresh_project_summary_view');
      await supabase.rpc('refresh_compliance_dashboard_view');

    } catch (error) {
      console.error('Error updating materialized views:', error);
    }
  }

  /**
   * Refresh caches
   */
  private async refreshCaches(): Promise<void> {
    // Implementation would refresh application caches
    console.log('Refreshing caches...');
  }

  /**
   * Setup monitoring triggers
   */
  private async setupMonitoringTriggers(): Promise<void> {
    // Implementation would set up database triggers for monitoring
    console.log('Setting up monitoring triggers...');
  }

  /**
   * Setup health checks
   */
  private async setupHealthChecks(): Promise<void> {
    // Implementation would set up health check endpoints
    console.log('Setting up health checks...');
  }

  /**
   * Setup performance monitoring
   */
  private async setupPerformanceMonitoring(): Promise<void> {
    // Implementation would set up performance monitoring
    console.log('Setting up performance monitoring...');
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(config: SyncConfiguration, result: OverallSyncResult): Promise<void> {
    // Implementation would send success notifications
    console.log('Sending success notification...');
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(config: SyncConfiguration, result: OverallSyncResult, error: any): Promise<void> {
    // Implementation would send failure notifications
    console.log('Sending failure notification...');
  }

  /**
   * Determine if rollback should be attempted
   */
  private shouldRollback(error: any): boolean {
    // Rollback on critical system errors
    return error instanceof Error && (
      error.message.includes('database constraint') ||
      error.message.includes('data corruption')
    );
  }

  /**
   * Log sync operation to audit trail
   */
  private async logSyncOperation(config: SyncConfiguration, result: OverallSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${result.syncId}`,
        migration_id: result.syncId,
        action: 'full_data_synchronization',
        actor: 'data_synchronizer',
        object_type: 'sync_operation',
        object_id: result.syncId,
        new_values: {
          configuration: config.name,
          duration: result.summary.overallDuration,
          totalProcessed: result.summary.totalProcessed,
          totalSuccessful: result.summary.totalSuccessful,
          totalFailed: result.summary.totalFailed,
          dataQualityScore: result.summary.dataQualityScore
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging sync operation:', error);
    }
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<{
    activeSyncs: Array<{
      syncId: string;
      phase: string;
      duration: number;
      status: string;
    }>;
    queueLength: number;
    lastSync: OverallSyncResult | null;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const activeSyncs = Array.from(this.activeSyncs.values()).map(sync => ({
      syncId: sync.syncId,
      phase: sync.phase,
      duration: Date.now() - new Date(sync.startedAt).getTime(),
      status: sync.status
    }));

    const lastSync = this.syncHistory.length > 0 ? this.syncHistory[this.syncHistory.length - 1] : null;

    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (activeSyncs.length > 0) {
      const failedSyncs = activeSyncs.filter(s => s.status === 'failed');
      if (failedSyncs.length > 0) {
        systemHealth = 'unhealthy';
      } else if (activeSyncs.length > 2) {
        systemHealth = 'degraded';
      }
    }

    return {
      activeSyncs,
      queueLength: this.syncQueue.length,
      lastSync,
      systemHealth
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 50): Promise<OverallSyncResult[]> {
    return this.syncHistory.slice(-limit);
  }

  /**
   * Cancel an active sync
   */
  async cancelSync(syncId: string): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId);
    if (!sync) return false;

    sync.status = 'failed';
    sync.completedAt = new Date().toISOString();
    sync.errors.push({
      source: 'system',
      phase: 'cancelled',
      error: 'Sync cancelled by user',
      timestamp: new Date().toISOString()
    });

    this.activeSyncs.delete(syncId);
    this.syncHistory.push(sync);

    return true;
  }

  /**
   * Pause all syncs
   */
  pauseAllSyncs(): void {
    for (const sync of this.activeSyncs.values()) {
      if (sync.status === 'running') {
        sync.status = 'paused';
      }
    }
  }

  /**
   * Resume all paused syncs
   */
  resumeAllSyncs(): void {
    for (const sync of this.activeSyncs.values()) {
      if (sync.status === 'paused') {
        sync.status = 'running';
      }
    }
  }

  /**
   * Force sync of specific data sources
   */
  async forceSync(sources: string[], options: any = {}): Promise<OverallSyncResult> {
    const config: SyncConfiguration = {
      syncId: this.generateSyncId(),
      name: `Force Sync - ${sources.join(', ')}`,
      description: 'Manual force sync triggered by user',
      enabled: true,
      schedule: {
        frequency: 'manual',
        timezone: 'UTC',
        retryAttempts: 3,
        retryDelay: 5
      },
      sources: {
        employers: sources.includes('employers'),
        projects: sources.includes('projects'),
        compliance: sources.includes('compliance'),
        siteVisits: sources.includes('siteVisits'),
        eba: sources.includes('eba')
      },
      options: {
        batchSize: 50,
        skipValidation: false,
        conflictResolution: 'target_wins',
        includeHistorical: false,
        historicalYears: 1,
        parallelProcessing: false,
        maxConcurrentSyncs: 1,
        ...options
      },
      notifications: {
        onSuccess: false,
        onFailure: true,
        onConflict: false,
        recipients: []
      }
    };

    return await this.executeFullSync(config);
  }
}

// Export singleton instance
export const dataSynchronizer = new DataSynchronizer();