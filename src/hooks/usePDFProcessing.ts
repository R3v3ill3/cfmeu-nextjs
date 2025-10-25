'use client'

import { useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'
import { useBulkUpload } from '@/contexts/BulkUploadContext'

/**
 * Custom hook for handling PDF file upload and processing
 * Manages file validation, PDF parsing, and page counting
 */
export function usePDFProcessing() {
  const { state, setFile, setPdfBytes, setTotalPages, setError } = useBulkUpload()

  // Refs for cleanup and memory management
  const abortControllerRef = useRef<AbortController | null>(null)

  // Process uploaded file and extract PDF information
  const processFile = useCallback(async (file: File) => {
    // Create new abort controller for this processing
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    try {
      setError(null)

      // Validate file type
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        setError('Please upload a PDF file')
        return false
      }

      // Check file size (limit to 100MB to prevent memory issues)
      const maxSize = 100 * 1024 * 1024 // 100MB
      if (file.size > maxSize) {
        toast.error('PDF file is too large. Maximum size is 100MB.')
        setError('PDF file is too large. Maximum size is 100MB.')
        return false
      }

      setFile(file)

      // Read and parse PDF
      const arrayBuffer = await file.arrayBuffer()

      // Check for abort signal
      if (signal.aborted) {
        throw new Error('File processing was cancelled')
      }

      const bytes = new Uint8Array(arrayBuffer)
      setPdfBytes(bytes)

      // Load PDF document to get page count
      const pdfDoc = await PDFDocument.load(bytes)

      // Check for abort signal again
      if (signal.aborted) {
        throw new Error('File processing was cancelled')
      }

      const pageCount = pdfDoc.getPageCount()

      // Validate page count
      if (pageCount === 0) {
        throw new Error('PDF appears to be empty or corrupted')
      }

      if (pageCount > 1000) {
        toast.warning('This PDF contains a large number of pages. Processing may take some time.')
      }

      setTotalPages(pageCount)

      toast.success(`PDF loaded: ${pageCount} page${pageCount !== 1 ? 's' : ''}`)
      return true

    } catch (error) {
      console.error('Failed to process PDF:', error)

      const errorMessage = error instanceof Error ? error.message : 'Failed to read PDF file'
      toast.error(errorMessage)
      setError(errorMessage)

      // Reset state on error
      setFile(null)
      setPdfBytes(null)
      setTotalPages(0)

      return false
    }
  }, [setFile, setPdfBytes, setTotalPages, setError])

  // Handle file drop from react-dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0]
    if (!uploadedFile) return

    await processFile(uploadedFile)
  }, [processFile])

  // Configure dropzone
  const dropzoneConfig = {
    onDrop,
    accept: { 'application/pdf': ['.pdf'] } as const,
    maxFiles: 1,
    disabled: state.isProcessing,
    multiple: false,
  }

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone(dropzoneConfig)

  // Handle file rejection
  const handleFileRejection = useCallback(() => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0]
      const error = rejection.errors[0]

      let errorMessage = 'Invalid file'
      if (error.code === 'file-too-large') {
        errorMessage = 'File is too large. Maximum size is 100MB.'
      } else if (error.code === 'file-invalid-type') {
        errorMessage = 'Only PDF files are supported.'
      }

      toast.error(errorMessage)
      setError(errorMessage)
    }
  }, [fileRejections, setError])

  // Handle file rejection
  if (fileRejections.length > 0) {
    handleFileRejection()
  }

  // Manual file upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    return await processFile(file)
  }, [processFile])

  // Clear uploaded file
  const clearFile = useCallback(() => {
    // Cancel any ongoing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setFile(null)
    setPdfBytes(null)
    setTotalPages(0)
    setError(null)
  }, [setFile, setPdfBytes, setTotalPages, setError])

  // Validate current file
  const validateCurrentFile = useCallback((): boolean => {
    if (!state.file) {
      setError('No file selected')
      return false
    }

    if (!state.pdfBytes) {
      setError('PDF not properly loaded')
      return false
    }

    if (state.totalPages === 0) {
      setError('PDF has no pages')
      return false
    }

    return true
  }, [state.file, state.pdfBytes, state.totalPages, setError])

  // Get file information for display
  const fileInfo = state.file ? {
    name: state.file.name,
    size: state.file.size,
    sizeFormatted: formatFileSize(state.file.size),
    lastModified: state.file.lastModified,
    lastModifiedFormatted: formatDate(state.file.lastModified),
  } : null

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return {
    // State
    file: state.file,
    pdfBytes: state.pdfBytes,
    totalPages: state.totalPages,
    isProcessing: state.isProcessing,

    // Dropzone
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,

    // Actions
    handleFileUpload,
    clearFile,
    validateCurrentFile,

    // Computed values
    fileInfo,

    // Cleanup
    cleanup,
  }
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}