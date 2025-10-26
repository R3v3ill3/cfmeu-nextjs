#!/usr/bin/env tsx

// Comprehensive script to normalize React imports in ALL files

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

interface FileWithImports {
  filePath: string
  hasStarImport: boolean
  content: string
}

function fixFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    let modified = false
    let newContent = content

    // Check if file has the problematic import patterns
    if (content.includes('import * as React from "react"') || content.includes("import * as React from 'react'")) {
      console.log(`🔧 Fixing star React imports in: ${filePath}`)

      // Replace star import with specific imports
      newContent = newContent.replace(
        /import \* as React from ["']react["']/g,
        "import { useState, useEffect, useCallback, useMemo, useRef } from 'react'"
      )
      modified = true
      console.log(`✅ Fixed star import: ${filePath}`)
    }

    // Fix "import React," pattern
    if (newContent.includes('import React,')) {
      console.log(`🔧 Fixing React import in: ${filePath}`)

      // Extract what's being imported from React
      const reactImportMatch = newContent.match(/import React,\s*\{([^}]+)\}\s+from\s+['"]react['"]/)
      if (reactImportMatch) {
        const imports = reactImportMatch[1]
        newContent = newContent.replace(
          /import React,\s*\{[^}]+\}\s+from\s+['"]react['"]/g,
          `import { ${imports} } from 'react'`
        )
      } else {
        // Just remove the React import if we can't parse it
        newContent = newContent.replace(/import React\s+from\s+['"]react['"]/g, '')
      }
      modified = true
      console.log(`✅ Fixed React import: ${filePath}`)
    }

    // Fix standalone "import React from 'react'"
    if (newContent.includes('import React from ')) {
      console.log(`🔧 Fixing standalone React import in: ${filePath}`)
      newContent = newContent.replace(/import React\s+from\s+['"]react['"]/g, '')
      modified = true
      console.log(`✅ Fixed standalone React import: ${filePath}`)
    }

    // Also fix JSX.Element type usage if present
    if (newContent.includes(': JSX.Element')) {
      newContent = newContent.replace(/: JSX\.Element/g, ': React.ReactElement')
      modified = true
    }

    // Fix React.ReactNode usage to add proper import if needed
    if (newContent.includes('React.ReactNode') && !newContent.includes('import type { ReactNode }')) {
      newContent = newContent.replace(/React\.ReactNode/g, 'ReactNode')
      // Add the type import if other React imports exist
      if (newContent.includes("import {") && newContent.includes("from 'react'")) {
        newContent = newContent.replace(
          /from ['"]react['"]/,
          "from 'react'\nimport type { ReactNode } from 'react'"
        )
      }
      modified = true
      console.log(`✅ Fixed React.ReactNode: ${filePath}`)
    }

    if (modified) {
      writeFileSync(filePath, newContent, 'utf-8')
      console.log(`✅ Updated: ${filePath}`)
    }

    return modified
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error)
    return false
  }
}

function main() {
  console.log('🚀 Fixing React imports in ALL files...\n')

  let totalFixed = 0

  try {
    // Find all TypeScript and JavaScript files that might have React imports
    const files = execSync('find src -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js"', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(file => file.length > 0)

    console.log(`📁 Found ${files.length} files to check`)

    for (const filePath of files) {
      if (fixFile(filePath)) {
        totalFixed++
      }
    }

    console.log(`\n✨ Fixed React imports in ${totalFixed} files`)
    console.log('📝 Changed "import * as React" to specific React imports')
    console.log('🎯 This should resolve the Vercel build issues')

    if (totalFixed > 0) {
      console.log('\n🔄 Running build to test fixes...')
      try {
        execSync('npm run build', { stdio: 'inherit' })
      } catch (error) {
        console.log('\n❌ Build still has issues. Manual checking may be required.')
      }
    }

  } catch (error) {
    console.error('❌ Error finding files:', error)
  }
}

main()