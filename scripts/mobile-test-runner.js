#!/usr/bin/env node

/**
 * Mobile Test Runner Utility
 * Helper script for managing and running mobile tests for CFMEU Next.js application
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = {
  configFile: 'playwright.mobile.config.ts',
  testDir: 'tests/mobile',
  resultsDir: 'test-results',
  port: 3000
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    log(`🚀 Running: ${command} ${args.join(' ')}`, 'cyan');

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ Command completed successfully`, 'green');
        resolve(code);
      } else {
        log(`❌ Command failed with code ${code}`, 'red');
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      log(`❌ Error: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  log('🔧 Checking prerequisites...', 'yellow');

  // Check if Node.js is installed
  try {
    await execCommand('node', ['--version']);
  } catch (error) {
    log('❌ Node.js is not installed or not in PATH', 'red');
    process.exit(1);
  }

  // Check if npm is installed
  try {
    await execCommand('npm', ['--version']);
  } catch (error) {
    log('❌ npm is not installed or not in PATH', 'red');
    process.exit(1);
  }

  // Check if playwright is installed
  try {
    await execCommand('npx', ['playwright', '--version']);
  } catch (error) {
    log('❌ Playwright is not installed', 'red');
    log('💡 Run: npm install @playwright/test', 'yellow');
    process.exit(1);
  }

  log('✅ All prerequisites satisfied', 'green');
}

async function checkServer() {
  log('🌐 Checking if development server is running...', 'yellow');

  try {
    const response = await fetch(`http://localhost:${config.port}`);
    if (response.ok) {
      log('✅ Development server is running', 'green');
      return true;
    }
  } catch (error) {
    // Server is not running
  }

  log('⚠️  Development server is not running', 'yellow');
  log('💡 Starting development server...', 'yellow');

  // Start development server in background
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    detached: true
  });

  // Wait for server to start
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`http://localhost:${config.port}`);
      if (response.ok) {
        log('✅ Development server started successfully', 'green');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    retries--;
  }

  log('❌ Failed to start development server', 'red');
  process.exit(1);
}

async function runTests(options = {}) {
  const {
    device = 'all',
    test = 'all',
    headed = false,
    debug = false,
    update = false,
    reporter = 'html'
  } = options;

  let args = ['test', '--config', config.configFile];

  if (device !== 'all') {
    args.push('--project', device);
  }

  if (test !== 'all') {
    args.push(test);
  }

  if (headed) {
    args.push('--headed');
  }

  if (debug) {
    args.push('--debug');
  }

  if (update) {
    args.push('--update-snapshots');
  }

  args.push('--reporter', reporter);

  try {
    await execCommand('npx', ['playwright', ...args]);
    log('✅ Tests completed successfully', 'green');
  } catch (error) {
    log('❌ Tests failed', 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('\n📱 Mobile Test Runner - CFMEU Next.js Application', 'cyan');
  log('='.repeat(50), 'cyan');

  log('\n🔧 Commands:', 'yellow');
  log('  run [options]     Run mobile tests', 'white');
  log('  check             Check prerequisites and setup', 'white');
  log('  setup             Install Playwright and browsers', 'white');
  log('  report            Open test report', 'white');
  log('  clean             Clean test results', 'white');
  log('  status            Show test status and statistics', 'white');

  log('\n⚙️  Options for "run":', 'yellow');
  log('  --device <name>   Specify device (iphone-15-pro, iphone-14, etc.)', 'white');
  log('  --test <path>     Run specific test file', 'white');
  log('  --headed          Run with visible browser', 'white');
  log('  --debug           Run in debug mode', 'white');
  log('  --update          Update screenshots', 'white');
  log('  --reporter <type> Specify reporter (html, json, junit)', 'white');

  log('\n📱 Available devices:', 'yellow');
  const devices = [
    'iphone-13', 'iphone-13-pro', 'iphone-13-pro-max',
    'iphone-14', 'iphone-14-pro', 'iphone-14-pro-max',
    'iphone-15', 'iphone-15-plus', 'iphone-15-pro', 'iphone-15-pro-max'
  ];
  devices.forEach(device => log(`  ${device}`, 'white'));

  log('\n📊 Test categories:', 'yellow');
  log('  tests/mobile/audit/navigation.spec.ts        Navigation tests', 'white');
  log('  tests/mobile/audit/employer-views.spec.ts    Employer view tests', 'white');
  log('  tests/mobile/audit/scan-review-workflow.spec.ts  Scan review tests', 'white');

  log('\n📝 Examples:', 'yellow');
  log('  node scripts/mobile-test-runner.js run', 'white');
  log('  node scripts/mobile-test-runner.js run --device iphone-15-pro', 'white');
  log('  node scripts/mobile-test-runner.js run --headed --debug', 'white');
  log('  node scripts/mobile-test-runner.js run --test tests/mobile/audit/navigation.spec.ts', 'white');
}

async function showStatus() {
  log('📊 Mobile Test Status', 'cyan');
  log('='.repeat(30), 'cyan');

  // Check if test results exist
  const resultsPath = path.join(config.resultsDir, 'mobile-test-summary.json');
  if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    log('\n📈 Latest Test Results:', 'yellow');
    log(`  Total Tests: ${results.mobileTesting?.testCoverage?.routes || 'N/A'}`, 'white');
    log(`  Devices Tested: ${results.mobileTesting?.devicesTested?.length || 'N/A'}`, 'white');
    log(`  Last Run: ${results.mobileTesting?.lastRun || 'N/A'}`, 'white');
  } else {
    log('\n⚠️  No test results found', 'yellow');
    log('💡 Run tests first: node scripts/mobile-test-runner.js run', 'white');
  }

  // Check screenshots
  const screenshotDir = path.join(config.resultsDir, 'screenshots');
  if (fs.existsSync(screenshotDir)) {
    const screenshots = fs.readdirSync(screenshotDir).length;
    log(`  Screenshots: ${screenshots}`, 'white');
  }

  // Check report files
  const reportDir = path.join(config.resultsDir, 'reports');
  if (fs.existsSync(reportDir)) {
    const reports = fs.readdirSync(reportDir).filter(file => file.endsWith('.html'));
    if (reports.length > 0) {
      log(`  HTML Reports: ${reports.length}`, 'white');
    }
  }
}

async function cleanResults() {
  log('🗑️  Cleaning test results...', 'yellow');

  const dirsToClean = [
    config.resultsDir,
    path.join(config.resultsDir, 'screenshots'),
    path.join(config.resultsDir, 'videos'),
    path.join(config.resultsDir, 'traces'),
    path.join(config.resultsDir, 'reports')
  ];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log(`  Cleaned: ${dir}`, 'white');
    }
  }

  log('✅ Test results cleaned', 'green');
}

async function openReport() {
  const reportPath = path.join(config.resultsDir, 'playwright-report', 'index.html');

  if (fs.existsSync(reportPath)) {
    log('📊 Opening test report...', 'yellow');
    try {
      const start = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' : 'xdg-open';
      await execCommand(start, [reportPath]);
    } catch (error) {
      log(`❌ Could not open report automatically`, 'red');
      log(`📂 Report available at: ${reportPath}`, 'yellow');
    }
  } else {
    log('⚠️  No test report found', 'yellow');
    log('💡 Run tests first: node scripts/mobile-test-runner.js run', 'white');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'check':
        await checkPrerequisites();
        await checkServer();
        break;

      case 'setup':
        log('🔧 Setting up mobile testing environment...', 'yellow');
        await execCommand('npm', ['install']);
        await execCommand('npx', ['playwright', 'install', '--with-deps']);
        log('✅ Setup completed', 'green');
        break;

      case 'run':
        await checkPrerequisites();
        await checkServer();

        const options = {};
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg === '--device' && args[i + 1]) {
            options.device = args[i + 1];
            i++;
          } else if (arg === '--test' && args[i + 1]) {
            options.test = args[i + 1];
            i++;
          } else if (arg === '--headed') {
            options.headed = true;
          } else if (arg === '--debug') {
            options.debug = true;
          } else if (arg === '--update') {
            options.update = true;
          } else if (arg === '--reporter' && args[i + 1]) {
            options.reporter = args[i + 1];
            i++;
          }
        }

        await runTests(options);
        break;

      case 'report':
        await openReport();
        break;

      case 'clean':
        await cleanResults();
        break;

      case 'status':
        await showStatus();
        break;

      default:
        log(`❌ Unknown command: ${command}`, 'red');
        log('💡 Run "node scripts/mobile-test-runner.js help" for usage', 'yellow');
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runTests, checkPrerequisites, checkServer, showStatus };