#!/bin/bash
# Test database connection before running the index script

CONNECTION_STRING="${1:-postgresql://postgres:!R3v3ill3-Strategy.@db.jzuoawqxqmrsftbtjkzv.supabase.co:5432/postgres}"

echo "Testing database connection..."
echo "Connection string: ${CONNECTION_STRING%%@*}@[HIDDEN]@${CONNECTION_STRING##*@}"
echo ""

# Extract hostname for DNS check
HOSTNAME=$(echo "$CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):.*/\1/p')
echo "Checking DNS resolution for: $HOSTNAME"
if nslookup "$HOSTNAME" > /dev/null 2>&1; then
    echo "✓ DNS resolution successful"
else
    echo "✗ DNS resolution failed - hostname not found"
    echo ""
    echo "Please verify:"
    echo "1. The connection string is correct from your Supabase dashboard"
    echo "2. The project reference/ID is correct"
    echo "3. You're copying from Settings > Database > Connection string"
    echo ""
    echo "Common issues:"
    echo "- Make sure you're copying the 'Direct connection' string (port 5432)"
    echo "- Remove any brackets [] from the connection string"
    echo "- The format should be: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
    exit 1
fi

echo ""
echo "Testing PostgreSQL connection..."
if psql "$CONNECTION_STRING" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✓ Database connection successful!"
    echo ""
    echo "You can now run the index creation script:"
    echo "  ./run_concurrent_indexes.sh \"$CONNECTION_STRING\""
else
    echo "✗ Database connection failed"
    echo ""
    echo "Possible issues:"
    echo "- Password might need URL encoding (special characters)"
    echo "- Firewall/VPN blocking connection"
    echo "- Incorrect credentials"
    exit 1
fi

