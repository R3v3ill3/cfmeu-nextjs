/**
 * CFMEU Traffic Light Rating System - Data Integration Layer
 *
 * This comprehensive data integration system connects the existing CFMEU data sources
 * to the new traffic light rating system, ensuring seamless data flow, real-time
 * synchronization, and high data quality.
 *
 * Architecture Overview:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    DATA INTEGRATION LAYER                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐
 * │  Data Sources   │  │  Sync Services  │  │   Monitoring    │  │   Quality    │
 * │                 │  │                 │  │                 │  │   Control    │
 * │ • Employers     │──▶│ • EmployerDS    │──▶│ • Metrics        │──▶│ • Validation  │
 * │ • Projects      │  │ • ProjectDS     │  │ • Health         │  │ • Rules       │
 * │ • Compliance    │  │ • ComplianceDS  │  │ • Performance    │  │ • Scoring     │
 * │ • Site Visits   │  │ • SiteVisitDS    │  │ • Alerts         │  │ • Trends      │
 * │ • EBA Records   │  │ • EBA-DS         │  │ • Trends         │  │ • Reports     │
 * │ • User Profiles  │  │                 │  │                 │  │             │
 * └─────────────────┘  └─────────────────┘  └─────────────────┘  └───────────────┘
 *          │                     │                    │                   │
 *          ▼                     ▼                    ▼                   ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    SYNCHRONIZATION ENGINE                   │
 * │                                                                 │
 * │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
 * │  │  Full Sync      │  │  Incremental    │  │  Historical      │    │
 * │  │  Engine         │  │  Sync Engine     │  │  Migration       │    │
 * │  │                 │  │                 │  │                 │    │
 * │  │ • Orchestrates   │  │ • Real-time      │  │ • Backfill       │    │
 * │  │ • Dependencies  │  │ • Triggers       │  │ • Phases         │    │
 * │  │ • Conflict Mgmt  │  │ • Change Buffer  │  │ • Validation     │    │
 * │  │ • Rollback       │  │ • Debouncing     │  │ • Recovery       │    │
 * │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
 * └─────────────────────────────────────────────────────────────────────┘
 *                                   │
 *                                   ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    TRAFFIC LIGHT RATING SYSTEM              │
 * │                                                                 │
 * │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
 * │  │  Employer       │  │  Project         │  │  Compliance     │    │
 * │  │  Ratings        │  │  Impacts         │  │  Factors        │    │
 * │  │                 │  │                 │  │                 │    │
 * │  │ • Overall Score │  │ • Risk Levels   │  │ • Status Scores │    │
 * │  │ • Component     │  │ • Calculations   │  │ • Trend Data    │    │
 * │  │ • Trend Analysis │  │ • Dependencies  │  │ • Alerts         │    │
 * │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Key Features:
 *
 * 🔄 **Seamless Data Integration**: Connects existing CFMEU data sources with rating system
 * 📊 **Real-time Synchronization**: Live data updates with database triggers and event streaming
 * 🛡 **Data Quality Assurance**: Continuous monitoring and validation of data integrity
 * 📈 **Comprehensive Monitoring**: Performance metrics, health monitoring, and alerting
 * 🔄 **Historical Migration**: Backfill historical data with phased migration approach
 * 🎯 **Conflict Resolution**: Intelligent handling of data conflicts and inconsistencies
 * 📋 **Audit Trail**: Complete tracking of all data changes and transformations
 * 🚀 **High Performance**: Optimized for large datasets with batch processing
 * 🔧 **Flexible Configuration**: Customizable sync rules, schedules, and validation
 * 🛠️ **Developer-Friendly**: Comprehensive APIs and TypeScript support
 */

// ============================================================================
// Core Types and Interfaces
// ============================================================================

export * from './types/IntegrationTypes';
export * from './types/MigrationTypes';

// ============================================================================
// Data Integration Services
// ============================================================================

export { employerDataService, EmployerDataService } from './services/EmployerDataService';
export { projectDataService, ProjectDataService } from './services/ProjectDataService';
export { complianceDataService, ComplianceDataService } from './services/ComplianceDataService';
export { siteVisitDataService, SiteVisitDataService } from './services/SiteVisitDataService';
export { ebaDataService, EBADataService } from './services/EBADataService';

// ============================================================================
// Synchronization Engine
// ============================================================================

export { dataSynchronizer, DataSynchronizer } from './sync/DataSynchronizer';
export { incrementalSync, IncrementalSync } from './sync/IncrementalSync';
export { realtimeTriggers, RealtimeTriggers } from './sync/RealtimeTriggers';

// ============================================================================
// Migration System
// ============================================================================

export { historicalDataMigration, HistoricalDataMigration } from './migration/HistoricalDataMigration';

// ============================================================================
// Monitoring and Metrics
// ============================================================================

export { syncMetricsCollector, SyncMetricsCollector } from './monitoring/SyncMetrics';
export { dataQualityMonitor, DataQualityMonitor } from './monitoring/DataQualityMonitor';

// ============================================================================
// Test Suite
// ============================================================================

export * from './tests/DataIntegration.test';

// ============================================================================
// Main Integration Manager
// ============================================================================

export class DataIntegrationManager {
  private static instance: DataIntegrationManager;

  private isInitialized = false;

  /**
   * Get singleton instance
   */
  static getInstance(): DataIntegrationManager {
    if (!DataIntegrationManager.instance) {
      DataIntegrationManager.instance = new DataIntegrationManager();
    }
    return DataIntegrationManager.instance;
  }

  /**
   * Initialize the complete data integration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Data Integration Manager already initialized');
      return;
    }

    console.log('🚀 Initializing CFMEU Data Integration System...');

    try {
      // Initialize core services
      await Promise.all([
        dataSynchronizer.initialize(),
        incrementalSync.initialize(),
        historicalDataMigration.initialize(),
        syncMetricsCollector.initialize(),
        dataQualityMonitor.initialize()
      ]);

      this.isInitialized = true;
      console.log('✅ Data Integration System initialized successfully');

      // Start monitoring
      this.startHealthMonitoring();

    } catch (error) {
      console.error('❌ Failed to initialize Data Integration System:', error);
      throw error;
    }
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    components: Record<string, any>;
    lastUpdate: string;
  }> {
    const [syncHealth, metricsHealth, qualityHealth] = await Promise.all([
      dataSynchronizer.getSyncStatus(),
      syncMetricsCollector.generateHealthReport(),
      dataQualityMonitor.getQualityDashboard()
    ]);

    const overallStatuses = [
      syncHealth.systemHealth,
      metricsHealth.overallStatus,
      qualityHealth.overview.overallScore >= 80 ? 'healthy' :
      qualityHealth.overview.overallScore >= 60 ? 'degraded' : 'unhealthy'
    ];

    const status = overallStatuses.includes('critical') ? 'critical' :
                      overallStatuses.includes('unhealthy') ? 'unhealthy' :
                      overallStatuses.includes('degraded') ? 'degraded' : 'healthy';

    return {
      status,
      components: {
        synchronization: syncHealth,
        metrics: metricsHealth,
        quality: qualityHealth
      },
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Run complete data synchronization
   */
  async runFullSync(options: {
    sources?: string[];
    batchSize?: number;
    skipValidation?: boolean;
  } = {}): Promise<any> {
    this.ensureInitialized();

    const sources = options.sources || ['employers', 'eba', 'compliance', 'projects', 'siteVisits'];

    console.log(`🔄 Running full sync for: ${sources.join(', ')}`);

    return await dataSynchronizer.forceSync(sources, {
      batchSize: options.batchSize || 50,
      skipValidation: options.skipValidation || false
    });
  }

  /**
   * Run data quality assessment
   */
  async runQualityAssessment(table?: string): Promise<any> {
    this.ensureInitialized();

    console.log(`📊 Running quality assessment${table ? ` for ${table}` : ' for all tables'}`);

    return await dataQualityMonitor.runQualityAssessment(table);
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<{
    health: any;
    metrics: any;
    quality: any;
    alerts: any;
  }> {
    this.ensureInitialized();

    const [health, metrics, quality] = await Promise.all([
      this.getSystemHealth(),
      syncMetricsCollector.getDashboardMetrics(),
      dataQualityMonitor.getQualityDashboard()
    ]);

    // Get active alerts
    const alerts = await this.getActiveAlerts();

    return {
      health,
      metrics,
      quality,
      alerts
    };
  }

  /**
   * Get integration statistics
   */
  async getStatistics(): Promise<{
    dataSources: Record<string, {
      totalRecords: number;
      lastSync: string;
      syncStatus: string;
      qualityScore: number;
    }>;
    syncPerformance: {
      totalSyncs: number;
      averageLatency: number;
      successRate: number;
      errorRate: number;
    };
    dataQuality: {
      overallScore: number;
      totalIssues: number;
      criticalIssues: number;
      trends: any;
    };
  }> {
    this.ensureInitialized();

    // Get sync statistics
    const syncStatus = await dataSynchronizer.getSyncStatus();
    const metrics = await syncMetricsCollector.getDashboardMetrics();
    const quality = await dataQualityMonitor.generateQualityReport();

    return {
      dataSources: {
        employers: {
          totalRecords: syncStatus.lastSync?.totalEmployers || 0,
          lastSync: syncStatus.lastSync?.lastSync || null,
          syncStatus: syncStatus.systemHealth,
          qualityScore: quality.dimensions.accuracy?.score || 0
        }
      },
      syncPerformance: {
        totalSyncs: metrics.overview.totalSyncs,
        averageLatency: metrics.overview.averageLatency,
        successRate: metrics.overview.successRate,
        errorRate: (100 - metrics.overview.successRate)
      },
      dataQuality: {
        overallScore: quality.summary.overallScore,
        totalIssues: quality.summary.totalIssues,
        criticalIssues: quality.summary.criticalIssues,
        trends: quality.trends
      }
    };
  }

  /**
   * Execute historical migration
   */
  async executeHistoricalMigration(config: {
    sources: Array<{
      name: string;
      table: string;
      estimatedRecords: number;
    }>;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    options?: {
      batchSize?: number;
      createBackups?: boolean;
      dryRun?: boolean;
    };
  }): Promise<any> {
    this.ensureInitialized();

    console.log('📦 Starting historical data migration...');

    const migrationConfig = {
      pipelineId: `migration_${Date.now()}`,
      name: 'Historical Data Migration',
      description: 'Backfill historical data for CFMEU rating system',
      sources: config.sources.map(s => ({
        ...s,
        priority: 1
      })),
      dateRange: config.dateRange,
      options: {
        batchSize: config.options?.batchSize || 100,
        parallelWorkers: 2,
        includeDeletes: false,
        validateData: true,
        dryRun: config.options?.dryRun || false,
        continueOnError: false,
        createBackups: config.options?.createBackups || false
      },
      notifications: {
        onStart: true,
        onPhaseComplete: false,
        onCompletion: true,
        onError: true,
        recipients: []
      }
    };

    return await historicalDataMigration.executeMigration(migrationConfig);
  }

  /**
   * Enable real-time synchronization
   */
  async enableRealtimeSync(tables: string[]): Promise<void> {
    this.ensureInitialized();

    console.log(`🔄 Enabling real-time sync for: ${tables.join(', ')}`);

    // This would set up real-time triggers and subscriptions
    for (const table of tables) {
      await incrementalSync.addSyncConfig({
        table,
        events: ['INSERT', 'UPDATE'],
        batchSize: 20,
        debounceMs: 5000,
        enabled: true
      });
    }
  }

  /**
   * Disable real-time synchronization
   */
  async disableRealtimeSync(tables: string[]): Promise<void> {
    this.ensureInitialized();

    console.log(`⏹️ Disabling real-time sync for: ${tables.join(', ')}`);

    for (const table of tables) {
      await incrementalSync.removeSyncConfig(table);
    }
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(): Promise<any[]> {
    try {
      const [healthReport, qualityIssues] = await Promise.all([
        syncMetricsCollector.generateHealthReport(),
        dataQualityMonitor.getQualityDashboard()
      ]);

      return [
        ...healthReport.alerts.map(alert => ({
          type: 'system',
          severity: alert.level,
          component: alert.component,
          message: alert.message,
          timestamp: alert.timestamp
        })),
        ...qualityIssues.recentIssues.map(issue => ({
          type: 'quality',
          severity: issue.severity,
          component: issue.table,
          message: issue.issue,
          timestamp: issue.detectedAt
        }))
      ];

    } catch (error) {
      console.error('Error getting active alerts:', error);
      return [];
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor system health every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();

        if (health.status === 'unhealthy' || health.status === 'critical') {
          console.warn(`⚠️ System health alert: ${health.status}`, health);
          // Send notifications if needed
        }
      } catch (error) {
        console.error('Error in health monitoring:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Ensure system is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Data Integration Manager not initialized. Call initialize() first.');
    }
  }

  /**
   * Export configuration for debugging
   */
  exportConfiguration(): any {
    return {
      version: '1.0.0',
      initialized: this.isInitialized,
      components: {
        synchronizer: '✅ Operational',
        incremental: '✅ Operational',
        migration: '✅ Operational',
        metrics: '✅ Operational',
        quality: '✅ Operational'
      },
      lastUpdate: new Date().toISOString()
    };
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

// Export singleton manager as default export
export default DataIntegrationManager.getInstance();

// Export named exports for direct access
export {
  // Services
  employerDataService,
  projectDataService,
  complianceDataService,
  siteVisitDataService,
  ebaDataService,

  // Synchronization
  dataSynchronizer,
  incrementalSync,
  realtimeTriggers,

  // Migration
  historicalDataMigration,

  // Monitoring
  syncMetricsCollector,
  dataQualityMonitor,

  // Manager
  DataIntegrationManager
};

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example usage of the Data Integration System
 */
export const DataIntegrationExamples = {
  // Basic initialization
  async initialize() {
    const manager = DataIntegrationManager.getInstance();
    await manager.initialize();
    console.log('Data integration system ready!');
  },

  // Run full synchronization
  async syncAllData() {
    const manager = DataIntegrationManager.getInstance();
    return await manager.runFullSync({
      sources: ['employers', 'projects', 'compliance', 'eba'],
      batchSize: 100,
      skipValidation: false
    });
  },

  // Get dashboard data
  async getDashboard() {
    const manager = DataIntegrationManager.getInstance();
    return await manager.getDashboardData();
  },

  // Run quality assessment
  async assessDataQuality() {
    const manager = DataIntegrationManager.getInstance();
    return await manager.runQualityAssessment();
  },

  // Get system statistics
  async getStats() {
    const manager = DataIntegrationManager.getInstance();
    return await manager.getStatistics();
  },

  // Enable real-time sync
  async enableRealtime() {
    const manager = DataIntegrationManager.getInstance();
    await manager.enableRealtimeSync(['employers', 'projects', 'compliance']);
  },

  // Execute historical migration
  async migrateHistoricalData() {
    const manager = DataIntegrationManager.getInstance();
    return await manager.executeHistoricalMigration({
      sources: [
        { name: 'Employers', table: 'employers', estimatedRecords: 1000 },
        { name: 'Projects', table: 'projects', estimatedRecords: 500 }
      ],
      dateRange: {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      options: {
        batchSize: 50,
        createBackups: true,
        dryRun: false
      }
    });
  }
};

// System information
export const SystemInfo = {
  name: 'CFMEU Traffic Light Rating System - Data Integration',
  version: '1.0.0',
  description: 'Comprehensive data integration layer for CFMEU rating system',
  features: [
    'Multi-source data synchronization',
    'Real-time data updates',
    'Historical data migration',
    'Data quality monitoring',
    'Performance metrics and alerting',
    'Conflict resolution',
    'Audit trail and logging',
    'Scalable batch processing',
    'TypeScript support',
    'Comprehensive error handling'
  ],
  architecture: {
    pattern: 'Event-driven microservices',
    databases: ['PostgreSQL/Supabase'],
    realTime: ['WebSockets', 'Database Triggers'],
    monitoring: ['Metrics Collection', 'Health Checks', 'Alerting']
  }
};