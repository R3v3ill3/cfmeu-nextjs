#!/bin/bash

# Supabase DB Push Helper
# This script works around the link password issue by using --db-url

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD="R3v3ill3_Strategy"
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

echo "🚀 Pushing Supabase migrations with updated password..."
echo ""

# Check if --include-all flag is needed
if [ "$1" = "--include-all" ] || [ "$1" = "-a" ]; then
  echo "Including ALL migrations (even out-of-order ones)..."
  npx supabase db push --include-all --db-url "$DB_URL"
else
  echo "Pushing in-order migrations only..."
  echo "Use: $0 --include-all to include out-of-order migrations"
  npx supabase db push --db-url "$DB_URL"
fi

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Migration push completed successfully!"
else
  echo "❌ Migration push failed. See error above."
  echo ""
  echo "💡 Common fixes:"
  echo "   1. Run the SQL in apply_apple_email_migration_manually.sql in Supabase SQL Editor"
  echo "   2. Check if migrations are already applied"
  echo "   3. Verify database password is correct"
fi

