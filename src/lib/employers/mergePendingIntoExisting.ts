import { normalizeEmployerName } from './normalize';
import type { MergeIntoExistingParams, MergeIntoExistingResult } from '@/types/pendingEmployerReview';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Merges a pending employer into an existing active employer
 * Transfers all associations and creates an alias for the pending name
 *
 * @param supabase - Supabase client instance (must be server-side client for API routes)
 * @param params - Merge parameters including employer IDs and transfer options
 * @returns Result object with success status and transfer counts
 */
export async function mergePendingIntoExisting(
  supabase: SupabaseClient<Database>,
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

  let jobsitesTransferred = 0;
  let projectsTransferred = 0;
  let tradesTransferred = 0;
  let aliasCreated = false;

  try {
    // Get user ID once at the beginning (important for serverless environments)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // 1. Get pending employer details
    const { data: pendingEmployer, error: fetchError } = await supabase
      .from('employers')
      .select('*')
      .eq('id', pendingEmployerId)
      .eq('approval_status', 'pending')
      .maybeSingle();

    if (fetchError) {
      console.error('[mergePendingIntoExisting] Error fetching pending employer:', {
        pendingEmployerId,
        error: fetchError,
        code: fetchError.code,
        details: fetchError.details,
      });
      throw new Error(`Pending employer fetch error: ${fetchError.message || JSON.stringify(fetchError)}`);
    }

    if (!pendingEmployer) {
      console.error('[mergePendingIntoExisting] Pending employer not found:', {
        pendingEmployerId,
        message: 'No pending employer exists with this ID',
      });
      throw new Error(`Pending employer not found with ID: ${pendingEmployerId}. It may have already been processed or does not exist.`);
    }

    // 2. Verify existing employer exists and is active
    const { data: existingEmployer, error: existingError } = await supabase
      .from('employers')
      .select('id, name, approval_status')
      .eq('id', existingEmployerId)
      .maybeSingle();

    if (existingError) {
      console.error('[mergePendingIntoExisting] Error fetching existing employer:', {
        existingEmployerId,
        error: existingError,
        code: existingError.code,
        details: existingError.details,
      });
      throw new Error(`Existing employer fetch error: ${existingError.message || JSON.stringify(existingError)}`);
    }

    if (!existingEmployer) {
      console.error('[mergePendingIntoExisting] Existing employer not found:', {
        existingEmployerId,
        message: 'No employer exists with this ID',
      });
      throw new Error(`Existing employer not found with ID: ${existingEmployerId}. The employer may have been deleted or merged.`);
    }

    if (existingEmployer.approval_status !== 'active') {
      console.error('[mergePendingIntoExisting] Existing employer is not active:', {
        existingEmployerId,
        currentStatus: existingEmployer.approval_status,
        message: 'Cannot merge into a non-active employer',
      });
      throw new Error(`Cannot merge into employer "${existingEmployer.name}" (ID: ${existingEmployerId}). Status is "${existingEmployer.approval_status}" but must be "active".`);
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
          collected_by: userId,
          notes: `Merged from pending employer review`,
        }, {
          onConflict: 'employer_id,alias_normalized'
        });

      if (aliasError) {
        console.error('Error creating employer alias:', aliasError);
      }
      aliasCreated = !aliasError;
    }

    // 7. Mark pending employer as rejected with merge note
    const { error: updateError } = await supabase
      .from('employers')
      .update({
        approval_status: 'rejected',
        rejection_reason: `Merged into existing employer: ${existingEmployer.name} (ID: ${existingEmployerId})`,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', pendingEmployerId);

    if (updateError) {
      console.error('Error updating pending employer status:', updateError);
      throw new Error(`Failed to update pending employer: ${updateError.message}`);
    }

    // 8. Record in approval history
    const { error: historyError } = await supabase
      .from('approval_history')
      .insert({
        entity_type: 'employer',
        entity_id: pendingEmployerId,
        action: 'rejected',
        performed_by: userId,
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

    if (historyError) {
      console.error('Error recording approval history:', historyError);
      // Don't throw - approval history is not critical
    }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    console.error('Error merging pending into existing employer:', {
      message: errorMessage,
      stack: errorDetails,
      pendingEmployerId,
      existingEmployerId,
    });

    return {
      success: false,
      existing_employer_id: existingEmployerId,
      pending_employer_id: pendingEmployerId,
      jobsites_transferred: 0,
      projects_transferred: 0,
      trades_transferred: 0,
      alias_created: false,
      error: errorMessage,
    };
  }
}


