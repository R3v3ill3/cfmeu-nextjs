# CFMEU Rating System - Troubleshooting Quick Reference

## 🚨 Emergency Response (First 5 Minutes)

### Critical System Failure
```bash
# 1. Emergency shutdown
curl -X POST https://app.cfmeu.org/api/emergency/shutdown \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Critical system failure"}'

# 2. Check system status
curl -s https://app.cfmeu.org/api/health | jq '.status, .score'

# 3. Check recent errors
curl -s "https://app.cfmeu.org/api/errors?severity=critical&limit=10"

# 4. Contact team
# DevOps: devops@cfmeu.org | +61 XXX XXX XXX
```

### High Error Rate (>5%)
```bash
# Immediate rollback
curl -X POST https://app.cfmeu.org/api/deployments/rollback \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "High error rate"}'

# Disable rating features
curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"flags": ["RATING_SYSTEM_ENABLED"], "action": "disable"}'
```

## 🔍 Health Check Commands

### Quick Health Status
```bash
# Basic health check
curl -f https://app.cfmeu.org/api/health

# Detailed health check
curl -s https://app.cfmeu.org/api/health?detailed=true | jq '.'

# Rating system health
curl -s https://app.cfmeu.org/api/ratings/health | jq '.status, .score, .issues'
```

### Response Headers Check
```bash
# Health status from headers
curl -I https://app.cfmeu.org/api/health | grep -E "X-Health-|X-Response-"
```

Expected good response:
```
X-Health-Status: healthy
X-Health-Score: 98
X-Response-Time: 45
X-Environment: production
```

## 📊 Monitoring Commands

### System Metrics
```bash
# Current metrics
curl -s https://app.cfmeu.org/api/health?detailed=true | jq '.metrics'

# Error statistics
curl -s https://app.cfmeu.org/api/errors/stats | jq '.'

# Feature flags status
curl -s https://app.cfmeu.org/api/feature-flags | jq '.systemStatus'
```

### Performance Monitoring
```bash
# Watch health score
watch -n 30 'curl -s https://app.cfmeu.org/api/health | jq ".status, .score"'

# Watch error rate
watch -n 60 'curl -s https://app.cfmeu.org/api/errors/stats | jq ".errorRate, .total"'

# Watch response times
watch -n 30 'curl -s https://app.cfmeu.org/api/health | jq ".checks[].duration"'
```

## 🚨 Common Issues & Solutions

### Issue 1: Database Connection Problems
**Symptoms:**
- Database connection errors in logs
- Failed health checks
- Unable to save/load ratings

**Quick Fix:**
```bash
# Check database health
curl -s https://app.cfmeu.org/api/health/database

# Restart application
kubectl rollout restart deployment/rating-system

# Check connection pool
curl -s https://app.cfmeu.org/api/health?detailed=true | jq '.checks[] | select(.name=="database")'
```

### Issue 2: Slow Performance
**Symptoms:**
- Response times > 500ms
- Users reporting slowness
- Performance alerts

**Quick Fix:**
```bash
# Check memory usage
curl -s https://app.cfmeu.org/api/health?detailed=true | jq '.metrics.memory'

# Clear caches
curl -X POST https://app.cfmeu.org/api/cache/clear \
  -H "Authorization: Bearer <admin-token>"

# Restart services
kubectl rollout restart deployment/rating-system
```

### Issue 3: Rating Calculation Failures
**Symptoms:**
- Rating calculations failing
- Calculation errors in logs
- Inaccurate ratings

**Quick Fix:**
```bash
# Check rating engine health
curl -s https://app.cfmeu.org/api/ratings/health | jq '.components.calculationEngine'

# Recalculate problematic ratings
curl -X POST https://app.cfmeu.org/api/ratings/recalculate \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"employerId": "<id>", "force": true}'

# Check for calculation errors
curl -s "https://app.cfmeu.org/api/errors?category=calculation" | jq '.'
```

### Issue 4: Feature Flag Issues
**Symptoms:**
- Features not working
- Inconsistent behavior
- Configuration errors

**Quick Fix:**
```bash
# Check flag status
curl -s https://app.cfmeu.org/api/feature-flags | jq '.RATING_SYSTEM_ENABLED'

# Reset critical flags
curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "flags": ["RATING_SYSTEM_ENABLED", "RATING_DASHBOARD_ENABLED"],
    "action": "enable"
  }'

# Refresh flag configuration
curl -X POST https://app.cfmeu.org/api/feature-flags/refresh \
  -H "Authorization: Bearer <admin-token>"
```

## 🔧 Feature Flag Management

### Check Flag Status
```bash
# All flags
curl -s https://app.cfmeu.org/api/feature-flags | jq '.'

# Specific flag
curl -s https://app.cfmeu.org/api/feature-flags | jq '.RATING_SYSTEM_ENABLED'

# System status
curl -s https://app.cfmeu.org/api/feature-flags | jq '.systemStatus'
```

### Emergency Flag Operations
```bash
# Disable all rating features
curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"action": "disable-all", "reason": "Emergency"}'

# Enable core features only
curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "flags": ["RATING_SYSTEM_ENABLED", "RATING_DASHBOARD_ENABLED"],
    "action": "enable"
  }'
```

## 📱 Mobile-Specific Issues

### Mobile Performance Problems
```bash
# Check mobile optimization status
curl -s https://app.cfmeu.org/api/health | jq '.checks[] | select(.name=="mobile")'

# Mobile health check
curl -s "https://app.cfmeu.org/api/health?user-agent=Mobile" | jq '.'

# Disable mobile features if needed
curl -X POST https://app.cfmeu.org/api/feature-flags/emergency \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"flags": ["MOBILE_RATINGS_ENABLED"], "action": "disable"}'
```

### Mobile-Specific Health Check
```bash
# Test mobile endpoints
curl -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" \
  https://app.cfmeu.org/api/ratings/dashboard

# Check mobile-specific metrics
curl -s "https://app.cfmeu.org/api/health?detailed=true" | jq '.metrics.mobile'
```

## 🚀 Deployment Issues

### Deployment Failure
```bash
# Check active deployments
curl -s https://app.cfmeu.org/api/deployments | jq '.active'

# Get deployment details
curl -s "https://app.cfmeu.org/api/deployments/<id>" | jq '.'

# Cancel active deployment
curl -X POST https://app.cfmeu.org/api/deployments/<id>/cancel \
  -H "Authorization: Bearer <admin-token>"
```

### Rollback Operations
```bash
# Quick rollback (last deployment)
curl -X POST https://app.cfmeu.org/api/deployments/rollback/last \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Performance issues"}'

# Specific deployment rollback
curl -X POST https://app.cfmeu.org/api/deployments/rollback \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"deploymentId": "<id>", "reason": "Critical errors"}'

# Check rollback status
curl -s https://app.cfmeu.org/api/deployments/<id> | jq '.status'
```

## 📈 Log Analysis

### Error Log Patterns
```bash
# Recent critical errors
curl -s "https://app.cfmeu.org/api/errors?severity=critical&limit=20" | jq '.[] | {timestamp, message, component}'

# Errors by category
curl -s https://app.cfmeu.org/api/errors/stats | jq '.byCategory'

# Top error messages
curl -s "https://app.cfmeu.org/api/errors?limit=10" | jq '.[] | .error.message'
```

### Performance Logs
```bash
# Slow requests
curl -s "https://app.cfmeu.org/api/metrics/slow-requests?limit=20"

# Database slow queries
curl -s "https://app.cfmeu.org/api/metrics/database/slow-queries"

# Cache performance
curl -s "https://app.cfmeu.org/api/metrics/cache" | jq '.hitRate'
```

## 🔐 Security Issues

### Security Incident Response
```bash
# Emergency disable all user features
curl -X POST https://app.cfmeu.org/api/emergency/security-lockdown \
  -H "Authorization: Bearer <admin-token>"

# Check for suspicious activity
curl -s "https://app.cfmeu.org/api/security/activity?since=1h"

# Rotate API keys
curl -X POST https://app.cfmeu.org/api/admin/rotate-keys \
  -H "Authorization: Bearer <admin-token>"
```

## 📞 Contact Information

### Emergency Contacts
| Role | Email | Phone | Available |
|------|-------|-------|-----------|
| DevOps Lead | devops@cfmeu.org | +61 XXX XXX XXX | 24/7 |
| System Admin | admin@cfmeu.org | +61 XXX XXX XXX | 24/7 |
| Rating Team | rating-team@cfmeu.org | +61 XXX XXX XXX | Business hours |
| Security Team | security@cfmeu.org | +61 XXX XXX XXX | 24/7 |

### Escalation Matrix
1. **Level 1**: DevOps team (0-5 minutes)
2. **Level 2**: System administrators (5-15 minutes)
3. **Level 3**: Development team (15-30 minutes)
4. **Level 4**: Management (30+ minutes)

## 🔧 Useful Scripts

### System Health Check Script
```bash
#!/bin/bash
# health-check.sh

echo "=== CFMEU Rating System Health Check ==="
echo "Timestamp: $(date)"
echo

# Basic health
HEALTH=$(curl -s https://app.cfmeu.org/api/health)
STATUS=$(echo $HEALTH | jq -r '.status')
SCORE=$(echo $HEALTH | jq -r '.score')

echo "Health Status: $STATUS"
echo "Health Score: $SCORE/100"

if [ "$STATUS" != "healthy" ]; then
    echo "⚠️  HEALTH ISSUES DETECTED"
    echo "Recent errors:"
    curl -s "https://app.cfmeu.org/api/errors?severity=high&limit=5" | jq '.[] | .error.message'
fi

echo
echo "=== Feature Flags ==="
curl -s https://app.cfmeu.org/api/feature-flags | jq '.systemStatus'

echo
echo "=== Recent Errors (last hour) ==="
curl -s "https://app.cfmeu.org/api/errors/stats" | jq '.total, .errorRate'
```

### Quick Deployment Script
```bash
#!/bin/bash
# deploy.sh

VERSION=${1:-$(git rev-parse --short HEAD)}
STRATEGY=${2:-canary}
ROLLOUT=${3:-10}

echo "Deploying version $VERSION with $STRATEGY strategy ($ROLLOUT% rollout)"

# Pre-deployment health check
echo "Pre-deployment health check..."
if ! curl -f https://staging.cfmeu.org/api/health; then
    echo "❌ Pre-deployment health check failed"
    exit 1
fi

# Deploy
curl -X POST https://app.cfmeu.org/api/deployments \
    -H "Authorization: Bearer $DEPLOY_TOKEN" \
    -d "{
        \"version\": \"$VERSION\",
        \"strategy\": \"$STRATEGY\",
        \"rolloutPercentage\": $ROLLOUT,
        \"autoRollback\": true
    }"

echo "Deployment initiated. Monitor with:"
echo "curl -s https://app.cfmeu.org/api/deployments | jq '.active'"
```

## 📋 Quick Response Checklist

### When Alert Fires:
1. ☐ Acknowledge alert (Slack/email)
2. ☐ Check system health: `curl -s https://app.cfmeu.org/api/health`
3. ☐ Check error rate: `curl -s https://app.cfmeu.org/api/errors/stats`
4. ☐ Check recent deployments: `curl -s https://app.cfmeu.org/api/deployments`
5. ☐ Identify affected components
6. ☐ Determine if rollback needed
7. ☐ Execute fix or rollback
8. ☐ Verify resolution
9. ☐ Document incident
10. ☐ Communicate to stakeholders

### Before Making Changes:
1. ☐ Check current system health
2. ☐ Review recent error patterns
3. ☐ Verify no active deployments
4. ☐ Have rollback plan ready
5. ☐ Notify team of changes

### After Resolving Incident:
1. ☐ Verify system health restored
2. ☐ Check error rates returned to normal
3. ☐ Monitor for 30 minutes
4. ☐ Document root cause
5. ☐ Update runbooks
6. ☐ Schedule post-mortem

---

**Remember**: When in doubt, prioritize system stability over features. It's better to disable features temporarily than risk system failure.

For detailed procedures, see [RATING_SYSTEM_DEPLOYMENT_GUIDE.md](./RATING_SYSTEM_DEPLOYMENT_GUIDE.md).