#!/bin/bash

# Supabase Re-link Script
# This script helps re-establish the Supabase CLI link after a password change

PROJECT_REF="jzuoawqxqmrsftbtjkzv"
DB_PASSWORD="R3v3ill3_Strategy"

echo "🔧 Supabase Re-link Helper Script"
echo "=================================="
echo ""

# Check if already logged in
echo "Step 1: Checking Supabase authentication..."
if npx supabase projects list 2>&1 | grep -q "jzuoawqxqmrsftbtjkzv"; then
  echo "✅ Already authenticated and linked!"
  echo ""
  echo "Your project is ready. You can now run:"
  echo "  npx supabase db push"
  exit 0
fi

# Check if just need to link (already logged in)
if npx supabase projects list 2>&1 | grep -q "project_id"; then
  echo "✅ Already logged in, just need to link..."
  echo ""
  echo "Running: npx supabase link --project-ref $PROJECT_REF"
  npx supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully linked!"
    exit 0
  else
    echo "❌ Link failed. You may need to login first."
  fi
fi

# Need to login first
echo "⚠️  Not logged in to Supabase CLI"
echo ""
echo "Please run this command in your terminal:"
echo ""
echo "  npx supabase login"
echo ""
echo "This will open your browser to authenticate."
echo "After logging in, run this script again."
echo ""
echo "Alternative: If you have an access token, set it:"
echo "  export SUPABASE_ACCESS_TOKEN=your_token_here"
echo "  npx supabase link --project-ref $PROJECT_REF"

exit 1

