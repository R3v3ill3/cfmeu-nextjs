import { NextResponse } from 'next/server'
import { searchGuide } from '@/lib/helpGuide'

const MAX_RESULTS = 10

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) {
    return NextResponse.json({ results: [] })
  }

  const sections = searchGuide(q).slice(0, MAX_RESULTS)
  return NextResponse.json({
    results: sections.map((section) => ({
      id: section.id,
      title: section.title,
      snippet: section.content.slice(0, 240),
      routeMatches: section.routeMatches
    }))
  })
}
