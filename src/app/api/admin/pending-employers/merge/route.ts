import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withValidation } from '@/lib/validation/middleware';
import { schemas } from '@/lib/validation/schemas';
import type { MergeResult, ConflictResolution } from '@/types/pendingEmployerReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pending-employers/merge
 * Merges multiple pending employers into one canonical employer with validation
 */
export const POST = withValidation(
  async (request, { data, user }) => {
    const supabase = await createServerSupabase();

    // Validate that canonical employer exists
    const { data: canonicalEmployer, error: canonicalError } = await supabase
      .from('employers')
      .select('id, name, abn, status')
      .eq('id', data.canonicalEmployerId)
      .single();

    if (canonicalError || !canonicalEmployer) {
      return NextResponse.json({
        success: false,
        error: 'Canonical employer not found',
        hint: 'Please verify the canonical employer ID and try again'
      }, { status: 404 });
    }

    // Validate that all merge employers exist and are in mergeable state
    const { data: mergeEmployers, error: mergeError } = await supabase
      .from('employers')
      .select('id, name, abn, status')
      .in('id', data.mergeEmployerIds);

    if (mergeError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to validate merge employers',
        details: mergeError.message
      }, { status: 500 });
    }

    if (!mergeEmployers || mergeEmployers.length !== data.mergeEmployerIds.length) {
      return NextResponse.json({
        success: false,
        error: 'Some merge employers not found',
        details: {
          requested: data.mergeEmployerIds,
          found: mergeEmployers?.map(e => e.id) || []
        }
      }, { status: 404 });
    }

    // Check for circular merges (canonical employer in merge list)
    if (data.mergeEmployerIds.includes(data.canonicalEmployerId)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot merge an employer into itself',
        hint: 'Remove the canonical employer from the merge list'
      }, { status: 400 });
    }

    // Additional business logic validation
    const hasConflictingABNs = mergeEmployers.some(emp =>
      emp.abn && emp.abn !== canonicalEmployer.abn
    );

    if (hasConflictingABNs && !data.autoMerge) {
      return NextResponse.json({
        success: false,
        error: 'Cannot merge employers with conflicting ABNs',
        details: {
          canonicalABN: canonicalEmployer.abn,
          conflictingABNs: mergeEmployers
            .filter(emp => emp.abn && emp.abn !== canonicalEmployer.abn)
            .map(emp => ({ id: emp.id, name: emp.name, abn: emp.abn }))
        },
        hint: 'Use conflict resolutions to handle ABN differences or enable auto-merge'
      }, { status: 409 });
    }

    // Call RPC function with validated data
    const { data: result, error: rpcError } = await supabase.rpc('merge_pending_employers', {
      p_canonical_employer_id: data.canonicalEmployerId,
      p_merge_employer_ids: data.mergeEmployerIds,
      p_conflict_resolutions: data.conflictResolutions || {},
      p_auto_merge: data.autoMerge || false,
    });

    if (rpcError) {
      console.error('RPC error merging pending employers:', rpcError);
      return NextResponse.json({
        success: false,
        error: 'Failed to merge pending employers',
        details: rpcError.message,
        hint: 'Check employer data and try again, or contact system administrator'
      }, { status: 500 });
    }

    const mergeResult = result as MergeResult;

    if (mergeResult.error) {
      return NextResponse.json({
        success: false,
        error: mergeResult.error,
        ...(mergeResult as any).status && { httpStatus: (mergeResult as any).status }
      }, { status: (mergeResult as any).status || 500 });
    }

    return NextResponse.json({
      success: true,
      ...mergeResult,
      mergedBy: user.full_name || user.email,
      mergedAt: new Date().toISOString(),
      summary: {
        canonicalEmployer: canonicalEmployer.name,
        mergedEmployers: mergeEmployers.map(e => e.name),
        totalMerged: data.mergeEmployerIds.length
      }
    });
  },
  schemas.employer.mergeEmployers,
  {
    requireAuth: true,
    requiredRoles: ['admin', 'lead_organiser'],
    returnValidationErrors: process.env.NODE_ENV === 'development'
  }
);


