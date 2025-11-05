import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ProjectDuplicateDetectionResult, DuplicateProjectGroup, DuplicateProjectMember } from '@/types/pendingProjectReview';

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

function checkPostcodeMatch(postcode1: string | null, postcode2: string | null): boolean {
  if (!postcode1 || !postcode2) return false;
  return postcode1.trim() === postcode2.trim();
}

function checkStateMatch(state1: string | null, state2: string | null): boolean {
  if (!state1 || !state2) return false;
  return state1.toLowerCase() === state2.toLowerCase();
}

function calculateOverallSimilarity(
  nameSim: number,
  addressSim: number,
  valueSim: number,
  postcodeMatch: boolean,
  stateMatch: boolean
): number {
  // Primary: Name similarity (50% weight)
  let score = nameSim * 0.5;

  // Secondary: Address similarity (30% weight)
  score += addressSim * 0.3;

  // Tertiary: Value similarity (15% weight)
  score += valueSim * 0.15;

  // Bonus: Postcode match (3%)
  if (postcodeMatch) score += 3;

  // Bonus: State match (2%)
  if (stateMatch) score += 2;

  return Math.min(100, Math.round(score));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or lead_organiser
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !['admin', 'lead_organiser'].includes(userProfile.role)) {
      return NextResponse.json({
        error: 'Forbidden - admin or lead_organiser access required'
      }, { status: 403 });
    }

    // Fetch all pending projects
    console.log('[detect-duplicates] Fetching pending projects...');
    const { data: pendingProjects, error: pendingError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        value,
        created_at,
        main_job_site:job_sites!main_job_site_id (
          full_address,
          suburb,
          state,
          postcode
        )
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    if (pendingError) {
      console.error('[detect-duplicates] Error fetching pending projects:', pendingError);
      return NextResponse.json({
        error: 'Failed to fetch pending projects',
        details: pendingError.message,
      }, { status: 500 });
    }

    if (!pendingProjects || pendingProjects.length === 0) {
      return NextResponse.json({
        success: true,
        groups: [],
        total_groups: 0,
        total_pending: 0,
      } as ProjectDuplicateDetectionResult);
    }

    // Fetch all active projects for comparison
    console.log('[detect-duplicates] Fetching active projects...');
    const { data: activeProjects, error: activeError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        value,
        created_at,
        main_job_site:job_sites!main_job_site_id (
          full_address,
          suburb,
          state,
          postcode
        )
      `)
      .eq('approval_status', 'active')
      .order('created_at', { ascending: true });

    if (activeError) {
      console.error('[detect-duplicates] Error fetching active projects:', activeError);
      return NextResponse.json({
        error: 'Failed to fetch active projects',
        details: activeError.message,
      }, { status: 500 });
    }

    // Combine pending and active projects for comparison
    const allProjects = [...pendingProjects, ...(activeProjects || [])];

    // Find duplicate groups
    const groups: DuplicateProjectGroup[] = [];
    const processedIds = new Set<string>();

    for (const project of pendingProjects) {
      if (processedIds.has(project.id)) continue;

      const members: DuplicateProjectMember[] = [];
      const similarities: { id: string; similarity: number }[] = [];

      // Compare with all other projects
      for (const otherProject of allProjects) {
        if (project.id === otherProject.id) continue;
        if (processedIds.has(otherProject.id)) continue;

        const nameSim = calculateSimilarity(project.name, otherProject.name);
        const addressSim = calculateAddressSimilarity(
          project.main_job_site?.full_address || null,
          otherProject.main_job_site?.full_address || null
        );
        const valueSim = calculateValueSimilarity(project.value, otherProject.value);
        // Note: job_sites doesn't have postcode/state columns, only full_address and location
        const postcodeMatch = false; // Can't match postcodes without that field
        const stateMatch = false; // Can't match states without that field

        const overallSim = calculateOverallSimilarity(
          nameSim,
          addressSim,
          valueSim,
          postcodeMatch,
          stateMatch
        );

        // Match criteria: overall similarity >= 70%
        if (overallSim >= 70) {
          similarities.push({ id: otherProject.id, similarity: overallSim });
        }
      }

      // If we found matches, create a group
      if (similarities.length > 0) {
        // Add the canonical project
        members.push({
          id: project.id,
          name: project.name,
          value: project.value,
          address: project.main_job_site?.full_address || project.main_job_site?.location || null,
          suburb: null, // job_sites doesn't have suburb column
          state: null, // job_sites doesn't have state column
          postcode: null, // job_sites doesn't have postcode column
          created_at: project.created_at,
          auto_merged: false,
          merged_from_pending_ids: [],
          similarity: 100,
        });

        // Add similar projects
        for (const { id, similarity } of similarities) {
          const matchedProject = allProjects.find(p => p.id === id);
          if (matchedProject) {
            members.push({
              id: matchedProject.id,
              name: matchedProject.name,
              value: matchedProject.value,
              address: matchedProject.main_job_site?.full_address || matchedProject.main_job_site?.location || null,
              suburb: null, // job_sites doesn't have suburb column
              state: null, // job_sites doesn't have state column
              postcode: null, // job_sites doesn't have postcode column
              created_at: matchedProject.created_at,
              auto_merged: false,
              merged_from_pending_ids: [],
              similarity,
            });
            processedIds.add(id);
          }
        }

        // Create group
        const memberSimilarities = members.slice(1).map(m => m.similarity);
        groups.push({
          canonical_id: project.id,
          canonical_name: project.name,
          members,
          member_count: members.length,
          min_similarity: Math.min(...memberSimilarities),
          max_similarity: Math.max(...memberSimilarities),
        });

        processedIds.add(project.id);
      }
    }

    console.log(`[detect-duplicates] Found ${groups.length} duplicate groups`);

    return NextResponse.json({
      success: true,
      groups,
      total_groups: groups.length,
      total_pending: pendingProjects.length,
    } as ProjectDuplicateDetectionResult);
  } catch (error) {
    console.error('Detect duplicates error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    );
  }
}
