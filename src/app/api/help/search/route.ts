import { NextRequest, NextResponse } from 'next/server'
import { searchGuide, getDocumentsByType } from '@/lib/helpGuide'

const MAX_RESULTS = 10

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const role = searchParams.get('role') || undefined
    const isMobile = searchParams.get('mobile') === 'true'
    const documentType = searchParams.get('type') as any || undefined

    if (!q) {
      // If no query, return top documents by type
      if (documentType) {
        const documents = getDocumentsByType(documentType)
        return NextResponse.json({
          results: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            type: 'document',
            documentType: doc.documentType,
            mobileOptimized: doc.mobileOptimized,
            lastModified: doc.lastModified
          }))
        })
      }
      return NextResponse.json({ results: [] })
    }

    // Enhanced search with role filtering and mobile optimization
    const sections = searchGuide(q, role, isMobile, documentType).slice(0, MAX_RESULTS)

    return NextResponse.json({
      results: sections.map((section) => ({
        id: section.id,
        title: section.title,
        snippet: section.content.slice(0, 240),
        routeMatches: section.routeMatches,
        documentId: section.documentId,
        documentTitle: section.documentTitle,
        examples: section.examples?.slice(0, 3), // Limit examples
        relatedLinks: section.relatedLinks,
        mobileOnly: section.mobileOnly,
        score: 1 // Placeholder for future scoring
      })),
      metadata: {
        query: q,
        totalResults: sections.length,
        role,
        isMobile,
        documentType
      }
    })
  } catch (error) {
    console.error('Help search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search help content' },
      { status: 500 }
    )
  }
}
