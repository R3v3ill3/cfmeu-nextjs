/**
 * Test script for optimized search functionality
 * Tests both mobile and desktop implementations
 */

const { chromium } = require('playwright');

async function testOptimizedSearch() {
  console.log('🧪 Testing Optimized Search Functionality...\n');

  // Test mobile
  await testMobileSearch();

  // Test desktop
  await testDesktopSearch();
}

async function testMobileSearch() {
  console.log('📱 Testing Mobile Search Implementation...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  try {
    // Navigate to patch page
    await page.goto('http://localhost:3000/patch');
    await page.waitForLoadState('networkidle');

    console.log('✅ Mobile page loaded');

    // Find search input
    const searchInput = await page.locator('#patch-project-search-mobile');
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Test 1: No scroll jump during typing
    console.log('\n📝 Test 1: Checking scroll behavior during typing...');

    // First scroll down a bit
    await page.evaluate(() => window.scrollTo(0, 200));
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Type search term
    await searchInput.fill('construction');
    await page.waitForTimeout(250); // Wait for debounced sync

    // Check scroll position
    const finalScrollY = await page.evaluate(() => window.scrollY);

    if (Math.abs(finalScrollY - initialScrollY) < 50) {
      console.log('✅ Scroll position preserved during typing');
    } else {
      console.log(`❌ Scroll position jumped from ${initialScrollY} to ${finalScrollY}`);
    }

    // Test 2: Focus preservation
    console.log('\n🎯 Test 2: Checking focus preservation...');

    const isFocused = await searchInput.evaluate(el => document.activeElement === el);
    if (isFocused) {
      console.log('✅ Input focus preserved');
    } else {
      console.log('❌ Input lost focus');
    }

    // Test 3: No page re-renders (check DOM stability)
    console.log('\n🔄 Test 3: Checking for unnecessary re-renders...');

    // Count filter bar re-mounts
    const filterBarInitial = await page.locator('.sticky').innerHTML();
    await searchInput.press('Backspace');
    await page.waitForTimeout(100);
    const filterBarAfter = await page.locator('.sticky').innerHTML();

    if (filterBarInitial === filterBarAfter) {
      console.log('✅ No unnecessary re-renders detected');
    } else {
      console.log('⚠️ Filter bar may be re-rendering');
    }

    // Test 4: URL updates after blur
    console.log('\n🔗 Test 4: Checking URL sync on blur...');

    await searchInput.blur();
    await page.waitForTimeout(300);

    const url = page.url();
    if (url.includes('q=constructio')) {
      console.log('✅ URL updated on blur');
    } else {
      console.log('❌ URL not updated');
    }

    // Test 5: Enter key immediate sync
    console.log('\n⏎ Test 5: Checking Enter key immediate sync...');

    await searchInput.fill('building');
    await searchInput.press('Enter');
    await page.waitForTimeout(100);

    const urlAfterEnter = page.url();
    if (urlAfterEnter.includes('q=building')) {
      console.log('✅ URL updated immediately on Enter');
    } else {
      console.log('❌ URL not updated on Enter');
    }

    // Test 6: Results preservation during loading
    console.log('\n⏳ Test 6: Checking results preservation during loading...');

    // Clear search first
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Get initial project count
    const initialProjects = await page.locator('[data-testid^="project-card-"]').count();

    // Type search
    await searchInput.fill('test');
    await page.waitForTimeout(100); // Before fetch completes

    // Check if old results are still showing
    const projectsDuringLoad = await page.locator('[data-testid^="project-card-"]').count();

    if (projectsDuringLoad > 0 || initialProjects === 0) {
      console.log('✅ Results preserved during loading (or no initial results)');
    } else {
      console.log('❌ Results disappeared during loading');
    }

    console.log('\n✨ Mobile tests completed!\n');

  } catch (error) {
    console.error('❌ Mobile test failed:', error.message);
  } finally {
    await browser.close();
  }
}

async function testDesktopSearch() {
  console.log('🖥️ Testing Desktop Search Implementation...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });

  const page = await context.newPage();

  try {
    // Navigate to patch page
    await page.goto('http://localhost:3000/patch');
    await page.waitForLoadState('networkidle');

    console.log('✅ Desktop page loaded');

    // Find search input (desktop doesn't have the mobile ID)
    const searchInput = await page.locator('input[placeholder*="Search projects"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Test 1: Immediate URL updates
    console.log('\n⚡ Test 1: Checking immediate URL updates...');

    await searchInput.fill('construction');
    await page.waitForTimeout(100);

    const url = page.url();
    if (url.includes('q=construction')) {
      console.log('✅ URL updated immediately');
    } else {
      console.log('❌ URL not updated immediately');
    }

    // Test 2: Character by character updates
    console.log('\n📝 Test 2: Checking character-by-character updates...');

    await searchInput.fill('');
    await searchInput.type('a', { delay: 100 });
    const urlAfterA = page.url();
    await searchInput.type('b', { delay: 100 });
    const urlAfterAB = page.url();
    await searchInput.type('c', { delay: 100 });
    const urlAfterABC = page.url();

    if (urlAfterA.includes('q=a') && urlAfterAB.includes('q=ab') && urlAfterABC.includes('q=abc')) {
      console.log('✅ Character-by-character URL updates working');
    } else {
      console.log('❌ Character-by-character updates not working');
    }

    // Test 3: Back button navigation
    console.log('\n⬅️ Test 3: Checking back button navigation...');

    await page.goBack();
    await page.waitForTimeout(100);
    const urlAfterBack = page.url();

    if (!urlAfterBack.includes('q=')) {
      console.log('✅ Back button navigation preserved search state');
    } else {
      console.log('❌ Back button not clearing search');
    }

    // Test 4: Forward button navigation
    console.log('\n➡️ Test 4: Checking forward button navigation...');

    await page.goForward();
    await page.waitForTimeout(100);
    const urlAfterForward = page.url();

    if (urlAfterForward.includes('q=abc')) {
      console.log('✅ Forward button restored search state');
    } else {
      console.log('❌ Forward button not restoring search');
    }

    // Test 5: Direct URL with search params
    console.log('\n🔗 Test 5: Checking direct URL with search params...');

    await page.goto('http://localhost:3000/patch?q=directsearch');
    await page.waitForLoadState('networkidle');

    const inputValue = await searchInput.inputValue();
    if (inputValue === 'directsearch') {
      console.log('✅ Direct URL with search params works');
    } else {
      console.log('❌ Direct URL not populating search');
    }

    console.log('\n✨ Desktop tests completed!\n');

  } catch (error) {
    console.error('❌ Desktop test failed:', error.message);
  } finally {
    await browser.close();
  }
}

async function testSharedState() {
  console.log('🔄 Testing Shared State Between Platforms...\n');

  // This would test that URL sharing works between mobile and desktop
  // Implementation would involve:
  // 1. Setting a search on desktop
  // 2. Copying URL
  // 3. Opening on mobile
  // 4. Verifying search is applied

  console.log('📝 Note: Shared state testing requires manual verification');
  console.log('   1. Set search on desktop');
  console.log('   2. Copy URL with search params');
  console.log('   3. Open on mobile device');
  console.log('   4. Verify search is applied correctly');
}

if (require.main === module) {
  testOptimizedSearch()
    .then(() => testSharedState())
    .then(() => {
      console.log('\n✨ All tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}