// CFMEU Employer Rating System - Weighting Configuration Types
// Comprehensive TypeScript interfaces for the user-configurable weighting system

import { TrafficLightRating, ConfidenceLevel, CalculationMethod } from '@/lib/rating-engine/types/RatingTypes';

// =============================================================================
// CORE ENUMS AND PRIMITIVE TYPES
// =============================================================================

export type UserRole = 'lead_organiser' | 'admin' | 'organiser' | 'delegate' | 'observer';
export type ProfileType = 'personal' | 'role_template' | 'project_specific' | 'experimental';
export type EmployerCategoryFocus = 'builders' | 'trade_contractors' | 'all';
export type TemplateCategory = 'beginner' | 'intermediate' | 'advanced' | 'specialized';
export type ChangeType = 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'clone';
export type ValidationStatus = 'pending' | 'validated' | 'invalid';
export type PreviewType = 'real_time' | 'batch' | 'comparison';

export type WeightingValidationState = 'valid' | 'invalid' | 'warning';
export type WeightingImpactLevel = 'low' | 'medium' | 'high' | 'critical';

// =============================================================================
// MAIN PROFILE INTERFACES
// =============================================================================

export interface UserWeightingProfile {
  id: string;
  user_id: string;
  profile_name: string;
  description?: string;
  profile_type: ProfileType;
  is_default: boolean;
  is_active: boolean;
  is_public: boolean;
  version: number;
  parent_profile_id?: string;

  // Role and focus configuration
  user_role: UserRole;
  employer_category_focus: EmployerCategoryFocus;

  // Overall system balance (Track 1 vs Track 2)
  project_data_weight: number; // 0-1, typically 0.60
  organiser_expertise_weight: number; // 0-1, typically 0.40

  // Minimum requirements and thresholds
  min_data_requirements: MinDataRequirements;
  confidence_thresholds: ConfidenceThresholds;

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  last_updated_by?: string;
}

export interface MinDataRequirements {
  min_project_assessments: number; // Default: 3
  min_expertise_assessments: number; // Default: 1
  min_data_age_days: number; // Default: 365
  require_eba_status: boolean; // Default: false
  require_safety_data: boolean; // Default: false
}

export interface ConfidenceThresholds {
  high_confidence_min: number; // Default: 0.8
  medium_confidence_min: number; // Default: 0.6
  low_confidence_min: number; // Default: 0.4
  very_low_confidence_max: number; // Default: 0.4
}

// =============================================================================
// TRACK 1 (PROJECT COMPLIANCE DATA) WEIGHTINGS
// =============================================================================

export interface Track1Weightings {
  id: string;
  profile_id: string;

  // CBUS compliance weightings
  cbus_paying_weight: number; // Weight for CBUS paying compliance
  cbus_on_time_weight: number; // Weight for CBUS on-time payments
  cbus_all_workers_weight: number; // Weight for CBUS all workers coverage

  // Incolink compliance weightings
  incolink_entitlements_weight: number; // Weight for Incolink entitlements compliance
  incolink_on_time_weight: number; // Weight for Incolink on-time payments
  incolink_all_workers_weight: number; // Weight for Incolink all workers coverage

  // Union relations weightings
  union_relations_right_of_entry_weight: number; // Weight for right of entry compliance
  union_relations_delegate_accommodation_weight: number; // Weight for delegate accommodation
  union_relations_access_to_info_weight: number; // Weight for access to information
  union_relations_access_to_inductions_weight: number; // Weight for access to inductions

  // Safety performance weightings
  safety_hsr_respect_weight: number; // Weight for HSR respect
  safety_general_standards_weight: number; // Weight for general safety standards
  safety_incidents_weight: number; // Weight for safety incidents

  // Subcontractor management weightings
  subcontractor_usage_levels_weight: number; // Weight for subcontractor usage levels
  subcontractor_practices_weight: number; // Weight for subcontractor management practices

  // Builder-specific weightings (only applicable to builders)
  builder_tender_consultation_weight: number; // Weight for tender consultation practices
  builder_communication_weight: number; // Weight for communication quality
  builder_delegate_facilities_weight: number; // Weight for delegate facilities
  builder_contractor_compliance_weight: number; // Weight for contractor compliance
  builder_eba_contractor_percentage_weight: number; // Weight for EBA contractor percentage

  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// TRACK 2 (ORGANISER EXPERTISE) WEIGHTINGS
// =============================================================================

export interface Track2Weightings {
  id: string;
  profile_id: string;

  // Individual assessment weightings
  cbus_overall_assessment_weight: number; // Weight for CBUS overall assessment
  incolink_overall_assessment_weight: number; // Weight for Incolink overall assessment
  union_relations_overall_weight: number; // Weight for union relations overall assessment
  safety_culture_overall_weight: number; // Weight for safety culture assessment

  // Relationship and historical factors
  historical_relationship_quality_weight: number; // Weight for historical relationship quality
  eba_status_weight: number; // Weight for EBA status as assessment factor

  // Expertise confidence weighting
  organiser_confidence_multiplier: number; // Multiplier based on organiser reputation

  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// TEMPLATES AND PRESETS
// =============================================================================

export interface WeightingTemplate {
  id: string;
  template_name: string;
  description?: string;
  template_category: TemplateCategory;
  target_role: UserRole;
  target_employer_type?: EmployerCategoryFocus;

  // Template metadata
  is_system_template: boolean;
  is_active: boolean;
  usage_count: number;
  average_rating?: number; // 1-5 rating

  // Template content (copy of profile structure)
  template_data: WeightingTemplateData;

  // Validation
  validation_status: ValidationStatus;
  validation_notes?: string;

  // Audit fields
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface WeightingTemplateData {
  // Profile data
  profile_name: string;
  description?: string;
  profile_type: ProfileType;
  user_role: UserRole;
  employer_category_focus: EmployerCategoryFocus;
  project_data_weight: number;
  organiser_expertise_weight: number;
  min_data_requirements: MinDataRequirements;
  confidence_thresholds: ConfidenceThresholds;

  // Track 1 weightings
  track1_weightings: Omit<Track1Weightings, 'id' | 'profile_id' | 'created_at' | 'updated_at'>;

  // Track 2 weightings
  track2_weightings: Omit<Track2Weightings, 'id' | 'profile_id' | 'created_at' | 'updated_at'>;
}

// =============================================================================
// AUDIT AND HISTORY
// =============================================================================

export interface WeightingChangeHistory {
  id: string;
  profile_id: string;

  // Change details
  change_type: ChangeType;
  change_description?: string;

  // Previous and new values
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changed_fields?: string[];

  // Impact assessment
  affected_employers: string[];
  estimated_impact_score: number; // 0-1

  // Change context
  change_reason?: string;
  change_context?: string;

  // Audit metadata
  changed_by: string;
  changed_at: Date;
  ip_address?: string;
  user_agent?: string;

  // Approval workflow
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: Date;
  approval_notes?: string;
}

// =============================================================================
// PERFORMANCE ANALYTICS
// =============================================================================

export interface WeightingPerformanceAnalytics {
  id: string;
  profile_id: string;

  // Analysis period
  analysis_period_start: Date;
  analysis_period_end: Date;

  // Performance metrics
  total_employers_rated: number;
  accuracy_score: number; // 0-1
  confidence_distribution: Record<ConfidenceLevel, number>;
  rating_distribution: Record<TrafficLightRating, number>;

  // Discrepancy analysis
  average_discrepancy_score: number; // 0-1
  manual_override_rate: number; // 0-1

  // Effectiveness metrics
  prediction_accuracy: number; // 0-1
  user_satisfaction_score: number; // 1-5

  // Comparative analysis
  performance_vs_default: number; // -1 to 1
  performance_rank_percentile: number; // 0-1

  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// PREVIEW CALCULATIONS
// =============================================================================

export interface WeightingPreviewCalculation {
  id: string;
  user_id: string;
  profile_id?: string;

  // Preview parameters
  sample_employers: string[];
  proposed_weightings: any; // Can be partial or full weighting configuration

  // Preview results
  calculation_results: WeightingPreviewResults;
  impact_analysis: WeightingImpactAnalysis;

  // Preview metadata
  preview_type: PreviewType;
  comparison_profile_id?: string;

  created_at: Date;
  expires_at: Date;
}

export interface WeightingPreviewResults {
  sample_size: number;
  current_ratings: RatingSnapshot[];
  proposed_ratings: RatingSnapshot[];
  rating_changes: RatingChange[];
  summary_statistics: {
    ratings_improved: number;
    ratings_declined: number;
    ratings_unchanged: number;
    average_score_change: number;
    confidence_change: number;
  };
}

export interface RatingSnapshot {
  employer_id: string;
  employer_name?: string;
  current_rating: TrafficLightRating;
  current_score: number;
  proposed_rating: TrafficLightRating;
  proposed_score: number;
  confidence_level: ConfidenceLevel;
}

export interface RatingChange {
  employer_id: string;
  employer_name?: string;
  previous_rating: TrafficLightRating;
  new_rating: TrafficLightRating;
  previous_score: number;
  new_score: number;
  score_change: number;
  rating_change_type: 'improvement' | 'decline' | 'no_change';
  impact_level: WeightingImpactLevel;
  contributing_factors: string[];
}

export interface WeightingImpactAnalysis {
  overall_impact_level: WeightingImpactLevel;
  impact_distribution: Record<WeightingImpactLevel, number>;
  affected_categories: string[];
  significant_changes: RatingChange[];
  recommendations: string[];
  risk_assessment: {
    high_risk_changes: number;
    medium_risk_changes: number;
    low_risk_changes: number;
  };
}

// =============================================================================
// VALIDATION AND ERROR TYPES
// =============================================================================

export interface WeightingValidationResult {
  is_valid: boolean;
  validation_state: WeightingValidationState;
  errors: WeightingValidationError[];
  warnings: WeightingValidationWarning[];
  summary: {
    total_weight_sum: number;
    track1_weight_sum: number;
    track2_weight_sum: number;
    balance_ratio: number;
  };
}

export interface WeightingValidationError {
  field: string;
  message: string;
  current_value: any;
  expected_value?: any;
  severity: 'error' | 'warning';
  category: 'sum_validation' | 'range_validation' | 'logic_validation' | 'business_rule';
}

export interface WeightingValidationWarning {
  field: string;
  message: string;
  current_value: any;
  recommendation?: string;
  impact_description: string;
}

// =============================================================================
// CONFIGURATION REQUESTS AND RESPONSES
// =============================================================================

export interface CreateWeightingProfileRequest {
  profile_name: string;
  description?: string;
  profile_type: ProfileType;
  user_role: UserRole;
  employer_category_focus: EmployerCategoryFocus;
  project_data_weight: number;
  organiser_expertise_weight: number;
  min_data_requirements?: Partial<MinDataRequirements>;
  confidence_thresholds?: Partial<ConfidenceThresholds>;
  is_default?: boolean;
  is_public?: boolean;
  parent_profile_id?: string;
}

export interface UpdateWeightingProfileRequest {
  profile_name?: string;
  description?: string;
  is_active?: boolean;
  is_public?: boolean;
  project_data_weight?: number;
  organiser_expertise_weight?: number;
  min_data_requirements?: Partial<MinDataRequirements>;
  confidence_thresholds?: Partial<ConfidenceThresholds>;
}

export interface UpdateTrack1WeightingsRequest {
  cbus_paying_weight?: number;
  cbus_on_time_weight?: number;
  cbus_all_workers_weight?: number;
  incolink_entitlements_weight?: number;
  incolink_on_time_weight?: number;
  incolink_all_workers_weight?: number;
  union_relations_right_of_entry_weight?: number;
  union_relations_delegate_accommodation_weight?: number;
  union_relations_access_to_info_weight?: number;
  union_relations_access_to_inductions_weight?: number;
  safety_hsr_respect_weight?: number;
  safety_general_standards_weight?: number;
  safety_incidents_weight?: number;
  subcontractor_usage_levels_weight?: number;
  subcontractor_practices_weight?: number;
  builder_tender_consultation_weight?: number;
  builder_communication_weight?: number;
  builder_delegate_facilities_weight?: number;
  builder_contractor_compliance_weight?: number;
  builder_eba_contractor_percentage_weight?: number;
}

export interface UpdateTrack2WeightingsRequest {
  cbus_overall_assessment_weight?: number;
  incolink_overall_assessment_weight?: number;
  union_relations_overall_weight?: number;
  safety_culture_overall_weight?: number;
  historical_relationship_quality_weight?: number;
  eba_status_weight?: number;
  organiser_confidence_multiplier?: number;
}

export interface PreviewWeightingsRequest {
  profile_id?: string;
  proposed_changes?: {
    profile_changes?: UpdateWeightingProfileRequest;
    track1_changes?: UpdateTrack1WeightingsRequest;
    track2_changes?: UpdateTrack2WeightingsRequest;
  };
  sample_employers?: string[];
  sample_size?: number;
  employer_filters?: {
    employer_type?: EmployerCategoryFocus;
    rating_range?: [number, number];
    confidence_levels?: ConfidenceLevel[];
  };
  comparison_profile_id?: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface WeightingProfileResponse {
  success: boolean;
  data?: UserWeightingProfile;
  track1_weightings?: Track1Weightings;
  track2_weightings?: Track2Weightings;
  validation_result?: WeightingValidationResult;
  error?: string;
  warnings?: string[];
}

export interface WeightingProfilesResponse {
  success: boolean;
  data?: UserWeightingProfile[];
  count?: number;
  error?: string;
}

export interface WeightingTemplatesResponse {
  success: boolean;
  data?: WeightingTemplate[];
  count?: number;
  categories?: TemplateCategory[];
  error?: string;
}

export interface WeightingPreviewResponse {
  success: boolean;
  data?: WeightingPreviewCalculation;
  calculation_id?: string;
  expires_at?: Date;
  error?: string;
}

export interface WeightingValidationResponse {
  success: boolean;
  is_valid: boolean;
  validation_state: WeightingValidationState;
  validation_result?: WeightingValidationResult;
  error?: string;
}

export interface WeightingAnalyticsResponse {
  success: boolean;
  data?: WeightingPerformanceAnalytics;
  trends?: AnalyticsTrend[];
  benchmarks?: AnalyticsBenchmark[];
  error?: string;
}

// =============================================================================
// ANALYTICS AND INSIGHTS
// =============================================================================

export interface AnalyticsTrend {
  period: string; // e.g., "2024-01", "2024-W01"
  accuracy_score: number;
  total_employers: number;
  user_satisfaction: number;
  manual_override_rate: number;
}

export interface AnalyticsBenchmark {
  metric_name: string;
  user_value: number;
  average_value: number;
  percentile_rank: number;
  top_quartile_value: number;
  bottom_quartile_value: number;
}

export interface WeightingEffectivenessReport {
  profile_id: string;
  report_period: {
    start: Date;
    end: Date;
  };
  effectiveness_score: number; // 0-1
  key_metrics: {
    prediction_accuracy: number;
    user_satisfaction: number;
    consistency_score: number;
    efficiency_gain: number;
  };
  strengths: string[];
  improvement_areas: string[];
  recommendations: string[];
  comparative_analysis: {
    vs_default_weighting: number;
    vs_role_average: number;
    vs_top_performers: number;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type WeightingFieldPath =
  | 'project_data_weight'
  | 'organiser_expertise_weight'
  | `track1.${keyof Omit<Track1Weightings, 'id' | 'profile_id' | 'created_at' | 'updated_at'>}`
  | `track2.${keyof Omit<Track2Weightings, 'id' | 'profile_id' | 'created_at' | 'updated_at'>}`;

export type WeightingComparison = {
  field: WeightingFieldPath;
  current_value: number;
  proposed_value: number;
  difference: number;
  percentage_change: number;
  impact_level: WeightingImpactLevel;
};

export type WeightingCategory =
  | 'cbus_compliance'
  | 'incolink_compliance'
  | 'union_relations'
  | 'safety_performance'
  | 'subcontractor_management'
  | 'builder_specific'
  | 'expertise_assessments'
  | 'relationship_factors';

export type WeightingSummary = {
  category: WeightingCategory;
  total_weight: number;
  fields: {
    name: string;
    weight: number;
    description: string;
  }[];
};

export type ProfileCloningOptions = {
  clone_name: string;
  clone_description?: string;
  clone_type: ProfileType;
  include_history: boolean;
  make_public: boolean;
  set_as_default: boolean;
};

export type BulkWeightingOperation = {
  operation_type: 'apply_template' | 'bulk_update' | 'bulk_clone' | 'bulk_delete';
  profile_ids: string[];
  operation_data: any;
  confirm_impact: boolean;
  scheduled_for?: Date;
};

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

export type {
  // Core types for backward compatibility and direct imports
  UserWeightingProfile as WeightingProfile,
  Track1Weightings as ProjectDataWeightings,
  Track2Weightings as ExpertiseWeightings,
  WeightingTemplate as WeightingPreset,
  WeightingChangeHistory as WeightingAuditLog,
  WeightingPerformanceAnalytics as WeightingMetrics
};