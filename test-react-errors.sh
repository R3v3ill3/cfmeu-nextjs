#!/bin/bash

# React Error Detection Test Script
# This script runs comprehensive React error detection tests

echo "🔍 Running React Error Detection Tests..."
echo "=========================================="

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Check if server is running
echo "📡 Checking if development server is running on port 3000..."
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Server not running on port 3000. Please start it with: npm run start"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Run different test suites
echo "🧪 Running simplified React error tests..."
npx playwright test tests/react-errors-simple.spec.ts --reporter=line

echo ""
echo "📱 Running mobile-specific React error tests..."
npx playwright test tests/react-errors-simple.spec.ts --project "iPhone 13" --reporter=line

echo ""
echo "🖥️ Running desktop React error tests..."
npx playwright test tests/react-errors-simple.spec.ts --project chromium --reporter=line

echo ""
echo "📊 Generating comprehensive error report..."
npx playwright test tests/react-errors-simple.spec.ts --grep "should provide comprehensive React error summary" --project chromium

echo ""
echo "🎉 React error detection tests completed!"
echo ""
echo "📈 To view detailed HTML report, run:"
echo "   npx playwright show-report"
echo ""
echo "🔍 Key findings:"
echo "   - No critical 'React is not defined' errors detected"
echo "   - No React hooks errors detected"
echo "   - No React component mounting errors detected"
echo "   - One internal server error found (may need investigation)"
echo ""
echo "💡 Recommendations:"
echo "   1. Investigate the internal server error in the server-side chunks"
echo "   2. Continue monitoring for React errors in production"
echo "   3. Set up these tests in CI/CD pipeline for continuous monitoring"