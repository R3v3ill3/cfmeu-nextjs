import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('🧪 SIMPLE TEST: Request received')

  try {
    const body = await request.json()
    console.log('🧪 SIMPLE TEST: Body:', body)

    return NextResponse.json({
      success: true,
      message: 'Simple test working',
      received: body,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('🧪 SIMPLE TEST: Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}