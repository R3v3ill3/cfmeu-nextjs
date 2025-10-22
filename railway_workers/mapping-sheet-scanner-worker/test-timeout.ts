/**
 * Test script for timeout handling implementation
 *
 * This script tests the timeout utilities without requiring actual Claude API calls
 * Run with: npx tsx test-timeout.ts
 */

import {
  withTimeout,
  withTimeoutAndRetry,
  TimeoutError,
  createTimeoutController,
  logTimeoutIncident,
} from './src/utils/timeout'

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function pass(test: string) {
  log(`✓ ${test}`, 'green')
}

function fail(test: string, error: any) {
  log(`✗ ${test}`, 'red')
  console.error('  Error:', error.message)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Test 1: Basic timeout wrapper - success case
async function testTimeoutSuccess() {
  try {
    const result = await withTimeout(
      Promise.resolve('success'),
      { timeoutMs: 1000, operationName: 'Test Operation' }
    )
    if (result === 'success') {
      pass('Basic timeout wrapper - success case')
    } else {
      fail('Basic timeout wrapper - success case', new Error('Wrong result'))
    }
  } catch (error) {
    fail('Basic timeout wrapper - success case', error)
  }
}

// Test 2: Basic timeout wrapper - timeout case
async function testTimeoutFailure() {
  try {
    await withTimeout(
      sleep(2000),
      { timeoutMs: 100, operationName: 'Test Operation' }
    )
    fail('Basic timeout wrapper - timeout case', new Error('Should have timed out'))
  } catch (error) {
    if (error instanceof TimeoutError && error.timeoutMs === 100) {
      pass('Basic timeout wrapper - timeout case')
    } else {
      fail('Basic timeout wrapper - timeout case', error)
    }
  }
}

// Test 3: AbortController cleanup
async function testAbortControllerCleanup() {
  try {
    const { controller, cleanup } = createTimeoutController(1000)

    // Verify controller is created
    if (!(controller instanceof AbortController)) {
      throw new Error('Controller not created')
    }

    // Verify cleanup works
    cleanup()

    // Controller should not abort after cleanup
    await sleep(1100)
    if (!controller.signal.aborted) {
      pass('AbortController cleanup prevents timeout')
    } else {
      fail('AbortController cleanup', new Error('Controller aborted after cleanup'))
    }
  } catch (error) {
    fail('AbortController cleanup', error)
  }
}

// Test 4: AbortController timeout
async function testAbortControllerTimeout() {
  try {
    const { controller, cleanup } = createTimeoutController(100)

    await sleep(150)

    if (controller.signal.aborted) {
      pass('AbortController times out correctly')
    } else {
      fail('AbortController timeout', new Error('Controller did not abort'))
    }

    cleanup()
  } catch (error) {
    fail('AbortController timeout', error)
  }
}

// Test 5: Retry logic - success on first try
async function testRetrySuccessFirstAttempt() {
  try {
    let attempts = 0
    const result = await withTimeoutAndRetry(
      async () => {
        attempts++
        return 'success'
      },
      {
        timeoutMs: 1000,
        maxRetries: 2,
        operationName: 'Test Operation',
      }
    )

    if (result === 'success' && attempts === 1) {
      pass('Retry logic - success on first attempt (no retries)')
    } else {
      fail('Retry logic - success on first attempt', new Error(`Wrong attempts: ${attempts}`))
    }
  } catch (error) {
    fail('Retry logic - success on first attempt', error)
  }
}

// Test 6: Retry logic - success on retry
async function testRetrySuccessOnRetry() {
  try {
    let attempts = 0
    const result = await withTimeoutAndRetry(
      async () => {
        attempts++
        if (attempts === 1) {
          await sleep(200) // First attempt times out
        }
        return 'success'
      },
      {
        timeoutMs: 100,
        maxRetries: 2,
        operationName: 'Test Operation',
      }
    )

    if (result === 'success' && attempts === 2) {
      pass('Retry logic - success on second attempt')
    } else {
      fail('Retry logic - success on retry', new Error(`Wrong attempts: ${attempts}`))
    }
  } catch (error) {
    fail('Retry logic - success on retry', error)
  }
}

// Test 7: Retry logic - all attempts timeout
async function testRetryAllTimeout() {
  let attempts = 0
  try {
    await withTimeoutAndRetry(
      async () => {
        attempts++
        await sleep(200) // Always timeout
        return 'success'
      },
      {
        timeoutMs: 100,
        maxRetries: 2,
        operationName: 'Test Operation',
      }
    )
    fail('Retry logic - all attempts timeout', new Error('Should have timed out'))
  } catch (error) {
    if (error instanceof TimeoutError && attempts === 3) {
      pass('Retry logic - all attempts timeout correctly')
    } else {
      fail('Retry logic - all attempts timeout', error)
    }
  }
}

// Test 8: Retry logic - non-timeout errors don't retry
async function testRetryNonTimeoutError() {
  let attempts = 0
  try {
    await withTimeoutAndRetry(
      async () => {
        attempts++
        throw new Error('Non-timeout error')
      },
      {
        timeoutMs: 1000,
        maxRetries: 2,
        operationName: 'Test Operation',
      }
    )
    fail('Retry logic - non-timeout errors', new Error('Should have thrown'))
  } catch (error) {
    if (!(error instanceof TimeoutError) && attempts === 1) {
      pass('Retry logic - non-timeout errors fail immediately')
    } else {
      fail('Retry logic - non-timeout errors', error)
    }
  }
}

// Test 9: Retry callback
async function testRetryCallback() {
  let callbackCount = 0
  let attempts = 0

  try {
    await withTimeoutAndRetry(
      async () => {
        attempts++
        await sleep(200)
        return 'success'
      },
      {
        timeoutMs: 100,
        maxRetries: 2,
        operationName: 'Test Operation',
        onRetry: (attempt) => {
          callbackCount = attempt
        },
      }
    )
  } catch (error) {
    if (callbackCount === 2) {
      pass('Retry callback invoked correctly')
    } else {
      fail('Retry callback', new Error(`Wrong callback count: ${callbackCount}`))
    }
  }
}

// Test 10: Timeout incident logging
async function testTimeoutIncidentLogging() {
  try {
    const originalLog = console.error
    let loggedData: any = null

    // Capture console.error
    console.error = (prefix: string, data: any) => {
      if (prefix === '[timeout-incident]') {
        loggedData = data
      }
    }

    logTimeoutIncident('Test Operation', 5000, {
      testKey: 'testValue',
      testNumber: 123,
    })

    console.error = originalLog

    if (
      loggedData &&
      loggedData.operation === 'Test Operation' &&
      loggedData.timeoutMs === 5000 &&
      loggedData.testKey === 'testValue' &&
      loggedData.testNumber === 123 &&
      loggedData.timestamp
    ) {
      pass('Timeout incident logging includes all metadata')
    } else {
      fail('Timeout incident logging', new Error('Missing or incorrect log data'))
    }
  } catch (error) {
    fail('Timeout incident logging', error)
  }
}

// Test 11: TimeoutError properties
async function testTimeoutErrorProperties() {
  try {
    const error = new TimeoutError('Test timeout', 5000)

    if (
      error.name === 'TimeoutError' &&
      error.message === 'Test timeout' &&
      error.timeoutMs === 5000 &&
      error instanceof Error
    ) {
      pass('TimeoutError has correct properties')
    } else {
      fail('TimeoutError properties', new Error('Wrong properties'))
    }
  } catch (error) {
    fail('TimeoutError properties', error)
  }
}

// Test 12: Concurrent timeout operations
async function testConcurrentTimeouts() {
  try {
    const results = await Promise.all([
      withTimeout(Promise.resolve('result1'), { timeoutMs: 100 }),
      withTimeout(Promise.resolve('result2'), { timeoutMs: 100 }),
      withTimeout(Promise.resolve('result3'), { timeoutMs: 100 }),
    ])

    if (
      results[0] === 'result1' &&
      results[1] === 'result2' &&
      results[2] === 'result3'
    ) {
      pass('Concurrent timeout operations work correctly')
    } else {
      fail('Concurrent timeout operations', new Error('Wrong results'))
    }
  } catch (error) {
    fail('Concurrent timeout operations', error)
  }
}

// Run all tests
async function runTests() {
  log('\n========================================', 'cyan')
  log('  Timeout Implementation Test Suite', 'cyan')
  log('========================================\n', 'cyan')

  log('Running tests...\n', 'blue')

  await testTimeoutSuccess()
  await testTimeoutFailure()
  await testAbortControllerCleanup()
  await testAbortControllerTimeout()
  await testRetrySuccessFirstAttempt()
  await testRetrySuccessOnRetry()
  await testRetryAllTimeout()
  await testRetryNonTimeoutError()
  await testRetryCallback()
  await testTimeoutIncidentLogging()
  await testTimeoutErrorProperties()
  await testConcurrentTimeouts()

  log('\n========================================', 'cyan')
  log('  Test Suite Complete', 'cyan')
  log('========================================\n', 'cyan')
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error)
  process.exit(1)
})
