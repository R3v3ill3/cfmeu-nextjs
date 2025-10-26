import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Simple test endpoint to debug the 500 error
export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    console.log('Testing employer ID:', employerId);

    const supabase = await createServerSupabase();

    // Test 1: Basic connection
    console.log('Testing database connection...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Auth failed', details: authError.message }, { status: 500 });
    }
    console.log('Auth successful for user:', user?.id);

    // Test 2: Check if employer exists
    console.log('Testing employer existence...');
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError) {
      console.error('Employer query error:', employerError);
      return NextResponse.json({ error: 'Employer query failed', details: employerError.message }, { status: 500 });
    }
    console.log('Employer found:', employer);

    // Test 3: Check if ratings table exists and is accessible
    console.log('Testing ratings table access...');
    const { data: ratingsTableTest, error: tableError } = await supabase
      .from('employer_final_ratings')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('Ratings table error:', tableError);
      return NextResponse.json({ error: 'Ratings table access failed', details: tableError.message }, { status: 500 });
    }
    console.log('Ratings table accessible, sample data:', ratingsTableTest);

    // Test 4: Query ratings for this specific employer
    console.log('Testing specific employer ratings query...');
    const { data: ratings, error: ratingsError } = await supabase
      .from('employer_final_ratings')
      .select('*')
      .eq('employer_id', employerId)
      .limit(5);

    if (ratingsError) {
      console.error('Employer ratings query error:', ratingsError);
      return NextResponse.json({ error: 'Employer ratings query failed', details: ratingsError.message }, { status: 500 });
    }
    console.log('Employer ratings found:', ratings?.length || 0);

    return NextResponse.json({
      success: true,
      employer,
      ratingsCount: ratings?.length || 0,
      ratings: ratings || [],
      message: 'All tests passed'
    });

  } catch (error) {
    console.error('Unexpected error in test endpoint:', error);
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}