# Fixing Supabase CLI Password Storage - Complete Solution

## The Problem

After resetting your Supabase database password, the CLI stopped working because:
1. The password is stored in macOS Keychain
2. `supabase link` doesn't update the keychain entry properly (bug)
3. Commands like `db push`, `db pull`, etc. read the OLD password from keychain → fail

## Solution: Wrapper Scripts

I've created wrapper scripts that use `--db-url` to bypass the broken keychain system.

### Available Scripts

1. **`db_push.sh`** - Push migrations
   ```bash
   ./db_push.sh --include-all
   ```

2. **`db_pull.sh`** - Pull migrations  
   ```bash
   ./db_pull.sh
   ```

3. **`supabase-cli-wrapper.sh`** - Wrapper for all commands
   ```bash
   ./supabase-cli-wrapper.sh db push --include-all
   ./supabase-cli-wrapper.sh db pull
   ./supabase-cli-wrapper.sh migration list
   ```

## Better Solution: Shell Function (Recommended)

Add this to your `~/.zshrc` to make `supabase` command work automatically:

```bash
# Supabase CLI wrapper function
supabase() {
  local PROJECT_REF="jzuoawqxqmrsftbtjkzv"
  local DB_PASSWORD="R3v3ill3_Strategy"
  local DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
  
  # Commands that need --db-url
  case "$1" in
    "db")
      case "$2" in
        "push"|"pull"|"reset"|"diff")
          command npx supabase "$@" --db-url "$DB_URL"
          ;;
        *)
          command npx supabase "$@"
          ;;
      esac
      ;;
    "migration")
      case "$2" in
        "list"|"repair")
          command npx supabase "$@" --db-url "$DB_URL"
          ;;
        *)
          command npx supabase "$@"
          ;;
      esac
      ;;
    *)
      # For other commands, try without --db-url first
      command npx supabase "$@"
      ;;
  esac
}
```

After adding, reload your shell:
```bash
source ~/.zshrc
```

Now you can use `supabase` commands normally:
```bash
supabase db push --include-all
supabase db pull
supabase migration list
```

## Why This Works

- `--db-url` bypasses the broken keychain credential system
- All database-related commands work reliably
- No need to remember workarounds

## Security Note

The password is stored in:
- Shell scripts (in repo - consider adding to `.gitignore` or using env vars)
- Shell function (in `~/.zshrc` - local only)

For better security, use environment variables:

```bash
# In ~/.zshrc
export SUPABASE_DB_PASSWORD="R3v3ill3_Strategy"
export SUPABASE_PROJECT_REF="jzuoawqxqmrsftbtjkzv"
export SUPABASE_DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Then update scripts/functions to use $SUPABASE_DB_URL
```

## Testing

Test the fix:
```bash
# Should work now
supabase db pull
supabase db push --include-all
supabase migration list
```

## Root Cause

This is a known Supabase CLI bug where:
- Keychain entries aren't updated when password changes
- `supabase link` doesn't properly update stored credentials
- The CLI reads stale credentials from keychain

The `--db-url` workaround is the most reliable solution until Supabase fixes this bug.

