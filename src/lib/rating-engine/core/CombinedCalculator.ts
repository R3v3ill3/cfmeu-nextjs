// Combined Calculator - Intelligent reconciliation between project data and organiser expertise

import {
  TrafficLightRating,
  ConfidenceLevel,
  FinalRatingResult,
  ProjectRatingResult,
  ExpertiseRatingResult,
  EBARatingResult,
  RatingWeights,
  CalculationMethod
} from '../types/RatingTypes';
import {
  CalculationContext,
  DiscrepancyCheck,
  DiscrepancyLevel,
  ReconciliationInput,
  ReconciliationOutput,
  CalculationConfig,
  RatingCalculationError
} from '../types/CalculationTypes';
import { DiscrepancyAnalysisResult, ReconciliationDetails } from '../types/ResultTypes';

// =============================================================================
// COMBINED CALCULATOR INTERFACE
// =============================================================================

export interface ICombinedCalculator {
  calculateFinalRating(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<FinalRatingResult>;
  detectDiscrepancies(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): Promise<DiscrepancyCheck>;
  reconcileRatings(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<ReconciliationOutput>;
}

// =============================================================================
// COMBINED CALCULATOR IMPLEMENTATION
// =============================================================================

export class CombinedCalculator implements ICombinedCalculator {
  private config: CalculationConfig;

  constructor(config: CalculationConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // MAIN CALCULATION METHOD
// -------------------------------------------------------------------------

  async calculateFinalRating(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<FinalRatingResult> {
    const startTime = Date.now();

    try {
      // Detect discrepancies between project and expertise data
      const discrepancyCheck = await this.detectDiscrepancies(projectResult, expertiseResult);

      // Perform reconciliation if needed
      const reconciliationOutput = await this.reconcileRatings(
        projectResult,
        expertiseResult,
        ebaResult,
        context
      );

      // Calculate final score and rating
      const { finalScore, finalRating } = this.calculateFinalScoreAndRating(
        projectResult,
        expertiseResult,
        ebaResult,
        context,
        reconciliationOutput
      );

      // Calculate overall confidence level
      const overallConfidence = this.calculateOverallConfidence(
        projectResult,
        expertiseResult,
        ebaResult,
        reconciliationOutput
      );

      // Calculate data completeness
      const dataCompleteness = this.calculateDataCompleteness(
        projectResult,
        expertiseResult,
        ebaResult
      );

      // Determine review requirements
      const reviewRequirements = this.determineReviewRequirements(
        discrepancyCheck,
        overallConfidence,
        dataCompleteness
      );

      // Create final result
      const result: FinalRatingResult = {
        employer_id: context.employer_id,
        calculation_date: context.calculation_date,
        final_rating: finalRating,
        final_score: finalScore,
        overall_confidence: overallConfidence,
        data_completeness: dataCompleteness,

        // Component results
        project_data: projectResult,
        expertise_data: expertiseResult,
        eba_data: ebaResult,

        // Discrepancy and reconciliation
        discrepancy_check: discrepancyCheck,
        reconciliation_applied: reconciliationOutput.reconciliation_applied,
        reconciliation_details: this.createReconciliationDetails(
          reconciliationOutput,
          context,
          discrepancyCheck
        ),

        // Calculation metadata
        calculation_method: context.method,
        weights: context.weights,
        algorithm_type: context.method,
        method_config: this.getMethodConfig(context.method),

        // Review and status
        review_required: reviewRequirements.required,
        review_reason: reviewRequirements.reason,
        next_review_date: reviewRequirements.nextReviewDate,
        expiry_date: this.calculateExpiryDate(context.calculation_date, overallConfidence),
        rating_status: 'active',

        // Performance and debugging
        performance: {
          calculation_time_ms: Date.now() - startTime,
          memory_usage_mb: 0, // Would be calculated in real implementation
          database_queries: 0,
          cache_hit_rate: 0,
          data_points_processed: this.countDataPoints(projectResult, expertiseResult, ebaResult),
          complexity_score: this.calculateComplexityScore(projectResult, expertiseResult, ebaResult),
          success_rate: 100
        },
        validation: {
          is_valid: true,
          missing_data: [],
          data_quality_issues: [],
          configuration_issues: [],
          warnings: [],
          recommendations: []
        },
        calculation_state: {
          phase: 'completed',
          progress: 100,
          current_step: 'Calculation completed',
          start_time: new Date(),
          elapsed_ms: Date.now() - startTime,
          warnings: [],
          errors: []
        },
        debug_info: {
          reconciliation_factors: reconciliationOutput.adjustments,
          discrepancy_analysis: discrepancyCheck,
          calculation_steps: this.logCalculationSteps(projectResult, expertiseResult, ebaResult, context)
        },
        calculated_at: new Date(),
        calculation_version: '1.0',
        processing_time_ms: Date.now() - startTime
      };

      return result;

    } catch (error) {
      throw new CombinedCalculationError(
        'CALCULATION_FAILED',
        `Combined calculation failed: ${(error as Error).message}`,
        { employer_id: context.employer_id, error: (error as Error).stack }
      );
    }
  }

  // -------------------------------------------------------------------------
  // DISCREPANCY DETECTION
  // -------------------------------------------------------------------------

  async detectDiscrepancies(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): Promise<DiscrepancyCheck> {
    // Calculate score difference
    const projectScore = projectResult.score || 0;
    const expertiseScore = expertiseResult.score || 0;
    const scoreDifference = Math.abs(projectScore - expertiseScore);

    // Check for rating mismatch
    const ratingMatch = projectResult.rating === expertiseResult.rating;

    // Calculate confidence gap
    const confidenceGap = this.calculateConfidenceGap(projectResult, expertiseResult);

    // Determine discrepancy level
    const discrepancyLevel = this.determineDiscrepancyLevel(
      scoreDifference,
      ratingMatch,
      confidenceGap
    );

    // Determine if review is required
    const requiresReview = this.determineReviewRequirement(discrepancyLevel, scoreDifference);

    // Provide recommended action
    const recommendedAction = this.recommendAction(
      discrepancyLevel,
      projectResult,
      expertiseResult
    );

    // Calculate confidence impact
    const confidenceImpact = this.calculateConfidenceImpact(discrepancyLevel);

    // Generate explanation
    const explanation = this.generateDiscrepancyExplanation(
      discrepancyLevel,
      scoreDifference,
      ratingMatch,
      confidenceGap
    );

    // Perform detailed analysis
    const detailedAnalysis = this.performDetailedDiscrepancyAnalysis(
      projectResult,
      expertiseResult
    );

    return {
      discrepancy_detected: discrepancyLevel !== 'none',
      discrepancy_level: discrepancyLevel,
      score_difference: scoreDifference,
      rating_match: ratingMatch,
      confidence_gap: confidenceGap,
      requires_review: requiresReview,
      recommended_action: recommendedAction,
      confidence_impact: confidenceImpact,
      explanation: explanation,
      detailed_analysis: detailedAnalysis
    };
  }

  // -------------------------------------------------------------------------
  // RECONCILIATION
  // -------------------------------------------------------------------------

  async reconcileRatings(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<ReconciliationOutput> {
    // Detect discrepancies first
    const discrepancyCheck = await this.detectDiscrepancies(projectResult, expertiseResult);

    // Choose reconciliation strategy
    const strategy = this.chooseReconciliationStrategy(discrepancyCheck, context);

    // Apply reconciliation
    const reconciliationResult = await this.applyReconciliationStrategy(
      strategy,
      projectResult,
      expertiseResult,
      ebaResult,
      context
    );

    return reconciliationResult;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateFinalScoreAndRating(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext,
    reconciliationOutput: ReconciliationOutput
  ): { finalScore: number; finalRating: TrafficLightRating } {
    let finalScore: number;

    switch (context.method) {
      case 'weighted_average':
        finalScore = this.calculateWeightedAverage(
          projectResult,
          expertiseResult,
          ebaResult,
          context.weights
        );
        break;

      case 'weighted_sum':
        finalScore = this.calculateWeightedSum(
          projectResult,
          expertiseResult,
          ebaResult,
          context.weights
        );
        break;

      case 'minimum_score':
        finalScore = this.calculateMinimumScore(
          projectResult,
          expertiseResult,
          ebaResult
        );
        break;

      case 'hybrid_method':
        finalScore = this.calculateHybridMethod(
          projectResult,
          expertiseResult,
          ebaResult,
          context.weights
        );
        break;

      default:
        finalScore = this.calculateWeightedAverage(
          projectResult,
          expertiseResult,
          ebaResult,
          context.weights
        );
    }

    // Apply reconciliation adjustments
    finalScore = this.applyReconciliationAdjustments(finalScore, reconciliationOutput);

    // Ensure score is within valid range
    finalScore = Math.max(-100, Math.min(100, finalScore));

    // Determine final rating
    const finalRating = this.determineRatingFromScore(finalScore);

    return { finalScore, finalRating };
  }

  private calculateWeightedAverage(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    weights: RatingWeights
  ): number {
    const projectScore = projectResult.score || 0;
    const expertiseScore = expertiseResult.score || 0;
    const ebaScore = ebaResult.eba_score || 0;

    const totalWeight = weights.project + weights.expertise + weights.eba;

    if (totalWeight === 0) return 0;

    const weightedSum = (
      (projectScore * weights.project) +
      (expertiseScore * weights.expertise) +
      (ebaScore * weights.eba)
    );

    return weightedSum / totalWeight;
  }

  private calculateWeightedSum(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    weights: RatingWeights
  ): number {
    const projectScore = projectResult.score || 0;
    const expertiseScore = expertiseResult.score || 0;
    const ebaScore = ebaResult.eba_score || 0;

    return (
      (projectScore * weights.project) +
      (expertiseScore * weights.expertise) +
      (ebaScore * weights.eba)
    );
  }

  private calculateMinimumScore(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult
  ): number {
    const projectScore = projectResult.score || 0;
    const expertiseScore = expertiseResult.score || 0;
    const ebaScore = ebaResult.eba_score || 0;

    // EBA status is often the most critical factor
    const criticalFactors = [ebaScore];

    // Include project and expertise if they have sufficient data
    if (projectResult.assessment_count >= 3) {
      criticalFactors.push(projectScore);
    }
    if (expertiseResult.assessment_count >= 2) {
      criticalFactors.push(expertiseScore);
    }

    return Math.min(...criticalFactors);
  }

  private calculateHybridMethod(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    weights: RatingWeights
  ): number {
    // Calculate base weighted average of project and expertise
    const projectScore = projectResult.score || 0;
    const expertiseScore = expertiseResult.score || 0;
    const ebaScore = ebaResult.eba_score || 0;

    const projectWeight = weights.project;
    const expertiseWeight = weights.expertise;

    let baseScore = 0;
    let baseWeight = projectWeight + expertiseWeight;

    if (baseWeight > 0) {
      baseScore = ((projectScore * projectWeight) + (expertiseScore * expertiseWeight)) / baseWeight;
    }

    // Apply critical factor adjustment (EBA has significant impact)
    const criticalWeight = 0.3; // 30% weight for critical factors
    const criticalScore = ebaScore;

    // Combine base and critical scores
    const finalScore = (baseScore * (1 - criticalWeight)) + (criticalScore * criticalWeight);

    return finalScore;
  }

  private applyReconciliationAdjustments(
    baseScore: number,
    reconciliationOutput: ReconciliationOutput
  ): number {
    let adjustedScore = baseScore;

    for (const adjustment of reconciliationOutput.adjustments) {
      switch (adjustment.type) {
        case 'score_override':
          adjustedScore = adjustment.adjusted_value;
          break;
        case 'bonus':
          adjustedScore += adjustment.amount;
          break;
        case 'penalty':
          adjustedScore -= adjustment.amount;
          break;
        case 'confidence_adjustment':
          // Confidence adjustments are handled separately
          break;
      }
    }

    return adjustedScore;
  }

  private determineRatingFromScore(score: number): TrafficLightRating {
    const thresholds = this.config.score_thresholds;

    if (score >= thresholds.green.min && score <= thresholds.green.max) {
      return 'green';
    } else if (score >= thresholds.amber.min && score <= thresholds.amber.max) {
      return 'amber';
    } else if (score >= thresholds.red.min && score <= thresholds.red.max) {
      return 'red';
    } else {
      return 'unknown';
    }
  }

  private calculateOverallConfidence(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    reconciliationOutput: ReconciliationOutput
  ): ConfidenceLevel {
    // Get component confidence levels
    const projectConfidence = this.convertConfidenceToNumeric(projectResult.data_quality);
    const expertiseConfidence = this.convertConfidenceToNumeric(expertiseResult.confidence_level);
    const ebaConfidence = this.calculateEBAConfidence(ebaResult);

    // Apply reconciliation confidence adjustment
    const reconciliationImpact = reconciliationOutput.confidence_adjustment;

    // Calculate weighted average confidence
    const weights = { project: 0.4, expertise: 0.4, eba: 0.2 };
    const weightedConfidence = (
      (projectConfidence * weights.project) +
      (expertiseConfidence * weights.expertise) +
      (ebaConfidence * weights.eba)
    );

    // Apply reconciliation impact
    const finalConfidence = Math.max(0, Math.min(1, weightedConfidence + reconciliationImpact));

    return this.convertNumericToConfidence(finalConfidence);
  }

  private convertConfidenceToNumeric(confidence: ConfidenceLevel): number {
    const mapping = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      very_low: 0.3
    };
    return mapping[confidence] || 0.5;
  }

  private convertNumericToConfidence(numeric: number): ConfidenceLevel {
    if (numeric >= 0.8) return 'high';
    if (numeric >= 0.6) return 'medium';
    if (numeric >= 0.4) return 'low';
    return 'very_low';
  }

  private calculateEBAConfidence(ebaResult: EBARatingResult): number {
    if (ebaResult.has_active_eba) {
      // Higher confidence for active EBAs, especially recent ones
      if (ebaResult.data_age_days && ebaResult.data_age_days <= 365) {
        return 0.9;
      } else if (ebaResult.data_age_days && ebaResult.data_age_days <= 1095) { // 3 years
        return 0.8;
      } else {
        return 0.7;
      }
    } else {
      // Lower confidence when no EBA data
      return 0.4;
    }
  }

  private calculateDataCompleteness(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult
  ): number {
    let completeness = 0;

    // Project data completeness (40% weight)
    if (projectResult.assessment_count > 0) {
      completeness += Math.min(40, projectResult.assessment_count * 8);
    }

    // Expertise data completeness (40% weight)
    if (expertiseResult.assessment_count > 0) {
      completeness += Math.min(40, expertiseResult.assessment_count * 10);
    }

    // EBA data completeness (20% weight)
    if (ebaResult.has_active_eba || ebaResult.eba_details.length > 0) {
      completeness += 20;
    }

    return completeness;
  }

  private determineReviewRequirements(
    discrepancyCheck: DiscrepancyCheck,
    overallConfidence: ConfidenceLevel,
    dataCompleteness: number
  ): { required: boolean; reason?: string; nextReviewDate?: Date } {
    const required = (
      discrepancyCheck.requires_review ||
      overallConfidence === 'very_low' ||
      dataCompleteness < 50
    );

    let reason: string | undefined;
    let nextReviewDate: Date | undefined;

    if (required) {
      const reasons = [];

      if (discrepancyCheck.requires_review) {
        reasons.push('Significant discrepancy between project and expertise ratings');
      }

      if (overallConfidence === 'very_low') {
        reasons.push('Very low confidence in rating accuracy');
      }

      if (dataCompleteness < 50) {
        reasons.push('Insufficient data for reliable rating');
      }

      reason = reasons.join('; ');

      // Set next review date based on urgency
      const now = new Date();
      if (overallConfidence === 'very_low' || discrepancyCheck.discrepancy_level === 'critical') {
        nextReviewDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 1 week
      } else if (overallConfidence === 'low' || discrepancyCheck.discrepancy_level === 'major') {
        nextReviewDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 1 month
      } else {
        nextReviewDate = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 2 months
      }
    }

    return { required, reason, nextReviewDate };
  }

  private calculateExpiryDate(calculationDate: Date, overallConfidence: ConfidenceLevel): Date {
    const baseExpiryDays = 180; // 6 months base

    let adjustmentDays = 0;
    switch (overallConfidence) {
      case 'high':
        adjustmentDays = 90; // Add 3 months
        break;
      case 'medium':
        adjustmentDays = 30; // Add 1 month
        break;
      case 'low':
        adjustmentDays = -30; // Subtract 1 month
        break;
      case 'very_low':
        adjustmentDays = -60; // Subtract 2 months
        break;
    }

    const totalDays = Math.max(30, baseExpiryDays + adjustmentDays); // Minimum 30 days
    return new Date(calculationDate.getTime() + (totalDays * 24 * 60 * 60 * 1000));
  }

  private getMethodConfig(method: CalculationMethod): Record<string, any> {
    const configs = {
      weighted_average: { normalize_weights: true },
      weighted_sum: { max_total_score: 100 },
      minimum_score: { critical_factors: ['eca_status', 'safety_incidents'] },
      hybrid_method: { critical_weight: 0.3, fallback_method: 'weighted_average' }
    };

    return configs[method] || {};
  }

  private countDataPoints(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult
  ): number {
    return (
      projectResult.assessment_count +
      expertiseResult.assessment_count +
      ebaResult.eba_details.length
    );
  }

  private calculateComplexityScore(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult
  ): number {
    let score = 0;

    // Base score for data volume
    score += Math.min(30, this.countDataPoints(projectResult, expertiseResult, ebaResult));

    // Additional complexity for reconciliation
    score += 20;

    // Complexity for detailed breakdowns
    if (projectResult.breakdown) score += 10;
    if (expertiseResult.breakdown) score += 10;
    if (ebaResult.breakdown) score += 10;

    // Trend analysis complexity
    if (projectResult.trend_analysis) score += 10;
    if (expertiseResult.reputation_analysis) score += 10;

    return Math.min(100, score);
  }

  private createReconciliationDetails(
    reconciliationOutput: ReconciliationOutput,
    context: CalculationContext,
    discrepancyCheck: DiscrepancyCheck
  ): ReconciliationDetails {
    return {
      method_used: reconciliationOutput.method_used,
      original_weights: context.weights,
      adjusted_weights: this.calculateAdjustedWeights(context.weights, reconciliationOutput),
      adjustments: reconciliationOutput.adjustments.map(adj => ({
        type: adj.type as any,
        component: adj.component as any,
        original_value: adj.original_value,
        adjusted_value: adj.adjusted_value,
        reason: adj.reason,
        auto_applied: adj.auto_applied,
        applied_at: new Date(),
        applied_by: adj.auto_applied ? 'system' : 'user'
      })),
      decision_factors: this.generateDecisionFactors(reconciliationOutput, discrepancyCheck),
      reviewer_notes: reconciliationOutput.explanation,
      reviewer_id: 'system',
      review_date: new Date()
    };
  }

  private calculateAdjustedWeights(
    originalWeights: RatingWeights,
    reconciliationOutput: ReconciliationOutput
  ): RatingWeights {
    const adjustedWeights = { ...originalWeights };

    for (const adjustment of reconciliationOutput.adjustments) {
      if (adjustment.type === 'weight_change' && adjustment.component in adjustedWeights) {
        adjustedWeights[adjustment.component as keyof RatingWeights] = adjustment.adjusted_value;
      }
    }

    return adjustedWeights;
  }

  private generateDecisionFactors(
    reconciliationOutput: ReconciliationOutput,
    discrepancyCheck: DiscrepancyCheck
  ): any[] {
    return [
      {
        factor: 'Discrepancy Level',
        weight: 0.3,
        value: discrepancyCheck.discrepancy_level,
        reasoning: `Discrepancy detected: ${discrepancyCheck.discrepancy_level}`,
        data_source: 'discrepancy_analysis'
      },
      {
        factor: 'Score Difference',
        weight: 0.2,
        value: discrepancyCheck.score_difference,
        reasoning: `Score difference: ${discrepancyCheck.score_difference}`,
        data_source: 'discrepancy_analysis'
      },
      {
        factor: 'Confidence Gap',
        weight: 0.2,
        value: discrepancyCheck.confidence_gap,
        reasoning: `Confidence gap between data sources`,
        data_source: 'discrepancy_analysis'
      },
      {
        factor: 'Reconciliation Method',
        weight: 0.3,
        value: reconciliationOutput.method_used,
        reasoning: `Applied ${reconciliationOutput.method_used} reconciliation`,
        data_source: 'reconciliation_engine'
      }
    ];
  }

  private logCalculationSteps(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): string[] {
    return [
      `1. Loaded project data: ${projectResult.assessment_count} assessments`,
      `2. Loaded expertise data: ${expertiseResult.assessment_count} assessments`,
      `3. Loaded EBA data: ${ebaResult.eba_details.length} records`,
      `4. Applied calculation method: ${context.method}`,
      `5. Used weights: project=${context.weights.project}, expertise=${context.weights.expertise}, eba=${context.weights.eba}`,
      `6. Detected discrepancies: ${projectResult.rating !== expertiseResult.rating ? 'Yes' : 'No'}`,
      `7. Applied reconciliation: ${context.method === 'hybrid_method' ? 'Yes' : 'No'}`,
      `8. Calculated final confidence: Based on component confidence levels`,
      `9. Determined review requirements: Based on discrepancy and confidence levels`
    ];
  }

  // -------------------------------------------------------------------------
  // DISCREPANCY ANALYSIS HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateConfidenceGap(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): number {
    const projectConfidence = this.convertConfidenceToNumeric(projectResult.data_quality);
    const expertiseConfidence = this.convertConfidenceToNumeric(expertiseResult.confidence_level);

    return Math.abs(projectConfidence - expertiseConfidence);
  }

  private determineDiscrepancyLevel(
    scoreDifference: number,
    ratingMatch: boolean,
    confidenceGap: number
  ): DiscrepancyLevel {
    // Critical discrepancies
    if (!ratingMatch && scoreDifference > 30) {
      return 'critical';
    }

    // Major discrepancies
    if (!ratingMatch && scoreDifference > 20) {
      return 'major';
    }

    // Moderate discrepancies
    if (scoreDifference > 15 || confidenceGap > 0.3) {
      return 'moderate';
    }

    // Minor discrepancies
    if (scoreDifference > 5 || confidenceGap > 0.2) {
      return 'minor';
    }

    return 'none';
  }

  private determineReviewRequirement(
    discrepancyLevel: DiscrepancyLevel,
    scoreDifference: number
  ): boolean {
    return (
      discrepancyLevel === 'critical' ||
      discrepancyLevel === 'major' ||
      scoreDifference > 25
    );
  }

  private recommendAction(
    discrepancyLevel: DiscrepancyLevel,
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any {
    if (discrepancyLevel === 'critical' || discrepancyLevel === 'major') {
      return {
        action: 'manual_review',
        confidence: 0.9,
        reasoning: 'Significant discrepancy requires human review',
        expected_outcome: 'Manual determination of most accurate rating',
        implementation: {
          method: 'escalate_to_human_review',
          priority: 'high',
          escalation_reason: 'Critical rating discrepancy'
        }
      };
    }

    if (discrepancyLevel === 'moderate') {
      // Prefer the source with better data quality
      const projectQuality = this.convertConfidenceToNumeric(projectResult.data_quality);
      const expertiseQuality = this.convertConfidenceToNumeric(expertiseResult.confidence_level);

      if (projectQuality > expertiseQuality) {
        return {
          action: 'prefer_project',
          confidence: 0.7,
          reasoning: 'Project data has higher confidence',
          expected_outcome: 'Project-based rating prioritized',
          implementation: {
            method: 'weighted_compromise',
            weight_adjustment: { project: 0.7, expertise: 0.3 }
          }
        };
      } else {
        return {
          action: 'prefer_expertise',
          confidence: 0.7,
          reasoning: 'Expertise data has higher confidence',
          expected_outcome: 'Expertise-based rating prioritized',
          implementation: {
            method: 'weighted_compromise',
            weight_adjustment: { project: 0.3, expertise: 0.7 }
          }
        };
      }
    }

    return {
      action: 'accept_calculated',
      confidence: 0.8,
      reasoning: 'Minor discrepancy, calculated rating acceptable',
      expected_outcome: 'Standard weighted average accepted',
      implementation: {
        method: 'standard_weighted_average',
        no_adjustment: true
      }
    };
  }

  private calculateConfidenceImpact(discrepancyLevel: DiscrepancyLevel): number {
    const impacts = {
      none: 0,
      minor: -0.05,
      moderate: -0.1,
      major: -0.2,
      critical: -0.3
    };

    return impacts[discrepancyLevel];
  }

  private generateDiscrepancyExplanation(
    discrepancyLevel: DiscrepancyLevel,
    scoreDifference: number,
    ratingMatch: boolean,
    confidenceGap: number
  ): string {
    if (discrepancyLevel === 'none') {
      return 'No significant discrepancy detected between project and expertise ratings.';
    }

    const explanations = [];

    if (!ratingMatch) {
      explanations.push(`Rating mismatch: project and expertise data indicate different traffic light ratings`);
    }

    if (scoreDifference > 10) {
      explanations.push(`Score difference of ${scoreDifference.toFixed(1)} points between data sources`);
    }

    if (confidenceGap > 0.2) {
      explanations.push(`Confidence level gap of ${(confidenceGap * 100).toFixed(0)}% between data sources`);
    }

    explanations.push(`Discrepancy classified as ${discrepancyLevel} severity`);

    return explanations.join('. ');
  }

  private performDetailedDiscrepancyAnalysis(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): DiscrepancyAnalysisResult {
    // Analyze primary causes
    const primaryCauses = this.identifyPrimaryCauses(projectResult, expertiseResult);

    // Identify contributing factors
    const contributingFactors = this.identifyContributingFactors(projectResult, expertiseResult);

    // Detect data conflicts
    const dataConflicts = this.detectDataConflicts(projectResult, expertiseResult);

    // Analyze temporal aspects
    const temporalAnalysis = this.analyzeTemporalDiscrepancy(projectResult, expertiseResult);

    // Assess source reliability
    const sourceReliability = this.assessSourceReliability(projectResult, expertiseResult);

    return {
      primary_causes: primaryCauses,
      contributing_factors: contributingFactors,
      data_conflicts: dataConflicts,
      temporal_analysis: temporalAnalysis,
      source_reliability: sourceReliability
    };
  }

  private identifyPrimaryCauses(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any[] {
    const causes = [];

    // Check for data recency differences
    const projectAge = projectResult.data_age_days || 999;
    const expertiseAge = expertiseResult.data_age_days || 999;

    if (Math.abs(projectAge - expertiseAge) > 90) {
      causes.push({
        cause: 'Data recency mismatch',
        impact: Math.abs(projectAge - expertiseAge) / 10,
        likelihood: 'high',
        evidence: [`Project data age: ${projectAge} days`, `Expertise data age: ${expertiseAge} days`],
        resolution_approach: 'Prefer more recent data source'
      });
    }

    // Check for data quality differences
    const projectQuality = this.convertConfidenceToNumeric(projectResult.data_quality);
    const expertiseQuality = this.convertConfidenceToNumeric(expertiseResult.confidence_level);

    if (Math.abs(projectQuality - expertiseQuality) > 0.3) {
      causes.push({
        cause: 'Data quality gap',
        impact: Math.abs(projectQuality - expertiseQuality) * 50,
        likelihood: 'medium',
        evidence: [
          `Project data quality: ${projectResult.data_quality}`,
          `Expertise data quality: ${expertiseResult.confidence_level}`
        ],
        resolution_approach: 'Prefer higher quality data source'
      });
    }

    return causes;
  }

  private identifyContributingFactors(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any[] {
    const factors = [];

    // Assessment volume differences
    if (Math.abs(projectResult.assessment_count - expertiseResult.assessment_count) > 2) {
      factors.push({
        factor: 'Assessment volume difference',
        weight: 0.2,
        description: `Different number of assessments: ${projectResult.assessment_count} vs ${expertiseResult.assessment_count}`,
        mitigable: false
      });
    }

    // Organiser expertise level
    if (expertiseResult.assessment_count === 1) {
      factors.push({
        factor: 'Single expertise assessment',
        weight: 0.3,
        description: 'Only one organiser expertise assessment available',
        mitigable: true
      });
    }

    return factors;
  }

  private detectDataConflicts(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any[] {
    const conflicts = [];

    if (projectResult.rating !== expertiseResult.rating) {
      conflicts.push({
        type: 'rating_mismatch',
        severity: 'high',
        description: `Different ratings: ${projectResult.rating} vs ${expertiseResult.rating}`,
        affected_components: ['project_rating', 'expertise_rating'],
        impact_score: 25,
        resolution_suggestion: 'Review assessment details and consider manual override'
      });
    }

    const scoreDiff = Math.abs((projectResult.score || 0) - (expertiseResult.score || 0));
    if (scoreDiff > 20) {
      conflicts.push({
        type: 'score_range',
        severity: 'medium',
        description: `Significant score difference: ${scoreDiff.toFixed(1)} points`,
        affected_components: ['project_score', 'expertise_score'],
        impact_score: scoreDiff / 2,
        resolution_suggestion: 'Apply weighted reconciliation or manual review'
      });
    }

    return conflicts;
  }

  private analyzeTemporalDiscrepancy(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any {
    const projectAge = projectResult.data_age_days || 0;
    const expertiseAge = expertiseResult.data_age_days || 0;
    const ageDifference = Math.abs(projectAge - expertiseAge);

    let temporalAlignment: 'aligned' | 'misaligned' | 'unknown';
    if (ageDifference <= 30) {
      temporalAlignment = 'aligned';
    } else if (ageDifference <= 90) {
      temporalAlignment = 'misaligned';
    } else {
      temporalAlignment = 'unknown';
    }

    let recencyPreference: 'project' | 'expertise' | 'balanced';
    if (projectAge < expertiseAge - 30) {
      recencyPreference = 'project';
    } else if (expertiseAge < projectAge - 30) {
      recencyPreference = 'expertise';
    } else {
      recencyPreference = 'balanced';
    }

    return {
      data_age_difference: ageDifference,
      temporal_alignment: temporalAlignment,
      recency_preference: recencyPreference,
      temporal_weight_adjustment: this.calculateTemporalWeightAdjustment(projectAge, expertiseAge)
    };
  }

  private calculateTemporalWeightAdjustment(projectAge: number, expertiseAge: number): number {
    // Prefer more recent data with a maximum adjustment of ±0.1
    const maxAdjustment = 0.1;
    const ageDifference = projectAge - expertiseAge;

    if (Math.abs(ageDifference) <= 30) {
      return 0; // No adjustment if data is similarly recent
    }

    const adjustment = (ageDifference / 365) * maxAdjustment;
    return Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustment));
  }

  private assessSourceReliability(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult
  ): any {
    const projectReliability = this.calculateSourceReliability(projectResult, 'project');
    const expertiseReliability = this.calculateSourceReliability(expertiseResult, 'expertise');
    const reliabilityGap = Math.abs(projectReliability - expertiseReliability);

    let preferredSource: 'project' | 'expertise' | 'balanced';
    if (projectReliability > expertiseReliability + 0.1) {
      preferredSource = 'project';
    } else if (expertiseReliability > projectReliability + 0.1) {
      preferredSource = 'expertise';
    } else {
      preferredSource = 'balanced';
    }

    return {
      project_reliability: projectReliability,
      expertise_reliability: expertiseReliability,
      reliability_gap: reliabilityGap,
      preferred_source: preferredSource,
      confidence_in_preference: Math.max(projectReliability, expertiseReliability)
    };
  }

  private calculateSourceReliability(result: ProjectRatingResult | ExpertiseRatingResult, sourceType: string): number {
    let reliability = 0.5; // Base reliability

    // Factor in data quality
    const qualityScore = this.convertConfidenceToNumeric(
      'data_quality' in result ? result.data_quality : result.confidence_level
    );
    reliability += qualityScore * 0.3;

    // Factor in assessment count
    const assessmentCount = result.assessment_count;
    const countScore = Math.min(1, assessmentCount / 5); // Cap at 5 assessments
    reliability += countScore * 0.2;

    // Factor in data recency
    const dataAge = result.data_age_days || 999;
    const recencyScore = Math.max(0, 1 - (dataAge / 365)); // Decay over 1 year
    reliability += recencyScore * 0.2;

    return Math.min(1, reliability);
  }

  // -------------------------------------------------------------------------
  // RECONCILIATION STRATEGY HELPER METHODS
  // -------------------------------------------------------------------------

  private chooseReconciliationStrategy(
    discrepancyCheck: DiscrepancyCheck,
    context: CalculationContext
  ): string {
    if (discrepancyCheck.discrepancy_level === 'critical' || discrepancyCheck.discrepancy_level === 'major') {
      return 'manual_review_required';
    }

    if (discrepancyCheck.discrepancy_level === 'moderate') {
      return 'automated_weighting_adjustment';
    }

    return 'standard_calculation';
  }

  private async applyReconciliationStrategy(
    strategy: string,
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<ReconciliationOutput> {
    switch (strategy) {
      case 'manual_review_required':
        return this.createManualReviewReconciliation(projectResult, expertiseResult, context);

      case 'automated_weighting_adjustment':
        return this.createAutomatedWeightingReconciliation(projectResult, expertiseResult, context);

      case 'standard_calculation':
      default:
        return this.createStandardReconciliation(projectResult, expertiseResult, ebaResult, context);
    }
  }

  private createManualReviewReconciliation(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    context: CalculationContext
  ): ReconciliationOutput {
    return {
      final_score: this.calculateWeightedAverage(projectResult, expertiseResult, { eba_score: 0 }, context.weights),
      final_rating: projectResult.rating, // Default to project rating until review
      reconciliation_applied: false,
      method_used: 'manual_review_required',
      adjustments: [],
      confidence_adjustment: -0.2, // Reduce confidence due to required review
      explanation: 'Significant discrepancy detected - manual review required before final rating determination'
    };
  }

  private createAutomatedWeightingReconciliation(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    context: CalculationContext
  ): ReconciliationOutput {
    const projectQuality = this.convertConfidenceToNumeric(projectResult.data_quality);
    const expertiseQuality = this.convertConfidenceToNumeric(expertiseResult.confidence_level);

    // Adjust weights based on data quality
    let adjustedWeights = { ...context.weights };
    const totalWeight = adjustedWeights.project + adjustedWeights.expertise;

    if (projectQuality > expertiseQuality) {
      adjustedWeights.project = context.weights.project * 1.2;
      adjustedWeights.expertise = context.weights.expertise * 0.8;
    } else {
      adjustedWeights.project = context.weights.project * 0.8;
      adjustedWeights.expertise = context.weights.expertise * 1.2;
    }

    // Normalize weights
    const newTotal = adjustedWeights.project + adjustedWeights.expertise;
    adjustedWeights.project = (adjustedWeights.project / newTotal) * totalWeight;
    adjustedWeights.expertise = (adjustedWeights.expertise / newTotal) * totalWeight;

    const adjustment = {
      type: 'weight_change' as const,
      component: 'weights' as const,
      original_value: totalWeight,
      adjusted_value: newTotal,
      reason: 'Automated weighting adjustment based on data quality differences',
      auto_applied: true
    };

    return {
      final_score: this.calculateWeightedAverage(projectResult, expertiseResult, { eba_score: 0 }, adjustedWeights),
      final_rating: projectResult.rating, // Would be recalculated
      reconciliation_applied: true,
      method_used: 'automated_weighting_adjustment',
      adjustments: [adjustment],
      confidence_adjustment: -0.1, // Small confidence reduction
      explanation: 'Applied automated weight adjustments based on relative data quality'
    };
  }

  private createStandardReconciliation(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): ReconciliationOutput {
    const finalScore = this.calculateWeightedAverage(projectResult, expertiseResult, ebaResult, context.weights);
    const finalRating = this.determineRatingFromScore(finalScore);

    return {
      final_score: finalScore,
      final_rating: finalRating,
      reconciliation_applied: false,
      method_used: context.method,
      adjustments: [],
      confidence_adjustment: 0,
      explanation: 'Standard calculation applied - no significant discrepancies detected'
    };
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class CombinedCalculationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'CombinedCalculationError';
    this.code = code;
    this.details = details;
  }
}