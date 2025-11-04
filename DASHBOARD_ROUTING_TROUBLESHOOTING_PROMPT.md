# Dashboard Routing Troubleshooting Agent Prompt

## Context
This is a Next.js 14.2.33 application using the App Router architecture for the CFMEU NSW construction union organizing database. The application has been working historically but the dashboard stopped building properly in localhost development.

## Recent Changes Made
1. **Root Page Creation**: Created `src/app/page.tsx` to fix 404 routing issues
2. **Duplicate Page Removal**: Removed conflicting `src/app/(app)/page.tsx` file
3. **Route Group Conflict Resolution**: Attempted to resolve duplicate page.tsx files
4. **Final Fix Attempt**: Moved page.tsx back into (app) route group at `src/app/(app)/page.tsx`

## Current Problem
- Browser shows error: "Missing required html tags: <html>, <body>"
- Terminal shows: `GET / 404 in [time]` and `○ Compiling /_not-found/page ...`
- Development server compiles successfully but root path `http://localhost:3000` returns 404
- Dashboard was previously working but is now inaccessible

## Application Architecture
- Uses Next.js App Router with route groups
- Has multiple layout files:
  - `src/app/layout.tsx` (root layout with basic HTML structure)
  - `src/app/(app)/layout.tsx` (authentication + providers + desktop/mobile layouts)
  - `src/app/mobile/layout.tsx` (mobile-specific layout)
- Route group structure:
  - `(app)` - authenticated desktop/mobile routes
  - `(auth)` - authentication routes
  - `mobile` - mobile-specific routes
  - API routes at `/api/*`

## Ineffective Troubleshooting Steps Taken
1. **File Conflict Resolution**: Removed duplicate page.tsx files
2. **Simplified Page Content**: Stripped page to basic HTML to test routing
3. **Development Server Restart**: Used `pnpm dev:all` to clear ports and restart
4. **Cache Clearing**: Removed `.next` build cache
5. **File Touching**: Forced recompilation by touching layout files
6. **Layout Analysis**: Reviewed all layout.tsx files for proper HTML structure
7. **Route Group Investigation**: Analyzed route group hierarchy and conflicts

## Current State
- `src/app/(app)/page.tsx` exists and imports DesktopDashboardView
- All layout files appear structurally correct
- Development server starts and compiles without TypeScript errors
- Root path still returns 404 instead of dashboard
- Browser error suggests layout.tsx is not being applied correctly

## Task
Investigate and resolve the 404 routing issue preventing the dashboard from loading at the root path. The application architecture uses complex route groups and authentication flows that may be causing routing conflicts or layout inheritance issues.