import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/projects/search
 *
 * Searches projects using full-text search (same as ProjectQuickFinder)
 * Used for bulk upload project matching
 * Bypasses RLS to allow searching all projects
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ projects: [] })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use existing working RPC function (same as ProjectQuickFinder)
    // This bypasses RLS and uses full-text search with similarity ranking
    const { data, error } = await supabase.rpc('search_projects_basic', {
      p_query: query,
      p_limit: 50,
    })

    if (error) {
      console.error('Project search error:', error)
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      )
    }

    // Map to expected format (search_projects_basic returns: id, name, full_address, builder_name)
    const projects = (data || []).map((p: any) => ({
      id: p.id,
      project_name: p.name,
      project_address: p.full_address || '',
      project_number: null, // Not available in quick search view
      builder: p.builder_name,
    }))

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Project search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
