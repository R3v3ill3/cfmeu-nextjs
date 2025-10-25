'use client'

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { splitPdfByProjects, SplitResult } from '@/lib/pdf/splitPdfByProjects'
import { uploadSplitPdfs } from '@/lib/pdf/uploadSplitPdfs'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useBulkUpload } from '@/contexts/BulkUploadContext'

/**
 * Custom hook for handling batch upload processing
 * Manages PDF splitting, file uploads, and batch creation
 */
export function useBatchProcessing() {
  const {
    state,
    dispatch,
    announceToScreenReader,
    setError,
    setStep,
  } = useBulkUpload()

  // Refs for managing batch processing state
  const abortControllerRef = useRef<AbortController | null>(null)
  const processingRequestIdRef = useRef<string | null>(null)

  // Poll batch status with proper cancellation and error handling
  const pollBatchStatus = useCallback(async (batchId: string, maxAttempts = 150) => {
    const attempts = 0

    console.log(`[batch-processing] Starting to poll batch ${batchId} (max ${maxAttempts} attempts, ${maxAttempts * 2 / 60} minutes)`)

    while (attempts < maxAttempts) {
      // Check for cancellation
      if (abortControllerRef.current?.signal.aborted) {
        console.log('[batch-processing] Polling cancelled')
        throw new Error('Processing was cancelled')
      }

      try {
        const response = await fetch(`/api/projects/batch-upload/${batchId}/status`, {
          signal: abortControllerRef.current?.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.status}`)
        }

        const batch = await response.json()
        const completed = batch.projects_completed || 0
        const total = batch.total_scans || state.totalScans

        // Update both completed and total scans dynamically
        dispatch({ type: 'SET_COMPLETED_SCANS', payload: completed })
        dispatch({ type: 'SET_TOTAL_SCANS', payload: total })

        console.log(`[batch-processing] Poll attempt ${attempts + 1}/${maxAttempts}: ${completed}/${total} scans completed (status: ${batch.status})`)

        if (batch.status === 'completed' || batch.status === 'partial') {
          console.log(`[batch-processing] Batch processing complete: ${batch.status}`)
          return batch
        }

        if (batch.status === 'failed') {
          throw new Error(batch.error_message || 'Batch processing failed')
        }

        // Use an abortable delay
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(), 2000)

          const handleAbort = () => {
            clearTimeout(timeout)
            reject(new Error('Polling cancelled'))
          }

          abortControllerRef.current?.signal.addEventListener('abort', handleAbort, { once: true })
        })

      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[batch-processing] Polling cancelled')
          throw err
        }

        console.error('[batch-processing] Status poll error:', err)

        // If it's a network error, we can retry
        if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
          console.log('[batch-processing] Network error, will retry...')
          continue
        }

        throw err
      }
    }

    const errorMessage = `Processing timeout after ${maxAttempts * 2 / 60} minutes. ${state.completedScans}/${state.totalScans} scans completed. Check batch status page for details.`
    console.error(`[batch-processing] ${errorMessage}`)
    throw new Error(errorMessage)
  }, [dispatch, state.completedScans, state.totalScans])

  // Process the complete batch upload workflow
  const processBatchUpload = useCallback(async () => {
    if (!state.file || !state.pdfBytes) {
      toast.error('No file selected')
      return false
    }

    // Prevent duplicate processing requests
    const requestId = crypto.randomUUID()
    processingRequestIdRef.current = requestId

    // Create new abort controller for this processing session
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    try {
      dispatch({ type: 'SET_STEP', payload: 'processing' })
      dispatch({ type: 'SET_IS_PROCESSING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })
      dispatch({ type: 'SET_IS_CANCELLING', payload: false })
      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 0 })

      announceToScreenReader('Processing started. This will take several minutes as we process all the mapping sheets.')

      // Filter out skipped projects before processing
      const activeProjectDefinitions = state.projectDefinitions.filter((def) => def.mode !== 'skip')

      if (activeProjectDefinitions.length === 0) {
        throw new Error('No projects selected for processing')
      }

      // Step 1: Initialize batch upload (upload original PDF)
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Uploading original PDF...' })
      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 10 })

      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('totalPages', state.totalPages.toString())
      formData.append('requestId', requestId)

      const initResponse = await fetch('/api/projects/batch-upload/init', {
        method: 'POST',
        body: formData,
        signal,
        headers: {
          'X-Request-ID': requestId,
        },
      })

      // Check if this is still the current request
      if (processingRequestIdRef.current !== requestId) {
        console.log('Batch processing cancelled - newer request started')
        return false
      }

      if (!initResponse.ok) {
        const errorData = await initResponse.json().catch(() => ({ error: 'Failed to initialize batch upload' }))
        throw new Error(errorData.error || 'Failed to initialize batch upload')
      }

      const initData = await initResponse.json()
      const uploadedBatchId = initData.batchId
      const uploaderIdFromInit: string | undefined = initData.uploaderId

      dispatch({ type: 'SET_BATCH_ID', payload: uploadedBatchId })
      if (uploaderIdFromInit) {
        dispatch({ type: 'SET_BATCH_UPLOADER_ID', payload: uploaderIdFromInit })
      }

      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 25 })

      // Step 2: Split PDFs client-side
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Splitting PDF by projects...' })

      // Check for cancellation before heavy processing
      if (signal.aborted) {
        throw new Error('Processing was cancelled')
      }

      const definitions = activeProjectDefinitions.map((def, index) => ({
        startPage: def.startPage,
        endPage: def.endPage,
        tentativeName: def.tentativeName || `Project ${index + 1}`,
        mode: def.mode === 'match' ? 'existing_project' : 'new_project',
        projectId: def.projectId,
      }))

      const splitResults: SplitResult[] = await splitPdfByProjects(state.pdfBytes, definitions)

      // Check for cancellation after splitting
      if (signal.aborted) {
        throw new Error('Processing was cancelled')
      }

      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 50 })

      // Step 3: Upload split PDFs
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Uploading split PDFs...' })

      let effectiveUploaderId = uploaderIdFromInit || state.batchUploaderId
      if (!effectiveUploaderId) {
        const supabase = getSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('User not authenticated')
        }
        effectiveUploaderId = user.id
        dispatch({ type: 'SET_BATCH_UPLOADER_ID', payload: user.id })
      }

      const uploadedScans = await uploadSplitPdfs(
        uploadedBatchId,
        effectiveUploaderId,
        splitResults,
        signal
      )

      // Check for cancellation after uploads
      if (signal.aborted) {
        throw new Error('Processing was cancelled')
      }

      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 75 })

      // Step 4: Create batch and scan records
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Creating batch records...' })

      const processResponse = await fetch('/api/projects/batch-upload/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({
          batchId: uploadedBatchId,
          originalFileUrl: initData.fileUrl,
          originalFileName: initData.fileName,
          originalFileSize: initData.fileSize,
          totalPages: initData.totalPages,
          projectDefinitions: definitions,
          uploadedScans,
        }),
        signal,
      })

      // Check if this is still the current request
      if (processingRequestIdRef.current !== requestId) {
        console.log('Batch processing cancelled - newer request started')
        return false
      }

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({ error: 'Failed to process batch upload' }))
        throw new Error(errorData.error || 'Failed to process batch upload')
      }

      const processData = await processResponse.json()
      dispatch({ type: 'SET_TOTAL_SCANS', payload: processData.scanIds.length })

      // Update batchId with the actual database record ID from RPC
      const actualBatchId = processData.batchId
      dispatch({ type: 'SET_BATCH_ID', payload: actualBatchId })
      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 90 })

      // Step 5: Poll for completion
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Processing scans...' })
      await pollBatchStatus(actualBatchId)

      // Check for cancellation after polling
      if (signal.aborted) {
        throw new Error('Processing was cancelled')
      }

      // Success!
      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 100 })
      dispatch({ type: 'SET_STEP', payload: 'complete' })

      announceToScreenReader(
        `Upload complete! Successfully processed ${state.totalScans} mapping sheet${state.totalScans !== 1 ? 's' : ''}.`
      )

      toast.success('Batch upload completed successfully!')
      return true

    } catch (error) {
      // Check if this is still the current request
      if (processingRequestIdRef.current !== requestId) {
        console.log('Batch processing error ignored - newer request started')
        return false
      }

      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Batch processing was cancelled')
        return false
      }

      console.error('Batch upload error:', error)

      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setError(errorMessage)
      toast.error('Batch upload failed')

      return false
    } finally {
      // Check if this is still the current request
      if (processingRequestIdRef.current === requestId) {
        dispatch({ type: 'SET_IS_PROCESSING', payload: false })
        processingRequestIdRef.current = null
      }
    }
  }, [
    state.file,
    state.pdfBytes,
    state.totalPages,
    state.projectDefinitions,
    state.batchUploaderId,
    state.totalScans,
    dispatch,
    announceToScreenReader,
    setError,
    setStep,
    pollBatchStatus,
  ])

  // Cancel ongoing batch processing
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (processingRequestIdRef.current) {
      processingRequestIdRef.current = null
    }

    dispatch({ type: 'SET_IS_PROCESSING', payload: false })
    dispatch({ type: 'SET_IS_CANCELLING', payload: false })
    dispatch({ type: 'SET_STEP', payload: 'define' })

    toast.info('Processing cancelled')
  }, [dispatch])

  // Retry batch processing
  const retryProcessing = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: null })
    await processBatchUpload()
  }, [processBatchUpload, dispatch])

  // Get processing status information
  const getProcessingStatus = useCallback(() => {
    return {
      isProcessing: state.isProcessing,
      step: state.step,
      progress: state.uploadProgress,
      status: state.processingStatus,
      completedScans: state.completedScans,
      totalScans: state.totalScans,
      error: state.error,
      batchId: state.batchId,
      isCancelling: state.isCancelling,
    }
  }, [
    state.isProcessing,
    state.step,
    state.uploadProgress,
    state.processingStatus,
    state.completedScans,
    state.totalScans,
    state.error,
    state.batchId,
    state.isCancelling,
  ])

  // Check if processing can be retried
  const canRetryProcessing = useCallback((): boolean => {
    return (
      state.error !== null &&
      state.step === 'processing' &&
      !state.isProcessing &&
      state.file !== null
    )
  }, [state.error, state.step, state.isProcessing, state.file])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    processingRequestIdRef.current = null
  }, [])

  return {
    // State
    isProcessing: state.isProcessing,
    step: state.step,
    progress: state.uploadProgress,
    status: state.processingStatus,
    completedScans: state.completedScans,
    totalScans: state.totalScans,
    error: state.error,
    batchId: state.batchId,
    isCancelling: state.isCancelling,

    // Actions
    processBatchUpload,
    cancelProcessing,
    retryProcessing,

    // Status information
    getProcessingStatus,
    canRetryProcessing,

    // Cleanup
    cleanup,
  }
}