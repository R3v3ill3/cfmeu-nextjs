# Database Connection Monitoring System

This document describes the comprehensive database connection monitoring system implemented to prevent connection pool exhaustion and identify potential causes of session loss in the CFMEU NSW Construction Union Organising Database.

## Overview

The monitoring system tracks database connections across all services (main app, middleware, workers) to:
- Prevent connection pool exhaustion that could cause session loss
- Identify connection leaks and resource contention
- Provide real-time visibility into database resource usage
- Enable proactive alerting and automated recovery
- Support performance optimization and capacity planning

## Architecture

### Core Components

1. **Connection Monitor** (`/src/lib/db-connection-monitor.ts`)
   - Singleton instance tracking all database connections
   - Real-time connection pool monitoring with configurable thresholds
   - Alert system for critical and warning conditions
   - Automatic cleanup of stale connections

2. **Metrics Collector** (`/src/lib/db-connection-metrics.ts`)
   - Comprehensive metrics collection and export
   - Support for multiple output formats (JSON, Prometheus, CSV)
   - Historical data retention and aggregation
   - Configurable collection intervals and retention periods

3. **Health Check API** (`/src/app/api/health/connections/route.ts`)
   - Real-time connection status endpoint
   - Detailed diagnostics and recommendations
   - Support for cleanup operations
   - Multiple response formats for monitoring tools

4. **Monitoring Dashboard API** (`/src/app/api/monitoring/database/route.ts`)
   - Comprehensive monitoring data export
   - Historical metrics and aggregation
   - Multiple export formats (JSON, Prometheus, CSV)
   - Administrative operations (cleanup, reset)

## Integration Points

### Main Application

- **Browser Client** (`/src/lib/supabase/client.ts`)
  - Connection tracking for client-side Supabase operations
  - Error monitoring for authentication and query failures
  - Automatic connection cleanup on client reset

- **Server Client** (`/src/lib/supabase/server.ts`)
  - Connection tracking for server-side operations
  - Query error monitoring and logging
  - Graceful connection release

- **Middleware** (`/src/middleware.ts`)
  - Request-level connection monitoring
  - Authentication error tracking
  - Connection pool usage logging

### Background Workers

- **Dashboard Worker** (`/railway_workers/cfmeu-dashboard-worker/src/supabase.ts`)
- **Scraper Worker** (`/railway_workers/cfmeu-scraper-worker/src/supabase.ts`)
- **Scanner Worker** (`/railway_workers/mapping-sheet-scanner-worker/src/supabase.ts`)

All workers include:
- Connection tracking with service identification
- Query error monitoring
- Graceful shutdown with connection cleanup

## Configuration

### Environment Variables

```bash
# Enable/disable connection monitoring
DB_CONNECTION_MONITORING=true

# Metrics collection
METRICS_COLLECTION_INTERVAL=30000          # 30 seconds
METRICS_RETENTION_HOURS=24                  # 24 hours

# Prometheus integration
PROMETHEUS_ENABLED=false
PROMETHEUS_PORT=9090

# InfluxDB integration
INFLUXDB_ENABLED=false
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=your-org
INFLUXDB_BUCKET=your-bucket

# Debug logging
NEXT_PUBLIC_SENTRY_DEBUG=true
```

### Thresholds

- **Warning**: 80% connection pool utilization
- **Critical**: 95% connection pool utilization
- **Cleanup**: Connections idle for 5+ minutes
- **Alert Cooldown**: 5 minutes between similar alerts

## API Endpoints

### Health Check

**GET** `/api/health/connections`

Basic connection health status with optional parameters:

```bash
# Basic status
curl /api/health/connections

# Detailed information
curl /api/health/connections?detailed=true

# Include diagnostics
curl /api/health/connections?diagnostics=true

# Force cleanup
curl -X POST /api/health/connections \
  -H "Content-Type: application/json" \
  -d '{"operation": "cleanup"}'
```

**POST** `/api/health/connections`

Perform operations:
- `cleanup` - Force cleanup of stale connections
- `emergency-reset` - Clear all connections (requires auth in production)

### Comprehensive Monitoring

**GET** `/api/monitoring/database`

Comprehensive monitoring data with rich parameters:

```bash
# Basic monitoring data
curl /api/monitoring/database

# Detailed with history
curl /api/monitoring/database?detailed=true&history=true&limit=50

# Aggregated statistics
curl /api/monitoring/database?aggregated=true&hours=24

# Service-specific metrics
curl /api/monitoring/database?service=dashboard-worker

# Export formats
curl /api/monitoring/database?format=prometheus
curl /api/monitoring/database?format=csv
```

**POST** `/api/monitoring/database`

Administrative operations:
- `cleanup` - Force connection cleanup
- `export-json` - Export metrics to JSON file
- `start-collection` - Start metrics collection
- `stop-collection` - Stop metrics collection
- `emergency-reset` - Emergency connection reset

## Usage Examples

### Monitoring Connection Health

```typescript
import { getConnectionStats, getPoolUtilization } from '@/lib/db-connection-monitor'

// Check current connection status
const stats = getConnectionStats()
console.log(`Pool utilization: ${Math.round(stats.poolUtilization * 100)}%`)
console.log(`Active connections: ${stats.totalActiveConnections}`)
console.log(`Health status: ${stats.healthStatus}`)

// Check if approaching limits
const utilization = getPoolUtilization()
if (utilization > 0.8) {
  console.warn('Connection pool approaching capacity')
}
```

### Exporting Metrics

```typescript
import { exportMetricsToJSON, getAggregatedStats } from '@/lib/db-connection-metrics'

// Export current metrics to file
await exportMetricsToJSON('/tmp/db-metrics.json')

// Get 24-hour aggregation
const stats = getAggregatedStats(24)
console.log(`Average utilization: ${stats.utilization.average}%`)
console.log(`Peak connections: ${stats.activeConnections.max}`)
```

### Custom Monitoring

```typescript
import { trackConnection, releaseConnection, recordConnectionError } from '@/lib/db-connection-monitor'

// Track a custom connection
const connectionId = trackConnection('custom-service', 'operation-123')

try {
  // Perform database operation
  await performDatabaseOperation()
} catch (error) {
  // Record the error
  recordConnectionError('custom-service', error, 'performDatabaseOperation')
} finally {
  // Always release the connection
  releaseConnection('custom-service', connectionId)
}
```

## Alerting and Notifications

### Built-in Alerts

The system automatically generates alerts for:

1. **High Pool Utilization** (80% warning, 95% critical)
2. **Connection Errors** (database failures, timeouts)
3. **Service Health Issues** (error rates, inactive services)
4. **Resource Exhaustion** (peak usage patterns)

### Alert Integration

```typescript
import { monitoring } from '@/lib/monitoring'

// Register custom alert
monitoring.registerAlert('custom-threshold', {
  name: 'Custom Threshold Alert',
  enabled: true,
  threshold: 90,
  comparison: 'gt',
  severity: 'warning',
  cooldown: 10,
  channels: ['slack'],
  conditions: [
    { metric: 'database.poolUtilization', operator: 'gt', value: 90 }
  ]
})
```

## Performance Impact

### Minimal Overhead

- Connection tracking uses lightweight Map data structures
- Metrics collection runs on configurable intervals (default: 30 seconds)
- Monitoring code is wrapped in try-catch to prevent application impact
- All monitoring operations are asynchronous and non-blocking

### Memory Usage

- Connection metrics stored in memory with automatic cleanup
- Configurable retention period (default: 24 hours)
- Efficient data structures minimize memory footprint
- Automatic cleanup of old data and stale connections

## Troubleshooting

### Common Issues

1. **High Connection Count**
   - Check for connection leaks in application code
   - Verify proper connection release in finally blocks
   - Review worker service connection management

2. **Frequent Alerts**
   - May indicate underlying database performance issues
   - Check for slow queries or network problems
   - Consider increasing connection pool size

3. **Memory Growth**
   - Reduce metrics retention period
   - Increase cleanup interval
   - Check for connection leaks

### Diagnostic Information

Use the diagnostics endpoint for detailed analysis:

```bash
curl /api/monitoring/database?detailed=true&diagnostics=true
```

This provides:
- Service health status
- Recent error patterns
- Performance recommendations
- Connection usage trends

## Production Deployment

### Monitoring Setup

1. **Environment Configuration**
   ```bash
   DB_CONNECTION_MONITORING=true
   METRICS_COLLECTION_INTERVAL=30000
   METRICS_RETENTION_HOURS=24
   ```

2. **Health Checks**
   - Configure monitoring tools to poll `/api/health/connections`
   - Set up alerts for critical status responses
   - Monitor response times from health endpoints

3. **Metrics Collection**
   - Enable Prometheus integration for metrics aggregation
   - Configure Grafana dashboards for visualization
   - Set up alerting rules based on metrics thresholds

### Scaling Considerations

- Monitor connection pool utilization during traffic spikes
- Consider horizontal scaling for database-intensive operations
- Use connection monitoring data for capacity planning
- Implement circuit breakers for database failures

## Security Considerations

### Access Control

- Health check endpoints are publicly accessible for monitoring
- Administrative operations require authentication in production
- Metrics export endpoints may contain sensitive system information

### Data Privacy

- Connection metrics do not contain application data
- Error messages are sanitized before logging
- Historical data retention should comply with data governance policies

## Integration with Existing Monitoring

### Sentry Integration

Connection monitoring automatically integrates with Sentry:
- Connection errors are captured as exceptions
- Breadcrumbs track connection lifecycle events
- Performance metrics enhance error context

### PostHog Integration

- Connection events can be tracked for analytics
- Performance metrics inform user experience optimization
- Error rates impact overall system health metrics

## Future Enhancements

### Planned Features

1. **Real-time Dashboard** - Web interface for connection monitoring
2. **Predictive Analytics** - Machine learning for capacity prediction
3. **Auto-scaling Integration** - Automatic resource scaling based on metrics
4. **Database Query Monitoring** - Query performance tracking and optimization
5. **Multi-region Support** - Distributed monitoring across deployments

### Extensibility

The monitoring system is designed for extensibility:
- Plugin architecture for custom metrics collectors
- Configurable alert channels and notification systems
- Support for custom service monitoring
- Integration hooks for external monitoring systems

---

For support or questions about the database connection monitoring system, please refer to the source code documentation or contact the development team.