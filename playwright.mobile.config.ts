import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Enhanced Playwright configuration for CFMEU Next.js application
 * Includes comprehensive mobile testing setup for iPhone 13+ models
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Enhanced reporter configuration
  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', {
      outputFile: 'test-results/results.json'
    }],
    ['junit', {
      outputFile: 'test-results/results.xml'
    }],
    ['list']
  ],

  // Global test configuration
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Mobile-specific settings
    ignoreHTTPSErrors: true,
    acceptDownloads: true,

    // Performance monitoring
    navigationTimeout: 30000,
    actionTimeout: 10000,

    // Viewport configuration for responsive testing
    colorScheme: 'light',
    reducedMotion: 'reduce',

    // Geolocation for testing location-based features
    geolocation: { latitude: -37.8136, longitude: 144.9631 }, // Melbourne
    permissions: ['geolocation'],
  },

  // Configure projects for different browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // iPhone 13 Series
    {
      name: 'iphone-13',
      use: {
        ...devices['iPhone 13'],
        // Enhanced mobile configuration
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        // Additional mobile-specific settings
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-13-pro',
      use: {
        ...devices['iPhone 13 Pro'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-13-pro-max',
      use: {
        ...devices['iPhone 13 Pro Max'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    // iPhone 14 Series
    {
      name: 'iphone-14',
      use: {
        ...devices['iPhone 14'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-14-pro',
      use: {
        ...devices['iPhone 14 Pro'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-14-pro-max',
      use: {
        ...devices['iPhone 14 Pro Max'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    // iPhone 15 Series
    {
      name: 'iphone-15',
      use: {
        ...devices['iPhone 15'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-15-plus',
      use: {
        ...devices['iPhone 15 Plus'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-15-pro',
      use: {
        ...devices['iPhone 15 Pro'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    {
      name: 'iphone-15-pro-max',
      use: {
        ...devices['iPhone 15 Pro Max'],
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    // Tablet testing for comparison
    {
      name: 'ipad',
      use: {
        ...devices['iPad Pro'],
        hasTouch: true,
        isMobile: true,
        javaScriptEnabled: true,
        ignoreHTTPSErrors: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    // Custom viewport testing for responsive design
    {
      name: 'mobile-custom-viewport',
      use: {
        ...devices['Mobile Chrome'],
        viewport: { width: 375, height: 812 }, // Standard iPhone dimensions
        userAgent: 'Custom Mobile Test',
        hasTouch: true,
        isMobile: true,
      },
      testMatch: '**/mobile/**/*.spec.ts',
    },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global setup and teardown
  globalSetup: path.join(__dirname, 'tests/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/global-teardown.ts'),

  // Test output configuration
  outputDir: 'test-results/',

  // Metadata for reporting
  metadata: {
    'Test Environment': process.env.NODE_ENV || 'test',
    'Base URL': process.env.BASE_URL || 'http://localhost:3000',
    'Mobile Testing': 'iPhone 13+ Series',
  },
});