// Core rating system types and interfaces for the CFMEU Employer Traffic Light Rating System

// =============================================================================
// BASIC ENUMS AND PRIMITIVE TYPES
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
export type CalculationMethod = 'weighted_average' | 'weighted_sum' | 'minimum_score' | 'hybrid_method';
export type UnionRelationshipQuality = 'excellent' | 'good' | 'neutral' | 'poor' | 'very_poor';
export type DiscrepancyLevel = 'none' | 'minor' | 'moderate' | 'major' | 'critical';

// =============================================================================
// INPUT DATA TYPES
// =============================================================================

export interface ComplianceAssessment {
  id: string;
  employer_id: string;
  project_id?: string;
  assessment_type: ComplianceAssessmentType;
  score: number | null;
  rating: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  severity_level: number | null;
  assessment_notes?: string;
  assessment_date: Date;
  evidence_attachments?: string[];
  follow_up_required: boolean;
  follow_up_date?: Date;
  organiser_id?: string;
  site_visit_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExpertiseAssessment {
  id: string;
  employer_id: string;
  organiser_id: string;
  overall_score: number | null;
  overall_rating: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  assessment_basis: string;
  assessment_context?: string;
  eba_status_known: boolean;
  eba_status?: TrafficLightRating;
  knowledge_beyond_projects: boolean;
  industry_reputation?: string;
  union_relationship_quality?: UnionRelationshipQuality;
  historical_issues?: string[];
  recent_improvements: boolean;
  future_concerns: boolean;
  assessment_notes?: string;
  assessment_date: Date;
  expires_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EBARecord {
  id: string;
  employer_id: string;
  eba_file_number?: string;
  sector?: string;
  fwc_certified_date?: Date;
  date_eba_signed?: Date;
  date_vote_occurred?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OrganiserProfile {
  id: string;
  name: string;
  role: string;
  accuracy_percentage?: number;
  overall_reputation_score?: number;
  expertise_level?: string;
}

// =============================================================================
// CALCULATION RESULT TYPES
// =============================================================================

export interface BaseRatingResult {
  rating: TrafficLightRating;
  score: number | null;
  confidence_level: ConfidenceLevel;
  assessment_count: number;
  latest_assessment_date?: Date;
  data_age_days?: number;
  calculation_date: Date;
  breakdown?: RatingBreakdown;
}

export interface ProjectRatingResult extends BaseRatingResult {
  data_quality: ConfidenceLevel;
  assessments: ComplianceAssessmentSummary[];
  earliest_assessment_date?: Date;
}

export interface ExpertiseRatingResult extends BaseRatingResult {
  assessments: ExpertiseAssessmentSummary[];
}

export interface EBARatingResult {
  eba_status: TrafficLightRating;
  eba_score: number;
  has_active_eba: boolean;
  latest_eba_date?: Date;
  eba_details: EBARecord[];
  data_age_days?: number;
  calculation_date: Date;
}

export interface ComplianceAssessmentSummary {
  assessment_type: ComplianceAssessmentType;
  score: number;
  confidence_level: ConfidenceLevel;
  assessment_date: Date;
  weight: number;
  severity_level?: number;
  severity_name?: string;
}

export interface ExpertiseAssessmentSummary {
  assessment_id: string;
  organiser_id: string;
  organiser_name: string;
  score: number;
  confidence_level: ConfidenceLevel;
  assessment_date: Date;
  confidence_weight: number;
  accuracy_percentage?: number;
  reputation_score?: number;
}

export interface RatingBreakdown {
  total_score: number;
  max_possible_score: number;
  components: RatingComponent[];
  weightings: Record<string, number>;
  adjustments?: RatingAdjustment[];
}

export interface RatingComponent {
  name: string;
  score: number;
  weight: number;
  weighted_score: number;
  confidence_level: ConfidenceLevel;
  data_points: number;
}

export interface RatingAdjustment {
  type: 'bonus' | 'penalty' | 'correction';
  amount: number;
  reason: string;
  applied_by: string;
  applied_at: Date;
}

// =============================================================================
// DISCREPANCY AND RECONCILIATION TYPES
// =============================================================================

export interface DiscrepancyCheck {
  discrepancy_detected: boolean;
  discrepancy_level: DiscrepancyLevel;
  score_difference: number;
  rating_match: boolean;
  requires_review: boolean;
  recommended_action: 'accept_calculated' | 'prefer_project' | 'prefer_expertise' | 'manual_review';
  confidence_impact: number;
  explanation: string;
}

export interface RatingReconciliation {
  method: 'automated_weighting' | 'expertise_override' | 'project_override' | 'manual_review_required';
  final_weights: RatingWeights;
  reconciliation_factors: ReconciliationFactor[];
  requires_human_review: boolean;
  automated_decision: boolean;
  decision_logic: string;
}

export interface RatingWeights {
  project: number;
  expertise: number;
  eba: number;
  custom?: Record<string, number>;
}

export interface ReconciliationFactor {
  factor: string;
  impact: number;
  reasoning: string;
}

// =============================================================================
// FINAL RATING TYPES
// =============================================================================

export interface FinalRatingResult {
  employer_id: string;
  calculation_date: Date;
  final_rating: TrafficLightRating;
  final_score: number;

  // Component data
  project_data: ProjectRatingResult;
  expertise_data: ExpertiseRatingResult;
  eba_data: EBARatingResult;

  // Quality indicators
  overall_confidence: ConfidenceLevel;
  data_completeness: number;
  discrepancy_check: DiscrepancyCheck;

  // Calculation details
  calculation_method: CalculationMethod;
  weights: RatingWeights;
  algorithm_type: CalculationMethod;
  method_config: Record<string, any>;

  // Reconciliation
  reconciliation_needed: boolean;
  reconciliation_method?: string;
  reconciliation?: RatingReconciliation;

  // Metadata
  calculated_at: Date;
  calculation_version: string;
  processing_time_ms?: number;
}

export interface EmployerRatingSummary {
  employer_id: string;
  current_rating: CurrentRatingDetails;
  recent_project_assessments: ComplianceAssessment[];
  recent_expertise_assessments: ExpertiseAssessment[];
  rating_history: RatingHistoryEntry[];
  retrieved_at: Date;
}

export interface CurrentRatingDetails {
  id: string;
  rating_date: Date;
  final_rating: TrafficLightRating;
  final_score: number;

  // Component ratings
  project_based_rating: TrafficLightRating;
  project_based_score: number;
  project_data_quality: ConfidenceLevel;
  projects_included: number;

  expertise_based_rating: TrafficLightRating;
  expertise_based_score: number;
  expertise_confidence: ConfidenceLevel;
  expertise_assessments_included: number;

  eba_status: TrafficLightRating;

  // Quality indicators
  overall_confidence: ConfidenceLevel;
  data_completeness_score: number;
  rating_discrepancy: boolean;
  discrepancy_level: DiscrepancyLevel;

  // Status
  rating_status: RatingStatus;
  review_required: boolean;
  review_reason?: string;
  next_review_date?: Date;
  expiry_date: Date;

  // Metadata
  calculated_at: Date;
  updated_at: Date;
}

export interface RatingHistoryEntry {
  rating_date: Date;
  previous_rating: TrafficLightRating;
  new_rating: TrafficLightRating;
  previous_score: number;
  new_score: number;
  rating_change_type: 'improvement' | 'decline' | 'no_change';
  score_change: number;
  significant_change: boolean;
  change_magnitude: number;
  primary_change_factors: string[];
  external_factors?: string[];
}

// =============================================================================
// CALCULATION CONFIGURATION TYPES
// =============================================================================

export interface RatingThreshold {
  rating: TrafficLightRating;
  min_score: number;
  max_score: number;
  description?: string;
  is_active: boolean;
}

export interface AssessmentWeight {
  assessment_type: ComplianceAssessmentType;
  weight: number;
  description?: string;
  is_active: boolean;
}

export interface SeverityLevel {
  assessment_type: ComplianceAssessmentType;
  severity_level: number;
  severity_name: string;
  score_impact: number;
  description?: string;
  color_code?: string;
  is_active: boolean;
}

export interface CalculationMethodConfig {
  method_name: string;
  method_description: string;
  algorithm_type: CalculationMethod;
  configuration: Record<string, any>;
  is_active: boolean;
}

export interface RatingCalculationRequest {
  employer_id: string;
  calculation_date?: Date;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  calculation_method?: CalculationMethod;
  force_recalculate?: boolean;
  custom_adjustment?: number;
  notes?: string;
}

export interface BatchCalculationRequest {
  operation_type: 'calculate' | 'recalculate' | 'expire' | 'archive' | 'approve';
  employer_ids: string[];
  calculation_date?: Date;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  approval_notes?: string;
}

// =============================================================================
// VALIDATION AND ERROR TYPES
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  constraint?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export interface RatingCalculationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  employer_id?: string;
  calculation_method?: string;
  timestamp: Date;
}

// =============================================================================
// PERFORMANCE AND MONITORING TYPES
// =============================================================================

export interface PerformanceMetrics {
  calculation_time_ms: number;
  database_queries: number;
  memory_usage_mb: number;
  cache_hit_rate: number;
  processed_employers: number;
  success_rate: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiry_date: Date;
  key: string;
  hit_count: number;
}

export interface ProcessingStats {
  total_processed: number;
  successful: number;
  failed: number;
  skipped: number;
  start_time: Date;
  end_time: Date;
  average_time_per_employer: number;
}

// =============================================================================
// AUDIT AND LOGGING TYPES
// =============================================================================

export interface RatingAuditLog {
  id: string;
  employer_id: string;
  previous_rating: TrafficLightRating | null;
  new_rating: TrafficLightRating;
  previous_score: number | null;
  new_score: number;
  rating_source: RatingSourceType;
  source_id?: string;
  reason_for_change?: string;
  changed_by?: string;
  created_at: Date;
}

export interface ComparisonLog {
  id: string;
  final_rating_id: string;
  project_rating: TrafficLightRating;
  project_score: number;
  expertise_rating: TrafficLightRating;
  expertise_score: number;
  score_difference: number;
  rating_match: boolean;
  discrepancy_category: DiscrepancyLevel;
  reconciliation_decision: string;
  reconciliation_factors: RatingWeights;
  final_weighting: RatingWeights;
  confidence_impact: string;
  requires_human_review: boolean;
  automated_decision: boolean;
  decision_logic: Record<string, any>;
  created_by: string;
  created_at: Date;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DateRange = {
  start: Date;
  end: Date;
};

export type ScoreRange = {
  min: number;
  max: number;
};

export type WeightedScore = {
  score: number;
  weight: number;
  confidence: number;
};

export type TrendData = {
  date: Date;
  rating: TrafficLightRating;
  score: number;
  confidence: ConfidenceLevel;
};

export type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf';

export type RatingSortField =
  | 'final_score'
  | 'calculation_date'
  | 'overall_confidence'
  | 'data_completeness'
  | 'rating_discrepancy'
  | 'projects_included';

export type RatingFilter = {
  rating?: TrafficLightRating[];
  confidence?: ConfidenceLevel[];
  date_range?: DateRange;
  min_data_completeness?: number;
  requires_review?: boolean;
  has_discrepancy?: boolean;
};