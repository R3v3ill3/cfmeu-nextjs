#!/bin/bash

# Supabase Migration Repair Helper
# Uses --db-url to work around keychain password issue

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD="R3v3ill3_Strategy"
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

echo "🔧 Repairing Supabase migrations..."
echo "Usage: $0 --status reverted <version1> <version2> ..."
echo ""

npx supabase migration repair --db-url "$DB_URL" "$@"



