#!/usr/bin/env node

/**
 * Rating System API Test Runner
 *
 * This script provides a comprehensive test runner for the rating system APIs.
 * It can run different test suites and generate detailed reports.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  testDir: path.join(__dirname, '../src/__tests__/rating-api'),
  reportsDir: path.join(__dirname, '../test-reports'),
  coverageDir: path.join(__dirname, '../coverage'),
  testSuites: {
    'track1': 'Track 1: Project Compliance Assessments',
    'track2': 'Track 2: Organiser Expertise Ratings',
    'final-ratings': 'Final Ratings API',
    'batch-analytics': 'Batch Operations and Analytics',
    'mobile-dashboard': 'Mobile Dashboard API',
    'integration': 'Integration Tests',
    'all': 'All Test Suites'
  }
};

class ApiTestRunner {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    [TEST_CONFIG.reportsDir, TEST_CONFIG.coverageDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  runTests(testSuite = 'all', options = {}) {
    console.log(`\n🚀 Running Rating System API Tests\n`);
    console.log(`Test Suite: ${TEST_CONFIG.testSuites[testSuite] || testSuite}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const testPattern = this.getTestPattern(testSuite);
    const jestArgs = this.buildJestArgs(testPattern, options);

    try {
      console.log('Executing tests...');
      const testOutput = execSync(`npx jest ${jestArgs.join(' ')}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: process.env.CI || 'false'
        }
      });

      this.generateReport(testSuite, testOutput);

      if (options.coverage) {
        this.processCoverage();
      }

      console.log('\n✅ Tests completed successfully!');
      return true;
    } catch (error) {
      console.error('\n❌ Tests failed!');
      this.generateReport(testSuite, error.stdout || error.message);

      if (options.coverage) {
        this.processCoverage();
      }

      return false;
    }
  }

  getTestPattern(testSuite) {
    if (testSuite === 'all') {
      return `${TEST_CONFIG.testDir}/**/*.test.ts`;
    }

    const testFile = path.join(TEST_CONFIG.testDir, `${testSuite}.test.ts`);
    if (fs.existsSync(testFile)) {
      return testFile;
    }

    throw new Error(`Test suite not found: ${testSuite}`);
  }

  buildJestArgs(testPattern, options) {
    const args = [
      testPattern,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--maxWorkers=4'
    ];

    if (options.coverage) {
      args.push('--coverage');
      args.push(`--coverageDirectory=${TEST_CONFIG.coverageDir}`);
      args.push('--coverageReporters=text,lcov,html,json-summary');
    }

    if (options.watch) {
      args.push('--watch');
    }

    if (options.updateSnapshots) {
      args.push('--updateSnapshots');
    }

    if (options.testNamePattern) {
      args.push(`--testNamePattern="${options.testNamePattern}"`);
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    return args;
  }

  generateReport(testSuite, output) {
    const reportPath = path.join(TEST_CONFIG.reportsDir, `api-test-report-${testSuite}-${Date.now()}.json`);

    const report = {
      testSuite,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      output: output.toString(),
      status: output.includes('FAIL') ? 'failed' : 'passed'
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Test report generated: ${reportPath}`);
  }

  processCoverage() {
    const coverageSummaryPath = path.join(TEST_CONFIG.coverageDir, 'coverage-summary.json');

    if (fs.existsSync(coverageSummaryPath)) {
      const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));

      console.log('\n📈 Coverage Summary:');
      console.log(`Lines: ${coverageSummary.total.lines.pct}%`);
      console.log(`Functions: ${coverageSummary.total.functions.pct}%`);
      console.log(`Branches: ${coverageSummary.total.branches.pct}%`);
      console.log(`Statements: ${coverageSummary.total.statements.pct}%`);

      // Generate coverage report
      const coverageReportPath = path.join(TEST_CONFIG.reportsDir, `coverage-report-${Date.now()}.json`);
      fs.writeFileSync(coverageReportPath, JSON.stringify(coverageSummary, null, 2));
      console.log(`\n📊 Coverage report generated: ${coverageReportPath}`);
    }
  }

  runHealthChecks() {
    console.log('\n🏥 Running API Health Checks...\n');

    const healthChecks = [
      {
        name: 'Track 1 API Health',
        endpoint: '/api/projects/test-project/compliance-assessments',
        method: 'HEAD'
      },
      {
        name: 'Track 2 API Health',
        endpoint: '/api/employers/test-employer/expertise-ratings',
        method: 'HEAD'
      },
      {
        name: 'Final Ratings API Health',
        endpoint: '/api/employers/test-employer/ratings',
        method: 'HEAD'
      },
      {
        name: 'Batch Operations Health',
        endpoint: '/api/ratings/batch',
        method: 'HEAD'
      },
      {
        name: 'Analytics API Health',
        endpoint: '/api/ratings/analytics/trends',
        method: 'HEAD'
      },
      {
        name: 'Mobile Dashboard Health',
        endpoint: '/api/ratings/dashboard',
        method: 'HEAD'
      }
    ];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const results = [];

    healthChecks.forEach(check => {
      try {
        const url = `${baseUrl}${check.endpoint}`;
        const response = execSync(`curl -s -o /dev/null -w "%{http_code}" -X ${check.method} "${url}"`, {
          encoding: 'utf8',
          timeout: 5000
        });

        const status = response.trim();
        const isHealthy = status === '200' || status === '401'; // 401 is expected without auth

        results.push({
          ...check,
          status,
          healthy: isHealthy,
          url
        });

        console.log(`${isHealthy ? '✅' : '❌'} ${check.name}: ${status}`);
      } catch (error) {
        results.push({
          ...check,
          status: 'ERROR',
          healthy: false,
          error: error.message
        });

        console.log(`❌ ${check.name}: ${error.message}`);
      }
    });

    const healthyCount = results.filter(r => r.healthy).length;
    console.log(`\nHealth Check Summary: ${healthyCount}/${results.length} endpoints healthy`);

    // Generate health check report
    const healthReportPath = path.join(TEST_CONFIG.reportsDir, `health-check-${Date.now()}.json`);
    fs.writeFileSync(healthReportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        healthy: healthyCount,
        unhealthy: results.length - healthyCount
      },
      results
    }, null, 2));

    return healthyCount === results.length;
  }

  runPerformanceTests() {
    console.log('\n⚡ Running API Performance Tests...\n');

    const performanceTests = [
      {
        name: 'Mobile Dashboard Load Time',
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ratings/dashboard`,
        expectedMaxTime: 2000 // 2 seconds
      },
      {
        name: 'Analytics Query Time',
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ratings/analytics/trends?period=30d`,
        expectedMaxTime: 3000 // 3 seconds
      }
    ];

    const results = [];

    performanceTests.forEach(test => {
      try {
        const startTime = Date.now();
        const response = execSync(`curl -s -o /dev/null -w "%{http_code}" "${test.url}"`, {
          encoding: 'utf8',
          timeout: 10000
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const passed = responseTime <= test.expectedMaxTime && response.trim() === '200';

        results.push({
          ...test,
          responseTime,
          status: response.trim(),
          passed
        });

        console.log(`${passed ? '✅' : '❌'} ${test.name}: ${responseTime}ms (max: ${test.expectedMaxTime}ms)`);
      } catch (error) {
        results.push({
          ...test,
          responseTime: -1,
          status: 'ERROR',
          passed: false,
          error: error.message
        });

        console.log(`❌ ${test.name}: ${error.message}`);
      }
    });

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\nPerformance Test Summary: ${passedCount}/${results.length} tests passed`);

    return passedCount === results.length;
  }

  validateApiEndpoints() {
    console.log('\n🔍 Validating API Endpoints...\n');

    const expectedEndpoints = [
      // Track 1
      { path: '/api/projects/[projectId]/compliance-assessments', methods: ['GET', 'POST'] },
      { path: '/api/compliance-assessments/[assessmentId]', methods: ['GET', 'PUT', 'DELETE'] },

      // Track 2
      { path: '/api/employers/[employerId]/expertise-ratings', methods: ['GET', 'POST'] },
      { path: '/api/expertise-wizard/config', methods: ['GET'] },
      { path: '/api/expertise-wizard/submit', methods: ['POST'] },

      // Final Ratings
      { path: '/api/employers/[employerId]/ratings', methods: ['GET', 'POST'] },
      { path: '/api/employers/[employerId]/ratings/compare', methods: ['GET'] },
      { path: '/api/employers/[employerId]/ratings/recalculate', methods: ['POST'] },

      // Batch & Analytics
      { path: '/api/ratings/batch', methods: ['POST', 'GET'] },
      { path: '/api/ratings/analytics/trends', methods: ['GET'] },
      { path: '/api/ratings/export', methods: ['POST'] },

      // Mobile Dashboard
      { path: '/api/ratings/dashboard', methods: ['GET', 'HEAD'] }
    ];

    const apiDir = path.join(__dirname, '../src/app/api');
    const validationResults = [];

    expectedEndpoints.forEach(endpoint => {
      const routePath = endpoint.path.replace(/\[.*?\]/g, '[...id]');
      const fullPath = path.join(apiDir, routePath.replace('/api/', ''));
      const routeFile = path.join(fullPath, 'route.ts');

      const exists = fs.existsSync(routeFile);

      validationResults.push({
        ...endpoint,
        routeFile,
        exists,
        relativePath: routePath
      });

      console.log(`${exists ? '✅' : '❌'} ${endpoint.path} (${endpoint.methods.join(', ')})`);
    });

    const existingCount = validationResults.filter(r => r.exists).length;
    console.log(`\nEndpoint Validation Summary: ${existingCount}/${expectedEndpoints.length} endpoints found`);

    // Generate validation report
    const validationReportPath = path.join(TEST_CONFIG.reportsDir, `endpoint-validation-${Date.now()}.json`);
    fs.writeFileSync(validationReportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: expectedEndpoints.length,
        existing: existingCount,
        missing: expectedEndpoints.length - existingCount
      },
      results: validationResults
    }, null, 2));

    return existingCount === expectedEndpoints.length;
  }
}

function printUsage() {
  console.log(`
Rating System API Test Runner

Usage: node scripts/api-test-runner.js [command] [options]

Commands:
  test [suite]        Run API tests
    suites: track1, track2, final-ratings, batch-analytics, mobile-dashboard, integration, all

  health              Run API health checks
  performance         Run API performance tests
  validate            Validate all API endpoints exist
  full                Run complete test suite (tests + health + performance + validation)

Options:
  --coverage          Generate coverage report
  --watch             Run tests in watch mode
  --verbose           Verbose output
  --testNamePattern <pattern>  Run tests matching pattern

Examples:
  node scripts/api-test-runner.js test all --coverage
  node scripts/api-test-runner.js test track1 --verbose
  node scripts/api-test-runner.js health
  node scripts/api-test-runner.js full --coverage
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const optionName = arg.substring(2);
      const optionValue = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[optionName] = optionValue;
      if (optionValue !== true) i++; // Skip next argument if it's a value
    }
  }

  const testRunner = new ApiTestRunner();

  try {
    switch (command) {
      case 'test':
        const testSuite = args[1] || 'all';
        const success = testRunner.runTests(testSuite, options);
        process.exit(success ? 0 : 1);

      case 'health':
        const healthSuccess = testRunner.runHealthChecks();
        process.exit(healthSuccess ? 0 : 1);

      case 'performance':
        const performanceSuccess = testRunner.runPerformanceTests();
        process.exit(performanceSuccess ? 0 : 1);

      case 'validate':
        const validateSuccess = testRunner.validateApiEndpoints();
        process.exit(validateSuccess ? 0 : 1);

      case 'full':
        console.log('🎯 Running Complete Test Suite\n');

        const testSuccess = testRunner.runTests('all', options);
        const healthSuccess2 = testRunner.runHealthChecks();
        const performanceSuccess2 = testRunner.runPerformanceTests();
        const validateSuccess2 = testRunner.validateApiEndpoints();

        const allSuccess = testSuccess && healthSuccess2 && performanceSuccess2 && validateSuccess2;

        console.log(`\n🏁 Complete Test Suite ${allSuccess ? 'PASSED' : 'FAILED'}`);
        process.exit(allSuccess ? 0 : 1);

      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ApiTestRunner };