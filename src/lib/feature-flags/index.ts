/**
 * Feature flags for safe deployment of rating system
 * Allows controlled rollout and quick rollback if issues arise
 */

export interface FeatureFlagConfig {
  enabled: boolean
  rolloutPercentage?: number
  allowedRoles?: string[]
  allowedUsers?: string[]
  environment?: string[]
  metadata?: Record<string, any>
}

export interface FeatureFlags {
  // Rating system core features
  RATING_SYSTEM_ENABLED: FeatureFlagConfig
  RATING_DASHBOARD_ENABLED: FeatureFlagConfig
  RATING_WIZARD_ENABLED: FeatureFlagConfig
  RATING_COMPARISON_ENABLED: FeatureFlagConfig

  // Mobile-specific features
  MOBILE_RATINGS_ENABLED: FeatureFlagConfig
  MOBILE_OPTIMIZATIONS_ENABLED: FeatureFlagConfig

  // Advanced features
  RATING_ANALYTICS_ENABLED: FeatureFlagConfig
  RATING_EXPORT_ENABLED: FeatureFlagConfig
  RATING_BATCH_OPERATIONS_ENABLED: FeatureFlagConfig

  // System features
  ENHANCED_ERROR_TRACKING: FeatureFlagConfig
  PERFORMANCE_MONITORING: FeatureFlagConfig
  DETAILED_LOGGING: FeatureFlagConfig
}

// Default feature flag configuration
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  RATING_SYSTEM_ENABLED: {
    enabled: process.env.RATING_SYSTEM_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_SYSTEM_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_SYSTEM_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Core rating system functionality',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_DASHBOARD_ENABLED: {
    enabled: process.env.RATING_DASHBOARD_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_DASHBOARD_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_DASHBOARD_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Rating dashboard and analytics',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_WIZARD_ENABLED: {
    enabled: process.env.RATING_WIZARD_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_WIZARD_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_WIZARD_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Rating wizard for assessments',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_COMPARISON_ENABLED: {
    enabled: process.env.RATING_COMPARISON_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_COMPARISON_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_COMPARISON_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Employer rating comparison features',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  MOBILE_RATINGS_ENABLED: {
    enabled: process.env.MOBILE_RATINGS_ENABLED === 'true',
    rolloutPercentage: process.env.MOBILE_RATINGS_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.MOBILE_RATINGS_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Mobile-optimized rating interface',
      owner: 'mobile-team',
      lastUpdated: new Date().toISOString()
    }
  },

  MOBILE_OPTIMIZATIONS_ENABLED: {
    enabled: process.env.MOBILE_OPTIMIZATIONS_ENABLED === 'true',
    rolloutPercentage: process.env.MOBILE_OPTIMIZATIONS_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.MOBILE_OPTIMIZATIONS_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser', 'organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Mobile performance optimizations',
      owner: 'mobile-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_ANALYTICS_ENABLED: {
    enabled: process.env.RATING_ANALYTICS_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_ANALYTICS_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_ANALYTICS_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Advanced rating analytics and trends',
      owner: 'analytics-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_EXPORT_ENABLED: {
    enabled: process.env.RATING_EXPORT_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_EXPORT_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_EXPORT_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin', 'lead_organiser'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Rating data export functionality',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  RATING_BATCH_OPERATIONS_ENABLED: {
    enabled: process.env.RATING_BATCH_OPERATIONS_ENABLED === 'true',
    rolloutPercentage: process.env.RATING_BATCH_OPERATIONS_ROLLOUT_PERCENTAGE
      ? parseInt(process.env.RATING_BATCH_OPERATIONS_ROLLOUT_PERCENTAGE)
      : 100,
    allowedRoles: ['admin'],
    environment: ['production', 'staging', 'development'],
    metadata: {
      description: 'Batch rating operations and maintenance',
      owner: 'rating-system-team',
      lastUpdated: new Date().toISOString()
    }
  },

  ENHANCED_ERROR_TRACKING: {
    enabled: process.env.ENHANCED_ERROR_TRACKING_ENABLED === 'true',
    environment: ['production', 'staging'],
    metadata: {
      description: 'Enhanced error tracking and reporting',
      owner: 'platform-team',
      lastUpdated: new Date().toISOString()
    }
  },

  PERFORMANCE_MONITORING: {
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED === 'true',
    environment: ['production', 'staging'],
    metadata: {
      description: 'Performance monitoring and metrics',
      owner: 'platform-team',
      lastUpdated: new Date().toISOString()
    }
  },

  DETAILED_LOGGING: {
    enabled: process.env.DETAILED_LOGGING_ENABLED === 'true',
    environment: ['development', 'staging'],
    metadata: {
      description: 'Detailed logging for debugging',
      owner: 'platform-team',
      lastUpdated: new Date().toISOString()
    }
  }
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager
  private flags: FeatureFlags
  private userContext?: {
    userId: string
    role: string
    environment: string
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager()
    }
    return FeatureFlagManager.instance
  }

  constructor() {
    this.flags = { ...DEFAULT_FEATURE_FLAGS }
    this.loadFlagsFromEnvironment()
  }

  private loadFlagsFromEnvironment() {
    // Load any overrides from environment variables or remote config
    try {
      const envFlags = process.env.FEATURE_FLAGS_OVERRIDES
      if (envFlags) {
        const overrides = JSON.parse(envFlags)
        this.flags = { ...this.flags, ...overrides }
      }
    } catch (error) {
      console.warn('Failed to load feature flag overrides:', error)
    }
  }

  setUserContext(context: { userId: string; role: string; environment: string }) {
    this.userContext = context
  }

  private isInEnvironment(flag: FeatureFlagConfig): boolean {
    if (!flag.environment || flag.environment.length === 0) {
      return true
    }

    const currentEnv = process.env.NODE_ENV || 'development'
    return flag.environment.includes(currentEnv)
  }

  private hasAllowedRole(flag: FeatureFlagConfig): boolean {
    if (!flag.allowedRoles || flag.allowedRoles.length === 0) {
      return true
    }

    return this.userContext ? flag.allowedRoles.includes(this.userContext.role) : false
  }

  private hasAllowedUser(flag: FeatureFlagConfig): boolean {
    if (!flag.allowedUsers || flag.allowedUsers.length === 0) {
      return true
    }

    return this.userContext ? flag.allowedUsers.includes(this.userContext.userId) : false
  }

  private isInRolloutPercentage(flag: FeatureFlagConfig): boolean {
    if (!flag.rolloutPercentage || flag.rolloutPercentage >= 100) {
      return true
    }

    if (!this.userContext) {
      return false
    }

    // Use consistent hash based on userId for rollout
    const hash = this.hashCode(this.userContext.userId)
    const bucket = Math.abs(hash) % 100
    return bucket < flag.rolloutPercentage
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }

  isEnabled(flagName: keyof FeatureFlags): boolean {
    const flag = this.flags[flagName]

    if (!flag.enabled) {
      return false
    }

    if (!this.isInEnvironment(flag)) {
      return false
    }

    if (!this.hasAllowedRole(flag)) {
      return false
    }

    if (!this.hasAllowedUser(flag)) {
      return false
    }

    return this.isInRolloutPercentage(flag)
  }

  getFlag(flagName: keyof FeatureFlags): FeatureFlagConfig | null {
    return this.flags[flagName] || null
  }

  getAllFlags(): Partial<FeatureFlags> {
    return this.flags
  }

  updateFlag(flagName: keyof FeatureFlags, config: Partial<FeatureFlagConfig>): void {
    if (this.flags[flagName]) {
      this.flags[flagName] = { ...this.flags[flagName], ...config }
    }
  }

  // Safety method for emergency disable
  emergencyDisable(flagName: keyof FeatureFlags): void {
    if (this.flags[flagName]) {
      this.flags[flagName].enabled = false
      console.warn(`EMERGENCY: Feature flag ${flagName} has been disabled`)
    }
  }

  // Get status for monitoring
  getSystemStatus(): {
    totalFlags: number
    enabledFlags: number
    disabledFlags: number
    environment: string
    lastUpdated: string
  } {
    const flags = Object.entries(this.flags)
    const enabled = flags.filter(([_, flag]) => flag.enabled).length

    return {
      totalFlags: flags.length,
      enabledFlags: enabled,
      disabledFlags: flags.length - enabled,
      environment: process.env.NODE_ENV || 'development',
      lastUpdated: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance()

// Convenience hooks for React components
export function useFeatureFlag(flagName: keyof FeatureFlags): boolean {
  // This would be used in React components with Auth context
  // For now, return the basic enabled state
  return featureFlags.isEnabled(flagName)
}

export function useFeatureFlags(): {
  isEnabled: (flagName: keyof FeatureFlags) => boolean
  getAllFlags: () => Partial<FeatureFlags>
  systemStatus: ReturnType<FeatureFlagManager['getSystemStatus']>
} {
  return {
    isEnabled: (flagName: keyof FeatureFlags) => featureFlags.isEnabled(flagName),
    getAllFlags: () => featureFlags.getAllFlags(),
    systemStatus: featureFlags.getSystemStatus()
  }
}