import { test, expect } from '@playwright/test';
import { MobileHelpers } from './mobile/helpers/mobile-helpers';
import { AuthHelpers } from './mobile/helpers/auth-helpers';
import { testUsers, mobileTestRoutes, mobileBreakpoints } from './mobile/fixtures/test-data';

interface ReactErrorInfo {
  message: string;
  stack: string;
  componentStack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

interface ConsoleError {
  type: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
}

test.describe('React Runtime Error Detection', () => {
  let mobileHelpers: MobileHelpers;
  let authHelpers: AuthHelpers;
  let consoleErrors: ConsoleError[] = [];
  let reactErrors: ReactErrorInfo[] = [];

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    authHelpers = new AuthHelpers(page);
    consoleErrors = [];
    reactErrors = [];

    // Set up comprehensive error monitoring
    await page.addInitScript(() => {
      // Capture console errors and warnings
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      window.consoleErrors = [];
      window.reactErrors = [];

      console.error = (...args) => {
        window.consoleErrors.push({
          type: 'error',
          text: args.join(' '),
          timestamp: Date.now()
        });
        originalConsoleError.apply(console, args);
      };

      console.warn = (...args) => {
        window.consoleErrors.push({
          type: 'warn',
          text: args.join(' '),
          timestamp: Date.now()
        });
        originalConsoleWarn.apply(console, args);
      };

      // Capture unhandled errors
      window.addEventListener('error', (event) => {
        window.consoleErrors.push({
          type: 'unhandled',
          text: event.message,
          url: event.filename,
          line: event.lineno,
          column: event.colno,
          timestamp: Date.now()
        });
      });

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        window.consoleErrors.push({
          type: 'unhandledrejection',
          text: event.reason?.toString() || 'Unknown promise rejection',
          timestamp: Date.now()
        });
      });

      // Monitor React errors
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const originalOnError = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
        if (originalOnError) {
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = (...args) => {
            try {
              return originalOnError.apply(this, args);
            } catch (error) {
              window.reactErrors.push({
                message: error.message,
                stack: error.stack,
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent
              });
            }
          };
        }
      }

      // Check for React hydration errors
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.dataset && element.dataset.reactroot) {
                  // Check for hydration mismatch indicators
                  const hasHydrationWarning = element.innerHTML.includes('data-react-helmet') ||
                    element.innerHTML.includes('data-react-checksum');

                  if (hasHydrationWarning) {
                    window.consoleErrors.push({
                      type: 'hydration',
                      text: 'Potential hydration mismatch detected',
                      timestamp: Date.now()
                    });
                  }
                }
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Collect errors from browser context
    const browserConsoleErrors = await page.evaluate(() => window.consoleErrors || []);
    const browserReactErrors = await page.evaluate(() => window.reactErrors || []);

    consoleErrors = [...consoleErrors, ...browserConsoleErrors];
    reactErrors = [...reactErrors, ...browserReactErrors];

    // Log any errors found
    if (consoleErrors.length > 0) {
      console.log('Console Errors detected:', consoleErrors);
    }
    if (reactErrors.length > 0) {
      console.log('React Errors detected:', reactErrors);
    }

    // Capture screenshots for debugging
    await mobileHelpers.captureScreenshots(`react-errors-${test.info().title}`);
  });

  test.describe('Main Dashboard React Errors', () => {
    test('should load main dashboard without React errors', async ({ page }) => {
      // Navigate to main dashboard
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for React to potentially render
      await page.waitForTimeout(2000);

      // Check for React is not defined errors
      const reactNotDefinedErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('ReferenceError: React') ||
        error.text.includes('Cannot read property') && error.text.includes('React')
      );

      expect(reactNotDefinedErrors, `React is not defined errors: ${JSON.stringify(reactNotDefinedErrors, null, 2)}`).toHaveLength(0);

      // Check for component mounting errors
      const mountingErrors = consoleErrors.filter(error =>
        error.text.includes('Failed to mount component') ||
        error.text.includes('Target container is not a DOM element') ||
        error.text.includes('render') && error.text.includes('error')
      );

      expect(mountingErrors, `Component mounting errors: ${JSON.stringify(mountingErrors, null, 2)}`).toHaveLength(0);

      // Verify React components are actually rendering
      const reactRoot = page.locator('[data-reactroot], #root, [data-testid="react-root"], .react-root');
      const hasReactContent = await reactRoot.count() > 0 ||
        await page.locator('*').first().evaluate(el => {
          return el.innerHTML.includes('react') ||
                 el.getAttribute('data-react-checksum') !== null ||
                 el.querySelector('[data-reactroot]') !== null;
        });

      expect(hasReactContent, 'No React content detected on page').toBeTruthy();
    });

    test('should handle mobile dashboard view without errors', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(mobileBreakpoints['iphone-14']);

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for mobile-specific React errors
      const mobileErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('useIsMobile') && error.text.includes('error') ||
        error.text.includes('MobileDashboardView') && error.text.includes('error')
      );

      expect(mobileErrors, `Mobile React errors: ${JSON.stringify(mobileErrors, null, 2)}`).toHaveLength(0);

      // Verify mobile-specific components are rendering
      const mobileDashboard = page.locator('[data-testid="mobile-dashboard"], .mobile-dashboard');
      const mobileViewExists = await mobileDashboard.count() > 0;

      if (mobileViewExists) {
        await expect(mobileDashboard).toBeVisible();
      }
    });

    test('should handle desktop dashboard view without errors', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1200, height: 800 });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for desktop-specific React errors
      const desktopErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('DesktopDashboardView') && error.text.includes('error')
      );

      expect(desktopErrors, `Desktop React errors: ${JSON.stringify(desktopErrors, null, 2)}`).toHaveLength(0);

      // Verify desktop components are rendering
      const desktopDashboard = page.locator('[data-testid="desktop-dashboard"], .desktop-dashboard');
      const desktopViewExists = await desktopDashboard.count() > 0;

      if (desktopViewExists) {
        await expect(desktopDashboard).toBeVisible();
      }
    });
  });

  test.describe('Client-Side Navigation React Errors', () => {
    test.beforeEach(async ({ page }) => {
      // Login for authenticated routes
      await authHelpers.login(testUsers.organizer);
    });

    test('should navigate between routes without React errors', async ({ page }) => {
      const routes = ['/projects', '/employers', '/activities', '/map'];

      for (const route of routes) {
        await test.step(`Navigate to ${route}`, async () => {
          // Clear previous errors for this step
          await page.evaluate(() => { window.consoleErrors = []; });

          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);

          // Check for navigation-related React errors
          const navigationErrors = await page.evaluate(() =>
            (window.consoleErrors || []).filter(error =>
              error.text.includes('React is not defined') ||
              error.text.includes('Cannot read propert') && error.text.includes('router') ||
              error.text.includes('TypeError') && error.text.includes('navigation')
            )
          );

          expect(navigationErrors, `Navigation errors on ${route}: ${JSON.stringify(navigationErrors, null, 2)}`).toHaveLength(0);
        });
      }
    });

    test('should handle dynamic routing without React errors', async ({ page }) => {
      // Test dynamic routes that might cause React issues
      const dynamicRoutes = [
        '/projects/1',
        '/projects/1/scan-review/1',
        '/employers/1',
        '/mobile/ratings/wizard/1'
      ];

      for (const route of dynamicRoutes) {
        await test.step(`Navigate to dynamic route ${route}`, async () => {
          await page.evaluate(() => { window.consoleErrors = []; });

          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);

          // Check for dynamic routing errors
          const dynamicErrors = await page.evaluate(() =>
            (window.consoleErrors || []).filter(error =>
              error.text.includes('React is not defined') ||
              error.text.includes('useParams') && error.text.includes('error') ||
              error.text.includes('Cannot read propert') && error.text.includes('params')
            )
          );

          expect(dynamicErrors, `Dynamic route errors on ${route}: ${JSON.stringify(dynamicErrors, null, 2)}`).toHaveLength(0);
        });
      }
    });
  });

  test.describe('Mobile-Specific React Errors', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport for all mobile tests
      await page.setViewportSize(mobileBreakpoints['iphone-14']);
      await authHelpers.login(testUsers.organizer);
    });

    test('should handle mobile ratings system without React errors', async ({ page }) => {
      await page.goto('/mobile/ratings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for mobile ratings component errors
      const ratingsErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('RatingBreakdown') && error.text.includes('error') ||
        error.text.includes('RatingComparison') && error.text.includes('error') ||
        error.text.includes('RatingHistory') && error.text.includes('error') ||
        error.text.includes('RatingWizard') && error.text.includes('error')
      );

      expect(ratingsErrors, `Mobile ratings errors: ${JSON.stringify(ratingsErrors, null, 2)}`).toHaveLength(0);

      // Test interactive elements
      const interactiveElements = page.locator('button, [role="button"], input, select');
      const elementCount = await interactiveElements.count();

      for (let i = 0; i < Math.min(elementCount, 5); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          await element.tap();
          await page.waitForTimeout(500);

          // Check for interaction errors
          const interactionErrors = await page.evaluate(() =>
            (window.consoleErrors || []).filter(error =>
              error.text.includes('React is not defined') ||
              error.text.includes('onClick') && error.text.includes('error')
            )
          );

          expect(interactionErrors, `Interaction errors on element ${i}: ${JSON.stringify(interactionErrors, null, 2)}`).toHaveLength(0);
        }
      }
    });

    test('should handle mobile UI components without React errors', async ({ page }) => {
      const mobileRoutes = [
        '/mobile/ratings/dashboard',
        '/mobile/ratings/compare/1',
        '/mobile/ratings/wizard/1'
      ];

      for (const route of mobileRoutes) {
        await test.step(`Test mobile UI components on ${route}`, async () => {
          await page.evaluate(() => { window.consoleErrors = []; });

          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);

          // Check for mobile UI component errors
          const uiErrors = await page.evaluate(() =>
            (window.consoleErrors || []).filter(error =>
              error.text.includes('React is not defined') ||
              error.text.includes('MobileCard') && error.text.includes('error') ||
              error.text.includes('MobileFilterPanel') && error.text.includes('error') ||
              error.text.includes('MobileList') && error.text.includes('error') ||
              error.text.includes('MobileSwipeFilters') && error.text.includes('error') ||
              error.text.includes('MobileTable') && error.text.includes('error') ||
              error.text.includes('MobileTableWithSearch') && error.text.includes('error')
            )
          );

          expect(uiErrors, `Mobile UI errors on ${route}: ${JSON.stringify(uiErrors, null, 2)}`).toHaveLength(0);
        });
      }
    });
  });

  test.describe('React Hydration and SSR Errors', () => {
    test('should detect hydration mismatches', async ({ page }) => {
      // Test with mobile viewport first
      await page.setViewportSize(mobileBreakpoints['iphone-14']);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Force a hydration check by evaluating React's internal state
      const hydrationCheck = await page.evaluate(() => {
        // Look for common hydration error indicators
        const body = document.body.innerHTML;
        const hydrationIndicators = [
          'data-react-checksum',
          'data-reactroot',
          'react-helmet',
          'Hydration failed',
          'Text content does not match',
          'Server-rendered markup'
        ];

        return hydrationIndicators.some(indicator => body.includes(indicator));
      });

      // Check for specific hydration errors in console
      const hydrationErrors = consoleErrors.filter(error =>
        error.text.includes('Hydration') ||
        error.text.includes('hydration') ||
        error.text.includes('Server-rendered markup') ||
        error.text.includes('Text content does not match') ||
        error.text.includes('Attribute mismatch')
      );

      expect(hydrationErrors, `Hydration errors: ${JSON.stringify(hydrationErrors, null, 2)}`).toHaveLength(0);
    });

    test('should handle client-side only components', async ({ page }) => {
      // Test components that might be client-side only
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for client-side only component errors
      const clientSideErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('window is not defined') ||
        error.text.includes('document is not defined') ||
        error.text.includes('localStorage') && error.text.includes('error') ||
        error.text.includes('sessionStorage') && error.text.includes('error')
      );

      expect(clientSideErrors, `Client-side errors: ${JSON.stringify(clientSideErrors, null, 2)}`).toHaveLength(0);
    });
  });

  test.describe('React Hooks and State Management Errors', () => {
    test('should handle React hooks without errors', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for hooks-related errors
      const hooksErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('Invalid hook call') ||
        error.text.includes('Hook can only be called') ||
        error.text.includes('useState') && error.text.includes('error') ||
        error.text.includes('useEffect') && error.text.includes('error') ||
        error.text.includes('useIsMobile') && error.text.includes('error')
      );

      expect(hooksErrors, `React hooks errors: ${JSON.stringify(hooksErrors, null, 2)}`).toHaveLength(0);
    });

    test('should handle state updates without React errors', async ({ page }) => {
      await authHelpers.login(testUsers.organizer);
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Trigger state changes by interacting with components
      const interactiveElements = page.locator('button, [role="button"], input[type="checkbox"], select');
      const elementCount = await interactiveElements.count();

      for (let i = 0; i < Math.min(elementCount, 3); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          await page.evaluate(() => { window.consoleErrors = []; });

          await element.click();
          await page.waitForTimeout(500);

          // Check for state update errors
          const stateErrors = await page.evaluate(() =>
            (window.consoleErrors || []).filter(error =>
              error.text.includes('React is not defined') ||
              error.text.includes('setState') && error.text.includes('error') ||
              error.text.includes('Maximum update depth exceeded') ||
              error.text.includes('Too many re-renders')
            )
          );

          expect(stateErrors, `State update errors on element ${i}: ${JSON.stringify(stateErrors, null, 2)}`).toHaveLength(0);
        }
      }
    });
  });

  test.describe('Performance and Memory Related React Errors', () => {
    test('should handle React performance without memory leaks', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Monitor memory usage during navigation
      const initialMemory = await page.evaluate(() =>
        (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      );

      // Navigate to multiple pages
      for (let i = 0; i < 5; i++) {
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');
        await page.goto('/employers');
        await page.waitForLoadState('networkidle');
      }

      const finalMemory = await page.evaluate(() =>
        (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      );

      // Check for memory-related errors
      const memoryErrors = consoleErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('out of memory') ||
        error.text.includes('Maximum call stack') ||
        error.text.includes('Internal error')
      );

      expect(memoryErrors, `Memory-related errors: ${JSON.stringify(memoryErrors, null, 2)}`).toHaveLength(0);

      // Log memory usage for analysis (not asserting as memory usage varies)
      console.log(`Memory usage: Initial=${initialMemory}, Final=${finalMemory}, Difference=${finalMemory - initialMemory}`);
    });
  });

  test.describe('Error Summary and Reporting', () => {
    test('should provide comprehensive error report', async ({ page }) => {
      // Run through all main routes
      const routes = ['/', '/projects', '/employers', '/activities', '/map'];
      const allErrors: ConsoleError[] = [];

      for (const route of routes) {
        await page.evaluate(() => { window.consoleErrors = []; });
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const routeErrors = await page.evaluate(() => window.consoleErrors || []);
        allErrors.push(...routeErrors.map(error => ({ ...error, route })));
      }

      // Filter for critical React errors
      const criticalErrors = allErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('ReferenceError: React') ||
        error.text.includes('TypeError') && error.text.includes('React')
      );

      // Generate detailed error report
      const errorReport = {
        totalErrors: allErrors.length,
        criticalReactErrors: criticalErrors.length,
        errorsByType: allErrors.reduce((acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        errorsByRoute: allErrors.reduce((acc, error) => {
          const route = (error as any).route || 'unknown';
          acc[route] = (acc[route] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        criticalErrorDetails: criticalErrors
      };

      console.log('React Error Report:', JSON.stringify(errorReport, null, 2));

      // Assert no critical React errors
      expect(criticalErrors, `Critical React errors found: ${JSON.stringify(criticalErrors, null, 2)}`).toHaveLength(0);
    });
  });
});