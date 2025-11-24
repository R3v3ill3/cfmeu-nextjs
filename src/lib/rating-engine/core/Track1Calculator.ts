// Track 1 Calculator - Project compliance assessment calculation engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  ComplianceAssessmentType,
  ProjectRatingResult,
  ProjectAssessmentSummary,
  ProjectRatingBreakdown,
  DataQualityMetrics,
  QualityFactor,
  ProjectTrendAnalysis,
  TrendFactor,
  RatingChange
} from '../types/RatingTypes';
import {
  CalculationContext,
  ProjectCalculationInput,
  WeightedAssessment,
  AggregatedProjectData,
  DataQualityIssue,
  CalculationConfig
} from '../types/CalculationTypes';

// =============================================================================
// TRACK 1 CALCULATOR INTERFACE
// =============================================================================

export interface ITrack1Calculator {
  calculateRating(
    assessments: any[],
    context: CalculationContext
  ): Promise<ProjectRatingResult>;
  calculateQualityMetrics(
    assessments: any[],
    context: CalculationContext
  ): Promise<DataQualityMetrics>;
  calculateTrendAnalysis(
    assessments: any[],
    context: CalculationContext
  ): Promise<ProjectTrendAnalysis | null>;
}

// =============================================================================
// TRACK 1 CALCULATOR IMPLEMENTATION
// =============================================================================

export class Track1Calculator implements ITrack1Calculator {
  private config: CalculationConfig;

  constructor(config: CalculationConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // MAIN CALCULATION METHOD
  // -------------------------------------------------------------------------

  async calculateRating(
    assessments: any[],
    context: CalculationContext
  ): Promise<ProjectRatingResult> {
    const startTime = Date.now();

    try {
      // Filter and validate assessments
      const validAssessments = this.filterValidAssessments(assessments, context);

      if (validAssessments.length === 0) {
        return this.createEmptyResult(context);
      }

      // Group assessments by type and apply weights
      const groupedAssessments = this.groupAssessmentsByType(validAssessments);
      const weightedAssessments = await this.applyWeightsAndDecay(groupedAssessments, context);

      // Calculate aggregated data
      const aggregatedData = this.calculateAggregatedData(weightedAssessments, context);

      // Calculate final score and rating
      const { finalScore, finalRating } = this.calculateFinalScoreAndRating(aggregatedData);

      // Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(validAssessments, context);

      // Generate assessment summaries
      const assessmentSummaries = this.generateAssessmentSummaries(weightedAssessments);

      // Generate detailed breakdown
      const breakdown = this.generateRatingBreakdown(aggregatedData, assessmentSummaries);

      // Calculate trend analysis if we have sufficient data
      const trendAnalysis = await this.calculateTrendAnalysis(validAssessments, context);

      // Create result
      const result: ProjectRatingResult = {
        rating: finalRating,
        score: finalScore,
        data_quality: qualityMetrics.data_quality,
        assessment_count: validAssessments.length,
        latest_assessment_date: this.getLatestAssessmentDate(validAssessments),
        earliest_assessment_date: this.getEarliestAssessmentDate(validAssessments),
        data_age_days: this.calculateDataAge(validAssessments, context.calculation_date),
        calculation_date: context.calculation_date,
        assessments: assessmentSummaries,
        breakdown,
        quality_metrics: qualityMetrics,
        trend_analysis: trendAnalysis,
        processing_time_ms: Date.now() - startTime,
        calculation_version: '1.0',
        warnings: this.generateWarnings(validAssessments, aggregatedData)
      };

      return result;

    } catch (error) {
      throw new Track1CalculationError(
        'CALCULATION_FAILED',
        `Track 1 calculation failed: ${(error as Error).message}`,
        { employer_id: context.employer_id, error: (error as Error).stack }
      );
    }
  }

  // -------------------------------------------------------------------------
  // QUALITY METRICS CALCULATION
  // -------------------------------------------------------------------------

  async calculateQualityMetrics(
    assessments: any[],
    context: CalculationContext
  ): Promise<DataQualityMetrics> {
    if (assessments.length === 0) {
      return this.createDefaultQualityMetrics();
    }

    // Calculate recency score
    const recencyScore = this.calculateRecencyScore(assessments, context.calculation_date);

    // Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(assessments);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(assessments);

    // Calculate overall quality score
    const overallQualityScore = (
      recencyScore * 0.4 +
      completenessScore * 0.3 +
      consistencyScore * 0.3
    );

    // Determine data quality level
    const dataQuality = this.determineDataQuality(overallQualityScore);

    // Generate quality factors
    const factors = this.generateQualityFactors(
      recencyScore,
      completenessScore,
      consistencyScore
    );

    // Generate recommendations
    const recommendations = this.generateQualityRecommendations(factors, assessments);

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
  // TREND ANALYSIS
  // -------------------------------------------------------------------------

  async calculateTrendAnalysis(
    assessments: any[],
    context: CalculationContext
  ): Promise<ProjectTrendAnalysis | null> {
    if (assessments.length < 3) {
      return null; // Insufficient data for trend analysis
    }

    // Sort assessments by date
    const sortedAssessments = assessments
      .filter(a => a.assessment_date)
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime());

    // Calculate trend direction and strength
    const trendDirection = this.calculateTrendDirection(sortedAssessments);
    const trendStrength = this.calculateTrendStrength(sortedAssessments);

    // Calculate score changes
    const scoreChange30d = this.calculateScoreChange(sortedAssessments, 30);
    const scoreChange90d = this.calculateScoreChange(sortedAssessments, 90);

    // Identify rating changes
    const ratingChanges = this.identifyRatingChanges(sortedAssessments);

    // Identify key factors
    const keyFactors = this.identifyTrendFactors(sortedAssessments);

    // Generate forecast if we have sufficient data
    const forecast = assessments.length >= 6 ? this.generateTrendForecast(sortedAssessments) : undefined;

    return {
      trend_direction: trendDirection,
      trend_strength: trendStrength,
      score_change_30d: scoreChange30d,
      score_change_90d: scoreChange90d,
      rating_changes: ratingChanges,
      key_factors: keyFactors,
      forecast
    };
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private filterValidAssessments(assessments: any[], context: CalculationContext): any[] {
    const cutoffDate = new Date(
      context.calculation_date.getTime() - (context.lookback_days.project * 24 * 60 * 60 * 1000)
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
      if (assessment.score === null || assessment.score === undefined) {
        return false;
      }

      return true;
    });
  }

  private groupAssessmentsByType(assessments: any[]): Record<ComplianceAssessmentType, any[]> {
    const grouped: Record<ComplianceAssessmentType, any[]> = {} as any;

    for (const assessment of assessments) {
      const type = assessment.assessment_type as ComplianceAssessmentType;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(assessment);
    }

    return grouped;
  }

  private async applyWeightsAndDecay(
    groupedAssessments: Record<ComplianceAssessmentType, any[]>,
    context: CalculationContext
  ): Promise<WeightedAssessment[]> {
    const weightedAssessments: WeightedAssessment[] = [];

    for (const [assessmentType, typeAssessments] of Object.entries(groupedAssessments)) {
      const weight = this.config.assessment_weights[assessmentType as ComplianceAssessmentType] || 1.0;

      for (const assessment of typeAssessments) {
        // Calculate confidence weight
        const confidenceWeight = this.calculateConfidenceWeight(assessment.confidence_level);

        // Calculate decay factor if enabled
        const decayFactor = this.config.decay_settings.enabled
          ? this.calculateDecayFactor(assessment.assessment_date, context.calculation_date)
          : 1.0;

        // Calculate effective weight
        const effectiveWeight = weight * confidenceWeight * decayFactor;

        // Calculate contribution
        const contribution = (assessment.score || 0) * effectiveWeight;

        weightedAssessments.push({
          assessment,
          weight,
          confidence_weight: confidenceWeight,
          decayed_weight: weight * decayFactor,
          effective_weight: effectiveWeight,
          contribution
        });
      }
    }

    return weightedAssessments;
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
    context: CalculationContext
  ): AggregatedProjectData {
    const assessmentsByType: Record<ComplianceAssessmentType, WeightedAssessment[]> = {} as any;
    const severityImpacts: Record<string, number> = {};

    let totalWeightedScore = 0;
    let totalWeight = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;

    // Group by type and calculate totals
    for (const weightedAssessment of weightedAssessments) {
      const assessment = weightedAssessment.assessment;
      const type = assessment.assessment_type as ComplianceAssessmentType;

      // Group by type
      if (!assessmentsByType[type]) {
        assessmentsByType[type] = [];
      }
      assessmentsByType[type].push(weightedAssessment);

      // Calculate totals
      totalWeightedScore += weightedAssessment.contribution;
      totalWeight += weightedAssessment.effective_weight;

      // Track severity impacts
      if (assessment.severity_level) {
        const key = `${type}_severity_${assessment.severity_level}`;
        severityImpacts[key] = (severityImpacts[key] || 0) + 1;
      }

      // Track date range
      const assessmentDate = new Date(assessment.assessment_date);
      if (!earliestDate || assessmentDate < earliestDate) {
        earliestDate = assessmentDate;
      }
      if (!latestDate || assessmentDate > latestDate) {
        latestDate = assessmentDate;
      }
    }

    // Calculate quality metrics
    const qualityMetrics = this.calculateAggregatedQualityMetrics(weightedAssessments, context);

    return {
      total_weighted_score: totalWeightedScore,
      total_weight: totalWeight,
      assessment_count: weightedAssessments.length,
      assessments_by_type: assessmentsByType,
      date_range: { earliest: earliestDate, latest: latestDate },
      quality_metrics: qualityMetrics,
      severity_impacts: severityImpacts
    };
  }

  private calculateAggregatedQualityMetrics(
    weightedAssessments: WeightedAssessment[],
    context: CalculationContext
  ): DataQualityMetrics {
    // This is a simplified version - the full implementation would be more sophisticated
    const assessmentCount = weightedAssessments.length;
    const recencyScore = this.calculateAverageRecency(weightedAssessments, context.calculation_date);
    const completenessScore = this.calculateTypeCompleteness(weightedAssessments);
    const consistencyScore = this.calculateScoreConsistency(weightedAssessments);

    const overallScore = (recencyScore + completenessScore + consistencyScore) / 3;
    const dataQuality = this.determineDataQuality(overallScore);

    return {
      data_quality: dataQuality,
      recency_score: recencyScore,
      completeness_score: completenessScore,
      consistency_score: consistencyScore,
      overall_quality_score: overallScore,
      factors: [],
      recommendations: []
    };
  }

  private calculateFinalScoreAndRating(aggregatedData: AggregatedProjectData): {
    finalScore: number;
    finalRating: TrafficLightRating;
  } {
    let finalScore: number;

    if (aggregatedData.total_weight > 0) {
      finalScore = aggregatedData.total_weighted_score / aggregatedData.total_weight;
    } else {
      finalScore = 0;
    }

    // Ensure score is within valid range
    finalScore = Math.max(-100, Math.min(100, finalScore));

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

  private generateAssessmentSummaries(weightedAssessments: WeightedAssessment[]): ProjectAssessmentSummary[] {
    return weightedAssessments.map(wa => {
      const assessment = wa.assessment;
      const daysOld = this.calculateDaysOld(assessment.assessment_date, new Date());

      return {
        assessment_type: assessment.assessment_type,
        score: assessment.score,
        rating: assessment.rating || this.determineRatingFromScore(assessment.score),
        confidence_level: assessment.confidence_level,
        assessment_date: new Date(assessment.assessment_date),
        weight: wa.weight,
        severity_level: assessment.severity_level,
        severity_name: this.getSeverityName(assessment.assessment_type, assessment.severity_level),
        weighted_score: wa.contribution,
        project_id: assessment.project_id,
        organiser_id: assessment.organiser_id,
        assessment_notes: assessment.assessment_notes,
        is_recent: daysOld <= 90,
        decay_factor: wa.decayed_weight / wa.weight
      };
    });
  }

  private generateRatingBreakdown(
    aggregatedData: AggregatedProjectData,
    assessmentSummaries: ProjectAssessmentSummary[]
  ): ProjectRatingBreakdown {
    const components: ProjectRatingComponent[] = [];
    const weightings: Record<ComplianceAssessmentType, number> = {};

    // Generate components for each assessment type
    for (const [assessmentType, assessments] of Object.entries(aggregatedData.assessments_by_type)) {
      const typeAssessments = assessments as WeightedAssessment[];
      const totalScore = typeAssessments.reduce((sum, wa) => sum + wa.contribution, 0);
      const totalWeight = typeAssessments.reduce((sum, wa) => sum + wa.effective_weight, 0);
      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      // Calculate severity distribution
      const severityDistribution: Record<number, number> = {};
      for (const wa of typeAssessments) {
        const severity = wa.assessment.severity_level || 1;
        severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;
      }

      // Calculate trend direction
      const trendDirection = this.calculateComponentTrend(typeAssessments);

      // Calculate recency score
      const recencyScore = this.calculateComponentRecency(typeAssessments);

      components.push({
        assessment_type: assessmentType as ComplianceAssessmentType,
        score: averageScore,
        weight: this.config.assessment_weights[assessmentType as ComplianceAssessmentType] || 1.0,
        weighted_score: totalScore,
        confidence_level: this.calculateAverageConfidence(typeAssessments),
        assessment_count: typeAssessments.length,
        date_range: {
          earliest: this.getComponentEarliestDate(typeAssessments),
          latest: this.getComponentLatestDate(typeAssessments)
        },
        severity_distribution: severityDistribution,
        trend_direction: trendDirection,
        recency_score: recencyScore
      });

      weightings[assessmentType as ComplianceAssessmentType] = this.config.assessment_weights[assessmentType as ComplianceAssessmentType] || 1.0;
    }

    // Generate calculations
    const calculations = {
      weighted_sum: aggregatedData.total_weighted_score,
      total_weight: aggregatedData.total_weight,
      base_score: aggregatedData.total_weight > 0 ? aggregatedData.total_weighted_score / aggregatedData.total_weight : 0,
      adjusted_score: 0, // Would be calculated based on adjustments
      decay_applied: this.config.decay_settings.enabled,
      severity_impacts: aggregatedData.severity_impacts,
      time_decay_factors: this.calculateTimeDecayFactors(assessmentSummaries)
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

  private calculateCompletenessScore(assessments: any[]): number {
    const requiredTypes: ComplianceAssessmentType[] = [
      'cbus_status',
      'incolink_status',
      'eca_status',
      'safety_incidents'
    ];

    const presentTypes = new Set(assessments.map(a => a.assessment_type));
    const presentCount = requiredTypes.filter(type => presentTypes.has(type)).length;

    return (presentCount / requiredTypes.length) * 100;
  }

  private calculateConsistencyScore(assessments: any[]): number {
    if (assessments.length < 2) return 100;

    // Calculate score variance by assessment type
    const typeGroups = this.groupAssessmentsByType(assessments);
    let totalVariance = 0;
    let typeCount = 0;

    for (const [type, typeAssessments] of Object.entries(typeGroups)) {
      if (typeAssessments.length >= 2) {
        const scores = typeAssessments.map(a => a.score).filter(s => s !== null);
        if (scores.length > 0) {
          const variance = this.calculateVariance(scores);
          totalVariance += variance;
          typeCount++;
        }
      }
    }

    const averageVariance = typeCount > 0 ? totalVariance / typeCount : 0;

    // Convert variance to consistency score (lower variance = higher consistency)
    return Math.max(0, 100 - (averageVariance * 2));
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private determineDataQuality(score: number): ConfidenceLevel {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'very_low';
  }

  private generateQualityFactors(
    recencyScore: number,
    completenessScore: number,
    consistencyScore: number
  ): QualityFactor[] {
    return [
      {
        name: 'Data Recency',
        score: recencyScore,
        weight: 0.4,
        description: 'How recent the assessment data is',
        impact: this.getImpactLevel(recencyScore),
        trend: 'stable' // Would be calculated based on historical data
      },
      {
        name: 'Data Completeness',
        score: completenessScore,
        weight: 0.3,
        description: 'Coverage of required assessment types',
        impact: this.getImpactLevel(completenessScore),
        trend: 'stable'
      },
      {
        name: 'Data Consistency',
        score: consistencyScore,
        weight: 0.3,
        description: 'Consistency of scores within assessment types',
        impact: this.getImpactLevel(consistencyScore),
        trend: 'stable'
      }
    ];
  }

  private getImpactLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    return 'high';
  }

  private generateQualityRecommendations(factors: QualityFactor[], assessments: any[]): any[] {
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
    const recentAssessments = assessments.filter(a =>
      this.calculateDaysOld(a.assessment_date, new Date()) <= 90
    );

    if (recentAssessments.length < 3) {
      recommendations.push({
        priority: 'high',
        action: 'Conduct more recent assessments',
        expected_improvement: 30,
        effort: 'significant',
        timeframe: '30-90 days'
      });
    }

    return recommendations;
  }

  // -------------------------------------------------------------------------
  // TREND ANALYSIS HELPER METHODS
  // -------------------------------------------------------------------------

  private calculateTrendDirection(assessments: any[]): 'improving' | 'stable' | 'declining' | 'volatile' | 'insufficient_data' {
    if (assessments.length < 3) return 'insufficient_data';

    // Group assessments by month and calculate monthly averages
    const monthlyScores = this.calculateMonthlyAverageScores(assessments);

    if (monthlyScores.length < 3) return 'insufficient_data';

    // Calculate trend using linear regression
    const trend = this.calculateLinearTrend(monthlyScores.map(m => m.score));

    // Calculate volatility
    const volatility = this.calculateVolatility(monthlyScores.map(m => m.score));

    if (volatility > 30) return 'volatile';
    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  private calculateTrendStrength(assessments: any[]): 'weak' | 'moderate' | 'strong' {
    const monthlyScores = this.calculateMonthlyAverageScores(assessments);
    if (monthlyScores.length < 3) return 'weak';

    const trend = Math.abs(this.calculateLinearTrend(monthlyScores.map(m => m.score)));
    const consistency = 100 - this.calculateVolatility(monthlyScores.map(m => m.score));

    if (trend > 10 && consistency > 70) return 'strong';
    if (trend > 5 && consistency > 50) return 'moderate';
    return 'weak';
  }

  private calculateMonthlyAverageScores(assessments: any[]): { month: Date; score: number }[] {
    const monthlyData: Record<string, number[]> = {};

    for (const assessment of assessments) {
      if (assessment.score === null) continue;

      const date = new Date(assessment.assessment_date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(assessment.score);
    }

    return Object.entries(monthlyData)
      .map(([monthKey, scores]) => ({
        month: new Date(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1])),
        score: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))
      .sort((a, b) => a.month.getTime() - b.month.getTime());
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + (val * y[i]), 0);
    const sumXX = x.reduce((sum, val) => sum + (val * val), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const variance = this.calculateVariance(values);
    return Math.sqrt(variance);
  }

  private calculateScoreChange(assessments: any[], days: number): number {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const recentAssessments = assessments.filter(a => new Date(a.assessment_date) >= cutoffDate);
    const olderAssessments = assessments.filter(a => new Date(a.assessment_date) < cutoffDate);

    if (recentAssessments.length === 0 || olderAssessments.length === 0) return 0;

    const recentAverage = recentAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / recentAssessments.length;
    const olderAverage = olderAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / olderAssessments.length;

    return recentAverage - olderAverage;
  }

  private identifyRatingChanges(assessments: any[]): RatingChange[] {
    const changes: RatingChange[] = [];
    const sortedAssessments = assessments
      .filter(a => a.assessment_date && a.score !== null)
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime());

    for (let i = 1; i < sortedAssessments.length; i++) {
      const current = sortedAssessments[i];
      const previous = sortedAssessments[i - 1];

      const currentRating = this.determineRatingFromScore(current.score);
      const previousRating = this.determineRatingFromScore(previous.score);

      if (currentRating !== previousRating) {
        changes.push({
          date: new Date(current.assessment_date),
          previous_rating: previousRating,
          new_rating: currentRating,
          reason: 'Score threshold crossed',
          assessment_types: [current.assessment_type]
        });
      }
    }

    return changes;
  }

  private identifyTrendFactors(assessments: any[]): TrendFactor[] {
    // This is a simplified implementation - would analyze which assessment types
    // are driving the trend
    const factors: TrendFactor[] = [];

    const typeGroups = this.groupAssessmentsByType(assessments);
    for (const [type, typeAssessments] of Object.entries(typeGroups)) {
      if (typeAssessments.length >= 3) {
        const trend = this.calculateTrendDirection(typeAssessments);
        const impact = Math.abs(this.calculateLinearTrend(typeAssessments.map(a => a.score)));

        if (trend !== 'stable' && impact > 5) {
          factors.push({
            factor: `${type.replace(/_/g, ' ')} trend`,
            impact: impact,
            confidence: 'medium',
            description: `${type} assessments showing ${trend} trend`,
            assessment_type: type as ComplianceAssessmentType
          });
        }
      }
    }

    return factors;
  }

  private generateTrendForecast(assessments: any[]): any {
    // Simplified forecast implementation
    const monthlyScores = this.calculateMonthlyAverageScores(assessments);
    const trend = this.calculateLinearTrend(monthlyScores.map(m => m.score));

    const lastScore = monthlyScores[monthlyScores.length - 1]?.score || 0;

    const predicted30d = lastScore + (trend * 1);
    const predicted90d = lastScore + (trend * 3);

    return {
      predicted_rating_30d: this.determineRatingFromScore(predicted30d),
      predicted_rating_90d: this.determineRatingFromScore(predicted90d),
      confidence: Math.abs(trend) > 10 ? 'high' : Math.abs(trend) > 5 ? 'medium' : 'low',
      key_influencers: [],
      risk_factors: []
    };
  }

  // -------------------------------------------------------------------------
  // UTILITY HELPER METHODS
  // -------------------------------------------------------------------------

  private createEmptyResult(context: CalculationContext): ProjectRatingResult {
    return {
      rating: 'unknown',
      score: null,
      data_quality: 'very_low',
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

  private getEarliestAssessmentDate(assessments: any[]): Date | undefined {
    if (assessments.length === 0) return undefined;

    return assessments.reduce((earliest, assessment) => {
      const assessmentDate = new Date(assessment.assessment_date);
      return assessmentDate < earliest ? assessmentDate : earliest;
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

  private getSeverityName(assessmentType: ComplianceAssessmentType, severityLevel: number | null): string | undefined {
    // This would typically come from configuration
    const severityNames: Record<string, Record<number, string>> = {
      'eca_status': {
        1: 'Active EBA',
        2: 'Expired EBA (< 6 months)',
        3: 'Expired EBA (6-12 months)',
        4: 'Expired EBA (> 12 months)',
        5: 'No EBA History'
      }
    };

    return severityNames[assessmentType]?.[severityLevel || 1];
  }

  private calculateAverageRecency(weightedAssessments: WeightedAssessment[], calculationDate: Date): number {
    if (weightedAssessments.length === 0) return 0;

    const totalDays = weightedAssessments.reduce((sum, wa) => {
      const daysOld = this.calculateDaysOld(wa.assessment.assessment_date, calculationDate);
      return sum + daysOld;
    }, 0);

    const averageDaysOld = totalDays / weightedAssessments.length;

    // Convert to recency score (newer is better)
    return Math.max(0, 100 - (averageDaysOld / 365 * 100));
  }

  private calculateTypeCompleteness(weightedAssessments: WeightedAssessment[]): number {
    const presentTypes = new Set(weightedAssessments.map(wa => wa.assessment.assessment_type));
    const requiredTypes: ComplianceAssessmentType[] = [
      'cbus_status',
      'incolink_status',
      'eca_status',
      'safety_incidents'
    ];

    const presentCount = requiredTypes.filter(type => presentTypes.has(type)).length;
    return (presentCount / requiredTypes.length) * 100;
  }

  private calculateScoreConsistency(weightedAssessments: WeightedAssessment[]): number {
    const typeGroups: Record<ComplianceAssessmentType, WeightedAssessment[]> = {} as any;

    for (const wa of weightedAssessments) {
      const type = wa.assessment.assessment_type as ComplianceAssessmentType;
      if (!typeGroups[type]) {
        typeGroups[type] = [];
      }
      typeGroups[type].push(wa);
    }

    let totalConsistency = 0;
    let typeCount = 0;

    for (const [type, typeAssessments] of Object.entries(typeGroups)) {
      if (typeAssessments.length >= 2) {
        const scores = typeAssessments.map(wa => wa.assessment.score).filter(s => s !== null);
        if (scores.length > 1) {
          const variance = this.calculateVariance(scores);
          const consistency = Math.max(0, 100 - (variance * 2));
          totalConsistency += consistency;
          typeCount++;
        }
      }
    }

    return typeCount > 0 ? totalConsistency / typeCount : 100;
  }

  private calculateAverageConfidence(weightedAssessments: WeightedAssessments[]): ConfidenceLevel {
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

  private calculateComponentTrend(weightedAssessments: WeightedAssessment[]): 'improving' | 'stable' | 'declining' | 'unknown' {
    if (weightedAssessments.length < 3) return 'unknown';

    const sortedAssessments = weightedAssessments
      .sort((a, b) => new Date(a.assessment.assessment_date).getTime() - new Date(b.assessment.assessment_date).getTime());

    const scores = sortedAssessments.map(wa => wa.assessment.score).filter(s => s !== null);
    if (scores.length < 3) return 'unknown';

    const trend = this.calculateLinearTrend(scores);

    if (trend > 3) return 'improving';
    if (trend < -3) return 'declining';
    return 'stable';
  }

  private calculateComponentRecency(weightedAssessments: WeightedAssessment[]): number {
    if (weightedAssessments.length === 0) return 0;

    const latestDate = weightedAssessments.reduce((latest, wa) => {
      const assessmentDate = new Date(wa.assessment.assessment_date);
      return assessmentDate > latest ? assessmentDate : latest;
    }, new Date(weightedAssessments[0].assessment.assessment_date));

    const daysOld = this.calculateDaysOld(latestDate, new Date());

    return Math.max(0, 100 - (daysOld / 90 * 100)); // 90-day window
  }

  private getComponentEarliestDate(weightedAssessments: WeightedAssessment[]): Date | undefined {
    if (weightedAssessments.length === 0) return undefined;

    return weightedAssessments.reduce((earliest, wa) => {
      const assessmentDate = new Date(wa.assessment.assessment_date);
      return assessmentDate < earliest ? assessmentDate : earliest;
    }, new Date(weightedAssessments[0].assessment.assessment_date));
  }

  private getComponentLatestDate(weightedAssessments: WeightedAssessment[]): Date | undefined {
    if (weightedAssessments.length === 0) return undefined;

    return weightedAssessments.reduce((latest, wa) => {
      const assessmentDate = new Date(wa.assessment.assessment_date);
      return assessmentDate > latest ? assessmentDate : latest;
    }, new Date(weightedAssessments[0].assessment.assessment_date));
  }

  private calculateTimeDecayFactors(assessmentSummaries: ProjectAssessmentSummary[]): Record<string, number> {
    const factors: Record<string, number> = {};

    for (const summary of assessmentSummaries) {
      const key = `${summary.assessment_type}_${summary.assessment_date.toISOString()}`;
      factors[key] = summary.decay_factor || 1.0;
    }

    return factors;
  }

  private generateWarnings(assessments: any[], aggregatedData: AggregatedProjectData): string[] {
    const warnings: string[] = [];

    if (assessments.length === 0) {
      warnings.push('No assessment data available');
      return warnings;
    }

    if (assessments.length < 3) {
      warnings.push('Limited assessment data - ratings may not be reliable');
    }

    const latestDate = this.getLatestAssessmentDate(assessments);
    if (latestDate) {
      const daysOld = this.calculateDaysOld(latestDate, new Date());
      if (daysOld > 180) {
        warnings.push('Assessment data is outdated - consider conducting new assessments');
      }
    }

    // Check for missing critical assessment types
    const presentTypes = new Set(assessments.map(a => a.assessment_type));
    const criticalTypes: ComplianceAssessmentType[] = ['eca_status', 'cbus_status', 'incolink_status'];

    for (const type of criticalTypes) {
      if (!presentTypes.has(type)) {
        warnings.push(`Missing critical assessment type: ${type.replace(/_/g, ' ')}`);
      }
    }

    return warnings;
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class Track1CalculationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'Track1CalculationError';
    this.code = code;
    this.details = details;
  }
}