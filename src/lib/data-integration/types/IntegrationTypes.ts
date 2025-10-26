/**
 * Core types for data integration between existing CFMEU data sources
 * and the employer traffic light rating system
 */

// ============================================================================
// Base Integration Types
// ============================================================================

export interface DataSource {
  name: string;
  type: 'employers' | 'projects' | 'compliance' | 'site_visits' | 'eba' | 'worker_placements';
  table: string;
  lastSyncAt?: string;
  status: 'active' | 'inactive' | 'error';
}

export interface SyncOperation {
  id: string;
  sourceTable: string;
  targetTable: string;
  operation: 'insert' | 'update' | 'delete' | 'transform';
  recordId: string;
  data: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  completedAt?: string;
  retryCount: number;
}

export interface DataTransformation {
  sourceField: string;
  targetField: string;
  transform: 'direct' | 'lookup' | 'calculate' | 'conditional' | 'normalize';
  transformFunction?: string;
  required: boolean;
  defaultValue?: any;
}

export interface IntegrationConfig {
  sourceTable: string;
  targetTable: string;
  transformations: DataTransformation[];
  filters?: Record<string, any>;
  batchSize: number;
  syncMode: 'full' | 'incremental' | 'real_time';
  conflictResolution: 'source_wins' | 'target_wins' | 'manual';
}

// ============================================================================
// Employer Data Integration Types
// ============================================================================

export interface LegacyEmployer {
  id: string;
  name: string;
  abn?: string;
  employer_type: string;
  enterprise_agreement_status?: boolean;
  eba_status_source?: string;
  eba_status_updated_at?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployerRatingData {
  id: string;
  employer_id: string;
  overall_rating: 'green' | 'amber' | 'red';
  eba_compliance_score: number;
  cbus_compliance_score: number;
  incolink_compliance_score: number;
  site_visit_score: number;
  historical_performance_score: number;
  worker_welfare_score: number;
  total_projects: number;
  active_projects: number;
  last_updated: string;
  data_quality_score: number;
}

export interface EmployerIntegrationMapping {
  legacyId: string;
  ratingId: string;
  mappedAt: string;
  mappedBy: string;
  confidence: number;
  lastVerified?: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
}

// ============================================================================
// Project Data Integration Types
// ============================================================================

export interface LegacyProject {
  id: string;
  name: string;
  description?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  project_type?: string;
  value?: number;
  start_date?: string;
  end_date?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LegacyProjectAssignment {
  id: string;
  project_id: string;
  employer_id: string;
  assignment_type: 'contractor_role' | 'trade_assignment' | 'labour_hire';
  role_type?: string;
  trade_type?: string;
  start_date?: string;
  end_date?: string;
  is_primary_contact?: boolean;
  created_at: string;
}

export interface ProjectComplianceImpact {
  project_id: string;
  employer_id: string;
  compliance_score_impact: number;
  factors: Array<{
    factor: string;
    impact: number;
    weight: number;
  }>;
  calculated_at: string;
}

// ============================================================================
// Compliance Data Integration Types
// ============================================================================

export interface LegacyComplianceCheck {
  id: string;
  employer_id: string;
  check_type: 'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super';
  status: 'compliant' | 'non_compliant' | 'pending' | 'exempt';
  checked_at: string;
  expiry_date?: string;
  details?: any;
  checked_by?: string;
}

export interface ComplianceRatingFactor {
  employer_id: string;
  factor_type: 'cbus' | 'incolink' | 'workers_comp' | 'tax' | 'super';
  score: number;
  weight: number;
  last_checked: string;
  status: 'active' | 'inactive' | 'pending';
  trend_history: Array<{
    date: string;
    score: number;
    status: string;
  }>;
}

// ============================================================================
// Site Visit Integration Types
// ============================================================================

export interface LegacySiteVisit {
  id: string;
  project_id: string;
  job_site_id?: string;
  employer_id?: string;
  visit_date: string;
  organiser_id: string;
  visit_type: string;
  findings?: any;
  compliance_score?: number;
  recommendations?: string[];
  follow_up_required?: boolean;
  follow_up_date?: string;
  created_at: string;
}

export interface SiteVisitRatingImpact {
  employer_id: string;
  site_visit_id: string;
  impact_score: number;
  impact_factors: Array<{
    factor: string;
    impact: number;
    category: 'safety' | 'compliance' | 'worker_welfare' | 'industrial_relations';
  }>;
  project_id: string;
  visit_date: string;
  decay_rate: number; // How quickly this impact decays over time
}

// ============================================================================
// EBA Data Integration Types
// ============================================================================

export interface LegacyEbaRecord {
  id: string;
  employer_id: string;
  eba_type: string;
  status: string;
  start_date?: string;
  end_date?: string;
  coverage?: string;
  last_updated: string;
  source: string;
  verification_status?: string;
}

export interface EbaRatingFactor {
  employer_id: string;
  eba_status: 'certified' | 'negotiating' | 'expired' | 'none';
  certification_date?: string;
  expiry_date?: string;
  coverage_level: number; // 0-100 percentage
  worker_count: number;
  compliance_score: number;
  last_verified: string;
  verification_source: string;
}

// ============================================================================
// Worker Placement Integration Types
// ============================================================================

export interface LegacyWorkerPlacement {
  id: string;
  worker_id?: string;
  employer_id: string;
  project_id?: string;
  placement_type: string;
  start_date?: string;
  end_date?: string;
  status: string;
  created_at: string;
}

export interface WorkerWelfareFactor {
  employer_id: string;
  total_placements: number;
  active_placements: number;
  average_duration: number;
  placement_success_rate: number;
  welfare_score: number;
  issues_reported: number;
  resolved_issues: number;
  last_calculated: string;
}

// ============================================================================
// Historical Data Types
// ============================================================================

export interface HistoricalDataSnapshot {
  id: string;
  table_name: string;
  record_id: string;
  snapshot_data: any;
  snapshot_date: string;
  changed_fields: string[];
  change_reason: 'sync' | 'migration' | 'correction' | 'update';
  changed_by?: string;
}

export interface DataMigrationBatch {
  id: string;
  source_table: string;
  target_table: string;
  batch_number: number;
  total_records: number;
  processed_records: number;
  failed_records: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  started_at?: string;
  completed_at?: string;
  error_details?: any;
}

// ============================================================================
// Monitoring and Metrics Types
// ============================================================================

export interface SyncMetrics {
  source_table: string;
  sync_date: string;
  total_records: number;
  successful_syncs: number;
  failed_syncs: number;
  average_processing_time: number;
  data_quality_score: number;
  conflict_count: number;
  resolution_time: number;
}

export interface DataQualityMetrics {
  table_name: string;
  record_count: number;
  completeness_score: number;
  accuracy_score: number;
  consistency_score: number;
  validity_score: number;
  last_assessed: string;
  issues: Array<{
    type: 'missing_data' | 'invalid_data' | 'duplicate_data' | 'inconsistent_data';
    field: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface PerformanceMetrics {
  operation: string;
  execution_time: number;
  memory_usage: number;
  cpu_usage: number;
  records_processed: number;
  throughput: number; // records per second
  timestamp: string;
  error_rate: number;
}

// ============================================================================
// Conflict Resolution Types
// ============================================================================

export interface DataConflict {
  id: string;
  source_table: string;
  target_table: string;
  record_id: string;
  field_name: string;
  source_value: any;
  target_value: any;
  conflict_type: 'value_mismatch' | 'missing_data' | 'constraint_violation' | 'reference_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'reviewing' | 'resolved' | 'ignored';
  resolution?: {
    action: 'use_source' | 'use_target' | 'merge' | 'manual';
    resolved_by: string;
    resolved_at: string;
    notes?: string;
  };
  detected_at: string;
}

export interface ConflictResolutionRule {
  id: string;
  table_name: string;
  field_pattern: string;
  conflict_type: string;
  resolution_strategy: 'source_wins' | 'target_wins' | 'most_recent' | 'most_complete' | 'manual';
  priority: number;
  conditions?: Record<string, any>;
  enabled: boolean;
}

// ============================================================================
// Real-time Sync Types
// ============================================================================

export interface DatabaseTrigger {
  id: string;
  table_name: string;
  trigger_name: string;
  event_type: 'INSERT' | 'UPDATE' | 'DELETE';
  trigger_function: string;
  enabled: boolean;
  created_at: string;
  last_fired?: string;
  fire_count: number;
}

export interface SyncEvent {
  id: string;
  event_id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  old_data?: any;
  new_data?: any;
  changed_fields: string[];
  event_timestamp: string;
  processed: boolean;
  processed_at?: string;
  error?: string;
}

export interface RealtimeSubscription {
  id: string;
  table_name: string;
  subscription_type: 'rating_update' | 'compliance_change' | 'new_assignment' | 'data_quality_alert';
  filters?: Record<string, any>;
  webhook_url?: string;
  enabled: boolean;
  created_at: string;
  last_triggered?: string;
}

// ============================================================================
// API Integration Types
// ============================================================================

export interface ExternalDataSource {
  id: string;
  name: string;
  type: 'api' | 'file' | 'database' | 'webhook';
  endpoint_url?: string;
  authentication: {
    type: 'bearer_token' | 'api_key' | 'basic_auth' | 'oauth';
    credentials?: any;
  };
  sync_frequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'manual';
  last_sync?: string;
  status: 'active' | 'inactive' | 'error';
  data_format: 'json' | 'xml' | 'csv' | 'excel';
}

export interface ApiSyncResult {
  source_id: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors: Array<{
    record_id: string;
    error: string;
    data?: any;
  }>;
  sync_duration: number;
  sync_timestamp: string;
}