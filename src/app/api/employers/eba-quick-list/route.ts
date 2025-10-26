import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { getEbaEmployersByTrade, searchEmployersWithAliases } from '@/lib/database/employerOperations';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

interface EbaQuickListResponse {
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    employer_type: string;
    enterprise_agreement_status: boolean;
    eba_status_source: string | null;
    eba_status_updated_at: string | null;
    estimated_worker_count: number | null;
    trades: Array<{
      code: string;
      name: string;
    }>;
    projects_count: number;
    last_eba_activity: string | null;
    search_score?: number;
    match_type?: string;
    matched_alias?: string;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filters_applied?: {
    trade_type?: string;
    search?: string;
    include_active_eba_only?: boolean;
  };
  error?: string;
  debug?: {
    queryTime: number;
    cacheHit: boolean;
    usedAliasSearch: boolean;
  };
}

// GET /api/employers/eba-quick-list - Get EBA employers filtered by trade
async function getEbaQuickListHandler(request: NextRequest) {
  const startTime = Date.now();

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
    const trade_type = searchParams.get('trade_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '50'), 1), 200);
    const include_active_eba_only = searchParams.get('include_active_eba_only') !== 'false';
    const include_aliases = searchParams.get('include_aliases') === 'true';
    const alias_match_mode = (searchParams.get('alias_match_mode') || 'any') as 'any' | 'authoritative' | 'canonical';

    const offset = (page - 1) * pageSize;

    let result: any = { success: false };
    let usedAliasSearch = false;

    // If there's a search query and aliases are enabled, use alias-aware search
    if (search && include_aliases) {
      usedAliasSearch = true;

      const searchResult = await searchEmployersWithAliases(search, {
        limit: pageSize,
        offset,
        includeAliases: true,
        aliasMatchMode: alias_match_mode,
        ebaStatus: include_active_eba_only ? 'active' : 'all'
      });

      if (searchResult.success) {
        // Filter by trade type if specified
        let filteredData = searchResult.data || [];
        if (trade_type) {
          filteredData = filteredData.filter((employer: any) => {
            const trades = employer.category_trades_json || [];
            return trades.some((trade: any) => trade.code === trade_type);
          });
        }

        // Transform to expected format
        result = {
          success: true,
          data: filteredData.map((employer: any) => ({
            id: employer.id,
            name: employer.name,
            employer_type: employer.employer_type,
            enterprise_agreement_status: employer.enterprise_agreement_status,
            eba_status_source: employer.eba_status_source,
            eba_status_updated_at: employer.eba_status_updated_at,
            estimated_worker_count: employer.estimated_worker_count,
            trades: (employer.category_trades_json || [])
              .filter((trade: any) => !trade_type || trade.code === trade_type)
              .map((trade: any) => ({
                code: trade.code,
                name: trade.name
              })),
            projects_count: employer.project_count || 0,
            last_eba_activity: employer.most_recent_eba_date,
            search_score: employer.search_score,
            match_type: employer.match_type,
            matched_alias: employer.matched_alias
          })),
          totalCount: searchResult.count || filteredData.length
        };
      } else {
        result = { success: false, error: searchResult.error };
      }
    } else {
      // Use the standard EBA trade filtering
      const ebaResult = await getEbaEmployersByTrade({
        trade_type,
        search,
        limit: pageSize,
        offset,
        include_active_eba_only
      });

      if (ebaResult.success) {
        result = {
          success: true,
          data: ebaResult.data,
          totalCount: ebaResult.count
        };
      } else {
        result = { success: false, error: ebaResult.error };
      }
    }

    if (!result.success) {
      console.error('Failed to fetch EBA quick list:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch EBA employers'
      }, { status: 500 });
    }

    const totalCount = result.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const queryTime = Date.now() - startTime;

    const response: EbaQuickListResponse = {
      success: true,
      data: result.data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      },
      filters_applied: {
        trade_type,
        search,
        include_active_eba_only
      },
      debug: {
        queryTime,
        cacheHit: false, // TODO: Implement caching in future
        usedAliasSearch
      }
    };

    // Add cache headers for CDN/browser caching
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // 1min cache, 5min stale
      'Content-Type': 'application/json',
      'X-Employer-Count': result.data.length.toString(),
      'X-Total-Rows': totalCount.toString(),
      'X-Query-Time': `${queryTime}ms`,
      'X-Alias-Search': usedAliasSearch.toString()
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Unexpected error in GET /api/employers/eba-quick-list:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET available trade types for EBA filtering
async function getTradeTypesHandler(request: NextRequest) {
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

    // Get unique trade types from employers with active EBAs
    const { data, error } = await supabase
      .from('employers_search_optimized')
      .select('category_trades_json')
      .eq('enterprise_agreement_status', true)
      .not('category_trades_json', 'is', null);

    if (error) {
      console.error('Error fetching trade types:', error);
      return NextResponse.json({ error: 'Failed to fetch trade types' }, { status: 500 });
    }

    // Extract unique trade types
    const tradeTypesMap = new Map<string, { code: string; name: string; count: number }>();

    (data || []).forEach((employer: any) => {
      const trades = employer.category_trades_json || [];
      trades.forEach((trade: any) => {
        if (trade && trade.code && trade.name) {
          const existing = tradeTypesMap.get(trade.code);
          if (existing) {
            existing.count++;
          } else {
            tradeTypesMap.set(trade.code, {
              code: trade.code,
              name: trade.name,
              count: 1
            });
          }
        }
      });
    });

    // Convert to array and sort by count (most used first) then by name
    const tradeTypes = Array.from(tradeTypesMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      success: true,
      trade_types: tradeTypes,
      total_types: tradeTypes.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache, 10min stale
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/employers/eba-quick-list/trades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export the handlers with rate limiting
export const GET = withRateLimit(getEbaQuickListHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY);

// Export trade types as a separate endpoint
export async function TRADE_TYPES(request: NextRequest) {
  return withRateLimit(getTradeTypesHandler, RATE_LIMIT_PRESETS.DEFAULT)(request);
}