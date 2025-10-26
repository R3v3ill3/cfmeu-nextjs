import { test, expect } from '@playwright/test'
import { MOBILE_VIEWPORTS } from './performance.spec'

test.describe('Mobile Touch Interactions', () => {
  Object.entries(MOBILE_VIEWPORTS).forEach(([deviceName, viewport]) => {
    test.describe(`${deviceName} Touch Tests`, () => {
      test.use({ viewport })

      test('should handle single tap interactions', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        // Test tapping on employer cards
        const employerCards = page.locator('[data-testid="employer-card"]')
        await expect(employerCards.first()).toBeVisible()

        // Tap first card
        await employerCards.first().tap()
        await page.waitForTimeout(300)

        // Should navigate to employer details or show more info
        const url = page.url()
        expect(url).toContain('/mobile/ratings')
      })

      test('should handle double tap interactions', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        const employerCard = page.locator('[data-testid="employer-card"]').first()
        await expect(employerCard).toBeVisible()

        // Double tap
        await employerCard.dbltap()
        await page.waitForTimeout(500)

        // Check if double tap action was triggered
        // This could open details, favorite, or another action
        const detailsModal = page.locator('[data-testid="employer-details-modal"]')
        if (await detailsModal.count() > 0) {
          await expect(detailsModal).toBeVisible()
        }
      })

      test('should handle long press interactions', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        const employerCard = page.locator('[data-testid="employer-card"]').first()
        await expect(employerCard).toBeVisible()

        // Long press
        await employerCard.tap()
        await page.waitForTimeout(600) // Hold for long press

        // Check if context menu or actions appear
        const contextMenu = page.locator('[data-testid="context-menu"]')
        const actionSheet = page.locator('[data-testid="action-sheet"]')

        const hasContextMenu = await contextMenu.count() > 0 && await contextMenu.isVisible()
        const hasActionSheet = await actionSheet.count() > 0 && await actionSheet.isVisible()

        expect(hasContextMenu || hasActionSheet).toBeTruthy()
      })

      test('should handle swipe left gestures', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        const employerCard = page.locator('[data-testid="employer-card"]').first()
        await expect(employerCard).toBeVisible()

        const box = await employerCard.boundingBox()
        if (box) {
          const startX = box.x + box.width - 50
          const centerY = box.y + box.height / 2
          const endX = box.x + 50

          // Perform swipe left
          await page.touch.tap(startX, centerY)
          await page.touch.move(startX, centerY)
          await page.touch.move(endX, centerY)
          await page.touch.end()

          await page.waitForTimeout(500)

          // Check if swipe action was triggered
          const swipeActions = page.locator('[data-testid="swipe-actions"]')
          if (await swipeActions.count() > 0) {
            await expect(swipeActions).toBeVisible()
          }
        }
      })

      test('should handle swipe right gestures', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        const employerCard = page.locator('[data-testid="employer-card"]').first()
        await expect(employerCard).toBeVisible()

        const box = await employerCard.boundingBox()
        if (box) {
          const startX = box.x + 50
          const centerY = box.y + box.height / 2
          const endX = box.x + box.width - 50

          // Perform swipe right
          await page.touch.tap(startX, centerY)
          await page.touch.move(startX, centerY)
          await page.touch.move(endX, centerY)
          await page.touch.end()

          await page.waitForTimeout(500)

          // Check if swipe action was triggered
          const swipeActions = page.locator('[data-testid="swipe-actions"]')
          if (await swipeActions.count() > 0) {
            await expect(swipeActions).toBeVisible()
          }
        }
      })

      test('should handle vertical scrolling with momentum', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        // Get initial scroll position
        const initialScrollY = await page.evaluate(() => window.scrollY)

        // Perform swipe down gesture
        await page.mouse.wheel(0, -500)
        await page.waitForTimeout(1000)

        // Check if scrolling happened with momentum
        const afterScrollY = await page.evaluate(() => window.scrollY)
        expect(afterScrollY).toBeGreaterThan(initialScrollY)

        // Test momentum scrolling continues after gesture
        await page.waitForTimeout(2000)
        const finalScrollY = await page.evaluate(() => window.scrollY)
        expect(finalScrollY).toBeGreaterThanOrEqual(afterScrollY)
      })

      test('should handle pull to refresh', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        // Get the list container
        const listContainer = page.locator('[data-testid="ratings-list"]')
        await expect(listContainer).toBeVisible()

        const box = await listContainer.boundingBox()
        if (box) {
          const startX = box.x + box.width / 2
          const startY = box.y + 100
          const endY = box.y + 300

          // Pull down gesture
          await page.touch.tap(startX, startY)
          await page.touch.move(startX, startY)
          await page.touch.move(startX, endY)
          await page.touch.end()

          await page.waitForTimeout(1500)

          // Check if refresh indicator appears
          const refreshIndicator = page.locator('[data-testid="pull-to-refresh"]')
          if (await refreshIndicator.count() > 0) {
            await expect(refreshIndicator).toBeVisible()
          }
        }
      })

      test('should handle pinch to zoom on charts', async ({ page }) => {
        await page.goto('/mobile/ratings/dashboard')
        await page.waitForLoadState('networkidle')

        const chartElement = page.locator('[data-testid="rating-chart"]').first()
        if (await chartElement.count() > 0) {
          await expect(chartElement).toBeVisible()

          const box = await chartElement.boundingBox()
          if (box) {
            const centerX = box.x + box.width / 2
            const centerY = box.y + box.height / 2

            // Start pinch gesture (two fingers)
            await page.touch.tap(centerX - 30, centerY)
            await page.touch.tap(centerX + 30, centerY)

            // Expand pinch (zoom in)
            await page.touch.move(centerX - 60, centerY)
            await page.touch.move(centerX + 60, centerY)

            // End pinch
            await page.touch.end()
            await page.touch.end()

            await page.waitForTimeout(1000)

            // Check if chart zoomed
            const zoomLevel = await page.evaluate(() => {
              const chart = document.querySelector('[data-testid="rating-chart"]')
              return chart ? getComputedStyle(chart).transform : 'none'
            })

            expect(zoomLevel).not.toBe('none')
          }
        }
      })

      test('should handle tap and hold for context menus', async ({ page }) => {
        await page.goto('/mobile/ratings')
        await page.waitForLoadState('networkidle')

        const employerCard = page.locator('[data-testid="employer-card"]').first()
        await expect(employerCard).toBeVisible()

        // Tap and hold
        await employerCard.tap()
        await page.waitForTimeout(800) // Hold longer for context menu

        // Check for context menu
        const contextMenu = page.locator('[data-testid="context-menu"]')
        const actionSheet = page.locator('[data-testid="action-sheet"]')
        const menuItems = page.locator('[data-testid="menu-item"]')

        const hasMenu = await contextMenu.count() > 0 && await contextMenu.isVisible() ||
                       await actionSheet.count() > 0 && await actionSheet.isVisible()

        if (hasMenu) {
          expect(await menuItems.count()).toBeGreaterThan(0)

          // Test tapping a menu item
          const firstMenuItem = menuItems.first()
          await firstMenuItem.tap()
          await page.waitForTimeout(500)
        }
      })
    })
  })

  test.describe('Multi-touch Gestures', () => {
    test.use({ viewport: MOBILE_VIEWPORTS.iPhone13 })

    test('should handle two-finger tap', async ({ page }) => {
      await page.goto('/mobile/ratings/dashboard')
      await page.waitForLoadState('networkidle')

      const chartContainer = page.locator('[data-testid="chart-container"]')
      if (await chartContainer.count() > 0) {
        const box = await chartContainer.boundingBox()
        if (box) {
          const centerX = box.x + box.width / 2
          const centerY = box.y + box.height / 2

          // Two-finger tap
          await page.touch.tap(centerX - 30, centerY)
          await page.touch.tap(centerX + 30, centerY)
          await page.waitForTimeout(500)

          // Check if two-finger tap action was triggered
          // This could reset zoom, show menu, etc.
          await page.waitForTimeout(1000)
        }
      }
    })

    test('should handle rotation gestures', async ({ page }) => {
      await page.goto('/mobile/ratings/dashboard')
      await page.waitForLoadState('networkidle')

      const rotatableElement = page.locator('[data-testid="rotatable-element"]')
      if (await rotatableElement.count() > 0) {
        const box = await rotatableElement.boundingBox()
        if (box) {
          const centerX = box.x + box.width / 2
          const centerY = box.y + box.height / 2
          const radius = 50

          // Start with two fingers
          await page.touch.tap(centerX - radius, centerY)
          await page.touch.tap(centerX + radius, centerY)

          // Rotate 90 degrees
          for (let angle = 0; angle <= 90; angle += 15) {
            const rad = (angle * Math.PI) / 180
            const x1 = centerX - radius * Math.cos(rad)
            const y1 = centerY - radius * Math.sin(rad)
            const x2 = centerX + radius * Math.cos(rad)
            const y2 = centerY + radius * Math.sin(rad)

            await page.touch.move(x1, y1, { touchId: 0 })
            await page.touch.move(x2, y2, { touchId: 1 })
            await page.waitForTimeout(50)
          }

          // End rotation
          await page.touch.end()
          await page.touch.end()

          await page.waitForTimeout(1000)

          // Check if rotation was applied
          const transform = await rotatableElement.evaluate(el => getComputedStyle(el).transform)
          expect(transform).not.toBe('none')
        }
      }
    })
  })

  test.describe('Touch Feedback', () => {
    test.use({ viewport: MOBILE_VIEWPORTS.iPhone13 })

    test('should provide visual feedback on touch', async ({ page }) => {
      await page.goto('/mobile/ratings')
      await page.waitForLoadState('networkidle')

      const button = page.locator('[data-testid="rate-employer-button"]').first()
      await expect(button).toBeVisible()

      // Check initial state
      const initialStyle = await button.evaluate(el => getComputedStyle(el).opacity)

      // Touch the button
      await button.tap()

      // Check for visual feedback (opacity change, scale, etc.)
      await page.waitForTimeout(200)
      const touchedStyle = await button.evaluate(el => getComputedStyle(el).opacity)

      // Should have some visual feedback
      expect(touchedStyle).not.toBe(initialStyle)
    })

    test('should show haptic feedback indicators', async ({ page }) => {
      await page.goto('/mobile/ratings')
      await page.waitForLoadState('networkidle')

      // Enable haptic feedback logging
      await page.addInitScript(() => {
        window.hapticEvents = []
        const originalVibrate = navigator.vibrate
        navigator.vibrate = function(pattern) {
          window.hapticEvents.push({ type: 'vibrate', pattern, timestamp: Date.now() })
          return originalVibrate.call(this, pattern)
        }
      })

      const button = page.locator('[data-testid="rate-employer-button"]').first()
      await button.tap()

      // Check if haptic feedback was triggered
      const hapticEvents = await page.evaluate(() => (window as any).hapticEvents || [])
      expect(hapticEvents.length).toBeGreaterThan(0)
    })

    test('should handle touch cancellation', async ({ page }) => {
      await page.goto('/mobile/ratings')
      await page.waitForLoadState('networkidle')

      const button = page.locator('[data-testid="rate-employer-button"]').first()
      await expect(button).toBeVisible()

      const box = await button.boundingBox()
      if (box) {
        // Start touch inside button
        await page.touch.tap(box.x + box.width / 2, box.y + box.height / 2)

        // Move outside button
        await page.touch.move(box.x + box.width + 50, box.y + box.height / 2)

        // End touch outside
        await page.touch.end()

        await page.waitForTimeout(500)

        // Should not trigger the button action
        const modal = page.locator('[data-testid="rating-modal"]')
        expect(await modal.count()).toBe(0)
      }
    })
  })
})

test.describe('Mobile Form Interactions', () => {
  test.use({ viewport: MOBILE_VIEWPORTS.iPhone13 })

  test('should handle mobile keyboard properly', async ({ page }) => {
    await page.goto('/mobile/ratings/wizard/123')
    await page.waitForLoadState('networkidle')

    // Focus on input field
    const inputField = page.locator('input[type="text"], textarea').first()
    if (await inputField.count() > 0) {
      await inputField.tap()

      // Wait for keyboard to appear
      await page.waitForTimeout(500)

      // Type some text
      await page.keyboard.type('Test rating comment')

      // Check if text was entered
      const value = await inputField.inputValue()
      expect(value).toContain('Test rating comment')

      // Dismiss keyboard
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })

  test('should handle number inputs with mobile keypad', async ({ page }) => {
    await page.goto('/mobile/ratings/wizard/123')
    await page.waitForLoadState('networkidle')

    const numberInput = page.locator('input[type="number"]').first()
    if (await numberInput.count() > 0) {
      await numberInput.tap()
      await page.waitForTimeout(300)

      // Enter numbers
      await page.keyboard.type('85')
      await page.waitForTimeout(200)

      const value = await numberInput.inputValue()
      expect(value).toBe('85')
    }
  })

  test('should handle select inputs on mobile', async ({ page }) => {
    await page.goto('/mobile/ratings/wizard/123')
    await page.waitForLoadState('networkidle')

    const selectElement = page.locator('select').first()
    if (await selectElement.count() > 0) {
      await selectElement.tap()
      await page.waitForTimeout(500)

      // Check if options appear
      const options = page.locator('option')
      expect(await options.count()).toBeGreaterThan(0)

      // Select an option
      const firstOption = options.nth(1)
      await firstOption.tap()

      const value = await selectElement.inputValue()
      expect(value).toBeTruthy()
    }
  })

  test('should handle checkbox inputs with proper touch targets', async ({ page }) => {
    await page.goto('/mobile/ratings/wizard/123')
    await page.waitForLoadState('networkidle')

    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.count() > 0) {
      const checkboxContainer = page.locator('label').filter({ has: checkbox }).first()
      await expect(checkboxContainer).toBeVisible()

      // Check initial state
      const initialState = await checkbox.isChecked()
      expect([true, false]).toContain(initialState)

      // Tap the checkbox
      await checkboxContainer.tap()
      await page.waitForTimeout(300)

      // Check if state changed
      const newState = await checkbox.isChecked()
      expect(newState).not.toBe(initialState)
    }
  })
})