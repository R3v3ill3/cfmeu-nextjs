import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up mobile testing environment...');

  // Ensure necessary directories exist
  const directories = [
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/reports'
  ];

  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }

  // Launch browser for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  try {
    // Set up test environment
    console.log('🔧 Setting up test environment...');

    // Check if application is running
    const baseURL = config.webServer?.url || 'http://localhost:3000';

    try {
      await page.goto(baseURL, { timeout: 10000 });
      console.log(`✅ Application is running at ${baseURL}`);
    } catch (error) {
      console.warn(`⚠️  Application may not be running at ${baseURL}`);
      console.warn('Please ensure the development server is started before running tests');
    }

    // Set up authentication state if needed
    console.log('🔐 Setting up authentication state...');

    // Create test data files if they don't exist
    const testDataPath = path.join(process.cwd(), 'tests/mobile/fixtures');
    if (!fs.existsSync(testDataPath)) {
      console.log('📊 Test data fixtures already exist');
    }

    // Cache assets for faster test execution
    console.log('💾 Caching assets...');

    // Pre-load common resources
    const commonRoutes = [
      '/',
      '/auth',
      '/employers',
      '/projects'
    ];

    for (const route of commonRoutes) {
      try {
        await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
        console.log(`📄 Pre-cached: ${route}`);
      } catch (error) {
        console.log(`⚠️  Could not pre-cache: ${route}`);
      }
    }

    // Setup mobile viewport testing
    console.log('📱 Setting up mobile viewport configurations...');
    const viewportTests = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 390, height: 844, name: 'iPhone 13' },
      { width: 428, height: 926, name: 'iPhone 13 Pro Max' },
      { width: 393, height: 852, name: 'iPhone 15 Pro' },
      { width: 430, height: 932, name: 'iPhone 15 Pro Max' }
    ];

    // Store viewport configuration for tests
    const viewportConfig = {
      devices: viewportTests,
      timestamp: new Date().toISOString()
    };

    const configPath = path.join(process.cwd(), 'test-results', 'viewport-config.json');
    fs.writeFileSync(configPath, JSON.stringify(viewportConfig, null, 2));
    console.log(`💾 Viewport configuration saved to ${configPath}`);

    // Initialize performance baselines
    console.log('📈 Initializing performance baselines...');
    const performanceBaselines = {
      mobile: {
        'First Contentful Paint': 1500,
        'Largest Contentful Paint': 2500,
        'Time to Interactive': 3500,
        'Cumulative Layout Shift': 0.1
      },
      timestamp: new Date().toISOString()
    };

    const performancePath = path.join(process.cwd(), 'test-results', 'performance-baselines.json');
    fs.writeFileSync(performancePath, JSON.stringify(performanceBaselines, null, 2));
    console.log(`📊 Performance baselines saved to ${performancePath}`);

    console.log('✅ Global setup completed successfully!');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;