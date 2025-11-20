# Supabase Migration Push Fix Guide

## Problem
Migration push fails with SCRAM authentication error:
```
failed SASL auth (invalid SCRAM server-final-message received from server)
```

**Root Cause**: The database password stored by Supabase CLI is incorrect or has been changed.

## Solution Steps

### Option 1: Use --db-url Flag (RECOMMENDED - Works Immediately)

**This is the fastest solution** - bypasses stored credentials entirely.

1. **Get Database Password from Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/jzuoawqxqmrsftbtjkzv
   - Go to **Settings** → **Database**
   - Scroll to **Connection string** section
   - If you don't know the password, click **"Reset database password"**
   - Copy the password (you'll only see it once if resetting!)

2. **Push Migrations with Connection String**
   ```bash
   cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
   npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
   ```
   - Replace `YOUR_PASSWORD` with your actual database password
   - This bypasses stored credentials and works immediately

3. **For Future Migrations**
   - You can use the same `--db-url` flag each time
   - Or store the password securely and use it in a script
   - Or re-link the project (see Option 2 below)

### Option 2: Re-link Project (For Long-term Use)

**Use this if you want to use `supabase db push` without the `--db-url` flag each time.**

1. **Unlink Current Project** (if already linked with wrong password)
   ```bash
   cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
   npx supabase unlink
   ```

2. **Get/Reset Database Password from Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/jzuoawqxqmrsftbtjkzv
   - Go to **Settings** → **Database**
   - Scroll to **Connection string** section
   - Click **"Reset database password"** button
   - Copy the new password (you'll only see it once!)
   - Save it securely (password manager)

3. **Re-link Project with Password**
   ```bash
   npx supabase link --project-ref jzuoawqxqmrsftbtjkzv --password "your-new-password"
   ```
   - Replace `"your-new-password"` with the password from step 2
   - The CLI will store it securely for future use

4. **Note**: Even after linking, `db push` may still fail. If so, use Option 1 with `--db-url` instead.

### Option 2: Use Direct Connection (Skip Pooler)

If the pooler connection continues to fail, you can use the direct connection:

1. **Get Database Password** (same as Option 1, step 2)

2. **Link with Direct Connection**
   ```bash
   npx supabase link --project-ref jzuoawqxqmrsftbtjkzv --password "your-password" --skip-pooler
   ```
   - The `--skip-pooler` flag uses direct connection instead of pooler

### Option 3: Manual Migration via SQL Editor

If CLI continues to fail, you can apply migrations manually:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/jzuoawqxqmrsftbtjkzv/sql

2. **Apply Each Migration**
   - Open each migration file from `supabase/migrations/`
   - Copy the SQL content
   - Paste into SQL Editor
   - Click "Run"

3. **Track Applied Migrations**
   - Check `supabase_migrations.schema_migrations` table to see which migrations have been applied
   - Only apply migrations that haven't been applied yet

## Verification

After fixing the connection:

```bash
# Push migrations (using --db-url method)
npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Or if you've successfully re-linked:
npx supabase db push

# Verify migrations applied
npx supabase migration list --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

## Working Solution Summary

✅ **The connection works using `--db-url` flag with full connection string**

The command that works:
```bash
npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

**Note**: Replace `YOUR_PASSWORD` with your actual database password from the Supabase dashboard.

## Troubleshooting

### If password reset doesn't work:
1. Check if you have the correct project reference ID: `jzuoawqxqmrsftbtjkzv`
2. Verify you have access to the Supabase project
3. Try logging out and back into Supabase CLI:
   ```bash
   npx supabase logout
   npx supabase login
   npx supabase link --project-ref jzuoawqxqmrsftbtjkzv
   ```

### If pooler connection fails:
- The pooler endpoint (`aws-0-ap-southeast-2.pooler.supabase.com`) may have issues
- Try using the direct connection string instead
- Check Supabase status page for any service issues

### Alternative: Use Supabase Dashboard SQL Editor
- All migrations can be applied manually via the SQL Editor
- This bypasses CLI connection issues entirely
- Just ensure migrations are applied in chronological order

## Prevention

To avoid this issue in the future:
1. **Document the database password** securely (password manager)
2. **Use Supabase CLI password management** - let CLI store it securely
3. **Set up CI/CD** - use service role key for automated migrations
4. **Regular connection tests** - periodically verify CLI connection works

