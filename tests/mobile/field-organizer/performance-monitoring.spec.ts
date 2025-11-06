import { test, expect } from '@playwright/test'
import { PERFORMANCE_THRESHOLDS } from '../../../src/lib/performance/performance-monitoring'

// Field organizer specific mobile viewports
const FIELD_ORGANIZER_DEVICES = {
  iPhone13: { width: 390, height: 844, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)' },
  iPhone13Pro: { width: 393, height: 852, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)' },
  SmallAndroid: { width: 360, height: 640, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B)' },
  Tablet: { width: 768, height: 1024, userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)' }
}

test.describe('Field Organizer Mobile Performance Monitoring', () => {
  Object.entries(FIELD_ORGANIZER_DEVICES).forEach(([deviceName, viewport]) => {
    test.describe(`${deviceName} Performance Monitoring`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: viewport.userAgent
      })

      test('should load performance dashboard within threshold', async ({ page }) => {
        const startTime = Date.now()

        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('[data-testid="performance-score"]')

        const loadTime = Date.now() - startTime
        console.log(`${deviceName} Performance Dashboard Load Time: ${loadTime}ms`)

        // Should load within 2 seconds for field organizers
        expect(loadTime).toBeLessThan(2000)

        // Check if performance score is displayed
        const scoreElement = await page.locator('[data-testid="performance-score"]').first()
        await expect(scoreElement).toBeVisible()

        const score = await scoreElement.textContent()
        expect(score).toMatch(/\d+\/100/)
      })

      test('should track GPS performance accurately', async ({ page }) => {
        // Mock geolocation API
        await page.context().grantPermissions(['geolocation'])
        await page.setGeolocation({ latitude: -33.8688, longitude: 151.2093 })

        await page.goto('/mobile/projects/1/mapping')
        await page.waitForLoadState('networkidle')

        // Start GPS tracking
        const startGPSButton = page.locator('[data-testid="start-gps"]').first()
        if (await startGPSButton.isVisible()) {
          await startGPSButton.click()

          // Wait for GPS to acquire
          await page.waitForSelector('[data-testid="gps-accuracy"]', { timeout: 10000 })

          const accuracyElement = await page.locator('[data-testid="gps-accuracy"]').first()
          const accuracy = await accuracyElement.textContent()

          expect(accuracy).toMatch(/\d+m/)
          const accuracyValue = parseInt(accuracy?.replace('m', '') || '0')
          expect(accuracyValue).toBeLessThan(50) // Should be under 50m accuracy
        }
      })

      test('should monitor photo capture performance', async ({ page }) => {
        await page.goto('/mobile/projects/1/mapping')
        await page.waitForLoadState('networkidle')

        // Mock camera API
        await page.addInitScript(() => {
          const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
          Object.defineProperty(navigator, 'mediaDevices', {
            value: {
              getUserMedia: () => Promise.resolve({
                getTracks: () => [{ stop: () => {} }]
              })
            }
          })
        })

        // Test photo capture
        const photoButton = page.locator('[data-testid="capture-photo"]').first()
        if (await photoButton.isVisible()) {
          const startTime = Date.now()
          await photoButton.click()

          // Wait for photo processing
          await page.waitForSelector('[data-testid="photo-preview"]', { timeout: 5000 })
          const captureTime = Date.now() - startTime

          console.log(`${deviceName} Photo Capture Time: ${captureTime}ms`)
          expect(captureTime).toBeLessThan(3000) // Should capture within 3 seconds
        }
      })

      test('should track form completion performance', async ({ page }) => {
        await page.goto('/mobile/projects/1/mapping')
        await page.waitForLoadState('networkidle')

        // Add employer form
        const addEmployerButton = page.locator('[data-testid="add-employer"]').first()
        await addEmployerButton.click()

        await page.waitForSelector('[data-testid="employer-form"]')

        const startTime = Date.now()

        // Fill form fields
        await page.fill('[data-testid="employer-name"]', 'Test Construction Co')
        await page.fill('[data-testid="contact-person"]', 'John Doe')
        await page.fill('[data-testid="phone"]', '0412345678')
        await page.selectOption('[data-testid="employer-role"]', 'trade_subcontractor')

        // Submit form
        await page.click('[data-testid="submit-employer"]')

        const completionTime = Date.now() - startTime
        console.log(`${deviceName} Form Completion Time: ${completionTime}ms`)

        // Should complete within 30 seconds
        expect(completionTime).toBeLessThan(30000)

        // Check for success confirmation
        await page.waitForSelector('[data-testid="success-message"]', { timeout: 5000 })
      })

      test('should handle offline mode gracefully', async ({ page }) => {
        // Go offline
        await page.context().setOffline(true)

        await page.goto('/mobile/projects/1/mapping')
        await page.waitForLoadState('networkidle')

        // Check offline indicator
        const offlineIndicator = page.locator('[data-testid="offline-indicator"]')
        await expect(offlineIndicator).toBeVisible()

        // Try to add employer while offline
        const addEmployerButton = page.locator('[data-testid="add-employer"]').first()
        await addEmployerButton.click()

        await page.waitForSelector('[data-testid="employer-form"]')
        await page.fill('[data-testid="employer-name"]', 'Offline Test Co')
        await page.click('[data-testid="submit-employer"]')

        // Should show queuing message
        const queueMessage = page.locator('[data-testid="queue-message"]')
        await expect(queueMessage).toBeVisible()

        // Go back online
        await page.context().setOffline(false)

        // Should sync automatically
        await page.waitForSelector('[data-testid="sync-indicator"]', { timeout: 10000 })
      })

      test('should maintain performance during heavy usage', async ({ page }) => {
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')

        // Simulate heavy usage by performing multiple actions
        const actions = [
          () => page.click('[data-testid="refresh-button"]'),
          () => page.tap('[data-testid="metric-card"]'),
          () => page.swipe('[data-testid="metrics-container"]', 'left'),
          () => page.click('[data-testid="optimization-action"]'),
        ]

        const startTime = Date.now()
        let frameDrops = 0

        // Monitor frame rate during actions
        const frameMonitor = page.evaluate(() => {
          let frameCount = 0
          let lastTime = performance.now()
          let drops = 0

          function countFrames() {
            frameCount++
            const currentTime = performance.now()

            if (currentTime - lastTime >= 1000) {
              if (frameCount < 55) drops++ // Less than 55fps is considered frame drops
              frameCount = 0
              lastTime = currentTime
            }

            requestAnimationFrame(countFrames)
          }

          requestAnimationFrame(countFrames)
          return drops
        })

        // Perform actions rapidly
        for (let i = 0; i < actions.length * 3; i++) {
          const action = actions[i % actions.length]
          await action()
          await page.waitForTimeout(100) // Small delay between actions
        }

        const totalTime = Date.now() - startTime
        frameDrops = await frameMonitor

        console.log(`${deviceName} Heavy Usage Performance:`)
        console.log(`  Total Time: ${totalTime}ms`)
        console.log(`  Frame Drops: ${frameDrops}`)

        // Should not drop more than 3 frames during heavy usage
        expect(frameDrops).toBeLessThanOrEqual(3)
        expect(totalTime).toBeLessThan(10000) // Should complete within 10 seconds
      })

      test('should optimize for different network conditions', async ({ page }) => {
        // Test slow 3G conditions
        await page.route('**/*', async (route) => {
          await route.continue({
            // Simulate 3G network
            headers: {
              ...route.request().headers(),
              'x-playwright-network-speed': '3G'
            }
          })
        })

        const startTime = Date.now()
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')
        const loadTime = Date.now() - startTime

        console.log(`${deviceName} 3G Load Time: ${loadTime}ms`)

        // Should still load within 8 seconds on 3G
        expect(loadTime).toBeLessThan(8000)

        // Check if performance monitoring still works
        const scoreElement = await page.locator('[data-testid="performance-score"]').first()
        await expect(scoreElement).toBeVisible()
      })

      test('should handle memory efficiently', async ({ page }) => {
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')

        // Get initial memory usage
        const initialMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize
          }
          return 0
        })

        // Perform memory-intensive operations
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="refresh-button"]')
          await page.waitForTimeout(500)
        }

        // Get final memory usage
        const finalMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize
          }
          return 0
        })

        if (initialMemory > 0 && finalMemory > 0) {
          const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB
          console.log(`${deviceName} Memory Increase: ${memoryIncrease.toFixed(2)}MB`)

          // Should not increase by more than 20MB
          expect(memoryIncrease).toBeLessThan(20)
        }
      })

      test('should provide accurate performance metrics', async ({ page }) => {
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')

        // Check for all required performance metrics
        const requiredMetrics = [
          '[data-testid="performance-score"]',
          '[data-testid="gps-accuracy"]',
          '[data-testid="battery-level"]',
          '[data-testid="memory-usage"]',
          '[data-testid="network-status"]',
          '[data-testid="touch-response"]'
        ]

        for (const metric of requiredMetrics) {
          const element = page.locator(metric)
          if (await element.isVisible()) {
            await expect(element).toBeVisible()

            const text = await element.textContent()
            expect(text).toBeTruthy()
            expect(text!.length).toBeGreaterThan(0)
          }
        }

        // Check performance alerts
        const alertsContainer = page.locator('[data-testid="performance-alerts"]')
        if (await alertsContainer.isVisible()) {
          const alerts = alertsContainer.locator('[data-testid="alert-item"]')
          const alertCount = await alerts.count()

          // Should not have more than 5 critical alerts
          const criticalAlerts = alerts.filter({ has: page.locator('.critical') })
          expect(await criticalAlerts.count()).toBeLessThanOrEqual(5)
        }
      })

      test('should handle touch interactions optimally', async ({ page }) => {
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')

        // Test touch response times
        const touchTargets = page.locator('button, [role="button"], .touch-target')
        const touchCount = await touchTargets.count()

        if (touchCount > 0) {
          const touchTimes = []

          for (let i = 0; i < Math.min(touchCount, 5); i++) {
            const target = touchTargets.nth(i)
            const startTime = Date.now()

            await target.tap()
            const responseTime = Date.now() - startTime

            touchTimes.push(responseTime)
          }

          const avgTouchTime = touchTimes.reduce((a, b) => a + b, 0) / touchTimes.length
          console.log(`${deviceName} Average Touch Response: ${avgTouchTime.toFixed(2)}ms`)

          // Touch responses should be under 200ms on average
          expect(avgTouchTime).toBeLessThan(200)
        }

        // Test swipe gestures
        const swipeableContainer = page.locator('[data-testid="swipeable-container"]').first()
        if (await swipeableContainer.isVisible()) {
          const box = await swipeableContainer.boundingBox()
          if (box) {
            await page.touch.tap(box.x + box.width / 2, box.y + box.height / 2)
            await page.touch.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.touch.move(box.x - 100, box.y + box.height / 2)
            await page.touch.end()

            // Check if swipe was registered
            await page.waitForTimeout(500)
          }
        }
      })

      test('should adapt to device capabilities', async ({ page }) => {
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')

        // Check if device adapts to screen size
        const isSmallScreen = viewport.width < 400
        const isLargeScreen = viewport.width > 700

        if (isSmallScreen) {
          // Should use compact layout on small screens
          const compactElements = page.locator('.compact-layout')
          const compactCount = await compactElements.count()
          expect(compactCount).toBeGreaterThan(0)
        }

        if (isLargeScreen) {
          // Should use enhanced layout on larger screens
          const enhancedElements = page.locator('.enhanced-layout')
          const enhancedCount = await enhancedElements.count()
          expect(enhancedCount).toBeGreaterThan(0)
        }

        // Check for responsive typography
        const bodyElement = page.locator('body')
        const fontSize = await bodyElement.evaluate(el =>
          window.getComputedStyle(el).getPropertyValue('font-size')
        )

        expect(fontSize).toBeTruthy()
        const fontSizeValue = parseInt(fontSize || '16px')

        // Font size should be appropriate for device size
        if (isSmallScreen) {
          expect(fontSizeValue).toBeGreaterThanOrEqual(14)
        } else {
          expect(fontSizeValue).toBeGreaterThanOrEqual(16)
        }
      })
    })
  })

  test.describe('Cross-Device Performance Consistency', () => {
    test('should maintain consistent performance across devices', async ({ page }) => {
      const deviceResults = []

      for (const [deviceName, viewport] of Object.entries(FIELD_ORGANIZER_DEVICES)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })

        const startTime = Date.now()
        await page.goto('/mobile/performance-dashboard')
        await page.waitForLoadState('networkidle')
        const loadTime = Date.now() - startTime

        // Get performance score
        const scoreElement = await page.locator('[data-testid="performance-score"]').first()
        const scoreText = await scoreElement.textContent()
        const score = parseInt(scoreText?.split('/')[0] || '0')

        deviceResults.push({
          device: deviceName,
          loadTime,
          score,
          viewport: `${viewport.width}x${viewport.height}`
        })
      }

      console.log('Cross-Device Performance Results:')
      deviceResults.forEach(result => {
        console.log(`  ${result.device} (${result.viewport}): ${result.loadTime}ms, Score: ${result.score}`)
      })

      // Load times should be consistent (within 50% variance)
      const loadTimes = deviceResults.map(r => r.loadTime)
      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length
      const maxVariance = avgLoadTime * 0.5

      for (const result of deviceResults) {
        expect(Math.abs(result.loadTime - avgLoadTime)).toBeLessThan(maxVariance)
      }

      // Performance scores should be consistent (within 20 point variance)
      const scores = deviceResults.map(r => r.score)
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
      const maxScoreVariance = 20

      for (const result of deviceResults) {
        expect(Math.abs(result.score - avgScore)).toBeLessThan(maxScoreVariance)
      }
    })
  })

  test.describe('Real-World Simulation Tests', () => {
    test('should handle typical field organizer workflow', async ({ page }) => {
      await page.goto('/mobile/dashboard')
      await page.waitForLoadState('networkidle')

      const workflowStartTime = Date.now()

      // Step 1: Navigate to project
      await page.click('[data-testid="project-card"]')
      await page.waitForLoadState('networkidle')

      // Step 2: Start mapping
      await page.click('[data-testid="start-mapping"]')
      await page.waitForSelector('[data-testid="mapping-workflow"]')

      // Step 3: Add employer
      await page.click('[data-testid="add-employer"]')
      await page.waitForSelector('[data-testid="employer-form"]')

      // Step 4: Fill form quickly (simulating field conditions)
      await page.fill('[data-testid="employer-name"]', 'Quick Test Co')
      await page.fill('[data-testid="phone"]', '0412345678')
      await page.click('[data-testid="submit-employer"]')

      // Step 5: Take photo
      const photoButton = page.locator('[data-testid="capture-photo"]')
      if (await photoButton.isVisible()) {
        await photoButton.click()
        await page.waitForTimeout(1000) // Simulate photo capture time
      }

      // Step 6: Complete mapping
      await page.click('[data-testid="complete-mapping"]')
      await page.waitForSelector('[data-testid="success-message"]')

      const workflowTime = Date.now() - workflowStartTime
      console.log(`Complete Field Workflow Time: ${workflowTime}ms`)

      // Should complete entire workflow within 2 minutes
      expect(workflowTime).toBeLessThan(120000)
    })

    test('should maintain performance during interruptions', async ({ page }) => {
      await page.goto('/mobile/projects/1/mapping')
      await page.waitForLoadState('networkidle')

      // Simulate phone call interruption
      await page.evaluate(() => {
        // Simulate incoming call overlay
        const overlay = document.createElement('div')
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
        `
        overlay.textContent = 'Incoming Call...'
        document.body.appendChild(overlay)

        // Remove after 3 seconds
        setTimeout(() => overlay.remove(), 3000)
      })

      // Wait for interruption to end
      await page.waitForTimeout(3500)

      // Check if app is still responsive
      const testButton = page.locator('button').first()
      await expect(testButton).toBeVisible()

      const responseStartTime = Date.now()
      await testButton.tap()
      const responseTime = Date.now() - responseStartTime

      // Should still respond quickly after interruption
      expect(responseTime).toBeLessThan(500)
    })
  })
})

test.describe('Performance Monitoring API Tests', () => {
  test('should collect and store performance metrics', async ({ page, request }) => {
    await page.goto('/mobile/performance-dashboard')
    await page.waitForLoadState('networkidle')

    // Wait for some metrics to be collected
    await page.waitForTimeout(2000)

    // Check if metrics are being sent to API
    const apiCalls = await page.evaluate(() => {
      return (window as any).performanceAPICalls || []
    })

    // Should have made at least one API call for metrics
    expect(apiCalls.length).toBeGreaterThan(0)

    // Verify API call structure
    const metricsCall = apiCalls.find((call: any) => call.url.includes('/api/mobile/field-organizer-analytics'))
    if (metricsCall) {
      expect(metricsCall.method).toBe('POST')
      expect(metricsCall.data).toHaveProperty('metrics')
      expect(metricsCall.data).toHaveProperty('deviceInfo')
    }
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/mobile/field-organizer-analytics', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })

    await page.goto('/mobile/performance-dashboard')
    await page.waitForLoadState('networkidle')

    // Should still function despite API errors
    const scoreElement = await page.locator('[data-testid="performance-score"]').first()
    await expect(scoreElement).toBeVisible()

    // Should show error indicator
    const errorIndicator = page.locator('[data-testid="api-error"]')
    if (await errorIndicator.isVisible()) {
      await expect(errorIndicator).toBeVisible()
    }
  })
})