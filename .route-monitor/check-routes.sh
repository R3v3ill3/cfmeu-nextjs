#!/bin/bash
# Route Monitor Scheduled Task
# This script runs the missing routes analyzer and logs results

PROJECT_ROOT="$(dirname "$(readlink -f "$0")")"

echo "🔍 Running route analysis at $(date)"
cd "$PROJECT_ROOT"

# Run the analyzer
npx tsx scripts/analyze-missing-routes.ts > .route-monitor/latest-report.log 2>&1

# Check for high priority issues
if grep -q "🚨 HIGH PRIORITY ISSUES:" .route-monitor/latest-report.log &&    grep -q -v "✅ No high priority issues found" .route-monitor/latest-report.log; then
  echo "⚠️  High priority route issues detected!"

  # Send notification (if configured)
  if [ -f ".route-monitor/notify.sh" ]; then
    bash .route-monitor/notify.sh
  fi

  exit 1
else
  echo "✅ No high priority route issues found"
  exit 0
fi
