# CFMEU Rating System - Deployment Safety & Monitoring Guide

## Overview

This guide covers the deployment safety procedures, monitoring setup, and emergency response protocols for the CFMEU rating system. The system has been enhanced with comprehensive safety mechanisms to ensure reliable production deployments.

## Table of Contents

1. [Production Readiness Assessment](#production-readiness-assessment)
2. [Feature Flags Configuration](#feature-flags-configuration)
3. [Monitoring & Health Checks](#monitoring--health-checks)
4. [Error Tracking & Alerting](#error-tracking--alerting)
5. [Deployment Procedures](#deployment-procedures)
6. [Emergency Response](#emergency-response)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring Dashboard](#monitoring-dashboard)

## Production Readiness Assessment

### ✅ Completed Pre-Deployment Checks

- **Security Review**: All APIs have proper authentication and authorization
- **Performance Testing**: Mobile optimizations and bundle splitting implemented
- **Error Handling**: Comprehensive error boundaries and tracking
- **Monitoring**: Health checks and metrics collection configured
- **Feature Flags**: Safe deployment mechanisms implemented
- **Database**: Rating system tables and indexes optimized

### 🚨 Configuration Issues Identified & Fixed

1. **Hardcoded Localhost Values**
   - Fixed: `useLeadOrganizerSummary.ts` localhost fallback
   - Fixed: Test files using localhost URLs

2. **Development Console Logs**
   - Fixed: Console logs in error handler (development-only)
   - Fixed: Debug statements in test files

3. **Environment Variables**
   - Added: Feature flag environment variables
   - Added: Monitoring configuration variables

## Feature Flags Configuration

### Core Rating System Flags

```bash
# Core functionality
RATING_SYSTEM_ENABLED=true
RATING_DASHBOARD_ENABLED=true
RATING_WIZARD_ENABLED=true
RATING_COMPARISON_ENABLED=true

# Mobile features
MOBILE_RATINGS_ENABLED=true
MOBILE_OPTIMIZATIONS_ENABLED=true

# Advanced features
RATING_ANALYTICS_ENABLED=true
RATING_EXPORT_ENABLED=true
RATING_BATCH_OPERATIONS_ENABLED=true

# Monitoring features
ENHANCED_ERROR_TRACKING=true
PERFORMANCE_MONITORING=true
DETAILED_LOGGING=false  # Only in dev/staging
```

### Rollout Percentages

For gradual deployment, use these environment variables:

```bash
# Gradual rollout (0-100)
RATING_SYSTEM_ROLLOUT_PERCENTAGE=100
RATING_DASHBOARD_ROLLOUT_PERCENTAGE=100
MOBILE_RATINGS_ROLLOUT_PERCENTAGE=100
```

### Emergency Controls

All rating system flags can be disabled via the emergency API:

```bash
# Emergency disable all rating features
curl -X POST https://your-app.com/api/ratings/emergency-disable \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Critical system issue"}'
```

## Monitoring & Health Checks

### Health Check Endpoints

#### General System Health
```
GET /api/health?detailed=true
HEAD /api/health
```

#### Rating System Health
```
GET /api/ratings/health?detailed=true
HEAD /api/ratings/health
```

#### Response Headers
- `X-Health-Status`: healthy | degraded | unhealthy
- `X-Health-Score`: 0-100
- `X-Response-Time`: milliseconds
- `X-Environment`: development | staging | production
- `X-Version`: application version

### Monitoring Metrics

The system tracks these key metrics:

#### System Metrics
- Uptime and response times
- Memory and CPU usage
- Database connection pool status
- API error rates

#### Rating System Metrics
- Active ratings count
- Calculation performance
- Cache hit rates
- Mobile optimization effectiveness

#### Error Metrics
- Error rates by category
- User-affected errors
- Performance degradation
- Feature flag changes

### Health Check Configuration

Health checks run every 30 seconds and monitor:

1. **Database Connectivity**
   - Connection response time < 500ms (warning), < 1000ms (critical)
   - Query success rate > 99%

2. **Rating Engine**
   - Calculation response time < 1000ms (warning), < 2000ms (critical)
   - Calculation success rate > 99%

3. **API Performance**
   - Response time < 200ms (warning), < 500ms (critical)
   - Error rate < 1% (warning), < 5% (critical)

4. **Feature Flags**
   - All critical flags enabled
   - Flag configuration consistency

## Error Tracking & Alerting

### Error Categories

1. **System Errors**: Infrastructure failures
2. **Database Errors**: Connection/query issues
3. **Calculation Errors**: Rating computation failures
4. **User Errors**: Client-side issues
5. **Network Errors**: API connectivity problems
6. **UI Errors**: React component failures

### Alert Configuration

#### Critical Alerts (Immediate Response Required)
- Error rate > 5%
- Database connection failures
- Rating calculation failures
- System health status = unhealthy

#### Warning Alerts (Monitor Closely)
- Error rate > 1%
- Response time > 500ms
- Health check warnings
- Feature flag changes

#### Info Alerts (For Awareness)
- System metrics changes
- Deployment completions
- Performance improvements

### Alert Channels

1. **Email**: `admin@cfmeu.org`, `devops@cfmeu.org`
2. **Slack**: `#alerts`, `#rating-system`, `#deployments`
3. **PagerDuty**: Critical incidents only

### Error Tracking API

```bash
# Get error statistics
GET /api/errors/stats

# Get recent errors
GET /api/errors?limit=50&severity=critical

# Resolve error
POST /api/errors/{errorId}/resolve
```

## Deployment Procedures

### Pre-Deployment Checklist

1. **Health Check Verification**
   ```bash
   curl -f https://staging.cfmeu.org/api/health
   curl -f https://staging.cfmeu.org/api/ratings/health
   ```

2. **Feature Flag Status**
   ```bash
   curl https://staging.cfmeu.org/api/health | jq '.featureFlags'
   ```

3. **Error Rate Check**
   ```bash
   # Ensure error rate < 1% before deployment
   curl https://staging.cfmeu.org/api/errors/stats | jq '.errorRate'
   ```

4. **Database Backup**
   - Verify recent backup completed
   - Test backup restoration procedure

### Deployment Strategies

#### 1. Canary Deployment (Recommended)
```bash
# Start with 10% traffic
npm run deploy -- --strategy=canary --rollout=10

# Monitor for 15 minutes
npm run monitor-deployment -- --deployment-id=<id>

# Gradually increase if healthy
npm run rollout-increase -- --deployment-id=<id> --percentage=25
```

#### 2. Blue-Green Deployment
```bash
# Deploy to green environment
npm run deploy -- --strategy=blue-green

# Run health checks on green
npm run health-check -- --environment=green

# Switch traffic
npm run traffic-switch -- --to=green
```

#### 3. Rolling Deployment
```bash
# Gradual rolling update
npm run deploy -- --strategy=rolling --batch-size=10%
```

### Deployment Monitoring

During deployment, monitor:

1. **Health Check Status**
   ```bash
   watch -n 30 'curl -s https://app.cfmeu.org/api/health | jq ".status, .score"'
   ```

2. **Error Rates**
   ```bash
   watch -n 60 'curl -s https://app.cfmeu.org/api/errors/stats | jq ".errorRate, .totalOccurrences"'
   ```

3. **Response Times**
   ```bash
   watch -n 30 'curl -s https://app.cfmeu.org/api/health | jq ".checks[].duration"'
   ```

## Emergency Response

### Emergency Shutdown

If critical issues are detected:

1. **Immediate Shutdown**
   ```bash
   curl -X POST https://app.cfmeu.org/api/emergency/shutdown \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"reason": "Critical system failure"}'
   ```

2. **Manual Feature Flag Disable**
   ```bash
   # Disable rating system
   curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"flag": "RATING_SYSTEM_ENABLED", "action": "disable"}'
   ```

3. **Database Connection Protection**
   - Enable read-only mode
   - Kill long-running queries
   - Check connection pool status

### Emergency Contacts

| Role | Contact | Phone |
|------|---------|-------|
| DevOps Lead | devops@cfmeu.org | +61 XXX XXX XXX |
| System Admin | admin@cfmeu.org | +61 XXX XXX XXX |
| Rating Team | rating-team@cfmeu.org | +61 XXX XXX XXX |

### Escalation Procedures

1. **Level 1**: DevOps team (immediate)
2. **Level 2**: System administrators (5 minutes)
3. **Level 3**: Development team (15 minutes)
4. **Level 4**: Management (30 minutes)

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. High Error Rate (>5%)

**Symptoms:**
- Users reporting errors
- Health check status = unhealthy
- Multiple error alerts triggered

**Immediate Actions:**
1. Check error tracking dashboard
2. Identify error patterns
3. Check recent deployments
4. Consider emergency rollback

**Commands:**
```bash
# Get recent critical errors
curl -s "https://app.cfmeu.org/api/errors?severity=critical&limit=20"

# Check recent deployments
curl -s "https://app.cfmeu.org/api/deployments?status=active"

# Emergency rollback
curl -X POST "https://app.cfmeu.org/api/deployments/rollback" \
  -d '{"deploymentId": "<id>", "reason": "High error rate"}'
```

#### 2. Slow Response Times (>1000ms)

**Symptoms:**
- Users reporting slow performance
- Health check warnings
- Performance alerts triggered

**Immediate Actions:**
1. Check database performance
2. Review API response times
3. Check memory/CPU usage
4. Verify cache hit rates

**Commands:**
```bash
# Check system metrics
curl -s "https://app.cfmeu.org/api/health?detailed=true" | jq '.metrics'

# Check database performance
curl -s "https://app.cfmeu.org/api/health/database"

# Restart services if needed
kubectl rollout restart deployment/rating-system
```

#### 3. Database Connection Issues

**Symptoms:**
- Database connection errors
- Failed health checks
- Unable to save/load ratings

**Immediate Actions:**
1. Check database server status
2. Verify connection pool configuration
3. Check for long-running queries
4. Restart application if needed

**Commands:**
```bash
# Check database health
curl -s "https://app.cfmeu.org/api/health/database"

# Kill long-running queries
psql -h db.cfmeu.org -U admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# Check connection pool
curl -s "https://app.cfmeu.org/api/health?detailed=true" | jq '.checks[].details.connectionPool'
```

#### 4. Feature Flag Issues

**Symptoms:**
- Features not appearing/disappearing
- Inconsistent behavior across users
- Configuration errors

**Immediate Actions:**
1. Check feature flag status
2. Verify configuration
3. Check rollout percentages
4. Reset flags if needed

**Commands:**
```bash
# Check flag status
curl -s "https://app.cfmeu.org/api/feature-flags" | jq '.RATING_SYSTEM_ENABLED'

# Reset to defaults
curl -X POST "https://app.cfmeu.org/api/feature-flags/reset" \
  -H "Authorization: Bearer <admin-token>"
```

## Rollback Procedures

### Automatic Rollback

The system can automatically rollback if:

- Error rate exceeds 5%
- Response time exceeds 1000ms
- Health checks fail 3+ times
- Critical feature flags become disabled

### Manual Rollback

#### 1. Full Deployment Rollback
```bash
# Get active deployments
curl -s "https://app.cfmeu.org/api/deployments?status=active"

# Initiate rollback
curl -X POST "https://app.cfmeu.org/api/deployments/rollback" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "deploymentId": "<deployment-id>",
    "reason": "Manual rollback due to performance issues"
  }'
```

#### 2. Feature Flag Rollback
```bash
# Disable problematic features
curl -X POST "https://app.cfmeu.org/api/feature-flags/emergency" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "flags": ["RATING_ANALYTICS_ENABLED", "RATING_EXPORT_ENABLED"],
    "action": "disable"
  }'

# Re-enable stable features
curl -X POST "https://app.cfmeu.org/api/feature-flags/emergency" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "flags": ["RATING_SYSTEM_ENABLED", "RATING_DASHBOARD_ENABLED"],
    "action": "enable"
  }'
```

#### 3. Database Rollback
```bash
# For database issues, use point-in-time recovery
# Contact database team immediately

# Check backup status
curl -s "https://app.cfmeu.org/api/database/backup-status"

# Initiate restore (admin only)
curl -X POST "https://app.cfmeu.org/api/database/restore" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"backupId": "<backup-id>", "reason": "Critical data corruption"}'
```

### Rollback Verification

After rollback:

1. **Health Check Verification**
   ```bash
   curl -f https://app.cfmeu.org/api/health
   curl -f https://app.cfmeu.org/api/ratings/health
   ```

2. **Functionality Testing**
   - Test rating calculations
   - Verify dashboard access
   - Check mobile functionality

3. **Performance Monitoring**
   - Monitor error rates
   - Check response times
   - Verify user experience

## Monitoring Dashboard

### Key Metrics to Monitor

1. **System Health Score** (Target: >95)
2. **Error Rate** (Target: <1%)
3. **Response Time** (Target: <200ms)
4. **Database Performance** (Target: <500ms query time)
5. **Feature Flag Status** (Target: All critical flags enabled)

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | >1% | >5% |
| Response Time | >500ms | >1000ms |
| Health Score | <90 | <80 |
| Database Time | >500ms | >1000ms |
| Memory Usage | >80% | >90% |

### Dashboard Access

- **Production**: https://monitoring.cfmeu.org
- **Staging**: https://staging-monitoring.cfmeu.org
- **Development**: http://localhost:3000/monitoring

### API Access

```bash
# System health
curl -s "https://app.cfmeu.org/api/health" | jq '.status, .score, .issues'

# Error statistics
curl -s "https://app.cfmeu.org/api/errors/stats" | jq '.total, .bySeverity'

# Feature flags
curl -s "https://app.cfmeu.org/api/feature-flags" | jq '.systemStatus'

# Deployment status
curl -s "https://app.cfmeu.org/api/deployments" | jq '.active, .recent'
```

## Conclusion

This deployment safety and monitoring system provides comprehensive protection for the CFMEU rating system. Key features include:

- **Safe Deployment**: Feature flags and gradual rollout
- **Real-time Monitoring**: Health checks and performance metrics
- **Error Tracking**: Comprehensive error collection and alerting
- **Emergency Response**: Automatic rollback and shutdown capabilities
- **Troubleshooting**: Detailed guides and procedures

Regular testing of these procedures is recommended to ensure team readiness during actual incidents.

For additional support or questions, contact the DevOps team at devops@cfmeu.org.