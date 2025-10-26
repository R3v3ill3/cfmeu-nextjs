// Confidence Calculation Algorithms - Advanced confidence level calculations for ratings

import {
  ConfidenceLevel,
  ComplianceAssessmentType,
  TrafficLightRating
} from '../types/RatingTypes';
import {
  ConfidenceFactors,
  ConfidenceInput,
  ConfidenceResult,
  ConfidenceCalculationConfig,
  ConfidenceValidationResult,
  TemporalConfidenceData,
  SourceReliabilityScore,
  ConfidenceBreakdown
} from '../types/CalculationTypes';

// =============================================================================
// CONFIDENCE CALCULATION INTERFACES
// =============================================================================

export interface IConfidenceCalculator {
  calculateConfidence(
    inputs: ConfidenceInput[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult>;
  calculateDataConfidence(
    assessmentData: any[],
    assessmentType: ComplianceAssessmentType,
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult>;
  calculateSourceReliability(
    sourceData: any[],
    sourceType: 'project' | 'expertise' | 'eba',
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<SourceReliabilityScore>;
  calculateTemporalConfidence(
    historicalData: TemporalConfidenceData[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult>;
  calculateConsensusConfidence(
    ratings: TrafficLightRating[],
    scores: number[],
    confidences: ConfidenceLevel[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult>;
  validateConfidenceInputs(
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): Promise<ConfidenceValidationResult>;
}

// =============================================================================
// CONFIDENCE CALCULATION CONFIGURATION
// =============================================================================

export interface ConfidenceCalculationConfig {
  // Weighting factors for different confidence components
  recency_weight: number;
  volume_weight: number;
  consistency_weight: number;
  source_quality_weight: number;
  diversity_weight: number;

  // Thresholds
  high_confidence_threshold: number;
  medium_confidence_threshold: number;
  low_confidence_threshold: number;

  // Temporal settings
  recency_half_life_days: number;
  max_data_age_days: number;
  temporal_smoothing_enabled: boolean;
  temporal_smoothing_factor: number;

  // Volume settings
  minimum_assessments_for_high: number;
  minimum_assessments_for_medium: number;
  volume_plateau_threshold: number;

  // Consistency settings
  consistency_window_days: number;
  outlier_detection_enabled: boolean;
  outlier_threshold_std_dev: number;

  // Source quality settings
  expert_weight_modifier: number;
  organiser_reputation_factor: number;
  assessment_quality_threshold: number;

  // Advanced settings
  consensus_bonus_enabled: boolean;
  consensus_bonus_factor: number;
  diversity_bonus_enabled: boolean;
  diversity_penalty_factor: number;
}

// =============================================================================
// CONFIDENCE CALCULATION IMPLEMENTATION
// =============================================================================

export class ConfidenceCalculator implements IConfidenceCalculator {
  private defaultConfig: ConfidenceCalculationConfig;

  constructor(config?: Partial<ConfidenceCalculationConfig>) {
    this.defaultConfig = {
      // Weighting factors
      recency_weight: 0.25,
      volume_weight: 0.25,
      consistency_weight: 0.25,
      source_quality_weight: 0.15,
      diversity_weight: 0.1,

      // Thresholds
      high_confidence_threshold: 0.8,
      medium_confidence_threshold: 0.6,
      low_confidence_threshold: 0.4,

      // Temporal settings
      recency_half_life_days: 90,
      max_data_age_days: 365,
      temporal_smoothing_enabled: true,
      temporal_smoothing_factor: 0.2,

      // Volume settings
      minimum_assessments_for_high: 5,
      minimum_assessments_for_medium: 3,
      volume_plateau_threshold: 10,

      // Consistency settings
      consistency_window_days: 180,
      outlier_detection_enabled: true,
      outlier_threshold_std_dev: 2.0,

      // Source quality settings
      expert_weight_modifier: 1.2,
      organiser_reputation_factor: 0.8,
      assessment_quality_threshold: 0.7,

      // Advanced settings
      consensus_bonus_enabled: true,
      consensus_bonus_factor: 0.1,
      diversity_bonus_enabled: true,
      diversity_penalty_factor: 0.05
    };

    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  // -------------------------------------------------------------------------
  // MAIN CONFIDENCE CALCULATION METHODS
  // -------------------------------------------------------------------------

  async calculateConfidence(
    inputs: ConfidenceInput[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Validate inputs
      const validation = await this.validateConfidenceInputs(inputs, finalConfig);
      if (!validation.is_valid) {
        throw new ConfidenceCalculationError(
          'VALIDATION_ERROR',
          'Confidence calculation inputs failed validation',
          { validation_errors: validation.errors }
        );
      }

      // Calculate individual confidence factors
      const factors = await this.calculateConfidenceFactors(inputs, finalConfig);

      // Calculate weighted confidence score
      const confidenceScore = this.calculateWeightedConfidence(factors, finalConfig);

      // Apply temporal smoothing if enabled
      const smoothedScore = finalConfig.temporal_smoothing_enabled
        ? this.applyTemporalSmoothing(confidenceScore, inputs, finalConfig)
        : confidenceScore;

      // Apply consensus bonus if enabled
      const finalScore = this.applyConsensusBonus(smoothedScore, inputs, finalConfig);

      // Convert to confidence level
      const confidenceLevel = this.scoreToConfidenceLevel(finalScore, finalConfig);

      // Generate breakdown
      const breakdown = this.generateConfidenceBreakdown(factors, finalScore, confidenceLevel, finalConfig);

      return {
        confidence_level: confidenceLevel,
        confidence_score: finalScore,
        confidence_factors: factors,
        breakdown: breakdown,
        validation: validation,
        temporal_trend: this.calculateTemporalTrend(inputs, finalConfig),
        recommendations: this.generateConfidenceRecommendations(finalScore, factors, finalConfig),
        metadata: {
          input_count: inputs.length,
          calculation_timestamp: new Date(),
          config_used: finalConfig,
          processing_time_ms: 0 // Would be measured in real implementation
        }
      };

    } catch (error) {
      throw new ConfidenceCalculationError(
        'CALCULATION_ERROR',
        `Confidence calculation failed: ${(error as Error).message}`,
        { inputs_count: inputs.length, config: finalConfig }
      );
    }
  }

  async calculateDataConfidence(
    assessmentData: any[],
    assessmentType: ComplianceAssessmentType,
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Convert assessment data to confidence inputs
    const inputs: ConfidenceInput[] = assessmentData.map(assessment => ({
      source_id: assessment.id,
      source_type: 'project' as const,
      assessment_type: assessmentType,
      confidence_level: assessment.confidence_level || 'medium',
      assessment_date: new Date(assessment.assessment_date),
      score: assessment.score || 0,
      weight: 1.0,
      quality_score: this.assessAssessmentQuality(assessment),
      source_reliability: 0.8 // Default reliability
    }));

    return this.calculateConfidence(inputs, finalConfig);
  }

  async calculateSourceReliability(
    sourceData: any[],
    sourceType: 'project' | 'expertise' | 'eba',
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<SourceReliabilityScore> {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Calculate base reliability
    let baseReliability = 0.5; // Default reliability

    switch (sourceType) {
      case 'project':
        baseReliability = this.calculateProjectSourceReliability(sourceData, finalConfig);
        break;
      case 'expertise':
        baseReliability = this.calculateExpertiseSourceReliability(sourceData, finalConfig);
        break;
      case 'eba':
        baseReliability = this.calculateEBASourceReliability(sourceData, finalConfig);
        break;
    }

    // Calculate reliability factors
    const factors = this.calculateReliabilityFactors(sourceData, sourceType, finalConfig);

    // Apply adjustments
    const adjustedReliability = this.applyReliabilityAdjustments(baseReliability, factors, finalConfig);

    // Determine reliability tier
    const reliabilityTier = this.determineReliabilityTier(adjustedReliability, finalConfig);

    return {
      reliability_score: adjustedReliability,
      reliability_tier: reliabilityTier,
      factors: factors,
      source_type: sourceType,
      data_points: sourceData.length,
      calculation_timestamp: new Date(),
      confidence_level: this.scoreToConfidenceLevel(adjustedReliability, finalConfig)
    };
  }

  async calculateTemporalConfidence(
    historicalData: TemporalConfidenceData[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (historicalData.length === 0) {
      return this.createEmptyConfidenceResult('No historical data available');
    }

    // Sort by date
    const sortedData = historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate temporal factors
    const recencyFactor = this.calculateTemporalRecencyFactor(sortedData, finalConfig);
    const consistencyFactor = this.calculateTemporalConsistencyFactor(sortedData, finalConfig);
    const trendFactor = this.calculateTemporalTrendFactor(sortedData, finalConfig);

    // Combine factors
    const factors: ConfidenceFactors = {
      recency_confidence: recencyFactor,
      volume_confidence: this.calculateVolumeConfidence(historicalData.length, finalConfig),
      consistency_confidence: consistencyFactor,
      source_quality_confidence: 0.8, // Default for historical data
      diversity_confidence: this.calculateHistoricalDiversityFactor(sortedData, finalConfig)
    };

    // Calculate weighted score
    const confidenceScore = this.calculateWeightedConfidence(factors, finalConfig);

    return {
      confidence_level: this.scoreToConfidenceLevel(confidenceScore, finalConfig),
      confidence_score: confidenceScore,
      confidence_factors: factors,
      breakdown: this.generateTemporalBreakdown(factors, sortedData, finalConfig),
      validation: { is_valid: true, errors: [], warnings: [], recommendations: [] },
      temporal_trend: this.calculateTemporalTrend(sortedData, finalConfig),
      recommendations: this.generateTemporalRecommendations(confidenceScore, factors, finalConfig),
      metadata: {
        input_count: historicalData.length,
        calculation_timestamp: new Date(),
        config_used: finalConfig,
        processing_time_ms: 0
      }
    };
  }

  async calculateConsensusConfidence(
    ratings: TrafficLightRating[],
    scores: number[],
    confidences: ConfidenceLevel[],
    config?: Partial<ConfidenceCalculationConfig>
  ): Promise<ConfidenceResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (ratings.length === 0) {
      return this.createEmptyConfidenceResult('No consensus data available');
    }

    // Calculate consensus factors
    const ratingAgreement = this.calculateRatingAgreement(ratings);
    const scoreVariance = this.calculateScoreVariance(scores);
    const confidenceAlignment = this.calculateConfidenceAlignment(confidences);

    // Convert to confidence scores
    const agreementScore = this.ratingAgreementToScore(ratingAgreement);
    const varianceScore = this.varianceToConfidenceScore(scoreVariance, finalConfig);
    const alignmentScore = this.confidenceAlignmentToScore(confidenceAlignment);

    // Create factors
    const factors: ConfidenceFactors = {
      recency_confidence: 0.8, // Not applicable for consensus
      volume_confidence: this.calculateVolumeConfidence(ratings.length, finalConfig),
      consistency_confidence: (agreementScore + varianceScore) / 2,
      source_quality_confidence: alignmentScore,
      diversity_confidence: this.calculateConsensusDiversityScore(ratings, scores)
    };

    // Calculate weighted score
    const confidenceScore = this.calculateWeightedConfidence(factors, finalConfig);

    // Apply consensus bonus if high agreement
    const finalScore = ratingAgreement > 0.8 && finalConfig.consensus_bonus_enabled
      ? Math.min(1.0, confidenceScore + finalConfig.consensus_bonus_factor)
      : confidenceScore;

    return {
      confidence_level: this.scoreToConfidenceLevel(finalScore, finalConfig),
      confidence_score: finalScore,
      confidence_factors: factors,
      breakdown: this.generateConsensusBreakdown(factors, ratings, scores, confidences, finalConfig),
      validation: { is_valid: true, errors: [], warnings: [], recommendations: [] },
      temporal_trend: 'stable',
      recommendations: this.generateConsensusRecommendations(finalScore, ratingAgreement, finalConfig),
      metadata: {
        input_count: ratings.length,
        calculation_timestamp: new Date(),
        config_used: finalConfig,
        processing_time_ms: 0
      }
    };
  }

  // -------------------------------------------------------------------------
  // VALIDATION METHODS
  // -------------------------------------------------------------------------

  async validateConfidenceInputs(
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): Promise<ConfidenceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty inputs
    if (inputs.length === 0) {
      errors.push('No confidence inputs provided');
    }

    // Validate each input
    for (const input of inputs) {
      if (!input.source_id) {
        errors.push(`Input missing source_id`);
      }

      if (!input.assessment_date) {
        errors.push(`Input ${input.source_id} missing assessment_date`);
      }

      if (!input.confidence_level) {
        warnings.push(`Input ${input.source_id} missing confidence_level, using default`);
      }

      if (input.score === null || input.score === undefined) {
        warnings.push(`Input ${input.source_id} missing score`);
      }

      if (input.weight <= 0) {
        warnings.push(`Input ${input.source_id} has non-positive weight`);
      }
    }

    // Validate configuration
    if (config.high_confidence_threshold <= config.medium_confidence_threshold) {
      errors.push('High confidence threshold must be greater than medium threshold');
    }

    if (config.medium_confidence_threshold <= config.low_confidence_threshold) {
      errors.push('Medium confidence threshold must be greater than low threshold');
    }

    const totalWeight = config.recency_weight + config.volume_weight +
                      config.consistency_weight + config.source_quality_weight +
                      config.diversity_weight;

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      warnings.push(`Confidence weights sum to ${totalWeight.toFixed(3)}, should sum to 1.0`);
    }

    return {
      is_valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      recommendations: this.generateValidationRecommendations(errors, warnings, inputs, config)
    };
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private async calculateConfidenceFactors(
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): Promise<ConfidenceFactors> {
    const factors: ConfidenceFactors = {
      recency_confidence: this.calculateRecencyConfidence(inputs, config),
      volume_confidence: this.calculateVolumeConfidence(inputs.length, config),
      consistency_confidence: this.calculateConsistencyConfidence(inputs, config),
      source_quality_confidence: this.calculateSourceQualityConfidence(inputs, config),
      diversity_confidence: this.calculateDiversityConfidence(inputs, config)
    };

    return factors;
  }

  private calculateRecencyConfidence(inputs: ConfidenceInput[], config: ConfidenceCalculationConfig): number {
    if (inputs.length === 0) return 0;

    const now = new Date();
    let totalRecencyScore = 0;
    let totalWeight = 0;

    for (const input of inputs) {
      const daysOld = (now.getTime() - input.assessment_date.getTime()) / (24 * 60 * 60 * 1000);

      // Exponential decay based on half-life
      let recencyScore = Math.pow(0.5, daysOld / config.recency_half_life_days);

      // Apply maximum age penalty
      if (daysOld > config.max_data_age_days) {
        recencyScore *= 0.5;
      }

      totalRecencyScore += recencyScore * input.weight;
      totalWeight += input.weight;
    }

    return totalWeight > 0 ? totalRecencyScore / totalWeight : 0;
  }

  private calculateVolumeConfidence(assessmentCount: number, config: ConfidenceCalculationConfig): number {
    if (assessmentCount >= config.minimum_assessments_for_high) {
      return 1.0;
    } else if (assessmentCount >= config.minimum_assessments_for_medium) {
      // Linear interpolation between medium and high
      const ratio = (assessmentCount - config.minimum_assessments_for_medium) /
                    (config.minimum_assessments_for_high - config.minimum_assessments_for_medium);
      return 0.6 + (ratio * 0.4); // From 0.6 to 1.0
    } else if (assessmentCount > 0) {
      // Linear interpolation from low to medium
      const ratio = assessmentCount / config.minimum_assessments_for_medium;
      return 0.3 + (ratio * 0.3); // From 0.3 to 0.6
    } else {
      return 0.0;
    }
  }

  private calculateConsistencyConfidence(inputs: ConfidenceInput[], config: ConfidenceCalculationConfig): number {
    if (inputs.length < 2) return 0.5; // Cannot measure consistency with single data point

    // Group by assessment type
    const typeGroups = this.groupByAssessmentType(inputs);
    let consistencyScores: number[] = [];

    for (const [type, typeInputs] of Object.entries(typeGroups)) {
      if (typeInputs.length >= 2) {
        const scores = typeInputs.map(input => input.score).filter(s => s !== null && s !== undefined);
        if (scores.length >= 2) {
          const variance = this.calculateVariance(scores);
          const consistency = Math.max(0, 1 - (variance / 100)); // Normalize variance
          consistencyScores.push(consistency);
        }
      }
    }

    if (consistencyScores.length === 0) return 0.5;

    // Apply outlier detection if enabled
    if (config.outlier_detection_enabled) {
      consistencyScores = this.removeOutliers(consistencyScores, config.outlier_threshold_std_dev);
    }

    // Return average consistency
    return consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;
  }

  private calculateSourceQualityConfidence(inputs: ConfidenceInput[], config: ConfidenceCalculationConfig): number {
    if (inputs.length === 0) return 0;

    let totalQualityScore = 0;
    let totalWeight = 0;

    for (const input of inputs) {
      let qualityScore = input.quality_score || 0.5;

      // Apply expert weight modifier for expertise sources
      if (input.source_type === 'expertise') {
        qualityScore *= config.expert_weight_modifier;
      }

      // Apply organiser reputation factor if available
      if (input.organiser_reputation) {
        qualityScore *= (1 + (input.organiser_reputation - 0.5) * config.organiser_reputation_factor);
      }

      totalQualityScore += qualityScore * input.weight;
      totalWeight += input.weight;
    }

    return totalWeight > 0 ? Math.min(1.0, totalQualityScore / totalWeight) : 0;
  }

  private calculateDiversityConfidence(inputs: ConfidenceInput[], config: ConfidenceCalculationConfig): number {
    if (inputs.length === 0) return 0;

    // Calculate source type diversity
    const sourceTypes = new Set(inputs.map(input => input.source_type));
    const sourceTypeScore = Math.min(1.0, sourceTypes.size / 3); // Max 3 source types

    // Calculate assessment type diversity
    const assessmentTypes = new Set(inputs.map(input => input.assessment_type));
    const assessmentTypeScore = Math.min(1.0, assessmentTypes.size / 5); // Max 5 assessment types

    // Calculate temporal diversity (spread across time)
    const dates = inputs.map(input => input.assessment_date.getTime());
    const timeSpan = Math.max(...dates) - Math.min(...dates);
    const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
    const temporalScore = Math.min(1.0, daysSpan / 180); // Max score for 6 months span

    // Combine diversity factors
    const overallDiversity = (sourceTypeScore * 0.4) + (assessmentTypeScore * 0.3) + (temporalScore * 0.3);

    return overallDiversity;
  }

  private calculateWeightedConfidence(factors: ConfidenceFactors, config: ConfidenceCalculationConfig): number {
    return (
      (factors.recency_confidence * config.recency_weight) +
      (factors.volume_confidence * config.volume_weight) +
      (factors.consistency_confidence * config.consistency_weight) +
      (factors.source_quality_confidence * config.source_quality_weight) +
      (factors.diversity_confidence * config.diversity_weight)
    );
  }

  private applyTemporalSmoothing(
    confidenceScore: number,
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): number {
    if (inputs.length < 2) return confidenceScore;

    // Calculate recent trend
    const sortedInputs = inputs.sort((a, b) => a.assessment_date.getTime() - b.assessment_date.getTime());
    const recentInputs = sortedInputs.slice(-3); // Last 3 inputs

    if (recentInputs.length < 2) return confidenceScore;

    const recentScores = recentInputs.map(input => this.inputToConfidenceScore(input));
    const recentAverage = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;

    // Apply smoothing
    return (confidenceScore * (1 - config.temporal_smoothing_factor)) +
           (recentAverage * config.temporal_smoothing_factor);
  }

  private applyConsensusBonus(
    confidenceScore: number,
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): number {
    if (!config.consensus_bonus_enabled || inputs.length < 2) return confidenceScore;

    // Check for rating consensus
    const ratings = inputs.map(input => this.scoreToRating(input.score));
    const agreement = this.calculateRatingAgreement(ratings);

    if (agreement > 0.8) {
      return Math.min(1.0, confidenceScore + config.consensus_bonus_factor);
    }

    return confidenceScore;
  }

  private scoreToConfidenceLevel(score: number, config: ConfidenceCalculationConfig): ConfidenceLevel {
    if (score >= config.high_confidence_threshold) return 'high';
    if (score >= config.medium_confidence_threshold) return 'medium';
    if (score >= config.low_confidence_threshold) return 'low';
    return 'very_low';
  }

  private scoreToRating(score: number): TrafficLightRating {
    if (score >= 80) return 'green';
    if (score >= 50) return 'amber';
    if (score >= 0) return 'red';
    return 'unknown';
  }

  private inputToConfidenceScore(input: ConfidenceInput): number {
    const confidenceMap = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      very_low: 0.3
    };
    return confidenceMap[input.confidence_level] || 0.5;
  }

  // -------------------------------------------------------------------------
  // SOURCE RELIABILITY CALCULATIONS
  // -------------------------------------------------------------------------

  private calculateProjectSourceReliability(sourceData: any[], config: ConfidenceCalculationConfig): number {
    if (sourceData.length === 0) return 0.5;

    // Project reliability based on data volume, consistency, and recency
    const volumeScore = Math.min(1.0, sourceData.length / 5); // Cap at 5 assessments
    const recencyScore = this.calculateRecencyConfidence(
      sourceData.map(data => ({
        source_id: data.id,
        source_type: 'project' as const,
        assessment_type: data.assessment_type,
        confidence_level: data.confidence_level || 'medium',
        assessment_date: new Date(data.assessment_date),
        score: data.score || 0,
        weight: 1.0,
        quality_score: this.assessAssessmentQuality(data),
        source_reliability: 0.8
      })),
      config
    );

    return (volumeScore * 0.4) + (recencyScore * 0.6);
  }

  private calculateExpertiseSourceReliability(sourceData: any[], config: ConfidenceCalculationConfig): number {
    if (sourceData.length === 0) return 0.5;

    // Expertise reliability based on organiser reputation, assessment quality, and consistency
    let reputationScore = 0.7; // Default
    let qualityScore = 0.7; // Default

    for (const data of sourceData) {
      if (data.organiser_reputation) {
        reputationScore = Math.max(reputationScore, data.organiser_reputation);
      }
      qualityScore += this.assessAssessmentQuality(data);
    }

    qualityScore = qualityScore / sourceData.length;

    return (reputationScore * 0.5) + (qualityScore * 0.5);
  }

  private calculateEBASourceReliability(sourceData: any[], config: ConfidenceCalculationConfig): number {
    if (sourceData.length === 0) return 0.3; // Low reliability for no EBA data

    // EBA reliability based on status, recency, and completeness
    let reliabilityScore = 0.8; // Base reliability for EBA data

    for (const data of sourceData) {
      // Check if EBA is active
      if (data.status === 'active') {
        reliabilityScore = 0.9;
      } else if (data.status === 'expired') {
        reliabilityScore = 0.6;
      }

      // Adjust for recency
      const daysOld = (Date.now() - new Date(data.certified_date).getTime()) / (24 * 60 * 60 * 1000);
      if (daysOld > 1460) { // 4 years
        reliabilityScore *= 0.7;
      }
    }

    return reliabilityScore;
  }

  private calculateReliabilityFactors(
    sourceData: any[],
    sourceType: string,
    config: ConfidenceCalculationConfig
  ): any[] {
    const factors = [];

    // Volume factor
    factors.push({
      factor: 'data_volume',
      score: Math.min(1.0, sourceData.length / 5),
      weight: 0.3,
      description: `Number of ${sourceType} assessments`
    });

    // Recency factor
    const recencyScore = this.calculateAverageRecency(sourceData);
    factors.push({
      factor: 'data_recency',
      score: recencyScore,
      weight: 0.4,
      description: 'Average recency of data'
    });

    // Quality factor
    const qualityScore = this.calculateAverageQuality(sourceData);
    factors.push({
      factor: 'data_quality',
      score: qualityScore,
      weight: 0.3,
      description: 'Average quality of assessments'
    });

    return factors;
  }

  private applyReliabilityAdjustments(
    baseReliability: number,
    factors: any[],
    config: ConfidenceCalculationConfig
  ): number {
    let adjustedReliability = baseReliability;

    for (const factor of factors) {
      adjustedReliability = (adjustedReliability * (1 - factor.weight)) + (factor.score * factor.weight);
    }

    return Math.min(1.0, Math.max(0.0, adjustedReliability));
  }

  private determineReliabilityTier(reliability: number, config: ConfidenceCalculationConfig): string {
    if (reliability >= config.high_confidence_threshold) return 'high';
    if (reliability >= config.medium_confidence_threshold) return 'medium';
    if (reliability >= config.low_confidence_threshold) return 'low';
    return 'very_low';
  }

  // -------------------------------------------------------------------------
  // CONSENSUS CALCULATIONS
  // -------------------------------------------------------------------------

  private calculateRatingAgreement(ratings: TrafficLightRating[]): number {
    if (ratings.length === 0) return 0;

    const ratingCounts = ratings.reduce((counts, rating) => {
      counts[rating] = (counts[rating] || 0) + 1;
      return counts;
    }, {} as Record<TrafficLightRating, number>);

    const mostCommonRating = Object.entries(ratingCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return mostCommonRating ? mostCommonRating[1] / ratings.length : 0;
  }

  private calculateScoreVariance(scores: number[]): number {
    if (scores.length === 0) return 0;

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    return variance;
  }

  private calculateConfidenceAlignment(confidences: ConfidenceLevel[]): number {
    if (confidences.length === 0) return 0;

    const confidenceValues = confidences.map(c => this.confidenceLevelToScore(c));
    const mean = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;

    const variance = confidenceValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / confidenceValues.length;

    // Lower variance = higher alignment
    return Math.max(0, 1 - (variance / 0.25)); // Normalize by max possible variance
  }

  private confidenceLevelToScore(confidence: ConfidenceLevel): number {
    const scores = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      very_low: 0.3
    };
    return scores[confidence] || 0.5;
  }

  private ratingAgreementToScore(agreement: number): number {
    // Convert agreement percentage to confidence score
    return Math.max(0.3, agreement); // Minimum 0.3 confidence
  }

  private varianceToConfidenceScore(variance: number, config: ConfidenceCalculationConfig): number {
    // Lower variance = higher confidence
    const maxVariance = 2500; // Maximum expected variance (score range -100 to 100)
    const normalizedVariance = Math.min(1.0, variance / maxVariance);
    return Math.max(0.3, 1.0 - normalizedVariance);
  }

  private confidenceAlignmentToScore(alignment: number): number {
    return alignment; // Already normalized 0-1
  }

  private calculateConsensusDiversityScore(ratings: TrafficLightRating[], scores: number[]): number {
    const ratingDiversity = new Set(ratings).size / 4; // 4 possible ratings
    const scoreRange = Math.max(...scores) - Math.min(...scores);
    const normalizedRange = Math.min(1.0, scoreRange / 100); // Normalize by score range

    return (ratingDiversity * 0.5) + (normalizedRange * 0.5);
  }

  // -------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------

  private groupByAssessmentType(inputs: ConfidenceInput[]): Record<ComplianceAssessmentType, ConfidenceInput[]> {
    return inputs.reduce((groups, input) => {
      const type = input.assessment_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(input);
      return groups;
    }, {} as Record<ComplianceAssessmentType, ConfidenceInput[]>);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  private removeOutliers(values: number[], thresholdStdDev: number): number[] {
    if (values.length < 3) return values;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const stdDev = Math.sqrt(this.calculateVariance(values));

    return values.filter(value => {
      const zScore = Math.abs((value - mean) / stdDev);
      return zScore <= thresholdStdDev;
    });
  }

  private assessAssessmentQuality(assessment: any): number {
    let qualityScore = 0.5; // Base quality

    // Check for detailed notes
    if (assessment.assessment_notes && assessment.assessment_notes.length > 50) {
      qualityScore += 0.2;
    }

    // Check for evidence
    if (assessment.evidence_attachments && assessment.evidence_attachments.length > 0) {
      qualityScore += 0.2;
    }

    // Check for follow-up requirements (indicates thoroughness)
    if (assessment.follow_up_required) {
      qualityScore += 0.1;
    }

    return Math.min(1.0, qualityScore);
  }

  private calculateAverageRecency(data: any[]): number {
    if (data.length === 0) return 0;

    const now = Date.now();
    const totalAge = data.reduce((sum, item) => {
      const age = (now - new Date(item.assessment_date).getTime()) / (24 * 60 * 60 * 1000);
      return sum + age;
    }, 0);

    const averageAge = totalAge / data.length;
    return Math.max(0, 1 - (averageAge / 365)); // Normalize by year
  }

  private calculateAverageQuality(data: any[]): number {
    if (data.length === 0) return 0.5;

    const totalQuality = data.reduce((sum, item) => sum + this.assessAssessmentQuality(item), 0);
    return totalQuality / data.length;
  }

  private createEmptyConfidenceResult(message: string): ConfidenceResult {
    return {
      confidence_level: 'very_low',
      confidence_score: 0,
      confidence_factors: {
        recency_confidence: 0,
        volume_confidence: 0,
        consistency_confidence: 0,
        source_quality_confidence: 0,
        diversity_confidence: 0
      },
      breakdown: {},
      validation: {
        is_valid: false,
        errors: [message],
        warnings: [],
        recommendations: []
      },
      temporal_trend: 'stable',
      recommendations: [],
      metadata: {
        input_count: 0,
        calculation_timestamp: new Date(),
        config_used: this.defaultConfig,
        processing_time_ms: 0
      }
    };
  }

  private generateConfidenceBreakdown(
    factors: ConfidenceFactors,
    finalScore: number,
    confidenceLevel: ConfidenceLevel,
    config: ConfidenceCalculationConfig
  ): ConfidenceBreakdown {
    return {
      component_scores: {
        recency: {
          score: factors.recency_confidence,
          weight: config.recency_weight,
          contribution: factors.recency_confidence * config.recency_weight
        },
        volume: {
          score: factors.volume_confidence,
          weight: config.volume_weight,
          contribution: factors.volume_confidence * config.volume_weight
        },
        consistency: {
          score: factors.consistency_confidence,
          weight: config.consistency_weight,
          contribution: factors.consistency_confidence * config.consistency_weight
        },
        source_quality: {
          score: factors.source_quality_confidence,
          weight: config.source_quality_weight,
          contribution: factors.source_quality_confidence * config.source_quality_weight
        },
        diversity: {
          score: factors.diversity_confidence,
          weight: config.diversity_weight,
          contribution: factors.diversity_confidence * config.diversity_weight
        }
      },
      final_score: finalScore,
      confidence_level: confidenceLevel,
      threshold_comparison: {
        high_threshold: config.high_confidence_threshold,
        medium_threshold: config.medium_confidence_threshold,
        low_threshold: config.low_confidence_threshold,
        distance_from_threshold: this.calculateDistanceFromThreshold(finalScore, confidenceLevel, config)
      }
    };
  }

  private calculateDistanceFromThreshold(
    score: number,
    level: ConfidenceLevel,
    config: ConfidenceCalculationConfig
  ): number {
    switch (level) {
      case 'high':
        return score - config.high_confidence_threshold;
      case 'medium':
        return score - config.medium_confidence_threshold;
      case 'low':
        return score - config.low_confidence_threshold;
      case 'very_low':
        return score - config.low_confidence_threshold;
      default:
        return 0;
    }
  }

  private calculateTemporalTrend(inputs: ConfidenceInput[], config: ConfidenceCalculationConfig): 'improving' | 'stable' | 'declining' {
    if (inputs.length < 3) return 'stable';

    const sortedInputs = inputs.sort((a, b) => a.assessment_date.getTime() - b.assessment_date.getTime());
    const recentScores = sortedInputs.slice(-5).map(input => this.inputToConfidenceScore(input));

    if (recentScores.length < 2) return 'stable';

    const trend = this.calculateLinearTrend(recentScores);

    if (trend > 0.05) return 'improving';
    if (trend < -0.05) return 'declining';
    return 'stable';
  }

  private calculateLinearTrend(scores: number[]): number {
    if (scores.length < 2) return 0;

    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = scores.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + (val * scores[i]), 0);
    const sumXX = x.reduce((sum, val) => sum + (val * val), 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private generateConfidenceRecommendations(
    finalScore: number,
    factors: ConfidenceFactors,
    config: ConfidenceCalculationConfig
  ): string[] {
    const recommendations: string[] = [];

    if (finalScore < config.high_confidence_threshold) {
      if (factors.volume_confidence < 0.7) {
        recommendations.push('Collect more assessment data to improve volume confidence');
      }

      if (factors.recency_confidence < 0.7) {
        recommendations.push('Conduct more recent assessments to improve recency confidence');
      }

      if (factors.consistency_confidence < 0.7) {
        recommendations.push('Review assessment methodology to improve consistency');
      }

      if (factors.source_quality_confidence < 0.7) {
        recommendations.push('Improve assessment quality and documentation');
      }

      if (factors.diversity_confidence < 0.7) {
        recommendations.push('Diversify assessment sources and types');
      }
    }

    return recommendations;
  }

  private generateValidationRecommendations(
    errors: string[],
    warnings: string[],
    inputs: ConfidenceInput[],
    config: ConfidenceCalculationConfig
  ): string[] {
    const recommendations: string[] = [];

    if (errors.includes('No confidence inputs provided')) {
      recommendations.push('Provide assessment data before calculating confidence');
    }

    if (warnings.some(w => w.includes('missing'))) {
      recommendations.push('Complete all required assessment fields');
    }

    if (warnings.some(w => w.includes('non-positive weight'))) {
      recommendations.push('Review and correct assessment weightings');
    }

    return recommendations;
  }

  // Additional placeholder methods for temporal and consensus breakdowns
  private generateTemporalBreakdown(factors: ConfidenceFactors, data: any[], config: ConfidenceCalculationConfig): any {
    return {
      temporal_analysis: 'Temporal confidence breakdown would be implemented here',
      factors: factors
    };
  }

  private generateConsensusBreakdown(
    factors: ConfidenceFactors,
    ratings: TrafficLightRating[],
    scores: number[],
    confidences: ConfidenceLevel[],
    config: ConfidenceCalculationConfig
  ): any {
    return {
      consensus_analysis: 'Consensus confidence breakdown would be implemented here',
      agreement_details: {
        rating_distribution: this.calculateRatingDistribution(ratings),
        score_statistics: this.calculateScoreStatistics(scores),
        confidence_distribution: this.calculateConfidenceDistribution(confidences)
      },
      factors: factors
    };
  }

  private calculateRatingDistribution(ratings: TrafficLightRating[]): Record<TrafficLightRating, number> {
    return ratings.reduce((dist, rating) => {
      dist[rating] = (dist[rating] || 0) + 1;
      return dist;
    }, {} as Record<TrafficLightRating, number>);
  }

  private calculateScoreStatistics(scores: number[]): { mean: number; variance: number; min: number; max: number } {
    if (scores.length === 0) return { mean: 0, variance: 0, min: 0, max: 0 };

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return { mean, variance, min, max };
  }

  private calculateConfidenceDistribution(confidences: ConfidenceLevel[]): Record<ConfidenceLevel, number> {
    return confidences.reduce((dist, confidence) => {
      dist[confidence] = (dist[confidence] || 0) + 1;
      return dist;
    }, {} as Record<ConfidenceLevel, number>);
  }

  private calculateTemporalRecencyFactor(data: TemporalConfidenceData[], config: ConfidenceCalculationConfig): number {
    // Implementation for temporal recency factor calculation
    return 0.8; // Placeholder
  }

  private calculateTemporalConsistencyFactor(data: TemporalConfidenceData[], config: ConfidenceCalculationConfig): number {
    // Implementation for temporal consistency factor calculation
    return 0.8; // Placeholder
  }

  private calculateTemporalTrendFactor(data: TemporalConfidenceData[], config: ConfidenceCalculationConfig): number {
    // Implementation for temporal trend factor calculation
    return 0.8; // Placeholder
  }

  private calculateHistoricalDiversityFactor(data: TemporalConfidenceData[], config: ConfidenceCalculationConfig): number {
    // Implementation for historical diversity factor calculation
    return 0.8; // Placeholder
  }

  private generateTemporalRecommendations(score: number, factors: ConfidenceFactors, config: ConfidenceCalculationConfig): string[] {
    // Implementation for temporal recommendations
    return []; // Placeholder
  }

  private generateConsensusRecommendations(score: number, agreement: number, config: ConfidenceCalculationConfig): string[] {
    // Implementation for consensus recommendations
    return []; // Placeholder
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class ConfidenceCalculationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ConfidenceCalculationError';
    this.code = code;
    this.details = details;
  }
}