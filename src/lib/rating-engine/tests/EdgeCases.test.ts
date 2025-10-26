/**
 * Edge cases and error scenario tests for the rating calculation engine
 * These tests ensure the system handles unusual situations gracefully
 */

import {
  Track1Calculator,
  Track2Calculator,
  CombinedCalculator,
  WeightedScoringCalculator,
  ConfidenceCalculator,
  TimeDecayCalculator,
  DiscrepancyDetector,
  Validator
} from '../core';

import {
  createMockCalculationContext,
  createMockRatingRequest,
  createMockProjectAssessment,
  createMockOrganiserAssessment,
  createMockEbaData,
  createMockHistoricalDataPoint,
  createPerformanceTestData
} from './testUtils';

describe('Rating Engine Edge Cases & Error Scenarios', () => {
  let track1Calculator: Track1Calculator;
  let track2Calculator: Track2Calculator;
  let combinedCalculator: CombinedCalculator;
  let weightedScoringCalculator: WeightedScoringCalculator;
  let confidenceCalculator: ConfidenceCalculator;
  let timeDecayCalculator: TimeDecayCalculator;
  let discrepancyDetector: DiscrepancyDetector;
  let validator: Validator;

  beforeEach(() => {
    track1Calculator = new Track1Calculator();
    track2Calculator = new Track2Calculator();
    combinedCalculator = new CombinedCalculator();
    weightedScoringCalculator = new WeightedScoringCalculator();
    confidenceCalculator = new ConfidenceCalculator();
    timeDecayCalculator = new TimeDecayCalculator();
    discrepancyDetector = new DiscrepancyDetector();
    validator = new Validator();
  });

  describe('Empty and Null Data Handling', () => {
    it('should handle empty project assessments array', async () => {
      const request = createMockRatingRequest({
        projectAssessments: [],
        organiserAssessments: [createMockOrganiserAssessment()],
        ebaData: createMockEbaData()
      });

      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(true);

      const result = await track1Calculator.calculateRating(
        request.projectAssessments,
        request.context
      );

      expect(result).toBeDefined();
      expect(result.rating).toBe(0.5); // Default neutral rating
      expect(result.confidence).toBe('very_low');
    });

    it('should handle null EBA data', async () => {
      const request = createMockRatingRequest({
        ebaData: null
      });

      const track1Result = await track1Calculator.calculateRating(
        request.projectAssessments,
        request.context
      );

      const track2Result = await track2Calculator.calculateRating(
        request.organiserAssessments,
        request.organiserProfiles,
        request.context
      );

      const finalResult = await combinedCalculator.calculateFinalRating(
        track1Result,
        track2Result,
        null, // No EBA data
        request.context
      );

      expect(finalResult).toBeDefined();
      expect(finalResult.metadata.ebaInfluence).toBe(0);
    });

    it('should handle all null assessments', async () => {
      const request = createMockRatingRequest({
        projectAssessments: [],
        organiserAssessments: [],
        ebaData: null
      });

      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('No assessment data provided');
    });
  });

  describe('Invalid Data Scenarios', () => {
    it('should handle assessments with invalid ratings', async () => {
      const invalidAssessment = createMockProjectAssessment({
        // @ts-ignore - intentionally invalid data
        rating: 'invalid_rating'
      });

      const request = createMockRatingRequest({
        projectAssessments: [invalidAssessment]
      });

      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(e => e.includes('rating'))).toBe(true);
    });

    it('should handle assessments with future dates', async () => {
      const futureAssessment = createMockProjectAssessment({
        assessmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      });

      const request = createMockRatingRequest({
        projectAssessments: [futureAssessment]
      });

      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.warnings.length).toBeGreaterThan(0);
      expect(validationResult.warnings.some(w => w.includes('future'))).toBe(true);
    });

    it('should handle assessments with extremely old dates', async () => {
      const ancientAssessment = createMockProjectAssessment({
        assessmentDate: new Date('1900-01-01T00:00:00Z')
      });

      const request = createMockRatingRequest({
        projectAssessments: [ancientAssessment]
      });

      const track1Result = await track1Calculator.calculateRating(
        request.projectAssessments,
        request.context
      );

      expect(track1Result).toBeDefined();
      expect(track1Result.metadata.agedAssessments).toBeGreaterThan(0);
    });

    it('should handle assessments with extreme weights', async () => {
      const extremeWeightAssessment = createMockProjectAssessment({
        weight: 1000.0 // Extremely high weight
      });

      const request = createMockRatingRequest({
        projectAssessments: [extremeWeightAssessment]
      });

      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.warnings.some(w => w.includes('weight'))).toBe(true);
    });
  });

  describe('Calculation Edge Cases', () => {
    it('should handle division by zero scenarios', async () => {
      const assessments = [
        createMockProjectAssessment({ weight: 0 }), // Zero weight
        createMockProjectAssessment({ weight: 0 })  // Zero weight
      ];

      const result = await track1Calculator.calculateRating(
        assessments,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.rating).toBe(0.5); // Should handle gracefully
    });

    it('should handle single assessment', async () => {
      const singleAssessment = [createMockProjectAssessment()];

      const result = await track1Calculator.calculateRating(
        singleAssessment,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.rating).toBeGreaterThanOrEqual(0);
      expect(result.rating).toBeLessThanOrEqual(1);
    });

    it('should handle identical assessments', async () => {
      const baseAssessment = createMockProjectAssessment();
      const identicalAssessments = Array(10).fill(baseAssessment);

      const result = await track1Calculator.calculateRating(
        identicalAssessments,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBe('high'); // High confidence from consensus
    });

    it('should handle completely opposite assessments', async () => {
      const oppositeAssessments = [
        createMockProjectAssessment({ rating: 'green', confidence: 'high', weight: 2.0 }),
        createMockProjectAssessment({ rating: 'red', confidence: 'high', weight: 2.0 })
      ];

      const result = await track1Calculator.calculateRating(
        oppositeAssessments,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.rating).toBe(0.5); // Should average to neutral
      expect(result.confidence).toBe('low'); // Low confidence due to conflict
    });
  });

  describe('Time Decay Edge Cases', () => {
    it('should handle very recent historical data', async () => {
      const recentData = [
        createMockHistoricalDataPoint({
          timestamp: new Date(), // Right now
          rating: 0.9,
          confidence: 'high'
        })
      ];

      const result = await timeDecayCalculator.calculateDecay(
        recentData,
        new Date(),
        { decayRate: 0.1 }
      );

      expect(result.decayedData[0].decayedWeight).toBeCloseTo(1.0, 2);
    });

    it('should handle very old historical data', async () => {
      const ancientData = [
        createMockHistoricalDataPoint({
          timestamp: new Date('2000-01-01T00:00:00Z'), // Very old
          rating: 0.9,
          confidence: 'high'
        })
      ];

      const result = await timeDecayCalculator.calculateDecay(
        ancientData,
        new Date(),
        { decayRate: 0.5, halfLifeDays: 30 }
      );

      expect(result.decayedData[0].decayedWeight).toBeLessThan(0.01);
    });

    it('should handle zero decay rate', async () => {
      const data = [
        createMockHistoricalDataPoint({
          timestamp: new Date('2020-01-01T00:00:00Z'),
          rating: 0.8,
          confidence: 'medium'
        })
      ];

      const result = await timeDecayCalculator.calculateDecay(
        data,
        new Date(),
        { decayRate: 0 } // No decay
      );

      expect(result.decayedData[0].decayedWeight).toBe(data[0].weight);
    });

    it('should handle extreme decay rate', async () => {
      const data = [
        createMockHistoricalDataPoint({
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          rating: 0.8,
          confidence: 'medium'
        })
      ];

      const result = await timeDecayCalculator.calculateDecay(
        data,
        new Date(),
        { decayRate: 10.0 } // Extreme decay
      );

      expect(result.decayedData[0].decayedWeight).toBeLessThan(0.1);
    });
  });

  describe('Discrepancy Detection Edge Cases', () => {
    it('should handle identical project and expertise ratings', async () => {
      const result = await discrepancyDetector.detectDiscrepancies(
        0.8, // Project rating
        'high',
        0.8, // Expertise rating
        'high'
      );

      expect(result.hasDiscrepancy).toBe(false);
      expect(result.discrepancyLevel).toBe('none');
    });

    it('should handle maximum possible discrepancy', async () => {
      const result = await discrepancyDetector.detectDiscrepancies(
        0.0, // Lowest project rating
        'high',
        1.0, // Highest expertise rating
        'high'
      );

      expect(result.hasDiscrepancy).toBe(true);
      expect(result.discrepancyLevel).toBe('critical');
      expect(result.recommendations.length).toBeGreaterThan(2);
    });

    it('should handle low confidence data', async () => {
      const result = await discrepancyDetector.detectDiscrepancies(
        0.2,
        'very_low', // Low confidence
        0.8,
        'very_low'  // Low confidence
      );

      expect(result.hasDiscrepancy).toBe(true);
      expect(result.confidenceImpact).toBe('reduced');
      expect(result.recommendations.some(r => r.includes('verification'))).toBe(true);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle extremely large assessment arrays', async () => {
      const largeDataset = createPerformanceTestData(10000);

      const startTime = Date.now();
      const result = await track1Calculator.calculateRating(
        largeDataset,
        createMockCalculationContext({
          calculationOptions: { performanceOptimization: true }
        })
      );
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.metadata.processedCount).toBe(10000);
    });

    it('should handle assessments with minimal metadata', async () => {
      const minimalAssessment = {
        id: 'minimal',
        projectId: 'project',
        assessmentType: 'cbus_status' as const,
        source: 'project_data' as const,
        rating: 'green' as const,
        confidence: 'high' as const,
        assessmentDate: new Date(),
        weight: 1.0,
        quality: 'verified' as const,
        metadata: {} // Empty metadata
      };

      const result = await track1Calculator.calculateRating(
        [minimalAssessment],
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.rating).toBeGreaterThan(0);
    });

    it('should handle assessments with excessive metadata', async () => {
      const excessiveMetadata = {
        ...createMockProjectAssessment(),
        metadata: {
          ...Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`]).flat(),
          deepNested: {
            ...Array.from({ length: 100 }, (_, i) => ({ [`nested${i}`]: `value${i}` }))
          }
        }
      };

      const startTime = Date.now();
      const result = await track1Calculator.calculateRating(
        [excessiveMetadata],
        createMockCalculationContext()
      );
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should still be reasonable
    });
  });

  describe('Data Type Edge Cases', () => {
    it('should handle numeric edge values', async () => {
      const edgeAssessments = [
        createMockProjectAssessment({ weight: Number.MIN_VALUE }),
        createMockProjectAssessment({ weight: Number.MAX_VALUE }),
        createMockProjectAssessment({ weight: Number.EPSILON }),
        createMockProjectAssessment({ weight: Number.POSITIVE_INFINITY })
      ];

      // Filter out invalid ones and test valid ones
      const validAssessments = edgeAssessments.filter(a =>
        isFinite(a.weight) && a.weight > 0
      );

      if (validAssessments.length > 0) {
        const result = await track1Calculator.calculateRating(
          validAssessments,
          createMockCalculationContext()
        );
        expect(result).toBeDefined();
      }
    });

    it('should handle date edge values', async () => {
      const edgeDateAssessments = [
        createMockProjectAssessment({
          assessmentDate: new Date(-8640000000000000) // Minimum date
        }),
        createMockProjectAssessment({
          assessmentDate: new Date(8640000000000000) // Maximum date
        })
      ];

      const result = await track1Calculator.calculateRating(
        edgeDateAssessments,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.metadata.dateRangeIssues).toBeDefined();
    });

    it('should handle string edge cases in metadata', async () => {
      const edgeStringAssessment = createMockProjectAssessment({
        metadata: {
          emptyString: '',
          veryLongString: 'a'.repeat(10000),
          unicodeString: '🔥🚀✨💯',
          specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          whitespaceString: '   \t\n\r   '
        }
      });

      const result = await track1Calculator.calculateRating(
        [edgeStringAssessment],
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory pressure scenarios', async () => {
      // Simulate memory pressure by creating many large objects
      const memoryIntensiveAssessments = Array.from({ length: 1000 }, (_, i) =>
        createMockProjectAssessment({
          id: `memory-test-${i}`,
          metadata: {
            largeData: 'x'.repeat(10000), // 10KB per assessment
            deepObject: {
              ...Array.from({ length: 100 }, (_, j) => ({
                [`level1_${j}`]: {
                  [`level2_${j}`]: {
                    [`level3_${j}`]: `value_${i}_${j}`
                  }
                }
              }))
            }
          }
        })
      );

      const result = await track1Calculator.calculateRating(
        memoryIntensiveAssessments,
        createMockCalculationContext({
          calculationOptions: { performanceOptimization: true }
        })
      );

      expect(result).toBeDefined();
      expect(result.metadata.memoryOptimizations).toBeDefined();
    });

    it('should handle concurrent calculation requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        track1Calculator.calculateRating(
          createMockRatingRequest({
            context: createMockCalculationContext({
              calculationId: `concurrent-${i}`
            })
          }).projectAssessments,
          createMockCalculationContext({
            calculationId: `concurrent-${i}`
          })
        )
      );

      const results = await Promise.all(concurrentRequests);

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.metadata.calculationId).toBe(`concurrent-${index}`);
      });
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from partial calculation failures', async () => {
      const mixedValidityAssessments = [
        createMockProjectAssessment(), // Valid
        // @ts-ignore - Invalid assessment (missing required fields)
        { id: 'invalid' },
        createMockProjectAssessment()  // Valid
      ];

      const result = await track1Calculator.calculateRating(
        mixedValidityAssessments,
        createMockCalculationContext()
      );

      expect(result).toBeDefined();
      expect(result.metadata.invalidCount).toBe(1);
      expect(result.metadata.validCount).toBe(2);
    });

    it('should maintain calculation integrity under stress', async () => {
      const stressTestRequests = Array.from({ length: 100 }, (_, i) =>
        track1Calculator.calculateRating(
          Array.from({ length: 100 }, (_, j) =>
            createMockProjectAssessment({
              id: `stress-${i}-${j}`,
              rating: ['green', 'amber', 'red'][j % 3] as any,
              confidence: ['high', 'medium', 'low'][j % 3] as any
            })
          ),
          createMockCalculationContext({
            calculationId: `stress-test-${i}`
          })
        )
      );

      const results = await Promise.all(stressTestRequests);

      // All calculations should succeed
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.rating).toBeGreaterThanOrEqual(0);
        expect(result.rating).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeDefined();
      });

      // Results should be consistent (same inputs should produce similar outputs)
      const ratings = results.map(r => r.rating);
      const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      expect(averageRating).toBeGreaterThan(0.3);
      expect(averageRating).toBeLessThan(0.7);
    });
  });
});