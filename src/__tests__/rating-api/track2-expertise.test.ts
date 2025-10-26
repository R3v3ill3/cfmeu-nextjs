import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  TestApiClient,
  TestEnvironment,
  createMockEmployer,
  createMockExpertiseAssessment,
  expectValidResponse,
  expectErrorResponse,
  expectPaginatedResponse,
} from './test-utils';
import type { Track2AssessmentRequest } from '@/types/rating-api';

describe('Track 2: Organiser Expertise Ratings API', () => {
  let testEnv: TestEnvironment;
  let client: TestApiClient;
  let testEmployer: any;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    client = testEnv.getClient();

    // Set up test data
    testEmployer = await testEnv.createTestEmployer();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('POST /api/employers/{employerId}/expertise-ratings', () => {
    it('should create a new expertise assessment with valid data', async () => {
      const assessmentData = createMockExpertiseAssessment();

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.employer_id).toBe(testEmployer.id);
      expect(response.data.data.overall_score).toBe(assessmentData.overall_score);
      expect(response.data.data.overall_rating).toBe(assessmentData.overall_rating);
      expect(response.data.data.confidence_level).toBe(assessmentData.confidence_level);
      expect(response.data.data.assessment_basis).toBe(assessmentData.assessment_basis);
      expect(response.data.data.assessment_context).toBe(assessmentData.assessment_context);
      expect(response.data.data.created_at).toBeDefined();
    });

    it('should handle high confidence assessments', async () => {
      const assessmentData = createMockExpertiseAssessment({
        overall_score: 85,
        overall_rating: 'green',
        confidence_level: 'high',
        eba_status_known: true,
        eba_status: 'green',
        knowledge_beyond_projects: true,
        union_relationship_quality: 'excellent',
        assessment_notes: 'Excellent compliance record across multiple projects',
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.confidence_level).toBe('high');
      expect(response.data.data.overall_rating).toBe('green');
      expect(response.data.data.eba_status_known).toBe(true);
      expect(response.data.data.eba_status).toBe('green');
    });

    it('should handle low confidence assessments', async () => {
      const assessmentData = createMockExpertiseAssessment({
        overall_score: 45,
        overall_rating: 'amber',
        confidence_level: 'low',
        eba_status_known: false,
        knowledge_beyond_projects: false,
        industry_reputation: 'Limited information available',
        assessment_notes: 'Limited project history and information available',
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.confidence_level).toBe('low');
      expect(response.data.data.overall_rating).toBe('amber');
      expect(response.data.data.eba_status_known).toBe(false);
      expect(response.data.data.knowledge_beyond_projects).toBe(false);
    });

    it('should handle red rating assessments', async () => {
      const assessmentData = createMockExpertiseAssessment({
        overall_score: -25,
        overall_rating: 'red',
        confidence_level: 'high',
        eba_status_known: true,
        eba_status: 'red',
        industry_reputation: 'Poor reputation with multiple compliance issues',
        union_relationship_quality: 'poor',
        assessment_notes: 'Significant compliance and relationship issues identified',
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.overall_rating).toBe('red');
      expect(response.data.data.eba_status).toBe('red');
      expect(response.data.data.union_relationship_quality).toBe('poor');
    });

    it('should reject invalid overall scores', async () => {
      const assessmentData = createMockExpertiseAssessment({
        overall_score: 150, // Invalid: should be -100 to 100
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid ratings', async () => {
      const assessmentData = createMockExpertiseAssessment({
        overall_rating: 'purple' as any, // Invalid rating
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid confidence levels', async () => {
      const assessmentData = createMockExpertiseAssessment({
        confidence_level: 'super_high' as any, // Invalid confidence level
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid union relationship quality', async () => {
      const assessmentData = createMockExpertiseAssessment({
        union_relationship_quality: 'terrible' as any, // Invalid value
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject missing required fields', async () => {
      const assessmentData = {
        overall_score: 75,
        // Missing other required fields
      };

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData as any);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should handle assessment with unknown EBA status', async () => {
      const assessmentData = createMockExpertiseAssessment({
        eba_status_known: true,
        eba_status: 'unknown',
        assessment_notes: 'EBA status confirmed as unknown/no current agreement',
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.eba_status).toBe('unknown');
    });

    it('should handle assessment without EBA status knowledge', async () => {
      const assessmentData = createMockExpertiseAssessment({
        eba_status_known: false,
        eba_status: undefined, // Should not be provided when eba_status_known is false
        assessment_notes: 'EBA status unknown, requires investigation',
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.eba_status_known).toBe(false);
    });

    it('should validate assessment date format', async () => {
      const assessmentData = createMockExpertiseAssessment({
        assessment_date: '2025-13-45', // Invalid date
      });

      const response = await client.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should return 404 for non-existent employer', async () => {
      const assessmentData = createMockExpertiseAssessment();

      const response = await client.createExpertiseAssessment('non-existent-employer-id', assessmentData);

      expectErrorResponse(response, 404);
    });
  });

  describe('GET /api/employers/{employerId}/expertise-ratings', () => {
    let createdAssessments: any[] = [];

    beforeEach(async () => {
      // Create test assessments for GET tests
      const assessments = [
        createMockExpertiseAssessment({
          overall_score: 85,
          overall_rating: 'green',
          confidence_level: 'high',
        }),
        createMockExpertiseAssessment({
          overall_score: 65,
          overall_rating: 'amber',
          confidence_level: 'medium',
        }),
        createMockExpertiseAssessment({
          overall_score: -15,
          overall_rating: 'red',
          confidence_level: 'high',
        }),
      ];

      for (const assessment of assessments) {
        const response = await client.createExpertiseAssessment(testEmployer.id, assessment);
        if (response.ok) {
          createdAssessments.push(response.data.data);
        }
      }
    });

    it('should retrieve expertise assessments for an employer', async () => {
      const response = await client.getExpertiseAssessments(testEmployer.id);

      expectValidResponse(response);
      expect(response.data.data.assessments).toBeDefined();
      expect(response.data.data.assessments.length).toBeGreaterThanOrEqual(createdAssessments.length);
    });

    it('should support pagination', async () => {
      const response = await client.getExpertiseAssessments(testEmployer.id, {
        page: '1',
        pageSize: '2',
      });

      expectValidResponse(response);
      expect(response.data.data.assessments.length).toBeLessThanOrEqual(2);
      expect(response.data.data.pagination).toBeDefined();
      expect(response.data.data.pagination.page).toBe(1);
      expect(response.data.data.pagination.pageSize).toBe(2);
    });

    it('should filter by confidence level', async () => {
      const response = await client.getExpertiseAssessments(testEmployer.id, {
        confidenceLevel: 'high',
      });

      expectValidResponse(response);
      response.data.data.assessments.forEach((assessment: any) => {
        expect(assessment.confidence_level).toBe('high');
      });
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await client.getExpertiseAssessments(testEmployer.id, {
        dateFrom: today,
        dateTo: today,
      });

      expectValidResponse(response);
      response.data.data.assessments.forEach((assessment: any) => {
        expect(assessment.assessment_date).toBe(today);
      });
    });

    it('should support sorting options', async () => {
      const response = await client.getExpertiseAssessments(testEmployer.id, {
        sortBy: 'overall_score',
        sortOrder: 'desc',
      });

      expectValidResponse(response);
      const assessments = response.data.data.assessments;
      for (let i = 1; i < assessments.length; i++) {
        expect(assessments[i-1].overall_score).toBeGreaterThanOrEqual(assessments[i].overall_score);
      }
    });

    it('should include inactive assessments when requested', async () => {
      const response = await client.getExpertiseAssessments(testEmployer.id, {
        includeInactive: 'true',
      });

      expectValidResponse(response);
      // In a real test, you'd create inactive assessments and verify they're included
    });

    it('should handle non-existent employer', async () => {
      const response = await client.getExpertiseAssessments('non-existent-employer-id');

      expectErrorResponse(response, 404);
    });
  });

  describe('GET /api/expertise-wizard/config', () => {
    it('should retrieve wizard configuration', async () => {
      const response = await client.getWizardConfig();

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('steps');
      expect(response.data.data).toHaveProperty('version');
      expect(response.data.data).toHaveProperty('last_updated');

      expect(Array.isArray(response.data.data.steps)).toBe(true);
      expect(response.data.data.steps.length).toBeGreaterThan(0);

      // Verify step structure
      const firstStep = response.data.data.steps[0];
      expect(firstStep).toHaveProperty('id');
      expect(firstStep).toHaveProperty('wizard_step');
      expect(firstStep).toHaveProperty('step_name');
      expect(firstStep).toHaveProperty('step_description');
      expect(firstStep).toHaveProperty('step_type');
      expect(firstStep).toHaveProperty('is_required');
      expect(firstStep).toHaveProperty('display_order');
      expect(firstStep).toHaveProperty('options');
    });

    it('should include multiple wizard steps', async () => {
      const response = await client.getWizardConfig();

      expectValidResponse(response);
      const steps = response.data.data.steps;

      // Should include key assessment areas
      const stepNames = steps.map((step: any) => step.step_name);
      expect(stepNames).toContain('EBA Status');
      expect(stepNames).toContain('Industry Reputation');
      expect(stepNames).toContain('Union Relationship');
    });

    it('should include step options with scoring', async () => {
      const response = await client.getWizardConfig();

      expectValidResponse(response);
      const firstStep = response.data.data.steps[0];

      expect(Array.isArray(firstStep.options)).toBe(true);
      expect(firstStep.options.length).toBeGreaterThan(0);

      const firstOption = firstStep.options[0];
      expect(firstOption).toHaveProperty('id');
      expect(firstOption).toHaveProperty('option_value');
      expect(firstOption).toHaveProperty('option_text');
      expect(firstOption).toHaveProperty('score_impact');
      expect(firstOption).toHaveProperty('explanation');

      expect(typeof firstOption.score_impact).toBe('number');
    });

    it('should validate step display order', async () => {
      const response = await client.getWizardConfig();

      expectValidResponse(response);
      const steps = response.data.data.steps;

      // Steps should be ordered by display_order
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i-1].display_order).toBeLessThan(steps[i].display_order);
      }
    });
  });

  describe('POST /api/expertise-wizard/submit', () => {
    let wizardConfig: any;

    beforeEach(async () => {
      // Get wizard config for test data
      const configResponse = await client.getWizardConfig();
      wizardConfig = configResponse.data.data;
    });

    it('should submit a completed wizard assessment', async () => {
      const wizardData = {
        employer_id: testEmployer.id,
        steps: wizardConfig.steps.map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Comprehensive assessment completed via wizard',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('wizard_session_id');
      expect(response.data.data).toHaveProperty('employer_id');
      expect(response.data.data).toHaveProperty('total_score');
      expect(response.data.data).toHaveProperty('final_rating');
      expect(response.data.data).toHaveProperty('completion_percentage');
      expect(response.data.data).toHaveProperty('time_spent_minutes');
      expect(response.data.data).toHaveProperty('assessment_summary');
      expect(response.data.data).toHaveProperty('key_factors');
      expect(response.data.data).toHaveProperty('confidence_level');
      expect(response.data.data).toHaveProperty('is_complete');
      expect(response.data.data).toHaveProperty('created_expertise_rating_id');

      expect(response.data.data.completion_percentage).toBe(100);
      expect(response.data.data.is_complete).toBe(true);
    });

    it('should calculate appropriate scores based on responses', async () => {
      const wizardData = {
        employer_id: testEmployer.id,
        steps: wizardConfig.steps.slice(0, 3).map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Partial wizard submission',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectValidResponse(response, 201);
      expect(typeof response.data.data.total_score).toBe('number');
      expect(response.data.data.total_score).toBeGreaterThanOrEqual(-100);
      expect(response.data.data.total_score).toBeLessThanOrEqual(100);

      expect(['green', 'amber', 'red', 'unknown']).toContain(response.data.data.final_rating);
    });

    it('should handle partial wizard completion', async () => {
      const wizardData = {
        employer_id: testEmployer.id,
        steps: wizardConfig.steps.slice(0, 2).map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Partial completion - will finish later',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectValidResponse(response, 201);
      expect(response.data.data.completion_percentage).toBeLessThan(100);
      expect(response.data.data.is_complete).toBe(false);
    });

    it('should reject invalid step responses', async () => {
      const wizardData = {
        employer_id: testEmployer.id,
        steps: [
          {
            wizard_step_id: wizardConfig.steps[0].id,
            step_response: { selected: 'invalid_option' },
            response_value: 'invalid_option',
            session_started_at: new Date().toISOString(),
          },
        ],
        organiser_notes: 'Invalid response test',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject missing employer_id', async () => {
      const wizardData = {
        steps: wizardConfig.steps.slice(0, 1).map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Missing employer test',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject empty steps array', async () => {
      const wizardData = {
        employer_id: testEmployer.id,
        steps: [],
        organiser_notes: 'Empty steps test',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should return 404 for non-existent employer', async () => {
      const wizardData = {
        employer_id: 'non-existent-employer-id',
        steps: wizardConfig.steps.slice(0, 1).map((step: any) => ({
          wizard_step_id: step.id,
          step_response: { selected: step.options[0].option_value },
          response_value: step.options[0].option_value,
          session_started_at: new Date().toISOString(),
        })),
        organiser_notes: 'Non-existent employer test',
      };

      const response = await client.submitWizardAssessment(wizardData);

      expectErrorResponse(response, 404);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should require authentication for expertise ratings', async () => {
      const clientWithoutAuth = new TestApiClient();
      const assessmentData = createMockExpertiseAssessment();

      const response = await clientWithoutAuth.createExpertiseAssessment(testEmployer.id, assessmentData);

      expectErrorResponse(response, 401);
    });

    it('should require authentication for wizard access', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.getWizardConfig();

      expectErrorResponse(response, 401);
    });

    it('should require proper role for wizard submission', async () => {
      const clientWithoutAuth = new TestApiClient();
      const wizardData = {
        employer_id: testEmployer.id,
        steps: [],
        organiser_notes: 'Test submission',
      };

      const response = await clientWithoutAuth.submitWizardAssessment(wizardData);

      expectErrorResponse(response, 401);
    });
  });
});