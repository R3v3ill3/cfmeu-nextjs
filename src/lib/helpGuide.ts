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
}

export type HelpGuide = {
  sections: HelpSection[]
  lastLoaded: number
  error?: string
}

let cachedGuide: HelpGuide | null = null
let cachedMtime: number | null = null
let resolvedGuidePath: string | null = null

const ROUTE_HINTS: Record<string, string[]> = {
  '/': ['dashboard', 'landing page', 'home'],
  '/projects': ['projects', 'project detail', 'mapping sheets'],
  '/employers': ['employers', 'company', 'eba'],
  '/workers': ['workers', 'members', 'placements'],
  '/map': ['map', 'geography', 'locations'],
  '/patch': ['patch', 'workspace', 'organiser'],
  '/site-visits': ['site visits', 'visits', 'compliance'],
  '/campaigns': ['campaigns', 'activities', 'tracking'],
  '/lead': ['co-ordinator', 'lead organiser'],
  '/admin': ['administration', 'management', 'user management'],
  '/guide': ['guide', 'documentation']
}

function resolveGuidePath(): string | null {
  if (resolvedGuidePath && fs.existsSync(resolvedGuidePath)) {
    return resolvedGuidePath
  }

  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'USER_GUIDE.md'),
    path.join(cwd, '..', 'USER_GUIDE.md'),
    path.join(cwd, 'public', 'USER_GUIDE.md'),
    path.join(cwd, '..', 'public', 'USER_GUIDE.md')
  ]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        resolvedGuidePath = candidate
        return resolvedGuidePath
      }
    } catch (err) {
      // ignore and try next candidate
    }
  }

  return null
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

function extractSections(markdown: string): HelpSection[] {
  const lines = markdown.split(/\r?\n/)
  const sections: HelpSection[] = []
  const stack: HelpSection[] = []

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    if (match) {
      const level = match[1].length
      const title = match[2].trim()
      const id = slugify(title || `section-${sections.length + 1}`)
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      const parent = stack[stack.length - 1]
      const section: HelpSection = {
        id,
        title,
        level,
        content: '',
        parentId: parent ? parent.id : undefined,
        routeMatches: detectRouteMatches(title),
        keywords: title
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .filter(Boolean)
      }
      sections.push(section)
      stack.push(section)
    } else if (stack.length > 0) {
      const current = stack[stack.length - 1]
      current.content = current.content ? `${current.content}\n${line}` : line
      if (line.trim()) {
        const lower = line.toLowerCase()
        current.keywords.push(...lower.split(/[^a-z0-9]+/g).filter(Boolean))
        current.routeMatches.push(...detectRouteMatches(line))
      }
    }
  }

  return sections.map((section) => ({
    ...section,
    routeMatches: Array.from(new Set(section.routeMatches)),
    keywords: Array.from(new Set(section.keywords))
  }))
}

function loadGuideFresh(): HelpGuide {
  const guidePath = resolveGuidePath()
  if (!guidePath) {
    cachedGuide = {
      sections: [],
      lastLoaded: Date.now(),
      error: 'USER_GUIDE.md not found'
    }
    cachedMtime = null
    return cachedGuide
  }

  try {
    const stats = fs.statSync(guidePath)
    const markdown = fs.readFileSync(guidePath, 'utf-8')
    const sections = extractSections(markdown)
    cachedGuide = {
      sections,
      lastLoaded: Date.now()
    }
    cachedMtime = stats.mtimeMs
    return cachedGuide
  } catch (err) {
    cachedGuide = {
      sections: [],
      lastLoaded: Date.now(),
      error: err instanceof Error ? err.message : 'Failed to load guide'
    }
    cachedMtime = null
    return cachedGuide
  }
}

export function loadGuide(force = false): HelpGuide {
  if (!force && cachedGuide && cachedMtime !== null) {
    try {
      const guidePath = resolveGuidePath()
      if (guidePath) {
        const stats = fs.statSync(guidePath)
        if (stats.mtimeMs === cachedMtime) {
          return cachedGuide
        }
      } else {
        return cachedGuide
      }
    } catch (err) {
      // Ignore and fall through to reload
    }
  }
  return loadGuideFresh()
}

export function getSectionsForRoute(route: string): HelpSection[] {
  const guide = loadGuide()
  if (guide.sections.length === 0) {
    return []
  }
  const normalizedRoute = route.split('?')[0]
  const exactMatches = guide.sections.filter((section) =>
    section.routeMatches.includes(normalizedRoute)
  )
  if (exactMatches.length > 0) {
    return exactMatches
  }
  const hintMatches = guide.sections.filter((section) =>
    section.routeMatches.some((match) => normalizedRoute.startsWith(match))
  )
  if (hintMatches.length > 0) {
    return hintMatches
  }
  return guide.sections.filter((section) => section.level <= 2).slice(0, 5)
}

export function searchGuide(query: string): HelpSection[] {
  const guide = loadGuide()
  if (guide.sections.length === 0) {
    return []
  }
  const terms = query.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)
  if (terms.length === 0) return []

  const scored = guide.sections.map((section) => {
    const titleMatches = terms.some((term) => section.title.toLowerCase().includes(term))
    const keywordMatches = terms.filter((term) => section.keywords.includes(term)).length
    const contentMatches = terms.filter((term) => section.content.toLowerCase().includes(term)).length
    const score = (titleMatches ? 5 : 0) + keywordMatches * 2 + contentMatches
    return { section, score }
  })

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.section)
}
