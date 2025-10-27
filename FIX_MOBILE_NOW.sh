#!/bin/bash
# Quick fix script for mobile view cache issues

set -e

echo "🧹 Clearing Next.js build cache..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/next-* 2>/dev/null || true

echo "✅ Cache cleared!"
echo ""
echo "Now do these steps:"
echo ""
echo "1. In your browser: Open DevTools (F12)"
echo "2. Right-click the Refresh button"
echo "3. Select 'Empty Cache and Hard Reload'"
echo "4. OR open Application → Storage → Clear site data"
echo ""
echo "5. Then run: npm run dev"
echo "6. Test in INCOGNITO window: http://localhost:3000/mobile/test"
echo ""
echo "The error should be GONE! ✨"

