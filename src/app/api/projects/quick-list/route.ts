import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

/**
 * GET /api/projects/quick-list
 * 
 * Lightweight endpoint for service worker caching and offline access.
 * Returns minimal project data suitable for quick lookups and navigation.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);
    const search = searchParams.get('search') || undefined;
    const stage = searchParams.get('stage') || undefined;
    const patchId = searchParams.get('patch_id') || undefined;

    // Build query for minimal project data
    let query = supabase
      .from('projects')
      .select(`
        id,
        name,
        stage,
        tier,
        job_sites!inner(
          id,
          street_address,
          suburb,
          patch_id
        )
      `)
      .order('name', { ascending: true })
      .limit(limit);

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Filter by stage if specified
    if (stage) {
      query = query.eq('stage', stage);
    }

    // Filter by patch if specified
    if (patchId) {
      query = query.eq('job_sites.patch_id', patchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[projects/quick-list] Error fetching projects:', error.message);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    // Transform to minimal format
    const projects = (data || []).map((proj: any) => {
      const primarySite = proj.job_sites?.[0];
      return {
        id: proj.id,
        name: proj.name,
        stage: proj.stage,
        tier: proj.tier,
        address: primarySite
          ? `${primarySite.street_address || ''}, ${primarySite.suburb || ''}`.replace(/^, |, $/g, '')
          : null,
        patch_id: primarySite?.patch_id || null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: projects,
        count: projects.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[projects/quick-list] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


