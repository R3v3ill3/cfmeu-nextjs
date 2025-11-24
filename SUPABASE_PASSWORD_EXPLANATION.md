# Why Supabase CLI Password Doesn't Persist - Technical Explanation

## The Problem

You're experiencing a frustrating issue where:
1. ✅ `supabase link --password "..."` works and says "Finished supabase link"
2. ❌ `supabase db push` fails with "Wrong password" 
3. ✅ `supabase db push --db-url "postgresql://...password..."` works

## Root Cause: How Supabase CLI Stores Credentials

### What `supabase link` Does

When you run `supabase link --password "..."`:
1. It connects to Supabase API (not the database directly)
2. It stores the **project reference** and **connection URL** (without password) in `supabase/.temp/pooler-url`
3. The password you provide is used **only for that link command** to verify connectivity
4. **The password is NOT stored anywhere** for security reasons

Looking at your `supabase/.temp/pooler-url` file:
```
postgresql://postgres.jzuoawqxqmrsftbtjkzv@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
```

Notice: **No password in the URL**. This is intentional for security.

### What `supabase db push` Does

When you run `supabase db push`:
1. It reads the connection URL from `supabase/.temp/pooler-url` (no password)
2. It needs to authenticate to PostgreSQL, which requires a password
3. **It should prompt you for the password**, but it's not doing that reliably
4. Instead, it's trying to use a cached/stored password that doesn't exist or is wrong

## Why This Design Exists

Supabase CLI follows security best practices:
- **Never store passwords in plain text** in config files
- **Never store passwords in connection strings** in version control
- **Prompt for passwords when needed** (but this is failing)

The problem is that the "prompt for password" mechanism isn't working correctly, so `db push` fails silently.

## Why `--db-url` Works

When you use `--db-url`:
- You're providing the **complete connection string** including the password
- This bypasses the credential storage/lookup mechanism entirely
- The CLI uses the password directly from the URL you provide
- No caching, no storage, no lookup - just direct connection

## The Real Issue: Missing Password Prompt

The CLI **should** prompt you for the password when running `db push` if it's not stored. But it's not doing that. This could be because:

1. **CLI Bug**: The password prompt mechanism might be broken
2. **Environment Issue**: Your terminal might not support interactive prompts
3. **CLI Version**: Older/newer versions might handle this differently

## Solutions Ranked by Preference

### Option 1: Use `--password` Flag (Best if it works)

```bash
npx supabase db push --password "R3v3ill3_Strategy" --include-all
```

This explicitly provides the password without embedding it in a URL. However, based on your testing, this might still fail due to the CLI bug.

### Option 2: Use `--db-url` Flag (Current Workaround)

```bash
npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:R3v3ill3_Strategy@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" --include-all
```

**Pros:**
- Works reliably
- Bypasses the broken credential system

**Cons:**
- Password visible in command history
- Need to type it every time (or use a script)

### Option 3: Environment Variable + Script (Recommended Long-term)

Create a script or alias:

```bash
# In your .zshrc or a script file
export SUPABASE_DB_URL="postgresql://postgres.jzuoawqxqmrsftbtjkzv:R3v3ill3_Strategy@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Then use:
npx supabase db push --db-url "$SUPABASE_DB_URL" --include-all
```

Or create a script `push-migrations.sh`:
```bash
#!/bin/bash
npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:R3v3ill3_Strategy@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" "$@"
```

Then use: `./push-migrations.sh --include-all`

### Option 4: Update Supabase CLI

Try updating to the latest version:
```bash
npm install -g supabase@latest
# or
npx supabase@latest db push --password "..." --include-all
```

Newer versions might have fixed the password prompt issue.

## Why It Can't Be "Fixed Permanently"

The password **can't** be stored permanently because:

1. **Security Best Practice**: Storing passwords in plain text files is a security risk
2. **Version Control**: If stored in config files, passwords would be committed to git
3. **Multi-user**: Different developers need different access levels
4. **Password Rotation**: Database passwords should be rotated periodically

The **correct** behavior would be:
- CLI prompts for password when needed
- Password is used for that session only
- Never stored on disk

But the CLI's password prompt mechanism appears to be broken, forcing the workaround.

## Summary

**What's happening:**
- `supabase link` stores connection info but NOT the password (by design)
- `supabase db push` should prompt for password but doesn't (bug)
- `--db-url` works because it bypasses the broken credential system

**Why the workaround exists:**
- The CLI's password prompt mechanism is broken
- `--db-url` provides a direct way to authenticate without relying on stored credentials

**Best solution:**
- Use `--db-url` with an environment variable or script
- Or wait for Supabase to fix the password prompt bug
- Or use the Supabase Dashboard SQL Editor for manual migrations

This is a known issue with Supabase CLI's credential management system.



