import fs from 'fs'
import path from 'path'

export type HelpSection = {
  id: string
  title: string
  level: number
  content: string
  parentId?: string
  routeMatches: string[]
  keywords: string[]
  documentId?: string
  documentTitle?: string
  roleFilter?: string[]
  mobileOnly?: boolean
  examples?: string[]
  relatedLinks?: Array<{ label: string; url: string }>
}

export type HelpDocument = {
  id: string
  title: string
  path: string
  lastModified: number
  roleAccess?: string[]
  mobileOptimized?: boolean
  documentType: 'user-guide' | 'workflow-guide' | 'mobile-guide' | 'system-guide'
}

export type HelpGuide = {
  sections: HelpSection[]
  documents: HelpDocument[]
  lastLoaded: number
  error?: string
}

let cachedGuide: HelpGuide | null = null
let cachedMtime: number | null = null
let resolvedDocuments: HelpDocument[] = []

const ROUTE_HINTS: Record<string, string[]> = {
  '/': ['dashboard', 'landing page', 'home', 'getting started'],
  '/projects': ['projects', 'project detail', 'mapping sheets', 'site visit'],
  '/employers': ['employers', 'company', 'eba', 'ratings', 'sham contracting'],
  '/workers': ['workers', 'members', 'placements', 'delegates'],
  '/map': ['map', 'geography', 'locations', 'gps', 'navigation'],
  '/patch': ['patch', 'workspace', 'organiser', 'geographic area'],
  '/site-visits': ['site visits', 'visits', 'compliance', 'audit'],
  '/campaigns': ['campaigns', 'activities', 'tracking'],
  '/lead': ['co-ordinator', 'lead organiser', 'management console'],
  '/admin': ['administration', 'management', 'user management'],
  '/guide': ['guide', 'documentation', 'help'],
  '/mobile': ['mobile', 'pwa', 'app', 'offline', 'field work'],
  '/mobile/ratings': ['mobile ratings', 'employer ratings', 'assessment'],
  '/site-visit-wizard': ['wizard', 'step by step', 'workflow'],
  '/delegate-tasks': ['delegate', 'webform', 'task assignment'],
  '/compliance': ['compliance', 'traffic light', 'audit', 'safety']
}

function resolveHelpDocuments(): HelpDocument[] {
  if (resolvedDocuments.length > 0) {
    return resolvedDocuments
  }

  const cwd = process.cwd()
  const publicDir = path.join(cwd, 'public')

  // Core documentation files
  const documentCandidates: Array<{
    id: string
    title: string
    relativePath: string
    documentType: HelpDocument['documentType']
    roleAccess?: string[]
    mobileOptimized?: boolean
  }> = [
    {
      id: 'user-guide',
      title: 'CFMEU Organiser Platform User Guide',
      relativePath: 'USER_GUIDE.md',
      documentType: 'user-guide',
      roleAccess: ['admin', 'lead_organiser', 'organiser', 'delegate', 'viewer'],
      mobileOptimized: true
    },
    {
      id: 'site-visit-workflow',
      title: 'Site Visit Workflow Guide',
      relativePath: 'guides/site-visit-workflow.md',
      documentType: 'workflow-guide',
      roleAccess: ['admin', 'lead_organiser', 'organiser'],
      mobileOptimized: true
    },
    {
      id: 'mobile-app-guide',
      title: 'Mobile App User Guide',
      relativePath: 'guides/mobile-app-user-guide.md',
      documentType: 'mobile-guide',
      roleAccess: ['admin', 'lead_organiser', 'organiser'],
      mobileOptimized: true
    },
    {
      id: 'ratings-system-v2',
      title: 'Employer Ratings System v2 Guide',
      relativePath: 'guides/ratings-system-v2.md',
      documentType: 'system-guide',
      roleAccess: ['admin', 'lead_organiser', 'organiser'],
      mobileOptimized: true
    }
  ]

  const documents: HelpDocument[] = []

  for (const candidate of documentCandidates) {
    const fullPath = path.join(publicDir, candidate.relativePath)
    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        documents.push({
          id: candidate.id,
          title: candidate.title,
          path: fullPath,
          lastModified: stats.mtimeMs,
          roleAccess: candidate.roleAccess,
          mobileOptimized: candidate.mobileOptimized,
          documentType: candidate.documentType
        })
      } else {
        console.warn(`Help document not found: ${fullPath}`)
      }
    } catch (err) {
      console.error(`Error accessing help document ${fullPath}:`, err)
    }
  }

  resolvedDocuments = documents
  return documents
}

function resolveGuidePath(): string | null {
  // This function is kept for backward compatibility
  // The new system uses resolveHelpDocuments() instead
  const documents = resolveHelpDocuments()
  const userGuide = documents.find(doc => doc.id === 'user-guide')
  return userGuide?.path || null
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function detectRouteMatches(text: string): string[] {
  const matches: string[] = []
  for (const [route, keywords] of Object.entries(ROUTE_HINTS)) {
    const lower = text.toLowerCase()
    if (keywords.some((keyword) => lower.includes(keyword))) {
      matches.push(route)
    }
  }
  return matches
}

function extractSections(markdown: string, document: HelpDocument): HelpSection[] {
  const lines = markdown.split(/\r?\n')
  const sections: HelpSection[] = []
  const stack: HelpSection[] = []
  let currentSection: HelpSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = /^(#{1,6})\s+(.*)$/.exec(line)

    if (match) {
      const level = match[1].length
      const title = match[2].trim()
      const id = `${document.id}-${slugify(title || `section-${sections.length + 1}`)}`

      // Close previous section content processing
      if (currentSection) {
        // Extract metadata from content
        extractSectionMetadata(currentSection, lines, i)
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      const parent = stack[stack.length - 1]
      currentSection = {
        id,
        title,
        level,
        content: '',
        parentId: parent ? parent.id : undefined,
        routeMatches: detectRouteMatches(title),
        keywords: title
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .filter(Boolean),
        documentId: document.id,
        documentTitle: document.title,
        roleFilter: document.roleAccess,
        mobileOnly: document.mobileOptimized && document.documentType === 'mobile-guide'
      }

      sections.push(currentSection)
      stack.push(currentSection)
    } else if (currentSection) {
      currentSection.content = currentSection.content ? `${currentSection.content}\n${line}` : line
      if (line.trim()) {
        const lower = line.toLowerCase()
        currentSection.keywords.push(...lower.split(/[^a-z0-9]+/g).filter(Boolean))
        currentSection.routeMatches.push(...detectRouteMatches(line))
      }
    }
  }

  // Process metadata for the last section
  if (currentSection) {
    extractSectionMetadata(currentSection, lines, lines.length)
  }

  return sections.map((section) => ({
    ...section,
    routeMatches: Array.from(new Set(section.routeMatches)),
    keywords: Array.from(new Set(section.keywords))
  }))
}

function extractSectionMetadata(section: HelpSection, lines: string[], currentIndex: number): void {
  const contentLines = section.content.split('\n')

  // Extract examples (look for numbered lists, bullet points after "Example:")
  const examples: string[] = []
  const relatedLinks: Array<{ label: string; url: string }> = []

  let inExamplesSection = false
  let inRelatedLinksSection = false

  for (const line of contentLines) {
    const trimmedLine = line.trim()

    // Detect examples section
    if (trimmedLine.toLowerCase().includes('example:') ||
        trimmedLine.toLowerCase().includes('examples:') ||
        trimmedLine.toLowerCase().includes('for example:')) {
      inExamplesSection = true
      inRelatedLinksSection = false
      continue
    }

    // Detect related links section
    if (trimmedLine.toLowerCase().includes('related:') ||
        trimmedLine.toLowerCase().includes('see also:') ||
        trimmedLine.toLowerCase().includes('learn more:')) {
      inRelatedLinksSection = true
      inExamplesSection = false
      continue
    }

    // Extract examples
    if (inExamplesSection) {
      if (trimmedLine.match(/^[-*]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
        examples.push(trimmedLine.replace(/^[-*]\s+|^\d+\.\s+/, ''))
      } else if (trimmedLine === '') {
        // Empty line ends the examples section
        inExamplesSection = false
      }
    }

    // Extract related links
    if (inRelatedLinksSection) {
      const linkMatch = trimmedLine.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        relatedLinks.push({
          label: linkMatch[1],
          url: linkMatch[2]
        })
      }
    }
  }

  // Add extracted metadata to section
  if (examples.length > 0) {
    section.examples = examples.slice(0, 5) // Limit to 5 examples
  }

  if (relatedLinks.length > 0) {
    section.relatedLinks = relatedLinks
  }
}

function loadGuideFresh(): HelpGuide {
  const documents = resolveHelpDocuments()
  const allSections: HelpSection[] = []
  let totalMtime = 0
  let error: string | undefined

  if (documents.length === 0) {
    cachedGuide = {
      sections: [],
      documents: [],
      lastLoaded: Date.now(),
      error: 'No help documents found'
    }
    cachedMtime = null
    return cachedGuide
  }

  for (const document of documents) {
    try {
      const markdown = fs.readFileSync(document.path, 'utf-8')
      const sections = extractSections(markdown, document)
      allSections.push(...sections)
      totalMtime = Math.max(totalMtime, document.lastModified)
    } catch (err) {
      console.error(`Failed to load help document ${document.title}:`, err)
      if (!error) {
        error = err instanceof Error ? err.message : 'Failed to load some help documents'
      }
    }
  }

  cachedGuide = {
    sections: allSections,
    documents,
    lastLoaded: Date.now(),
    error
  }
  cachedMtime = totalMtime
  return cachedGuide
}

export function loadGuide(force = false): HelpGuide {
  if (!force && cachedGuide && cachedMtime !== null) {
    try {
      const documents = resolveHelpDocuments()
      let totalMtime = 0
      let allExist = true

      for (const document of documents) {
        try {
          const stats = fs.statSync(document.path)
          totalMtime = Math.max(totalMtime, stats.mtimeMs)
        } catch {
          allExist = false
          break
        }
      }

      if (allExist && documents.length > 0 && totalMtime === cachedMtime) {
        return cachedGuide
      }
    } catch (err) {
      // Ignore and fall through to reload
    }
  }
  return loadGuideFresh()
}

export function getSectionsForRoute(route: string, userRole?: string, isMobile?: boolean): HelpSection[] {
  const guide = loadGuide()
  if (guide.sections.length === 0) {
    return []
  }

  const normalizedRoute = route.split('?')[0]

  // Filter sections based on role and mobile access
  const accessibleSections = guide.sections.filter((section) => {
    // Role-based filtering
    if (section.roleFilter && userRole && !section.roleFilter.includes(userRole)) {
      return false
    }

    // Mobile-specific filtering
    if (isMobile && !section.mobileOnly && section.documentId?.includes('mobile-app-guide')) {
      // Prioritize mobile-optimized content on mobile devices
    }

    return true
  })

  // Exact route matches
  const exactMatches = accessibleSections.filter((section) =>
    section.routeMatches.includes(normalizedRoute)
  )

  if (exactMatches.length > 0) {
    // Prioritize mobile-optimized content on mobile devices
    if (isMobile) {
      return [
        ...exactMatches.filter(s => s.mobileOnly),
        ...exactMatches.filter(s => !s.mobileOnly)
      ]
    }
    return exactMatches
  }

  // Route prefix matches
  const hintMatches = accessibleSections.filter((section) =>
    section.routeMatches.some((match) => normalizedRoute.startsWith(match))
  )

  if (hintMatches.length > 0) {
    if (isMobile) {
      return [
        ...hintMatches.filter(s => s.mobileOnly),
        ...hintMatches.filter(s => !s.mobileOnly)
      ]
    }
    return hintMatches
  }

  // Fallback to top-level sections
  const topLevelSections = accessibleSections.filter((section) => section.level <= 2)
  if (isMobile) {
    return [
      ...topLevelSections.filter(s => s.mobileOnly),
      ...topLevelSections.filter(s => !s.mobileOnly)
    ].slice(0, 5)
  }

  return topLevelSections.slice(0, 5)
}

export function searchGuide(
  query: string,
  userRole?: string,
  isMobile?: boolean,
  documentType?: HelpDocument['documentType']
): HelpSection[] {
  const guide = loadGuide()
  if (guide.sections.length === 0) {
    return []
  }

  const terms = query.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)
  if (terms.length === 0) return []

  // Filter sections based on access and criteria
  const searchableSections = guide.sections.filter((section) => {
    // Role-based filtering
    if (section.roleFilter && userRole && !section.roleFilter.includes(userRole)) {
      return false
    }

    // Document type filtering
    if (documentType) {
      const targetDoc = guide.documents.find(doc => doc.id === section.documentId)
      if (!targetDoc || targetDoc.documentType !== documentType) {
        return false
      }
    }

    // Mobile preference
    if (isMobile && section.mobileOnly) {
      return true // Prioritize mobile content
    }

    return true
  })

  const scored = searchableSections.map((section) => {
    let score = 0

    // Title matches (highest weight)
    const titleMatches = terms.some((term) => section.title.toLowerCase().includes(term))
    if (titleMatches) score += 10

    // Keyword matches (high weight)
    const keywordMatches = terms.filter((term) => section.keywords.includes(term)).length
    score += keywordMatches * 5

    // Content matches (medium weight)
    const contentMatches = terms.filter((term) => section.content.toLowerCase().includes(term)).length
    score += contentMatches * 2

    // Document title matches (bonus)
    if (section.documentTitle) {
      const docTitleMatches = terms.some((term) =>
        section.documentTitle.toLowerCase().includes(term)
      )
      if (docTitleMatches) score += 3
    }

    // Mobile optimization bonus on mobile devices
    if (isMobile && section.mobileOnly) {
      score += 2
    }

    // Recent document bonus (based on last modified)
    const document = guide.documents.find(doc => doc.id === section.documentId)
    if (document) {
      const daysSinceModified = (Date.now() - document.lastModified) / (1000 * 60 * 60 * 24)
      if (daysSinceModified < 30) score += 1 // Recent content bonus
    }

    return { section, score }
  })

  const results = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.section)

  // Prioritize mobile content on mobile devices
  if (isMobile) {
    const mobileResults = results.filter(s => s.mobileOnly)
    const otherResults = results.filter(s => !s.mobileOnly)
    return [...mobileResults, ...otherResults]
  }

  return results
}

// New function to get documents by type
export function getDocumentsByType(type: HelpDocument['documentType']): HelpDocument[] {
  const guide = loadGuide()
  return guide.documents.filter(doc => doc.documentType === type)
}

// New function to get sections by document
export function getSectionsByDocument(documentId: string, userRole?: string): HelpSection[] {
  const guide = loadGuide()
  return guide.sections.filter(section => {
    if (section.documentId !== documentId) return false
    if (section.roleFilter && userRole && !section.roleFilter.includes(userRole)) return false
    return true
  })
}
