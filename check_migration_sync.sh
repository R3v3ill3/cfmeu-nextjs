#!/bin/bash

# Migration Sync Diagnostic Script
# Compares local migration files with what's tracked in remote database

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD='%21R3v3ill3-Strategy%21'
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"

echo "🔍 Migration Sync Diagnostic"
echo "============================"
echo ""

# Get list of local migrations (properly named ones only)
echo "📁 Local migrations (properly named):"
echo "-------------------------------------"
LOCAL_MIGRATIONS=$(find supabase/migrations -name "*.sql" -type f | grep -E "^supabase/migrations/[0-9]{14}_" | sort)
echo "$LOCAL_MIGRATIONS" | while read -r file; do
    basename "$file"
done | head -20
echo ""

# Count total
LOCAL_COUNT=$(echo "$LOCAL_MIGRATIONS" | wc -l | tr -d ' ')
echo "Total local migrations: $LOCAL_COUNT"
echo ""

# Get list of tracked migrations from database
echo "🗄️  Remote tracked migrations:"
echo "--------------------------------"
REMOTE_MIGRATIONS=$(psql "$DB_URL" -t -c "SELECT version || '_' || name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$REMOTE_MIGRATIONS" | sed 's/^[[:space:]]*//' | sed '/^$/d'
    REMOTE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | tr -d ' ')
    echo ""
    echo "Total remote tracked migrations: $REMOTE_COUNT"
else
    echo "❌ Could not connect to database. Check your connection."
fi
echo ""

# Check for problematic files
echo "⚠️  Problematic migration files (being skipped):"
echo "-------------------------------------------------"
echo "Files with .applied extension:"
find supabase/migrations -name "*.applied" -type f | while read -r file; do
    echo "  - $(basename "$file")"
done
echo ""
echo "Files without proper timestamp prefix:"
find supabase/migrations -name "*.sql" -type f | grep -vE "^supabase/migrations/[0-9]{14}_" | while read -r file; do
    echo "  - $(basename "$file")"
done
echo ""

# Check untracked migrations from git
echo "📝 Untracked migrations (from git):"
echo "-----------------------------------"
git status --porcelain supabase/migrations/ | grep "^??" | awk '{print $2}' | while read -r file; do
    echo "  - $(basename "$file")"
done
echo ""

# Check deleted migrations from git
echo "🗑️  Deleted migrations (from git):"
echo "-----------------------------------"
git status --porcelain supabase/migrations/ | grep "^D" | awk '{print $2}' | while read -r file; do
    echo "  - $(basename "$file")"
done
echo ""

echo "💡 Next steps:"
echo "  1. If migrations are out of sync, you may need to manually apply untracked ones"
echo "  2. Files with .applied extension were manually applied - they're safe to ignore"
echo "  3. Run: supabase db push --include-all to push out-of-order migrations"

