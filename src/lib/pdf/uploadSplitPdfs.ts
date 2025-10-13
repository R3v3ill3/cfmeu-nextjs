import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { SplitResult } from './splitPdfByProjects'

export interface UploadedSplitPdf {
  path: string
  url: string
  fileName: string
  size: number
  definition: SplitResult['definition']
}

/**
 * Uploads split PDFs to Supabase Storage
 * @param batchId Batch upload ID for organizing files
 * @param userId User ID for file path
 * @param splitResults Results from splitPdfByProjects
 * @returns Array of upload results with storage paths
 */
export async function uploadSplitPdfs(
  batchId: string,
  userId: string,
  splitResults: SplitResult[]
): Promise<UploadedSplitPdf[]> {
  const supabase = getSupabaseBrowserClient()
  const uploadedFiles: UploadedSplitPdf[] = []

  for (const result of splitResults) {
    // Create storage path: mapping-sheet-scans/{userId}/batch-{batchId}/{fileName}
    const storagePath = `${userId}/batch-${batchId}/${result.fileName}`

    // Convert Uint8Array to Blob
    const blob = new Blob([result.pdfBytes], { type: 'application/pdf' })

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('mapping-sheet-scans')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (error) {
      console.error(`Failed to upload ${result.fileName}:`, error)
      throw new Error(`Upload failed for ${result.fileName}: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('mapping-sheet-scans')
      .getPublicUrl(data.path)

    uploadedFiles.push({
      path: data.path,
      url: urlData.publicUrl,
      fileName: result.fileName,
      size: result.pdfBytes.length,
      definition: result.definition,
    })
  }

  return uploadedFiles
}
