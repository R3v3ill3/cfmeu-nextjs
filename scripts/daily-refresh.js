#!/usr/bin/env node

/**
 * Daily Safety Net Refresh Script
 * 
 * This script runs daily as a backup to ensure materialized views stay current
 * even if upload-triggered refreshes fail or are missed.
 * 
 * Usage:
 * - Run via cron job: 0 2 * * * cd /path/to/app && node scripts/daily-refresh.js
 * - Run via Vercel Cron: Create a serverless function that calls this
 * - Run manually: npm run refresh-views
 */

const API_BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const REFRESH_ENDPOINT = `${API_BASE_URL}/api/admin/refresh-views`;

async function dailyRefresh() {
  console.log('🕐 Starting daily materialized view refresh...');
  console.log(`📍 Target endpoint: ${REFRESH_ENDPOINT}`);
  
  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY || 'localhost-dev'}`
      },
      body: JSON.stringify({
        scope: 'all',
        force: false // Only refresh stale views
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    console.log('✅ Daily refresh completed successfully:');
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Views refreshed: ${result.refreshedViews.join(', ')}`);
    console.log(`   Timestamp: ${result.timestamp}`);
    
    // Exit with success
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Daily refresh failed:', error);
    
    // Log detailed error information
    console.error('   Endpoint:', REFRESH_ENDPOINT);
    console.error('   Time:', new Date().toISOString());
    
    // Exit with error code for monitoring systems
    process.exit(1);
  }
}

// Check if views are stale first
async function checkStaleness() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/refresh-views`, {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      const staleViews = data.views.filter((v) => v.needs_refresh);
      
      console.log(`📊 View staleness check:`);
      data.views.forEach((view) => {
        const status = view.needs_refresh ? '🔴 STALE' : '✅ FRESH';
        console.log(`   ${view.view_name}: ${status} (${Math.round(view.minutes_old || 0)} minutes old)`);
      });
      
      if (staleViews.length === 0) {
        console.log('ℹ️ All views are fresh - skipping refresh');
        process.exit(0);
      }
      
      console.log(`🔄 ${staleViews.length} views need refresh - proceeding...`);
    }
  } catch (error) {
    console.warn('⚠️ Staleness check failed, proceeding with refresh anyway:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Daily Materialized View Refresh Script');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  
  await checkStaleness();
  await dailyRefresh();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception in daily refresh:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled rejection in daily refresh:', reason);
  process.exit(1);
});

// Run the script
main();
