import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

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

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate unique batch ID
    const batchId = crypto.randomUUID()

    // Upload original PDF to storage
    const storagePath = `${user.id}/batch-${batchId}/original-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('mapping-sheet-scans')
      .upload(storagePath, file, {
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
    })
  } catch (error) {
    console.error('Batch init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Init failed' },
      { status: 500 }
    )
  }
}
