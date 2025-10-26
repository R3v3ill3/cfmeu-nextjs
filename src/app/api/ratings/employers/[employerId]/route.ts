import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Completely minimal endpoint with no custom types or dependencies
export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    console.log('Minimal endpoint called with employerId:', employerId);

    // Return a simple response
    return NextResponse.json({
      success: true,
      employerId: employerId,
      message: 'Minimal endpoint working',
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