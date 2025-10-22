/**
 * Test script for rate limiting functionality
 *
 * This script tests the rate limiting by making multiple rapid requests
 * to verify that the rate limiter correctly rejects requests after the limit.
 *
 * Usage:
 *   tsx scripts/test-rate-limit.ts [endpoint] [count]
 *
 * Example:
 *   tsx scripts/test-rate-limit.ts /api/projects 35
 */

import { checkRateLimit, RATE_LIMIT_PRESETS } from '../src/lib/rateLimit';
import { NextRequest } from 'next/server';

// Mock NextRequest for testing
function createMockRequest(pathname: string, ip: string = '127.0.0.1'): NextRequest {
  const url = `http://localhost:3000${pathname}`;

  const headers = new Headers({
    'x-forwarded-for': ip,
  });

  // Create a minimal mock that satisfies NextRequest interface
  const request = {
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(),
    },
    headers,
  } as unknown as NextRequest;

  return request;
}

async function testRateLimit(endpoint: string, requestCount: number = 35) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Rate Limiting for ${endpoint}`);
  console.log(`${'='.repeat(60)}\n`);

  const config = RATE_LIMIT_PRESETS.EXPENSIVE_QUERY;
  console.log('Rate Limit Config:');
  console.log(`  Max Requests: ${config.maxRequests}`);
  console.log(`  Window: ${config.windowSeconds} seconds`);
  console.log(`  Burst Allowance: ${config.burstAllowance}`);
  console.log(`  Expected limit: ${config.maxRequests + (config.burstAllowance || 0)} total\n`);

  let successCount = 0;
  let burstCount = 0;
  let rejectedCount = 0;

  console.log('Making requests...\n');

  for (let i = 1; i <= requestCount; i++) {
    const request = createMockRequest(endpoint);
    const result = checkRateLimit(request, config);

    const status = result.success ? '✓' : '✗';
    const isBurst = result.success && result.remaining === 0 && i > config.maxRequests;

    if (result.success) {
      if (isBurst) {
        burstCount++;
        console.log(
          `${status} Request ${i.toString().padStart(2)}: SUCCESS (BURST) - ` +
          `Remaining: ${result.remaining}, Reset in: ${Math.ceil((result.reset - Date.now()) / 1000)}s`
        );
      } else {
        successCount++;
        console.log(
          `${status} Request ${i.toString().padStart(2)}: SUCCESS - ` +
          `Remaining: ${result.remaining}, Reset in: ${Math.ceil((result.reset - Date.now()) / 1000)}s`
        );
      }
    } else {
      rejectedCount++;
      console.log(
        `${status} Request ${i.toString().padStart(2)}: REJECTED - ` +
        `Retry after: ${result.retryAfter}s, Reset in: ${Math.ceil((result.reset - Date.now()) / 1000)}s`
      );
    }

    // Small delay to prevent overwhelming the output
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Results:');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`  Total Requests:     ${requestCount}`);
  console.log(`  ✓ Successful:       ${successCount} (within limit)`);
  console.log(`  ✓ Burst Allowed:    ${burstCount} (within burst)`);
  console.log(`  ✗ Rejected:         ${rejectedCount} (rate limited)`);
  console.log(`  Total Allowed:      ${successCount + burstCount}`);

  const expectedAllowed = config.maxRequests + (config.burstAllowance || 0);
  const passed = (successCount + burstCount) === expectedAllowed;

  console.log(`\n  Expected Allowed:   ${expectedAllowed}`);
  console.log(`  Test Status:        ${passed ? '✓ PASSED' : '✗ FAILED'}`);

  if (!passed) {
    console.log(`\n  ⚠️  Warning: Expected ${expectedAllowed} allowed requests but got ${successCount + burstCount}`);
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

// Main execution
const endpoint = process.argv[2] || '/api/projects';
const count = parseInt(process.argv[3] || '35');

testRateLimit(endpoint, count).catch(console.error);
