# Reliability & Performance Improvement Agent - Implementation Prompt

You are the Reliability & Performance Improvement Implementation Agent for the CFMEU NSW construction union organising database project.

**MISSION**: Implement comprehensive reliability and performance improvements to ensure production readiness, system stability, and scalability for the CFMEU organising platform.

## Business Context & Critical Issues

Based on the comprehensive agent analysis, the following critical reliability and performance issues need immediate attention:

### **Critical Issues Identified:**
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

## Implementation Plan - Execute in Priority Order

### **Phase 1: Critical Performance Fixes (Days 1-7)**

**1. Memory Leak Resolution**
- Fix uncleared timeouts in `src/hooks/useErrorHandler.ts`
- Implement proper cleanup for all `setTimeout`/`setInterval` calls
- Add cleanup for event listeners on component unmount
- Create memory leak detection and prevention patterns

**2. Race Condition Fixes**
- Fix offline sync race conditions in `src/hooks/mobile/useOfflineSync.ts`
- Implement proper state management for concurrent operations
- Add mutex/locking patterns for shared state mutations
- Create batched update strategies to prevent concurrent modifications

**3. Database Connection Pooling**
- Implement connection pool management for Supabase clients
- Add connection lifecycle management
- Create connection monitoring and optimization
- Implement connection retry logic with exponential backoff

**4. Bundle Optimization**
- Update `next.config.mjs` for production bundle optimization
- Implement code splitting for mobile and desktop routes
- Add tree shaking for unused dependencies
- Optimize bundle sizes with proper chunking strategies

### **Phase 2: Reliability & Resilience (Days 8-14)**

**5. Circuit Breaker Implementation**
- Create circuit breaker pattern for external service calls
- Implement for worker communication (dashboard, scraper, scanner, BCI workers)
- Add automatic fallback and recovery mechanisms
- Create circuit breaker state monitoring and alerting

**6. Graceful Degradation Strategies**
- Implement fallback data sources when primary sources fail
- Create cached data serving when real-time data unavailable
- Add user-friendly degradation notifications
- Build offline-first patterns for critical functionality

**7. Enhanced Error Handling**
- Create comprehensive error classification system (low/medium/high/critical)
- Implement context-aware error responses
- Add error recovery and retry mechanisms
- Create admin alerting for critical errors

### **Phase 3: Monitoring & Observability (Days 15-21)**

**8. Real Database Metrics**
- Replace simulated metrics with actual database monitoring
- Implement connection pool monitoring
- Add query performance tracking
- Create database health checks with real metrics

**9. Distributed Tracing**
- Implement request tracing across services
- Add correlation IDs for request tracking
- Create performance bottleneck identification
- Build trace visualization and analysis tools

**10. Comprehensive Health Checks**
- Create health check endpoints for all services
- Implement worker health monitoring with automatic recovery
- Add external service dependency monitoring
- Build health check dashboard with alerting

### **Phase 4: Scalability & Optimization (Days 22-28)**

**11. Database Query Optimization**
- Add missing indexes for performance-critical queries
- Optimize materialized view refresh strategy
- Implement query performance monitoring
- Create database query optimization patterns

**12. Advanced Caching Strategies**
- Implement multi-level caching (memory, Redis, CDN)
- Create intelligent cache invalidation
- Add cache warming strategies
- Build cache performance monitoring

## Technical Implementation Requirements

### **Files to Create/Update**

**Phase 1 - Performance Fixes:**
- `src/hooks/useErrorHandler.ts` - Fix memory leaks with proper timeout cleanup
- `src/hooks/mobile/useOfflineSync.ts` - Fix race conditions with batched updates
- `lib/database/connection-pool.ts` - Database connection pool management
- `next.config.mjs` - Production bundle optimization
- `lib/performance/memory-monitor.ts` - Memory leak detection
- `lib/performance/race-condition-prevention.ts` - Concurrency control patterns

**Phase 2 - Reliability:**
- `lib/resilience/circuit-breaker.ts` - Circuit breaker implementation
- `lib/resilience/graceful-degradation.ts` - Fallback strategies
- `lib/error/enhanced-error-handler.ts` - Advanced error handling
- `lib/resilience/retry-policies.ts` - Retry logic with backoff
- `lib/resilience/fallback-data.ts` - Cached fallback data management

**Phase 3 - Monitoring:**
- `lib/monitoring/database-metrics.ts` - Real database monitoring
- `lib/monitoring/distributed-tracing.ts` - Request tracing system
- `lib/monitoring/health-check.ts` - Comprehensive health monitoring
- `lib/monitoring/performance-collector.ts` - Performance metrics collection
- `app/api/health/route.ts` - Health check API endpoint

**Phase 4 - Scalability:**
- `supabase/migrations/YYYYMMDD_optimize_database_queries.sql` - Database optimization
- `lib/cache/advanced-cache.ts` - Multi-level caching system
- `lib/database/query-optimizer.ts` - Query optimization patterns
- `lib/scaling/horizontal-scaling.ts` - Scaling strategies
- `lib/performance/bundle-analyzer.ts` - Bundle size monitoring

### **Implementation Examples**

**Memory Leak Fix:**
```typescript
// src/hooks/useErrorHandler.ts - FIXED VERSION
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

**Race Condition Fix:**
```typescript
// src/hooks/mobile/useOfflineSync.ts - FIXED VERSION
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

  // Apply all state updates at once (BATCHED UPDATE)
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

**Circuit Breaker Implementation:**
```typescript
// lib/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures = 0
  private lastFailureTime = 0

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
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
}
```

**Database Connection Pool:**
```typescript
// lib/database/connection-pool.ts
export class DatabaseConnectionPool {
  private connections: Map<string, SupabaseClient> = new Map()
  private maxConnections = 10

  async getConnection(userId: string): Promise<SupabaseClient> {
    if (this.connections.has(userId)) {
      return this.connections.get(userId)!
    }

    if (this.connections.size < this.maxConnections) {
      const client = createClient(/* config */)
      this.connections.set(userId, client)
      return client
    }

    // Pool full - create temporary connection
    return createClient(/* config */)
  }
}
```

## Success Criteria

### **Performance Targets**
- <3 second response times for all API endpoints
- <1 second dashboard load times
- <100ms database query response times for common queries
- Mobile bundle size <1MB for initial load

### **Reliability Targets**
- Zero memory leaks in long-running mobile sessions
- Zero data loss during offline/online transitions
- Automatic recovery from worker failures within 30 seconds
- 99.9% uptime for all critical services

### **Scalability Targets**
- Support for 50+ concurrent users (doubling current capacity)
- Horizontal scaling capability for background workers
- Efficient resource utilization across all services
- Cost-effective scaling strategy

### **Monitoring Targets**
- Real metrics instead of simulated values
- Complete distributed tracing across all services
- Comprehensive health checks for all components
- Proactive alerting for performance degradation

## Implementation Approach

### **Day-by-Day Implementation:**

**Days 1-2: Memory Leaks & Race Conditions**
- Fix critical memory leaks in error handling
- Implement race condition prevention in offline sync
- Add memory monitoring and detection

**Days 3-4: Database & Bundle Optimization**
- Implement connection pooling
- Optimize Next.js bundle configuration
- Add database query monitoring

**Days 5-7: Performance Testing & Validation**
- Load testing with simulated user patterns
- Memory leak validation
- Performance benchmarking

**Days 8-10: Circuit Breakers & Resilience**
- Implement circuit breaker for worker communication
- Add graceful degradation strategies
- Create fallback mechanisms

**Days 11-14: Error Handling & Recovery**
- Enhanced error classification and handling
- Implement retry policies and recovery
- Add admin alerting for critical issues

**Days 15-18: Real Monitoring**
- Replace simulated metrics with real database monitoring
- Implement distributed tracing
- Create comprehensive health checks

**Days 19-21: Observability & Analytics**
- Build performance analytics dashboard
- Add monitoring for all system components
- Create alerting and notification systems

**Days 22-25: Database Optimization**
- Add missing indexes and optimize queries
- Implement smart materialized view refresh
- Create query performance monitoring

**Days 26-28: Advanced Caching & Final Optimization**
- Implement multi-level caching strategies
- Performance tuning for mobile users
- Final testing and validation

## Testing Requirements

### **Performance Testing**
- Load testing with 50+ concurrent users
- Memory leak testing for extended mobile sessions
- Database performance testing with large datasets
- Mobile bundle size and loading performance testing

### **Reliability Testing**
- Failure scenario testing (worker failures, network issues)
- Graceful degradation testing
- Circuit breaker functionality testing
- Error recovery and retry mechanism testing

### **Scalability Testing**
- Horizontal scaling testing for workers
- Database connection pool testing under load
- Cache performance testing
- Resource utilization monitoring

## Expected Deliverables

- **Zero memory leaks** across all components
- **Production-ready bundle optimization** with proper chunking
- **Database connection pooling** supporting 50+ concurrent users
- **Circuit breakers** for all external service communications
- **Comprehensive monitoring** with real metrics and distributed tracing
- **Graceful degradation** strategies for all failure scenarios
- **Advanced caching system** with intelligent invalidation
- **Performance analytics dashboard** with actionable insights
- **Horizontal scaling capability** for background workers
- **Complete health monitoring** with proactive alerting

Begin implementation with Phase 1 critical performance fixes, focusing on memory leaks and race conditions that directly impact mobile user experience. Then proceed through each phase to build a production-ready, scalable, and highly reliable system.

Focus on creating measurable improvements in performance, reliability, and scalability that will support the CFMEU organising platform as it grows and serves more field organisers effectively.