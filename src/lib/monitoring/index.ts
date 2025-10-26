/**
 * Monitoring and health check system for rating system
 * Provides comprehensive health monitoring, metrics collection, and alerting
 */

import { featureFlags } from '../feature-flags'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: HealthCheck[]
  overallScore: number
  issues: HealthIssue[]
  recommendations: string[]
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  duration: number
  message?: string
  details?: Record<string, any>
  threshold?: {
    warning: number
    critical: number
  }
}

export interface HealthIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'performance' | 'availability' | 'functionality' | 'security'
  title: string
  description: string
  affectedComponent: string
  timestamp: string
}

export interface SystemMetrics {
  timestamp: string
  environment: string
  version: string
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  database: {
    connectionPool: {
      active: number
      idle: number
      total: number
    }
    queryStats: {
      avgResponseTime: number
      slowQueries: number
      failedQueries: number
    }
  }
  api: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
    statusCodes: Record<string, number>
  }
  ratingSystem: {
    activeRatings: number
    calculationsPerMinute: number
    cacheHitRate: number
    errorRate: number
  }
}

export interface AlertConfig {
  name: string
  enabled: boolean
  threshold: number
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  severity: 'info' | 'warning' | 'critical'
  cooldown: number // minutes
  channels: ('email' | 'slack' | 'pagerduty')[]
  conditions: {
    metric: string
    operator: string
    value: number
  }[]
}

export class MonitoringService {
  private static instance: MonitoringService
  private metrics: Map<string, number[]> = new Map()
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map()
  private alerts: Map<string, AlertConfig> = new Map()
  private lastAlertTimes: Map<string, number> = new Map()
  private startTime: number = Date.now()

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
      MonitoringService.instance.initializeDefaultChecks()
    }
    return MonitoringService.instance
  }

  private initializeDefaultChecks() {
    // Database connectivity check
    this.registerHealthCheck('database', async () => {
      const start = Date.now()
      try {
        // This would be implemented with actual database health check
        // For now, simulate database check
        await new Promise(resolve => setTimeout(resolve, 50))
        const duration = Date.now() - start

        return {
          name: 'database',
          status: duration < 500 ? 'pass' : duration < 1000 ? 'warn' : 'fail',
          duration,
          message: `Database connection ${duration < 500 ? 'healthy' : 'slow'}`,
          details: {
            responseTime: duration,
            connections: { active: 5, idle: 15, total: 20 }
          },
          threshold: { warning: 500, critical: 1000 }
        }
      } catch (error) {
        return {
          name: 'database',
          status: 'fail',
          duration: Date.now() - start,
          message: `Database connection failed: ${error}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    })

    // Rating system health check
    this.registerHealthCheck('rating-system', async () => {
      const start = Date.now()
      try {
        // This would check rating system functionality
        await new Promise(resolve => setTimeout(resolve, 100))
        const duration = Date.now() - start

        return {
          name: 'rating-system',
          status: duration < 1000 ? 'pass' : duration < 2000 ? 'warn' : 'fail',
          duration,
          message: `Rating system ${duration < 1000 ? 'operational' : 'slow'}`,
          details: {
            responseTime: duration,
            activeCalculations: 0,
            cacheSize: 150,
            lastCalculation: new Date().toISOString()
          },
          threshold: { warning: 1000, critical: 2000 }
        }
      } catch (error) {
        return {
          name: 'rating-system',
          status: 'fail',
          duration: Date.now() - start,
          message: `Rating system check failed: ${error}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    })

    // API performance check
    this.registerHealthCheck('api-performance', async () => {
      const start = Date.now()
      try {
        // Check API response times
        const responseTime = Math.random() * 200 + 50 // Simulate 50-250ms response time
        const duration = Date.now() - start

        return {
          name: 'api-performance',
          status: responseTime < 200 ? 'pass' : responseTime < 500 ? 'warn' : 'fail',
          duration,
          message: `API response time ${responseTime.toFixed(2)}ms`,
          details: {
            averageResponseTime: responseTime,
            requestsPerMinute: Math.floor(Math.random() * 1000) + 100,
            errorRate: Math.random() * 2 // 0-2% error rate
          },
          threshold: { warning: 200, critical: 500 }
        }
      } catch (error) {
        return {
          name: 'api-performance',
          status: 'fail',
          duration: Date.now() - start,
          message: `API performance check failed: ${error}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    })

    // Feature flags check
    this.registerHealthCheck('feature-flags', async () => {
      const start = Date.now()
      try {
        const systemStatus = featureFlags.getSystemStatus()
        const duration = Date.now() - start

        const hasCriticalFlags = featureFlags.isEnabled('RATING_SYSTEM_ENABLED')

        return {
          name: 'feature-flags',
          status: hasCriticalFlags ? 'pass' : 'warn',
          duration,
          message: `Feature flags system ${hasCriticalFlags ? 'operational' : 'core features disabled'}`,
          details: {
            ...systemStatus,
            criticalFlagsEnabled: {
              ratingSystem: hasCriticalFlags,
              dashboard: featureFlags.isEnabled('RATING_DASHBOARD_ENABLED'),
              mobile: featureFlags.isEnabled('MOBILE_RATINGS_ENABLED')
            }
          }
        }
      } catch (error) {
        return {
          name: 'feature-flags',
          status: 'fail',
          duration: Date.now() - start,
          message: `Feature flags check failed: ${error}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    })

    this.initializeDefaultAlerts()
  }

  private initializeDefaultAlerts() {
    // High error rate alert
    this.registerAlert('high-error-rate', {
      name: 'High Error Rate',
      enabled: true,
      threshold: 5,
      comparison: 'gt',
      severity: 'critical',
      cooldown: 5,
      channels: ['email', 'slack'],
      conditions: [
        { metric: 'api.errorRate', operator: 'gt', value: 5 }
      ]
    })

    // Database performance alert
    this.registerAlert('database-slow', {
      name: 'Database Slow Response',
      enabled: true,
      threshold: 1000,
      comparison: 'gt',
      severity: 'warning',
      cooldown: 10,
      channels: ['slack'],
      conditions: [
        { metric: 'database.avgResponseTime', operator: 'gt', value: 1000 }
      ]
    })

    // Rating system failure alert
    this.registerAlert('rating-system-down', {
      name: 'Rating System Unavailable',
      enabled: true,
      threshold: 0,
      comparison: 'eq',
      severity: 'critical',
      cooldown: 2,
      channels: ['email', 'slack', 'pagerduty'],
      conditions: [
        { metric: 'ratingSystem.status', operator: 'eq', value: 0 }
      ]
    })
  }

  registerHealthCheck(name: string, check: () => Promise<HealthCheck>) {
    this.healthChecks.set(name, check)
  }

  registerAlert(name: string, config: AlertConfig) {
    this.alerts.set(name, config)
  }

  async runHealthChecks(): Promise<HealthCheckResult> {
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        try {
          return await checkFn()
        } catch (error) {
          return {
            name,
            status: 'fail' as const,
            duration: 0,
            message: `Health check failed: ${error}`,
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          }
        }
      }
    )

    const checks = await Promise.all(checkPromises)
    const failedChecks = checks.filter(check => check.status === 'fail')
    const warningChecks = checks.filter(check => check.status === 'warn')
    const passedChecks = checks.filter(check => check.status === 'pass')

    // Calculate overall score (0-100)
    const totalChecks = checks.length
    const score = totalChecks > 0 ? (passedChecks.length / totalChecks) * 100 : 0

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (failedChecks.length > 0) {
      status = 'unhealthy'
    } else if (warningChecks.length > 0) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    // Generate issues
    const issues: HealthIssue[] = [
      ...failedChecks.map(check => ({
        severity: 'critical' as const,
        category: 'availability' as const,
        title: `${check.name} failure`,
        description: check.message || `Health check ${check.name} failed`,
        affectedComponent: check.name,
        timestamp: new Date().toISOString()
      })),
      ...warningChecks.map(check => ({
        severity: 'medium' as const,
        category: 'performance' as const,
        title: `${check.name} warning`,
        description: check.message || `Health check ${check.name} showing warnings`,
        affectedComponent: check.name,
        timestamp: new Date().toISOString()
      }))
    ]

    // Generate recommendations
    const recommendations: string[] = []
    if (failedChecks.length > 0) {
      recommendations.push('Immediate investigation required for failed health checks')
    }
    if (warningChecks.length > 0) {
      recommendations.push('Monitor warning conditions and optimize performance')
    }
    if (score < 80) {
      recommendations.push('Overall system health below optimal levels')
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
      overallScore: Math.round(score),
      issues,
      recommendations
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const uptime = Date.now() - this.startTime

    // Simulate metrics collection
    // In production, this would collect real metrics from various sources
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime,
      memory: {
        used: Math.random() * 500 * 1024 * 1024, // 0-500MB
        total: 1024 * 1024 * 1024, // 1GB
        percentage: Math.random() * 60 + 20 // 20-80%
      },
      cpu: {
        usage: Math.random() * 80 + 10 // 10-90%
      },
      database: {
        connectionPool: {
          active: Math.floor(Math.random() * 10) + 1,
          idle: Math.floor(Math.random() * 20) + 5,
          total: 25
        },
        queryStats: {
          avgResponseTime: Math.random() * 100 + 50, // 50-150ms
          slowQueries: Math.floor(Math.random() * 5), // 0-5
          failedQueries: Math.floor(Math.random() * 2) // 0-2
        }
      },
      api: {
        requestsPerMinute: Math.floor(Math.random() * 1000) + 100,
        averageResponseTime: Math.random() * 200 + 50, // 50-250ms
        errorRate: Math.random() * 2, // 0-2%
        statusCodes: {
          '200': Math.floor(Math.random() * 900) + 100,
          '400': Math.floor(Math.random() * 10),
          '500': Math.floor(Math.random() * 5)
        }
      },
      ratingSystem: {
        activeRatings: Math.floor(Math.random() * 1000) + 500,
        calculationsPerMinute: Math.floor(Math.random() * 50) + 10,
        cacheHitRate: Math.random() * 30 + 70, // 70-100%
        errorRate: Math.random() * 1 // 0-1%
      }
    }
  }

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const values = this.metrics.get(name)!
    values.push({ timestamp: Date.now(), value } as any)

    // Keep only last 1000 data points
    if (values.length > 1000) {
      values.splice(0, values.length - 1000)
    }

    // Check alerts
    this.checkAlerts(name, value)
  }

  private checkAlerts(metricName: string, value: number) {
    for (const [alertName, alert] of this.alerts.entries()) {
      if (!alert.enabled) continue

      // Check cooldown
      const lastAlert = this.lastAlertTimes.get(alertName) || 0
      const cooldownMs = alert.cooldown * 60 * 1000
      if (Date.now() - lastAlert < cooldownMs) continue

      // Check conditions
      const shouldAlert = alert.conditions.some(condition => {
        if (condition.metric !== metricName) return false

        switch (condition.operator) {
          case 'gt': return value > condition.value
          case 'lt': return value < condition.value
          case 'eq': return value === condition.value
          case 'gte': return value >= condition.value
          case 'lte': return value <= condition.value
          default: return false
        }
      })

      if (shouldAlert) {
        this.triggerAlert(alertName, alert, metricName, value)
        this.lastAlertTimes.set(alertName, Date.now())
      }
    }
  }

  private triggerAlert(alertName: string, alert: AlertConfig, metric: string, value: number) {
    console.warn(`ALERT: ${alert.name}`, {
      metric,
      value,
      threshold: alert.threshold,
      severity: alert.severity,
      channels: alert.channels
    })

    // In production, this would send actual alerts to configured channels
    // For now, just log the alert
  }

  // Emergency controls
  emergencyShutdown(reason: string) {
    console.error(`EMERGENCY SHUTDOWN: ${reason}`)

    // Disable all feature flags
    const allFlags = featureFlags.getAllFlags()
    Object.keys(allFlags).forEach(flagName => {
      if (flagName.includes('RATING_')) {
        featureFlags.emergencyDisable(flagName as any)
      }
    })

    // Alert administrators
    this.triggerAlert('emergency-shutdown', {
      name: 'Emergency Shutdown',
      enabled: true,
      threshold: 0,
      comparison: 'eq',
      severity: 'critical',
      cooldown: 1,
      channels: ['email', 'slack', 'pagerduty'],
      conditions: [{ metric: 'system.status', operator: 'eq', value: 0 }]
    }, 'system.status', 0)
  }

  getMonitoringStatus() {
    return {
      uptime: Date.now() - this.startTime,
      registeredChecks: this.healthChecks.size,
      registeredAlerts: this.alerts.size,
      metricsCount: Array.from(this.metrics.values()).reduce((sum, values) => sum + values.length, 0),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance()

// Convenience functions for common monitoring tasks
export async function healthCheck(): Promise<HealthCheckResult> {
  return monitoring.runHealthChecks()
}

export async function getMetrics(): Promise<SystemMetrics> {
  return monitoring.getSystemMetrics()
}

export function recordMetric(name: string, value: number) {
  monitoring.recordMetric(name, value)
}