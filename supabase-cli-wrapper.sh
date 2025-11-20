#!/bin/bash

# Supabase CLI Wrapper
# This script wraps all Supabase CLI commands with --db-url to work around
# the keychain password storage issue

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD="R3v3ill3_Strategy"
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Get the command (first argument)
COMMAND="$1"
shift  # Remove first argument, rest are flags

case "$COMMAND" in
  "db")
    SUBCOMMAND="$1"
    shift
    
    case "$SUBCOMMAND" in
      "push")
        echo "🚀 Pushing migrations..."
        npx supabase db push --db-url "$DB_URL" "$@"
        ;;
      "pull")
        echo "📥 Pulling migrations..."
        npx supabase db pull --db-url "$DB_URL" "$@"
        ;;
      "reset")
        echo "🔄 Resetting database..."
        npx supabase db reset --db-url "$DB_URL" "$@"
        ;;
      "diff")
        echo "🔍 Diffing database..."
        npx supabase db diff --db-url "$DB_URL" "$@"
        ;;
      *)
        echo "Unknown db subcommand: $SUBCOMMAND"
        echo "Supported: push, pull, reset, diff"
        exit 1
        ;;
    esac
    ;;
  "migration")
    SUBCOMMAND="$1"
    shift
    
    case "$SUBCOMMAND" in
      "list")
        echo "📋 Listing migrations..."
        npx supabase migration list --db-url "$DB_URL" "$@"
        ;;
      "repair")
        echo "🔧 Repairing migration..."
        # Migration repair needs --db-url for each flag
        if [[ "$1" == "--status" ]]; then
          STATUS="$2"
          shift 2
          # Build repair command with remaining version numbers
          npx supabase migration repair --db-url "$DB_URL" --status "$STATUS" "$@"
        else
          npx supabase migration repair --db-url "$DB_URL" "$@"
        fi
        ;;
      *)
        echo "Unknown migration subcommand: $SUBCOMMAND"
        echo "Supported: list, repair"
        exit 1
        ;;
    esac
    ;;
  "link")
    # Link doesn't need db-url, but we'll pass it anyway for consistency
    echo "🔗 Linking project..."
    npx supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD" "$@"
    ;;
  *)
    # For any other command, try to pass --db-url if it's a db-related command
    if [[ "$COMMAND" == *"db"* ]]; then
      echo "⚠️  Attempting with --db-url..."
      npx supabase "$COMMAND" --db-url "$DB_URL" "$@"
    else
      # For non-db commands, just pass through
      echo "⚠️  Running without --db-url (may fail if password needed)..."
      npx supabase "$COMMAND" "$@"
    fi
    ;;
esac

