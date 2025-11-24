#!/usr/bin/env node

/**
 * Test script to verify PWA geofencing functionality
 * Tests both the redirect from legacy URLs and the settings page geofencing features
 */

const baseUrl = process.env.NODE_ENV === 'production'
  ? 'https://cfmeu.uconstruct.app'
  : 'http://localhost:3000';

async function testLegacyRedirects() {
  console.log('\n🔍 Testing legacy URL redirects...');

  const legacyUrls = [
    '/mobile/ratings',
    '/mobile/ratings/dashboard',
    '/mobile/ratings/wizard',
  ];

  for (const url of legacyUrls) {
    try {
      const response = await fetch(`${baseUrl}${url}`, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        }
      });

      const location = response.headers.get('location');
      if (location && location.includes('/settings')) {
        console.log(`✅ ${url} → ${location}`);
      } else {
        console.log(`❌ ${url} - Expected redirect to /settings, got:`, location || response.status);
      }
    } catch (error) {
      console.error(`❌ Error testing ${url}:`, error.message);
    }
  }
}

async function testSettingsPage() {
  console.log('\n🔍 Testing settings page...');

  try {
    const response = await fetch(`${baseUrl}/settings`);
    const html = await response.text();

    // Check for geofencing-related content
    const hasGeofencing = html.includes('GeofencingSetup') ||
                         html.includes('geofencing') ||
                         html.includes('Site Visit Geofencing');

    if (hasGeofencing) {
      console.log('✅ Settings page contains geofencing features');
    } else {
      console.log('❌ Settings page missing geofencing features');
    }

    // Check for PWA manifest
    const hasManifest = html.includes('manifest.json');
    if (hasManifest) {
      console.log('✅ PWA manifest reference found');
    } else {
      console.log('❌ PWA manifest reference missing');
    }

  } catch (error) {
    console.error('❌ Error testing settings page:', error.message);
  }
}

async function testManifest() {
  console.log('\n🔍 Testing PWA manifest...');

  try {
    const response = await fetch(`${baseUrl}/manifest.json`);
    const manifest = await response.json();

    console.log('✅ Manifest loads successfully');
    console.log(`  - Name: ${manifest.name}`);
    console.log(`  - Start URL: ${manifest.start_url}`);

    // Check if settings shortcut exists
    const settingsShortcut = manifest.shortcuts?.find(s => s.url === '/settings');
    if (settingsShortcut) {
      console.log('✅ Settings shortcut exists in manifest');
    } else {
      console.log('⚠️  Settings shortcut not found in manifest');
    }

  } catch (error) {
    console.error('❌ Error testing manifest:', error.message);
  }
}

async function testServiceWorker() {
  console.log('\n🔍 Testing Service Worker...');

  try {
    const response = await fetch(`${baseUrl}/sw.js`);
    const swText = await response.text();

    // Check for old URLs
    const hasOldUrls = swText.includes('/mobile/ratings');
    if (!hasOldUrls) {
      console.log('✅ Service worker clean of old /mobile/ratings URLs');
    } else {
      console.log('❌ Service worker still contains /mobile/ratings URLs');
    }

    // Check for correct URLs
    const hasCorrectUrls = swText.includes('/settings');
    if (hasCorrectUrls) {
      console.log('✅ Service worker references /settings');
    } else {
      console.log('⚠️  Service worker missing /settings reference');
    }

  } catch (error) {
    console.error('❌ Error testing service worker:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log(`\n🧪 Testing PWA Geofencing Setup`);
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`=====================================`);

  await testLegacyRedirects();
  await testSettingsPage();
  await testManifest();
  await testServiceWorker();

  console.log('\n✨ Test suite complete!');
  console.log('\n📱 Manual Testing Steps:');
  console.log('1. Open Safari on iPhone');
  console.log('2. Navigate to cfmeu.uconstruct.app');
  console.log('3. Sign in as organiser/admin');
  console.log('4. Go to Settings');
  console.log('5. Enable Geofencing');
  console.log('6. Grant location permission');
  console.log('7. Add to Home Screen');
  console.log('8. Launch from home screen icon');
  console.log('9. Verify it opens to Settings, not /mobile/ratings');
}

runTests().catch(console.error);