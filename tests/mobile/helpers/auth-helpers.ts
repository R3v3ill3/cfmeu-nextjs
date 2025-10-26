import { Page, BrowserContext } from '@playwright/test';

export interface UserCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Authentication helpers for mobile testing in CFMEU Next.js application
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * Logs in a user with mobile-optimized interactions
   */
  async login(credentials: UserCredentials): Promise<void> {
    await this.page.goto('/auth');

    // Wait for auth page to load
    await this.page.waitForSelector('[data-testid="auth-container"]', { timeout: 10000 });

    // Fill in email field with mobile-friendly interactions
    const emailField = this.page.locator('input[type="email"], input[name="email"]');
    await emailField.tap();
    await emailField.fill(credentials.email);

    // Fill in password field
    const passwordField = this.page.locator('input[type="password"], input[name="password"]');
    await passwordField.tap();
    await passwordField.fill(credentials.password);

    // Submit form (find submit button)
    const submitButton = this.page.locator('button[type="submit"], [data-testid="login-button"]');
    await submitButton.tap();

    // Wait for successful login redirect
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });
  }

  /**
   * Logs out the current user
   */
  async logout(): Promise<void> {
    // Try to find and click mobile menu or logout button
    const mobileMenuButton = this.page.locator('[data-testid="mobile-menu-button"], button[aria-label="menu"]');

    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.tap();
      await this.page.waitForTimeout(500); // Wait for menu animation
    }

    const logoutButton = this.page.locator('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")');
    await logoutButton.tap();

    // Wait for logout redirect
    await this.page.waitForURL('**/auth', { timeout: 10000 });
  }

  /**
   * Sets up authentication tokens for testing
   */
  async setAuthToken(context: BrowserContext, token: AuthToken): Promise<void> {
    await context.addCookies([
      {
        name: 'access_token',
        value: token.accessToken,
        domain: new URL(this.page.url()).hostname,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      },
      {
        name: 'refresh_token',
        value: token.refreshToken,
        domain: new URL(this.page.url()).hostname,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      }
    ]);
  }

  /**
   * Checks if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for authentication indicators
      const authIndicators = [
        '[data-testid="user-menu"]',
        '[data-testid="profile-button"]',
        'button:has-text("Logout")',
        '[data-testid="authenticated-content"]'
      ];

      for (const selector of authIndicators) {
        if (await this.page.locator(selector).isVisible({ timeout: 2000 })) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Handles multi-factor authentication if present
   */
  async handleMFA(code: string): Promise<void> {
    const mfaInput = this.page.locator('input[name="mfa"], input[data-testid="mfa-code"]');

    if (await mfaInput.isVisible({ timeout: 5000 })) {
      await mfaInput.tap();
      await mfaInput.fill(code);

      const verifyButton = this.page.locator('button:has-text("Verify"), button[type="submit"]');
      await verifyButton.tap();

      // Wait for MFA completion
      await this.page.waitForSelector('[data-testid="mfa-success"]', { state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * Tests password reset flow on mobile
   */
  async testPasswordReset(email: string): Promise<void> {
    await this.page.goto('/auth/reset-password');

    const emailField = this.page.locator('input[type="email"]');
    await emailField.tap();
    await emailField.fill(email);

    const resetButton = this.page.locator('button[type="submit"]');
    await resetButton.tap();

    // Wait for success message
    await this.page.waitForSelector('[data-testid="reset-success"]', { timeout: 10000 });
  }

  /**
   * Tests registration flow on mobile
   */
  async testRegistration(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<void> {
    await this.page.goto('/auth/register');

    // Fill registration form with mobile interactions
    const fields = [
      { selector: 'input[name="firstName"]', value: userData.firstName },
      { selector: 'input[name="lastName"]', value: userData.lastName },
      { selector: 'input[type="email"]', value: userData.email },
      { selector: 'input[type="password"]', value: userData.password },
    ];

    if (userData.phone) {
      fields.push({ selector: 'input[name="phone"]', value: userData.phone });
    }

    for (const field of fields) {
      const element = this.page.locator(field.selector);
      await element.tap();
      await element.fill(field.value);
      // Dismiss keyboard on mobile
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(200);
    }

    const registerButton = this.page.locator('button[type="submit"]');
    await registerButton.tap();

    // Wait for registration completion
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });
  }
}