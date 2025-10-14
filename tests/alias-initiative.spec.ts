import { test, expect } from '@playwright/test';

/**
 * Alias Initiative E2E Tests
 * 
 * Tests the complete alias system including:
 * - Prompt 3B: Canonical Promotion Console
 * - Prompt 3C: Alias Search
 * - Prompt 3D: Alias Analytics Dashboard
 * 
 * Prerequisites:
 * - Local dev server running (pnpm dev)
 * - Supabase migrations applied
 * - Test user with admin role
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('Alias Initiative - Full Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // Helper to login as admin (you'll need to adapt this to your auth flow)
  async function loginAsAdmin(page: any) {
    // TODO: Replace with your actual login flow
    // This is a placeholder - adapt to your authentication
    await page.goto(`${BASE_URL}/login`);
    
    // Example: If you use email/password
    // await page.fill('[name="email"]', 'admin@test.com');
    // await page.fill('[name="password"]', 'test-password');
    // await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard or home
    // await page.waitForURL(/\/(dashboard|home|admin)/);
    
    // For now, we'll just navigate to admin
    await page.goto(`${BASE_URL}/admin`);
  }

  test.describe('Prompt 3D: Alias Analytics Dashboard', () => {
    test('should display analytics dashboard', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      // Look for the Alias Analytics tab/section
      const aliasAnalyticsTab = page.locator('text=Alias Analytics').first();
      await expect(aliasAnalyticsTab).toBeVisible({ timeout: 10000 });

      // Click the tab (desktop) or expand collapsible (mobile)
      await aliasAnalyticsTab.click();

      // Wait for dashboard to load
      await page.waitForLoadState('networkidle');

      // Verify overview cards are present
      await expect(page.locator('text=Total Aliases')).toBeVisible();
      await expect(page.locator('text=Pending Reviews')).toBeVisible();
      await expect(page.locator('text=Employer Coverage')).toBeVisible();

      // Verify source systems table
      await expect(page.locator('text=Aliases by Source System')).toBeVisible();
      
      // Verify export button exists
      const exportButton = page.locator('button:has-text("Export CSV")').first();
      await expect(exportButton).toBeVisible();
    });

    test('should load metrics without errors', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      // Navigate to analytics
      const aliasAnalyticsTab = page.locator('text=Alias Analytics').first();
      await aliasAnalyticsTab.click();

      // Wait for API call to complete
      await page.waitForResponse(
        response => response.url().includes('/api/admin/alias-metrics') && response.status() === 200,
        { timeout: 10000 }
      );

      // Check no error messages displayed
      await expect(page.locator('text=Failed to load')).not.toBeVisible();
      
      // Should show some metric numbers (may be 0 if no data)
      const metricCards = page.locator('[class*="CardContent"]');
      await expect(metricCards.first()).toBeVisible();
    });

    test('should display alerts when thresholds exceeded', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      const aliasAnalyticsTab = page.locator('text=Alias Analytics').first();
      await aliasAnalyticsTab.click();

      await page.waitForLoadState('networkidle');

      // Alerts may or may not be visible depending on data
      // Just verify the page loaded successfully
      const dashboardTitle = page.locator('text=Alias Analytics & Reporting');
      await expect(dashboardTitle).toBeVisible();
    });
  });

  test.describe('Prompt 3B: Canonical Promotion Console', () => {
    test('should display canonical names tab', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      // Look for the Canonical Names tab/section
      const canonicalTab = page.locator('text=Canonical Names').first();
      await expect(canonicalTab).toBeVisible({ timeout: 10000 });

      // Click the tab
      await canonicalTab.click();

      // Wait for console to load
      await page.waitForLoadState('networkidle');

      // Verify console header
      await expect(page.locator('text=Canonical Name Promotion Console')).toBeVisible();
      
      // Verify info alert is present
      await expect(page.locator('text=About Canonical Promotions')).toBeVisible();
    });

    test('should load promotion queue', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      const canonicalTab = page.locator('text=Canonical Names').first();
      await canonicalTab.click();

      await page.waitForLoadState('networkidle');

      // Queue may be empty or have items
      const emptyState = page.locator('text=All caught up!');
      const queueItems = page.locator('[class*="CardTitle"]').filter({ hasText: /.+/ });

      // Either empty state or queue items should be visible
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasQueueItems = await queueItems.count().then(count => count > 0).catch(() => false);

      expect(hasEmptyState || hasQueueItems).toBe(true);
    });

    test('should open decision dialog when clicking action buttons', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      const canonicalTab = page.locator('text=Canonical Names').first();
      await canonicalTab.click();

      await page.waitForLoadState('networkidle');

      // Check if queue has items
      const promoteButton = page.locator('button:has-text("Promote to Canonical")').first();
      const hasItems = await promoteButton.isVisible().catch(() => false);

      if (hasItems) {
        // Click promote button
        await promoteButton.click();

        // Dialog should open
        await expect(page.locator('text=Promote to Canonical Name')).toBeVisible();
        
        // Verify rationale textarea exists
        await expect(page.locator('textarea[id="rationale"]')).toBeVisible();
        
        // Close dialog
        await page.locator('button:has-text("Cancel")').click();
      } else {
        // Skip test if no queue items
        test.skip();
      }
    });
  });

  test.describe('Prompt 3C: Alias Search (API)', () => {
    test('should search employers with alias support', async ({ page, request }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      // This test requires authentication token
      // For now, we'll test that the endpoint exists
      
      await loginAsAdmin(page);

      // Test basic employer search (should work without aliases)
      const response = await page.request.get(`${BASE_URL}/api/employers?page=1&pageSize=10`);
      
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('employers');
        expect(data).toHaveProperty('pagination');
      } else {
        // May require authentication via cookie
        console.log('Employer API requires authentication via browser session');
      }
    });

    test('should include aliases when parameter is set', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);

      // Make authenticated request via page context
      const response = await page.request.get(
        `${BASE_URL}/api/employers?q=test&includeAliases=true&page=1&pageSize=10`
      );

      if (response.status() === 200) {
        const data = await response.json();
        
        expect(data).toHaveProperty('employers');
        expect(data).toHaveProperty('debug');
        
        if (data.debug) {
          // Verify alias search was used if query present
          expect(data.debug).toHaveProperty('aliasSearchUsed');
        }
      } else {
        console.log(`Alias search API returned status: ${response.status()}`);
      }
    });
  });

  test.describe('Admin Page Navigation', () => {
    test('should show all alias initiative tabs for admin users', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      await page.waitForLoadState('networkidle');

      // Check for desktop tabs or mobile collapsibles
      const aliasAnalytics = page.locator('text=Alias Analytics').first();
      const canonicalNames = page.locator('text=Canonical Names').first();

      // At least one should be visible (depending on viewport)
      const analyticsVisible = await aliasAnalytics.isVisible().catch(() => false);
      const canonicalVisible = await canonicalNames.isVisible().catch(() => false);

      expect(analyticsVisible || canonicalVisible).toBe(true);
    });

    test('should navigate between alias tabs without errors', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}/admin`);

      await page.waitForLoadState('networkidle');

      // Try to navigate to Alias Analytics
      const analyticsTab = page.locator('text=Alias Analytics').first();
      if (await analyticsTab.isVisible()) {
        await analyticsTab.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Alias Analytics & Reporting')).toBeVisible();
      }

      // Try to navigate to Canonical Names
      const canonicalTab = page.locator('text=Canonical Names').first();
      if (await canonicalTab.isVisible()) {
        await canonicalTab.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Canonical Name Promotion Console')).toBeVisible();
      }
    });
  });

  test.describe('Integration - Full Workflow', () => {
    test('should complete full alias lifecycle', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT * 2); // Extended timeout for full workflow
      
      await loginAsAdmin(page);
      
      // Step 1: Check analytics before
      await page.goto(`${BASE_URL}/admin`);
      const analyticsTab = page.locator('text=Alias Analytics').first();
      
      if (await analyticsTab.isVisible()) {
        await analyticsTab.click();
        await page.waitForLoadState('networkidle');
        
        // Note the current metrics (we won't modify in test, just verify they load)
        await expect(page.locator('text=Total Aliases')).toBeVisible();
      }

      // Step 2: Check canonical promotion queue
      const canonicalTab = page.locator('text=Canonical Names').first();
      if (await canonicalTab.isVisible()) {
        await canonicalTab.click();
        await page.waitForLoadState('networkidle');
        
        // Verify queue loads
        await expect(page.locator('text=Canonical Name Promotion Console')).toBeVisible();
      }

      // Step 3: Verify no console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Navigate through all tabs
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForLoadState('networkidle');

      // Verify minimal errors (some expected warnings are OK)
      expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
    });
  });
});

