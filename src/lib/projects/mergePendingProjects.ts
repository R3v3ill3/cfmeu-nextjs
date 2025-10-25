import type { SupabaseClient } from '@supabase/supabase-js';
import type { MergeProjectResult, ProjectConflictResolution } from '@/types/pendingProjectReview';

interface MergePendingProjectsParams {
  canonicalProjectId: string;
  mergeProjectIds: string[];
  conflictResolutions?: ProjectConflictResolution;
  autoMerge?: boolean;
}

/**
 * Merges multiple pending projects together into one canonical project
 * All associations from merged projects are transferred to the canonical project
 *
 * CRITICAL: This function accepts a Supabase client as parameter to work correctly in server contexts
 */
export async function mergePendingProjects(
  supabase: SupabaseClient,
  params: MergePendingProjectsParams
): Promise<MergeProjectResult> {
  const {
    canonicalProjectId,
    mergeProjectIds,
    conflictResolutions = {},
    autoMerge = false,
  } = params;

  let assignmentsTransferred = 0;
  let jobsitesTransferred = 0;

  try {
    // 1. Verify canonical project is pending
    const { data: canonicalProject, error: canonicalError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', canonicalProjectId)
      .eq('approval_status', 'pending')
      .single();

    if (canonicalError || !canonicalProject) {
      throw new Error('Canonical project not found or not pending');
    }

    // 2. Verify all merge projects are pending
    const { data: mergeProjects, error: mergeError } = await supabase
      .from('projects')
      .select('*')
      .in('id', mergeProjectIds)
      .eq('approval_status', 'pending');

    if (mergeError) {
      throw new Error(`Error fetching projects to merge: ${mergeError.message}`);
    }

    if (!mergeProjects || mergeProjects.length !== mergeProjectIds.length) {
      throw new Error('One or more merge projects not found or not pending');
    }

    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // 3. Apply conflict resolutions to canonical project
    if (Object.keys(conflictResolutions).length > 0) {
      const updateData: Record<string, any> = {};

      // Only include fields that are explicitly set in conflict resolutions
      if (conflictResolutions.name !== undefined) updateData.name = conflictResolutions.name;
      if (conflictResolutions.value !== undefined) updateData.value = conflictResolutions.value;
      if (conflictResolutions.project_type !== undefined) updateData.project_type = conflictResolutions.project_type;
      if (conflictResolutions.proposed_start_date !== undefined) updateData.proposed_start_date = conflictResolutions.proposed_start_date;
      if (conflictResolutions.proposed_finish_date !== undefined) updateData.proposed_finish_date = conflictResolutions.proposed_finish_date;
      if (conflictResolutions.state_funding !== undefined) updateData.state_funding = conflictResolutions.state_funding;
      if (conflictResolutions.federal_funding !== undefined) updateData.federal_funding = conflictResolutions.federal_funding;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', canonicalProjectId);

        if (updateError) {
          console.error('Error applying conflict resolutions:', updateError);
        }
      }
    }

    // 4. Transfer all associations from merge projects to canonical
    for (const mergeProject of mergeProjects) {
      // Transfer project assignments
      const { error: assignmentError, count: assignmentCount } = await supabase
        .from('project_assignments')
        .update({ project_id: canonicalProjectId })
        .eq('project_id', mergeProject.id);

      if (!assignmentError) {
        assignmentsTransferred += assignmentCount || 0;
      }

      // Transfer job sites
      const { data: jobsites } = await supabase
        .from('job_sites')
        .select('*')
        .eq('project_id', mergeProject.id);

      if (jobsites && jobsites.length > 0) {
        for (const site of jobsites) {
          // Don't transfer as main site to avoid conflicts
          const { error: siteError } = await supabase
            .from('job_sites')
            .update({
              project_id: canonicalProjectId,
              is_main_site: false
            })
            .eq('id', site.id);

          if (!siteError) {
            jobsitesTransferred++;
          }
        }
      }

      // 5. Mark merged project as rejected
      await supabase
        .from('projects')
        .update({
          approval_status: 'rejected',
          rejection_reason: `Merged into project: ${canonicalProject.name} (ID: ${canonicalProjectId})`,
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', mergeProject.id);

      // 6. Record in approval history
      await supabase
        .from('approval_history')
        .insert({
          entity_type: 'project',
          entity_id: mergeProject.id,
          action: 'rejected',
          performed_by: userId,
          previous_status: 'pending',
          new_status: 'rejected',
          reason: `Merged into pending project: ${canonicalProject.name}`,
          metadata: {
            merged_into_project_id: canonicalProjectId,
            merged_into_project_name: canonicalProject.name,
            auto_merge: autoMerge,
          },
        });
    }

    // 7. Create merge log entry (if merge_logs table exists)
    let mergeLogId = '';
    try {
      const { data: mergeLog, error: logError } = await supabase
        .from('project_merge_logs')
        .insert({
          canonical_project_id: canonicalProjectId,
          merged_project_ids: mergeProjectIds,
          conflict_resolutions: conflictResolutions,
          merged_by: userId,
          merged_at: new Date().toISOString(),
          metadata: {
            assignments_transferred: assignmentsTransferred,
            jobsites_transferred: jobsitesTransferred,
            auto_merge: autoMerge,
          },
        })
        .select('id')
        .single();

      if (!logError && mergeLog) {
        mergeLogId = mergeLog.id;
      }
    } catch (e) {
      // Merge logs table may not exist - that's okay
      console.log('Merge logs table not available');
    }

    // 8. Update canonical project with merged_from_pending_ids
    const currentMergedIds = canonicalProject.merged_from_pending_ids || [];
    const updatedMergedIds = [...new Set([...currentMergedIds, ...mergeProjectIds])];

    await supabase
      .from('projects')
      .update({
        merged_from_pending_ids: updatedMergedIds,
        auto_merged: autoMerge,
      })
      .eq('id', canonicalProjectId);

    return {
      success: true,
      canonical_project_id: canonicalProjectId,
      merged_count: mergeProjects.length,
      merged_ids: mergeProjectIds,
      merge_log_id: mergeLogId,
      assignments_transferred: assignmentsTransferred,
      jobsites_transferred: jobsitesTransferred,
    };

  } catch (error) {
    console.error('Error merging pending projects:', error);
    return {
      success: false,
      canonical_project_id: canonicalProjectId,
      merged_count: 0,
      merged_ids: [],
      merge_log_id: '',
      assignments_transferred: 0,
      jobsites_transferred: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
