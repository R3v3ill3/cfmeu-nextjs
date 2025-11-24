# Vercel Supabase Environment Variables - Quick Fix

## Issue

Error in Vercel logs:
```
[Error: Your project's URL and Key are required to create a Supabase client!]
```

## Root Cause

The server-side Supabase client (`src/lib/supabase/server.ts`) requires both:
1. ✅ Supabase URL (you have this)
2. ❌ Supabase Anon Key (you're missing this)

## Required Environment Variables in Vercel

You need to set these in Vercel Dashboard → Settings → Environment Variables:

### Required (Minimum)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jzuoawqxqmrsftbtjkzv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ← YOU'RE MISSING THIS
```

### Optional (Server-Side Only)
These can be set instead of or in addition to the `NEXT_PUBLIC_*` versions:
```bash
SUPABASE_URL=https://jzuoawqxqmrsftbtjkzv.supabase.co  # You already have this
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Optional server-side version
```

## How to Get Your Supabase Anon Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Find the **anon/public** key
5. Copy the entire key (it starts with `eyJ...`)

## Quick Fix Steps

1. **Get your anon key** from Supabase Dashboard (Settings → API → anon/public key)
2. **Add to Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Click "Add New"
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: Paste your anon key from Supabase
   - Environment: Select **Production** (and **Preview** if you want)
   - Click "Save"
3. **Redeploy** your application (or wait for next automatic deployment)

## Why You Need This

The server-side code (`src/lib/supabase/server.ts`) creates Supabase clients for:
- Authentication checks
- Database queries
- User profile lookups

Without the anon key, these operations fail with the error you're seeing.

## Verification

After adding the variable and redeploying:

1. Check Vercel logs - the error should be gone
2. Visit your production site - it should load without 500 errors
3. Try logging in - authentication should work

## Current Status

✅ You have:
- `NEXT_PUBLIC_SUPABASE_URL` 
- `SUPABASE_URL`

❌ You're missing:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← **ADD THIS**

## Note About Variable Names

The code accepts either:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + server accessible)
- `SUPABASE_ANON_KEY` (server-only)

Both work, but `NEXT_PUBLIC_SUPABASE_ANON_KEY` is recommended since it's also used by client-side code.




