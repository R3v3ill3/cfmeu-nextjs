import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface DuplicateCheckRequest {
  name: string;
  projectId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { name, projectId }: DuplicateCheckRequest = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for exact name matches (case-insensitive)
    let exactQuery = supabase
      .from('projects')
      .select(`
        id,
        name,
        approval_status,
        value,
        stage_class,
        project_status,
        created_at,
        main_job_site:job_sites!main_job_site_id (
          full_address
        ),
        project_assignments!inner (
          assignment_type,
          employer:employers!employer_id (
            name
          )
        )
      `)
      .ilike('name', name);

    // Exclude current project if provided
    if (projectId) {
      exactQuery = exactQuery.neq('id', projectId);
    }

    const { data: exactMatches, error: exactError } = await exactQuery;

    if (exactError) {
      console.error('Exact match error:', exactError);
      return NextResponse.json(
        { error: 'Failed to check for exact matches' },
        { status: 500 }
      );
    }

    // Check for fuzzy matches using trigram similarity
    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc(
      'search_projects_by_name_similarity',
      {
        p_project_name: name,
        p_exclude_id: projectId || null,
        p_limit: 10,
        p_threshold: 0.3 // 30% similarity threshold
      }
    );

    if (fuzzyError) {
      console.error('Fuzzy match error:', fuzzyError);
      // Don't fail the request, just log and continue with exact matches only
    }

    const fuzzyMatches = fuzzyData || [];

    // Transform exact matches
    const transformedExactMatches = (exactMatches || []).map((project: any) => ({
      id: project.id,
      name: project.name,
      approval_status: project.approval_status,
      value: project.value,
      stage_class: project.stage_class,
      project_status: project.project_status,
      address: project.main_job_site?.full_address || null,
      builder_name: project.project_assignments
        ?.find((a: any) => a.assignment_type === 'builder')
        ?.employer?.name || null,
      created_at: project.created_at,
      match_type: 'exact' as const,
    }));

    // Transform fuzzy matches
    const transformedFuzzyMatches = fuzzyMatches.map((project: any) => ({
      id: project.id,
      name: project.name,
      approval_status: project.approval_status,
      value: project.value,
      stage_class: project.stage_class,
      project_status: project.project_status,
      address: project.address || null,
      builder_name: project.builder_name || null,
      created_at: project.created_at,
      match_type: 'fuzzy' as const,
      similarity_score: project.similarity || 0,
    }));

    const result = {
      has_exact_matches: transformedExactMatches.length > 0,
      has_fuzzy_matches: transformedFuzzyMatches.length > 0,
      exact_matches: transformedExactMatches,
      fuzzy_matches: transformedFuzzyMatches,
      searched_name: name,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Duplicate check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Duplicate check failed' },
      { status: 500 }
    );
  }
}
