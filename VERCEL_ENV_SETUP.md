# Vercel Environment Variables for 4-Point Rating System

## Required Environment Variables

Add these to your Vercel project dashboard under Settings > Environment Variables:

### Rating System Feature Flags
```
RATING_SYSTEM_4POINT=true
RATING_SYSTEM_ENABLED=true
RATING_DASHBOARD_ENABLED=true
RATING_WIZARD_ENABLED=true
RATING_COMPARISON_ENABLED=true
MOBILE_RATINGS_ENABLED=true
MOBILE_OPTIMIZATIONS_ENABLED=true
RATING_ANALYTICS_ENABLED=true
RATING_EXPORT_ENABLED=true
RATING_BATCH_OPERATIONS_ENABLED=true
```

### Optional Feature Flags (for debugging)
```
ENHANCED_ERROR_TRACKING_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
DETAILED_LOGGING_ENABLED=true
```

### Supabase Configuration (already should be set)
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_URL=your_supabase_url
```

### Other Configuration
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

## Instructions

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add each of the above variables with their values
4. Make sure to select the appropriate environments (Production, Preview, Development)
5. Redeploy your application

## Database Migration

Ensure the following migrations have been applied to your production Supabase database:
- `20250131040000_fix_weighted_rating_calculations.sql`
- `20250131050000_rating_weight_configuration.sql`

You can run these migrations using:
```bash
supabase db push
```

## Verification

After deployment, verify the rating system is working by:
1. Navigate to an employer's detail page
2. Click on the "Traffic Light Rating" tab
3. The 4-point rating system should be visible without the "Not Available" error
4. The "Add Assessment" button should open the rating wizard