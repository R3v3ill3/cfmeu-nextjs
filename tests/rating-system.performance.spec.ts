import { test, expect } from '@playwright/test';

test.describe('4-Point Rating System Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = {
        navigationStart: performance.timing.navigationStart,
        loadEventEnd: 0,
        domContentLoaded: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0
      };
    });

    // Monitor performance metrics
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') && response.status() === 200) {
        const timing = response.request().timing();
        console.log(`API Response Time for ${url}: ${timing.responseEnd}ms`);
      }
    });
  });

  test('should load ratings dashboard within performance thresholds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/ratings');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Check Core Web Vitals
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    // Performance assertions
    expect(performanceMetrics.domContentLoaded).toBeLessThan(1500); // 1.5s
    expect(performanceMetrics.loadComplete).toBeLessThan(3000); // 3s
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1000); // 1s
  });

  test('should handle rating calculation performance efficiently', async ({ page }) => {
    await page.goto('/employers/test-employer-123');

    // Start performance monitoring
    await page.evaluate(() => {
      window.performance.mark('rating-calculation-start');
    });

    // Trigger rating calculation
    await page.click('[data-testid="calculate-rating-button"]');
    await page.waitForSelector('[data-testid="rating-result"]');

    // End performance monitoring
    const calculationTime = await page.evaluate(() => {
      window.performance.mark('rating-calculation-end');
      window.performance.measure(
        'rating-calculation',
        'rating-calculation-start',
        'rating-calculation-end'
      );

      const measure = performance.getEntriesByName('rating-calculation')[0];
      return measure.duration;
    });

    // Rating calculation should complete within 2 seconds
    expect(calculationTime).toBeLessThan(2000);
  });

  test('should handle large dataset rendering efficiently', async ({ page }) => {
    await page.goto('/ratings');

    // Mock large dataset
    await page.route('**/api/ratings**', async route => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `employer-${i}`,
        name: `Employer ${i}`,
        rating: Math.floor(Math.random() * 4) + 1,
        confidence: Math.floor(Math.random() * 40) + 60
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: largeDataset })
      });
    });

    const renderStart = Date.now();

    // Trigger rendering of large dataset
    await page.click('[data-testid="load-all-ratings"]');
    await page.waitForSelector('[data-testid="ratings-grid"]');

    const renderTime = Date.now() - renderStart;

    // Large dataset should render within 5 seconds
    expect(renderTime).toBeLessThan(5000);

    // Verify memory usage
    const memoryUsage = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory usage should be reasonable (less than 50MB)
    expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
  });

  test('should maintain performance during concurrent rating calculations', async ({ page }) => {
    await page.goto('/ratings/bulk-calculate');

    // Select multiple employers for bulk calculation
    await page.click('[data-testid="select-all-employers"]');

    const concurrentCalculations = [];

    // Monitor each calculation
    page.on('console', (msg) => {
      if (msg.text().includes('Calculation completed')) {
        concurrentCalculations.push(Date.now());
      }
    });

    const startTime = Date.now();

    // Start bulk calculation
    await page.click('[data-testid="start-bulk-calculation"]');
    await page.waitForSelector('[data-testid="bulk-calculation-complete"]');

    const totalTime = Date.now() - startTime;

    // Bulk calculation should complete within 30 seconds for 100 employers
    expect(totalTime).toBeLessThan(30000);

    // Verify calculations ran concurrently
    expect(concurrentCalculations.length).toBeGreaterThan(1);
  });

  test('should optimize mobile performance', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific test');

    await page.goto('/mobile/ratings');

    // Monitor mobile-specific metrics
    const mobilePerformance = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        firstContentfulPaint: performance.getEntriesByType('paint')
          .find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        // Check for touch responsiveness
        touchResponseTime: 0
      };
    });

    // Mobile should load faster than desktop
    expect(mobilePerformance.domContentLoaded).toBeLessThan(2000);
    expect(mobilePerformance.firstContentfulPaint).toBeLessThan(1500);

    // Test touch responsiveness
    const touchStart = Date.now();
    await page.tap('[data-testid="rating-selector-3"]');
    const touchResponse = Date.now() - touchStart;

    // Touch response should be immediate
    expect(touchResponse).toBeLessThan(100);
  });

  test('should handle network performance degradation gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      await route.continue();
    });

    await page.goto('/ratings');

    const startTime = Date.now();

    // Should show loading states during slow network
    await page.waitForSelector('[data-testid="loading-skeleton"]');
    await page.waitForSelector('[data-testid="ratings-content"]', { timeout: 15000 });

    const loadTime = Date.now() - startTime;

    // Should still load within reasonable time despite network issues
    expect(loadTime).toBeLessThan(10000);

    // Should display appropriate loading indicators
    const loadingIndicator = await page.locator('[data-testid="loading-skeleton"]');
    await expect(loadingIndicator).toBeVisible();
  });

  test('should maintain performance with real-time updates', async ({ page }) => {
    await page.goto('/ratings');

    // Monitor WebSocket connection performance
    const wsPerformance = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:3000/realtime');
        const connectStart = Date.now();

        ws.onopen = () => {
          const connectTime = Date.now() - connectStart;
          ws.close();
          resolve({ connectTime });
        };
      });
    });

    // WebSocket connection should be fast
    expect(wsPerformance.connectTime).toBeLessThan(1000);

    // Test real-time update performance
    const updateStart = Date.now();

    // Simulate real-time update
    await page.evaluate(() => {
      window.postMessage({
        type: 'rating_update',
        data: { employerId: 'test-123', newRating: 4 }
      }, '*');
    });

    await page.waitForSelector('[data-testid="rating-updated"]');
    const updateTime = Date.now() - updateStart;

    // Real-time updates should be processed quickly
    expect(updateTime).toBeLessThan(500);
  });

  test('should optimize bundle size and loading', async ({ page }) => {
    const responses: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.js') || url.includes('.css')) {
        const headers = response.headers();
        const contentLength = headers['content-length'];

        if (contentLength) {
          responses.push({
            url,
            size: parseInt(contentLength),
            type: url.endsWith('.js') ? 'javascript' : 'css'
          });
        }
      }
    });

    await page.goto('/ratings');
    await page.waitForLoadState('networkidle');

    // Calculate total bundle size
    const jsSize = responses
      .filter(r => r.type === 'javascript')
      .reduce((sum, r) => sum + r.size, 0);

    const cssSize = responses
      .filter(r => r.type === 'css')
      .reduce((sum, r) => sum + r.size, 0);

    // Bundle sizes should be optimized
    expect(jsSize).toBeLessThan(1024 * 1024); // Less than 1MB for JS
    expect(cssSize).toBeLessThan 200 * 1024); // Less than 200KB for CSS

    // Check for code splitting
    const chunks = responses.filter(r => r.url.includes('chunk'));
    expect(chunks.length).toBeGreaterThan(0); // Should have code splitting
  });

  test('should handle memory leaks efficiently', async ({ page }) => {
    await page.goto('/ratings');

    // Monitor memory usage over multiple operations
    const memorySnapshots: number[] = [];

    for (let i = 0; i < 10; i++) {
      // Perform memory-intensive operation
      await page.click('[data-testid="load-more-ratings"]');
      await page.waitForTimeout(1000);

      const memoryUsage = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      memorySnapshots.push(memoryUsage);

      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
    }

    // Memory usage should not grow significantly
    const initialMemory = memorySnapshots[0];
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be minimal (less than 10MB)
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);

    // Memory usage should be stable (not continuously growing)
    const maxMemory = Math.max(...memorySnapshots);
    const minMemory = Math.min(...memorySnapshots);
    const memoryVariation = maxMemory - minMemory;

    expect(memoryVariation).toBeLessThan(5 * 1024 * 1024); // Less than 5MB variation
  });
});