import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// Error logging endpoint
async function errorsHandler(request: NextRequest) {
  try {
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.error || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: error and message' },
        { status: 400 }
      )
    }

    // Log the error (in production, you'd send this to a logging service)
    const errorData = {
      timestamp: new Date().toISOString(),
      level: body.level || 'error',
      error: body.error,
      message: body.message,
      stack: body.stack,
      userAgent: request.headers.get('user-agent'),
      url: body.url,
      userId: body.userId,
      additionalInfo: body.additionalInfo || {}
    }

    // Log to console (in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error Report:', JSON.stringify(errorData, null, 2))
    }

    // In production, you would send this to your error tracking service
    // Examples: Sentry, LogRocket, Datadog, etc.
    // await sendToErrorTrackingService(errorData)

    return NextResponse.json(
      {
        success: true,
        message: 'Error logged successfully',
        id: crypto.randomUUID()
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error in errors endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply rate limiting to prevent abuse
// Using RELAXED preset (120 req/min) since error logging should be allowed frequently
export const POST = withRateLimit(errorsHandler, RATE_LIMIT_PRESETS.RELAXED)

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}