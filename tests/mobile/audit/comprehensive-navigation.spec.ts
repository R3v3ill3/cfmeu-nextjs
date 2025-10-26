import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';

test.describe('Comprehensive Mobile Navigation Audit', () => {
  const mobileDevices = [
    { name: 'iPhone 13', device: devices['iPhone 13'] },
    { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'] },
    { name: 'iPhone 15 Pro Max', device: devices['iPhone 15 Pro Max'] }
  ];

  mobileDevices.forEach(({ name, device }) => {
    test.describe(`${name} Mobile Navigation`, () => {
      let mobileHelpers: MobileHelpers;

      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });
        mobileHelpers = new MobileHelpers(page);
      });

      test('should handle authentication flow on mobile', async ({ page }) => {
        await test.step('should display auth page with proper mobile layout', async () => {
          await page.goto('/auth');
          await page.waitForLoadState('networkidle');

          // Check if auth form is properly sized for mobile
          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          const formBounds = await authForm.boundingBox();
          expect(formBounds?.width).toBeLessThanOrEqual(device.viewport?.width || 390);

          // Check input touch targets
          const emailInput = page.locator('input[type="email"]');
          const passwordInput = page.locator('input[type="password"]');

          const emailTouchTarget = await mobileHelpers.validateTouchTargetSize(emailInput);
          const passwordTouchTarget = await mobileHelpers.validateTouchTargetSize(passwordInput);

          // Form inputs should meet minimum touch target size
          expect(emailTouchTarget.size.height).toBeGreaterThanOrEqual(44);
          expect(passwordTouchTarget.size.height).toBeGreaterThanOrEqual(44);
        });

        await test.step('should handle mobile keyboard interactions', async () => {
          await page.goto('/auth');

          const emailInput = page.locator('input[type="email"]');
          await emailInput.tap();

          // Check if mobile keyboard appears properly
          await expect(emailInput).toBeFocused();

          // Test keyboard doesn't obscure form
          const emailInputBounds = await emailInput.boundingBox();
          expect(emailInputBounds?.y).toBeLessThan(200); // Should be visible above keyboard
        });
      });

      test('should prevent access to protected routes without authentication', async ({ page }) => {
        const protectedRoutes = ['/projects', '/employers', '/map', '/activities'];

        for (const route of protectedRoutes) {
          await test.step(`should redirect from ${route} to auth`, async () => {
            await page.goto(route);
            await page.waitForLoadState('networkidle');

            // Should redirect to auth page
            await expect(page).toHaveURL(/\/auth/);

            // Check viewport overflow
            const overflowCheck = await mobileHelpers.checkViewportOverflow();
            expect(overflowCheck.hasOverflow).toBeFalsy();
          });
        }
      });

      test('should handle responsive viewport across different orientations', async ({ page }) => {
        await test.step('portrait orientation', async () => {
          await page.goto('/auth');
          await page.setViewportSize({ width: device.viewport?.width || 390, height: device.viewport?.height || 844 });

          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          const overflowCheck = await mobileHelpers.checkViewportOverflow();
          expect(overflowCheck.hasOverflow).toBeFalsy();
        });

        await test.step('landscape orientation', async () => {
          await page.goto('/auth');
          await page.setViewportSize({
            width: device.viewport?.height || 844,
            height: device.viewport?.width || 390
          });

          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          // Form should adapt to landscape
          const formBounds = await authForm.boundingBox();
          expect(formBounds?.width).toBeLessThanOrEqual(device.viewport?.height || 844);
        });
      });

      test('should maintain proper safe area handling for notched devices', async ({ page }) => {
        // Test safe area CSS variables are applied
        await page.goto('/auth');

        const safeAreaStyles = await page.evaluate(() => {
          const bodyStyles = getComputedStyle(document.body);
          return {
            paddingLeft: bodyStyles.paddingLeft,
            paddingRight: bodyStyles.paddingRight,
            paddingTop: bodyStyles.paddingTop,
            paddingBottom: bodyStyles.paddingBottom
          };
        });

        // Check if safe area insets are being used (should have some padding)
        expect(safeAreaStyles.paddingLeft).not.toBe('0px');
      });

      test('should handle network conditions gracefully', async ({ page }) => {
        await test.step('slow network conditions', async () => {
          await mobileHelpers.setNetworkConditions('slow3g');

          const startTime = Date.now();
          await page.goto('/auth');
          await page.waitForLoadState('networkidle');
          const loadTime = Date.now() - startTime;

          // Should still load within reasonable time even on slow network
          expect(loadTime).toBeLessThan(15000);

          // Form should still be functional
          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();

          await mobileHelpers.setNetworkConditions('online');
        });

        await test.step('offline conditions', async () => {
          await mobileHelpers.setNetworkConditions('offline');

          await page.goto('/auth');

          // Should handle offline state gracefully (show cached version or error)
          const body = page.locator('body');
          await expect(body).toBeVisible();

          await mobileHelpers.setNetworkConditions('online');
        });
      });

      test('should support accessibility features on mobile', async ({ page }) => {
        await page.goto('/auth');

        await test.step('keyboard navigation', async () => {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          // First input should be focused
          const emailInput = page.locator('input[type="email"]');
          await expect(emailInput).toBeFocused();

          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          // Second input should be focused
          const passwordInput = page.locator('input[type="password"]');
          await expect(passwordInput).toBeFocused();
        });

        await test.step('screen reader support', async () => {
          const form = page.locator('form');
          const emailLabel = await emailInput.getAttribute('placeholder');
          const passwordLabel = await passwordInput.getAttribute('placeholder');

          // Should have proper labels/placeholders
          expect(emailLabel).toBeTruthy();
          expect(passwordLabel).toBeTruthy();

          // Check for proper heading structure
          const heading = page.locator('h1');
          await expect(heading).toBeVisible();
        });
      });

      test('should handle touch gestures properly', async ({ page }) => {
        await page.goto('/auth');

        await test.step('tap interactions', async () => {
          const emailInput = page.locator('input[type="email"]');
          await emailInput.tap();
          await expect(emailInput).toBeFocused();

          const passwordInput = page.locator('input[type="password"]');
          await passwordInput.tap();
          await expect(passwordInput).toBeFocused();
        });

        await test.step('form submission', async () => {
          const submitButton = page.locator('button[type="submit"], button:not([type])');
          const touchValidation = await mobileHelpers.validateTouchTargetSize(submitButton);

          // Submit button should be easily tappable
          expect(touchValidation.size.width).toBeGreaterThanOrEqual(44);
          expect(touchValidation.size.height).toBeGreaterThanOrEqual(44);
        });
      });

      test('should have proper viewport and scaling', async ({ page }) => {
        await page.goto('/auth');

        const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewportMeta).toContain('width=device-width');
        expect(viewportMeta).toContain('initial-scale=1');
        expect(viewportMeta).toContain('user-scalable=no');

        // Check if page is properly scaled
        const documentWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(documentWidth).toBe(device.viewport?.width || 390);
      });

      test('should handle Dynamic Island and modern iPhone features', async ({ page }) => {
        await page.goto('/auth');

        // Check for viewport-fit=cover for notched devices
        const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewportMeta).toContain('viewport-fit=cover');

        // Check for safe area handling
        const safeAreaSupport = await page.evaluate(() => {
          const styles = getComputedStyle(document.body);
          return styles.paddingTop.includes('env(safe-area-inset-top)');
        });

        // Safe area should be supported for modern devices
        expect(safeAreaSupport).toBeTruthy();
      });

      test('should capture performance metrics', async ({ page }) => {
        await test.step('measure page load performance', async () => {
          const startTime = Date.now();
          await page.goto('/auth');
          await page.waitForLoadState('networkidle');
          const loadTime = Date.now() - startTime;

          // Should load quickly on mobile
          expect(loadTime).toBeLessThan(3000);

          const performanceMetrics = await mobileHelpers.measurePerformance();
          expect(performanceMetrics.loadTime).toBeLessThan(1000);
          expect(performanceMetrics.domContentLoaded).toBeLessThan(800);
        });
      });
    });
  });

  test.describe('Cross-Device Navigation Consistency', () => {
    test('should maintain consistent touch target sizes across devices', async ({ page }) => {
      const touchTargets = [];

      for (const { name, device } of mobileDevices) {
        await page.setViewportSize(device.viewport || { width: 390, height: 844 });
        await page.goto('/auth');

        const submitButton = page.locator('button[type="submit"], button:not([type])');
        const touchValidation = await new MobileHelpers(page).validateTouchTargetSize(submitButton);

        touchTargets.push({
          device: name,
          size: touchValidation.size,
          isAccessible: touchValidation.isAccessible
        });
      }

      // All devices should have accessible touch targets
      touchTargets.forEach(target => {
        expect(target.isAccessible).toBeTruthy();
        expect(target.size.width).toBeGreaterThanOrEqual(44);
        expect(target.size.height).toBeGreaterThanOrEqual(44);
      });
    });

    test('should handle different screen densities', async ({ page }) => {
      for (const { name, device } of mobileDevices) {
        await test.step(`${name} pixel density handling`, async () => {
          await page.setViewportSize(device.viewport || { width: 390, height: 844 });
          await page.goto('/auth');

          // Check if high-DPI displays are handled properly
          const pixelRatio = await page.evaluate(() => window.devicePixelRatio);
          expect(pixelRatio).toBeGreaterThan(1);

          // Images and text should be crisp on high-DPI displays
          const authForm = page.locator('form');
          await expect(authForm).toBeVisible();
        });
      }
    });
  });

  test.describe('Mobile Navigation Best Practices', () => {
    test('should follow mobile UX patterns', async ({ page }) => {
      await page.goto('/auth');

      // Should have proper touch feedback
      const submitButton = page.locator('button[type="submit"], button:not([type])');
      await submitButton.tap();

      // Button should provide visual feedback
      const buttonStyles = await submitButton.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          transition: styles.transition
        };
      });

      // Should have some kind of transition or hover state
      expect(buttonStyles.transition).not.toBe('');
    });

    test('should prevent common mobile navigation issues', async ({ page }) => {
      await page.goto('/auth');

      // Check for zoom issues
      const initialScale = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta?.getAttribute('content')?.includes('initial-scale=1');
      });
      expect(initialScale).toBeTruthy();

      // Check for horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });
});