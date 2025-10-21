import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { UndoMergeResult } from '@/types/pendingEmployerReview';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { mergeLogId, reason } = await request.json();

    if (!mergeLogId) {
      return NextResponse.json({ 
        error: 'Missing required field: mergeLogId' 
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

    // Call RPC function to undo merge
    const { data, error: rpcError } = await supabase.rpc('undo_pending_employer_merge', {
      p_merge_log_id: mergeLogId,
      p_reason: reason || null,
    });

    if (rpcError) {
      console.error('RPC error undoing merge:', rpcError);
      return NextResponse.json({ 
        error: 'Failed to undo merge',
        details: rpcError.message 
      }, { status: 500 });
    }

    const result = data as UndoMergeResult;

    if (result.error) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: (result as any).status || 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Undo merge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Undo failed' },
      { status: 500 }
    );
  }
}


