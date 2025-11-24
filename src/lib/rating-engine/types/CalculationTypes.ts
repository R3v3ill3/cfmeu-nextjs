// Calculation-specific types and interfaces for the rating calculation engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  ComplianceAssessmentType,
  CalculationMethod,
  RatingWeights,
  DiscrepancyLevel
} from './RatingTypes';

// =============================================================================
// CALCULATION INPUT AND CONFIGURATION TYPES
// =============================================================================

export interface CalculationContext {
  employer_id: string;
  calculation_date: Date;
  lookback_days: {
    project: number;
    expertise: number;
    eba: number;
  };
  weights: RatingWeights;
  method: CalculationMethod;
  force_recalculate: boolean;
  debug_mode: boolean;
  user_id?: string;
}

export interface CalculationConfig {
  // Thresholds and ranges
  score_thresholds: Record<TrafficLightRating, { min: number; max: number }>;
  confidence_thresholds: Record<ConfidenceLevel, { min: number; max: number }>;
  assessment_weights: Record<ComplianceAssessmentType, number>;

  // Time-based settings
  decay_settings: {
    enabled: boolean;
    half_life_days: number;
    minimum_weight: number;
  };

  // Quality settings
  quality_requirements: {
    minimum_assessments: {
      project: number;
      expertise: number;
    };
    maximum_data_age: {
      high: number;  // days
      medium: number;
      low: number;
    };
  };

  // Discrepancy settings
  discrepancy_thresholds: {
    score_difference: Record<DiscrepancyLevel, number>;
    rating_mismatch: Record<DiscrepancyLevel, boolean>;
  };

  // Performance settings
  performance: {
    enable_caching: boolean;
    cache_ttl_seconds: number;
    batch_size: number;
    timeout_ms: number;
  };
}

export interface CalculationInput {
  employer_id: string;
  project_assessments: RawProjectAssessment[];
  expertise_assessments: RawExpertiseAssessment[];
  eba_records: RawEBARecord[];
  organiser_profiles: Record<string, RawOrganiserProfile>;
  context: CalculationContext;
}

// =============================================================================
// RAW INPUT DATA TYPES
// =============================================================================

export interface RawProjectAssessment {
  id: string;
  employer_id: string;
  project_id?: string;
  assessment_type: ComplianceAssessmentType;
  score: number | null;
  rating: TrafficLightRating | null;
  confidence_level: ConfidenceLevel;
  severity_level: number | null;
  assessment_date: Date;
  assessment_notes?: string;
  evidence_attachments?: string[];
  follow_up_required: boolean;
  follow_up_date?: Date;
  organiser_id?: string;
  site_visit_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RawExpertiseAssessment {
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
  union_relationship_quality?: 'excellent' | 'good' | 'neutral' | 'poor' | 'very_poor';
  historical_issues?: string[];
  recent_improvements: boolean;
  future_concerns: boolean;
  assessment_notes?: string;
  assessment_date: Date;
  expires_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Optional fields to align with shared assessment processing
  assessment_type?: ComplianceAssessmentType;
  score?: number | null;
  severity_level?: number | null;
}

export interface RawEBARecord {
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

export interface RawOrganiserProfile {
  id: string;
  name: string;
  role: string;
  accuracy_percentage?: number;
  overall_reputation_score?: number;
  expertise_level?: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// CALCULATION STATE TYPES
// =============================================================================

export interface CalculationState {
  phase: 'initializing' | 'loading_data' | 'calculating_project' | 'calculating_expertise' | 'calculating_eba' | 'reconciling' | 'finalizing' | 'completed' | 'error';
  progress: number; // 0-100
  current_step: string;
  start_time: Date;
  elapsed_ms: number;
  warnings: CalculationWarning[];
  errors: CalculationError[];
  debug_info?: Record<string, any>;
}

export interface CalculationWarning {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  phase: string;
  details?: Record<string, any>;
}

export interface CalculationError {
  code: string;
  message: string;
  phase: string;
  recoverable: boolean;
  details?: Record<string, any>;
  stack?: string;
}

// =============================================================================
// INTERMEDIATE CALCULATION TYPES
// =============================================================================

export interface ProjectCalculationInput {
  assessments: RawProjectAssessment[];
  weights: Record<ComplianceAssessmentType, number>;
  context: CalculationContext;
  decay_enabled: boolean;
}

export interface ExpertiseCalculationInput {
  assessments: RawExpertiseAssessment[];
  organiser_profiles: Record<string, RawOrganiserProfile>;
  context: CalculationContext;
  decay_enabled: boolean;
}

export interface EBACalculationInput {
  eba_records: RawEBARecord[];
  context: CalculationContext;
}

export interface WeightedAssessment {
  assessment: RawProjectAssessment | RawExpertiseAssessment;
  weight: number;
  confidence_weight: number;
  decayed_weight: number;
  effective_weight: number;
  contribution: number;
}

export interface AggregatedProjectData {
  total_weighted_score: number;
  total_weight: number;
  assessment_count: number;
  assessments_by_type: Record<ComplianceAssessmentType, WeightedAssessment[]>;
  date_range: { earliest?: Date; latest?: Date };
  quality_metrics: DataQualityMetrics;
  severity_impacts: Record<string, number>;
}

export interface AggregatedExpertiseData {
  total_weighted_score: number;
  total_confidence_weight: number;
  assessment_count: number;
  unique_organisers: number;
  assessments_by_organiser: Record<string, WeightedAssessment[]>;
  date_range: { earliest?: Date; latest?: Date };
  reputation_adjusted_scores: boolean;
  quality_metrics: DataQualityMetrics;
}

export interface DataQualityMetrics {
  data_quality: ConfidenceLevel;
  recency_score: number;
  completeness_score: number;
  consistency_score: number;
  overall_quality_score: number;
  factors: QualityFactor[];
}

export interface QualityFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

// =============================================================================
// RECONCILIATION TYPES
// =============================================================================

export interface ReconciliationInput {
  project_result: ProjectRatingResult;
  expertise_result: ExpertiseRatingResult;
  eba_result: EBARatingResult;
  weights: RatingWeights;
  method: CalculationMethod;
  config: CalculationConfig;
}

export interface ReconciliationOutput {
  final_score: number;
  final_rating: TrafficLightRating;
  reconciliation_applied: boolean;
  method_used: string;
  adjustments: ReconciliationAdjustment[];
  confidence_adjustment: number;
  explanation: string;
}

export interface ReconciliationAdjustment {
  type: 'weight_change' | 'score_override' | 'confidence_adjustment' | 'manual_override';
  component: 'project' | 'expertise' | 'eba' | 'final';
  original_value: number;
  adjusted_value: number;
  reason: string;
  auto_applied: boolean;
}

export interface DiscrepancyAnalysis {
  detected: boolean;
  level: DiscrepancyLevel;
  score_difference: number;
  rating_mismatch: boolean;
  confidence_gap: number;
  data_conflicts: DataConflict[];
  recommended_action: ReconciliationAction;
  explanation: string;
}

export interface DataConflict {
  type: 'score_range' | 'rating_mismatch' | 'confidence_gap' | 'recency_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number;
  resolution_suggestion: string;
}

export interface ReconciliationAction {
  action: 'accept_calculated' | 'prefer_project' | 'prefer_expertise' | 'prefer_eba' | 'manual_review';
  confidence: number;
  reasoning: string;
  expected_outcome: string;
}

// =============================================================================
// ALGORITHM-SPECIFIC TYPES
// =============================================================================

export interface WeightedAverageInput {
  components: {
    score: number;
    weight: number;
    confidence: number;
  }[];
  normalize_weights: boolean;
}

export interface WeightedSumInput {
  components: {
    score: number;
    weight: number;
  }[];
  max_total_score: number;
}

export interface MinimumScoreInput {
  components: {
    name: string;
    score: number;
    is_critical: boolean;
  }[];
  critical_factors: string[];
  include_non_critical: boolean;
}

export interface HybridMethodInput {
  base_components: {
    score: number;
    weight: number;
  }[];
  critical_factors: {
    name: string;
    score: number;
    weight: number;
  }[];
  critical_weight: number;
  fallback_method: CalculationMethod;
}

// =============================================================================
// CONFIDENCE CALCULATION TYPES
// =============================================================================

export interface ConfidenceInput {
  source_id: string;
  source_type: 'project' | 'expertise' | 'eba';
  assessment_type: ComplianceAssessmentType;
  confidence_level: ConfidenceLevel;
  assessment_date: Date;
  score: number;
  weight: number;
  quality_score: number;
  source_reliability: number;
  organiser_reputation?: number;
  metadata?: Record<string, any>;
}

export interface ConfidenceFactors {
  recency_confidence: number;
  volume_confidence: number;
  consistency_confidence: number;
  source_quality_confidence: number;
  diversity_confidence: number;
}

export interface ConfidenceComponentScore {
  score: number;
  weight: number;
  contribution: number;
}

export interface ConfidenceBreakdown {
  component_scores: {
    recency: ConfidenceComponentScore;
    volume: ConfidenceComponentScore;
    consistency: ConfidenceComponentScore;
    source_quality: ConfidenceComponentScore;
    diversity: ConfidenceComponentScore;
  };
  final_score: number;
  confidence_level: ConfidenceLevel;
  threshold_comparison: {
    high_threshold: number;
    medium_threshold: number;
    low_threshold: number;
    distance_from_threshold: number;
  };
}

export interface ConfidenceValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ConfidenceCalculationConfig {
  recency_weight: number;
  volume_weight: number;
  consistency_weight: number;
  source_quality_weight: number;
  diversity_weight: number;
  high_confidence_threshold: number;
  medium_confidence_threshold: number;
  low_confidence_threshold: number;
  recency_half_life_days: number;
  max_data_age_days: number;
  temporal_smoothing_enabled: boolean;
  temporal_smoothing_factor: number;
  minimum_assessments_for_high: number;
  minimum_assessments_for_medium: number;
  volume_plateau_threshold: number;
  consistency_window_days: number;
  outlier_detection_enabled: boolean;
  outlier_threshold_std_dev: number;
  expert_weight_modifier: number;
  organiser_reputation_factor: number;
  assessment_quality_threshold: number;
  consensus_bonus_enabled: boolean;
  consensus_bonus_factor: number;
  diversity_bonus_enabled: boolean;
  diversity_penalty_factor: number;
}

export interface ConfidenceResult {
  confidence_level: ConfidenceLevel;
  confidence_score: number;
  confidence_factors: ConfidenceFactors;
  breakdown: ConfidenceBreakdown | Record<string, any>;
  validation: ConfidenceValidationResult;
  temporal_trend?: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  metadata: {
    input_count: number;
    calculation_timestamp: Date;
    config_used: ConfidenceCalculationConfig;
    processing_time_ms: number;
    [key: string]: any;
  };
}

export interface TemporalConfidenceData {
  date: Date;
  score: number;
  confidence_level?: ConfidenceLevel;
  assessment_type?: ComplianceAssessmentType;
  source_type?: 'project' | 'expertise' | 'eba';
  source_id?: string;
  weight?: number;
  quality_score?: number;
  source_reliability?: number;
  organiser_reputation?: number;
  metadata?: Record<string, any>;
}

export interface SourceReliabilityFactor {
  factor: string;
  score: number;
  weight: number;
  description?: string;
}

export interface SourceReliabilityScore {
  reliability_score: number;
  reliability_tier: ConfidenceLevel;
  factors: SourceReliabilityFactor[];
  source_type: 'project' | 'expertise' | 'eba';
  data_points: number;
  calculation_timestamp: Date;
  confidence_level: ConfidenceLevel;
}

// =============================================================================
// CACHING AND PERFORMANCE TYPES
// =============================================================================

export interface CacheKey {
  employer_id: string;
  calculation_date: string;
  method: string;
  weights_hash: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiry_date: Date;
  key_hash: string;
  size_bytes: number;
  hit_count: number;
  last_accessed: Date;
}

export interface PerformanceProfile {
  calculation_time_ms: number;
  memory_usage_mb: number;
  database_queries: number;
  cache_hits: number;
  cache_misses: number;
  data_points_processed: number;
  complexity_score: number;
}

export interface BatchCalculationProgress {
  total_employers: number;
  processed_employers: number;
  successful_calculations: number;
  failed_calculations: number;
  current_employer_id?: string;
  estimated_completion: Date;
  average_time_per_employer: number;
}

// =============================================================================
// VALIDATION AND OUTPUT TYPES
// =============================================================================

export interface CalculationValidationResult {
  is_valid: boolean;
  missing_data: MissingDataIssue[];
  data_quality_issues: DataQualityIssue[];
  configuration_issues: ConfigurationIssue[];
  warnings: ValidationWarning[];
  recommendations: ValidationRecommendation[];
}

export interface MissingDataIssue {
  type: 'project_assessments' | 'expertise_assessments' | 'eba_records' | 'organiser_profiles';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggested_action: string;
}

export interface DataQualityIssue {
  type: 'outdated_data' | 'inconsistent_data' | 'low_confidence' | 'insufficient_sample';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affected_records: number;
  impact_score: number;
  remediation: string;
}

export interface ConfigurationIssue {
  type: 'invalid_weights' | 'unsupported_method' | 'missing_thresholds';
  severity: 'medium' | 'high';
  description: string;
  current_value: any;
  expected_value: any;
  fix_required: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  category: 'data_quality' | 'configuration' | 'performance' | 'accuracy';
  actionability: 'informational' | 'recommended' | 'required';
}

export interface ValidationRecommendation {
  priority: 'low' | 'medium' | 'high';
  action: string;
  expected_impact: string;
  effort: 'minimal' | 'moderate' | 'significant';
}

export interface CalculationOutput {
  success: boolean;
  result?: FinalRatingResult;
  errors: CalculationError[];
  warnings: CalculationWarning[];
  validation: CalculationValidationResult;
  performance: PerformanceProfile;
  cache_status: {
    hit: boolean;
    key?: string;
    ttl_seconds?: number;
  };
  debug_info?: Record<string, any>;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type CalculationPhase =
  | 'initialization'
  | 'data_loading'
  | 'project_calculation'
  | 'expertise_calculation'
  | 'eba_calculation'
  | 'reconciliation'
  | 'finalization'
  | 'completion'
  | 'error';

export type QualityDimension =
  | 'recency'
  | 'completeness'
  | 'consistency'
  | 'accuracy'
  | 'coverage';

export type ReconciliationStrategy =
  | 'weighted_trust'
  | 'data_quality_priority'
  | 'recency_priority'
  | 'expertise_priority'
  | 'project_priority'
  | 'hybrid_strategy';

export type CacheStrategy =
  | 'aggressive'
  | 'moderate'
  | 'conservative'
  | 'disabled';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  phase: CalculationPhase;
  message: string;
  data?: Record<string, any>;
  employer_id?: string;
}

// Helper type for calculation method parameters
export type CalculationParameters = {
  [K in CalculationMethod]: {
    method: K;
    parameters: K extends 'weighted_average' ? WeightedAverageInput
      : K extends 'weighted_sum' ? WeightedSumInput
      : K extends 'minimum_score' ? MinimumScoreInput
      : K extends 'hybrid_method' ? HybridMethodInput
      : never;
  };
}[CalculationMethod];

// =============================================================================
// DISCREPANCY DETECTION TYPES
// =============================================================================

export interface DiscrepancyCheck {
  id: string;
  level: DiscrepancyLevel;
  detected: boolean;
  description?: string;
  impact_score?: number;
}

export type DiscrepancyAnalysisResult = DiscrepancyAnalysis;

export interface DiscrepancyDetectionConfig {
  thresholds: Record<DiscrepancyLevel, number>;
  validation_window_days: number;
  auto_resolve: boolean;
  notify_roles: string[];
}

export interface DiscrepancyPattern {
  id: string;
  name: string;
  severity: DiscrepancyLevel;
  indicators: string[];
  description?: string;
}

export interface DiscrepancyTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number;
  period_days: number;
}

export interface DiscrepancyResolution {
  strategy: 'accept_calculated' | 'prefer_project' | 'prefer_expertise' | 'prefer_eba' | 'manual_review';
  confidence: number;
  notes?: string;
}

// =============================================================================
// TIME DECAY TYPES
// =============================================================================

export type DecayCurveType = 'exponential' | 'linear' | 'step' | 'custom';

export interface DecayConfiguration {
  curve: DecayCurveType;
  half_life_days: number;
  minimum_weight: number;
  maximum_decay?: number;
}

export interface DecayFactors {
  base_weight: number;
  decay_factor: number;
  effective_weight: number;
}

export interface DecayResult {
  decayed_score: number;
  decay_factor: number;
  original_score: number;
}

export interface HistoricalDataPoint {
  date: Date;
  score: number;
  weight?: number;
}

export interface DecaySchedule {
  [interval: string]: number;
}

export interface TemporalWeightingResult {
  weighted_score: number;
  total_weight: number;
  data_points: number;
}

// =============================================================================
// WEIGHTED SCORING TYPES
// =============================================================================

export interface AssessmentWeight {
  assessment_type: ComplianceAssessmentType;
  base_weight: number;
  max_weight?: number;
  min_weight?: number;
}

export interface WeightAdjustment {
  assessment_id: string;
  reason: string;
  adjustment: number;
}

export interface ScoringConfiguration {
  normalize_weights: boolean;
  max_score: number;
  min_score: number;
  assessment_weights: AssessmentWeight[];
  allow_negative?: boolean;
}

export interface ScoringComponentResult {
  assessment_id: string;
  assessment_type: ComplianceAssessmentType;
  score: number;
  weight: number;
  effective_weight: number;
  contribution: number;
}

export interface ScoringResult {
  total_score: number;
  total_weight: number;
  normalized_score: number;
  components: ScoringComponentResult[];
}

export interface ScoringValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

// Type guard functions
export function isProjectAssessment(obj: any): obj is RawProjectAssessment {
  return obj && typeof obj === 'object' && 'assessment_type' in obj;
}

export function isExpertiseAssessment(obj: any): obj is RawExpertiseAssessment {
  return obj && typeof obj === 'object' && 'organiser_id' in obj && 'assessment_basis' in obj;
}

export function isEBARecord(obj: any): obj is RawEBARecord {
  return obj && typeof obj === 'object' && 'eba_file_number' in obj;
}