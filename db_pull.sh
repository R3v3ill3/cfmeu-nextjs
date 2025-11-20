#!/bin/bash

# Supabase DB Pull Helper
# Uses --db-url to work around keychain password issue

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD="R3v3ill3_Strategy"
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

echo "📥 Pulling Supabase migrations..."
npx supabase db pull --db-url "$DB_URL" "$@"

