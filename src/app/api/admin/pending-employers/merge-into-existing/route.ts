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

    // Log merge attempt
    console.log('[merge-into-existing] Starting merge:', {
      user: user.id,
      pendingEmployerId: params.pendingEmployerId,
      existingEmployerId: params.existingEmployerId,
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


