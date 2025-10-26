/**
 * Incremental Synchronization Service
 * Handles delta synchronization and real-time updates for changed data
 */

import { supabase } from '@/integrations/supabase/client';
import { dataSynchronizer, SyncConfiguration } from './DataSynchronizer';
import { employerDataService } from '../services/EmployerDataService';
import { projectDataService } from '../services/ProjectDataService';
import { complianceDataService } from '../services/ComplianceDataService';
import { siteVisitDataService } from '../services/SiteVisitDataService';
import { ebaDataService } from '../services/EBADataService';

import {
  SyncOperation,
  SyncMetrics,
  SyncEvent,
  RealtimeSubscription,
  DataSource
} from '../types/IntegrationTypes';

import {
  DataConflict,
  AuditLog,
  DataLineageRecord
} from '../types/MigrationTypes';

export interface IncrementalSyncOptions {
  sourceTables: string[];
  lastSyncId?: string;
  batchSize?: number;
  maxChanges?: number;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
  skipValidation?: boolean;
  includeDeletes?: boolean;
}

export interface IncrementalSyncResult {
  syncId: string;
  sourceTable: string;
  changesProcessed: number;
  inserts: number;
  updates: number;
  deletes: number;
  conflicts: DataConflict[];
  errors: Array<{
    operation: string;
    recordId: string;
    error: string;
  }>;
  metrics: SyncMetrics;
  duration: number;
  nextSyncToken?: string;
}

export interface RealtimeSyncConfig {
  table: string;
  events: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  filters?: Record<string, any>;
  batchSize: number;
  debounceMs: number;
  enabled: boolean;
}

export class IncrementalSync {
  private activeSubscriptions: Map<string, RealtimeSubscription> = new Map();
  private changeBuffers: Map<string, SyncEvent[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private syncConfigs: Map<string, RealtimeSyncConfig> = new Map();
  private lastSyncTokens: Map<string, string> = new Map();

  /**
   * Initialize incremental sync system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Incremental Sync system...');

    try {
      // Load existing sync configurations
      await this.loadSyncConfigurations();

      // Setup database triggers for change detection
      await this.setupChangeTriggers();

      // Setup real-time subscriptions
      await this.setupRealtimeSubscriptions();

      // Start change processing loop
      this.startChangeProcessingLoop();

      console.log('Incremental Sync system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Incremental Sync system:', error);
      throw error;
    }
  }

  /**
   * Perform incremental sync for a specific table
   */
  async performIncrementalSync(options: IncrementalSyncOptions): Promise<IncrementalSyncResult[]> {
    console.log(`Starting incremental sync for tables: ${options.sourceTables.join(', ')}`);

    const results: IncrementalSyncResult[] = [];

    for (const table of options.sourceTables) {
      try {
        const result = await this.syncTableChanges(table, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to sync changes for table ${table}:`, error);

        // Create error result
        const errorResult: IncrementalSyncResult = {
          syncId: this.generateSyncId(),
          sourceTable: table,
          changesProcessed: 0,
          inserts: 0,
          updates: 0,
          deletes: 0,
          conflicts: [],
          errors: [{
            operation: 'sync',
            recordId: 'table',
            error: error instanceof Error ? error.message : 'Unknown error'
          }],
          metrics: {
            source_table: table,
            sync_date: new Date().toISOString(),
            total_records: 0,
            successful_syncs: 0,
            failed_syncs: 1,
            average_processing_time: 0,
            data_quality_score: 0,
            conflict_count: 0,
            resolution_time: 0
          },
          duration: 0
        };

        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * Sync changes for a specific table
   */
  private async syncTableChanges(table: string, options: IncrementalSyncOptions): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    const syncId = this.generateSyncId();

    console.log(`Syncing changes for table: ${table}`);

    const result: IncrementalSyncResult = {
      syncId,
      sourceTable: table,
      changesProcessed: 0,
      inserts: 0,
      updates: 0,
      deletes: 0,
      conflicts: [],
      errors: [],
      metrics: {
        source_table: table,
        sync_date: new Date().toISOString(),
        total_records: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        average_processing_time: 0,
        data_quality_score: 0,
        conflict_count: 0,
        resolution_time: 0
      },
      duration: 0
    };

    try {
      // Get changes since last sync
      const changes = await this.getChangesSinceLastSync(table, options.lastSyncId, options.maxChanges);

      console.log(`Found ${changes.length} changes for table ${table}`);

      if (changes.length === 0) {
        console.log(`No changes found for table ${table}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Group changes by operation type
      const groupedChanges = this.groupChangesByOperation(changes);

      // Process changes in batches
      const batchSize = options.batchSize || 50;

      // Process inserts
      if (groupedChanges.inserts.length > 0) {
        const insertResult = await this.processInserts(table, groupedChanges.inserts, options);
        result.inserts += insertResult.processed;
        result.conflicts.push(...insertResult.conflicts);
        result.errors.push(...insertResult.errors);
        result.changesProcessed += insertResult.processed;
      }

      // Process updates
      if (groupedChanges.updates.length > 0) {
        const updateResult = await this.processUpdates(table, groupedChanges.updates, options);
        result.updates += updateResult.processed;
        result.conflicts.push(...updateResult.conflicts);
        result.errors.push(...updateResult.errors);
        result.changesProcessed += updateResult.processed;
      }

      // Process deletes if enabled
      if (options.includeDeletes && groupedChanges.deletes.length > 0) {
        const deleteResult = await this.processDeletes(table, groupedChanges.deletes, options);
        result.deletes += deleteResult.processed;
        result.conflicts.push(...deleteResult.conflicts);
        result.errors.push(...deleteResult.errors);
        result.changesProcessed += deleteResult.processed;
      }

      // Update metrics
      result.metrics.total_records = changes.length;
      result.metrics.successful_syncs = result.changesProcessed - result.errors.length;
      result.metrics.failed_syncs = result.errors.length;
      result.metrics.conflict_count = result.conflicts.length;
      result.metrics.average_processing_time = (Date.now() - startTime) / Math.max(result.changesProcessed, 1);

      // Generate next sync token
      result.nextSyncToken = this.generateSyncToken(changes);

      // Store last sync token
      this.lastSyncTokens.set(table, result.nextSyncToken);

      console.log(`Completed sync for table ${table}: ${result.changesProcessed} changes processed`);

    } catch (error) {
      console.error(`Error syncing changes for table ${table}:`, error);
      result.errors.push({
        operation: 'sync',
        recordId: table,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    result.duration = Date.now() - startTime;

    // Log the sync operation
    await this.logIncrementalSync(result);

    return result;
  }

  /**
   * Get changes since last sync
   */
  private async getChangesSinceLastSync(
    table: string,
    lastSyncId?: string,
    maxChanges?: number
  ): Promise<SyncEvent[]> {
    try {
      let query = supabase
        .from('sync_events')
        .select('*')
        .eq('table_name', table)
        .eq('processed', false)
        .order('event_timestamp', { ascending: true });

      if (lastSyncId) {
        query = query.gt('event_id', lastSyncId);
      }

      if (maxChanges) {
        query = query.limit(maxChanges);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch changes: ${error.message}`);
      }

      return (data || []).map(this.mapToSyncEvent);

    } catch (error) {
      console.error(`Error getting changes for table ${table}:`, error);
      return [];
    }
  }

  /**
   * Group changes by operation type
   */
  private groupChangesByOperation(changes: SyncEvent[]): {
    inserts: SyncEvent[];
    updates: SyncEvent[];
    deletes: SyncEvent[];
  } {
    const grouped = {
      inserts: changes.filter(c => c.operation === 'INSERT'),
      updates: changes.filter(c => c.operation === 'UPDATE'),
      deletes: changes.filter(c => c.operation === 'DELETE')
    };

    return grouped;
  }

  /**
   * Process insert operations
   */
  private async processInserts(
    table: string,
    inserts: SyncEvent[],
    options: IncrementalSyncOptions
  ): Promise<{
    processed: number;
    conflicts: DataConflict[];
    errors: Array<{ operation: string; recordId: string; error: string }>;
  }> {
    const result = {
      processed: 0,
      conflicts: [] as DataConflict[],
      errors: [] as Array<{ operation: string; recordId: string; error: string }>
    };

    const batchSize = options.batchSize || 50;

    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize);

      for (const insertEvent of batch) {
        try {
          // Check for conflicts
          const conflicts = await this.detectInsertConflicts(table, insertEvent);
          if (conflicts.length > 0) {
            result.conflicts.push(...conflicts);

            const resolved = await this.resolveConflicts(conflicts, options.conflictResolution || 'target_wins');
            if (!resolved.allResolved) {
              result.errors.push({
                operation: 'INSERT',
                recordId: insertEvent.record_id,
                error: `Unresolved conflicts: ${resolved.unresolved.join(', ')}`
              });
              continue;
            }
          }

          // Process the insert based on table
          await this.processInsertByTable(table, insertEvent);

          // Mark event as processed
          await this.markEventProcessed(insertEvent.event_id);

          result.processed++;

        } catch (error) {
          console.error(`Failed to process insert for record ${insertEvent.record_id}:`, error);
          result.errors.push({
            operation: 'INSERT',
            recordId: insertEvent.record_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return result;
  }

  /**
   * Process update operations
   */
  private async processUpdates(
    table: string,
    updates: SyncEvent[],
    options: IncrementalSyncOptions
  ): Promise<{
    processed: number;
    conflicts: DataConflict[];
    errors: Array<{ operation: string; recordId: string; error: string }>;
  }> {
    const result = {
      processed: 0,
      conflicts: [] as DataConflict[],
      errors: [] as Array<{ operation: string; recordId: string; error: string }>
    };

    const batchSize = options.batchSize || 50;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      for (const updateEvent of batch) {
        try {
          // Check for conflicts
          const conflicts = await this.detectUpdateConflicts(table, updateEvent);
          if (conflicts.length > 0) {
            result.conflicts.push(...conflicts);

            const resolved = await this.resolveConflicts(conflicts, options.conflictResolution || 'target_wins');
            if (!resolved.allResolved) {
              result.errors.push({
                operation: 'UPDATE',
                recordId: updateEvent.record_id,
                error: `Unresolved conflicts: ${resolved.unresolved.join(', ')}`
              });
              continue;
            }
          }

          // Process the update based on table
          await this.processUpdateByTable(table, updateEvent);

          // Mark event as processed
          await this.markEventProcessed(updateEvent.event_id);

          result.processed++;

        } catch (error) {
          console.error(`Failed to process update for record ${updateEvent.record_id}:`, error);
          result.errors.push({
            operation: 'UPDATE',
            recordId: updateEvent.record_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return result;
  }

  /**
   * Process delete operations
   */
  private async processDeletes(
    table: string,
    deletes: SyncEvent[],
    options: IncrementalSyncOptions
  }: {
    processed: number;
    conflicts: DataConflict[];
    errors: Array<{ operation: string; recordId: string; error: string }>;
  }) {
    const result = {
      processed: 0,
      conflicts: [] as DataConflict[],
      errors: [] as Array<{ operation: string; recordId: string; error: string }>
    };

    for (const deleteEvent of deletes) {
      try {
        // Check for conflicts (e.g., record has dependencies)
        const conflicts = await this.detectDeleteConflicts(table, deleteEvent);
        if (conflicts.length > 0) {
          result.conflicts.push(...conflicts);

          const resolved = await this.resolveConflicts(conflicts, options.conflictResolution || 'target_wins');
          if (!resolved.allResolved) {
            result.errors.push({
              operation: 'DELETE',
              recordId: deleteEvent.record_id,
              error: `Unresolved conflicts: ${resolved.unresolved.join(', ')}`
            });
            continue;
          }
        }

        // Process the delete based on table
        await this.processDeleteByTable(table, deleteEvent);

        // Mark event as processed
        await this.markEventProcessed(deleteEvent.event_id);

        result.processed++;

      } catch (error) {
        console.error(`Failed to process delete for record ${deleteEvent.record_id}:`, error);
        result.errors.push({
          operation: 'DELETE',
          recordId: deleteEvent.record_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Process insert based on table type
   */
  private async processInsertByTable(table: string, event: SyncEvent): Promise<void> {
    switch (table) {
      case 'employers':
        await employerDataService.syncEmployerData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateOnly: false
        });
        break;

      case 'projects':
        await projectDataService.syncProjectData({
          batchSize: 1,
          projectIds: [event.record_id],
          updateAssignmentsOnly: false
        });
        break;

      case 'compliance_checks':
        await complianceDataService.syncComplianceData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateFactorsOnly: false
        });
        break;

      case 'site_visits':
        await siteVisitDataService.syncSiteVisitData({
          batchSize: 1,
          projectIds: [event.record_id],
          updateImpactsOnly: false
        });
        break;

      case 'company_eba_records':
        await ebaDataService.syncEbaData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateFactorsOnly: false
        });
        break;

      default:
        console.warn(`Unknown table for insert processing: ${table}`);
    }
  }

  /**
   * Process update based on table type
   */
  private async processUpdateByTable(table: string, event: SyncEvent): Promise<void> {
    // Similar to insert but with update-specific logic
    switch (table) {
      case 'employers':
        await employerDataService.syncEmployerData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateOnly: true
        });
        break;

      case 'projects':
        await projectDataService.syncProjectData({
          batchSize: 1,
          projectIds: [event.record_id],
          updateAssignmentsOnly: true
        });
        break;

      case 'compliance_checks':
        await complianceDataService.syncComplianceData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateFactorsOnly: true
        });
        break;

      case 'site_visits':
        await siteVisitDataService.syncSiteVisitData({
          batchSize: 1,
          projectIds: [event.record_id],
          updateImpactsOnly: true
        });
        break;

      case 'company_eba_records':
        await ebaDataService.syncEbaData({
          batchSize: 1,
          employerIds: [event.record_id],
          updateFactorsOnly: true
        });
        break;

      default:
        console.warn(`Unknown table for update processing: ${table}`);
    }
  }

  /**
   * Process delete based on table type
   */
  private async processDeleteByTable(table: string, event: SyncEvent): Promise<void> {
    // Handle cascade deletes and related data cleanup
    switch (table) {
      case 'employers':
        // Archive employer data and update related records
        await this.archiveEmployerData(event.record_id);
        break;

      case 'projects':
        // Archive project data and update related records
        await this.archiveProjectData(event.record_id);
        break;

      default:
        console.warn(`Unknown table for delete processing: ${table}`);
    }
  }

  /**
   * Setup real-time subscriptions for change detection
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    console.log('Setting up real-time subscriptions...');

    const subscriptions: RealtimeSyncConfig[] = [
      {
        table: 'employers',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        batchSize: 10,
        debounceMs: 5000,
        enabled: true
      },
      {
        table: 'projects',
        events: ['INSERT', 'UPDATE', 'DELETE'],
        batchSize: 10,
        debounceMs: 5000,
        enabled: true
      },
      {
        table: 'compliance_checks',
        events: ['INSERT', 'UPDATE'],
        batchSize: 20,
        debounceMs: 3000,
        enabled: true
      },
      {
        table: 'site_visits',
        events: ['INSERT', 'UPDATE'],
        batchSize: 15,
        debounceMs: 4000,
        enabled: true
      },
      {
        table: 'company_eba_records',
        events: ['INSERT', 'UPDATE'],
        batchSize: 15,
        debounceMs: 4000,
        enabled: true
      }
    ];

    for (const config of subscriptions) {
      if (config.enabled) {
        await this.createRealtimeSubscription(config);
      }
    }
  }

  /**
   * Create real-time subscription
   */
  private async createRealtimeSubscription(config: RealtimeSyncConfig): Promise<void> {
    try {
      const subscription = supabase
        .channel(`sync_${config.table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: config.table,
            filter: config.filters
          },
          (payload) => {
            this.handleRealtimeChange(config.table, payload);
          }
        )
        .subscribe();

      const realtimeSubscription: RealtimeSubscription = {
        id: `sync_${config.table}`,
        table_name: config.table,
        subscription_type: 'rating_update',
        filters: config.filters,
        enabled: true,
        created_at: new Date().toISOString()
      };

      this.activeSubscriptions.set(config.table, realtimeSubscription);
      this.syncConfigs.set(config.table, config);

      console.log(`Created real-time subscription for table: ${config.table}`);

    } catch (error) {
      console.error(`Failed to create subscription for table ${config.table}:`, error);
    }
  }

  /**
   * Handle real-time change events
   */
  private handleRealtimeChange(table: string, payload: any): void {
    try {
      const config = this.syncConfigs.get(table);
      if (!config || !config.enabled) return;

      const event: SyncEvent = {
        event_id: this.generateEventId(),
        table_name: table,
        operation: payload.eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE',
        record_id: payload.new?.id || payload.old?.id,
        old_data: payload.old,
        new_data: payload.new,
        changed_fields: payload.new ? Object.keys(payload.new) : [],
        event_timestamp: new Date().toISOString(),
        processed: false
      };

      // Buffer the change
      if (!this.changeBuffers.has(table)) {
        this.changeBuffers.set(table, []);
      }

      this.changeBuffers.get(table)!.push(event);

      // Debounce processing
      this.debounceChangeProcessing(table, config.debounceMs);

    } catch (error) {
      console.error(`Error handling real-time change for table ${table}:`, error);
    }
  }

  /**
   * Debounce change processing to avoid excessive syncs
   */
  private debounceChangeProcessing(table: string, debounceMs: number): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(table);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBufferedChanges(table);
    }, debounceMs);

    this.debounceTimers.set(table, timer);
  }

  /**
   * Process buffered changes
   */
  private async processBufferedChanges(table: string): Promise<void> {
    const changes = this.changeBuffers.get(table) || [];
    if (changes.length === 0) return;

    console.log(`Processing ${changes.length} buffered changes for table ${table}`);

    // Clear buffer
    this.changeBuffers.set(table, []);

    try {
      // Perform incremental sync
      await this.performIncrementalSync({
        sourceTables: [table],
        batchSize: this.syncConfigs.get(table)?.batchSize || 10,
        skipValidation: true, // Skip validation for real-time updates
        includeDeletes: true
      });

    } catch (error) {
      console.error(`Failed to process buffered changes for table ${table}:`, error);

      // Re-add changes to buffer for retry
      const existingBuffer = this.changeBuffers.get(table) || [];
      this.changeBuffers.set(table, [...changes, ...existingBuffer]);
    }
  }

  /**
   * Start change processing loop
   */
  private startChangeProcessingLoop(): void {
    // Process changes every 30 seconds
    setInterval(async () => {
      for (const table of this.changeBuffers.keys()) {
        const changes = this.changeBuffers.get(table) || [];
        if (changes.length > 0) {
          await this.processBufferedChanges(table);
        }
      }
    }, 30000);
  }

  // ============================================================================
  // Conflict Detection and Resolution
  // ============================================================================

  private async detectInsertConflicts(table: string, event: SyncEvent): Promise<DataConflict[]> {
    // Check for duplicate records
    const conflicts: DataConflict[] = [];

    try {
      // Implementation would check for conflicts based on table
      if (table === 'employers' && event.new_data?.name) {
        const { data: existing } = await supabase
          .from('employers')
          .select('id, name')
          .eq('name', event.new_data.name)
          .neq('id', event.record_id)
          .maybeSingle();

        if (existing) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: table,
            target_table: table,
            record_id: event.record_id,
            field_name: 'name',
            source_value: event.new_data.name,
            target_value: existing.name,
            conflict_type: 'duplicate_data',
            severity: 'medium',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      console.error('Error detecting insert conflicts:', error);
    }

    return conflicts;
  }

  private async detectUpdateConflicts(table: string, event: SyncEvent): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check if target record has been modified since source
      if (event.old_data && event.new_data) {
        const { data: current } = await supabase
          .from(table)
          .select('*')
          .eq('id', event.record_id)
          .single();

        if (current && current.updated_at !== event.new_data.updated_at) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: table,
            target_table: table,
            record_id: event.record_id,
            field_name: 'updated_at',
            source_value: event.new_data.updated_at,
            target_value: current.updated_at,
            conflict_type: 'value_mismatch',
            severity: 'low',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      console.error('Error detecting update conflicts:', error);
    }

    return conflicts;
  }

  private async detectDeleteConflicts(table: string, event: SyncEvent): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for dependencies
      if (table === 'employers') {
        const { count: projectCount } = await supabase
          .from('project_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('employer_id', event.record_id);

        if (projectCount && projectCount > 0) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: table,
            target_table: 'project_assignments',
            record_id: event.record_id,
            field_name: 'employer_id',
            source_value: null,
            target_value: event.record_id,
            conflict_type: 'reference_error',
            severity: 'high',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      console.error('Error detecting delete conflicts:', error);
    }

    return conflicts;
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
            unresolved.push(`Manual review needed for conflict ${conflict.id}`);
            break;
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
    // Implementation would apply source resolution
    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_source',
          resolved_by: 'incremental_sync',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  private async applyTargetResolution(conflict: DataConflict): Promise<void> {
    // Implementation would apply target resolution
    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_target',
          resolved_by: 'incremental_sync',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async setupChangeTriggers(): Promise<void> {
    // Implementation would create database triggers for change detection
    console.log('Setting up change detection triggers...');
  }

  private async loadSyncConfigurations(): Promise<void> {
    // Implementation would load sync configurations from database
    console.log('Loading sync configurations...');
  }

  private mapToSyncEvent(data: any): SyncEvent {
    return {
      event_id: data.event_id,
      table_name: data.table_name,
      operation: data.operation,
      record_id: data.record_id,
      old_data: data.old_data,
      new_data: data.new_data,
      changed_fields: data.changed_fields || [],
      event_timestamp: data.event_timestamp,
      processed: data.processed,
      processed_at: data.processed_at,
      error: data.error
    };
  }

  private generateSyncId(): string {
    return `inc_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSyncToken(changes: SyncEvent[]): string {
    if (changes.length === 0) return '';
    const lastChange = changes[changes.length - 1];
    return btoa(`${lastChange.event_id}_${lastChange.event_timestamp}`);
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    try {
      await supabase
        .from('sync_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('event_id', eventId);
    } catch (error) {
      console.error('Error marking event as processed:', error);
    }
  }

  private async archiveEmployerData(employerId: string): Promise<void> {
    // Implementation would archive employer data instead of hard delete
    console.log(`Archiving employer data for: ${employerId}`);
  }

  private async archiveProjectData(projectId: string): Promise<void> {
    // Implementation would archive project data instead of hard delete
    console.log(`Archiving project data for: ${projectId}`);
  }

  private async logIncrementalSync(result: IncrementalSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${result.syncId}`,
        migration_id: result.syncId,
        action: 'incremental_data_synchronization',
        actor: 'incremental_sync',
        object_type: 'sync_operation',
        object_id: result.syncId,
        new_values: {
          sourceTable: result.sourceTable,
          changesProcessed: result.changesProcessed,
          inserts: result.inserts,
          updates: result.updates,
          deletes: result.deletes,
          conflicts: result.conflicts.length,
          duration: result.duration
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging incremental sync:', error);
    }
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get incremental sync status
   */
  async getIncrementalSyncStatus(): Promise<{
    activeSubscriptions: number;
    bufferedChanges: number;
    lastSyncTokens: Record<string, string>;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const bufferedChanges = Array.from(this.changeBuffers.values())
      .reduce((total, buffer) => total + buffer.length, 0);

    const lastSyncTokens = Object.fromEntries(this.lastSyncTokens);

    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (bufferedChanges > 1000) {
      systemHealth = 'unhealthy';
    } else if (bufferedChanges > 100) {
      systemHealth = 'degraded';
    }

    return {
      activeSubscriptions: this.activeSubscriptions.size,
      bufferedChanges,
      lastSyncTokens,
      systemHealth
    };
  }

  /**
   * Force sync of buffered changes
   */
  async forceSyncBufferedChanges(): Promise<void> {
    for (const table of this.changeBuffers.keys()) {
      await this.processBufferedChanges(table);
    }
  }

  /**
   * Clear all buffered changes
   */
  clearBufferedChanges(): void {
    this.changeBuffers.clear();

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Add custom sync configuration
   */
  async addSyncConfig(config: RealtimeSyncConfig): Promise<void> {
    this.syncConfigs.set(config.table, config);

    if (config.enabled) {
      await this.createRealtimeSubscription(config);
    }
  }

  /**
   * Remove sync configuration
   */
  async removeSyncConfig(table: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(table);
    if (subscription) {
      await supabase.removeChannel(subscription.id);
      this.activeSubscriptions.delete(table);
    }

    this.syncConfigs.delete(table);
    this.changeBuffers.delete(table);

    const timer = this.debounceTimers.get(table);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(table);
    }
  }
}

// Export singleton instance
export const incrementalSync = new IncrementalSync();