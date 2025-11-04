# CFMEU Reliability & Performance Improvement Implementation Plan

## Overview

This plan addresses the reliability and performance issues identified in the comprehensive agent analysis, focusing on production readiness, system stability, and scalability for the CFMEU NSW construction union organising database.

## Critical Issues Identified

### **From Agent Analysis Summary:**

1. **Memory Leaks** - Uncleared timeouts in error handler affecting mobile performance
2. **Race Conditions** - Offline sync state modification during iteration
3. **Database Connection Issues** - Missing connection pooling for 25 concurrent users
4. **Materialized View Performance** - Auto-refresh may impact write performance
5. **Worker Reliability** - No circuit breaker patterns for worker failures
6. **Bundle Optimization** - Development configurations may not be optimal for production

### **Performance Bottlenecks:**
- Database query performance with large datasets
- Background worker communication reliability
- Mobile bundle size and loading performance
- Real-time subscription efficiency

### **Scalability Concerns:**
- No horizontal scaling strategy for background workers
- Missing graceful degradation when workers unavailable
- Limited monitoring and observability across services

## Implementation Strategy

### **Phase 1: Critical Performance Fixes (Week 1)**
- Fix memory leaks and race conditions
- Implement database connection pooling
- Optimize bundle configurations
- Add proper timeout management

### **Phase 2: Reliability & Resilience (Week 2)**
- Implement circuit breaker patterns
- Add graceful degradation strategies
- Enhance error handling and recovery
- Improve worker communication reliability

### **Phase 3: Monitoring & Observability (Week 3)**
- Replace simulated metrics with real monitoring
- Add distributed tracing across services
- Implement comprehensive health checks
- Create performance analytics dashboard

### **Phase 4: Scalability & Optimization (Week 4)**
- Optimize database queries and indexing
- Implement horizontal scaling for workers
- Add advanced caching strategies
- Performance tuning for mobile users

## Detailed Implementation Requirements

### **Phase 1: Critical Performance Fixes**

#### **1. Memory Leak Resolution**

**Files to Fix:**
- `src/hooks/useErrorHandler.ts` - Uncleared timeouts in screen reader announcements
- Any components with `setTimeout`/`setInterval` without cleanup
- Event listeners not properly removed on unmount

**Implementation:**
```typescript
// Enhanced timeout management with cleanup
const timeoutRef = useRef<NodeJS.Timeout>()

const announceToScreenReader = useCallback((message: string) => {
  dispatch({ type: 'SET_SCREEN_READER_ANNOUNCEMENT', payload: message })

  // Clear previous timeout
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }

  timeoutRef.current = setTimeout(() => {
    dispatch({ type: 'SET_SCREEN_READER_ANNOUNCEMENT', payload: '' })
  }, 1000)
}, [])

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }
}, [])
```

#### **2. Race Condition Fixes**

**Files to Fix:**
- `src/hooks/mobile/useOfflineSync.ts` - State modification during iteration
- Any async operations that modify shared state
- Concurrent API calls that could conflict

**Implementation:**
```typescript
// Fixed race condition with batched updates
const syncPendingOperations = useCallback(async () => {
  const operationsToSync = await offlineStorage.getPendingOperations()

  // Process all operations and collect results
  const results = await Promise.allSettled(
    operationsToSync.map(async (operation) => {
      try {
        const response = await syncOperation(operation)
        return { operation, success: true, response }
      } catch (error) {
        return { operation, success: false, error }
      }
    })
  )

  // Apply all state updates at once
  const successfulOps = results
    .filter(r => r.status === 'fulfilled' && r.value.success)
    .map(r => r.value.operation.id)

  const failedOps = results
    .filter(r => r.status === 'fulfilled' && !r.value.success)
    .map(r => ({ ...r.value.operation, retries: r.value.operation.retries + 1 }))
    .filter(op => op.retries < maxRetries)

  setPendingOperations(prev => [
    ...prev.filter(op => !successfulOps.includes(op.id) && !failedOps.some(fo => fo.id === op.id)),
    ...failedOps
  ])
}, [])
```

#### **3. Database Connection Pooling**

**Implementation:**
```typescript
// lib/database/connection-pool.ts
import { createClient } from '@supabase/supabase-js'

class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool
  private connections: Map<string, SupabaseClient> = new Map()
  private maxConnections = 10
  private currentConnections = 0

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool()
    }
    return DatabaseConnectionPool.instance
  }

  async getConnection(userId: string): Promise<SupabaseClient> {
    // Check for existing connection
    if (this.connections.has(userId)) {
      return this.connections.get(userId)!
    }

    // Create new connection if under limit
    if (this.currentConnections < this.maxConnections) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      this.connections.set(userId, client)
      this.currentConnections++

      return client
    }

    // Pool is full, create temporary connection
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  releaseConnection(userId: string): void {
    if (this.connections.has(userId)) {
      this.connections.delete(userId)
      this.currentConnections--
    }
  }
}

export const dbPool = DatabaseConnectionPool.getInstance()
```

#### **4. Bundle Optimization**

**File to Update:**
- `next.config.mjs` - Production bundle configuration

**Implementation:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            maxSize: 250000, // 250KB chunks
          },
          mobile: {
            test: /[\\/]src[\\/]components[\\/]mobile[\\/]/,
            name: 'mobile',
            chunks: 'all',
            priority: 20,
            maxSize: 150000, // 150KB chunks for mobile
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            maxSize: 200000,
          }
        }
      }
    }

    return config
  }
}
```

### **Phase 2: Reliability & Resilience**

#### **5. Circuit Breaker Implementation**

**Implementation:**
```typescript
// lib/resilience/circuit-breaker.ts
export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures = 0
  private lastFailureTime = 0
  private successCount = 0

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.successCount = 0
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= 3) { // Success threshold
        this.state = CircuitBreakerState.CLOSED
      }
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout
  }

  getState(): CircuitBreakerState {
    return this.state
  }
}

// Usage for worker communication
const workerCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 30000 // 30 seconds
})
```

#### **6. Graceful Degradation**

**Implementation:**
```typescript
// lib/resilience/graceful-degradation.ts
export interface FallbackStrategy<T> {
  primary: () => Promise<T>
  fallback: () => Promise<T>
  fallbackMessage?: string
}

export class GracefulDegradation {
  static async executeWithFallback<T>(strategy: FallbackStrategy<T>): Promise<T> {
    try {
      return await strategy.primary()
    } catch (primaryError) {
      console.warn('Primary operation failed, using fallback:', primaryError.message)

      try {
        const result = await strategy.fallback()

        if (strategy.fallbackMessage) {
          // Show user-friendly message about degraded functionality
          showNotification(strategy.fallbackMessage, 'warning')
        }

        return result
      } catch (fallbackError) {
        console.error('Both primary and fallback failed:', {
          primary: primaryError.message,
          fallback: fallbackError.message
        })

        throw new Error('All operation strategies failed')
      }
    }
  }
}

// Usage example for dashboard data
export const fetchDashboardData = () => {
  return GracefulDegradation.executeWithFallback({
    primary: () => fetchFromWorker('/dashboard/metrics'),
    fallback: () => fetchFromDatabase('dashboard_metrics'),
    fallbackMessage: 'Using cached data - real-time metrics temporarily unavailable'
  })
}
```

#### **7. Enhanced Error Handling**

**Implementation:**
```typescript
// lib/error/enhanced-error-handler.ts
export interface ErrorContext {
  operation: string
  userId?: string
  timestamp: Date
  additionalData?: Record<string, any>
}

export class EnhancedErrorHandler {
  private static instance: EnhancedErrorHandler
  private errorCounts: Map<string, number> = new Map()
  private lastErrors: Map<string, Date> = new Map()

  static getInstance(): EnhancedErrorHandler {
    if (!EnhancedErrorHandler.instance) {
      EnhancedErrorHandler.instance = new EnhancedErrorHandler()
    }
    return EnhancedErrorHandler.instance
  }

  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const errorKey = `${context.operation}:${error.name}`

    // Track error frequency
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1)
    this.lastErrors.set(errorKey, new Date())

    // Log detailed error information
    console.error('Enhanced Error Handler:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      frequency: this.errorCounts.get(errorKey),
      lastOccurrence: this.lastErrors.get(errorKey)
    })

    // Determine error severity and response
    const severity = this.determineSeverity(error, context)

    switch (severity) {
      case 'LOW':
        await this.handleLowSeverityError(error, context)
        break
      case 'MEDIUM':
        await this.handleMediumSeverityError(error, context)
        break
      case 'HIGH':
        await this.handleHighSeverityError(error, context)
        break
      case 'CRITICAL':
        await this.handleCriticalError(error, context)
        break
    }
  }

  private determineSeverity(error: Error, context: ErrorContext): string {
    // Critical errors that prevent core functionality
    if (error.name === 'DatabaseConnectionError' ||
        error.name === 'AuthenticationError') {
      return 'CRITICAL'
    }

    // High severity errors affecting user experience
    if (context.operation.includes('dashboard') ||
        context.operation.includes('mobile') ||
        this.errorCounts.get(`${context.operation}:${error.name}`) > 5) {
      return 'HIGH'
    }

    // Medium severity errors with workarounds
    if (error.name === 'NetworkError' ||
        error.name === 'TimeoutError') {
      return 'MEDIUM'
    }

    return 'LOW'
  }

  private async handleLowSeverityError(error: Error, context: ErrorContext): Promise<void> {
    // Log and continue - user may not need to be notified
  }

  private async handleMediumSeverityError(error: Error, context: ErrorContext): Promise<void> {
    // Show user-friendly notification
    showNotification(
      `Temporary issue with ${context.operation}. Please try again.`,
      'warning'
    )
  }

  private async handleHighSeverityError(error: Error, context: ErrorContext): Promise<void> {
    // Show more prominent notification
    showNotification(
      `We're experiencing issues with ${context.operation}. Our team has been notified.`,
      'error'
    )

    // Report to monitoring service
    await this.reportToMonitoring(error, context)
  }

  private async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
    // Immediate user notification
    showNotification(
      'Critical system error. Please refresh the page or contact support.',
      'error'
    )

    // Immediate alert to administrators
    await this.alertAdministrators(error, context)

    // Report to all monitoring channels
    await this.reportToMonitoring(error, context)
  }

  private async reportToMonitoring(error: Error, context: ErrorContext): Promise<void> {
    // Implementation for external monitoring service
    // Could integrate with Sentry, DataDog, etc.
  }

  private async alertAdministrators(error: Error, context: ErrorContext): Promise<void> {
    // Implementation for immediate admin notification
    // Could send SMS, email, Slack notification, etc.
  }
}
```

### **Phase 3: Monitoring & Observability**

#### **8. Real Database Metrics**

**Implementation:**
```typescript
// lib/monitoring/database-metrics.ts
export class DatabaseMetrics {
  private static instance: DatabaseMetrics
  private metrics: DatabaseMetricData = {
    connectionPool: {
      active: 0,
      idle: 0,
      total: 0
    },
    queryPerformance: {
      slowQueries: [],
      averageResponseTime: 0,
      queriesPerSecond: 0
    },
    errors: {
      connectionErrors: 0,
      queryErrors: 0,
      timeoutErrors: 0
    }
  }

  static getInstance(): DatabaseMetrics {
    if (!DatabaseMetrics.instance) {
      DatabaseMetrics.instance = new DatabaseMetrics()
    }
    return DatabaseMetrics.instance
  }

  async collectMetrics(): Promise<DatabaseMetricData> {
    // Real connection pool monitoring
    const poolMetrics = await this.getConnectionPoolMetrics()

    // Query performance monitoring
    const queryMetrics = await this.getQueryPerformanceMetrics()

    // Error rate monitoring
    const errorMetrics = await this.getErrorMetrics()

    return {
      connectionPool: poolMetrics,
      queryPerformance: queryMetrics,
      errors: errorMetrics
    }
  }

  private async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    // Implementation to query actual database connection pool
    // This would depend on your database provider (Supabase, PostgreSQL, etc.)

    // For Supabase, you might use their admin API or custom queries
    const result = await supabase.rpc('get_connection_pool_metrics')

    return {
      active: result.data?.active || 0,
      idle: result.data?.idle || 0,
      total: result.data?.total || 0
    }
  }

  private async getQueryPerformanceMetrics(): Promise<QueryPerformanceMetrics> {
    // Query pg_stat_statements for actual performance data
    const result = await supabase
      .from('pg_stat_statements')
      .select('*')
      .order('total_exec_time', { ascending: false })
      .limit(10)

    const queries = result.data || []

    return {
      slowQueries: queries.filter(q => q.mean_exec_time > 1000), // > 1 second
      averageResponseTime: queries.reduce((acc, q) => acc + q.mean_exec_time, 0) / queries.length,
      queriesPerSecond: queries.reduce((acc, q) => acc + q.calls, 0) / 3600 // Rough QPS
    }
  }

  private async getErrorMetrics(): Promise<ErrorMetrics> {
    // Query error logs or monitor error tracking
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const result = await supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', oneHourAgo.toISOString())

    const errors = result.data || []

    return {
      connectionErrors: errors.filter(e => e.error_type === 'connection').length,
      queryErrors: errors.filter(e => e.error_type === 'query').length,
      timeoutErrors: errors.filter(e => e.error_type === 'timeout').length
    }
  }
}
```

#### **9. Distributed Tracing**

**Implementation:**
```typescript
// lib/monitoring/distributed-tracing.ts
export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  startTime: Date
  tags: Record<string, any>
}

export class DistributedTracing {
  private static instance: DistributedTracing
  private activeTraces: Map<string, TraceContext> = new Map()

  static getInstance(): DistributedTracing {
    if (!DistributedTracing.instance) {
      DistributedTracing.instance = new DistributedTracing()
    }
    return DistributedTracing.instance
  }

  startTrace(operationName: string, parentSpanId?: string): TraceContext {
    const traceId: string = this.generateTraceId()
    const spanId: string = this.generateSpanId()

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: new Date(),
      tags: {}
    }

    this.activeTraces.set(traceId, context)
    return context
  }

  async traceOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    parentSpanId?: string,
    tags?: Record<string, any>
  ): Promise<T> {
    const context = this.startTrace(operationName, parentSpanId)

    if (tags) {
      context.tags = { ...context.tags, ...tags }
    }

    try {
      const result = await operation()
      this.finishTrace(context, { success: true })
      return result
    } catch (error) {
      this.finishTrace(context, {
        success: false,
        error: error.message
      })
      throw error
    }
  }

  private finishTrace(context: TraceContext, result: any): void {
    const endTime = new Date()
    const duration = endTime.getTime() - context.startTime.getTime()

    // Log trace data
    console.log('Trace completed:', {
      traceId: context.traceId,
      operationName: context.operationName,
      duration,
      success: result.success,
      error: result.error,
      tags: context.tags
    })

    // Send to monitoring service
    this.sendTraceToMonitoring(context, result, duration)

    // Clean up
    this.activeTraces.delete(context.traceId)
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private async sendTraceToMonitoring(
    context: TraceContext,
    result: any,
    duration: number
  ): Promise<void> {
    // Implementation to send traces to monitoring service
    // Could integrate with Jaeger, Zipkin, OpenTelemetry, etc.
  }
}

// Usage example
const tracer = DistributedTracing.getInstance()

export const tracedApiCall = async (
  operationName: string,
  apiCall: () => Promise<any>,
  userId?: string
) => {
  return tracer.traceOperation(
    operationName,
    apiCall,
    undefined,
    { userId, service: 'api' }
  )
}
```

#### **10. Comprehensive Health Checks**

**Implementation:**
```typescript
// lib/monitoring/health-check.ts
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheck[]
  overallScore: number
  issues: HealthIssue[]
  recommendations: string[]
  timestamp: Date
}

export interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  details?: Record<string, any>
  errorMessage?: string
}

export class HealthCheckService {
  private static instance: HealthCheckService

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService()
    }
    return HealthCheckService.instance
  }

  async performHealthChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    const checks: HealthCheck[] = []
    const issues: HealthIssue[] = []

    // Database health check
    const dbCheck = await this.checkDatabaseHealth()
    checks.push(dbCheck)
    if (dbCheck.status !== 'healthy') {
      issues.push({
        type: 'database',
        severity: dbCheck.status,
        message: dbCheck.errorMessage || 'Database health check failed',
        recommendation: 'Check database connection and performance'
      })
    }

    // Worker health checks
    const workerChecks = await this.checkWorkerHealth()
    checks.push(...workerChecks)
    workerChecks.forEach(check => {
      if (check.status !== 'healthy') {
        issues.push({
          type: 'worker',
          severity: check.status,
          message: `Worker ${check.name} is ${check.status}`,
          recommendation: 'Restart worker service or check logs'
        })
      }
    })

    // External service health checks
    const externalChecks = await this.checkExternalServices()
    checks.push(...externalChecks)
    externalChecks.forEach(check => {
      if (check.status !== 'healthy') {
        issues.push({
          type: 'external_service',
          severity: check.status,
          message: `External service ${check.name} is ${check.status}`,
          recommendation: 'Check external service status and API keys'
        })
      }
    })

    // Performance health check
    const perfCheck = await this.checkPerformanceHealth()
    checks.push(perfCheck)
    if (perfCheck.status !== 'healthy') {
      issues.push({
        type: 'performance',
        severity: perfCheck.status,
        message: 'Performance metrics indicate issues',
        recommendation: 'Optimize slow queries or scale resources'
      })
    }

    const overallScore = this.calculateOverallScore(checks)
    const overallStatus = this.determineOverallStatus(checks)
    const recommendations = this.generateRecommendations(issues)

    return {
      status: overallStatus,
      checks,
      overallScore,
      issues,
      recommendations,
      timestamp: new Date()
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const result = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single()

      const responseTime = Date.now() - startTime

      return {
        name: 'database',
        status: result.error ? 'unhealthy' : 'healthy',
        responseTime,
        details: {
          connected: !result.error,
          responseTime
        },
        errorMessage: result.error?.message
      }
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      }
    }
  }

  private async checkWorkerHealth(): Promise<HealthCheck[]> {
    const workerUrls = [
      process.env.DASHBOARD_WORKER_URL,
      process.env.SCRAPER_WORKER_URL,
      process.env.SCANNER_WORKER_URL,
      process.env.BCI_WORKER_URL
    ].filter(Boolean)

    const checks = await Promise.allSettled(
      workerUrls.map(async (url, index) => {
        const startTime = Date.now()

        try {
          const response = await fetch(`${url}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000) // 10 second timeout
          })

          const responseTime = Date.now() - startTime

          return {
            name: `worker-${index + 1}`,
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime,
            details: {
              url,
              statusCode: response.status
            }
          }
        } catch (error) {
          return {
            name: `worker-${index + 1}`,
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            errorMessage: error.message
          }
        }
      })
    )

    return checks
      .filter(check => check.status === 'fulfilled')
      .map(check => check.value)
  }

  private async checkExternalServices(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = []

    // Google Maps API check
    const mapsCheck = await this.checkGoogleMapsHealth()
    checks.push(mapsCheck)

    // Incolink API check
    const incolinkCheck = await this.checkIncolinkHealth()
    checks.push(incolinkCheck)

    return checks
  }

  private async checkGoogleMapsHealth(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=Sydney&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )

      const responseTime = Date.now() - startTime

      return {
        name: 'google-maps-api',
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        details: {
          apiStatus: response.ok ? 'operational' : 'degraded'
        }
      }
    } catch (error) {
      return {
        name: 'google-maps-api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      }
    }
  }

  private async checkIncolinkHealth(): Promise<HealthCheck> {
    // Implementation for Incolink API health check
    return {
      name: 'incolink-api',
      status: 'healthy', // Default implementation
      responseTime: 0,
      details: { status: 'not_implemented' }
    }
  }

  private async checkPerformanceHealth(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      // Check recent response times
      const recentMetrics = await this.getRecentPerformanceMetrics()
      const avgResponseTime = recentMetrics.reduce((acc, m) => acc + m.responseTime, 0) / recentMetrics.length

      const responseTime = Date.now() - startTime

      return {
        name: 'performance',
        status: avgResponseTime > 3000 ? 'degraded' : 'healthy', // > 3 seconds is degraded
        responseTime,
        details: {
          averageResponseTime: avgResponseTime,
          metricsCount: recentMetrics.length
        }
      }
    } catch (error) {
      return {
        name: 'performance',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      }
    }
  }

  private async getRecentPerformanceMetrics(): Promise<Array<{ responseTime: number }>> {
    // Implementation to get recent performance metrics
    // This would typically query a metrics store or database
    return Array.from({ length: 10 }, () => ({ responseTime: Math.random() * 2000 }))
  }

  private calculateOverallScore(checks: HealthCheck[]): number {
    const healthyCount = checks.filter(c => c.status === 'healthy').length
    const totalCount = checks.length
    return Math.round((healthyCount / totalCount) * 100)
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy')
    const hasDegraded = checks.some(c => c.status === 'degraded')

    if (hasUnhealthy) return 'unhealthy'
    if (hasDegraded) return 'degraded'
    return 'healthy'
  }

  private generateRecommendations(issues: HealthIssue[]): string[] {
    return issues.map(issue => issue.recommendation)
  }
}
```

### **Phase 4: Scalability & Optimization**

#### **11. Database Query Optimization**

**Implementation:**
```sql
-- Add missing indexes for performance
CREATE INDEX CONCURRENTLY idx_projects_geography
ON projects USING GIST (coordinates)
WHERE coordinates IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_employers_name_search
ON employers USING GIN (to_tsvector('english', name));

CREATE INDEX CONCURRENTLY idx_activities_created_at
ON activities (created_at DESC);

CREATE INDEX CONCURRENTLY idx_patch_job_sites_effective_dates
ON patch_job_sites (effective_from, effective_to);

-- Optimize materialized view refresh strategy
CREATE OR REPLACE FUNCTION refresh_patch_mapping_view_smart()
RETURNS void AS $$
DECLARE
  last_refresh timestamp;
  changes_since_refresh bigint;
BEGIN
  -- Get last refresh time
  SELECT COALESCE(MAX(refreshed_at), '1970-01-01'::timestamp)
  INTO last_refresh
  FROM materialized_view_stats
  WHERE view_name = 'patch_project_mapping_view';

  -- Count changes since last refresh
  SELECT COUNT(*)
  INTO changes_since_refresh
  FROM (
    SELECT 1 FROM patch_job_sites WHERE updated_at > last_refresh
    UNION ALL
    SELECT 1 FROM projects WHERE updated_at > last_refresh
    UNION ALL
    SELECT 1 FROM patches WHERE updated_at > last_refresh
  ) changes;

  -- Only refresh if significant changes
  IF changes_since_refresh > 100 THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY patch_project_mapping_view;

    UPDATE materialized_view_stats
    SET refreshed_at = NOW(), change_count = changes_since_refresh
    WHERE view_name = 'patch_project_mapping_view';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create table to track materialized view refresh stats
CREATE TABLE IF NOT EXISTS materialized_view_stats (
  view_name text PRIMARY KEY,
  refreshed_at timestamp DEFAULT NOW(),
  change_count bigint DEFAULT 0
);
```

#### **12. Advanced Caching Strategies**

**Implementation:**
```typescript
// lib/cache/advanced-cache.ts
export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum number of entries
  strategy: 'lru' | 'lfu' | 'ttl'
}

export class AdvancedCache {
  private cache = new Map<string, CacheEntry>()
  private accessTimes = new Map<string, number>()
  private config: CacheConfig

  constructor(config: CacheConfig) {
    this.config = config
    this.startCleanupTimer()
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.accessTimes.delete(key)
      return null
    }

    // Update access time for LRU
    this.accessTimes.set(key, Date.now())

    return entry.value as T
  }

  async set<T>(key: string, value: T, customTtl?: number): Promise<void> {
    const ttl = customTtl || this.config.ttl

    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictEntries()
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 1
    }

    this.cache.set(key, entry)
    this.accessTimes.set(key, Date.now())
  }

  invalidate(pattern: string | RegExp): void {
    const keys = Array.from(this.cache.keys())

    for (const key of keys) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key)
        this.accessTimes.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessTimes.clear()
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictEntries(): void {
    const entries = Array.from(this.cache.entries())

    if (this.config.strategy === 'lru') {
      // Remove least recently used entries
      entries.sort((a, b) => {
        const aTime = this.accessTimes.get(a[0]) || 0
        const bTime = this.accessTimes.get(b[0]) || 0
        return aTime - bTime
      })
    } else if (this.config.strategy === 'lfu') {
      // Remove least frequently used entries
      entries.sort((a, b) => a[1].accessCount - b[1].accessCount)
    }

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25)
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i]
      this.cache.delete(key)
      this.accessTimes.delete(key)
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired()
    }, 60000) // Cleanup every minute
  }

  private cleanupExpired(): void {
    const keys = Array.from(this.cache.keys())

    for (const key of keys) {
      const entry = this.cache.get(key)
      if (entry && this.isExpired(entry)) {
        this.cache.delete(key)
        this.accessTimes.delete(key)
      }
    }
  }
}

// Usage examples
export const dashboardCache = new AdvancedCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  strategy: 'lru'
})

export const projectCache = new AdvancedCache({
  ttl: 15 * 60 * 1000, // 15 minutes
  maxSize: 500,
  strategy: 'lru'
})

export const employerCache = new AdvancedCache({
  ttl: 30 * 60 * 1000, // 30 minutes
  maxSize: 2000,
  strategy: 'lfu'
})
```

## Success Metrics

### **Performance Targets**
- <3 second response times for all API endpoints
- <1 second dashboard load times
- 99.9% uptime for all services
- <100ms database query response times for common queries

### **Reliability Targets**
- Zero data loss during offline/online transitions
- Automatic recovery from worker failures within 30 seconds
- Graceful degradation when external services are unavailable
- Comprehensive error handling with user-friendly messages

### **Scalability Targets**
- Support for 50+ concurrent users (current target)
- Ability to scale horizontally with user growth
- Efficient resource utilization across all services
- Cost-effective scaling strategy

## Implementation Timeline

### **Week 1: Critical Performance Fixes**
- Fix memory leaks and race conditions
- Implement database connection pooling
- Optimize bundle configurations
- Add proper timeout management

### **Week 2: Reliability & Resilience**
- Implement circuit breaker patterns
- Add graceful degradation strategies
- Enhance error handling and recovery
- Improve worker communication reliability

### **Week 3: Monitoring & Observability**
- Replace simulated metrics with real monitoring
- Add distributed tracing across services
- Implement comprehensive health checks
- Create performance analytics dashboard

### **Week 4: Scalability & Optimization**
- Optimize database queries and indexing
- Implement horizontal scaling for workers
- Add advanced caching strategies
- Performance tuning for mobile users

This implementation plan provides a comprehensive approach to addressing the reliability and performance issues identified in the agent analysis, ensuring the CFMEU system is production-ready and can scale effectively with user growth.