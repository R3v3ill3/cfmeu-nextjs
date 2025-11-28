#!/bin/bash
# Execute concurrent index creation with better error handling
# Usage: ./execute_concurrent_indexes.sh [connection-string]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/supabase/manual/20251201_search_indexes_concurrent.sql"

# Get connection string
if [ -n "$1" ]; then
    CONNECTION_STRING="$1"
elif [ -n "$DATABASE_URL" ]; then
    CONNECTION_STRING="$DATABASE_URL"
else
    echo "Error: Connection string required"
    echo ""
    echo "Usage: $0 [connection-string]"
    echo ""
    echo "Connection string formats accepted by psql:"
    echo "  1. URI format: postgresql://user:password@host:port/database"
    echo "  2. Individual params: host=... port=... user=... password=... dbname=..."
    echo ""
    echo "To get your Supabase connection string:"
    echo "  1. Go to Supabase Dashboard > Your Project"
    echo "  2. Settings > Database"
    echo "  3. Under 'Connection string' section:"
    echo "     - Select 'URI' format"
    echo "     - Copy the string (it should start with postgresql://)"
    echo "     - Make sure to replace [YOUR-PASSWORD] with your actual password"
    echo "     - Remove any brackets [] - they are placeholders"
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
echo "Note: CREATE INDEX CONCURRENTLY runs outside transactions,"
echo "so this cannot be run as a regular migration."
echo ""

# Test connection first
echo "Testing database connection..."
if psql "$CONNECTION_STRING" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Connection successful"
    echo ""
else
    echo "✗ Connection failed"
    echo ""
    echo "Troubleshooting:"
    echo "1. Verify the connection string is correct"
    echo "2. Check that you can access the database from your network"
    echo "3. For Supabase, make sure you're using the correct format:"
    echo "   - Direct: postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.co:5432/postgres"
    echo "   - Pooler: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    echo ""
    echo "If using special characters in password, try URL encoding:"
    echo "   ! = %21"
    echo "   @ = %40"
    echo "   # = %23"
    echo "   $ = %24"
    echo "   & = %26"
    exit 1
fi

# Execute the SQL file
echo "Creating indexes concurrently..."
psql "$CONNECTION_STRING" -f "$SQL_FILE"

echo ""
echo "✓ Index creation completed!"

