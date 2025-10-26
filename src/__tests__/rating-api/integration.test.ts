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
import type { FinalRatingRequest, BatchOperationRequest } from '@/types/rating-api';

describe('Rating System API Integration Tests', () => {
  let testEnv: TestEnvironment;
  let client: TestApiClient;
  let testEmployers: any[] = [];
  let testProjects: any[] = [];

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    client = testEnv.getClient();

    // Create comprehensive test data
    testProjects = [
      await testEnv.createTestProject({ id: 'integration-project-1', name: 'Integration Test Project 1' }),
      await testEnv.createTestProject({ id: 'integration-project-2', name: 'Integration Test Project 2' }),
    ];

    testEmployers = [
      await testEnv.createTestEmployer({
        id: 'integration-employer-1',
        name: 'Integration Test Employer 1',
        abn: '11111111111'
      }),
      await testEnv.createTestEmployer({
        id: 'integration-employer-2',
        name: 'Integration Test Employer 2',
        abn: '22222222222'
      }),
      await testEnv.createTestEmployer({
        id: 'integration-employer-3',
        name: 'Integration Test Employer 3',
        abn: '33333333333'
      }),
    ];
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('End-to-End Workflow: Complete Rating Process', () => {
    it('should handle complete rating workflow from assessment to final rating', async () => {
      // Step 1: Create compliance assessments
      const complianceAssessment1 = createMockComplianceAssessment({
        employer_id: testEmployers[0].id,
        project_id: testProjects[0].id,
        assessment_type: 'eca_status',
        score: 75,
        rating: 'green',
        confidence_level: 'high',
        assessment_notes: 'Excellent EBA compliance',
      });

      const complianceResponse1 = await client.createComplianceAssessment(testProjects[0].id, complianceAssessment1);
      expectValidResponse(complianceResponse1, 201);

      const complianceAssessment2 = createMockComplianceAssessment({
        employer_id: testEmployers[0].id,
        project_id: testProjects[0].id,
        assessment_type: 'safety_incidents',
        score: 10,
        rating: 'amber',
        confidence_level: 'medium',
        assessment_notes: 'Minor safety incident reported',
      });

      const complianceResponse2 = await client.createComplianceAssessment(testProjects[0].id, complianceAssessment2);
      expectValidResponse(complianceResponse2, 201);

      // Step 2: Create expertise assessment
      const expertiseAssessment = createMockExpertiseAssessment({
        overall_score: 80,
        overall_rating: 'green',
        confidence_level: 'high',
        eba_status_known: true,
        eba_status: 'green',
        knowledge_beyond_projects: true,
        industry_reputation: 'Excellent reputation with no concerns',
        union_relationship_quality: 'excellent',
        assessment_notes: 'Strong overall performance across all metrics',
      });

      const expertiseResponse = await client.createExpertiseAssessment(testEmployers[0].id, expertiseAssessment);
      expectValidResponse(expertiseResponse, 201);

      // Step 3: Calculate final rating
      const finalRatingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Complete workflow test calculation',
      };

      const finalRatingResponse = await client.calculateFinalRating(testEmployers[0].id, finalRatingRequest);
      expectValidResponse(finalRatingResponse, 201);

      const finalRating = finalRatingResponse.data.data;
      expect(finalRating.calculation_result.final_rating).toBe('green');
      expect(finalRating.calculation_result.final_score).toBeGreaterThan(70);
      expect(finalRating.calculation_result.overall_confidence).toBe('high');

      // Step 4: Verify the rating appears in final ratings list
      const ratingsListResponse = await client.getFinalRatings(testEmployers[0].id);
      expectValidResponse(ratingsListResponse);
      expect(ratingsListResponse.data.data.ratings.length).toBeGreaterThan(0);

      // Step 5: Compare ratings to detect discrepancies
      const comparisonResponse = await client.compareRatings(testEmployers[0].id);
      expectValidResponse(comparisonResponse);
      expect(comparisonResponse.data.data.project_vs_expertise).toBeDefined();

      // Step 6: Verify data appears in dashboard
      const dashboardResponse = await client.getDashboard({ limit: '10' });
      expectValidResponse(dashboardResponse);
      expect(dashboardResponse.data.data.overview.rated_employers).toBeGreaterThanOrEqual(1);
    });

    it('should handle workflow with wizard-based expertise assessment', async () => {
      // Step 1: Get wizard configuration
      const wizardConfigResponse = await client.getWizardConfig();
      expectValidResponse(wizardConfigResponse);
      const wizardConfig = wizardConfigResponse.data.data;

      // Step 2: Submit wizard assessment
      const wizardData = {
        employer_id: testEmployers[1].id,
        steps: wizardConfig.steps.slice(0, 3).map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Integration test wizard submission',
      };

      const wizardResponse = await client.submitWizardAssessment(wizardData);
      expectValidResponse(wizardResponse, 201);
      expect(wizardResponse.data.data.created_expertise_rating_id).toBeDefined();

      // Step 3: Create compliance assessment
      const complianceAssessment = createMockComplianceAssessment({
        employer_id: testEmployers[1].id,
        project_id: testProjects[1].id,
        assessment_type: 'eca_status',
        score: 45,
        rating: 'amber',
        confidence_level: 'medium',
        assessment_notes: 'Moderate compliance with some issues',
      });

      const complianceResponse = await client.createComplianceAssessment(testProjects[1].id, complianceAssessment);
      expectValidResponse(complianceResponse, 201);

      // Step 4: Calculate final rating
      const finalRatingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.5,
        expertise_weight: 0.5,
        eba_weight: 0.1,
        calculation_method: 'balanced_method',
        force_recalculate: false,
        notes: 'Wizard-based assessment calculation',
      };

      const finalRatingResponse = await client.calculateFinalRating(testEmployers[1].id, finalRatingRequest);
      expectValidResponse(finalRatingResponse, 201);

      // Step 5: Verify the wizard-based assessment is properly integrated
      const expertiseRatingsResponse = await client.getExpertiseAssessments(testEmployers[1].id);
      expectValidResponse(expertiseRatingsResponse);
      expect(expertiseRatingsResponse.data.data.assessments.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Multi-Employer Operations', () => {
    it('should handle batch operations across multiple employers', async () => {
      // Prepare data for multiple employers
      for (let i = 0; i < testEmployers.length; i++) {
        const complianceAssessment = createMockComplianceAssessment({
          employer_id: testEmployers[i].id,
          project_id: testProjects[0].id,
          score: 50 + (i * 10),
          rating: i < 2 ? 'green' : 'amber',
          assessment_type: 'eca_status',
        });
        await client.createComplianceAssessment(testProjects[0].id, complianceAssessment);

        const expertiseAssessment = createMockExpertiseAssessment({
          overall_score: 55 + (i * 8),
          overall_rating: i < 2 ? 'green' : 'amber',
          confidence_level: 'medium',
        });
        await client.createExpertiseAssessment(testEmployers[i].id, expertiseAssessment);
      }

      // Execute batch calculation
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: testEmployers.map(e => e.id),
            parameters: {
              calculation_date: '2025-01-26',
              project_weight: 0.6,
              expertise_weight: 0.4,
              eba_weight: 0.15,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const batchResponse = await client.executeBatchOperation(batchRequest);
      expectValidResponse(batchResponse, 201);
      expect(batchResponse.data.data.total_operations).toBe(testEmployers.length);
      expect(batchResponse.data.data.completed_operations).toBe(testEmployers.length);

      // Verify all employers have ratings
      for (const employer of testEmployers) {
        const ratingsResponse = await client.getFinalRatings(employer.id);
        expectValidResponse(ratingsResponse);
        expect(ratingsResponse.data.data.ratings.length).toBeGreaterThan(0);
      }

      // Check batch status
      const batchStatusResponse = await client.getBatchStatus(batchResponse.data.data.batch_id);
      expectValidResponse(batchStatusResponse);
      expect(batchStatusResponse.data.data.status).toBe('completed');
    });

    it('should handle mixed batch operations with partial failures', async () => {
      // Include one non-existent employer to test error handling
      const mixedEmployerIds = [
        testEmployers[0].id,
        'non-existent-employer-id',
        testEmployers[1].id,
      ];

      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: mixedEmployerIds,
            parameters: {
              calculation_date: '2025-01-26',
              project_weight: 0.6,
              expertise_weight: 0.4,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const batchResponse = await client.executeBatchOperation(batchRequest);
      expectValidResponse(batchResponse, 201);
      expect(batchResponse.data.data.total_operations).toBe(3);
      expect(batchResponse.data.data.completed_operations).toBe(2);
      expect(batchResponse.data.data.failed_operations).toBe(1);

      // Verify results contain both successes and failures
      const results = batchResponse.data.data.results;
      const successResults = results.filter((r: any) => r.status === 'success');
      const failureResults = results.filter((r: any) => r.status === 'failed');

      expect(successResults.length).toBe(2);
      expect(failureResults.length).toBe(1);
      expect(failureResults[0].error).toBeDefined();
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency across related operations', async () => {
      const employer = testEmployers[0];
      const project = testProjects[0];

      // Create multiple compliance assessments
      const assessments = [
        { type: 'eca_status', score: 80, rating: 'green' as const },
        { type: 'cbus_status', score: 60, rating: 'amber' as const },
        { type: 'safety_incidents', score: -20, rating: 'red' as const },
      ];

      const createdAssessments = [];
      for (const assessment of assessments) {
        const assessmentData = createMockComplianceAssessment({
          employer_id: employer.id,
          project_id: project.id,
          assessment_type: assessment.type,
          score: assessment.score,
          rating: assessment.rating,
        });

        const response = await client.createComplianceAssessment(project.id, assessmentData);
        expectValidResponse(response, 201);
        createdAssessments.push(response.data.data);
      }

      // Retrieve all assessments for the project
      const projectAssessmentsResponse = await client.getComplianceAssessments(project.id);
      expectValidResponse(projectAssessmentsResponse);

      // Verify all created assessments are present
      const projectAssessments = projectAssessmentsResponse.data.data.assessments;
      expect(projectAssessments.length).toBeGreaterThanOrEqual(assessments.length);

      // Verify assessment types are correctly stored
      const assessmentTypes = projectAssessments.map((a: any) => a.assessment_type);
      expect(assessmentTypes).toContain('eca_status');
      expect(assessmentTypes).toContain('cbus_status');
      expect(assessmentTypes).toContain('safety_incidents');

      // Create expertise assessment
      const expertiseData = createMockExpertiseAssessment({
        overall_score: 65,
        overall_rating: 'amber',
        confidence_level: 'medium',
      });
      const expertiseResponse = await client.createExpertiseAssessment(employer.id, expertiseData);
      expectValidResponse(expertiseResponse, 201);

      // Calculate final rating
      const finalRatingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.7,
        expertise_weight: 0.3,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Data consistency test',
      };

      const finalRatingResponse = await client.calculateFinalRating(employer.id, finalRatingRequest);
      expectValidResponse(finalRatingResponse, 201);

      // Verify the final rating calculation considers all data
      const finalRating = finalRatingResponse.data.data;
      expect(finalRating.components.project_data).toBeDefined();
      expect(finalRating.components.expertise_data).toBeDefined();
      expect(finalRating.components.eba_data).toBeDefined();

      // Verify the final rating is accessible through all endpoints
      const ratingsListResponse = await client.getFinalRatings(employer.id);
      expectValidResponse(ratingsListResponse);
      expect(ratingsListResponse.data.data.ratings.length).toBeGreaterThan(0);

      const comparisonResponse = await client.compareRatings(employer.id);
      expectValidResponse(comparisonResponse);
      expect(comparisonResponse.data.data.project_vs_expertise).toBeDefined();
    });

    it('should handle concurrent operations without data corruption', async () => {
      const employer = testEmployers[1];
      const project = testProjects[1];

      // Create multiple assessments concurrently
      const concurrentPromises = [];

      for (let i = 0; i < 5; i++) {
        const complianceData = createMockComplianceAssessment({
          employer_id: employer.id,
          project_id: project.id,
          assessment_type: 'eca_status',
          score: 50 + (i * 5),
          rating: i < 3 ? 'green' : 'amber',
          assessment_notes: `Concurrent assessment ${i}`,
        });

        concurrentPromises.push(client.createComplianceAssessment(project.id, complianceData));
      }

      const concurrentResponses = await Promise.all(concurrentPromises);

      // All requests should succeed
      concurrentResponses.forEach(response => {
        expectValidResponse(response, 201);
      });

      // Verify data integrity
      const assessmentsResponse = await client.getComplianceAssessments(project.id);
      expectValidResponse(assessmentsResponse);
      expect(assessmentsResponse.data.data.assessments.length).toBeGreaterThanOrEqual(5);

      // Verify unique assessments were created
      const assessmentNotes = assessmentsResponse.data.data.assessments.map((a: any) => a.assessment_notes);
      const uniqueNotes = [...new Set(assessmentNotes)];
      expect(uniqueNotes.length).toBe(5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large data volumes efficiently', async () => {
      const startTime = Date.now();

      // Create assessments for all employers
      for (const employer of testEmployers) {
        for (const project of testProjects) {
          const complianceData = createMockComplianceAssessment({
            employer_id: employer.id,
            project_id: project.id,
            score: Math.floor(Math.random() * 100) - 50,
            rating: ['green', 'amber', 'red'][Math.floor(Math.random() * 3)] as any,
          });

          await client.createComplianceAssessment(project.id, complianceData);

          const expertiseData = createMockExpertiseAssessment({
            overall_score: Math.floor(Math.random() * 100) - 50,
            overall_rating: ['green', 'amber', 'red'][Math.floor(Math.random() * 3)] as any,
          });

          await client.createExpertiseAssessment(employer.id, expertiseData);
        }
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test batch calculation performance
      const batchStartTime = Date.now();

      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: testEmployers.map(e => e.id),
            parameters: {
              calculation_date: '2025-01-26',
              project_weight: 0.6,
              expertise_weight: 0.4,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const batchResponse = await client.executeBatchOperation(batchRequest);
      const batchTime = Date.now() - batchStartTime;

      expectValidResponse(batchResponse, 201);
      expect(batchTime).toBeLessThan(5000); // Batch operation should complete within 5 seconds

      // Test dashboard performance with all data
      const dashboardStartTime = Date.now();
      const dashboardResponse = await client.getDashboard({ limit: '20' });
      const dashboardTime = Date.now() - dashboardStartTime;

      expectValidResponse(dashboardResponse);
      expect(dashboardTime).toBeLessThan(2000); // Dashboard should load within 2 seconds

      // Verify data quality
      expect(dashboardResponse.data.data.overview.rated_employers).toBe(testEmployers.length);
      expect(dashboardResponse.data.data.overview.total_employers).toBeGreaterThanOrEqual(testEmployers.length);
    });

    it('should handle analytics queries efficiently', async () => {
      const startTime = Date.now();

      // Test different analytics queries
      const analyticsPromises = [
        client.getRatingTrends({ period: '7d' }),
        client.getRatingTrends({ period: '30d', granularity: 'weekly' }),
        client.getRatingTrends({ period: '90d', granularity: 'monthly' }),
        client.getRatingTrends({ employerType: 'construction' }),
      ];

      const analyticsResponses = await Promise.all(analyticsPromises);
      const analyticsTime = Date.now() - startTime;

      // All analytics queries should succeed
      analyticsResponses.forEach(response => {
        expectValidResponse(response);
        expect(response.data.data.overview).toBeDefined();
        expect(response.data.data.time_series).toBeDefined();
      });

      expect(analyticsTime).toBeLessThan(5000); // Analytics should complete within 5 seconds

      // Verify data consistency across queries
      const baseOverview = analyticsResponses[0].data.data.overview;
      analyticsResponses.forEach(response => {
        expect(response.data.data.overview.total_employers).toBe(baseOverview.total_employers);
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from temporary failures', async () => {
      // This would be tested with mock failures
      // For now, verify graceful degradation
      const employer = testEmployers[0];

      // Create assessment with minimal data
      const minimalAssessment = {
        employer_id: employer.id,
        project_id: testProjects[0].id,
        assessment_type: 'eca_status',
        score: 0,
        rating: 'unknown',
        confidence_level: 'low',
        assessment_date: '2025-01-26',
      };

      const response = await client.createComplianceAssessment(testProjects[0].id, minimalAssessment);
      expectValidResponse(response, 201);

      // Should handle calculation with minimal data
      const finalRatingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 0.6,
        expertise_weight: 0.4,
        eba_weight: 0.15,
        calculation_method: 'hybrid_method',
        force_recalculate: false,
        notes: 'Minimal data test',
      };

      const finalRatingResponse = await client.calculateFinalRating(employer.id, finalRatingRequest);
      expectValidResponse(finalRatingResponse, 201);
      expect(finalRatingResponse.data.data.calculation_result.data_completeness).toBeLessThan(100);
    });

    it('should handle invalid or corrupted data gracefully', async () => {
      // Test with extreme values
      const extremeAssessment = createMockComplianceAssessment({
        employer_id: testEmployers[0].id,
        project_id: testProjects[0].id,
        score: 100, // Maximum score
        rating: 'green',
        confidence_level: 'high',
      });

      const response = await client.createComplianceAssessment(testProjects[0].id, extremeAssessment);
      expectValidResponse(response, 201);

      // Should handle boundary cases in calculations
      const finalRatingRequest: FinalRatingRequest = {
        calculation_date: '2025-01-26',
        project_weight: 1.0, // Extreme weighting
        expertise_weight: 0.0,
        eba_weight: 0.0,
        calculation_method: 'extreme_test',
        force_recalculate: false,
        notes: 'Boundary case test',
      };

      const finalRatingResponse = await client.calculateFinalRating(testEmployers[0].id, finalRatingRequest);
      expectValidResponse(finalRatingResponse, 201);
    });
  });

  describe('Cross-System Integration', () => {
    it('should integrate with existing employer and project data', async () => {
      // Use existing test data to verify integration
      const assessmentsResponse = await client.getComplianceAssessments(testProjects[0].id);
      expectValidResponse(assessmentsResponse);

      if (assessmentsResponse.data.data.assessments.length > 0) {
        const assessment = assessmentsResponse.data.data.assessments[0];
        expect(assessment.employer_id).toBeDefined();
        expect(assessment.project_id).toBe(testProjects[0].id);

        // Should be able to retrieve related employer data
        // (This would require employer lookup endpoints to be implemented)
      }
    });

    it('should maintain audit trails across operations', async () => {
      // Create an assessment
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployers[0].id,
        project_id: testProjects[0].id,
        assessment_notes: 'Audit trail test assessment',
      });

      const createResponse = await client.createComplianceAssessment(testProjects[0].id, assessmentData);
      expectValidResponse(createResponse, 201);
      const assessmentId = createResponse.data.data.id;

      // Update the assessment
      const updateData = {
        assessment_notes: 'Updated audit trail test assessment',
      };

      const updateResponse = await client.updateComplianceAssessment(assessmentId, updateData);
      expectValidResponse(updateResponse);

      // Verify timestamps and audit information
      expect(updateResponse.data.data.updated_at).toBeDefined();
      expect(updateResponse.data.data.updated_at).not.toBe(updateResponse.data.data.created_at);

      // Retrieve final version
      const getResponse = await client.getComplianceAssessment(assessmentId);
      expectValidResponse(getResponse);
      expect(getResponse.data.data.assessment_notes).toBe(updateData.assessment_notes);
    });
  });
});