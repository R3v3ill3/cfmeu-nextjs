import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'
import { ExtractedMappingSheetData, ProcessingResult } from '../types'
import { CLAUDE_SYSTEM_PROMPT, CLAUDE_USER_PROMPT } from './prompts'

const client = new Anthropic({
  apiKey: config.claudeApiKey,
})

export async function extractWithClaude(
  pdfBuffer: Buffer,
  selectedPages?: number[]
): Promise<ProcessingResult> {
  const startTime = Date.now()
  
  try {
    // Build message content with PDF document
    const content: any[] = [
      {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: pdfBuffer.toString('base64'),
        },
      },
      {
        type: 'text' as const,
        text: selectedPages 
          ? `Analyze pages ${selectedPages.join(', ')} of this PDF mapping sheet.\n\n${CLAUDE_USER_PROMPT(1, selectedPages.length)}`
          : `Analyze all pages of this PDF mapping sheet.\n\n${CLAUDE_USER_PROMPT(1, 3)}`,
      },
    ]

    // Call Claude API
    const message = await client.messages.create({
      model: config.claudeModel,
      max_tokens: config.maxTokens,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    // Extract JSON from response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    // Parse JSON (may be wrapped in markdown code blocks)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    const extractedData: ExtractedMappingSheetData = JSON.parse(jsonText)
    
    // Calculate cost
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costUsd =
      (inputTokens / 1000) * config.claudeCostPer1kInput +
      (outputTokens / 1000) * config.claudeCostPer1kOutput

    const processingTimeMs = Date.now() - startTime

    return {
      success: true,
      extractedData,
      provider: 'claude',
      costUsd,
      processingTimeMs,
      inputTokens,
      outputTokens,
      imagesProcessed: selectedPages?.length || 1,
    }
  } catch (error) {
    console.error('[claude] Extraction failed:', error)
    return {
      success: false,
      provider: 'claude',
      costUsd: 0,
      processingTimeMs: Date.now() - startTime,
      imagesProcessed: selectedPages?.length || 1,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
