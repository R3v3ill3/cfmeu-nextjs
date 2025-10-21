# Environment Variables Configuration

## Materialized View Feature Flag

Add this environment variable to control the materialized view optimization:

```bash
# Enable/Disable Employer Search Materialized View
# Set to 'false' to instantly rollback to old behavior
# Default: true (uses optimized materialized view)
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true
```

## Configuration by Environment

### Development (.env.local)
```bash
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true
NEXT_PUBLIC_SHOW_DEBUG_BADGES=true
```

### Staging
```bash
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true
NEXT_PUBLIC_SHOW_DEBUG_BADGES=true
```

### Production
```bash
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true  # Start with false, enable gradually
NEXT_PUBLIC_SHOW_DEBUG_BADGES=false     # Hide debug info in production
```

## Rollback Procedure

If issues occur in production:

1. Set the environment variable to `false`:
   ```bash
   NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=false
   ```

2. Redeploy (takes ~2-3 minutes on Vercel)

3. Site immediately uses old query path

No code changes needed - instant rollback!

## Monitoring

When feature flag is enabled, check console logs:
- ✅ Success: "🚀 Using materialized view for employer search"
- ❌ Rollback: "📊 Using analytics view for employer search"

API responses include debug info:
```json
{
  "debug": {
    "queryTime": 150,
    "usedMaterializedView": true
  }
}
```

## Related Variables

These existing variables work alongside the new materialized view:

```bash
# Server-side processing (already enabled)
NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS=true

# Debug output
NEXT_PUBLIC_SHOW_DEBUG_BADGES=true
```


