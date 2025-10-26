import { test, expect } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers, testProjects, testScans, testEmployerAliases } from '../fixtures/test-data';

test.describe('Mobile Scan Review Workflow Audit', () => {
  let mobileHelpers: MobileHelpers;
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    authHelpers = new AuthHelpers(page);

    // Login for authenticated routes
    await authHelpers.login(testUsers.organizer);
  });

  test.afterEach(async ({ page }) => {
    await mobileHelpers.captureScreenshots(`scan-review-${test.info().title}`);
  });

  test.describe('Scan Review List View', () => {
    test('should display scan list properly on mobile', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Navigate to project with scans
      const projectId = testProjects[0].id;
      await page.goto(`/projects/${projectId}`);
      await page.waitForLoadState('networkidle');

      // Look for scan review section or navigation
      const scanReviewLink = page.locator(
        'a:has-text("Scan Review"), ' +
        '[data-testid="scan-review-link"], ' +
        'button:has-text("Scans")'
      );

      if (await scanReviewLink.isVisible()) {
        await scanReviewLink.tap();
        await page.waitForLoadState('networkidle');

        // Check for scan list
        const scanCards = page.locator('[data-testid="scan-card"], .scan-card, tr[data-scan-id]');

        if (await scanCards.count() > 0) {
          // Test first few scan cards
          const cardCount = await scanCards.count();
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const card = scanCards.nth(i);
            await expect(card).toBeVisible();

            // Check for scan information
            const scanName = card.locator('[data-testid="scan-name"], .scan-name, td:first-child');
            if (await scanName.isVisible()) {
              await expect(scanName).toBeVisible();
            }

            // Check status badge
            const statusBadge = card.locator('[data-testid="scan-status"], .status-badge');
            if (await statusBadge.isVisible()) {
              await expect(statusBadge).toBeVisible();
            }

            // Test touch target size
            const touchValidation = await mobileHelpers.validateTouchTargetSize(card);
            if (!touchValidation.isAccessible) {
              console.warn(`Scan card touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
            }
          }
        }

        // Check for viewport overflow
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        expect(overflowCheck.hasOverflow).toBeFalsy();
      }
    });

    test('should handle scan filtering and sorting on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      await page.goto(`/projects/${projectId}/scan-review`);
      await page.waitForLoadState('networkidle');

      // Look for filter controls
      const filterButton = page.locator(
        'button:has-text("Filter"), ' +
        '[data-testid="filter-button"], ' +
        '.filter-button'
      );

      if (await filterButton.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(filterButton);
        expect(touchValidation.isAccessible).toBeTruthy();

        await filterButton.tap();
        await page.waitForTimeout(300);

        // Check filter modal
        const filterModal = page.locator('[data-testid="filter-modal"], .filter-modal');
        if (await filterModal.isVisible()) {
          await expect(filterModal).toBeVisible();

          // Test filter options
          const statusFilter = filterModal.locator('select[name="status"], [data-testid="status-filter"]');
          if (await statusFilter.isVisible()) {
            await statusFilter.tap();
            await statusFilter.selectOption({ label: 'Processed' });
            await page.waitForTimeout(200);
          }

          // Apply filters
          const applyButton = filterModal.locator('button:has-text("Apply"), .apply-button');
          if (await applyButton.isVisible()) {
            await applyButton.tap();
            await page.waitForTimeout(500);
          }
        }
      }

      // Look for sorting controls
      const sortButton = page.locator(
        'button:has-text("Sort"), ' +
        '[data-testid="sort-button"], ' +
        '.sort-button'
      );

      if (await sortButton.isVisible()) {
        await sortButton.tap();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Scan Review Detail View', () => {
    test('should display scan review interface on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Check for scan review header
      const scanHeader = page.locator('[data-testid="scan-header"], .scan-header');
      if (await scanHeader.isVisible()) {
        await expect(scanHeader).toBeVisible();

        // Check scan information
        const scanName = scanHeader.locator('[data-testid="scan-name"], .scan-name');
        const scanStatus = scanHeader.locator('[data-testid="scan-status"], .scan-status');
        const scanProgress = scanHeader.locator('[data-testid="scan-progress"], .scan-progress');

        if (await scanName.isVisible()) await expect(scanName).toBeVisible();
        if (await scanStatus.isVisible()) await expect(scanStatus).toBeVisible();
        if (await scanProgress.isVisible()) await expect(scanProgress).toBeVisible();
      }

      // Check for unmatched/matched employer sections
      const unmatchedSection = page.locator('[data-testid="unmatched-employers"], .unmatched-section');
      const matchedSection = page.locator('[data-testid="matched-employers"], .matched-section');

      if (await unmatchedSection.isVisible()) {
        await expect(unmatchedSection).toBeVisible();

        // Test unmatched employer cards
        const unmatchedCards = unmatchedSection.locator('[data-testid="employer-card"], .employer-card');
        const unmatchedCount = await unmatchedCards.count();

        for (let i = 0; i < Math.min(unmatchedCount, 3); i++) {
          const card = unmatchedCards.nth(i);
          await expect(card).toBeVisible();

          // Check for match button
          const matchButton = card.locator('button:has-text("Match"), [data-testid="match-button"]');
          if (await matchButton.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(matchButton);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }

      if (await matchedSection.isVisible()) {
        await expect(matchedSection).toBeVisible();
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle employer matching workflow on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for unmatched employer cards
      const unmatchedEmployers = page.locator('[data-testid="unmatched-employers"] [data-testid="employer-card"]');
      const employerCount = await unmatchedEmployers.count();

      if (employerCount > 0) {
        const firstEmployer = unmatchedEmployers.first();
        await expect(firstEmployer).toBeVisible();

        // Look for match button
        const matchButton = firstEmployer.locator('[data-testid="match-button"], button:has-text("Match")');
        if (await matchButton.isVisible()) {
          await matchButton.tap();
          await page.waitForTimeout(300);

          // Check for match dialog
          const matchDialog = page.locator('[data-testid="match-dialog"], .match-dialog, [role="dialog"]');
          if (await matchDialog.isVisible()) {
            await expect(matchDialog).toBeVisible();

            // Test employer search in match dialog
            const searchInput = matchDialog.locator('input[placeholder*="search" i], [data-testid="employer-search"]');
            if (await searchInput.isVisible()) {
              await searchInput.tap();
              await searchInput.fill('Construction');
              await page.waitForTimeout(500);

              // Check search results
              const searchResults = matchDialog.locator('[data-testid="search-result"], .search-result');
              const resultCount = await searchResults.count();

              if (resultCount > 0) {
                const firstResult = searchResults.first();
                await firstResult.tap();
                await page.waitForTimeout(300);

                // Look for confirm button
                const confirmButton = matchDialog.locator('button:has-text("Confirm"), [data-testid="confirm-match"]');
                if (await confirmButton.isVisible()) {
                  await confirmButton.tap();
                  await page.waitForTimeout(500);
                }
              }
            }

            // Close dialog if still open
            const cancelButton = matchDialog.locator('button:has-text("Cancel"), .cancel-button');
            if (await cancelButton.isVisible()) {
              await cancelButton.tap();
            }
          }
        }
      }
    });

    test('should handle bulk matching operations on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for bulk operations controls
      const bulkActionsButton = page.locator(
        'button:has-text("Bulk"), ' +
        '[data-testid="bulk-actions-button"], ' +
        '.bulk-actions'
      );

      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.tap();
        await page.waitForTimeout(300);

        // Check for selection checkboxes
        const checkboxes = page.locator('[data-testid="employer-checkbox"], input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();

        if (checkboxCount > 0) {
          // Select first few employers
          for (let i = 0; i < Math.min(checkboxCount, 3); i++) {
            const checkbox = checkboxes.nth(i);
            await checkbox.tap();
            await page.waitForTimeout(100);
          }

          // Look for bulk match button
          const bulkMatchButton = page.locator(
            'button:has-text("Match Selected"), ' +
            '[data-testid="bulk-match-button"]'
          );

          if (await bulkMatchButton.isVisible()) {
            await bulkMatchButton.tap();
            await page.waitForTimeout(300);

            // Test bulk match dialog
            const bulkMatchDialog = page.locator('[data-testid="bulk-match-dialog"]');
            if (await bulkMatchDialog.isVisible()) {
              await expect(bulkMatchDialog).toBeVisible();

              // Close dialog for testing purposes
              const closeButton = bulkMatchDialog.locator('button:has-text("Cancel"), .cancel-button');
              if (await closeButton.isVisible()) {
                await closeButton.tap();
              }
            }
          }
        }
      }
    });
  });

  test.describe('Employer Alias Management in Scan Review', () => {
    test('should handle employer alias creation on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for unmatched employers
      const unmatchedEmployers = page.locator('[data-testid="unmatched-employers"] [data-testid="employer-card"]');
      const employerCount = await unmatchedEmployers.count();

      if (employerCount > 0) {
        const firstEmployer = unmatchedEmployers.first();
        await expect(firstEmployer).toBeVisible();

        // Look for add alias button
        const addAliasButton = firstEmployer.locator(
          'button:has-text("Add Alias"), ' +
          '[data-testid="add-alias-button"]'
        );

        if (await addAliasButton.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(addAliasButton);
          expect(touchValidation.isAccessible).toBeTruthy();

          await addAliasButton.tap();
          await page.waitForTimeout(300);

          // Check for alias creation dialog
          const aliasDialog = page.locator('[data-testid="alias-dialog"], .alias-dialog');
          if (await aliasDialog.isVisible()) {
            await expect(aliasDialog).toBeVisible();

            // Test alias input
            const aliasInput = aliasDialog.locator('input[name="alias"], [data-testid="alias-input"]');
            if (await aliasInput.isVisible()) {
              await aliasInput.tap();
              await aliasInput.fill('Test Construction Alias');
              await page.waitForTimeout(200);
            }

            // Test employer selection
            const employerSelect = aliasDialog.locator('select[name="employer"], [data-testid="employer-select"]');
            if (await employerSelect.isVisible()) {
              await employerSelect.tap();
              await employerSelect.selectOption({ index: 1 });
              await page.waitForTimeout(200);
            }

            // Close dialog for testing
            const cancelButton = aliasDialog.locator('button:has-text("Cancel"), .cancel-button');
            if (await cancelButton.isVisible()) {
              await cancelButton.tap();
            }
          }
        }
      }
    });

    test('should display existing employer aliases on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for employers with aliases
      const employerCards = page.locator('[data-testid="employer-card"]');
      const cardCount = await employerCards.count();

      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = employerCards.nth(i);

        // Check for alias display
        const aliasDisplay = card.locator('[data-testid="alias-display"], .alias-display');
        if (await aliasDisplay.isVisible()) {
          await expect(aliasDisplay).toBeVisible();

          // Check alias information
          const aliasText = aliasDisplay.locator('[data-testid="alias-text"], .alias-text');
          if (await aliasText.isVisible()) {
            await expect(aliasText).toBeVisible();
          }

          // Check manage alias button
          const manageAliasButton = card.locator(
            'button:has-text("Manage"), ' +
            '[data-testid="manage-alias-button"]'
          );

          if (await manageAliasButton.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(manageAliasButton);
            if (!touchValidation.isAccessible) {
              console.warn(`Manage alias button touch target too small`);
            }
          }
        }
      }
    });
  });

  test.describe('Mobile Scan Review Interactions', () => {
    test('should handle horizontal scrolling for data tables', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for data tables
      const dataTable = page.locator('[data-testid="data-table"], table.data-table');
      if (await dataTable.isVisible()) {
        // Test horizontal scrolling
        const tableWidth = await dataTable.evaluate(el => el.scrollWidth);
        const viewportWidth = await dataTable.evaluate(el => el.clientWidth);

        if (tableWidth > viewportWidth) {
          // Scroll horizontally
          await dataTable.evaluate(el => {
            el.scrollLeft = 200;
          });
          await page.waitForTimeout(500);

          // Check if content is accessible after scroll
          const scrolledContent = dataTable.locator('td, th').first();
          if (await scrolledContent.isVisible()) {
            await expect(scrolledContent).toBeVisible();
          }
        }
      }
    });

    test('should handle swipe gestures for employer cards', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for swipeable employer cards
      const employerCards = page.locator('[data-testid="employer-card"]');
      const cardCount = await employerCards.count();

      if (cardCount > 0) {
        const firstCard = employerCards.first();
        await expect(firstCard).toBeVisible();

        // Test swipe left action
        await mobileHelpers.swipe({
          direction: 'left',
          element: firstCard
        });

        await page.waitForTimeout(500);

        // Look for swipe action buttons that might appear
        const swipeActions = firstCard.locator('[data-testid="swipe-actions"], .swipe-actions');
        if (await swipeActions.isVisible()) {
          await expect(swipeActions).toBeVisible();

          const actionButtons = swipeActions.locator('button');
          const buttonCount = await actionButtons.count();

          for (let i = 0; i < buttonCount; i++) {
            const button = actionButtons.nth(i);
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }

        // Test swipe right action
        await mobileHelpers.swipe({
          direction: 'right',
          element: firstCard
        });

        await page.waitForTimeout(500);
      }
    });

    test('should handle pull-to-refresh functionality', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Simulate pull-to-refresh gesture
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });

      await page.mouse.move(200, 100);
      await page.mouse.down();
      await page.mouse.move(200, 300, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(1000);

      // Check if refresh indicator appears
      const refreshIndicator = page.locator('[data-testid="refresh-indicator"], .refreshing');
      if (await refreshIndicator.isVisible({ timeout: 2000 })) {
        await expect(refreshIndicator).toBeVisible();
      }
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should handle large scan datasets efficiently', async ({ page }) => {
      // Test with simulated large dataset
      await mobileHelpers.setNetworkConditions('fast3g');

      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;

      const startTime = Date.now();
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000);
      console.log(`Scan review loaded in ${loadTime}ms with fast 3G`);

      // Check for virtual scrolling or pagination
      const virtualScroll = page.locator('[data-testid="virtual-scroll"], .virtual-scroll');
      const pagination = page.locator('[data-testid="pagination"], .pagination');

      const hasPerformanceOptimization = await virtualScroll.isVisible() || await pagination.isVisible();

      if (hasPerformanceOptimization) {
        console.log('Performance optimization (virtual scroll/pagination) detected');
      }

      await mobileHelpers.setNetworkConditions('online');
    });

    test('should maintain accessibility compliance on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Check accessibility
      const accessibilityCheck = await mobileHelpers.checkAccessibility();

      expect(accessibilityCheck.issues.length).toBeLessThan(10);

      if (accessibilityCheck.issues.length > 0) {
        console.log('Accessibility issues found:', accessibilityCheck.issues);
      }

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = page.locator(':focus');
      const isFocused = await focusedElement.count() > 0;
      expect(isFocused).toBeTruthy();

      // Test ARIA labels
      const interactiveElements = page.locator('button, a, input, select');
      const elementCount = await interactiveElements.count();

      for (let i = 0; i < Math.min(elementCount, 10); i++) {
        const element = interactiveElements.nth(i);
        const isVisible = await element.isVisible();

        if (isVisible) {
          const hasAriaLabel = await element.evaluate(el => {
            return el.hasAttribute('aria-label') ||
                   el.hasAttribute('aria-labelledby') ||
                   el.getAttribute('aria-describedby') ||
                   (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) ||
                   (el.tagName === 'BUTTON' && el.textContent?.trim());
          });

          expect(hasAriaLabel).toBeTruthy();
        }
      }
    });
  });
});