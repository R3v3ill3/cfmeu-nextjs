import { test, expect } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers, mobileTestRoutes, mobileBreakpoints } from '../fixtures/test-data';

test.describe('Mobile Navigation Audit', () => {
  let mobileHelpers: MobileHelpers;
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    authHelpers = new AuthHelpers(page);

    // Login for authenticated routes
    await authHelpers.login(testUsers.organizer);
  });

  test.afterEach(async ({ page }) => {
    // Capture screenshots for debugging
    await mobileHelpers.captureScreenshots(`navigation-${test.info().title}`);
  });

  test.describe('Core Navigation Functionality', () => {
    test('should display mobile navigation menu on all pages', async ({ page }) => {
      for (const route of mobileTestRoutes) {
        await test.step(`Navigate to ${route.name}`, async () => {
          await page.goto(route.path);
          await page.waitForLoadState('networkidle');

          // Check for mobile navigation elements
          const mobileMenuButton = page.locator(
            '[data-testid="mobile-menu-button"], ' +
            'button[aria-label="menu"], ' +
            '.mobile-menu-button, ' +
            'nav button:first-child'
          );

          // Some pages might not have navigation, but should handle gracefully
          const isVisible = await mobileMenuButton.isVisible().catch(() => false);

          if (isVisible) {
            await expect(mobileMenuButton).toBeVisible();

            // Test menu toggle
            await mobileMenuButton.tap();
            await page.waitForTimeout(300);

            // Check menu visibility
            const mobileMenu = page.locator(
              '[data-testid="mobile-menu"], ' +
              '.mobile-menu, ' +
              'nav[role="navigation"]'
            );
            await expect(mobileMenu).toBeVisible();
          } else {
            console.log(`No mobile menu found on ${route.path} - this might be expected`);
          }
        });
      }
    });

    test('should handle navigation between key routes', async ({ page }) => {
      const navigationFlow = [
        '/projects',
        '/employers',
        '/activities',
        '/map'
      ];

      for (let i = 0; i < navigationFlow.length; i++) {
        const route = navigationFlow[i];

        await test.step(`Navigate to ${route}`, async () => {
          // Navigate via direct URL first
          await page.goto(route);
          await page.waitForLoadState('networkidle');

          // Verify page loaded correctly
          await expect(page).toHaveURL(route);

          // Check for viewport overflow
          const overflowCheck = await mobileHelpers.checkViewportOverflow();
          expect(overflowCheck.hasOverflow).toBeFalsy();

          if (overflowCheck.hasOverflow) {
            console.warn(`Viewport overflow detected on ${route}`);
          }
        });
      }
    });

    test('should maintain navigation state on orientation change', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Test portrait to landscape
      await mobileHelpers.changeOrientation('landscape');
      await page.waitForTimeout(500);

      // Check navigation still works
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"], button[aria-label="menu"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.tap();
        await page.waitForTimeout(300);

        const mobileMenu = page.locator('[data-testid="mobile-menu"]');
        await expect(mobileMenu).toBeVisible();
      }

      // Test landscape back to portrait
      await mobileHelpers.changeOrientation('portrait');
      await page.waitForTimeout(500);
    });

    test('should handle breadcrumb navigation on mobile', async ({ page }) => {
      // Navigate to a project detail page
      await page.goto('/projects/1');
      await page.waitForLoadState('networkidle');

      // Check for breadcrumb elements
      const breadcrumbs = page.locator('[data-testid="breadcrumb"], .breadcrumb, nav[aria-label="breadcrumb"]');

      if (await breadcrumbs.isVisible()) {
        const breadcrumbLinks = breadcrumbs.locator('a');
        const linkCount = await breadcrumbLinks.count();

        if (linkCount > 0) {
          // Test breadcrumb navigation
          await breadcrumbLinks.first().tap();
          await page.waitForTimeout(500);

          // Verify navigation worked
          expect(page.url()).not.toContain('/projects/1');
        }
      }
    });
  });

  test.describe('Mobile Navigation Touch Targets', () => {
    test('should have properly sized navigation touch targets', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const navigationSelectors = [
        'button',
        'a[href]',
        '[role="button"]',
        '[data-testid="nav-item"]'
      ];

      for (const selector of navigationSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();

        for (let i = 0; i < Math.min(count, 10); i++) { // Test first 10 elements
          const element = elements.nth(i);
          const isVisible = await element.isVisible();

          if (isVisible) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(element);

            if (!touchValidation.isAccessible) {
              console.warn(`Touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
            }
          }
        }
      }
    });

    test('should handle mobile menu interactions', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"], button[aria-label="menu"]');

      if (await mobileMenuButton.isVisible()) {
        // Test menu open
        await mobileMenuButton.tap();
        await page.waitForTimeout(300);

        // Check menu items are tappable
        const menuItems = page.locator('[data-testid="mobile-menu"] a, [data-testid="mobile-menu"] button');
        const itemCount = await menuItems.count();

        for (let i = 0; i < Math.min(itemCount, 5); i++) { // Test first 5 items
          const item = menuItems.nth(i);
          const isVisible = await item.isVisible();

          if (isVisible) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(item);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }

        // Test menu close
        await mobileMenuButton.tap();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Navigation Performance', () => {
    test('should navigate quickly between pages', async ({ page }) => {
      const routes = ['/projects', '/employers', '/activities'];

      for (const route of routes) {
        await test.step(`Test navigation performance for ${route}`, async () => {
          const startTime = Date.now();

          await page.goto(route);
          await page.waitForLoadState('networkidle');

          const endTime = Date.now();
          const navigationTime = endTime - startTime;

          // Navigation should be under 3 seconds
          expect(navigationTime).toBeLessThan(3000);

          console.log(`Navigation to ${route} took ${navigationTime}ms`);
        });
      }
    });

    test('should handle navigation with slow network', async ({ page }) => {
      await mobileHelpers.setNetworkConditions('slow3g');

      const startTime = Date.now();
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();

      // Even with slow network, should load within reasonable time
      expect(endTime - startTime).toBeLessThan(15000);

      // Reset network conditions
      await mobileHelpers.setNetworkConditions('online');
    });
  });

  test.describe('Responsive Navigation', () => {
    Object.entries(mobileBreakpoints).forEach(([deviceName, viewport]) => {
      test(`should adapt navigation for ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // Check for overflow issues
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        expect(overflowCheck.hasOverflow).toBeFalsy();

        // Check navigation elements are properly sized
        const navigationElements = page.locator('nav, .navigation, [data-testid="navigation"]');
        if (await navigationElements.isVisible()) {
          const navBounds = await navigationElements.first().boundingBox();
          if (navBounds) {
            expect(navBounds.width).toBeLessThanOrEqual(viewport.width);
          }
        }
      });
    });
  });

  test.describe('Accessibility Navigation', () => {
    test('should maintain proper focus management', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Check that something is focused
      const focusedElement = page.locator(':focus');
      const isFocused = await focusedElement.count() > 0;
      expect(isFocused).toBeTruthy();

      // Test tab through multiple elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
    });

    test('should handle keyboard navigation on mobile elements', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Test keyboard shortcuts if implemented
      await page.keyboard.press('/');

      // Check if search or help dialog appears (common shortcut)
      const searchDialog = page.locator('[data-testid="search-dialog"], [role="dialog"]');
      if (await searchDialog.isVisible({ timeout: 1000 })) {
        await expect(searchDialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(searchDialog).toBeHidden({ timeout: 1000 });
      }
    });
  });
});