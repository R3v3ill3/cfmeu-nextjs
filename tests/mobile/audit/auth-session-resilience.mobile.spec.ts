import { test, expect, TestInfo } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { MobileHelpers } from '../helpers/mobile-helpers';
import { testUsers } from '../fixtures/test-data';

const PROFILE_QUERY_KEY = ['settings-current-user'];
const SUPABASE_PROFILE_ROUTE = '**/rest/v1/profiles**';
const TEST_WIZARD_BASE = '/site-visit-wizard?projectId=test-project&projectName=Automation%20Project&phase=action-menu';

async function throttleProfileRequests(page, delayMs = 5000) {
  await page.route(SUPABASE_PROFILE_ROUTE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

async function waitForQueryClient(page) {
  await page.waitForFunction(() => typeof (window as any).__REACT_QUERY_CLIENT__ !== 'undefined', null, {
    timeout: 10000,
  });
}

async function ensureSettingsProfileInitialized(page) {
  await page.waitForFunction(
    (key) => {
      const client = (window as any).__REACT_QUERY_CLIENT__;
      if (!client) return false;
      return !!client.getQueryData(key);
    },
    PROFILE_QUERY_KEY,
    { timeout: 20000 }
  );
}

async function assertProfileCache(page, stepLabel: string) {
  const result = await page.evaluate((key) => {
    const client = (window as any).__REACT_QUERY_CLIENT__;
    if (!client) return { hasData: false };
    const data = client.getQueryData(key);
    return { hasData: !!data };
  }, PROFILE_QUERY_KEY);

  expect(result.hasData, `settings-current-user cache should exist after ${stepLabel}`).toBeTruthy();
}

async function attachReactQueryLog(page, testInfo: TestInfo) {
  const log = await page.evaluate(() => {
    return (window as any).__REACT_QUERY_DEBUG_LOG__ || [];
  });

  await testInfo.attach('react-query-log-mobile', {
    body: JSON.stringify(log, null, 2),
    contentType: 'application/json',
  });
}

async function openTestEmployerModal(page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('cfmeu:test-open-employer-modal', {
        detail: { employerId: 'mobile-test-role' },
      })
    );
  });
}

async function closeTestEmployerModal(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cfmeu:test-close-employer-modal'));
  });
}

test.describe('Auth session resilience - mobile flows', () => {
  let authHelpers: AuthHelpers;
  let mobileHelpers: MobileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    mobileHelpers = new MobileHelpers(page);
    await throttleProfileRequests(page);
    await authHelpers.login(testUsers.organizer);
    await waitForQueryClient(page);
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.unroute(SUPABASE_PROFILE_ROUTE);
    } catch {
      // ignore
    }
  });

  test('keeps profile cache intact across mobile wizard flow', async ({ page }, testInfo) => {
    await page.goto('/settings');
    await ensureSettingsProfileInitialized(page);
    await assertProfileCache(page, 'settings bootstrap');

    await page.goto('/projects');
    await assertProfileCache(page, 'projects landing');

    await openTestEmployerModal(page);
    await expect(page.getByTestId('employer-detail-modal')).toBeVisible({ timeout: 10000 });
    await assertProfileCache(page, 'employer modal open');
    await closeTestEmployerModal(page);
    await expect(page.getByTestId('employer-detail-modal')).toBeHidden({ timeout: 10000 });

    await page.goto(TEST_WIZARD_BASE);
    await assertProfileCache(page, 'wizard action menu');

    await page.goto(`${TEST_WIZARD_BASE}&view=ratings`);
    await assertProfileCache(page, 'wizard ratings view');

    await attachReactQueryLog(page, testInfo);

    // Capture quick screenshots for debugging context
    await mobileHelpers.captureScreenshots('auth-session-wizard');
  });
});


