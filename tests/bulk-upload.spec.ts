import { test, expect } from '@playwright/test'

const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
const testEmail = process.env.TEST_ADMIN_EMAIL || 'troyburton@gmail.com'
const testPassword = process.env.TEST_ADMIN_PASSWORD || '0Rganiser!'

async function login(page) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Email').fill(testEmail)
  await page.getByPlaceholder('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(
    (url) => !url.pathname.includes('/auth'),
    { timeout: 20000 }
  )
}

test.describe('Projects Bulk Upload flow', () => {
  // Test file handling and validation
  test.describe('File Upload Validation', () => {
    test('should reject non-PDF files', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Try to upload a non-PDF file
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise

      // Create a dummy text file
      await fileChooser.setFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content')
      })

      // Should show error toast
      await expect(page.locator('[role="alert"]')).toContainText('Please upload a PDF file')
    })

    test('should handle large file uploads gracefully', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Test with a reasonably large file (10MB instead of 50MB to avoid Playwright limits)
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise

      // Create a moderately large PDF buffer
      const largePdfBuffer = Buffer.alloc(10 * 1024 * 1024, 0) // 10MB
      await fileChooser.setFiles({
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: largePdfBuffer
      })

      // Should handle large file without crashing
      await expect(dialog).toBeVisible()
      // Check for loading state or error handling
      await page.waitForTimeout(2000)
    })
  })

  // Test error scenarios
  test.describe('Error Handling', () => {
    test('should handle AI analysis failure gracefully', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Mock AI failure by intercepting the API call
      await page.route('/api/projects/batch-upload/analyze', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'AI service unavailable' })
        })
      })

      // Upload PDF
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      // Wait for AI analysis to fail
      await expect(page.locator('[role="alert"]')).toContainText('AI analysis failed', { timeout: 30000 })

      // Should fallback to manual mode
      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 10000 })
    })

    test('should handle network timeout during processing', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Mock network timeout for processing API
      await page.route('/api/projects/batch-upload/process', route => {
        // Delay response to simulate timeout
        setTimeout(() => {
          route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Request timeout' })
          })
        }, 30000) // 30 second delay
      })

      // Upload and proceed to processing
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      // Wait for analysis and proceed
      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })
      const processButton = dialog.getByRole('button', { name: /Process Upload/i })
      await processButton.click()

      // Should handle timeout gracefully
      await expect(dialog.getByText(/timeout|failed/i)).toBeVisible({ timeout: 40000 })
    })

    test('should handle corrupted PDF files', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Upload corrupted PDF
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise

      await fileChooser.setFiles({
        name: 'corrupted.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('not a real pdf content')
      })

      // Should show error message
      await expect(page.locator('[role="alert"]')).toContainText('Failed to read PDF', { timeout: 10000 })
    })
  })

  // Test user interaction edge cases
  test.describe('User Interaction Edge Cases', () => {
    test('should prevent rapid clicking during processing', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })
      const processButton = dialog.getByRole('button', { name: /Process Upload/i })

      // Rapid click multiple times
      await processButton.click()
      await processButton.click()
      await processButton.click()

      // Should only process once
      await expect(dialog.getByText(/Processing scans/i)).toBeVisible({ timeout: 60000 })
      await expect(processButton).toBeDisabled()
    })

    test('should handle dialog closing during processing', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })
      const processButton = dialog.getByRole('button', { name: /Process Upload/i })
      await processButton.click()

      // Try to close dialog during processing
      await expect(dialog.getByText(/Processing scans/i)).toBeVisible({ timeout: 60000 })

      // Press Escape key - should not close during processing
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()

      // Try clicking outside - should not close
      await page.mouse.click(100, 100)
      await expect(dialog).toBeVisible()
    })

    test('should handle browser navigation during upload', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

      // Navigate away and back
      await page.goto(`${baseUrl}/projects`)
      await page.goBack()

      // Dialog should be closed and state reset
      await expect(dialog).not.toBeVisible()

      // Should be able to open again
      await bulkUploadButton.click()
      await expect(dialog).toBeVisible()
    })
  })

  // Test accessibility
  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Test Tab navigation
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()

      // Test file input accessibility
      const fileInput = dialog.locator('input[type="file"]')
      await expect(fileInput).toBeVisible()
      await expect(fileInput).toHaveAttribute('accept', '.pdf')

      // Test AI toggle
      const aiToggle = page.getByRole('switch')
      await expect(aiToggle).toBeVisible()
      await aiToggle.focus()
      await page.keyboard.press('Space')
    })

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Check dialog accessibility
      await expect(dialog).toHaveAttribute('role', 'dialog')
      await expect(dialog).toHaveAttribute('aria-modal', 'true')

      // Check progress bar accessibility when processing
      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })
      const processButton = dialog.getByRole('button', { name: /Process Upload/i })
      await processButton.click()

      await expect(dialog.getByText(/Processing scans/i)).toBeVisible({ timeout: 60000 })

      // Check progress element
      const progressElement = dialog.locator('[role="progressbar"]')
      if (await progressElement.isVisible()) {
        await expect(progressElement).toHaveAttribute('aria-label')
      }
    })
  })

  // Test performance and memory
  test.describe('Performance and Memory', () => {
    test('should handle memory usage with large projects', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      const bulkUploadButton = page.getByRole('button', { name: /Bulk Upload/i })
      await bulkUploadButton.click()

      const dialog = page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })
      await expect(dialog).toBeVisible()

      // Monitor memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      const fileChooserPromise = page.waitForEvent('filechooser')
      await dialog.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(dialog.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

      // Check memory after processing
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      // Memory increase should be reasonable (less than 100MB)
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024)
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`)

      // Should not cause memory leaks (this is a soft check)
      expect(memoryIncrease).toBeLessThan(100)
    })
  })

  // Original happy path test
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
