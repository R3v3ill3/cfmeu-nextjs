// CFMEU Employer Rating System - Weighting Calculation Engine
// Core engine for applying user-configurable weightings to rating calculations

import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  WeightingValidationResult,
  WeightingValidationError,
  WeightingValidationWarning,
  WeightingValidationState,
  MinDataRequirements,
  ConfidenceThresholds,
  TrafficLightRating,
  ConfidenceLevel,
  CalculationMethod,
  WeightingFieldPath,
  WeightingImpactLevel,
  WeightingSummary,
  WeightingCategory
} from './types/WeightingTypes';

import {
  FinalRatingResult,
  ProjectRatingResult,
  ExpertiseRatingResult,
  EBARatingResult,
  ComplianceAssessment,
  ExpertiseAssessment,
  RatingWeights,
  BaseRatingResult
} from '@/lib/rating-engine/types/RatingTypes';

// =============================================================================
// CORE WEIGHTING ENGINE CLASS
// =============================================================================

export class WeightingEngine {
  private static readonly EPSILON = 0.01; // Tolerance for floating point comparisons
  private static readonly DEFAULT_MIN_REQUIREMENTS: MinDataRequirements = {
    min_project_assessments: 3,
    min_expertise_assessments: 1,
    min_data_age_days: 365,
    require_eba_status: false,
    require_safety_data: false
  };

  private static readonly DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
    high_confidence_min: 0.8,
    medium_confidence_min: 0.6,
    low_confidence_min: 0.4,
    very_low_confidence_max: 0.4
  };

  // =============================================================================
  // VALIDATION METHODS
  // =============================================================================

  /**
   * Validate a complete weighting profile configuration
   */
  static validateWeightingProfile(
    profile: UserWeightingProfile,
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings
  ): WeightingValidationResult {
    const errors: WeightingValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    // Validate main weightings sum to 1.0
    const mainSum = profile.project_data_weight + profile.organiser_expertise_weight;
    if (Math.abs(mainSum - 1.0) > this.EPSILON) {
      errors.push({
        field: 'main_weightings',
        message: `Project data and organiser expertise weights must sum to 1.0. Current sum: ${mainSum.toFixed(3)}`,
        current_value: mainSum,
        expected_value: 1.0,
        severity: 'error',
        category: 'sum_validation'
      });
    }

    // Validate individual weight ranges
    this.validateWeightRange(errors, warnings, 'project_data_weight', profile.project_data_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'organiser_expertise_weight', profile.organiser_expertise_weight, 0, 1);

    // Validate Track 1 weightings
    const track1Validation = this.validateTrack1Weightings(track1Weightings);
    errors.push(...track1Validation.errors);
    warnings.push(...track1Validation.warnings);

    // Validate Track 2 weightings
    const track2Validation = this.validateTrack2Weightings(track2Weightings);
    errors.push(...track2Validation.errors);
    warnings.push(...track2Validation.warnings);

    // Validate minimum requirements
    this.validateMinRequirements(errors, warnings, profile.min_data_requirements);

    // Validate confidence thresholds
    this.validateConfidenceThresholds(errors, warnings, profile.confidence_thresholds);

    // Calculate summary
    const track1Sum = this.calculateTrack1Sum(track1Weightings);
    const track2Sum = this.calculateTrack2Sum(track2Weightings);

    const summary = {
      total_weight_sum: mainSum,
      track1_weight_sum: track1Sum,
      track2_weight_sum: track2Sum,
      balance_ratio: profile.project_data_weight / profile.organiser_expertise_weight
    };

    // Determine validation state
    const validationState: WeightingValidationState = errors.length > 0
      ? 'invalid'
      : warnings.length > 0
      ? 'warning'
      : 'valid';

    return {
      is_valid: errors.length === 0,
      validation_state: validationState,
      errors,
      warnings,
      summary
    };
  }

  /**
   * Validate Track 1 (Project Compliance Data) weightings
   */
  private static validateTrack1Weightings(
    weightings: Track1Weightings
  ): { errors: WeightingValidationError[]; warnings: WeightingValidationWarning[] } {
    const errors: WeightingValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    // CBUS weightings
    this.validateWeightRange(errors, warnings, 'track1.cbus_paying_weight', weightings.cbus_paying_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.cbus_on_time_weight', weightings.cbus_on_time_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.cbus_all_workers_weight', weightings.cbus_all_workers_weight, 0, 1);

    // Incolink weightings
    this.validateWeightRange(errors, warnings, 'track1.incolink_entitlements_weight', weightings.incolink_entitlements_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.incolink_on_time_weight', weightings.incolink_on_time_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.incolink_all_workers_weight', weightings.incolink_all_workers_weight, 0, 1);

    // Union relations weightings
    this.validateWeightRange(errors, warnings, 'track1.union_relations_right_of_entry_weight', weightings.union_relations_right_of_entry_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.union_relations_delegate_accommodation_weight', weightings.union_relations_delegate_accommodation_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.union_relations_access_to_info_weight', weightings.union_relations_access_to_info_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.union_relations_access_to_inductions_weight', weightings.union_relations_access_to_inductions_weight, 0, 1);

    // Safety performance weightings
    this.validateWeightRange(errors, warnings, 'track1.safety_hsr_respect_weight', weightings.safety_hsr_respect_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.safety_general_standards_weight', weightings.safety_general_standards_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.safety_incidents_weight', weightings.safety_incidents_weight, 0, 1);

    // Subcontractor management weightings
    this.validateWeightRange(errors, warnings, 'track1.subcontractor_usage_levels_weight', weightings.subcontractor_usage_levels_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.subcontractor_practices_weight', weightings.subcontractor_practices_weight, 0, 1);

    // Builder-specific weightings
    this.validateWeightRange(errors, warnings, 'track1.builder_tender_consultation_weight', weightings.builder_tender_consultation_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.builder_communication_weight', weightings.builder_communication_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.builder_delegate_facilities_weight', weightings.builder_delegate_facilities_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.builder_contractor_compliance_weight', weightings.builder_contractor_compliance_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track1.builder_eba_contractor_percentage_weight', weightings.builder_eba_contractor_percentage_weight, 0, 1);

    // Validate that subcontractor weights sum appropriately
    const subcontractorSum = weightings.subcontractor_usage_levels_weight + weightings.subcontractor_practices_weight;
    if (Math.abs(subcontractorSum - 1.0) > this.EPSILON) {
      errors.push({
        field: 'track1.subcontractor_weights',
        message: `Subcontractor management weights must sum to 1.0. Current sum: ${subcontractorSum.toFixed(3)}`,
        current_value: subcontractorSum,
        expected_value: 1.0,
        severity: 'error',
        category: 'sum_validation'
      });
    }

    // Validate that builder weights sum appropriately
    const builderSum = weightings.builder_tender_consultation_weight +
                     weightings.builder_communication_weight +
                     weightings.builder_delegate_facilities_weight +
                     weightings.builder_contractor_compliance_weight +
                     weightings.builder_eba_contractor_percentage_weight;

    if (Math.abs(builderSum - 1.0) > this.EPSILON) {
      warnings.push({
        field: 'track1.builder_weights',
        message: `Builder-specific weights ideally sum to 1.0. Current sum: ${builderSum.toFixed(3)}`,
        current_value: builderSum,
        recommendation: 'Consider adjusting builder weights to sum to 1.0 for consistent scoring',
        impact_description: 'May affect relative importance of builder-specific factors'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate Track 2 (Organiser Expertise) weightings
   */
  private static validateTrack2Weightings(
    weightings: Track2Weightings
  ): { errors: WeightingValidationError[]; warnings: WeightingValidationWarning[] } {
    const errors: WeightingValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    // Individual assessment weightings
    this.validateWeightRange(errors, warnings, 'track2.cbus_overall_assessment_weight', weightings.cbus_overall_assessment_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track2.incolink_overall_assessment_weight', weightings.incolink_overall_assessment_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track2.union_relations_overall_weight', weightings.union_relations_overall_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track2.safety_culture_overall_weight', weightings.safety_culture_overall_weight, 0, 1);

    // Relationship and historical factors
    this.validateWeightRange(errors, warnings, 'track2.historical_relationship_quality_weight', weightings.historical_relationship_quality_weight, 0, 1);
    this.validateWeightRange(errors, warnings, 'track2.eba_status_weight', weightings.eba_status_weight, 0, 1);

    // Organiser confidence multiplier
    this.validateWeightRange(errors, warnings, 'track2.organiser_confidence_multiplier', weightings.organiser_confidence_multiplier, 0.5, 2.0);

    // Check if organiser confidence multiplier is significantly different from 1.0
    if (Math.abs(weightings.organiser_confidence_multiplier - 1.0) > 0.2) {
      warnings.push({
        field: 'track2.organiser_confidence_multiplier',
        message: `Organiser confidence multiplier is significantly different from default: ${weightings.organiser_confidence_multiplier.toFixed(2)}`,
        current_value: weightings.organiser_confidence_multiplier,
        recommendation: 'Consider if this level of confidence adjustment is appropriate',
        impact_description: 'Will significantly scale the impact of organiser expertise on final ratings'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate weight range and add appropriate errors/warnings
   */
  private static validateWeightRange(
    errors: WeightingValidationError[],
    warnings: WeightingValidationWarning[],
    field: string,
    value: number,
    min: number,
    max: number
  ): void {
    if (value < min || value > max) {
      errors.push({
        field,
        message: `${field} must be between ${min} and ${max}. Current value: ${value.toFixed(3)}`,
        current_value: value,
        expected_value: `${min}-${max}`,
        severity: 'error',
        category: 'range_validation'
      });
    } else if (value < min + this.EPSILON || value > max - this.EPSILON) {
      warnings.push({
        field,
        message: `${field} is at the extreme boundary: ${value.toFixed(3)}`,
        current_value: value,
        recommendation: 'Consider if this extreme weighting is intentional',
        impact_description: 'May limit the impact of other factors in the calculation'
      });
    }
  }

  /**
   * Validate minimum data requirements
   */
  private static validateMinRequirements(
    errors: WeightingValidationError[],
    warnings: WeightingValidationWarning[],
    requirements: MinDataRequirements
  ): void {
    if (requirements.min_project_assessments < 1) {
      errors.push({
        field: 'min_data_requirements.min_project_assessments',
        message: 'Minimum project assessments must be at least 1',
        current_value: requirements.min_project_assessments,
        expected_value: '>= 1',
        severity: 'error',
        category: 'business_rule'
      });
    }

    if (requirements.min_expertise_assessments < 0) {
      errors.push({
        field: 'min_data_requirements.min_expertise_assessments',
        message: 'Minimum expertise assessments cannot be negative',
        current_value: requirements.min_expertise_assessments,
        expected_value: '>= 0',
        severity: 'error',
        category: 'business_rule'
      });
    }

    if (requirements.min_data_age_days < 30) {
      warnings.push({
        field: 'min_data_requirements.min_data_age_days',
        message: 'Very short data age threshold may include outdated information',
        current_value: requirements.min_data_age_days,
        recommendation: 'Consider a longer threshold for more stable ratings',
        impact_description: 'May result in ratings based on very limited recent data'
      });
    }
  }

  /**
   * Validate confidence thresholds
   */
  private static validateConfidenceThresholds(
    errors: WeightingValidationError[],
    warnings: WeightingValidationWarning[],
    thresholds: ConfidenceThresholds
  ): void {
    const thresholdsArray = [
      { field: 'high_confidence_min', value: thresholds.high_confidence_min },
      { field: 'medium_confidence_min', value: thresholds.medium_confidence_min },
      { field: 'low_confidence_min', value: thresholds.low_confidence_min }
    ];

    // Check ordering
    for (let i = 0; i < thresholdsArray.length - 1; i++) {
      if (thresholdsArray[i].value <= thresholdsArray[i + 1].value) {
        errors.push({
          field: `confidence_thresholds.${thresholdsArray[i].field}`,
          message: `Confidence thresholds must be in descending order. ${thresholdsArray[i].field} (${thresholdsArray[i].value}) must be greater than ${thresholdsArray[i + 1].field} (${thresholdsArray[i + 1].value})`,
          current_value: thresholdsArray[i].value,
          expected_value: `> ${thresholdsArray[i + 1].value}`,
          severity: 'error',
          category: 'logic_validation'
        });
      }
    }

    // Check that very_low_confidence_max is consistent
    if (thresholds.very_low_confidence_max >= thresholds.low_confidence_min) {
      errors.push({
        field: 'confidence_thresholds.very_low_confidence_max',
        message: 'Very low confidence maximum must be less than low confidence minimum',
        current_value: thresholds.very_low_confidence_max,
        expected_value: `< ${thresholds.low_confidence_min}`,
        severity: 'error',
        category: 'logic_validation'
      });
    }
  }

  // =============================================================================
  // CALCULATION METHODS
  // =============================================================================

  /**
   * Apply user weightings to calculate final employer rating
   */
  static calculateWeightedRating(
    profile: UserWeightingProfile,
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings,
    projectData: ProjectRatingResult,
    expertiseData: ExpertiseRatingResult,
    ebaData: EBARatingResult
  ): FinalRatingResult {
    // Validate minimum data requirements
    this.checkMinimumDataRequirements(profile, projectData, expertiseData, ebaData);

    // Apply Track 1 weightings to project data
    const weightedProjectScore = this.applyTrack1Weightings(track1Weightings, projectData);

    // Apply Track 2 weightings to expertise data
    const weightedExpertiseScore = this.applyTrack2Weightings(track2Weightings, expertiseData);

    // Apply organiser confidence multiplier
    const confidenceAdjustedExpertiseScore = weightedExpertiseScore.score * track2Weightings.organiser_confidence_multiplier;

    // Combine weighted scores using main balance weights
    const finalScore = (weightedProjectScore.score * profile.project_data_weight) +
                      (confidenceAdjustedExpertiseScore * profile.organiser_expertise_weight);

    // Apply EBA status influence
    const ebaAdjustedScore = this.applyEBAInfluence(finalScore, ebaData, track2Weightings.eba_status_weight);

    // Convert score to traffic light rating
    const finalRating = this.scoreToRating(ebaAdjustedScore);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      weightedProjectScore.confidence_level,
      weightedExpertiseScore.confidence_level,
      profile.project_data_weight,
      profile.organiser_expertise_weight
    );

    // Create rating breakdown for transparency
    const breakdown = this.createRatingBreakdown(
      weightedProjectScore,
      weightedExpertiseScore,
      ebaData,
      profile,
      track1Weightings,
      track2Weightings
    );

    // Check for discrepancies
    const discrepancyCheck = this.performDiscrepancyCheck(
      weightedProjectScore,
      weightedExpertiseScore,
      profile
    );

    return {
      employer_id: projectData.employer_id || expertiseData.employer_id,
      calculation_date: new Date(),
      final_rating: finalRating,
      final_score: Math.max(0, Math.min(1, ebaAdjustedScore)), // Clamp between 0 and 1

      // Component data
      project_data: weightedProjectScore,
      expertise_data: weightedExpertiseScore,
      eba_data: ebaData,

      // Quality indicators
      overall_confidence: overallConfidence,
      data_completeness: this.calculateDataCompleteness(projectData, expertiseData, ebaData),
      discrepancy_check: discrepancyCheck,

      // Calculation details
      calculation_method: CalculationMethod.weighted_average,
      weights: {
        project: profile.project_data_weight,
        expertise: profile.organiser_expertise_weight,
        eba: track2Weightings.eba_status_weight
      },
      algorithm_type: CalculationMethod.weighted_average,
      method_config: {
        profile_id: profile.id,
        profile_name: profile.profile_name,
        weighting_version: profile.version,
        organiser_confidence_multiplier: track2Weightings.organiser_confidence_multiplier
      },

      // Reconciliation
      reconciliation_needed: discrepancyCheck.requires_review,
      reconciliation_method: discrepancyCheck.recommended_action,

      // Metadata
      calculated_at: new Date(),
      calculation_version: `v${profile.version}`,
      processing_time_ms: 0 // Would be populated in actual implementation
    };
  }

  /**
   * Apply Track 1 weightings to project compliance data
   */
  private static applyTrack1Weightings(
    weightings: Track1Weightings,
    projectData: ProjectRatingResult
  ): ProjectRatingResult {
    const componentScores = this.extractComponentScoresFromProjectData(projectData);
    let totalScore = 0;
    let totalWeight = 0;

    // Apply CBUS weightings
    const cbusScore = this.calculateComponentScore(
      componentScores.cbus_paying * weightings.cbus_paying_weight +
      componentScores.cbus_on_time * weightings.cbus_on_time_weight +
      componentScores.cbus_all_workers * weightings.cbus_all_workers_weight,
      weightings.cbus_paying_weight + weightings.cbus_on_time_weight + weightings.cbus_all_workers_weight
    );

    // Apply Incolink weightings
    const incolinkScore = this.calculateComponentScore(
      componentScores.incolink_entitlements * weightings.incolink_entitlements_weight +
      componentScores.incolink_on_time * weightings.incolink_on_time_weight +
      componentScores.incolink_all_workers * weightings.incolink_all_workers_weight,
      weightings.incolink_entitlements_weight + weightings.incolink_on_time_weight + weightings.incolink_all_workers_weight
    );

    // Apply Union Relations weightings
    const unionRelationsScore = this.calculateComponentScore(
      componentScores.union_relations_right_of_entry * weightings.union_relations_right_of_entry_weight +
      componentScores.union_relations_delegate_accommodation * weightings.union_relations_delegate_accommodation_weight +
      componentScores.union_relations_access_to_info * weightings.union_relations_access_to_info_weight +
      componentScores.union_relations_access_to_inductions * weightings.union_relations_access_to_inductions_weight,
      weightings.union_relations_right_of_entry_weight +
      weightings.union_relations_delegate_accommodation_weight +
      weightings.union_relations_access_to_info_weight +
      weightings.union_relations_access_to_inductions_weight
    );

    // Apply Safety performance weightings
    const safetyScore = this.calculateComponentScore(
      componentScores.safety_hsr_respect * weightings.safety_hsr_respect_weight +
      componentScores.safety_general_standards * weightings.safety_general_standards_weight +
      componentScores.safety_incidents * weightings.safety_incidents_weight,
      weightings.safety_hsr_respect_weight + weightings.safety_general_standards_weight + weightings.safety_incidents_weight
    );

    // Apply Subcontractor management weightings
    const subcontractorScore = this.calculateComponentScore(
      componentScores.subcontractor_usage_levels * weightings.subcontractor_usage_levels_weight +
      componentScores.subcontractor_practices * weightings.subcontractor_practices_weight,
      weightings.subcontractor_usage_levels_weight + weightings.subcontractor_practices_weight
    );

    // Combine all components (using equal weighting for main categories)
    const categoryWeights = {
      cbus: 0.25,
      incolink: 0.25,
      union_relations: 0.25,
      safety: 0.15,
      subcontractor: 0.10
    };

    totalScore = (cbusScore.score * categoryWeights.cbus) +
                (incolinkScore.score * categoryWeights.incolink) +
                (unionRelationsScore.score * categoryWeights.union_relations) +
                (safetyScore.score * categoryWeights.safety) +
                (subcontractorScore.score * categoryWeights.subcontractor);

    return {
      ...projectData,
      score: Math.max(0, Math.min(1, totalScore)),
      rating: this.scoreToRating(totalScore),
      breakdown: {
        total_score: totalScore,
        max_possible_score: 1.0,
        components: [
          { name: 'CBUS Compliance', score: cbusScore.score, weight: categoryWeights.cbus, weighted_score: cbusScore.score * categoryWeights.cbus, confidence_level: cbusScore.confidence_level, data_points: cbusScore.data_points },
          { name: 'Incolink Compliance', score: incolinkScore.score, weight: categoryWeights.incolink, weighted_score: incolinkScore.score * categoryWeights.incolink, confidence_level: incolinkScore.confidence_level, data_points: incolinkScore.data_points },
          { name: 'Union Relations', score: unionRelationsScore.score, weight: categoryWeights.union_relations, weighted_score: unionRelationsScore.score * categoryWeights.union_relations, confidence_level: unionRelationsScore.confidence_level, data_points: unionRelationsScore.data_points },
          { name: 'Safety Performance', score: safetyScore.score, weight: categoryWeights.safety, weighted_score: safetyScore.score * categoryWeights.safety, confidence_level: safetyScore.confidence_level, data_points: safetyScore.data_points },
          { name: 'Subcontractor Management', score: subcontractorScore.score, weight: categoryWeights.subcontractor, weighted_score: subcontractorScore.score * categoryWeights.subcontractor, confidence_level: subcontractorScore.confidence_level, data_points: subcontractorScore.data_points }
        ],
        weightings: categoryWeights
      }
    };
  }

  /**
   * Apply Track 2 weightings to organiser expertise data
   */
  private static applyTrack2Weightings(
    weightings: Track2Weightings,
    expertiseData: ExpertiseRatingResult
  ): ExpertiseRatingResult {
    const componentScores = this.extractComponentScoresFromExpertiseData(expertiseData);

    let totalScore = 0;
    let totalWeight = 0;

    // Apply individual assessment weightings
    const assessmentWeightSum = weightings.cbus_overall_assessment_weight +
                               weightings.incolink_overall_assessment_weight +
                               weightings.union_relations_overall_weight +
                               weightings.safety_culture_overall_weight;

    const weightedAssessmentScore = this.calculateComponentScore(
      componentScores.cbus_overall * weightings.cbus_overall_assessment_weight +
      componentScores.incolink_overall * weightings.incolink_overall_assessment_weight +
      componentScores.union_relations_overall * weightings.union_relations_overall_weight +
      componentScores.safety_culture_overall * weightings.safety_culture_overall_weight,
      assessmentWeightSum
    );

    // Apply relationship and historical factor weightings
    const relationshipWeightSum = weightings.historical_relationship_quality_weight + weightings.eba_status_weight;
    const weightedRelationshipScore = this.calculateComponentScore(
      componentScores.historical_relationship_quality * weightings.historical_relationship_quality_weight +
      componentScores.eba_status * weightings.eba_status_weight,
      relationshipWeightSum
    );

    // Combine assessment and relationship factors
    const finalWeightedScore = (weightedAssessmentScore.score * 0.8) + (weightedRelationshipScore.score * 0.2);

    return {
      ...expertiseData,
      score: Math.max(0, Math.min(1, finalWeightedScore)),
      rating: this.scoreToRating(finalWeightedScore),
      confidence_level: this.adjustConfidenceForMultiplier(expertiseData.confidence_level, weightings.organiser_confidence_multiplier)
    };
  }

  /**
   * Apply EBA status influence on final score
   */
  private static applyEBAInfluence(
    currentScore: number,
    ebaData: EBARatingResult,
    ebaWeight: number
  ): number {
    if (!ebaData.has_active_eba || ebaWeight === 0) {
      return currentScore;
    }

    // Convert EBA rating to score
    const ebaScore = this.ratingToScore(ebaData.eba_status);

    // Apply EBA influence (small adjustment to final score)
    const ebaInfluence = (ebaScore - currentScore) * ebaWeight * 0.2; // Reduced impact

    return currentScore + ebaInfluence;
  }

  // =============================================================================
  // UTILITY AND HELPER METHODS
  // =============================================================================

  /**
   * Calculate sum of Track 1 weightings
   */
  private static calculateTrack1Sum(weightings: Track1Weightings): number {
    return (
      weightings.cbus_paying_weight + weightings.cbus_on_time_weight + weightings.cbus_all_workers_weight +
      weightings.incolink_entitlements_weight + weightings.incolink_on_time_weight + weightings.incolink_all_workers_weight +
      weightings.union_relations_right_of_entry_weight + weightings.union_relations_delegate_accommodation_weight +
      weightings.union_relations_access_to_info_weight + weightings.union_relations_access_to_inductions_weight +
      weightings.safety_hsr_respect_weight + weightings.safety_general_standards_weight + weightings.safety_incidents_weight +
      weightings.subcontractor_usage_levels_weight + weightings.subcontractor_practices_weight
    );
  }

  /**
   * Calculate sum of Track 2 weightings
   */
  private static calculateTrack2Sum(weightings: Track2Weightings): number {
    return (
      weightings.cbus_overall_assessment_weight + weightings.incolink_overall_assessment_weight +
      weightings.union_relations_overall_weight + weightings.safety_culture_overall_weight +
      weightings.historical_relationship_quality_weight + weightings.eba_status_weight
    );
  }

  /**
   * Convert score (0-1) to traffic light rating
   */
  private static scoreToRating(score: number): TrafficLightRating {
    if (score >= 0.8) return 'green';
    if (score >= 0.6) return 'amber';
    if (score >= 0.3) return 'red';
    return 'red'; // Treat very low scores as red
  }

  /**
   * Convert traffic light rating to score (0-1)
   */
  private static ratingToScore(rating: TrafficLightRating): number {
    switch (rating) {
      case 'green': return 0.85;
      case 'amber': return 0.65;
      case 'red': return 0.25;
      case 'unknown': return 0.5;
      default: return 0.5;
    }
  }

  /**
   * Calculate component score with proper weighting
   */
  private static calculateComponentScore(
    weightedSum: number,
    totalWeight: number
  ): { score: number; confidence_level: ConfidenceLevel; data_points: number } {
    return {
      score: totalWeight > 0 ? weightedSum / totalWeight : 0,
      confidence_level: 'medium', // Would be calculated based on actual data
      data_points: 1 // Would be calculated based on actual data
    };
  }

  /**
   * Extract component scores from project data
   */
  private static extractComponentScoresFromProjectData(projectData: ProjectRatingResult): Record<string, number> {
    // This would extract actual component scores from the project data
    // For now, using the overall score as a placeholder
    return {
      cbus_paying: projectData.score,
      cbus_on_time: projectData.score,
      cbus_all_workers: projectData.score,
      incolink_entitlements: projectData.score,
      incolink_on_time: projectData.score,
      incolink_all_workers: projectData.score,
      union_relations_right_of_entry: projectData.score,
      union_relations_delegate_accommodation: projectData.score,
      union_relations_access_to_info: projectData.score,
      union_relations_access_to_inductions: projectData.score,
      safety_hsr_respect: projectData.score,
      safety_general_standards: projectData.score,
      safety_incidents: projectData.score,
      subcontractor_usage_levels: projectData.score,
      subcontractor_practices: projectData.score
    };
  }

  /**
   * Extract component scores from expertise data
   */
  private static extractComponentScoresFromExpertiseData(expertiseData: ExpertiseRatingResult): Record<string, number> {
    return {
      cbus_overall: expertiseData.score,
      incolink_overall: expertiseData.score,
      union_relations_overall: expertiseData.score,
      safety_culture_overall: expertiseData.score,
      historical_relationship_quality: expertiseData.score,
      eba_status: expertiseData.score
    };
  }

  /**
   * Check minimum data requirements are met
   */
  private static checkMinimumDataRequirements(
    profile: UserWeightingProfile,
    projectData: ProjectRatingResult,
    expertiseData: ExpertiseRatingResult,
    ebaData: EBARatingResult
  ): void {
    const requirements = { ...this.DEFAULT_MIN_REQUIREMENTS, ...profile.min_data_requirements };

    if (projectData.assessment_count < requirements.min_project_assessments) {
      throw new Error(`Insufficient project assessments: ${projectData.assessment_count} < ${requirements.min_project_assessments}`);
    }

    if (expertiseData.assessment_count < requirements.min_expertise_assessments) {
      throw new Error(`Insufficient expertise assessments: ${expertiseData.assessment_count} < ${requirements.min_expertise_assessments}`);
    }

    if (requirements.require_eba_status && !ebaData.has_active_eba) {
      throw new Error('EBA status required but not available');
    }
  }

  /**
   * Calculate overall confidence level
   */
  private static calculateOverallConfidence(
    projectConfidence: ConfidenceLevel,
    expertiseConfidence: ConfidenceLevel,
    projectWeight: number,
    expertiseWeight: number
  ): ConfidenceLevel {
    const confidenceScores = {
      'very_low': 0.2,
      'low': 0.4,
      'medium': 0.6,
      'high': 0.8
    };

    const projectScore = confidenceScores[projectConfidence];
    const expertiseScore = confidenceScores[expertiseConfidence];
    const combinedScore = (projectScore * projectWeight) + (expertiseScore * expertiseWeight);

    if (combinedScore >= 0.75) return 'high';
    if (combinedScore >= 0.5) return 'medium';
    if (combinedScore >= 0.25) return 'low';
    return 'very_low';
  }

  /**
   * Calculate data completeness score
   */
  private static calculateDataCompleteness(
    projectData: ProjectRatingResult,
    expertiseData: ExpertiseRatingResult,
    ebaData: EBARatingResult
  ): number {
    let completenessScore = 0;
    let totalFactors = 0;

    // Project data completeness
    if (projectData.assessment_count > 0) {
      completenessScore += Math.min(projectData.assessment_count / 5, 1) * 0.4;
    }
    totalFactors += 0.4;

    // Expertise data completeness
    if (expertiseData.assessment_count > 0) {
      completenessScore += Math.min(expertiseData.assessment_count / 3, 1) * 0.3;
    }
    totalFactors += 0.3;

    // EBA data completeness
    if (ebaData.has_active_eba) {
      completenessScore += 0.2;
    }
    totalFactors += 0.2;

    // Data recency
    const dataAge = Math.max(
      projectData.data_age_days || 365,
      expertiseData.data_age_days || 365
    );
    const recencyScore = Math.max(0, 1 - (dataAge / 365));
    completenessScore += recencyScore * 0.1;
    totalFactors += 0.1;

    return totalFactors > 0 ? completenessScore / totalFactors : 0;
  }

  /**
   * Perform discrepancy check between project and expertise data
   */
  private static performDiscrepancyCheck(
    projectData: ProjectRatingResult,
    expertiseData: ExpertiseRatingResult,
    profile: UserWeightingProfile
  ): any {
    const scoreDifference = Math.abs(projectData.score - expertiseData.score);
    const ratingMatch = projectData.rating === expertiseData.rating;

    let discrepancyLevel: any = 'none';
    let requiresReview = false;
    let recommendedAction = 'accept_calculated';

    if (scoreDifference > 0.3) {
      discrepancyLevel = 'critical';
      requiresReview = true;
      recommendedAction = 'manual_review';
    } else if (scoreDifference > 0.2) {
      discrepancyLevel = 'major';
      requiresReview = true;
      recommendedAction = profile.project_data_weight > profile.organiser_expertise_weight ? 'prefer_project' : 'prefer_expertise';
    } else if (scoreDifference > 0.1) {
      discrepancyLevel = 'moderate';
      if (!ratingMatch) {
        requiresReview = true;
        recommendedAction = profile.project_data_weight > profile.organiser_expertise_weight ? 'prefer_project' : 'prefer_expertise';
      }
    } else if (scoreDifference > 0.05) {
      discrepancyLevel = 'minor';
    }

    const confidenceImpact = scoreDifference * 0.5;

    return {
      discrepancy_detected: scoreDifference > 0.05,
      discrepancy_level: discrepancyLevel,
      score_difference: scoreDifference,
      rating_match: ratingMatch,
      requires_review: requiresReview,
      recommended_action: recommendedAction,
      confidence_impact: confidenceImpact,
      explanation: `Score difference: ${scoreDifference.toFixed(3)}, Rating match: ${ratingMatch}, Confidence impact: ${confidenceImpact.toFixed(3)}`
    };
  }

  /**
   * Create detailed rating breakdown for transparency
   */
  private static createRatingBreakdown(
    projectData: ProjectRatingResult,
    expertiseData: ExpertiseRatingResult,
    ebaData: EBARatingResult,
    profile: UserWeightingProfile,
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings
  ): any {
    return {
      total_score: (projectData.score * profile.project_data_weight) + (expertiseData.score * profile.organiser_expertise_weight),
      max_possible_score: 1.0,
      components: [
        {
          name: 'Project Compliance Data',
          score: projectData.score,
          weight: profile.project_data_weight,
          weighted_score: projectData.score * profile.project_data_weight,
          confidence_level: projectData.confidence_level,
          data_points: projectData.assessment_count
        },
        {
          name: 'Organiser Expertise',
          score: expertiseData.score,
          weight: profile.organiser_expertise_weight,
          weighted_score: expertiseData.score * profile.organiser_expertise_weight,
          confidence_level: expertiseData.confidence_level,
          data_points: expertiseData.assessment_count
        },
        {
          name: 'EBA Status',
          score: this.ratingToScore(ebaData.eba_status),
          weight: track2Weightings.eba_status_weight,
          weighted_score: this.ratingToScore(ebaData.eba_status) * track2Weightings.eba_status_weight,
          confidence_level: 'high',
          data_points: ebaData.has_active_eba ? 1 : 0
        }
      ],
      weightings: {
        project: profile.project_data_weight,
        expertise: profile.organiser_expertise_weight,
        eba: track2Weightings.eba_status_weight
      }
    };
  }

  /**
   * Adjust confidence level based on organiser confidence multiplier
   */
  private static adjustConfidenceForMultiplier(
    baseConfidence: ConfidenceLevel,
    multiplier: number
  ): ConfidenceLevel {
    const confidenceScores = {
      'very_low': 0.2,
      'low': 0.4,
      'medium': 0.6,
      'high': 0.8
    };

    const baseScore = confidenceScores[baseConfidence];
    const adjustedScore = Math.max(0.1, Math.min(1.0, baseScore * multiplier));

    if (adjustedScore >= 0.75) return 'high';
    if (adjustedScore >= 0.5) return 'medium';
    if (adjustedScore >= 0.25) return 'low';
    return 'very_low';
  }

  /**
   * Get weighting summary for display purposes
   */
  static getWeightingSummary(
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings
  ): WeightingSummary[] {
    return [
      {
        category: 'cbus_compliance',
        total_weight: track1Weightings.cbus_paying_weight + track1Weightings.cbus_on_time_weight + track1Weightings.cbus_all_workers_weight,
        fields: [
          { name: 'Paying Compliance', weight: track1Weightings.cbus_paying_weight, description: 'CBUS payment compliance' },
          { name: 'On-time Payments', weight: track1Weightings.cbus_on_time_weight, description: 'CBUS on-time payment record' },
          { name: 'All Workers Coverage', weight: track1Weightings.cbus_all_workers_weight, description: 'CBUS coverage for all workers' }
        ]
      },
      {
        category: 'incolink_compliance',
        total_weight: track1Weightings.incolink_entitlements_weight + track1Weightings.incolink_on_time_weight + track1Weightings.incolink_all_workers_weight,
        fields: [
          { name: 'Entitlements Compliance', weight: track1Weightings.incolink_entitlements_weight, description: 'Incolink entitlement compliance' },
          { name: 'On-time Payments', weight: track1Weightings.incolink_on_time_weight, description: 'Incolink on-time payment record' },
          { name: 'All Workers Coverage', weight: track1Weightings.incolink_all_workers_weight, description: 'Incolink coverage for all workers' }
        ]
      },
      {
        category: 'union_relations',
        total_weight: track1Weightings.union_relations_right_of_entry_weight + track1Weightings.union_relations_delegate_accommodation_weight + track1Weightings.union_relations_access_to_info_weight + track1Weightings.union_relations_access_to_inductions_weight,
        fields: [
          { name: 'Right of Entry', weight: track1Weightings.union_relations_right_of_entry_weight, description: 'Union right of entry compliance' },
          { name: 'Delegate Accommodation', weight: track1Weightings.union_relations_delegate_accommodation_weight, description: 'Delegate accommodation practices' },
          { name: 'Access to Information', weight: track1Weightings.union_relations_access_to_info_weight, description: 'Information access transparency' },
          { name: 'Access to Inductions', weight: track1Weightings.union_relations_access_to_inductions_weight, description: 'Union induction access' }
        ]
      },
      {
        category: 'safety_performance',
        total_weight: track1Weightings.safety_hsr_respect_weight + track1Weightings.safety_general_standards_weight + track1Weightings.safety_incidents_weight,
        fields: [
          { name: 'HSR Respect', weight: track1Weightings.safety_hsr_respect_weight, description: 'Health and Safety Representative respect' },
          { name: 'General Standards', weight: track1Weightings.safety_general_standards_weight, description: 'Overall safety standards' },
          { name: 'Safety Incidents', weight: track1Weightings.safety_incidents_weight, description: 'Safety incident record' }
        ]
      },
      {
        category: 'subcontractor_management',
        total_weight: track1Weightings.subcontractor_usage_levels_weight + track1Weightings.subcontractor_practices_weight,
        fields: [
          { name: 'Usage Levels', weight: track1Weightings.subcontractor_usage_levels_weight, description: 'Subcontractor usage levels' },
          { name: 'Management Practices', weight: track1Weightings.subcontractor_practices_weight, description: 'Subcontractor management quality' }
        ]
      },
      {
        category: 'expertise_assessments',
        total_weight: track2Weightings.cbus_overall_assessment_weight + track2Weightings.incolink_overall_assessment_weight + track2Weightings.union_relations_overall_weight + track2Weightings.safety_culture_overall_weight,
        fields: [
          { name: 'CBUS Assessment', weight: track2Weightings.cbus_overall_assessment_weight, description: 'Overall CBUS assessment' },
          { name: 'Incolink Assessment', weight: track2Weightings.incolink_overall_assessment_weight, description: 'Overall Incolink assessment' },
          { name: 'Union Relations Assessment', weight: track2Weightings.union_relations_overall_weight, description: 'Overall union relations assessment' },
          { name: 'Safety Culture Assessment', weight: track2Weightings.safety_culture_overall_weight, description: 'Overall safety culture assessment' }
        ]
      },
      {
        category: 'relationship_factors',
        total_weight: track2Weightings.historical_relationship_quality_weight + track2Weightings.eba_status_weight,
        fields: [
          { name: 'Historical Relationship', weight: track2Weightings.historical_relationship_quality_weight, description: 'Historical relationship quality' },
          { name: 'EBA Status', weight: track2Weightings.eba_status_weight, description: 'Current EBA status' }
        ]
      }
    ];
  }
}