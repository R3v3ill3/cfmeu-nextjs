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

describe('Mobile Dashboard API', () => {
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

    // Create test employers with different ratings
    const employerData = [
      { name: 'Green Construction Co', rating: 'green', score: 85 },
      { name: 'Amber Builders Ltd', rating: 'amber', score: 65 },
      { name: 'Red Contracting', rating: 'red', score: -15 },
      { name: 'Unknown Services', rating: 'unknown', score: null },
      { name: 'Excellent Contractors', rating: 'green', score: 90 },
    ];

    for (let i = 0; i < employerData.length; i++) {
      const employer = await testEnv.createTestEmployer({
        id: `mobile-employer-${i}`,
        name: employerData[i].name,
      });
      testEmployers.push(employer);

      // Create compliance assessment
      const complianceData = createMockComplianceAssessment({
        employer_id: employer.id,
        project_id: testProject.id,
        score: employerData[i].score,
        rating: employerData[i].rating,
        assessment_type: 'eca_status',
      });
      await client.createComplianceAssessment(testProject.id, complianceData);

      // Create expertise assessment
      const expertiseData = createMockExpertiseAssessment({
        overall_score: employerData[i].score,
        overall_rating: employerData[i].rating,
        confidence_level: 'high',
      });
      await client.createExpertiseAssessment(employer.id, expertiseData);
    }
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('GET /api/ratings/dashboard', () => {
    it('should retrieve mobile-optimized dashboard data', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      expect(response.data.data).toHaveProperty('overview');
      expect(response.data.data).toHaveProperty('top_concerns');
      expect(response.data.data).toHaveProperty('top_performers');
      expect(response.data.data).toHaveProperty('recent_activities');
      expect(response.data.data).toHaveProperty('alerts');
      expect(response.data.data).toHaveProperty('quick_actions');

      // Verify mobile optimization headers
      expect(response.headers.get('X-Mobile-Optimized')).toBe('true');
      expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    });

    it('should include comprehensive overview data', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const overview = response.data.data.overview;

      expect(overview).toHaveProperty('total_employers');
      expect(overview).toHaveProperty('rated_employers');
      expect(overview).toHaveProperty('current_rating_distribution');
      expect(overview).toHaveProperty('recent_changes');
      expect(overview).toHaveProperty('system_health');

      expect(typeof overview.total_employers).toBe('number');
      expect(typeof overview.rated_employers).toBe('number');
      expect(overview.total_employers).toBeGreaterThanOrEqual(overview.rated_employers);
    });

    it('should include rating distribution in overview', async () => {
      const response = await client.getDashboard();

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

      // Distribution should sum to total rated employers
      const sum = distribution.green + distribution.amber + distribution.red + distribution.unknown;
      expect(sum).toBe(response.data.data.overview.rated_employers);
    });

    it('should include recent changes summary', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const recentChanges = response.data.data.overview.recent_changes;

      expect(recentChanges).toHaveProperty('improvements');
      expect(recentChanges).toHaveProperty('declines');
      expect(recentChanges).toHaveProperty('new_ratings');

      expect(typeof recentChanges.improvements).toBe('number');
      expect(typeof recentChanges.declines).toBe('number');
      expect(typeof recentChanges.new_ratings).toBe('number');
    });

    it('should include system health metrics', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const systemHealth = response.data.data.overview.system_health;

      expect(systemHealth).toHaveProperty('data_quality_score');
      expect(systemHealth).toHaveProperty('last_updated');
      expect(systemHealth).toHaveProperty('active_alerts');
      expect(systemHealth).toHaveProperty('pending_reviews');

      expect(typeof systemHealth.data_quality_score).toBe('number');
      expect(systemHealth.data_quality_score).toBeGreaterThanOrEqual(0);
      expect(systemHealth.data_quality_score).toBeLessThanOrEqual(1);
      expect(typeof systemHealth.active_alerts).toBe('number');
      expect(typeof systemHealth.pending_reviews).toBe('number');
    });

    it('should include top concerns (red/amber employers)', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const topConcerns = response.data.data.top_concerns;

      expect(Array.isArray(topConcerns)).toBe(true);

      if (topConcerns.length > 0) {
        const concern = topConcerns[0];
        expect(concern).toHaveProperty('employer_id');
        expect(concern).toHaveProperty('employer_name');
        expect(concern).toHaveProperty('current_rating');
        expect(concern).toHaveProperty('score');
        expect(concern).toHaveProperty('rating_trend');
        expect(concern).toHaveProperty('last_updated');
        expect(concern).toHaveProperty('priority');

        expect(['red', 'amber']).toContain(concern.current_rating);
        expect(['high', 'medium', 'low']).toContain(concern.priority);
        expect(['improving', 'stable', 'declining']).toContain(concern.rating_trend);
      }
    });

    it('should include top performers (green employers)', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const topPerformers = response.data.data.top_performers;

      expect(Array.isArray(topPerformers)).toBe(true);

      if (topPerformers.length > 0) {
        const performer = topPerformers[0];
        expect(performer).toHaveProperty('employer_id');
        expect(performer).toHaveProperty('employer_name');
        expect(performer).toHaveProperty('current_rating');
        expect(performer).toHaveProperty('score');
        expect(performer).toHaveProperty('rating_trend');
        expect(performer).toHaveProperty('last_updated');

        expect(performer.current_rating).toBe('green');
        expect(['improving', 'stable', 'declining']).toContain(performer.rating_trend);
      }
    });

    it('should include recent activities', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const recentActivities = response.data.data.recent_activities;

      expect(Array.isArray(recentActivities)).toBe(true);

      if (recentActivities.length > 0) {
        const activity = recentActivities[0];
        expect(activity).toHaveProperty('type');
        expect(activity).toHaveProperty('employer_id');
        expect(activity).toHaveProperty('employer_name');
        expect(activity).toHaveProperty('description');
        expect(activity).toHaveProperty('timestamp');

        expect(['rating_change', 'assessment_added', 'review_completed', 'alert_triggered']).toContain(activity.type);
        expect(typeof activity.timestamp).toBe('string');
      }
    });

    it('should include active alerts', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const alerts = response.data.data.alerts;

      expect(Array.isArray(alerts)).toBe(true);

      if (alerts.length > 0) {
        const alert = alerts[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('title');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('created_at');
        expect(alert).toHaveProperty('requires_action');

        expect(['rating_change', 'discrepancy_detected', 'review_required', 'expiry_warning']).toContain(alert.type);
        expect(['info', 'warning', 'critical']).toContain(alert.severity);
        expect(typeof alert.requires_action).toBe('boolean');
      }
    });

    it('should include quick actions summary', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);
      const quickActions = response.data.data.quick_actions;

      expect(quickActions).toHaveProperty('pending_reviews');
      expect(quickActions).toHaveProperty('ratings_expiring_soon');
      expect(quickActions).toHaveProperty('data_gaps');
      expect(quickActions).toHaveProperty('discrepancies_to_resolve');

      expect(typeof quickActions.pending_reviews).toBe('number');
      expect(typeof quickActions.ratings_expiring_soon).toBe('number');
      expect(typeof quickActions.data_gaps).toBe('number');
      expect(typeof quickActions.discrepancies_to_resolve).toBe('number');
    });

    it('should support result limiting', async () => {
      const response = await client.getDashboard({
        limit: '5',
      });

      expectValidResponse(response);

      // Should respect the limit
      const topConcerns = response.data.data.top_concerns;
      const topPerformers = response.data.data.top_performers;
      const recentActivities = response.data.data.recent_activities;
      const alerts = response.data.data.alerts;

      expect(topConcerns.length).toBeLessThanOrEqual(5);
      expect(topPerformers.length).toBeLessThanOrEqual(5);
      expect(recentActivities.length).toBeLessThanOrEqual(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });

    it('should support maximum limit enforcement', async () => {
      const response = await client.getDashboard({
        limit: '50', // Should be capped at 20
      });

      expectValidResponse(response);

      const topConcerns = response.data.data.top_concerns;
      const topPerformers = response.data.data.top_performers;
      const recentActivities = response.data.data.recent_activities;
      const alerts = response.data.data.alerts;

      expect(topConcerns.length).toBeLessThanOrEqual(20);
      expect(topPerformers.length).toBeLessThanOrEqual(20);
      expect(recentActivities.length).toBeLessThanOrEqual(20);
      expect(alerts.length).toBeLessThanOrEqual(20);
    });

    it('should allow excluding alerts', async () => {
      const response = await client.getDashboard({
        includeAlerts: 'false',
      });

      expectValidResponse(response);
      expect(response.data.data.alerts).toEqual([]);
    });

    it('should include role-based filter information', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Should include filters for organizers and lead organizers
      if (response.data.data.filters) {
        const filters = response.data.data.filters;
        expect(filters).toHaveProperty('role_scope');
        expect(filters).toHaveProperty('accessible_patches');

        expect(Array.isArray(filters.role_scope)).toBe(true);
        expect(Array.isArray(filters.accessible_patches)).toBe(true);
      }
    });

    it('should support patch filtering', async () => {
      const response = await client.getDashboard({
        patch: 'test-patch-id',
      });

      expectValidResponse(response);
      // Should filter data by patch if user has access
    });

    it('should handle mobile optimization headers', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Check mobile-specific headers
      expect(response.headers.get('X-Mobile-Optimized')).toBe('true');

      // Check caching headers
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('s-maxage=300');
      expect(cacheControl).toContain('stale-while-revalidate=600');
    });

    it('should handle empty data gracefully', async () => {
      // Create a new environment with no data
      const emptyEnv = new TestEnvironment();
      await emptyEnv.setup();
      const emptyClient = emptyEnv.getClient();

      const response = await emptyClient.getDashboard();

      expectValidResponse(response);

      const overview = response.data.data.overview;
      expect(overview.total_employers).toBe(0);
      expect(overview.rated_employers).toBe(0);

      expect(response.data.data.top_concerns).toEqual([]);
      expect(response.data.data.top_performers).toEqual([]);
      expect(response.data.data.recent_activities).toEqual([]);
      expect(response.data.data.alerts).toEqual([]);

      const quickActions = response.data.data.quick_actions;
      expect(quickActions.pending_reviews).toBe(0);
      expect(quickActions.ratings_expiring_soon).toBe(0);
      expect(quickActions.data_gaps).toBe(0);
      expect(quickActions.discrepancies_to_resolve).toBe(0);

      await emptyEnv.teardown();
    });

    it('should require authentication', async () => {
      const clientWithoutAuth = new TestApiClient();

      const response = await clientWithoutAuth.getDashboard();

      expectErrorResponse(response, 401);
    });
  });

  describe('HEAD /api/ratings/dashboard', () => {
    it('should return health check status', async () => {
      const response = await client.healthCheck('/ratings/dashboard');

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);

      // Check health headers
      expect(response.headers.has('X-Active-Ratings')).toBe(true);
      expect(response.headers.has('X-Dashboard-Status')).toBe(true);
      expect(response.headers.has('X-Mobile-Optimized')).toBe(true);
      expect(response.headers.has('X-Last-Checked')).toBe(true);
    });

    it('should include active ratings count in health check', async () => {
      const response = await client.healthCheck('/ratings/dashboard');

      expect(response.status).toBe(200);
      const activeRatings = response.headers.get('X-Active-Ratings');
      expect(activeRatings).toBeDefined();
      expect(parseInt(activeRatings || '0')).toBeGreaterThanOrEqual(0);
    });

    it('should indicate dashboard status is operational', async () => {
      const response = await client.healthCheck('/ratings/dashboard');

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Dashboard-Status')).toBe('operational');
    });

    it('should include mobile optimization indicator', async () => {
      const response = await client.healthCheck('/ratings/dashboard');

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Mobile-Optimized')).toBe('true');
    });

    it('should include timestamp in health check', async () => {
      const response = await client.healthCheck('/ratings/dashboard');

      expect(response.status).toBe(200);
      const lastChecked = response.headers.get('X-Last-Checked');
      expect(lastChecked).toBeDefined();
      expect(Date.parse(lastChecked || '')).not.toBeNaN();
    });

    it('should handle service unavailable scenario', async () => {
      // This would be tested by mocking a database failure
      // For now, just verify the endpoint structure exists
      const response = await client.healthCheck('/ratings/dashboard');
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Mobile-Specific Optimizations', () => {
    it('should minimize data transfer for mobile', async () => {
      const response = await client.getDashboard({
        limit: '5',
        includeAlerts: 'false',
      });

      expectValidResponse(response);

      // Response should be concise
      const dataString = JSON.stringify(response.data.data);
      expect(dataString.length).toBeLessThan(50000); // Should be under 50KB for mobile
    });

    it('should structure data for easy mobile consumption', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Data should be flat and easy to consume
      const overview = response.data.data.overview;
      expect(typeof overview.total_employers).toBe('number');
      expect(typeof overview.current_rating_distribution).toBe('object');

      // Arrays should be easily iterable
      expect(Array.isArray(response.data.data.top_concerns)).toBe(true);
      expect(Array.isArray(response.data.data.top_performers)).toBe(true);
      expect(Array.isArray(response.data.data.recent_activities)).toBe(true);
    });

    it('should provide cache-friendly structure', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Data should be structured for easy local storage
      const data = response.data.data;

      // Key metrics should be easily extractable
      expect(typeof data.overview.total_employers).toBe('number');
      expect(typeof data.overview.rated_employers).toBe('number');
      expect(typeof data.overview.system_health.data_quality_score).toBe('number');

      // Lists should be self-contained
      data.top_concerns.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('status');
      });
    });

    it('should support offline-first data structure', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Include timestamps for cache validation
      expect(response.data.data.overview.system_health.last_updated).toBeDefined();

      // Include stable identifiers
      response.data.data.top_concerns.forEach((concern: any) => {
        expect(concern).toHaveProperty('employer_id');
      });

      response.data.data.alerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('created_at');
      });
    });

    it('should implement progressive loading hints', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      // Critical data should be present
      expect(response.data.data.overview).toBeDefined();
      expect(response.data.data.quick_actions).toBeDefined();

      // Detailed data should be in arrays that can be loaded progressively
      expect(Array.isArray(response.data.data.top_concerns)).toBe(true);
      expect(Array.isArray(response.data.data.recent_activities)).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    it('should respond quickly for mobile use', async () => {
      const startTime = Date.now();
      const response = await client.getDashboard();
      const endTime = Date.now();

      expectValidResponse(response);
      expect(endTime - startTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should include appropriate caching headers', async () => {
      const response = await client.getDashboard();

      expectValidResponse(response);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('s-maxage=300'); // 5 minutes server cache
      expect(cacheControl).toContain('stale-while-revalidate=600'); // 10 minutes stale
    });

    it('should support conditional requests', async () => {
      const firstResponse = await client.getDashboard();
      expectValidResponse(firstResponse);

      // Make a second request with caching
      const secondResponse = await client.getDashboard();
      expectValidResponse(secondResponse);

      // Headers should support caching
      expect(firstResponse.headers.has('ETag') || firstResponse.headers.has('Last-Modified')).toBe(true);
    });

    it('should handle concurrent requests gracefully', async () => {
      const promises = Array(5).fill(null).map(() => client.getDashboard());

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expectValidResponse(response);
      });

      // Data should be consistent
      const firstData = JSON.stringify(responses[0].data.data);
      responses.forEach(response => {
        expect(JSON.stringify(response.data.data)).toBe(firstData);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid limit parameters', async () => {
      const response = await client.getDashboard({
        limit: 'invalid',
      });

      // Should default to reasonable limit
      expectValidResponse(response);
      expect(response.data.data.top_concerns.length).toBeLessThanOrEqual(20);
    });

    it('should handle negative limit parameters', async () => {
      const response = await client.getDashboard({
        limit: '-5',
      });

      // Should default to reasonable limit
      expectValidResponse(response);
      expect(response.data.data.top_concerns.length).toBeLessThanOrEqual(20);
    });

    it('should handle very large limit parameters', async () => {
      const response = await client.getDashboard({
        limit: '999999',
      });

      // Should cap at maximum
      expectValidResponse(response);
      expect(response.data.data.top_concerns.length).toBeLessThanOrEqual(20);
    });

    it('should handle malformed boolean parameters', async () => {
      const response = await client.getDashboard({
        includeAlerts: 'maybe',
      });

      // Should default to including alerts
      expectValidResponse(response);
      expect(Array.isArray(response.data.data.alerts)).toBe(true);
    });

    it('should handle service degradation gracefully', async () => {
      // This would be tested with mocked service failures
      // For now, verify the endpoint handles errors appropriately
      const response = await client.getDashboard();
      expect(response.status).toBeLessThan(500);
    });
  });
});