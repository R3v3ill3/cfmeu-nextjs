/**
 * Migration-specific types for historical data migration and backfilling
 */

import { DataMigrationBatch, HistoricalDataSnapshot, DataConflict } from './IntegrationTypes';

// ============================================================================
// Migration Pipeline Types
// ============================================================================

export interface MigrationPipeline {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed' | 'paused';
  phases: MigrationPhase[];
  current_phase?: number;
  started_at?: string;
  completed_at?: string;
  total_records?: number;
  processed_records?: number;
  error_count?: number;
  rollback_available: boolean;
}

export interface MigrationPhase {
  id: string;
  name: string;
  type: 'discovery' | 'validation' | 'transformation' | 'load' | 'verification';
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  config: PhaseConfig;
  dependencies: string[]; // phase IDs that must complete first
  estimated_duration?: number; // in minutes
  actual_duration?: number; // in minutes
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface PhaseConfig {
  source_tables: string[];
  target_tables: string[];
  batch_size: number;
  parallel_workers: number;
  timeout_seconds: number;
  retry_attempts: number;
  validation_rules: ValidationRule[];
  transformation_rules: TransformationRule[];
  conflict_resolution: ConflictResolutionStrategy;
}

// ============================================================================
// Data Validation Types
// ============================================================================

export interface ValidationRule {
  id: string;
  field_path: string; // dot notation for nested fields
  rule_type: 'required' | 'format' | 'range' | 'enum' | 'custom' | 'reference';
  parameters: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  error_message?: string;
  enabled: boolean;
}

export interface ValidationResult {
  rule_id: string;
  record_id: string;
  field_path: string;
  status: 'pass' | 'fail' | 'warning';
  message?: string;
  actual_value?: any;
  expected_value?: any;
  severity: 'error' | 'warning' | 'info';
}

export interface DataValidationReport {
  migration_id: string;
  phase_id?: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  warning_records: number;
  validation_results: ValidationResult[];
  summary: {
    completeness_score: number;
    accuracy_score: number;
    consistency_score: number;
    overall_quality_score: number;
  };
  generated_at: string;
}

// ============================================================================
// Data Transformation Types
// ============================================================================

export interface TransformationRule {
  id: string;
  name: string;
  source_field: string;
  target_field: string;
  transformation_type: 'direct' | 'lookup' | 'calculate' | 'conditional' | 'split' | 'merge' | 'format' | 'normalize';
  transformation_logic: string; // SQL or JavaScript expression
  parameters?: Record<string, any>;
  dependencies?: string[]; // other transformations that must run first
  error_handling: 'skip' | 'default' | 'fail';
  default_value?: any;
  order: number;
}

export interface TransformationResult {
  rule_id: string;
  record_id: string;
  source_value: any;
  target_value: any;
  transformed: boolean;
  error?: string;
  transformation_time: number; // in milliseconds
}

export interface FieldMapping {
  source_table: string;
  source_field: string;
  target_table: string;
  target_field: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array';
  required: boolean;
  default_value?: any;
  validation_rules: string[]; // validation rule IDs
  transformation_rules: string[]; // transformation rule IDs
}

// ============================================================================
// Conflict Resolution Types
// ============================================================================

export interface ConflictResolutionStrategy {
  strategy: 'source_wins' | 'target_wins' | 'most_recent' | 'most_complete' | 'merge' | 'manual' | 'skip';
  conditions?: Record<string, any>;
  merge_logic?: string;
  escalation_rules?: EscalationRule[];
}

export interface EscalationRule {
  condition: string; // when to escalate
  action: 'notify' | 'pause' | 'fail' | 'manual_review';
  recipients: string[];
  message_template?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConflictBatch {
  id: string;
  migration_id: string;
  conflicts: DataConflict[];
  resolution_strategy: ConflictResolutionStrategy;
  status: 'pending' | 'reviewing' | 'resolved' | 'escalated';
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
}

// ============================================================================
// Migration Execution Types
// ============================================================================

export interface MigrationJob {
  id: string;
  migration_id: string;
  phase_id: string;
  batch_id: string;
  job_type: 'extract' | 'transform' | 'load' | 'validate';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  worker_id?: string;
  started_at?: string;
  completed_at?: string;
  duration?: number; // in seconds
  records_processed: number;
  records_successful: number;
  records_failed: number;
  error_message?: string;
  retry_count: number;
  max_retries: number;
}

export interface JobQueue {
  id: string;
  name: string;
  max_workers: number;
  current_workers: number;
  queue_size: number;
  processing_rate: number; // jobs per minute
  average_wait_time: number; // in seconds
  status: 'active' | 'paused' | 'stopped';
}

// ============================================================================
// Rollback and Recovery Types
// ============================================================================

export interface RollbackPlan {
  migration_id: string;
  rollback_steps: RollbackStep[];
  backup_created: boolean;
  backup_location?: string;
  rollback_available_until: string;
  test_performed: boolean;
  test_results?: RollbackTestResult;
}

export interface RollbackStep {
  order: number;
  description: string;
  action: 'delete_records' | 'restore_records' | 'truncate_table' | 'disable_triggers' | 'restore_backup';
  target_table: string;
  conditions?: Record<string, any>;
  estimated_duration: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface RollbackTestResult {
  test_date: string;
  test_environment: string;
  steps_tested: number;
  steps_successful: number;
  test_duration: number;
  issues: Array<{
    step_order: number;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overall_success: boolean;
}

export interface RecoveryPoint {
  id: string;
  migration_id: string;
  timestamp: string;
  table_snapshots: TableSnapshot[];
  metadata: Record<string, any>;
  size_bytes: number;
  compressed: boolean;
  retention_date: string;
}

export interface TableSnapshot {
  table_name: string;
  record_count: number;
  snapshot_format: 'sql' | 'csv' | 'json' | 'binary';
  file_path?: string;
  checksum?: string;
  created_at: string;
}

// ============================================================================
// Migration Monitoring Types
// ============================================================================

export interface MigrationProgress {
  migration_id: string;
  phase_progress: Array<{
    phase_id: string;
    phase_name: string;
    status: string;
    progress_percentage: number;
    estimated_remaining_time?: number;
    current_batch?: number;
    total_batches?: number;
    records_processed: number;
    total_records: number;
  }>;
  overall_progress: number;
  estimated_completion?: string;
  current_rate: number; // records per minute
  average_rate: number;
  error_rate: number; // percentage
  memory_usage: number; // in MB
  cpu_usage: number; // percentage
}

export interface MigrationAlert {
  id: string;
  migration_id: string;
  alert_type: 'error' | 'warning' | 'info' | 'milestone';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
  phase_id?: string;
  batch_id?: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

export interface MigrationMetrics {
  migration_id: string;
  phase_id?: string;
  metric_type: 'performance' | 'quality' | 'throughput' | 'errors';
  metric_name: string;
  metric_value: number;
  unit: string;
  timestamp: string;
  dimensions?: Record<string, string>;
}

// ============================================================================
// Testing and Validation Types
// ============================================================================

export interface MigrationTest {
  id: string;
  name: string;
  test_type: 'data_integrity' | 'performance' | 'rollback' | 'edge_case' | 'load';
  description: string;
  test_data_config: TestDataConfig;
  expected_results: ExpectedResults;
  test_environment: 'development' | 'staging' | 'production_readonly';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  executed_at?: string;
  duration?: number;
  results?: TestResults;
}

export interface TestDataConfig {
  source_data_generator: string;
  data_volume: number;
  data_variations: string[];
  edge_cases: string[];
  custom_data?: Record<string, any>;
}

export interface ExpectedResults {
  record_counts: Record<string, number>;
  data_quality_score: number;
  performance_thresholds: Record<string, number>;
  validation_rules: string[];
}

export interface TestResults {
  passed: boolean;
  actual_results: Record<string, any>;
  differences: Array<{
    field: string;
    expected: any;
    actual: any;
    difference: string;
  }>;
  performance_metrics: Record<string, number>;
  quality_metrics: Record<string, number>;
  issues: Array<{
    severity: string;
    category: string;
    description: string;
    count?: number;
  }>;
  recommendations: string[];
}

// ============================================================================
// Data Lineage and Audit Types
// ============================================================================

export interface DataLineageRecord {
  id: string;
  source_record_id: string;
  source_table: string;
  target_record_id: string;
  target_table: string;
  transformation_applied: string;
  migration_id: string;
  transformed_at: string;
  transformation_hash: string; // for change detection
  quality_score: number;
  confidence_level: number;
}

export interface AuditLog {
  id: string;
  migration_id: string;
  action: string;
  actor: string;
  object_type: 'migration' | 'phase' | 'batch' | 'record' | 'conflict';
  object_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface DataChangeRecord {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value: any;
  new_value: any;
  change_type: 'create' | 'update' | 'delete';
  changed_by: string;
  changed_at: string;
  migration_id?: string;
  reason?: string;
}