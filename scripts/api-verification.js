#!/usr/bin/env node

/**
 * Rating System API Endpoint Verification Script
 *
 * This script verifies that all API endpoints are properly implemented,
 * follows the expected patterns, and includes required functionality.
 */

const fs = require('fs');
const path = require('path');

const VERIFICATION_CONFIG = {
  apiDir: path.join(__dirname, '../src/app/api'),
  requiredFiles: [
    'route.ts'
  ],
  requiredExports: [
    'GET', 'POST', 'PUT', 'DELETE', 'HEAD'
  ],
  requiredPatterns: {
    authentication: true,
    authorization: true,
    errorHandling: true,
    validation: true,
    rateLimiting: true,
    typescriptTypes: true
  }
};

class ApiVerifier {
  constructor() {
    this.verificationResults = {
      endpoints: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      issues: []
    };
  }

  async verifyAll() {
    console.log('🔍 Starting API Endpoint Verification\n');

    await this.scanApiEndpoints();
    await this.verifyEndpointImplementations();
    await this.verifyTypescriptTypes();
    await this.verifySecurityPatterns();
    await this.verifyErrorHandling();
    await this.verifyMobileOptimizations();

    this.generateReport();
    return this.verificationResults.summary.failed === 0;
  }

  async scanApiEndpoints() {
    console.log('📁 Scanning API endpoints...');

    const apiStructure = this.getDirectoryStructure(VERIFICATION_CONFIG.apiDir);
    const endpoints = this.extractEndpointsFromStructure(apiStructure);

    this.verificationResults.endpoints = endpoints;
    this.verificationResults.summary.total = endpoints.length;

    console.log(`Found ${endpoints.length} API endpoints\n`);
  }

  getDirectoryStructure(dirPath, relativePath = '') {
    const structure = {
      path: relativePath || 'api',
      type: 'directory',
      children: []
    };

    if (!fs.existsSync(dirPath)) {
      return structure;
    }

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemRelativePath = path.join(relativePath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        const childStructure = this.getDirectoryStructure(itemPath, itemRelativePath);
        structure.children.push(childStructure);
      } else {
        structure.children.push({
          path: itemRelativePath,
          type: 'file',
          size: stat.size
        });
      }
    }

    return structure;
  }

  extractEndpointsFromStructure(structure, basePath = '') {
    const endpoints = [];

    if (structure.children) {
      for (const child of structure.children) {
        if (child.type === 'directory') {
          endpoints.push(...this.extractEndpointsFromStructure(child, path.join(basePath, child.path)));
        } else if (child.path === 'route.ts') {
          const endpointPath = this.normalizeEndpointPath(basePath);
          const endpointInfo = {
            path: endpointPath,
            fullPath: path.join(VERIFICATION_CONFIG.apiDir, basePath, 'route.ts'),
            methods: [],
            features: {},
            issues: []
          };

          endpoints.push(endpointInfo);
        }
      }
    }

    return endpoints;
  }

  normalizeEndpointPath(dirPath) {
    if (!dirPath) return '/api';

    // Convert directory structure to endpoint pattern
    const parts = dirPath.split(path.sep);
    const normalizedParts = parts.map(part => {
      // Check if it's a dynamic segment (contains brackets or is numeric)
      if (part.includes('[') && part.includes(']')) {
        return part;
      }
      return part;
    });

    return '/api/' + normalizedParts.join('/');
  }

  async verifyEndpointImplementations() {
    console.log('🔧 Verifying endpoint implementations...');

    for (const endpoint of this.verificationResults.endpoints) {
      try {
        const content = fs.readFileSync(endpoint.fullPath, 'utf8');
        await this.analyzeEndpointFile(endpoint, content);
      } catch (error) {
        endpoint.issues.push({
          type: 'error',
          message: `Failed to read endpoint file: ${error.message}`
        });
      }
    }

    console.log(`Verified ${this.verificationResults.endpoints.length} endpoint implementations\n`);
  }

  async analyzeEndpointFile(endpoint, content) {
    // Check for required HTTP methods
    const methodPattern = /export\s+(?:const\s+)?(\w+)\s*=\s*(?:withRateLimit\([^)]*\,\s*[^)]*\)|[^;]+)/g;
    const methods = [];
    let match;

    while ((match = methodPattern.exec(content)) !== null) {
      methods.push(match[1]);
    }

    endpoint.methods = methods;

    // Check for authentication
    endpoint.features.authentication = this.checkForPattern(content, [
      /getUser\(\)/,
      /auth\.getUser/,
      /createServerSupabase/,
      /authorization/i
    ]);

    // Check for authorization
    endpoint.features.authorization = this.checkForPattern(content, [
      /role/i,
      /ALLOWED_ROLES/,
      /authorization/i,
      /forbidden/i
    ]);

    // Check for error handling
    endpoint.features.errorHandling = this.checkForPattern(content, [
      /try\s*{/,
      /catch\s*\(/,
      /console\.error/,
      /NextResponse\.json.*error/i
    ]);

    // Check for validation
    endpoint.features.validation = this.checkForPattern(content, [
      /zod/i,
      /validate/i,
      /schema/i,
      /validation/i
    ]);

    // Check for rate limiting
    endpoint.features.rateLimiting = this.checkForPattern(content, [
      /withRateLimit/,
      /RATE_LIMIT/,
      /rateLimit/i
    ]);

    // Check for TypeScript types
    endpoint.features.typescriptTypes = this.checkForPattern(content, [
      /interface\s+\w+/,
      /type\s+\w+/,
      /:.*=>/,
      /as\s+\w+/
    ]);

    // Check for mobile optimization
    endpoint.features.mobileOptimization = this.checkForPattern(content, [
      /mobile/i,
      /cache/i,
      /X-Mobile/i,
      /Cache-Control/
    ]);

    // Check for proper response patterns
    endpoint.features.properResponses = this.checkForPattern(content, [
      /NextResponse\.json/,
      /status:\s*\d+/,
      /headers:/
    ]);

    // Check for database operations
    endpoint.features.databaseOperations = this.checkForPattern(content, [
      /supabase\./,
      /\.from\(/,
      /\.select\(/,
      /\.insert\(/,
      /\.update\(/,
      /\.delete\(/
    ]);

    // Specific checks for different endpoint types
    this.verifyEndpointSpecificPatterns(endpoint, content);
  }

  verifyEndpointSpecificPatterns(endpoint, content) {
    // Track 1: Project Compliance Assessments
    if (endpoint.path.includes('projects') && endpoint.path.includes('compliance-assessments')) {
      if (endpoint.methods.includes('POST')) {
        const hasRequiredFields = this.checkForPattern(content, [
          /employer_id/,
          /project_id/,
          /assessment_type/,
          /score/,
          /rating/
        ]);
        if (!hasRequiredFields) {
          endpoint.issues.push({
            type: 'warning',
            message: 'POST compliance assessment may be missing required field validation'
          });
        }
      }
    }

    // Track 2: Organiser Expertise Ratings
    if (endpoint.path.includes('employers') && endpoint.path.includes('expertise-ratings')) {
      if (endpoint.methods.includes('POST')) {
        const hasRequiredFields = this.checkForPattern(content, [
          /overall_score/,
          /overall_rating/,
          /confidence_level/
        ]);
        if (!hasRequiredFields) {
          endpoint.issues.push({
            type: 'warning',
            message: 'POST expertise rating may be missing required field validation'
          });
        }
      }
    }

    // Wizard endpoints
    if (endpoint.path.includes('expertise-wizard')) {
      if (endpoint.path.includes('config') && !endpoint.methods.includes('GET')) {
        endpoint.issues.push({
          type: 'error',
          message: 'Wizard config endpoint should support GET method'
        });
      }
      if (endpoint.path.includes('submit') && !endpoint.methods.includes('POST')) {
        endpoint.issues.push({
          type: 'error',
          message: 'Wizard submit endpoint should support POST method'
        });
      }
    }

    // Final Ratings endpoints
    if (endpoint.path.includes('employers') && endpoint.path.includes('ratings')) {
      if (!endpoint.path.includes('compare') && !endpoint.path.includes('recalculate')) {
        // Main ratings endpoint
        if (!endpoint.methods.includes('GET') || !endpoint.methods.includes('POST')) {
          endpoint.issues.push({
            type: 'warning',
            message: 'Final ratings endpoint should support both GET and POST methods'
          });
        }
      }
    }

    // Batch operations
    if (endpoint.path.includes('ratings') && endpoint.path.includes('batch')) {
      if (!endpoint.methods.includes('POST')) {
        endpoint.issues.push({
          type: 'error',
          message: 'Batch operations endpoint should support POST method'
        });
      }
    }

    // Analytics endpoints
    if (endpoint.path.includes('analytics') || endpoint.path.includes('trends')) {
      if (!endpoint.methods.includes('GET')) {
        endpoint.issues.push({
          type: 'error',
          message: 'Analytics endpoints should support GET method'
        });
      }
    }

    // Mobile dashboard
    if (endpoint.path.includes('dashboard')) {
      if (!endpoint.methods.includes('GET')) {
        endpoint.issues.push({
          type: 'error',
          message: 'Dashboard endpoint should support GET method'
        });
      }

      // Check for mobile optimization
      if (!endpoint.features.mobileOptimization) {
        endpoint.issues.push({
          type: 'warning',
          message: 'Dashboard endpoint should include mobile optimizations'
        });
      }
    }
  }

  checkForPattern(content, patterns) {
    return patterns.some(pattern => pattern.test(content));
  }

  async verifyTypescriptTypes() {
    console.log('📝 Verifying TypeScript types...');

    const typesFile = path.join(__dirname, '../src/types/rating-api.ts');

    if (fs.existsSync(typesFile)) {
      const typesContent = fs.readFileSync(typesFile, 'utf8');

      const requiredTypes = [
        'Track1AssessmentRequest',
        'Track2AssessmentRequest',
        'FinalRatingRequest',
        'BatchOperationRequest',
        'DashboardResponse'
      ];

      const foundTypes = [];
      const missingTypes = [];

      requiredTypes.forEach(type => {
        if (typesContent.includes(`export interface ${type}`) ||
            typesContent.includes(`export type ${type}`)) {
          foundTypes.push(type);
        } else {
          missingTypes.push(type);
        }
      });

      if (missingTypes.length > 0) {
        this.verificationResults.issues.push({
          type: 'error',
          message: `Missing TypeScript types: ${missingTypes.join(', ')}`
        });
      }

      console.log(`Found ${foundTypes.length}/${requiredTypes.length} required TypeScript types`);
    } else {
      this.verificationResults.issues.push({
        type: 'error',
        message: 'TypeScript types file not found: src/types/rating-api.ts'
      });
    }

    console.log();
  }

  async verifySecurityPatterns() {
    console.log('🔒 Verifying security patterns...');

    let authCount = 0;
    let authzCount = 0;
    let validationCount = 0;

    for (const endpoint of this.verificationResults.endpoints) {
      if (endpoint.features.authentication) authCount++;
      if (endpoint.features.authorization) authzCount++;
      if (endpoint.features.validation) validationCount++;
    }

    const totalEndpoints = this.verificationResults.endpoints.length;

    if (authCount < totalEndpoints) {
      this.verificationResults.issues.push({
        type: 'warning',
        message: `${totalEndpoints - authCount} endpoints may be missing authentication`
      });
    }

    if (authzCount < totalEndpoints) {
      this.verificationResults.issues.push({
        type: 'warning',
        message: `${totalEndpoints - authzCount} endpoints may be missing authorization`
      });
    }

    if (validationCount < totalEndpoints * 0.8) { // Allow 20% to not need validation (e.g., GET endpoints)
      this.verificationResults.issues.push({
        type: 'warning',
        message: `${totalEndpoints - validationCount} endpoints may be missing input validation`
      });
    }

    console.log(`Security verification: ${authCount}/${totalEndpoints} authenticated, ${authzCount}/${totalEndpoints} authorized, ${validationCount}/${totalEndpoints} validated\n`);
  }

  async verifyErrorHandling() {
    console.log('⚠️  Verifying error handling...');

    let errorHandlingCount = 0;

    for (const endpoint of this.verificationResults.endpoints) {
      if (endpoint.features.errorHandling) {
        errorHandlingCount++;
      } else {
        endpoint.issues.push({
          type: 'warning',
          message: 'Endpoint may be missing proper error handling'
        });
      }
    }

    const totalEndpoints = this.verificationResults.endpoints.length;

    if (errorHandlingCount < totalEndpoints * 0.9) { // 90% should have error handling
      this.verificationResults.issues.push({
        type: 'warning',
        message: `${totalEndpoints - errorHandlingCount} endpoints may be missing error handling`
      });
    }

    console.log(`Error handling verification: ${errorHandlingCount}/${totalEndpoints} endpoints have error handling\n`);
  }

  async verifyMobileOptimizations() {
    console.log('📱 Verifying mobile optimizations...');

    const mobileEndpoints = this.verificationResults.endpoints.filter(endpoint =>
      endpoint.path.includes('dashboard') ||
      endpoint.path.includes('analytics') ||
      endpoint.path.includes('trends')
    );

    let optimizedCount = 0;

    for (const endpoint of mobileEndpoints) {
      if (endpoint.features.mobileOptimization) {
        optimizedCount++;
      } else {
        endpoint.issues.push({
          type: 'info',
          message: 'Endpoint could benefit from mobile optimizations'
        });
      }
    }

    console.log(`Mobile optimization: ${optimizedCount}/${mobileEndpoints.length} mobile endpoints optimized\n`);
  }

  generateReport() {
    console.log('📊 Verification Report\n');

    // Update summary
    this.verificationResults.summary.passed = this.verificationResults.endpoints.filter(e =>
      e.issues.filter(i => i.type === 'error').length === 0
    ).length;

    this.verificationResults.summary.failed = this.verificationResults.endpoints.filter(e =>
      e.issues.filter(i => i.type === 'error').length > 0
    ).length;

    this.verificationResults.summary.warnings = this.verificationResults.endpoints.reduce((sum, e) =>
      sum + e.issues.filter(i => i.type === 'warning').length, 0
    );

    // Print summary
    console.log(`Total endpoints: ${this.verificationResults.summary.total}`);
    console.log(`Passed: ${this.verificationResults.summary.passed}`);
    console.log(`Failed: ${this.verificationResults.summary.failed}`);
    console.log(`Warnings: ${this.verificationResults.summary.warnings}`);
    console.log(`Total issues: ${this.verificationResults.issues.length}\n`);

    // Print endpoint details
    console.log('🔍 Endpoint Details:\n');

    for (const endpoint of this.verificationResults.endpoints) {
      const status = endpoint.issues.filter(i => i.type === 'error').length === 0 ? '✅' : '❌';
      const methods = endpoint.methods.length > 0 ? endpoint.methods.join(', ') : 'No methods';

      console.log(`${status} ${endpoint.path} [${methods}]`);

      if (endpoint.issues.length > 0) {
        endpoint.issues.forEach(issue => {
          const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} ${issue.message}`);
        });
      }
    }

    // Print global issues
    if (this.verificationResults.issues.length > 0) {
      console.log('\n🌍 Global Issues:\n');
      this.verificationResults.issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${issue.message}`);
      });
    }

    // Save detailed report
    const reportPath = path.join(__dirname, '../test-reports', `api-verification-${Date.now()}.json`);
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(this.verificationResults, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

function printUsage() {
  console.log(`
API Endpoint Verification Script

Usage: node scripts/api-verification.js [options]

Options:
  --help, -h          Show this help message

Examples:
  node scripts/api-verification.js
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  try {
    const verifier = new ApiVerifier();
    const success = await verifier.verifyAll();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ApiVerifier };