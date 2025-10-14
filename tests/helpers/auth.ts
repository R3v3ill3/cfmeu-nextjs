import { Page } from '@playwright/test';

/**
 * Authentication helper for Playwright tests
 * 
 * Note: You'll need to configure this based on your actual auth setup
 * Options:
 * 1. Use Supabase test credentials
 * 2. Use auth state from storage
 * 3. Mock authentication for testing
 */

export async function loginAsAdmin(page: Page): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  // Option 1: If you have test credentials in env
  const testEmail = process.env.TEST_ADMIN_EMAIL;
  const testPassword = process.env.TEST_ADMIN_PASSWORD;

  if (testEmail && testPassword) {
    // Navigate to login page
    await page.goto(`${baseUrl}/login`);
    
    // Fill in credentials (adapt selectors to your login form)
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await submitButton.click();

      // Wait for successful login
      await page.waitForURL(/\/(admin|dashboard|home)/, { timeout: 10000 });
    }
  } else {
    // Option 2: Navigate directly and rely on existing session
    // This works if you're already logged in during test run
    await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' });
    
    // Check if we got redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(
        'Authentication required. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables, ' +
        'or login manually before running tests.'
      );
    }
  }
}

export async function loginAsLeadOrganiser(page: Page): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  const testEmail = process.env.TEST_LEAD_ORGANISER_EMAIL;
  const testPassword = process.env.TEST_LEAD_ORGANISER_PASSWORD;

  if (testEmail && testPassword) {
    await page.goto(`${baseUrl}/login`);
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await submitButton.click();
      await page.waitForURL(/\/(admin|dashboard|home)/, { timeout: 10000 });
    }
  } else {
    await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' });
  }
}

export async function logout(page: Page): Promise<void> {
  // Implement logout if needed for test isolation
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/(login|$)/, { timeout: 5000 });
  }
}

