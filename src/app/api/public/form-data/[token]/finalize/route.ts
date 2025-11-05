/**
 * Finalize Audit Form API
 * 
 * Marks an audit compliance token as complete/used
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Use anon SSR client
    const supabase = await createServerSupabase();

    // Call RPC to finalize the token
    const { data: result, error } = await supabase
      .rpc('finalize_audit_token', { p_token: token });

    if (error || !result?.success) {
      console.error('Failed to finalize audit token:', error || result);
      return NextResponse.json(
        { error: result?.error || 'Failed to finalize audit form' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Finalize audit token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



