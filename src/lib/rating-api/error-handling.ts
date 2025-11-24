// Comprehensive error handling utilities for the Employer Traffic Light Rating System API
// This module provides centralized error handling, logging, and response formatting

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type {
  ApiError,
  ValidationError,
  ApiResponse,
  TrafficLightRating,
  ConfidenceLevel,
  RatingStatus
} from '@/types/rating-api';

// =============================================================================
// ERROR TYPES
// =============================================================================

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  PARSING = 'PARSING',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  details?: any;
  cause?: Error;
  context?: {
    userId?: string;
    requestPath?: string;
    method?: string;
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
  };
  timestamp: string;
  stack?: string;
}

export interface ErrorReport {
  error: AppError;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    memory: {
      used: number;
      total: number;
    };
    uptime: number;
  };
}

// =============================================================================
// ERROR CONFIGURATION
// =============================================================================

interface ErrorConfig {
  includeStackTrace: boolean;
  logToDatabase: boolean;
  sendToExternalService: boolean;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
}

const ERROR_CONFIGS: Record<ErrorType, Partial<ErrorConfig>> = {
  [ErrorType.VALIDATION]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Invalid request data',
    statusCode: 400,
    retryable: false,
  },
  [ErrorType.AUTHENTICATION]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Authentication required',
    statusCode: 401,
    retryable: false,
  },
  [ErrorType.AUTHORIZATION]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Access denied',
    statusCode: 403,
    retryable: false,
  },
  [ErrorType.NOT_FOUND]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Resource not found',
    statusCode: 404,
    retryable: false,
  },
  [ErrorType.CONFLICT]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Resource conflict',
    statusCode: 409,
    retryable: false,
  },
  [ErrorType.RATE_LIMIT]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Too many requests',
    statusCode: 429,
    retryable: true,
  },
  [ErrorType.DATABASE]: {
    includeStackTrace: true,
    logToDatabase: true,
    sendToExternalService: true,
    userMessage: 'Database error occurred',
    statusCode: 500,
    retryable: true,
  },
  [ErrorType.EXTERNAL_SERVICE]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: true,
    userMessage: 'External service error',
    statusCode: 502,
    retryable: true,
  },
  [ErrorType.INTERNAL]: {
    includeStackTrace: true,
    logToDatabase: true,
    sendToExternalService: true,
    userMessage: 'Internal server error',
    statusCode: 500,
    retryable: false,
  },
  [ErrorType.NETWORK]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Network error',
    statusCode: 503,
    retryable: true,
  },
  [ErrorType.TIMEOUT]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Request timeout',
    statusCode: 408,
    retryable: true,
  },
  [ErrorType.PARSING]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Invalid request format',
    statusCode: 400,
    retryable: false,
  },
  [ErrorType.BUSINESS_LOGIC]: {
    includeStackTrace: false,
    logToDatabase: true,
    sendToExternalService: false,
    userMessage: 'Business rule violation',
    statusCode: 422,
    retryable: false,
  },
  [ErrorType.SYSTEM]: {
    includeStackTrace: true,
    logToDatabase: true,
    sendToExternalService: true,
    userMessage: 'System error',
    statusCode: 500,
    retryable: false,
  },
};

// =============================================================================
// ERROR CREATION UTILITIES
// =============================================================================

export function createError(
  type: ErrorType,
  message: string,
  options: {
    severity?: ErrorSeverity;
    code?: string;
    details?: any;
    cause?: Error;
    context?: AppError['context'];
    stack?: string;
  } = {}
): AppError {
  return {
    type,
    severity: options.severity || getDefaultSeverity(type),
    message,
    code: options.code,
    details: options.details,
    cause: options.cause,
    context: options.context || {},
    timestamp: new Date().toISOString(),
    stack: options.stack ?? options.cause?.stack,
  };
}

export function createValidationError(
  message: string,
  details: any,
  context?: AppError['context']
): AppError {
  return createError(ErrorType.VALIDATION, message, {
    severity: ErrorSeverity.LOW,
    details,
    context,
  });
}

export function createAuthenticationError(
  message: string = 'Authentication required',
  context?: AppError['context']
): AppError {
  return createError(ErrorType.AUTHENTICATION, message, {
    severity: ErrorSeverity.MEDIUM,
    context,
  });
}

export function createAuthorizationError(
  message: string = 'Access denied',
  context?: AppError['context']
): AppError {
  return createError(ErrorType.AUTHORIZATION, message, {
    severity: ErrorSeverity.MEDIUM,
    context,
  });
}

export function createNotFoundError(
  resource: string,
  identifier?: string,
  context?: AppError['context']
): AppError {
  const message = identifier ? `${resource} '${identifier}' not found` : `${resource} not found`;
  return createError(ErrorType.NOT_FOUND, message, {
    details: { resource, identifier },
    context,
  });
}

export function createConflictError(
  message: string,
  details?: any,
  context?: AppError['context']
): AppError {
  return createError(ErrorType.CONFLICT, message, {
    severity: ErrorSeverity.MEDIUM,
    details,
    context,
  });
}

export function createDatabaseError(
  message: string,
  cause?: Error,
  details?: any,
  context?: AppError['context']
): AppError {
  return createError(ErrorType.DATABASE, message, {
    severity: ErrorSeverity.HIGH,
    cause,
    details,
    context,
  });
}

export function createExternalServiceError(
  service: string,
  message: string,
  cause?: Error,
  context?: AppError['context']
): AppError {
  const fullMessage = `${service} error: ${message}`;
  return createError(ErrorType.EXTERNAL_SERVICE, fullMessage, {
    severity: ErrorSeverity.MEDIUM,
    cause,
    details: { service, originalMessage: message },
    context,
  });
}

export function createRateLimitError(
  limit: number,
  resetTime: number,
  context?: AppError['context']
): AppError {
  const message = `Rate limit exceeded. Maximum ${limit} requests allowed. Try again in ${Math.ceil(resetTime / 1000)} seconds.`;
  return createError(ErrorType.RATE_LIMIT, message, {
    severity: ErrorSeverity.MEDIUM,
    details: { limit, resetTime },
    context,
  });
}

function getDefaultSeverity(type: ErrorType): ErrorSeverity {
  switch (type) {
    case ErrorType.VALIDATION:
    case ErrorType.PARSING:
      return ErrorSeverity.LOW;
    case ErrorType.AUTHENTICATION:
    case ErrorType.AUTHORIZATION:
    case ErrorType.NOT_FOUND:
    case ErrorType.CONFLICT:
      return ErrorSeverity.MEDIUM;
    case ErrorType.DATABASE:
    case ErrorType.EXTERNAL_SERVICE:
    case ErrorType.SYSTEM:
      return ErrorSeverity.HIGH;
    case ErrorType.RATE_LIMIT:
    case ErrorType.NETWORK:
    case ErrorType.TIMEOUT:
      return ErrorSeverity.MEDIUM;
    case ErrorType.INTERNAL:
    case ErrorType.BUSINESS_LOGIC:
    default:
      return ErrorSeverity.MEDIUM;
  }
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

export async function handleApiError(
  error: AppError,
  request: NextRequest
): Promise<NextResponse> {
  // Get error configuration
  const config = ERROR_CONFIGS[error.type] || ERROR_CONFIGS[ErrorType.INTERNAL];

  // Log error
  await logError(error, request);

  // Create user-friendly response
  const errorResponse: ApiError = {
    error: error.message,
    code: error.code || error.type,
    details: shouldIncludeDetails(error, config) ? error.details : undefined,
    type: error.type,
    severity: error.severity,
    timestamp: error.timestamp,
  };

  // Add retry information if applicable
  if (config.retryable) {
    const retryAfter = calculateRetryAfter(error);
    if (retryAfter) {
      errorResponse.retryAfter = retryAfter;
    }
  }

  // Add request ID for tracking
  const requestId = generateRequestId();
  errorResponse.requestId = requestId;

  // Add rate limit headers
  const headers = {
    'X-Request-ID': requestId,
    'X-Error-Type': error.type,
    'X-Error-Severity': error.severity,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  return NextResponse.json(errorResponse, {
    status: config.statusCode,
    headers,
  });
}

export function shouldIncludeDetails(error: AppError, config: Partial<ErrorConfig>): boolean {
  // Don't include sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return !!config.includeStackTrace;
}

function calculateRetryAfter(error: AppError): number | undefined {
  // Calculate retry-after based on error type and severity
  switch (error.type) {
    case ErrorType.RATE_LIMIT:
      return error.details?.resetTime || 60;
    case ErrorType.DATABASE:
    case ErrorType.EXTERNAL_SERVICE:
    case ErrorType.NETWORK:
      return Math.min(300, Math.max(5, error.severity === ErrorSeverity.CRITICAL ? 5 : 30));
    case ErrorType.TIMEOUT:
      return 60;
    default:
      return undefined;
  }
}

// =============================================================================
// ERROR LOGGING
// =============================================================================

export async function logError(error: AppError, request: NextRequest): Promise<void> {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        type: error.type,
        severity: error.severity,
        message: error.message,
        code: error.code,
        details: error.details,
        context: error.context,
        timestamp: error.timestamp,
        stack: error.stack,
      });
    }

    // Log to database (in production)
    if (process.env.NODE_ENV === 'production' || ERROR_CONFIGS[error.type]?.logToDatabase) {
      await logToDatabase(error, request);
    }

    // Send to external monitoring service (in production)
    if (process.env.NODE_ENV === 'production' && ERROR_CONFIGS[error.type]?.sendToExternalService) {
      await logToExternalService(error, request);
    }

  } catch (loggingError) {
    // Fallback logging if error logging fails
    console.error('Failed to log error:', loggingError);
  }
}

async function logToDatabase(error: AppError, request: NextRequest): Promise<void> {
  try {
    const supabase = await createServerSupabase();

    const errorRecord = {
      error_type: error.type,
      severity: error.severity,
      message: error.message,
      code: error.code,
      details: error.details,
      stack_trace: error.stack,
      context: error.context,
      request_method: request.method,
      request_url: request.url,
      request_path: new URL(request.url).pathname,
      user_agent: request.headers.get('user-agent'),
      ip_address: getClientIpAddress(request),
      timestamp: error.timestamp,
    };

    // Insert error log into database
    await supabase.from('api_error_logs').insert(errorRecord);

  } catch (dbError) {
    console.error('Failed to log error to database:', dbError);
  }
}

async function logToExternalService(error: AppError, request: NextRequest): Promise<void> {
  try {
    // In a real implementation, this would send to a service like Sentry, DataDog, etc.
    // For now, we'll just log to console
    console.error('External service error notification:', {
      error: {
        type: error.type,
        severity: error.severity,
        message: error.message,
      },
      request: {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
      },
    });

  } catch (serviceError) {
    console.error('Failed to send error to external service:', serviceError);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getClientIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = request.ip;

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  if (remoteAddr) {
    return remoteAddr;
  }

  return 'unknown';
}

export function isRateLimitError(error: AppError): boolean {
  return error.type === ErrorType.RATE_LIMIT;
}

export function isRetryableError(error: AppError): boolean {
  return ERROR_CONFIGS[error.type]?.retryable || false;
}

export function isUserError(error: AppError): boolean {
  return [
    ErrorType.VALIDATION,
    ErrorType.AUTHENTICATION,
    ErrorType.AUTHORIZATION,
    ErrorType.NOT_FOUND,
    ErrorType.CONFLICT,
    ErrorType.BUSINESS_LOGIC,
  ].includes(error.type);
}

export function isServerError(error: AppError): boolean {
  return [
    ErrorType.DATABASE,
    ErrorType.EXTERNAL_SERVICE,
    ErrorType.INTERNAL,
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SYSTEM,
  ].includes(error.type);
}

export function getErrorSummary(error: AppError): string {
  if (error.type === ErrorType.VALIDATION && error.details) {
    const fieldNames = Object.keys(error.details);
    if (fieldNames.length > 0) {
      return `${error.message} (Fields: ${fieldNames.join(', ')})`;
    }
  }

  return error.message;
}

// =============================================================================
// ERROR RESPONSE BUILDERS
// =============================================================================

export function buildErrorResponse(
  error: AppError,
  request?: NextRequest,
  options?: {
    includeRequestId?: boolean;
    includeStack?: boolean;
  }
): NextResponse {
  const config = ERROR_CONFIGS[error.type] || ERROR_CONFIGS[ErrorType.INTERNAL];
  const requestId = options?.includeRequestId !== false ? generateRequestId() : undefined;

  const errorResponse: ApiError = {
    error: error.message,
    code: error.code || error.type,
    details: options?.includeStack && error.stack ? error.stack : undefined,
    type: error.type,
    severity: error.severity,
    timestamp: error.timestamp,
    requestId,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  if (isRateLimitError(error)) {
    const retryAfter = calculateRetryAfter(error);
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString();
    }
  }

  return NextResponse.json(errorResponse, {
    status: config.statusCode,
    headers,
  });
}

export function buildSuccessResponse<T>(
  data: T,
  request?: NextRequest,
  options?: {
    statusCode?: number;
    cacheControl?: string;
    headers?: Record<string, string>;
  }
): NextResponse {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  const response: ApiResponse<T> = {
    data,
    meta: {
      timestamp,
      requestId,
      version: '1.0',
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'X-Timestamp': timestamp,
    ...options?.headers,
  };

  if (options?.cacheControl) {
    headers['Cache-Control'] = options.cacheControl;
  }

  return NextResponse.json(response, {
    status: options?.statusCode || 200,
    headers,
  });
}

// =============================================================================
// WRAPPER FUNCTIONS FOR COMMON OPERATIONS
// =============================================================================

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: {
    request?: NextRequest;
    operation?: string;
  }
): Promise<{ data: T | null; error?: AppError }> {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    const appError = createAppError(error);
    if (context?.request) {
      await logError(appError, context.request);
    }
    return { data: null, error: appError };
  }
}

export function createAppError(error: unknown): AppError {
  if (error instanceof Error) {
    // Handle known error types
    if (error.name === 'ValidationError') {
      return createValidationError(error.message, error.message);
    }
    if (error.name === 'DatabaseError') {
      return createDatabaseError(error.message, error);
    }
    if (error.name === 'RateLimitError') {
      return createRateLimitError(100, 60000);
    }

    // Generic error
    return createError(ErrorType.INTERNAL, error.message, {
      cause: error,
      stack: error.stack,
    });
  } else if (typeof error === 'string') {
    return createError(ErrorType.INTERNAL, error);
  } else {
    return createError(ErrorType.INTERNAL, 'Unknown error occurred');
  }
}

export default {
  // Error creation
  createError,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createDatabaseError,
  createExternalServiceError,
  createRateLimitError,

  // Error handling
  handleApiError,
  logError,
  shouldIncludeDetails,
  calculateRetryAfter,

  // Response builders
  buildErrorResponse,
  buildSuccessResponse,

  // Utilities
  generateRequestId,
  getClientIpAddress,
  isRateLimitError,
  isRetryableError,
  isUserError,
  isServerError,
  getErrorSummary,

  // Wrapper functions
  withErrorHandling,
  createAppError,

  // Configs and enums
  ErrorType,
  ErrorSeverity,
  ERROR_CONFIGS,
};