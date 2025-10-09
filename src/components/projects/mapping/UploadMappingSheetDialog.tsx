"use client"

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, FileCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useDropzone } from 'react-dropzone'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
// TODO: Re-add PDF thumbnails with Next.js-compatible library
// import { usePdfThumbnails } from '@/hooks/usePdfThumbnails'
// import Image from 'next/image'

type UploadMode = 'existing_project' | 'new_project'

interface SharedUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: UploadMode
  onScanReady: (scanId: string, projectId?: string) => void
}

interface ExistingProjectUploadProps extends SharedUploadDialogProps {
  mode: 'existing_project'
  projectId: string
  projectName: string
}

interface NewProjectUploadProps extends SharedUploadDialogProps {
  mode: 'new_project'
  projectName?: string
}

type UploadMappingSheetDialogProps = ExistingProjectUploadProps | NewProjectUploadProps

type UploadStage = 'select' | 'page-selection' | 'uploading' | 'processing' | 'complete' | 'error'

export function UploadMappingSheetDialog(props: UploadMappingSheetDialogProps) {
  const { open, onOpenChange, mode, onScanReady } = props
  const projectId = mode === 'existing_project' ? props.projectId : undefined
  const projectName = props.projectName || (mode === 'existing_project' ? 'Project' : 'New Project')
  const [stage, setStage] = useState<UploadStage>('select')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number>(0)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [scanId, setScanId] = useState<string>('')
  const [processingProgress, setProcessingProgress] = useState(0)

  // TODO: Re-implement with Next.js-compatible PDF library
  // const { thumbnails, isGenerating: isGeneratingThumbnails, error: thumbnailError } = usePdfThumbnails(
  //   stage === 'page-selection' ? selectedFile : null,
  //   10 // Max 10 pages for thumbnail generation
  // )

  // Check if project has pending scan
  const checkPendingScan = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id

    if (!userId) {
      toast.error('You must be signed in to upload a scan')
      return true
    }

    if (mode === 'existing_project' && projectId) {
      const { data, error } = await supabase.rpc('project_has_pending_scan', {
        p_project_id: projectId,
      })

      if (error) {
        console.error('Error checking pending scan:', error)
        return false
      }

      return data === true
    }

    const { data, error } = await supabase.rpc('user_has_pending_new_project_scan', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error checking new project pending scan:', error)
      return false
    }

    return data === true
  }

  // Count PDF pages
  const countPdfPages = async (file: File): Promise<number> => {
    try {
      // Use a simple approach - load the PDF and count pages
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Simple PDF page count - look for /Type /Page entries
      const text = new TextDecoder().decode(uint8Array)
      const pageMatches = text.match(/\/Type[\s]*\/Page[^s]/g)
      
      return pageMatches ? pageMatches.length : 1
    } catch (error) {
      console.error('Error counting PDF pages:', error)
      return 1
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]

    // Validate file type
    if (file.type !== 'application/pdf') {
      setErrorMessage('Please upload a PDF file')
      setStage('error')
      return
    }

    // Validate file size (10MB max)
    const maxSizeMB = 10
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMessage(`File size must be less than ${maxSizeMB}MB`)
      setStage('error')
      return
    }

    // Check for pending scan
    const hasPending = await checkPendingScan()
    if (hasPending) {
      setErrorMessage(
        mode === 'existing_project'
          ? 'This project already has a pending scan. Please complete or cancel the existing scan before uploading another.'
          : 'You already have a new-project scan in progress. Please complete or cancel it before uploading another.'
      )
      setStage('error')
      return
    }

    setSelectedFile(file)
    setErrorMessage('')

    // Count pages
    const pageCount = await countPdfPages(file)
    setPdfPageCount(pageCount)

    // If more than 3 pages, show page selection
    if (pageCount > 3) {
      setSelectedPages([1, 2, 3]) // Default to first 3 pages
      setStage('page-selection')
    } else {
      // Auto-select all pages if 3 or fewer
      setSelectedPages(Array.from({ length: pageCount }, (_, i) => i + 1))
    }
  }, [mode, projectId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: stage !== 'select',
  })

  const handlePageToggle = (pageNum: number) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNum)) {
        return prev.filter(p => p !== pageNum)
      } else {
        // Limit to 3 pages max
        if (prev.length >= 3) {
          toast.error('Maximum 3 pages allowed')
          return prev
        }
        return [...prev, pageNum].sort((a, b) => a - b)
      }
    })
  }

  const handleProceedWithPages = () => {
    if (selectedPages.length < 2) {
      toast.error('Please select at least 2 pages')
      return
    }
    if (selectedPages.length > 3) {
      toast.error('Please select no more than 3 pages')
      return
    }
    handleUpload()
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setStage('uploading')
      setUploadProgress(0)

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        throw new Error('User not authenticated')
      }

      // Generate unique file path
      const timestamp = Date.now()
      const fileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const pathSegment = projectId ?? 'new-project'
      const filePath = `${userId}/${pathSegment}/${timestamp}_${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mapping-sheet-scans')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      setUploadProgress(50)

      // Create scan record
      const { data: scanData, error: scanError } = await supabase
        .from('mapping_sheet_scans')
        .insert({
          project_id: projectId,
          uploaded_by: userId,
          file_url: uploadData.path,
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          status: 'pending',
          upload_mode: mode, // 'existing_project' or 'new_project'
          notes: pdfPageCount > 3
            ? `Selected pages: ${selectedPages.join(', ')} of ${pdfPageCount} total pages`
            : null,
        })
        .select('id')
        .single()

      if (scanError) {
        throw scanError
      }

      setUploadProgress(75)
      setScanId(scanData.id)

      // Create scraper job
      const jobType = 'mapping_sheet_scan' // Always use the same job type

      const jobPayload: Record<string, any> = {
        scanId: scanData.id,
        fileUrl: uploadData.path,
        fileName: selectedFile.name,
        selectedPages,
      }

      if (scanData.project_id) {
        jobPayload.projectId = scanData.project_id
      }

      const { error: jobError } = await supabase.from('scraper_jobs').insert({
        job_type: jobType,
        status: 'queued',
        priority: 5, // Normal priority (scale: 1-10, higher = more important)
        created_by: userId, // Important for RLS policies
        payload: jobPayload,
        run_at: new Date().toISOString(),
        max_attempts: 3,
        attempts: 0,
        progress_completed: 0,
        progress_total: selectedPages.length,
      })

      if (jobError) {
        throw jobError
      }

      setUploadProgress(100)
      setStage('processing')

      // Start polling for completion
      pollScanStatus(scanData.id)
    } catch (error) {
      console.error('Upload error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
      setStage('error')
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const pollScanStatus = async (scanId: string) => {
    const pollInterval = 2000 // Poll every 2 seconds
    const maxPolls = 150 // 5 minutes max (150 * 2s)
    let pollCount = 0

    const poll = async () => {
      pollCount++

      const { data, error } = await supabase
        .from('mapping_sheet_scans')
        .select('status, error_message')
        .eq('id', scanId)
        .single()

      if (error) {
        console.error('Polling error:', error)
        setErrorMessage('Failed to check scan status')
        setStage('error')
        return
      }

      // Update progress based on status
      if (data.status === 'processing') {
        setProcessingProgress(Math.min(50 + pollCount * 2, 90))
      }

      if (data.status === 'completed' || data.status === 'under_review' || data.status === 'review_new_project') {
        setProcessingProgress(100)
        setStage('complete')
        toast.success('Scan completed!', {
          description: 'Review the extracted data to confirm import',
        })
        return
      }

      if (data.status === 'failed') {
        setErrorMessage(data.error_message || 'Scan processing failed')
        setStage('error')
        toast.error('Scan failed', {
          description: data.error_message,
        })
        return
      }

      // Continue polling
      if (pollCount < maxPolls) {
        setTimeout(poll, pollInterval)
      } else {
        setErrorMessage('Scan is taking longer than expected. Please check back later.')
        setStage('error')
      }
    }

    poll()
  }

  const handleViewResults = () => {
    if (!scanId) return
    onScanReady(scanId, projectId)
    onOpenChange(false)
  }

  const handleReset = () => {
    setStage('select')
    setSelectedFile(null)
    setUploadProgress(0)
    setProcessingProgress(0)
    setErrorMessage('')
    setScanId('')
    setPdfPageCount(0)
    setSelectedPages([])
  }

  const handleCancel = () => {
    if (stage === 'processing') {
      // Don't close during processing
      toast.info('Processing in progress', {
        description: 'You can close this and check back later',
      })
      return
    }
    handleReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {mode === 'existing_project' ? 'Upload Scanned Mapping Sheet' : 'Upload Scanned Project Data'}
          </DialogTitle>
          <DialogDescription>
            Upload a PDF scan of a handwritten mapping sheet for {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stage: Select File */}
          {stage === 'select' && (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      Choose different file
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">
                      {isDragActive
                        ? 'Drop PDF file here'
                        : 'Drag & drop PDF file here, or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Maximum 3 pages • 10MB limit
                    </p>
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Tips for best results:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Ensure handwriting is clear and legible</li>
                    <li>Scan in color at 300 DPI or higher</li>
                    <li>Avoid shadows and ensure good lighting</li>
                    <li>Include all pages (up to 3 pages supported)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Stage: Page Selection */}
          {stage === 'page-selection' && (
            <div className="space-y-4">
              <Alert>
                <FileCheck className="h-4 w-4" />
                <AlertDescription>
                  <strong>Your PDF has {pdfPageCount} pages.</strong>
                  <br />
                  Please select 2-3 pages that contain the mapping sheet for this project.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 bg-gray-50">
                <Label className="text-sm font-medium mb-3 block">
                  Select Pages ({selectedPages.length}/3 selected)
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: pdfPageCount }, (_, i) => i + 1).map((pageNum) => (
                    <div
                      key={pageNum}
                      className={`flex items-center space-x-2 p-3 border rounded cursor-pointer transition-colors ${
                        selectedPages.includes(pageNum)
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => handlePageToggle(pageNum)}
                    >
                      <Checkbox
                        checked={selectedPages.includes(pageNum)}
                        onCheckedChange={() => handlePageToggle(pageNum)}
                      />
                      <Label className="cursor-pointer flex-1">
                        Page {pageNum}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Alert variant={selectedPages.length >= 2 && selectedPages.length <= 3 ? 'default' : 'destructive'}>
                <AlertDescription className="text-sm">
                  {selectedPages.length === 0 && 'Please select at least 2 pages'}
                  {selectedPages.length === 1 && 'Please select at least 1 more page'}
                  {selectedPages.length >= 2 && selectedPages.length <= 3 && `✓ ${selectedPages.length} pages selected: ${selectedPages.join(', ')}`}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Stage: Uploading */}
          {stage === 'uploading' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Uploading file...</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-gray-500">{uploadProgress}% complete</p>
            </div>
          )}

          {/* Stage: Processing */}
          {stage === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">AI is analyzing your document...</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
              <div className="space-y-2 text-xs text-gray-600">
                <p>✓ PDF uploaded successfully</p>
                <p>✓ Focusing on pages {selectedPages.join(', ')}</p>
                <p>⏳ Extracting handwritten data with AI</p>
                <p className="text-gray-400">This may take 30-60 seconds...</p>
              </div>
              <Alert>
                <AlertDescription className="text-sm">
                  You can close this dialog and the processing will continue in the background.
                  You'll be notified when it's ready for review.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Stage: Complete */}
          {stage === 'complete' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Scan completed successfully!</span>
              </div>
              <Alert>
                <AlertDescription>
                  The mapping sheet has been analyzed. Please review the extracted data and
                  confirm any employer matches before importing.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Stage: Error */}
          {stage === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {stage === 'select' && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}

          {stage === 'page-selection' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button 
                onClick={handleProceedWithPages}
                disabled={selectedPages.length < 2 || selectedPages.length > 3}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Selected Pages
              </Button>
            </>
          )}

          {stage === 'uploading' && (
            <Button variant="outline" disabled>
              Uploading...
            </Button>
          )}

          {stage === 'processing' && (
            <Button variant="outline" onClick={handleCancel}>
              Close (processing continues)
            </Button>
          )}

          {stage === 'complete' && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Close
              </Button>
              <Button onClick={handleViewResults}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {mode === 'existing_project' ? 'Review Results' : 'Review Extracted Data'}
              </Button>
            </>
          )}

          {stage === 'error' && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleReset}>Try Again</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}