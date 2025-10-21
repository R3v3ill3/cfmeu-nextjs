import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { normalizeEmployerName } from './normalize';
import type { MergeIntoExistingParams, MergeIntoExistingResult } from '@/types/pendingEmployerReview';

/**
 * Merges a pending employer into an existing active employer
 * Transfers all associations and creates an alias for the pending name
 */
export async function mergePendingIntoExisting(
  params: MergeIntoExistingParams
): Promise<MergeIntoExistingResult> {
  const {
    pendingEmployerId,
    existingEmployerId,
    transferJobsites = true,
    transferProjects = true,
    transferTrades = true,
    createAlias = true,
  } = params;

  const supabase = getSupabaseBrowserClient();
  
  let jobsitesTransferred = 0;
  let projectsTransferred = 0;
  let tradesTransferred = 0;
  let aliasCreated = false;

  try {
    // 1. Get pending employer details
    const { data: pendingEmployer, error: fetchError } = await supabase
      .from('employers')
      .select('*')
      .eq('id', pendingEmployerId)
      .eq('approval_status', 'pending')
      .single();

    if (fetchError || !pendingEmployer) {
      throw new Error('Pending employer not found or not pending');
    }

    // 2. Verify existing employer exists and is active
    const { data: existingEmployer, error: existingError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', existingEmployerId)
      .eq('approval_status', 'active')
      .single();

    if (existingError || !existingEmployer) {
      throw new Error('Existing employer not found or not active');
    }

    // 3. Transfer project assignments
    if (transferProjects) {
      const { error: projectError, count } = await supabase
        .from('project_assignments')
        .update({ employer_id: existingEmployerId })
        .eq('employer_id', pendingEmployerId);

      if (projectError) {
        console.error('Error transferring project assignments:', projectError);
      } else {
        projectsTransferred = count || 0;
      }
    }

    // 4. Transfer jobsite associations (if they exist as separate table)
    if (transferJobsites) {
      // Check if employer has any jobsite associations
      // This may vary based on your schema - adjust as needed
      const { error: jobsiteError, count } = await supabase
        .from('project_assignments')
        .update({ employer_id: existingEmployerId })
        .eq('employer_id', pendingEmployerId)
        .not('project_id', 'is', null);

      if (!jobsiteError) {
        jobsitesTransferred = count || 0;
      }
    }

    // 5. Transfer trade capabilities (avoiding duplicates)
    if (transferTrades) {
      // First, get trade capabilities from pending employer
      const { data: pendingTrades, error: tradesError } = await supabase
        .from('contractor_trade_capabilities')
        .select('*')
        .eq('employer_id', pendingEmployerId);

      if (!tradesError && pendingTrades && pendingTrades.length > 0) {
        // Get existing trades for the target employer
        const { data: existingTrades } = await supabase
          .from('contractor_trade_capabilities')
          .select('trade_type')
          .eq('employer_id', existingEmployerId);

        const existingTradeTypes = new Set(
          (existingTrades || []).map((t: any) => t.trade_type)
        );

        // Insert only non-duplicate trades
        const tradesToInsert = pendingTrades
          .filter((t: any) => !existingTradeTypes.has(t.trade_type))
          .map((t: any) => ({
            employer_id: existingEmployerId,
            trade_type: t.trade_type,
            is_primary: t.is_primary,
            notes: t.notes,
          }));

        if (tradesToInsert.length > 0) {
          const { error: insertError, count } = await supabase
            .from('contractor_trade_capabilities')
            .insert(tradesToInsert);

          if (!insertError) {
            tradesTransferred = count || 0;
          }
        }

        // Delete old trade capabilities from pending employer
        await supabase
          .from('contractor_trade_capabilities')
          .delete()
          .eq('employer_id', pendingEmployerId);
      }
    }

    // 6. Create employer alias for the pending name
    if (createAlias && pendingEmployer.name !== existingEmployer.name) {
      const normalized = normalizeEmployerName(pendingEmployer.name);
      
      const { error: aliasError } = await supabase
        .from('employer_aliases')
        .upsert({
          employer_id: existingEmployerId,
          alias: pendingEmployer.name,
          alias_normalized: normalized.normalized,
          source_system: 'pending_employer_merge',
          source_identifier: pendingEmployerId,
          collected_at: new Date().toISOString(),
          collected_by: (await supabase.auth.getUser()).data.user?.id || null,
          notes: `Merged from pending employer review`,
        }, {
          onConflict: 'employer_id,alias_normalized'
        });

      aliasCreated = !aliasError;
    }

    // 7. Mark pending employer as rejected with merge note
    const { error: updateError } = await supabase
      .from('employers')
      .update({
        approval_status: 'rejected',
        rejection_reason: `Merged into existing employer: ${existingEmployer.name} (ID: ${existingEmployerId})`,
        approved_by: (await supabase.auth.getUser()).data.user?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', pendingEmployerId);

    if (updateError) {
      throw new Error(`Failed to update pending employer: ${updateError.message}`);
    }

    // 8. Record in approval history
    await supabase
      .from('approval_history')
      .insert({
        entity_type: 'employer',
        entity_id: pendingEmployerId,
        action: 'rejected',
        performed_by: (await supabase.auth.getUser()).data.user?.id || null,
        previous_status: 'pending',
        new_status: 'rejected',
        reason: `Merged into existing employer: ${existingEmployer.name}`,
        metadata: {
          merged_into_employer_id: existingEmployerId,
          merged_into_employer_name: existingEmployer.name,
          jobsites_transferred: jobsitesTransferred,
          projects_transferred: projectsTransferred,
          trades_transferred: tradesTransferred,
          alias_created: aliasCreated,
        },
      });

    return {
      success: true,
      existing_employer_id: existingEmployerId,
      pending_employer_id: pendingEmployerId,
      jobsites_transferred: jobsitesTransferred,
      projects_transferred: projectsTransferred,
      trades_transferred: tradesTransferred,
      alias_created: aliasCreated,
    };

  } catch (error) {
    console.error('Error merging pending into existing employer:', error);
    return {
      success: false,
      existing_employer_id: existingEmployerId,
      pending_employer_id: pendingEmployerId,
      jobsites_transferred: 0,
      projects_transferred: 0,
      trades_transferred: 0,
      alias_created: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}


