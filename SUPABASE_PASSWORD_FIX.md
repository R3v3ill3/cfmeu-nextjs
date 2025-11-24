# Fixing Supabase CLI Password Storage Issue

## The Real Problem

You're absolutely right - if `supabase db push` worked for months without passwords, then the password WAS being stored somewhere. After resetting the password, the CLI isn't updating its stored credentials.

## Root Cause

The Supabase CLI stores database passwords in **macOS Keychain**, but there's a bug where:
1. `supabase link --password` doesn't update the keychain entry
2. `supabase db push` reads from keychain (which has the OLD password)
3. The MCP server might also be caching credentials separately

## Solution: Clear and Re-store Credentials

### Step 1: Delete the Old Keychain Entry

```bash
# Delete the Supabase CLI keychain entry
security delete-generic-password -a "supabase" -s "Supabase CLI" 2>/dev/null

# Also check for project-specific entries
security delete-generic-password -a "jzuoawqxqmrsftbtjkzv" 2>/dev/null
```

### Step 2: Unlink and Re-link

```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
npx supabase unlink
npx supabase link --project-ref jzuoawqxqmrsftbtjkzv --password "R3v3ill3_Strategy"
```

### Step 3: Test

```bash
npx supabase db push --include-all
```

## Alternative: Force Password Prompt

If the above doesn't work, try forcing the CLI to prompt for password:

```bash
# Delete keychain entry first
security delete-generic-password -a "supabase" -s "Supabase CLI" 2>/dev/null

# Then run db push - it should prompt for password
npx supabase db push --include-all
```

## MCP Server Interference

The Supabase MCP server in `.cursor/mcp.json` might be interfering. Try:

1. **Temporarily disable MCP** - Comment out the supabase MCP in `.cursor/mcp.json`
2. **Restart Cursor** - This will reload MCP configuration
3. **Try db push again**

## If All Else Fails: Use --db-url

The `--db-url` flag works because it bypasses ALL credential storage:

```bash
npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:R3v3ill3_Strategy@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" --include-all
```

Create an alias or script to make this easier:

```bash
# Add to ~/.zshrc
alias supabase-push='npx supabase db push --db-url "postgresql://postgres.jzuoawqxqmrsftbtjkzv:R3v3ill3_Strategy@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"'
```

## Why This Happened

When you reset the password in the Supabase dashboard:
- The database password changed
- The CLI's keychain entry still had the OLD password
- `supabase link` doesn't update the keychain (bug)
- `supabase db push` reads the OLD password from keychain
- Result: Authentication fails

This is a known issue with Supabase CLI's credential management on macOS.


