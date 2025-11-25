/**
 * Simple script to test mobile search functionality
 * Run with: node scripts/test-mobile-search.js
 */

const { chromium } = require('playwright');

async function testMobileSearch() {
  console.log('🧪 Testing mobile search functionality...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  try {
    // Navigate to patch page (adjust URL as needed)
    await page.goto('http://localhost:3000/patch');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    console.log('✅ Page loaded successfully');

    // Check if search input is visible
    const searchInput = await page.locator('#patch-project-search-mobile');
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    console.log('✅ Search input is visible');

    // Check icon positioning (by checking if it's overlapping)
    const searchIcon = await page.locator('.relative svg').first();
    const iconBoundingBox = await searchIcon.boundingBox();
    const inputBoundingBox = await searchInput.boundingBox();

    if (iconBoundingBox && inputBoundingBox) {
      const iconLeft = iconBoundingBox.x;
      const textStart = inputBoundingBox.x + 48; // 3rem = 48px

      if (textStart > iconLeft + iconBoundingBox.width) {
        console.log('✅ Search icon is positioned correctly (no overlap)');
      } else {
        console.log('❌ Search icon may be overlapping with text');
      }
    }

    // Test typing without scroll jump
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Scroll down a bit first
    await page.evaluate(() => window.scrollTo(0, 300));
    const afterScrollY = await page.evaluate(() => window.scrollY);

    // Type in search
    await searchInput.fill('test');
    await page.waitForTimeout(350); // Wait for debounce

    const finalScrollY = await page.evaluate(() => window.scrollY);

    if (Math.abs(finalScrollY - afterScrollY) < 50) {
      console.log('✅ Scroll position preserved during typing');
    } else {
      console.log('❌ Scroll position jumped during typing');
      console.log(`   Before: ${afterScrollY}, After: ${finalScrollY}`);
    }

    // Test Enter key immediate search
    await searchInput.fill('');
    await searchInput.type('construction', { delay: 50 });
    await searchInput.press('Enter');

    // Check if loading spinner appears
    const loadingSpinner = await page.locator('.absolute.right-4 svg.animate-spin');
    const isLoading = await loadingSpinner.isVisible();

    if (isLoading) {
      console.log('✅ Loading spinner appears during search');
    } else {
      console.log('⚠️ Loading spinner not visible (might be too fast)');
    }

    // Wait for results
    await page.waitForTimeout(500);

    // Check for empty state or results
    const noResults = await page.locator('text=No projects found matching').isVisible();
    const hasResults = await page.locator('[data-testid="project-table-row"]').count() > 0;

    if (noResults || hasResults) {
      console.log('✅ Search results are displayed (either results or empty state)');
    } else {
      console.log('❌ No search results or empty state shown');
    }

    console.log('\n✨ All tests completed! Check the browser to verify visually.');

    // Keep browser open for manual inspection
    console.log('\nPress Ctrl+C to close the browser...');
    await new Promise(resolve => {
      process.on('SIGINT', resolve);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testMobileSearch().catch(console.error);
}