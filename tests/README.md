# Playwright E2E Tests - Alias Initiative

## Overview

This directory contains end-to-end tests for the Employer Alias Initiative (Prompts 3B, 3C, 3D).

## Test Files

1. **`database-validation.spec.ts`** - Database object verification (no auth required)
2. **`alias-initiative.spec.ts`** - Full UI and integration tests (requires auth)
3. **`helpers/auth.ts`** - Authentication utilities
4. **`helpers/database.ts`** - Database setup and cleanup utilities

## Setup

### Prerequisites

1. **Local development server running:**
   ```bash
   pnpm dev
   ```

2. **Migrations applied:**
   ```bash
   cd supabase
   supabase db push
   ```

3. **Environment variables configured:**
   Create `.env.test` or set environment variables:
   ```bash
   # Supabase (required for database tests)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Authentication (required for UI tests)
   TEST_ADMIN_EMAIL=admin@test.com
   TEST_ADMIN_PASSWORD=test-password
   TEST_LEAD_ORGANISER_EMAIL=lead@test.com
   TEST_LEAD_ORGANISER_PASSWORD=test-password

   # Base URL (optional, defaults to localhost:3000)
   BASE_URL=http://localhost:3000
   ```

### Install Dependencies

```bash
# Install Playwright browsers (if not already installed)
pnpm exec playwright install
```

## Running Tests

### Run All Tests
```bash
pnpm exec playwright test
```

### Run Database Validation Only (No Auth Required)
```bash
pnpm exec playwright test database-validation
```

### Run UI Tests Only (Requires Auth)
```bash
pnpm exec playwright test alias-initiative
```

### Run Specific Test
```bash
pnpm exec playwright test -g "should query alias_metrics_summary"
```

### Run in UI Mode (Interactive)
```bash
pnpm exec playwright test --ui
```

### Run with Debug Mode
```bash
pnpm exec playwright test --debug
```

### Generate HTML Report
```bash
pnpm exec playwright show-report
```

## Test Coverage

### Database Validation Tests (10 tests)
- ✅ Supabase client configuration
- ✅ Database objects exist (tables, views, functions)
- ✅ `alias_metrics_summary` view query
- ✅ `canonical_review_metrics` view query
- ✅ `alias_source_system_stats` view query
- ✅ `employer_alias_coverage` view query
- ✅ `canonical_promotion_queue` view query
- ✅ `search_employers_with_aliases` RPC call
- ✅ `get_employer_aliases` RPC call
- ✅ `get_alias_metrics_range` RPC call

### UI Integration Tests (8 tests)
- Analytics dashboard display
- Analytics metrics loading
- Analytics alerts
- Canonical console display
- Canonical queue loading
- Decision dialog interaction
- Alias search API
- Tab navigation

## Expected Results

### Without Data
If your database has no aliases yet, tests should still pass but show:
- Total aliases: 0
- Coverage: 0%
- Queue: Empty
- No conflicts

### With Data
If aliases exist in your database, tests will show:
- Actual metric counts
- Coverage percentages
- Queue items (if authoritative aliases exist)
- Source system breakdowns

## Troubleshooting

### "Supabase client not initialized"
**Cause:** Missing environment variables  
**Fix:** Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### "Authentication required"
**Cause:** UI tests can't login  
**Fix:** Set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD`, or login manually before running tests

### "relation does not exist"
**Cause:** Migrations not applied  
**Fix:** Run `supabase db push` to apply migrations

### "function does not exist"
**Cause:** Migration failed or not applied  
**Fix:** Check migration status with `supabase migration list`

### Tests timeout
**Cause:** Dev server not running or slow queries  
**Fix:** Ensure `pnpm dev` is running and database is responsive

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Playwright tests
  run: |
    pnpm exec playwright install --with-deps
    pnpm exec playwright test database-validation
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

### Skip UI Tests in CI
UI tests require authentication setup. You can skip them in CI:
```bash
pnpm exec playwright test --grep-invert "Alias Initiative - Full Suite"
```

## Writing New Tests

### Database Test Pattern
```typescript
test('should test something', async () => {
  if (!testSupabase) {
    test.skip();
    return;
  }

  const { data, error } = await testSupabase
    .from('your_view')
    .select('*');

  expect(error).toBeNull();
  expect(data).not.toBeNull();
});
```

### UI Test Pattern
```typescript
test('should test UI feature', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/admin`);
  
  // Your test logic
  await expect(page.locator('text=Something')).toBeVisible();
});
```

## Best Practices

1. **Always check if testSupabase exists** before database tests
2. **Use test.skip()** for tests that can't run due to missing config
3. **Set appropriate timeouts** for slow operations
4. **Clean up test data** after tests that create records
5. **Log useful information** with console.log for debugging
6. **Handle both empty and populated databases** gracefully

## Support

For issues or questions:
- Check Playwright docs: https://playwright.dev
- Review test helpers in `tests/helpers/`
- Check migration status in database
- Verify environment variables are set correctly

