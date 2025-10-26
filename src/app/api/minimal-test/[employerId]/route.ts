import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Minimal test endpoint with no dependencies
export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    console.log('Minimal test endpoint called with employerId:', employerId);

    // Just return a simple response
    return NextResponse.json({
      success: true,
      employerId: employerId,
      message: 'Minimal test endpoint working',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in minimal test endpoint:', error);

    return NextResponse.json({
      error: 'Minimal test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}