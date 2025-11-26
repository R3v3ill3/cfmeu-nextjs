import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

/**
 * GET /api/employers/quick-list
 * 
 * Lightweight endpoint for service worker caching and offline access.
 * Returns minimal employer data suitable for quick lookups and autocomplete.
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
    const ebaOnly = searchParams.get('eba_only') === 'true';

    // Build query for minimal employer data
    let query = supabase
      .from('employers')
      .select('id, name, employer_type, enterprise_agreement_status, abn')
      .order('name', { ascending: true })
      .limit(limit);

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Filter to only employers with EBA if requested
    if (ebaOnly) {
      query = query.eq('enterprise_agreement_status', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[employers/quick-list] Error fetching employers:', error.message);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employers' },
        { status: 500 }
      );
    }

    // Transform to minimal format
    const employers = (data || []).map((emp) => ({
      id: emp.id,
      name: emp.name,
      type: emp.employer_type,
      eba: emp.enterprise_agreement_status || false,
      abn: emp.abn,
    }));

    return NextResponse.json(
      {
        success: true,
        data: employers,
        count: employers.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[employers/quick-list] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


