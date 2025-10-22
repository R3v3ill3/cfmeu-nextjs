import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employerId = params.id;
    const updates = await request.json();

    if (!employerId) {
      return NextResponse.json({ 
        error: 'Missing employer ID' 
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

    // Verify employer exists and is pending
    const { data: existingEmployer, error: fetchError } = await supabase
      .from('employers')
      .select('id, approval_status')
      .eq('id', employerId)
      .single();

    if (fetchError || !existingEmployer) {
      return NextResponse.json({ 
        error: 'Employer not found' 
      }, { status: 404 });
    }

    if (existingEmployer.approval_status !== 'pending') {
      return NextResponse.json({ 
        error: 'Can only update pending employers' 
      }, { status: 400 });
    }

    // Filter out fields that shouldn't be updated via this endpoint
    const allowedFields = [
      'name',
      'employer_type',
      'abn',
      'address_line_1',
      'address_line_2',
      'suburb',
      'state',
      'postcode',
      'phone',
      'email',
      'website',
      'primary_contact_name',
      'review_notes',
      'currently_reviewed_by',
      'review_started_at',
    ];

    const filteredUpdates: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Add review tracking
    filteredUpdates.last_reviewed_at = new Date().toISOString();
    filteredUpdates.last_reviewed_by = user.id;

    // Update the employer
    const { data: updatedEmployer, error: updateError } = await supabase
      .from('employers')
      .update(filteredUpdates)
      .eq('id', employerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pending employer:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update employer',
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      employer: updatedEmployer,
    });
  } catch (error) {
    console.error('Update pending employer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

// Also support GET to fetch single pending employer details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employerId = params.id;

    if (!employerId) {
      return NextResponse.json({ 
        error: 'Missing employer ID' 
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

    // Fetch employer
    const { data: employer, error: fetchError } = await supabase
      .from('employers')
      .select('*')
      .eq('id', employerId)
      .eq('approval_status', 'pending')
      .single();

    if (fetchError || !employer) {
      return NextResponse.json({ 
        error: 'Pending employer not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ employer });
  } catch (error) {
    console.error('Fetch pending employer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}



