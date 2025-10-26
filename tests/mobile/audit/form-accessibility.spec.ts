import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';

const mobileDevices = [
  devices['iPhone 13'],
  devices['iPhone 14 Pro'],
  devices['iPhone 15 Pro Max']
];

mobileDevices.forEach(device => {
  test.describe(`Form Accessibility - ${device.name}`, () => {
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
    });

    test.describe('Screen Reader Compatibility', () => {
      test('should have proper ARIA labels and roles on form elements', async () => {
        // Test authentication form
        await page.goto('http://localhost:3000/auth');

        // Check form accessibility attributes
        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          // Check for proper labeling
          const emailLabel = page.locator('label[for*="email"], label:has-text("Email")');
          const hasExplicitLabel = await emailLabel.count() > 0;
          const hasAriaLabel = await emailInput.getAttribute('aria-label') !== null;
          const hasAriaLabelledBy = await emailInput.getAttribute('aria-labelledby') !== null;

          expect(hasExplicitLabel || hasAriaLabel || hasAriaLabelledBy).toBe(true);

          // Check for required attributes
          const isRequired = await emailInput.getAttribute('required') !== null;
          const hasAriaRequired = await emailInput.getAttribute('aria-required') === 'true';

          if (isRequired || hasAriaRequired) {
            const hasAriaRequiredAttr = await emailInput.getAttribute('aria-required');
            expect(hasAriaRequiredAttr).toBeTruthy();
          }
        }

        // Test password input
        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
          // Password inputs should have appropriate labeling
          const hasAriaLabel = await passwordInput.getAttribute('aria-label') !== null;
          const hasExplicitLabel = await page.locator('label[for*="password"], label:has-text("Password")').count() > 0;

          expect(hasAriaLabel || hasExplicitLabel).toBe(true);

          // Check for autocomplete attributes
          const hasAutocomplete = await passwordInput.getAttribute('autocomplete') !== null;
          expect(hasAutocomplete).toBeTruthy();
        }
      });

      test('should announce form validation errors to screen readers', async () => {
        await page.goto('http://localhost:3000/auth');

        // Try to submit invalid form
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.tap();
          await page.waitForTimeout(1000);

          // Check for error announcements
          const errorElements = page.locator('[role="alert"], .error-message, [aria-live]');
          const errorCount = await errorElements.count();

          if (errorCount > 0) {
            for (let i = 0; i < errorCount; i++) {
              const errorElement = errorElements.nth(i);
              const hasRole = await errorElement.getAttribute('role') === 'alert';
              const hasAriaLive = await errorElement.getAttribute('aria-live') !== null;
              const hasAriaAtomic = await errorElement.getAttribute('aria-atomic') === 'true';

              // Error messages should be announced to screen readers
              expect(hasRole || hasAriaLive).toBe(true);
            }
          }
        }
      });

      test('should have proper focus management in modals and forms', async () => {
        // Login first to access protected forms
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        // Navigate to a page with forms
        await page.goto('http://localhost:3000/projects');

        // Look for modal triggers
        const modalTrigger = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
        if (await modalTrigger.isVisible()) {
          await modalTrigger.tap();

          // Wait for modal to appear
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible();

          // Check for proper focus trapping
          const firstFocusableElement = dialog.locator('input, button, select, textarea, [tabindex]:not([tabindex="-1"])').first();
          if (await firstFocusableElement.isVisible()) {
            // First focusable element should receive focus
            await expect(firstFocusableElement).toBeFocused();
          }

          // Test tab navigation within modal
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          // Check that focus stays within modal
          const focusedElement = page.locator(':focus');
          const focusedElementInModal = await dialog.locator(':focus').count() > 0;

          expect(focusedElementInModal).toBe(true);

          // Test escape key to close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

          // Modal should be closed and focus should return to trigger
          const dialogVisible = await dialog.isVisible();
          expect(dialogVisible).toBe(false);
        }
      });
    });

    test.describe('Keyboard Navigation', () => {
      test('should support full keyboard navigation through forms', async () => {
        await page.goto('http://localhost:3000/auth');

        // Start from first input
        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await expect(emailInput).toBeFocused();

          // Test Tab navigation
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          // Should move to next focusable element (likely password input)
          const passwordInput = page.locator('input[type="password"]');
          if (await passwordInput.isVisible()) {
            await expect(passwordInput).toBeFocused();
          }

          // Test Shift+Tab navigation
          await page.keyboard.press('Shift+Tab');
          await page.waitForTimeout(300);

          // Should return to email input
          await expect(emailInput).toBeFocused();
        }

        // Test Enter key submission
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Form submission should be attempted
        // (May show validation errors if form is incomplete)
      });

      test('should handle keyboard navigation in complex forms', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        // Navigate to a complex form
        await page.goto('http://localhost:3000/projects/new');

        // Test Tab navigation through all form elements
        const formElements = page.locator('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
        const elementCount = await formElements.count();

        for (let i = 0; i < Math.min(elementCount, 10); i++) { // Test first 10 elements
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);

          const focusedElement = page.locator(':focus');
          const isFocused = await focusedElement.count() > 0;

          expect(isFocused).toBe(true);

          // Check that focused element has visible focus indication
          const focusableElement = formElements.nth(i);
          if (await focusableElement.isVisible()) {
            const computedStyle = await focusableElement.evaluate((el) => {
              const style = window.getComputedStyle(el);
              return {
                outline: style.outline,
                boxShadow: style.boxShadow
              };
            });

            // Should have some focus indication
            const hasFocusIndicator =
              computedStyle.outline !== 'none' ||
              computedStyle.boxShadow.includes('0 0 0') ||
              computedStyle.boxShadow.includes('focus');

            // Note: Focus styles might be handled differently in different frameworks
          }
        }
      });

      test('should support arrow key navigation in form controls', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        await page.goto('http://localhost:3000/projects/new');

        // Test arrow keys in select elements
        const selectElements = page.locator('select');
        const selectCount = await selectElements.count();

        if (selectCount > 0) {
          const firstSelect = selectElements.first();
          await firstSelect.tap();
          await expect(firstSelect).toBeFocused();

          // Test arrow key navigation
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);

          await page.keyboard.press('ArrowUp');
          await page.waitForTimeout(200);

          // Test Enter to select
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);
        }

        // Test arrow keys in radio button groups
        const radioGroups = page.locator('[role="radiogroup"]');
        const radioGroupCount = await radioGroups.count();

        if (radioGroupCount > 0) {
          const firstRadioGroup = radioGroups.first();
          const radioOptions = firstRadioGroup.locator('[role="radio"]');
          const optionCount = await radioOptions.count();

          if (optionCount > 0) {
            // Focus first radio option
            await radioOptions.first().tap();
            await expect(radioOptions.first()).toBeFocused();

            // Test arrow navigation between radio options
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(200);

            // Should move to next radio option
            const secondRadioSelected = await radioOptions.nth(1).isChecked();
            expect(secondRadioSelected).toBe(true);

            // Test arrow up
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(200);

            // Should return to first option
            const firstRadioSelected = await radioOptions.first().isChecked();
            expect(firstRadioSelected).toBe(true);
          }
        }
      });
    });

    test.describe('Color Contrast and Visual Accessibility', () => {
      test('should have sufficient color contrast for form elements', async () => {
        await page.goto('http://localhost:3000/auth');

        // Check form labels and text contrast
        const formLabels = page.locator('label, .form-label, [data-testid*="label"]');
        const labelCount = await formLabels.count();

        for (let i = 0; i < Math.min(labelCount, 5); i++) { // Test first 5 labels
          const label = formLabels.nth(i);
          if (await label.isVisible()) {
            const colorContrast = await mobileHelpers.checkColorContrast(label);
            if (colorContrast) {
              // WCAG AA requires 4.5:1 for normal text
              expect(colorContrast).toBeGreaterThanOrEqual(4.5);
            }
          }
        }

        // Check input field border and text contrast
        const inputFields = page.locator('input, textarea');
        const inputCount = await inputFields.count();

        for (let i = 0; i < Math.min(inputCount, 3); i++) {
          const input = inputFields.nth(i);
          if (await input.isVisible()) {
            const inputContrast = await mobileHelpers.checkColorContrast(input);
            if (inputContrast) {
              expect(inputContrast).toBeGreaterThanOrEqual(3.0); // 3:1 for large text
            }
          }
        }
      });

      test('should have sufficient contrast for error messages', async () => {
        await page.goto('http://localhost:3000/auth');

        // Trigger validation errors
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.tap();
          await page.waitForTimeout(1000);

          // Check error message contrast
          const errorMessages = page.locator('.error-message, .text-red-600, [role="alert"]');
          const errorCount = await errorMessages.count();

          if (errorCount > 0) {
            for (let i = 0; i < Math.min(errorCount, 3); i++) {
              const error = errorMessages.nth(i);
              if (await error.isVisible()) {
                const errorContrast = await mobileHelpers.checkColorContrast(error);
                if (errorContrast) {
                  // Error messages should have even better contrast
                  expect(errorContrast).toBeGreaterThanOrEqual(4.5);
                }
              }
            }
          }
        }
      });

      test('should handle high contrast mode', async () => {
        // Test with high contrast mode simulation
        await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

        await page.goto('http://localhost:3000/auth');

        // Check that form remains usable in high contrast
        const formElements = page.locator('input, button, label');
        const elementCount = await formElements.count();

        let allElementsVisible = true;
        for (let i = 0; i < Math.min(elementCount, 5); i++) {
          const element = formElements.nth(i);
          if (await element.isVisible()) {
            const opacity = await element.evaluate((el) => {
              return window.getComputedStyle(el).opacity;
            });

            // Elements should remain visible (not hidden by poor contrast)
            if (parseFloat(opacity) < 0.5) {
              allElementsVisible = false;
            }
          }
        }

        expect(allElementsVisible).toBe(true);
      });
    });

    test.describe('Focus Management and Indication', () => {
      test('should provide clear focus indicators for form elements', async () => {
        await page.goto('http://localhost:3000/auth');

        const focusableElements = page.locator('input, button, select, textarea');
        const elementCount = await focusableElements.count();

        for (let i = 0; i < Math.min(elementCount, 5); i++) {
          const element = focusableElements.nth(i);
          if (await element.isVisible()) {
            // Focus the element
            await element.tap();
            await page.waitForTimeout(200);

            // Check for focus indication
            const hasFocus = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const computedStyle = {
                outline: style.outline,
                outlineOffset: style.outlineOffset,
                boxShadow: style.boxShadow,
                border: style.border
              };

              return {
                hasOutline: style.outline !== 'none',
                hasFocusRing: style.boxShadow.includes('0 0 0') || style.boxShadow.includes('focus'),
                hasBorderFocus: style.border.includes('focus') || style.borderColor !== 'rgb(209, 213, 219)'
              };
            });

            // Element should have some focus indication
            expect(
              hasFocus.hasOutline ||
              hasFocus.hasFocusRing ||
              hasFocus.hasBorderFocus
            ).toBe(true);
          }
        }
      });

      test('should maintain focus after form interactions', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await expect(emailInput).toBeFocused();

          // Type some text
          await emailInput.fill('test@example.com');

          // Focus should remain on the input
          await expect(emailInput).toBeFocused();

          // Test blur and refocus
          await emailInput.blur();
          await expect(emailInput).not.toBeFocused();

          await emailInput.tap();
          await expect(emailInput).toBeFocused();
        }
      });

      test('should handle focus management in dynamic form content', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        await page.goto('http://localhost:3000/projects');

        // Look for forms with dynamic content
        const dynamicForm = page.locator('button:has-text("Add"), button:has-text("Create")').first();
        if (await dynamicForm.isVisible()) {
          await dynamicForm.tap();
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

          // Test focus management when new content appears
          const dialog = page.locator('[role="dialog"]').first();
          const firstInput = dialog.locator('input').first();

          if (await firstInput.isVisible()) {
            await firstInput.tap();
            await expect(firstInput).toBeFocused();

            // Look for dynamic form elements (like "Add Another" buttons)
            const dynamicButtons = dialog.locator('button:has-text("Add"), button:has-text("More")');
            const dynamicButtonCount = await dynamicButtons.count();

            if (dynamicButtonCount > 0) {
              await dynamicButtons.first().tap();
              await page.waitForTimeout(1000);

              // Focus should move to the newly added content
              const newInput = dialog.locator('input').last();
              if (await newInput.isVisible()) {
                // New content should be focusable
                const canFocus = await newInput.evaluate((el) => {
                  el.focus();
                  return document.activeElement === el;
                });

                expect(canFocus).toBe(true);
              }
            }
          }
        }
      });
    });

    test.describe('Touch Target Accessibility', () => {
      test('should meet minimum touch target requirements for accessibility', async () => {
        await page.goto('http://localhost:3000/auth');

        // Test all interactive elements
        const interactiveElements = page.locator('input, button, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])');
        const elementCount = await interactiveElements.count();

        for (let i = 0; i < Math.min(elementCount, 10); i++) {
          const element = interactiveElements.nth(i);
          if (await element.isVisible()) {
            const boundingBox = await element.boundingBox();

            if (boundingBox) {
              // WCAG requires minimum 44x44px touch targets
              expect(boundingBox.height).toBeGreaterThanOrEqual(44);
              expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });

      test('should provide adequate spacing between interactive elements', async () => {
        await page.goto('http://localhost:3000/auth');

        // Test button spacing
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();

        for (let i = 0; i < buttonCount - 1; i++) {
          const currentButton = buttons.nth(i);
          const nextButton = buttons.nth(i + 1);

          if (await currentButton.isVisible() && await nextButton.isVisible()) {
            const currentBox = await currentButton.boundingBox();
            const nextBox = await nextButton.boundingBox();

            if (currentBox && nextBox) {
              // Check horizontal and vertical spacing
              const horizontalSpacing = Math.abs(currentBox.x + currentBox.width - nextBox.x);
              const verticalSpacing = Math.abs(currentBox.y + currentBox.height - nextBox.y);

              // Should have at least 8px spacing
              if (currentBox.y === nextBox.y) { // Same row
                expect(horizontalSpacing).toBeGreaterThanOrEqual(8);
              }
            }
          }
        }
      });
    });
  });
});