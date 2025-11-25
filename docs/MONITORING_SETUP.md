# Monitoring Setup Guide

This document describes how to set up Sentry (error tracking) and PostHog (user analytics) for the CFMEU uConstruct application.

## Overview

The monitoring stack consists of:
- **Sentry**: Error tracking, performance monitoring, and session replay
- **PostHog**: User analytics, session recordings, and feature flags

Both services are cloud-hosted SaaS platforms. You access dashboards at:
- Sentry: https://sentry.io
- PostHog: https://app.posthog.com

## Quick Start

### 1. Create Accounts

1. **Sentry**: Sign up at https://sentry.io/signup/
   - Create a new project for "Next.js"
   - Copy your DSN (looks like `https://xxx@xxx.ingest.sentry.io/xxx`)

2. **PostHog**: Sign up at https://app.posthog.com/signup
   - Create a new project
   - Copy your Project API Key (starts with `phc_`)

### 2. Set Environment Variables

#### For Vercel (Main Next.js App)

Add these to your Vercel project settings → Environment Variables:

```bash
# Sentry - Required
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx          # For source map uploads (optional but recommended)
SENTRY_ORG=your-org-slug              # From Sentry settings
SENTRY_PROJECT=your-project-slug      # From Sentry settings

# PostHog - Required
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx       # Project API Key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
POSTHOG_API_KEY=phx_xxx               # Personal API Key (for server-side, optional)

# Optional debug flags (set to 'true' to enable in development)
NEXT_PUBLIC_SENTRY_DEBUG=false
NEXT_PUBLIC_POSTHOG_DEBUG=false
SENTRY_DEBUG=false
```

#### For Railway (Workers)

Add these to each Railway service's Variables tab:

```bash
# Sentry - use a separate project DSN for workers if desired
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NODE_ENV=production

# Optional
SENTRY_DEBUG=false
```

### 3. Get Your Keys

#### Sentry DSN
1. Go to https://sentry.io
2. Select your project
3. Go to Settings → Projects → [Your Project] → Client Keys (DSN)
4. Copy the DSN

#### Sentry Auth Token (for source maps)
1. Go to https://sentry.io/settings/auth-tokens/
2. Create a new token with `project:releases` and `org:read` scopes
3. Copy the token

#### PostHog Project API Key
1. Go to https://app.posthog.com
2. Click Settings (gear icon)
3. Go to Project → Project API Key
4. Copy the key (starts with `phc_`)

#### PostHog Personal API Key (optional, for server-side)
1. Go to https://app.posthog.com
2. Click your profile → Personal API Keys
3. Create a new key
4. Copy the key (starts with `phx_`)

## What Gets Tracked

### Sentry
- **Errors**: All unhandled exceptions with stack traces
- **Performance**: Page load times, API response times
- **Session Replay**: See exactly what users did before an error (opt-in)
- **Breadcrumbs**: User actions leading up to an error

### PostHog
- **Page Views**: All page visits with timing
- **Sessions**: User sessions with full replay capability
- **Events**: Custom events like form submissions, button clicks
- **User Identification**: Linked to your Supabase auth users

## Dashboard Access

### Sentry Dashboard Features
- **Issues**: See all errors grouped by type
- **Performance**: API and page load metrics
- **Releases**: Track errors by deployment
- **User Feedback**: Built-in feedback widget

### PostHog Dashboard Features
- **Session Recordings**: Watch user sessions
- **Funnels**: Track conversion flows
- **User Paths**: See how users navigate
- **Dashboards**: Custom analytics views

## Testing the Integration

After setting environment variables and deploying:

### Test Sentry
1. Add this to any page temporarily:
```tsx
<button onClick={() => { throw new Error('Test Sentry Error'); }}>
  Test Sentry
</button>
```
2. Click the button
3. Check Sentry dashboard for the error

### Test PostHog
1. Visit any page in your app
2. Check PostHog → Activity → Live Events
3. You should see `$pageview` events appearing

## User Identification

Users are automatically identified when logged in. The integration connects:
- Sentry user context (for error attribution)
- PostHog user identification (for analytics)

To manually identify a user (e.g., after custom login flow):

```typescript
import { identifyMonitoringUser } from '@/hooks/useMonitoringIdentity';

identifyMonitoringUser(
  user.id,
  user.email,
  user.full_name,
  profile.role,
  profile.patches?.map(p => p.name)
);
```

## Disabling in Development

By default, both services are disabled in development to avoid polluting your data. To enable for testing:

```bash
# In .env.local
NEXT_PUBLIC_SENTRY_DEBUG=true
NEXT_PUBLIC_POSTHOG_DEBUG=true
```

## Cost Considerations

### Sentry
- **Free tier**: 5K errors/month, 10K transactions/month
- **Team tier**: ~$26/month for small teams
- For 30-50 users testing, free tier should be sufficient initially

### PostHog
- **Free tier**: 1M events/month, 5K session recordings
- **Team tier**: Usage-based pricing
- For 30-50 users, free tier should be sufficient

## Railway Worker Configuration

Each Railway worker has its own `monitoring.ts` file. To enable:

1. Add `SENTRY_DSN` to the Railway service variables
2. The worker will automatically:
   - Initialize Sentry on startup
   - Capture unhandled errors
   - Flush events on shutdown

Workers included:
- `cfmeu-dashboard-worker`
- `cfmeu-scraper-worker`
- `bci-import-worker`
- `mapping-sheet-scanner-worker`

## Troubleshooting

### Sentry events not appearing
1. Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify not in development mode (or set `SENTRY_DEBUG=true`)
3. Check browser console for Sentry initialization messages

### PostHog events not appearing
1. Check `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
2. Verify PostHog is initialized (check Network tab for `posthog.com` requests)
3. Check if user has ad-blocker (some block PostHog)

### Source maps not working in Sentry
1. Ensure `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set
2. Check Vercel build logs for source map upload messages
3. Verify the auth token has correct permissions

## Files Created

```
├── sentry.client.config.ts      # Client-side Sentry config
├── sentry.server.config.ts      # Server-side Sentry config
├── sentry.edge.config.ts        # Edge runtime Sentry config
├── src/
│   ├── instrumentation.ts       # Next.js instrumentation hook
│   ├── lib/posthog/
│   │   ├── client.ts            # PostHog client utilities
│   │   ├── server.ts            # PostHog server utilities
│   │   └── index.ts             # Exports
│   ├── providers/
│   │   └── PostHogProvider.tsx  # React provider for PostHog
│   └── hooks/
│       └── useMonitoringIdentity.ts  # User identification hook
└── railway_workers/
    └── */src/monitoring.ts      # Sentry config for each worker
```

