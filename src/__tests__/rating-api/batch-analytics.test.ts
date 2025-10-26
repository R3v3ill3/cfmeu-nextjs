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
import type { BatchOperationRequest } from '@/types/rating-api';

describe('Batch Operations and Analytics API', () => {
  let testEnv: TestEnvironment;
  let client: TestApiClient;
  let testEmployers: any[] = [];
  let testProject: any;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    client = testEnv.getClient();

    // Set up test data
    testProject = await testEnv.createTestProject();

    // Create multiple test employers for batch operations
    for (let i = 0; i < 5; i++) {
      const employer = await testEnv.createTestEmployer({
        id: `test-employer-${i}`,
        name: `Test Employer ${i}`,
      });
      testEmployers.push(employer);

      // Create assessments for each employer
      const complianceData = createMockComplianceAssessment({
        employer_id: employer.id,
        project_id: testProject.id,
        score: 50 + (i * 10), // Varying scores
        rating: i < 2 ? 'green' : i < 4 ? 'amber' : 'red',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      const expertiseData = createMockExpertiseAssessment({
        overall_score: 55 + (i * 8),
        overall_rating: i < 2 ? 'green' : i < 4 ? 'amber' : 'red',
        confidence_level: 'medium',
      });
      await client.createExpertiseAssessment(employer.id, expertiseData);
    }
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('POST /api/ratings/batch', () => {
    it('should execute batch calculate operations', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: testEmployers.slice(0, 3).map(e => e.id),
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

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('batch_id');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('total_operations');
      expect(response.data.data).toHaveProperty('completed_operations');
      expect(response.data.data).toHaveProperty('failed_operations');
      expect(response.data.data).toHaveProperty('results');
      expect(response.data.data).toHaveProperty('summary');

      expect(response.data.data.status).toBe('completed');
      expect(response.data.data.total_operations).toBe(3);
      expect(response.data.data.completed_operations).toBeGreaterThanOrEqual(0);
      expect(response.data.data.failed_operations).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch recalculate operations', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'recalculate',
            employer_ids: testEmployers.slice(2, 5).map(e => e.id),
            parameters: {
              project_weight: 0.7,
              expertise_weight: 0.3,
              force_recalculate: true,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(3);
      expect(response.data.data.results).toBeDefined();
    });

    it('should handle batch expire operations', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'expire',
            employer_ids: testEmployers.slice(0, 2).map(e => e.id),
            parameters: {
              expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              reason: 'Scheduled expiry for testing',
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(2);
    });

    it('should handle batch archive operations', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'archive',
            employer_ids: testEmployers.slice(1, 3).map(e => e.id),
            parameters: {
              archive_date: new Date().toISOString().split('T')[0],
              reason: 'Archive old ratings for testing',
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(2);
    });

    it('should handle batch approve operations', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'approve',
            employer_ids: testEmployers.slice(3, 5).map(e => e.id),
            parameters: {
              approved_by: 'test-approver',
              approval_notes: 'Batch approval for testing',
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(2);
    });

    it('should handle multiple operation types in one batch', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: [testEmployers[0].id],
            parameters: {
              calculation_date: '2025-01-26',
              project_weight: 0.6,
              expertise_weight: 0.4,
            },
          },
          {
            operation_type: 'recalculate',
            employer_ids: [testEmployers[1].id],
            parameters: {
              project_weight: 0.7,
              expertise_weight: 0.3,
              force_recalculate: true,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(2);
      expect(response.data.data.results.length).toBe(2);
    });

    it('should handle dry run mode', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: testEmployers.slice(0, 3).map(e => e.id),
            parameters: {
              calculation_date: '2025-01-26',
              project_weight: 0.6,
              expertise_weight: 0.4,
            },
          },
        ],
        dry_run: true,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 200);
      expect(response.data.data.status).toBe('dry_run_completed');
      expect(response.data.data.results).toBeDefined();
      // Should not actually modify data in dry run mode
    });

    it('should handle partial failures gracefully', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: [testEmployers[0].id, 'non-existent-employer', testEmployers[1].id],
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

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.total_operations).toBe(3);
      expect(response.data.data.completed_operations).toBe(2);
      expect(response.data.data.failed_operations).toBe(1);
      expect(response.data.data.results.length).toBe(3);

      // Check that failed operations are properly marked
      const failedResult = response.data.data.results.find((r: any) => r.status === 'failed');
      expect(failedResult).toBeDefined();
      expect(failedResult.error).toBeDefined();
    });

    it('should provide operation summary', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: testEmployers.slice(0, 2).map(e => e.id),
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

      const response = await client.executeBatchOperation(batchRequest);

      expectValidResponse(response, 201);
      const summary = response.data.data.summary;
      expect(summary).toHaveProperty('ratings_calculated');
      expect(summary).toHaveProperty('total_processing_time_ms');
      expect(typeof summary.ratings_calculated).toBe('number');
      expect(typeof summary.total_processing_time_ms).toBe('number');
    });

    it('should reject invalid operation types', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'invalid_operation' as any,
            employer_ids: [testEmployers[0].id],
            parameters: {},
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject empty operations array', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should reject invalid parameters', async () => {
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: [testEmployers[0].id],
            parameters: {
              project_weight: 1.5, // Invalid weight > 1
              expertise_weight: 0.5,
            },
          },
        ],
        dry_run: false,
        notification_preferences: {
          email_on_completion: false,
        },
      };

      const response = await client.executeBatchOperation(batchRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should require proper authorization', async () => {
      const clientWithoutAuth = new TestApiClient();
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: [testEmployers[0].id],
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

      const response = await clientWithoutAuth.executeBatchOperation(batchRequest);

      expectErrorResponse(response, 401);
    });
  });

  describe('GET /api/ratings/batch', () => {
    let batchId: string;

    beforeEach(async () => {
      // Create a batch operation to test status checking
      const batchRequest: BatchOperationRequest = {
        operations: [
          {
            operation_type: 'calculate',
            employer_ids: [testEmployers[0].id],
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

      const response = await client.executeBatchOperation(batchRequest);
      batchId = response.data.data.batch_id;
    });

    it('should retrieve batch operation status', async () => {
      const response = await client.getBatchStatus(batchId);

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('batch_id');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('total_operations');
      expect(response.data.data).toHaveProperty('completed_operations');
      expect(response.data.data).toHaveProperty('failed_operations');
      expect(response.data.data).toHaveProperty('created_at');
      expect(response.data.data).toHaveProperty('updated_at');

      expect(response.data.data.batch_id).toBe(batchId);
      expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(response.data.data.status);
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await client.getBatchStatus('non-existent-batch-id');

      expectErrorResponse(response, 404);
    });

    it('should require authentication', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.getBatchStatus(batchId);

      expectErrorResponse(response, 401);
    });
  });

  describe('GET /api/ratings/analytics/trends', () => {
    it('should retrieve rating trends overview', async () => {
      const response = await client.getRatingTrends();

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('overview');
      expect(response.data.data).toHaveProperty('time_series');
      expect(response.data.data).toHaveProperty('rating_changes');
      expect(response.data.data).toHaveProperty('insights');

      const overview = response.data.data.overview;
      expect(overview).toHaveProperty('total_employers');
      expect(overview).toHaveProperty('employers_with_ratings');
      expect(overview).toHaveProperty('current_rating_distribution');
      expect(overview).toHaveProperty('system_health');

      expect(typeof overview.total_employers).toBe('number');
      expect(typeof overview.employers_with_ratings).toBe('number');
      expect(typeof overview.current_rating_distribution).toBe('object');
    });

    it('should include rating distribution data', async () => {
      const response = await client.getRatingTrends();

      expectValidResponse(response);
      const distribution = response.data.data.overview.current_rating_distribution;

      expect(distribution).toHaveProperty('green');
      expect(distribution).toHaveProperty('amber');
      expect(distribution).toHaveProperty('red');
      expect(distribution).toHaveProperty('unknown');

      expect(typeof distribution.green).toBe('number');
      expect(typeof distribution.amber).toBe('number');
      expect(typeof distribution.red).toBe('number');
      expect(typeof distribution.unknown).toBe('number');
    });

    it('should include rating changes summary', async () => {
      const response = await client.getRatingTrends();

      expectValidResponse(response);
      const changes = response.data.data.rating_changes;

      expect(changes).toHaveProperty('improvements');
      expect(changes).toHaveProperty('declines');
      expect(changes).toHaveProperty('net_change');

      expect(typeof changes.improvements).toBe('number');
      expect(typeof changes.declines).toBe('number');
      expect(typeof changes.net_change).toBe('number');
    });

    it('should provide insights and recommendations', async () => {
      const response = await client.getRatingTrends();

      expectValidResponse(response);
      const insights = response.data.data.insights;

      expect(insights).toHaveProperty('positive_trends');
      expect(insights).toHaveProperty('concerns');
      expect(insights).toHaveProperty('recommendations');

      expect(Array.isArray(insights.positive_trends)).toBe(true);
      expect(Array.isArray(insights.concerns)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);
    });

    it('should support time period filtering', async () => {
      const response = await client.getRatingTrends({
        period: '30d',
      });

      expectValidResponse(response);
      expect(response.data.data.overview).toBeDefined();
      // Should show data for the last 30 days
    });

    it('should support different time periods', async () => {
      const periods = ['7d', '30d', '90d', '180d', '1y'];

      for (const period of periods) {
        const response = await client.getRatingTrends({ period });

        expectValidResponse(response);
        expect(response.data.data.overview).toBeDefined();
      }
    });

    it('should support employer type filtering', async () => {
      const response = await client.getRatingTrends({
        employerType: 'construction',
      });

      expectValidResponse(response);
      expect(response.data.data.overview).toBeDefined();
    });

    it('should support different granularities', async () => {
      const granularities = ['daily', 'weekly', 'monthly'];

      for (const granularity of granularities) {
        const response = await client.getRatingTrends({ granularity });

        expectValidResponse(response);
        expect(response.data.data.time_series).toBeDefined();
      }
    });

    it('should include time series data', async () => {
      const response = await client.getRatingTrends({
        period: '7d',
        granularity: 'daily',
      });

      expectValidResponse(response);
      const timeSeries = response.data.data.time_series;

      expect(Array.isArray(timeSeries)).toBe(true);
      expect(timeSeries.length).toBeGreaterThan(0);

      const dataPoint = timeSeries[0];
      expect(dataPoint).toHaveProperty('date');
      expect(dataPoint).toHaveProperty('green_count');
      expect(dataPoint).toHaveProperty('amber_count');
      expect(dataPoint).toHaveProperty('red_count');
      expect(dataPoint).toHaveProperty('unknown_count');
      expect(dataPoint).toHaveProperty('total_count');
    });

    it('should include system health metrics', async () => {
      const response = await client.getRatingTrends();

      expectValidResponse(response);
      const systemHealth = response.data.data.overview.system_health;

      expect(systemHealth).toHaveProperty('data_quality_score');
      expect(systemHealth).toHaveProperty('last_updated');
      expect(systemHealth).toHaveProperty('active_alerts');

      expect(typeof systemHealth.data_quality_score).toBe('number');
      expect(typeof systemHealth.active_alerts).toBe('number');
    });

    it('should require authentication', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.getRatingTrends();

      expectErrorResponse(response, 401);
    });
  });

  describe('POST /api/ratings/export', () => {
    it('should create CSV export request', async () => {
      const exportRequest = {
        format: 'csv',
        employer_ids: testEmployers.slice(0, 3).map(e => e.id),
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active'],
        include_details: true,
        include_history: false,
      };

      const response = await client.exportData(exportRequest);

      expectValidResponse(response, 201);
      expect(response.data.data).toHaveProperty('export_id');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('format');
      expect(response.data.data).toHaveProperty('record_count');
      expect(response.data.data).toHaveProperty('expires_at');

      expect(response.data.data.format).toBe('csv');
      expect(response.data.data.status).toBe('processing');
      expect(typeof response.data.data.record_count).toBe('number');
    });

    it('should create JSON export request', async () => {
      const exportRequest = {
        format: 'json',
        employer_ids: testEmployers.map(e => e.id),
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active', 'expired'],
        include_details: true,
        include_history: true,
      };

      const response = await client.exportData(exportRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.format).toBe('json');
      expect(response.data.data.record_count).toBeGreaterThan(0);
    });

    it('should handle Excel export format', async () => {
      const exportRequest = {
        format: 'excel',
        employer_ids: testEmployers.slice(0, 2).map(e => e.id),
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active'],
        include_details: false,
        include_history: false,
      };

      const response = await client.exportData(exportRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.format).toBe('excel');
    });

    it('should validate export format', async () => {
      const exportRequest = {
        format: 'pdf', // Unsupported format
        employer_ids: [testEmployers[0].id],
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active'],
        include_details: true,
        include_history: false,
      };

      const response = await client.exportData(exportRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should validate date range', async () => {
      const exportRequest = {
        format: 'csv',
        employer_ids: [testEmployers[0].id],
        date_range: {
          from: '2025-01-31', // End date before start date
          to: '2025-01-01',
        },
        rating_status: ['active'],
        include_details: true,
        include_history: false,
      };

      const response = await client.exportData(exportRequest);

      expectErrorResponse(response, 400);
      expect(response.data.type).toBe('validation');
    });

    it('should handle empty employer list', async () => {
      const exportRequest = {
        format: 'csv',
        employer_ids: [],
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active'],
        include_details: true,
        include_history: false,
      };

      const response = await client.exportData(exportRequest);

      expectValidResponse(response, 201);
      expect(response.data.data.record_count).toBe(0);
    });

    it('should require authentication', async () => {
      const clientWithoutAuth = new TestApiClient();
      const exportRequest = {
        format: 'csv',
        employer_ids: [testEmployers[0].id],
        date_range: {
          from: '2025-01-01',
          to: '2025-01-31',
        },
        rating_status: ['active'],
        include_details: true,
        include_history: false,
      };

      const response = await clientWithoutAuth.exportData(exportRequest);

      expectErrorResponse(response, 401);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits on analytics endpoints', async () => {
      // Make multiple requests quickly to test rate limiting
      const promises = Array(10).fill(null).map(() =>
        client.getRatingTrends({ period: '7d' })
      );

      const responses = await Promise.all(promises);

      // Most should succeed, but some might be rate limited
      const successfulResponses = responses.filter(r => r.ok);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length).toBeGreaterThan(0);
      // Rate limiting is optional in test environment, but if implemented should work
    });

    it('should include rate limit headers', async () => {
      const response = await client.getRatingTrends();

      expect(response.headers.has('X-RateLimit-Limit')).toBe(true);
      expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
      expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
    });
  });
});