// Discrepancy Detection and Handling Algorithms - Advanced detection and resolution of rating discrepancies

import {
  TrafficLightRating,
  ConfidenceLevel,
  RatingWeights,
  CalculationMethod
} from '../types/RatingTypes';
import {
  DiscrepancyCheck,
  DiscrepancyLevel,
  ReconciliationInput,
  DiscrepancyAnalysisResult,
  DiscrepancyDetectionConfig,
  DiscrepancyPattern,
  DiscrepancyTrend,
  ReconciliationStrategy,
  DiscrepancyResolution
} from '../types/CalculationTypes';
import { DiscrepancyAnalysisDetails } from '../types/ResultTypes';

// =============================================================================
// DISCREPANCY DETECTION INTERFACES
// =============================================================================

export interface IDiscrepancyDetector {
  detectDiscrepancies(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<DiscrepancyCheck>;
  analyzeDiscrepancyPatterns(
    historicalDiscrepancies: DiscrepancyCheck[],
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<DiscrepancyPattern[]>;
  predictDiscrepancyRisk(
    projectData: any,
    expertiseData: any,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<number>;
  calculateDiscrepancyTrend(
    discrepancies: DiscrepancyCheck[],
    timeWindow: number
  ): Promise<DiscrepancyTrend>;
  recommendReconciliationStrategy(
    discrepancy: DiscrepancyCheck,
    context: any,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<ReconciliationStrategy>;
}

export interface IDiscrepancyResolver {
  resolveDiscrepancy(
    discrepancy: DiscrepancyCheck,
    strategy: ReconciliationStrategy,
    context: any
  ): Promise<DiscrepancyResolution>;
  applyWeightAdjustment(
    currentWeights: RatingWeights,
    discrepancy: DiscrepancyCheck,
    strategy: ReconciliationStrategy
  ): Promise<RatingWeights>;
  calculateConfidenceAdjustment(
    discrepancy: DiscrepancyCheck,
    resolution: DiscrepancyResolution
  ): Promise<number>;
  validateResolution(
    resolution: DiscrepancyResolution,
    originalDiscrepancy: DiscrepancyCheck
  ): Promise<boolean>;
}

// =============================================================================
// DISCREPANCY DETECTION CONFIGURATION
// =============================================================================

export interface DiscrepancyDetectionConfig {
  // Thresholds
  score_difference_thresholds: Record<DiscrepancyLevel, number>;
  confidence_gap_thresholds: Record<DiscrepancyLevel, number>;
  rating_mismatch_weights: Record<DiscrepancyLevel, number>;

  // Detection sensitivity
  detection_sensitivity: 'conservative' | 'balanced' | 'aggressive';
  min_assessments_for_detection: number;
  temporal_consistency_window: number;

  // Pattern recognition
  enable_pattern_detection: boolean;
  pattern_history_length: number;
  pattern_significance_threshold: number;

  // Risk assessment
  enable_risk_prediction: boolean;
  risk_factors: Record<string, number>;
  risk_adjustment_enabled: boolean;

  // Resolution strategies
  auto_resolve_enabled: boolean;
  auto_resolve_threshold: DiscrepancyLevel;
  human_review_threshold: DiscrepancyLevel;

  // Advanced settings
  enable_ml_detection: boolean;
  ml_model_confidence_threshold: number;
  enable_contextual_analysis: boolean;
  contextual_factors: Record<string, number>;

  // Performance
  enable_caching: boolean;
  cache_ttl_seconds: number;
  batch_processing: boolean;
}

// =============================================================================
// DISCREPANCY DETECTOR IMPLEMENTATION
// =============================================================================

export class DiscrepancyDetector implements IDiscrepancyDetector {
  private defaultConfig: DiscrepancyDetectionConfig;
  private discrepancyCache: Map<string, DiscrepancyCheck>;
  private patternCache: Map<string, DiscrepancyPattern[]>;

  constructor(config?: Partial<DiscrepancyDetectionConfig>) {
    this.defaultConfig = {
      // Thresholds
      score_difference_thresholds: {
        none: 5,
        minor: 15,
        moderate: 30,
        major: 50,
        critical: 70
      },
      confidence_gap_thresholds: {
        none: 0.1,
        minor: 0.2,
        moderate: 0.3,
        major: 0.4,
        critical: 0.5
      },
      rating_mismatch_weights: {
        none: 0,
        minor: 10,
        moderate: 25,
        major: 40,
        critical: 60
      },

      // Detection sensitivity
      detection_sensitivity: 'balanced',
      min_assessments_for_detection: 1,
      temporal_consistency_window: 90,

      // Pattern recognition
      enable_pattern_detection: true,
      pattern_history_length: 10,
      pattern_significance_threshold: 0.7,

      // Risk assessment
      enable_risk_prediction: true,
      risk_factors: {
        data_age_difference: 0.3,
        source_quality_gap: 0.25,
        assessment_volume_gap: 0.2,
        temporal_misalignment: 0.15,
        complexity_score: 0.1
      },
      risk_adjustment_enabled: true,

      // Resolution strategies
      auto_resolve_enabled: true,
      auto_resolve_threshold: DiscrepancyLevel.minor,
      human_review_threshold: DiscrepancyLevel.major,

      // Advanced settings
      enable_ml_detection: false,
      ml_model_confidence_threshold: 0.8,
      enable_contextual_analysis: true,
      contextual_factors: {
        employer_size: 0.2,
        industry_sector: 0.15,
        geographic_location: 0.1,
        union_relationship_history: 0.3,
        recent_changes: 0.25
      },

      // Performance
      enable_caching: true,
      cache_ttl_seconds: 300,
      batch_processing: true
    };

    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.discrepancyCache = new Map();
    this.patternCache = new Map();
  }

  // -------------------------------------------------------------------------
  // MAIN DISCREPANCY DETECTION METHODS
  // -------------------------------------------------------------------------

  async detectDiscrepancies(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<DiscrepancyCheck> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Calculate basic discrepancy metrics
      const scoreDifference = Math.abs(projectRating - expertiseRating);
      const ratingMatch = this.ratingMatch(projectRating, expertiseRating);
      const confidenceGap = this.calculateConfidenceGap(projectConfidence, expertiseConfidence);

      // Determine discrepancy level
      const discrepancyLevel = this.determineDiscrepancyLevel(
        scoreDifference,
        ratingMatch,
        confidenceGap,
        finalConfig
      );

      // Calculate detailed analysis
      const detailedAnalysis = await this.performDetailedAnalysis(
        projectRating,
        projectConfidence,
        expertiseRating,
        expertiseConfidence,
        finalConfig
      );

      // Determine if review is required
      const requiresReview = this.determineReviewRequirement(discrepancyLevel, finalConfig);

      // Recommend action
      const recommendedAction = await this.recommendAction(
        discrepancyLevel,
        scoreDifference,
        ratingMatch,
        confidenceGap,
        detailedAnalysis,
        finalConfig
      );

      // Calculate confidence impact
      const confidenceImpact = this.calculateConfidenceImpact(discrepancyLevel, finalConfig);

      // Generate explanation
      const explanation = this.generateExplanation(
        discrepancyLevel,
        scoreDifference,
        ratingMatch,
        confidenceGap,
        detailedAnalysis
      );

      // Perform contextual analysis if enabled
      const contextualFactors = finalConfig.enable_contextual_analysis
        ? await this.analyzeContextualFactors(
            projectRating,
            projectConfidence,
            expertiseRating,
            expertiseConfidence,
            finalConfig
          )
        : {};

      // Create discrepancy check result
      const result: DiscrepancyCheck = {
        discrepancy_detected: discrepancyLevel !== 'none',
        discrepancy_level: discrepancyLevel,
        score_difference: scoreDifference,
        rating_match: ratingMatch,
        confidence_gap: confidenceGap,
        requires_review: requiresReview,
        recommended_action: recommendedAction,
        confidence_impact: confidenceImpact,
        explanation: explanation,
        detailed_analysis: detailedAnalysis,
        contextual_factors: contextualFactors,
        detection_timestamp: new Date(),
        configuration_used: finalConfig
      };

      // Cache result if enabled
      if (finalConfig.enable_caching) {
        const cacheKey = this.generateDiscrepancyCacheKey(
          projectRating,
          projectConfidence,
          expertiseRating,
          expertiseConfidence
        );
        this.discrepancyCache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      throw new DiscrepancyDetectionError(
        'DETECTION_ERROR',
        `Discrepancy detection failed: ${(error as Error).message}`,
        { projectRating, expertiseRating, config: finalConfig }
      );
    }
  }

  async analyzeDiscrepancyPatterns(
    historicalDiscrepancies: DiscrepancyCheck[],
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<DiscrepancyPattern[]> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (historicalDiscrepancies.length < finalConfig.pattern_history_length) {
      return [];
    }

    try {
      // Sort by timestamp
      const sortedDiscrepancies = historicalDiscrepancies
        .sort((a, b) => a.detection_timestamp.getTime() - b.detection_timestamp.getTime())
        .slice(-finalConfig.pattern_history_length);

      // Analyze different patterns
      const patterns: DiscrepancyPattern[] = [];

      // Frequency pattern
      const frequencyPattern = this.analyzeFrequencyPattern(sortedDiscrepancies, finalConfig);
      if (frequencyPattern.significance >= finalConfig.pattern_significance_threshold) {
        patterns.push(frequencyPattern);
      }

      // Severity pattern
      const severityPattern = this.analyzeSeverityPattern(sortedDiscrepancies, finalConfig);
      if (severityPattern.significance >= finalConfig.pattern_significance_threshold) {
        patterns.push(severityPattern);
      }

      // Temporal pattern
      const temporalPattern = this.analyzeTemporalPattern(sortedDiscrepancies, finalConfig);
      if (temporalPattern.significance >= finalConfig.pattern_significance_threshold) {
        patterns.push(temporalPattern);
      }

      // Source bias pattern
      const sourceBiasPattern = this.analyzeSourceBiasPattern(sortedDiscrepancies, finalConfig);
      if (sourceBiasPattern.significance >= finalConfig.pattern_significance_threshold) {
        patterns.push(sourceBiasPattern);
      }

      return patterns;

    } catch (error) {
      throw new DiscrepancyDetectionError(
        'PATTERN_ANALYSIS_ERROR',
        `Discrepancy pattern analysis failed: ${(error as Error).message}`,
        { discrepancies_count: historicalDiscrepancies.length, config: finalConfig }
      );
    }
  }

  async predictDiscrepancyRisk(
    projectData: any,
    expertiseData: any,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<number> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (!finalConfig.enable_risk_prediction) {
      return 0.5; // Default medium risk
    }

    try {
      let riskScore = 0.5; // Base risk

      // Data age difference risk
      const ageDifferenceRisk = this.calculateAgeDifferenceRisk(projectData, expertiseData);
      riskScore += ageDifferenceRisk * finalConfig.risk_factors.data_age_difference;

      // Source quality gap risk
      const qualityGapRisk = this.calculateQualityGapRisk(projectData, expertiseData);
      riskScore += qualityGapRisk * finalConfig.risk_factors.source_quality_gap;

      // Assessment volume gap risk
      const volumeGapRisk = this.calculateVolumeGapRisk(projectData, expertiseData);
      riskScore += volumeGapRisk * finalConfig.risk_factors.assessment_volume_gap;

      // Temporal misalignment risk
      const temporalRisk = this.calculateTemporalMisalignmentRisk(projectData, expertiseData);
      riskScore += temporalRisk * finalConfig.risk_factors.temporal_misalignment;

      // Complexity score risk
      const complexityRisk = this.calculateComplexityRisk(projectData, expertiseData);
      riskScore += complexityRisk * finalConfig.risk_factors.complexity_score;

      // Normalize risk score to 0-1 range
      return Math.max(0, Math.min(1, riskScore));

    } catch (error) {
      throw new DiscrepancyDetectionError(
        'RISK_PREDICTION_ERROR',
        `Discrepancy risk prediction failed: ${(error as Error).message}`,
        { projectData, expertiseData, config: finalConfig }
      );
    }
  }

  async calculateDiscrepancyTrend(
    discrepancies: DiscrepancyCheck[],
    timeWindow: number
  ): Promise<DiscrepancyTrend> {
    if (discrepancies.length < 2) {
      return {
        direction: 'stable',
        strength: 'none',
        trend_score: 0,
        volatility: 0,
        period_analyzed: timeWindow,
        data_points: discrepancies.length
      };
    }

    try {
      // Filter discrepancies within time window
      const cutoffDate = new Date(Date.now() - (timeWindow * 24 * 60 * 60 * 1000));
      const recentDiscrepancies = discrepancies.filter(d => d.detection_timestamp >= cutoffDate);

      if (recentDiscrepancies.length < 2) {
        return {
          direction: 'stable',
          strength: 'none',
          trend_score: 0,
          volatility: 0,
          period_analyzed: timeWindow,
          data_points: recentDiscrepancies.length
        };
      }

      // Calculate trend based on discrepancy levels
      const levelScores = recentDiscrepancies.map(d => this.discrepancyLevelToScore(d.discrepancy_level));
      const trendScore = this.calculateLinearTrend(levelScores);

      // Determine direction and strength
      let direction: 'improving' | 'stable' | 'declining';
      let strength: 'none' | 'weak' | 'moderate' | 'strong';

      if (Math.abs(trendScore) < 0.05) {
        direction = 'stable';
        strength = 'none';
      } else if (trendScore > 0) {
        direction = 'declining'; // Higher scores = worse discrepancies
        strength = trendScore > 0.2 ? 'strong' : trendScore > 0.1 ? 'moderate' : 'weak';
      } else {
        direction = 'improving';
        strength = Math.abs(trendScore) > 0.2 ? 'strong' : Math.abs(trendScore) > 0.1 ? 'moderate' : 'weak';
      }

      // Calculate volatility
      const volatility = this.calculateVolatility(levelScores);

      return {
        direction,
        strength,
        trend_score: trendScore,
        volatility,
        period_analyzed: timeWindow,
        data_points: recentDiscrepancies.length
      };

    } catch (error) {
      throw new DiscrepancyDetectionError(
        'TREND_CALCULATION_ERROR',
        `Discrepancy trend calculation failed: ${(error as Error).message}`,
        { discrepancies_count: discrepancies.length, timeWindow }
      );
    }
  }

  async recommendReconciliationStrategy(
    discrepancy: DiscrepancyCheck,
    context: any,
    config?: Partial<DiscrepancyDetectionConfig>
  ): Promise<ReconciliationStrategy> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Base strategy determination
      let strategy: ReconciliationStrategy;
      const confidence = this.calculateStrategyConfidence(discrepancy, context, finalConfig);

      if (discrepancy.discrepancy_level === 'critical' || discrepancy.discrepancy_level === 'major') {
        strategy = {
          approach: 'human_review_required',
          confidence: confidence,
          reasoning: this.generateHumanReviewReasoning(discrepancy),
          expected_outcome: 'Manual review and determination required',
          implementation: {
            escalation_level: discrepancy.discrepancy_level === 'critical' ? 'urgent' : 'standard',
            required_reviewers: this.determineRequiredReviewers(discrepancy),
            review_timeline: this.calculateReviewTimeline(discrepancy),
            supporting_data_needed: this.identifySupportingData(discrepancy)
          },
          risk_level: 'high'
        };
      } else if (discrepancy.discrepancy_level === 'moderate') {
        // Determine automated strategy based on data quality
        const preferredSource = this.determinePreferredSource(discrepancy, context);
        strategy = {
          approach: 'automated_weighting_adjustment',
          confidence: confidence,
          reasoning: `Automated adjustment favoring ${preferredSource} based on data quality analysis`,
          expected_outcome: `Weighted reconciliation with preference for ${preferredSource} data`,
          implementation: {
            preferred_source: preferredSource,
            weight_adjustments: this.calculateWeightAdjustments(discrepancy, preferredSource),
            validation_required: true,
            fallback_to_human_review: false
          },
          risk_level: 'medium'
        };
      } else {
        // Minor or no discrepancy - accept calculated result
        strategy = {
          approach: 'accept_calculated',
          confidence: confidence,
          reasoning: 'Minor discrepancy within acceptable tolerance',
          expected_outcome: 'Standard calculation result accepted',
          implementation: {
            no_adjustment_required: true,
            document_discrepancy: true,
            monitor_for_trends: true
          },
          risk_level: 'low'
        };
      }

      // Apply ML-based adjustment if enabled
      if (finalConfig.enable_ml_detection) {
        strategy = await this.applyMLAdjustment(strategy, discrepancy, context, finalConfig);
      }

      return strategy;

    } catch (error) {
      throw new DiscrepancyDetectionError(
        'STRATEGY_RECOMMENDATION_ERROR',
        `Reconciliation strategy recommendation failed: ${(error as Error).message}`,
        { discrepancy, context, config: finalConfig }
      );
    }
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateConfidenceGap(
    projectConfidence: ConfidenceLevel,
    expertiseConfidence: ConfidenceLevel
  ): number {
    const confidenceValues = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      very_low: 0.3
    };

    const projectValue = confidenceValues[projectConfidence] || 0.5;
    const expertiseValue = confidenceValues[expertiseConfidence] || 0.5;

    return Math.abs(projectValue - expertiseValue);
  }

  private ratingMatch(projectRating: number, expertiseRating: number): boolean {
    const projectThresholds = { green: 80, amber: 50, red: 0 };
    const expertiseThresholds = { green: 80, amber: 50, red: 0 };

    const projectRatingLevel = this.scoreToRating(projectRating, projectThresholds);
    const expertiseRatingLevel = this.scoreToRating(expertiseRating, expertiseThresholds);

    return projectRatingLevel === expertiseRatingLevel;
  }

  private scoreToRating(score: number, thresholds: { green: number; amber: number; red: number }): TrafficLightRating {
    if (score >= thresholds.green) return 'green';
    if (score >= thresholds.amber) return 'amber';
    if (score >= thresholds.red) return 'red';
    return 'unknown';
  }

  private determineDiscrepancyLevel(
    scoreDifference: number,
    ratingMatch: boolean,
    confidenceGap: number,
    config: DiscrepancyDetectionConfig
  ): DiscrepancyLevel {
    // Calculate discrepancy score
    let discrepancyScore = 0;

    // Score difference contribution
    for (const [level, threshold] of Object.entries(config.score_difference_thresholds)) {
      if (scoreDifference >= threshold) {
        discrepancyScore = Math.max(discrepancyScore, this.discrepancyLevelToScore(level as DiscrepancyLevel));
      }
    }

    // Rating mismatch contribution
    if (!ratingMatch) {
      discrepancyScore += 30; // Significant penalty for rating mismatch
    }

    // Confidence gap contribution
    for (const [level, threshold] of Object.entries(config.confidence_gap_thresholds)) {
      if (confidenceGap >= threshold) {
        discrepancyScore = Math.max(discrepancyScore, this.discrepancyLevelToScore(level as DiscrepancyLevel) * 0.5);
      }
    }

    // Apply sensitivity adjustment
    const sensitivityMultiplier = this.getSensitivityMultiplier(config.detection_sensitivity);
    discrepancyScore *= sensitivityMultiplier;

    // Convert score back to level
    return this.scoreToDiscrepancyLevel(discrepancyScore);
  }

  private discrepancyLevelToScore(level: DiscrepancyLevel): number {
    const scores = {
      none: 0,
      minor: 25,
      moderate: 50,
      major: 75,
      critical: 100
    };
    return scores[level];
  }

  private scoreToDiscrepancyLevel(score: number): DiscrepancyLevel {
    if (score < 15) return 'none';
    if (score < 35) return 'minor';
    if (score < 65) return 'moderate';
    if (score < 85) return 'major';
    return 'critical';
  }

  private getSensitivityMultiplier(sensitivity: 'conservative' | 'balanced' | 'aggressive'): number {
    switch (sensitivity) {
      case 'conservative': return 0.8; // Less sensitive
      case 'balanced': return 1.0;
      case 'aggressive': return 1.2; // More sensitive
      default: return 1.0;
    }
  }

  private async performDetailedAnalysis(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel,
    config: DiscrepancyDetectionConfig
  ): Promise<DiscrepancyAnalysisResult> {
    // Analyze primary causes
    const primaryCauses = this.identifyPrimaryCauses(
      projectRating,
      projectConfidence,
      expertiseRating,
      expertiseConfidence
    );

    // Identify contributing factors
    const contributingFactors = this.identifyContributingFactors(
      projectRating,
      projectConfidence,
      expertiseRating,
      expertiseConfidence
    );

    // Detect data conflicts
    const dataConflicts = this.detectDataConflicts(
      projectRating,
      projectConfidence,
      expertiseRating,
      expertiseConfidence
    );

    // Analyze temporal aspects
    const temporalAnalysis = this.analyzeTemporalAspects();

    // Assess source reliability
    const sourceReliability = this.assessSourceReliability(
      projectConfidence,
      expertiseConfidence
    );

    return {
      primary_causes: primaryCauses,
      contributing_factors: contributingFactors,
      data_conflicts: dataConflicts,
      temporal_analysis: temporalAnalysis,
      source_reliability: sourceReliability
    };
  }

  private identifyPrimaryCauses(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel
  ): any[] {
    const causes = [];

    const scoreDiff = Math.abs(projectRating - expertiseRating);
    const confidenceDiff = Math.abs(
      this.confidenceLevelToScore(projectConfidence) - this.confidenceLevelToScore(expertiseConfidence)
    );

    if (scoreDiff > 30) {
      causes.push({
        cause: 'significant_score_difference',
        impact: scoreDiff / 100,
        likelihood: 'high',
        evidence: [`Score difference: ${scoreDiff.toFixed(1)}`],
        resolution_approach: 'Investigate underlying data sources'
      });
    }

    if (confidenceDiff > 0.3) {
      causes.push({
        cause: 'confidence_level_mismatch',
        impact: confidenceDiff,
        likelihood: 'medium',
        evidence: [`Confidence gap: ${confidenceDiff.toFixed(2)}`],
        resolution_approach: 'Review assessment quality and completeness'
      });
    }

    return causes;
  }

  private identifyContributingFactors(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel
  ): any[] {
    const factors = [];

    // Rating level difference
    const projectLevel = this.scoreToRating(projectRating, { green: 80, amber: 50, red: 0 });
    const expertiseLevel = this.scoreToRating(expertiseRating, { green: 80, amber: 50, red: 0 });

    if (projectLevel !== expertiseLevel) {
      factors.push({
        factor: 'rating_threshold_crossover',
        weight: 0.4,
        description: `Different rating levels: ${projectLevel} vs ${expertiseLevel}`,
        mitigable: false
      });
    }

    // Confidence level difference
    if (projectConfidence !== expertiseConfidence) {
      factors.push({
        factor: 'confidence_level_divergence',
        weight: 0.3,
        description: `Different confidence levels: ${projectConfidence} vs ${expertiseConfidence}`,
        mitigable: true
      });
    }

    return factors;
  }

  private detectDataConflicts(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel
  ): any[] {
    const conflicts = [];

    const scoreDiff = Math.abs(projectRating - expertiseRating);
    if (scoreDiff > 20) {
      conflicts.push({
        type: 'score_range_conflict',
        severity: scoreDiff > 50 ? 'high' : 'medium',
        description: `Significant score difference: ${scoreDiff.toFixed(1)}`,
        affected_components: ['project_score', 'expertise_score'],
        impact_score: scoreDiff / 2,
        resolution_suggestion: 'Apply weighted reconciliation or manual review'
      });
    }

    return conflicts;
  }

  private analyzeTemporalAspects(): any {
    // Placeholder for temporal analysis
    return {
      data_age_difference: 0,
      temporal_alignment: 'unknown',
      recency_preference: 'balanced',
      temporal_weight_adjustment: 0
    };
  }

  private assessSourceReliability(
    projectConfidence: ConfidenceLevel,
    expertiseConfidence: ConfidenceLevel
  ): any {
    const projectReliability = this.confidenceLevelToScore(projectConfidence);
    const expertiseReliability = this.confidenceLevelToScore(expertiseConfidence);

    const reliabilityGap = Math.abs(projectReliability - expertiseReliability);
    const preferredSource = projectReliability > expertiseReliability ? 'project' : 'expertise';

    return {
      project_reliability: projectReliability,
      expertise_reliability: expertiseReliability,
      reliability_gap: reliabilityGap,
      preferred_source: preferredSource,
      confidence_in_preference: Math.max(projectReliability, expertiseReliability)
    };
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

  private determineReviewRequirement(
    discrepancyLevel: DiscrepancyLevel,
    config: DiscrepancyDetectionConfig
  ): boolean {
    return this.compareDiscrepancyLevels(discrepancyLevel, config.human_review_threshold) >= 0;
  }

  private compareDiscrepancyLevels(level1: DiscrepancyLevel, level2: DiscrepancyLevel): number {
    const levels = ['none', 'minor', 'moderate', 'major', 'critical'];
    return levels.indexOf(level1) - levels.indexOf(level2);
  }

  private async recommendAction(
    discrepancyLevel: DiscrepancyLevel,
    scoreDifference: number,
    ratingMatch: boolean,
    confidenceGap: number,
    detailedAnalysis: DiscrepancyAnalysisResult,
    config: DiscrepancyDetectionConfig
  ): Promise<any> {
    if (this.compareDiscrepancyLevels(discrepancyLevel, config.auto_resolve_threshold) <= 0) {
      // Can auto-resolve
      const preferredSource = detailedAnalysis.source_reliability.preferred_source;
      return {
        action: `prefer_${preferredSource}`,
        confidence: 0.8,
        reasoning: `Auto-resolution: ${preferredSource} data has higher reliability`,
        expected_outcome: `Accept ${preferredSource} rating with minor adjustments`,
        implementation: {
          method: 'automated_weighting',
          preferred_source: preferredSource,
          requires_validation: true
        }
      };
    }

    // Human review required
    return {
      action: 'manual_review',
      confidence: 0.95,
      reasoning: `Discrepancy level ${discrepancyLevel} requires human review`,
      expected_outcome: 'Manual determination of most accurate rating',
      implementation: {
        method: 'human_review',
        escalation_level: discrepancyLevel === 'critical' ? 'urgent' : 'standard',
        required_approvers: ['senior_organiser', 'rating_specialist']
      }
    };
  }

  private calculateConfidenceImpact(
    discrepancyLevel: DiscrepancyLevel,
    config: DiscrepancyDetectionConfig
  ): number {
    const impacts = {
      none: 0,
      minor: -0.05,
      moderate: -0.1,
      major: -0.2,
      critical: -0.3
    };

    let baseImpact = impacts[discrepancyLevel];

    // Apply sensitivity adjustment
    const sensitivityMultiplier = this.getSensitivityMultiplier(config.detection_sensitivity);
    baseImpact *= sensitivityMultiplier;

    return baseImpact;
  }

  private generateExplanation(
    discrepancyLevel: DiscrepancyLevel,
    scoreDifference: number,
    ratingMatch: boolean,
    confidenceGap: number,
    detailedAnalysis: DiscrepancyAnalysisResult
  ): string {
    const explanations = [];

    if (discrepancyLevel === 'none') {
      return 'No significant discrepancy detected between project and expertise ratings.';
    }

    if (scoreDifference > 10) {
      explanations.push(`Score difference of ${scoreDifference.toFixed(1)} points between data sources`);
    }

    if (!ratingMatch) {
      explanations.push('Rating mismatch between project and expertise assessments');
    }

    if (confidenceGap > 0.2) {
      explanations.push(`Confidence level gap of ${(confidenceGap * 100).toFixed(0)}% between sources`);
    }

    if (detailedAnalysis.primary_causes.length > 0) {
      explanations.push(`Primary causes: ${detailedAnalysis.primary_causes.map(c => c.cause).join(', ')}`);
    }

    explanations.push(`Discrepancy classified as ${discrepancyLevel} severity`);

    return explanations.join('. ');
  }

  private async analyzeContextualFactors(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel,
    config: DiscrepancyDetectionConfig
  ): Promise<Record<string, any>> {
    // Placeholder for contextual analysis
    // In a real implementation, this would analyze employer-specific context
    return {
      employer_size_factor: 1.0,
      industry_sector_risk: 0.5,
      geographic_considerations: 0.3,
      relationship_history: 0.7,
      recent_changes: 0.4
    };
  }

  // -------------------------------------------------------------------------
  // PATTERN ANALYSIS METHODS
  // -------------------------------------------------------------------------

  private analyzeFrequencyPattern(
    discrepancies: DiscrepancyCheck[],
    config: DiscrepancyDetectionConfig
  ): DiscrepancyPattern {
    const significantDiscrepancies = discrepancies.filter(d => d.discrepancy_level !== 'none');
    const frequency = significantDiscrepancies.length / discrepancies.length;

    return {
      pattern_type: 'frequency',
      description: `Discrepancies occur in ${(frequency * 100).toFixed(1)}% of assessments`,
      significance: frequency,
      confidence: this.calculatePatternConfidence(significantDiscrepancies.length, discrepancies.length),
      recommendations: frequency > 0.5 ? ['Review data collection processes', 'Improve assessment consistency'] : [],
      detected_at: new Date()
    };
  }

  private analyzeSeverityPattern(
    discrepancies: DiscrepancyCheck[],
    config: DiscrepancyDetectionConfig
  ): DiscrepancyPattern {
    const severityScores = discrepancies.map(d => this.discrepancyLevelToScore(d.discrepancy_level));
    const averageSeverity = severityScores.reduce((sum, score) => sum + score, 0) / severityScores.length;
    const severityVariance = this.calculateVariance(severityScores);

    return {
      pattern_type: 'severity',
      description: `Average discrepancy severity: ${averageSeverity.toFixed(1)} (variance: ${severityVariance.toFixed(2)})`,
      significance: averageSeverity / 100,
      confidence: this.calculatePatternConfidence(severityScores.length, discrepancies.length),
      recommendations: averageSeverity > 50 ? ['Investigate root causes of high-severity discrepancies'] : [],
      detected_at: new Date()
    };
  }

  private analyzeTemporalPattern(
    discrepancies: DiscrepancyCheck[],
    config: DiscrepancyDetectionConfig
  ): DiscrepancyPattern {
    const timeGaps = discrepancies.slice(1).map((d, i) =>
      (d.detection_timestamp.getTime() - discrepancies[i].detection_timestamp.getTime()) / (24 * 60 * 60 * 1000)
    );

    const averageGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;

    return {
      pattern_type: 'temporal',
      description: `Discrepancies occur approximately every ${averageGap.toFixed(1)} days`,
      significance: averageGap < 30 ? 0.8 : averageGap < 90 ? 0.5 : 0.2,
      confidence: this.calculatePatternConfidence(timeGaps.length, discrepancies.length),
      recommendations: averageGap < 30 ? ['Address immediate data quality issues'] : [],
      detected_at: new Date()
    };
  }

  private analyzeSourceBiasPattern(
    discrepancies: DiscrepancyCheck[],
    config: DiscrepancyDetectionConfig
  ): DiscrepancyPattern {
    // Analyze if discrepancies consistently favor one source over another
    const projectFavoredCount = discrepancies.filter(d => d.detailed_analysis?.source_reliability?.preferred_source === 'project').length;
    const expertiseFavoredCount = discrepancies.filter(d => d.detailed_analysis?.source_reliability?.preferred_source === 'expertise').length;

    const bias = Math.abs(projectFavoredCount - expertiseFavoredCount) / discrepancies.length;

    return {
      pattern_type: 'source_bias',
      description: `Source bias detected: ${bias > 0.6 ? 'strong' : bias > 0.3 ? 'moderate' : 'weak'} preference for ${projectFavoredCount > expertiseFavoredCount ? 'project' : 'expertise'} data`,
      significance: bias,
      confidence: this.calculatePatternConfidence(discrepancies.length, discrepancies.length),
      recommendations: bias > 0.5 ? ['Review source assessment methodologies', 'Consider rebalancing source weights'] : [],
      detected_at: new Date()
    };
  }

  private calculatePatternConfidence(sampleSize: number, totalPopulation: number): number {
    if (totalPopulation === 0) return 0;
    return Math.min(1.0, sampleSize / totalPopulation);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + (val * values[i]), 0);
    const sumXX = x.reduce((sum, val) => sum + (val * val), 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    return Math.sqrt(this.calculateVariance(values));
  }

  // -------------------------------------------------------------------------
  // RISK PREDICTION METHODS
  // -------------------------------------------------------------------------

  private calculateAgeDifferenceRisk(projectData: any, expertiseData: any): number {
    // Placeholder implementation
    return 0.3;
  }

  private calculateQualityGapRisk(projectData: any, expertiseData: any): number {
    // Placeholder implementation
    return 0.4;
  }

  private calculateVolumeGapRisk(projectData: any, expertiseData: any): number {
    // Placeholder implementation
    return 0.2;
  }

  private calculateTemporalMisalignmentRisk(projectData: any, expertiseData: any): number {
    // Placeholder implementation
    return 0.25;
  }

  private calculateComplexityRisk(projectData: any, expertiseData: any): number {
    // Placeholder implementation
    return 0.35;
  }

  // -------------------------------------------------------------------------
  // STRATEGY RECOMMENDATION METHODS
  // -------------------------------------------------------------------------

  private calculateStrategyConfidence(
    discrepancy: DiscrepancyCheck,
    context: any,
    config: DiscrepancyDetectionConfig
  ): number {
    let confidence = 0.7; // Base confidence

    // Adjust based on discrepancy level
    const levelConfidence = {
      none: 0.95,
      minor: 0.85,
      moderate: 0.75,
      major: 0.65,
      critical: 0.55
    };
    confidence = levelConfidence[discrepancy.discrepancy_level];

    // Adjust based on data quality
    if (context.data_quality_score) {
      confidence *= (0.5 + context.data_quality_score / 2);
    }

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private generateHumanReviewReasoning(discrepancy: DiscrepancyCheck): string {
    const reasons = [];

    if (discrepancy.discrepancy_level === 'critical') {
      reasons.push('Critical discrepancy detected requiring immediate attention');
    }

    if (discrepancy.score_difference > 50) {
      reasons.push(`Large score difference: ${discrepancy.score_difference.toFixed(1)} points`);
    }

    if (!discrepancy.rating_match) {
      reasons.push('Fundamental rating disagreement between data sources');
    }

    if (discrepancy.confidence_gap > 0.4) {
      reasons.push('Significant confidence level gap between sources');
    }

    return reasons.join('. ');
  }

  private determineRequiredReviewers(discrepancy: DiscrepancyCheck): string[] {
    const reviewers = ['rating_specialist'];

    if (discrepancy.discrepancy_level === 'critical') {
      reviewers.push('senior_organiser', 'compliance_manager');
    } else if (discrepancy.discrepancy_level === 'major') {
      reviewers.push('senior_organiser');
    }

    return reviewers;
  }

  private calculateReviewTimeline(discrepancy: DiscrepancyCheck): string {
    const timelines = {
      critical: '24 hours',
      major: '72 hours',
      moderate: '1 week',
      minor: '2 weeks',
      none: '1 month'
    };

    return timelines[discrepancy.discrepancy_level];
  }

  private identifySupportingData(discrepancy: DiscrepancyCheck): string[] {
    const data = ['project_assessments', 'expertise_assessments'];

    if (discrepancy.detailed_analysis?.data_conflicts?.length > 0) {
      data.push('conflict_resolution_history');
    }

    if (discrepancy.contextual_factors) {
      data.push('contextual_information');
    }

    return data;
  }

  private determinePreferredSource(discrepancy: DiscrepancyCheck, context: any): string {
    return discrepancy.detailed_analysis?.source_reliability?.preferred_source || 'balanced';
  }

  private calculateWeightAdjustments(discrepancy: DiscrepancyCheck, preferredSource: string): Record<string, number> {
    const adjustments = {
      project: 1.0,
      expertise: 1.0
    };

    if (preferredSource === 'project') {
      adjustments.project = 1.3;
      adjustments.expertise = 0.7;
    } else if (preferredSource === 'expertise') {
      adjustments.project = 0.7;
      adjustments.expertise = 1.3;
    }

    return adjustments;
  }

  private async applyMLAdjustment(
    strategy: ReconciliationStrategy,
    discrepancy: DiscrepancyCheck,
    context: any,
    config: DiscrepancyDetectionConfig
  ): Promise<ReconciliationStrategy> {
    // Placeholder for ML-based adjustment
    // In a real implementation, this would use a trained ML model
    return strategy;
  }

  // -------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // -------------------------------------------------------------------------

  private generateDiscrepancyCacheKey(
    projectRating: number,
    projectConfidence: ConfidenceLevel,
    expertiseRating: number,
    expertiseConfidence: ConfidenceLevel
  ): string {
    const keyData = {
      projectRating,
      projectConfidence,
      expertiseRating,
      expertiseConfidence
    };

    return btoa(JSON.stringify(keyData));
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class DiscrepancyDetectionError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'DiscrepancyDetectionError';
    this.code = code;
    this.details = details;
  }
}