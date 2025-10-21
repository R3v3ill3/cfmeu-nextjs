import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = new Set(['admin', 'lead_organiser']);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = Number(searchParams.get('limit') ?? '40');
    const includeAliases = searchParams.get('includeAliases') !== 'false';
    const aliasMatchMode = searchParams.get('aliasMatchMode') ?? 'any';

    const { data, error: rpcError } = await supabase.rpc('search_employers_with_aliases', {
      p_query: query,
      p_limit: Math.min(Math.max(limit, 1), 100),
      p_offset: 0,
      p_include_aliases: includeAliases,
      p_alias_match_mode: aliasMatchMode,
    });

    if (rpcError) {
      console.error('[pending-employers/search] RPC error:', rpcError);
      return NextResponse.json({ error: rpcError.message ?? 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (error) {
    console.error('[pending-employers/search] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


