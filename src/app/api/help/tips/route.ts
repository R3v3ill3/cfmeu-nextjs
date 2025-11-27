import { NextResponse } from 'next/server'
import { getSectionsForRoute, loadGuide, getDocumentsByType } from '@/lib/helpGuide'
import { AppRole } from '@/constants/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TIPS = 5

function roleFilter(sectionTitle: string, role: AppRole | undefined): boolean {
  if (!role) return true
  const lower = sectionTitle.toLowerCase()
  if (role === 'admin') return true
  if (role === 'lead_organiser') {
    return !lower.includes('admin only')
  }
  if (role === 'organiser') {
    return !lower.includes('admin') && !lower.includes('co-ordinator')
  }
  if (role === 'delegate' || role === 'viewer') {
    return lower.includes('overview') || lower.includes('summary')
  }
  return true
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const route = searchParams.get('route') || '/'
  const role = (searchParams.get('role') as AppRole | null) ?? undefined
  const isMobile = searchParams.get('mobile') === 'true'
  const documentType = searchParams.get('type') as any || undefined
  const contextual = searchParams.get('contextual') === 'true'

  try {
    const guide = loadGuide()
    if (guide.error) {
      console.error('[help-tips] guide load error:', guide.error)
      return NextResponse.json({ tips: [], error: guide.error }, { status: 503 })
    }

    let sections = getSectionsForRoute(route, role, isMobile)

    // If no route-specific tips, provide general tips
    if (sections.length === 0) {
      // Get mobile-specific tips if on mobile
      if (isMobile) {
        const mobileDocs = getDocumentsByType('mobile-guide')
        if (mobileDocs.length > 0) {
          const mobileSections = guide.sections.filter(section =>
            section.documentId === mobileDocs[0].id &&
            (!section.roleFilter || !role || section.roleFilter.includes(role))
          )
          sections = mobileSections.slice(0, MAX_TIPS)
        }
      }

      // Fallback to getting document-type specific tips
      if (sections.length === 0 && documentType) {
        const docs = getDocumentsByType(documentType)
        if (docs.length > 0) {
          sections = guide.sections.filter(section =>
            section.documentId === docs[0].id &&
            (!section.roleFilter || !role || section.roleFilter.includes(role))
          )
        }
      }
    }

    if (sections.length === 0) {
      console.warn('[help-tips] no sections found for route', route)
      return NextResponse.json({ tips: [], lastLoaded: guide.lastLoaded })
    }

    const tips = sections
      .filter((section) => roleFilter(section.title, role))
      .map((section) => ({
        id: section.id,
        title: section.title,
        level: section.level,
        content: section.content.trim() || 'No additional content yet.',
        routeMatches: section.routeMatches,
        keywords: section.keywords,
        documentId: section.documentId,
        documentTitle: section.documentTitle,
        examples: contextual ? section.examples?.slice(0, 2) : undefined,
        relatedLinks: contextual ? section.relatedLinks : undefined,
        mobileOnly: section.mobileOnly,
        priority: calculateTipPriority(section, route, isMobile)
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_TIPS)

    return NextResponse.json({
      tips,
      lastLoaded: guide.lastLoaded,
      metadata: {
        route,
        role,
        isMobile,
        documentType,
        contextual,
        totalSections: sections.length
      }
    })
  } catch (err) {
    console.error('[help-tips] unhandled error', err)
    return NextResponse.json({ tips: [], error: 'Internal error loading help tips' }, { status: 500 })
  }
}

function calculateTipPriority(section: any, route: string, isMobile: boolean): number {
  let priority = 0

  // Higher priority for exact route matches
  if (section.routeMatches.includes(route)) {
    priority += 10
  }

  // Higher priority for route prefix matches
  const hasPrefixMatch = section.routeMatches.some((match: string) => route.startsWith(match))
  if (hasPrefixMatch) {
    priority += 5
  }

  // Higher priority for mobile content on mobile devices
  if (isMobile && section.mobileOnly) {
    priority += 8
  }

  // Higher priority for lower-level sections (more specific)
  if (section.level <= 2) {
    priority += 3
  }

  // Higher priority for content with examples
  if (section.examples && section.examples.length > 0) {
    priority += 2
  }

  return priority
}
