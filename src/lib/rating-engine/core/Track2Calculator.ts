// Track 2 Calculator - Organiser expertise assessment calculation engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  ExpertiseRatingResult,
  ExpertiseAssessmentSummary,
  ExpertiseRatingBreakdown,
  DataQualityMetrics,
  QualityFactor,
  ReputationAnalysis,
  AccuracyDataPoint,
  PeerComparison
} from '../types/RatingTypes';
import {
  CalculationContext,
  ExpertiseCalculationInput,
  WeightedAssessment,
  AggregatedExpertiseData,
  CalculationConfig
} from '../types/CalculationTypes';

// =============================================================================
// TRACK 2 CALCULATOR INTERFACE
// =============================================================================

export interface ITrack2Calculator {
  calculateRating(
    assessments: any[],
    organiserProfiles: Record<string, any>,
    context: CalculationContext
  ): Promise<ExpertiseRatingResult>;
  calculateQualityMetrics(
    assessments: any[],
    organiserProfiles: Record<string, any>,
    context: CalculationContext
  ): Promise<DataQualityMetrics>;
  calculateReputationAnalysis(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): Promise<ReputationAnalysis>;
}

// =============================================================================
// TRACK 2 CALCULATOR IMPLEMENTATION
// =============================================================================

export class Track2Calculator implements ITrack2Calculator {
  private config: CalculationConfig;

  constructor(config: CalculationConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // MAIN CALCULATION METHOD
  // -------------------------------------------------------------------------

  async calculateRating(
    assessments: any[],
    organiserProfiles: Record<string, any>,
    context: CalculationContext
  ): Promise<ExpertiseRatingResult> {
    const startTime = Date.now();

    try {
      // Filter and validate assessments
      const validAssessments = this.filterValidAssessments(assessments, context);

      if (validAssessments.length === 0) {
        return this.createEmptyResult(context);
      }

      // Group assessments by organiser and calculate reputation-adjusted weights
      const groupedAssessments = this.groupAssessmentsByOrganiser(validAssessments);
      const weightedAssessments = await this.applyReputationWeights(
        groupedAssessments,
        organiserProfiles,
        context
      );

      // Calculate aggregated data
      const aggregatedData = this.calculateAggregatedData(weightedAssessments, organiserProfiles);

      // Calculate final score and rating
      const { finalScore, finalRating } = this.calculateFinalScoreAndRating(aggregatedData);

      // Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(validAssessments, organiserProfiles, context);

      // Generate assessment summaries
      const assessmentSummaries = this.generateAssessmentSummaries(weightedAssessments, organiserProfiles);

      // Generate detailed breakdown
      const breakdown = this.generateRatingBreakdown(aggregatedData, assessmentSummaries);

      // Calculate reputation analysis
      const reputationAnalysis = await this.calculateReputationAnalysis(validAssessments, organiserProfiles);

      // Create result
      const result: ExpertiseRatingResult = {
        rating: finalRating,
        score: finalScore,
        confidence_level: qualityMetrics.data_quality,
        assessment_count: validAssessments.length,
        latest_assessment_date: this.getLatestAssessmentDate(validAssessments),
        data_age_days: this.calculateDataAge(validAssessments, context.calculation_date),
        calculation_date: context.calculation_date,
        assessments: assessmentSummaries,
        breakdown,
        quality_metrics: qualityMetrics,
        reputation_analysis: reputationAnalysis,
        processing_time_ms: Date.now() - startTime,
        calculation_version: '1.0',
        warnings: this.generateWarnings(validAssessments, aggregatedData)
      };

      return result;

    } catch (error) {
      throw new Track2CalculationError(
        'CALCULATION_FAILED',
        `Track 2 calculation failed: ${(error as Error).message}`,
        { employer_id: context.employer_id, error: (error as Error).stack }
      );
    }
  }

  // -------------------------------------------------------------------------
  // QUALITY METRICS CALCULATION
  // -------------------------------------------------------------------------

  async calculateQualityMetrics(
    assessments: any[],
    organiserProfiles: Record<string, any>,
    context: CalculationContext
  ): Promise<DataQualityMetrics> {
    if (assessments.length === 0) {
      return this.createDefaultQualityMetrics();
    }

    // Calculate recency score
    const recencyScore = this.calculateRecencyScore(assessments, context.calculation_date);

    // Calculate completeness score based on organiser coverage
    const completenessScore = this.calculateCompletenessScore(assessments, organiserProfiles);

    // Calculate consistency score between organisers
    const consistencyScore = this.calculateInterOrganiserConsistency(assessments, organiserProfiles);

    // Calculate expertise quality score
    const expertiseScore = this.calculateExpertiseQualityScore(assessments);

    // Calculate overall quality score with expert-specific weighting
    const overallQualityScore = (
      recencyScore * 0.25 +
      completenessScore * 0.25 +
      consistencyScore * 0.25 +
      expertiseScore * 0.25
    );

    // Determine data quality level
    const dataQuality = this.determineDataQuality(overallQualityScore);

    // Generate quality factors
    const factors = this.generateExpertiseQualityFactors(
      recencyScore,
      completenessScore,
      consistencyScore,
      expertiseScore
    );

    // Generate recommendations
    const recommendations = this.generateExpertiseRecommendations(factors, assessments, organiserProfiles);

    return {
      data_quality: dataQuality,
      recency_score: recencyScore,
      completeness_score: completenessScore,
      consistency_score: consistencyScore,
      overall_quality_score: overallQualityScore,
      factors,
      recommendations
    };
  }

  // -------------------------------------------------------------------------
  // REPUTATION ANALYSIS
  // -------------------------------------------------------------------------

  async calculateReputationAnalysis(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): Promise<ReputationAnalysis> {
    // Calculate overall reputation score
    const overallReputationScore = this.calculateOverallReputationScore(assessments, organiserProfiles);

    // Analyze reputation trend
    const reputationTrend = this.calculateReputationTrend(assessments, organiserProfiles);

    // Build accuracy history
    const accuracyHistory = this.buildAccuracyHistory(assessments, organiserProfiles);

    // Calculate consistency score
    const consistencyScore = this.calculateAssessmentConsistency(assessments);

    // Assess expertise level
    const expertiseLevelAssessment = this.assessExpertiseLevel(assessments, organiserProfiles);

    // Perform peer comparison
    const peerComparison = this.performPeerComparison(assessments, organiserProfiles);

    return {
      overall_reputation_score: overallReputationScore,
      reputation_trend: reputationTrend,
      accuracy_history: accuracyHistory,
      consistency_score: consistencyScore,
      expertise_level_assessment: expertiseLevelAssessment,
      peer_comparison: peerComparison
    };
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private filterValidAssessments(assessments: any[], context: CalculationContext): any[] {
    const cutoffDate = new Date(
      context.calculation_date.getTime() - (context.lookback_days.expertise * 24 * 60 * 60 * 1000)
    );

    return assessments.filter(assessment => {
      // Check if assessment is within lookback period
      const assessmentDate = new Date(assessment.assessment_date);
      if (assessmentDate < cutoffDate) {
        return false;
      }

      // Check if assessment is active
      if (!assessment.is_active) {
        return false;
      }

      // Check if assessment has a score
      if (assessment.overall_score === null || assessment.overall_score === undefined) {
        return false;
      }

      // Check if assessment has required fields
      if (!assessment.assessment_basis || assessment.assessment_basis.trim() === '') {
        return false;
      }

      return true;
    });
  }

  private groupAssessmentsByOrganiser(assessments: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const assessment of assessments) {
      const organiserId = assessment.organiser_id;
      if (!grouped[organiserId]) {
        grouped[organiserId] = [];
      }
      grouped[organiserId].push(assessment);
    }

    return grouped;
  }

  private async applyReputationWeights(
    groupedAssessments: Record<string, any[]>,
    organiserProfiles: Record<string, any>,
    context: CalculationContext
  ): Promise<WeightedAssessment[]> {
    const weightedAssessments: WeightedAssessment[] = [];

    for (const [organiserId, organiserAssessments] of Object.entries(groupedAssessments)) {
      const organiserProfile = organiserProfiles[organiserId];
      const reputationMultiplier = this.calculateReputationMultiplier(organiserProfile);

      for (const assessment of organiserAssessments) {
        // Calculate confidence weight
        const confidenceWeight = this.calculateConfidenceWeight(assessment.confidence_level);

        // Calculate decay factor if enabled
        const decayFactor = this.config.decay_settings.enabled
          ? this.calculateDecayFactor(assessment.assessment_date, context.calculation_date)
          : 1.0;

        // Apply reputation adjustment
        const reputationAdjustedWeight = confidenceWeight * reputationMultiplier * decayFactor;

        // Calculate contribution
        const contribution = (assessment.overall_score || 0) * reputationAdjustedWeight;

        weightedAssessments.push({
          assessment,
          weight: confidenceWeight,
          confidence_weight: confidenceWeight,
          decayed_weight: confidenceWeight * decayFactor,
          effective_weight: reputationAdjustedWeight,
          contribution
        });
      }
    }

    return weightedAssessments;
  }

  private calculateReputationMultiplier(organiserProfile: any): number {
    if (!organiserProfile) {
      return 0.7; // Default for unknown organiser
    }

    let multiplier = 1.0;

    // Adjust based on accuracy percentage
    if (organiserProfile.accuracy_percentage) {
      multiplier *= (organiserProfile.accuracy_percentage / 100);
    }

    // Adjust based on reputation score
    if (organiserProfile.overall_reputation_score) {
      multiplier *= (organiserProfile.overall_reputation_score / 100);
    }

    // Adjust based on expertise level
    if (organiserProfile.expertise_level) {
      const expertiseWeights = {
        'senior': 1.2,
        'expert': 1.3,
        'master': 1.4,
        'junior': 0.9,
        'intermediate': 1.0
      };
      multiplier *= expertiseWeights[organiserProfile.expertise_level] || 1.0;
    }

    // Ensure multiplier is within reasonable bounds
    return Math.max(0.3, Math.min(1.5, multiplier));
  }

  private calculateConfidenceWeight(confidenceLevel: ConfidenceLevel): number {
    const weights = {
      high: 1.0,
      medium: 0.8,
      low: 0.6,
      very_low: 0.4
    };
    return weights[confidenceLevel] || 0.5;
  }

  private calculateDecayFactor(assessmentDate: Date, calculationDate: Date): number {
    const daysDiff = (calculationDate.getTime() - assessmentDate.getTime()) / (24 * 60 * 60 * 1000);
    const halfLifeDays = this.config.decay_settings.half_life_days;
    const minimumWeight = this.config.decay_settings.minimum_weight;

    if (daysDiff <= 0) return 1.0;

    // Exponential decay
    const decayFactor = Math.pow(0.5, daysDiff / halfLifeDays);
    return Math.max(decayFactor, minimumWeight);
  }

  private calculateAggregatedData(
    weightedAssessments: WeightedAssessment[],
    organiserProfiles: Record<string, any>
  ): AggregatedExpertiseData {
    const assessmentsByOrganiser: Record<string, WeightedAssessment[]> = {};

    let totalWeightedScore = 0;
    let totalConfidenceWeight = 0;
    let uniqueOrganisers = 0;

    // Group by organiser and calculate totals
    for (const weightedAssessment of weightedAssessments) {
      const assessment = weightedAssessment.assessment;
      const organiserId = assessment.organiser_id;

      // Group by organiser
      if (!assessmentsByOrganiser[organiserId]) {
        assessmentsByOrganiser[organiserId] = [];
        uniqueOrganisers++;
      }
      assessmentsByOrganiser[organiserId].push(weightedAssessment);

      // Calculate totals
      totalWeightedScore += weightedAssessment.contribution;
      totalConfidenceWeight += weightedAssessment.effective_weight;
    }

    // Check if reputation adjustments were applied
    const reputationAdjustedScores = Object.values(assessmentsByOrganiser).some(assessments =>
      assessments.some(wa => {
        const profile = organiserProfiles[wa.assessment.organiser_id];
        return profile && (profile.accuracy_percentage || profile.overall_reputation_score);
      })
    );

    // Calculate date range
    const allDates = weightedAssessments.map(wa => new Date(wa.assessment.assessment_date));
    const earliest = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : undefined;
    const latest = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : undefined;

    // Calculate quality metrics
    const qualityMetrics = this.calculateAggregatedQualityMetrics(weightedAssessments);

    return {
      total_weighted_score: totalWeightedScore,
      total_confidence_weight: totalConfidenceWeight,
      assessment_count: weightedAssessments.length,
      unique_organisers: uniqueOrganisers,
      assessments_by_organiser: assessmentsByOrganiser,
      date_range: { earliest, latest },
      reputation_adjusted_scores: reputationAdjustedScores,
      quality_metrics: qualityMetrics
    };
  }

  private calculateAggregatedQualityMetrics(weightedAssessments: WeightedAssessment[]): DataQualityMetrics {
    // Simplified quality metrics for aggregated data
    const assessmentCount = weightedAssessments.length;
    const uniqueOrganisers = new Set(weightedAssessments.map(wa => wa.assessment.organiser_id)).size;

    // Calculate quality based on number of assessments and unique organisers
    const diversityScore = Math.min((uniqueOrganisers / 3) * 100, 100); // Max 3 organisers
    const volumeScore = Math.min((assessmentCount / 5) * 100, 100); // Max 5 assessments
    const confidenceScore = this.calculateAverageConfidenceLevel(weightedAssessments);

    const overallScore = (diversityScore + volumeScore + confidenceScore) / 3;
    const dataQuality = this.determineDataQuality(overallScore);

    return {
      data_quality: dataQuality,
      recency_score: 0, // Would be calculated based on dates
      completeness_score: diversityScore,
      consistency_score: confidenceScore,
      overall_quality_score: overallScore,
      factors: [],
      recommendations: []
    };
  }

  private calculateFinalScoreAndRating(aggregatedData: AggregatedExpertiseData): {
    finalScore: number;
    finalRating: TrafficLightRating;
  } {
    let finalScore: number;

    if (aggregatedData.total_confidence_weight > 0) {
      finalScore = aggregatedData.total_weighted_score / aggregatedData.total_confidence_weight;
    } else {
      finalScore = 0;
    }

    // Ensure score is within valid range
    finalScore = Math.max(-100, Math.min(100, finalScore));

    // Apply bonus for multiple diverse opinions
    if (aggregatedData.unique_organisers >= 2) {
      finalScore += 2; // Small bonus for consensus
    }

    // Determine rating based on score thresholds
    const finalRating = this.determineRatingFromScore(finalScore);

    return { finalScore, finalRating };
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

  private generateAssessmentSummaries(
    weightedAssessments: WeightedAssessment[],
    organiserProfiles: Record<string, any>
  ): ExpertiseAssessmentSummary[] {
    return weightedAssessments.map(wa => {
      const assessment = wa.assessment;
      const organiserProfile = organiserProfiles[assessment.organiser_id];
      const daysOld = this.calculateDaysOld(assessment.assessment_date, new Date());

      return {
        assessment_id: assessment.id,
        organiser_id: assessment.organiser_id,
        organiser_name: organiserProfile?.name || 'Unknown',
        score: assessment.overall_score,
        rating: assessment.overall_rating || this.determineRatingFromScore(assessment.overall_score),
        confidence_level: assessment.confidence_level,
        assessment_date: new Date(assessment.assessment_date),
        confidence_weight: wa.confidence_weight,
        weighted_score: wa.contribution,
        accuracy_percentage: organiserProfile?.accuracy_percentage,
        reputation_score: organiserProfile?.overall_reputation_score,
        assessment_basis: assessment.assessment_basis,
        knowledge_beyond_projects: assessment.knowledge_beyond_projects,
        union_relationship_quality: assessment.union_relationship_quality,
        is_recent: daysOld <= 90,
        decay_factor: wa.decayed_weight / wa.weight
      };
    });
  }

  private generateRatingBreakdown(
    aggregatedData: AggregatedExpertiseData,
    assessmentSummaries: ExpertiseAssessmentSummary[]
  ): ExpertiseRatingBreakdown {
    const components: ExpertiseRatingComponent[] = [];
    const weightings: Record<string, number> = {};

    // Generate components for each organiser
    for (const [organiserId, organiserAssessments] of Object.entries(aggregatedData.assessments_by_organiser)) {
      const assessments = organiserAssessments as WeightedAssessment[];
      const organiserSummary = assessmentSummaries.find(s => s.organiser_id === organiserId);

      const totalScore = assessments.reduce((sum, wa) => sum + wa.contribution, 0);
      const totalWeight = assessments.reduce((sum, wa) => sum + wa.effective_weight, 0);
      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      // Calculate reputation adjustment
      const organiserProfile = assessmentSummaries.find(s => s.organiser_id === organiserId);
      const reputationAdjustment = this.calculateReputationMultiplier({
        accuracy_percentage: organiserSummary?.accuracy_percentage,
        overall_reputation_score: organiserSummary?.reputation_score,
        expertise_level: organiserSummary?.expertise_level
      });

      // Calculate consistency
      const consistency = this.calculateOrganiserConsistency(assessments);

      components.push({
        organiser_id: organiserId,
        organiser_name: organiserSummary?.organiser_name || 'Unknown',
        score: averageScore,
        confidence_weight: totalWeight,
        weighted_score: totalScore,
        assessment_count: assessments.length,
        reputation_adjustment: reputationAdjustment,
        expertise_level: organiserSummary?.expertise_level,
        accuracy_score: organiserSummary?.accuracy_percentage,
        date_range: {
          earliest: this.getOrganiserEarliestDate(assessments),
          latest: this.getOrganiserLatestDate(assessments)
        },
        consistency_score: consistency
      });

      weightings[organiserId] = totalWeight;
    }

    // Generate calculations
    const calculations = {
      weighted_sum: aggregatedData.total_weighted_score,
      total_confidence_weight: aggregatedData.total_confidence_weight,
      base_score: aggregatedData.total_confidence_weight > 0
        ? aggregatedData.total_weighted_score / aggregatedData.total_confidence_weight
        : 0,
      reputation_adjusted_score: 0, // Would be calculated based on adjustments
      confidence_applied: true,
      reputation_bonus: aggregatedData.reputation_adjusted_scores ? 5 : 0,
      consistency_score: this.calculateOverallConsistency(components)
    };

    return {
      total_score: calculations.base_score,
      max_possible_score: 100,
      components,
      weightings,
      adjustments: [], // Would be populated if there are manual adjustments
      calculations
    };
  }

  // -------------------------------------------------------------------------
  // QUALITY METRICS HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateRecencyScore(assessments: any[], calculationDate: Date): number {
    if (assessments.length === 0) return 0;

    const totalDays = assessments.reduce((sum, assessment) => {
      const daysOld = this.calculateDaysOld(assessment.assessment_date, calculationDate);
      return sum + daysOld;
    }, 0);

    const averageDaysOld = totalDays / assessments.length;

    // Score based on average age (newer is better)
    if (averageDaysOld <= 30) return 100;
    if (averageDaysOld <= 60) return 80;
    if (averageDaysOld <= 90) return 60;
    if (averageDaysOld <= 180) return 40;
    return 20;
  }

  private calculateCompletenessScore(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): number {
    const uniqueOrganisers = new Set(assessments.map(a => a.organiser_id)).size;
    const organiserCount = Object.keys(organiserProfiles).length;

    if (organiserCount === 0) return 0;

    // Score based on proportion of organisers who have provided assessments
    return (uniqueOrganisers / organiserCount) * 100;
  }

  private calculateInterOrganiserConsistency(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): number {
    const groupedByOrganiser = this.groupAssessmentsByOrganiser(assessments);
    const organiserAverages: Record<string, number> = {};

    // Calculate average score for each organiser
    for (const [organiserId, organiserAssessments] of Object.entries(groupedByOrganiser)) {
      const scores = organiserAssessments.map(a => a.overall_score).filter(s => s !== null);
      if (scores.length > 0) {
        organiserAverages[organiserId] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      }
    }

    const averages = Object.values(organiserAverages);
    if (averages.length < 2) return 100; // No inconsistency if only one organiser

    // Calculate variance between organiser averages
    const mean = averages.reduce((sum, avg) => sum + avg, 0) / averages.length;
    const variance = averages.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) / averages.length;

    // Convert variance to consistency score (lower variance = higher consistency)
    return Math.max(0, 100 - (variance * 2));
  }

  private calculateExpertiseQualityScore(assessments: any[]): number {
    if (assessments.length === 0) return 0;

    let totalQualityScore = 0;

    for (const assessment of assessments) {
      let qualityScore = 50; // Base score

      // Bonus for detailed assessment basis
      if (assessment.assessment_basis && assessment.assessment_basis.length > 50) {
        qualityScore += 10;
      }

      // Bonus for knowledge beyond projects
      if (assessment.knowledge_beyond_projects) {
        qualityScore += 15;
      }

      // Bonus for union relationship quality assessment
      if (assessment.union_relationship_quality) {
        qualityScore += 10;
      }

      // Bonus for recent improvements or future concerns tracking
      if (assessment.recent_improvements || assessment.future_concerns) {
        qualityScore += 5;
      }

      // Penalty for minimal assessment basis
      if (assessment.assessment_basis && assessment.assessment_basis.length < 20) {
        qualityScore -= 10;
      }

      totalQualityScore += Math.max(0, Math.min(100, qualityScore));
    }

    return totalQualityScore / assessments.length;
  }

  private determineDataQuality(score: number): ConfidenceLevel {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'very_low';
  }

  private generateExpertiseQualityFactors(
    recencyScore: number,
    completenessScore: number,
    consistencyScore: number,
    expertiseScore: number
  ): QualityFactor[] {
    return [
      {
        name: 'Assessment Recency',
        score: recencyScore,
        weight: 0.25,
        description: 'How recent the expertise assessments are',
        impact: this.getImpactLevel(recencyScore),
        trend: 'stable'
      },
      {
        name: 'Organiser Coverage',
        score: completenessScore,
        weight: 0.25,
        description: 'Diversity of organiser opinions',
        impact: this.getImpactLevel(completenessScore),
        trend: 'stable'
      },
      {
        name: 'Inter-Organiser Consistency',
        score: consistencyScore,
        weight: 0.25,
        description: 'Agreement between different organisers',
        impact: this.getImpactLevel(consistencyScore),
        trend: 'stable'
      },
      {
        name: 'Assessment Quality',
        score: expertiseScore,
        weight: 0.25,
        description: 'Depth and quality of assessment details',
        impact: this.getImpactLevel(expertiseScore),
        trend: 'stable'
      }
    ];
  }

  private getImpactLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    return 'high';
  }

  private generateExpertiseRecommendations(
    factors: QualityFactor[],
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): any[] {
    const recommendations: any[] = [];

    for (const factor of factors) {
      if (factor.score < 60) {
        recommendations.push({
          priority: factor.score < 40 ? 'high' : 'medium',
          action: `Improve ${factor.name.toLowerCase()}`,
          expected_improvement: 60 - factor.score,
          effort: 'moderate',
          timeframe: '30-60 days'
        });
      }
    }

    // Add specific recommendations based on assessment patterns
    const uniqueOrganisers = new Set(assessments.map(a => a.organiser_id)).size;

    if (uniqueOrganisers < 2) {
      recommendations.push({
        priority: 'medium',
        action: 'Seek additional organiser assessments for diverse perspectives',
        expected_improvement: 25,
        effort: 'moderate',
        timeframe: '30-90 days'
      });
    }

    // Check for low-quality assessments
    const lowQualityAssessments = assessments.filter(a =>
      !a.assessment_basis || a.assessment_basis.length < 20
    );

    if (lowQualityAssessments.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Improve detail and quality of assessment justifications',
        expected_improvement: 30,
        effort: 'moderate',
        timeframe: '30 days'
      });
    }

    return recommendations;
  }

  // -------------------------------------------------------------------------
  // REPUTATION ANALYSIS HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateOverallReputationScore(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): number {
    let totalReputation = 0;
    let organiserCount = 0;

    for (const assessment of assessments) {
      const profile = organiserProfiles[assessment.organiser_id];
      if (profile) {
        let reputationScore = 50; // Base score

        if (profile.accuracy_percentage) {
          reputationScore += (profile.accuracy_percentage / 100) * 30;
        }

        if (profile.overall_reputation_score) {
          reputationScore += (profile.overall_reputation_score / 100) * 20;
        }

        totalReputation += reputationScore;
        organiserCount++;
      }
    }

    return organiserCount > 0 ? totalReputation / organiserCount : 50;
  }

  private calculateReputationTrend(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): 'improving' | 'stable' | 'declining' {
    // Group assessments by quarter and calculate average reputation scores
    const quarterlyData = this.groupAssessmentsByQuarter(assessments, organiserProfiles);

    if (quarterlyData.length < 2) return 'stable';

    const recentScores = quarterlyData.slice(-2).map(q => q.averageReputation);
    const trend = recentScores[1] - recentScores[0];

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  private buildAccuracyHistory(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): AccuracyDataPoint[] {
    const history: AccuracyDataPoint[] = [];
    const organiserData: Record<string, any[]> = {};

    // Group assessments by organiser and month
    for (const assessment of assessments) {
      const organiserId = assessment.organiser_id;
      const profile = organiserProfiles[organiserId];

      if (!organiserData[organiserId]) {
        organiserData[organiserId] = [];
      }

      organiserData[organiserId].push({
        date: new Date(assessment.assessment_date),
        confidence_level: assessment.confidence_level,
        accuracy_percentage: profile?.accuracy_percentage
      });
    }

    // Build history points
    for (const [organiserId, organiserAssessments] of Object.entries(organiserData)) {
      const sortedAssessments = organiserAssessments.sort((a, b) => a.date.getTime() - b.date.getTime());

      for (const assessment of sortedAssessments) {
        history.push({
          date: assessment.date,
          accuracy_percentage: assessment.accuracy_percentage || 75,
          assessment_count: organiserAssessments.length,
          confidence_level: assessment.confidence_level
        });
      }
    }

    return history.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateAssessmentConsistency(assessments: any[]): number {
    const groupedByOrganiser = this.groupAssessmentsByOrganiser(assessments);
    const organiserAverages: number[] = [];

    for (const organiserAssessments of Object.values(groupedByOrganiser)) {
      const scores = organiserAssessments.map(a => a.overall_score).filter(s => s !== null);
      if (scores.length > 0) {
        organiserAverages.push(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      }
    }

    if (organiserAverages.length < 2) return 100;

    const mean = organiserAverages.reduce((sum, avg) => sum + avg, 0) / organiserAverages.length;
    const variance = organiserAverages.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) / organiserAverages.length;

    return Math.max(0, 100 - (variance * 2));
  }

  private assessExpertiseLevel(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): string {
    const expertiseLevels = new Set(
      assessments
        .map(a => organiserProfiles[a.organiser_id]?.expertise_level)
        .filter(level => level)
    );

    if (expertiseLevels.has('master') || expertiseLevels.has('expert')) {
      return 'Senior expertise with expert-level assessors';
    } else if (expertiseLevels.has('senior')) {
      return 'Experienced expertise with senior assessors';
    } else if (expertiseLevels.has('intermediate')) {
      return 'Developing expertise with intermediate assessors';
    } else {
      return 'Limited expertise with junior assessors';
    }
  }

  private performPeerComparison(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): PeerComparison {
    const ourReputation = this.calculateOverallReputationScore(assessments, organiserProfiles);

    // This would typically compare against a database of all organisers
    // For now, provide a placeholder implementation
    const percentileRank = Math.min(90, ourReputation * 0.9);
    const comparisonGroupSize = 100; // Placeholder
    const averageAccuracy = 75; // Placeholder

    let relativePerformance: 'above_average' | 'average' | 'below_average';
    if (ourReputation >= 85) relativePerformance = 'above_average';
    else if (ourReputation >= 70) relativePerformance = 'average';
    else relativePerformance = 'below_average';

    return {
      percentile_rank: percentileRank,
      comparison_group_size: comparisonGroupSize,
      average_accuracy: averageAccuracy,
      relative_performance: relativePerformance
    };
  }

  // -------------------------------------------------------------------------
  // UTILITY HELPER METHODS
  // -------------------------------------------------------------------------

  private groupAssessmentsByQuarter(
    assessments: any[],
    organiserProfiles: Record<string, any>
  ): { quarter: Date; averageReputation: number; assessmentCount: number }[] {
    const quarterlyData: Record<string, { reputation: number; count: number }> = {};

    for (const assessment of assessments) {
      const date = new Date(assessment.assessment_date);
      const quarter = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;

      const profile = organiserProfiles[assessment.organiser_id];
      const reputationScore = profile?.overall_reputation_score || 75;

      if (!quarterlyData[quarter]) {
        quarterlyData[quarter] = { reputation: 0, count: 0 };
      }

      quarterlyData[quarter].reputation += reputationScore;
      quarterlyData[quarter].count += 1;
    }

    return Object.entries(quarterlyData)
      .map(([quarter, data]) => ({
        quarter: new Date(quarter.split('-')[0], (parseInt(quarter.split('-')[1].replace('Q', '')) - 1) * 3),
        averageReputation: data.reputation / data.count,
        assessmentCount: data.count
      }))
      .sort((a, b) => a.quarter.getTime() - b.quarter.getTime());
  }

  private createEmptyResult(context: CalculationContext): ExpertiseRatingResult {
    return {
      rating: 'unknown',
      score: null,
      confidence_level: 'very_low',
      assessment_count: 0,
      calculation_date: context.calculation_date,
      assessments: [],
      quality_metrics: this.createDefaultQualityMetrics(),
      processing_time_ms: 0,
      calculation_version: '1.0'
    };
  }

  private createDefaultQualityMetrics(): DataQualityMetrics {
    return {
      data_quality: 'very_low',
      recency_score: 0,
      completeness_score: 0,
      consistency_score: 0,
      overall_quality_score: 0,
      factors: [],
      recommendations: []
    };
  }

  private getLatestAssessmentDate(assessments: any[]): Date | undefined {
    if (assessments.length === 0) return undefined;

    return assessments.reduce((latest, assessment) => {
      const assessmentDate = new Date(assessment.assessment_date);
      return assessmentDate > latest ? assessmentDate : latest;
    }, new Date(assessments[0].assessment_date));
  }

  private calculateDataAge(assessments: any[], calculationDate: Date): number | undefined {
    const latestDate = this.getLatestAssessmentDate(assessments);
    if (!latestDate) return undefined;

    return this.calculateDaysOld(latestDate, calculationDate);
  }

  private calculateDaysOld(date: Date | string, fromDate: Date): number {
    const assessmentDate = typeof date === 'string' ? new Date(date) : date;
    return Math.floor((fromDate.getTime() - assessmentDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  private calculateAverageConfidenceLevel(weightedAssessments: WeightedAssessment[]): ConfidenceLevel {
    const confidenceScores = weightedAssessments.map(wa => {
      const levels = { high: 100, medium: 75, low: 50, very_low: 25 };
      return levels[wa.assessment.confidence_level] || 50;
    });

    const averageScore = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;

    if (averageScore >= 80) return 'high';
    if (averageScore >= 65) return 'medium';
    if (averageScore >= 50) return 'low';
    return 'very_low';
  }

  private calculateOrganiserConsistency(assessments: WeightedAssessment[]): number {
    const scores = assessments.map(wa => wa.assessment.overall_score).filter(s => s !== null);
    if (scores.length < 2) return 100;

    const variance = this.calculateVariance(scores);
    return Math.max(0, 100 - (variance * 2));
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private getOrganiserEarliestDate(assessments: WeightedAssessment[]): Date | undefined {
    if (assessments.length === 0) return undefined;

    return assessments.reduce((earliest, wa) => {
      const assessmentDate = new Date(wa.assessment.assessment_date);
      return assessmentDate < earliest ? assessmentDate : earliest;
    }, new Date(assessments[0].assessment.assessment_date));
  }

  private getOrganiserLatestDate(assessments: WeightedAssessment[]): Date | undefined {
    if (assessments.length === 0) return undefined;

    return assessments.reduce((latest, wa) => {
      const assessmentDate = new Date(wa.assessment.assessment_date);
      return assessmentDate > latest ? assessmentDate : latest;
    }, new Date(assessments[0].assessment.assessment_date));
  }

  private calculateOverallConsistency(components: ExpertiseRatingComponent[]): number {
    if (components.length < 2) return 100;

    const scores = components.map(c => c.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    return Math.max(0, 100 - (variance * 2));
  }

  private generateWarnings(assessments: any[], aggregatedData: AggregatedExpertiseData): string[] {
    const warnings: string[] = [];

    if (assessments.length === 0) {
      warnings.push('No expertise assessment data available');
      return warnings;
    }

    if (assessments.length === 1) {
      warnings.push('Only one expertise assessment available - results may not be representative');
    }

    if (aggregatedData.unique_organisers === 1) {
      warnings.push('Assessments from only one organiser - consider seeking additional perspectives');
    }

    const latestDate = this.getLatestAssessmentDate(assessments);
    if (latestDate) {
      const daysOld = this.calculateDaysOld(latestDate, new Date());
      if (daysOld > 120) {
        warnings.push('Expertise assessments are outdated - consider conducting new assessments');
      }
    }

    // Check for low-quality assessments
    const lowQualityCount = assessments.filter(a =>
      !a.assessment_basis || a.assessment_basis.length < 20
    ).length;

    if (lowQualityCount > 0) {
      warnings.push(`${lowQualityCount} assessment(s) have minimal justification`);
    }

    return warnings;
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class Track2CalculationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'Track2CalculationError';
    this.code = code;
    this.details = details;
  }
}