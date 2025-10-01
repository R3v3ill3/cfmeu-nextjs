#!/usr/bin/env tsx
/**
 * AI-Powered Projects Page Documentation Generator
 * Analyzes the projects page and all its workflows
 */

import { config } from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

config()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

async function analyzeProjectsPage() {
  console.log('🔍 Analyzing Projects Page and Workflows...\n')
  
  // Read all relevant files
  const files = await Promise.all([
    readFile('src/app/(app)/projects/page.tsx'),
    readFile('src/app/(app)/projects/[projectId]/page.tsx'),
    readFile('src/components/projects/ProjectCard.tsx'),
    readFile('src/components/projects/ProjectList.tsx'),
    readFile('src/components/projects/CreateProjectDialog.tsx'),
    readFile('src/components/projects/mapping/MappingSheetPage1.tsx'),
    readFile('src/components/upload/ProjectImport.tsx'),
  ])
  
  const [mainPage, detailPage, projectCard, projectList, createDialog, mappingSheet, projectImport] = files
  
  const codeContext = `
# PROJECTS PAGE ANALYSIS

## Main Projects Page (src/app/(app)/projects/page.tsx)
\`\`\`tsx
${mainPage.substring(0, 4000)}
\`\`\`

## Project Detail Page (src/app/(app)/projects/[projectId]/page.tsx)
\`\`\`tsx
${detailPage.substring(0, 4000)}
\`\`\`

## Project Card Component
\`\`\`tsx
${projectCard.substring(0, 2000)}
\`\`\`

## Create Project Dialog
\`\`\`tsx
${createDialog.substring(0, 3000)}
\`\`\`

## Mapping Sheet
\`\`\`tsx
${mappingSheet.substring(0, 2000)}
\`\`\`

## Project Import
\`\`\`tsx
${projectImport.substring(0, 2000)}
\`\`\`
  `.trim()
  
  const prompt = `You are analyzing the Projects page of a union organizing platform (CFMEU).

Your task: Create comprehensive, user-friendly documentation for EVERY user-interactable feature on this page.

${codeContext}

Analyze and document:

1. **Projects List Page** - Main features:
   - Viewing projects (card/list/map views)
   - Filtering (tier, universe, stage, EBA, patch)
   - Sorting options
   - Search functionality
   - Creating new projects

2. **Project Creation Workflow**:
   - How to create a project
   - Required fields
   - Auto-assignment rules
   - What happens after creation

3. **Project Detail View**:
   - What information is displayed
   - Tabs available (mapping sheets, wallcharts, etc.)
   - Actions available

4. **Mapping Sheets Workflow**:
   - What are mapping sheets
   - How to add contractors
   - How to manage trades
   - Printing/sharing options

5. **Project Import**:
   - How to import projects
   - File format requirements
   - Validation rules

6. **Any Other Interactive Features** you identify

For EACH feature/workflow, create a documentation entry in this format:

\`\`\`json
{
  "id": "unique-slug",
  "title": "User-Friendly Title (How to...)",
  "category": "core-features" or "workflows",
  "content": "Detailed explanation in plain language. Include:
    - What this feature does
    - When to use it
    - Prerequisites (if any)
    - Important notes or tips",
  "roles": ["which roles can use this"],
  "pages": ["/projects"],
  "keywords": ["searchable", "terms"],
  "steps": [
    "Step 1: Clear action",
    "Step 2: Next action",
    "Step 3: Result"
  ],
  "related": ["other-doc-ids"]
}
\`\`\`

Return a JSON array with 10-15 comprehensive documentation entries covering all aspects of the projects page.
Be extremely detailed and specific. Include exact button names, field names, menu locations.
Write for non-technical users.`

  console.log('📡 Calling Claude API...\n')
  
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 16000,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })
  
  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  
  // Extract JSON
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[\s*\{[\s\S]*\}\s*\]/)
  
  if (!jsonMatch) {
    console.error('❌ Could not extract JSON from response')
    console.log('\nResponse preview:')
    console.log(content.substring(0, 500))
    return
  }
  
  const docs = JSON.parse(jsonMatch[1] || jsonMatch[0])
  
  console.log(`✅ Generated ${docs.length} documentation entries\n`)
  
  // Save to file
  const outputPath = path.join(process.cwd(), 'docs', 'PROJECTS_PAGE_DOCS.json')
  await fs.writeFile(outputPath, JSON.stringify({
    meta: {
      page: 'Projects',
      generated: new Date().toISOString(),
      totalDocuments: docs.length
    },
    documents: docs
  }, null, 2))
  
  console.log(`📄 Saved to: ${outputPath}`)
  console.log('\nGenerated documentation for:')
  docs.forEach((doc: any, i: number) => {
    console.log(`  ${i + 1}. ${doc.title}`)
  })
}

analyzeProjectsPage().catch(console.error)
