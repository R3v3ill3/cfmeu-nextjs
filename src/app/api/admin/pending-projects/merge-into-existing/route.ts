import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { mergePendingIntoExisting } from '@/lib/projects/mergePendingIntoExisting';
import type { MergeIntoExistingProjectParams } from '@/types/pendingProjectReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pending-projects/merge-into-existing
 * Merges a pending project into an existing active project
 *
 * CRITICAL: Uses createServerSupabase() and passes client to helper function
 */
export async function POST(request: NextRequest) {
  try {
    const params: MergeIntoExistingProjectParams = await request.json();

    if (!params.pendingProjectId || !params.existingProjectId) {
      return NextResponse.json({
        error: 'Missing required fields: pendingProjectId and existingProjectId'
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
    const result = await mergePendingIntoExisting(supabase, params);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Merge into existing failed'
      }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Merge into existing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
