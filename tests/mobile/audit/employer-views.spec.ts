import { test, expect } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers, testEmployers, mobileBreakpoints } from '../fixtures/test-data';

test.describe('Mobile Employer Views Audit', () => {
  let mobileHelpers: MobileHelpers;
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    authHelpers = new AuthHelpers(page);

    // Login for authenticated routes
    await authHelpers.login(testUsers.organizer);
  });

  test.afterEach(async ({ page }) => {
    await mobileHelpers.captureScreenshots(`employer-views-${test.info().title}`);
  });

  test.describe('Employer Listing Page', () => {
    test('should display employers list properly on mobile', async ({ page }) => {
      await page.goto('/employers');
      await page.waitForLoadState('networkidle');

      // Check page title
      await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

      // Check for employer cards or list items
      const employerCards = page.locator('[data-testid="employer-card"], .employer-card, tr[data-employer-id]');

      if (await employerCards.count() > 0) {
        // Test first few employer cards
        const cardCount = await employerCards.count();
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = employerCards.nth(i);
          await expect(card).toBeVisible();

          // Check for essential employer information
          const employerName = card.locator('[data-testid="employer-name"], .employer-name, td:first-child');
          if (await employerName.isVisible()) {
            await expect(employerName).toBeVisible();
          }

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

    test('should handle employer search and filtering on mobile', async ({ page }) => {
      await page.goto('/employers');
      await page.waitForLoadState('networkidle');

      // Look for search functionality
      const searchInput = page.locator(
        'input[placeholder*="search" i], ' +
        'input[data-testid="employer-search"], ' +
        '.search-input'
      );

      if (await searchInput.isVisible()) {
        // Test search input interaction
        await searchInput.tap();
        await searchInput.fill('Construction');
        await page.waitForTimeout(500);

        // Verify search results
        await expect(page.locator('[data-testid="employer-card"]')).toHaveCount.greaterThan(0);

        // Test clearing search
        await searchInput.clear();
        await page.waitForTimeout(500);
      }

      // Look for filter options
      const filterButton = page.locator(
        'button[data-testid="filter-button"], ' +
        '.filter-button, ' +
        'button:has-text("Filter")'
      );

      if (await filterButton.isVisible()) {
        await filterButton.tap();
        await page.waitForTimeout(300);

        // Check filter modal or panel
        const filterModal = page.locator('[data-testid="filter-modal"], .filter-modal');
        if (await filterModal.isVisible()) {
          await expect(filterModal).toBeVisible();

          // Test filter interaction
          const filterOptions = filterModal.locator('input[type="checkbox"], select, button');
          const optionCount = await filterOptions.count();

          if (optionCount > 0) {
            const firstOption = filterOptions.first();
            await firstOption.tap();
            await page.waitForTimeout(200);
          }

          // Close filter modal
          await page.locator('button:has-text("Apply"), button:has-text("Close")').first().tap();
        }
      }
    });

    test('should handle pagination on mobile', async ({ page }) => {
      await page.goto('/employers');
      await page.waitForLoadState('networkidle');

      // Look for pagination controls
      const paginationControls = page.locator(
        '[data-testid="pagination"], ' +
        '.pagination, ' +
        'nav[aria-label="pagination"]'
      );

      if (await paginationControls.isVisible()) {
        // Test pagination buttons
        const paginationButtons = paginationControls.locator('button, a');
        const buttonCount = await paginationButtons.count();

        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const button = paginationButtons.nth(i);
          if (await button.isVisible()) {
            const touchValidation = await mobileHelpers.validateTouchTargetSize(button);
            expect(touchValidation.isAccessible).toBeTruthy();

            // Test pagination navigation (if not disabled)
            const isDisabled = await button.isDisabled();
            if (!isDisabled) {
              await button.tap();
              await page.waitForTimeout(500);
              await page.goBack();
            }
          }
        }
      }
    });
  });

  test.describe('Employer Detail View', () => {
    test('should display employer details properly on mobile', async ({ page }) => {
      const employerId = testEmployers[0].id;
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');

      // Check employer name
      const employerName = page.locator('[data-testid="employer-name"], h1, .employer-name');
      await expect(employerName).toBeVisible();

      // Check for essential employer information sections
      const essentialInfo = [
        '[data-testid="employer-address"], .employer-address',
        '[data-testid="employer-phone"], .employer-phone',
        '[data-testid="employer-email"], .employer-email',
        '[data-testid="employer-abn"], .employer-abn'
      ];

      for (const selector of essentialInfo) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          await expect(element).toBeVisible();
        }
      }

      // Check for no viewport overflow
      const overflowCheck = await mobileHelpers.checkViewportOverflow();
      expect(overflowCheck.hasOverflow).toBeFalsy();
    });

    test('should handle employer alias management on mobile', async ({ page }) => {
      const employerId = testEmployers[0].id;
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');

      // Look for alias management section
      const aliasSection = page.locator(
        '[data-testid="employer-aliases"], ' +
        '.employer-aliases, ' +
        'section:has-text("alias" i)'
      );

      if (await aliasSection.isVisible()) {
        // Check existing aliases
        const aliasItems = aliasSection.locator('[data-testid="alias-item"], .alias-item');
        const aliasCount = await aliasItems.count();

        for (let i = 0; i < aliasCount; i++) {
          const alias = aliasItems.nth(i);
          await expect(alias).toBeVisible();
        }

        // Look for add alias functionality
        const addAliasButton = aliasSection.locator(
          'button:has-text("Add"), ' +
          '[data-testid="add-alias-button"], ' +
          '.add-alias-button'
        );

        if (await addAliasButton.isVisible()) {
          const touchValidation = await mobileHelpers.validateTouchTargetSize(addAliasButton);
          expect(touchValidation.isAccessible).toBeTruthy();

          await addAliasButton.tap();
          await page.waitForTimeout(300);

          // Check for alias form modal
          const aliasModal = page.locator('[data-testid="alias-modal"], .alias-modal');
          if (await aliasModal.isVisible()) {
            await expect(aliasModal).toBeVisible();

            // Test alias form fields
            const aliasInput = aliasModal.locator('input[name="alias"], [data-testid="alias-input"]');
            if (await aliasInput.isVisible()) {
              await aliasInput.tap();
              await aliasInput.fill('Test Alias');
              await page.keyboard.press('Escape'); // Close modal
            }
          }
        }
      }
    });

    test('should handle related projects view on mobile', async ({ page }) => {
      const employerId = testEmployers[0].id;
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');

      // Look for related projects section
      const projectsSection = page.locator(
        '[data-testid="employer-projects"], ' +
        '.employer-projects, ' +
        'section:has-text("project" i)'
      );

      if (await projectsSection.isVisible()) {
        const projectCards = projectsSection.locator('[data-testid="project-card"], .project-card');
        const projectCount = await projectCards.count();

        // Test first few project cards
        for (let i = 0; i < Math.min(projectCount, 3); i++) {
          const card = projectCards.nth(i);
          await expect(card).toBeVisible();

          // Check project card touch target
          const touchValidation = await mobileHelpers.validateTouchTargetSize(card);
          if (!touchValidation.isAccessible) {
            console.warn(`Project card touch target too small: ${touchValidation.size.width}x${touchValidation.size.height}px`);
          }
        }

        // Test navigation to project if cards are clickable
        if (projectCount > 0) {
          const firstCard = projectCards.first();
          const isClickable = await firstCard.locator('a').count() > 0;

          if (isClickable) {
            await firstCard.tap();
            await page.waitForTimeout(500);
            await expect(page.url()).toContain('/projects');
            await page.goBack();
          }
        }
      }
    });
  });

  test.describe('Employer Actions and Interactions', () => {
    test('should handle employer editing on mobile', async ({ page }) => {
      const employerId = testEmployers[0].id;
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');

      // Look for edit button
      const editButton = page.locator(
        'button:has-text("Edit"), ' +
        '[data-testid="edit-employer-button"], ' +
        '.edit-button'
      );

      if (await editButton.isVisible()) {
        const touchValidation = await mobileHelpers.validateTouchTargetSize(editButton);
        expect(touchValidation.isAccessible).toBeTruthy();

        await editButton.tap();
        await page.waitForTimeout(300);

        // Check for edit form
        const editForm = page.locator('[data-testid="edit-form"], form.edit-form');
        if (await editForm.isVisible()) {
          await expect(editForm).toBeVisible();

          // Test form field interactions
          const formInputs = editForm.locator('input, textarea, select');
          const inputCount = await formInputs.count();

          for (let i = 0; i < Math.min(inputCount, 3); i++) {
            const input = formInputs.nth(i);
            await expect(input).toBeVisible();

            await input.tap();
            await page.waitForTimeout(100);
            await page.keyboard.press('Tab');
          }

          // Cancel edit
          await page.locator('button:has-text("Cancel"), .cancel-button').first().tap();
        }
      }
    });

    test('should handle employer deletion on mobile', async ({ page }) => {
      const employerId = testEmployers[1].id; // Use different employer for deletion test
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');

      // Look for delete button
      const deleteButton = page.locator(
        'button:has-text("Delete"), ' +
        '[data-testid="delete-employer-button"], ' +
        '.delete-button'
      );

      if (await deleteButton.isVisible()) {
        await deleteButton.tap();
        await page.waitForTimeout(300);

        // Check for confirmation dialog
        const confirmDialog = page.locator('[role="dialog"], .confirm-dialog');
        if (await confirmDialog.isVisible()) {
          await expect(confirmDialog).toBeVisible();

          // Find cancel button to avoid actual deletion
          const cancelButton = confirmDialog.locator('button:has-text("Cancel"), .cancel-button');
          await cancelButton.tap();
        }
      }
    });
  });

  test.describe('Responsive Design Tests', () => {
    Object.entries(mobileBreakpoints).forEach(([deviceName, viewport]) => {
      test(`should adapt employer views for ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/employers');
        await page.waitForLoadState('networkidle');

        // Check viewport overflow
        const overflowCheck = await mobileHelpers.checkViewportOverflow();
        expect(overflowCheck.hasOverflow).toBeFalsy();

        // Test navigation to employer detail
        const firstEmployer = page.locator('[data-testid="employer-card"], tr[data-employer-id]').first();
        if (await firstEmployer.isVisible()) {
          await firstEmployer.tap();
          await page.waitForTimeout(500);

          // Check detail view adaptation
          const detailOverflow = await mobileHelpers.checkViewportOverflow();
          expect(detailOverflow.hasOverflow).toBeFalsy();
        }
      });
    });
  });

  test.describe('Performance Tests', () => {
    test('should load employer pages quickly on mobile', async ({ page }) => {
      // Test employer listing performance
      const listingStart = Date.now();
      await page.goto('/employers');
      await page.waitForLoadState('networkidle');
      const listingTime = Date.now() - listingStart;

      expect(listingTime).toBeLessThan(3000);
      console.log(`Employer listing loaded in ${listingTime}ms`);

      // Test employer detail performance
      const employerId = testEmployers[0].id;
      const detailStart = Date.now();
      await page.goto(`/employers/${employerId}`);
      await page.waitForLoadState('networkidle');
      const detailTime = Date.now() - detailStart;

      expect(detailTime).toBeLessThan(2000);
      console.log(`Employer detail loaded in ${detailTime}ms`);
    });

    test('should handle large employer lists on mobile', async ({ page }) => {
      await mobileHelpers.setNetworkConditions('slow3g');

      const startTime = Date.now();
      await page.goto('/employers');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Even with slow network, should load within reasonable time
      expect(loadTime).toBeLessThan(15000);

      // Check if virtual scrolling or pagination is used
      const virtualScroll = page.locator('[data-testid="virtual-scroll"], .virtual-scroll');
      const pagination = page.locator('[data-testid="pagination"], .pagination');

      const hasPerformanceOptimization = await virtualScroll.isVisible() || await pagination.isVisible();
      expect(hasPerformanceOptimization).toBeTruthy();

      await mobileHelpers.setNetworkConditions('online');
    });
  });
});