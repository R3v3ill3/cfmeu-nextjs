import { test, expect } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';

test.describe('Project Views Mobile UI Audit', () => {
  let mobileHelpers: MobileHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
  });

  test.afterEach(async ({ page }) => {
    await mobileHelpers.captureScreenshots(`project-ui-${test.info().title}`);
  });

  test.describe('1. Auth Flow Mobile Testing', () => {
    test('should display auth page properly on mobile', async ({ page }) => {
      await page.goto('/');
      // The app should redirect to auth page
      await page.waitForLoadState('networkidle');

      // Check for auth container
      const authContainer = page.locator('form, [data-testid="auth-container"], .auth-container');
      if (await authContainer.isVisible({ timeout: 5000 })) {
        await expect(authContainer).toBeVisible();

        // Check for email field
        const emailField = page.locator('input[type="email"], input[name="email"]');
        if (await emailField.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(emailField);
          expect(touchValidation.isAccessible).toBeTruthy();
        }

        // Check for password field
        const passwordField = page.locator('input[type="password"], input[name="password"]');
        if (await passwordField.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(passwordField);
          expect(touchValidation.isAccessible).toBeTruthy();
        }

        // Check for submit button
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(submitButton);
          expect(touchValidation.isAccessible).toBeTruthy();
        }
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });
  });

  test.describe('2. Direct Route Mobile Testing (Bypassing Auth)', () => {
    test('should handle projects page layout on mobile', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Redirected to auth - expected behavior');
        return;
      }

      // Check for project cards or alternative layouts
      const projectCards = page.locator('[data-testid="project-card"], .project-card, .card');
      const cardCount = await projectCards.count();

      if (cardCount === 0) {
        console.log('No project cards found - checking for alternative layouts');
        // Check for list view or table view
        const projectRows = page.locator('table tbody tr, .list-item, .project-row');
        const rowCount = await projectRows.count();

        if (rowCount > 0) {
          for (let i = 0; i < Math.min(rowCount, 3); i++) {
            const row = projectRows.nth(i);
            await expect(row).toBeVisible();

            // Check for project information in row
            const projectName = row.locator('td:first-child, .project-name, h3');
            if (await projectName.isVisible()) {
              await expect(projectName).toBeVisible();
            }
          }
        }
      } else {
        // Test card layout for mobile
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = projectCards.nth(i);
          await expect(card).toBeVisible();

          // Check for project information
          const projectName = card.locator('h3, .project-name, [data-testid="project-name"]');
          if (await projectName.isVisible()) {
            await expect(projectName).toBeVisible();
          }

          const projectStatus = card.locator('.status, .badge, [data-testid="project-status"]');
          if (await projectStatus.isVisible()) {
            await expect(projectStatus).toBeVisible();
          }

          // Test touch target size
          const touchValidation = await mobileHelpers.validateTouchTargetSize(card);
          if (!touchValidation.isAccessible) {
            console.warn(`Project card touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
          }
        }
      }

      // Check for search functionality
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
      if (await searchInput.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(searchInput);
        expect(touchValidation.isAccessible).toBeTruthy();
      }

      // Check for navigation elements
      const navigationButtons = page.locator('nav button, .nav button, [data-testid="nav-button"]');
      const navButtonCount = await navigationButtons.count();

      for (let i = 0; i < Math.min(navButtonCount, 5); i++) {
        const button = navigationButtons.nth(i);
        if (await button.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
          expect(touchValidation.isAccessible).toBeTruthy();
        }
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle project detail page on mobile', async ({ page }) => {
      await page.goto('/projects/1');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Redirected to auth - expected behavior');
        return;
      }

      // Check for project header
      const projectHeader = page.locator('[data-testid="project-header"], .project-header, h1');
      if (await projectHeader.isVisible()) {
        await expect(projectHeader).toBeVisible();
      }

      // Check for tab navigation
      const tabNavigation = page.locator('[role="tablist"], .tabs, .tab-navigation');
      if (await tabNavigation.isVisible()) {
        const tabs = tabNavigation.locator('[role="tab"], .tab, button');
        const tabCount = await tabs.count();

        for (let i = 0; i < Math.min(tabCount, 5); i++) {
          const tab = tabs.nth(i);
          if (await tab.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(tab);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }

      // Check for action buttons
      const actionButtons = page.locator('button, [role="button"]');
      const buttonCount = await actionButtons.count();

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = actionButtons.nth(i);
        if (await button.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
          if (!touchValidation.isAccessible) {
            console.warn(`Button touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
          }
        }
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle scan review page on mobile', async ({ page }) => {
      await page.goto('/projects/1/scan-review/1');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Redirected to auth - expected behavior');
        return;
      }

      // Check for scan review interface
      const scanHeader = page.locator('[data-testid="scan-header"], .scan-header, h1, h2');
      if (await scanHeader.isVisible()) {
        await expect(scanHeader).toBeVisible();
      }

      // Look for data tables (common in scan review)
      const dataTables = page.locator('table.data-table, [data-testid="data-table"]');
      const tableCount = await dataTables.count();

      if (tableCount > 0) {
        const firstTable = dataTables.first();
        await expect(firstTable).toBeVisible();

        // Test table responsiveness
        const tableWidth = await firstTable.evaluate(el => el.scrollWidth);
        const viewportWidth = await firstTable.evaluate(el => el.clientWidth);

        if (tableWidth > viewportWidth) {
          console.log('Table requires horizontal scrolling on mobile - testing scroll functionality');

          // Test horizontal scrolling
          await firstTable.evaluate(el => {
            el.scrollLeft = 200;
          });
          await page.waitForTimeout(500);

          // Verify content is still accessible
          const tableContent = firstTable.locator('td, th').first();
          if (await tableContent.isVisible()) {
            await expect(tableContent).toBeVisible();
          }
        }
      }

      // Look for employer cards or unmatched sections
      const employerCards = page.locator('[data-testid="employer-card"], .employer-card, .unmatched-employer');
      const employerCardCount = await employerCards.count();

      if (employerCardCount > 0) {
        for (let i = 0; i < Math.min(employerCardCount, 3); i++) {
          const card = employerCards.nth(i);
          await expect(card).toBeVisible();

          // Test touch target size
          const touchValidation = await mobileHelpers.validateTouchTargetSize(card);
          if (!touchValidation.isAccessible) {
            console.warn(`Employer card touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
          }
        }
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle mapping sheets page on mobile', async ({ page }) => {
      await page.goto('/projects/1/mappingsheets');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Redirected to auth - expected behavior');
        return;
      }

      // Check for mapping sheets interface
      const mappingContainer = page.locator('[data-testid="mapping-container"], .mapping-container');
      if (await mappingContainer.isVisible()) {
        await expect(mappingContainer).toBeVisible();
      }

      // Look for data tables or lists
      const contentArea = page.locator('table, .list, .content-area');
      if (await contentArea.isVisible()) {
        await expect(contentArea).toBeVisible();
      }

      // Check for navigation elements
      const navigationElements = page.locator('nav, .navigation, [data-testid="navigation"]');
      if (await navigationElements.isVisible()) {
        await expect(navigationElements).toBeVisible();
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle map page on mobile', async ({ page }) => {
      await page.goto('/map');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Redirected to auth - expected behavior');
        return;
      }

      // Check for map container
      const mapContainer = page.locator('[data-testid="map"], .map-container, #map');
      if (await mapContainer.isVisible()) {
        await expect(mapContainer).toBeVisible();

        // Test map interactions
        await mobileHelpers.swipe({ direction: 'left', element: mapContainer });
        await page.waitForTimeout(300);

        await mobileHelpers.swipe({ direction: 'down', element: mapContainer });
        await page.waitForTimeout(300);

        // Test zoom gestures
        await mobileHelpers.doubleTap(mapContainer);
        await page.waitForTimeout(300);
      }

      // Check for map controls
      const mapControls = page.locator('.map-controls, [data-testid="map-controls"]');
      if (await mapControls.isVisible()) {
        const controlButtons = mapControls.locator('button');
        const buttonCount = await controlButtons.count();

        for (let i = 0; i < buttonCount; i++) {
          const button = controlButtons.nth(i);
          if (await button.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });
  });

  test.describe('3. Responsive Design Testing Across Devices', () => {
    const devices = [
      { name: 'iPhone 13', width: 390, height: 844 },
      { name: 'iPhone 14 Pro', width: 393, height: 852 },
      { name: 'iPhone 15 Pro Max', width: 430, height: 932 }
    ];

    devices.forEach(({ name, width, height }) => {
      test(`should be responsive on ${name}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // If redirected to auth, that's expected
        if (page.url().includes('/auth')) {
          console.log(`${name}: Redirected to auth - expected behavior`);
          return;
        }

        console.log(`Testing responsiveness on ${name} (${width}x${height})`);

        // Check that main content is visible
        const mainContent = page.locator('main, .main-content, [data-testid="main-content"]');
        if (await mainContent.isVisible()) {
          await expect(mainContent).toBeVisible();
        }

        // Check for proper viewport usage
        const htmlElement = page.locator('html');
        const htmlBounds = await htmlElement.boundingBox();

        if (htmlBounds) {
          expect(htmlBounds.width).toBeLessThanOrEqual(width);
          expect(htmlBounds.height).toBeLessThanOrEqual(height);
        }

        // Check for overflow
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        if (overflowCheck.hasOverflow) {
          console.warn(`${name}: Viewport overflow detected`, overflowCheck.overflowingElements.length);
        }
      });
    });
  });

  test.describe('4. Mobile Interaction Testing', () => {
    test('should handle touch interactions properly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Test tap interactions on visible elements
      const tappableElements = page.locator('button, a, [role="button"], input, select');
      const elementCount = await tappableElements.count();

      if (elementCount > 0) {
        // Test first 5 tappable elements
        for (let i = 0; i < Math.min(elementCount, 5); i++) {
          const element = tappableElements.nth(i);
          const isVisible = await element.isVisible();

          if (isVisible) {
            // Test tap interaction
            await element.tap();
            await page.waitForTimeout(200);

            // Test touch target size
            const touchValidation = await mobileHelpers.validateTouchTargetSize(element);
            if (!touchValidation.isAccessible) {
              console.warn(`Touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
            }
          }
        }
      }
    });

    test('should handle swipe gestures', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, test on auth page
      if (page.url().includes('/auth')) {
        console.log('Testing swipe gestures on auth page');
      }

      // Test swipe gestures on main content area
      const mainContent = page.locator('main, .main-content, body');
      await expect(mainContent).toBeVisible();

      // Test horizontal swipe
      await mobileHelpers.swipe({ direction: 'left', element: mainContent });
      await page.waitForTimeout(500);

      // Test vertical swipe
      await mobileHelpers.swipe({ direction: 'down', element: mainContent });
      await page.waitForTimeout(500);
    });

    test('should handle orientation changes', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 }); // Portrait
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // If redirected to auth, that's expected
      if (page.url().includes('/auth')) {
        console.log('Testing orientation changes on auth page');
      }

      // Switch to landscape
      await mobileHelpers.changeOrientation('landscape');
      await page.waitForTimeout(500);

      // Check that content is still accessible
      const mainContent = page.locator('main, .main-content, body');
      if (await mainContent.isVisible()) {
        await expect(mainContent).toBeVisible();
      }

      // Switch back to portrait
      await mobileHelpers.changeOrientation('portrait');
      await page.waitForTimeout(500);
    });
  });

  test.describe('5. Performance Testing', () => {
    test('should load pages within acceptable time limits', async ({ page }) => {
      const routes = ['/', '/projects', '/map', '/employers'];

      for (const route of routes) {
        const startTime = Date.now();
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`${route} loaded in ${loadTime}ms`);

        // Should load within 3 seconds on mobile
        expect(loadTime).toBeLessThan(3000);
      }
    });

    test('should handle slow network conditions', async ({ page }) => {
      await mobileHelpers.setNetworkConditions('fast3g');

      const startTime = Date.now();
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      console.log(`Projects page loaded in ${loadTime}ms with fast 3G network`);

      // Should still load within reasonable time on slow network
      expect(loadTime).toBeLessThan(8000);

      await mobileHelpers.setNetworkConditions('online');
    });

    test('should measure performance metrics', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const performanceMetrics = await mobileHelpers.measurePerformance();

      console.log('Performance metrics:', performanceMetrics);

      expect(performanceMetrics.loadTime).toBeLessThan(3000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000);
      expect(performanceMetrics.domContentLoaded).toBeLessThan(2500);
    });
  });

  test.describe('6. Accessibility Testing', () => {
    test('should maintain accessibility compliance', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Check accessibility
      const accessibilityCheck = await mobileHelpers.checkAccessibility();

      console.log('Accessibility issues found:', accessibilityCheck.issues.length);

      if (accessibilityCheck.issues.length > 0) {
        console.log('Issues:', accessibilityCheck.issues);
      }

      // Should have minimal accessibility issues
      expect(accessibilityCheck.issues.length).toBeLessThan(15);
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = page.locator(':focus');
      const isFocused = await focusedElement.count() > 0;
      expect(isFocused).toBeTruthy();

      // Test multiple tabs
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }

      // Test Enter key on focused element
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Check interactive elements for ARIA labels
      const interactiveElements = page.locator('button, a, input, select, [role="button"]');
      const elementCount = await interactiveElements.count();

      let elementsWithoutLabels = 0;

      for (let i = 0; i < Math.min(elementCount, 10); i++) {
        const element = interactiveElements.nth(i);
        const isVisible = await element.isVisible();

        if (isVisible) {
          const hasAriaLabel = await element.evaluate(el => {
            return el.hasAttribute('aria-label') ||
                   el.hasAttribute('aria-labelledby') ||
                   el.hasAttribute('aria-describedby') ||
                   (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) ||
                   (el.tagName === 'BUTTON' && el.textContent?.trim());
          });

          if (!hasAriaLabel) {
            elementsWithoutLabels++;
          }
        }
      }

      console.log(`Elements without proper ARIA labels: ${elementsWithoutLabels}`);

      // Should have most interactive elements properly labeled
      expect(elementsWithoutLabels).toBeLessThan(elementCount * 0.3);
    });
  });
});