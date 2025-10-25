import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { mergePendingProjects } from '@/lib/projects/mergePendingProjects';
import type { ProjectConflictResolution } from '@/types/pendingProjectReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pending-projects/merge
 * Merges multiple pending projects into one canonical project
 *
 * CRITICAL: Uses createServerSupabase() and passes client to helper function
 */
export async function POST(request: NextRequest) {
  try {
    const {
      canonicalProjectId,
      mergeProjectIds,
      conflictResolutions,
      autoMerge
    }: {
      canonicalProjectId: string;
      mergeProjectIds: string[];
      conflictResolutions?: ProjectConflictResolution;
      autoMerge?: boolean;
    } = await request.json();

    if (!canonicalProjectId || !mergeProjectIds || !Array.isArray(mergeProjectIds)) {
      return NextResponse.json({
        error: 'Missing required fields: canonicalProjectId and mergeProjectIds'
      }, { status: 400 });
    }

    if (mergeProjectIds.length === 0) {
      return NextResponse.json({
        error: 'mergeProjectIds array cannot be empty'
      }, { status: 400 });
    }

    // Create server-side Supabase client
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

    // Perform the merge - pass the server Supabase client
    const result = await mergePendingProjects(supabase, {
      canonicalProjectId,
      mergeProjectIds,
      conflictResolutions: conflictResolutions || {},
      autoMerge: autoMerge || false,
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Merge failed'
      }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Merge pending projects error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
