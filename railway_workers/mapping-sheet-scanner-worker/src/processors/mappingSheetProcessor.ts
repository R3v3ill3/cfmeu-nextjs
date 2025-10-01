import { createClient } from '@supabase/supabase-js'
import { config } from '../config'
import { MappingSheetScanJob, ProcessingResult } from '../types'
import { extractWithClaude } from '../ai/claude'

export async function processMappingSheetScan(
  supabase: ReturnType<typeof createClient>,
  job: MappingSheetScanJob
): Promise<{ succeeded: number; failed: number }> {
  const { scanId, fileUrl } = job.payload

  try {
    console.log(`[processor] Processing scan ${scanId}`)

    // Update status to processing
    await supabase
      .from('mapping_sheet_scans')
      .update({ 
        status: 'processing',
        extraction_attempted_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    // Download PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('mapping-sheet-scans')
      .download(fileUrl)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`)
    }

    // Convert to buffer
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

    // Get selected pages from job payload
    const selectedPages = job.payload.selectedPages as number[] | undefined

    // Try Claude (Claude can read PDFs directly!)
    console.log(`[processor] Attempting extraction with Claude (PDF direct)`)
    const result: ProcessingResult = await extractWithClaude(pdfBuffer, selectedPages)

    if (!result.success) {
      throw new Error(`Claude extraction failed: ${result.error}`)
    }

    console.log(`[processor] Extraction successful with ${result.provider}`)

    // Store cost tracking
    await supabase.from('mapping_sheet_scan_costs').insert({
      scan_id: scanId,
      ai_provider: result.provider,
      model: result.provider === 'claude' ? config.claudeModel : config.openaiModel,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      images_processed: result.imagesProcessed,
      cost_usd: result.costUsd,
      processing_time_ms: result.processingTimeMs,
    })

    // Update scan record with results
    await supabase
      .from('mapping_sheet_scans')
      .update({
        status: 'completed',
        extracted_data: result.extractedData,
        confidence_scores: result.extractedData?.confidence,
        ai_provider: result.provider,
        extraction_completed_at: new Date().toISOString(),
        extraction_cost_usd: result.costUsd,
        page_count: imageBuffers.length,
      })
      .eq('id', scanId)

    return { succeeded: 1, failed: 0 }
  } catch (error) {
    console.error(`[processor] Failed to process scan ${scanId}:`, error)

    // Update scan with error
    await supabase
      .from('mapping_sheet_scans')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        retry_count: job.attempts,
      })
      .eq('id', scanId)

    return { succeeded: 0, failed: 1 }
  }
}
