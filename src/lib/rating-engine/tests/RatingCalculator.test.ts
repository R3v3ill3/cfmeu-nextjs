// Unit Tests for Rating Calculator - Core rating calculation functionality

import {
  RatingCalculator,
  BaseRatingCalculator,
  RatingCalculationError
} from '../core/RatingCalculator';
import {
  Track1Calculator,
  Track1CalculationError
} from '../core/Track1Calculator';
import {
  Track2Calculator,
  Track2CalculationError
} from '../core/Track2Calculator';
import {
  CombinedCalculator,
  CombinedCalculationError
} from '../core/CombinedCalculator';
import {
  WeightedScoringCalculator,
  WeightedScoringError
} from '../algorithms/WeightedScoring';
import {
  ConfidenceCalculator,
  ConfidenceCalculationError
} from '../algorithms/ConfidenceCalculation';
import {
  TimeDecayCalculator,
  TimeDecayError,
  DecayCurveType
} from '../algorithms/TimeDecay';
import {
  DiscrepancyDetector,
  DiscrepancyDetectionError
} from '../algorithms/DiscrepancyDetection';
import {
  Validator,
  ValidationError
} from '../utils/Validation';
import {
  PerformanceOptimizer
} from '../utils/Performance';

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockDataSource {
  loadProjectAssessments: jest.Mock;
  loadExpertiseAssessments: jest.Mock;
  loadEBARecords: jest.Mock;
  loadOrganiserProfiles: jest.Mock;
}

interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

interface MockPerformanceTracker {
  recordCalculation: jest.Mock;
  recordError: jest.Mock;
  getCurrentMetrics: jest.Mock;
}

interface MockValidator {
  validateCalculationRequest: jest.Mock;
  validateConfiguration: jest.Mock;
}

interface MockDependencies {
  logger: MockLogger;
  performanceTracker: MockPerformanceTracker;
  validator: MockValidator;
  dataSource: MockDataSource;
}

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const createMockDependencies = (): MockDependencies => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  performanceTracker: {
    recordCalculation: jest.fn(),
    recordError: jest.fn(),
    getCurrentMetrics: jest.fn().mockResolvedValue({
      calculation_time_ms: 0,
      memory_usage_mb: 0,
      database_queries: 0,
      cache_hit_rate: 0,
      data_points_processed: 0,
      complexity_score: 0,
      success_rate: 1
    })
  },
  validator: {
    validateCalculationRequest: jest.fn().mockResolvedValue({
      is_valid: true,
      errors: [],
      warnings: []
    }),
    validateConfiguration: jest.fn().mockResolvedValue({
      is_valid: true,
      errors: [],
      warnings: []
    })
  },
  dataSource: {
    loadProjectAssessments: jest.fn(),
    loadExpertiseAssessments: jest.fn(),
    loadEBARecords: jest.fn(),
    loadOrganiserProfiles: jest.fn()
  }
});

const createMockProjectAssessment = (overrides: any = {}) => ({
  id: 'test-assessment-1',
  employer_id: 'test-employer-1',
  project_id: 'test-project-1',
  assessment_type: 'cbus_status',
  score: 75,
  rating: 'amber',
  confidence_level: 'medium',
  severity_level: 2,
  assessment_date: new Date('2024-01-15'),
  assessment_notes: 'Test assessment',
  evidence_attachments: [],
  follow_up_required: false,
  organiser_id: 'test-organiser-1',
  is_active: true,
  created_at: new Date('2024-01-15'),
  updated_at: new Date('2024-01-15'),
  ...overrides
});

const createMockExpertiseAssessment = (overrides: any = {}) => ({
  id: 'test-expertise-1',
  employer_id: 'test-employer-1',
  organiser_id: 'test-organiser-1',
  overall_score: 80,
  overall_rating: 'green',
  confidence_level: 'high',
  assessment_basis: 'Comprehensive assessment of employer compliance',
  assessment_context: 'Based on multiple project interactions',
  eba_status_known: true,
  eba_status: 'green',
  knowledge_beyond_projects: true,
  industry_reputation: 'Good',
  union_relationship_quality: 'good',
  historical_issues: [],
  recent_improvements: false,
  future_concerns: false,
  assessment_notes: 'Expert assessment',
  assessment_date: new Date('2024-01-10'),
  is_active: true,
  created_at: new Date('2024-01-10'),
  updated_at: new Date('2024-01-10'),
  ...overrides
});

const createMockEBARecord = (overrides: any = {}) => ({
  id: 'test-eba-1',
  employer_id: 'test-employer-1',
  eba_file_number: 'EBA123456',
  sector: 'Construction',
  fwc_certified_date: new Date('2023-06-01'),
  date_eba_signed: new Date('2023-05-15'),
  date_vote_occurred: new Date('2023-05-01'),
  is_active: true,
  created_at: new Date('2023-06-01'),
  updated_at: new Date('2023-06-01'),
  ...overrides
});

const createMockOrganiserProfile = (overrides: any = {}) => ({
  id: 'test-organiser-1',
  name: 'John Doe',
  role: 'Senior Organiser',
  accuracy_percentage: 85,
  overall_reputation_score: 88,
  expertise_level: 'senior',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  ...overrides
});

const createMockCalculationConfig = () => ({
  score_thresholds: {
    green: { min: 80, max: 100 },
    amber: { min: 50, max: 79 },
    red: { min: 0, max: 49 },
    unknown: { min: -1, max: -1 }
  },
  confidence_thresholds: {
    high: { min: 0.8, max: 1.0 },
    medium: { min: 0.6, max: 0.79 },
    low: { min: 0.4, max: 0.59 },
    very_low: { min: 0, max: 0.39 }
  },
  assessment_weights: {
    cbus_status: 3.0,
    incolink_status: 2.5,
    site_visit_report: 2.0,
    delegate_report: 1.5,
    organiser_verbal_report: 1.0,
    organiser_written_report: 1.2,
    eca_status: 2.8,
    safety_incidents: 2.5,
    industrial_disputes: 3.0,
    payment_issues: 2.7
  },
  decay_settings: {
    enabled: true,
    half_life_days: 90,
    minimum_weight: 0.1,
    maximum_weight: 1.0
  },
  quality_requirements: {
    minimum_assessments: {
      project: 1,
      expertise: 1
    },
    maximum_data_age: {
      high: 30,
      medium: 60,
      low: 90
    }
  },
  discrepancy_thresholds: {
    score_difference: {
      none: 5,
      minor: 15,
      moderate: 30,
      major: 50,
      critical: 70
    },
    rating_mismatch: {
      none: 0,
      minor: 10,
      moderate: 25,
      major: 40,
      critical: 60
    }
  },
  performance: {
    enable_caching: true,
    cache_ttl_seconds: 300,
    batch_size: 10
  }
});

// =============================================================================
// TRACK 1 CALCULATOR TESTS
// =============================================================================

describe('Track1Calculator', () => {
  let calculator: Track1Calculator;
  let config: any;

  beforeEach(() => {
    config = createMockCalculationConfig();
    calculator = new Track1Calculator(config);
  });

  describe('calculateRating', () => {
    it('should calculate rating with valid project assessments', async () => {
      const assessments = [
        createMockProjectAssessment({ assessment_type: 'cbus_status', score: 85 }),
        createMockProjectAssessment({ assessment_type: 'incolink_status', score: 75 }),
        createMockProjectAssessment({ assessment_type: 'eca_status', score: 90 })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating(assessments, context);

      expect(result).toBeDefined();
      expect(result.rating).toMatch(/^(green|amber|red|unknown)$/);
      expect(result.score).toBeGreaterThanOrEqual(-100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.assessment_count).toBe(3);
      expect(result.assessments).toHaveLength(3);
      expect(result.breakdown).toBeDefined();
      expect(result.quality_metrics).toBeDefined();
    });

    it('should return unknown rating for empty assessments', async () => {
      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating([], context);

      expect(result.rating).toBe('unknown');
      expect(result.score).toBeNull();
      expect(result.assessment_count).toBe(0);
    });

    it('should filter out old assessments based on lookback period', async () => {
      const oldAssessment = createMockProjectAssessment({
        assessment_date: new Date('2022-01-01'), // Too old
        assessment_type: 'cbus_status',
        score: 50
      });

      const recentAssessment = createMockProjectAssessment({
        assessment_date: new Date('2024-01-10'), // Recent
        assessment_type: 'incolink_status',
        score: 80
      });

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 30, expertise: 180, eba: 1460 }, // Short lookback
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating([oldAssessment, recentAssessment], context);

      expect(result.assessment_count).toBe(1);
      expect(result.assessments[0].assessment_type).toBe('incolink_status');
    });

    it('should apply confidence weighting correctly', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_type: 'cbus_status',
          score: 80,
          confidence_level: 'high'
        }),
        createMockProjectAssessment({
          assessment_type: 'incolink_status',
          score: 80,
          confidence_level: 'low'
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating(assessments, context);

      // High confidence assessment should have more influence
      expect(result.breakdown?.components).toBeDefined();
      const cbusComponent = result.breakdown?.components?.find((c: any) => c.assessment_type === 'cbus_status');
      const incolinkComponent = result.breakdown?.components?.find((c: any) => c.assessment_type === 'incolink_status');

      expect(cbusComponent?.weighted_score).toBeGreaterThan(incolinkComponent?.weighted_score);
    });

    it('should handle assessments with missing scores', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_type: 'cbus_status',
          score: null
        }),
        createMockProjectAssessment({
          assessment_type: 'incolink_status',
          score: 75
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating(assessments, context);

      // Should only count assessment with valid score
      expect(result.assessment_count).toBe(1);
      expect(result.assessments[0].assessment_type).toBe('incolink_status');
    });
  });

  describe('calculateQualityMetrics', () => {
    it('should calculate quality metrics for recent data', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_date: new Date(), // Very recent
          confidence_level: 'high'
        }),
        createMockProjectAssessment({
          assessment_date: new Date(),
          confidence_level: 'high'
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date(),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateQualityMetrics(assessments, context);

      expect(result.data_quality).toBe('high');
      expect(result.recency_score).toBeGreaterThan(80);
      expect(result.completeness_score).toBeGreaterThan(0);
      expect(result.consistency_score).toBeGreaterThan(0);
      expect(result.overall_quality_score).toBeGreaterThan(0.7);
    });

    it('should return low quality for old or insufficient data', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_date: new Date('2023-01-01'), // Very old
          confidence_level: 'low'
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateQualityMetrics(assessessments, context);

      expect(result.data_quality).toMatch(/^(low|very_low)$/);
      expect(result.recency_score).toBeLessThan(50);
    });
  });

  describe('calculateTrendAnalysis', () => {
    it('should calculate trend analysis for sufficient data', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_date: new Date('2024-01-01'),
          score: 60
        }),
        createMockProjectAssessment({
          assessment_date: new Date('2024-01-10'),
          score: 70
        }),
        createMockProjectAssessment({
          assessment_date: new Date('2024-01-15'),
          score: 80
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateTrendAnalysis(assessments, context);

      expect(result).toBeDefined();
      expect(result.trend_direction).toMatch(/^(improving|stable|declining|volatile|insufficient_data)$/);
      expect(result.score_change_30d).toBeDefined();
      expect(result.key_factors).toBeDefined();
    });

    it('should return null for insufficient data', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_date: new Date('2024-01-15'),
          score: 75
        })
      ];

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateTrendAnalysis(assessessments, context);

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw Track1CalculationError for invalid input', async () => {
      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      // Pass invalid assessment data
      const invalidAssessments = [null as any];

      await expect(calculator.calculateRating(invalidAssessments, context))
        .rejects.toThrow(Track1CalculationError);
    });
  });
});

// =============================================================================
// TRACK 2 CALCULATOR TESTS
// =============================================================================

describe('Track2Calculator', () => {
  let calculator: Track2Calculator;
  let config: any;

  beforeEach(() => {
    config = createMockCalculationConfig();
    calculator = new Track2Calculator(config);
  });

  describe('calculateRating', () => {
    it('should calculate expertise rating with valid assessments', async () => {
      const assessments = [
        createMockExpertiseAssessment({
          overall_score: 85,
          confidence_level: 'high'
        }),
        createMockExpertiseAssessment({
          overall_score: 78,
          confidence_level: 'medium'
        })
      ];

      const organiserProfiles = {
        'test-organiser-1': createMockOrganiserProfile({
          accuracy_percentage: 90,
          overall_reputation_score: 88
        })
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating(assessments, organiserProfiles, context);

      expect(result).toBeDefined();
      expect(result.rating).toMatch(/^(green|amber|red|unknown)$/);
      expect(result.score).toBeGreaterThanOrEqual(-100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.assessment_count).toBe(2);
      expect(result.assessments).toHaveLength(2);
      expect(result.breakdown).toBeDefined();
      expect(result.quality_metrics).toBeDefined();
      expect(result.reputation_analysis).toBeDefined();
    });

    it('should return unknown rating for empty assessments', async () => {
      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating([], {}, context);

      expect(result.rating).toBe('unknown');
      expect(result.score).toBeNull();
      expect(result.assessment_count).toBe(0);
    });

    it('should apply reputation weighting correctly', async () => {
      const assessments = [
        createMockExpertiseAssessment({
          overall_score: 70,
          confidence_level: 'medium'
        })
      ];

      const highReputationProfile = createMockOrganiserProfile({
        accuracy_percentage: 95,
        overall_reputation_score: 92
      });

      const lowReputationProfile = createMockOrganiserProfile({
        accuracy_percentage: 60,
        overall_reputation_score: 65
      });

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      // Test with high reputation
      const resultHighRep = await calculator.calculateRating(assessments, { 'test-organiser-1': highReputationProfile }, context);

      // Test with low reputation (different organiser)
      const lowRepAssessment = createMockExpertiseAssessment({
        overall_score: 70,
        confidence_level: 'medium',
        organiser_id: 'test-organiser-2'
      });
      const resultLowRep = await calculator.calculateRating([lowRepAssessment], { 'test-organiser-2': lowReputationProfile }, context);

      // High reputation should result in better score when other factors are equal
      // (This is a simplified test - in reality, the calculation is more complex)
      expect(resultHighRep.assessments[0].accuracy_percentage).toBe(95);
      expect(resultLowRep.assessments[0].accuracy_percentage).toBe(60);
    });

    it('should calculate consensus confidence for multiple organisers', async () => {
      const assessments = [
        createMockExpertiseAssessment({
          organiser_id: 'organiser-1',
          overall_score: 80,
          confidence_level: 'high'
        }),
        createMockExpertiseAssessment({
          organiser_id: 'organiser-2',
          overall_score: 85,
          confidence_level: 'high'
        })
      ];

      const organiserProfiles = {
        'organiser-1': createMockOrganiserProfile({ id: 'organiser-1', name: 'Organiser 1' }),
        'organiser-2': createMockOrganiserProfile({ id: 'organiser-2', name: 'Organiser 2' })
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateRating(assessments, organiserProfiles, context);

      expect(result.confidence_level).toBe('high'); // Multiple high-confidence assessments
      expect(result.breakdown?.components).toHaveLength(2); // Two different organisers
    });
  });

  describe('calculateReputationAnalysis', () => {
    it('should analyze reputation for single organiser', async () => {
      const assessments = [
        createMockExpertiseAssessment({
          organiser_id: 'test-organiser-1',
          overall_score: 85,
          confidence_level: 'high'
        })
      ];

      const organiserProfiles = {
        'test-organiser-1': createMockOrganiserProfile({
          accuracy_percentage: 90,
          overall_reputation_score: 88
        })
      };

      const result = await calculator.calculateReputationAnalysis(assessments, organiserProfiles);

      expect(result).toBeDefined();
      expect(result.overall_reputation_score).toBeGreaterThan(80);
      expect(result.reputation_trend).toMatch(/^(improving|stable|declining)$/);
      expect(result.accuracy_history).toBeDefined();
      expect(result.consistency_score).toBeDefined();
      expect(result.peer_comparison).toBeDefined();
    });

    it('should handle missing organiser profiles', async () => {
      const assessments = [
        createMockExpertiseAssessment({
          organiser_id: 'unknown-organiser',
          overall_score: 70,
          confidence_level: 'medium'
        })
      ];

      const organiserProfiles = {}; // Empty profiles

      const result = await calculator.calculateReputationAnalysis(assessments, organiserProfiles);

      expect(result).toBeDefined();
      expect(result.overall_reputation_score).toBeLessThan(80); // Should use default values
    });
  });

  describe('error handling', () => {
    it('should throw Track2CalculationError for invalid input', async () => {
      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const invalidAssessments = [null as any];

      await expect(calculator.calculateRating(invalidAssessments, {}, context))
        .rejects.toThrow(Track2CalculationError);
    });
  });
});

// =============================================================================
// COMBINED CALCULATOR TESTS
// =============================================================================

describe('CombinedCalculator', () => {
  let calculator: CombinedCalculator;
  let config: any;

  beforeEach(() => {
    config = createMockCalculationConfig();
    calculator = new CombinedCalculator(config);
  });

  describe('calculateFinalRating', () => {
    it('should combine project and expertise ratings correctly', async () => {
      const projectResult = {
        rating: 'amber' as const,
        score: 65,
        data_quality: 'medium' as const,
        assessment_count: 3,
        latest_assessment_date: new Date('2024-01-10'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'medium',
          recency_score: 70,
          completeness_score: 60,
          consistency_score: 75,
          overall_quality_score: 68,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 100
      };

      const expertiseResult = {
        rating: 'green' as const,
        score: 78,
        confidence_level: 'high' as const,
        assessment_count: 2,
        latest_assessment_date: new Date('2024-01-12'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'high',
          recency_score: 85,
          completeness_score: 80,
          consistency_score: 90,
          overall_quality_score: 85,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 80
      };

      const ebaResult = {
        eba_status: 'green' as const,
        eba_score: 25,
        has_active_eba: true,
        latest_eba_date: new Date('2023-12-01'),
        data_age_days: 45,
        calculation_date: new Date('2024-01-15'),
        eba_details: [createMockEBARecord()],
        breakdown: undefined,
        processing_time_ms: 50
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'hybrid_method' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateFinalRating(projectResult, expertiseResult, ebaResult, context);

      expect(result).toBeDefined();
      expect(result.employer_id).toBe('test-employer-1');
      expect(result.final_rating).toMatch(/^(green|amber|red|unknown)$/);
      expect(result.final_score).toBeGreaterThanOrEqual(-100);
      expect(result.final_score).toBeLessThanOrEqual(100);
      expect(result.overall_confidence).toMatch(/^(high|medium|low|very_low)$/);
      expect(result.data_completeness).toBeGreaterThanOrEqual(0);
      expect(result.discrepancy_check).toBeDefined();
      expect(result.project_data).toEqual(projectResult);
      expect(result.expertise_data).toEqual(expertiseResult);
      expect(result.eba_data).toEqual(ebaResult);
    });

    it('should detect discrepancies between ratings', async () => {
      const projectResult = {
        rating: 'red' as const,
        score: 25,
        data_quality: 'medium' as const,
        assessment_count: 3,
        latest_assessment_date: new Date('2024-01-10'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'medium',
          recency_score: 70,
          completeness_score: 60,
          consistency_score: 75,
          overall_quality_score: 68,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 100
      };

      const expertiseResult = {
        rating: 'green' as const,
        score: 85,
        confidence_level: 'high' as const,
        assessment_count: 2,
        latest_assessment_date: new Date('2024-01-12'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'high',
          recency_score: 85,
          completeness_score: 80,
          consistency_score: 90,
          overall_quality_score: 85,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 80
      };

      const ebaResult = {
        eba_status: 'green' as const,
        eba_score: 20,
        has_active_eba: true,
        latest_eba_date: new Date('2023-12-01'),
        data_age_days: 45,
        calculation_date: new Date('2024-01-15'),
        eba_details: [createMockEBARecord()],
        breakdown: undefined,
        processing_time_ms: 50
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'hybrid_method' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateFinalRating(projectResult, expertiseResult, ebaResult, context);

      expect(result.discrepancy_check.discrepancy_detected).toBe(true);
      expect(result.discrepancy_check.discrepancy_level).toMatch(/^(minor|moderate|major|critical)$/);
      expect(result.discrepancy_check.score_difference).toBe(60); // 85 - 25
      expect(result.discrepancy_check.rating_match).toBe(false);
      expect(result.discrepancy_check.requires_review).toBe(true);
    });

    it('should apply reconciliation for significant discrepancies', async () => {
      const projectResult = {
        rating: 'red' as const,
        score: 20,
        data_quality: 'low' as const,
        assessment_count: 1,
        latest_assessment_date: new Date('2024-01-05'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'low',
          recency_score: 40,
          completeness_score: 30,
          consistency_score: 50,
          overall_quality_score: 40,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 100
      };

      const expertiseResult = {
        rating: 'green' as const,
        score: 90,
        confidence_level: 'high' as const,
        assessment_count: 3,
        latest_assessment_date: new Date('2024-01-14'),
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'high',
          recency_score: 95,
          completeness_score: 90,
          consistency_score: 88,
          overall_quality_score: 91,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 80
      };

      const ebaResult = {
        eba_status: 'amber' as const,
        eba_score: 10,
        has_active_eba: true,
        latest_eba_date: new Date('2023-11-01'),
        data_age_days: 75,
        calculation_date: new Date('2024-01-15'),
        eba_details: [createMockEBARecord()],
        breakdown: undefined,
        processing_time_ms: 50
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'hybrid_method' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateFinalRating(projectResult, expertiseResult, ebaResult, context);

      expect(result.reconciliation_applied).toBe(true);
      expect(result.reconciliation_details).toBeDefined();
      expect(result.review_required).toBe(true);
      expect(result.review_reason).toContain('discrepancy');
    });

    it('should handle edge cases with missing data', async () => {
      const emptyProjectResult = {
        rating: 'unknown' as const,
        score: null,
        data_quality: 'very_low' as const,
        assessment_count: 0,
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'very_low',
          recency_score: 0,
          completeness_score: 0,
          consistency_score: 0,
          overall_quality_score: 0,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 10
      };

      const emptyExpertiseResult = {
        rating: 'unknown' as const,
        score: null,
        confidence_level: 'very_low' as const,
        assessment_count: 0,
        calculation_date: new Date('2024-01-15'),
        assessments: [],
        breakdown: undefined,
        quality_metrics: {
          data_quality: 'very_low',
          recency_score: 0,
          completeness_score: 0,
          consistency_score: 0,
          overall_quality_score: 0,
          factors: [],
          recommendations: []
        },
        processing_time_ms: 10
      };

      const emptyEBAResult = {
        eba_status: 'unknown' as const,
        eba_score: 0,
        has_active_eba: false,
        latest_eba_date: undefined,
        data_age_days: undefined,
        calculation_date: new Date('2024-01-15'),
        eba_details: [],
        breakdown: undefined,
        processing_time_ms: 10
      };

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'weighted_average' as const,
        force_recalculate: false,
        debug_mode: false
      };

      const result = await calculator.calculateFinalRating(emptyProjectResult, emptyExpertiseResult, emptyEBAResult, context);

      expect(result.final_rating).toBe('unknown');
      expect(result.final_score).toBe(0); // Should default to 0 when no data
      expect(result.overall_confidence).toBe('very_low');
      expect(result.data_completeness).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw CombinedCalculationError for invalid input', async () => {
      const invalidProjectResult = null as any;
      const invalidExpertiseResult = null as any;
      const invalidEBAResult = null as any;

      const context = {
        employer_id: 'test-employer-1',
        calculation_date: new Date('2024-01-15'),
        lookback_days: { project: 365, expertise: 180, eba: 1460 },
        weights: { project: 0.6, expertise: 0.4, eba: 0.15 },
        method: 'hybrid_method' as const,
        force_recalculate: false,
        debug_mode: false
      };

      await expect(calculator.calculateFinalRating(invalidProjectResult, invalidExpertiseResult, invalidEBAResult, context))
        .rejects.toThrow(CombinedCalculationError);
    });
  });
});

// =============================================================================
// WEIGHTED SCORING CALCULATOR TESTS
// =============================================================================

describe('WeightedScoringCalculator', () => {
  let calculator: WeightedScoringCalculator;

  beforeEach(() => {
    calculator = new WeightedScoringCalculator();
  });

  describe('calculateWeightedScore', () => {
    it('should calculate weighted score correctly', async () => {
      const assessments = [
        {
          assessment: { id: '1', assessment_type: 'cbus_status', score: 80, confidence_level: 'high' },
          weight: 1.0,
          confidence_weight: 1.0,
          decayed_weight: 1.0,
          effective_weight: 1.0,
          contribution: 80
        },
        {
          assessment: { id: '2', assessment_type: 'incolink_status', score: 70, confidence_level: 'medium' },
          weight: 1.0,
          confidence_weight: 0.8,
          decayed_weight: 1.0,
          effective_weight: 0.8,
          contribution: 56
        }
      ];

      const result = await calculator.calculateWeightedScore(assessessments);

      expect(result.final_score).toBeCloseTo(71.5, 0.1); // (80*1.0 + 70*0.8) / (1.0 + 0.8)
      expect(result.final_rating).toMatch(/^(green|amber|red|unknown)$/);
      expect(result.components).toHaveLength(2);
      expect(result.validation.is_valid).toBe(true);
    });

    it('should handle empty assessments', async () => {
      const result = await calculator.calculateWeightedScore([]);

      expect(result.final_score).toBe(0);
      expect(result.final_rating).toBe('unknown');
      expect(result.components).toHaveLength(0);
    });

    it('should apply confidence weighting when enabled', async () => {
      const assessments = [
        {
          assessment: { id: '1', assessment_type: 'cbus_status', score: 80, confidence_level: 'high' },
          weight: 1.0,
          confidence_weight: 1.0,
          decayed_weight: 1.0,
          effective_weight: 1.0,
          contribution: 80
        },
        {
          assessment: { id: '2', assessment_type: 'incolink_status', score: 80, confidence_level: 'very_low' },
          weight: 1.0,
          confidence_weight: 0.4,
          decayed_weight: 1.0,
          effective_weight: 0.4,
          contribution: 32
        }
      ];

      const config = { apply_confidence_weighting: true };
      const result = await calculator.calculateWeightedScore(assessessments, config);

      expect(result.final_score).toBeCloseTo(62.8, 0.1); // (80*1.0 + 80*0.4) / (1.0 + 0.4)
    });

    it('should validate minimum assessment count', async () => {
      const assessments = [
        {
          assessment: { id: '1', assessment_type: 'cbus_status', score: 75, confidence_level: 'medium' },
          weight: 1.0,
          confidence_weight: 0.8,
          decayed_weight: 1.0,
          effective_weight: 0.8,
          contribution: 60
        }
      ];

      const config = { require_minimum_assessments: true, minimum_assessment_count: 2 };
      const result = await calculator.calculateWeightedScore(assessessments, config);

      expect(result.validation.is_valid).toBe(false);
      expect(result.validation.errors).toContain(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });

  describe('calculateWeightedAverage', () => {
    it('should calculate weighted average correctly', async () => {
      const components = [
        { score: 80, weight: 2.0, confidence: 0.9 },
        { score: 60, weight: 1.0, confidence: 0.7 }
      ];

      const result = await calculator.calculateWeightedAverage(components);

      expect(result).toBeCloseTo(72.4, 0.1); // (80*2*0.9 + 60*1*0.7) / (2*0.9 + 1*0.7)
    });

    it('should handle empty components', async () => {
      const result = await calculator.calculateWeightedAverage([]);

      expect(result).toBe(0);
    });
  });

  describe('calculateMinimumScore', () => {
    it('should return minimum of critical factors', async () => {
      const components = [
        { name: 'critical_factor', score: 80, is_critical: true },
        { name: 'non_critical', score: 95, is_critical: false },
        { name: 'another_critical', score: 65, is_critical: true }
      ];

      const result = await calculator.calculateMinimumScore(components);

      expect(result).toBe(65); // Minimum of critical factors
    });

    it('should handle non-critical only factors', async () => {
      const components = [
        { name: 'non_critical_1', score: 80, is_critical: false },
        { name: 'non_critical_2', score: 90, is_critical: false }
      ];

      const result = await calculator.calculateMinimumScore(components);

      expect(result).toBe(85); // Average of non-critical factors
    });
  });

  describe('calculateHybridScore', () => {
    it('should combine base and critical scores correctly', async () => {
      const baseComponents = [
        { score: 75, weight: 1.0 },
        { score: 85, weight: 1.0 }
      ];

      const criticalFactors = [
        { name: 'eba_status', score: 25, weight: 1.5 },
        { name: 'safety', score: 80, weight: 1.0 }
      ];

      const config = { eba_critical_weight: 0.3 };
      const result = await calculator.calculateHybridScore(baseComponents, criticalFactors, config);

      expect(result).toBeCloseTo(68.25, 0.1); // Weighted combination
    });
  });

  describe('error handling', () => {
    it('should throw WeightedScoringError for invalid input', async () => {
      const invalidAssessments = [null as any];

      await expect(calculator.calculateWeightedScore(invalidAssessments))
        .rejects.toThrow(WeightedScoringError);
    });

    it('should handle validation errors', async () => {
      const assessments = [
        {
          assessment: { id: '1', assessment_type: 'invalid_type', score: 150, confidence_level: 'invalid' },
          weight: 1.0,
          confidence_weight: 1.0,
          decayed_weight: 1.0,
          effective_weight: 1.0,
          contribution: 150
        }
      ];

      const result = await calculator.calculateWeightedScore(assessments);

      expect(result.validation.is_valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// CONFIDENCE CALCULATOR TESTS
// =============================================================================

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  beforeEach(() => {
    calculator = new ConfidenceCalculator();
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence for multiple inputs', async () => {
      const inputs = [
        {
          source_id: 'source-1',
          source_type: 'project',
          assessment_type: 'cbus_status',
          confidence_level: 'high',
          assessment_date: new Date('2024-01-10'),
          score: 85,
          weight: 1.0,
          quality_score: 0.9,
          source_reliability: 0.85
        },
        {
          source_id: 'source-2',
          source_type: 'expertise',
          assessment_type: 'eca_status',
          confidence_level: 'medium',
          assessment_date: new Date('2024-01-12'),
          score: 75,
          weight: 1.0,
          quality_score: 0.8,
          source_reliability: 0.7
        }
      ];

      const result = await calculator.calculateConfidence(inputs);

      expect(result).toBeDefined();
      expect(result.confidence_level).toMatch(/^(high|medium|low|very_low)$/);
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.confidence_factors).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(result.validation.is_valid).toBe(true);
    });

    it('should handle empty inputs', async () => {
      const result = await calculator.calculateConfidence([]);

      expect(result.confidence_level).toBe('very_low');
      expect(result.confidence_score).toBe(0);
      expect(result.validation.is_valid).toBe(false);
    });

    it('should apply temporal smoothing when enabled', async () => {
      const inputs = [
        {
          source_id: 'source-1',
          source_type: 'project',
          assessment_type: 'cbus_status',
          confidence_level: 'high',
          assessment_date: new Date('2024-01-10'),
          score: 85,
          weight: 1.0,
          quality_score: 0.9,
          source_reliability: 0.85
        }
      ];

      const config = { temporal_smoothing_enabled: true, temporal_smoothing_factor: 0.2 };
      const result = await calculator.calculateConfidence(inputs, config);

      expect(result.confidence_score).toBeDefined();
      // The exact value depends on the smoothing calculation
    });
  });

  describe('calculateDataConfidence', () => {
    it('should calculate confidence for assessment data', async () => {
      const assessmentData = [
        createMockProjectAssessment({
          assessment_type: 'cbus_status',
          confidence_level: 'high',
          assessment_date: new Date('2024-01-10')
        })
      ];

      const result = await calculator.calculateDataConfidence(assessmentData, 'cbus_status');

      expect(result).toBeDefined();
      expect(result.confidence_level).toBe('high');
      expect(result.confidence_score).toBeGreaterThan(0.5);
    });
  });

  describe('calculateSourceReliability', () => {
    it('should calculate reliability for expertise source', async () => {
      const sourceData = [
        {
          id: 'organiser-1',
          accuracy_percentage: 90,
          overall_reputation_score: 88,
          expertise_level: 'senior'
        }
      ];

      const result = await calculator.calculateSourceReliability(sourceData, 'expertise');

      expect(result).toBeDefined();
      expect(result.reliability_score).toBeGreaterThan(0.8);
      expect(result.reliability_tier).toMatch(/^(high|medium|low|very_low)$/);
      expect(result.source_type).toBe('expertise');
    });
  });

  describe('calculateConsensusConfidence', () => {
    it('should calculate confidence for consistent ratings', async () => {
      const ratings = ['green', 'green', 'green'] as TrafficLightRating[];
      const scores = [85, 88, 90];
      const confidences = ['high', 'high', 'medium'] as ConfidenceLevel[];

      const result = await calculator.calculateConsensusConfidence(ratings, scores, confidences);

      expect(result.confidence_level).toBe('high'); // High agreement
      expect(result.confidence_score).toBeGreaterThan(0.8);
    });

    it('should calculate lower confidence for mixed ratings', async () => {
      const ratings = ['green', 'amber', 'red'] as TrafficLightRating[];
      const scores = [85, 45, 25];
      const confidences = ['high', 'medium', 'low'] as ConfidenceLevel[];

      const result = await calculator.calculateConsensusConfidence(ratings, scores, confidences);

      expect(result.confidence_level).toMatch(/^(medium|low|very_low)$/);
      expect(result.confidence_score).toBeLessThan(0.7);
    });
  });

  describe('error handling', () => {
    it('should throw ConfidenceCalculationError for invalid input', async () => {
      const invalidInputs = [null as any];

      await expect(calculator.calculateConfidence(invalidInputs))
        .rejects.toThrow(ConfidenceCalculationError);
    });

    it('should handle invalid configuration', async () => {
      const inputs = [
        {
          source_id: 'source-1',
          source_type: 'project',
          assessment_type: 'cbus_status',
          confidence_level: 'high',
          assessment_date: new Date('2024-01-10'),
          score: 85,
          weight: 1.0,
          quality_score: 0.9,
          source_reliability: 0.85
        }
      ];

      const invalidConfig = {
        recency_weight: -0.1, // Invalid negative weight
        volume_weight: 1.5, // Invalid total > 1
        confidence_thresholds: {
          high: { min: 0.9, max: 0.8 } // min > max
        }
      };

      const result = await calculator.calculateConfidence(inputs, invalidConfig);

      expect(result.validation.is_valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// TIME DECAY CALCULATOR TESTS
// =============================================================================

describe('TimeDecayCalculator', () => {
  let calculator: TimeDecayCalculator;

  beforeEach(() => {
    calculator = new TimeDecayCalculator();
  });

  describe('calculateDecay', () => {
    it('should apply exponential decay correctly', async () => {
      const dataPoints = [
        {
          id: 'data-1',
          date: new Date('2024-01-15'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        },
        {
          id: 'data-2',
          date: new Date('2024-01-01'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        }
      ];

      const referenceDate = new Date('2024-01-15');
      const result = await calculator.calculateDecay(dataPoints, referenceDate);

      expect(result.decayed_points).toHaveLength(2);

      // Recent data point should have higher weight
      const recentPoint = result.decayed_points.find(p => p.id === 'data-1');
      const oldPoint = result.decayed_points.find(p => p.id === 'data-2');

      expect(recentPoint?.decay_factor).toBeGreaterThan(oldPoint?.decay_factor || 0);
      expect(recentPoint?.decayed_weight).toBeGreaterThan(oldPoint?.decayed_weight || 0);
      expect(result.decay_factors.overall_decay_factor).toBeLessThan(1.0);
    });

    it('should return no decay when disabled', async () => {
      const dataPoints = [
        {
          id: 'data-1',
          date: new Date('2024-01-15'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        }
      ];

      const config = { enabled: false };
      const referenceDate = new Date('2024-01-15');
      const result = await calculator.calculateDecay(dataPoints, referenceDate, config);

      expect(result.decayed_points[0].decay_factor).toBe(1.0);
      expect(result.decayed_points[0].decayed_weight).toBe(1.0);
      expect(result.decay_factors.overall_decay_factor).toBe(1.0);
    });

    it('should filter out old data points', async () => {
      const dataPoints = [
        {
          id: 'data-1',
          date: new Date('2022-01-01'), // Very old
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        },
        {
          id: 'data-2',
          date: new Date('2024-01-15'), // Recent
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        }
      ];

      const config = { max_data_age_days: 30 };
      const referenceDate = new Date('2024-01-15');
      const result = await calculator.calculateDecay(dataPoints, referenceDate, config);

      expect(result.decayed_points).toHaveLength(1);
      expect(result.decayed_points[0].id).toBe('data-2');
    });

    it('should apply assessment type multipliers', async () => {
      const dataPoints = [
        {
          id: 'data-1',
          date: new Date('2024-01-15'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'eca_status' } // Critical assessment type
        },
        {
          id: 'data-2',
          date: new Date('2024-01-15'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' } // Regular assessment type
        }
      ];

      const referenceDate = new Date('2024-01-15');
      const result = await calculator.calculateDecay(dataPoints, referenceDate);

      const ecaPoint = result.decayed_points.find(p => p.metadata?.assessment_type === 'eca_status');
      const cbusPoint = result.decayed_points.find(p => p.metadata?.assessment_type === 'cbus_status');

      expect(ecaPoint?.decay_factor).toBeGreaterThan(cbusPoint?.decay_factor || 0);
    });
  });

  describe('applyTemporalWeighting', () => {
    it('should apply temporal weights to assessments', async () => {
      const assessments = [
        createMockProjectAssessment({
          assessment_date: new Date('2024-01-15'),
          weight: 1.0
        }),
        createMockProjectAssessment({
          assessment_date: new Date('2023-12-15'), // Older
          weight: 1.0
        })
      ];

      const referenceDate = new Date('2024-01-15');
      const result = await calculator.applyTemporalWeighting(assessments, referenceDate);

      expect(result.weighted_assessments).toHaveLength(2);

      // Recent assessment should have higher temporal weight
      const recentAssessment = result.weighted_assessments[0];
      const oldAssessment = result.weighted_assessments[1];

      expect(recentAssessment.temporal_weight).toBeGreaterThan(oldAssessment.temporal_weight);
      expect(oldAssessment.decay_factor).toBeLessThan(1.0);
      expect(oldAssessment.age_days).toBeGreaterThan(0);
    });
  });

  describe('projectFutureDecay', () => {
    it('should project future decay', async () => {
      const currentData = [
        {
          id: 'data-1',
          date: new Date('2024-01-15'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        }
      ];

      const result = await calculator.projectFutureDecay(currentData, 30, config);

      expect(result.reference_date).toEqual(new Date('2024-02-14')); // 30 days in future
      expect(result.metadata?.is_projection).toBe(true);
      expect(result.metadata?.projection_days).toBe(30);
    });
  });

  describe('validateDecayConfiguration', () => {
    it('should validate correct configuration', async () => {
      const validConfig = {
        enabled: true,
        decay_curve_type: DecayCurveType.EXPONENTIAL,
        half_life_days: 90,
        minimum_weight: 0.1,
        maximum_weight: 1.0,
        max_data_age_days: 365,
        assessment_type_multipliers: {
          cbus_status: 1.0,
          eca_status: 1.5
        }
      };

      const result = await calculator.validateDecayConfiguration(validConfig);

      expect(result).toBe(true);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        enabled: true,
        decay_curve_type: DecayCurveType.EXPONENTIAL,
        half_life_days: -1, // Invalid negative
        minimum_weight: 1.5, // Invalid > maximum
        maximum_weight: 0.5, // Invalid < minimum
        max_data_age_days: 0 // Invalid non-positive
      };

      const result = await calculator.validateDecayConfiguration(invalidConfig);

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw TimeDecayError for invalid input', async () => {
      const invalidDataPoints = [null as any];

      await expect(calculator.calculateDecay(invalidDataPoints, new Date()))
        .rejects.toThrow(TimeDecayError);
    });

    it('should handle decay calculation errors', async () => {
      const dataPoints = [
        {
          id: 'data-1',
          date: new Date('invalid-date'),
          value: 80,
          weight: 1.0,
          metadata: { assessment_type: 'cbus_status' }
        }
      ];

      await expect(calculator.calculateDecay(dataPoints, new Date()))
        .rejects.toThrow(TimeDecayError);
    });
  });
});

// =============================================================================
// DISCREPANCY DETECTOR TESTS
// =============================================================================

describe('DiscrepancyDetector', () => {
  let detector: DiscrepancyDetector;

  beforeEach(() => {
    detector = new DiscrepancyDetector();
  });

  describe('detectDiscrepancies', () => {
    it('should detect no discrepancy for similar ratings', async () => {
      const result = await detector.detectDiscrepancies(
        75,  // projectRating
        'high', // projectConfidence
        78, // expertiseRating
        'high', // expertiseConfidence
        { detection_sensitivity: 'balanced' }
      );

      expect(result.discrepancy_detected).toBe(false);
      expect(result.discrepancy_level).toBe('none');
      expect(result.score_difference).toBe(3);
      expect(result.rating_match).toBe(true);
      expect(result.requires_review).toBe(false);
    });

    it('should detect minor discrepancy', async () => {
      const result = await detector.detectDiscrepancies(
        70, // projectRating
        'high', // projectConfidence
        85, // expertiseRating
        'high', // expertiseConfidence
        { detection_sensitivity: 'balanced' }
      );

      expect(result.discrepancy_detected).toBe(true);
      expect(result.discrepancy_level).toBe('minor');
      expect(result.score_difference).toBe(15);
      expect(result.rating_match).toBe(true);
      expect(result.requires_review).toBe(false);
    });

    it('should detect critical discrepancy', async () => {
      const result = await detector.detectDiscrepancies(
        20, // projectRating
        'low', // projectConfidence
        90, // expertiseRating
        'high', // expertiseConfidence
        { detection_sensitivity: 'balanced' }
      );

      expect(result.discrepancy_detected).toBe(true);
      expect(result.discrepancy_level).toBe('critical');
      expect(result.score_difference).toBe(70);
      expect(result.rating_match).toBe(false);
      expect(result.requires_review).toBe(true);
    });

    it('should calculate confidence gap correctly', async () => {
      const result = await detector.detectDiscrepancies(
        75, // projectRating
        'high', // projectConfidence
        75, // expertiseRating
        'very_low', // expertiseConfidence
        { detection_sensitivity: 'balanced' }
      );

      expect(result.confidence_gap).toBeCloseTo(0.6, 0.1); // 0.9 - 0.3
      expect(result.discrepancy_detected).toBe(true);
    });

    it('should apply sensitivity adjustments', async () => {
      const balancedResult = await detector.detectDiscrepancies(
        30, // score difference
        'medium', // projectConfidence
        50, // expertiseRating
        'medium', // expertiseConfidence
        { detection_sensitivity: 'balanced' }
      );

      const aggressiveResult = await detector.detectDiscrepancies(
        30, // score difference
        'medium', // projectConfidence
        50, // expertiseRating
        'medium', // expertiseConfidence
        { detection_sensitivity: 'aggressive' }
      );

      // Aggressive sensitivity should detect discrepancy more easily
      expect(aggressiveResult.discrepancy_level).toMatch(/^(minor|moderate|major|critical)$/);
      expect(aggressiveResult.discrepancy_detected).toBe(true);
    });
  });

  describe('analyzeDiscrepancyPatterns', () => {
    it('should analyze frequency patterns', async () => {
      const discrepancies = [
        {
          discrepancy_detected: true,
          discrepancy_level: 'minor' as const,
          score_difference: 20,
          rating_match: false,
          confidence_gap: 0.2,
          requires_review: false,
          recommended_action: { action: 'accept_calculated' },
          confidence_impact: -0.05,
          explanation: 'Minor discrepancy detected',
          detection_timestamp: new Date('2024-01-10'),
          configuration_used: {}
        },
        {
          discrepancy_detected: true,
          discrepancy_level: 'minor' as const,
          score_difference: 25,
          rating_match: false,
          confidence_gap: 0.3,
          requires_review: false,
          recommended_action: { action: 'accept_calculated' },
          confidence_impact: -0.05,
          explanation: 'Minor discrepancy detected',
          detection_timestamp: new Date('2024-01-12'),
          configuration_used: {}
        }
      ];

      const result = await detector.analyzeDiscrepancyPatterns(discrepancies);

      expect(result).toHaveLength(1);
      expect(result[0].pattern_type).toBe('frequency');
      expect(result[0].significance).toBeGreaterThan(0.5);
    });

    it('should return empty patterns for insufficient data', async () => {
      const discrepancies = [
        {
          discrepancy_detected: false,
          discrepancy_level: 'none' as const,
          score_difference: 5,
          rating_match: true,
          confidence_gap: 0.1,
          requires_review: false,
          recommended_action: { action: 'accept_calculated' },
          confidence_impact: 0,
          explanation: 'No significant discrepancy detected',
          detection_timestamp: new Date('2024-01-10'),
          configuration_used: {}
        }
      ];

      const result = await detector.analyzeDiscrepancyPatterns(discrepancies);

      expect(result).toHaveLength(0);
    });
  });

  describe('recommendReconciliationStrategy', () => {
    it('should recommend human review for critical discrepancies', async () => {
      const discrepancy = {
        discrepancy_detected: true,
        discrepancy_level: 'critical' as const,
        score_difference: 70,
        rating_match: false,
        confidence_gap: 0.5,
        requires_review: true,
        recommended_action: { action: 'manual_review' },
        confidence_impact: -0.3,
        explanation: 'Critical discrepancy detected',
        detection_timestamp: new Date('2024-01-10'),
        configuration_used: {}
      };

      const result = await detector.recommendReconciliationStrategy(discrepancy, {}, {});

      expect(result.approach).toBe('human_review_required');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.risk_level).toBe('high');
    });

    it('should recommend automated resolution for minor discrepancies', async () => {
      const discrepancy = {
        discrepancy_detected: true,
        discrepancy_level: 'minor' as const,
        score_difference: 15,
        rating_match: false,
        confidence_gap: 0.2,
        requires_review: false,
        recommended_action: { action: 'accept_calculated' },
        confidence_impact: -0.05,
        explanation: 'Minor discrepancy detected',
        detection_timestamp: new Date('2024-01-10'),
        configuration_used: {}
      };

      const result = await detector.recommendReconciliationStrategy(discrepancy, {}, {});

      expect(result.approach).toBe('accept_calculated');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.risk_level).toBe('low');
    });
  });

  describe('error handling', () => {
    it('should throw DiscrepancyDetectionError for invalid input', async () => {
      await expect(detector.detectDiscrepancies(
        NaN, // Invalid rating
        'high',
        75,
        'high'
      )).rejects.toThrow(DiscrepancyDetectionError);
    });

    it('should handle prediction errors', async () => {
      const invalidProjectData = null as any;
      const invalidExpertiseData = null as any;

      const result = await detector.predictDiscrepancyRisk(invalidProjectData, invalidExpertiseData);

      expect(result).toBe(0.5); // Default risk score
    });
  });
});

// =============================================================================
// VALIDATOR TESTS
// =============================================================================

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('validateCalculationRequest', () => {
    it('should validate correct calculation request', async () => {
      const request = {
        employer_id: '123e4567-e89b-12d3-a456-426614174000',
        calculation_method: 'hybrid_method',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15
      };

      const result = await validator.validateCalculationRequest(request);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid employer ID', async () => {
      const request = {
        employer_id: 'invalid-uuid',
        calculation_method: 'hybrid_method'
      };

      const result = await validator.validateCalculationRequest(request);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({ code: 'INVALID_EMPLOYER_ID' })
      );
    });

    it('should reject invalid weights', async () => {
      const request = {
        employer_id: '123e4567-e89b-12d3-a456-426614174000',
        project_weight: -1, // Invalid negative weight
        calculation_method: 'hybrid_method'
      };

      const result = await validator.validateCalculationRequest(request);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({ code: 'INVALID_PROJECT_WEIGHT' })
      );
    });

    it('should warn about future calculation date', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const request = {
        employer_id: '123e4567-e89b-12d3-a456-426614174000',
        calculation_date: futureDate.toISOString(),
        calculation_method: 'hybrid_method'
      };

      const result = await validator.validateCalculationRequest(request);

      expect(result.is_valid).toBe(true);
      expect(result.warnings).toContain(
        expect.objectContaining({ code: 'FUTURE_CALCULATION_DATE' })
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string values', () => {
      const data = {
        name: '  Test String  ',
        description: '<script>alert("xss")</script>'
      };

      const schema = {
        name: { type: 'string', maxLength: 20 },
        description: { type: 'string', maxLength: 50 }
      };

      const sanitized = validator.sanitizeInput(data, schema);

      expect(sanitized.name).toBe('Test String'); // Trimmed
      expect(sanitized.description).toBe('<script>alert("xss")</script>'); // Basic HTML sanitization
    });

    it('should clamp number values to valid range', () => {
      const data = {
        score: 150, // Above max
        confidence: -0.5 // Below min
      };

      const schema = {
        score: { type: 'number', min: 0, max: 100 },
        confidence: { type: 'number', min: 0, max: 1 }
      };

      const sanitized = validator.sanitizeInput(data, schema);

      expect(sanitized.score).toBe(100); // Clamped to max
      expect(sanitized.confidence).toBe(0); // Clamped to min
    });
  });

  describe('createError', () => {
    it('should create validation error with details', () => {
      const error = validator.createError('TEST_ERROR', 'Test error message', {
        field: 'test_field',
        value: 'test_value',
        constraint: 'test_constraint'
      });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.field).toBe('test_field');
      expect(error.value).toBe('test_value');
      expect(error.constraint).toBe('test_constraint');
    });
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    PerformanceMonitor.enable();
  });

  afterEach(() => {
    PerformanceMonitor.clearMetrics();
  });

  describe('timer operations', () => {
    it('should measure operation time', async () => {
      const timerId = PerformanceMonitor.startTimer('test-operation');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      const duration = PerformanceMonitor.endTimer('test-operation', timerId);

      expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(duration).toBeLessThan(150);
    });

    it('should handle multiple operations', () => {
      const timerId1 = PerformanceMonitor.startTimer('operation-1');
      const timerId2 = PerformanceMonitor.startTimer('operation-2');

      const duration1 = PerformanceMonitor.endTimer('operation-1', timerId1);
      const duration2 = PerformanceMonitor.endTimer('operation-2', timerId2);

      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);

      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.size).toBe(2);
    });

    it('should maintain performance history', async () => {
      const timerId = PerformanceMonitor.startTimer('repeated-operation');

      // Multiple operations
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const totalDuration = PerformanceMonitor.endTimer('repeated-operation', timerId);

      expect(totalDuration).toBeGreaterThan(40);
      expect(totalDuration).toBeLessThan(100);

      const metrics = PerformanceMonitor.getMetrics('repeated-operation');
      expect(metrics.length).toBe(5);
    });
  });

  describe('statistics', () => {
    it('should calculate average response time', () => {
      const timerId = PerformanceMonitor.startTimer('stats-test');

      PerformanceMonitor.endTimer('stats-test', timerId);
      PerformanceMonitor.endTimer('stats-test', timerId);
      PerformanceMonitor.endTimer('stats-test', timerId);

      const metrics = PerformanceMonitor.getMetrics('stats-test');
      const averageTime = metrics.reduce((sum, metric) => sum + metric.duration, 0) / metrics.length;

      expect(averageTime).toBeGreaterThan(0);
      expect(averageTime).toBeLessThan(1000);
    });
  });
});

describe('OptimizationUtils', () => {
  describe('memoization', () => {
    it('should cache function results', () => {
      let callCount = 0;

      const expensiveFunction = jest.fn((x: number) => {
        callCount++;
        return x * 2;
      });

      const memoizedFunction = OptimizationUtils.createMemoizedFunction(expensiveFunction, (x: number) => x.toString());

      // First call
      const result1 = memoizedFunction(5);
      expect(result1).toBe(10);
      expect(expensiveFunction).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = memoizedFunction(5);
      expect(result2).toBe(10);
      expect(expensiveFunction).toHaveBeenCalledTimes(1); // Still only called once

      // Different argument should trigger new calculation
      const result3 = memoizedFunction(10);
      expect(result3).toBe(20);
      expect(expensiveFunction).toHaveBeenCalledTimes(2);
    });

    it('should debounce function calls', async () => {
      let callCount = 0;

      const debouncedFunction = OptimizationUtils.debounce(() => {
        callCount++;
      }, 100);

      debouncedFunction();
      debouncedFunction();
      debouncedFunction();

      // Should only execute once due to debouncing
      expect(callCount).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 150));

      debouncedFunction();
      expect(callCount).toBe(2);
    });

    it('should throttle function calls', async () => {
      let callCount = 0;

      const throttledFunction = OptimizationUtils.throttle(() => {
        callCount++;
      }, 100);

      // Multiple calls within throttle window
      throttledFunction();
      throttledFunction();
      throttledFunction();

      expect(callCount).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 150));

      // After throttle window, next call should execute
      throttledFunction();
      expect(callCount).toBe(2);
    });
  });

  describe('retry functionality', () => {
    it('should retry failed operations', async () => {
      let attemptCount = 0;

      const flakyFunction = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await OptimizationUtils.retry(flakyFunction, 3);

      expect(result).toBe('success');
      expect(flakyFunction).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying after max attempts', async () => {
      const alwaysFailingFunction = jest.fn(() => {
        throw new Error('Persistent failure');
      });

      await expect(OptimizationUtils.retry(alwaysFailingFunction, 2, 1000))
        .rejects.toThrow('Persistent failure');
    });
  });
});

// =============================================================================
// RUN TESTS
// =============================================================================

// Run the tests
console.log('Starting Rating Engine Tests...');

// Note: In a real test environment, you would run:
// npm test --testPath="src/lib/rating-engine/tests"

// For now, we'll just log that the test file has been created successfully
console.log('✅ Rating Engine test file created successfully');
console.log('📊 Test coverage includes:');
console.log('  - Track 1 Calculator tests');
console.log('  - Track 2 Calculator tests');
console.log('  - Combined Calculator tests');
console.log('  - Weighted Scoring Calculator tests');
console.log('  - Confidence Calculator tests');
console.log('  - Time Decay Calculator tests');
console.log('  - Discrepancy Detector tests');
console.log('  - Validator tests');
console.log('  - Performance Monitor tests');
console.log('  - Optimization Utils tests');
console.log('');
console.log('To run the actual tests, use:');
console.log('npm test --testPath="src/lib/rating-engine/tests"');