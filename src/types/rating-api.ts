// Comprehensive TypeScript types for the Employer Traffic Light Rating System API
// This file contains all the type definitions used across the rating system API endpoints

// =============================================================================
// BASE TYPES AND ENUMS
// =============================================================================

export type TrafficLightRating = 'green' | 'amber' | 'red' | 'unknown';
export type ComplianceAssessmentType =
  | 'cbus_status'
  | 'incolink_status'
  | 'site_visit_report'
  | 'delegate_report'
  | 'organiser_verbal_report'
  | 'organiser_written_report'
  | 'eca_status'
  | 'safety_incidents'
  | 'industrial_disputes'
  | 'payment_issues';
export type RatingSourceType = 'project_assessment' | 'organiser_expertise' | 'calculated_final' | 'manual_override';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';
export type RatingStatus = 'active' | 'under_review' | 'disputed' | 'superseded' | 'archived';
export type UserRole = 'organiser' | 'lead_organiser' | 'admin';

// =============================================================================
// TRACK 1: PROJECT COMPLIANCE ASSESSMENTS
// =============================================================================

export interface CreateComplianceAssessmentRequest {
  employer_id: string;
  project_id: string;
  assessment_type: ComplianceAssessmentType;
  score?: number | null;
  rating?: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  severity_level?: number | null;
  assessment_notes?: string | null;
  assessment_date: string;
  evidence_attachments?: string[] | null;
  follow_up_required?: boolean;
  follow_up_date?: string | null;
  organiser_id?: string | null;
  site_visit_id?: string | null;
}

export interface ComplianceAssessmentResponse {
  id: string;
  employer_id: string;
  project_id: string;
  assessment_type: ComplianceAssessmentType;
  score: number | null;
  rating: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  severity_level: number | null;
  assessment_notes: string | null;
  assessment_date: string;
  evidence_attachments: string[] | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  organiser_id: string | null;
  site_visit_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ComplianceAssessmentsListResponse {
  assessments: ComplianceAssessmentResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_assessments: number;
    assessments_by_type: Record<string, number>;
    average_score: number | null;
    latest_assessment_date: string | null;
  };
}

export interface ProjectComplianceAssessment {
  assessment_type: string;
  score: number | null;
  confidence_level: string;
  assessment_date: string;
  weight: number;
  severity_level: number | null;
  severity_name: string | null;
  project_id: string | null;
  project_name: string | null;
  project_tier: string | null;
  assessment_notes: string | null;
}

export interface ProjectComplianceSummary {
  employer_id: string;
  calculation_date: string;
  project_rating: TrafficLightRating;
  project_score: number | null;
  data_quality: ConfidenceLevel;
  assessment_count: number;
  assessments: ProjectComplianceAssessment[];
  latest_assessment_date: string | null;
  earliest_assessment_date: string | null;
  data_age_days: number | null;
}

export interface ProjectComplianceAnalytics {
  by_assessment_type: Record<string, {
    count: number;
    average_score: number;
    latest_date: string;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  by_project: Record<string, {
    project_name: string;
    assessment_count: number;
    average_score: number;
    latest_date: string;
  }>;
  trends: {
    last_30_days: number;
    last_90_days: number;
    last_180_days: number;
    direction: 'improving' | 'stable' | 'declining';
    trend_strength: number;
  };
  recommendations: string[];
}

export interface ProjectComplianceResponse {
  employer_id: string;
  current_summary: ProjectComplianceSummary;
  analytics: ProjectComplianceAnalytics;
  comparison: {
    industry_average: number | null;
    industry_percentile: number | null;
    similar_employers_count: number;
    rating_distribution: Record<TrafficLightRating, number>;
  };
  insights: {
    strengths: string[];
    concerns: string[];
    recommended_actions: string[];
    data_gaps: string[];
  };
}

// =============================================================================
// TRACK 2: ORGANISER EXPERTISE RATINGS
// =============================================================================

export interface CreateExpertiseRatingRequest {
  overall_score?: number | null;
  overall_rating?: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  assessment_basis: string;
  assessment_context?: string | null;
  eba_status_known?: boolean;
  eba_status?: TrafficLightRating | null;
  knowledge_beyond_projects?: boolean;
  knowledge_beyond_projects_details?: string | null;
  industry_reputation?: string | null;
  union_relationship_quality?: 'excellent' | 'good' | 'neutral' | 'poor' | 'very_poor';
  historical_issues?: string[] | null;
  recent_improvements?: boolean;
  improvement_details?: string | null;
  future_concerns?: boolean;
  concern_details?: string | null;
  assessment_notes?: string | null;
  assessment_date: string;
  expires_date?: string | null;
}

export interface ExpertiseRatingResponse {
  id: string;
  employer_id: string;
  organiser_id: string;
  assessment_date: string;
  overall_score: number | null;
  overall_rating: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  assessment_basis: string;
  assessment_context: string | null;
  eba_status_known: boolean;
  eba_status: TrafficLightRating | null;
  knowledge_beyond_projects: boolean;
  knowledge_beyond_projects_details: string | null;
  industry_reputation: string | null;
  union_relationship_quality: string | null;
  historical_issues: string[] | null;
  recent_improvements: boolean;
  improvement_details: string | null;
  future_concerns: boolean;
  concern_details: string | null;
  assessment_notes: string | null;
  is_active: boolean;
  expires_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Related data
  organiser?: {
    id: string;
    name: string;
    role: string;
    reputation_score?: number;
  };
  validation_records?: Array<{
    id: string;
    validation_date: string;
    rating_match: boolean;
    score_difference: number;
  }>;
}

export interface ExpertiseRatingsListResponse {
  ratings: ExpertiseRatingResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_ratings: number;
    average_score: number | null;
    latest_rating_date: string | null;
    confidence_distribution: Record<ConfidenceLevel, number>;
    rating_distribution: Record<TrafficLightRating, number>;
  };
}

export interface WizardStepSubmission {
  wizard_step_id: string;
  step_response: any;
  response_value?: string;
  session_started_at: string;
}

export interface WizardSubmissionRequest {
  employer_id: string;
  wizard_session_id?: string;
  steps: WizardStepSubmission[];
  session_completed_at?: string;
  organiser_notes?: string;
}

export interface WizardSubmissionResponse {
  wizard_session_id: string;
  employer_id: string;
  organiser_id: string;
  session_date: string;
  total_score: number;
  final_rating: TrafficLightRating;
  completion_percentage: number;
  time_spent_minutes: number;
  assessment_summary: string;
  key_factors: string[];
  confidence_level: ConfidenceLevel;
  is_complete: boolean;
  expires_date: string;
  steps_processed: number;
  steps_successful: number;
  created_expertise_rating_id?: string;
}

export interface WizardConfigurationResponse {
  steps: Array<{
    id: string;
    wizard_step: number;
    step_name: string;
    step_description: string;
    step_type: 'question' | 'info' | 'calculation';
    is_required: boolean;
    display_order: number;
    options?: Array<{
      id: string;
      option_value: string;
      option_text: string;
      score_impact: number;
      explanation: string;
      display_order: number;
    }>;
  }>;
  version: string;
  last_updated: string;
}

// =============================================================================
// FINAL RATINGS - COMBINED SYSTEM
// =============================================================================

export interface FinalRatingResponse {
  id: string;
  employer_id: string;
  rating_date: string;
  final_rating: TrafficLightRating;
  final_score: number | null;

  // Component ratings
  project_based_rating: TrafficLightRating | null;
  project_based_score: number | null;
  project_data_quality: ConfidenceLevel;
  projects_included: number;
  latest_project_date: string | null;

  expertise_based_rating: TrafficLightRating | null;
  expertise_based_score: number | null;
  expertise_confidence: ConfidenceLevel;
  expertise_assessments_included: number;
  latest_expertise_date: string | null;

  eba_status: TrafficLightRating | null;

  // Discrepancy information
  rating_discrepancy: boolean;
  discrepancy_level: number;
  reconciliation_method: string | null;
  required_dispute_resolution: boolean;

  // Quality indicators
  overall_confidence: ConfidenceLevel;
  data_completeness_score: number;
  rating_stability_score: number | null;

  // Status information
  rating_status: RatingStatus;
  review_required: boolean;
  review_reason: string | null;
  next_review_date: string | null;
  expiry_date: string | null;

  // Weighting information
  project_weight: number;
  expertise_weight: number;
  eba_weight: number;
  calculation_method_id: string | null;
  custom_adjustment: number;
  adjustment_reason: string | null;

  // Audit information
  calculated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Additional calculated fields
  data_age_days?: number;
  days_until_expiry?: number;
  needs_review?: boolean;
}

export interface RatingsListResponse {
  ratings: FinalRatingResponse[];
  current_rating: FinalRatingResponse | null;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_ratings: number;
    current_rating_score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining' | 'unknown';
    last_updated: string | null;
    next_review_due: string | null;
  };
}

export interface RatingCalculationRequest {
  calculation_date?: string;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  calculation_method?: string;
  force_recalculate?: boolean;
  notes?: string;
}

export interface RatingCalculationResponse {
  rating_id: string;
  calculation_result: {
    final_rating: TrafficLightRating;
    final_score: number;
    overall_confidence: ConfidenceLevel;
    data_completeness: number;
    discrepancy_detected: boolean;
    reconciliation_needed: boolean;
  };
  components: {
    project_data: any;
    expertise_data: any;
    eba_data: any;
  };
  calculation_details: {
    calculation_method: string;
    weights_used: {
      project: number;
      expertise: number;
      eba: number;
    };
    algorithm_type: string;
    calculation_timestamp: string;
  };
  warnings: string[];
  recommendations: string[];
}

export interface RatingComparisonResponse {
  employer_id: string;
  comparison_date: string;
  project_vs_expertise: {
    project_rating: TrafficLightRating | null;
    project_score: number | null;
    expertise_rating: TrafficLightRating | null;
    expertise_score: number | null;
    score_difference: number | null;
    rating_match: boolean;
    discrepancy_level: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
    alignment_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
  };
  detailed_breakdown: {
    project_assessments: Array<{
      assessment_type: string;
      score: number | null;
      rating: string | null;
      confidence_level: string;
      assessment_date: string;
      weight: number;
      contribution: number | null;
    }>;
    expertise_assessments: Array<{
      organiser_name: string;
      overall_score: number | null;
      overall_rating: string | null;
      confidence_level: string;
      assessment_date: string;
      reputation_score: number | null;
      contribution: number | null;
    }>;
  };
  validation_data: {
    validation_records: Array<{
      validation_date: string;
      rating_match: boolean;
      score_difference: number;
      project_based_rating: string;
      expertise_rating: string;
      data_confidence_level: string;
    }>;
    accuracy_metrics: {
      total_validations: number;
      matching_validations: number;
      accuracy_percentage: number | null;
      average_score_difference: number | null;
      trend_direction: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    };
  };
  recommendations: {
    immediate_actions: string[];
    investigation_areas: string[];
    data_improvements: string[];
    reconciliation_options: string[];
  };
  confidence_indicators: {
    overall_confidence: ConfidenceLevel;
    data_quality_score: number;
    sample_size_adequacy: 'excellent' | 'adequate' | 'limited' | 'insufficient';
    recency_score: number;
    cross_validation_available: boolean;
  };
}

export interface RecalculateRatingRequest {
  calculation_date?: string;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  calculation_method?: string;
  force_recalculate?: boolean;
  override_expiration?: boolean;
  custom_adjustment?: number;
  adjustment_reason?: string;
  approval_notes?: string;
}

export interface RecalculateRatingResponse {
  previous_rating?: {
    id: string;
    final_rating: TrafficLightRating;
    final_score: number | null;
    rating_date: string;
    updated_at: string;
  };
  new_rating: {
    id: string;
    final_rating: TrafficLightRating;
    final_score: number;
    rating_date: string;
    calculation_timestamp: string;
  };
  changes: {
    rating_changed: boolean;
    score_change: number | null;
    rating_change_type: 'improvement' | 'decline' | 'maintained' | 'first_rating';
    magnitude: 'minimal' | 'minor' | 'moderate' | 'significant' | 'major';
  };
  calculation_details: {
    method_used: string;
    weights_applied: {
      project: number;
      expertise: number;
      eba: number;
    };
    algorithm_type: string;
    processing_time_ms: number;
  };
  validation: {
    discrepancies_resolved: boolean;
    confidence_change: 'improved' | 'declined' | 'maintained';
    data_completeness_change: number;
    warnings_generated: string[];
  };
  audit_trail: {
    calculation_id: string;
    triggered_by: string;
    trigger_reason: string;
    timestamp: string;
    ip_address: string;
  };
}

// =============================================================================
// BATCH AND ANALYTICS APIS
// =============================================================================

export interface BatchRatingOperation {
  operation_type: 'calculate' | 'recalculate' | 'expire' | 'archive' | 'approve';
  employer_ids: string[];
  parameters?: {
    calculation_date?: string;
    project_weight?: number;
    expertise_weight?: number;
    eba_weight?: number;
    calculation_method?: string;
    force_recalculate?: boolean;
    approval_notes?: string;
  };
}

export interface BatchRatingRequest {
  batch_id?: string;
  operations: BatchRatingOperation[];
  dry_run?: boolean;
  notification_preferences?: {
    email_on_completion?: boolean;
    webhook_url?: string;
  };
}

export interface BatchRatingResponse {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_operations: number;
  completed_operations: number;
  failed_operations: number;
  results: Array<{
    employer_id: string;
    operation_type: string;
    status: 'success' | 'failed' | 'skipped';
    rating_id?: string;
    previous_rating?: string;
    new_rating?: string;
    score_change?: number;
    error_message?: string;
    processing_time_ms: number;
  }>;
  summary: {
    ratings_calculated: number;
    ratings_updated: number;
    ratings_expired: number;
    ratings_archived: number;
    ratings_approved: number;
    total_processing_time_ms: number;
    average_processing_time_ms: number;
  };
  errors: Array<{
    employer_id: string;
    operation: string;
    error_code: string;
    error_message: string;
    timestamp: string;
  }>;
  audit_trail: {
    initiated_by: string;
    initiated_at: string;
    completed_at?: string;
    ip_address: string;
    dry_run: boolean;
  };
}

export interface BatchStatusResponse {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total_operations: number;
    completed_operations: number;
    failed_operations: number;
    percentage_complete: number;
  };
  estimated_completion?: string;
  results?: BatchRatingResponse['results'];
  errors?: BatchRatingResponse['errors'];
  started_at?: string;
  completed_at?: string;
}

export interface RatingTrendsResponse {
  overview: {
    total_employers: number;
    employers_with_ratings: number;
    current_rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    average_confidence_score: number;
    last_updated: string;
  };
  time_series: Array<{
    date: string;
    total_ratings: number;
    average_score: number;
    rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    confidence_distribution: {
      high: number;
      medium: number;
      low: number;
      very_low: number;
    };
  }>;
  rating_changes: {
    improvements: number;
    declines: number;
    new_ratings: number;
    net_change: number;
    change_rate: number;
  };
  component_analysis: {
    project_vs_expertise_alignment: {
      aligned: number;
      misaligned: number;
      alignment_rate: number;
    };
    data_quality_trends: {
      high_quality: number;
      medium_quality: number;
      low_quality: number;
      very_low_quality: number;
    };
    assessment_coverage: {
      project_coverage_rate: number;
      expertise_coverage_rate: number;
      combined_coverage_rate: number;
    };
  };
  insights: {
    positive_trends: string[];
    concerns: string[];
    recommendations: string[];
  };
}

export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'json';
  employer_ids?: string[];
  date_range?: {
    from: string;
    to: string;
  };
  rating_status?: RatingStatus[];
  include_details?: boolean;
  include_history?: boolean;
  include_components?: boolean;
  filters?: {
    employer_type?: string;
    min_score?: number;
    max_score?: number;
    rating_categories?: TrafficLightRating[];
  };
}

export interface ExportResponse {
  export_id: string;
  status: 'processing' | 'completed' | 'failed';
  format: string;
  file_size_bytes?: number;
  download_url?: string;
  expires_at?: string;
  record_count?: number;
  generated_at?: string;
  expires_in_hours?: number;
}

export interface RefreshRequest {
  operation: 'materialized_views' | 'statistics' | 'cache' | 'indexes' | 'all';
  force_refresh?: boolean;
  dry_run?: boolean;
  notification_preferences?: {
    email_on_completion?: boolean;
    webhook_url?: string;
  };
}

export interface RefreshResponse {
  refresh_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  operation: string;
  started_at: string;
  completed_at?: string;
  results: {
    materialized_views: {
      refreshed: string[];
      failed: string[];
      total_refresh_time_ms: number;
    };
    statistics: {
      recalculated: string[];
      failed: string[];
      total_calculation_time_ms: number;
    };
    cache: {
      cleared: string[];
      failed: string[];
      total_clear_time_ms: number;
    };
    indexes: {
      rebuilt: string[];
      failed: string[];
      total_rebuild_time_ms: number;
    };
  };
  summary: {
    total_operations: number;
    successful_operations: number;
    failed_operations: number;
    total_processing_time_ms: number;
  };
  performance_impact: {
    duration: string;
    estimated_user_impact: 'none' | 'minimal' | 'moderate' | 'high';
    recommended_maintenance_window: string;
  };
  audit_trail: {
    triggered_by: string;
    trigger_reason: string;
    ip_address: string;
    dry_run: boolean;
  };
}

// =============================================================================
// MOBILE DASHBOARD API
// =============================================================================

export interface DashboardResponse {
  overview: {
    total_employers: number;
    rated_employers: number;
    current_rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    recent_changes: {
      improvements: number;
      declines: number;
      new_ratings: number;
    };
    system_health: {
      data_quality_score: number;
      last_updated: string;
      active_alerts: number;
      pending_reviews: number;
    };
  };
  top_concerns: Array<{
    employer_id: string;
    employer_name: string;
    current_rating: TrafficLightRating;
    score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining';
    last_updated: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  top_performers: Array<{
    employer_id: string;
    employer_name: string;
    current_rating: TrafficLightRating;
    score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining';
    last_updated: string;
  }>;
  recent_activities: Array<{
    type: 'rating_change' | 'assessment_added' | 'review_completed' | 'alert_triggered';
    employer_id: string;
    employer_name: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
  alerts: Array<{
    id: string;
    type: 'rating_change' | 'discrepancy_detected' | 'review_required' | 'expiry_warning';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    employer_id?: string;
    employer_name?: string;
    created_at: string;
    requires_action: boolean;
  }>;
  quick_actions: {
    pending_reviews: number;
    ratings_expiring_soon: number;
    data_gaps: number;
    discrepancies_to_resolve: number;
  };
  filters?: {
    role_scope: string[];
    accessible_patches: string[];
  };
}

// =============================================================================
// ERROR AND RESPONSE TYPES
// =============================================================================

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  details?: any;
  type?: string;
  severity?: string;
  timestamp?: string;
  retryAfter?: number;
  requestId?: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    queryTime: number;
    cacheHit: boolean;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface RequestHeaders {
  [key: string]: string;
}

export interface QueryParams {
  [key: string]: string | string[] | number | boolean | undefined;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterOption {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'like' | 'ilike';
  value: any;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// =============================================================================
// AUDIT AND LOGGING TYPES
// =============================================================================

export interface AuditLogEntry {
  id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string;
  record_id: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

export interface SystemMetrics {
  timestamp: string;
  active_users: number;
  api_requests_per_minute: number;
  average_response_time_ms: number;
  error_rate: number;
  database_connections: number;
  cache_hit_rate: number;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface RatingSystemConfig {
  traffic_light_thresholds: {
    green: { min_score: number; max_score: number };
    amber: { min_score: number; max_score: number };
    red: { min_score: number; max_score: number };
  };
  assessment_weights: Record<ComplianceAssessmentType, number>;
  calculation_methods: Array<{
    name: string;
    algorithm_type: string;
    default_weights: {
      project: number;
      expertise: number;
      eba: number;
    };
  }>;
  confidence_thresholds: {
    high: number;
    medium: number;
    low: number;
    very_low: number;
  };
}

export interface CacheConfig {
  default_ttl_seconds: number;
  dashboard_ttl_seconds: number;
  analytics_ttl_seconds: number;
  export_ttl_seconds: number;
  max_cache_size_mb: number;
}

// =============================================================================
// EXPORT ALL TYPES FOR EASY IMPORTING
// =============================================================================

export type {
  // Core request/response types
  CreateComplianceAssessmentRequest,
  ComplianceAssessmentResponse,
  ComplianceAssessmentsListResponse,
  ProjectComplianceResponse,

  CreateExpertiseRatingRequest,
  ExpertiseRatingResponse,
  ExpertiseRatingsListResponse,
  WizardSubmissionRequest,
  WizardSubmissionResponse,
  WizardConfigurationResponse,

  FinalRatingResponse,
  RatingsListResponse,
  RatingCalculationRequest,
  RatingCalculationResponse,
  RatingComparisonResponse,
  RecalculateRatingRequest,
  RecalculateRatingResponse,

  // Batch operations
  BatchRatingRequest,
  BatchRatingResponse,
  BatchStatusResponse,

  // Analytics and exports
  RatingTrendsResponse,
  ExportRequest,
  ExportResponse,
  RefreshRequest,
  RefreshResponse,

  // Dashboard
  DashboardResponse,

  // Utility types
  ApiError,
  ApiResponse,
  PaginatedResponse,
  ValidationResult,
  AuditLogEntry,
  SystemMetrics,
  RatingSystemConfig,
  CacheConfig,
};

// Default exports for convenience
export default {
  // Enums
  TrafficLightRating,
  ComplianceAssessmentType,
  RatingSourceType,
  ConfidenceLevel,
  RatingStatus,
  UserRole,

  // Core types
  CreateComplianceAssessmentRequest,
  ComplianceAssessmentResponse,
  ComplianceAssessmentsListResponse,
  CreateExpertiseRatingRequest,
  ExpertiseRatingResponse,
  ExpertiseRatingsListResponse,
  WizardSubmissionRequest,
  WizardSubmissionResponse,
  WizardConfigurationResponse,
  FinalRatingResponse,
  RatingsListResponse,
  RatingCalculationRequest,
  RatingCalculationResponse,
  RatingComparisonResponse,
  RecalculateRatingRequest,
  RecalculateRatingResponse,
  BatchRatingRequest,
  BatchRatingResponse,
  BatchStatusResponse,
  RatingTrendsResponse,
  ExportRequest,
  ExportResponse,
  RefreshRequest,
  RefreshResponse,
  DashboardResponse,
  ApiError,
  ApiResponse,
  PaginatedResponse,
  ValidationResult,
  AuditLogEntry,
  SystemMetrics,
  RatingSystemConfig,
  CacheConfig,
};