import OpenAI from 'openai'
import { config } from '../config'
import { ExtractedMappingSheetData, ProcessingResult } from '../types'
import { CLAUDE_SYSTEM_PROMPT, CLAUDE_USER_PROMPT } from './prompts'

const client = new OpenAI({
  apiKey: config.openaiApiKey,
})

export async function extractWithOpenAI(
  imageBuffers: Buffer[]
): Promise<ProcessingResult> {
  const startTime = Date.now()
  
  try {
    // Convert buffers to base64 data URLs
    const imageUrls = imageBuffers.map((buffer) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/png;base64,${buffer.toString('base64')}`,
        detail: 'high' as const,
      },
    }))

    // Build message content
    const content: any[] = [
      { type: 'text', text: CLAUDE_SYSTEM_PROMPT },
    ]
    
    imageBuffers.forEach((_, index) => {
      content.push(imageUrls[index])
      content.push({
        type: 'text',
        text: CLAUDE_USER_PROMPT(index + 1, imageBuffers.length),
      })
    })

    // Call OpenAI API
    const response = await client.chat.completions.create({
      model: config.openaiModel,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    const responseText = response.choices[0]?.message?.content || ''

    // Parse JSON
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    const extractedData: ExtractedMappingSheetData = JSON.parse(jsonText)
    
    // Calculate cost (rough estimate for vision)
    const totalTokens = response.usage?.total_tokens || 0
    const costUsd = (totalTokens / 1000) * config.openaiCostPer1kTokens

    const processingTimeMs = Date.now() - startTime

    return {
      success: true,
      extractedData,
      provider: 'openai',
      costUsd,
      processingTimeMs,
      imagesProcessed: imageBuffers.length,
    }
  } catch (error) {
    console.error('[openai] Extraction failed:', error)
    return {
      success: false,
      provider: 'openai',
      costUsd: 0,
      processingTimeMs: Date.now() - startTime,
      imagesProcessed: imageBuffers.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
