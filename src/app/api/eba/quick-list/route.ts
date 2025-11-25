import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

/**
 * GET /api/eba/quick-list
 * 
 * Lightweight endpoint for service worker caching and offline access.
 * Returns minimal EBA record data for quick lookups.
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
    const activeOnly = searchParams.get('active_only') !== 'false'; // Default to active only

    // Build query for minimal EBA data
    let query = supabase
      .from('company_eba_records')
      .select(`
        id,
        status,
        nominal_expiry_date,
        fwc_certified_date,
        employers!inner(
          id,
          name
        )
      `)
      .order('nominal_expiry_date', { ascending: false, nullsFirst: false })
      .limit(limit);

    // Filter to active EBAs if requested
    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;

    if (error) {
      console.error('[eba/quick-list] Error fetching EBA records:', error.message);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch EBA records' },
        { status: 500 }
      );
    }

    // Apply search filter (post-query since we're searching employer name)
    let filteredData = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((record: any) =>
        record.employers?.name?.toLowerCase().includes(searchLower)
      );
    }

    // Transform to minimal format
    const ebaRecords = filteredData.map((record: any) => ({
      id: record.id,
      employer_id: record.employers?.id,
      employer_name: record.employers?.name,
      status: record.status,
      expiry_date: record.nominal_expiry_date,
      certified_date: record.fwc_certified_date,
    }));

    return NextResponse.json(
      {
        success: true,
        data: ebaRecords,
        count: ebaRecords.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[eba/quick-list] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

