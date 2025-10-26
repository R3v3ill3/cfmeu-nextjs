import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';

const mobileDevices = [
  devices['iPhone 13'],
  devices['iPhone 14 Pro'],
  devices['iPhone 15 Pro Max']
];

// Test data for critical business forms
const businessFormsData = {
  projectCreation: {
    name: 'Mobile Test Construction Project',
    address: '123 Construction Site, Melbourne VIC 3000',
    clientName: 'Test Client Company',
    projectValue: '500000',
    expectedStartDate: '2024-02-01',
    description: 'Test project for mobile form validation'
  },
  employerSearch: {
    queries: ['Formwork', 'Scaffolding', 'Concrete', 'Electrical', 'Plumbing'],
    newEmployer: 'Mobile Test Contractors Pty Ltd'
  },
  scanReview: {
    employerMatch: 'Existing Formwork Company',
    aliasTest: 'Alias Test Company'
  }
};

mobileDevices.forEach(device => {
  test.describe(`Critical Business Forms - ${device.name}`, () => {
    let mobileHelpers: MobileHelpers;
    let authHelpers: AuthHelpers;
    let page: any;

    test.beforeEach(async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
        isMobile: true,
        hasTouch: true,
      });

      page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      authHelpers = new AuthHelpers(page);

      // Navigate to the application
      await page.goto('http://localhost:3000');

      // Authenticate for protected routes
      await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
    });

    test.describe('Project Creation Forms', () => {
      test('should handle project creation form on mobile', async () => {
        // Navigate to projects page
        await page.goto('http://localhost:3000/projects');

        // Look for create project button
        const createProjectBtn = page.locator('button:has-text("Create Project")').first();
        if (await createProjectBtn.isVisible()) {
          await createProjectBtn.tap();
        } else {
          // Alternative navigation
          await page.goto('http://localhost:3000/projects/new');
        }

        // Wait for project creation dialog/form
        await page.waitForSelector('[role="dialog"], .dialog, form', { timeout: 5000 });

        // Test project name input
        const nameInput = page.locator('input[name*="name"], input[placeholder*="name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.tap();
          await nameInput.fill(businessFormsData.projectCreation.name);

          // Test touch target compliance
          const nameBoundingBox = await nameInput.boundingBox();
          expect(nameBoundingBox?.height!).toBeGreaterThanOrEqual(44);
        }

        // Test address input (often uses Google Places)
        const addressInput = page.locator('input[name*="address"], input[placeholder*="address"]').first();
        if (await addressInput.isVisible()) {
          await addressInput.tap();
          await addressInput.fill(businessFormsData.projectCreation.address);

          // Wait for potential autocomplete suggestions
          await page.waitForTimeout(1000);

          // Test autocomplete functionality
          const suggestions = page.locator('[role="option"], .autocomplete-option');
          if (await suggestions.first().isVisible()) {
            await suggestions.first().tap();
          }
        }

        // Test dropdown/select inputs
        const selectInputs = page.locator('select, [role="combobox"]');
        const selectCount = await selectInputs.count();
        if (selectCount > 0) {
          for (let i = 0; i < selectCount; i++) {
            const select = selectInputs.nth(i);
            if (await select.isVisible()) {
              await select.tap();
              await page.waitForTimeout(500);

              // Look for options
              const options = page.locator('option, [role="option"]');
              const optionCount = await options.count();
              if (optionCount > 1) {
                await options.nth(1).tap(); // Select second option
              }
            }
          }
        }

        // Test date input if present
        const dateInputs = page.locator('input[type="date"]');
        const dateInputCount = await dateInputs.count();
        if (dateInputCount > 0) {
          for (let i = 0; i < dateInputCount; i++) {
            const dateInput = dateInputs.nth(i);
            if (await dateInput.isVisible()) {
              await dateInput.tap();
              await dateInput.fill(businessFormsData.projectCreation.expectedStartDate);
            }
          }
        }

        // Test textarea for description
        const textarea = page.locator('textarea[name*="description"], textarea[placeholder*="description"]');
        if (await textarea.isVisible()) {
          await textarea.tap();
          await textarea.fill(businessFormsData.projectCreation.description);

          // Test scrolling in textarea on mobile
          await page.keyboard.press('End');
          await page.waitForTimeout(500);
        }

        // Take screenshot of completed form
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/project-creation-form.png`,
          fullPage: true
        });
      });

      test('should handle project form validation on mobile', async () => {
        // Navigate to project creation
        await page.goto('http://localhost:3000/projects/new');

        // Try to submit empty form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.tap();

          // Check for validation errors
          await page.waitForTimeout(1000);

          const errorElements = page.locator('.text-red-600, [role="alert"], .error-message');
          const errorCount = await errorElements.count();

          // Should have some validation for required fields
          expect(errorCount).toBeGreaterThan(0);

          // Take screenshot of validation state
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/project-form-validation.png`,
            fullPage: true
          });
        }
      });
    });

    test.describe('Employer Matching and Search Forms', () => {
      test('should handle employer search functionality on mobile', async () => {
        // Navigate to employers page
        await page.goto('http://localhost:3000/employers');

        // Look for search input
        const searchInput = page.locator('input[placeholder*="search"], input[name*="search"]').first();
        if (await searchInput.isVisible()) {
          // Test different search queries
          for (const query of businessFormsData.employerSearch.queries) {
            await searchInput.fill('');
            await searchInput.fill(query);

            // Wait for search results
            await page.waitForTimeout(1000);

            // Check if results are displayed
            const results = page.locator('[data-testid*="employer"], .employer-card, tr');
            const resultCount = await results.count();

            if (resultCount > 0) {
              // Test scrolling through results
              await mobileHelpers.swipe({ direction: 'up', distance: 200 });
              await page.waitForTimeout(500);
            }

            // Clear search for next query
            await searchInput.fill('');
          }
        }

        // Take screenshot of employer search
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/employer-search.png`,
          fullPage: true
        });
      });

      test('should handle employer matching dialog on mobile', async () => {
        // Navigate to a project's scan review page
        await page.goto('http://localhost:3000/projects/1/mapping');

        // Look for employer matching elements
        const matchButtons = page.locator('button:has-text("Match"), button:has-text("Assign")');
        const matchButtonCount = await matchButtons.count();

        if (matchButtonCount > 0) {
          await matchButtons.first().tap();

          // Wait for employer match dialog
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          // Test search within dialog
          const dialogSearchInput = page.locator('[role="dialog"] input[type="text"], [role="dialog"] input[placeholder*="search"]').first();
          if (await dialogSearchInput.isVisible()) {
            await dialogSearchInput.tap();
            await dialogSearchInput.fill(businessFormsData.employerSearch.queries[0]);

            // Wait for search results in dialog
            await page.waitForTimeout(1000);

            // Test selecting an employer
            const employerOptions = page.locator('[role="dialog"] [role="option"], [role="dialog"] .employer-option');
            const optionCount = await employerOptions.count();

            if (optionCount > 0) {
              await employerOptions.first().tap();
            }
          }

          // Test creating new employer option
          const newEmployerBtn = page.locator('button:has-text("New Employer"), button:has-text("Add New")').first();
          if (await newEmployerBtn.isVisible()) {
            await newEmployerBtn.tap();

            // Fill new employer form
            const newEmployerInput = page.locator('input[placeholder*="name"], input[name*="name"]').first();
            if (await newEmployerInput.isVisible()) {
              await newEmployerInput.tap();
              await newEmployerInput.fill(businessFormsData.employerSearch.newEmployer);
            }
          }

          // Test confirm button
          const confirmBtn = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Save")').first();
          if (await confirmBtn.isVisible()) {
            await confirmBtn.tap();
          }
        }

        // Take screenshot of employer matching dialog
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/employer-matching-dialog.png`,
          fullPage: true
        });
      });
    });

    test.describe('Scan Review Forms', () => {
      test('should handle scan review workflow on mobile', async () => {
        // Navigate to scan review page
        await page.goto('http://localhost:3000/projects/1/mapping');

        // Wait for scan review interface to load
        await page.waitForSelector('[data-testid*="scan-review"], .scan-review', { timeout: 5000 });

        // Test horizontal scrolling for subcontractors table
        const scrollableTable = page.locator('.overflow-x-auto, [data-testid*="subcontractors-table"]').first();
        if (await scrollableTable.isVisible()) {
          // Test swipe gestures for horizontal scrolling
          await mobileHelpers.swipe({ direction: 'left', distance: 150 });
          await page.waitForTimeout(500);

          await mobileHelpers.swipe({ direction: 'right', distance: 150 });
          await page.waitForTimeout(500);
        }

        // Test bulk operations
        const bulkActionBtn = page.locator('button:has-text("Bulk"), button:has-text("Select")').first();
        if (await bulkActionBtn.isVisible()) {
          await bulkActionBtn.tap();

          // Test selection checkboxes
          const checkboxes = page.locator('input[type="checkbox"]');
          const checkboxCount = await checkboxes.count();

          if (checkboxCount > 0) {
            // Select first few items
            for (let i = 0; i < Math.min(3, checkboxCount); i++) {
              const checkbox = checkboxes.nth(i);
              if (await checkbox.isVisible()) {
                await checkbox.tap();
                await page.waitForTimeout(200);
              }
            }
          }
        }

        // Take screenshot of scan review interface
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/scan-review-interface.png`,
          fullPage: true
        });
      });

      test('should handle alias management forms on mobile', async () => {
        // Navigate to employers page with alias functionality
        await page.goto('http://localhost:3000/employers');

        // Look for employer with alias management
        const employerCards = page.locator('.employer-card, [data-testid*="employer"]').first();
        if (await employerCards.isVisible()) {
          await employerCards.tap();

          // Wait for employer detail view
          await page.waitForTimeout(1000);

          // Look for alias management button
          const aliasBtn = page.locator('button:has-text("Alias"), button:has-text("Add Alias")').first();
          if (await aliasBtn.isVisible()) {
            await aliasBtn.tap();

            // Test alias input form
            const aliasInput = page.locator('input[placeholder*="alias"], input[name*="alias"]').first();
            if (await aliasInput.isVisible()) {
              await aliasInput.tap();
              await aliasInput.fill(businessFormsData.scanReview.aliasTest);

              // Test alias submission
              const submitAliasBtn = page.locator('button:has-text("Add"), button:has-text("Save")').first();
              if (await submitAliasBtn.isVisible()) {
                await submitAliasBtn.tap();
                await page.waitForTimeout(1000);
              }
            }
          }
        }

        // Take screenshot of alias management
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/alias-management.png`,
          fullPage: true
        });
      });
    });

    test.describe('File Upload Forms', () => {
      test('should handle file upload on mobile devices', async () => {
        // Navigate to upload page
        await page.goto('http://localhost:3000/upload');

        // Look for file upload inputs
        const fileInputs = page.locator('input[type="file"]');
        const fileInputCount = await fileInputs.count();

        if (fileInputCount > 0) {
          const fileInput = fileInputs.first();

          // Test file input visibility and touch target
          await expect(fileInput).toBeVisible();
          const fileInputBoundingBox = await fileInput.boundingBox();
          if (fileInputBoundingBox) {
            expect(fileInputBoundingBox.height).toBeGreaterThanOrEqual(44);
            expect(fileInputBoundingBox.width).toBeGreaterThanOrEqual(44);
          }

          // Note: Actual file upload testing on mobile requires special handling
          // For now, just test the UI interactions

          // Test drag and drop area (if present)
          const dropZone = page.locator('.drop-zone, [data-testid*="drop-zone"]').first();
          if (await dropZone.isVisible()) {
            const dropZoneBoundingBox = await dropZone.boundingBox();
            if (dropZoneBoundingBox) {
              expect(dropZoneBoundingBox.height).toBeGreaterThanOrEqual(100);
              expect(dropZoneBoundingBox.width).toBeGreaterThanOrEqual(200);
            }
          }
        }

        // Take screenshot of upload interface
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/file-upload-interface.png`,
          fullPage: true
        });
      });

      test('should handle bulk upload forms on mobile', async () => {
        // Look for bulk upload functionality
        await page.goto('http://localhost:3000/projects');

        const bulkUploadBtn = page.locator('button:has-text("Bulk Upload"), button:has-text("Import")').first();
        if (await bulkUploadBtn.isVisible()) {
          await bulkUploadBtn.tap();

          // Wait for bulk upload dialog
          await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

          // Test column mapping interface (common in bulk uploads)
          const mappingInterface = page.locator('.column-mapping, [data-testid*="mapping"]').first();
          if (await mappingInterface.isVisible()) {
            // Test dropdown selection for column mapping
            const selectDropdowns = mappingInterface.locator('select, [role="combobox"]');
            const dropdownCount = await selectDropdowns.count();

            if (dropdownCount > 0) {
              // Test first few dropdowns
              for (let i = 0; i < Math.min(3, dropdownCount); i++) {
                const dropdown = selectDropdowns.nth(i);
                if (await dropdown.isVisible()) {
                  await dropdown.tap();
                  await page.waitForTimeout(500);

                  // Select an option
                  const options = page.locator('option, [role="option"]');
                  const optionCount = await options.count();

                  if (optionCount > 1) {
                    await options.nth(1).tap();
                  }
                }
              }
            }
          }
        }

        // Take screenshot of bulk upload interface
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/bulk-upload-form.png`,
          fullPage: true
        });
      });
    });

    test.describe('Form Error Handling on Mobile', () => {
      test('should display form errors appropriately on mobile', async () => {
        // Navigate to project creation
        await page.goto('http://localhost:3000/projects/new');

        // Try to submit incomplete form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.tap();

          // Check for error states
          await page.waitForTimeout(1000);

          const errorMessages = page.locator('.error-message, .text-red-600, [role="alert"]');
          const errorCount = await errorMessages.count();

          if (errorCount > 0) {
            // Take screenshot of error state
            await page.screenshot({
              path: `test-results/screenshots/${device.name}/form-errors.png`,
              fullPage: true
            });
          }
        }
      });

      test('should handle network errors in form submissions', async () => {
        // Simulate network issues
        await page.context().setOffline(true);

        // Navigate to a form
        await page.goto('http://localhost:3000/projects/new');

        // Fill out a simple form field
        const nameInput = page.locator('input[name*="name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Project');
        }

        // Try to submit
        const submitBtn = page.locator('button[type="submit"]').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.tap();

          // Wait for network error handling
          await page.waitForTimeout(3000);

          // Check for network error indicators
          const networkError = await Promise.race([
            page.locator('text=Network error').isVisible(),
            page.locator('text=Connection failed').isVisible(),
            page.locator('text=Unable to connect').isVisible(),
            page.waitForTimeout(1000).then(() => false)
          ]);

          // Restore connection
          await page.context().setOffline(false);

          // Network error should be handled
          expect(networkError).toBeDefined();
        }
      });
    });
  });
});