import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  Track1AssessmentRequest,
  Track2AssessmentRequest,
  FinalRatingRequest,
  BatchOperationRequest
} from '@/types/rating-api';

// Test utilities
const TEST_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  API_BASE: '/api',
  TIMEOUT: 30000,
};

// Test data factories
const createMockEmployer = (overrides: any = {}) => ({
  id: 'test-employer-id',
  name: 'Test Construction Company',
  abn: '12345678901',
  ...overrides,
});

const createMockProject = (overrides: any = {}) => ({
  id: 'test-project-id',
  name: 'Test Project',
  project_code: 'TEST-001',
  ...overrides,
});

const createMockComplianceAssessment = (overrides: any = {}): Track1AssessmentRequest => ({
  employer_id: 'test-employer-id',
  project_id: 'test-project-id',
  assessment_type: 'eca_status',
  score: 25,
  rating: 'green',
  confidence_level: 'high',
  severity_level: 1,
  assessment_notes: 'Active EBA with good compliance',
  assessment_date: '2025-01-26',
  evidence_attachments: [],
  follow_up_required: false,
  ...overrides,
});

const createMockExpertiseAssessment = (overrides: any = {}): Track2AssessmentRequest => ({
  overall_score: 75,
  overall_rating: 'green',
  confidence_level: 'medium',
  assessment_basis: 'Based on industry knowledge and recent project interactions',
  assessment_context: 'Employer has shown consistent compliance and good union relationship',
  eba_status_known: true,
  eba_status: 'green',
  knowledge_beyond_projects: true,
  industry_reputation: 'Generally positive with some isolated concerns',
  union_relationship_quality: 'good',
  assessment_date: '2025-01-26',
  assessment_notes: 'Strong EBA compliance, good payment history, positive industry reputation',
  ...overrides,
});

// Test utilities
class TestApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = TEST_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${TEST_CONFIG.API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(TEST_CONFIG.TIMEOUT),
    });

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data: response.ok ? await response.json() : await response.json().catch(() => null),
    };
  }

  // Track 1 endpoints
  async createComplianceAssessment(projectId: string, data: Track1AssessmentRequest) {
    return this.makeRequest(`/projects/${projectId}/compliance-assessments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getComplianceAssessments(projectId: string, params: Record<string, string> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `/projects/${projectId}/compliance-assessments?${queryString}`
      : `/projects/${projectId}/compliance-assessments`;

    return this.makeRequest(endpoint);
  }

  async getComplianceAssessment(assessmentId: string) {
    return this.makeRequest(`/compliance-assessments/${assessmentId}`);
  }

  async updateComplianceAssessment(assessmentId: string, data: Partial<Track1AssessmentRequest>) {
    return this.makeRequest(`/compliance-assessments/${assessmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteComplianceAssessment(assessmentId: string) {
    return this.makeRequest(`/compliance-assessments/${assessmentId}`, {
      method: 'DELETE',
    });
  }

  // Track 2 endpoints
  async createExpertiseAssessment(employerId: string, data: Track2AssessmentRequest) {
    return this.makeRequest(`/employers/${employerId}/expertise-ratings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExpertiseAssessments(employerId: string, params: Record<string, string> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `/employers/${employerId}/expertise-ratings?${queryString}`
      : `/employers/${employerId}/expertise-ratings`;

    return this.makeRequest(endpoint);
  }

  async getWizardConfig() {
    return this.makeRequest('/expertise-wizard/config');
  }

  async submitWizardAssessment(data: any) {
    return this.makeRequest('/expertise-wizard/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Final Ratings endpoints
  async getFinalRatings(employerId: string, params: Record<string, string> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `/employers/${employerId}/ratings?${queryString}`
      : `/employers/${employerId}/ratings`;

    return this.makeRequest(endpoint);
  }

  async calculateFinalRating(employerId: string, data: FinalRatingRequest) {
    return this.makeRequest(`/employers/${employerId}/ratings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async compareRatings(employerId: string) {
    return this.makeRequest(`/employers/${employerId}/ratings/compare`);
  }

  async recalculateRating(employerId: string, data: any) {
    return this.makeRequest(`/employers/${employerId}/ratings/recalculate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Batch operations
  async executeBatchOperation(data: BatchOperationRequest) {
    return this.makeRequest('/ratings/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBatchStatus(batchId: string) {
    return this.makeRequest(`/ratings/batch?batchId=${batchId}`);
  }

  // Analytics endpoints
  async getRatingTrends(params: Record<string, string> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `/ratings/analytics/trends?${queryString}`
      : `/ratings/analytics/trends`;

    return this.makeRequest(endpoint);
  }

  async exportData(data: any) {
    return this.makeRequest('/ratings/export', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Mobile dashboard
  async getDashboard(params: Record<string, string> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `/ratings/dashboard?${queryString}`
      : `/ratings/dashboard`;

    return this.makeRequest(endpoint);
  }

  // Health check
  async healthCheck(endpoint: string) {
    return this.makeRequest(endpoint, { method: 'HEAD' });
  }
}

// Test setup and teardown utilities
export class TestEnvironment {
  private client: TestApiClient;
  private createdEmployers: string[] = [];
  private createdProjects: string[] = [];
  private createdAssessments: string[] = [];

  constructor() {
    this.client = new TestApiClient();
  }

  async setup() {
    // Create test data
    // Note: In a real implementation, you'd set up test database state here
    console.log('Setting up test environment...');
  }

  async teardown() {
    // Clean up test data
    // Note: In a real implementation, you'd clean up test database state here
    console.log('Tearing down test environment...');
  }

  getClient(): TestApiClient {
    return this.client;
  }

  // Helper methods for creating test data
  async createTestEmployer(data?: any) {
    const employer = createMockEmployer(data);
    this.createdEmployers.push(employer.id);
    return employer;
  }

  async createTestProject(data?: any) {
    const project = createMockProject(data);
    this.createdProjects.push(project.id);
    return project;
  }

  async createTestComplianceAssessment(data?: any) {
    const assessment = createMockComplianceAssessment(data);
    this.createdAssessments.push(assessment.employer_id);
    return assessment;
  }

  async createTestExpertiseAssessment(data?: any) {
    const assessment = createMockExpertiseAssessment(data);
    this.createdAssessments.push(assessment.assessment_basis);
    return assessment;
  }
}

// Export test utilities
export {
  TestApiClient,
  TEST_CONFIG,
  createMockEmployer,
  createMockProject,
  createMockComplianceAssessment,
  createMockExpertiseAssessment,
};

// Common test patterns
export const expectValidResponse = (response: any, expectedStatus: number = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.ok).toBe(expectedStatus < 400);
  expect(response.data).toBeDefined();
  expect(response.data).toHaveProperty('data');
  expect(response.data).toHaveProperty('meta');
  expect(response.data.meta).toHaveProperty('timestamp');
};

export const expectErrorResponse = (response: any, expectedStatus: number) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.ok).toBe(false);
  expect(response.data).toHaveProperty('error');
  expect(response.data).toHaveProperty('type');
  expect(response.data).toHaveProperty('timestamp');
};

export const expectPaginatedResponse = (response: any) => {
  expectValidResponse(response);
  expect(response.data.data).toHaveProperty('assessments');
  expect(response.data.data).toHaveProperty('pagination');
  expect(response.data.data.pagination).toHaveProperty('page');
  expect(response.data.data.pagination).toHaveProperty('pageSize');
  expect(response.data.data.pagination).toHaveProperty('totalCount');
  expect(response.data.data.pagination).toHaveProperty('totalPages');
};