#!/usr/bin/env tsx

/**
 * Background Agent: Missing Routes Analyzer
 *
 * This agent systematically analyzes disabled routes and identifies missing routes
 * in the current application structure. It checks for:
 *
 * 1. Routes that exist in disabled directories but not in active routes
 * 2. Route components that reference missing API endpoints
 * 3. Database dependencies that may not be satisfied
 * 4. Broken internal links and navigation references
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, relative, dirname } from 'path'
import { glob } from 'glob'

interface RouteAnalysis {
  route: string
  path: string
  exists: boolean
  missingComponents: string[]
  missingAPIs: string[]
  missingDBTables: string[]
  internalLinks: string[]
  status: 'OK' | 'MISSING_ROUTE' | 'MISSING_DEPENDENCIES' | 'BROKEN_LINKS'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  recommendation: string
}

interface AnalysisReport {
  timestamp: string
  summary: {
    totalRoutes: number
    missingRoutes: number
    routesWithIssues: number
    highPriorityIssues: number
  }
  routes: RouteAnalysis[]
}

const ROOT_DIR = process.cwd()
const DISABLED_DIRS = [
  'batches_disabled_20251026_142049',
  // Add other disabled directories as they're discovered
]

const ACTIVE_ROUTE_PATTERNS = [
  'src/app/**/page.tsx',
  'src/app/**/layout.tsx',
  'src/app/**/route.ts',
]

const COMPONENT_PATTERNS = [
  'src/components/**/*.tsx',
]

const API_PATTERNS = [
  'src/app/api/**/route.ts',
]

class MissingRoutesAnalyzer {
  private activeRoutes = new Set<string>()
  private activeComponents = new Set<string>()
  private activeAPIs = new Set<string>()
  private disabledRoutes: RouteAnalysis[] = []

  constructor() {
    console.log('🔍 Starting Missing Routes Analysis...')
  }

  async analyze(): Promise<AnalysisReport> {
    console.log('📋 Step 1: Scanning active routes...')
    await this.scanActiveRoutes()

    console.log('🧩 Step 2: Scanning active components...')
    await this.scanActiveComponents()

    console.log('🔌 Step 3: Scanning active APIs...')
    await this.scanActiveAPIs()

    console.log('🚫 Step 4: Analyzing disabled routes...')
    await this.analyzeDisabledRoutes()

    console.log('📊 Step 5: Generating analysis report...')
    return this.generateReport()
  }

  private async scanActiveRoutes(): Promise<void> {
    for (const pattern of ACTIVE_ROUTE_PATTERNS) {
      const files = await glob(pattern, { cwd: ROOT_DIR })
      for (const file of files) {
        // Convert file path to route path
        const routePath = this.fileToRoutePath(file)
        this.activeRoutes.add(routePath)
      }
    }
    console.log(`✅ Found ${this.activeRoutes.size} active routes`)
  }

  private async scanActiveComponents(): Promise<void> {
    for (const pattern of COMPONENT_PATTERNS) {
      const files = await glob(pattern, { cwd: ROOT_DIR })
      for (const file of files) {
        const componentName = this.extractComponentName(file)
        this.activeComponents.add(componentName)
      }
    }
    console.log(`✅ Found ${this.activeComponents.size} active components`)
  }

  private async scanActiveAPIs(): Promise<void> {
    for (const pattern of API_PATTERNS) {
      const files = await glob(pattern, { cwd: ROOT_DIR })
      for (const file of files) {
        const apiPath = this.fileToAPIPath(file)
        this.activeAPIs.add(apiPath)
      }
    }
    console.log(`✅ Found ${this.activeAPIs.size} active APIs`)
  }

  private async analyzeDisabledRoutes(): Promise<void> {
    for (const disabledDir of DISABLED_DIRS) {
      const disabledPath = join(ROOT_DIR, disabledDir)
      if (!existsSync(disabledPath)) {
        console.log(`⚠️  Disabled directory not found: ${disabledDir}`)
        continue
      }

      await this.scanDisabledDirectory(disabledPath, disabledDir)
    }
  }

  private async scanDisabledDirectory(dirPath: string, dirName: string): Promise<void> {
    const items = readdirSync(dirPath)

    for (const item of items) {
      const itemPath = join(dirPath, item)
      const stat = statSync(itemPath)

      if (stat.isDirectory()) {
        await this.scanDisabledDirectory(itemPath, dirName)
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        const analysis = this.analyzeRouteFile(itemPath, dirName)
        if (analysis) {
          this.disabledRoutes.push(analysis)
        }
      }
    }
  }

  private analyzeRouteFile(filePath: string, disabledDir: string): RouteAnalysis | null {
    const relativePath = relative(ROOT_DIR, filePath)
    const routePath = this.fileToRoutePath(relativePath.replace(disabledDir + '/', ''))
    const content = readFileSync(filePath, 'utf-8')

    // Determine if route exists in active structure
    const exists = this.activeRoutes.has(routePath)

    // Find missing components
    const missingComponents = this.findMissingComponents(content)

    // Find missing APIs
    const missingAPIs = this.findMissingAPIs(content)

    // Find database dependencies
    const missingDBTables = this.findMissingDBTables(content)

    // Find internal links
    const internalLinks = this.findInternalLinks(content)

    // Determine status and priority
    const status = this.determineStatus(exists, missingComponents, missingAPIs, missingDBTables)
    const priority = this.determinePriority(status, routePath)
    const recommendation = this.generateRecommendation(status, routePath, missingComponents, missingAPIs)

    return {
      route: routePath,
      path: relativePath,
      exists,
      missingComponents,
      missingAPIs,
      missingDBTables,
      internalLinks,
      status,
      priority,
      recommendation
    }
  }

  private fileToRoutePath(filePath: string): string {
    // Remove src/app/ and file extensions, convert to route path
    const routePath = filePath
      .replace(/^src\/app\//, '')
      .replace(/\/page\.(tsx|ts)$/, '')
      .replace(/\/layout\.(tsx|ts)$/, '')
      .replace(/\/route\.(tsx|ts)$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1') // Convert [param] to :param for display
      .replace(/\/index$/, '') // Remove trailing /index

    return routePath === '' ? '/' : `/${routePath}`
  }

  private fileToAPIPath(filePath: string): string {
    return filePath
      .replace(/^src\/app\//, '')
      .replace(/\/route\.(tsx|ts)$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')
  }

  private extractComponentName(filePath: string): string {
    const fileName = filePath.split('/').pop()!
    return fileName.replace(/\.(tsx|ts)$/, '')
  }

  private findMissingComponents(content: string): string[] {
    const componentImports = content.match(/import\s+.*\s+from\s+['"@][^'"]*['"];/g) || []
    const missing: string[] = []

    for (const importStatement of componentImports) {
      const match = importStatement.match(/from\s+['"]@\/components\/([^'"]+)['"]/)
      if (match) {
        const componentPath = match[1]
        const componentName = componentPath.split('/').pop()!

        // Check if component file exists (basic check)
        if (!this.activeComponents.has(componentName)) {
          missing.push(componentName)
        }
      }
    }

    return missing
  }

  private findMissingAPIs(content: string): string[] {
    const apiCalls = content.match(/fetch\s*\(\s*['"`]\/api\/([^'"`]+)['"`]/g) || []
    const missing: string[] = []

    for (const call of apiCalls) {
      const match = call.match(/fetch\s*\(\s*['"`]\/api\/([^'"`]+)['"`]/)
      if (match) {
        const apiPath = match[1]
        if (!this.activeAPIs.has(apiPath)) {
          missing.push(apiPath)
        }
      }
    }

    return missing
  }

  private findMissingDBTables(content: string): string[] {
    const tables = content.match(/\.from\s*\(\s*['"`]([^'"`]+)['"`]/g) || []
    const found: string[] = []

    for (const tableRef of tables) {
      const match = tableRef.match(/\.from\s*\(\s*['"`]([^'"`]+)['"`]/)
      if (match) {
        found.push(match[1])
      }
    }

    return found // Note: We don't check if these exist in DB, just extract them
  }

  private findInternalLinks(content: string): string[] {
    const links = content.match(/href\s*=\s*['"`]([^'"`]+)['"`]/g) || []
    const internalLinks: string[] = []

    for (const link of links) {
      const match = link.match(/href\s*=\s*['"`]([^'"`]+)['"`]/)
      if (match && match[1].startsWith('/')) {
        internalLinks.push(match[1])
      }
    }

    return internalLinks
  }

  private determineStatus(
    exists: boolean,
    missingComponents: string[],
    missingAPIs: string[],
    missingDBTables: string[]
  ): RouteAnalysis['status'] {
    if (!exists) {
      return 'MISSING_ROUTE'
    }

    if (missingComponents.length > 0 || missingAPIs.length > 0) {
      return 'MISSING_DEPENDENCIES'
    }

    if (missingDBTables.length > 0) {
      return 'BROKEN_LINKS' // Could be broken if DB tables don't exist
    }

    return 'OK'
  }

  private determinePriority(status: RouteAnalysis['status'], routePath: string): RouteAnalysis['priority'] {
    if (status === 'MISSING_ROUTE') {
      // High priority for admin/batch related routes
      if (routePath.includes('/admin') || routePath.includes('/batch')) {
        return 'HIGH'
      }
      return 'MEDIUM'
    }

    if (status === 'MISSING_DEPENDENCIES') {
      return 'HIGH' // This will cause runtime errors
    }

    return 'LOW'
  }

  private generateRecommendation(
    status: RouteAnalysis['status'],
    routePath: string,
    missingComponents: string[],
    missingAPIs: string[]
  ): string {
    switch (status) {
      case 'MISSING_ROUTE':
        return `Create missing route: ${routePath}`
      case 'MISSING_DEPENDENCIES':
        const recommendations = []
        if (missingComponents.length > 0) {
          recommendations.push(`Create components: ${missingComponents.join(', ')}`)
        }
        if (missingAPIs.length > 0) {
          recommendations.push(`Create APIs: ${missingAPIs.join(', ')}`)
        }
        return recommendations.join(' | ')
      case 'BROKEN_LINKS':
        return 'Verify database tables exist and migrations are applied'
      default:
        return 'Route appears to be working correctly'
    }
  }

  private generateReport(): AnalysisReport {
    const missingRoutes = this.disabledRoutes.filter(r => r.status === 'MISSING_ROUTE')
    const routesWithIssues = this.disabledRoutes.filter(r => r.status !== 'OK')
    const highPriorityIssues = this.disabledRoutes.filter(r => r.priority === 'HIGH')

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalRoutes: this.disabledRoutes.length,
        missingRoutes: missingRoutes.length,
        routesWithIssues: routesWithIssues.length,
        highPriorityIssues: highPriorityIssues.length,
      },
      routes: this.disabledRoutes
    }
  }
}

// Main execution
async function main() {
  try {
    const analyzer = new MissingRoutesAnalyzer()
    const report = await analyzer.analyze()

    console.log('\n' + '='.repeat(80))
    console.log('📊 MISSING ROUTES ANALYSIS REPORT')
    console.log('='.repeat(80))
    console.log(`🕒 Generated: ${report.timestamp}`)
    console.log(`📈 Summary:`)
    console.log(`   Total routes analyzed: ${report.summary.totalRoutes}`)
    console.log(`   Missing routes: ${report.summary.missingRoutes}`)
    console.log(`   Routes with issues: ${report.summary.routesWithIssues}`)
    console.log(`   High priority issues: ${report.summary.highPriorityIssues}`)

    console.log('\n🚨 HIGH PRIORITY ISSUES:')
    const highPriority = report.routes.filter(r => r.priority === 'HIGH')
    if (highPriority.length === 0) {
      console.log('   ✅ No high priority issues found')
    } else {
      highPriority.forEach(route => {
        console.log(`   ❌ ${route.route} (${route.status})`)
        console.log(`      💡 ${route.recommendation}`)
      })
    }

    console.log('\n📋 DETAILED ANALYSIS:')
    report.routes.forEach(route => {
      const icon = route.status === 'OK' ? '✅' : route.priority === 'HIGH' ? '🚨' : route.priority === 'MEDIUM' ? '⚠️' : 'ℹ️'
      console.log(`   ${icon} ${route.route}`)
      console.log(`      Path: ${route.path}`)
      console.log(`      Status: ${route.status} | Priority: ${route.priority}`)
      if (route.recommendation !== 'Route appears to be working correctly') {
        console.log(`      💡 Recommendation: ${route.recommendation}`)
      }
      if (route.missingComponents.length > 0) {
        console.log(`      🧩 Missing Components: ${route.missingComponents.join(', ')}`)
      }
      if (route.missingAPIs.length > 0) {
        console.log(`      🔌 Missing APIs: ${route.missingAPIs.join(', ')}`)
      }
      console.log('')
    })

    // Write report to file
    const reportPath = join(ROOT_DIR, 'missing-routes-report.json')
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Full report saved to: ${reportPath}`)

  } catch (error) {
    console.error('❌ Error running analysis:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}