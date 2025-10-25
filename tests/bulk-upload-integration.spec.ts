import { test, expect } from '@playwright/test'
import { devices } from '@playwright/test'

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

test.describe('Bulk Upload Integration Tests', () => {
  // Test different browsers and devices
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test.describe(`${browserName} browser`, () => {
      test.use({ browserName })

      test('complete bulk upload workflow on desktop', async ({ page }) => {
        await login(page)
        await page.goto(`${baseUrl}/projects`)

        // Open bulk upload dialog
        await page.getByRole('button', { name: /Bulk Upload/i }).click()
        await expect(page.getByRole('dialog', { name: /Bulk Upload Mapping Sheets/i })).toBeVisible()

        // Upload PDF file
        const fileChooserPromise = page.waitForEvent('filechooser')
        await page.locator('input[type="file"]').click({ force: true })
        const fileChooser = await fileChooserPromise
        await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

        // Wait for AI analysis
        await expect(page.getByRole('button', { name: /Analyze with AI/ })).toBeEnabled({ timeout: 20000 })
        await page.getByRole('button', { name: /Analyze with AI/ }).click()

        // Wait for project definitions
        await expect(page.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

        // Verify project definitions are displayed
        const projectCards = page.locator('div').filter({ hasText: /Project/ }).first()
        await expect(projectCards).toBeVisible()

        // Process the upload
        await page.getByRole('button', { name: /Process Upload/i }).click()

        // Wait for processing to complete
        await expect(page.getByText(/Upload Complete/)).toBeVisible({ timeout: 600000 })

        // Verify completion details
        await expect(page.getByText(/Successfully processed/)).toBeVisible()
        await expect(page.getByText(/Batch ID:/)).toBeVisible()

        // Test navigation to batch details
        const [newPage] = await Promise.all([
          page.context().waitForEvent('page'),
          page.getByRole('button', { name: /View Batch Details/ }).click()
        ])

        await expect(newPage).toHaveURL(/\/projects\/batches\//)
        await newPage.close()
      })
    })
  })

  // Mobile device testing
  test.describe('Mobile devices', () => {
    ['iPhone 13', 'Pixel 5'].forEach(deviceName => {
      test(`complete workflow on ${deviceName}`, async ({ page }) => {
        test.use({ ...devices[deviceName] })

        await login(page)
        await page.goto(`${baseUrl}/projects`)

        // Test mobile-specific interactions
        await page.getByRole('button', { name: /Bulk Upload/i }).tap()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Test file upload on mobile
        const fileChooserPromise = page.waitForEvent('filechooser')
        await page.locator('input[type="file"]').click({ force: true })
        const fileChooser = await fileChooserPromise
        await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

        // Test scrolling on mobile
        await page.getByRole('button', { name: /Analyze with AI/ }).scrollIntoViewIfNeeded()
        await expect(page.getByRole('button', { name: /Analyze with AI/ })).toBeEnabled({ timeout: 20000 })

        await page.getByRole('button', { name: /Analyze with AI/ }).tap()

        // Test mobile form interactions
        await expect(page.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

        // Test mobile scrolling in project definitions
        await page.getByRole('button', { name: /Process Upload/i }).scrollIntoViewIfNeeded()
        await page.getByRole('button', { name: /Process Upload/i }).tap()

        await expect(page.getByText(/Upload Complete/)).toBeVisible({ timeout: 600000 })
      })
    })
  })

  // Cross-browser compatibility tests
  test.describe('Cross-browser compatibility', () => {
    test('PDF upload functionality across browsers', async ({ page, browserName }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      await page.getByRole('button', { name: /Bulk Upload/i }).click()

      // Test drag and drop (may not work in all browsers)
      if (browserName !== 'webkit') { // Safari has limited drag-drop support
        const fileInput = page.locator('input[type="file"]')

        // Create a data transfer object for drag and drop
        const dataTransfer = await page.evaluateHandle(() => new DataTransfer())

        // Test drop functionality
        await page.dispatchEvent('[data-testid="dropzone"]', 'drop', {
          dataTransfer
        })
      }

      // Fallback to click upload
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await expect(page.getByText(/Adnan Hvrat/)).toBeVisible({ timeout: 10000 })
    })
  })

  // Performance tests
  test.describe('Performance testing', () => {
    test('memory usage during large file processing', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      // Monitor performance metrics
      await page.goto(`${baseUrl}/projects`)

      // Get initial memory usage
      const initialMetrics = await page.evaluate(() => {
        const perfEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        return {
          domContentLoaded: perfEntries.domContentLoadedEventEnd - perfEntries.domContentLoadedEventStart,
          loadComplete: perfEntries.loadEventEnd - perfEntries.loadEventStart,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
        }
      })

      console.log(`Initial performance metrics for ${page.context().browser().browserType().name()}:`, initialMetrics)

      // Test with large file (simulate)
      await page.getByRole('button', { name: /Bulk Upload/i }).click()

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      // Measure performance during processing
      const processingMetrics = await page.evaluate(() => {
        return {
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          timestamp: Date.now()
        }
      })

      console.log('Processing metrics:', processingMetrics)

      // Memory increase should be reasonable
      const memoryIncrease = (processingMetrics.memoryUsage - initialMetrics.memoryUsage) / (1024 * 1024)
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`)
      expect(memoryIncrease).toBeLessThan(200) // Allow up to 200MB increase
    })

    test('page load performance with bulk upload dialog', async ({ page }) => {
      await login(page)

      // Measure page load performance
      const navigationStart = await page.evaluate(() => performance.now())
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' })

      const loadComplete = await page.evaluate(() => performance.now())
      const loadTime = loadComplete - navigationStart

      console.log(`Page load time: ${loadTime.toFixed(2)}ms`)

      // Page should load within reasonable time
      expect(loadTime).toBeLessThan(3000) // 3 seconds

      // Test dialog opening performance
      const dialogOpenStart = await page.evaluate(() => performance.now())
      await page.getByRole('button', { name: /Bulk Upload/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      const dialogOpenComplete = await page.evaluate(() => performance.now())
      const dialogOpenTime = dialogOpenComplete - dialogOpenStart

      console.log(`Dialog open time: ${dialogOpenTime.toFixed(2)}ms`)
      expect(dialogOpenTime).toBeLessThan(500) // 500ms
    })
  })

  // Error handling integration tests
  test.describe('Error handling workflows', () => {
    test('network failure recovery', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      // Simulate network failure during upload
      await page.route('/api/projects/batch-upload/init', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Network error' })
        })
      })

      await page.getByRole('button', { name: /Bulk Upload/i }).click()

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      await page.getByRole('button', { name: /Analyze with AI/ }).click()
      await expect(page.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

      await page.getByRole('button', { name: /Process Upload/i }).click()

      // Should show error message and recovery options
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 10000 })

      // Test retry functionality
      await page.unroute('/api/projects/batch-upload/init')

      if (await page.getByRole('button', { name: /Retry/i }).isVisible()) {
        await page.getByRole('button', { name: /Retry/i }).click()
        // Should proceed normally after retry
        await expect(page.getByText(/Processing scans/)).toBeVisible({ timeout: 60000 })
      }
    })

    test('file corruption handling', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      await page.getByRole('button', { name: /Bulk Upload/i }).click()

      // Upload corrupted file
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('input[type="file"]').click({ force: true })
      const fileChooser = await fileChooserPromise

      await fileChooser.setFiles({
        name: 'corrupted.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('not a real pdf content')
      })

      // Should show user-friendly error message
      await expect(page.locator('[role="alert"]')).toContainText('Failed to read PDF', { timeout: 10000 })

      // User should be able to try again with a different file
      await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()
      await expect(page.locator('input[type="file"]')).toBeVisible()
    })
  })

  // Accessibility integration tests
  test.describe('Accessibility integration', () => {
    test('screen reader workflow', async ({ page }) => {
      await login(page)
      await page.goto(`${baseUrl}/projects`)

      // Enable accessibility testing
      await page.emulateMedia({ reducedMotion: 'reduce' })

      // Test keyboard navigation
      await page.keyboard.press('Tab')
      let focused = await page.locator(':focus').getAttribute('aria-label')
      expect(focused).toBeTruthy()

      await page.getByRole('button', { name: /Bulk Upload/i }).focus()
      await page.keyboard.press('Enter')

      // Test dialog accessibility
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')

      // Test file input accessibility
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toHaveAttribute('accept', '.pdf')

      // Test keyboard file upload
      fileInput.focus()
      await page.keyboard.press('Enter')

      const fileChooserPromise = page.waitForEvent('filechooser')
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('tests/Adnan Hvrat Mapping Sheets.pdf')

      // Test screen reader announcements
      await expect(page.locator('[role="status"]')).toBeVisible()

      // Test progress bar accessibility
      await page.getByRole('button', { name: /Analyze with AI/ }).click()
      await expect(page.getByText('Project Definitions')).toBeVisible({ timeout: 30000 })

      await page.getByRole('button', { name: /Process Upload/i }).click()
      await expect(page.getByText(/Processing scans/)).toBeVisible({ timeout: 60000 })

      // Test progress element accessibility
      const progressElement = page.locator('[role="progressbar"]')
      if (await progressElement.isVisible()) {
        await expect(progressElement).toHaveAttribute('aria-valuenow')
        await expect(progressElement).toHaveAttribute('aria-valuemin')
        await expect(progressElement).toHaveAttribute('aria-valuemax')
      }
    })

    test('high contrast mode support', async ({ page }) => {
      await login(page)

      // Emulate high contrast mode
      await page.emulateMedia({
        colorScheme: 'dark',
        reducedMotion: 'reduce'
      })

      await page.goto(`${baseUrl}/projects`)
      await page.getByRole('button', { name: /Bulk Upload/i }).click()

      // Test that all interactive elements are visible in high contrast
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.locator('input[type="file"]')).toBeVisible()
      await expect(page.getByRole('button', { name: /Analyze with AI/ })).toBeVisible()
    })
  })
})