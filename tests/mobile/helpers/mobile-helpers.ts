import { Page, Locator, BrowserContext } from '@playwright/test';

export interface MobileDeviceConfig {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
  hasTouch: boolean;
  devicePixelRatio: number;
}

export interface TouchGesture {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration?: number;
}

export interface SwipeDirection {
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  speed?: 'slow' | 'medium' | 'fast';
}

/**
 * Mobile testing helper utilities for CFMEU Next.js application
 * Provides comprehensive mobile interaction methods and device-specific testing utilities
 */
export class MobileHelpers {
  constructor(private page: Page) {}

  /**
   * Simulates a swipe gesture on the mobile device
   */
  async swipe(direction: SwipeDirection, element?: Locator): Promise<void> {
    const target = element || this.page;
    const bounds = await (element ? element.boundingBox() : this.page.viewportSize());

    if (!bounds) throw new Error('Could not determine element bounds');

    const distance = direction.distance || bounds.height * 0.3;
    const speedMultiplier = {
      slow: 3,
      medium: 2,
      fast: 1
    }[direction.speed || 'medium'];

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;

    switch (direction.direction) {
      case 'up':
        startY = bounds.y + bounds.height * 0.8;
        endY = bounds.y + bounds.height * 0.2;
        break;
      case 'down':
        startY = bounds.y + bounds.height * 0.2;
        endY = bounds.y + bounds.height * 0.8;
        break;
      case 'left':
        startX = bounds.x + bounds.width * 0.8;
        endX = bounds.x + bounds.width * 0.2;
        break;
      case 'right':
        startX = bounds.x + bounds.width * 0.2;
        endX = bounds.x + bounds.width * 0.8;
        break;
    }

    await this.page.touchscreen.tap(startX, startY);
    await this.page.touchscreen.move(endX, endY);
    await this.page.waitForTimeout(distance * speedMultiplier);
  }

  /**
   * Performs a pinch gesture for zoom functionality
   */
  async pinchOut(element: Locator, scale: number = 1.5): Promise<void> {
    const bounds = await element.boundingBox();
    if (!bounds) throw new Error('Could not determine element bounds');

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const distance = Math.min(bounds.width, bounds.height) / 4;

    // Initial touch points
    const touch1 = { x: centerX - distance, y: centerY };
    const touch2 = { x: centerX + distance, y: centerY };

    // Final positions for pinch out
    const finalDistance = distance * scale;
    const finalTouch1 = { x: centerX - finalDistance, y: centerY };
    const finalTouch2 = { x: centerX + finalDistance, y: centerY };

    await this.page.touchscreen.tap(touch1.x, touch1.y);
    await this.page.touchscreen.tap(touch2.x, touch2.y);

    await this.page.touchscreen.move(finalTouch1.x, finalTouch1.y);
    await this.page.touchscreen.move(finalTouch2.x, finalTouch2.y);
  }

  /**
   * Performs a double-tap gesture
   */
  async doubleTap(element: Locator): Promise<void> {
    const bounds = await element.boundingBox();
    if (!bounds) throw new Error('Could not determine element bounds');

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    await this.page.touchscreen.tap(centerX, centerY);
    await this.page.waitForTimeout(200);
    await this.page.touchscreen.tap(centerX, centerY);
  }

  /**
   * Long press gesture
   */
  async longPress(element: Locator, duration: number = 1000): Promise<void> {
    const bounds = await element.boundingBox();
    if (!bounds) throw new Error('Could not determine element bounds');

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    await this.page.touchscreen.tap(centerX, centerY);
    await this.page.waitForTimeout(duration);
  }

  /**
   * Validates touch target size according to mobile accessibility guidelines
   */
  async validateTouchTargetSize(element: Locator): Promise<{ isAccessible: boolean; size: { width: number; height: number } }> {
    const bounds = await element.boundingBox();
    if (!bounds) throw new Error('Could not determine element bounds');

    const minSize = 44; // Apple's minimum touch target size
    const isAccessible = bounds.width >= minSize && bounds.height >= minSize;

    return {
      isAccessible,
      size: { width: bounds.width, height: bounds.height }
    };
  }

  /**
   * Checks if elements are properly visible within the viewport
   */
  async checkViewportOverflow(): Promise<{ hasOverflow: boolean; overflowingElements: Locator[] }> {
    const overflowingElements: Locator[] = [];

    // Check for horizontal overflow
    const hasHorizontalOverflow = await this.page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });

    // Check for vertical overflow
    const hasVerticalOverflow = await this.page.evaluate(() => {
      return document.body.scrollHeight > document.body.clientHeight;
    });

    // Find elements that might be causing overflow
    if (hasHorizontalOverflow || hasVerticalOverflow) {
      const elements = await this.page.locator('*').all();
      for (const element of elements) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          const bounds = await element.boundingBox();
          if (bounds) {
            if (bounds.x < 0 || bounds.y < 0 ||
                bounds.x + bounds.width > (await this.page.viewportSize())!.width ||
                bounds.y + bounds.height > (await this.page.viewportSize())!.height) {
              overflowingElements.push(element);
            }
          }
        }
      }
    }

    return {
      hasOverflow: hasHorizontalOverflow || hasVerticalOverflow,
      overflowingElements
    };
  }

  /**
   * Simulates different network conditions
   */
  async setNetworkConditions(condition: 'slow3g' | 'fast3g' | 'offline' | 'online'): Promise<void> {
    switch (condition) {
      case 'slow3g':
        await this.page.route('**/*', (route) => {
          // Simulate slow 3G network
          setTimeout(() => route.continue(), Math.random() * 1000 + 500);
        });
        break;
      case 'fast3g':
        await this.page.route('**/*', (route) => {
          // Simulate fast 3G network
          setTimeout(() => route.continue(), Math.random() * 300 + 100);
        });
        break;
      case 'offline':
        await this.page.setOffline(true);
        break;
      case 'online':
        await this.page.setOffline(false);
        await this.page.unroute('**/*');
        break;
    }
  }

  /**
   * Captures screenshots in different orientations
   */
  async captureScreenshots(testName: string): Promise<{ portrait: string; landscape: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Portrait screenshot
    await this.page.setViewportSize({ width: 390, height: 844 }); // iPhone 13 dimensions
    const portraitPath = `test-results/screenshots/${testName}-portrait-${timestamp}.png`;
    await this.page.screenshot({ path: portraitPath, fullPage: true });

    // Landscape screenshot
    await this.page.setViewportSize({ width: 844, height: 390 });
    const landscapePath = `test-results/screenshots/${testName}-landscape-${timestamp}.png`;
    await this.page.screenshot({ path: landscapePath, fullPage: true });

    return { portrait: portraitPath, landscape: landscapePath };
  }

  /**
   * Measures page load performance
   */
  async measurePerformance(): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  }> {
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: 0 // Would need PerformanceObserver for LCP
      };
    });

    return performanceMetrics;
  }

  /**
   * Checks mobile accessibility compliance
   */
  async checkAccessibility(): Promise<{
    issues: string[];
    colorContrastIssues: Locator[];
    focusOrderIssues: Locator[];
  }> {
    const issues: string[] = [];
    const colorContrastIssues: Locator[] = [];
    const focusOrderIssues: Locator[] = [];

    // Check for alt text on images
    const imagesWithoutAlt = await this.page.locator('img:not([alt]), img[alt=""]').all();
    if (imagesWithoutAlt.length > 0) {
      issues.push(`${imagesWithoutAlt.length} images missing alt text`);
    }

    // Check for proper heading structure
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    for (let i = 1; i < headings.length; i++) {
      const currentLevel = await headings[i].evaluate(el => parseInt(el.tagName.substring(1)));
      const previousLevel = await headings[i - 1].evaluate(el => parseInt(el.tagName.substring(1)));

      if (currentLevel > previousLevel + 1) {
        issues.push(`Heading level jump detected from h${previousLevel} to h${currentLevel}`);
      }
    }

    // Check for form labels
    const inputsWithoutLabels = await this.page.locator('input:not([aria-label]):not([aria-labelledby])').all();
    const inputsWithoutAssociatedLabels = [];

    for (const input of inputsWithoutLabels) {
      const hasLabel = await input.evaluate(el => {
        const id = el.getAttribute('id');
        return id ? document.querySelector(`label[for="${id}"]`) : false;
      });

      if (!hasLabel) {
        inputsWithoutAssociatedLabels.push(input);
      }
    }

    if (inputsWithoutAssociatedLabels.length > 0) {
      issues.push(`${inputsWithoutAssociatedLabels.length} form inputs without proper labels`);
    }

    return {
      issues,
      colorContrastIssues,
      focusOrderIssues
    };
  }

  /**
   * Handles mobile device orientation changes
   */
  async changeOrientation(orientation: 'portrait' | 'landscape'): Promise<void> {
    const viewport = await this.page.viewportSize();
    if (!viewport) throw new Error('No viewport set');

    if (orientation === 'landscape') {
      await this.page.setViewportSize({ width: viewport.height, height: viewport.width });
    } else {
      await this.page.setViewportSize({ width: Math.max(viewport.width, viewport.height), height: Math.min(viewport.width, viewport.height) });
    }
  }

  /**
   * Simulates mobile keyboard appearance/disappearance
   */
  async simulateKeyboard(show: boolean): Promise<void> {
    if (show) {
      // Focus on an input field to bring up keyboard
      const input = await this.page.locator('input, textarea').first();
      if (await input.isVisible()) {
        await input.focus();
        // Simulate keyboard height adjustment
        const viewport = await this.page.viewportSize();
        if (viewport) {
          await this.page.setViewportSize({
            width: viewport.width,
            height: viewport.height - 300 // Approximate keyboard height
          });
        }
      }
    } else {
      // Blur focused element to hide keyboard
      await this.page.keyboard.press('Escape');
      // Restore full viewport
      await this.page.setViewportSize({ width: 390, height: 844 });
    }
  }
}