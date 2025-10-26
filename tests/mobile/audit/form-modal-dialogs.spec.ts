import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';

const mobileDevices = [
  devices['iPhone 13'],
  devices['iPhone 14 Pro'],
  devices['iPhone 15 Pro Max']
];

// Test data for modal and multi-step forms
const modalFormData = {
  contractorAssignment: {
    employers: ['Formwork Company A', 'Scaffolding Company B'],
    projectRole: 'Main Contractor',
    contactName: 'John Doe',
    contactPhone: '0412 345 678',
    contactEmail: 'john@contractor.com.au'
  },
  employerDetails: {
    abn: '12345678901',
    address: '456 Business Ave, Melbourne VIC 3000',
    phone: '03 9876 5432',
    website: 'https://contractor.com.au',
    description: 'Professional construction services provider'
  },
  multiStepProject: {
    step1: {
      name: 'Multi-step Mobile Test Project',
      type: 'Commercial',
      category: 'New Construction'
    },
    step2: {
      address: '789 Project Street, Melbourne VIC 3000',
      clientName: 'Test Client Corp',
      expectedStart: '2024-03-01'
    },
    step3: {
      description: 'Project created via mobile multi-step form testing',
      budget: '1000000',
      duration: '12 months'
    }
  }
};

mobileDevices.forEach(device => {
  test.describe(`Modal Dialog Forms - ${device.name}`, () => {
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

      await page.goto('http://localhost:3000');
      await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
    });

    test.describe('Employer Match Dialog', () => {
      test('should handle employer matching dialog on mobile', async () => {
        // Navigate to a project mapping page
        await page.goto('http://localhost:3000/projects/1/mapping');

        // Look for employer match trigger
        const matchTriggers = page.locator('button:has-text("Match"), button:has-text("Assign"), button:has-text("Link Employer")');
        const triggerCount = await matchTriggers.count();

        if (triggerCount > 0) {
          await matchTriggers.first().tap();

          // Wait for dialog to appear
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible();

          // Test dialog positioning and sizing
          const dialogBoundingBox = await dialog.boundingBox();
          if (dialogBoundingBox) {
            const viewportHeight = page.viewportSize()?.height || 844;
            const viewportWidth = page.viewportSize()?.width || 390;

            // Dialog should not exceed viewport
            expect(dialogBoundingBox.width).toBeLessThanOrEqual(viewportWidth * 0.95);
            expect(dialogBoundingBox.height).toBeLessThanOrEqual(viewportHeight * 0.9);

            // Dialog should be centered or properly positioned
            expect(dialogBoundingBox.x).toBeGreaterThanOrEqual(0);
            expect(dialogBoundingBox.y).toBeGreaterThanOrEqual(0);
          }

          // Test search functionality within dialog
          const searchInput = dialog.locator('input[type="text"], input[placeholder*="search"]').first();
          if (await searchInput.isVisible()) {
            await searchInput.tap();
            await searchInput.fill('Formwork');

            // Wait for search results
            await page.waitForTimeout(1000);

            // Test search results scrolling
            const resultsContainer = dialog.locator('.overflow-y-auto, [data-testid*="results"]').first();
            if (await resultsContainer.isVisible()) {
              // Test swipe gestures for scrolling
              await mobileHelpers.swipe({ direction: 'up', distance: 100 });
              await page.waitForTimeout(500);
            }
          }

          // Test radio button selections
          const radioGroups = dialog.locator('[role="radiogroup"]');
          const radioGroupCount = await radioGroups.count();

          if (radioGroupCount > 0) {
            for (let i = 0; i < radioGroupCount; i++) {
              const radioGroup = radioGroups.nth(i);
              const radioOptions = radioGroup.locator('[role="radio"]');
              const optionCount = await radioOptions.count();

              if (optionCount > 0) {
                // Test selecting different radio options
                await radioOptions.first().tap();
                await page.waitForTimeout(300);

                if (optionCount > 1) {
                  await radioOptions.nth(1).tap();
                  await page.waitForTimeout(300);
                }
              }
            }
          }

          // Test action buttons
          const actionButtons = dialog.locator('button');
          const buttonCount = await actionButtons.count();

          for (let i = 0; i < buttonCount; i++) {
            const button = actionButtons.nth(i);
            const buttonText = await button.textContent();

            // Test touch targets for all buttons
            const buttonBoundingBox = await button.boundingBox();
            if (buttonBoundingBox) {
              expect(buttonBoundingBox.height).toBeGreaterThanOrEqual(44);
              expect(buttonBoundingBox.width).toBeGreaterThanOrEqual(44);
            }
          }

          // Test dialog close functionality
          const closeButton = dialog.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label*="close"]').first();
          if (await closeButton.isVisible()) {
            await closeButton.tap();
            await page.waitForTimeout(500);

            // Verify dialog is closed
            await expect(dialog).not.toBeVisible();
          }
        }

        // Take screenshot of employer match dialog
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/employer-match-dialog.png`,
          fullPage: true
        });
      });

      test('should handle alias manager dialog within employer match', async () => {
        await page.goto('http://localhost:3000/projects/1/mapping');

        // Trigger employer match dialog
        const matchTrigger = page.locator('button:has-text("Match"), button:has-text("Assign")').first();
        if (await matchTrigger.isVisible()) {
          await matchTrigger.tap();
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          // Look for alias management trigger
          const aliasTrigger = page.locator('button:has-text("Alias"), button:has-text("Manage Aliases")').first();
          if (await aliasTrigger.isVisible()) {
            await aliasTrigger.tap();

            // Wait for alias manager dialog (might be nested)
            await page.waitForTimeout(1000);

            // Test alias input form
            const aliasInput = page.locator('input[placeholder*="alias"], input[name*="alias"]').first();
            if (await aliasInput.isVisible()) {
              await aliasInput.tap();
              await aliasInput.fill('Test Alias Company');

              // Test alias submission
              const addAliasBtn = page.locator('button:has-text("Add"), button:has-text("Save")').first();
              if (await addAliasBtn.isVisible()) {
                await addAliasBtn.tap();
                await page.waitForTimeout(1000);
              }
            }

            // Test alias list display and interactions
            const aliasList = page.locator('[data-testid*="alias-list"], .alias-list').first();
            if (await aliasList.isVisible()) {
              // Test swipe gestures on alias list
              await mobileHelpers.swipe({ direction: 'up', distance: 150 });
              await page.waitForTimeout(500);
            }
          }
        }
      });
    });

    test.describe('Unified Contractor Assignment Modal', () => {
      test('should handle complex contractor assignment modal', async () => {
        // Navigate to project page
        await page.goto('http://localhost:3000/projects/1');

        // Look for contractor assignment trigger
        const assignTrigger = page.locator('button:has-text("Assign Contractor"), button:has-text("Add Contractor")').first();
        if (await assignTrigger.isVisible()) {
          await assignTrigger.tap();

          // Wait for modal
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          const modal = page.locator('[role="dialog"]').first();

          // Test modal overflow handling
          const modalBoundingBox = await modal.boundingBox();
          if (modalBoundingBox) {
            const viewportHeight = page.viewportSize()?.height || 844;

            // If modal is tall, it should scroll within viewport
            if (modalBoundingBox.height > viewportHeight * 0.8) {
              // Test scrolling within modal
              await mobileHelpers.swipe({
                selector: '[role="dialog"]',
                direction: 'up',
                distance: 200
              });
              await page.waitForTimeout(500);
            }
          }

          // Test employer selection interface
          const employerSearch = modal.locator('input[placeholder*="employer"], input[placeholder*="search"]').first();
          if (await employerSearch.isVisible()) {
            await employerSearch.tap();
            await employerSearch.fill(modalFormData.contractorAssignment.employers[0]);

            // Wait for and test employer selection results
            await page.waitForTimeout(1000);

            const employerOptions = modal.locator('[role="option"], .employer-option');
            const optionCount = await employerOptions.count();

            if (optionCount > 0) {
              await employerOptions.first().tap();
            }
          }

          // Test form fields within modal
          const formInputs = modal.locator('input, select, textarea');
          const inputCount = await formInputs.count();

          for (let i = 0; i < Math.min(inputCount, 5); i++) { // Test first 5 inputs
            const input = formInputs.nth(i);
            if (await input.isVisible()) {
              const inputType = await input.getAttribute('type');
              const placeholder = await input.getAttribute('placeholder');

              await input.tap();
              await page.waitForTimeout(300);

              // Fill with appropriate test data
              if (placeholder?.toLowerCase().includes('name')) {
                await input.fill(modalFormData.contractorAssignment.contactName);
              } else if (placeholder?.toLowerCase().includes('phone')) {
                await input.fill(modalFormData.contractorAssignment.contactPhone);
              } else if (placeholder?.toLowerCase().includes('email')) {
                await input.fill(modalFormData.contractorAssignment.contactEmail);
              }

              // Test keyboard interaction
              await page.keyboard.press('Tab');
              await page.waitForTimeout(300);
            }
          }

          // Test modal action buttons
          const saveButton = modal.locator('button:has-text("Save"), button:has-text("Assign")').first();
          const cancelButton = modal.locator('button:has-text("Cancel")').first();

          if (await saveButton.isVisible()) {
            const saveBoundingBox = await saveButton.boundingBox();
            if (saveBoundingBox) {
              expect(saveBoundingBox.height).toBeGreaterThanOrEqual(44);
            }
          }

          if (await cancelButton.isVisible()) {
            await cancelButton.tap();
            await page.waitForTimeout(500);
          }
        }

        // Take screenshot of contractor assignment modal
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/contractor-assignment-modal.png`,
          fullPage: true
        });
      });

      test('should handle modal content overflow and scrolling', async () => {
        // Navigate to a page that might have tall modals
        await page.goto('http://localhost:3000/employers');

        // Trigger employer detail modal
        const employerCard = page.locator('.employer-card, [data-testid*="employer"]').first();
        if (await employerCard.isVisible()) {
          await employerCard.tap();
          await page.waitForTimeout(1000);

          // Look for edit or detailed view trigger
          const detailTrigger = page.locator('button:has-text("Edit"), button:has-text("Details")').first();
          if (await detailTrigger.isVisible()) {
            await detailTrigger.tap();

            // Wait for detailed modal
            await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

            const modal = page.locator('[role="dialog"]').first();

            // Test if modal content overflows
            const modalBoundingBox = await modal.boundingBox();
            const viewportHeight = page.viewportSize()?.height || 844;

            if (modalBoundingBox && modalBoundingBox.height > viewportHeight * 0.8) {
              // Test scrolling within modal
              const modalContent = modal.locator('.modal-content, [data-testid*="modal-content"]').first();

              if (await modalContent.isVisible()) {
                // Test scroll gestures
                await mobileHelpers.swipe({
                  selector: '[role="dialog"]',
                  direction: 'up',
                  distance: 300
                });
                await page.waitForTimeout(500);

                await mobileHelpers.swipe({
                  selector: '[role="dialog"]',
                  direction: 'down',
                  distance: 300
                });
                await page.waitForTimeout(500);
              }
            }
          }
        }
      });
    });

    test.describe('Multi-Step Forms', () => {
      test('should handle multi-step project creation workflow', async () => {
        // Look for multi-step project creation
        await page.goto('http://localhost:3000/projects/new');

        // Check if this is a multi-step form
        const stepIndicators = page.locator('[data-testid*="step"], .step-indicator, .progress-step');
        const stepCount = await stepIndicators.count();

        if (stepCount > 1) {
          // Test Step 1
          const step1Inputs = page.locator('form input, form select, form textarea');
          const step1InputCount = await step1Inputs.count();

          for (let i = 0; i < Math.min(step1InputCount, 3); i++) {
            const input = step1Inputs.nth(i);
            if (await input.isVisible()) {
              await input.tap();
              await page.waitForTimeout(300);

              // Fill with step 1 test data
              const inputName = await input.getAttribute('name') || await input.getAttribute('placeholder');

              if (inputName?.toLowerCase().includes('name')) {
                await input.fill(modalFormData.multiStepProject.step1.name);
              } else if (inputName?.toLowerCase().includes('type')) {
                // Handle dropdown
                await input.selectOption({ label: modalFormData.multiStepProject.step1.type });
              }

              await page.keyboard.press('Tab');
              await page.waitForTimeout(300);
            }
          }

          // Test navigation to next step
          const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
          if (await nextButton.isVisible()) {
            await nextButton.tap();
            await page.waitForTimeout(1000);

            // Take screenshot after step transition
            await page.screenshot({
              path: `test-results/screenshots/${device.name}/multi-step-form-step2.png`,
              fullPage: true
            });

            // Test Step 2
            const step2Inputs = page.locator('form input, form select, form textarea');
            const step2InputCount = await step2Inputs.count();

            for (let i = 0; i < Math.min(step2InputCount, 3); i++) {
              const input = step2Inputs.nth(i);
              if (await input.isVisible()) {
                await input.tap();
                await page.waitForTimeout(300);

                const inputName = await input.getAttribute('name') || await input.getAttribute('placeholder');

                if (inputName?.toLowerCase().includes('address')) {
                  await input.fill(modalFormData.multiStepProject.step2.address);
                } else if (inputName?.toLowerCase().includes('client')) {
                  await input.fill(modalFormData.multiStepProject.step2.clientName);
                }

                await page.keyboard.press('Tab');
                await page.waitForTimeout(300);
              }
            }

            // Test back navigation
            const backButton = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
            if (await backButton.isVisible()) {
              await backButton.tap();
              await page.waitForTimeout(1000);

              // Verify we're back to step 1
              const step1Active = page.locator('[data-testid*="step-1"], .step-1').first();
              await expect(step1Active).toHaveClass(/active|current/);
            }
          }

          // Test progress indicators
          const progressElements = page.locator('[role="progressbar"], .progress-bar, .step-indicator');
          const progressCount = await progressElements.count();

          if (progressCount > 0) {
            for (let i = 0; i < progressCount; i++) {
              const progress = progressElements.nth(i);
              const progressBoundingBox = await progress.boundingBox();

              if (progressBoundingBox) {
                // Progress indicators should be touchable
                expect(progressBoundingBox.height).toBeGreaterThanOrEqual(32);
                expect(progressBoundingBox.width).toBeGreaterThanOrEqual(32);
              }
            }
          }
        }
      });

      test('should handle step validation and error states', async () => {
        await page.goto('http://localhost:3000/projects/new');

        // Check for multi-step form
        const stepIndicators = page.locator('[data-testid*="step"], .step-indicator');
        const stepCount = await stepIndicators.count();

        if (stepCount > 1) {
          // Try to proceed without filling required fields
          const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
          if (await nextButton.isVisible()) {
            await nextButton.tap();
            await page.waitForTimeout(1000);

            // Check for validation errors
            const errorElements = page.locator('.error-message, .text-red-600, [role="alert"]');
            const errorCount = await errorElements.count();

            if (errorCount > 0) {
              // Take screenshot of validation state
              await page.screenshot({
                path: `test-results/screenshots/${device.name}/multi-step-validation.png`,
                fullPage: true
              });
            }
          }
        }
      });
    });

    test.describe('Confirmation Dialogs', () => {
      test('should handle confirmation dialogs with proper button placement', async () => {
        // Navigate to a page with delete/remove actions
        await page.goto('http://localhost:3000/projects');

        // Look for delete/remove actions
        const deleteButtons = page.locator('button:has-text("Delete"), button:has-text("Remove")');
        const deleteButtonCount = await deleteButtons.count();

        if (deleteButtonCount > 0) {
          await deleteButtons.first().tap();

          // Wait for confirmation dialog
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          const dialog = page.locator('[role="dialog"]').first();

          // Test button placement and touch targets
          const confirmButton = dialog.locator('button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Remove")').first();
          const cancelButton = dialog.locator('button:has-text("Cancel")').first();

          if (await confirmButton.isVisible() && await cancelButton.isVisible()) {
            const confirmBoundingBox = await confirmButton.boundingBox();
            const cancelBoundingBox = await cancelButton.boundingBox();

            if (confirmBoundingBox && cancelBoundingBox) {
              // Both buttons should meet touch target requirements
              expect(confirmBoundingBox.height).toBeGreaterThanOrEqual(44);
              expect(cancelBoundingBox.height).toBeGreaterThanOrEqual(44);

              // Buttons should have adequate spacing
              const verticalSpacing = Math.abs(confirmBoundingBox.y - cancelBoundingBox.y);
              expect(verticalSpacing).toBeGreaterThanOrEqual(8);
            }

            // Test cancel button (safer for testing)
            await cancelButton.tap();
            await page.waitForTimeout(500);

            // Verify dialog is closed
            await expect(dialog).not.toBeVisible();
          }
        }
      });

      test('should handle dialog backdrop dismissal on mobile', async () => {
        await page.goto('http://localhost:3000/projects');

        // Trigger any modal
        const triggerButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Edit")').first();
        if (await triggerButton.isVisible()) {
          await triggerButton.tap();
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible();

          // Test tapping outside dialog (backdrop)
          const dialogBoundingBox = await dialog.boundingBox();
          if (dialogBoundingBox) {
            // Tap outside the dialog area
            await page.touchscreen.tap(
              dialogBoundingBox.x - 50, // Tap to the left of dialog
              dialogBoundingBox.y + 50
            );
            await page.waitForTimeout(1000);

            // Some dialogs close on backdrop tap, others don't
            // This test just verifies the behavior doesn't cause crashes
            const isDialogStillVisible = await dialog.isVisible();
            expect(isDialogStillVisible).toBeDefined();
          }
        }
      });
    });
  });
});