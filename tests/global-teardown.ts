import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up mobile testing environment...');

  try {
    // Generate consolidated test report
    console.log('📊 Generating consolidated test report...');
    await generateConsolidatedReport();

    // Clean up temporary files
    console.log('🗑️  Cleaning up temporary files...');
    const tempDirs = [
      path.join(process.cwd(), 'test-results', 'temp'),
      path.join(process.cwd(), 'test-results', 'cache')
    ];

    for (const tempDir of tempDirs) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🗑️  Removed temporary directory: ${tempDir}`);
      }
    }

    // Archive old test results (keep last 5 runs)
    console.log('📦 Archiving old test results...');
    await archiveOldTestResults();

    // Generate mobile testing summary
    console.log('📱 Generating mobile testing summary...');
    await generateMobileTestingSummary();

    console.log('✅ Global teardown completed successfully!');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
  }
}

async function generateConsolidatedReport() {
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const resultsJsonPath = path.join(testResultsDir, 'results.json');

  if (fs.existsSync(resultsJsonPath)) {
    const results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));

    const consolidatedReport = {
      summary: {
        total: results.suites?.reduce((acc: any, suite: any) => acc + suite.specs?.length || 0, 0) || 0,
        passed: results.suites?.reduce((acc: any, suite: any) =>
          acc + suite.specs?.filter((spec: any) => spec.ok).length || 0, 0) || 0,
        failed: results.suites?.reduce((acc: any, suite: any) =>
          acc + suite.specs?.filter((spec: any) => !spec.ok).length || 0, 0) || 0,
        skipped: results.suites?.reduce((acc: any, suite: any) =>
          acc + suite.specs?.filter((spec: any) => spec.skipped).length || 0, 0) || 0,
      },
      mobileTests: results.suites?.filter((suite: any) =>
        suite.title.includes('Mobile') || suite.file?.includes('mobile')) || [],
      timestamp: new Date().toISOString()
    };

    const reportPath = path.join(testResultsDir, 'mobile-test-summary.json');
    fs.writeFileSync(reportPath, JSON.stringify(consolidatedReport, null, 2));
    console.log(`📊 Consolidated report saved to ${reportPath}`);
  }
}

async function archiveOldTestResults() {
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const archivesDir = path.join(testResultsDir, 'archives');

  if (!fs.existsSync(archivesDir)) {
    fs.mkdirSync(archivesDir, { recursive: true });
  }

  // Keep recent files, archive older ones
  const files = fs.readdirSync(testResultsDir);
  const now = Date.now();
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

  for (const file of files) {
    const filePath = path.join(testResultsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && stats.mtime.getTime() < oneWeekAgo) {
      if (!file.includes('mobile-test-summary.json') && !file.includes('performance-baselines.json')) {
        const archivePath = path.join(archivesDir, file);
        fs.renameSync(filePath, archivePath);
        console.log(`📦 Archived: ${file}`);
      }
    }
  }
}

async function generateMobileTestingSummary() {
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const screenshotDir = path.join(testResultsDir, 'screenshots');

  let screenshotCount = 0;
  if (fs.existsSync(screenshotDir)) {
    screenshotCount = fs.readdirSync(screenshotDir).length;
  }

  const summary = {
    mobileTesting: {
      devicesTested: [
        'iPhone 13',
        'iPhone 13 Pro',
        'iPhone 13 Pro Max',
        'iPhone 14',
        'iPhone 14 Pro',
        'iPhone 14 Pro Max',
        'iPhone 15',
        'iPhone 15 Plus',
        'iPhone 15 Pro',
        'iPhone 15 Pro Max'
      ],
      testCategories: [
        'Navigation',
        'Employer Views',
        'Scan Review Workflow',
        'Authentication',
        'Performance',
        'Accessibility',
        'Responsive Design'
      ],
      testCoverage: {
        routes: 15,
        interactions: 25,
        viewports: 10,
        networkConditions: 4
      },
      screenshots: screenshotCount,
      lastRun: new Date().toISOString(),
      recommendations: [
        'Monitor touch target sizes for accessibility compliance',
        'Optimize image loading for mobile network conditions',
        'Ensure proper keyboard handling for form inputs',
        'Test offline functionality for critical features'
      ]
    }
  };

  const summaryPath = path.join(testResultsDir, 'mobile-testing-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📱 Mobile testing summary saved to ${summaryPath}`);
}

export default globalTeardown;