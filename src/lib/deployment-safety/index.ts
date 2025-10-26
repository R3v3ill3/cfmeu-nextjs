/**
 * Deployment safety procedures and rollback mechanisms
 * Provides controlled deployment with automatic rollback capabilities
 */

import { featureFlags } from '../feature-flags'
import { monitoring } from '../monitoring'
import { errorTracking } from '../error-tracking'

export interface DeploymentConfig {
  id: string
  version: string
  timestamp: string
  environment: string
  strategy: 'blue-green' | 'canary' | 'rolling' | 'immediate'
  rolloutPercentage: number
  healthCheckUrl: string
  rollbackThresholds: {
    errorRate: number // percentage
    responseTime: number // milliseconds
    failedHealthChecks: number
    userComplaints: number
  }
  monitoringWindow: number // minutes
  autoRollback: boolean
  notifications: {
    email: string[]
    slack: string[]
  }
}

export interface DeploymentStatus {
  deploymentId: string
  status: 'pending' | 'in-progress' | 'success' | 'failed' | 'rolling-back' | 'rolled-back'
  startTime: string
  endTime?: string
  currentStep: string
  progress: number // 0-100
  metrics: {
    errorRate: number
    responseTime: number
    healthCheckStatus: 'passing' | 'warning' | 'failing'
    userFeedback: number
  }
  issues: DeploymentIssue[]
  rollbackAvailable: boolean
}

export interface DeploymentIssue {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'health-check' | 'performance' | 'error-rate' | 'user-feedback' | 'feature-flag'
  title: string
  description: string
  timestamp: string
  resolved: boolean
  automaticRollbackTriggered: boolean
}

export class DeploymentSafetyService {
  private static instance: DeploymentSafetyService
  private activeDeployments: Map<string, DeploymentStatus> = new Map()
  private deploymentHistory: DeploymentStatus[] = []
  private rollbackStack: DeploymentConfig[] = []
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map()

  static getInstance(): DeploymentSafetyService {
    if (!DeploymentSafetyService.instance) {
      DeploymentSafetyService.instance = new DeploymentSafetyService()
    }
    return DeploymentSafetyService.instance
  }

  async initiateDeployment(config: DeploymentConfig): Promise<string> {
    const deploymentId = this.generateDeploymentId()

    console.log(`🚀 Initiating deployment: ${deploymentId}`, {
      version: config.version,
      strategy: config.strategy,
      rolloutPercentage: config.rolloutPercentage
    })

    // Create deployment status
    const status: DeploymentStatus = {
      deploymentId,
      status: 'pending',
      startTime: new Date().toISOString(),
      currentStep: 'pre-deployment checks',
      progress: 0,
      metrics: {
        errorRate: 0,
        responseTime: 0,
        healthCheckStatus: 'passing',
        userFeedback: 0
      },
      issues: [],
      rollbackAvailable: true
    }

    this.activeDeployments.set(deploymentId, status)

    try {
      // Pre-deployment safety checks
      await this.performPreDeploymentChecks(config, status)

      // Based on strategy, execute deployment
      switch (config.strategy) {
        case 'blue-green':
          await this.executeBlueGreenDeployment(config, status)
          break
        case 'canary':
          await this.executeCanaryDeployment(config, status)
          break
        case 'rolling':
          await this.executeRollingDeployment(config, status)
          break
        case 'immediate':
          await this.executeImmediateDeployment(config, status)
          break
        default:
          throw new Error(`Unknown deployment strategy: ${config.strategy}`)
      }

      // Deployment completed successfully
      status.status = 'success'
      status.endTime = new Date().toISOString()
      status.progress = 100
      status.currentStep = 'deployment completed'

      console.log(`✅ Deployment completed successfully: ${deploymentId}`)
      this.sendNotification(config, 'success', status)

      // Move to history
      this.deploymentHistory.push(status)
      this.activeDeployments.delete(deploymentId)

      return deploymentId

    } catch (error) {
      // Deployment failed
      status.status = 'failed'
      status.endTime = new Date().toISOString()
      status.currentStep = 'deployment failed'

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      status.issues.push({
        id: this.generateId(),
        severity: 'critical',
        type: 'health-check',
        title: 'Deployment Failed',
        description: errorMessage,
        timestamp: new Date().toISOString(),
        resolved: false,
        automaticRollbackTriggered: false
      })

      console.error(`❌ Deployment failed: ${deploymentId}`, error)
      this.sendNotification(config, 'failed', status)

      // Auto-rollback if enabled
      if (config.autoRollback) {
        await this.initiateRollback(deploymentId, 'Deployment failed')
      }

      return deploymentId
    }
  }

  private async performPreDeploymentChecks(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'pre-deployment checks'
    status.progress = 10

    // Check if critical feature flags are properly configured
    const criticalFlags = [
      'RATING_SYSTEM_ENABLED',
      'RATING_DASHBOARD_ENABLED',
      'RATING_WIZARD_ENABLED'
    ]

    for (const flagName of criticalFlags) {
      const flag = featureFlags.getFlag(flagName as any)
      if (!flag) {
        throw new Error(`Critical feature flag ${flagName} is not configured`)
      }
    }

    // Check system health
    const healthResult = await monitoring.runHealthChecks()
    if (healthResult.status === 'unhealthy') {
      throw new Error('System health checks failed - cannot proceed with deployment')
    }

    // Check error rates
    const errorStats = errorTracking.getErrorStats()
    if (errorStats.totalOccurrences > 100) {
      status.issues.push({
        id: this.generateId(),
        severity: 'medium',
        type: 'error-rate',
        title: 'High Error Rate Before Deployment',
        description: `${errorStats.totalOccurrences} errors detected before deployment`,
        timestamp: new Date().toISOString(),
        resolved: false,
        automaticRollbackTriggered: false
      })
    }

    status.progress = 25
  }

  private async executeBlueGreenDeployment(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'blue-green deployment'
    status.progress = 30

    console.log(`🔄 Executing blue-green deployment for ${config.version}`)

    // In a real blue-green deployment, this would:
    // 1. Deploy to green environment
    // 2. Run health checks on green
    // 3. Switch traffic from blue to green
    // 4. Keep blue as rollback target

    status.progress = 60
    status.currentStep = 'switching traffic'

    // Simulate traffic switch
    await this.sleep(2000)

    status.progress = 90
    status.currentStep = 'validating deployment'

    // Validate deployment
    await this.validateDeployment(config, status)

    // Store rollback configuration
    this.rollbackStack.push(config)
    if (this.rollbackStack.length > 5) {
      this.rollbackStack.shift()
    }
  }

  private async executeCanaryDeployment(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'canary deployment'
    status.progress = 30

    console.log(`🐤 Executing canary deployment for ${config.version} (${config.rolloutPercentage}%)`)

    // Start with small percentage and gradually increase
    const increments = [5, 10, 25, 50, 75, 100]
    const targetPercentage = config.rolloutPercentage

    for (const percentage of increments) {
      if (percentage > targetPercentage) break

      status.currentStep = `canary rollout: ${percentage}%`
      status.progress = 30 + (percentage / targetPercentage) * 60

      console.log(`📈 Rolling out to ${percentage}% of traffic`)

      // Apply canary percentage
      await this.applyCanaryPercentage(percentage)

      // Monitor for issues
      await this.monitorDeployment(config, status, 5) // 5 minutes monitoring

      // Check if rollback is needed
      if (this.shouldRollback(config, status)) {
        throw new Error(`Canary deployment at ${percentage}% triggered rollback conditions`)
      }
    }

    // Full deployment successful
    status.progress = 90
    status.currentStep = 'validating canary deployment'

    await this.validateDeployment(config, status)

    // Store rollback configuration
    this.rollbackStack.push(config)
  }

  private async executeRollingDeployment(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'rolling deployment'
    status.progress = 30

    console.log(`🔄 Executing rolling deployment for ${config.version}`)

    // Simulate rolling update
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      status.currentStep = `rolling update: step ${i}/${steps}`
      status.progress = 30 + (i / steps) * 60

      console.log(`📦 Rolling update step ${i}/${steps}`)

      // Simulate rolling step
      await this.sleep(1000)

      // Monitor health
      const healthResult = await monitoring.runHealthChecks()
      if (healthResult.status === 'unhealthy') {
        throw new Error(`Rolling deployment failed at step ${i} - system unhealthy`)
      }
    }

    status.progress = 90
    status.currentStep = 'validating rolling deployment'

    await this.validateDeployment(config, status)

    // Store rollback configuration
    this.rollbackStack.push(config)
  }

  private async executeImmediateDeployment(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'immediate deployment'
    status.progress = 30

    console.log(`⚡ Executing immediate deployment for ${config.version}`)

    // For immediate deployment, we still need some safety checks
    status.progress = 60
    status.currentStep = 'validating immediate deployment'

    await this.validateDeployment(config, status)

    // Store rollback configuration
    this.rollbackStack.push(config)
  }

  private async applyCanaryPercentage(percentage: number) {
    // In a real implementation, this would configure load balancer or feature flags
    // to route the specified percentage of traffic to the new version

    // For now, simulate the canary percentage
    await this.sleep(1000)

    console.log(`🎯 Applied ${percentage}% canary traffic`)
  }

  private async validateDeployment(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'running health checks'
    status.progress = 95

    // Run comprehensive health checks
    const healthResult = await monitoring.runHealthChecks()

    if (healthResult.status === 'unhealthy') {
      throw new Error('Deployment validation failed - system unhealthy')
    }

    if (healthResult.status === 'degraded') {
      status.issues.push({
        id: this.generateId(),
        severity: 'medium',
        type: 'health-check',
        title: 'System Health Degraded',
        description: 'Health checks show warnings after deployment',
        timestamp: new Date().toISOString(),
        resolved: false,
        automaticRollbackTriggered: false
      })
    }

    // Check rating system specifically
    const ratingHealth = await this.checkRatingSystemHealth()
    if (!ratingHealth) {
      throw new Error('Rating system health check failed')
    }

    console.log(`✅ Deployment validation passed`)
  }

  private async monitorDeployment(config: DeploymentConfig, status: DeploymentStatus, durationMinutes: number) {
    const startTime = Date.now()
    const durationMs = durationMinutes * 60 * 1000

    console.log(`👀 Monitoring deployment for ${durationMinutes} minutes`)

    while (Date.now() - startTime < durationMs) {
      await this.sleep(30000) // Check every 30 seconds

      // Update metrics
      const systemMetrics = await monitoring.getSystemMetrics()
      status.metrics.errorRate = systemMetrics.api.errorRate
      status.metrics.responseTime = systemMetrics.api.averageResponseTime

      // Check if rollback conditions are met
      if (this.shouldRollback(config, status)) {
        throw new Error('Deployment monitoring triggered rollback conditions')
      }
    }
  }

  private shouldRollback(config: DeploymentConfig, status: DeploymentStatus): boolean {
    const { thresholds } = config

    // Check error rate
    if (status.metrics.errorRate > thresholds.errorRate) {
      status.issues.push({
        id: this.generateId(),
        severity: 'high',
        type: 'error-rate',
        title: 'Error Rate Threshold Exceeded',
        description: `Error rate ${status.metrics.errorRate}% exceeds threshold ${thresholds.errorRate}%`,
        timestamp: new Date().toISOString(),
        resolved: false,
        automaticRollbackTriggered: true
      })
      return true
    }

    // Check response time
    if (status.metrics.responseTime > thresholds.responseTime) {
      status.issues.push({
        id: this.generateId(),
        severity: 'high',
        type: 'performance',
        title: 'Response Time Threshold Exceeded',
        description: `Response time ${status.metrics.responseTime}ms exceeds threshold ${thresholds.responseTime}ms`,
        timestamp: new Date().toISOString(),
        resolved: false,
        automaticRollbackTriggered: true
      })
      return true
    }

    return false
  }

  private async checkRatingSystemHealth(): Promise<boolean> {
    try {
      // Simulate rating system health check
      await this.sleep(500)
      return true
    } catch (error) {
      console.error('Rating system health check failed:', error)
      return false
    }
  }

  async initiateRollback(deploymentId: string, reason: string): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId)
    if (!deployment) {
      console.error(`Deployment ${deploymentId} not found for rollback`)
      return false
    }

    console.log(`🔄 Initiating rollback for deployment ${deploymentId}: ${reason}`)

    deployment.status = 'rolling-back'
    deployment.currentStep = 'rolling back deployment'

    try {
      // Get rollback configuration
      const rollbackConfig = this.rollbackStack[this.rollbackStack.length - 2] // Previous version
      if (!rollbackConfig) {
        throw new Error('No rollback configuration available')
      }

      // Execute rollback
      await this.executeRollback(rollbackConfig, deployment)

      deployment.status = 'rolled-back'
      deployment.endTime = new Date().toISOString()
      deployment.currentStep = 'rollback completed'

      console.log(`✅ Rollback completed for deployment ${deploymentId}`)

      // Move to history
      this.deploymentHistory.push(deployment)
      this.activeDeployments.delete(deploymentId)

      return true

    } catch (error) {
      console.error(`❌ Rollback failed for deployment ${deploymentId}:`, error)
      deployment.currentStep = 'rollback failed'
      return false
    }
  }

  private async executeRollback(config: DeploymentConfig, status: DeploymentStatus) {
    status.currentStep = 'restoring previous version'
    status.progress = 25

    // In a real rollback, this would:
    // 1. Restore previous version
    // 2. Switch traffic back
    // 3. Validate rollback
    // 4. Clean up new version

    await this.sleep(2000) // Simulate rollback time

    status.progress = 75
    status.currentStep = 'validating rollback'

    // Validate rollback
    const healthResult = await monitoring.runHealthChecks()
    if (healthResult.status === 'unhealthy') {
      throw new Error('Rollback validation failed - system still unhealthy')
    }

    status.progress = 100
  }

  async emergencyShutdown(reason: string): Promise<void> {
    console.error(`🚨 EMERGENCY SHUTDOWN: ${reason}`)

    // Disable all critical feature flags
    const criticalFlags = [
      'RATING_SYSTEM_ENABLED',
      'RATING_DASHBOARD_ENABLED',
      'RATING_WIZARD_ENABLED',
      'MOBILE_RATINGS_ENABLED'
    ]

    for (const flagName of criticalFlags) {
      featureFlags.emergencyDisable(flagName as any)
    }

    // Cancel all active deployments
    for (const [deploymentId, deployment] of this.activeDeployments.entries()) {
      deployment.status = 'failed'
      deployment.endTime = new Date().toISOString()
      deployment.currentStep = 'emergency shutdown'

      this.deploymentHistory.push(deployment)
    }

    this.activeDeployments.clear()

    // Clear monitoring intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval)
    }
    this.healthCheckIntervals.clear()

    // Trigger emergency alerts
    monitoring.emergencyShutdown(reason)

    console.log(`✅ Emergency shutdown completed`)
  }

  getDeploymentStatus(deploymentId: string): DeploymentStatus | undefined {
    return this.activeDeployments.get(deploymentId)
  }

  getAllActiveDeployments(): DeploymentStatus[] {
    return Array.from(this.activeDeployments.values())
  }

  getDeploymentHistory(limit: number = 50): DeploymentStatus[] {
    return this.deploymentHistory
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit)
  }

  getSystemStatus(): {
    activeDeployments: number
    recentDeployments: number
    rollbackAvailable: boolean
    lastDeployment: string | null
    systemHealth: 'healthy' | 'degraded' | 'unhealthy'
  } {
    const recentDeployments = this.deploymentHistory.filter(
      d => new Date(d.startTime || '').getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length

    return {
      activeDeployments: this.activeDeployments.size,
      recentDeployments,
      rollbackAvailable: this.rollbackStack.length > 1,
      lastDeployment: this.deploymentHistory[0]?.deploymentId || null,
      systemHealth: this.activeDeployments.size > 0 ? 'degraded' : 'healthy'
    }
  }

  private generateDeploymentId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private sendNotification(config: DeploymentConfig, type: 'success' | 'failed', status: DeploymentStatus) {
    // In production, this would send actual notifications
    console.log(`📧 DEPLOYMENT ${type.toUpperCase()}:`, {
      deploymentId: status.deploymentId,
      version: config.version,
      environment: config.environment,
      duration: status.endTime ?
        new Date(status.endTime).getTime() - new Date(status.startTime).getTime() :
        Date.now() - new Date(status.startTime).getTime(),
      issues: status.issues.length
    })
  }
}

// Export singleton instance
export const deploymentSafety = DeploymentSafetyService.getInstance()

// Convenience functions
export async function initiateDeployment(config: Partial<DeploymentConfig>): Promise<string> {
  const fullConfig: DeploymentConfig = {
    id: '',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    strategy: 'canary',
    rolloutPercentage: 10,
    healthCheckUrl: '/api/health',
    rollbackThresholds: {
      errorRate: 5,
      responseTime: 1000,
      failedHealthChecks: 3,
      userComplaints: 10
    },
    monitoringWindow: 15,
    autoRollback: true,
    notifications: {
      email: ['devops@cfmeu.org'],
      slack: ['#deployments']
    },
    ...config
  }

  return deploymentSafety.initiateDeployment(fullConfig)
}

export async function initiateRollback(deploymentId: string, reason: string): Promise<boolean> {
  return deploymentSafety.initiateRollback(deploymentId, reason)
}

export async function emergencyShutdown(reason: string): Promise<void> {
  return deploymentSafety.emergencyShutdown(reason)
}