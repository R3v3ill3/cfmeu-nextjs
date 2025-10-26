# Rating System API Testing Guide

This guide provides comprehensive instructions for testing the CFMEU Employer Traffic Light Rating System API endpoints.

## Overview

The rating system API includes the following components:

- **Track 1**: Project Compliance Assessments
- **Track 2**: Organiser Expertise Ratings
- **Final Ratings**: Combined scoring system
- **Batch Operations**: Bulk processing capabilities
- **Analytics**: Trends and insights
- **Mobile Dashboard**: Optimized for field use

## Testing Setup

### Prerequisites

1. **Node.js 18+** installed
2. **Jest** testing framework (included in dev dependencies)
3. **Supabase** local setup or connection to staging/production
4. **Environment variables** configured for testing

### Environment Configuration

Create a `.env.test` file or ensure the following environment variables are set:

```bash
NODE_ENV=test
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Test Suites

### 1. Track 1: Project Compliance Assessments

**File**: `src/__tests__/rating-api/track1-compliance.test.ts`

**Tests covered**:
- Creating compliance assessments (ECA, CBUS, Safety Incidents)
- Validating assessment scores and ratings
- Retrieving assessments with pagination and filtering
- Updating and soft-deleting assessments
- Authentication and authorization

**Key test scenarios**:
```typescript
// Create a compliance assessment
const assessmentData = createMockComplianceAssessment({
  employer_id: testEmployer.id,
  project_id: testProject.id,
  assessment_type: 'eca_status',
  score: 25,
  rating: 'green',
  confidence_level: 'high'
});

const response = await client.createComplianceAssessment(testProject.id, assessmentData);
expectValidResponse(response, 201);
```

### 2. Track 2: Organiser Expertise Ratings

**File**: `src/__tests__/rating-api/track2-expertise.test.ts`

**Tests covered**:
- Creating expertise assessments
- Wizard-based assessments
- Retrieving expertise ratings with filtering
- Validation of confidence levels and relationship quality

**Key test scenarios**:
```typescript
// Create expertise assessment
const expertiseData = createMockExpertiseAssessment({
  overall_score: 75,
  overall_rating: 'green',
  confidence_level: 'high',
  eba_status_known: true,
  industry_reputation: 'Generally positive'
});

const response = await client.createExpertiseAssessment(testEmployer.id, expertiseData);
expectValidResponse(response, 201);
```

### 3. Final Ratings API

**File**: `src/__tests__/rating-api/final-ratings.test.ts`

**Tests covered**:
- Calculating final combined ratings
- Comparing project vs expertise ratings
- Force recalculating with admin privileges
- Rating history and trends

**Key test scenarios**:
```typescript
// Calculate final rating
const ratingRequest: FinalRatingRequest = {
  calculation_date: '2025-01-26',
  project_weight: 0.6,
  expertise_weight: 0.4,
  eba_weight: 0.15,
  calculation_method: 'hybrid_method',
  force_recalculate: false
};

const response = await client.calculateFinalRating(testEmployer.id, ratingRequest);
expectValidResponse(response, 201);
```

### 4. Batch Operations and Analytics

**File**: `src/__tests__/rating-api/batch-analytics.test.ts`

**Tests covered**:
- Batch calculate/recalculate/expire/archive operations
- Analytics trends and insights
- Data export functionality
- Rate limiting behavior

**Key test scenarios**:
```typescript
// Batch operation
const batchRequest: BatchOperationRequest = {
  operations: [{
    operation_type: 'calculate',
    employer_ids: testEmployers.map(e => e.id),
    parameters: {
      calculation_date: '2025-01-26',
      project_weight: 0.6,
      expertise_weight: 0.4
    }
  }],
  dry_run: false
};

const response = await client.executeBatchOperation(batchRequest);
expectValidResponse(response, 201);
```

### 5. Mobile Dashboard API

**File**: `src/__tests__/rating-api/mobile-dashboard.test.ts`

**Tests covered**:
- Mobile-optimized dashboard data
- Caching headers and performance
- Progressive loading patterns
- Role-based data filtering

**Key test scenarios**:
```typescript
// Mobile dashboard request
const response = await client.getDashboard({
  limit: '10',
  includeAlerts: 'true'
});

expectValidResponse(response);
expect(response.headers.get('X-Mobile-Optimized')).toBe('true');
expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
```

### 6. Integration Tests

**File**: `src/__tests__/rating-api/integration.test.ts`

**Tests covered**:
- End-to-end workflows
- Multi-employer operations
- Data consistency validation
- Performance under load
- Error recovery scenarios

## Running Tests

### Using the Test Runner

The project includes a comprehensive test runner script:

```bash
# Run all tests
node scripts/api-test-runner.js test all

# Run specific test suite
node scripts/api-test-runner.js test track1
node scripts/api-test-runner.js test track2
node scripts/api-test-runner.js test final-ratings
node scripts/api-test-runner.js test integration

# Run with coverage
node scripts/api-test-runner.js test all --coverage

# Run in watch mode
node scripts/api-test-runner.js test track1 --watch

# Run specific test pattern
node scripts/api-test-runner.js test all --testNamePattern "should create"
```

### Direct Jest Commands

```bash
# Run all tests
npx jest src/__tests__/rating-api/

# Run specific test file
npx jest src/__tests__/rating-api/track1-compliance.test.ts

# Run with coverage
npx jest src/__tests__/rating-api/ --coverage

# Run in watch mode
npx jest src/__tests__/rating-api/ --watch
```

## Health Checks and Verification

### API Health Checks

```bash
# Run health checks on all endpoints
node scripts/api-test-runner.js health

# Check specific endpoint
curl -I http://localhost:3000/api/ratings/dashboard
```

### Endpoint Verification

```bash
# Verify all endpoints exist and follow patterns
node scripts/api-verification.js

# Check specific patterns
node scripts/api-verification.js | grep -E "(✅|❌)"
```

### Performance Tests

```bash
# Run performance benchmarks
node scripts/api-test-runner.js performance
```

## Test Utilities

### TestApiClient

The `TestApiClient` class provides a clean interface for testing API endpoints:

```typescript
import { TestApiClient } from './test-utils';

const client = new TestApiClient();
client.setAuthToken(authToken);

// Track 1 operations
await client.createComplianceAssessment(projectId, data);
await client.getComplianceAssessments(projectId, params);

// Track 2 operations
await client.createExpertiseAssessment(employerId, data);
await client.getWizardConfig();

// Final ratings
await client.calculateFinalRating(employerId, data);
await client.compareRatings(employerId);

// Batch operations
await client.executeBatchOperation(batchData);
await client.getBatchStatus(batchId);

// Analytics
await client.getRatingTrends(params);
await client.exportData(exportData);

// Mobile dashboard
await client.getDashboard(params);
```

### Mock Data Factories

Utility functions for creating test data:

```typescript
// Create mock employer
const employer = createMockEmployer({
  name: 'Test Company',
  abn: '12345678901'
});

// Create mock compliance assessment
const assessment = createMockComplianceAssessment({
  score: 75,
  rating: 'green',
  confidence_level: 'high'
});

// Create mock expertise assessment
const expertise = createMockExpertiseAssessment({
  overall_score: 80,
  overall_rating: 'green',
  eba_status_known: true
});
```

### Response Validators

Helper functions for validating API responses:

```typescript
// Validate successful response
expectValidResponse(response, 201);

// Validate error response
expectErrorResponse(response, 400);

// Validate paginated response
expectPaginatedResponse(response);
```

## Coverage Reports

### Generating Coverage

```bash
# Run tests with coverage
node scripts/api-test-runner.js test all --coverage

# Or directly with Jest
npx jest src/__tests__/rating-api/ --coverage
```

### Coverage Reports Location

- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Summary**: `coverage/coverage-summary.json`
- **LCOV Format**: `coverage/lcov.info`

### Coverage Targets

Aim for:
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: API Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run API tests
      run: node scripts/api-test-runner.js test all --coverage

    - name: Run health checks
      run: node scripts/api-test-runner.js health

    - name: Verify endpoints
      run: node scripts/api-verification.js

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Test Data Management

### Test Database Setup

1. **Isolated Test Database**: Use a separate Supabase project or schema for testing
2. **Data Seeding**: Automatically create test data before tests run
3. **Cleanup**: Remove test data after tests complete
4. **Idempotent Operations**: Tests should be runnable multiple times

### Mock Data Strategies

```typescript
// Use factories for consistent test data
const testEmployer = await testEnv.createTestEmployer({
  name: 'Integration Test Employer',
  abn: '12345678901'
});

// Clean up automatically
await testEnv.teardown();
```

## Debugging Tests

### Common Issues

1. **Authentication Failures**: Ensure test user has proper permissions
2. **Database Connection**: Verify Supabase credentials and connectivity
3. **Timeout Issues**: Increase timeout for slow operations
4. **Race Conditions**: Use proper async/await patterns

### Debugging Techniques

```bash
# Run with verbose output
node scripts/api-test-runner.js test track1 --verbose

# Run specific test
npx jest --testNamePattern="should create compliance assessment"

# Debug with Node inspector
node --inspect-brk scripts/api-test-runner.js test track1
```

### Test Logs

- **Test Reports**: `test-reports/api-test-report-*.json`
- **Health Checks**: `test-reports/health-check-*.json`
- **Endpoint Validation**: `test-reports/endpoint-validation-*.json`

## Best Practices

### Test Structure

1. **Arrange-Act-Assert Pattern**: Clear test structure
2. **Descriptive Test Names**: Explain what the test validates
3. **Isolated Tests**: Tests should not depend on each other
4. **Reusable Utilities**: Share common test logic

### Data Management

1. **Minimal Test Data**: Create only necessary data
2. **Consistent Naming**: Use predictable test data names
3. **Cleanup**: Remove created data after tests
4. **Realistic Data**: Use realistic test scenarios

### Performance Testing

1. **Response Time Validation**: Ensure APIs respond quickly
2. **Load Testing**: Test with multiple concurrent requests
3. **Mobile Optimization**: Verify mobile-specific optimizations
4. **Caching**: Validate caching behavior

### Security Testing

1. **Authentication**: Verify all endpoints require authentication
2. **Authorization**: Test role-based access control
3. **Input Validation**: Ensure proper validation of all inputs
4. **Error Handling**: Verify no sensitive data leaks in errors

## Troubleshooting

### Common Test Failures

1. **401 Unauthorized**: Check authentication setup
2. **404 Not Found**: Verify endpoint paths
3. **400 Bad Request**: Check request validation
4. **500 Internal Error**: Check server logs

### Performance Issues

1. **Slow Tests**: Check database queries and network calls
2. **Memory Leaks**: Ensure proper cleanup
3. **Timeouts**: Increase timeout values for slow operations

### Environment Issues

1. **Missing Environment Variables**: Verify `.env.test` setup
2. **Database Connectivity**: Check Supabase connection
3. **Port Conflicts**: Ensure test ports are available

## Contributing

When adding new tests:

1. **Follow Existing Patterns**: Use established test utilities and patterns
2. **Add to Test Runner**: Include new test suites in the test runner
3. **Update Documentation**: Keep this guide current
4. **Maintain Coverage**: Ensure coverage targets are met

### Adding New Endpoint Tests

1. Create test file in `src/__tests__/rating-api/`
2. Follow naming convention: `feature-name.test.ts`
3. Use `TestApiClient` for API calls
4. Include authentication, validation, and error handling tests
5. Update test runner to include new suite

## Conclusion

This comprehensive testing setup ensures the rating system API is:

- **Reliable**: Comprehensive test coverage
- **Performant**: Performance benchmarks included
- **Secure**: Authentication and authorization validated
- **Mobile-Optimized**: Mobile-specific features tested
- **Maintainable**: Clear test structure and documentation

Regular execution of these tests ensures the API continues to meet quality standards as the system evolves.