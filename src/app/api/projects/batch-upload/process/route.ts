import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/projects/batch-upload/process
 *
 * Step 2: After client has split PDFs and uploaded them
 * Creates batch record and scan records, triggers worker processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      batchId,
      originalFileUrl,
      originalFileName,
      originalFileSize,
      totalPages,
      projectDefinitions,
      uploadedScans,  // Array of { fileUrl, fileName, fileSize, pageCount, definition }
    } = body

    if (!batchId || !projectDefinitions || !uploadedScans) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prepare batch data
    const batchData = {
      original_file_url: originalFileUrl,
      original_file_name: originalFileName,
      original_file_size_bytes: originalFileSize,
      total_pages: totalPages,
      total_projects: projectDefinitions.length,
      project_definitions: projectDefinitions,
    }

    // Prepare scan records with selected_pages
    const scanRecords = uploadedScans.map((scan: any) => {
      // Calculate selected pages array from startPage and endPage
      const startPage = scan.definition.startPage
      const endPage = scan.definition.endPage
      const selectedPages = Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => startPage + i
      )

      return {
        project_id: scan.definition.projectId || null,
        file_url: scan.url,
        file_name: scan.fileName,
        file_size_bytes: scan.size,
        upload_mode: scan.definition.mode,
        notes: `Part of batch upload. Pages ${startPage}-${endPage} of original PDF.`,
        page_count: scan.pageCount,
        selected_pages: selectedPages,
      }
    })

    // Call RPC to create batch and scans
    const { data: result, error: rpcError } = await supabase.rpc(
      'create_batch_upload_with_scans',
      {
        p_user_id: user.id,
        p_batch_data: batchData as any,
        p_scans: scanRecords as any,
      }
    )

    if (rpcError) {
      console.error('RPC error creating batch:', rpcError)
      return NextResponse.json(
        { error: 'Failed to create batch upload' },
        { status: 500 }
      )
    }

    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      )
    }

    // Enqueue worker jobs for each scan with full context
    const scanIds = result.scanIds as string[]

    // Fetch scan records to get selected_pages and other metadata
    const { data: scans, error: fetchError } = await supabase
      .from('mapping_sheet_scans')
      .select('id, file_url, file_name, upload_mode, selected_pages')
      .in('id', scanIds)

    if (fetchError || !scans) {
      console.error('Failed to fetch scans for job creation:', fetchError)
      return NextResponse.json(
        { error: 'Failed to create jobs' },
        { status: 500 }
      )
    }

    for (const scan of scans) {
      const { error: jobError } = await supabase.from('scraper_jobs').insert({
        job_type: 'mapping_sheet_scan',
        payload: {
          scanId: scan.id,
          fileUrl: scan.file_url,
          fileName: scan.file_name,
          uploadMode: scan.upload_mode,
          selectedPages: scan.selected_pages, // Include selected pages
        },
        status: 'queued',
        priority: 5,
        max_attempts: 3,
        created_by: user.id, // Required for RLS policy
      })

      if (jobError) {
        console.error(`Failed to enqueue job for scan ${scan.id}:`, jobError)
        // Continue with other scans even if one job fails
      }
    }

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      scanIds: result.scanIds,
    })
  } catch (error) {
    console.error('Batch process error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Process failed' },
      { status: 500 }
    )
  }
}
