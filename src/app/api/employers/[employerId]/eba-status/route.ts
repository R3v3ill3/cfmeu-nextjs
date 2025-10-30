import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase();
    const { employerId } = params;

    // Validate employer ID
    if (!employerId) {
      return NextResponse.json(
        { error: 'Employer ID is required' },
        { status: 400 }
      );
    }

    // Get employer EBA status from the canonical source
    const { data: employer, error } = await supabase
      .from('employers')
      .select('enterprise_agreement_status')
      .eq('id', employerId)
      .single();

    if (error) {
      console.error('Error fetching employer EBA status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employer data' },
        { status: 500 }
      );
    }

    if (!employer) {
      return NextResponse.json(
        { error: 'Employer not found' },
        { status: 404 }
      );
    }

    // Return EBA status
    return NextResponse.json({
      employerId,
      hasActiveEba: employer.enterprise_agreement_status === true,
      enterprise_agreement_status: employer.enterprise_agreement_status,
      retrieved_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('EBA status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}