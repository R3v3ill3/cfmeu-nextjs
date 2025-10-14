import { createClient } from '@supabase/supabase-js'
import { config } from '../config'
import { MappingSheetScanJob, ProcessingResult } from '../types'
import { extractWithClaude } from '../ai/claude'

export async function processMappingSheetScan(
  supabase: any,
  job: MappingSheetScanJob
): Promise<{ succeeded: number; failed: number }> {
  const { scanId } = job.payload

  try {
    console.log(`[processor] Processing scan ${scanId}`)

    // Fetch scan record to get file URL
    const { data: scanRecord, error: scanFetchError } = await supabase
      .from('mapping_sheet_scans')
      .select('file_url, file_name, upload_mode')
      .eq('id', scanId)
      .single()

    if (scanFetchError || !scanRecord) {
      throw new Error(`Failed to fetch scan record: ${scanFetchError?.message}`)
    }

    // Extract storage path from public URL
    // URL format: https://.../storage/v1/object/public/mapping-sheet-scans/{path}
    const fileUrl = scanRecord.file_url as string
    if (!fileUrl) {
      throw new Error('Scan record is missing file_url')
    }

    let storagePath = fileUrl

    const bucketSegment = '/mapping-sheet-scans/'
    const bucketPrefix = 'mapping-sheet-scans/'

    if (fileUrl.includes(bucketSegment)) {
      storagePath = fileUrl.split(bucketSegment)[1]
    } else if (fileUrl.startsWith(bucketPrefix)) {
      storagePath = fileUrl.substring(bucketPrefix.length)
    } else if (fileUrl.startsWith('http')) {
      // Handle signed URL without expected path segment
      const url = new URL(fileUrl)
      const parts = url.pathname.split('/').filter(Boolean)
      const bucketIndex = parts.findIndex((segment) => segment === 'mapping-sheet-scans')
      if (bucketIndex === -1 || bucketIndex === parts.length - 1) {
        throw new Error(`Could not extract storage path from URL: ${fileUrl}`)
      }
      storagePath = parts.slice(bucketIndex + 1).join('/')
    }

    if (!storagePath) {
      throw new Error(`Could not determine storage path for file: ${fileUrl}`)
    }

    // Update status to processing
    const { error: processingUpdateError } = await supabase
      .from('mapping_sheet_scans')
      .update({
        status: 'processing',
        extraction_attempted_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    if (processingUpdateError) {
      throw new Error(`Failed to mark scan ${scanId} as processing: ${processingUpdateError.message}`)
    }

    // Download PDF from Supabase Storage
    console.log(`[processor] Downloading from storage path: ${storagePath}`)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('mapping-sheet-scans')
      .download(storagePath)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`)
    }

    // Convert to buffer
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

    // Get selected pages from job payload
    const selectedPages = job.payload.selectedPages as number[] | undefined

    // Try Claude (Claude can read PDFs directly!)
    // Note: Claude will process all pages - we'll use text instruction to focus on specific pages
    console.log(`[processor] Attempting extraction with Claude (PDF direct)${selectedPages ? ` - focus on pages: ${selectedPages.join(', ')}` : ''}`)
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

    // Determine final status based on upload_mode (already fetched at start)
    // - new_project scans: review_new_project (triggers quick finder dialog)
    // - existing_project scans: completed (goes straight to under_review)
    const finalStatus = scanRecord.upload_mode === 'new_project'
      ? 'review_new_project'
      : 'completed'

    console.log(`[processor] Setting final status to '${finalStatus}' (upload_mode: ${scanRecord.upload_mode})`)

    // Update scan record with results
    const { error: completionUpdateError } = await supabase
      .from('mapping_sheet_scans')
      .update({
        status: finalStatus,
        extracted_data: result.extractedData,
        confidence_scores: result.extractedData?.confidence,
        ai_provider: result.provider,
        extraction_completed_at: new Date().toISOString(),
        extraction_cost_usd: result.costUsd,
        page_count: selectedPages?.length || result.extractedData?.pages_processed || 1,
      })
      .eq('id', scanId)

    if (completionUpdateError) {
      throw new Error(`Failed to update scan ${scanId} with extraction results: ${completionUpdateError.message}`)
    }

    return { succeeded: 1, failed: 0 }
  } catch (error) {
    const message = error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : 'Unknown error'

    console.error(`[processor] Failed to process scan ${scanId}:`, message)

    // Update scan with error
    await supabase
      .from('mapping_sheet_scans')
      .update({
        status: 'failed',
        error_message: message,
        retry_count: job.attempts,
      })
      .eq('id', scanId)

    return { succeeded: 0, failed: 1 }
  }
}
