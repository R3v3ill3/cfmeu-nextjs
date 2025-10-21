import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Test suite for Add Employer functionality
 * Tests the workflow from the Employers page to create a new employer
 */

test.describe('Add Employer Workflow', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
  });

  test('should successfully add a new employer on desktop', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Employers' })).toBeVisible();

    // Click the "Add Employer" button
    const addButton = page.getByRole('button', { name: /Add Employer/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Verify dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New Employer')).toBeVisible();

    // Generate unique employer name to avoid conflicts
    const timestamp = Date.now();
    const employerName = `Test Employer ${timestamp}`;

    // Fill in required fields
    await page.locator('input#name').fill(employerName);
    
    // Select employer type
    await page.locator('#employer_type').click();
    await page.getByRole('option', { name: 'Principal Contractor' }).click();

    // Fill in optional fields
    await page.locator('input#abn').fill('12 345 678 901');
    await page.locator('input#phone').fill('03 9123 4567');
    await page.locator('input#email').fill(`test${timestamp}@example.com`);
    await page.locator('input#website').fill('https://example.com');
    await page.locator('input#estimated_worker_count').fill('50');
    await page.locator('textarea#notes').fill('This is a test employer created by automated tests');

    // Submit the form
    const createButton = page.getByRole('button', { name: /Create Employer/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for success toast
    await expect(page.getByText(/has been created successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify dialog closed
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Verify the employer appears in the list (search for it)
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(employerName);
    await page.waitForTimeout(1000); // Wait for search to filter

    // The employer should appear in the results
    await expect(page.getByText(employerName)).toBeVisible();
  });

  test('should show validation error when required fields are missing', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    // Click the "Add Employer" button
    const addButton = page.getByRole('button', { name: /Add Employer/i });
    await addButton.click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Try to submit without filling required fields
    const createButton = page.getByRole('button', { name: /Create Employer/i });
    await createButton.click();

    // Should show validation error
    await expect(page.getByText(/Employer name is required/i)).toBeVisible({ timeout: 5000 });

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should show validation error when employer type is missing', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    // Click the "Add Employer" button
    const addButton = page.getByRole('button', { name: /Add Employer/i });
    await addButton.click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill only the name
    const timestamp = Date.now();
    await page.locator('input#name').fill(`Test Employer ${timestamp}`);

    // Try to submit without selecting employer type
    const createButton = page.getByRole('button', { name: /Create Employer/i });
    await createButton.click();

    // Should show validation error
    await expect(page.getByText(/Employer type is required/i)).toBeVisible({ timeout: 5000 });

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should allow canceling the dialog', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    // Click the "Add Employer" button
    const addButton = page.getByRole('button', { name: /Add Employer/i });
    await addButton.click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in some data
    await page.locator('input#name').fill('Should Not Be Created');

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Verify employer was not created (search for it)
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('Should Not Be Created');
    await page.waitForTimeout(1000);

    // Should show no results
    const noResults = page.getByText(/No employers found/i);
    // The text might be visible, or there might be other employers, so we check if our text is NOT in the list
    const shouldNotExist = page.getByText('Should Not Be Created', { exact: true });
    await expect(shouldNotExist).not.toBeVisible();
  });

  test('should test all employer types', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    const employerTypes = [
      'Builder',
      'Principal Contractor',
      'Large Contractor',
      'Small Contractor',
      'Individual'
    ];

    for (const employerType of employerTypes) {
      // Click the "Add Employer" button
      const addButton = page.getByRole('button', { name: /Add Employer/i });
      await addButton.click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill in required fields
      const timestamp = Date.now();
      const employerName = `Test ${employerType} ${timestamp}`;
      
      await page.locator('input#name').fill(employerName);
      
      // Select employer type
      await page.locator('#employer_type').click();
      await page.getByRole('option', { name: employerType }).click();

      // Submit the form
      const createButton = page.getByRole('button', { name: /Create Employer/i });
      await createButton.click();

      // Wait for success
      await expect(page.getByText(/has been created successfully/i)).toBeVisible({ timeout: 10000 });

      // Wait for dialog to close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

      // Small delay between iterations
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Add Employer Workflow - Mobile', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE dimensions
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
  });

  test('should successfully add a new employer on mobile', async ({ page }) => {
    // Navigate to Employers page
    await page.goto(`${baseUrl}/employers`);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Employers' })).toBeVisible();

    // Click the "Add" button (mobile has shorter text)
    const addButton = page.getByRole('button', { name: /Add/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Verify dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New Employer')).toBeVisible();

    // Generate unique employer name
    const timestamp = Date.now();
    const employerName = `Mobile Test Employer ${timestamp}`;

    // Fill in required fields
    await page.locator('input#name').fill(employerName);
    
    // Select employer type
    await page.locator('#employer_type').click();
    await page.getByRole('option', { name: 'Small Contractor' }).click();

    // Fill in some optional fields
    await page.locator('input#abn').fill('98 765 432 109');
    await page.locator('input#phone').fill('0412 345 678');

    // Submit the form
    const createButton = page.getByRole('button', { name: /Create Employer/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for success toast
    await expect(page.getByText(/has been created successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify dialog closed
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Verify the employer appears in the list (search for it)
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(employerName);
    await page.waitForTimeout(1000); // Wait for search to filter

    // The employer should appear in the results
    await expect(page.getByText(employerName)).toBeVisible();
  });
});


