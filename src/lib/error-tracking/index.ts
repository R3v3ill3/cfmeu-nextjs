/**
 * Enhanced error tracking and alerting system
 * Integrates with existing rating error handler and provides comprehensive error monitoring
 */

import { featureFlags } from '../feature-flags'
import { monitoring } from '../monitoring'

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  employerId?: string
  sessionId?: string
  userAgent?: string
  url?: string
  additionalData?: Record<string, any>
}

export interface ErrorReport {
  id: string
  timestamp: string
  environment: string
  version: string
  error: {
    name: string
    message: string
    stack?: string
    cause?: any
  }
  context: ErrorContext
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'user' | 'system' | 'network' | 'database' | 'calculation' | 'ui'
  resolved: boolean
  occurrences: number
  firstOccurrence: string
  lastOccurrence: string
  affectedUsers: string[]
  metadata: {
    fingerprint: string
    grouping: string
    tags: string[]
  }
}

export interface AlertConfig {
  id: string
  name: string
  enabled: boolean
  conditions: {
    errorPattern?: string
    severity?: string[]
    category?: string[]
    frequencyThreshold?: number
    timeWindow?: number // minutes
  }
  actions: {
    email?: {
      enabled: boolean
      recipients: string[]
      template?: string
    }
    slack?: {
      enabled: boolean
      webhook?: string
      channel?: string
    }
    pagerduty?: {
      enabled: boolean
      serviceKey?: string
      severity?: string
    }
    featureFlag?: {
      enabled: boolean
      flagName: string
      action: 'disable' | 'enable'
    }
  }
  cooldown: number // minutes
  lastTriggered?: string
}

export class ErrorTrackingService {
  private static instance: ErrorTrackingService
  private errorReports: Map<string, ErrorReport> = new Map()
  private alertConfigs: Map<string, AlertConfig> = new Map()
  private alertCooldowns: Map<string, number> = new Map()
  private errorQueue: ErrorReport[] = []
  private maxQueueSize = 1000
  private isProcessing = false

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService()
      ErrorTrackingService.instance.initializeDefaultAlerts()
    }
    return ErrorTrackingService.instance
  }

  private initializeDefaultAlerts() {
    // Critical system errors
    this.registerAlert('critical-system-errors', {
      id: 'critical-system-errors',
      name: 'Critical System Errors',
      enabled: true,
      conditions: {
        severity: ['critical'],
        frequencyThreshold: 1,
        timeWindow: 5
      },
      actions: {
        email: { enabled: true, recipients: ['admin@cfmeu.org'] },
        slack: { enabled: true, channel: '#alerts' },
        pagerduty: { enabled: true, severity: 'critical' },
        featureFlag: { enabled: true, flagName: 'RATING_SYSTEM_ENABLED', action: 'disable' }
      },
      cooldown: 15
    })

    // High error rate
    this.registerAlert('high-error-rate', {
      id: 'high-error-rate',
      name: 'High Error Rate',
      enabled: true,
      conditions: {
        frequencyThreshold: 10,
        timeWindow: 5
      },
      actions: {
        email: { enabled: true, recipients: ['devops@cfmeu.org'] },
        slack: { enabled: true, channel: '#alerts' }
      },
      cooldown: 30
    })

    // Database errors
    this.registerAlert('database-errors', {
      id: 'database-errors',
      name: 'Database Connection Errors',
      enabled: true,
      conditions: {
        category: ['database'],
        frequencyThreshold: 3,
        timeWindow: 2
      },
      actions: {
        email: { enabled: true, recipients: ['database@cfmeu.org'] },
        slack: { enabled: true, channel: '#database-alerts' }
      },
      cooldown: 10
    })

    // Rating calculation errors
    this.registerAlert('rating-calculation-errors', {
      id: 'rating-calculation-errors',
      name: 'Rating Calculation Errors',
      enabled: true,
      conditions: {
        category: ['calculation'],
        frequencyThreshold: 5,
        timeWindow: 5
      },
      actions: {
        email: { enabled: true, recipients: ['rating-team@cfmeu.org'] },
        slack: { enabled: true, channel: '#rating-alerts' }
      },
      cooldown: 15
    })
  }

  registerAlert(id: string, config: AlertConfig) {
    this.alertConfigs.set(id, config)
  }

  trackError(
    error: Error | string,
    context: ErrorContext = {},
    severity: ErrorReport['severity'] = 'medium',
    category: ErrorReport['category'] = 'system'
  ): string {
    if (!featureFlags.isEnabled('ENHANCED_ERROR_TRACKING')) {
      // Fallback to basic console logging if tracking is disabled
      console.error('Error:', error, context)
      return 'basic-tracking-disabled'
    }

    const errorObj = typeof error === 'string' ? new Error(error) : error
    const fingerprint = this.generateFingerprint(errorObj, context)
    const timestamp = new Date().toISOString()

    let errorReport = this.errorReports.get(fingerprint)

    if (errorReport) {
      // Update existing error report
      errorReport.occurrences++
      errorReport.lastOccurrence = timestamp
      errorReport.severity = this.getHigherSeverity(errorReport.severity, severity)

      if (context.userId && !errorReport.affectedUsers.includes(context.userId)) {
        errorReport.affectedUsers.push(context.userId)
      }
    } else {
      // Create new error report
      errorReport = {
        id: this.generateId(),
        timestamp,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        error: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack,
          cause: errorObj.cause
        },
        context: {
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          ...context
        },
        severity,
        category,
        resolved: false,
        occurrences: 1,
        firstOccurrence: timestamp,
        lastOccurrence: timestamp,
        affectedUsers: context.userId ? [context.userId] : [],
        metadata: {
          fingerprint,
          grouping: this.determineGrouping(errorObj, category),
          tags: this.generateTags(errorObj, context, category)
        }
      }

      this.errorReports.set(fingerprint, errorReport)
    }

    // Add to processing queue
    this.errorQueue.push(errorReport)
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }

    // Process queue asynchronously
    this.processErrorQueue()

    // Record metrics
    monitoring.recordMetric('errors.total', 1)
    monitoring.recordMetric(`errors.${category}`, 1)
    monitoring.recordMetric(`errors.${severity}`, 1)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${category}:`, errorObj.message, context)
    }

    return errorReport.id
  }

  private async processErrorQueue() {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return
    }

    this.isProcessing = true
    const errorsToProcess = [...this.errorQueue]
    this.errorQueue = []

    try {
      for (const errorReport of errorsToProcess) {
        await this.processError(errorReport)
      }
    } catch (error) {
      console.error('Error processing queue:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async processError(errorReport: ErrorReport) {
    // Check alert conditions
    for (const [alertId, alertConfig] of this.alertConfigs.entries()) {
      if (!alertConfig.enabled) continue

      // Check cooldown
      const lastTriggered = this.alertCooldowns.get(alertId) || 0
      const cooldownMs = alertConfig.cooldown * 60 * 1000
      if (Date.now() - lastTriggered < cooldownMs) continue

      // Check if error matches alert conditions
      if (this.shouldTriggerAlert(errorReport, alertConfig)) {
        await this.triggerAlert(alertId, alertConfig, errorReport)
        this.alertCooldowns.set(alertId, Date.now())
        alertConfig.lastTriggered = new Date().toISOString()
      }
    }
  }

  private shouldTriggerAlert(errorReport: ErrorReport, alertConfig: AlertConfig): boolean {
    const { conditions } = alertConfig

    // Check severity
    if (conditions.severity && !conditions.severity.includes(errorReport.severity)) {
      return false
    }

    // Check category
    if (conditions.category && !conditions.category.includes(errorReport.category)) {
      return false
    }

    // Check error pattern
    if (conditions.errorPattern) {
      const pattern = new RegExp(conditions.errorPattern, 'i')
      if (!pattern.test(errorReport.error.message) && !pattern.test(errorReport.error.name)) {
        return false
      }
    }

    // Check frequency threshold
    if (conditions.frequencyThreshold && conditions.timeWindow) {
      const timeWindow = conditions.timeWindow * 60 * 1000 // Convert to milliseconds
      const cutoffTime = Date.now() - timeWindow

      let recentOccurrences = 0
      for (const report of this.errorReports.values()) {
        if (new Date(report.lastOccurrence).getTime() > cutoffTime) {
          recentOccurrences += report.occurrences
        }
      }

      if (recentOccurrences < conditions.frequencyThreshold) {
        return false
      }
    }

    return true
  }

  private async triggerAlert(alertId: string, alertConfig: AlertConfig, errorReport: ErrorReport) {
    console.warn(`ALERT TRIGGERED: ${alertConfig.name}`, {
      alertId,
      errorId: errorReport.id,
      severity: errorReport.severity,
      message: errorReport.error.message,
      occurrences: errorReport.occurrences
    })

    const { actions } = alertConfig

    // Send email alerts
    if (actions.email?.enabled && actions.email.recipients.length > 0) {
      await this.sendEmailAlert(actions.email, alertConfig, errorReport)
    }

    // Send Slack alerts
    if (actions.slack?.enabled) {
      await this.sendSlackAlert(actions.slack, alertConfig, errorReport)
    }

    // Send PagerDuty alerts
    if (actions.pagerduty?.enabled) {
      await this.sendPagerDutyAlert(actions.pagerduty, alertConfig, errorReport)
    }

    // Execute feature flag actions
    if (actions.featureFlag?.enabled) {
      await this.executeFeatureFlagAction(actions.featureFlag, errorReport)
    }
  }

  private async sendEmailAlert(emailConfig: AlertConfig['actions']['email'], alertConfig: AlertConfig, errorReport: ErrorReport) {
    // In production, this would integrate with an email service
    console.log(`EMAIL ALERT: ${alertConfig.name}`, {
      to: emailConfig.recipients,
      subject: `[${errorReport.severity.toUpperCase()}] ${alertConfig.name}`,
      body: `Error: ${errorReport.error.message}\nOccurrences: ${errorReport.occurrences}\nComponent: ${errorReport.context.component}`
    })
  }

  private async sendSlackAlert(slackConfig: AlertConfig['actions']['slack'], alertConfig: AlertConfig, errorReport: ErrorReport) {
    // In production, this would send to a Slack webhook
    console.log(`SLACK ALERT: ${alertConfig.name}`, {
      channel: slackConfig.channel,
      message: `🚨 ${alertConfig.name}: ${errorReport.error.message} (${errorReport.occurrences} occurrences)`
    })
  }

  private async sendPagerDutyAlert(pagerdutyConfig: AlertConfig['actions']['pagerduty'], alertConfig: AlertConfig, errorReport: ErrorReport) {
    // In production, this would integrate with PagerDuty API
    console.log(`PAGERDUTY ALERT: ${alertConfig.name}`, {
      severity: pagerdutyConfig.severity,
      message: `${alertConfig.name}: ${errorReport.error.message}`,
      details: {
        errorId: errorReport.id,
        occurrences: errorReport.occurrences,
        component: errorReport.context.component
      }
    })
  }

  private async executeFeatureFlagAction(featureFlagConfig: AlertConfig['actions']['featureFlag'], errorReport: ErrorReport) {
    if (featureFlagConfig.action === 'disable') {
      featureFlags.emergencyDisable(featureFlagConfig.flagName as any)
      console.warn(`EMERGENCY: Feature flag ${featureFlagConfig.flagName} disabled due to critical errors`)
    }
  }

  private generateFingerprint(error: Error, context: ErrorContext): string {
    const key = `${error.name}:${error.message}:${context.component || 'unknown'}:${context.action || 'unknown'}`
    return this.simpleHash(key)
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getHigherSeverity(current: ErrorReport['severity'], newSeverity: ErrorReport['severity']): ErrorReport['severity'] {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 }
    return severityLevels[newSeverity] > severityLevels[current] ? newSeverity : current
  }

  private determineGrouping(error: Error, category: string): string {
    // Group similar errors together
    if (error.name === 'TypeError') return 'type-errors'
    if (error.name === 'NetworkError') return 'network-errors'
    if (category === 'database') return 'database-issues'
    if (category === 'calculation') return 'calculation-errors'
    return 'general-errors'
  }

  private generateTags(error: Error, context: ErrorContext, category: string): string[] {
    const tags = [category, error.name]

    if (context.component) tags.push(`component:${context.component}`)
    if (context.action) tags.push(`action:${context.action}`)
    if (process.env.NODE_ENV) tags.push(`env:${process.env.NODE_ENV}`)

    return tags
  }

  // Public methods for error management
  getErrorReport(id: string): ErrorReport | undefined {
    for (const report of this.errorReports.values()) {
      if (report.id === id) return report
    }
    return undefined
  }

  getAllErrors(limit: number = 100): ErrorReport[] {
    return Array.from(this.errorReports.values())
      .sort((a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime())
      .slice(0, limit)
  }

  getErrorsByCategory(category: string, limit: number = 50): ErrorReport[] {
    return Array.from(this.errorReports.values())
      .filter(report => report.category === category)
      .sort((a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime())
      .slice(0, limit)
  }

  resolveError(id: string): boolean {
    for (const [fingerprint, report] of this.errorReports.entries()) {
      if (report.id === id) {
        report.resolved = true
        return true
      }
    }
    return false
  }

  getErrorStats() {
    const reports = Array.from(this.errorReports.values())
    const total = reports.length
    const resolved = reports.filter(r => r.resolved).length
    const unresolved = total - resolved

    const bySeverity = reports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byCategory = reports.reduce((acc, report) => {
      acc[report.category] = (acc[report.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalOccurrences = reports.reduce((sum, report) => sum + report.occurrences, 0)
    const uniqueUsersAffected = new Set(reports.flatMap(r => r.affectedUsers)).size

    return {
      total,
      resolved,
      unresolved,
      bySeverity,
      byCategory,
      totalOccurrences,
      uniqueUsersAffected,
      alertsConfigured: this.alertConfigs.size,
      alertsTriggeredToday: Array.from(this.alertConfigs.values())
        .filter(config => config.lastTriggered)
        .filter(config => {
          const today = new Date().toDateString()
          const lastTriggered = new Date(config.lastTriggered!).toDateString()
          return today === lastTriggered
        }).length
    }
  }

  // Emergency controls
  emergencyDisableAllAlerts() {
    for (const [alertId, config] of this.alertConfigs.entries()) {
      config.enabled = false
    }
    console.warn('EMERGENCY: All alerts have been disabled')
  }

  emergencyResolveAllErrors() {
    for (const report of this.errorReports.values()) {
      report.resolved = true
    }
    console.warn('EMERGENCY: All errors have been marked as resolved')
  }
}

// Export singleton instance
export const errorTracking = ErrorTrackingService.getInstance()

// Convenience functions
export function trackError(
  error: Error | string,
  context?: ErrorContext,
  severity?: ErrorReport['severity'],
  category?: ErrorReport['category']
): string {
  return errorTracking.trackError(error, context, severity, category)
}

// React Error Boundary integration
export function trackReactError(error: Error, errorInfo: any, componentStack: string) {
  return trackError(error, {
    component: 'React',
    action: 'render',
    additionalData: {
      componentStack,
      errorInfo
    }
  }, 'high', 'ui')
}

// API Error tracking
export function trackApiError(error: Error | string, endpoint: string, method: string, userId?: string) {
  return trackError(error, {
    component: 'API',
    action: `${method} ${endpoint}`,
    userId,
    additionalData: {
      endpoint,
      method
    }
  }, 'medium', 'network')
}

// Database Error tracking
export function trackDatabaseError(error: Error | string, query: string, table?: string) {
  return trackError(error, {
    component: 'Database',
    action: 'query',
    additionalData: {
      query: query.substring(0, 200), // Limit query length
      table
    }
  }, 'high', 'database')
}

// Rating Calculation Error tracking
export function trackRatingCalculationError(error: Error | string, employerId?: string, calculationType?: string) {
  return trackError(error, {
    component: 'RatingEngine',
    action: calculationType || 'calculate',
    employerId,
    additionalData: {
      calculationType
    }
  }, 'high', 'calculation')
}