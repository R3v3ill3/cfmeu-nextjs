#!/usr/bin/env tsx

// Script to fix React imports in UI components by adding comprehensive imports
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

function fixFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    let modified = false
    let newContent = content

    // Check if file uses React features but doesn't have proper imports
    if (content.includes('React.') || content.includes('HTMLAttributes') || content.includes('forwardRef')) {
      console.log(`🔧 Fixing React imports in UI component: ${filePath}`)

      // Determine what React features are used
      const needsForwardRef = content.includes('forwardRef')
      const needsHTMLAttributes = content.includes('HTMLAttributes')
      const needsReactNode = content.includes('ReactNode') || content.includes('React.ReactNode')
      const needsOtherReact = content.includes('React.') && !needsForwardRef && !needsHTMLAttributes

      if (needsForwardRef || needsHTMLAttributes || needsReactNode || needsOtherReact) {
        const imports = []

        if (needsForwardRef) imports.push('forwardRef')
        if (needsHTMLAttributes) imports.push('HTMLAttributes')
        if (needsReactNode) imports.push('ReactNode')

        // Build the new import statement
        if (imports.length > 0) {
          const importStatement = `import { ${imports.join(', ')} } from 'react'\nimport type { ${imports.filter(i => i !== 'forwardRef').join(', ')} } from 'react'`

          // Replace or add import
          if (content.includes("import { useState, useEffect, useCallback, useMemo, useRef } from 'react'")) {
            newContent = content.replace(
              "import { useState, useEffect, useCallback, useMemo, useRef } from 'react'",
              `import { useState, useEffect, useCallback, useMemo, useRef${needsForwardRef ? ', forwardRef' : ''} } from 'react'\nimport type { ${imports.filter(i => i !== 'forwardRef').join(', ')} } from 'react'`
            )
          } else if (content.includes("from 'react'")) {
            // Add to existing React imports
            newContent = content.replace(
              /import \{([^}]+)\} from ['"]react['"]/,
              `import { ${needsForwardRef ? '$1, forwardRef' : '$1'} } from 'react'\nimport type { ${imports.filter(i => i !== 'forwardRef').join(', ')} } from 'react'`
            )
          } else {
            // Add new React import
            newContent = `${importStatement}\n${content}`
          }

          // Replace React.forwardRef with forwardRef
          newContent = newContent.replace(/React\.forwardRef/g, 'forwardRef')

          // Replace React.HTMLAttributes with HTMLAttributes
          newContent = newContent.replace(/React\.HTMLAttributes/g, 'HTMLAttributes')

          // Replace React.ReactNode with ReactNode
          newContent = newContent.replace(/React\.ReactNode/g, 'ReactNode')
        }

        if (newContent !== content) {
          writeFileSync(filePath, newContent, 'utf-8')
          modified = true
          console.log(`✅ Fixed UI component: ${filePath}`)
        }
      }
    }

    return modified
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error)
    return false
  }
}

function main() {
  console.log('🚀 Fixing React imports in UI components...\n')

  let totalFixed = 0

  try {
    // Find all UI component files
    const files = execSync('find src/components/ui -name "*.tsx" -o -name "*.ts"', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(file => file.length > 0)

    console.log(`📁 Found ${files.length} UI component files to check`)

    for (const filePath of files) {
      if (fixFile(filePath)) {
        totalFixed++
      }
    }

    console.log(`\n✨ Fixed React imports in ${totalFixed} UI component files`)
    console.log('📝 Added comprehensive React imports for UI components')
    console.log('🎯 This should resolve the React import issues in mobile components')

  } catch (error) {
    console.error('❌ Error finding files:', error)
  }
}

main()