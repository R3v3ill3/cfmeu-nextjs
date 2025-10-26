import { TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

export interface MobileTestIssue {
  type: 'touch-target' | 'viewport-overflow' | 'accessibility' | 'performance' | 'functionality';
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  element?: string;
  device?: string;
  screenshot?: string;
  recommendation?: string;
}

export interface MobileTestReport {
  device: string;
  testSuite: string;
  timestamp: string;
  duration: number;
  passed: number;
  failed: number;
  issues: MobileTestIssue[];
  screenshots: string[];
  performance: {
    loadTime?: number;
    firstContentfulPaint?: number;
    interactionTime?: number;
  };
  accessibility: {
    issues: string[];
    colorContrastIssues: number;
    focusOrderIssues: number;
  };
}

/**
 * Mobile testing reporting helper for CFMEU Next.js application
 */
export class ReportingHelpers {
  private reports: MobileTestReport[] = [];
  private currentTestSuite: string = '';
  private currentDevice: string = '';
  private testStartTime: number = 0;

  /**
   * Initialize a new test suite
   */
  startTestSuite(suiteName: string, device: string): void {
    this.currentTestSuite = suiteName;
    this.currentDevice = device;
    this.testStartTime = Date.now();

    console.log(`📱 Starting mobile test suite: ${suiteName} on ${device}`);
  }

  /**
   * Add an issue to the current test report
   */
  addIssue(issue: Omit<MobileTestIssue, 'device'>): void {
    const fullIssue: MobileTestIssue = {
      ...issue,
      device: this.currentDevice
    };

    const currentReport = this.getCurrentReport();
    if (currentReport) {
      currentReport.issues.push(fullIssue);
      this.logIssue(fullIssue);
    }
  }

  /**
   * Add performance metrics to the current test report
   */
  addPerformanceMetrics(metrics: MobileTestReport['performance']): void {
    const currentReport = this.getCurrentReport();
    if (currentReport) {
      currentReport.performance = { ...currentReport.performance, ...metrics };
    }
  }

  /**
   * Add accessibility results to the current test report
   */
  addAccessibilityResults(results: MobileTestReport['accessibility']): void {
    const currentReport = this.getCurrentReport();
    if (currentReport) {
      currentReport.accessibility = { ...currentReport.accessibility, ...results };
    }
  }

  /**
   * Add screenshot path to current test report
   */
  addScreenshot(screenshotPath: string): void {
    const currentReport = this.getCurrentReport();
    if (currentReport) {
      currentReport.screenshots.push(screenshotPath);
    }
  }

  /**
   * Complete the current test suite and generate report
   */
  completeTestSuite(passed: number, failed: number): void {
    const duration = Date.now() - this.testStartTime;

    const report: MobileTestReport = {
      device: this.currentDevice,
      testSuite: this.currentTestSuite,
      timestamp: new Date().toISOString(),
      duration,
      passed,
      failed,
      issues: [],
      screenshots: [],
      performance: {},
      accessibility: {
        issues: [],
        colorContrastIssues: 0,
        focusOrderIssues: 0
      }
    };

    this.reports.push(report);
    console.log(`✅ Completed test suite: ${this.currentTestSuite} (${duration}ms)`);
  }

  /**
   * Generate comprehensive mobile testing report
   */
  generateReport(): void {
    const reportDir = path.join(process.cwd(), 'test-results', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate JSON report
    const jsonReport = {
      summary: this.generateSummary(),
      reports: this.reports,
      recommendations: this.generateRecommendations(),
      generatedAt: new Date().toISOString()
    };

    const jsonPath = path.join(reportDir, 'mobile-test-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(jsonReport);
    const htmlPath = path.join(reportDir, 'mobile-test-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    // Generate CSV for easy analysis
    const csvReport = this.generateCsvReport();
    const csvPath = path.join(reportDir, 'mobile-test-report.csv');
    fs.writeFileSync(csvPath, csvReport);

    console.log(`📊 Mobile test reports generated:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
    console.log(`   CSV: ${csvPath}`);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary() {
    const totalTests = this.reports.reduce((acc, report) => acc + report.passed + report.failed, 0);
    const totalPassed = this.reports.reduce((acc, report) => acc + report.passed, 0);
    const totalFailed = this.reports.reduce((acc, report) => acc + report.failed, 0);
    const totalIssues = this.reports.reduce((acc, report) => acc + report.issues.length, 0);

    const issuesByType = this.reports.flatMap(report => report.issues)
      .reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const issuesBySeverity = this.reports.flatMap(report => report.issues)
      .reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalTests,
      totalPassed,
      totalFailed,
      successRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) + '%' : '0%',
      totalIssues,
      issuesByType,
      issuesBySeverity,
      devicesTested: [...new Set(this.reports.map(report => report.device))],
      testSuites: [...new Set(this.reports.map(report => report.testSuite))]
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const issues = this.reports.flatMap(report => report.issues);
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === 'touch-target')) {
      recommendations.push('Increase touch target sizes to meet 44x44px minimum requirement');
    }

    if (issues.some(issue => issue.type === 'viewport-overflow')) {
      recommendations.push('Fix horizontal overflow issues for better mobile experience');
    }

    if (issues.some(issue => issue.type === 'accessibility')) {
      recommendations.push('Improve accessibility compliance (alt text, labels, color contrast)');
    }

    if (issues.some(issue => issue.type === 'performance')) {
      recommendations.push('Optimize performance for mobile devices and network conditions');
    }

    const avgLoadTime = this.reports
      .filter(report => report.performance.loadTime)
      .reduce((acc, report) => acc + (report.performance.loadTime || 0), 0) /
      this.reports.filter(report => report.performance.loadTime).length;

    if (avgLoadTime > 3000) {
      recommendations.push('Optimize page load times - current average exceeds 3 seconds');
    }

    return recommendations;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(data: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mobile Testing Report - CFMEU Next.js</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .metric { text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #2563eb; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1e40af; }
        .metric-label { color: #64748b; margin-top: 5px; }
        .issues { padding: 0 30px 30px; }
        .issue { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
        .issue.major { background: #fef3c7; border-left-color: #f59e0b; }
        .issue.minor { background: #f0f9ff; border-left-color: #3b82f6; }
        .recommendations { padding: 0 30px 30px; }
        .recommendations h2 { color: #1e293b; }
        .recommendation { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
        .devices { padding: 0 30px 30px; }
        .device-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .device-card { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .device-name { font-weight: bold; color: #1e293b; margin-bottom: 10px; }
        .device-stats { display: flex; justify-content: space-between; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Mobile Testing Report</h1>
            <p>CFMEU Next.js Application - Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${data.summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${data.summary.successRate}</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${data.summary.totalIssues}</div>
                <div class="metric-label">Issues Found</div>
            </div>
            <div class="metric">
                <div class="metric-value">${data.summary.devicesTested.length}</div>
                <div class="metric-label">Devices Tested</div>
            </div>
        </div>

        <div class="issues">
            <h2>🚨 Issues Summary</h2>
            ${Object.entries(data.summary.issuesByType).map(([type, count]) =>
              `<div class="issue"><strong>${type}:</strong> ${count} issues</div>`
            ).join('')}
        </div>

        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            ${data.recommendations.map(rec =>
              `<div class="recommendation">${rec}</div>`
            ).join('')}
        </div>

        <div class="devices">
            <h2>📱 Device Coverage</h2>
            <div class="device-grid">
                ${data.summary.devicesTested.map((device: string) =>
                  `<div class="device-card">
                      <div class="device-name">${device}</div>
                      <div class="device-stats">
                          <span>✅ Completed</span>
                      </div>
                  </div>`
                ).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate CSV report for data analysis
   */
  private generateCsvReport(): string {
    const headers = [
      'Device',
      'Test Suite',
      'Timestamp',
      'Duration (ms)',
      'Tests Passed',
      'Tests Failed',
      'Total Issues',
      'Critical Issues',
      'Major Issues',
      'Minor Issues',
      'Load Time (ms)',
      'FCP (ms)',
      'Accessibility Issues'
    ];

    const rows = this.reports.map(report => [
      report.device,
      report.testSuite,
      report.timestamp,
      report.duration,
      report.passed,
      report.failed,
      report.issues.length,
      report.issues.filter(i => i.severity === 'critical').length,
      report.issues.filter(i => i.severity === 'major').length,
      report.issues.filter(i => i.severity === 'minor').length,
      report.performance.loadTime || '',
      report.performance.firstContentfulPaint || '',
      report.accessibility.issues.length
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Get current test report
   */
  private getCurrentReport(): MobileTestReport | null {
    if (this.reports.length === 0 || this.reports[this.reports.length - 1].testSuite !== this.currentTestSuite) {
      return null;
    }
    return this.reports[this.reports.length - 1];
  }

  /**
   * Log issue to console
   */
  private logIssue(issue: MobileTestIssue): void {
    const emoji = {
      critical: '🚨',
      major: '⚠️',
      minor: 'ℹ️',
      info: '💡'
    }[issue.severity];

    console.log(`${emoji} [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`);
    if (issue.recommendation) {
      console.log(`   💡 ${issue.recommendation}`);
    }
  }
}