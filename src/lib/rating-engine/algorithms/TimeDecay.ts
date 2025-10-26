// Time-based Decay Functions - Historical data decay and temporal weighting algorithms

import {
  ConfidenceLevel,
  ComplianceAssessmentType
} from '../types/RatingTypes';
import {
  DecayConfiguration,
  DecayResult,
  DecayFactors,
  TemporalWeightingResult,
  HistoricalDataPoint,
  DecaySchedule,
  DecayCurveType
} from '../types/CalculationTypes';

// =============================================================================
// TIME DECAY INTERFACES
// =============================================================================

export interface ITimeDecayCalculator {
  calculateDecay(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config?: Partial<DecayConfiguration>
  ): Promise<DecayResult>;
  applyTemporalWeighting(
    assessments: any[],
    referenceDate: Date,
    config?: Partial<DecayConfiguration>
  ): Promise<TemporalWeightingResult>;
  calculateDecaySchedule(
    assessmentType: ComplianceAssessmentType,
    config: DecayConfiguration
  ): DecaySchedule;
  projectFutureDecay(
    currentData: HistoricalDataPoint[],
    futureDays: number,
    config: DecayConfiguration
  ): Promise<DecayResult>;
  validateDecayConfiguration(config: DecayConfiguration): Promise<boolean>;
}

// =============================================================================
// DECAY CONFIGURATION
// =============================================================================

export interface DecayConfiguration {
  // Basic decay settings
  enabled: boolean;
  decay_curve_type: DecayCurveType;
  half_life_days: number;
  minimum_weight: number;
  maximum_weight: number;

  // Assessment type specific settings
  assessment_type_multipliers: Record<ComplianceAssessmentType, number>;
  critical_assessment_types: ComplianceAssessmentType[];

  // Temporal settings
  reference_date: Date;
  max_data_age_days: number;
  decay_floor_days: number;

  // Advanced settings
  enable_seasonal_adjustment: boolean;
  seasonal_multiplier: number;
  enable_volume_boost: boolean;
  volume_boost_threshold: number;
  volume_boost_factor: number;

  // Outlier handling
  enable_outlier_detection: boolean;
  outlier_threshold_std_dev: number;
  outlier_decay_factor: number;

  // Performance settings
  enable_caching: boolean;
  cache_ttl_seconds: number;
  batch_processing_enabled: boolean;
  batch_size: number;
}

export enum DecayCurveType {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  LOGARITHMIC = 'logarithmic',
  STEP_FUNCTION = 'step_function',
  CUSTOM = 'custom'
}

// =============================================================================
// TIME DECAY CALCULATOR IMPLEMENTATION
// =============================================================================

export class TimeDecayCalculator implements ITimeDecayCalculator {
  private defaultConfig: DecayConfiguration;
  private decayCache: Map<string, DecayResult>;
  private lastCacheClear: Date;

  constructor(config?: Partial<DecayConfiguration>) {
    this.defaultConfig = {
      // Basic decay settings
      enabled: true,
      decay_curve_type: DecayCurveType.EXPONENTIAL,
      half_life_days: 90,
      minimum_weight: 0.1,
      maximum_weight: 1.0,

      // Assessment type multipliers
      assessment_type_multipliers: {
        'cbus_status': 1.2,
        'incolink_status': 1.1,
        'site_visit_report': 1.0,
        'delegate_report': 0.9,
        'organiser_verbal_report': 0.8,
        'organiser_written_report': 0.9,
        'eca_status': 1.5, // Higher weight for EBA
        'safety_incidents': 1.3,
        'industrial_disputes': 1.4,
        'payment_issues': 1.2
      },
      critical_assessment_types: ['eca_status', 'safety_incidents', 'industrial_disputes'],

      // Temporal settings
      reference_date: new Date(),
      max_data_age_days: 365,
      decay_floor_days: 180,

      // Advanced settings
      enable_seasonal_adjustment: false,
      seasonal_multiplier: 1.1,
      enable_volume_boost: false,
      volume_boost_threshold: 5,
      volume_boost_factor: 1.2,

      // Outlier handling
      enable_outlier_detection: true,
      outlier_threshold_std_dev: 2.0,
      outlier_decay_factor: 0.5,

      // Performance settings
      enable_caching: true,
      cache_ttl_seconds: 300, // 5 minutes
      batch_processing_enabled: true,
      batch_size: 100
    };

    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.decayCache = new Map();
    this.lastCacheClear = new Date();
  }

  // -------------------------------------------------------------------------
  // MAIN DECAY CALCULATION METHODS
  // -------------------------------------------------------------------------

  async calculateDecay(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config?: Partial<DecayConfiguration>
  ): Promise<DecayResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Check if decay is enabled
      if (!finalConfig.enabled) {
        return this.createNoDecayResult(dataPoints, referenceDate);
      }

      // Validate configuration
      const isValidConfig = await this.validateDecayConfiguration(finalConfig);
      if (!isValidConfig) {
        throw new TimeDecayError(
          'INVALID_CONFIG',
          'Invalid decay configuration provided',
          { config: finalConfig }
        );
      }

      // Check cache first
      if (finalConfig.enable_caching) {
        const cacheKey = this.generateCacheKey(dataPoints, referenceDate, finalConfig);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Filter valid data points
      const validDataPoints = this.filterValidDataPoints(dataPoints, referenceDate, finalConfig);

      if (validDataPoints.length === 0) {
        return this.createEmptyDecayResult(referenceDate, finalConfig);
      }

      // Calculate decay for each data point
      const decayedPoints = await this.calculateDecayForPoints(validDataPoints, referenceDate, finalConfig);

      // Calculate aggregate decay factors
      const decayFactors = this.calculateAggregateDecayFactors(decayedPoints, finalConfig);

      // Detect and handle outliers
      const processedPoints = finalConfig.enable_outlier_detection
        ? this.handleOutliers(decayedPoints, finalConfig)
        : decayedPoints;

      // Apply volume boost if enabled
      const finalPoints = finalConfig.enable_volume_boost
        ? this.applyVolumeBoost(processedPoints, finalConfig)
        : processedPoints;

      // Calculate final result
      const result: DecayResult = {
        reference_date: referenceDate,
        original_points: dataPoints,
        decayed_points: finalPoints,
        decay_factors: decayFactors,
        decay_schedule: this.calculateDecayScheduleForType('general', finalConfig),
        configuration_used: finalConfig,
        processing_details: {
          points_processed: finalPoints.length,
          points_filtered_out: dataPoints.length - validDataPoints.length,
          outliers_detected: finalConfig.enable_outlier_detection ? this.detectOutliers(decayedPoints, finalConfig).length : 0,
          cache_hit: false,
          processing_time_ms: 0 // Would be measured in real implementation
        },
        metadata: {
          calculation_timestamp: new Date(),
          cache_key: finalConfig.enable_caching ? this.generateCacheKey(dataPoints, referenceDate, finalConfig) : undefined,
          decay_curve_type: finalConfig.decay_curve_type,
          half_life_days: finalConfig.half_life_days
        }
      };

      // Cache result if enabled
      if (finalConfig.enable_caching) {
        this.addToCache(result.metadata.cache_key!, result);
      }

      return result;

    } catch (error) {
      throw new TimeDecayError(
        'DECAY_CALCULATION_ERROR',
        `Time decay calculation failed: ${(error as Error).message}`,
        { data_points_count: dataPoints.length, reference_date, config: finalConfig }
      );
    }
  }

  async applyTemporalWeighting(
    assessments: any[],
    referenceDate: Date,
    config?: Partial<DecayConfiguration>
  ): Promise<TemporalWeightingResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Convert assessments to historical data points
    const dataPoints: HistoricalDataPoint[] = assessments.map(assessment => ({
      id: assessment.id,
      date: new Date(assessment.assessment_date),
      value: assessment.score || 0,
      weight: assessment.weight || 1.0,
      metadata: {
        assessment_type: assessment.assessment_type,
        confidence_level: assessment.confidence_level,
        source_id: assessment.source_id
      }
    }));

    // Calculate decay
    const decayResult = await this.calculateDecay(dataPoints, referenceDate, finalConfig);

    // Apply weights back to assessments
    const weightedAssessments = assessments.map((assessment, index) => {
      const decayedPoint = decayResult.decayed_points.find(dp => dp.id === assessment.id);
      return {
        ...assessment,
        temporal_weight: decayedPoint?.decayed_weight || 1.0,
        decay_factor: decayedPoint?.decay_factor || 1.0,
        age_days: decayedPoint?.age_days || 0
      };
    });

    return {
      original_assessments: assessments,
      weighted_assessments: weightedAssessments,
      decay_result: decayResult,
      weighting_summary: this.calculateWeightingSummary(weightedAssessments),
      temporal_analysis: this.analyzeTemporalPatterns(weightedAssessments, finalConfig)
    };
  }

  calculateDecaySchedule(
    assessmentType: ComplianceAssessmentType,
    config: DecayConfiguration
  ): DecaySchedule {
    const multiplier = config.assessment_type_multipliers[assessmentType] || 1.0;
    const isCritical = config.critical_assessment_types.includes(assessmentType);

    const schedule: DecaySchedule = {
      assessment_type: assessmentType,
      decay_curve_type: config.decay_curve_type,
      half_life_days: isCritical ? config.half_life_days * 1.5 : config.half_life_days,
      minimum_weight: config.minimum_weight * multiplier,
      maximum_weight: config.maximum_weight * multiplier,
      decay_schedule_points: this.generateDecaySchedulePoints(config),
      critical_adjustments: isCritical ? {
        extended_half_life: 1.5,
        minimum_weight_boost: 1.2,
        decay_resistance: 0.8
      } : undefined
    };

    return schedule;
  }

  async projectFutureDecay(
    currentData: HistoricalDataPoint[],
    futureDays: number,
    config: DecayConfiguration
  ): Promise<DecayResult> {
    const futureReferenceDate = new Date(config.reference_date.getTime() + (futureDays * 24 * 60 * 60 * 1000));

    // Calculate decay for future date
    const futureDecay = await this.calculateDecay(currentData, futureReferenceDate, {
      ...config,
      reference_date: futureReferenceDate
    });

    // Add projection metadata
    return {
      ...futureDecay,
      metadata: {
        ...futureDecay.metadata,
        is_projection: true,
        projection_days: futureDays,
        original_reference_date: config.reference_date
      }
    };
  }

  async validateDecayConfiguration(config: DecayConfiguration): Promise<boolean> {
    // Check basic configuration validity
    if (config.half_life_days <= 0) {
      return false;
    }

    if (config.minimum_weight < 0 || config.minimum_weight > config.maximum_weight) {
      return false;
    }

    if (config.maximum_weight <= 0 || config.maximum_weight > 10) {
      return false;
    }

    if (config.max_data_age_days <= 0) {
      return false;
    }

    if (config.outlier_threshold_std_dev <= 0) {
      return false;
    }

    if (config.volume_boost_factor <= 0) {
      return false;
    }

    // Check assessment type multipliers
    for (const multiplier of Object.values(config.assessment_type_multipliers)) {
      if (multiplier <= 0 || multiplier > 10) {
        return false;
      }
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------

  private filterValidDataPoints(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config: DecayConfiguration
  ): HistoricalDataPoint[] {
    return dataPoints.filter(point => {
      // Check if point is within max age
      const ageDays = (referenceDate.getTime() - point.date.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays > config.max_data_age_days) {
        return false;
      }

      // Check if point has valid data
      if (point.value === null || point.value === undefined) {
        return false;
      }

      if (point.weight <= 0) {
        return false;
      }

      return true;
    });
  }

  private async calculateDecayForPoints(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config: DecayConfiguration
  ): Promise<HistoricalDataPoint[]> {
    if (config.batch_processing_enabled && dataPoints.length > config.batch_size) {
      return this.processBatchDecay(dataPoints, referenceDate, config);
    } else {
      return dataPoints.map(point => this.calculateDecayForPoint(point, referenceDate, config));
    }
  }

  private calculateDecayForPoint(
    point: HistoricalDataPoint,
    referenceDate: Date,
    config: DecayConfiguration
  ): HistoricalDataPoint {
    const ageDays = (referenceDate.getTime() - point.date.getTime()) / (24 * 60 * 60 * 1000);

    // Calculate base decay factor
    let decayFactor: number;

    switch (config.decay_curve_type) {
      case DecayCurveType.EXPONENTIAL:
        decayFactor = this.calculateExponentialDecay(ageDays, config);
        break;
      case DecayCurveType.LINEAR:
        decayFactor = this.calculateLinearDecay(ageDays, config);
        break;
      case DecayCurveType.LOGARITHMIC:
        decayFactor = this.calculateLogarithmicDecay(ageDays, config);
        break;
      case DecayCurveType.STEP_FUNCTION:
        decayFactor = this.calculateStepDecay(ageDays, config);
        break;
      case DecayCurveType.CUSTOM:
        decayFactor = this.calculateCustomDecay(ageDays, config);
        break;
      default:
        decayFactor = this.calculateExponentialDecay(ageDays, config);
    }

    // Apply assessment type multiplier
    const assessmentType = point.metadata?.assessment_type as ComplianceAssessmentType;
    const typeMultiplier = config.assessment_type_multipliers[assessmentType] || 1.0;
    decayFactor *= typeMultiplier;

    // Apply seasonal adjustment if enabled
    if (config.enable_seasonal_adjustment) {
      decayFactor *= this.calculateSeasonalAdjustment(point.date, config);
    }

    // Ensure decay factor is within bounds
    decayFactor = Math.max(config.minimum_weight, Math.min(config.maximum_weight, decayFactor));

    // Calculate decayed weight
    const decayedWeight = point.weight * decayFactor;

    return {
      ...point,
      decay_factor: decayFactor,
      decayed_weight: decayedWeight,
      age_days: ageDays
    };
  }

  private calculateExponentialDecay(ageDays: number, config: DecayConfiguration): number {
    if (ageDays <= 0) return 1.0;

    // Exponential decay: weight = (1/2)^(age/halfLife)
    const decayFactor = Math.pow(0.5, ageDays / config.half_life_days);

    // Apply decay floor
    if (ageDays > config.decay_floor_days) {
      const floorFactor = Math.pow(0.5, config.decay_floor_days / config.half_life_days);
      return Math.max(config.minimum_weight, floorFactor);
    }

    return Math.max(config.minimum_weight, decayFactor);
  }

  private calculateLinearDecay(ageDays: number, config: DecayConfiguration): number {
    if (ageDays <= 0) return 1.0;

    // Linear decay from 1 to minimum_weight over half_life_days
    const decayRate = (1.0 - config.minimum_weight) / config.half_life_days;
    const decayFactor = Math.max(config.minimum_weight, 1.0 - (ageDays * decayRate));

    // Apply decay floor
    if (ageDays > config.decay_floor_days) {
      return config.minimum_weight;
    }

    return decayFactor;
  }

  private calculateLogarithmicDecay(ageDays: number, config: DecayConfiguration): number {
    if (ageDays <= 0) return 1.0;

    // Logarithmic decay: slower initial decay, faster later decay
    const logFactor = Math.log(1 + (ageDays / config.half_life_days)) / Math.log(2);
    const decayFactor = Math.pow(0.5, logFactor);

    return Math.max(config.minimum_weight, decayFactor);
  }

  private calculateStepDecay(ageDays: number, config: DecayConfiguration): number {
    if (ageDays <= 0) return 1.0;

    // Step function decay with defined intervals
    const stepIntervals = [
      { max_days: 30, weight: 1.0 },
      { max_days: 90, weight: 0.8 },
      { max_days: 180, weight: 0.6 },
      { max_days: 365, weight: 0.4 },
      { max_days: Infinity, weight: config.minimum_weight }
    ];

    for (const interval of stepIntervals) {
      if (ageDays <= interval.max_days) {
        return interval.weight;
      }
    }

    return config.minimum_weight;
  }

  private calculateCustomDecay(ageDays: number, config: DecayConfiguration): number {
    // Custom decay function - can be extended based on specific requirements
    // This example uses a sigmoid-like decay curve
    if (ageDays <= 0) return 1.0;

    const steepness = 0.02;
    const midpoint = config.half_life_days;
    const sigmoid = 1 / (1 + Math.exp(steepness * (ageDays - midpoint)));

    return Math.max(config.minimum_weight, sigmoid);
  }

  private calculateSeasonalAdjustment(date: Date, config: DecayConfiguration): number {
    // Simple seasonal adjustment - could be made more sophisticated
    const month = date.getMonth();

    // Assume higher activity/concern during certain months
    const highActivityMonths = [3, 4, 5, 9, 10, 11]; // Spring and Fall

    if (highActivityMonths.includes(month)) {
      return config.seasonal_multiplier;
    }

    return 1.0;
  }

  private calculateAggregateDecayFactors(
    decayedPoints: HistoricalDataPoint[],
    config: DecayConfiguration
  ): DecayFactors {
    if (decayedPoints.length === 0) {
      return {
        total_original_weight: 0,
        total_decayed_weight: 0,
        overall_decay_factor: 0,
        average_age_days: 0,
        weight_loss_percentage: 0,
        effective_data_points: 0
      };
    }

    const totalOriginalWeight = decayedPoints.reduce((sum, point) => sum + point.weight, 0);
    const totalDecayedWeight = decayedPoints.reduce((sum, point) => sum + point.decayed_weight, 0);
    const overallDecayFactor = totalOriginalWeight > 0 ? totalDecayedWeight / totalOriginalWeight : 0;
    const averageAge = decayedPoints.reduce((sum, point) => sum + point.age_days, 0) / decayedPoints.length;
    const weightLossPercentage = totalOriginalWeight > 0 ? ((totalOriginalWeight - totalDecayedWeight) / totalOriginalWeight) * 100 : 0;

    // Count effective data points (those with weight > minimum threshold)
    const effectiveDataPoints = decayedPoints.filter(point => point.decayed_weight > config.minimum_weight * 0.5).length;

    return {
      total_original_weight: totalOriginalWeight,
      total_decayed_weight: totalDecayedWeight,
      overall_decay_factor: overallDecayFactor,
      average_age_days: averageAge,
      weight_loss_percentage: weightLossPercentage,
      effective_data_points: effectiveDataPoints
    };
  }

  private detectOutliers(decayedPoints: HistoricalDataPoint[], config: DecayConfiguration): HistoricalDataPoint[] {
    if (decayedPoints.length < 3) return [];

    const decayFactors = decayedPoints.map(point => point.decay_factor);
    const mean = decayFactors.reduce((sum, factor) => sum + factor, 0) / decayFactors.length;
    const variance = decayFactors.reduce((sum, factor) => sum + Math.pow(factor - mean, 2), 0) / decayFactors.length;
    const stdDev = Math.sqrt(variance);

    const outliers = decayedPoints.filter(point => {
      const zScore = Math.abs((point.decay_factor - mean) / stdDev);
      return zScore > config.outlier_threshold_std_dev;
    });

    return outliers;
  }

  private handleOutliers(decayedPoints: HistoricalDataPoint[], config: DecayConfiguration): HistoricalDataPoint[] {
    const outliers = this.detectOutliers(decayedPoints, config);
    const outlierIds = new Set(outliers.map(o => o.id));

    return decayedPoints.map(point => {
      if (outlierIds.has(point.id)) {
        // Apply outlier decay factor
        return {
          ...point,
          decay_factor: point.decay_factor * config.outlier_decay_factor,
          decayed_weight: point.decayed_weight * config.outlier_decay_factor,
          metadata: {
            ...point.metadata,
            is_outlier: true,
            original_decay_factor: point.decay_factor
          }
        };
      }
      return point;
    });
  }

  private applyVolumeBoost(decayedPoints: HistoricalDataPoint[], config: DecayConfiguration): HistoricalDataPoint[] {
    if (decayedPoints.length < config.volume_boost_threshold) {
      return decayedPoints;
    }

    return decayedPoints.map(point => ({
      ...point,
      decay_factor: Math.min(config.maximum_weight, point.decay_factor * config.volume_boost_factor),
      decayed_weight: Math.min(config.maximum_weight * point.weight, point.decayed_weight * config.volume_boost_factor),
      metadata: {
        ...point.metadata,
        volume_boost_applied: true
      }
    }));
  }

  private async processBatchDecay(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config: DecayConfiguration
  ): Promise<HistoricalDataPoint[]> {
    const batches: HistoricalDataPoint[][] = [];
    for (let i = 0; i < dataPoints.length; i += config.batch_size) {
      batches.push(dataPoints.slice(i, i + config.batch_size));
    }

    const results: HistoricalDataPoint[] = [];
    for (const batch of batches) {
      const batchResults = batch.map(point => this.calculateDecayForPoint(point, referenceDate, config));
      results.push(...batchResults);
    }

    return results;
  }

  private generateDecaySchedulePoints(config: DecayConfiguration): Array<{ age_days: number; decay_factor: number }> {
    const points: Array<{ age_days: number; decay_factor: number }> = [];
    const maxAge = config.max_data_age_days;
    const step = Math.ceil(maxAge / 20); // Generate 20 points

    for (let age = 0; age <= maxAge; age += step) {
      let decayFactor: number;

      switch (config.decay_curve_type) {
        case DecayCurveType.EXPONENTIAL:
          decayFactor = this.calculateExponentialDecay(age, config);
          break;
        case DecayCurveType.LINEAR:
          decayFactor = this.calculateLinearDecay(age, config);
          break;
        case DecayCurveType.LOGARITHMIC:
          decayFactor = this.calculateLogarithmicDecay(age, config);
          break;
        case DecayCurveType.STEP_FUNCTION:
          decayFactor = this.calculateStepDecay(age, config);
          break;
        default:
          decayFactor = this.calculateExponentialDecay(age, config);
      }

      points.push({ age_days: age, decay_factor: decayFactor });
    }

    return points;
  }

  private calculateDecayScheduleForType(assessmentType: string, config: DecayConfiguration): DecaySchedule {
    // Create a generic schedule for non-specific types
    return {
      assessment_type: assessmentType as ComplianceAssessmentType,
      decay_curve_type: config.decay_curve_type,
      half_life_days: config.half_life_days,
      minimum_weight: config.minimum_weight,
      maximum_weight: config.maximum_weight,
      decay_schedule_points: this.generateDecaySchedulePoints(config)
    };
  }

  private calculateWeightingSummary(weightedAssessments: any[]): any {
    const totalOriginalWeight = weightedAssessments.reduce((sum, a) => sum + (a.weight || 1.0), 0);
    const totalTemporalWeight = weightedAssessments.reduce((sum, a) => sum + (a.temporal_weight || 1.0), 0);
    const averageDecayFactor = totalOriginalWeight > 0 ? totalTemporalWeight / totalOriginalWeight : 0;

    return {
      total_assessments: weightedAssessments.length,
      total_original_weight: totalOriginalWeight,
      total_temporal_weight: totalTemporalWeight,
      average_decay_factor: averageDecayFactor,
      weight_retention_percentage: averageDecayFactor * 100,
      assessments_above_minimum: weightedAssessments.filter(a => a.temporal_weight > 0.1).length
    };
  }

  private analyzeTemporalPatterns(weightedAssessments: any[], config: DecayConfiguration): any {
    // Sort by date
    const sortedAssessments = weightedAssessments.sort((a, b) =>
      new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
    );

    if (sortedAssessments.length < 2) {
      return {
        pattern: 'insufficient_data',
        trend: 'unknown',
        recency_score: 0,
        temporal_distribution: {}
      };
    }

    // Calculate temporal patterns
    const ages = sortedAssessments.map(a => a.age_days || 0);
    const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
    const maxAge = Math.max(...ages);
    const minAge = Math.min(...ages);

    // Calculate recency score
    const recencyScore = Math.max(0, 1 - (averageAge / config.max_data_age_days));

    // Determine temporal distribution
    const distribution = {
      recent: sortedAssessments.filter(a => (a.age_days || 0) <= 30).length,
      medium: sortedAssessments.filter(a => (a.age_days || 0) > 30 && (a.age_days || 0) <= 90).length,
      old: sortedAssessments.filter(a => (a.age_days || 0) > 90).length
    };

    return {
      pattern: distribution.recent > distribution.old ? 'recent_heavy' : 'aged_heavy',
      trend: this.calculateTemporalTrend(sortedAssessments),
      recency_score: recencyScore,
      temporal_distribution: distribution,
      age_statistics: {
        average_age_days: averageAge,
        min_age_days: minAge,
        max_age_days: maxAge,
        age_range_days: maxAge - minAge
      }
    };
  }

  private calculateTemporalTrend(sortedAssessments: any[]): 'improving' | 'stable' | 'declining' | 'unknown' {
    if (sortedAssessments.length < 3) return 'unknown';

    // Get temporal weights (higher weights indicate more recent/higher impact)
    const weights = sortedAssessments.map(a => a.temporal_weight || 1.0);
    const trend = this.calculateLinearTrend(weights);

    if (trend > 0.05) return 'improving';
    if (trend < -0.05) return 'declining';
    return 'stable';
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

  // -------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // -------------------------------------------------------------------------

  private generateCacheKey(
    dataPoints: HistoricalDataPoint[],
    referenceDate: Date,
    config: DecayConfiguration
  ): string {
    const keyData = {
      point_count: dataPoints.length,
      reference_date: referenceDate.toISOString(),
      config_hash: this.hashConfig(config),
      data_signature: this.calculateDataSignature(dataPoints)
    };

    return btoa(JSON.stringify(keyData));
  }

  private hashConfig(config: DecayConfiguration): string {
    // Simple hash of configuration - in production, use proper hashing
    const configString = JSON.stringify({
      decay_curve_type: config.decay_curve_type,
      half_life_days: config.half_life_days,
      minimum_weight: config.minimum_weight,
      maximum_weight: config.maximum_weight,
      max_data_age_days: config.max_data_age_days
    });

    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateDataSignature(dataPoints: HistoricalDataPoint[]): string {
    // Create a signature based on data point IDs and dates
    const signatureData = dataPoints
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(p => `${p.id}:${p.date.getTime()}`)
      .join('|');

    let hash = 0;
    for (let i = 0; i < signatureData.length; i++) {
      const char = signatureData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache(key: string): DecayResult | null {
    // Clear expired entries
    this.clearExpiredCacheEntries();

    const entry = this.decayCache.get(key);
    if (entry) {
      return entry;
    }
    return null;
  }

  private addToCache(key: string, result: DecayResult): void {
    this.decayCache.set(key, result);
  }

  private clearExpiredCacheEntries(): void {
    const now = new Date();
    const cacheAge = (now.getTime() - this.lastCacheClear.getTime()) / 1000;

    if (cacheAge > this.defaultConfig.cache_ttl_seconds) {
      this.decayCache.clear();
      this.lastCacheClear = now;
    }
  }

  // -------------------------------------------------------------------------
  // RESULT CREATION HELPERS
  // -------------------------------------------------------------------------

  private createNoDecayResult(dataPoints: HistoricalDataPoint[], referenceDate: Date): DecayResult {
    const pointsWithNoDecay = dataPoints.map(point => ({
      ...point,
      decay_factor: 1.0,
      decayed_weight: point.weight,
      age_days: (referenceDate.getTime() - point.date.getTime()) / (24 * 60 * 60 * 1000)
    }));

    return {
      reference_date: referenceDate,
      original_points: dataPoints,
      decayed_points: pointsWithNoDecay,
      decay_factors: this.calculateAggregateDecayFactors(pointsWithNoDecay, this.defaultConfig),
      decay_schedule: this.calculateDecayScheduleForType('general', this.defaultConfig),
      configuration_used: { ...this.defaultConfig, enabled: false },
      processing_details: {
        points_processed: pointsWithNoDecay.length,
        points_filtered_out: 0,
        outliers_detected: 0,
        cache_hit: false,
        processing_time_ms: 0
      },
      metadata: {
        calculation_timestamp: new Date(),
        decay_curve_type: this.defaultConfig.decay_curve_type,
        half_life_days: this.defaultConfig.half_life_days
      }
    };
  }

  private createEmptyDecayResult(referenceDate: Date, config: DecayConfiguration): DecayResult {
    return {
      reference_date: referenceDate,
      original_points: [],
      decayed_points: [],
      decay_factors: {
        total_original_weight: 0,
        total_decayed_weight: 0,
        overall_decay_factor: 0,
        average_age_days: 0,
        weight_loss_percentage: 0,
        effective_data_points: 0
      },
      decay_schedule: this.calculateDecayScheduleForType('general', config),
      configuration_used: config,
      processing_details: {
        points_processed: 0,
        points_filtered_out: 0,
        outliers_detected: 0,
        cache_hit: false,
        processing_time_ms: 0
      },
      metadata: {
        calculation_timestamp: new Date(),
        decay_curve_type: config.decay_curve_type,
        half_life_days: config.half_life_days
      }
    };
  }
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class TimeDecayError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'TimeDecayError';
    this.code = code;
    this.details = details;
  }
}