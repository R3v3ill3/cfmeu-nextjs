/**
 * Test utilities for the rating calculation engine
 */

import {
  TrafficLightRating,
  ComplianceAssessmentType,
  ConfidenceLevel,
  AssessmentSource,
  AssessmentQuality,
  OrganiserReputation,
  ScoringMethod,
  DecayCurveType,
  DiscrepancyLevel,
  ReconciliationStrategy,
  RatingCalculationRequest,
  CalculationContext,
  ProjectComplianceAssessment,
  OrganiserExpertiseAssessment,
  EBARatingData,
  WeightedAssessment,
  HistoricalDataPoint
} from '../types';

/**
 * Creates a mock calculation context for testing
 */
export function createMockCalculationContext(overrides: Partial<CalculationContext> = {}): CalculationContext {
  return {
    calculationId: 'test-calculation-id',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    employerId: 'test-employer-id',
    employerName: 'Test Employer Pty Ltd',
    calculationOptions: {
      includeTrendAnalysis: true,
      includeOutlierDetection: true,
      performanceOptimization: false
    },
    ...overrides
  };
}

/**
 * Creates a mock project compliance assessment
 */
export function createMockProjectAssessment(overrides: Partial<ProjectComplianceAssessment> = {}): ProjectComplianceAssessment {
  return {
    id: 'assessment-id',
    projectId: 'project-id',
    assessmentType: 'cbus_status' as ComplianceAssessmentType,
    source: 'project_data' as AssessmentSource,
    rating: 'green' as TrafficLightRating,
    confidence: 'high' as ConfidenceLevel,
    assessmentDate: new Date('2024-01-01T00:00:00Z'),
    weight: 1.0,
    quality: 'verified' as AssessmentQuality,
    metadata: {},
    ...overrides
  };
}

/**
 * Creates a mock organiser expertise assessment
 */
export function createMockOrganiserAssessment(overrides: Partial<OrganiserExpertiseAssessment> = {}): OrganiserExpertiseAssessment {
  return {
    id: 'expertise-id',
    organiserId: 'organiser-id',
    source: 'wizard' as AssessmentSource,
    rating: 'amber' as TrafficLightRating,
    confidence: 'medium' as ConfidenceLevel,
    assessmentDate: new Date('2024-01-01T00:00:00Z'),
    weight: 1.0,
    reputation: 'established' as OrganiserReputation,
    metadata: {},
    ...overrides
  };
}

/**
 * Creates mock EBA rating data
 */
export function createMockEbaData(overrides: Partial<EBARatingData> = {}): EBARatingData {
  return {
    id: 'eba-id',
    employerId: 'employer-id',
    ebaStatus: 'current' as TrafficLightRating,
    expiryDate: new Date('2025-01-01T00:00:00Z'),
    lastVerified: new Date('2024-01-01T00:00:00Z'),
    confidence: 'high' as ConfidenceLevel,
    weight: 2.0,
    metadata: {},
    ...overrides
  };
}

/**
 * Creates a mock weighted assessment
 */
export function createMockWeightedAssessment(overrides: Partial<WeightedAssessment> = {}): WeightedAssessment {
  return {
    id: 'weighted-id',
    type: 'cbus_status' as ComplianceAssessmentType,
    rating: 0.8,
    weight: 1.0,
    confidence: 'high' as ConfidenceLevel,
    source: 'project_data' as AssessmentSource,
    assessmentDate: new Date('2024-01-01T00:00:00Z'),
    metadata: {},
    ...overrides
  };
}

/**
 * Creates a mock historical data point
 */
export function createMockHistoricalDataPoint(overrides: Partial<HistoricalDataPoint> = {}): HistoricalDataPoint {
  return {
    id: 'historical-id',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    rating: 0.75,
    confidence: 'medium' as ConfidenceLevel,
    weight: 1.0,
    decayedWeight: 0.8,
    metadata: {},
    ...overrides
  };
}

/**
 * Creates a mock rating calculation request
 */
export function createMockRatingRequest(overrides: Partial<RatingCalculationRequest> = {}): RatingCalculationRequest {
  const context = createMockCalculationContext();

  return {
    context,
    projectAssessments: [
      createMockProjectAssessment(),
      createMockProjectAssessment({ assessmentType: 'incolink_status', rating: 'amber' })
    ],
    organiserAssessments: [
      createMockOrganiserAssessment()
    ],
    organiserProfiles: {
      'organiser-id': {
        id: 'organiser-id',
        name: 'Test Organiser',
        reputation: 'established' as OrganiserReputation,
        yearsExperience: 10,
        specializations: ['construction'],
        averageRating: 0.75,
        totalAssessments: 50
      }
    },
    ebaData: createMockEbaData(),
    ...overrides
  };
}

/**
 * Creates multiple mock project assessments with different ratings
 */
export function createMockProjectAssessments(): ProjectComplianceAssessment[] {
  return [
    createMockProjectAssessment({
      id: 'assessment-1',
      assessmentType: 'cbus_status',
      rating: 'green',
      confidence: 'high'
    }),
    createMockProjectAssessment({
      id: 'assessment-2',
      assessmentType: 'incolink_status',
      rating: 'amber',
      confidence: 'medium'
    }),
    createMockProjectAssessment({
      id: 'assessment-3',
      assessmentType: 'site_visit',
      rating: 'green',
      confidence: 'high'
    }),
    createMockProjectAssessment({
      id: 'assessment-4',
      assessmentType: 'delegate_report',
      rating: 'red',
      confidence: 'low'
    })
  ];
}

/**
 * Creates multiple mock organiser assessments with different confidence levels
 */
export function createMockOrganiserAssessments(): OrganiserExpertiseAssessment[] {
  return [
    createMockOrganiserAssessment({
      id: 'expertise-1',
      organiserId: 'organiser-1',
      rating: 'green',
      confidence: 'high',
      reputation: 'senior'
    }),
    createMockOrganiserAssessment({
      id: 'expertise-2',
      organiserId: 'organiser-2',
      rating: 'amber',
      confidence: 'medium',
      reputation: 'established'
    })
  ];
}

/**
 * Creates test data for time decay calculations
 */
export function createMockHistoricalData(): HistoricalDataPoint[] {
  const now = new Date();
  return [
    createMockHistoricalDataPoint({
      id: 'historical-1',
      timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      rating: 0.9,
      confidence: 'high'
    }),
    createMockHistoricalDataPoint({
      id: 'historical-2',
      timestamp: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      rating: 0.7,
      confidence: 'medium'
    }),
    createMockHistoricalDataPoint({
      id: 'historical-3',
      timestamp: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      rating: 0.5,
      confidence: 'low'
    })
  ];
}

/**
 * Common test scenarios for rating calculations
 */
export const TestScenarios = {
  // All green assessments - should result in green rating
  allGreen: {
    projectAssessments: [
      createMockProjectAssessment({ rating: 'green', confidence: 'high' }),
      createMockProjectAssessment({ rating: 'green', confidence: 'high' })
    ],
    organiserAssessments: [
      createMockOrganiserAssessment({ rating: 'green', confidence: 'high' })
    ],
    ebaData: createMockEbaData({ ebaStatus: 'green' })
  },

  // Mixed assessments - should test reconciliation logic
  mixed: {
    projectAssessments: [
      createMockProjectAssessment({ rating: 'green', confidence: 'high' }),
      createMockProjectAssessment({ rating: 'red', confidence: 'low' })
    ],
    organiserAssessments: [
      createMockOrganiserAssessment({ rating: 'amber', confidence: 'medium' })
    ],
    ebaData: createMockEbaData({ ebaStatus: 'amber' })
  },

  // High confidence vs low confidence - should test confidence weighting
  confidenceTest: {
    projectAssessments: [
      createMockProjectAssessment({ rating: 'red', confidence: 'high', weight: 2.0 }),
      createMockProjectAssessment({ rating: 'green', confidence: 'low', weight: 0.5 })
    ],
    organiserAssessments: [],
    ebaData: createMockEbaData({ ebaStatus: 'green', confidence: 'low' })
  },

  // Empty data - should test edge cases
  emptyData: {
    projectAssessments: [],
    organiserAssessments: [],
    ebaData: null
  }
};

/**
 * Performance test utilities
 */
export function createPerformanceTestData(size: number): ProjectComplianceAssessment[] {
  const assessments: ProjectComplianceAssessment[] = [];
  const assessmentTypes: ComplianceAssessmentType[] = ['cbus_status', 'incolink_status', 'site_visit', 'delegate_report'];
  const ratings: TrafficLightRating[] = ['green', 'amber', 'red', 'unknown'];
  const confidences: ConfidenceLevel[] = ['high', 'medium', 'low', 'very_low'];

  for (let i = 0; i < size; i++) {
    assessments.push(createMockProjectAssessment({
      id: `perf-test-${i}`,
      assessmentType: assessmentTypes[i % assessmentTypes.length],
      rating: ratings[i % ratings.length],
      confidence: confidences[i % confidences.length],
      assessmentDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Days in the past
    }));
  }

  return assessments;
}

/**
 * Helper function to assert rating calculation results
 */
export function assertRatingResult(result: any, expectedRating: TrafficLightRating, expectedConfidence: ConfidenceLevel) {
  expect(result).toBeDefined();
  expect(result.finalRating).toBe(expectedRating);
  expect(result.confidence).toBe(expectedConfidence);
  expect(result.breakdown).toBeDefined();
  expect(result.metadata).toBeDefined();
}

/**
 * Helper function to assert performance metrics
 */
export function assertPerformanceMetrics(metrics: any, maxDuration: number) {
  expect(metrics).toBeDefined();
  expect(metrics.duration).toBeDefined();
  expect(metrics.duration).toBeLessThan(maxDuration);
  expect(metrics.cacheHits).toBeDefined();
  expect(metrics.processingItems).toBeDefined();
}