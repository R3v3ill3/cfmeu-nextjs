import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Test with Supabase connection
async function getEmployerRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    console.log('Testing Supabase connection with employerId:', employerId);

    // Test Supabase connection
    const supabase = await createServerSupabase();
    console.log('Supabase client created successfully');

    // Return a simple response indicating the test worked
    return NextResponse.json({
      success: true,
      employerId: employerId,
      message: 'Supabase connection test working',
      timestamp: new Date().toISOString(),
      data: {
        project_data_rating: {
          rating: 'green',
          confidence: 'medium',
          calculated_at: new Date().toISOString()
        },
        organiser_expertise_rating: {
          rating: 'amber',
          confidence: 'high',
          calculated_at: new Date().toISOString()
        },
        rating_history: []
      }
    });

  } catch (error) {
    console.error('Minimal endpoint error:', error);

    return NextResponse.json({
      error: 'Minimal endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      employerId: params.employerId
    }, { status: 500 });
  }
}

// Export handler with rate limiting
export const GET = withRateLimit(
  (request, context) => getEmployerRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Adapter-Status': 'healthy',
        'X-Debug': 'minimal-head',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}