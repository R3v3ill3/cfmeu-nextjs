// Weighted Scoring Algorithms - Core scoring logic for the rating calculation engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  ComplianceAssessmentType,
  RatingWeights
} from '../types/RatingTypes';
import {
  WeightedAssessment,
  AssessmentWeight,
  ScoringConfiguration,
  ScoringResult,
  WeightAdjustment,
  ScoringValidationResult
} from '../types/CalculationTypes';

// =============================================================================
// WEIGHTED SCORING INTERFACES
// =============================================================================

export interface IWeightedScoringCalculator {
  calculateWeightedScore(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<ScoringResult>;
  calculateWeightedAverage(
    components: { score: number; weight: number; confidence: number }[],
    config: ScoringConfiguration
  ): Promise<number>;
  calculateWeightedSum(
    components: { score: number; weight: number }[],
    config: ScoringConfiguration
  ): Promise<number>;
  calculateMinimumScore(
    components: { name: string; score: number; is_critical: boolean }[],
    config: ScoringConfiguration
  ): Promise<number>;
  calculateHybridScore(
    baseComponents: { score: number; weight: number }[],
    criticalFactors: { name: string; score: number; weight: number }[],
    config: ScoringConfiguration
  ): Promise<number>;
  validateScoringInputs(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<ScoringValidationResult>;
}

// =============================================================================
// WEIGHTED SCORING IMPLEMENTATION
// =============================================================================

export class WeightedScoringCalculator implements IWeightedScoringCalculator {
  private defaultConfig: ScoringConfiguration;

  constructor(config?: Partial<ScoringConfiguration>) {
    this.defaultConfig = {
      normalize_weights: true,
      max_total_score: 100,
      min_total_score: -100,
      confidence_threshold: 0.5,
      apply_confidence_weighting: true,
      apply_recency_weighting: true,
      apply_severity_weighting: true,
      apply_volume_weighting: false,
      enable_outlier_detection: true,
      outlier_threshold: 2.0,
      smoothing_enabled: false,
      smoothing_factor: 0.1,
      eba_critical_weight: 0.3,
      eba_override_threshold: -20,
      require_minimum_assessments: true,
      minimum_assessment_count: 1,
      validate_weight_distribution: true
    };

    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  // -------------------------------------------------------------------------
  // MAIN CALCULATION METHODS
  // -------------------------------------------------------------------------

  async calculateWeightedScore(
    assessments: WeightedAssessment[],
    config?: Partial<ScoringConfiguration>
  ): Promise<ScoringResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Validate inputs
      const validation = await this.validateScoringInputs(assessments, finalConfig);
      if (!validation.is_valid) {
        throw new WeightedScoringError(
          'VALIDATION_ERROR',
          'Scoring inputs failed validation',
          { validation_errors: validation.errors }
        );
      }

      // Apply preprocessing
      const processedAssessments = await this.preprocessAssessments(assessments, finalConfig);

      // Calculate weighted components
      const components = this.calculateWeightedComponents(processedAssessments, finalConfig);

      // Apply scoring algorithm
      let finalScore: number;
      let methodUsed: string;

      if (this.hasCriticalFactors(components, finalConfig)) {
        finalScore = await this.calculateMinimumScoreWithWeights(components, finalConfig);
        methodUsed = 'minimum_score';
      } else {
        finalScore = await this.calculateWeightedAverageScore(components, finalConfig);
        methodUsed = 'weighted_average';
      }

      // Apply post-processing
      finalScore = this.postProcessScore(finalScore, processedAssessments, finalConfig);

      // Generate breakdown
      const breakdown = this.generateScoringBreakdown(components, finalScore, methodUsed, finalConfig);

      // Apply validation
      const scoreValidation = this.validateFinalScore(finalScore, finalConfig);

      return {
        final_score: finalScore,
        final_rating: this.determineRatingFromScore(finalScore, finalConfig),
        method_used: methodUsed,
        components: components,
        weight_adjustments: this.calculateWeightAdjustments(processedAssessments, finalConfig),
        breakdown: breakdown,
        validation: scoreValidation,
        confidence_level: this.calculateOverallConfidence(components, finalConfig),
        processing_details: {
          assessment_count: processedAssessments.length,
          total_weight: this.calculateTotalWeight(components),
          effective_weight_range: this.calculateWeightRange(components),
          outliers_detected: this.detectOutliers(components, finalConfig).length,
          smoothing_applied: finalConfig.smoothing_enabled
        }
      };

    } catch (error) {
      throw new WeightedScoringError(
        'CALCULATION_ERROR',
        `Weighted scoring calculation failed: ${(error as Error).message}`,
        { assessments_count: assessments.length, config: finalConfig }
      );
    }
  }

  async calculateWeightedAverage(
    components: { score: number; weight: number; confidence: number }[],
    config: ScoringConfiguration
  ): Promise<number> {
    if (components.length === 0) return 0;

    // Apply confidence weighting if enabled
    const weightedComponents = config.apply_confidence_weighting
      ? components.map(c => ({
          ...c,
          effective_weight: c.weight * c.confidence
        }))
      : components.map(c => ({
          ...c,
          effective_weight: c.weight
        }));

    // Calculate total effective weight
    const totalWeight = weightedComponents.reduce((sum, c) => sum + c.effective_weight, 0);

    if (totalWeight === 0) return 0;

    // Calculate weighted average
    const weightedSum = weightedComponents.reduce((sum, c) => sum + (c.score * c.effective_weight), 0);
    let averageScore = weightedSum / totalWeight;

    // Apply smoothing if enabled
    if (config.smoothing_enabled) {
      averageScore = this.applySmoothing(averageScore, components, config.smoothing_factor);
    }

    // Ensure score is within bounds
    return Math.max(config.min_total_score, Math.min(config.max_total_score, averageScore));
  }

  async calculateWeightedSum(
    components: { score: number; weight: number }[],
    config: ScoringConfiguration
  ): Promise<number> {
    if (components.length === 0) return 0;

    // Calculate weighted sum
    const weightedSum = components.reduce((sum, c) => sum + (c.score * c.weight), 0);

    // Normalize to max score if enabled
    let finalScore = weightedSum;
    if (config.normalize_weights) {
      const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight > 0) {
        finalScore = (weightedSum / totalWeight) * (config.max_total_score / 100);
      }
    }

    // Apply smoothing if enabled
    if (config.smoothing_enabled) {
      finalScore = this.applySmoothing(finalScore, components, config.smoothing_factor);
    }

    // Ensure score is within bounds
    return Math.max(config.min_total_score, Math.min(config.max_total_score, finalScore));
  }

  async calculateMinimumScore(
    components: { name: string; score: number; is_critical: boolean }[],
    config: ScoringConfiguration
  ): Promise<number> {
    if (components.length === 0) return 0;

    // Identify critical factors
    const criticalComponents = components.filter(c => c.is_critical);
    const nonCriticalComponents = components.filter(c => !c.is_critical);

    let finalScore: number;

    if (criticalComponents.length > 0) {
      // Use minimum of critical factors
      const criticalScores = criticalComponents.map(c => c.score);
      finalScore = Math.min(...criticalScores);

      // If there are non-critical components and the critical score is not too low,
      // blend in some non-critical influence
      if (nonCriticalComponents.length > 0 && finalScore > -50) {
        const nonCriticalAverage = nonCriticalComponents.reduce((sum, c) => sum + c.score, 0) / nonCriticalComponents.length;
        const blendFactor = 0.3; // 30% non-critical influence
        finalScore = (finalScore * (1 - blendFactor)) + (nonCriticalAverage * blendFactor);
      }
    } else {
      // No critical factors, use average of all components
      finalScore = components.reduce((sum, c) => sum + c.score, 0) / components.length;
    }

    // Apply smoothing if enabled
    if (config.smoothing_enabled) {
      finalScore = this.applySmoothing(finalScore, components, config.smoothing_factor);
    }

    // Ensure score is within bounds
    return Math.max(config.min_total_score, Math.min(config.max_total_score, finalScore));
  }

  async calculateHybridScore(
    baseComponents: { score: number; weight: number }[],
    criticalFactors: { name: string; score: number; weight: number }[],
    config: ScoringConfiguration
  ): Promise<number> {
    // Calculate base score from regular components
    let baseScore = 0;
    let baseWeight = 0;

    if (baseComponents.length > 0) {
      const weightedSum = baseComponents.reduce((sum, c) => sum + (c.score * c.weight), 0);
      baseWeight = baseComponents.reduce((sum, c) => sum + c.weight, 0);
      baseScore = baseWeight > 0 ? weightedSum / baseWeight : 0;
    }

    // Calculate critical score
    let criticalScore = 0;
    let criticalWeight = 0;

    if (criticalFactors.length > 0) {
      const criticalSum = criticalFactors.reduce((sum, c) => sum + (c.score * c.weight), 0);
      criticalWeight = criticalFactors.reduce((sum, c) => sum + c.weight, 0);
      criticalScore = criticalWeight > 0 ? criticalSum / criticalWeight : 0;
    }

    // Apply hybrid weighting
    const criticalWeightRatio = config.eba_critical_weight; // Default 0.3 (30%)
    const baseWeightRatio = 1 - criticalWeightRatio;

    let finalScore: number;

    if (baseWeight > 0 && criticalWeight > 0) {
      // Both base and critical components exist
      finalScore = (baseScore * baseWeightRatio) + (criticalScore * criticalWeightRatio);
    } else if (criticalWeight > 0) {
      // Only critical components (e.g., only EBA data)
      finalScore = criticalScore;
    } else {
      // Only base components
      finalScore = baseScore;
    }

    // Apply special EBA override logic
    if (criticalFactors.some(cf => cf.name.toLowerCase().includes('eba'))) {
      const ebaFactor = criticalFactors.find(cf => cf.name.toLowerCase().includes('eba'));
      if (ebaFactor && ebaFactor.score < config.eba_override_threshold) {
        // EBA is very poor, heavily penalize final score
        finalScore = Math.min(finalScore, ebaFactor.score);
      }
    }

    // Apply smoothing if enabled
    if (config.smoothing_enabled) {
      finalScore = this.applySmoothing(finalScore, [...baseComponents, ...criticalFactors], config.smoothing_factor);
    }

    // Ensure score is within bounds
    return Math.max(config.min_total_score, Math.min(config.max_total_score, finalScore));
  }

  // -------------------------------------------------------------------------
  // VALIDATION METHODS
  // -------------------------------------------------------------------------

  async validateScoringInputs(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<ScoringValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty assessments
    if (assessments.length === 0) {
      errors.push('No assessments provided for scoring');
    }

    // Check minimum assessment count
    if (config.require_minimum_assessments && assessments.length < config.minimum_assessment_count) {
      errors.push(`Insufficient assessments: ${assessments.length} provided, ${config.minimum_assessment_count} required`);
    }

    // Validate assessment data
    for (const assessment of assessments) {
      if (assessment.assessment.score === null || assessment.assessment.score === undefined) {
        warnings.push(`Assessment ${assessment.assessment.id} has no score`);
      }

      if (assessment.effective_weight <= 0) {
        warnings.push(`Assessment ${assessment.assessment.id} has zero or negative weight`);
      }
    }

    // Check weight distribution
    if (config.validate_weight_distribution) {
      const totalWeight = assessments.reduce((sum, a) => sum + a.effective_weight, 0);
      if (totalWeight === 0) {
        errors.push('Total effective weight is zero');
      }

      // Check for extreme weight concentration
      const maxWeight = Math.max(...assessments.map(a => a.effective_weight));
      if (maxWeight / totalWeight > 0.8) {
        warnings.push('Single assessment dominates total weight (>80%)');
      }
    }

    // Validate configuration
    if (config.max_total_score <= config.min_total_score) {
      errors.push('Invalid score range: max_score must be greater than min_score');
    }

    if (config.confidence_threshold < 0 || config.confidence_threshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }

    return {
      is_valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      recommendations: this.generateValidationRecommendations(errors, warnings, assessments, config)
    };
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private async preprocessAssessments(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<WeightedAssessment[]> {
    let processed = [...assessments];

    // Apply outlier detection and removal
    if (config.enable_outlier_detection) {
      processed = this.removeOutliers(processed, config);
    }

    // Apply recency weighting
    if (config.apply_recency_weighting) {
      processed = this.applyRecencyWeighting(processed);
    }

    // Apply severity weighting
    if (config.apply_severity_weighting) {
      processed = this.applySeverityWeighting(processed);
    }

    // Apply volume weighting
    if (config.apply_volume_weighting) {
      processed = this.applyVolumeWeighting(processed);
    }

    return processed;
  }

  private calculateWeightedComponents(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): WeightedAssessment[] {
    return assessments.map(assessment => ({
      ...assessment,
      effective_weight: this.calculateEffectiveWeight(assessment, config)
    }));
  }

  private calculateEffectiveWeight(
    assessment: WeightedAssessment,
    config: ScoringConfiguration
  ): number {
    let effectiveWeight = assessment.weight;

    // Apply confidence weighting
    if (config.apply_confidence_weighting) {
      const confidenceMultiplier = this.getConfidenceMultiplier(assessment.assessment.confidence_level);
      effectiveWeight *= confidenceMultiplier;
    }

    // Normalize if required
    if (config.normalize_weights) {
      const totalWeight = this.calculateTotalWeight([assessment]);
      if (totalWeight > 0) {
        effectiveWeight = effectiveWeight / totalWeight;
      }
    }

    return effectiveWeight;
  }

  private getConfidenceMultiplier(confidenceLevel: ConfidenceLevel): number {
    const multipliers = {
      high: 1.0,
      medium: 0.8,
      low: 0.6,
      very_low: 0.4
    };
    return multipliers[confidenceLevel] || 0.5;
  }

  private hasCriticalFactors(components: WeightedAssessment[], config: ScoringConfiguration): boolean {
    // Check if any assessment type is marked as critical
    return components.some(assessment => {
      const assessmentType = assessment.assessment.assessment_type;
      return this.isCriticalAssessmentType(assessmentType, config);
    });
  }

  private isCriticalAssessmentType(assessmentType: ComplianceAssessmentType, config: ScoringConfiguration): boolean {
    const criticalTypes = ['eca_status', 'safety_incidents', 'industrial_disputes'];
    return criticalTypes.includes(assessmentType);
  }

  private async calculateMinimumScoreWithWeights(
    components: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<number> {
    const criticalComponents = components.filter(c =>
      this.isCriticalAssessmentType(c.assessment.assessment_type, config)
    );
    const nonCriticalComponents = components.filter(c =>
      !this.isCriticalAssessmentType(c.assessment.assessment_type, config)
    );

    if (criticalComponents.length === 0) {
      // No critical factors, use weighted average
      return this.calculateWeightedAverageScore(components, config);
    }

    // Calculate minimum of critical factors
    const criticalScores = criticalComponents.map(c => c.assessment.score || 0);
    const minCriticalScore = Math.min(...criticalScores);

    // If non-critical components exist and critical score isn't too low, blend them
    if (nonCriticalComponents.length > 0 && minCriticalScore > -50) {
      const nonCriticalAverage = nonCriticalComponents.reduce((sum, c) =>
        sum + (c.assessment.score || 0), 0
      ) / nonCriticalComponents.length;

      const blendFactor = 0.2; // 20% non-critical influence
      return (minCriticalScore * (1 - blendFactor)) + (nonCriticalAverage * blendFactor);
    }

    return minCriticalScore;
  }

  private async calculateWeightedAverageScore(
    components: WeightedAssessment[],
    config: ScoringConfiguration
  ): Promise<number> {
    if (components.length === 0) return 0;

    const totalWeight = components.reduce((sum, c) => sum + c.effective_weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = components.reduce((sum, c) =>
      sum + ((c.assessment.score || 0) * c.effective_weight), 0
    );

    return weightedSum / totalWeight;
  }

  private postProcessScore(
    score: number,
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): number {
    let processedScore = score;

    // Apply bounds checking
    processedScore = Math.max(config.min_total_score, Math.min(config.max_total_score, processedScore));

    // Apply rounding
    processedScore = Math.round(processedScore * 10) / 10; // Round to 1 decimal place

    return processedScore;
  }

  private generateScoringBreakdown(
    components: WeightedAssessment[],
    finalScore: number,
    methodUsed: string,
    config: ScoringConfiguration
  ): any {
    const breakdown = {
      total_weighted_score: 0,
      total_effective_weight: 0,
      component_breakdown: [],
      weighting_factors: {},
      calculation_summary: {
        method: methodUsed,
        total_components: components.length,
        config_used: config
      }
    };

    for (const component of components) {
      const contribution = (component.assessment.score || 0) * component.effective_weight;
      breakdown.total_weighted_score += contribution;
      breakdown.total_effective_weight += component.effective_weight;

      breakdown.component_breakdown.push({
        assessment_id: component.assessment.id,
        assessment_type: component.assessment.assessment_type,
        score: component.assessment.score,
        base_weight: component.weight,
        confidence_level: component.assessment.confidence_level,
        effective_weight: component.effective_weight,
        contribution: contribution,
        percentage_of_total: breakdown.total_effective_weight > 0
          ? (component.effective_weight / breakdown.total_effective_weight) * 100
          : 0
      });

      breakdown.weighting_factors[component.assessment.assessment_type] = component.effective_weight;
    }

    return breakdown;
  }

  private calculateWeightAdjustments(
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): WeightAdjustment[] {
    const adjustments: WeightAdjustment[] = [];

    for (const assessment of assessments) {
      const originalWeight = assessment.weight;
      const finalWeight = assessment.effective_weight;

      if (Math.abs(originalWeight - finalWeight) > 0.01) { // Only record significant changes
        adjustments.push({
          assessment_id: assessment.assessment.id,
          original_weight: originalWeight,
          final_weight: finalWeight,
          adjustment_factor: finalWeight / originalWeight,
          reasons: this.determineAdjustmentReasons(assessment, config)
        });
      }
    }

    return adjustments;
  }

  private determineAdjustmentReasons(
    assessment: WeightedAssessment,
    config: ScoringConfiguration
  ): string[] {
    const reasons: string[] = [];

    if (config.apply_confidence_weighting) {
      const confidenceMultiplier = this.getConfidenceMultiplier(assessment.assessment.confidence_level);
      if (confidenceMultiplier !== 1.0) {
        reasons.push(`Confidence adjustment: ${assessment.assessment.confidence_level}`);
      }
    }

    if (config.apply_recency_weighting && assessment.decayed_weight !== assessment.weight) {
      reasons.push('Recency decay applied');
    }

    if (config.apply_severity_weighting && assessment.assessment.severity_level) {
      reasons.push(`Severity level: ${assessment.assessment.severity_level}`);
    }

    return reasons;
  }

  private validateFinalScore(score: number, config: ScoringConfiguration): ScoringValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isNaN(score)) {
      errors.push('Final score is NaN');
    }

    if (!isFinite(score)) {
      errors.push('Final score is infinite');
    }

    if (score < config.min_total_score || score > config.max_total_score) {
      warnings.push(`Final score ${score} is outside expected range [${config.min_total_score}, ${config.max_total_score}]`);
    }

    return {
      is_valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      recommendations: []
    };
  }

  private determineRatingFromScore(score: number, config: ScoringConfiguration): TrafficLightRating {
    // Standard thresholds - could be made configurable
    if (score >= 80) return 'green';
    if (score >= 50) return 'amber';
    if (score >= 0) return 'red';
    return 'unknown';
  }

  private calculateOverallConfidence(
    components: WeightedAssessment[],
    config: ScoringConfiguration
  ): ConfidenceLevel {
    if (components.length === 0) return 'very_low';

    // Calculate weighted average confidence
    const totalWeight = components.reduce((sum, c) => sum + c.effective_weight, 0);
    if (totalWeight === 0) return 'very_low';

    const weightedConfidence = components.reduce((sum, c) => {
      const confidenceValue = this.getConfidenceValue(c.assessment.confidence_level);
      return sum + (confidenceValue * c.effective_weight);
    }, 0);

    const averageConfidence = weightedConfidence / totalWeight;

    // Convert back to confidence level
    if (averageConfidence >= 0.8) return 'high';
    if (averageConfidence >= 0.6) return 'medium';
    if (averageConfidence >= 0.4) return 'low';
    return 'very_low';
  }

  private getConfidenceValue(confidenceLevel: ConfidenceLevel): number {
    const values = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      very_low: 0.3
    };
    return values[confidenceLevel] || 0.5;
  }

  private calculateTotalWeight(components: WeightedAssessment[]): number {
    return components.reduce((sum, c) => sum + c.effective_weight, 0);
  }

  private calculateWeightRange(components: WeightedAssessment[]): { min: number; max: number } {
    if (components.length === 0) return { min: 0, max: 0 };

    const weights = components.map(c => c.effective_weight);
    return {
      min: Math.min(...weights),
      max: Math.max(...weights)
    };
  }

  private detectOutliers(components: WeightedAssessment[], config: ScoringConfiguration): WeightedAssessment[] {
    if (components.length < 3) return []; // Need at least 3 points to detect outliers

    const scores = components.map(c => c.assessment.score || 0);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const outliers = components.filter((c, index) => {
      const zScore = Math.abs((scores[index] - mean) / stdDev);
      return zScore > config.outlier_threshold;
    });

    return outliers;
  }

  private removeOutliers(assessments: WeightedAssessment[], config: ScoringConfiguration): WeightedAssessment[] {
    const outliers = this.detectOutliers(assessments, config);
    const outlierIds = new Set(outliers.map(o => o.assessment.id));

    return assessments.filter(a => !outlierIds.has(a.assessment.id));
  }

  private applyRecencyWeighting(assessments: WeightedAssessment[]): WeightedAssessment[] {
    const now = new Date();
    const halfLifeDays = 180; // 6 months half-life

    return assessments.map(assessment => {
      const assessmentDate = new Date(assessment.assessment.assessment_date);
      const daysOld = (now.getTime() - assessmentDate.getTime()) / (24 * 60 * 60 * 1000);

      // Exponential decay
      const decayFactor = Math.pow(0.5, daysOld / halfLifeDays);
      const adjustedWeight = assessment.effective_weight * Math.max(0.1, decayFactor);

      return {
        ...assessment,
        decayed_weight: adjustedWeight,
        effective_weight: adjustedWeight
      };
    });
  }

  private applySeverityWeighting(assessments: WeightedAssessment[]): WeightedAssessment[] {
    return assessments.map(assessment => {
      let severityMultiplier = 1.0;

      if (assessment.assessment.severity_level) {
        // Higher severity levels get more weight
        switch (assessment.assessment.severity_level) {
          case 5: severityMultiplier = 1.5; break;
          case 4: severityMultiplier = 1.3; break;
          case 3: severityMultiplier = 1.1; break;
          case 2: severityMultiplier = 0.9; break;
          case 1: severityMultiplier = 0.7; break;
          default: severityMultiplier = 1.0;
        }
      }

      return {
        ...assessment,
        effective_weight: assessment.effective_weight * severityMultiplier
      };
    });
  }

  private applyVolumeWeighting(assessments: WeightedAssessment[]): WeightedAssessment[] {
    // Group by assessment type and adjust weights based on volume
    const typeGroups = assessments.reduce((groups, assessment) => {
      const type = assessment.assessment.assessment_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(assessment);
      return groups;
    }, {} as Record<ComplianceAssessmentType, WeightedAssessment[]>);

    return assessments.map(assessment => {
      const type = assessment.assessment.assessment_type;
      const typeGroup = typeGroups[type];
      const volumeMultiplier = Math.min(2.0, 0.5 + (typeGroup.length * 0.1)); // Cap at 2x weight

      return {
        ...assessment,
        effective_weight: assessment.effective_weight * volumeMultiplier
      };
    });
  }

  private applySmoothing(
    score: number,
    components: any[],
    smoothingFactor: number
  ): number {
    if (components.length < 2) return score;

    // Simple moving average smoothing
    const recentScores = components.slice(-5).map(c => c.score || 0); // Last 5 components
    const movingAverage = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;

    return (score * (1 - smoothingFactor)) + (movingAverage * smoothingFactor);
  }

  private generateValidationRecommendations(
    errors: string[],
    warnings: string[],
    assessments: WeightedAssessment[],
    config: ScoringConfiguration
  ): string[] {
    const recommendations: string[] = [];

    if (errors.includes('No assessments provided for scoring')) {
      recommendations.push('Provide assessment data before calculating scores');
    }

    if (errors.some(e => e.includes('Insufficient assessments'))) {
      recommendations.push('Collect more assessment data to improve scoring reliability');
    }

    if (warnings.some(w => w.includes('zero or negative weight'))) {
      recommendations.push('Review assessment weighting configuration');
    }

    if (warnings.some(w => w.includes('dominates total weight'))) {
      recommendations.push('Consider diversifying assessment sources to reduce weight concentration');
    }

    return recommendations;
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class WeightedScoringError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'WeightedScoringError';
    this.code = code;
    this.details = details;
  }
}