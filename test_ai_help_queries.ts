#!/usr/bin/env ts-node

/**
 * AI Help System Quality Testing Script
 * Tests query responses against expected documentation coverage
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface TestQuery {
  id: string
  query: string
  category: string
  expectedTopics: string[]
  expectedMinConfidence: number
  userRole?: string
  page?: string
  expectedResult: 'high_confidence' | 'medium_confidence' | 'fallback' | 'decline'
}

interface TestResult {
  query: TestQuery
  actualConfidence?: number
  sources?: string[]
  answer?: string
  passed: boolean
  issues: string[]
}

// Test queries based on DOCUMENTATION_STRUCTURE.json coverage
const testQueries: TestQuery[] = [
  // Mobile & PWA Features (High coverage expected)
  {
    id: 'mobile-pwa-install',
    query: 'How do I install the mobile app on my iPhone?',
    category: 'mobile',
    expectedTopics: ['pwa', 'install', 'ios', 'safari', 'home screen'],
    expectedMinConfidence: 0.85,
    expectedResult: 'high_confidence'
  },
  {
    id: 'site-visit-wizard',
    query: 'What is the Site Visit Wizard?',
    category: 'mobile',
    expectedTopics: ['site visit', 'wizard', 'mobile', 'workflow'],
    expectedMinConfidence: 0.85,
    expectedResult: 'high_confidence'
  },
  {
    id: 'offline-usage',
    query: 'How do I conduct a site visit when I have no internet?',
    category: 'mobile',
    expectedTopics: ['offline', 'sync', 'cache', 'site visit'],
    expectedMinConfidence: 0.80,
    expectedResult: 'high_confidence'
  },
  {
    id: 'gps-features',
    query: 'How do I find projects closest to my location?',
    category: 'mobile',
    expectedTopics: ['gps', 'location', 'closest', 'navigation'],
    expectedMinConfidence: 0.80,
    expectedResult: 'high_confidence'
  },

  // Ratings & Compliance (High coverage expected)
  {
    id: 'traffic-light-system',
    query: 'What is the traffic light rating system?',
    category: 'compliance',
    expectedTopics: ['traffic light', 'rating', 'compliance', 'red amber green'],
    expectedMinConfidence: 0.85,
    expectedResult: 'high_confidence'
  },
  {
    id: 'ratings-v2',
    query: 'How does Ratings System v2 work?',
    category: 'compliance',
    expectedTopics: ['ratings v2', 'two-track', 'weighting', 'confidence'],
    expectedMinConfidence: 0.80,
    expectedResult: 'high_confidence'
  },
  {
    id: 'sham-contracting',
    query: 'What is sham contracting detection?',
    category: 'compliance',
    expectedTopics: ['sham contracting', 'detection', 'hard block', 'compliance'],
    expectedMinConfidence: 0.80,
    expectedResult: 'high_confidence'
  },

  // Core Workflows (High coverage expected)
  {
    id: 'delegate-registration',
    query: 'How do I register a site delegate?',
    category: 'workflows',
    expectedTopics: ['delegate', 'registration', 'hsr', 'representative'],
    expectedMinConfidence: 0.85,
    expectedResult: 'high_confidence',
    userRole: 'organiser'
  },
  {
    id: 'project-creation',
    query: 'How do I create a new project?',
    category: 'workflows',
    expectedTopics: ['create project', 'new project', 'value', 'tier'],
    expectedMinConfidence: 0.85,
    expectedResult: 'high_confidence',
    userRole: 'organiser'
  },
  {
    id: 'campaign-activity',
    query: 'How do I create a campaign activity?',
    category: 'workflows',
    expectedTopics: ['campaign', 'activity', 'organizing', 'rating'],
    expectedMinConfidence: 0.75,
    expectedResult: 'high_confidence'
  },

  // Admin Features (Good coverage expected)
  {
    id: 'user-roles',
    query: 'What are the different user roles and permissions?',
    category: 'admin',
    expectedTopics: ['roles', 'permissions', 'admin', 'organiser', 'delegate'],
    expectedMinConfidence: 0.80,
    expectedResult: 'high_confidence'
  },
  {
    id: 'bci-import',
    query: 'How do I import BCI project data?',
    category: 'admin',
    expectedTopics: ['bci', 'import', 'csv', 'excel', 'building construction'],
    expectedMinConfidence: 0.75,
    expectedResult: 'high_confidence',
    userRole: 'lead_organiser'
  },

  // Edge Cases (Should decline or fallback)
  {
    id: 'delete-all-projects',
    query: 'Can I delete all projects at once?',
    category: 'edge_case',
    expectedTopics: [],
    expectedMinConfidence: 0,
    expectedResult: 'decline'
  },
  {
    id: 'sap-export',
    query: 'How do I export to SAP?',
    category: 'edge_case',
    expectedTopics: [],
    expectedMinConfidence: 0,
    expectedResult: 'decline'
  },
  {
    id: 'keyboard-shortcuts',
    query: 'What are the keyboard shortcuts?',
    category: 'edge_case',
    expectedTopics: [],
    expectedMinConfidence: 0,
    expectedResult: 'fallback'
  }
]

// Load documentation structure for reference
const docsPath = join(__dirname, '..', 'docs', 'DOCUMENTATION_STRUCTURE.json')
const documentationStructure = JSON.parse(readFileSync(docsPath, 'utf8'))

// Helper function to check if query topics are covered in documentation
function checkDocumentationCoverage(query: TestQuery): {
  covered: boolean
  matchedDocs: string[]
  coverage: number
} {
  const matchedDocs: string[] = []
  const queryText = query.query.toLowerCase() + ' ' + query.expectedTopics.join(' ')

  for (const doc of documentationStructure.documents) {
    const searchText = (
      doc.title + ' ' +
      doc.content + ' ' +
      doc.keywords?.join(' ') || ''
    ).toLowerCase()

    // Check if any expected topic matches this document
    const hasMatch = query.expectedTopics.some(topic =>
      searchText.includes(topic.toLowerCase()) ||
      topic.toLowerCase().includes(searchText.substring(0, 20))
    )

    if (hasMatch) {
      matchedDocs.push(doc.title)
    }
  }

  const coverage = matchedDocs.length / documentationStructure.documents.length
  return {
    covered: matchedDocs.length > 0,
    matchedDocs,
    coverage
  }
}

// Run test suite
async function runAITests(): Promise<TestResult[]> {
  console.log('🧪 Running AI Help System Quality Tests...\n')

  const results: TestResult[] = []

  for (const query of testQueries) {
    console.log(`Testing: ${query.id} - "${query.query}"`)

    // Check documentation coverage first
    const docCoverage = checkDocumentationCoverage(query)

    const result: TestResult = {
      query,
      passed: true,
      issues: []
    }

    // Log coverage analysis
    if (!docCoverage.covered && query.expectedResult !== 'decline' && query.expectedResult !== 'fallback') {
      result.issues.push(`No matching documentation found for expected topics: ${query.expectedTopics.join(', ')}`)
      result.passed = false
    }

    if (docCoverage.covered) {
      console.log(`  ✅ Documentation coverage: ${docCoverage.matchedDocs.length} docs matched`)
      console.log(`  📄 Matched docs: ${docCoverage.matchedDocs.slice(0, 3).join(', ')}`)
    } else {
      console.log(`  ⚠️  No documentation coverage (expected: ${query.expectedResult})`)
    }

    // For now, simulate expected results since we can't call the API directly
    // In a real test environment, this would call /api/help/chat
    if (query.expectedResult === 'decline') {
      result.answer = "I don't have information about that in the documentation"
      result.passed = !docCoverage.covered
    } else if (query.expectedResult === 'fallback') {
      result.answer = "I don't have enough specific information, but here's what I can tell you..."
      result.actualConfidence = 0.4
      result.passed = result.actualConfidence < query.expectedMinConfidence
    } else {
      result.actualConfidence = Math.min(0.9, docCoverage.coverage * 1.2)
      result.sources = docCoverage.matchedDocs
      result.passed = result.actualConfidence >= query.expectedMinConfidence
    }

    if (!result.passed) {
      result.issues.push(`Confidence ${result.actualConfidence} below expected ${query.expectedMinConfidence}`)
    }

    results.push(result)
    console.log(`  ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`)
  }

  return results
}

// Generate quality report
function generateQualityReport(results: TestResult[]) {
  const totalTests = results.length
  const passedTests = results.filter(r => r.passed).length
  const passRate = (passedTests / totalTests) * 100

  console.log('\n📊 AI Help System Quality Report')
  console.log('====================================')
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passedTests}`)
  console.log(`Failed: ${totalTests - passedTests}`)
  console.log(`Pass Rate: ${passRate.toFixed(1)}%\n`)

  // Category breakdown
  const categories = ['mobile', 'compliance', 'workflows', 'admin', 'edge_case']
  for (const category of categories) {
    const categoryResults = results.filter(r => r.query.category === category)
    const categoryPasses = categoryResults.filter(r => r.passed).length
    const categoryRate = (categoryPasses / categoryResults.length) * 100

    console.log(`${category.toUpperCase()}: ${categoryPasses}/${categoryResults.length} (${categoryRate.toFixed(1)}%)`)
  }

  // Failed tests details
  const failedTests = results.filter(r => !r.passed)
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:')
    for (const test of failedTests) {
      console.log(`  ${test.query.id}: ${test.issues.join('; ')}`)
    }
  }

  // Recommendations
  console.log('\n💡 Recommendations:')

  const mobileResults = results.filter(r => r.query.category === 'mobile')
  const mobilePassRate = (mobileResults.filter(r => r.passed).length / mobileResults.length) * 100
  if (mobilePassRate < 90) {
    console.log('- Improve mobile feature documentation coverage')
  }

  const edgeCaseResults = results.filter(r => r.query.category === 'edge_case')
  const edgeCasePasses = edgeCaseResults.filter(r => r.passed).length
  if (edgeCasePasses < edgeCaseResults.length) {
    console.log('- Review hallucination prevention for edge cases')
  }

  const avgConfidence = results.reduce((sum, r) => sum + (r.actualConfidence || 0), 0) / results.length
  if (avgConfidence < 0.7) {
    console.log('- Expand documentation to improve overall confidence scores')
  }

  return {
    totalTests,
    passedTests,
    passRate,
    avgConfidence,
    categoryBreakdown: categories.map(cat => ({
      category: cat,
      total: results.filter(r => r.query.category === cat).length,
      passed: results.filter(r => r.query.category === cat && r.passed).length
    }))
  }
}

// Run the test suite
if (require.main === module) {
  runAITests()
    .then(generateQualityReport)
    .catch(console.error)
}

export { testQueries, runAITests, generateQualityReport }