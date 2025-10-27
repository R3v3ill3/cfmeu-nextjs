import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright configuration for CFMEU 4-Point Rating System
 * Comprehensive testing across desktop, mobile, and performance scenarios
 */

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Comprehensive reporting for the 4-point rating system */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['line']
  ],

  /* Enhanced test configuration for rating system testing */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure for debugging */
    screenshot: 'only-on-failure',

    /* Record video on failure for review */
    video: 'retain-on-failure',

    /* Global timeout for each action */
    actionTimeout: 10000,

    /* Global timeout for navigation */
    navigationTimeout: 30000,

    /* Ignore HTTPS errors for testing */
    ignoreHTTPSErrors: true,

    /* Locale for testing */
    locale: 'en-AU',

    /* Timezone for testing */
    timezoneId: 'Australia/Sydney',
  },

  /* Configure projects for comprehensive testing */
  projects: [
    /* Desktop browsers */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        userAgent: 'CFMEU-E2E-Chromium'
      },
      testMatch: '**/*.chromium.spec.ts',
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        userAgent: 'CFMEU-E2E-Firefox'
      },
      testMatch: '**/*.firefox.spec.ts',
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
        userAgent: 'CFMEU-E2E-Safari'
      },
      testMatch: '**/*.webkit.spec.ts',
      dependencies: ['setup'],
    },

    /* Mobile devices for rating system mobile testing */
    {
      name: 'Mobile Chrome - Pixel 5',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
        userAgent: 'CFMEU-E2E-Mobile-Pixel5',
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/*.mobile.spec.ts',
      dependencies: ['setup'],
    },

    {
      name: 'Mobile Safari - iPhone 13',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        userAgent: 'CFMEU-E2E-iPhone13',
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/*.mobile.spec.ts',
      dependencies: ['setup'],
    },

    {
      name: 'Mobile Safari - iPhone 15 Pro Max',
      use: {
        ...devices['iPhone 15 Pro Max'],
        viewport: { width: 430, height: 932 },
        userAgent: 'CFMEU-E2E-iPhone15ProMax',
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/*.mobile.spec.ts',
      dependencies: ['setup'],
    },

    /* Tablet testing for rating system */
    {
      name: 'Tablet - iPad',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
        userAgent: 'CFMEU-E2E-iPad',
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/*.tablet.spec.ts',
      dependencies: ['setup'],
    },

    /* Performance testing project */
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--enable-automation',
            '--no-sandbox',
            '--disable-dev-shm-usage'
          ]
        },
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/*.performance.spec.ts',
      retries: 0,
      timeout: 60000,
      dependencies: ['setup'],
    },

    /* Accessibility testing project */
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/*.a11y.spec.ts',
      dependencies: ['setup'],
    },

    /* Cross-browser compatibility testing */
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/*.edge.spec.ts',
      dependencies: ['setup'],
    },

    /* Data setup project */
    {
      name: 'setup',
      testMatch: '**/*.setup.spec.ts',
      teardown: 'cleanup',
    },
  ],

  /* Global setup and teardown for test data */
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Test configuration */
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/',

  /* Metadata for test organization */
  metadata: {
    'Test Environment': 'E2E Testing',
    'System': 'CFMEU 4-Point Rating System',
    'Version': '1.0.0',
  },

  /* Global test configuration */
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,
});
