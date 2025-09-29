import { NextResponse } from 'next/server'
import { getSectionsForRoute, loadGuide } from '@/lib/helpGuide'
import { AppRole } from '@/constants/roles'

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

  const guide = loadGuide()
  const sections = getSectionsForRoute(route)

  if (sections.length === 0) {
    return NextResponse.json({ tips: [], lastLoaded: guide.lastLoaded })
  }

  const tips = sections
    .filter((section) => roleFilter(section.title, role))
    .map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      content: section.content.trim(),
      routeMatches: section.routeMatches,
      keywords: section.keywords
    }))
    .slice(0, MAX_TIPS)

  return NextResponse.json({ tips, lastLoaded: guide.lastLoaded })
}
