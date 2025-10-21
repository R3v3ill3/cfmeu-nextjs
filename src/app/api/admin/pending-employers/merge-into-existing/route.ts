import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { mergePendingIntoExisting } from '@/lib/employers/mergePendingIntoExisting';
import type { MergeIntoExistingParams } from '@/types/pendingEmployerReview';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const params: MergeIntoExistingParams = await request.json();

    if (!params.pendingEmployerId || !params.existingEmployerId) {
      return NextResponse.json({ 
        error: 'Missing required fields: pendingEmployerId and existingEmployerId' 
      }, { status: 400 });
    }

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

    // Perform the merge
    const result = await mergePendingIntoExisting(params);

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


