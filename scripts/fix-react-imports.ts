#!/usr/bin/env tsx

// Script to ensure React imports in mobile components

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface FileWithImports {
  filePath: string
  hasStarImport: boolean
  needsSpecificImports: boolean
  content: string
}

// Files to check and fix
const filesToCheck = [
  // Mobile page files
  'src/app/mobile/ratings/page.tsx',
  'src/app/mobile/ratings/dashboard/page.tsx',
  'src/app/mobile/ratings/weightings/page.tsx',
  'src/app/mobile/ratings/compare/[employerId]/page.tsx',
  'src/app/mobile/ratings/wizard/[employerId]/page.tsx',

  // Mobile component files
  'src/components/mobile/shared/MobileOptimizationProvider.tsx',
  'src/components/mobile/rating-system/RatingDashboard.tsx',
  'src/components/mobile/rating-system/RatingHistory.tsx',
  'src/components/mobile/rating-system/WeightingManagerMobile.tsx',
  'src/components/mobile/rating-system/RatingComparison.tsx',
  'src/components/mobile/rating-system/RatingWizard.tsx',
  'src/components/mobile/rating-system/EmployerRatingCard.tsx',
  'src/components/mobile/rating-system/RatingBreakdown.tsx',
  'src/components/mobile/rating-system/TrafficLightDisplay.tsx',
  'src/components/mobile/shared/MobileForm.tsx',
  'src/components/mobile/shared/SwipeActions.tsx',
  'src/components/mobile/shared/PullToRefresh.tsx',
  'src/components/mobile/shared/BottomSheet.tsx',

  // Hooks that also need fixing
  'src/hooks/mobile/useMobileOptimizations.ts',
  'src/hooks/mobile/useOfflineSync.ts',
  'src/hooks/use-toast.ts'
]

function fixFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    let modified = false

    // Check if file has the problematic import
    if (content.includes('import * as React from "react"')) {
      console.log(`🔧 Fixing React imports in: ${filePath}`)

      // Replace star import with specific imports
      let newContent = content.replace(
        /import \* as React from "react"/g,
        "import { useState, useEffect, useCallback, useMemo, useRef } from 'react'"
      )

      // Also fix JSX.Element type usage if present
      if (newContent.includes(': JSX.Element')) {
        newContent = newContent.replace(/: JSX\.Element/g, ': React.ReactElement')
      }

      // Fix React.ReactNode if used
      if (newContent.includes('React.ReactNode')) {
        // Keep React.ReactNode as it's already specific
      }

      writeFileSync(filePath, newContent, 'utf-8')
      modified = true
      console.log(`✅ Fixed: ${filePath}`)
    }

    return modified
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error)
    return false
  }
}

function main() {
  console.log('🚀 Fixing React imports in mobile components...\n')

  let totalFixed = 0

  for (const filePath of filesToCheck) {
    if (fixFile(filePath)) {
      totalFixed++
    }
  }

  console.log(`\n✨ Fixed React imports in ${totalFixed} files`)
  console.log('📝 Changed "import * as React" to specific React imports')
  console.log('🎯 This should resolve the Vercel build issues')
}

main()