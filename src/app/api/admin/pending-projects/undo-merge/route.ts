import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { UndoMergeProjectResult } from '@/types/pendingProjectReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pending-projects/undo-merge
 * Undoes a previous merge of pending projects
 * Restores projects that were marked as rejected due to merging
 *
 * CRITICAL: Uses createServerSupabase() for server-side operations
 */
export async function POST(request: NextRequest) {
  try {
    const {
      mergeLogId,
      projectIds,
      reason
    }: {
      mergeLogId?: string;
      projectIds?: string[];
      reason?: string;
    } = await request.json();

    if (!mergeLogId && (!projectIds || projectIds.length === 0)) {
      return NextResponse.json({
        error: 'Either mergeLogId or projectIds must be provided'
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

    let restoredIds: string[] = [];
    let restoredCount = 0;

    // If mergeLogId provided, get project IDs from merge log
    if (mergeLogId) {
      try {
        const { data: mergeLog, error: logError } = await supabase
          .from('project_merge_logs')
          .select('merged_project_ids, canonical_project_id')
          .eq('id', mergeLogId)
          .is('undone_at', null)
          .single();

        if (logError || !mergeLog) {
          return NextResponse.json({
            error: 'Merge log not found or already undone'
          }, { status: 404 });
        }

        restoredIds = mergeLog.merged_project_ids || [];

        // Mark merge log as undone
        await supabase
          .from('project_merge_logs')
          .update({
            undone_at: new Date().toISOString(),
            undone_by: user.id,
            undo_reason: reason || 'Manual undo',
          })
          .eq('id', mergeLogId);

      } catch (e) {
        // Merge logs table may not exist
        console.log('Merge logs table not available, using projectIds');
        if (!projectIds || projectIds.length === 0) {
          return NextResponse.json({
            error: 'Merge logs not available and no projectIds provided'
          }, { status: 400 });
        }
        restoredIds = projectIds;
      }
    } else if (projectIds) {
      restoredIds = projectIds;
    }

    if (restoredIds.length === 0) {
      return NextResponse.json({
        error: 'No projects to restore'
      }, { status: 400 });
    }

    // Restore all merged projects to pending status
    for (const projectId of restoredIds) {
      // Only restore projects that were rejected due to merging
      const { data: project } = await supabase
        .from('projects')
        .select('rejection_reason, approval_status')
        .eq('id', projectId)
        .single();

      if (!project || project.approval_status !== 'rejected') {
        continue;
      }

      // Check if rejection was due to merge
      const isMergeRejection = project.rejection_reason?.includes('Merged into');

      if (isMergeRejection) {
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            approval_status: 'pending',
            rejection_reason: null,
            approved_by: null,
            approved_at: null,
          })
          .eq('id', projectId);

        if (!updateError) {
          restoredCount++;

          // Record in approval history
          await supabase
            .from('approval_history')
            .insert({
              entity_type: 'project',
              entity_id: projectId,
              action: 'resubmitted',
              performed_by: user.id,
              previous_status: 'rejected',
              new_status: 'pending',
              reason: reason || 'Merge undone - restored to pending',
              metadata: {
                undo_merge: true,
                merge_log_id: mergeLogId,
              },
            });
        }
      }
    }

    const result: UndoMergeProjectResult = {
      success: true,
      restored_count: restoredCount,
      restored_ids: restoredIds.slice(0, restoredCount),
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Undo merge error:', error);
    return NextResponse.json(
      {
        success: false,
        restored_count: 0,
        restored_ids: [],
        error: error instanceof Error ? error.message : 'Undo merge failed'
      },
      { status: 500 }
    );
  }
}
