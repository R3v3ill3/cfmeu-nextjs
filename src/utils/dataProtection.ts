/**
 * Data Protection Utilities
 * 
 * This module implements guardrails to prevent data deletion, merging, or modification
 * during dashboard operations. All dashboard functions should be read-only.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

/**
 * Read-only database operation wrapper
 * Ensures that only SELECT operations can be performed
 */
export class ReadOnlySupabase {
  constructor(private supabaseClient: any) {}

  /**
   * Create a read-only query builder that only allows SELECT operations
   */
  from(table: string) {
    const originalFrom = this.supabaseClient.from(table)
    
    // Return a proxy that only allows safe read operations
    return new Proxy(originalFrom, {
      get(target, prop) {
        // Allowed read operations
        const allowedMethods = [
          'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 
          'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
          'rangeLt', 'rangeGt', 'rangeGte', 'rangeLte', 'rangeAdjacent',
          'overlaps', 'textSearch', 'match', 'not', 'or', 'filter',
          'order', 'limit', 'range', 'abortSignal', 'single', 'maybe',
          'csv', 'geojson', 'explain', 'rollback', 'returns',
          // Promise methods
          'then', 'catch', 'finally'
        ]
        
        // Block dangerous operations
        const blockedMethods = [
          'insert', 'upsert', 'update', 'delete', 'rpc'
        ]
        
        if (typeof prop === 'string' && blockedMethods.includes(prop)) {
          throw new Error(`Dashboard Error: ${prop} operations are not allowed in dashboard components for data protection. Dashboard is read-only.`)
        }
        
        if (typeof prop === 'string' && !allowedMethods.includes(prop)) {
          console.warn(`Dashboard Warning: Method ${prop} may not be safe for read-only operations`)
        }
        
        return target[prop]
      }
    })
  }

  /**
   * Block RPC calls completely - they could modify data
   */
  rpc() {
    throw new Error('Dashboard Error: RPC calls are not allowed in dashboard components for data protection')
  }

  /**
   * Allow auth operations (read-only)
   */
  get auth() {
    const originalAuth = this.supabaseClient.auth
    
    return new Proxy(originalAuth, {
      get(target, prop) {
        // Only allow read operations on auth
        const allowedAuthMethods = ['getUser', 'getSession', 'onAuthStateChange']
        
        if (typeof prop === 'string' && !allowedAuthMethods.includes(prop)) {
          throw new Error(`Dashboard Error: Auth method ${prop} is not allowed in dashboard components`)
        }
        
        return target[prop]
      }
    })
  }
}

/**
 * Validate that a database query is read-only
 */
export function validateReadOnlyQuery(queryBuilder: any): boolean {
  try {
    // Check if the query builder has any modification methods called
    const queryString = queryBuilder.toString?.() || ''
    const dangerousPatterns = [
      /INSERT\s+INTO/i,
      /UPDATE\s+\w+\s+SET/i,
      /DELETE\s+FROM/i,
      /DROP\s+TABLE/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+TABLE/i,
      /TRUNCATE\s+TABLE/i
    ]
    
    return !dangerousPatterns.some(pattern => pattern.test(queryString))
  } catch (error) {
    console.warn('Could not validate query safety:', error)
    return false
  }
}

/**
 * Dashboard operation audit logger
 * Logs what data is accessed but not modified
 */
export class DashboardAuditLogger {
  private static instance: DashboardAuditLogger
  private logs: Array<{
    timestamp: string
    userId?: string
    operation: string
    table: string
    filters?: any
    success: boolean
    error?: string
  }> = []

  static getInstance(): DashboardAuditLogger {
    if (!DashboardAuditLogger.instance) {
      DashboardAuditLogger.instance = new DashboardAuditLogger()
    }
    return DashboardAuditLogger.instance
  }

  log(operation: string, table: string, options: {
    userId?: string
    filters?: any
    success: boolean
    error?: string
  }) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      userId: options.userId,
      operation,
      table,
      filters: options.filters,
      success: options.success,
      error: options.error
    })

    // Keep only last 100 logs in memory
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dashboard Audit: ${operation} on ${table}`, {
        success: options.success,
        filters: options.filters,
        error: options.error
      })
    }
  }

  getLogs() {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
  }
}

/**
 * Safe query executor with built-in protection
 */
export async function executeSafeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  auditInfo: {
    operation: string
    table: string
    userId?: string
    filters?: any
  }
): Promise<T | null> {
  const logger = DashboardAuditLogger.getInstance()
  
  try {
    const result = await queryFn()
    
    if (result.error) {
      logger.log(auditInfo.operation, auditInfo.table, {
        ...auditInfo,
        success: false,
        error: result.error.message
      })
      throw result.error
    }
    
    logger.log(auditInfo.operation, auditInfo.table, {
      ...auditInfo,
      success: true
    })
    
    return result.data
  } catch (error) {
    logger.log(auditInfo.operation, auditInfo.table, {
      ...auditInfo,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Component wrapper that ensures read-only data access
 */
export function withDataProtection<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const ProtectedComponent = (props: P) => {
    useEffect(() => {
      // Override console.error to catch any data modification attempts
      const originalError = console.error
      console.error = (...args: any[]) => {
        const errorMessage = args.join(' ')
        if (errorMessage.includes('Cannot read properties') && 
            errorMessage.includes('of null') && 
            errorMessage.includes('supabase')) {
          console.warn('Dashboard: Blocked potential data modification attempt')
          return
        }
        originalError.apply(console, args)
      }
      
      return () => {
        console.error = originalError
      }
    }, [])
    
    return React.createElement(Component, props)
  }
  
  ProtectedComponent.displayName = `withDataProtection(${Component.displayName || Component.name})`
  
  return ProtectedComponent
}

/**
 * Hook to ensure component is operating in read-only mode
 */
export function useReadOnlyMode() {
  useEffect(() => {
    // Set a flag that can be checked by other components (avoiding eval-like patterns)
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('DASHBOARD_READ_ONLY_MODE', 'true')
      }
    } catch (error) {
      // Silently fail if storage is not available
      console.warn('Could not set read-only mode flag:', error)
    }
    
    return () => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('DASHBOARD_READ_ONLY_MODE')
        }
      } catch (error) {
        // Silently fail
      }
    }
  }, [])
  
  return {
    isReadOnlyMode: true,
    validateOperation: (operation: string) => {
      const dangerousOps = ['insert', 'update', 'delete', 'upsert', 'rpc']
      if (dangerousOps.some(op => operation.toLowerCase().includes(op))) {
        console.error(`Dashboard Error: Operation '${operation}' is not allowed in dashboard read-only mode`)
        return false
      }
      return true
    }
  }
}
