import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase/server'
import { mapFilenameToTradeType, extractTradeLabelFromFilename } from '@/utils/ebaTradeTypeMapping'
import { validatePdfSignature } from '@/lib/validation/fileSignature'

interface ParsedEmployer {
  companyName: string
  aliases?: string[]
  streetAddress?: string
  suburb?: string
  state?: string
  postcode?: string
  phones: string[]
  sectorCode?: string
  rawText?: string
}

interface ParseResult {
  success: boolean
  tradeType: string | null
  tradeLabel: string
  sourceFile: string
  employers: ParsedEmployer[]
  totalParsed: number
  errors?: string[]
  metadata?: {
    modelUsed: string
    costUsd: number
    processingTimeMs: number
  }
}

const CLAUDE_SYSTEM_PROMPT = `You are an expert at extracting structured employer data from PDF documents.

You will receive a PDF containing a list of employers with active Enterprise Bargaining Agreements (EBAs), categorized by trade.

The PDF format is typically:
- Header: "EMPLOYMENT LIST", "COMPANY NAME & ADDRESS", "PHONE", "FAX", "SECTOR"
- Each employer record spans multiple lines
- **CRITICAL: The first column contains company ID codes (e.g., "CRANHIR", "BRICAUS") - IGNORE these codes completely**
- Company name appears in the second column or after the ID code
- Example: "CRANHIR    Crane Hire Group Pty Ltd" → Extract only "Crane Hire Group Pty Ltd"
- Example: "BRICAUS    Australian Bricklaying Pty Ltd" → Extract only "Australian Bricklaying Pty Ltd"
- Address lines (street, suburb/state/postcode) on subsequent lines
- Phone/fax numbers interspersed
- Sector code (e.g., "23YBR", "45ABC") marks the end of each employer record
- State abbreviations: NSW, VIC, QLD, SA, WA, TAS, NT, ACT
- Australian postcodes are 4 digits

**CRITICAL: Trading Names and Aliases**
Many company names contain multiple trading variations. Look for these patterns:
- "T/A" or "T/AS" or "TRADING AS" followed by a trading name
- "THE TRUSTEE FOR [NAME] T/A [TRADING NAME]"
- "PREVIOUSLY [OLD NAME]"
- "ATF [TRUST NAME]" or "AS TRUSTEE FOR [TRUST NAME]"
- Multiple names separated by "/"

Examples:
- "THE TRUSTEE FOR DELUXE CLEANING UNITY TRUST T/A: DELUXE CLEANING PTY LTD"
  → companyName: "THE TRUSTEE FOR DELUXE CLEANING UNITY TRUST"
  → aliases: ["DELUXE CLEANING PTY LTD", "DELUXE CLEANING"]
  
- "ABC PTY LTD T/A XYZ SERVICES"
  → companyName: "ABC PTY LTD"
  → aliases: ["XYZ SERVICES"]

Your task:
1. Extract ALL employer records from the PDF
2. For each employer, extract:
   - Company name (legal entity name, before any T/A)
   - Aliases (trading names, after T/A or TRADING AS)
   - Street address (if present)
   - Suburb (if present)
   - State (standardized to: NSW, VIC, QLD, SA, WA, TAS, NT, or ACT)
   - Postcode (4 digits)
   - Phone numbers (array, cleaned to numbers only)
   - Sector code (e.g., "23YBR")

3. Return ONLY valid JSON (no markdown, no explanations) in this exact format:
{
  "employers": [
    {
      "companyName": "THE TRUSTEE FOR ABC TRUST",
      "aliases": ["ABC CLEANING", "ABC SERVICES"],
      "streetAddress": "123 Smith Street",
      "suburb": "Melbourne",
      "state": "VIC",
      "postcode": "3000",
      "phones": ["0398765432", "0412345678"],
      "sectorCode": "23YBR"
    }
  ]
}

Important:
- Return ONLY the JSON object, no markdown code blocks
- **IGNORE company ID codes in the first column (e.g., CRANHIR, BRICAUS) - do NOT include these in the company name**
- Extract ALL trading names as separate aliases
- If no T/A or trading name, aliases can be empty array or omitted
- If a field is missing or unclear, omit it (don't use null or empty string)
- Normalize state names to standard abbreviations
- Remove all non-digit characters from phone numbers
- Skip header rows and footer text
- companyName should be the legal entity only, without the ID code prefix
- aliases should be trading names`

/**
 * POST /api/admin/eba-trade-import/parse
 * 
 * Parses an EBA trade PDF using Claude AI to extract employer records
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authenticate user
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role (allow admin or lead_organiser)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'lead_organiser'].includes(profile.role)) {
      return NextResponse.json({ 
        error: 'Forbidden - admin or lead_organiser access required' 
      }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const manualTradeType = formData.get('tradeType') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Extract trade information from filename
    const tradeLabel = extractTradeLabelFromFilename(file.name)
    const detectedTradeType = mapFilenameToTradeType(file.name)
    const tradeType = manualTradeType || detectedTradeType

    console.log(`[eba-parse] Processing: ${file.name}`)
    console.log(`[eba-parse] Trade label: ${tradeLabel}, Type: ${tradeType}`)

    // Check file size (limit to 50MB)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // SECURITY: Validate file signature (magic bytes) to prevent malicious uploads
    const signatureValidation = await validatePdfSignature(buffer)
    if (!signatureValidation.valid) {
      console.warn('[eba-parse] PDF signature validation failed:', signatureValidation.error)
      return NextResponse.json(
        {
          error: 'Invalid PDF file',
          details: 'The uploaded file does not appear to be a valid PDF. File extension can be spoofed - please ensure you are uploading a genuine PDF file.',
          securityWarning: 'Potential security risk detected: file signature mismatch'
        },
        { status: 400 }
      )
    }

    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    // Initialize Anthropic client
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      console.error('[eba-parse] ANTHROPIC_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const client = new Anthropic({ apiKey: anthropicApiKey })

    // Call Claude to parse PDF
    console.log(`[eba-parse] Sending to Claude (${(buffer.length / 1024).toFixed(2)} KB)`)
    
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: CLAUDE_SYSTEM_PROMPT,
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
              text: `Extract all employer records from this ${tradeLabel} EBA list. Return only the JSON object with the "employers" array.`,
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

    console.log(`[eba-parse] Claude response (${processingTime}ms):`, responseText.substring(0, 200))

    // Parse JSON response (handle markdown code blocks if present)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    let parsed: { employers: ParsedEmployer[] }
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('[eba-parse] Failed to parse Claude response:', parseError)
      console.error('[eba-parse] Raw response:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          rawResponse: responseText.substring(0, 500),
        },
        { status: 500 }
      )
    }

    // Validate response structure
    if (!parsed.employers || !Array.isArray(parsed.employers)) {
      return NextResponse.json(
        {
          error: 'Invalid response structure from AI',
          details: 'Missing or invalid "employers" array',
        },
        { status: 500 }
      )
    }

    // Calculate approximate cost
    // Claude Sonnet pricing: ~$3 per million input tokens, ~$15 per million output tokens
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15

    const result: ParseResult = {
      success: true,
      tradeType,
      tradeLabel,
      sourceFile: file.name,
      employers: parsed.employers,
      totalParsed: parsed.employers.length,
      metadata: {
        modelUsed: message.model,
        costUsd: parseFloat(costUsd.toFixed(4)),
        processingTimeMs: processingTime,
      },
    }

    console.log(`[eba-parse] Success: ${result.totalParsed} employers parsed, cost: $${result.metadata.costUsd}`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[eba-parse] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to parse PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

