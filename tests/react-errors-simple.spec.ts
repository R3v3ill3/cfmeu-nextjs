import { test, expect } from '@playwright/test';
import { mobileBreakpoints } from './mobile/fixtures/test-data';

interface ConsoleError {
  type: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
}

test.describe('React Runtime Error Detection - Simple', () => {
  test.beforeEach(async ({ page }) => {
    // Set up comprehensive error monitoring without MutationObserver issues
    await page.addInitScript(() => {
      // Capture console errors and warnings
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      window.consoleErrors = [];

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
    });
  });

  test('should detect React is not defined errors on main dashboard', async ({ page }) => {
    // Test on mobile first
    await page.setViewportSize(mobileBreakpoints['iphone-14']);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow React to potentially fail

    // Collect console errors
    const consoleErrors = await page.evaluate(() => window.consoleErrors || []);

    // Check for specific "React is not defined" errors
    const reactNotDefinedErrors = consoleErrors.filter(error =>
      error.text.includes('React is not defined') ||
      error.text.includes('ReferenceError: React') ||
      error.text.includes('Cannot read property') && error.text.includes('React') ||
      error.text.includes('React.createElement') ||
      error.text.includes('React.useState') ||
      error.text.includes('React.useEffect')
    );

    // Log all errors for debugging
    console.log('All console errors:', JSON.stringify(consoleErrors, null, 2));
    console.log('React-specific errors found:', JSON.stringify(reactNotDefinedErrors, null, 2));

    // Check if React is actually available in the page
    const reactAvailable = await page.evaluate(() => {
      return typeof window.React !== 'undefined' ||
             typeof window.ReactDOM !== 'undefined' ||
             document.querySelector('[data-reactroot]') !== null ||
             document.querySelector('[data-react-checksum]') !== null ||
             document.querySelector('*[class*="react"]') !== null;
    });

    console.log('React availability check:', reactAvailable);

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(error =>
      error.text.includes('Hydration') ||
      error.text.includes('hydration') ||
      error.text.includes('Server-rendered markup') ||
      error.text.includes('Text content does not match') ||
      error.text.includes('Attribute mismatch')
    );

    console.log('Hydration errors:', JSON.stringify(hydrationErrors, null, 2));

    // Assert no critical React errors
    expect(reactNotDefinedErrors, `Critical React errors found: ${JSON.stringify(reactNotDefinedErrors, null, 2)}`).toHaveLength(0);
  });

  test('should detect React errors on mobile pages', async ({ page }) => {
    await page.setViewportSize(mobileBreakpoints['iphone-14']);

    // Test mobile-specific routes
    const mobileRoutes = [
      '/mobile/ratings',
      '/mobile/ratings/dashboard'
    ];

    for (const route of mobileRoutes) {
      await test.step(`Test mobile route: ${route}`, async () => {
        // Clear previous errors
        await page.evaluate(() => { window.consoleErrors = []; });

        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        const routeErrors = await page.evaluate(() => window.consoleErrors || []);

        const reactErrors = routeErrors.filter(error =>
          error.text.includes('React is not defined') ||
          error.text.includes('ReferenceError: React') ||
          error.text.includes('MobileDashboardView') && error.text.includes('error') ||
          error.text.includes('RatingBreakdown') && error.text.includes('error') ||
          error.text.includes('RatingComparison') && error.text.includes('error') ||
          error.text.includes('RatingHistory') && error.text.includes('error') ||
          error.text.includes('RatingWizard') && error.text.includes('error')
        );

        console.log(`React errors on ${route}:`, JSON.stringify(reactErrors, null, 2));

        expect(reactErrors, `React errors on ${route}: ${JSON.stringify(reactErrors, null, 2)}`).toHaveLength(0);
      });
    }
  });

  test('should detect React errors on desktop pages', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });

    // Test main routes
    const routes = ['/', '/projects', '/employers', '/activities', '/map'];

    for (const route of routes) {
      await test.step(`Test desktop route: ${route}`, async () => {
        await page.evaluate(() => { window.consoleErrors = []; });

        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const routeErrors = await page.evaluate(() => window.consoleErrors || []);

        const reactErrors = routeErrors.filter(error =>
          error.text.includes('React is not defined') ||
          error.text.includes('ReferenceError: React') ||
          error.text.includes('DesktopDashboardView') && error.text.includes('error')
        );

        console.log(`React errors on ${route}:`, JSON.stringify(reactErrors, null, 2));

        expect(reactErrors, `React errors on ${route}: ${JSON.stringify(reactErrors, null, 2)}`).toHaveLength(0);
      });
    }
  });

  test('should detect React component mounting errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const consoleErrors = await page.evaluate(() => window.consoleErrors || []);

    // Check for component mounting related errors
    const mountingErrors = consoleErrors.filter(error =>
      error.text.includes('Failed to mount component') ||
      error.text.includes('Target container is not a DOM element') ||
      error.text.includes('render') && error.text.includes('error') ||
      error.text.includes('createRoot') && error.text.includes('error') ||
      error.text.includes('hydrateRoot') && error.text.includes('error')
    );

    console.log('Component mounting errors:', JSON.stringify(mountingErrors, null, 2));

    expect(mountingErrors, `Component mounting errors: ${JSON.stringify(mountingErrors, null, 2)}`).toHaveLength(0);
  });

  test('should detect React hooks errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const consoleErrors = await page.evaluate(() => window.consoleErrors || []);

    // Check for hooks-related errors
    const hooksErrors = consoleErrors.filter(error =>
      error.text.includes('Invalid hook call') ||
      error.text.includes('Hook can only be called') ||
      error.text.includes('useState') && error.text.includes('error') ||
      error.text.includes('useEffect') && error.text.includes('error') ||
      error.text.includes('useIsMobile') && error.text.includes('error') ||
      error.text.includes('Maximum update depth exceeded') ||
      error.text.includes('Too many re-renders')
    );

    console.log('React hooks errors:', JSON.stringify(hooksErrors, null, 2));

    expect(hooksErrors, `React hooks errors: ${JSON.stringify(hooksErrors, null, 2)}`).toHaveLength(0);
  });

  test('should detect React navigation errors', async ({ page }) => {
    // Test navigation between routes
    const routes = ['/', '/projects', '/employers'];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];

      await page.evaluate(() => { window.consoleErrors = []; });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const routeErrors = await page.evaluate(() => window.consoleErrors || []);

      const navigationErrors = routeErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('Cannot read propert') && error.text.includes('router') ||
        error.text.includes('TypeError') && error.text.includes('navigation') ||
        error.text.includes('useParams') && error.text.includes('error') ||
        error.text.includes('useRouter') && error.text.includes('error')
      );

      console.log(`Navigation errors on ${route}:`, JSON.stringify(navigationErrors, null, 2));

      expect(navigationErrors, `Navigation errors on ${route}: ${JSON.stringify(navigationErrors, null, 2)}`).toHaveLength(0);
    }
  });

  test('should provide comprehensive React error summary', async ({ page }) => {
    const routes = ['/', '/projects', '/employers', '/activities', '/map'];
    const allErrors: ConsoleError[] = [];
    const criticalReactErrors: ConsoleError[] = [];

    for (const route of routes) {
      await page.evaluate(() => { window.consoleErrors = []; });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const routeErrors = await page.evaluate(() => window.consoleErrors || []);
      allErrors.push(...routeErrors.map(error => ({ ...error, route })));

      // Check for critical React errors
      const critical = routeErrors.filter(error =>
        error.text.includes('React is not defined') ||
        error.text.includes('ReferenceError: React') ||
        error.text.includes('React.createElement') ||
        error.text.includes('React.useState') ||
        error.text.includes('React.useEffect')
      );

      criticalReactErrors.push(...critical.map(error => ({ ...error, route })));
    }

    // Generate detailed error report
    const errorReport = {
      totalErrors: allErrors.length,
      criticalReactErrors: criticalReactErrors.length,
      errorsByType: allErrors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      errorsByRoute: allErrors.reduce((acc, error) => {
        const route = (error as any).route || 'unknown';
        acc[route] = (acc[route] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      criticalErrorDetails: criticalReactErrors,
      uniqueErrorMessages: [...new Set(allErrors.map(e => e.text))]
    };

    console.log('=== COMPREHENSIVE REACT ERROR REPORT ===');
    console.log(JSON.stringify(errorReport, null, 2));

    // Take a screenshot for visual reference
    await page.screenshot({
      path: 'test-results/react-error-summary.png',
      fullPage: true
    });

    // Assert no critical React errors
    expect(criticalReactErrors, `Critical React errors found: ${JSON.stringify(criticalReactErrors, null, 2)}`).toHaveLength(0);
  });
});