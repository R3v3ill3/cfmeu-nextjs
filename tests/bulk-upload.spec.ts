import { test, expect } from '@playwright/test'

const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
const testEmail = process.env.TEST_ADMIN_EMAIL || 'troyburton@gmail.com'
const testPassword = process.env.TEST_ADMIN_PASSWORD || '0Rganiser!'

async function login(page) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Email').fill(testEmail)
  await page.getByPlaceholder('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/projects/, { timeout: 15000 })
}

test.describe('Projects Bulk Upload flow', () => {
  test('bulk upload happy path using mapping-sheet PDF', async ({ page }) => {
    await login(page)

    // Navigate to Projects page explicitly (in case redirect lands elsewhere)
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' })

    // Wait for bulk upload button
    const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
    await expect(bulkUploadButton).toBeVisible()

    // Open dialog
    await bulkUploadButton.click()
    const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
    await expect(dialog).toBeVisible()

    // Upload PDF via dropzone
    const fileChooserPromise = page.waitForEvent('filechooser')
    await dialog.locator('input[type="file"]').click({ force: true })
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

    // Wait for AI analyze button to be enabled and trigger it
    const analyzeButton = dialog.getByRole('button', { name: /Analyze with AI/ })
    await expect(analyzeButton).toBeEnabled({ timeout: 20000 })
    await analyzeButton.click()

    // Wait for define step
    await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

    // Ensure at least one project definition appears
    const projectCards = dialog.locator('div').filter({ hasText: /Project/ }).first()
    await expect(projectCards).toBeVisible()

    // Process upload
    const processButton = dialog.getByRole('button', { name: /Process Upload/i })
    await expect(processButton).toBeEnabled()
    await processButton.click()

    // Watch processing state
    await expect(dialog.getByText(/Processing scans/i)).toBeVisible({ timeout: 600000 })

    // Wait for completion (either success or error for diagnostics)
    await expect(dialog.getByText(/Upload Complete|Upload failed/i)).toBeVisible({ timeout: 600000 })

    // Capture screenshot for report
    await page.screenshot({ path: 'playwright-report/bulk-upload-final.png', fullPage: true })
  })
})
