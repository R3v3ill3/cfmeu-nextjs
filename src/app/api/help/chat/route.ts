import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface HelpContext {
  page: string
  role?: string
  section?: string
  projectId?: string
  isMobile?: boolean
  documentType?: 'user-guide' | 'workflow-guide' | 'mobile-guide' | 'system-guide'
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
  documentTitle?: string
  documentType?: string
  examples?: string[]
  relatedLinks?: Array<{ label: string; url: string }>
  mobileOnly?: boolean
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

    // 2. Get authenticated user using anon SSR client
    const supabase = await createServerSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

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
const isMobile = context.isMobile || false

    // 4. Search for relevant documents using enhanced help system
    const { searchGuide, getSectionsForRoute } = await import('@/lib/helpGuide')

    // Get route-specific sections first
    const routeSections = getSectionsForRoute(context.page, userRole, isMobile)

    // Then search for additional relevant content
    const searchResults = searchGuide(message, userRole, isMobile, context.documentType)

    // Combine and deduplicate results
    const allSections = [...routeSections, ...searchResults]
    const uniqueSections = allSections.filter((section, index, self) =>
      index === self.findIndex((s) => s.id === section.id)
    ).slice(0, 5) // Limit to top 5 most relevant sections

    // 5. Calculate confidence based on result quality
    const hasRouteMatch = routeSections.length > 0
    const hasSearchMatch = searchResults.length > 0
    const hasDirectContentMatch = uniqueSections.some(section =>
      section.title.toLowerCase().includes(message.toLowerCase()) ||
      section.keywords.some(keyword => message.toLowerCase().includes(keyword))
    )

    let confidence = 0
    if (hasDirectContentMatch) confidence = 0.9
    else if (hasRouteMatch && hasSearchMatch) confidence = 0.8
    else if (hasRouteMatch || hasSearchMatch) confidence = 0.6
    else confidence = 0.3

    // 6. If confidence too low, return fallback
    if (confidence < 0.5) {
      const fallbackAnswer = "I don't have enough information to answer that question accurately. Please refer to the user guide at /guide or contact support for assistance."

      // Log low-confidence interaction via RPC
      await supabase.rpc('log_help_interaction', {
        p_user_id: user.id,
        p_question: message,
        p_answer: fallbackAnswer,
        p_confidence: confidence,
        p_context: context as any,
        p_sources: [],
        p_ai_provider: 'claude',
        p_tokens_used: null,
        p_response_time_ms: Date.now() - startTime,
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

    // 7. Build context from retrieved help sections (enhanced with metadata)
    const MAX_CONTENT_LENGTH = 1200 // Limit each section to ~1200 chars
    const documentContext = uniqueSections
      .map((section, i: number) => {
        // Truncate long content
        const truncatedContent = section.content.length > MAX_CONTENT_LENGTH
          ? section.content.substring(0, MAX_CONTENT_LENGTH) + '... [truncated for brevity]'
          : section.content

        let docText = `[${section.documentTitle || 'Help Guide'} - ${section.title}]\n${truncatedContent}`

        // Include examples if available
        if (section.examples && section.examples.length > 0) {
          const examples = section.examples.slice(0, 3) // Limit to 3 examples
          docText += `\n\nExamples:\n${examples.map((example, idx) => `${idx + 1}. ${example}`).join('\n')}`
        }

        // Include related links if available
        if (section.relatedLinks && section.relatedLinks.length > 0) {
          docText += `\n\nRelated Resources:\n${section.relatedLinks.map(link => `- ${link.label}: ${link.url}`).join('\n')}`
        }

        // Add mobile-specific context if applicable
        if (isMobile && section.mobileOnly) {
          docText += `\n\n[Mobil-optimized content for field use]`
        }

        return docText
      })
      .join('\n\n---\n\n')

    // 8. Build enhanced system prompt with mobile context
    const systemPrompt = `You are a helpful assistant for the CFMEU Organiser Platform.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY answer based on the provided documentation below
2. If the information is not in the documentation, say "I don't have information about that in the documentation"
3. NEVER make assumptions or invent features that aren't documented
4. Always provide step-by-step instructions when the documentation includes steps
5. Be concise but complete
6. Cite which document you're referencing when appropriate
7. If asked about something outside the platform, politely redirect to platform topics
8. ${isMobile ? 'Prioritize mobile-optimized guidance and field-appropriate instructions' : 'Provide comprehensive desktop guidance'}

Current User Context:
- Role: ${userRole}
- Current Page: ${context.page}
- Feature Area: ${getFeatureName(context.page)}
- Device: ${isMobile ? 'Mobile (Field Use)' : 'Desktop'}
- Document Type Focus: ${context.documentType || 'All documents'}

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
        model: "claude-sonnet-4-5-20250929",
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

    // 11. Build enhanced sources with metadata
    const sources: Source[] = uniqueSections.map((section) => ({
      docId: section.id,
      title: section.title,
      excerpt: section.content.substring(0, 200) + (section.content.length > 200 ? '...' : ''),
      similarity: confidence, // Use overall confidence as similarity proxy
      documentTitle: section.documentTitle,
      documentType: section.documentId,
      examples: section.examples?.slice(0, 2),
      relatedLinks: section.relatedLinks,
      mobileOnly: section.mobileOnly
    }))

    // 12. Extract suggested actions from help sections
    const suggestedActions = extractSuggestedActions(context, uniqueSections)

    // 14. Log interaction via RPC
    await supabase.rpc('log_help_interaction', {
      p_user_id: user.id,
      p_question: message,
      p_answer: answer,
      p_confidence: confidence,
      p_context: context as any,
      p_sources: sources as any,
      p_ai_provider: 'claude',
      p_tokens_used: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
      p_response_time_ms: Date.now() - startTime,
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        return NextResponse.json(
          {
            error: 'AI service configuration error',
            details: 'API key not configured'
          },
          { status: 500 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          {
            error: 'Request timeout',
            details: 'The AI service took too long to respond'
          },
          { status: 408 }
        )
      }
    }

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

// Enhanced helper to extract suggested actions from context and help sections
function extractSuggestedActions(context: HelpContext, sections: any[]): Array<{ label: string; path: string }> {
  const actions: Array<{ label: string; path: string }> = []

  // Add context-aware actions based on page and document content
  if (context.page.startsWith('/projects') && sections.some((s) => s.title.toLowerCase().includes('mapping'))) {
    actions.push({
      label: 'View Project Mapping',
      path: `/projects/${context.projectId || 'current'}/mapping`,
    })
  }

  if (context.page.startsWith('/mobile/ratings') && sections.some((s) => s.documentId === 'ratings-system-v2')) {
    actions.push({
      label: 'Open Ratings Wizard',
      path: '/mobile/ratings/wizard',
    })
  }

  if (context.page.startsWith('/site-visit-wizard') && sections.some((s) => s.title.toLowerCase().includes('workflow'))) {
    actions.push({
      label: 'Start Site Visit',
      path: '/site-visit-wizard',
    })
  }

  // Add mobile-specific actions
  if (context.isMobile) {
    if (sections.some((s) => s.documentId === 'mobile-app-guide')) {
      actions.push({
        label: 'Mobile App Guide',
        path: '/guide#mobile-app',
      })
    }
  }

  // Add document-specific actions from related links
  sections.forEach((section) => {
    if (section.relatedLinks) {
      section.relatedLinks.forEach((link: { label: string; url: string }) => {
        if (!actions.some(a => a.label === link.label)) {
          actions.push({
            label: link.label,
            path: link.url,
          })
        }
      })
    }
  })

  // Default actions based on role and page
  if (actions.length === 0) {
    if (context.page?.includes('mobile')) {
      actions.push({
        label: 'Mobile Dashboard',
        path: '/mobile',
      })
    } else {
      actions.push({
        label: 'View User Guide',
        path: '/guide',
      })
    }
  }

  // Limit to maximum 4 actions
  return actions.slice(0, 4)
}
