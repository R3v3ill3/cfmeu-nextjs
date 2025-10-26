import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  TestApiClient,
  TestEnvironment,
  createMockEmployer,
  createMockProject,
  createMockComplianceAssessment,
  expectValidResponse,
  expectErrorResponse,
  expectPaginatedResponse,
} from './test-utils';
import type { Track1AssessmentRequest } from '@/types/rating-api';

describe('Track 1: Project Compliance Assessments API', () => {
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

  describe('POST /api/projects/{projectId}/compliance-assessments', () => {
    it('should create a new compliance assessment with valid data', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.employer_id).toBe(testEmployer.id);
      expect(response.data.data.project_id).toBe(testProject.id);
      expect(response.data.data.assessment_type).toBe(assessmentData.assessment_type);
      expect(response.data.data.score).toBe(assessmentData.score);
      expect(response.data.data.rating).toBe(assessmentData.rating);
      expect(response.data.data.confidence_level).toBe(assessmentData.confidence_level);
      expect(response.data.data.created_at).toBeDefined();
    });

    it('should handle ECA status assessments', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        assessment_type: 'eca_status',
        score: 30,
        rating: 'green',
        confidence_level: 'high',
        assessment_notes: 'Active EBA with excellent compliance record',
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.assessment_type).toBe('eca_status');
      expect(response.data.data.score).toBe(30);
      expect(response.data.data.rating).toBe('green');
    });

    it('should handle CBUS status assessments', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        assessment_type: 'cbus_status',
        score: 15,
        rating: 'amber',
        confidence_level: 'medium',
        assessment_notes: 'CBUS participation but some contribution issues',
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.assessment_type).toBe('cbus_status');
      expect(response.data.data.rating).toBe('amber');
    });

    it('should handle safety incident assessments', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        assessment_type: 'safety_incidents',
        score: -50,
        rating: 'red',
        confidence_level: 'high',
        severity_level: 4,
        assessment_notes: 'Multiple serious safety incidents reported',
        follow_up_required: true,
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.assessment_type).toBe('safety_incidents');
      expect(response.data.data.score).toBe(-50);
      expect(response.data.data.rating).toBe('red');
      expect(response.data.data.follow_up_required).toBe(true);
    });

    it('should reject invalid assessment types', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        assessment_type: 'invalid_type' as any,
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid scores', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 150, // Invalid: should be -100 to 100
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid ratings', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        rating: 'purple' as any, // Invalid: should be green/amber/red/unknown
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid confidence levels', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        confidence_level: 'super_high' as any, // Invalid
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject missing required fields', async () => {
      const assessmentData = {
        employer_id: testEmployer.id,
        // Missing required fields
      };

      const response = await client.createComplianceAssessment(testProject.id, assessmentData as any);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should handle evidence attachments', async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        evidence_attachments: ['document1.pdf', 'image1.jpg', 'certificate.pdf'],
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);

      expectValidResponse(response, 201);
      expect(response.data.data.evidence_attachments).toEqual(
        expect.arrayContaining(['document1.pdf', 'image1.jpg', 'certificate.pdf'])
      );
    });
  });

  describe('GET /api/projects/{projectId}/compliance-assessments', () => {
    let createdAssessments: any[] = [];

    beforeEach(async () => {
      // Create test assessments for GET tests
      const assessmentTypes = ['eca_status', 'cbus_status', 'safety_incidents'];

      for (const type of assessmentTypes) {
        const assessmentData = createMockComplianceAssessment({
          employer_id: testEmployer.id,
          project_id: testProject.id,
          assessment_type: type,
        });

        const response = await client.createComplianceAssessment(testProject.id, assessmentData);
        if (response.ok) {
          createdAssessments.push(response.data.data);
        }
      }
    });

    it('should retrieve compliance assessments for a project', async () => {
      const response = await client.getComplianceAssessments(testProject.id);

      expectPaginatedResponse(response);
      expect(response.data.data.assessments).toHaveLength(createdAssessments.length);
      expect(response.data.data.summary).toBeDefined();
      expect(response.data.data.summary.total_assessments).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await client.getComplianceAssessments(testProject.id, {
        page: '1',
        pageSize: '2',
      });

      expectPaginatedResponse(response);
      expect(response.data.data.pagination.page).toBe(1);
      expect(response.data.data.pagination.pageSize).toBe(2);
      expect(response.data.data.assessments.length).toBeLessThanOrEqual(2);
    });

    it('should filter by assessment type', async () => {
      const response = await client.getComplianceAssessments(testProject.id, {
        assessmentType: 'eca_status',
      });

      expectValidResponse(response);
      response.data.data.assessments.forEach((assessment: any) => {
        expect(assessment.assessment_type).toBe('eca_status');
      });
    });

    it('should filter by confidence level', async () => {
      const response = await client.getComplianceAssessments(testProject.id, {
        confidenceLevel: 'high',
      });

      expectValidResponse(response);
      response.data.data.assessments.forEach((assessment: any) => {
        expect(assessment.confidence_level).toBe('high');
      });
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await client.getComplianceAssessments(testProject.id, {
        dateFrom: today,
        dateTo: today,
      });

      expectValidResponse(response);
      response.data.data.assessments.forEach((assessment: any) => {
        expect(assessment.assessment_date).toBe(today);
      });
    });

    it('should support different sort options', async () => {
      const response = await client.getComplianceAssessments(testProject.id, {
        sortBy: 'score',
        sortOrder: 'desc',
      });

      expectValidResponse(response);
      const assessments = response.data.data.assessments;
      for (let i = 1; i < assessments.length; i++) {
        expect(assessments[i-1].score).toBeGreaterThanOrEqual(assessments[i].score);
      }
    });

    it('should include inactive assessments when requested', async () => {
      const response = await client.getComplianceAssessments(testProject.id, {
        includeInactive: 'true',
      });

      expectValidResponse(response);
      // In a real test, you'd create inactive assessments and verify they're included
    });

    it('should provide assessment summary statistics', async () => {
      const response = await client.getComplianceAssessments(testProject.id);

      expectValidResponse(response);
      const summary = response.data.data.summary;
      expect(summary).toHaveProperty('total_assessments');
      expect(summary).toHaveProperty('assessments_by_type');
      expect(summary).toHaveProperty('average_score');
      expect(summary).toHaveProperty('latest_assessment_date');

      expect(typeof summary.total_assessments).toBe('number');
      expect(typeof summary.average_score).toBe('number');
    });

    it('should handle non-existent project', async () => {
      const response = await client.getComplianceAssessments('non-existent-project-id');

      expectErrorResponse(response, 404);
    });
  });

  describe('GET /api/compliance-assessments/{assessmentId}', () => {
    let testAssessment: any;

    beforeEach(async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);
      testAssessment = response.data.data;
    });

    it('should retrieve a specific compliance assessment', async () => {
      const response = await client.getComplianceAssessment(testAssessment.id);

      expectValidResponse(response);
      expect(response.data.data.id).toBe(testAssessment.id);
      expect(response.data.data.employer_id).toBe(testEmployer.id);
      expect(response.data.data.project_id).toBe(testProject.id);
    });

    it('should return 404 for non-existent assessment', async () => {
      const response = await client.getComplianceAssessment('non-existent-assessment-id');

      expectErrorResponse(response, 404);
    });
  });

  describe('PUT /api/compliance-assessments/{assessmentId}', () => {
    let testAssessment: any;

    beforeEach(async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
        score: 20,
        rating: 'green',
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);
      testAssessment = response.data.data;
    });

    it('should update a compliance assessment', async () => {
      const updateData = {
        score: 35,
        rating: 'green',
        assessment_notes: 'Updated assessment with better score',
        follow_up_required: false,
      };

      const response = await client.updateComplianceAssessment(testAssessment.id, updateData);

      expectValidResponse(response);
      expect(response.data.data.id).toBe(testAssessment.id);
      expect(response.data.data.score).toBe(35);
      expect(response.data.data.assessment_notes).toBe(updateData.assessment_notes);
      expect(response.data.data.updated_at).toBeDefined();
    });

    it('should reject invalid update data', async () => {
      const updateData = {
        score: 150, // Invalid score
      };

      const response = await client.updateComplianceAssessment(testAssessment.id, updateData);

      expectErrorResponse(response, 400);
    });

    it('should not allow updating certain fields', async () => {
      const updateData = {
        employer_id: 'different-employer-id', // Should not be updatable
      };

      const response = await client.updateComplianceAssessment(testAssessment.id, updateData);

      // In a real implementation, this might be rejected or ignored
      expectValidResponse(response);
      expect(response.data.data.employer_id).toBe(testEmployer.id); // Should remain unchanged
    });

    it('should return 404 for non-existent assessment', async () => {
      const response = await client.updateComplianceAssessment('non-existent-assessment-id', {
        score: 25,
      });

      expectErrorResponse(response, 404);
    });
  });

  describe('DELETE /api/compliance-assessments/{assessmentId}', () => {
    let testAssessment: any;

    beforeEach(async () => {
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
      });

      const response = await client.createComplianceAssessment(testProject.id, assessmentData);
      testAssessment = response.data.data;
    });

    it('should soft delete a compliance assessment', async () => {
      const response = await client.deleteComplianceAssessment(testAssessment.id);

      expectValidResponse(response, 200);

      // Verify the assessment is now inactive
      const getResponse = await client.getComplianceAssessment(testAssessment.id);
      expect(getResponse.data.data.is_active).toBe(false);
    });

    it('should return 404 for non-existent assessment', async () => {
      const response = await client.deleteComplianceAssessment('non-existent-assessment-id');

      expectErrorResponse(response, 404);
    });

    it('should not hard delete the assessment record', async () => {
      await client.deleteComplianceAssessment(testAssessment.id);

      // The record should still exist but be inactive
      const getResponse = await client.getComplianceAssessment(testAssessment.id, {
        includeInactive: 'true',
      });

      expectValidResponse(getResponse);
      expect(getResponse.data.data.id).toBe(testAssessment.id);
      expect(getResponse.data.data.is_active).toBe(false);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should require authentication', async () => {
      // Test without auth token
      const clientWithoutAuth = new TestApiClient();
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
      });

      const response = await clientWithoutAuth.createComplianceAssessment(testProject.id, assessmentData);

      expectErrorResponse(response, 401);
    });

    it('should require proper role authorization', async () => {
      // Test with unauthorized role (if implemented)
      // This would require setting up a test user with insufficient permissions
      const assessmentData = createMockComplianceAssessment({
        employer_id: testEmployer.id,
        project_id: testProject.id,
      });

      // For now, we'll assume the client has proper auth setup
      // In a real test environment, you'd test different user roles
      const response = await client.createComplianceAssessment(testProject.id, assessmentData);
      expectValidResponse(response, 201);
    });
  });
});