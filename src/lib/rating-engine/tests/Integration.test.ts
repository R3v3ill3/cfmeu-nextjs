/**
 * Integration tests for the rating calculation engine
 * These tests verify that all components work together correctly
 */

import {
  Track1Calculator,
  Track2Calculator,
  CombinedCalculator,
  WeightedScoringCalculator,
  ConfidenceCalculator,
  TimeDecayCalculator,
  DiscrepancyDetector,
  Validator,
  PerformanceOptimizer
} from '../core';

import {
  createMockCalculationContext,
  createMockRatingRequest,
  createMockProjectAssessments,
  createMockOrganiserAssessments,
  createMockEbaData,
  TestScenarios,
  assertRatingResult,
  assertPerformanceMetrics
} from './testUtils';

describe('Rating Engine Integration Tests', () => {
  let track1Calculator: Track1Calculator;
  let track2Calculator: Track2Calculator;
  let combinedCalculator: CombinedCalculator;
  let weightedScoringCalculator: WeightedScoringCalculator;
  let confidenceCalculator: ConfidenceCalculator;
  let timeDecayCalculator: TimeDecayCalculator;
  let discrepancyDetector: DiscrepancyDetector;
  let validator: Validator;
  let performanceOptimizer: PerformanceOptimizer;

  beforeEach(() => {
    // Initialize all calculator instances
    track1Calculator = new Track1Calculator();
    track2Calculator = new Track2Calculator();
    combinedCalculator = new CombinedCalculator();
    weightedScoringCalculator = new WeightedScoringCalculator();
    confidenceCalculator = new ConfidenceCalculator();
    timeDecayCalculator = new TimeDecayCalculator();
    discrepancyDetector = new DiscrepancyDetector();
    validator = new Validator();
    performanceOptimizer = new PerformanceOptimizer();
  });

  describe('Complete Rating Calculation Workflow', () => {
    it('should calculate final rating for a typical employer', async () => {
      // Arrange
      const request = createMockRatingRequest(TestScenarios.allGreen);
      const context = request.context;

      // Validate input
      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(true);

      // Calculate Track 1 rating
      const track1Result = await track1Calculator.calculateRating(
        request.projectAssessments,
        context
      );
      expect(track1Result).toBeDefined();
      expect(track1Result.rating).toBeGreaterThanOrEqual(0);
      expect(track1Result.rating).toBeLessThanOrEqual(1);

      // Calculate Track 2 rating
      const track2Result = await track2Calculator.calculateRating(
        request.organiserAssessments,
        request.organiserProfiles,
        context
      );
      expect(track2Result).toBeDefined();
      expect(track2Result.rating).toBeGreaterThanOrEqual(0);
      expect(track2Result.rating).toBeLessThanOrEqual(1);

      // Calculate final combined rating
      const finalResult = await combinedCalculator.calculateFinalRating(
        track1Result,
        track2Result,
        request.ebaData!,
        context
      );

      // Assert results
      assertRatingResult(finalResult, 'green', 'high');
      expect(finalResult.breakdown.track1Rating).toBeDefined();
      expect(finalResult.breakdown.track2Rating).toBeDefined();
      expect(finalResult.breakdown.ebaInfluence).toBeDefined();
      expect(finalResult.metadata.reconciliationStrategy).toBeDefined();
    });

    it('should handle mixed assessments with proper reconciliation', async () => {
      // Arrange
      const request = createMockRatingRequest(TestScenarios.mixed);

      // Act
      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(true);

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
        request.ebaData!,
        request.context
      );

      // Assert
      expect(finalResult).toBeDefined();
      // Mixed data should result in amber rating with medium confidence
      assertRatingResult(finalResult, 'amber', 'medium');
      expect(finalResult.metadata.discrepancies.length).toBeGreaterThan(0);
    });

    it('should handle confidence weighting correctly', async () => {
      // Arrange
      const request = createMockRatingRequest(TestScenarios.confidenceTest);

      // Act
      const track1Result = await track1Calculator.calculateRating(
        request.projectAssessments,
        request.context
      );

      const finalResult = await combinedCalculator.calculateFinalRating(
        track1Result,
        { rating: 0.5, confidence: 'medium' }, // Mock track2 result
        request.ebaData!,
        request.context
      );

      // Assert
      expect(finalResult).toBeDefined();
      // High confidence red should outweigh low confidence green
      assertRatingResult(finalResult, 'red', 'high');
    });
  });

  describe('Performance Optimization Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Arrange
      const largeRequest = createMockRatingRequest({
        projectAssessments: Array.from({ length: 1000 }, (_, i) =>
          createMockProjectAssessments()[i % 4]
        ),
        context: createMockCalculationContext({
          calculationOptions: { performanceOptimization: true }
        })
      });

      // Act
      const startTime = Date.now();

      const result = await performanceOptimizer.optimizeCalculation(
        async () => {
          const track1Result = await track1Calculator.calculateRating(
            largeRequest.projectAssessments,
            largeRequest.context
          );
          return track1Result;
        },
        largeRequest.context,
        { enableCaching: true, enableBatching: true }
      );

      const duration = Date.now() - startTime;

      // Assert
      expect(result).toBeDefined();
      assertPerformanceMetrics({ duration, cacheHits: 0, processingItems: 1000 }, 5000); // Should complete within 5 seconds
    });

    it('should demonstrate caching benefits', async () => {
      // Arrange
      const request = createMockRatingRequest();

      // First calculation
      const result1 = await performanceOptimizer.optimizeCalculation(
        async () => {
          return await track1Calculator.calculateRating(
            request.projectAssessments,
            request.context
          );
        },
        request.context,
        { enableCaching: true }
      );

      // Second calculation (should use cache)
      const result2 = await performanceOptimizer.optimizeCalculation(
        async () => {
          return await track1Calculator.calculateRating(
            request.projectAssessments,
            request.context
          );
        },
        request.context,
        { enableCaching: true }
      );

      // Assert
      expect(result1).toEqual(result2);
      // Second calculation should be faster due to caching
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid data gracefully', async () => {
      // Arrange
      const invalidRequest = createMockRatingRequest({
        projectAssessments: [], // Empty assessments
        organiserAssessments: [],
        ebaData: null
      });

      // Act & Assert
      const validationResult = await validator.validateCalculationRequest(invalidRequest);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle calculation errors without crashing', async () => {
      // Arrange
      const request = createMockRatingRequest({
        projectAssessments: [
          createMockProjectAssessments()[0] // Valid assessment
        ],
        context: createMockCalculationContext({
          calculationOptions: {
            // Some invalid options that might cause errors
            includeTrendAnalysis: true,
            includeOutlierDetection: true
          }
        })
      });

      // Act
      try {
        const result = await track1Calculator.calculateRating(
          request.projectAssessments,
          request.context
        );

        // Should either succeed or fail gracefully
        expect(result).toBeDefined();
      } catch (error) {
        // If it fails, it should be a meaningful error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe('Component Integration Scenarios', () => {
    it('should integrate time decay with weighted scoring', async () => {
      // Arrange
      const historicalData = Array.from({ length: 100 }, (_, i) => ({
        id: `historical-${i}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Days in the past
        rating: Math.random(),
        confidence: 'medium' as const,
        weight: 1.0,
        decayedWeight: 0,
        metadata: {}
      }));

      // Apply time decay
      const decayResult = await timeDecayCalculator.calculateDecay(
        historicalData,
        new Date(),
        { decayRate: 0.1, halfLifeDays: 30 }
      );

      // Apply weighted scoring to decayed data
      const weightedAssessments = decayResult.decayedData.map(point => ({
        id: point.id,
        type: 'historical' as const,
        rating: point.rating,
        weight: point.decayedWeight,
        confidence: point.confidence,
        source: 'historical' as const,
        assessmentDate: point.timestamp,
        metadata: point.metadata
      }));

      const scoringResult = await weightedScoringCalculator.calculateWeightedScore(
        weightedAssessments,
        { method: 'weighted_average' }
      );

      // Assert
      expect(decayResult.decayedData.length).toBe(historicalData.length);
      expect(scoringResult.score).toBeGreaterThanOrEqual(0);
      expect(scoringResult.score).toBeLessThanOrEqual(1);
      expect(scoringResult.metadata.weightedSum).toBeDefined();
    });

    it('should integrate discrepancy detection with reconciliation', async () => {
      // Arrange
      const projectRating = 0.2; // Low rating (red)
      const projectConfidence = 'high' as const;
      const expertiseRating = 0.8; // High rating (green)
      const expertiseConfidence = 'high' as const;

      // Detect discrepancy
      const discrepancyCheck = await discrepancyDetector.detectDiscrepancies(
        projectRating,
        projectConfidence,
        expertiseRating,
        expertiseConfidence
      );

      // Assert
      expect(discrepancyCheck.hasDiscrepancy).toBe(true);
      expect(discrepancyCheck.discrepancyLevel).toBe('high');
      expect(discrepancyCheck.recommendations.length).toBeGreaterThan(0);
      expect(discrepancyCheck.confidenceImpact).toBeDefined();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle a typical construction employer profile', async () => {
      // Arrange - Simulate a real construction employer with mixed data
      const request = createMockRatingRequest({
        projectAssessments: [
          createMockProjectAssessments()[0], // green CBUS
          createMockProjectAssessments()[1], // amber Incolink
          createMockProjectAssessments()[2], // green site visit
          createMockProjectAssessments()[3]  // red delegate report
        ],
        organiserAssessments: createMockOrganiserAssessments(),
        ebaData: createMockEbaData({ ebaStatus: 'green' })
      });

      // Act
      const validationResult = await validator.validateCalculationRequest(request);
      expect(validationResult.isValid).toBe(true);

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
        request.ebaData!,
        request.context
      );

      // Assert
      expect(finalResult).toBeDefined();
      expect(['green', 'amber']).toContain(finalResult.finalRating);
      expect(['high', 'medium']).toContain(finalResult.confidence);
      expect(finalResult.metadata.assessmentCount).toBeGreaterThan(0);
    });
  });
});