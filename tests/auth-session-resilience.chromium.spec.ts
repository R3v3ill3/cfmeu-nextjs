import { test, expect, TestInfo } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

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

  await testInfo.attach('react-query-log', {
    body: JSON.stringify(log, null, 2),
    contentType: 'application/json',
  });
}

async function openTestEmployerModal(page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('cfmeu:test-open-employer-modal', {
        detail: { employerId: 'test-role' },
      })
    );
  });
}

async function closeTestEmployerModal(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cfmeu:test-close-employer-modal'));
  });
}

test.describe('Auth session resilience - desktop chromium', () => {
  test.beforeEach(async ({ page }) => {
    await throttleProfileRequests(page);
    await loginAsAdmin(page);
    await waitForQueryClient(page);
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.unroute(SUPABASE_PROFILE_ROUTE);
    } catch {
      // ignore - route might already be removed
    }
  });

  test('keeps profile cache intact across modal + wizard navigation', async ({ page }, testInfo) => {
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
  });
});


