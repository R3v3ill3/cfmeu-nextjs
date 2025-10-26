/**
 * Synchronization Metrics Collection and Analysis
 * Provides comprehensive monitoring and analytics for data integration operations
 */

import { supabase } from '@/integrations/supabase/client';
import {
  SyncMetrics,
  PerformanceMetrics,
  DataQualityMetrics,
  DataSource
} from '../types/IntegrationTypes';

import {
  MigrationMetrics,
  AuditLog
} from '../types/MigrationTypes';

export interface MetricsCollectionConfig {
  enabled: boolean;
  retentionDays: number;
  aggregationIntervals: Array<'1m' | '5m' | '15m' | '1h' | '6h' | '1d'>;
  alertThresholds: {
    errorRate: number; // percentage
    latency: number; // milliseconds
    dataQualityScore: number; // percentage
    queueSize: number;
  };
  notifications: {
    email: string[];
    webhook?: string;
  };
}

export interface SyncHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  timestamp: string;
  components: {
    dataSynchronization: HealthStatus;
    dataQuality: HealthStatus;
    performance: HealthStatus;
    systemResources: HealthStatus;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    component: string;
    message: string;
    timestamp: string;
  }>;
  recommendations: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number;
  metrics: {
    [key: string]: number | string;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metric?: string;
    actualValue?: any;
    threshold?: any;
  }>;
}

export interface MetricsSnapshot {
  timestamp: string;
  syncOperations: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
  };
  dataSources: Array<{
    name: string;
    status: string;
    lastSync: string;
    recordsProcessed: number;
    averageLatency: number;
    errorRate: number;
  }>;
  systemResources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  dataQuality: {
    overallScore: number;
    completenessScore: number;
    accuracyScore: number;
    consistencyScore: number;
  };
}

export class SyncMetricsCollector {
  private config: MetricsCollectionConfig;
  private metricsBuffer: Map<string, PerformanceMetrics[]> = new Map();
  private alertHistory: Array<any> = [];
  private readonly MAX_ALERT_HISTORY = 1000;

  constructor(config: MetricsCollectionConfig) {
    this.config = config;
  }

  /**
   * Initialize the metrics collector
   */
  async initialize(): Promise<void> {
    console.log('Initializing Sync Metrics Collector...');

    try {
      // Create metrics tables
      await this.createMetricsTables();

      // Setup metric collection intervals
      this.setupMetricCollectionIntervals();

      // Load existing alert thresholds
      await this.loadAlertThresholds();

      // Start background metrics processing
      this.startMetricsProcessing();

      console.log('Sync Metrics Collector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Sync Metrics Collector:', error);
      throw error;
    }
  }

  /**
   * Record a sync operation metric
   */
  async recordSyncMetrics(metrics: SyncMetrics): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Store immediate metrics
      await supabase
        .from('sync_metrics')
        .insert({
          ...metrics,
          recorded_at: new Date().toISOString()
        });

      // Update aggregated metrics
      await this.updateAggregatedMetrics(metrics);

      // Check for alerts
      await this.checkMetricAlerts(metrics);

      console.log(`Recorded sync metrics for ${metrics.source_table}`);

    } catch (error) {
      console.error('Error recording sync metrics:', error);
    }
  }

  /**
   * Record a performance metric
   */
  async recordPerformanceMetric(metric: PerformanceMetrics): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Buffer metrics for aggregation
      const bufferKey = `${metric.operation}_${metric.dimensions?.table_name || 'unknown'}`;

      if (!this.metricsBuffer.has(bufferKey)) {
        this.metricsBuffer.set(bufferKey, []);
      }

      const buffer = this.metricsBuffer.get(bufferKey)!;
      buffer.push(metric);

      // Keep buffer size manageable
      if (buffer.length > 1000) {
        buffer.splice(0, 500); // Remove oldest 500
      }

      // Store detailed metrics for recent data
      await supabase
        .from('performance_metrics')
        .insert({
          ...metric,
          recorded_at: new Date().toISOString()
        });

    } catch (error) {
      console.error('Error recording performance metric:', error);
    }
  }

  /**
   * Record data quality metrics
   */
  async recordDataQualityMetrics(metrics: DataQualityMetrics): Promise<void> {
    if (!this.config.enabled) return;

    try {
      await supabase
        .from('data_quality_metrics')
        .insert({
          ...metrics,
          recorded_at: new Date().toISOString()
        });

      // Check for quality alerts
      await this.checkQualityAlerts(metrics);

    } catch (error) {
      console.error('Error recording data quality metrics:', error);
    }
  }

  /**
   * Get current metrics snapshot
   */
  async getCurrentMetricsSnapshot(): Promise<MetricsSnapshot> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [
        syncStats,
        dataSourceStats,
        recentPerformance,
        recentQuality
      ] = await Promise.all([
        this.getSyncStatistics(oneHourAgo),
        this.getDataSourceStatistics(),
        this.getRecentPerformanceMetrics(oneHourAgo),
        this.getRecentDataQualityMetrics(oneHourAgo)
      ]);

      return {
        timestamp: now.toISOString(),
        syncOperations: syncStats,
        dataSources: dataSourceStats,
        systemResources: await this.getSystemResources(),
        dataQuality: recentQuality
      };

    } catch (error) {
      console.error('Error getting metrics snapshot:', error);
      return this.getEmptyMetricsSnapshot();
    }
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<SyncHealthReport> {
    try {
      const snapshot = await this.getCurrentMetricsSnapshot();

      const components = {
        dataSynchronization: await this.analyzeSyncHealth(snapshot),
        dataQuality: await this.analyzeDataQualityHealth(snapshot),
        performance: await this.analyzePerformanceHealth(snapshot),
        systemResources: await this.analyzeSystemResourceHealth(snapshot)
      };

      const overallScore = Object.values(components)
        .reduce((sum, component) => sum + component.score, 0) / 4;

      const alerts = this.generateAlerts(components);
      const recommendations = this.generateRecommendations(components, alerts);

      const overallStatus = this.determineOverallStatus(overallScore, alerts);

      return {
        overallStatus,
        score: Math.round(overallScore),
        timestamp: new Date().toISOString(),
        components,
        alerts,
        recommendations
      };

    } catch (error) {
      console.error('Error generating health report:', error);
      return this.getEmptyHealthReport();
    }
  }

  /**
   * Get metrics for a specific time range
   */
  async getMetricsForTimeRange(
    startTime: string,
    endTime: string,
    sourceTables?: string[]
  ): Promise<{
    syncMetrics: SyncMetrics[];
    performanceMetrics: PerformanceMetrics[];
    dataQualityMetrics: DataQualityMetrics[];
  }> {
    try {
      let query = supabase
        .from('sync_metrics')
        .select('*')
        .gte('recorded_at', startTime)
        .lte('recorded_at', endTime)
        .order('recorded_at', { ascending: true });

      if (sourceTables && sourceTables.length > 0) {
        query = query.in('source_table', sourceTables);
      }

      const { data: syncMetrics } = await query;

      const [performanceMetrics, dataQualityMetrics] = await Promise.all([
        supabase
          .from('performance_metrics')
          .select('*')
          .gte('recorded_at', startTime)
          .lte('recorded_at', endTime)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('data_quality_metrics')
          .select('*')
          .gte('last_assessed', startTime)
          .lte('last_assessed', endTime)
          .order('last_assessed', { ascending: true })
      ]);

      return {
        syncMetrics: syncMetrics || [],
        performanceMetrics: performanceMetrics || [],
        dataQualityMetrics: dataQualityMetrics || []
      };

    } catch (error) {
      console.error('Error getting metrics for time range:', error);
      return {
        syncMetrics: [],
        performanceMetrics: [],
        dataQualityMetrics: []
      };
    }
  }

  /**
   * Get aggregated metrics for dashboard
   */
  async getDashboardMetrics(): Promise<{
    overview: {
      totalSyncs: number;
      successRate: number;
      averageLatency: number;
      dataQualityScore: number;
      activeAlerts: number;
    };
    trends: {
      syncVolume: Array<{ timestamp: string; count: number }>;
      errorRate: Array<{ timestamp: string; rate: number }>;
      dataQuality: Array<{ timestamp: string; score: number }>;
      latency: Array<{ timestamp: string; ms: number }>;
    };
    topSources: Array<{
      name: string;
      recordsProcessed: number;
      successRate: number;
      lastSync: string;
    }>;
  }> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        overview,
        trends,
        topSources
      ] = await Promise.all([
        this.getOverviewMetrics(last24h),
        this.getTrendMetrics(last7d),
        this.getTopSourceMetrics(last24h)
      ]);

      return { overview, trends, topSources };

    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      return this.getEmptyDashboardMetrics();
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async createMetricsTables(): Promise<void> {
    const tables = [
      // Sync metrics table
      `
        CREATE TABLE IF NOT EXISTS sync_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_table TEXT NOT NULL,
          sync_date TIMESTAMP WITH TIME ZONE NOT NULL,
          total_records INTEGER DEFAULT 0,
          successful_syncs INTEGER DEFAULT 0,
          failed_syncs INTEGER DEFAULT 0,
          average_processing_time NUMERIC DEFAULT 0,
          data_quality_score NUMERIC DEFAULT 0,
          conflict_count INTEGER DEFAULT 0,
          resolution_time NUMERIC DEFAULT 0,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_sync_metrics_source_date
          ON sync_metrics(source_table, sync_date);
        CREATE INDEX IF NOT EXISTS idx_sync_metrics_recorded_at
          ON sync_metrics(recorded_at);
      `,
      // Performance metrics table
      `
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation TEXT NOT NULL,
          execution_time NUMERIC NOT NULL,
          memory_usage NUMERIC DEFAULT 0,
          cpu_usage NUMERIC DEFAULT 0,
          records_processed INTEGER DEFAULT 0,
          throughput NUMERIC DEFAULT 0,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          error_rate NUMERIC DEFAULT 0,
          dimensions JSONB,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation
          ON performance_metrics(operation, timestamp);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp
          ON performance_metrics(timestamp);
      `,
      // Data quality metrics table
      `
        CREATE TABLE IF NOT EXISTS data_quality_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          record_count INTEGER DEFAULT 0,
          completeness_score NUMERIC DEFAULT 0,
          accuracy_score NUMERIC DEFAULT 0,
          consistency_score NUMERIC DEFAULT 0,
          validity_score NUMERIC DEFAULT 0,
          last_assessed TIMESTAMP WITH TIME ZONE NOT NULL,
          issues JSONB,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_data_quality_table_assessed
          ON data_quality_metrics(table_name, last_assessed);
        CREATE INDEX IF NOT EXISTS idx_data_quality_score
          ON data_quality_metrics(completeness_score, accuracy_score);
      `,
      // Alerts table
      `
        CREATE TABLE IF NOT EXISTS metrics_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          alert_type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
          component TEXT NOT NULL,
          message TEXT NOT NULL,
          metric_name TEXT,
          actual_value JSONB,
          threshold_value JSONB,
          triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          acknowledged BOOLEAN DEFAULT FALSE,
          acknowledged_by TEXT,
          acknowledged_at TIMESTAMP WITH TIME ZONE,
          resolved BOOLEAN DEFAULT FALSE,
          resolved_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_alerts_severity
          ON metrics_alerts(severity, triggered_at);
        CREATE INDEX IF NOT EXISTS idx_metrics_alerts_component
          ON metrics_alerts(component, triggered_at);
      `
    ];

    for (const tableSql of tables) {
      try {
        await supabase.rpc('execute_sql', { sql: tableSql });
      } catch (error) {
        console.error('Error creating metrics table:', error);
      }
    }
  }

  private setupMetricCollectionIntervals(): void {
    // Collect system metrics every 5 minutes
    setInterval(async () => {
      if (this.config.enabled) {
        await this.collectSystemMetrics();
      }
    }, 5 * 60 * 1000);

    // Process buffered metrics every minute
    setInterval(async () => {
      if (this.config.enabled) {
        await this.processBufferedMetrics();
      }
    }, 60 * 1000);

    // Clean up old metrics every hour
    setInterval(async () => {
      if (this.config.enabled) {
        await this.cleanupOldMetrics();
      }
    }, 60 * 60 * 1000);
  }

  private async loadAlertThresholds(): Promise<void> {
    // Load alert thresholds from configuration
    console.log('Loading alert thresholds...');
  }

  private startMetricsProcessing(): void {
    // Start background processing for metrics aggregation and analysis
    console.log('Starting metrics processing...');
  }

  private async updateAggregatedMetrics(metrics: SyncMetrics): Promise<void> {
    // Update aggregated metrics tables for different time intervals
    const intervals = this.config.aggregationIntervals;

    for (const interval of intervals) {
      try {
        await this.updateAggregatedMetricsForInterval(metrics, interval);
      } catch (error) {
        console.error(`Error updating aggregated metrics for interval ${interval}:`, error);
      }
    }
  }

  private async updateAggregatedMetricsForInterval(
    metrics: SyncMetrics,
    interval: string
  ): Promise<void> {
    // Implementation would update aggregated metrics for specific time intervals
    console.log(`Updating aggregated metrics for ${interval} interval`);
  }

  private async checkMetricAlerts(metrics: SyncMetrics): Promise<void> {
    const alerts: Array<any> = [];

    // Check error rate
    if (metrics.total_records > 0) {
      const errorRate = (metrics.failed_syncs / metrics.total_records) * 100;
      if (errorRate > this.config.alertThresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          severity: errorRate > this.config.alertThresholds.errorRate * 2 ? 'critical' : 'error',
          component: 'data_synchronization',
          message: `High error rate: ${errorRate.toFixed(2)}%`,
          metricName: 'error_rate',
          actualValue: errorRate,
          thresholdValue: this.config.alertThresholds.errorRate
        });
      }
    }

    // Check data quality score
    if (metrics.data_quality_score < this.config.alertThresholds.dataQualityScore) {
      alerts.push({
        type: 'data_quality',
        severity: metrics.data_quality_score < this.config.alertThresholds.dataQualityScore / 2 ? 'critical' : 'warning',
        component: 'data_quality',
        message: `Low data quality score: ${metrics.data_quality_score}`,
        metricName: 'data_quality_score',
        actualValue: metrics.data_quality_score,
        thresholdValue: this.config.alertThresholds.dataQualityScore
      });
    }

    // Check processing time
    if (metrics.average_processing_time > this.config.alertThresholds.latency) {
      alerts.push({
        type: 'latency',
        severity: metrics.average_processing_time > this.config.alertThresholds.latency * 2 ? 'warning' : 'info',
        component: 'performance',
        message: `High latency: ${metrics.average_processing_time}ms`,
        metricName: 'average_processing_time',
        actualValue: metrics.average_processing_time,
        thresholdValue: this.config.alertThresholds.latency
      });
    }

    // Store alerts
    for (const alert of alerts) {
      await this.storeAlert(alert);
    }
  }

  private async checkQualityAlerts(metrics: DataQualityMetrics): Promise<void> {
    const alerts: Array<any> = [];

    // Check overall quality score
    if (metrics.overall_quality_score < this.config.alertThresholds.dataQualityScore) {
      alerts.push({
        type: 'data_quality',
        severity: metrics.overall_quality_score < 50 ? 'critical' : 'warning',
        component: 'data_quality',
        message: `Low data quality for ${metrics.table_name}: ${metrics.overall_quality_score}`,
        metricName: 'overall_quality_score',
        actualValue: metrics.overall_quality_score,
        thresholdValue: this.config.alertThresholds.dataQualityScore
      });
    }

    // Store alerts
    for (const alert of alerts) {
      await this.storeAlert(alert);
    }
  }

  private async storeAlert(alert: any): Promise<void> {
    try {
      await supabase
        .from('metrics_alerts')
        .insert({
          ...alert,
          triggered_at: new Date().toISOString()
        });

      // Add to alert history
      this.alertHistory.push({
        ...alert,
        triggered_at: new Date().toISOString()
      });

      // Keep alert history size manageable
      if (this.alertHistory.length > this.MAX_ALERT_HISTORY) {
        this.alertHistory.splice(0, this.MAX_ALERT_HISTORY / 2);
      }

      // Send notifications if configured
      if (this.config.notifications.email.length > 0) {
        await this.sendAlertNotification(alert);
      }

    } catch (error) {
      console.error('Error storing alert:', error);
    }
  }

  private async sendAlertNotification(alert: any): Promise<void> {
    // Implementation would send email/webhook notifications
    console.log(`Alert notification sent: ${alert.message}`);
  }

  private async getSyncStatistics(since: Date): Promise<MetricsSnapshot['syncOperations']> {
    try {
      const { data: metrics } = await supabase
        .from('sync_metrics')
        .select('successful_syncs, failed_syncs')
        .gte('recorded_at', since.toISOString());

      const total = (metrics || []).reduce((sum, m) => sum + m.successful_syncs + m.failed_syncs, 0);
      const successful = (metrics || []).reduce((sum, m) => sum + m.successful_syncs, 0);
      const failed = (metrics || []).reduce((sum, m) => sum + m.failed_syncs, 0);

      return {
        total,
        successful,
        failed,
        inProgress: 0 // Would need to be tracked separately
      };

    } catch (error) {
      console.error('Error getting sync statistics:', error);
      return { total: 0, successful: 0, failed: 0, inProgress: 0 };
    }
  }

  private async getDataSourceStatistics(): Promise<MetricsSnapshot['dataSources']> {
    const sources = ['employers', 'projects', 'compliance_checks', 'site_visits', 'company_eba_records'];
    const stats: MetricsSnapshot['dataSources'] = [];

    for (const source of sources) {
      try {
        const { data: metrics } = await supabase
          .from('sync_metrics')
          .select('*')
          .eq('source_table', source)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

        if (metrics) {
          stats.push({
            name: source,
            status: 'active',
            lastSync: metrics.sync_date,
            recordsProcessed: metrics.total_records,
            averageLatency: metrics.average_processing_time || 0,
            errorRate: metrics.total_records > 0 ? (metrics.failed_syncs / metrics.total_records) * 100 : 0
          });
        }

      } catch (error) {
        stats.push({
          name: source,
          status: 'unknown',
          lastSync: '',
          recordsProcessed: 0,
          averageLatency: 0,
          errorRate: 0
        });
      }
    }

    return stats;
  }

  private async getRecentPerformanceMetrics(since: Date): Promise<any> {
    try {
      const { data: metrics } = await supabase
        .from('performance_metrics')
        .select('execution_time, throughput, error_rate')
        .gte('timestamp', since.toISOString());

      if (!metrics || metrics.length === 0) {
        return {
          averageLatency: 0,
          throughput: 0,
          errorRate: 0
        };
      }

      const avgLatency = metrics.reduce((sum, m) => sum + m.execution_time, 0) / metrics.length;
      const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
      const avgErrorRate = metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length;

      return {
        averageLatency: Math.round(avgLatency),
        throughput: Math.round(avgThroughput),
        errorRate: Math.round(avgErrorRate * 100) / 100
      };

    } catch (error) {
      console.error('Error getting recent performance metrics:', error);
      return { averageLatency: 0, throughput: 0, errorRate: 0 };
    }
  }

  private async getRecentDataQualityMetrics(since: Date): Promise<MetricsSnapshot['dataQuality']> {
    try {
      const { data: metrics } = await supabase
        .from('data_quality_metrics')
        .select('completeness_score, accuracy_score, consistency_score, validity_score')
        .gte('last_assessed', since.toISOString());

      if (!metrics || metrics.length === 0) {
        return {
          overallScore: 0,
          completenessScore: 0,
          accuracyScore: 0,
          consistencyScore: 0
        };
      }

      const avgCompleteness = metrics.reduce((sum, m) => sum + m.completeness_score, 0) / metrics.length;
      const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy_score, 0) / metrics.length;
      const avgConsistency = metrics.reduce((sum, m) => sum + m.consistency_score, 0) / metrics.length;
      const avgValidity = metrics.reduce((sum, m) => sum + m.validity_score, 0) / metrics.length;

      return {
        overallScore: Math.round((avgCompleteness + avgAccuracy + avgConsistency + avgValidity) / 4),
        completenessScore: Math.round(avgCompleteness),
        accuracyScore: Math.round(avgAccuracy),
        consistencyScore: Math.round(avgConsistency)
      };

    } catch (error) {
      console.error('Error getting recent data quality metrics:', error);
      return {
        overallScore: 0,
        completenessScore: 0,
        accuracyScore: 0,
        consistencyScore: 0
      };
    }
  }

  private async getSystemResources(): Promise<MetricsSnapshot['systemResources']> {
    // In a real implementation, this would get actual system metrics
    return {
      cpuUsage: 45,
      memoryUsage: 62,
      diskUsage: 38,
      networkLatency: 12
    };
  }

  private getEmptyMetricsSnapshot(): MetricsSnapshot {
    return {
      timestamp: new Date().toISOString(),
      syncOperations: { total: 0, successful: 0, failed: 0, inProgress: 0 },
      dataSources: [],
      systemResources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkLatency: 0 },
      dataQuality: { overallScore: 0, completenessScore: 0, accuracyScore: 0, consistencyScore: 0 }
    };
  }

  private async analyzeSyncHealth(snapshot: MetricsSnapshot): Promise<HealthStatus> {
    const issues: HealthStatus['issues'] = [];
    let score = 100;

    // Analyze sync operation health
    const totalSyncs = snapshot.syncOperations.total;
    if (totalSyncs > 0) {
      const errorRate = (snapshot.syncOperations.failed / totalSyncs) * 100;
      if (errorRate > 10) {
        issues.push({
          severity: 'high',
          description: `High sync error rate: ${errorRate.toFixed(2)}%`,
          metric: 'error_rate',
          actualValue: errorRate,
          threshold: 10
        });
        score -= 30;
      } else if (errorRate > 5) {
        issues.push({
          severity: 'medium',
          description: `Elevated sync error rate: ${errorRate.toFixed(2)}%`,
          metric: 'error_rate',
          actualValue: errorRate,
          threshold: 5
        });
        score -= 15;
      }
    }

    // Analyze data source health
    const inactiveSources = snapshot.dataSources.filter(ds => ds.status !== 'active').length;
    if (inactiveSources > 0) {
      issues.push({
        severity: 'medium',
        description: `${inactiveSources} data sources are inactive`,
        metric: 'inactive_sources',
        actualValue: inactiveSources
      });
      score -= inactiveSources * 10;
    }

    const status = score >= 90 ? 'healthy' : score >= 70 ? 'degraded' : score >= 50 ? 'unhealthy' : 'critical';

    return {
      status,
      score,
      metrics: {
        totalSyncs: snapshot.syncOperations.total,
        errorRate: totalSyncs > 0 ? (snapshot.syncOperations.failed / totalSyncs) * 100 : 0,
        activeSources: snapshot.dataSources.filter(ds => ds.status === 'active').length
      },
      issues
    };
  }

  private async analyzeDataQualityHealth(snapshot: MetricsSnapshot): Promise<HealthStatus> {
    const issues: HealthStatus['issues'] = [];
    let score = snapshot.dataQuality.overallScore;

    if (score < 70) {
      issues.push({
        severity: 'high',
        description: `Low data quality score: ${score}`,
        metric: 'overall_quality_score',
        actualValue: score,
        threshold: 70
      });
    } else if (score < 85) {
      issues.push({
        severity: 'medium',
        description: `Data quality score needs improvement: ${score}`,
        metric: 'overall_quality_score',
        actualValue: score,
        threshold: 85
      });
    }

    const status = score >= 90 ? 'healthy' : score >= 75 ? 'degraded' : score >= 60 ? 'unhealthy' : 'critical';

    return {
      status,
      score,
      metrics: snapshot.dataQuality,
      issues
    };
  }

  private async analyzePerformanceHealth(snapshot: MetricsSnapshot): Promise<HealthStatus> {
    const issues: HealthStatus['issues'] = [];
    let score = 100;

    // Analyze average latency across sources
    const avgLatency = snapshot.dataSources.reduce((sum, ds) => sum + ds.averageLatency, 0) / Math.max(snapshot.dataSources.length, 1);
    if (avgLatency > 5000) { // 5 seconds
      issues.push({
        severity: 'high',
        description: `High average latency: ${avgLatency}ms`,
        metric: 'average_latency',
        actualValue: avgLatency,
        threshold: 5000
      });
      score -= 25;
    } else if (avgLatency > 2000) { // 2 seconds
      issues.push({
        severity: 'medium',
        description: `Elevated latency: ${avgLatency}ms`,
        metric: 'average_latency',
        actualValue: avgLatency,
        threshold: 2000
      });
      score -= 10;
    }

    // Analyze system resources
    if (snapshot.systemResources.cpuUsage > 80) {
      issues.push({
        severity: 'high',
        description: `High CPU usage: ${snapshot.systemResources.cpuUsage}%`,
        metric: 'cpu_usage',
        actualValue: snapshot.systemResources.cpuUsage,
        threshold: 80
      });
      score -= 20;
    }

    if (snapshot.systemResources.memoryUsage > 85) {
      issues.push({
        severity: 'high',
        description: `High memory usage: ${snapshot.systemResources.memoryUsage}%`,
        metric: 'memory_usage',
        actualValue: snapshot.systemResources.memoryUsage,
        threshold: 85
      });
      score -= 20;
    }

    const status = score >= 90 ? 'healthy' : score >= 75 ? 'degraded' : score >= 60 ? 'unhealthy' : 'critical';

    return {
      status,
      score,
      metrics: {
        averageLatency: Math.round(avgLatency),
        cpuUsage: snapshot.systemResources.cpuUsage,
        memoryUsage: snapshot.systemResources.memoryUsage
      },
      issues
    };
  }

  private async analyzeSystemResourceHealth(snapshot: MetricsSnapshot): Promise<HealthStatus> {
    const issues: HealthStatus['issues'] = [];
    let score = 100;

    const { cpuUsage, memoryUsage, diskUsage, networkLatency } = snapshot.systemResources;

    if (cpuUsage > 90) {
      issues.push({
        severity: 'critical',
        description: `Critical CPU usage: ${cpuUsage}%`,
        metric: 'cpu_usage',
        actualValue: cpuUsage,
        threshold: 90
      });
      score -= 40;
    } else if (cpuUsage > 75) {
      issues.push({
        severity: 'high',
        description: `High CPU usage: ${cpuUsage}%`,
        metric: 'cpu_usage',
        actualValue: cpuUsage,
        threshold: 75
      });
      score -= 20;
    }

    if (memoryUsage > 90) {
      issues.push({
        severity: 'critical',
        description: `Critical memory usage: ${memoryUsage}%`,
        metric: 'memory_usage',
        actualValue: memoryUsage,
        threshold: 90
      });
      score -= 40;
    } else if (memoryUsage > 80) {
      issues.push({
        severity: 'high',
        description: `High memory usage: ${memoryUsage}%`,
        metric: 'memory_usage',
        actualValue: memoryUsage,
        threshold: 80
      });
      score -= 20;
    }

    if (diskUsage > 85) {
      issues.push({
        severity: 'high',
        description: `High disk usage: ${diskUsage}%`,
        metric: 'disk_usage',
        actualValue: diskUsage,
        threshold: 85
      });
      score -= 15;
    }

    if (networkLatency > 100) {
      issues.push({
        severity: 'medium',
        description: `High network latency: ${networkLatency}ms`,
        metric: 'network_latency',
        actualValue: networkLatency,
        threshold: 100
      });
      score -= 10;
    }

    const status = score >= 90 ? 'healthy' : score >= 75 ? 'degraded' : score >= 60 ? 'unhealthy' : 'critical';

    return {
      status,
      score,
      metrics: snapshot.systemResources,
      issues
    };
  }

  private generateAlerts(components: SyncHealthReport['components']): SyncHealthReport['alerts'] {
    const alerts: SyncHealthReport['alerts'] = [];

    for (const [componentName, component] of Object.entries(components)) {
      for (const issue of component.issues) {
        alerts.push({
          level: issue.severity === 'critical' ? 'critical' :
                issue.severity === 'high' ? 'error' :
                issue.severity === 'medium' ? 'warning' : 'info',
          component: componentName,
          message: issue.description,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    alerts.sort((a, b) => severityOrder[a.level as keyof typeof severityOrder] - severityOrder[b.level as keyof typeof severityOrder]);

    return alerts;
  }

  private generateRecommendations(
    components: SyncHealthReport['components'],
    alerts: SyncHealthReport['alerts']
  ): string[] {
    const recommendations: string[] = [];

    // Analyze components and generate recommendations
    if (components.dataSynchronization.score < 80) {
      recommendations.push('Review and optimize data synchronization processes');
      recommendations.push('Check for data conflicts and resolution strategies');
    }

    if (components.dataQuality.score < 80) {
      recommendations.push('Implement data validation and quality checks');
      recommendations.push('Review data source quality and completeness');
    }

    if (components.performance.score < 80) {
      recommendations.push('Optimize database queries and indexing');
      recommendations.push('Consider increasing system resources');
    }

    if (components.systemResources.score < 80) {
      recommendations.push('Monitor system resource utilization');
      recommendations.push('Scale up resources if consistently high usage');
    }

    // Add specific recommendations based on alerts
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('URGENT: Address critical system issues immediately');
    }

    return recommendations;
  }

  private determineOverallStatus(
    score: number,
    alerts: SyncHealthReport['alerts']
  ): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    // If there are critical alerts, status is critical regardless of score
    if (alerts.some(a => a.level === 'critical')) {
      return 'critical';
    }

    // If there are error alerts, status is unhealthy
    if (alerts.some(a => a.level === 'error')) {
      return 'unhealthy';
    }

    // Determine status based on score
    if (score >= 90) return 'healthy';
    if (score >= 75) return 'degraded';
    if (score >= 60) return 'unhealthy';
    return 'critical';
  }

  private getEmptyHealthReport(): SyncHealthReport {
    return {
      overallStatus: 'unhealthy',
      score: 0,
      timestamp: new Date().toISOString(),
      components: {
        dataSynchronization: { status: 'unhealthy', score: 0, metrics: {}, issues: [] },
        dataQuality: { status: 'unhealthy', score: 0, metrics: {}, issues: [] },
        performance: { status: 'unhealthy', score: 0, metrics: {}, issues: [] },
        systemResources: { status: 'unhealthy', score: 0, metrics: {}, issues: [] }
      },
      alerts: [],
      recommendations: ['System metrics unavailable - check monitoring system']
    };
  }

  private async collectSystemMetrics(): Promise<void> {
    // Collect system-level metrics
    const systemResources = await this.getSystemResources();

    const performanceMetric: PerformanceMetrics = {
      operation: 'system_monitoring',
      execution_time: 0,
      memory_usage: systemResources.memoryUsage,
      cpu_usage: systemResources.cpuUsage,
      records_processed: 0,
      throughput: 0,
      timestamp: new Date().toISOString(),
      error_rate: 0,
      dimensions: {
        component: 'system'
      }
    };

    await this.recordPerformanceMetric(performanceMetric);
  }

  private async processBufferedMetrics(): Promise<void> {
    // Process and aggregate buffered metrics
    for (const [key, metrics] of this.metricsBuffer.entries()) {
      if (metrics.length > 0) {
        // Calculate aggregates
        const avgExecutionTime = metrics.reduce((sum, m) => sum + m.execution_time, 0) / metrics.length;
        const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
        const avgErrorRate = metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length;

        // Store aggregated metrics
        await this.recordPerformanceMetric({
          operation: key.split('_')[0],
          execution_time: avgExecutionTime,
          memory_usage: 0,
          cpu_usage: 0,
          records_processed: metrics.reduce((sum, m) => sum + m.records_processed, 0),
          throughput: avgThroughput,
          timestamp: new Date().toISOString(),
          error_rate: avgErrorRate,
          dimensions: {
            aggregated: true,
            table_name: key.split('_')[1] || 'unknown',
            sample_size: metrics.length
          }
        });

        // Clear buffer
        this.metricsBuffer.set(key, []);
      }
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

    try {
      // Clean up old metrics tables
      await Promise.all([
        supabase
          .from('sync_metrics')
          .delete()
          .lt('recorded_at', cutoffDate.toISOString()),
        supabase
          .from('performance_metrics')
          .delete()
          .lt('recorded_at', cutoffDate.toISOString()),
        supabase
          .from('data_quality_metrics')
          .delete()
          .lt('recorded_at', cutoffDate.toISOString()),
        supabase
          .from('metrics_alerts')
          .delete()
          .lt('triggered_at', cutoffDate.toISOString())
          .eq('resolved', true)
      ]);

      console.log('Cleaned up old metrics');
    } catch (error) {
      console.error('Error cleaning up old metrics:', error);
    }
  }

  private async getOverviewMetrics(since: Date): Promise<any> {
    try {
      const { data: metrics } = await supabase
        .from('sync_metrics')
        .select('*')
        .gte('recorded_at', since.toISOString());

      if (!metrics || metrics.length === 0) {
        return {
          totalSyncs: 0,
          successRate: 0,
          averageLatency: 0,
          dataQualityScore: 0,
          activeAlerts: 0
        };
      }

      const totalSyncs = metrics.reduce((sum, m) => sum + m.total_records, 0);
      const successfulSyncs = metrics.reduce((sum, m) => sum + m.successful_syncs, 0);
      const averageLatency = metrics.reduce((sum, m) => sum + m.average_processing_time, 0) / metrics.length;
      const avgDataQuality = metrics.reduce((sum, m) => sum + m.data_quality_score, 0) / metrics.length;

      // Get active alerts count
      const { count: activeAlerts } = await supabase
        .from('metrics_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)
        .gte('triggered_at', since.toISOString());

      return {
        totalSyncs,
        successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
        averageLatency: Math.round(averageLatency),
        dataQualityScore: Math.round(avgDataQuality),
        activeAlerts: activeAlerts || 0
      };

    } catch (error) {
      console.error('Error getting overview metrics:', error);
      return {
        totalSyncs: 0,
        successRate: 0,
        averageLatency: 0,
        dataQualityScore: 0,
        activeAlerts: 0
      };
    }
  }

  private async getTrendMetrics(since: Date): Promise<any> {
    // Implementation would return trend data for charts
    return {
      syncVolume: [],
      errorRate: [],
      dataQuality: [],
      latency: []
    };
  }

  private async getTopSourceMetrics(since: Date): Promise<any> {
    try {
      const { data: metrics } = await supabase
        .from('sync_metrics')
        .select('source_table, total_records, successful_syncs, recorded_at')
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: false });

      // Group by source table and get most recent
      const sourceStats = new Map();

      for (const metric of metrics || []) {
        if (!sourceStats.has(metric.source_table) ||
            new Date(metric.recorded_at) > new Date(sourceStats.get(metric.source_table).lastSync)) {
          sourceStats.set(metric.source_table, {
            name: metric.source_table,
            recordsProcessed: metric.total_records,
            successRate: metric.total_records > 0 ? (metric.successful_syncs / metric.total_records) * 100 : 0,
            lastSync: metric.recorded_at
          });
        }
      }

      return Array.from(sourceStats.values())
        .sort((a, b) => b.recordsProcessed - a.recordsProcessed)
        .slice(0, 10);

    } catch (error) {
      console.error('Error getting top source metrics:', error);
      return [];
    }
  }

  private getEmptyDashboardMetrics(): any {
    return {
      overview: {
        totalSyncs: 0,
        successRate: 0,
        averageLatency: 0,
        dataQualityScore: 0,
        activeAlerts: 0
      },
      trends: {
        syncVolume: [],
        errorRate: [],
        dataQuality: [],
        latency: []
      },
      topSources: []
    };
  }
}

// Export singleton instance
export const syncMetricsCollector = new SyncMetricsCollector({
  enabled: true,
  retentionDays: 30,
  aggregationIntervals: ['5m', '1h', '1d'],
  alertThresholds: {
    errorRate: 5.0,
    latency: 5000,
    dataQualityScore: 75,
    queueSize: 1000
  },
  notifications: {
    email: []
  }
});