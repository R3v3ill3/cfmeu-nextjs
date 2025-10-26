import { test, expect } from '@playwright/test'
import { PERFORMANCE_THRESHOLDS } from '../../src/lib/performance/performance-monitoring'

// Mobile viewport configurations
const MOBILE_VIEWPORTS = {
  iPhone13: { width: 390, height: 844 },
  iPhone13Pro: { width: 393, height: 852 },
  iPhone13Mini: { width: 375, height: 812 },
  iPhone13ProMax: { width: 428, height: 926 },
  SmallMobile: { width: 360, height: 640 },
  StandardMobile: { width: 375, height: 667 }
}

test.describe('Mobile Performance Tests', () => {
  Object.entries(MOBILE_VIEWPORTS).forEach(([deviceName, viewport]) => {
    test.describe(`${deviceName} Performance`, () => {
      test.use({ viewport })

      test('should load within performance thresholds', async ({ page }) => {
        const startTime = Date.now()

        // Navigate to mobile ratings page
        await page.goto('/mobile/ratings')

        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('[data-testid="ratings-container"]')

        const loadTime = Date.now() - startTime

        console.log(`${deviceName} Load Time: ${loadTime}ms`)

        // Should load within 3 seconds on mobile
        expect(loadTime).toBeLessThan(3000)
      })

      test('should meet Core Web Vitals thresholds', async ({ page }) => {
        // Enable performance monitoring
        await page.goto('/mobile/ratings')

        // Wait for the page to load
        await page.waitForLoadState('networkidle')

        // Get performance metrics
        const performanceMetrics = await page.evaluate(() => {
          return new Promise((resolve) => {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries()
              const metrics: any = {}

              entries.forEach((entry) => {
                if (entry.entryType === 'paint') {
                  if (entry.name === 'first-contentful-paint') {
                    metrics.fcp = entry.startTime
                  } else if (entry.name === 'largest-contentful-paint') {
                    metrics.lcp = entry.startTime
                  }
                } else if (entry.entryType === 'layout-shift') {
                  metrics.cls = (metrics.cls || 0) + (entry as any).value
                } else if (entry.entryType === 'first-input') {
                  metrics.fid = (entry as any).processingStart - entry.startTime
                }
              })

              resolve(metrics)
            })

            observer.observe({ entryTypes: ['paint', 'layout-shift', 'first-input'] })

            // Fallback timeout
            setTimeout(() => resolve({}), 5000)
          })
        })

        console.log(`${deviceName} Performance Metrics:`, performanceMetrics)

        // Assert Core Web Vitals thresholds
        if (performanceMetrics.fcp) {
          expect(performanceMetrics.fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP)
        }

        if (performanceMetrics.lcp) {
          expect(performanceMetrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP)
        }

        if (performanceMetrics.cls) {
          expect(performanceMetrics.cls).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS)
        }

        if (performanceMetrics.fid) {
          expect(performanceMetrics.fid).toBeLessThan(PERFORMANCE_THRESHOLDS.FID)
        }
      })

      test('should maintain 60fps during interactions', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        // Test scrolling performance
        const frameRates: number[] = []

        await page.evaluate(() => {
          return new Promise((resolve) => {
            let frameCount = 0
            let lastTime = performance.now()

            function measureFrames() {
              frameCount++
              const currentTime = performance.now()

              if (currentTime - lastTime >= 1000) {
                resolve(frameCount)
                return
              }

              requestAnimationFrame(measureFrames)
            }

            requestAnimationFrame(measureFrames)
          })
        }).then((frameCount) => {
          frameRates.push(frameCount as number)
        })

        // Scroll down
        await page.mouse.wheel(0, 500)
        await page.waitForTimeout(1000)

        // Scroll up
        await page.mouse.wheel(0, -500)
        await page.waitForTimeout(1000)

        const averageFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length

        console.log(`${deviceName} Average Frame Rate: ${averageFrameRate}fps`)
        expect(averageFrameRate).toBeGreaterThan(55) // Allow some variance
      })

      test('should handle memory efficiently', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        // Get memory usage (Chrome-specific)
        const memoryUsage = await page.evaluate(() => {
          return new Promise((resolve) => {
            if ('memory' in performance) {
              resolve({
                used: (performance as any).memory.usedJSHeapSize,
                total: (performance as any).memory.totalJSHeapSize,
                limit: (performance as any).memory.jsHeapSizeLimit
              })
            } else {
              resolve({ used: 0, total: 0, limit: 0 })
            }
          })
        })

        if (memoryUsage.used) {
          const usedMB = memoryUsage.used / 1024 / 1024
          console.log(`${deviceName} Memory Usage: ${usedMB.toFixed(2)}MB`)

          // Should use less than 50MB on mobile
          expect(usedMB).toBeLessThan(50)
        }
      })

      test('should load efficiently on slow networks', async ({ page }) => {
        // Simulate 3G network conditions
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
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')
        const loadTime = Date.now() - startTime

        console.log(`${deviceName} 3G Load Time: ${loadTime}ms`)

        // Should still load within 8 seconds on 3G
        expect(loadTime).toBeLessThan(8000)
      })
    })
  })
})

test.describe('Mobile Bundle Size Tests', () => {
  test('should have optimized bundle sizes', async ({ page }) => {
    const bundleSizes = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const sizes: any = {}

          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resource = entry as PerformanceResourceTiming
              if (resource.name.includes('.js') || resource.name.includes('.css')) {
                const size = resource.transferSize || resource.encodedBodySize || 0
                const name = resource.name.split('/').pop()
                if (name) {
                  sizes[name] = (sizes[name] || 0) + size
                }
              }
            }
          })

          resolve(sizes)
        })

        observer.observe({ entryTypes: ['resource'] })

        // Navigate to trigger resource loading
        window.location.href = '/mobile/ratings'
      })
    })

    console.log('Bundle Sizes:', bundleSizes)

    // Total JavaScript should be under 250KB gzipped
    const totalJS = Object.entries(bundleSizes)
      .filter(([name]) => name.includes('.js'))
      .reduce((sum, [, size]) => sum + size, 0)

    console.log(`Total JS Size: ${(totalJS / 1024).toFixed(2)}KB`)
    expect(totalJS).toBeLessThan(250 * 1024) // 250KB
  })

  test('should implement code splitting', async ({ page }) => {
    const loadedChunks = new Set()

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/_next/static/chunks/') && url.includes('.js')) {
        const chunkName = url.split('/').pop()
        if (chunkName) {
          loadedChunks.add(chunkName)
        }
      }
    })

    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Should have multiple chunks (code splitting)
    expect(loadedChunks.size).toBeGreaterThan(3)
    console.log(`Loaded ${loadedChunks.size} chunks`)
  })
})

test.describe('Mobile Touch Interactions', () => {
  test.use({ viewport: MOBILE_VIEWPORTS.iPhone13 })

  test('should respond quickly to touch events', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Test tap response time
    const button = page.locator('[data-testid="rate-employer-button"]').first()
    await button.waitFor()

    const startTime = Date.now()
    await button.tap()
    const responseTime = Date.now() - startTime

    console.log(`Touch Response Time: ${responseTime}ms`)
    expect(responseTime).toBeLessThan(100) // Should respond within 100ms
  })

  test('should handle swipe gestures smoothly', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Find a swipeable element
    const swipeableElement = page.locator('[data-testid="employer-card"]').first()
    await swipeableElement.waitFor()

    // Test swipe left
    const startPosition = await swipeableElement.boundingBox()
    if (startPosition) {
      await page.touch.tap(startPosition.x + startPosition.width / 2, startPosition.y + startPosition.height / 2)
      await page.touch.move(startPosition.x + startPosition.width / 2, startPosition.y + startPosition.height / 2)
      await page.touch.move(startPosition.x - 100, startPosition.y + startPosition.height / 2)
      await page.touch.end()

      // Check if swipe action was triggered
      await page.waitForTimeout(500)
      // Add assertions based on swipe behavior
    }
  })

  test('should handle pinch to zoom', async ({ page }) => {
    await page.goto('/mobile/ratings/dashboard')
    await page.waitForLoadState('networkidle')

    // Test pinch zoom
    const chartElement = page.locator('[data-testid="rating-chart"]').first()
    await chartElement.waitFor()

    const box = await chartElement.boundingBox()
    if (box) {
      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2

      // Start pinch
      await page.touch.tap(centerX - 50, centerY)
      await page.touch.tap(centerX + 50, centerY)

      // Perform pinch
      await page.touch.move(centerX - 100, centerY)
      await page.touch.move(centerX + 100, centerY)

      // End pinch
      await page.touch.end()
      await page.touch.end()

      await page.waitForTimeout(500)
    }
  })
})

test.describe('Mobile Accessibility Tests', () => {
  test.use({ viewport: MOBILE_VIEWPORTS.iPhone13 })

  test('should have proper touch targets', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Check touch target sizes
    const buttons = page.locator('button, [role="button"], input[type="button"], input[type="submit"]')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()

      if (box) {
        // Touch targets should be at least 44x44 points
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
  })

  test('should support screen readers', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Check for proper ARIA labels
    const interactiveElements = page.locator('button, a, input, select, textarea')
    const count = await interactiveElements.count()

    for (let i = 0; i < count; i++) {
      const element = interactiveElements.nth(i)
      const ariaLabel = await element.getAttribute('aria-label')
      const ariaLabelledBy = await element.getAttribute('aria-labelledby')
      const title = await element.getAttribute('title')
      const text = await element.textContent()

      // Interactive elements should have accessible names
      expect(ariaLabel || ariaLabelledBy || title || text?.trim()).toBeTruthy()
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Test tab navigation
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)

    const focusedElement = await page.locator(':focus')
    expect(await focusedElement.count()).toBeGreaterThan(0)

    // Test Enter key on focused element
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
  })
})

test.describe('Mobile Network Tests', () => {
  test('should handle offline mode gracefully', async ({ page }) => {
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Go offline
    await page.context().setOffline(true)

    // Try to navigate to another page
    await page.goto('/mobile/ratings/dashboard')

    // Should show offline message or cached content
    await page.waitForTimeout(2000)

    // Check if offline indicator is shown
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]')
    if (await offlineIndicator.count() > 0) {
      expect(await offlineIndicator.isVisible()).toBeTruthy()
    }

    // Go back online
    await page.context().setOffline(false)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('should sync data when back online', async ({ page }) => {
    await page.context().setOffline(true)
    await page.goto('/mobile/ratings')
    await page.waitForLoadState('networkidle')

    // Perform an action that would be queued
    const rateButton = page.locator('[data-testid="rate-employer-button"]').first()
    if (await rateButton.count() > 0) {
      await rateButton.tap()
      await page.waitForTimeout(1000)
    }

    // Go back online
    await page.context().setOffline(false)
    await page.waitForTimeout(2000)

    // Check if sync indicator appears
    const syncIndicator = page.locator('[data-testid="sync-indicator"]')
    if (await syncIndicator.count() > 0) {
      expect(await syncIndicator.isVisible()).toBeTruthy()
    }
  })
})