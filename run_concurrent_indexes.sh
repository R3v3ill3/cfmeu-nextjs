#!/bin/bash
# Script to execute concurrent index creation
# Usage: ./run_concurrent_indexes.sh [DATABASE_URL]
#   If DATABASE_URL is not provided, it will try to get it from environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/supabase/manual/20251201_search_indexes_concurrent.sql"

# Get DATABASE_URL from argument or environment
if [ -n "$1" ]; then
    DATABASE_URL="$1"
elif [ -n "$DATABASE_URL" ]; then
    echo "Using DATABASE_URL from environment"
else
    echo "Error: DATABASE_URL not provided and not found in environment"
    echo ""
    echo "Usage: $0 [DATABASE_URL]"
    echo ""
    echo "Or set DATABASE_URL environment variable:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    echo "To get your Supabase connection string:"
    echo "  1. Go to your Supabase project dashboard"
    echo "  2. Navigate to Settings > Database"
    echo "  3. Copy the 'Connection string' (use the 'Direct connection' or 'Session pooler' URI)"
    echo "     Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    exit 1
fi

# Verify psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Verify SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found at $SQL_FILE"
    exit 1
fi

echo "Executing concurrent index creation..."
echo "This may take several minutes depending on table sizes..."
echo ""

# Execute the SQL file
psql "$DATABASE_URL" -f "$SQL_FILE"

echo ""
echo "Index creation completed!"




