import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import Anthropic from '@anthropic-ai/sdk'
import { validatePdfSignature } from '@/lib/validation/fileSignature'

const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing CFMEU NSW MappingSheets forms. These are standardized construction project forms.

**FORM STRUCTURE (CFMEU NSW MappingSheets):**

PAGE 1 (Project Details):
- **TOP SECTION**: Contains "Organiser name" field and "Project Name" field (THIS IS WHERE THE PROJECT NAME IS!)
- Government or Private checkboxes
- Funding amounts, Project Value, **Address** (THIS IS WHERE THE PROJECT ADDRESS IS!), Builder
- Proposed start/finish dates
- EBA checkbox
- Site Contacts table

PAGE 2 (Subcontractors):
- Table with columns: Stage | Trade | Company | EBA
- Lists subcontractors for the project

**TYPICAL BATCH STRUCTURE:**
- Multiple projects in one PDF
- Each project = 2 pages (sometimes 3 if many subcontractors)
- Projects are sequential (Project 1: pages 1-2, Project 2: pages 3-4, etc.)

Your task is to analyze PDFs containing multiple projects and detect:
1. Project boundaries (which pages belong to which project)
2. **Project names from the "Project Name" field at the TOP of page 1** for each project
3. **Project addresses from the "Address" field on page 1** for each project
4. Confidence scores for your detections`

const ANALYSIS_USER_PROMPT = `Analyze this PDF of CFMEU NSW MappingSheets forms containing multiple construction projects.

**WHAT YOU'RE LOOKING FOR:**

1. **Project Boundaries**:
   - Identify where each project starts and ends
   - Usually 2 pages per project (page 1 = details, page 2 = subcontractors)
   - Look for the form header pattern repeating to detect new projects

2. **Project Names** (CRITICAL):
   - On page 1 of EACH project, at the TOP, there's a field labeled "Project Name"
   - This is handwritten text in a box/field near the top of the form
   - Extract the EXACT text from this field
   - Common examples: "Collins Street Tower", "West Gate Tunnel", "Melbourne Metro Stage 2"
   - If the Project Name field is blank or illegible, use "Unnamed Project"
   - NEVER use generic names like "Project 1", "Project 2", "Unknown Project"

3. **Project Addresses** (IMPORTANT):
   - On page 1 of EACH project, there's an "Address" field
   - This contains the physical address of the construction site
   - Extract the EXACT text from this field
   - Common examples: "123 Collins St, Melbourne VIC 3000", "West Gate Freeway, Spotswood VIC"
   - If the Address field is blank or illegible, use null
   - This helps users match to existing projects

4. **Confidence Scores**:
   - 0.9-1.0: Project name and address clearly legible, boundaries obvious
   - 0.7-0.9: Project name and address readable, standard 2-page structure
   - 0.5-0.7: Project name or address partially legible or non-standard page count
   - <0.5: Project name or address illegible or boundaries unclear

**IMPORTANT:**
- Each CFMEU NSW MappingSheets form has a specific "Project Name" field at the top
- The "Address" field is separate from the project name, builder name, or organiser name
- Extract ONLY what's written in those specific fields
- Handwriting may vary but the field locations are always the same

Return ONLY valid JSON in this exact format:
{
  "projects": [
    {
      "startPage": 1,
      "endPage": 2,
      "projectName": "Collins Street Tower Development",
      "projectAddress": "123 Collins St, Melbourne VIC 3000",
      "confidence": 0.95,
      "reasoning": "Project name and address clearly visible on page 1"
    },
    {
      "startPage": 3,
      "endPage": 4,
      "projectName": "Unnamed Project",
      "projectAddress": null,
      "confidence": 0.60,
      "reasoning": "No clear project name or address found on page 3, but form structure suggests project boundary"
    }
  ],
  "totalPages": 4,
  "detectionMethod": "header_analysis",
  "notes": ["Projects follow standard 2-page format"]
}

Rules:
- startPage and endPage are 1-indexed (first page is 1, not 0)
- confidence should be 0.0 to 1.0 based on clarity of project name, address, and boundaries
- projectName must be extracted text from the document, never use placeholders like "Project 1" or "Project 2"
- projectAddress must be extracted text from the document, or null if not found
- If no name found, use exactly "Unnamed Project" (this helps distinguish from placeholder names)`

interface AnalysisResult {
  projects: Array<{
    startPage: number
    endPage: number
    projectName: string
    projectAddress?: string | null
    confidence: number
    reasoning?: string
  }>
  totalPages: number
  detectionMethod: string
  notes?: string[]
}

/**
 * POST /api/projects/batch-upload/analyze
 *
 * Analyzes a PDF to detect project boundaries and extract project names using Claude AI
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // SECURITY: Validate file signature (magic bytes) to prevent malicious uploads
    const signatureValidation = await validatePdfSignature(buffer)
    if (!signatureValidation.valid) {
      console.warn('[analyze] PDF signature validation failed:', signatureValidation.error)
      return NextResponse.json(
        {
          error: 'Invalid PDF file',
          details: 'The uploaded file does not appear to be a valid PDF. File extension can be spoofed - please ensure you are uploading a genuine PDF file.'
        },
        { status: 400 }
      )
    }

    // Check file size (limit to 50MB for performance)
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    // Initialize Anthropic client
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const client = new Anthropic({ apiKey: anthropicApiKey })

    console.log(`[analyze] Processing PDF: ${file.name} (${(buffer.length / 1024).toFixed(2)} KB)`)

    // Call Claude to analyze PDF (same model as mapping sheet scanner)
    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Same model as working scanner
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: ANALYSIS_USER_PROMPT,
            },
          ],
        },
      ],
    })

    const processingTime = Date.now() - startTime

    // Extract text response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    console.log(`[analyze] Claude response (${processingTime}ms):`, responseText.substring(0, 200))
    console.log(`[analyze] Full Claude response:`, responseText)

    // Parse JSON response (handle markdown code blocks)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    let analysis: AnalysisResult
    try {
      analysis = JSON.parse(jsonText)
      console.log('[analyze] Parsed analysis:', JSON.stringify(analysis, null, 2))
    } catch (parseError) {
      console.error('[analyze] Failed to parse Claude response:', parseError)
      console.error('[analyze] Raw response:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          rawResponse: responseText.substring(0, 500),
        },
        { status: 500 }
      )
    }

    // Validate analysis
    if (!analysis.projects || !Array.isArray(analysis.projects)) {
      console.error('[analyze] Invalid analysis structure:', analysis)
      return NextResponse.json(
        { error: 'Invalid analysis format: missing projects array' },
        { status: 500 }
      )
    }

    // Log each project name and address for debugging
    analysis.projects.forEach((p, idx) => {
      console.log(`[analyze] Project ${idx + 1}: "${p.projectName}" at "${p.projectAddress || 'No address'}" (pages ${p.startPage}-${p.endPage}, confidence: ${p.confidence})`)
    })

    // Calculate costs
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costPer1kInput = 0.003 // $3 per million tokens
    const costPer1kOutput = 0.015 // $15 per million tokens
    const costUsd = (inputTokens / 1000) * costPer1kInput + (outputTokens / 1000) * costPer1kOutput

    console.log(`[analyze] Analysis complete: ${analysis.projects.length} projects detected, cost: $${costUsd.toFixed(4)}`)

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        processingTimeMs: processingTime,
        inputTokens,
        outputTokens,
        costUsd: parseFloat(costUsd.toFixed(4)),
        model: 'claude-sonnet-4-5-20250929',
      },
    })
  } catch (error) {
    console.error('[analyze] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Analysis failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
