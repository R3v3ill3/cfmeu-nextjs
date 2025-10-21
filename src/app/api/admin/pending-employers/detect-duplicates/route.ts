import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { DuplicateDetectionResult } from '@/types/pendingEmployerReview';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    // Call RPC function to detect duplicates
    console.log('[detect-duplicates] Calling find_duplicate_pending_employers RPC...');
    const { data, error: rpcError } = await supabase.rpc('find_duplicate_pending_employers');

    if (rpcError) {
      console.error('[detect-duplicates] RPC error:', rpcError);
      console.error('[detect-duplicates] Error details:', {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      });
      return NextResponse.json({ 
        error: 'Failed to detect duplicates',
        details: rpcError.message,
        code: rpcError.code,
        hint: rpcError.hint,
      }, { status: 500 });
    }

    console.log('[detect-duplicates] RPC returned data:', JSON.stringify(data).substring(0, 200));

    const result = data as DuplicateDetectionResult;

    if (result.error) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: (result as any).status || 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Detect duplicates error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    );
  }
}

