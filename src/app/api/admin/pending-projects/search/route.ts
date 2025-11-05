import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = new Set(['admin', 'lead_organiser']);

export const dynamic = 'force-dynamic';

function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeProjectName(str1);
  const s2 = normalizeProjectName(str2);

  // Exact match
  if (s1 === s2) return 100;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length <= s2.length ? s1 : s2;
    return Math.round((shorter.length / longer.length) * 85);
  }

  // Levenshtein distance based similarity
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  const distance = matrix[s1.length][s2.length];
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

function calculateAddressSimilarity(addr1: string | null, addr2: string | null): number {
  if (!addr1 || !addr2) return 0;

  const normalize = (addr: string) =>
    addr.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

  const a1 = normalize(addr1);
  const a2 = normalize(addr2);

  if (a1 === a2) return 100;
  if (a1.includes(a2) || a2.includes(a1)) return 85;

  return calculateSimilarity(addr1, addr2);
}

function calculateValueSimilarity(val1: number | null, val2: number | null): number {
  if (val1 === null || val2 === null) return 0;
  if (val1 === val2) return 100;

  const diff = Math.abs(val1 - val2);
  const avg = (val1 + val2) / 2;
  const percentDiff = (diff / avg) * 100;

  // Within 10% tolerance
  if (percentDiff <= 10) return 95;
  if (percentDiff <= 20) return 80;
  if (percentDiff <= 30) return 60;

  return 0;
}

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

    // Search active projects by name, address, and value
    const { data: projects, error: searchError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        value,
        proposed_start_date,
        main_job_site_id,
        main_job_site:job_sites!main_job_site_id (
          id,
          full_address,
          suburb,
          state,
          postcode
        ),
        builder:project_assignments!inner (
          employer:employers (
            id,
            name
          )
        )
      `)
      .eq('approval_status', 'active')
      .or(`name.ilike.%${query}%,main_job_site.full_address.ilike.%${query}%`)
      .limit(Math.min(Math.max(limit, 1), 100));

    if (searchError) {
      console.error('[pending-projects/search] Search error:', searchError);
      return NextResponse.json({ error: searchError.message ?? 'Search failed' }, { status: 500 });
    }

    // Calculate similarity scores and match types
    const results = (projects || []).map(project => {
      const nameSimilarity = calculateSimilarity(query, project.name);
      const addressSimilarity = calculateAddressSimilarity(
        query,
        project.main_job_site?.full_address || null
      );

      // Try parsing query as number for value comparison
      const queryValue = parseFloat(query.replace(/[^0-9.]/g, ''));
      const valueSimilarity = !isNaN(queryValue)
        ? calculateValueSimilarity(queryValue, project.value)
        : 0;

      // Determine match type and score
      let matchType: 'name' | 'address' | 'value';
      let searchScore: number;

      if (nameSimilarity >= addressSimilarity && nameSimilarity >= valueSimilarity) {
        matchType = 'name';
        searchScore = nameSimilarity;
      } else if (addressSimilarity >= valueSimilarity) {
        matchType = 'address';
        searchScore = addressSimilarity;
      } else {
        matchType = 'value';
        searchScore = valueSimilarity;
      }

      // Boost score if multiple criteria match
      if (nameSimilarity >= 70 && addressSimilarity >= 70) {
        searchScore = Math.min(100, searchScore + 10);
      }
      if (nameSimilarity >= 70 && valueSimilarity >= 70) {
        searchScore = Math.min(100, searchScore + 10);
      }

      return {
        id: project.id,
        name: project.name,
        value: project.value,
        proposed_start_date: project.proposed_start_date,
        main_job_site: project.main_job_site
          ? {
              full_address: project.main_job_site.full_address,
              location: project.main_job_site.location,
              // Note: job_sites doesn't have suburb/state/postcode columns
              suburb: null,
              state: null,
              postcode: null,
            }
          : null,
        builder: Array.isArray(project.builder) && project.builder.length > 0 && project.builder[0].employer
          ? {
              id: project.builder[0].employer.id,
              name: project.builder[0].employer.name,
            }
          : null,
        matchType,
        searchScore,
        matchDetails: {
          nameSimilarity,
          addressSimilarity,
          valueSimilarity,
        },
      };
    })
    .filter(result => result.searchScore >= 50) // Filter out low-quality matches
    .sort((a, b) => b.searchScore - a.searchScore); // Sort by score descending

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[pending-projects/search] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
