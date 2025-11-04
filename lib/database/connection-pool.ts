/**
 * Database Connection Pool Management
 *
 * Provides connection pooling, retry logic, and monitoring for Supabase connections
 * to support 25+ concurrent users efficiently.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export interface ConnectionConfig {
  url: string
  key: string
  options?: {
    db?: {
      poolSize?: number
      connectionTimeoutMillis?: number
      idleTimeoutMillis?: number
      maxLifetime?: number
    }
    auth?: {
      persistSession?: boolean
      autoRefreshToken?: boolean
      detectSessionInUrl?: boolean
    }
  }
}

export interface PoolStats {
  total: number
  active: number
  idle: number
  waiting: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageWaitTime: number
  maxWaitTime: number
}

export interface ConnectionInfo {
  id: string
  client: SupabaseClient<Database>
  createdAt: number
  lastUsed: number
  isActive: boolean
  requestCount: number
  errorCount: number
}

export interface ConnectionPoolOptions {
  maxConnections?: number
  minConnections?: number
  acquireTimeoutMillis?: number
  idleTimeoutMillis?: number
  maxLifetime?: number
  healthCheckInterval?: number
  retryAttempts?: number
  retryDelay?: number
}

/**
 * Database Connection Pool for managing Supabase connections
 */
export class DatabaseConnectionPool {
  private config: ConnectionConfig
  private options: Required<ConnectionPoolOptions>
  private connections: Map<string, ConnectionInfo> = new Map()
  private waitingQueue: Array<{
    resolve: (connection: ConnectionInfo) => void
    reject: (error: Error) => void
    timestamp: number
    timeout: NodeJS.Timeout
  }> = []
  private isDestroyed = false
  private healthCheckInterval: NodeJS.Timeout | null = null
  private stats: PoolStats = {
    total: 0,
    active: 0,
    idle: 0,
    waiting: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageWaitTime: 0,
    maxWaitTime: 0
  }

  constructor(config: ConnectionConfig, options: ConnectionPoolOptions = {}) {
    this.config = config

    this.options = {
      maxConnections: options.maxConnections ?? 20,
      minConnections: options.minConnections ?? 3,
      acquireTimeoutMillis: options.acquireTimeoutMillis ?? 30000,
      idleTimeoutMillis: options.idleTimeoutMillis ?? 300000, // 5 minutes
      maxLifetime: options.maxLifetime ?? 3600000, // 1 hour
      healthCheckInterval: options.healthCheckInterval ?? 60000, // 1 minute
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000
    }

    this.initializePool()
    this.startHealthCheck()
  }

  /**
   * Initialize the minimum number of connections
   */
  private async initializePool(): Promise<void> {
    const promises = []
    for (let i = 0; i < this.options.minConnections; i++) {
      promises.push(this.createConnection())
    }

    await Promise.allSettled(promises)
    console.log(`🗄️ Database connection pool initialized with ${this.connections.size} connections`)
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<ConnectionInfo> {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const client = createClient<Database>(
        this.config.url,
        this.config.key,
        {
          ...this.config.options,
          db: {
            poolSize: 1, // Each connection manages its own pool
            ...this.config.options?.db
          }
        }
      )

      const connection: ConnectionInfo = {
        id: connectionId,
        client,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: false,
        requestCount: 0,
        errorCount: 0
      }

      this.connections.set(connectionId, connection)
      this.updateStats()

      return connection
    } catch (error) {
      console.error(`Failed to create database connection ${connectionId}:`, error)
      throw error
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<SupabaseClient<Database>> {
    if (this.isDestroyed) {
      throw new Error('Connection pool has been destroyed')
    }

    this.stats.totalRequests++
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      // Try to find an idle connection
      const idleConnection = this.getIdleConnection()

      if (idleConnection) {
        const waitTime = Date.now() - startTime
        this.updateWaitStats(waitTime)
        this.markConnectionActive(idleConnection)
        this.stats.successfulRequests++
        resolve(idleConnection.client)
        return
      }

      // If no idle connection and we can create more
      if (this.connections.size < this.options.maxConnections) {
        this.createConnection()
          .then(connection => {
            const waitTime = Date.now() - startTime
            this.updateWaitStats(waitTime)
            this.markConnectionActive(connection)
            this.stats.successfulRequests++
            resolve(connection.client)
          })
          .catch(error => {
            this.stats.failedRequests++
            reject(error)
          })
        return
      }

      // No available connections, add to waiting queue
      const timeout = setTimeout(() => {
        const queueIndex = this.waitingQueue.findIndex(item =>
          item.resolve === resolve
        )
        if (queueIndex !== -1) {
          this.waitingQueue.splice(queueIndex, 1)
          this.stats.failedRequests++
          this.updateStats()
          reject(new Error(`Connection acquire timeout after ${this.options.acquireTimeoutMillis}ms`))
        }
      }, this.options.acquireTimeoutMillis)

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout)
          const waitTime = Date.now() - startTime
          this.updateWaitStats(waitTime)
          this.markConnectionActive(connection)
          this.stats.successfulRequests++
          resolve(connection.client)
        },
        reject: (error) => {
          clearTimeout(timeout)
          this.stats.failedRequests++
          reject(error)
        },
        timestamp: startTime,
        timeout
      })

      this.updateStats()
    })
  }

  /**
   * Release a connection back to the pool
   */
  release(client: SupabaseClient<Database>): void {
    if (this.isDestroyed) return

    const connection = this.findConnectionByClient(client)
    if (!connection) return

    this.markConnectionIdle(connection)

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift()
      if (next) {
        this.markConnectionActive(connection)
        next.resolve(connection)
      }
    }

    this.updateStats()
  }

  /**
   * Execute a database operation with automatic connection management
   */
  async execute<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>,
    options: {
      retries?: number
      timeout?: number
    } = {}
  ): Promise<T> {
    const retries = options.retries ?? this.options.retryAttempts
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      let client: SupabaseClient<Database> | null = null

      try {
        client = await this.acquire()

        // Add timeout if specified
        const operationPromise = operation(client)
        const result = options.timeout
          ? await Promise.race([
              operationPromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Operation timeout')), options.timeout)
              )
            ])
          : await operationPromise

        connection.requestCount++
        this.stats.successfulRequests++
        return result

      } catch (error) {
        lastError = error as Error

        if (client) {
          const connection = this.findConnectionByClient(client)
          if (connection) {
            connection.errorCount++
          }
        }

        // Don't retry on authentication or validation errors
        if (error instanceof Error &&
            (error.message.includes('JWT') ||
             error.message.includes('Invalid') ||
             error.message.includes('Permission'))) {
          break
        }

        if (attempt < retries) {
          await new Promise(resolve =>
            setTimeout(resolve, this.options.retryDelay * Math.pow(2, attempt))
          )
        }
      } finally {
        if (client) {
          this.release(client)
        }
      }
    }

    this.stats.failedRequests++
    throw lastError || new Error('Operation failed after retries')
  }

  /**
   * Get an idle connection from the pool
   */
  private getIdleConnection(): ConnectionInfo | null {
    for (const connection of this.connections.values()) {
      if (!connection.isActive && this.isConnectionHealthy(connection)) {
        return connection
      }
    }
    return null
  }

  /**
   * Check if a connection is healthy
   */
  private async isConnectionHealthy(connection: ConnectionInfo): Promise<boolean> {
    try {
      // Simple health check - try to execute a light query
      const { error } = await connection.client.from('employers').select('id').limit(1)
      return !error
    } catch {
      return false
    }
  }

  /**
   * Mark a connection as active
   */
  private markConnectionActive(connection: ConnectionInfo): void {
    connection.isActive = true
    connection.lastUsed = Date.now()
    this.updateStats()
  }

  /**
   * Mark a connection as idle
   */
  private markConnectionIdle(connection: ConnectionInfo): void {
    connection.isActive = false
    connection.lastUsed = Date.now()
    this.updateStats()
  }

  /**
   * Find connection by client instance
   */
  private findConnectionByClient(client: SupabaseClient<Database>): ConnectionInfo | null {
    for (const connection of this.connections.values()) {
      if (connection.client === client) {
        return connection
      }
    }
    return null
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    this.stats.total = this.connections.size
    this.stats.active = Array.from(this.connections.values()).filter(c => c.isActive).length
    this.stats.idle = this.stats.total - this.stats.active
    this.stats.waiting = this.waitingQueue.length
  }

  /**
   * Update wait time statistics
   */
  private updateWaitStats(waitTime: number): void {
    const totalWaitTime = this.stats.averageWaitTime * (this.stats.successfulRequests - 1) + waitTime
    this.stats.averageWaitTime = totalWaitTime / this.stats.successfulRequests
    this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime)
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.options.healthCheckInterval)
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [id, connection] of this.connections) {
      // Remove connections that have exceeded max lifetime
      if (now - connection.createdAt > this.options.maxLifetime) {
        connectionsToRemove.push(id)
        continue
      }

      // Remove idle connections that have exceeded idle timeout
      if (!connection.isActive && now - connection.lastUsed > this.options.idleTimeoutMillis) {
        // Only remove if we have more than minimum connections
        if (this.connections.size > this.options.minConnections) {
          connectionsToRemove.push(id)
          continue
        }
      }

      // Check connection health
      if (connection.errorCount > 5) {
        connectionsToRemove.push(id)
        continue
      }
    }

    // Remove unhealthy connections
    for (const id of connectionsToRemove) {
      this.connections.delete(id)
      console.log(`🗄️ Removed unhealthy connection ${id}`)
    }

    // Ensure minimum connections
    while (this.connections.size < this.options.minConnections && !this.isDestroyed) {
      try {
        await this.createConnection()
      } catch (error) {
        console.error('Failed to create minimum connection:', error)
        break
      }
    }

    this.updateStats()
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats }
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails(): Array<{
    id: string
    age: number
    lastUsed: number
    isActive: boolean
    requestCount: number
    errorCount: number
  }> {
    const now = Date.now()
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      age: now - conn.createdAt,
      lastUsed: now - conn.lastUsed,
      isActive: conn.isActive,
      requestCount: conn.requestCount,
      errorCount: conn.errorCount
    }))
  }

  /**
   * Destroy the connection pool
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return

    this.isDestroyed = true

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(item => {
      clearTimeout(item.timeout)
      item.reject(new Error('Connection pool is being destroyed'))
    })
    this.waitingQueue = []

    // Close all connections
    this.connections.clear()
    this.updateStats()

    console.log('🗄️ Database connection pool destroyed')
  }
}

// Global connection pool instance
let globalPool: DatabaseConnectionPool | null = null

/**
 * Get or create the global database connection pool
 */
export function getDatabasePool(config?: ConnectionConfig, options?: ConnectionPoolOptions): DatabaseConnectionPool {
  if (!globalPool) {
    const defaultConfig: ConnectionConfig = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    }

    const defaultOptions: ConnectionPoolOptions = {
      maxConnections: 20,
      minConnections: 3,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000,
      maxLifetime: 3600000,
      healthCheckInterval: 60000,
      retryAttempts: 3,
      retryDelay: 1000
    }

    globalPool = new DatabaseConnectionPool(
      config ?? defaultConfig,
      options ?? defaultOptions
    )
  }

  return globalPool
}

/**
 * Execute a database operation using the global pool
 */
export async function withDatabase<T>(
  operation: (client: SupabaseClient<Database>) => Promise<T>,
  options?: {
    retries?: number
    timeout?: number
  }
): Promise<T> {
  const pool = getDatabasePool()
  return pool.execute(operation, options)
}

export default {
  DatabaseConnectionPool,
  getDatabasePool,
  withDatabase
}