import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface HelpContext {
  page: string
  role?: string
  section?: string
  projectId?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  docId: string
  title: string
  excerpt: string
  similarity: number
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. Parse request
    const body = await request.json()
    const { message, context, conversationHistory = [] } = body as {
      message: string
      context: HelpContext
      conversationHistory: Message[]
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // 2. Get authenticated user
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

    // 3. Get user profile for role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = context.role || profile?.role || 'viewer'

    // 4. Generate embedding for the question
    // Note: Claude doesn't provide embeddings, so we use a simple approach
    // or integrate with OpenAI just for embeddings
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    })

    const embeddingData = await embeddingResponse.json()
    const questionEmbedding = embeddingData.data[0].embedding

    // 5. Search for relevant documents in Supabase
    const { data: relevantDocs, error: searchError } = await supabase.rpc(
      'match_help_documents',
      {
        query_embedding: questionEmbedding,
        match_threshold: 0.65,
        match_count: 3, // Reduced from 5 to 3 to avoid context overload
        filter_roles: [userRole, 'all'],
        filter_page: context.page,
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      throw new Error('Failed to search help documents')
    }

    // 6. Calculate confidence based on similarity scores
    const avgSimilarity = relevantDocs?.length
      ? relevantDocs.reduce((sum: number, doc: any) => sum + doc.similarity, 0) / relevantDocs.length
      : 0

    const confidence = avgSimilarity

    // 7. If confidence too low, return fallback
    if (confidence < 0.6) {
      const fallbackAnswer = "I don't have enough information to answer that question accurately. Please refer to the user guide at /guide or contact support for assistance."
      
      // Log low-confidence interaction
      await supabase.from('help_interactions').insert({
        user_id: user.id,
        question: message,
        answer: fallbackAnswer,
        confidence: confidence,
        context: context,
        sources: [],
        ai_provider: 'claude',
        response_time_ms: Date.now() - startTime,
      })

      return NextResponse.json({
        answer: fallbackAnswer,
        confidence: confidence,
        sources: [],
        suggestedActions: [
          {
            label: 'View User Guide',
            path: '/guide',
          },
        ],
      })
    }

    // 8. Build context from retrieved documents (truncate to avoid overwhelming Claude)
    const MAX_CONTENT_LENGTH = 1200 // Limit each doc to ~1200 chars
    const documentContext = relevantDocs
      .map((doc: any, i: number) => {
        // Truncate long content
        const truncatedContent = doc.content.length > MAX_CONTENT_LENGTH
          ? doc.content.substring(0, MAX_CONTENT_LENGTH) + '... [truncated for brevity]'
          : doc.content
        
        let docText = `[Document ${i + 1}: ${doc.title}]\n${truncatedContent}`
        
        if (doc.steps && Array.isArray(doc.steps)) {
          // Include steps but limit to first 10
          const steps = doc.steps.slice(0, 10)
          docText += `\n\nStep-by-step instructions:\n${steps.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}`
        }
        
        return docText
      })
      .join('\n\n---\n\n')

    // 9. Build system prompt
    const systemPrompt = `You are a helpful assistant for the CFMEU Organiser Platform.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY answer based on the provided documentation below
2. If the information is not in the documentation, say "I don't have information about that in the documentation"
3. NEVER make assumptions or invent features that aren't documented
4. Always provide step-by-step instructions when the documentation includes steps
5. Be concise but complete
6. Cite which document you're referencing when appropriate
7. If asked about something outside the platform, politely redirect to platform topics

Current User Context:
- Role: ${userRole}
- Current Page: ${context.page}
- Feature Area: ${getFeatureName(context.page)}

Available Documentation:
${documentContext}

Remember: Only answer based on the documentation above. If you're not sure, say you don't have that information.`

    // 10. Build conversation messages
    const messages: Anthropic.MessageParam[] = [
      // Include recent conversation history (last 3 turns)
      ...conversationHistory.slice(-6).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      // Add current question
      {
        role: 'user' as const,
        content: message,
      },
    ]

    // 11. Call Claude API with timeout
    const claudeResponse = await Promise.race([
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800, // Reduced from 1024 for faster responses
        temperature: 0.1, // Low temperature for factual, consistent responses
        system: systemPrompt,
        messages: messages,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude API timeout after 30s')), 30000)
      )
    ]) as Anthropic.Message

    const answer = claudeResponse.content[0].type === 'text' 
      ? claudeResponse.content[0].text 
      : 'Unable to generate response'

    // 12. Build sources
    const sources: Source[] = relevantDocs.map((doc: any) => ({
      docId: doc.doc_id,
      title: doc.title,
      excerpt: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
      similarity: doc.similarity,
    }))

    // 13. Extract suggested actions from documents
    const suggestedActions = extractSuggestedActions(context, relevantDocs)

    // 14. Log interaction
    await supabase.from('help_interactions').insert({
      user_id: user.id,
      question: message,
      answer: answer,
      confidence: confidence,
      context: context,
      sources: sources,
      ai_provider: 'claude',
      tokens_used: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
      response_time_ms: Date.now() - startTime,
    })

    // 15. Return response
    return NextResponse.json({
      answer,
      confidence,
      sources,
      suggestedActions,
      responseTime: Date.now() - startTime,
    })

  } catch (error) {
    console.error('Help chat error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process help request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to get feature name from page path
function getFeatureName(page: string): string {
  const features: Record<string, string> = {
    '/': 'Dashboard',
    '/projects': 'Projects',
    '/employers': 'Employers',
    '/workers': 'Workers',
    '/map': 'Map',
    '/patch': 'Patch Management',
    '/site-visits': 'Site Visits',
    '/campaigns': 'Campaigns',
    '/lead': 'Co-ordinator Console',
    '/admin': 'Administration',
    '/guide': 'User Guide',
  }

  for (const [path, name] of Object.entries(features)) {
    if (page.startsWith(path)) return name
  }

  return 'Platform'
}

// Helper to extract suggested actions from context and docs
function extractSuggestedActions(context: HelpContext, docs: any[]): Array<{ label: string; path: string }> {
  const actions: Array<{ label: string; path: string }> = []

  // Add context-aware actions based on page
  if (context.page === '/projects' && docs.some((d: any) => d.doc_id.includes('mapping'))) {
    actions.push({
      label: 'View Project Mapping Sheets',
      path: `/projects/${context.projectId || ''}?tab=mappingsheets`,
    })
  }

  if (docs.some((d: any) => d.doc_id.includes('delegate-registration'))) {
    actions.push({
      label: 'Learn About Delegate Registration',
      path: '/guide#delegate-registration',
    })
  }

  // Add guide action if no other actions
  if (actions.length === 0) {
    actions.push({
      label: 'View User Guide',
      path: '/guide',
    })
  }

  return actions
}
