import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { validatePdfSignature } from '@/lib/validation/fileSignature'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/batch-upload/init
 *
 * Step 1: Upload original PDF to storage
 * Returns batchId and upload URL for client to proceed with splitting
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const totalPages = parseInt(formData.get('totalPages') as string)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!totalPages || totalPages < 1) {
      return NextResponse.json({ error: 'Invalid totalPages' }, { status: 400 })
    }

    // SECURITY: Validate file signature (magic bytes) before processing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const signatureValidation = await validatePdfSignature(buffer)
    if (!signatureValidation.valid) {
      console.warn('[batch-init] PDF signature validation failed:', signatureValidation.error)
      return NextResponse.json(
        {
          error: 'Invalid PDF file',
          details: 'The uploaded file does not appear to be a valid PDF. File extension can be spoofed - please ensure you are uploading a genuine PDF file.'
        },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate unique batch ID
    const batchId = crypto.randomUUID()

    // Recreate File from buffer for upload (since we already read it for validation)
    const validatedFile = new File([buffer], file.name, { type: 'application/pdf' })

    // Upload original PDF to storage (use validated file)
    const storagePath = `${user.id}/batch-${batchId}/original-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('mapping-sheet-scans')
      .upload(storagePath, validatedFile, {
        contentType: 'application/pdf',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('mapping-sheet-scans')
      .getPublicUrl(uploadData.path)

    return NextResponse.json({
      success: true,
      batchId,
      fileUrl: urlData.publicUrl,
      filePath: uploadData.path,
      fileName: file.name,
      fileSize: file.size,
      totalPages,
      uploaderId: user.id,
    })
  } catch (error) {
    console.error('Batch init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Init failed' },
      { status: 500 }
    )
  }
}
