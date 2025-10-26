# Rating Engine Test Suite

This directory contains comprehensive unit and integration tests for the CFMEU Employer Traffic Light Rating System calculation engine.

## Test Structure

### Core Test Files

- **`RatingCalculator.test.ts`** - Main unit tests covering all calculation methods
- **`Integration.test.ts`** - Integration tests verifying component interactions
- **`testUtils.ts`** - Test utilities and mock data factories

### Test Coverage Areas

#### 1. Core Calculation Components
- Track 1 Calculator (Project Compliance Assessments)
- Track 2 Calculator (Organiser Expertise Ratings)
- Combined Calculator (Rating Reconciliation)
- Weighted Scoring Calculator
- Confidence Calculator
- Time Decay Calculator
- Discrepancy Detector
- Validator
- Performance Optimizer

#### 2. Test Scenarios

**Happy Path Tests:**
- All green assessments → Green rating
- Mixed assessments → Reconciliation logic
- High confidence weighting → Confidence-based decisions

**Edge Case Tests:**
- Empty data sets
- Invalid input data
- Calculation errors
- Performance with large datasets

**Integration Tests:**
- Complete calculation workflows
- Component interactions
- Performance optimization
- Error handling across components

## Running Tests

### Prerequisites
```bash
# Install dependencies (if not already done)
npm install --save-dev jest @types/jest ts-jest
```

### Basic Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- RatingCalculator.test.ts

# Run specific test pattern
npm test -- --testNamePattern="Track1Calculator"
```

## Test Data and Utilities

### Mock Data Factories

The `testUtils.ts` file provides helper functions for creating test data:

```typescript
// Create mock calculation context
const context = createMockCalculationContext();

// Create mock project assessments
const assessments = createMockProjectAssessments();

// Create mock rating request
const request = createMockRatingRequest();
```

### Predefined Test Scenarios

```typescript
// All green assessments
TestScenarios.allGreen

// Mixed assessments requiring reconciliation
TestScenarios.mixed

// High vs low confidence weighting
TestScenarios.confidenceTest

// Empty data edge case
TestScenarios.emptyData
```

## Understanding Test Structure

### Unit Test Pattern
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup component instance
  });

  describe('specific method', () => {
    it('should handle expected behavior', async () => {
      // Arrange - prepare test data
      // Act - call method
      // Assert - verify results
    });
  });
});
```

### Integration Test Pattern
```typescript
describe('Workflow Integration', () => {
  it('should complete full calculation workflow', async () => {
    // Arrange - prepare complete request
    // Act - run through all components
    // Assert - verify final result and intermediate steps
  });
});
```

## Test Assertions

### Rating Result Validation
```typescript
// Verify rating calculation results
assertRatingResult(result, 'green', 'high');

// Verify performance metrics
assertPerformanceMetrics(metrics, maxDuration);
```

### Custom Matchers
```typescript
// Test numeric ranges
expect(rating).toBeWithinRange(0, 1);

// Test calculation accuracy
expect(accuracy).toBeGreaterThan(0.95);
```

## Performance Testing

### Large Dataset Tests
```typescript
// Create performance test data
const largeDataset = createPerformanceTestData(1000);

// Measure calculation time
const startTime = Date.now();
const result = await calculator.calculate(largeDataset);
const duration = Date.now() - startTime;

// Verify performance requirements
expect(duration).toBeLessThan(5000); // 5 second max
```

## Mocking Strategies

### Component Mocking
```typescript
// Mock external dependencies
jest.mock('@/integrations/supabase/client', () => ({
  supabase: { /* mock implementation */ }
}));

// Mock calculation results
const mockResult = {
  rating: 0.8,
  confidence: 'high',
  metadata: {}
};
```

## Error Testing

### Validation Error Testing
```typescript
it('should handle invalid data gracefully', async () => {
  const invalidRequest = createMockRatingRequest({
    projectAssessments: [], // Invalid empty data
    organiserAssessments: [],
    ebaData: null
  });

  const result = await validator.validateCalculationRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});
```

### Calculation Error Testing
```typescript
it('should handle calculation errors without crashing', async () => {
  try {
    const result = await calculator.calculate(invalidData);
    // Should either succeed or fail gracefully
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBeDefined();
  }
});
```

## Test Configuration

### Jest Configuration
- **Environment**: Node.js
- **Timeout**: 10 seconds per test
- **Coverage**: 80% minimum threshold
- **Transform**: TypeScript via ts-jest
- **Module Mapping**: `@/` → `src/`

### Coverage Requirements
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Continuous Integration

### Test Commands for CI
```bash
# Run tests with coverage
npm run test:coverage

# Generate coverage report
npm run test:coverage -- --coverageReporters=lcov

# Exit on failure
npm test && npm run test:coverage
```

## Debugging Tests

### Common Issues

1. **Import Errors**: Check Jest module mapping in `jest.config.js`
2. **Type Errors**: Ensure TypeScript compilation passes
3. **Timeout Errors**: Increase timeout in test or optimize test data
4. **Mock Failures**: Verify mock implementations match real APIs

### Debugging Commands
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Run tests without cache
npm test -- --no-cache
```

## Adding New Tests

### When Adding Components
1. Create unit tests in `RatingCalculator.test.ts`
2. Add integration tests in `Integration.test.ts`
3. Update test utilities if needed
4. Verify coverage remains above threshold

### When Adding Features
1. Test happy path scenarios
2. Test edge cases and error conditions
3. Test performance implications
4. Update documentation

## Test Best Practices

1. **Arrange-Act-Assert Pattern**: Structure tests clearly
2. **Descriptive Test Names**: Make test purposes obvious
3. **Isolated Tests**: Tests should not depend on each other
4. **Mock External Dependencies**: Avoid network/database calls
5. **Test Data Variety**: Cover different input combinations
6. **Performance Testing**: Verify efficiency requirements
7. **Error Scenarios**: Test failure modes and recovery

## Future Enhancements

### Planned Test Improvements
- Visual regression tests for rating displays
- Load testing for concurrent calculations
- End-to-end tests with real database
- Performance benchmarking suite
- Automated test data generation

### Testing Tools to Consider
- **Storybook**: Component visual testing
- **Cypress**: End-to-end testing
- **Artillery**: Load testing
- **TestCafe**: Cross-browser testing