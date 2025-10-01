import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { interactionId, feedback, comment } = body

    if (!interactionId || !feedback) {
      return NextResponse.json(
        { error: 'Interaction ID and feedback are required' },
        { status: 400 }
      )
    }

    if (!['positive', 'negative'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Feedback must be "positive" or "negative"' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update the interaction with feedback
    const { error: updateError } = await supabase
      .from('help_interactions')
      .update({
        feedback,
        feedback_comment: comment || null,
      })
      .eq('id', interactionId)
      .eq('user_id', user.id) // Ensure user owns this interaction

    if (updateError) {
      console.error('Feedback update error:', updateError)
      throw updateError
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
