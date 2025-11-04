#!/usr/bin/env tsx

/**
 * Route Monitor Deployment Script
 *
 * This script sets up a systematic route monitoring system that can be run
 * periodically to detect missing routes and dependencies before they cause
 * production issues.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface MonitorConfig {
  disabledDirectories: string[]
  schedule: string
  notifications: {
    email?: string
    slack?: string
  }
  excludePatterns: string[]
}

const DEFAULT_CONFIG: MonitorConfig = {
  disabledDirectories: [
    'batches_disabled_20251026_142049',
    // Add other disabled directories as they're discovered
  ],
  schedule: '0 9 * * 1-5', // Weekdays at 9 AM
  notifications: {
    // Configure as needed
  },
  excludePatterns: [
    '*.test.*',
    '*.spec.*',
    'node_modules/**',
    '.next/**',
    'coverage/**'
  ]
}

class RouteMonitorDeployer {
  private rootDir: string

  constructor() {
    this.rootDir = process.cwd()
  }

  async deploy(): Promise<void> {
    console.log('🚀 Deploying Route Monitor System...')

    // 1. Create monitoring directory
    await this.createMonitoringDirectory()

    // 2. Generate configuration file
    await this.generateConfig()

    // 3. Create scheduled task script
    await this.createScheduledTask()

    // 4. Create GitHub Actions workflow
    await this.createGitHubWorkflow()

    // 5. Create pre-commit hook
    await this.createPreCommitHook()

    console.log('✅ Route Monitor System deployed successfully!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('   1. Review the generated configuration in .route-monitor/config.json')
    console.log('   2. Set up notifications if needed')
    console.log('   3. Add the pre-commit hook to your git hooks')
    console.log('   4. Enable the GitHub Actions workflow')
  }

  private async createMonitoringDirectory(): Promise<void> {
    const monitorDir = join(this.rootDir, '.route-monitor')

    if (!existsSync(monitorDir)) {
      mkdirSync(monitorDir, { recursive: true })
      console.log('📁 Created .route-monitor directory')
    }
  }

  private async generateConfig(): Promise<void> {
    const configPath = join(this.rootDir, '.route-monitor', 'config.json')
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
    console.log('⚙️  Generated configuration file')
  }

  private async createScheduledTask(): Promise<void> {
    const scriptPath = join(this.rootDir, '.route-monitor', 'check-routes.sh')

    const script = `#!/bin/bash
# Route Monitor Scheduled Task
# This script runs the missing routes analyzer and logs results

PROJECT_ROOT="$(dirname "$(readlink -f "$0")")"

echo "🔍 Running route analysis at $(date)"
cd "$PROJECT_ROOT"

# Run the analyzer
npx tsx scripts/analyze-missing-routes.ts > .route-monitor/latest-report.log 2>&1

# Check for high priority issues
if grep -q "🚨 HIGH PRIORITY ISSUES:" .route-monitor/latest-report.log && \
   grep -q -v "✅ No high priority issues found" .route-monitor/latest-report.log; then
  echo "⚠️  High priority route issues detected!"

  # Send notification (if configured)
  if [ -f ".route-monitor/notify.sh" ]; then
    bash .route-monitor/notify.sh
  fi

  exit 1
else
  echo "✅ No high priority route issues found"
  exit 0
fi
`

    writeFileSync(scriptPath, script)

    // Make it executable
    const { execSync } = require('child_process')
    execSync(`chmod +x ${scriptPath}`)

    console.log('📅 Created scheduled task script')
  }

  private async createGitHubWorkflow(): Promise<void> {
    const workflowDir = join(this.rootDir, '.github', 'workflows')

    if (!existsSync(workflowDir)) {
      mkdirSync(workflowDir, { recursive: true })
    }

    const workflow = `name: Route Monitor

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Run weekdays at 9 AM UTC
    - cron: '0 9 * * 1-5'
  workflow_dispatch:

jobs:
  route-monitor:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run Route Monitor
      run: npx tsx scripts/analyze-missing-routes.ts

    - name: Check for High Priority Issues
      run: |
        if grep -q "🚨 HIGH PRIORITY ISSUES:" missing-routes-report.json && \
           grep -q -v "✅ No high priority issues found" missing-routes-report.json; then
          echo "::error::High priority route issues detected!"
          cat missing-routes-report.json
          exit 1
        fi

    - name: Upload Report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: route-monitor-report
        path: missing-routes-report.json

    - name: Comment PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');

          if (fs.existsSync('missing-routes-report.json')) {
            const report = JSON.parse(fs.readFileSync('missing-routes-report.json', 'utf8'));

            if (report.summary.highPriorityIssues > 0) {
              const body = \`## 🚨 Route Monitor Report

              **High Priority Issues:** \${report.summary.highPriorityIssues}
              **Missing Routes:** \${report.summary.missingRoutes}

              <details>
              <summary>View Details</summary>

              \\\`\\\`\\\`json
              \${JSON.stringify(report.routes.filter(r => r.priority === 'HIGH'), null, 2)}
              \\\`\\\`\\\`

              </details>

              Please review and fix these issues before merging.
              \`;

              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: body
              });
            }
          }
`

    writeFileSync(join(workflowDir, 'route-monitor.yml'), workflow)
    console.log('🔄 Created GitHub Actions workflow')
  }

  private async createPreCommitHook(): Promise<void> {
    const hooksDir = join(this.rootDir, '.git', 'hooks')

    const hook = `#!/bin/bash
# Pre-commit hook for route monitoring
echo "🔍 Running route analysis..."

# Run the analyzer
npx tsx scripts/analyze-missing-routes.ts > /tmp/route-analysis.log 2>&1

# Check for high priority issues
if grep -q "🚨 HIGH PRIORITY ISSUES:" /tmp/route-analysis.log && \
   grep -q -v "✅ No high priority issues found" /tmp/route-analysis.log; then
  echo ""
  echo "⚠️  High priority route issues detected!"
  echo "Please fix these issues before committing:"
  cat /tmp/route-analysis.log
  exit 1
fi

echo "✅ Route analysis passed"
exit 0
`

    writeFileSync(join(hooksDir, 'pre-commit-route-monitor'), hook)

    // Make it executable
    const { execSync } = require('child_process')
    execSync(`chmod +x ${join(hooksDir, 'pre-commit-route-monitor')}`)

    console.log('🪝 Created pre-commit hook')
    console.log('   To enable: ln -s .git/hooks/pre-commit-route-monitor .git/hooks/pre-commit')
  }
}

// Main execution
async function main() {
  try {
    const deployer = new RouteMonitorDeployer()
    await deployer.deploy()
  } catch (error) {
    console.error('❌ Error deploying route monitor:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}