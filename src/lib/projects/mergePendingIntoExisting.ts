import type { SupabaseClient } from '@supabase/supabase-js';
import type { MergeIntoExistingProjectParams, MergeIntoExistingProjectResult } from '@/types/pendingProjectReview';

/**
 * Merges a pending project into an existing active project
 * Transfers all associations and creates an alias for the pending name
 *
 * CRITICAL: This function accepts a Supabase client as parameter to work correctly in server contexts
 */
export async function mergePendingIntoExisting(
  supabase: SupabaseClient,
  params: MergeIntoExistingProjectParams
): Promise<MergeIntoExistingProjectResult> {
  const {
    pendingProjectId,
    existingProjectId,
    transferAssignments = true,
    transferJobsites = true,
    transferContacts = true,
    createAlias = true,
  } = params;

  let assignmentsTransferred = 0;
  let jobsitesTransferred = 0;
  let contactsTransferred = 0;
  let aliasCreated = false;

  try {
    // 1. Get pending project details
    const { data: pendingProject, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', pendingProjectId)
      .eq('approval_status', 'pending')
      .single();

    if (fetchError || !pendingProject) {
      throw new Error('Pending project not found or not pending');
    }

    // 2. Verify existing project exists and is active
    const { data: existingProject, error: existingError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', existingProjectId)
      .eq('approval_status', 'active')
      .single();

    if (existingError || !existingProject) {
      throw new Error('Existing project not found or not active');
    }

    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // 3. Transfer project assignments (employers/subcontractors)
    if (transferAssignments) {
      const { error: assignmentError, count } = await supabase
        .from('project_assignments')
        .update({ project_id: existingProjectId })
        .eq('project_id', pendingProjectId);

      if (assignmentError) {
        console.error('Error transferring project assignments:', assignmentError);
      } else {
        assignmentsTransferred = count || 0;
      }
    }

    // 4. Transfer job sites
    if (transferJobsites) {
      // Get all job sites for pending project
      const { data: jobsites, error: jobsitesError } = await supabase
        .from('job_sites')
        .select('*')
        .eq('project_id', pendingProjectId);

      if (!jobsitesError && jobsites && jobsites.length > 0) {
        // Check if existing project has a main job site
        const { data: existingMainSite } = await supabase
          .from('job_sites')
          .select('id')
          .eq('project_id', existingProjectId)
          .eq('is_main_site', true)
          .single();

        // Transfer job sites
        for (const site of jobsites) {
          // If this is a main site and existing project already has one, transfer as non-main
          const isMainSite = site.is_main_site && !existingMainSite;

          const { error: updateError } = await supabase
            .from('job_sites')
            .update({
              project_id: existingProjectId,
              is_main_site: isMainSite
            })
            .eq('id', site.id);

          if (!updateError) {
            jobsitesTransferred++;
          }
        }

        // If pending project had a main site and we transferred it as the new main site
        // update the existing project's main_job_site_id
        const transferredMainSite = jobsites.find(s => s.is_main_site);
        if (transferredMainSite && !existingMainSite) {
          await supabase
            .from('projects')
            .update({ main_job_site_id: transferredMainSite.id })
            .eq('id', existingProjectId);
        }
      }
    }

    // 5. Transfer site contacts (through job sites)
    if (transferContacts) {
      // Get all job site IDs from pending project
      const { data: pendingJobSites } = await supabase
        .from('job_sites')
        .select('id')
        .eq('project_id', pendingProjectId);

      if (pendingJobSites && pendingJobSites.length > 0) {
        const jobSiteIds = pendingJobSites.map(js => js.id);

        // Count site contacts to be transferred
        const { count } = await supabase
          .from('site_contacts')
          .select('*', { count: 'exact', head: true })
          .in('job_site_id', jobSiteIds);

        contactsTransferred = count || 0;

        // Note: Actual transfer happens when job sites are transferred
        // since contacts are linked to job sites, not directly to projects
      }
    }

    // 6. Create project name alias (if schema supports it)
    // Note: Projects may not have an aliases table like employers do
    // This would need to be implemented if required
    if (createAlias && pendingProject.name !== existingProject.name) {
      // Check if project_aliases table exists
      const { error: aliasError } = await supabase
        .from('project_aliases')
        .upsert({
          project_id: existingProjectId,
          alias: pendingProject.name,
          source_system: 'pending_project_merge',
          source_identifier: pendingProjectId,
          collected_at: new Date().toISOString(),
          collected_by: userId,
          notes: 'Merged from pending project review',
        }, {
          onConflict: 'project_id,alias'
        });

      // If table doesn't exist, that's okay - skip alias creation
      if (!aliasError || aliasError.code === 'PGRST204') {
        aliasCreated = !aliasError;
      }
    }

    // 7. Mark pending project as rejected with merge note
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        approval_status: 'rejected',
        rejection_reason: `Merged into existing project: ${existingProject.name} (ID: ${existingProjectId})`,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', pendingProjectId);

    if (updateError) {
      throw new Error(`Failed to update pending project: ${updateError.message}`);
    }

    // 8. Record in approval history
    await supabase
      .from('approval_history')
      .insert({
        entity_type: 'project',
        entity_id: pendingProjectId,
        action: 'rejected',
        performed_by: userId,
        previous_status: 'pending',
        new_status: 'rejected',
        reason: `Merged into existing project: ${existingProject.name}`,
        metadata: {
          merged_into_project_id: existingProjectId,
          merged_into_project_name: existingProject.name,
          assignments_transferred: assignmentsTransferred,
          jobsites_transferred: jobsitesTransferred,
          contacts_transferred: contactsTransferred,
          alias_created: aliasCreated,
        },
      });

    return {
      success: true,
      existing_project_id: existingProjectId,
      pending_project_id: pendingProjectId,
      assignments_transferred: assignmentsTransferred,
      jobsites_transferred: jobsitesTransferred,
      contacts_transferred: contactsTransferred,
      alias_created: aliasCreated,
    };

  } catch (error) {
    console.error('Error merging pending into existing project:', error);
    return {
      success: false,
      existing_project_id: existingProjectId,
      pending_project_id: pendingProjectId,
      assignments_transferred: 0,
      jobsites_transferred: 0,
      contacts_transferred: 0,
      alias_created: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
