// Result types and interfaces for the rating calculation engine outputs

import {
  TrafficLightRating,
  ConfidenceLevel,
  ComplianceAssessmentType,
  RatingStatus,
  DiscrepancyLevel,
  CalculationMethod,
  RatingWeights,
  CurrentRatingDetails,
  RatingHistoryEntry
} from './RatingTypes';
import { CalculationState, PerformanceProfile, CalculationValidationResult } from './CalculationTypes';

// =============================================================================
// CORE RESULT INTERFACES
// =============================================================================

export interface ProjectRatingResult {
  // Basic rating information
  rating: TrafficLightRating;
  score: number | null;
  data_quality: ConfidenceLevel;
  assessment_count: number;
  latest_assessment_date?: Date;
  earliest_assessment_date?: Date;
  data_age_days?: number;
  calculation_date: Date;

  // Detailed breakdown
  assessments: ProjectAssessmentSummary[];
  breakdown?: ProjectRatingBreakdown;

  // Quality metrics
  quality_metrics: DataQualityMetrics;
  trend_analysis?: ProjectTrendAnalysis;

  // Metadata
  processing_time_ms: number;
  calculation_version: string;
  warnings?: string[];
}

export interface ExpertiseRatingResult {
  // Basic rating information
  rating: TrafficLightRating;
  score: number | null;
  confidence_level: ConfidenceLevel;
  assessment_count: number;
  latest_assessment_date?: Date;
  data_age_days?: number;
  calculation_date: Date;

  // Detailed breakdown
  assessments: ExpertiseAssessmentSummary[];
  breakdown?: ExpertiseRatingBreakdown;

  // Quality metrics
  quality_metrics: DataQualityMetrics;
  reputation_analysis?: ReputationAnalysis;

  // Metadata
  processing_time_ms: number;
  calculation_version: string;
  warnings?: string[];
}

export interface EBARatingResult {
  // Basic rating information
  eba_status: TrafficLightRating;
  eba_score: number;
  has_active_eba: boolean;
  latest_eba_date?: Date;
  data_age_days?: number;
  calculation_date: Date;

  // Detailed breakdown
  eba_details: EBADetailSummary[];
  breakdown?: EBARatingBreakdown;

  // Analysis
  compliance_analysis?: EBAComplianceAnalysis;
  expiry_analysis?: EBAExpiryAnalysis;

  // Metadata
  processing_time_ms: number;
  calculation_version: string;
}

export interface FinalRatingResult {
  // Core rating data
  employer_id: string;
  calculation_date: Date;
  final_rating: TrafficLightRating;
  final_score: number;
  overall_confidence: ConfidenceLevel;
  data_completeness: number;

  // Component results
  project_data: ProjectRatingResult;
  expertise_data: ExpertiseRatingResult;
  eba_data: EBARatingResult;

  // Discrepancy and reconciliation
  discrepancy_check: DiscrepancyCheckResult;
  reconciliation_applied: boolean;
  reconciliation_details?: ReconciliationDetails;

  // Calculation metadata
  calculation_method: CalculationMethod;
  weights: RatingWeights;
  algorithm_type: CalculationMethod;
  method_config: Record<string, any>;

  // Review and status
  review_required: boolean;
  review_reason?: string;
  next_review_date?: Date;
  expiry_date: Date;
  rating_status: RatingStatus;

  // Performance and debugging
  performance: PerformanceProfile;
  validation: CalculationValidationResult;
  calculation_state: CalculationState;
  debug_info?: Record<string, any>;

  // Metadata
  calculated_at: Date;
  calculation_version: string;
  processing_time_ms: number;
}

// =============================================================================
// ASSESSMENT SUMMARY TYPES
// =============================================================================

export interface ProjectAssessmentSummary {
  assessment_type: ComplianceAssessmentType;
  score: number;
  rating: TrafficLightRating;
  confidence_level: ConfidenceLevel;
  assessment_date: Date;
  weight: number;
  severity_level?: number;
  severity_name?: string;
  weighted_score: number;
  project_id?: string;
  organiser_id?: string;
  assessment_notes?: string;
  is_recent: boolean; // Within last 90 days
  decay_factor?: number;
}

export interface ExpertiseAssessmentSummary {
  assessment_id: string;
  organiser_id: string;
  organiser_name: string;
  score: number;
  rating: TrafficLightRating;
  confidence_level: ConfidenceLevel;
  assessment_date: Date;
  confidence_weight: number;
  weighted_score: number;
  accuracy_percentage?: number;
  reputation_score?: number;
  assessment_basis: string;
  knowledge_beyond_projects: boolean;
  union_relationship_quality?: string;
  is_recent: boolean; // Within last 90 days
  decay_factor?: number;
}

export interface EBADetailSummary {
  id: string;
  eba_file_number?: string;
  sector?: string;
  fwc_certified_date?: Date;
  date_eba_signed?: Date;
  date_vote_occurred?: Date;
  status: 'active' | 'expired' | 'expiring_soon' | 'unknown';
  days_until_expiry?: number;
  score_impact: number;
  compliance_level: 'compliant' | 'minor_issues' | 'major_issues' | 'non_compliant';
}

// =============================================================================
// BREAKDOWN TYPES
// =============================================================================

export interface ProjectRatingBreakdown {
  total_score: number;
  max_possible_score: number;
  components: ProjectRatingComponent[];
  weightings: Record<ComplianceAssessmentType, number>;
  adjustments: RatingAdjustment[];
  calculations: ProjectCalculations;
}

export interface ProjectRatingComponent {
  assessment_type: ComplianceAssessmentType;
  score: number;
  weight: number;
  weighted_score: number;
  confidence_level: ConfidenceLevel;
  assessment_count: number;
  date_range: { earliest?: Date; latest?: Date };
  severity_distribution: Record<number, number>; // severity_level -> count
  trend_direction: 'improving' | 'stable' | 'declining' | 'unknown';
  recency_score: number;
}

export interface ExpertiseRatingBreakdown {
  total_score: number;
  max_possible_score: number;
  components: ExpertiseRatingComponent[];
  weightings: Record<string, number>;
  adjustments: RatingAdjustment[];
  calculations: ExpertiseCalculations;
}

export interface ExpertiseRatingComponent {
  organiser_id: string;
  organiser_name: string;
  score: number;
  confidence_weight: number;
  weighted_score: number;
  assessment_count: number;
  reputation_adjustment: number;
  expertise_level?: string;
  accuracy_score?: number;
  date_range: { earliest?: Date; latest?: Date };
  consistency_score: number;
}

export interface EBARatingBreakdown {
  total_score: number;
  components: EBARatingComponent[];
  adjustments: RatingAdjustment[];
  calculations: EBACalculations;
}

export interface EBARatingComponent {
  eba_id: string;
  eba_file_number?: string;
  status: TrafficLightRating;
  score_contribution: number;
  age_factor: number;
  compliance_score: number;
  expiry_risk: 'low' | 'medium' | 'high' | 'expired';
  sector_score_adjustment: number;
}

export interface RatingAdjustment {
  type: 'bonus' | 'penalty' | 'correction' | 'manual_override';
  amount: number;
  reason: string;
  applied_by: string;
  applied_at: Date;
  source: 'system' | 'user' | 'algorithm';
}

// =============================================================================
// CALCULATION DETAILS TYPES
// =============================================================================

export interface ProjectCalculations {
  weighted_sum: number;
  total_weight: number;
  base_score: number;
  adjusted_score: number;
  decay_applied: boolean;
  severity_impacts: Record<string, number>;
  time_decay_factors: Record<string, number>;
}

export interface ExpertiseCalculations {
  weighted_sum: number;
  total_confidence_weight: number;
  base_score: number;
  reputation_adjusted_score: number;
  confidence_applied: boolean;
  reputation_bonus: number;
  consistency_score: number;
}

export interface EBACalculations {
  base_score: number;
  recency_adjustment: number;
  expiry_adjustment: number;
  sector_adjustment: number;
  final_score: number;
  compliance_factors: string[];
  risk_factors: string[];
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface DataQualityMetrics {
  data_quality: ConfidenceLevel;
  recency_score: number;
  completeness_score: number;
  consistency_score: number;
  overall_quality_score: number;
  factors: QualityFactor[];
  recommendations: QualityRecommendation[];
}

export interface QualityFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  impact: 'low' | 'medium' | 'high';
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export interface QualityRecommendation {
  priority: 'low' | 'medium' | 'high';
  action: string;
  expected_improvement: number;
  effort: 'minimal' | 'moderate' | 'significant';
  timeframe: string;
}

export interface ProjectTrendAnalysis {
  trend_direction: 'improving' | 'stable' | 'declining' | 'volatile' | 'insufficient_data';
  trend_strength: 'weak' | 'moderate' | 'strong';
  score_change_30d: number;
  score_change_90d: number;
  rating_changes: RatingChange[];
  key_factors: TrendFactor[];
  forecast?: TrendForecast;
}

export interface TrendFactor {
  factor: string;
  impact: number;
  confidence: 'low' | 'medium' | 'high';
  description: string;
  assessment_type?: ComplianceAssessmentType;
}

export interface RatingChange {
  date: Date;
  previous_rating: TrafficLightRating;
  new_rating: TrafficLightRating;
  reason: string;
  assessment_types: ComplianceAssessmentType[];
}

export interface TrendForecast {
  predicted_rating_30d: TrafficLightRating;
  predicted_rating_90d: TrafficLightRating;
  confidence: 'low' | 'medium' | 'high';
  key_influencers: string[];
  risk_factors: string[];
}

export interface ReputationAnalysis {
  overall_reputation_score: number;
  reputation_trend: 'improving' | 'stable' | 'declining';
  accuracy_history: AccuracyDataPoint[];
  consistency_score: number;
  expertise_level_assessment: string;
  peer_comparison: PeerComparison;
}

export interface AccuracyDataPoint {
  date: Date;
  accuracy_percentage: number;
  assessment_count: number;
  confidence_level: ConfidenceLevel;
}

export interface PeerComparison {
  percentile_rank: number;
  comparison_group_size: number;
  average_accuracy: number;
  relative_performance: 'above_average' | 'average' | 'below_average';
}

export interface EBAComplianceAnalysis {
  overall_compliance: 'fully_compliant' | 'mostly_compliant' | 'partially_compliant' | 'non_compliant';
  compliance_factors: ComplianceFactor[];
  risk_areas: RiskArea[];
  recommendations: EBARecommendation[];
}

export interface ComplianceFactor {
  factor: string;
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'unknown';
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence?: string;
}

export interface RiskArea {
  area: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
  impact: string;
  mitigation: string;
}

export interface EBARecommendation {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  deadline?: Date;
  responsible_party?: string;
  expected_outcome: string;
}

export interface EBAExpiryAnalysis {
  expiry_status: 'current' | 'expiring_soon' | 'expired' | 'no_eba';
  days_until_expiry?: number;
  expiry_risk_level: 'low' | 'medium' | 'high' | 'critical';
  renewal_indicators: RenewalIndicator[];
  historical_patterns: ExpiryPattern[];
}

export interface RenewalIndicator {
  indicator: string;
  present: boolean;
  strength: 'weak' | 'moderate' | 'strong';
  confidence: 'low' | 'medium' | 'high';
}

export interface ExpiryPattern {
  pattern_type: string;
  frequency: number;
  average_gap_days: number;
  last_occurrence: Date;
}

// =============================================================================
// DISCREPANCY AND RECONCILIATION RESULT TYPES
// =============================================================================

export interface DiscrepancyCheckResult {
  discrepancy_detected: boolean;
  discrepancy_level: DiscrepancyLevel;
  score_difference: number;
  rating_match: boolean;
  confidence_gap: number;
  requires_review: boolean;
  recommended_action: ReconciliationAction;
  confidence_impact: number;
  explanation: string;
  detailed_analysis: DiscrepancyAnalysis;
}

export interface DiscrepancyAnalysis {
  primary_causes: DiscrepancyCause[];
  contributing_factors: ContributingFactor[];
  data_conflicts: DataConflict[];
  temporal_analysis: TemporalDiscrepancy;
  source_reliability: SourceReliabilityAssessment;
}

export type DiscrepancyAnalysisDetails = DiscrepancyAnalysis;

export interface DiscrepancyCause {
  cause: string;
  impact: number;
  likelihood: 'low' | 'medium' | 'high';
  evidence: string[];
  resolution_approach: string;
}

export interface ContributingFactor {
  factor: string;
  weight: number;
  description: string;
  mitigable: boolean;
}

export interface DataConflict {
  type: 'score_range' | 'rating_mismatch' | 'confidence_gap' | 'recency_conflict' | 'completeness_difference';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_components: string[];
  impact_score: number;
  resolution_suggestion: string;
}

export interface TemporalDiscrepancy {
  data_age_difference: number;
  temporal_alignment: 'aligned' | 'misaligned' | 'unknown';
  recency_preference: 'project' | 'expertise' | 'balanced';
  temporal_weight_adjustment: number;
}

export interface SourceReliabilityAssessment {
  project_reliability: number;
  expertise_reliability: number;
  reliability_gap: number;
  preferred_source: 'project' | 'expertise' | 'balanced';
  confidence_in_preference: number;
}

export interface ReconciliationAction {
  action: 'accept_calculated' | 'prefer_project' | 'prefer_expertise' | 'prefer_eba' | 'manual_review' | 'weighted_compromise';
  confidence: number;
  reasoning: string;
  expected_outcome: string;
  implementation: ReconciliationImplementation;
}

export interface ReconciliationImplementation {
  method: string;
  weight_adjustments: Record<string, number>;
  score_adjustments: Record<string, number>;
  manual_review_required: boolean;
  automated_actions: string[];
}

export interface ReconciliationDetails {
  method_used: string;
  original_weights: RatingWeights;
  adjusted_weights: RatingWeights;
  adjustments: ReconciliationAdjustment[];
  decision_factors: DecisionFactor[];
  reviewer_notes?: string;
  reviewer_id?: string;
  review_date?: Date;
}

export interface ReconciliationAdjustment {
  type: 'weight_change' | 'score_override' | 'confidence_adjustment' | 'manual_override';
  component: 'project' | 'expertise' | 'eba' | 'final';
  original_value: number;
  adjusted_value: number;
  reason: string;
  auto_applied: boolean;
  applied_by?: string;
  applied_at: Date;
}

export interface DecisionFactor {
  factor: string;
  weight: number;
  value: number;
  reasoning: string;
  data_source: string;
}

// =============================================================================
// COMPREHENSIVE RESULT TYPES
// =============================================================================

export interface EmployerRatingSummary {
  employer_id: string;
  current_rating: CurrentRatingDetails;
  recent_project_assessments: RecentProjectAssessment[];
  recent_expertise_assessments: RecentExpertiseAssessment[];
  rating_history: RatingHistoryEntry[];
  rating_trends: RatingTrendSummary;
  compliance_summary: ComplianceSummary;
  recommendations: EmployerRecommendation[];
  retrieved_at: Date;
  data_freshness: DataFreshnessInfo;
}

export interface RecentProjectAssessment {
  id: string;
  assessment_type: ComplianceAssessmentType;
  score: number;
  rating: TrafficLightRating;
  assessment_date: Date;
  confidence_level: ConfidenceLevel;
  project_name?: string;
  organiser_name?: string;
  days_old: number;
}

export interface RecentExpertiseAssessment {
  id: string;
  overall_score: number;
  overall_rating: TrafficLightRating;
  assessment_date: Date;
  confidence_level: ConfidenceLevel;
  organiser_name: string;
  assessment_basis: string;
  days_old: number;
}

export interface RatingTrendSummary {
  direction_30d: 'improving' | 'stable' | 'declining' | 'unknown';
  direction_90d: 'improving' | 'stable' | 'declining' | 'unknown';
  score_change_30d: number;
  score_change_90d: number;
  rating_changes_30d: number;
  rating_changes_90d: number;
  trend_strength: 'weak' | 'moderate' | 'strong';
}

export interface ComplianceSummary {
  overall_status: 'excellent' | 'good' | 'needs_attention' | 'poor';
  key_strengths: string[];
  areas_for_improvement: string[];
  critical_issues: string[];
  compliance_score: number;
  last_updated: Date;
}

export interface EmployerRecommendation {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'compliance' | 'relationship' | 'data_quality' | 'review';
  action: string;
  rationale: string;
  target_date?: Date;
  responsible_party?: string;
  expected_impact: string;
}

export interface DataFreshnessInfo {
  project_data_age: number;
  expertise_data_age: number;
  eba_data_age: number;
  overall_freshness: 'current' | 'acceptable' | 'stale' | 'very_stale';
  last_calculation: Date;
  next_recommended_update: Date;
}

// =============================================================================
// EXPORT AND REPORTING TYPES
// =============================================================================

export interface RatingExportResult {
  export_id: string;
  format: 'json' | 'csv' | 'excel' | 'pdf';
  employer_count: number;
  file_size_bytes: number;
  export_date: Date;
  export_url?: string;
  expires_at?: Date;
  filters: ExportFilters;
}

export interface ExportFilters {
  rating?: TrafficLightRating[];
  confidence_level?: ConfidenceLevel[];
  date_range?: { start: Date; end: Date };
  min_data_completeness?: number;
  requires_review_only?: boolean;
}

export interface RatingReport {
  report_id: string;
  title: string;
  description: string;
  generated_at: Date;
  data_range: { start: Date; end: Date };
  employer_count: number;
  summary_statistics: ReportStatistics;
  sections: ReportSection[];
  format: 'html' | 'pdf' | 'json';
}

export interface ReportStatistics {
  rating_distribution: Record<TrafficLightRating, number>;
  average_confidence: number;
  average_score: number;
  data_completeness_average: number;
  review_required_count: number;
  discrepancy_count: number;
  trends_summary: TrendStatistics;
}

export interface TrendStatistics {
  improving_count: number;
  stable_count: number;
  declining_count: number;
  unknown_count: number;
  average_change_30d: number;
  average_change_90d: number;
}

export interface ReportSection {
  title: string;
  type: 'summary' | 'charts' | 'tables' | 'analysis' | 'recommendations';
  content: any;
  order: number;
}