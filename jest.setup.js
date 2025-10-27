// Global Jest setup file for CFMEU 4-Point Rating System Testing
import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { server } from './src/__tests__/mocks/server'

// Configure Testing Library
configure({ testIdAttribute: 'data-testid' })

// Set test timeout for all tests (increased for API tests)
jest.setTimeout(30000)

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock WebSocket for real-time testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
}))

// Setup MSW (Mock Service Worker) for API mocking
beforeAll(() => server.listen())

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Close server after all tests
afterAll(() => server.close())

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation for App Router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock console methods in tests to reduce noise (but keep errors)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging test failures
}

// Environment variables for testing
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Add custom matchers for 4-point rating system
expect.extend({
  toBeValidFourPointRating(received) {
    const pass = received >= 1 && received <= 4 && Number.isInteger(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid 4-point rating`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid 4-point rating (1-4)`,
        pass: false,
      }
    }
  },

  toBeValidConfidenceLevel(received) {
    const pass = received >= 0 && received <= 100 && Number.isFinite(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid confidence level`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid confidence level (0-100)`,
        pass: false,
      }
    }
  },

  toBeValidAssessmentType(received) {
    const validTypes = ['union_respect', 'safety_4_point', 'subcontractor_use', 'role_specific']
    const pass = validTypes.includes(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid assessment type`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be one of: ${validTypes.join(', ')}`,
        pass: false,
      }
    }
  },

  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

// Global test utilities
global.testUtils = {
  createMockEmployer: (overrides = {}) => ({
    id: 'test-employer-id',
    name: 'Test Employer',
    abn: '12345678901',
    role: 'trade_contractor',
    cbus_status: 'compliant',
    incocolink_status: 'active',
    ...overrides,
  }),

  createMockAssessment: (type, overrides = {}) => ({
    id: 'test-assessment-id',
    employer_id: 'test-employer-id',
    assessment_type: type,
    overall_score: 3,
    confidence_level: 80,
    assessment_date: new Date().toISOString(),
    ...overrides,
  }),

  createMockRating: (overrides = {}) => ({
    employer_id: 'test-employer-id',
    final_score: 3,
    confidence_level: 85,
    union_respect_score: 3,
    safety_score: 3,
    subcontractor_score: 3,
    role_specific_score: 3,
    last_updated: new Date().toISOString(),
    ...overrides,
  }),
}