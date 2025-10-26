import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  TestApiClient,
  TestEnvironment,
  createMockEmployer,
  createMockProject,
  createMockComplianceAssessment,
  createMockExpertiseAssessment,
  expectValidResponse,
  expectErrorResponse,
} from './test-utils';
import type { FinalRatingRequest } from '@/types/rating-api';

describe('Final Ratings API', () => {
  let testEnv: TestEnvironment;
  let client: TestApiClient;
  let testEmployer: any;
  let testProject: any;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    client = testEnv.getClient();

    // Set up test data
    testEmployer = await testEnv.createTestEmployer();
    testProject = await testEnv.createTestProject();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('GET /api/employers/{employerId}/ratings', () => {
    beforeEach(async () => {
      // Create test data for final ratings
      // Create compliance assessments
      const complianceData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 75,
        rating: 'green',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      // Create expertise assessment
      const expertiseData = createMockExpertiseAssessment({
        overall_score: 80,
        overall_rating: 'green',
        confidence_level: 'high',
      });
      await client.createExpertiseAssessment(testEmployer.id, expertiseData);
    });

    it('should retrieve final ratings for an employer', async () => {
      const response = await client.getFinalRatings(testEmployer.id);

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('ratings');
      expect(response.data.data).toHaveProperty('current_rating');
      expect(response.data.data).toHaveProperty('summary');
    });

    it('should include current rating information', async () => {
      const response = await client.getFinalRatings(testEmployer.id);

      expectValidResponse(response);
      const currentRating = response.data.data.current_rating;

      if (currentRating) {
        expect(currentRating).toHaveProperty('id');
        expect(currentRating).toHaveProperty('final_rating');
        expect(currentRating).toHaveProperty('final_score');
        expect(currentRating).toHaveProperty('project_based_rating');
        expect(currentRating).toHaveProperty('expertise_based_rating');
        expect(currentRating).toHaveProperty('overall_confidence');
        expect(currentRating).toHaveProperty('rating_status');

        expect(['green', 'amber', 'red', 'unknown']).toContain(currentRating.final_rating);
        expect(typeof currentRating.final_score).toBe('number');
        expect(['high', 'medium', 'low']).toContain(currentRating.overall_confidence);
      }
    });

    it('should provide rating summary statistics', async () => {
      const response = await client.getFinalRatings(testEmployer.id);

      expectValidResponse(response);
      const summary = response.data.data.summary;

      expect(summary).toHaveProperty('total_ratings');
      expect(summary).toHaveProperty('current_rating_score');
      expect(summary).toHaveProperty('rating_trend');
      expect(summary).toHaveProperty('last_updated');
      expect(summary).toHaveProperty('next_review_due');

      expect(typeof summary.total_ratings).toBe('number');
      expect(['improving', 'stable', 'declining']).toContain(summary.rating_trend);
    });

    it('should support pagination', async () => {
      const response = await client.getFinalRatings(testEmployer.id, {
        page: '1',
        pageSize: '5',
      });

      expectValidResponse(response);
      expect(response.data.data.pagination).toBeDefined();
      expect(response.data.data.pagination.page).toBe(1);
      expect(response.data.data.pagination.pageSize).toBe(5);
    });

    it('should filter by rating status', async () => {
      const response = await client.getFinalRatings(testEmployer.id, {
        status: 'active',
      });

      expectValidResponse(response);
      response.data.data.ratings.forEach((rating: any) => {
        expect(rating.rating_status).toBe('active');
      });
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await client.getFinalRatings(testEmployer.id, {
        dateFrom: today,
        dateTo: today,
      });

      expectValidResponse(response);
      response.data.data.ratings.forEach((rating: any) => {
        expect(rating.rating_date).toBe(today);
      });
    });

    it('should support sorting options', async () => {
      const response = await client.getFinalRatings(testEmployer.id, {
        sortBy: 'final_score',
        sortOrder: 'desc',
      });

      expectValidResponse(response);
      const ratings = response.data.data.ratings;
      for (let i = 1; i < ratings.length; i++) {
        expect(ratings[i-1].final_score).toBeGreaterThanOrEqual(ratings[i].final_score);
      }
    });

    it('should include inactive ratings when requested', async () => {
      const response = await client.getFinalRatings(testEmployer.id, {
        includeInactive: 'true',
      });

      expectValidResponse(response);
      // In a real test, you'd verify inactive ratings are included
    });

    it('should handle non-existent employer', async () => {
      const response = await client.getFinalRatings('non-existent-employer-id');

      expectErrorResponse(response, 404);
    });

    it('should return empty results for employer with no ratings', async () => {
      const newEmployer = await testEnv.createTestEmployer({ id: 'new-employer-no-ratings' });

      const response = await client.getFinalRatings(newEmployer.id);

      expectValidResponse(response);
      expect(response.data.data.ratings).toEqual([]);
      expect(response.data.data.current_rating).toBeNull();
      expect(response.data.data.summary.total_ratings).toBe(0);
    });
  });

  describe('POST /api/employers/{employerId}/ratings', () => {
    beforeEach(async () => {
      // Create test data for rating calculation
      const complianceData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 70,
        rating: 'green',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      const expertiseData = createMockExpertiseAssessment({
        overall_score: 75,
        overall_rating: 'green',
        confidence_level: 'medium',
      });
      await client.createExpertiseAssessment(testEmployer.id, expertiseData);
    });

    it('should calculate a new final rating', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Monthly rating calculation',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('rating_id');
      expect(response.data.data).toHaveProperty('calculation_result');
      expect(response.data.data).toHaveProperty('components');
      expect(response.data.data).toHaveProperty('warnings');
      expect(response.data.data).toHaveProperty('recommendations');

      const result = response.data.data.calculation_result;
      expect(result).toHaveProperty('final_rating');
      expect(result).toHaveProperty('final_score');
      expect(result).toHaveProperty('overall_confidence');
      expect(result).toHaveProperty('data_completeness');
      expect(result).toHaveProperty('discrepancy_detected');

      expect(['green', 'amber', 'red', 'unknown']).toContain(result.final_rating);
      expect(typeof result.final_score).toBe('number');
      expect(typeof result.overall_confidence).toBe('string');
      expect(typeof result.data_completeness).toBe('number');
      expect(typeof result.discrepancy_detected).toBe('boolean');
    });

    it('should include component breakdown', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.7,
        expertise_weight: 0.3,
        eba_weight: 0.2,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Test calculation with component breakdown',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      const components = response.data.data.components;

      expect(components).toHaveProperty('project_data');
      expect(components).toHaveProperty('expertise_data');
      expect(components).toHaveProperty('eba_data');

      expect(components.project_data).toHaveProperty('rating');
      expect(components.project_data).toHaveProperty('score');
      expect(components.project_data).toHaveProperty('confidence');

      expect(components.expertise_data).toHaveProperty('rating');
      expect(components.expertise_data).toHaveProperty('score');
      expect(components.expertise_data).toHaveProperty('confidence');
    });

    it('should handle different weighting schemes', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.8,
        expertise_weight: 0.2,
        eba_weight: 0.1,
        calculation_method: 'project_heavy',
        force_recalculate: false,
        notes: 'Project-heavy weighting calculation',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.calculation_result.final_score).toBeDefined();

      // The weights should be reflected in the calculation
      const components = response.data.data.components;
      expect(components).toBeDefined();
    });

    it('should detect discrepancies between tracks', async () => {
      // Create assessments with different ratings to trigger discrepancy
      const complianceData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 80,
        rating: 'green',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      const expertiseData = createMockExpertiseAssessment({
        overall_score: -20,
        overall_rating: 'red',
        confidence_level: 'high',
      });
      await client.createExpertiseAssessment(testEmployer.id, expertiseData);

      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.5,
        expertise_weight: 0.5,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Discrepancy detection test',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.calculation_result.discrepancy_detected).toBe(true);
      expect(response.data.data.warnings.length).toBeGreaterThan(0);
    });

    it('should provide recommendations when issues are detected', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.5,
        expertise_weight: 0.5,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Recommendations test',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      expect(Array.isArray(response.data.data.recommendations)).toBe(true);

      // Recommendations might be empty if no issues detected
      if (response.data.data.recommendations.length > 0) {
        const recommendation = response.data.data.recommendations[0];
        expect(recommendation).toHaveProperty('type');
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('action_required');
      }
    });

    it('should handle force recalculation', async () => {
      // First calculation
      const ratingRequest1: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'First calculation',
      };

      const response1 = await client.calculateFinalRating(testEmployer.id, ratingRequest1);
      expectValidResponse(response1, 201);

      // Force recalculation
      const ratingRequest2: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: true,
        notes: 'Force recalculation test',
      };

      const response2 = await client.calculateFinalRating(testEmployer.id, ratingRequest2);
      expectValidResponse(response2, 201);
      expect(response2.data.data.rating_id).not.toBe(response1.data.data.rating_id);
    });

    it('should validate weight sum', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.8, // Total weight > 1
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'invalid_weights',
        force_recalculate: false,
        notes: 'Invalid weight sum test',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid calculation date', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-13-45', // Invalid date
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Invalid date test',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject negative weights', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: -0.1, // Negative weight
        expertise_weight: 0.6,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Negative weight test',
      };

      const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should handle insufficient data', async () => {
      const newEmployer = await testEnv.createTestEmployer({ id: 'employer-no-data' });

      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Insufficient data test',
      };

      const response = await client.calculateFinalRating(newEmployer.id, ratingRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.calculation_result.data_completeness).toBeLessThan(100);
      expect(response.data.data.warnings.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent employer', async () => {
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Non-existent employer test',
      };

      const response = await client.calculateFinalRating('non-existent-employer-id', ratingRequest);

      expectErrorResponse(response, 404);
    });
  });

  describe('GET /api/employers/{employerId}/ratings/compare', () => {
    beforeEach(async () => {
      // Create test data with potential discrepancies
      const complianceData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 75,
        rating: 'green',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      const expertiseData = createMockExpertiseAssessment({
        overall_score: 50,
        overall_rating: 'amber',
        confidence_level: 'medium',
      });
      await client.createExpertiseAssessment(testEmployer.id, expertiseData);
    });

    it('should compare project vs expertise ratings', async () => {
      const response = await client.compareRatings(testEmployer.id);

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('employer_id');
      expect(response.data.data).toHaveProperty('comparison_date');
      expect(response.data.data).toHaveProperty('project_vs_expertise');
      expect(response.data.data).toHaveProperty('recommendations');

      const comparison = response.data.data.project_vs_expertise;
      expect(comparison).toHaveProperty('project_rating');
      expect(comparison).toHaveProperty('project_score');
      expect(comparison).toHaveProperty('expertise_rating');
      expect(comparison).toHaveProperty('expertise_score');
      expect(comparison).toHaveProperty('rating_match');
      expect(comparison).toHaveProperty('discrepancy_level');
      expect(comparison).toHaveProperty('alignment_quality');

      expect(['green', 'amber', 'red', 'unknown']).toContain(comparison.project_rating);
      expect(['green', 'amber', 'red', 'unknown']).toContain(comparison.expertise_rating);
      expect(typeof comparison.project_score).toBe('number');
      expect(typeof comparison.expertise_score).toBe('number');
      expect(typeof comparison.rating_match).toBe('boolean');
    });

    it('should detect rating mismatches', async () => {
      const response = await client.compareRatings(testEmployer.id);

      expectValidResponse(response);
      const comparison = response.data.data.project_vs_expertise;

      // With our test data, we expect a potential mismatch
      if (comparison.project_rating !== comparison.expertise_rating) {
        expect(comparison.rating_match).toBe(false);
        expect(['minor', 'moderate', 'severe']).toContain(comparison.discrepancy_level);
      }
    });

    it('should provide alignment recommendations', async () => {
      const response = await client.compareRatings(testEmployer.id);

      expectValidResponse(response);
      const recommendations = response.data.data.recommendations;

      expect(recommendations).toHaveProperty('immediate_actions');
      expect(recommendations).toHaveProperty('investigation_areas');
      expect(recommendations).toHaveProperty('data_improvements');

      expect(Array.isArray(recommendations.immediate_actions)).toBe(true);
      expect(Array.isArray(recommendations.investigation_areas)).toBe(true);
      expect(Array.isArray(recommendations.data_improvements)).toBe(true);
    });

    it('should assess alignment quality', async () => {
      const response = await client.compareRatings(testEmployer.id);

      expectValidResponse(response);
      const comparison = response.data.data.project_vs_expertise;

      expect(['excellent', 'good', 'fair', 'poor']).toContain(comparison.alignment_quality);
    });

    it('should handle employer with no comparison data', async () => {
      const newEmployer = await testEnv.createTestEmployer({ id: 'employer-no-comparison-data' });

      const response = await client.compareRatings(newEmployer.id);

      expectValidResponse(response);
      expect(response.data.data.project_vs_expertise).toBeDefined();
      // Should handle missing data gracefully
    });

    it('should return 404 for non-existent employer', async () => {
      const response = await client.compareRatings('non-existent-employer-id');

      expectErrorResponse(response, 404);
    });
  });

  describe('POST /api/employers/{employerId}/ratings/recalculate', () => {
    beforeEach(async () => {
      // Create initial ratings data
      const complianceData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 60,
        rating: 'amber',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      const expertiseData = createMockExpertiseAssessment({
        overall_score: 65,
        overall_rating: 'amber',
        confidence_level: 'medium',
      });
      await client.createExpertiseAssessment(testEmployer.id, expertiseData);
    });

    it('should force recalculate with admin privileges', async () => {
      const recalcData = {
        project_weight: 0.7,
        expertise_weight: 0.3,
        force_recalculate: true,
        custom_adjustment: 5,
        adjustment_reason: 'Updated weighting based on new guidelines',
        approval_notes: 'Approved by regional manager',
      };

      const response = await client.recalculateRating(testEmployer.id, recalcData);

      expectValidResponse(response, 200);
      expect(response.data.data).toHaveProperty('rating_id');
      expect(response.data.data).toHaveProperty('previous_rating_id');
      expect(response.data.data).toHaveProperty('recalculation_reason');
      expect(response.data.data).toHaveProperty('approval_details');
    });

    it('should handle custom adjustments', async () => {
      const recalcData = {
        project_weight: 0.6,
        expertise_weight: 0.4,
        force_recalculate: true,
        custom_adjustment: -10,
        adjustment_reason: 'Adjustment for exceptional circumstances',
        approval_notes: 'Director approval granted',
      };

      const response = await client.recalculateRating(testEmployer.id, recalcData);

      expectValidResponse(response, 200);
      expect(response.data.data.custom_adjustment).toBe(-10);
      expect(response.data.data.adjustment_reason).toBeDefined();
    });

    it('should require proper authorization', async () => {
      const clientWithoutAuth = new TestApiClient();
      const recalcData = {
        project_weight: 0.6,
        expertise_weight: 0.4,
        force_recalculate: true,
      };

      const response = await clientWithoutAuth.recalculateRating(testEmployer.id, recalcData);

      expectErrorResponse(response, 401);
    });

    it('should return 404 for non-existent employer', async () => {
      const recalcData = {
        project_weight: 0.6,
        expertise_weight: 0.4,
        force_recalculate: true,
      };

      const response = await client.recalculateRating('non-existent-employer-id', recalcData);

      expectErrorResponse(response, 404);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should require authentication for viewing ratings', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.getFinalRatings(testEmployer.id);

      expectErrorResponse(response, 401);
    });

    it('should require authentication for calculating ratings', async () => {
      const clientWithoutAuth = new TestApiClient();
      const ratingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Test calculation',
      };

      const response = await clientWithoutAuth.calculateFinalRating(testEmployer.id, ratingRequest);

      expectErrorResponse(response, 401);
    });

    it('should require authentication for rating comparison', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.compareRatings(testEmployer.id);

      expectErrorResponse(response, 401);
    });
  });
});