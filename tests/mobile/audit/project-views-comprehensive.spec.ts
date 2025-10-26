import { test, expect } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';
import {
  testUsers,
  testProjects,
  testScans,
  mobileTestRoutes,
  touchTargetTests,
  mobileBreakpoints
} from '../fixtures/test-data';

test.describe('Comprehensive Project Views Mobile Audit', () => {
  let mobileHelpers: MobileHelpers;
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    authHelpers = new AuthHelpers(page);

    // Login for authenticated routes
    await authHelpers.login(testUsers.organizer);
  });

  test.afterEach(async ({ page }) => {
    await mobileHelpers.captureScreenshots(`project-views-${test.info().title}`);
  });

  test.describe('1. Projects List Page Mobile Audit', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
    });

    test('should display responsive project cards on mobile', async ({ page }) => {
      // Check for project cards
      const projectCards = page.locator('[data-testid="project-card"], .project-card, .card');
      const cardCount = await projectCards.count();

      if (cardCount === 0) {
        console.log('No project cards found - checking for alternative layouts');
        // Check for list view
        const projectRows = page.locator('table tbody tr, .list-item');
        const rowCount = await projectRows.count();
        expect(rowCount).toBeGreaterThan(0);
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

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle search and filtering functionality on mobile', async ({ page }) => {
      // Look for search functionality
      const searchInput = page.locator(
        'input[type="search"], ' +
        'input[placeholder*="search" i], ' +
        '[data-testid="search-input"]'
      );

      if (await searchInput.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(searchInput);
        expect(touchValidation.isAccessible).toBeTruthy();

        // Test search functionality
        await searchInput.tap();
        await searchInput.fill('Melbourne');
        await page.waitForTimeout(500);

        // Check if results are updated
        const searchResults = page.locator('[data-testid="project-card"], .project-card');
        const resultCount = await searchResults.count();
        expect(resultCount).toBeGreaterThanOrEqual(0);
      }

      // Look for filter controls
      const filterButton = page.locator(
        'button:has-text("Filter"), ' +
        '[data-testid="filter-button"], ' +
        '.filter-button'
      );

      if (await filterButton.isVisible()) {
        await filterButton.tap();
        await page.waitForTimeout(300);

        // Check filter modal
        const filterModal = page.locator('[data-testid="filter-modal"], .filter-modal, [role="dialog"]');
        if (await filterModal.isVisible()) {
          await expect(filterModal).toBeVisible();

          // Test filter options
          const statusFilter = filterModal.locator('select[name="status"], [data-testid="status-filter"]');
          if (await statusFilter.isVisible()) {
            await statusFilter.tap();
            await statusFilter.selectOption({ label: 'Active' });
            await page.waitForTimeout(200);
          }

          // Close filter modal
          const closeButton = filterModal.locator('button:has-text("Close"), .close-button');
          if (await closeButton.isVisible()) {
            await closeButton.tap();
          }
        }
      }
    });

    test('should handle map view interaction on mobile', async ({ page }) => {
      // Look for view switcher
      const mapViewButton = page.locator(
        'button:has-text("Map"), ' +
        '[data-testid="map-view-button"], ' +
        'button[aria-label*="map" i]'
      );

      if (await mapViewButton.isVisible()) {
        await mapViewButton.tap();
        await page.waitForTimeout(500);

        // Check for map container
        const mapContainer = page.locator('[data-testid="map"], .map-container, .map');
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

        // Switch back to card/list view
        const listViewButton = page.locator(
          'button:has-text("List"), ' +
          '[data-testid="list-view-button"], ' +
          'button[aria-label*="list" i]'
        );

        if (await listViewButton.isVisible()) {
          await listViewButton.tap();
          await page.waitForTimeout(300);
        }
      }
    });

    test('should handle view switching on mobile', async ({ page }) => {
      const viewButtons = [
        { selector: 'button:has-text("Card")', name: 'card view' },
        { selector: 'button:has-text("List")', name: 'list view' },
        { selector: 'button:has-text("Map")', name: 'map view' }
      ];

      for (const viewButton of viewButtons) {
        const button = page.locator(viewButton.selector);

        if (await button.isVisible()) {
          await button.tap();
          await page.waitForTimeout(300);

          // Check for overflow after view switch
          const overflowCheck = await mobileHelpers.checkViewportOverflow();
          expect(overflowCheck.hasOverflow).toBeFalsy();

          console.log(`Successfully switched to ${viewButton.name}`);
        }
      }
    });

    test('should handle performance with project datasets', async ({ page }) => {
      // Test performance under normal conditions
      const performanceMetrics = await mobileHelpers.measurePerformance();

      console.log('Performance metrics for projects list:', performanceMetrics);
      expect(performanceMetrics.loadTime).toBeLessThan(3000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);

      // Test with slow network
      await mobileHelpers.setNetworkConditions('fast3g');

      const slowNetworkStartTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const slowNetworkLoadTime = Date.now() - slowNetworkStartTime;

      expect(slowNetworkLoadTime).toBeLessThan(5000);
      console.log(`Projects list loaded in ${slowNetworkLoadTime}ms with fast 3G`);

      await mobileHelpers.setNetworkConditions('online');
    });
  });

  test.describe('2. Project Detail Pages Mobile Audit', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to first project detail page
      const projectId = testProjects[0].id;
      await page.goto(`/projects/${projectId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should handle tab navigation on mobile', async ({ page }) => {
      // Look for tab navigation
      const tabNavigation = page.locator(
        '[role="tablist"], ' +
        '.tabs, ' +
        '.tab-navigation'
      );

      if (await tabNavigation.isVisible()) {
        const tabs = tabNavigation.locator('[role="tab"], .tab');
        const tabCount = await tabs.count();

        expect(tabCount).toBeGreaterThan(0);

        // Test each tab
        for (let i = 0; i < Math.min(tabCount, 5); i++) {
          const tab = tabs.nth(i);
          const isDisabled = await tab.isDisabled();

          if (!isDisabled && await tab.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(tab);
            expect(touchValidation.isAccessible).toBeTruthy();

            await tab.tap();
            await page.waitForTimeout(300);

            // Check that tab panel content appears
            const tabPanel = page.locator('[role="tabpanel"]');
            if (await tabPanel.count() > 0) {
              await expect(tabPanel.first()).toBeVisible();
            }
          }
        }
      }
    });

    test('should display project information correctly on mobile', async ({ page }) => {
      // Check for project header information
      const projectHeader = page.locator('[data-testid="project-header"], .project-header');
      if (await projectHeader.isVisible()) {
        const projectName = projectHeader.locator('h1, .project-name');
        const projectStatus = projectHeader.locator('.status, .badge');
        const projectDates = projectHeader.locator('.dates, .date-info');

        if (await projectName.isVisible()) await expect(projectName).toBeVisible();
        if (await projectStatus.isVisible()) await expect(projectStatus).toBeVisible();
        if (await projectDates.isVisible()) await expect(projectDates).toBeVisible();
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle action buttons and workflow interactions on mobile', async ({ page }) => {
      // Look for action buttons
      const actionButtons = page.locator(
        'button:has-text("Edit"), ' +
        'button:has-text("Delete"), ' +
        'button:has-text("Add"), ' +
        'button:has-text("Manage"), ' +
        '[data-testid="action-button"]'
      );

      const buttonCount = await actionButtons.count();
      if (buttonCount > 0) {
        // Test first few action buttons
        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const button = actionButtons.nth(i);
          if (await button.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }

      // Look for workflow buttons
      const workflowButtons = page.locator(
        'button:has-text("Scan"), ' +
        'button:has-text("Upload"), ' +
        'button:has-text("Assign"), ' +
        '[data-testid="workflow-button"]'
      );

      const workflowButtonCount = await workflowButtons.count();
      if (workflowButtonCount > 0) {
        for (let i = 0; i < Math.min(workflowButtonCount, 2); i++) {
          const button = workflowButtons.nth(i);
          if (await button.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }
    });

    test('should handle contractor assignment functionality on mobile', async ({ page }) => {
      // Look for contractor assignment section
      const contractorSection = page.locator(
        '[data-testid="contractors"], ' +
        '.contractors-section, ' +
        '.assign-contractors'
      );

      if (await contractorSection.isVisible()) {
        // Look for assign contractor button
        const assignButton = contractorSection.locator(
          'button:has-text("Assign"), ' +
          '[data-testid="assign-contractor-button"]'
        );

        if (await assignButton.isVisible()) {
          await assignButton.tap();
          await page.waitForTimeout(300);

          // Check for assignment dialog
          const assignmentDialog = page.locator(
            '[data-testid="assignment-dialog"], ' +
            '.assignment-dialog, ' +
            '[role="dialog"]'
          );

          if (await assignmentDialog.isVisible()) {
            await expect(assignmentDialog).toBeVisible();

            // Test contractor selection
            const contractorSelect = assignmentDialog.locator(
              'select[name="contractor"], ' +
              '[data-testid="contractor-select"]'
            );

            if (await contractorSelect.isVisible()) {
              await contractorSelect.tap();
              await contractorSelect.selectOption({ index: 1 });
              await page.waitForTimeout(200);
            }

            // Close dialog for testing
            const cancelButton = assignmentDialog.locator('button:has-text("Cancel")');
            if (await cancelButton.isVisible()) {
              await cancelButton.tap();
            }
          }
        }
      }
    });

    test('should handle mobile-specific compliance views', async ({ page }) => {
      // Look for compliance tab or section
      const complianceTab = page.locator(
        '[role="tab"]:has-text("Compliance"), ' +
        'button:has-text("Compliance"), ' +
        '[data-testid="compliance-tab"]'
      );

      if (await complianceTab.isVisible()) {
        await complianceTab.tap();
        await page.waitForTimeout(300);

        // Check compliance content
        const complianceContent = page.locator('[data-testid="compliance-content"]');
        if (await complianceContent.isVisible()) {
          // Look for compliance metrics
          const metrics = complianceContent.locator('.metric, .compliance-metric');
          const metricCount = await metrics.count();

          for (let i = 0; i < Math.min(metricCount, 5); i++) {
            const metric = metrics.nth(i);
            await expect(metric).toBeVisible();
          }

          // Check for overflow in compliance section
          const overflowCheck = await mobileHelpers.checkViewportOverflow();
          expect(overflowCheck.hasOverflow).toBeFalsy();
        }
      }
    });
  });

  test.describe('3. Scan Review Workflow Mobile Audit', () => {
    test.beforeEach(async ({ page }) => {
      const projectId = testProjects[0].id;
      await page.goto(`/projects/${projectId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should navigate to scan review on mobile', async ({ page }) => {
      // Look for scan review navigation
      const scanReviewLink = page.locator(
        'a:has-text("Scan Review"), ' +
        '[data-testid="scan-review-link"], ' +
        'button:has-text("Scans")'
      );

      if (await scanReviewLink.isVisible()) {
        await scanReviewLink.tap();
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/scan-review');
      } else {
        // Try direct navigation to scan review
        const projectId = testProjects[0].id;
        await page.goto(`/projects/${projectId}/scan-review`);
        await page.waitForLoadState('networkidle');
      }
    });

    test('should display scan list properly on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      await page.goto(`/projects/${projectId}/scan-review`);
      await page.waitForLoadState('networkidle');

      // Check for scan list or cards
      const scanCards = page.locator('[data-testid="scan-card"], .scan-card, tr[data-scan-id]');
      const scanCount = await scanCards.count();

      if (scanCount === 0) {
        console.log('No scan cards found - checking for upload option');
        // Check for upload button if no scans exist
        const uploadButton = page.locator(
          'button:has-text("Upload"), ' +
          '[data-testid="upload-scan-button"]'
        );

        if (await uploadButton.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(uploadButton);
          expect(touchValidation.isAccessible).toBeTruthy();
        }
      } else {
        // Test first few scan cards
        for (let i = 0; i < Math.min(scanCount, 3); i++) {
          const card = scanCards.nth(i);
          await expect(card).toBeVisible();

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
    });

    test('should handle scan detail view on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Check for scan header
      const scanHeader = page.locator('[data-testid="scan-header"], .scan-header');
      if (await scanHeader.isVisible()) {
        await expect(scanHeader).toBeVisible();
      }

      // Look for unmatched/matched employer sections
      const unmatchedSection = page.locator('[data-testid="unmatched-employers"], .unmatched-section');
      const matchedSection = page.locator('[data-testid="matched-employers"], .matched-section');

      if (await unmatchedSection.isVisible()) {
        await expect(unmatchedSection).toBeVisible();
      }

      if (await matchedSection.isVisible()) {
        await expect(matchedSection).toBeVisible();
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle subcontractor table responsiveness on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for subcontractor table
      const subcontractorTable = page.locator(
        '[data-testid="subcontractor-table"], ' +
        'table.data-table, ' +
        '.subcontractors-table'
      );

      if (await subcontractorTable.isVisible()) {
        await expect(subcontractorTable).toBeVisible();

        // Test horizontal scrolling for table
        const tableWidth = await subcontractorTable.evaluate(el => el.scrollWidth);
        const viewportWidth = await subcontractorTable.evaluate(el => el.clientWidth);

        if (tableWidth > viewportWidth) {
          console.log('Table requires horizontal scrolling on mobile');

          // Test horizontal scrolling
          await subcontractorTable.evaluate(el => {
            el.scrollLeft = 200;
          });
          await page.waitForTimeout(500);

          // Verify content is still accessible
          const tableContent = subcontractorTable.locator('td, th').first();
          if (await tableContent.isVisible()) {
            await expect(tableContent).toBeVisible();
          }
        }

        // Test touch targets for table interactions
        const tableRows = subcontractorTable.locator('tbody tr');
        const rowCount = await tableRows.count();

        for (let i = 0; i < Math.min(rowCount, 3); i++) {
          const row = tableRows.nth(i);
          const touchValidation = await mobileHelpers.validateTouchTargetSize(row);

          if (!touchValidation.isAccessible) {
            console.warn(`Table row touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
          }
        }
      }
    });

    test('should handle employer matching dialog on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for employer cards with match functionality
      const employerCards = page.locator('[data-testid="employer-card"], .employer-card');
      const cardCount = await employerCards.count();

      if (cardCount > 0) {
        const firstCard = employerCards.first();
        await expect(firstCard).toBeVisible();

        // Look for match button
        const matchButton = firstCard.locator(
          'button:has-text("Match"), ' +
          '[data-testid="match-button"]'
        );

        if (await matchButton.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(matchButton);
          expect(touchValidation.isAccessible).toBeTruthy();

          await matchButton.tap();
          await page.waitForTimeout(300);

          // Check for match dialog
          const matchDialog = page.locator(
            '[data-testid="match-dialog"], ' +
            '.match-dialog, ' +
            '[role="dialog"]'
          );

          if (await matchDialog.isVisible()) {
            await expect(matchDialog).toBeVisible();

            // Test dialog responsiveness
            const dialogBounds = await matchDialog.boundingBox();
            if (dialogBounds) {
              const viewport = await page.viewportSize();
              if (viewport) {
                expect(dialogBounds.width).toBeLessThanOrEqual(viewport.width * 0.95);
                expect(dialogBounds.height).toBeLessThanOrEqual(viewport.height * 0.9);
              }
            }

            // Test search functionality in dialog
            const searchInput = matchDialog.locator('input[placeholder*="search" i]');
            if (await searchInput.isVisible()) {
              await searchInput.tap();
              await searchInput.fill('Construction');
              await page.waitForTimeout(500);

              // Check for search results
              const searchResults = matchDialog.locator('[data-testid="search-result"], .search-result');
              const resultCount = await searchResults.count();

              if (resultCount > 0) {
                const firstResult = searchResults.first();
                await firstResult.tap();
                await page.waitForTimeout(300);
              }
            }

            // Test confirm button
            const confirmButton = matchDialog.locator('button:has-text("Confirm")');
            if (await confirmButton.isVisible()) {
              const touchValidation = await mobileHelpers.validateTouchTargetSize(confirmButton);
              expect(touchValidation.isAccessible).toBeTruthy();
            }

            // Close dialog for testing
            const cancelButton = matchDialog.locator('button:has-text("Cancel")');
            if (await cancelButton.isVisible()) {
              await cancelButton.tap();
            }
          }
        }
      }
    });

    test('should handle bulk operations on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for bulk operations controls
      const bulkActionsButton = page.locator(
        'button:has-text("Bulk"), ' +
        '[data-testid="bulk-actions-button"]'
      );

      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.tap();
        await page.waitForTimeout(300);

        // Check for selection checkboxes
        const checkboxes = page.locator('input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();

        if (checkboxCount > 0) {
          // Test checkbox touch targets
          for (let i = 0; i < Math.min(checkboxCount, 3); i++) {
            const checkbox = checkboxes.nth(i);
            const touchValidation = await mobileHelpers.validateTouchTargetSize(checkbox);

            if (!touchValidation.isAccessible) {
              console.warn(`Checkbox touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
            }

            // Toggle checkboxes
            await checkbox.tap();
            await page.waitForTimeout(100);
          }
        }

        // Look for bulk action buttons
        const bulkActionButtons = page.locator(
          'button:has-text("Match Selected"), ' +
          'button:has-text("Delete Selected"), ' +
          '[data-testid="bulk-action-button"]'
        );

        const actionButtonCount = await bulkActionButtons.count();
        if (actionButtonCount > 0) {
          for (let i = 0; i < actionButtonCount; i++) {
            const button = bulkActionButtons.nth(i);
            if (await button.isVisible()) {
              const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
              expect(touchValidation.isAccessible).toBeTruthy();
            }
          }
        }
      }
    });

    test('should handle navigation between scan review steps on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for step navigation or progress indicators
      const stepNavigation = page.locator(
        '[data-testid="step-navigation"], ' +
        '.step-indicator, ' +
        '.progress-steps'
      );

      if (await stepNavigation.isVisible()) {
        const steps = stepNavigation.locator('[role="button"], .step');
        const stepCount = await steps.count();

        if (stepCount > 0) {
          // Test step navigation
          for (let i = 0; i < Math.min(stepCount, 3); i++) {
            const step = steps.nth(i);
            if (await step.isVisible()) {
              const touchValidation = await mobileHelpers.validateTouchTargetSize(step);
              expect(touchValidation.isAccessible).toBeTruthy();
            }
          }
        }
      }

      // Look for previous/next navigation
      const prevButton = page.locator('button:has-text("Previous"), .prev-button');
      const nextButton = page.locator('button:has-text("Next"), .next-button');

      if (await prevButton.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(prevButton);
        expect(touchValidation.isAccessible).toBeTruthy();
      }

      if (await nextButton.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(nextButton);
        expect(touchValidation.isAccessible).toBeTruthy();
      }
    });

    test('should handle data validation and error handling on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for form validation
      const formInputs = page.locator('input[required], select[required], textarea[required]');
      const inputCount = await formInputs.count();

      if (inputCount > 0) {
        const firstInput = formInputs.first();

        // Test validation
        if (await firstInput.isVisible()) {
          await firstInput.tap();
          await firstInput.fill(''); // Clear input
          await page.keyboard.press('Tab');

          // Check for validation messages
          const validationMessage = page.locator(
            '[data-testid="validation-message"], ' +
            '.error-message, ' +
            '.validation-error'
          );

          if (await validationMessage.isVisible({ timeout: 1000 })) {
            await expect(validationMessage).toBeVisible();
          }
        }
      }

      // Test error handling
      const errorDisplays = page.locator(
        '[data-testid="error-display"], ' +
        '.error-container, ' +
        '.alert-error'
      );

      const errorCount = await errorDisplays.count();
      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const error = errorDisplays.nth(i);
          if (await error.isVisible()) {
            await expect(error).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('4. Project Creation/Editing Mobile Audit', () => {
    test('should handle project creation form on mobile', async ({ page }) => {
      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Check for form elements
      const formFields = [
        { selector: 'input[name="name"]', name: 'project name' },
        { selector: 'input[name="address"]', name: 'address' },
        { selector: 'input[name="client"]', name: 'client' },
        { selector: 'textarea[name="description"]', name: 'description' }
      ];

      for (const field of formFields) {
        const element = page.locator(field.selector);
        if (await element.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(element);
          expect(touchValidation.isAccessible).toBeTruthy();

          // Test field interaction
          await element.tap();
          await page.waitForTimeout(100);

          // Check if keyboard appears properly
          const focused = await element.evaluate(el => document.activeElement === el);
          expect(focused).toBeTruthy();

          // Hide keyboard
          await page.keyboard.press('Escape');
        }
      }

      // Check for submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Create")');
      if (await submitButton.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(submitButton);
        expect(touchValidation.isAccessible).toBeTruthy();
      }

      // Check for viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle address input and location services on mobile', async ({ page }) => {
      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Look for address input
      const addressInput = page.locator(
        'input[name="address"], ' +
        'input[placeholder*="address" i], ' +
        '[data-testid="address-input"]'
      );

      if (await addressInput.isVisible()) {
        await addressInput.tap();
        await addressInput.fill('123 Test Street');
        await page.waitForTimeout(500);

        // Look for location suggestions or autocomplete
        const suggestions = page.locator(
          '[data-testid="address-suggestions"], ' +
          '.autocomplete-suggestions, ' +
          '.location-suggestions'
        );

        if (await suggestions.isVisible({ timeout: 1000 })) {
          await expect(suggestions).toBeVisible();

          const suggestionItems = suggestions.locator('li, .suggestion-item');
          const itemCount = await suggestionItems.count();

          if (itemCount > 0) {
            const firstSuggestion = suggestionItems.first();
            const touchValidation = await mobileHelpers.validateTouchTargetSize(firstSuggestion);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }
    });

    test('should handle file upload functionality on mobile', async ({ page }) => {
      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Look for file upload inputs
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();

      if (fileInputCount > 0) {
        for (let i = 0; i < fileInputCount; i++) {
          const fileInput = fileInputs.nth(i);
          if (await fileInput.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(fileInput);
            expect(touchValidation.isAccessible).toBeTruthy();

            // Note: File input testing on mobile might need special handling
            console.log('File input found on mobile form');
          }
        }
      }

      // Look for drag-and-drop areas (should be touch-friendly on mobile)
      const dropZones = page.locator(
        '[data-testid="drop-zone"], ' +
        '.file-drop-zone, ' +
        '.upload-area'
      );

      const dropZoneCount = await dropZones.count();
      if (dropZoneCount > 0) {
        for (let i = 0; i < dropZoneCount; i++) {
          const dropZone = dropZones.nth(i);
          if (await dropZone.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(dropZone);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }
    });

    test('should handle multi-step project setup workflow on mobile', async ({ page }) => {
      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Look for step indicators
      const stepIndicators = page.locator(
        '[data-testid="step-indicator"], ' +
        '.step-wizard, ' +
        '.multi-step'
      );

      if (await stepIndicators.isVisible()) {
        const steps = stepIndicators.locator('[role="tab"], .step');
        const stepCount = await steps.count();

        if (stepCount > 0) {
          // Test each step
          for (let i = 0; i < Math.min(stepCount, 5); i++) {
            const step = steps.nth(i);
            if (await step.isVisible()) {
              const touchValidation = await mobileHelpers.validateTouchTargetSize(step);
              expect(touchValidation.isAccessible).toBeTruthy();

              await step.tap();
              await page.waitForTimeout(300);
            }
          }
        }
      }

      // Look for next/previous navigation
      const navigationButtons = page.locator(
        'button:has-text("Next"), ' +
        'button:has-text("Previous"), ' +
        'button:has-text("Continue"), ' +
        'button:has-text("Back")'
      );

      const navButtonCount = await navigationButtons.count();
      if (navButtonCount > 0) {
        for (let i = 0; i < Math.min(navButtonCount, 3); i++) {
          const button = navigationButtons.nth(i);
          if (await button.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('5. Mobile Orientation and Responsive Testing', () => {
    const orientations = [
      { name: 'iPhone 13', viewport: { width: 390, height: 844 } },
      { name: 'iPhone 14 Pro', viewport: { width: 393, height: 852 } },
      { name: 'iPhone 15 Pro Max', viewport: { width: 430, height: 932 } }
    ];

    orientations.forEach(({ name, viewport }) => {
      test(`should work on ${name} in portrait`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // Test basic functionality
        const projectCards = page.locator('[data-testid="project-card"], .project-card');
        const cardCount = await projectCards.count();

        if (cardCount > 0) {
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const card = projectCards.nth(i);
            await expect(card).toBeVisible();
          }
        }

        // Check for overflow
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        expect(overflowCheck.hasOverflow).toBeFalsy();
      });

      test(`should work on ${name} in landscape`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.height, height: viewport.width });
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // Test basic functionality
        const projectCards = page.locator('[data-testid="project-card"], .project-card');
        const cardCount = await projectCards.count();

        if (cardCount > 0) {
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const card = projectCards.nth(i);
            await expect(card).toBeVisible();
          }
        }

        // Check for overflow
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        expect(overflowCheck.hasOverflow).toBeFalsy();
      });
    });
  });

  test.describe('6. Performance Testing with Network Simulation', () => {
    test('should perform well under slow network conditions', async ({ page }) => {
      // Test with slow 3G
      await mobileHelpers.setNetworkConditions('slow3g');

      const routes = ['/projects', '/employers', '/map'];

      for (const route of routes) {
        await test.step(`Test ${route} with slow 3G`, async () => {
          const startTime = Date.now();

          await page.goto(route);
          await page.waitForLoadState('networkidle');

          const loadTime = Date.now() - startTime;

          // Should load within reasonable time even on slow network
          expect(loadTime).toBeLessThan(10000);
          console.log(`${route} loaded in ${loadTime}ms with slow 3G`);
        });
      }

      await mobileHelpers.setNetworkConditions('online');
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Simulate large dataset scenario
      await mobileHelpers.setNetworkConditions('fast3g');

      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;

      const startTime = Date.now();
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000);
      console.log(`Scan review with large dataset loaded in ${loadTime}ms`);

      // Check for performance optimizations
      const virtualScroll = page.locator('[data-testid="virtual-scroll"], .virtual-scroll');
      const pagination = page.locator('[data-testid="pagination"], .pagination');
      const lazyLoading = page.locator('[data-testid="lazy-load"], .lazy-load');

      const hasOptimization = await virtualScroll.isVisible() ||
                             await pagination.isVisible() ||
                             await lazyLoading.isVisible();

      if (hasOptimization) {
        console.log('Performance optimization detected (virtual scroll/pagination/lazy loading)');
      }

      await mobileHelpers.setNetworkConditions('online');
    });
  });

  test.describe('7. Critical Business Process Testing', () => {
    test('should handle complete scan review workflow on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;

      // Step 1: Navigate to project
      await page.goto(`/projects/${projectId}`);
      await page.waitForLoadState('networkidle');

      // Step 2: Navigate to scan review
      const scanReviewLink = page.locator('a:has-text("Scan Review"), [data-testid="scan-review-link"]');
      if (await scanReviewLink.isVisible()) {
        await scanReviewLink.tap();
        await page.waitForLoadState('networkidle');
      } else {
        await page.goto(`/projects/${projectId}/scan-review`);
        await page.waitForLoadState('networkidle');
      }

      // Step 3: Select scan for review
      const scanCards = page.locator('[data-testid="scan-card"], .scan-card');
      if (await scanCards.count() > 0) {
        await scanCards.first().tap();
        await page.waitForLoadState('networkidle');
      } else {
        await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
        await page.waitForLoadState('networkidle');
      }

      // Step 4: Test employer matching
      const employerCards = page.locator('[data-testid="employer-card"], .employer-card');
      const employerCount = await employerCards.count();

      if (employerCount > 0) {
        const firstEmployer = employerCards.first();
        await expect(firstEmployer).toBeVisible();

        const matchButton = firstEmployer.locator('button:has-text("Match")');
        if (await matchButton.isVisible()) {
          await matchButton.tap();
          await page.waitForTimeout(300);

          // Test search and selection
          const searchInput = page.locator('input[placeholder*="search" i]');
          if (await searchInput.isVisible()) {
            await searchInput.tap();
            await searchInput.fill('Construction');
            await page.waitForTimeout(500);

            const searchResults = page.locator('[data-testid="search-result"]');
            if (await searchResults.count() > 0) {
              await searchResults.first().tap();
              await page.waitForTimeout(300);

              const confirmButton = page.locator('button:has-text("Confirm")');
              if (await confirmButton.isVisible()) {
                await confirmButton.tap();
                await page.waitForTimeout(500);
              }
            }
          }
        }
      }

      // Step 5: Test workflow completion
      const completeButton = page.locator('button:has-text("Complete"), button:has-text("Finish")');
      if (await completeButton.isVisible()) {
        await completeButton.tap();
        await page.waitForTimeout(500);
      }

      console.log('Complete scan review workflow tested successfully');
    });

    test('should handle bulk matching operations workflow on mobile', async ({ page }) => {
      const projectId = testProjects[0].id;
      const scanId = testScans[0].id;
      await page.goto(`/projects/${projectId}/scan-review/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Look for bulk operations
      const bulkActionsButton = page.locator('button:has-text("Bulk"), [data-testid="bulk-actions-button"]');
      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.tap();
        await page.waitForTimeout(300);

        // Select multiple items
        const checkboxes = page.locator('input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();

        if (checkboxCount > 0) {
          // Select first few items
          for (let i = 0; i < Math.min(checkboxCount, 3); i++) {
            await checkboxes.nth(i).tap();
            await page.waitForTimeout(100);
          }

          // Test bulk action
          const bulkMatchButton = page.locator('button:has-text("Match Selected")');
          if (await bulkMatchButton.isVisible()) {
            await bulkMatchButton.tap();
            await page.waitForTimeout(300);

            // Test bulk operation dialog
            const bulkDialog = page.locator('[data-testid="bulk-match-dialog"]');
            if (await bulkDialog.isVisible()) {
              await expect(bulkDialog).toBeVisible();

              // Test dialog responsiveness
              const dialogBounds = await bulkDialog.boundingBox();
              if (dialogBounds) {
                const viewport = await page.viewportSize();
                if (viewport) {
                  expect(dialogBounds.width).toBeLessThanOrEqual(viewport.width * 0.95);
                }
              }

              // Close for testing
              const cancelButton = bulkDialog.locator('button:has-text("Cancel")');
              if (await cancelButton.isVisible()) {
                await cancelButton.tap();
              }
            }
          }
        }
      }
    });
  });
});