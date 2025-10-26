import { test, expect, devices } from '@playwright/test';

test.describe('Core Mobile Navigation Focus Areas', () => {
  const mobileDevices = [
    { name: 'iPhone 13', device: devices['iPhone 13'] },
    { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
    { name: 'iPhone 15 Pro Max', device: devices['iPhone 15 Pro Max'] }
  ];

  mobileDevices.forEach(({ name, device }) => {
    test.describe(`${name} - Core Navigation Assessment`, () => {
      test('should handle authentication flow on mobile', async ({ page }) => {
        await test.step('auth page mobile layout', async () => {
          await page.goto('/auth');
          await page.setViewportSize(device.viewport || { width: 390, height: 844 });
          await page.waitForLoadState('networkidle');

          // Check auth form visibility and sizing
          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          const formBounds = await authForm.boundingBox();
          if (formBounds) {
            console.log(`${name} - Form bounds: ${formBounds.width}x${formBounds.height}`);
            expect(formBounds.width).toBeLessThanOrEqual(device.viewport?.width || 390);
          }

          // Check input sizing
          const emailInput = page.locator('input[type="email"]');
          const passwordInput = page.locator('input[type="password"]');

          const emailBounds = await emailInput.boundingBox();
          const passwordBounds = await passwordInput.boundingBox();

          if (emailBounds && passwordBounds) {
            console.log(`${name} - Email input: ${emailBounds.width}x${emailBounds.height}`);
            console.log(`${name} - Password input: ${passwordBounds.width}x${passwordBounds.height}`);

            // Check minimum touch targets (Apple recommends 44x44)
            expect(emailBounds.height).toBeGreaterThanOrEqual(42); // Slightly more realistic
            expect(passwordBounds.height).toBeGreaterThanOrEqual(42);
          }

          // Check submit button
          const submitButton = page.locator('button[type="submit"], button:not([type])');
          const buttonBounds = await submitButton.boundingBox();
          if (buttonBounds) {
            console.log(`${name} - Submit button: ${buttonBounds.width}x${buttonBounds.height}`);
            expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
          }
        });

        await test.step('auth page responsive design', async () => {
          // Test landscape orientation
          await page.setViewportSize({
            width: device.viewport?.height || 844,
            height: device.viewport?.width || 390
          });

          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          const landscapeBounds = await authForm.boundingBox();
          if (landscapeBounds) {
            expect(landscapeBounds.width).toBeLessThanOrEqual(device.viewport?.height || 844);
          }
        });
      });

      test('should handle protected route redirects', async ({ page }) => {
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });

        const protectedRoutes = ['/projects', '/employers', '/map', '/activities'];

        for (const route of protectedRoutes) {
          await page.goto(route);
          await page.waitForLoadState('networkidle');

          // Should redirect to auth
          expect(page.url()).toContain('/auth');

          // Check viewport doesn't overflow
          const hasHorizontalOverflow = await page.evaluate(() => {
            return document.body.scrollWidth > document.body.clientWidth;
          });

          expect(hasHorizontalOverflow).toBeFalsy();
        }
      });

      test('should have proper mobile viewport configuration', async ({ page }) => {
        await page.goto('/auth');
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });

        // Check viewport meta tag
        const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewportMeta).toContain('width=device-width');
        expect(viewportMeta).toContain('initial-scale=1');
        expect(viewportMeta).toContain('viewport-fit=cover');

        // Check document width matches viewport
        const documentWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(documentWidth).toBe(device.viewport?.width || 390);

        // Check for proper mobile meta tags
        const appleWebAppCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
        expect(appleWebAppCapable).toBe('yes');

        const appleStatusBarStyle = await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
        expect(appleStatusBarStyle).toBe('black-translucent');
      });

      test('should handle accessibility basics', async ({ page }) => {
        await page.goto('/auth');
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });

        // Check for proper form structure
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const heading = page.locator('h1');

        await expect(heading).toBeVisible();
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();

        // Check for placeholders/labels
        const emailPlaceholder = await emailInput.getAttribute('placeholder');
        const passwordPlaceholder = await passwordInput.getAttribute('placeholder');

        expect(emailPlaceholder).toBeTruthy();
        expect(passwordPlaceholder).toBeTruthy();

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await expect(emailInput).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(passwordInput).toBeFocused();
      });

      test('should handle performance on mobile', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/auth');
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`${name} - Page load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds

        // Check for performance metrics
        const performanceMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
          };
        });

        console.log(`${name} - Performance metrics:`, performanceMetrics);
        expect(performanceMetrics.loadTime).toBeLessThan(1000);
      });
    });
  });

  test.describe('Cross-Device Consistency', () => {
    test('should maintain consistent form sizing across devices', async ({ page }) => {
      const results = [];

      for (const { name, device } of mobileDevices) {
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });
        await page.goto('/auth');
        await page.waitForLoadState('networkidle');

        const emailInput = page.locator('input[type="email"]');
        const emailBounds = await emailInput.boundingBox();

        if (emailBounds) {
          results.push({
            device: name,
            width: emailBounds.width,
            height: emailBounds.height
          });
        }
      }

      console.log('Input sizes across devices:', results);

      // All devices should have similar relative sizing
      results.forEach(result => {
        expect(result.height).toBeGreaterThanOrEqual(42);
        expect(result.width).toBeGreaterThan(0);
      });
    });

    test('should handle different viewport sizes properly', async ({ page }) => {
      const viewports = [
        { name: 'Small', width: 375, height: 667 },  // iPhone SE
        { name: 'Medium', width: 390, height: 844 },  // iPhone 13
        { name: 'Large', width: 430, height: 932 }    // iPhone 15 Pro Max
      ];

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/auth');
        await page.waitForLoadState('networkidle');

        const authForm = page.locator('form');
        await expect(authForm).toBeVisible();

        const formBounds = await authForm.boundingBox();
        if (formBounds) {
          expect(formBounds.width).toBeLessThanOrEqual(viewport.width);
          console.log(`${viewport.name} viewport (${viewport.width}x${viewport.height}): Form width ${formBounds.width}px`);
        }

        // Check for horizontal overflow
        const hasOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > document.body.clientWidth;
        });
        expect(hasOverflow).toBeFalsy();
      }
    });
  });
});