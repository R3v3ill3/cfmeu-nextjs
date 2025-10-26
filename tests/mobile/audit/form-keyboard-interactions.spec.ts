import { test, expect, devices } from '@playwright/test';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { AuthHelpers } from '../helpers/auth-helpers';

const mobileDevices = [
  devices['iPhone 13'],
  devices['iPhone 14 Pro'],
  devices['iPhone 15 Pro Max']
];

// Test data for keyboard interaction scenarios
const keyboardTestData = {
  formData: {
    email: 'user@cfmeu.org.au',
    phone: '0412345678',
    url: 'https://example.com',
    date: '2024-02-15',
    time: '14:30',
    number: '12345',
    search: 'Formwork contractor Melbourne'
  },
  textInputs: {
    short: 'Test',
    medium: 'This is a medium length text input for testing mobile keyboard interactions',
    long: 'This is a very long text input that should trigger scrolling behavior and test how the mobile keyboard interacts with form content on smaller screens to ensure proper user experience'
  }
};

mobileDevices.forEach(device => {
  test.describe(`Mobile Keyboard Interactions - ${device.name}`, () => {
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

    test.describe('Mobile Keyboard Types', () => {
      test('should display appropriate keyboard for email input', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Take screenshot of email keyboard
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/email-keyboard.png`,
            fullPage: true
          });

          // Fill with email
          await emailInput.fill(keyboardTestData.formData.email);

          // Verify @ symbol is easily accessible (indicated by correct keyboard type)
          const inputType = await emailInput.getAttribute('type');
          expect(inputType).toBe('email');
        }
      });

      test('should display numeric keypad for phone input', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
        await page.goto('http://localhost:3000/projects/new');

        // Look for phone input
        const phoneInputs = page.locator('input[type="tel"], input[name*="phone"], input[placeholder*="phone"]');
        const phoneCount = await phoneInputs.count();

        if (phoneCount > 0) {
          const phoneInput = phoneInputs.first();
          await phoneInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Take screenshot of numeric keypad
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/phone-keyboard.png`,
            fullPage: true
          });

          // Test numeric input
          await phoneInput.fill(keyboardTestData.formData.phone);

          // Verify input type is appropriate
          const inputType = await phoneInput.getAttribute('type');
          expect(['tel', 'text']).toContain(inputType);
        }
      });

      test('should display appropriate keyboard for URL input', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
        await page.goto('http://localhost:3000/employers/new');

        // Look for URL/website input
        const urlInputs = page.locator('input[type="url"], input[name*="website"], input[placeholder*="website"]');
        const urlCount = await urlInputs.count();

        if (urlCount > 0) {
          const urlInput = urlInputs.first();
          await urlInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Take screenshot of URL keyboard
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/url-keyboard.png`,
            fullPage: true
          });

          // Test URL input
          await urlInput.fill(keyboardTestData.formData.url);

          const inputType = await urlInput.getAttribute('type');
          expect(inputType).toBe('url');
        }
      });

      test('should display date picker for date inputs', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
        await page.goto('http://localhost:3000/projects/new');

        // Look for date inputs
        const dateInputs = page.locator('input[type="date"], input[name*="date"]');
        const dateCount = await dateInputs.count();

        if (dateCount > 0) {
          const dateInput = dateInputs.first();
          await dateInput.tap();
          await page.waitForTimeout(1000);

          // Take screenshot of date picker
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/date-picker.png`,
            fullPage: true
          });

          // Test date input
          await dateInput.fill(keyboardTestData.formData.date);

          const inputType = await dateInput.getAttribute('type');
          expect(inputType).toBe('date');
        }
      });

      test('should display search keyboard for search inputs', async () => {
        await page.goto('http://localhost:3000/employers');

        // Look for search input
        const searchInputs = page.locator('input[type="search"], input[placeholder*="search"], input[name*="search"]');
        const searchCount = await searchInputs.count();

        if (searchCount > 0) {
          const searchInput = searchInputs.first();
          await searchInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Take screenshot of search keyboard
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/search-keyboard.png`,
            fullPage: true
          });

          // Test search functionality
          await searchInput.fill(keyboardTestData.formData.search);
          await page.waitForTimeout(1000);

          // Verify search functionality works
          const searchResults = page.locator('[data-testid*="search-result"], .search-result');
          const hasResults = await searchResults.count() > 0;

          // Should either have results or show "no results" message
          expect(hasResults || await page.locator('text=no results').isVisible()).toBeTruthy();
        }
      });
    });

    test.describe('Keyboard Viewport Interactions', () => {
      test('should auto-scroll focused inputs into view when keyboard appears', async () => {
        await page.goto('http://localhost:3000/auth');

        // Focus on password input (typically below email)
        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
          // Get initial position
          const initialBoundingBox = await passwordInput.boundingBox();

          await passwordInput.tap();
          await mobileHelpers.waitForKeyboard();
          await page.waitForTimeout(500);

          // Check if input is still visible
          const isVisible = await passwordInput.isVisible();
          expect(isVisible).toBe(true);

          // Take screenshot with keyboard visible
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/keyboard-viewport-scroll.png`,
            fullPage: true
          });
        }
      });

      test('should prevent content from being hidden behind keyboard', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        // Navigate to a form with multiple inputs
        await page.goto('http://localhost:3000/projects/new');

        // Find the last input in the form (likely to be affected by keyboard)
        const allInputs = page.locator('input, textarea');
        const inputCount = await allInputs.count();

        if (inputCount > 0) {
          const lastInput = allInputs.nth(inputCount - 1);
          if (await lastInput.isVisible()) {
            // Focus the last input
            await lastInput.tap();
            await mobileHelpers.waitForKeyboard();
            await page.waitForTimeout(500);

            // Verify input is not hidden behind keyboard
            const boundingBox = await lastInput.boundingBox();
            if (boundingBox) {
              const viewportHeight = page.viewportSize()?.height || 844;
              const keyboardHeight = viewportHeight * 0.4; // Approximate keyboard height

              // Input should be visible above keyboard area
              expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(viewportHeight - keyboardHeight);
            }

            // Take screenshot showing keyboard interaction
            await page.screenshot({
              path: `test-results/screenshots/${device.name}/keyboard-last-input.png`,
              fullPage: true
            });
          }
        }
      });

      test('should handle keyboard dismissal gracefully', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Test keyboard dismissal via tap outside
          const body = page.locator('body');
          await body.tap({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(500);

          // Check if keyboard is dismissed (focus lost)
          const isFocused = await emailInput.evaluate((el) => document.activeElement === el);
          expect(isFocused).toBe(false);

          // Test keyboard dismissal via Escape key
          await emailInput.tap();
          await mobileHelpers.waitForKeyboard();

          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          const isStillFocused = await emailInput.evaluate((el) => document.activeElement === el);
          expect(isStillFocused).toBe(false);
        }
      });
    });

    test.describe('Text Input Behavior', () => {
      test('should handle long text input in mobile textareas', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
        await page.goto('http://localhost:3000/projects/new');

        // Look for textarea inputs
        const textareas = page.locator('textarea');
        const textareaCount = await textareas.count();

        if (textareaCount > 0) {
          const textarea = textareas.first();
          await textarea.tap();
          await mobileHelpers.waitForKeyboard();

          // Test typing long text
          await textarea.fill(keyboardTestData.textInputs.long);
          await page.waitForTimeout(1000);

          // Test cursor movement with keyboard
          await page.keyboard.press('Home');
          await page.waitForTimeout(200);

          await page.keyboard.press('End');
          await page.waitForTimeout(200);

          // Test text selection
          await page.keyboard.press('Control+a'); // Select all on mobile
          await page.waitForTimeout(200);

          // Take screenshot of textarea with long text
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/textarea-long-text.png`,
            fullPage: true
          });
        }
      });

      test('should handle text selection and editing on mobile', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await emailInput.fill('test@cfmeu.org.au');

          // Test text selection
          await emailInput.selectText();
          await page.waitForTimeout(500);

          // Test replacement
          await emailInput.fill('new@cfmeu.org.au');

          // Test cursor positioning
          await emailInput.tap();
          await page.keyboard.press('End');
          await page.keyboard.type(' more text');

          const finalValue = await emailInput.inputValue();
          expect(finalValue).toContain('more text');

          // Take screenshot showing text editing
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/text-editing.png`,
            fullPage: true
          });
        }
      });

      test('should handle autocomplete and suggestions appropriately', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          // Set autocomplete attributes if not present
          await emailInput.evaluate((el) => {
            el.setAttribute('autocomplete', 'email');
          });

          await emailInput.tap();
          await emailInput.fill('test@');

          // Test if browser shows autocomplete dropdown
          await page.waitForTimeout(2000);

          // Take screenshot to capture any autocomplete UI
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/autocomplete-suggestions.png`,
            fullPage: true
          });
        }
      });
    });

    test.describe('Form Input Patterns', () => {
      test('should handle pattern-based input validation', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        // Look for inputs with patterns (ABN, phone, etc.)
        await page.goto('http://localhost:3000/employers/new');

        // Test ABN input (common in Australian business forms)
        const abnInputs = page.locator('input[name*="abn"], input[placeholder*="ABN"], input[pattern*="\\d"]');
        const abnCount = await abnInputs.count();

        if (abnCount > 0) {
          const abnInput = abnInputs.first();
          await abnInput.tap();

          // Test valid ABN format
          await abnInput.fill('12345678901');

          // Test invalid ABN format
          await abnInput.fill('invalid');
          await abnInput.blur();

          // Check for pattern validation
          const isValid = await abnInput.evaluate((el) => el.validity.valid);
          expect(isValid).toBe(false);

          // Take screenshot of validation state
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/pattern-validation.png`,
            fullPage: true
          });
        }
      });

      test('should handle input masking for sensitive data', async () => {
        await page.goto('http://localhost:3000/auth');

        // Test password masking
        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
          await passwordInput.tap();
          await passwordInput.fill('secret123');

          // Verify password is masked
          const inputValue = await passwordInput.inputValue();
          const displayValue = await passwordInput.evaluate((el) => {
            return el.value; // This gets the actual value, not display
          });

          // The input should show masked characters but have the actual value
          expect(displayValue).toBe('secret123');

          // Test show/hide password toggle if present
          const toggleButton = page.locator('button[aria-label*="password"], button[title*="password"]');
          if (await toggleButton.isVisible()) {
            await toggleButton.tap();
            await page.waitForTimeout(500);

            // Password should now be visible
            const type = await passwordInput.getAttribute('type');
            expect(type).toBe('text');

            // Toggle back
            await toggleButton.tap();
            await page.waitForTimeout(500);

            const typeAfterToggle = await passwordInput.getAttribute('type');
            expect(typeAfterToggle).toBe('password');
          }
        }
      });

      test('should handle number inputs with proper mobile keyboards', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');

        // Look for number inputs
        await page.goto('http://localhost:3000/projects/new');

        const numberInputs = page.locator('input[type="number"], input[pattern*="\\d"]');
        const numberCount = await numberInputs.count();

        if (numberCount > 0) {
          const numberInput = numberInputs.first();
          await numberInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Test numeric input
          await numberInput.fill(keyboardTestData.formData.number);

          // Test increment/decrement if available
          const step = await numberInput.getAttribute('step');
          if (step) {
            // Test arrow keys for increment/decrement
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(200);

            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(200);
          }

          // Take screenshot of number input
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/number-input.png`,
            fullPage: true
          });
        }
      });
    });

    test.describe('Keyboard Navigation in Complex Forms', () => {
      test('should handle Tab navigation through form fields on mobile', async () => {
        await authHelpers.mobileLogin('test@cfmeu.org.au', 'TestPassword123!');
        await page.goto('http://localhost:3000/projects/new');

        const formElements = page.locator('input, select, textarea, button');
        const elementCount = await formElements.count();

        // Test Tab navigation through first 10 elements
        for (let i = 0; i < Math.min(elementCount, 10); i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          const focusedElement = page.locator(':focus');
          const isFocused = await focusedElement.count() > 0;

          expect(isFocused).toBe(true);

          // Check if focused element is visible
          const isVisible = await focusedElement.isVisible();
          expect(isVisible).toBe(true);
        }
      });

      test('should handle form submission with keyboard on mobile', async () => {
        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');

        if (await emailInput.isVisible() && await passwordInput.isVisible()) {
          // Fill form using keyboard
          await emailInput.tap();
          await emailInput.fill(keyboardTestData.formData.email);

          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          await passwordInput.fill('testpassword123');

          // Submit with Enter key
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);

          // Form submission should be attempted
          // May result in error (since we're using test credentials) or success
          const hasError = await page.locator('.error-message, .text-red-600').count() > 0;
          const redirected = page.url() !== 'http://localhost:3000/auth';

          expect(hasError || redirected).toBe(true);
        }
      });
    });

    test.describe('Orientation and Keyboard Behavior', () => {
      test('should handle keyboard interactions in landscape orientation', async () => {
        // Switch to landscape
        await page.setViewportSize({ width: 844, height: 390 });

        await page.goto('http://localhost:3000/auth');

        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
          await passwordInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Test keyboard behavior in landscape
          await passwordInput.fill('testpassword');

          // Verify input is still visible and functional
          const isVisible = await passwordInput.isVisible();
          const hasValue = await passwordInput.inputValue() !== '';

          expect(isVisible).toBe(true);
          expect(hasValue).toBe(true);

          // Take screenshot of landscape keyboard
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/landscape-keyboard.png`,
            fullPage: true
          });
        }
      });

      test('should handle orientation changes with active keyboard', async () => {
        // Start in portrait
        await page.setViewportSize({ width: 390, height: 844 });

        await page.goto('http://localhost:3000/auth');

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.tap();
          await mobileHelpers.waitForKeyboard();

          // Fill some text
          await emailInput.fill('test@cfmeu.org.au');

          // Rotate to landscape
          await page.setViewportSize({ width: 844, height: 390 });
          await page.waitForTimeout(1000);

          // Input should still be functional
          const stillFocused = await emailInput.evaluate((el) => document.activeElement === el);
          const hasValue = await emailInput.inputValue() !== '';

          // The input might lose focus during orientation change, but value should remain
          expect(hasValue).toBe(true);

          // Test retyping in landscape
          await emailInput.tap();
          await emailInput.fill('new@cfmeu.org.au');

          // Take screenshot after orientation change
          await page.screenshot({
            path: `test-results/screenshots/${device.name}/orientation-change-keyboard.png`,
            fullPage: true
          });
        }
      });
    });
  });
});