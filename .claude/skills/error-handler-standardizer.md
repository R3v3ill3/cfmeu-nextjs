# Error Handler Standardizer Skill

Analyze and standardize error handling patterns across the application for consistency, debuggability, and user experience.

## Purpose

Ensure consistent error handling throughout the codebase by identifying inconsistent patterns, missing error handling, and opportunities to improve error messages, logging, and user experience. This skill helps establish and enforce error handling best practices.

## When to Use This Skill

- When debugging production errors
- Before implementing error monitoring (Sentry, etc.)
- After adding new features or API routes
- When standardizing API response formats
- During code quality reviews
- When improving user error messages
- After experiencing unhandled errors in production

## Analysis Scope

### 1. Error Handling Patterns

#### Try/Catch Usage
- Missing try/catch in async functions
- Empty catch blocks
- Generic catch blocks without error inspection
- Catch blocks that don't re-throw or handle
- Inconsistent error handling between similar functions

#### Promise Handling
- `.then()` without `.catch()`
- `.catch()` without proper error handling
- Unhandled promise rejections
- Silent promise failures
- Missing error callbacks

#### Error Propagation
- Errors caught but not logged
- Errors logged but not reported to user
- Errors swallowed without action
- Missing error context in propagation
- Incorrect error re-throwing

### 2. API Route Error Handling

#### Status Codes
- Inconsistent HTTP status codes
- Generic 500 errors without specificity
- Missing 4xx client error responses
- Inappropriate status codes
- Missing status code documentation

#### Response Formats
- Inconsistent error response shapes
- Missing error details
- Exposed internal errors to client
- No error codes for client handling
- Missing validation error details

#### Input Validation
- Missing input validation
- Validation without clear error messages
- No schema validation (Zod, etc.)
- Inconsistent validation error formats

### 3. React Component Error Handling

#### Error Boundaries
- Missing error boundaries
- Error boundaries without fallback UI
- Error boundaries not logging errors
- Too broad or too narrow error boundaries
- Missing error recovery mechanisms

#### Hook Error States
- React Query without error states
- Form submissions without error handling
- API calls without loading/error states
- Missing error toast notifications
- Inconsistent error display patterns

### 4. Logging and Monitoring

#### Logging Patterns
- Inconsistent log levels
- Missing error context (user, timestamp, request ID)
- Sensitive data in logs (passwords, tokens)
- No structured logging
- Console.log in production code
- Missing correlation IDs

#### Error Tracking
- Errors not sent to monitoring service
- Missing stack traces
- No error grouping or fingerprinting
- Missing user context in errors
- No performance monitoring

## Search Commands

Use these patterns to identify error handling issues:

```bash
# Find async functions without try/catch
grep -n "async.*{" --include="*.ts" --include="*.tsx" -r src/ | head -50

# Find empty catch blocks
grep -n "catch.*{[\s]*}" --include="*.ts" --include="*.tsx" -r src/

# Find generic catch blocks
grep -n "catch.*err\|error" --include="*.ts" --include="*.tsx" -r src/

# Find .then() without .catch()
grep -n "\.then\(" --include="*.ts" --include="*.tsx" -r src/

# Find console.error (should use proper logging)
grep -n "console\.error" --include="*.ts" --include="*.tsx" -r src/

# Find API routes
find src/app/api -name "route.ts" -type f

# Find error responses
grep -n "NextResponse\|Response\.json" --include="*.ts" -r src/app/api/

# Find error boundaries
grep -n "ErrorBoundary\|componentDidCatch" --include="*.tsx" -r src/
```

## Analysis Process

1. **Pattern Identification**
   - Catalog all error handling patterns in use
   - Identify most common patterns
   - Find outliers and inconsistencies

2. **Coverage Analysis**
   - Map error handling coverage
   - Identify unprotected code paths
   - Find critical paths without error handling

3. **User Experience Review**
   - Evaluate error message quality
   - Check for helpful error context
   - Assess error recovery options

4. **Standardization Opportunities**
   - Identify patterns to standardize
   - Design consistent error handling strategy
   - Create reusable error handling utilities

## Output Format

### Error Handling Analysis Report

```markdown
# Error Handling Standardization Report

## Executive Summary

**Overall Error Handling Score**: [0-100]%

**Findings**:
- Total error handling sites analyzed: [count]
- Properly handled: [count] ([percentage]%)
- Missing error handling: [count] ([percentage]%)
- Inconsistent patterns: [count] ([percentage]%)

**Critical Issues**: [count]
**High Priority Issues**: [count]
**Medium Priority Issues**: [count]

## Current Error Handling Patterns

### Pattern 1: Try/Catch with Toast (Most Common)
**Frequency**: [count] occurrences
**Locations**: API routes, form handlers

```typescript
try {
  const result = await operation()
  toast.success('Success message')
} catch (error) {
  console.error('Error:', error)
  toast.error('Error message')
}
```

**Assessment**: ✅ Good for user-facing operations

### Pattern 2: Next.js Error Response
**Frequency**: [count] occurrences
**Locations**: API routes

```typescript
catch (error) {
  console.error('Error:', error)
  return NextResponse.json(
    { error: 'Something went wrong' },
    { status: 500 }
  )
}
```

**Assessment**: ⚠️ Needs improvement - generic messages, no error codes

### Pattern 3: Silent Failure
**Frequency**: [count] occurrences ❌
**Locations**: Background operations, utilities

```typescript
catch (error) {
  // Silent - no logging, no user notification
}
```

**Assessment**: ❌ Critical issue - errors disappear

---

## Critical Issues

### Issue #1: Missing Error Handling in API Routes

**Affected Routes**: [count]

**Example**: `src/app/api/employers/route.ts:45`

```typescript
// Current (no error handling)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await supabase.from('employers').insert(body)
  return NextResponse.json(result)
}

// Recommended
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validated = employerSchema.parse(body)

    const { data, error } = await supabase
      .from('employers')
      .insert(validated)
      .select()

    if (error) {
      console.error('[API Error] Failed to create employer:', {
        error,
        body: validated,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json(
        {
          error: 'Failed to create employer',
          code: 'EMPLOYER_CREATE_FAILED',
          details: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('[API Error] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

---

### Issue #2: React Query Without Error States

**Affected Components**: [count]

**Example**: `src/components/employers/EmployerList.tsx:67`

```typescript
// Current (no error state)
const { data: employers } = useQuery({
  queryKey: ['employers'],
  queryFn: fetchEmployers
})

return (
  <div>
    {employers?.map(emp => <EmployerCard key={emp.id} employer={emp} />)}
  </div>
)

// Recommended
const { data: employers, error, isError, isLoading } = useQuery({
  queryKey: ['employers'],
  queryFn: fetchEmployers
})

if (isError) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to load employers</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : 'Unknown error occurred'}
        <Button onClick={() => refetch()} className="mt-2">
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  )
}

if (isLoading) {
  return <EmployerListSkeleton />
}

return (
  <div>
    {employers?.map(emp => <EmployerCard key={emp.id} employer={emp} />)}
  </div>
)
```

---

### Issue #3: Missing Error Boundaries

**Current State**: [count] error boundaries found
**Needed**: Error boundaries around major feature areas

**Recommended Structure**:
```typescript
// src/components/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Error Boundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)

    // Send to error monitoring service
    // captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-500 rounded">
          <h2 className="text-lg font-semibold text-red-600">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage in layout
export default function RootLayout({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
```

---

## Standardization Recommendations

### 1. API Route Error Handler Utility

Create a centralized error handler for all API routes:

```typescript
// src/lib/api-error-handler.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown) {
  console.error('[API Error]', {
    error,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined
  })

  // Validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      },
      { status: 400 }
    )
  }

  // Custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details
      },
      { status: error.statusCode }
    )
  }

  // Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code: string; message: string }

    // Map common Postgres errors
    const errorMap: Record<string, { status: number; code: string; message: string }> = {
      '23505': { status: 409, code: 'DUPLICATE_ENTRY', message: 'Record already exists' },
      '23503': { status: 400, code: 'FOREIGN_KEY_VIOLATION', message: 'Related record not found' },
      '23502': { status: 400, code: 'NULL_VIOLATION', message: 'Required field missing' }
    }

    const mapped = errorMap[dbError.code]
    if (mapped) {
      return NextResponse.json(
        { error: mapped.message, code: mapped.code, details: dbError.message },
        { status: mapped.status }
      )
    }
  }

  // Generic error
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      // Only include details in development
      details: process.env.NODE_ENV === 'development'
        ? error instanceof Error ? error.message : String(error)
        : undefined
    },
    { status: 500 }
  )
}

// Usage in API routes
export async function POST(request: NextRequest) {
  try {
    // Your logic here
    const body = await request.json()
    const validated = schema.parse(body)

    const { data, error } = await supabase.from('table').insert(validated)

    if (error) {
      throw new ApiError('Failed to create record', 500, 'CREATE_FAILED', error)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

### 2. Consistent React Query Error Handling

```typescript
// src/hooks/useStandardQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useStandardQuery<T>(
  options: UseQueryOptions<T>,
  showErrorToast = true
) {
  return useQuery({
    ...options,
    onError: (error) => {
      console.error('[Query Error]', {
        queryKey: options.queryKey,
        error,
        timestamp: new Date().toISOString()
      })

      if (showErrorToast) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to fetch data'
        )
      }

      options.onError?.(error)
    }
  })
}
```

### 3. Structured Logging

```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  requestId?: string
  component?: string
  action?: string
  [key: string]: unknown
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...context
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // Send to service (Datadog, LogRocket, etc.)
    } else {
      console[level === 'debug' ? 'log' : level](
        `[${level.toUpperCase()}]`,
        message,
        context
      )
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error?.message,
      stack: error?.stack
    })
  }
}

export const logger = new Logger()

// Usage
logger.error('Failed to create employer', error, {
  userId: user.id,
  component: 'EmployerForm',
  action: 'submit'
})
```

## Implementation Checklist

### Phase 1: Critical Fixes
- [ ] Add error handling to all API routes
- [ ] Add error states to all React Query hooks
- [ ] Replace all empty catch blocks
- [ ] Add error boundaries to main routes

### Phase 2: Standardization
- [ ] Implement centralized API error handler
- [ ] Create standard error response format
- [ ] Implement structured logging
- [ ] Add input validation with Zod

### Phase 3: User Experience
- [ ] Improve error messages (user-friendly)
- [ ] Add error recovery options
- [ ] Implement retry logic
- [ ] Add error context for support

### Phase 4: Monitoring
- [ ] Integrate error monitoring service
- [ ] Add performance monitoring
- [ ] Set up error alerting
- [ ] Create error dashboards

## Error Message Guidelines

### Good Error Messages

✅ **Specific and actionable**
```
"Failed to create employer: name is required"
```

✅ **Includes recovery options**
```
"Network error. Check your connection and try again"
```

✅ **User-friendly language**
```
"We couldn't save your changes. Please try again in a moment"
```

### Bad Error Messages

❌ **Generic and unhelpful**
```
"Error occurred"
```

❌ **Technical jargon**
```
"PGRST203: Function resolution ambiguous"
```

❌ **No context**
```
"Failed"
```

## Special Considerations for This Codebase

### Supabase Error Handling
- Check both `error` and `data` from queries
- Handle RLS policy violations gracefully
- Provide meaningful messages for constraint violations

### React Server Components
- Handle errors in async Server Components
- Use error.tsx for route-level errors
- Distinguish between server and client errors

### Background Workers
- Log errors with job context
- Implement retry logic with exponential backoff
- Alert on repeated failures

### Mobile Considerations
- Handle offline errors gracefully
- Provide clear network error messages
- Implement request queuing for offline mode

## Next Steps

After receiving this report:

1. **Prioritize**: Decide which patterns to standardize first
2. **Create Utilities**: Build reusable error handling utilities
3. **Migrate**: Update code to use standard patterns
4. **Document**: Create error handling guidelines
5. **Monitor**: Set up error tracking and alerting
6. **Review**: Regularly audit error handling coverage

## Example Invocation

**User**: "Run error-handler-standardizer on API routes"

**You should**:
1. Scan all files in `src/app/api/`
2. Catalog error handling patterns
3. Identify missing error handling
4. Provide standardization recommendations
5. Offer to implement utilities and migrate code
