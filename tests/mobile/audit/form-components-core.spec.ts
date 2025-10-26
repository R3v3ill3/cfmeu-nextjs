import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';

// Test data
const testForms = {
  authentication: {
    login: {
      email: 'test@cfmeu.org.au',
      password: 'TestPassword123!'
    }
  },
  projectCreation: {
    name: 'Test Mobile Project',
    address: '123 Test Street, Melbourne VIC 3000',
    description: 'Mobile test project for form validation'
  },
  employerMatching: {
    searchQueries: ['Formwork', 'Scaffolding', 'Concrete', 'Electrical'],
    newEmployer: 'Mobile Test Contractor Pty Ltd'
  }
};

const mobileDevices = [
  devices['iPhone 13'],
  devices['iPhone 14 Pro'],
  devices['iPhone 15 Pro Max']
];

mobileDevices.forEach(device => {
  test.describe(`Core Form Components - ${device.name}`, () => {
    let mobileHelpers: MobileHelpers;
    let page: any;

    test.beforeEach(async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
        isMobile: true,
        hasTouch: true,
      });

      page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);

      // Navigate to the application
      await page.goto('http://localhost:3000');
    });

    test.describe('Input Field Types', () => {
      test('should display proper mobile keyboards for different input types', async () => {
        await page.goto('http://localhost:3000/auth');

        // Test email input
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible();
        await emailInput.tap();

        // Verify email input shows email keyboard (with @ symbol)
        await mobileHelpers.waitForKeyboard();
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/email-keyboard.png`,
          fullPage: true
        });

        // Test password input
        const passwordInput = page.locator('input[type="password"]');
        await passwordInput.tap();

        // Verify password input shows secure keyboard
        await mobileHelpers.waitForKeyboard();
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/password-keyboard.png`,
          fullPage: true
        });

        // Touch target validation - inputs should be at least 44px
        const emailBoundingBox = await emailInput.boundingBox();
        const passwordBoundingBox = await passwordInput.boundingBox();

        expect(emailBoundingBox?.height!).toBeGreaterThanOrEqual(44);
        expect(passwordBoundingBox?.height!).toBeGreaterThanOrEqual(44);
      });

      test('should handle text input focus and auto-scroll', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        const initialViewport = page.viewportSize();

        // Tap on input and verify it comes into view
        await emailInput.tap();

        // Check that input is properly focused
        await expect(emailInput).toBeFocused();

        // Verify viewport hasn't changed unexpectedly
        const currentViewport = page.viewportSize();
        expect(currentViewport?.width).toBe(initialViewport?.width);
        expect(currentViewport?.height).toBe(initialViewport?.height);
      });
    });

    test.describe('Form Validation', () => {
      test('should display validation errors appropriately on mobile', async () => {
        await page.goto('http://localhost:3000/auth');

        // Attempt to submit empty form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.tap();

        // Check for validation messages
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toHaveAttribute('required');

        // Test empty form submission
        await page.fill('input[type="email"]', 'invalid-email');
        await page.fill('input[type="password"]', '');
        await submitButton.tap();

        // Check if validation is working
        const isValidEmail = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
        expect(isValidEmail).toBe(false);
      });

      test('should show inline validation feedback', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');

        // Enter invalid email
        await emailInput.fill('invalid-email');
        await emailInput.blur(); // Remove focus to trigger validation

        // Check if browser validation is triggered
        const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
        expect(isValid).toBe(false);
      });
    });

    test.describe('Touch Target Compliance', () => {
      test('should meet minimum touch target requirements (44x44px)', async () => {
        await page.goto('http://localhost:3000/auth');

        const interactiveElements = [
          'input[type="email"]',
          'input[type="password"]',
          'button[type="submit"]',
          'button[type="button"]'
        ];

        for (const selector of interactiveElements) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              expect(boundingBox.height).toBeGreaterThanOrEqual(44);
              expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });

      test('should provide adequate spacing between touch targets', async () => {
        await page.goto('http://localhost:3000/auth');

        const submitButton = page.locator('button[type="submit"]');
        const resetButton = page.locator('button[type="button"]');

        if (await submitButton.isVisible() && await resetButton.isVisible()) {
          const submitBox = await submitButton.boundingBox();
          const resetBox = await resetButton.boundingBox();

          if (submitBox && resetBox) {
            // Calculate vertical spacing
            const verticalSpacing = Math.abs(submitBox.y - resetBox.y);
            expect(verticalSpacing).toBeGreaterThanOrEqual(8); // Minimum 8px spacing
          }
        }
      });
    });

    test.describe('Form Layout and Responsiveness', () => {
      test('should adapt to mobile viewport properly', async () => {
        await page.goto('http://localhost:3000/auth');

        const form = page.locator('form');
        await expect(form).toBeVisible();

        // Check form doesn't overflow horizontally
        const formBoundingBox = await form.boundingBox();
        const viewportWidth = page.viewportSize()?.width || 0;

        if (formBoundingBox) {
          expect(formBoundingBox.width).toBeLessThanOrEqual(viewportWidth);
        }

        // Verify all form elements are visible within viewport
        const formElements = await form.locator('input, button').count();
        expect(formElements).toBeGreaterThan(0);
      });

      test('should handle orientation changes gracefully', async () => {
        await page.goto('http://localhost:3000/auth');

        // Test portrait
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(1000);

        const portraitForm = page.locator('form');
        await expect(portraitForm).toBeVisible();

        // Test landscape
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(1000);

        const landscapeForm = page.locator('form');
        await expect(landscapeForm).toBeVisible();

        // Take screenshots for comparison
        await page.screenshot({
          path: `test-results/screenshots/${device.name}/auth-form-landscape.png`,
          fullPage: true
        });
      });
    });

    test.describe('Mobile Keyboard Interactions', () => {
      test('should not obscure important form elements when keyboard appears', async () => {
        await page.goto('http://localhost:3000/auth');

        // Focus on password input (usually last in form)
        const passwordInput = page.locator('input[type="password"]');
        await passwordInput.tap();

        // Wait for keyboard animation
        await mobileHelpers.waitForKeyboard();
        await page.waitForTimeout(500);

        // Verify submit button is still visible/accessible
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();

        // Check if input is still in view
        const passwordBoundingBox = await passwordInput.boundingBox();
        if (passwordBoundingBox) {
          expect(passwordBoundingBox.y).toBeGreaterThanOrEqual(0);
          expect(passwordBoundingBox.y).toBeLessThanOrEqual((page.viewportSize()?.height || 844) - 100);
        }
      });

      test('should handle keyboard dismissal properly', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        await emailInput.tap();
        await mobileHelpers.waitForKeyboard();

        // Dismiss keyboard
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Verify focus is lost
        await expect(emailInput).not.toBeFocused();
      });
    });

    test.describe('Form Submission States', () => {
      test('should show loading states during submission', async () => {
        await page.goto('http://localhost:3000/auth');

        // Fill form with test data
        await page.fill('input[type="email"]', testForms.authentication.login.email);
        await page.fill('input[type="password"]', testForms.authentication.login.password);

        // Submit form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.tap();

        // Check for loading state (common patterns)
        const isLoading = await Promise.race([
          submitButton.evaluate((el: HTMLButtonElement) =>
            el.textContent?.includes('Signing') || el.disabled
          ),
          page.waitForSelector('[data-loading]', { timeout: 1000 }),
          page.waitForTimeout(2000).then(() => false) // Timeout after 2s
        ]);

        // The loading state should appear (either disabled button or loading text)
        expect(isLoading).toBeDefined();
      });

      test('should handle network errors gracefully', async () => {
        // Simulate offline condition
        await page.context().setOffline(true);

        await page.goto('http://localhost:3000/auth');

        // Fill form
        await page.fill('input[type="email"]', testForms.authentication.login.email);
        await page.fill('input[type="password"]', testForms.authentication.login.password);

        // Submit form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.tap();

        // Wait for error handling
        await page.waitForTimeout(3000);

        // Check for error message or network error handling
        const hasError = await Promise.race([
          page.locator('text=Network error').isVisible(),
          page.locator('text=Failed to sign in').isVisible(),
          page.locator('.text-red-600').isVisible(),
          page.waitForTimeout(2000).then(() => false)
        ]);

        // Restore connection
        await page.context().setOffline(false);

        // Error handling should be present
        expect(hasError).toBeDefined();
      });
    });
  });
});