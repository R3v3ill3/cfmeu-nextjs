import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { mergePendingIntoExisting } from '@/lib/employers/mergePendingIntoExisting';
import type { MergeIntoExistingParams } from '@/types/pendingEmployerReview';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const params: MergeIntoExistingParams = await request.json();

    // Validate required parameters
    if (!params.pendingEmployerId || !params.existingEmployerId) {
      console.error('[merge-into-existing] Missing required fields:', params);
      return NextResponse.json({
        error: 'Missing required fields: pendingEmployerId and existingEmployerId'
      }, { status: 400 });
    }

    // Prevent merging an employer into itself
    if (params.pendingEmployerId === params.existingEmployerId) {
      console.error('[merge-into-existing] Cannot merge employer into itself:', params.pendingEmployerId);
      return NextResponse.json({
        error: 'Cannot merge an employer into itself. Please select a different existing employer.',
        pendingEmployerId: params.pendingEmployerId,
        existingEmployerId: params.existingEmployerId,
      }, { status: 400 });
    }

    // Create server-side Supabase client
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[merge-into-existing] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or lead_organiser
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[merge-into-existing] Failed to fetch user profile:', profileError);
      return NextResponse.json({
        error: 'Failed to verify user permissions'
      }, { status: 500 });
    }

    if (!userProfile || !['admin', 'lead_organiser'].includes(userProfile.role)) {
      console.error('[merge-into-existing] Unauthorized role:', userProfile?.role);
      return NextResponse.json({
        error: 'Forbidden - admin or lead_organiser access required'
      }, { status: 403 });
    }

    // Validate pending employer exists and is pending
    const { data: pendingEmployer, error: pendingError } = await supabase
      .from('employers')
      .select('id, name, approval_status')
      .eq('id', params.pendingEmployerId)
      .maybeSingle();

    if (pendingError) {
      console.error('[merge-into-existing] Error checking pending employer:', pendingError);
      return NextResponse.json({
        error: 'Failed to validate pending employer',
        details: pendingError.message,
      }, { status: 500 });
    }

    if (!pendingEmployer) {
      console.error('[merge-into-existing] Pending employer not found:', params.pendingEmployerId);
      return NextResponse.json({
        error: 'Pending employer not found',
        details: `No employer exists with ID: ${params.pendingEmployerId}`,
        pendingEmployerId: params.pendingEmployerId,
      }, { status: 404 });
    }

    if (pendingEmployer.approval_status !== 'pending') {
      console.error('[merge-into-existing] Employer is not pending:', {
        id: params.pendingEmployerId,
        currentStatus: pendingEmployer.approval_status,
      });
      return NextResponse.json({
        error: 'Employer is not pending',
        details: `Employer "${pendingEmployer.name}" has status "${pendingEmployer.approval_status}" (expected "pending")`,
        pendingEmployerId: params.pendingEmployerId,
        currentStatus: pendingEmployer.approval_status,
      }, { status: 400 });
    }

    // Validate existing employer exists and is active
    const { data: existingEmployer, error: existingError } = await supabase
      .from('employers')
      .select('id, name, approval_status')
      .eq('id', params.existingEmployerId)
      .maybeSingle();

    if (existingError) {
      console.error('[merge-into-existing] Error checking existing employer:', existingError);
      return NextResponse.json({
        error: 'Failed to validate existing employer',
        details: existingError.message,
      }, { status: 500 });
    }

    if (!existingEmployer) {
      console.error('[merge-into-existing] Existing employer not found:', params.existingEmployerId);
      return NextResponse.json({
        error: 'Existing employer not found',
        details: `No employer exists with ID: ${params.existingEmployerId}. The employer may have been deleted or merged into another employer.`,
        existingEmployerId: params.existingEmployerId,
        hint: 'Search for the employer again to find the current record',
      }, { status: 404 });
    }

    if (existingEmployer.approval_status !== 'active') {
      console.error('[merge-into-existing] Existing employer is not active:', {
        id: params.existingEmployerId,
        currentStatus: existingEmployer.approval_status,
      });
      return NextResponse.json({
        error: 'Cannot merge into non-active employer',
        details: `Employer "${existingEmployer.name}" has status "${existingEmployer.approval_status}" (expected "active")`,
        existingEmployerId: params.existingEmployerId,
        existingEmployerName: existingEmployer.name,
        currentStatus: existingEmployer.approval_status,
        hint: 'Select an active employer to merge into',
      }, { status: 400 });
    }

    // Log merge attempt
    console.log('[merge-into-existing] Starting merge:', {
      user: user.id,
      pendingEmployer: { id: pendingEmployer.id, name: pendingEmployer.name },
      existingEmployer: { id: existingEmployer.id, name: existingEmployer.name },
    });

    // Perform the merge - pass the Supabase client as first parameter
    const result = await mergePendingIntoExisting(supabase, params);

    if (!result.success) {
      console.error('[merge-into-existing] Merge failed:', {
        error: result.error,
        pendingEmployerId: params.pendingEmployerId,
        existingEmployerId: params.existingEmployerId,
      });
      return NextResponse.json({
        error: result.error || 'Merge into existing failed',
        details: result.error, // Return actual error for debugging
        pendingEmployerId: params.pendingEmployerId,
        existingEmployerId: params.existingEmployerId,
      }, { status: 500 });
    }

    console.log('[merge-into-existing] Merge successful:', {
      pendingEmployerId: result.pending_employer_id,
      existingEmployerId: result.existing_employer_id,
      projectsTransferred: result.projects_transferred,
      tradesTransferred: result.trades_transferred,
      aliasCreated: result.alias_created,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[merge-into-existing] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}


