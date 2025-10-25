'use client'

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useBulkUpload } from '@/contexts/BulkUploadContext'
import { ProjectDefinitionForm, AnalysisResult } from '@/contexts/BulkUploadContext'

/**
 * Custom hook for handling AI-powered PDF analysis
 * Manages AI analysis requests, processing, and result handling
 */
export function useAIAnalysis() {
  const {
    state,
    dispatch,
    announceToScreenReader,
    setError,
    setStep,
    setTotalPages
  } = useBulkUpload()

  // Refs for managing AI analysis state
  const abortControllerRef = useRef<AbortController | null>(null)
  const analysisRequestIdRef = useRef<string | null>(null)

  // Perform AI analysis on uploaded PDF
  const analyzeWithAI = useCallback(async () => {
    if (!state.file) {
      toast.error('No file selected for analysis')
      return false
    }

    // Prevent duplicate requests
    const requestId = crypto.randomUUID()
    analysisRequestIdRef.current = requestId

    // Create new abort controller for this analysis
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    try {
      dispatch({ type: 'SET_STEP', payload: 'analyze' })
      dispatch({ type: 'SET_IS_PROCESSING', payload: true })
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Analyzing PDF with AI...' })
      dispatch({ type: 'SET_ERROR', payload: null })

      announceToScreenReader('Starting AI analysis. This may take 10-20 seconds.')

      // Prepare form data for API request
      const formData = new FormData()
      formData.append('file', state.file)

      // Add request ID for tracking
      formData.append('requestId', requestId)

      // Make API request with timeout and abort signal
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      // Combine abort signals
      const combinedSignal = signal.aborted ? signal : controller.signal
      if (signal.aborted) controller.abort()

      const response = await fetch('/api/projects/batch-upload/analyze', {
        method: 'POST',
        body: formData,
        signal: combinedSignal,
        headers: {
          'X-Request-ID': requestId,
        },
      })

      clearTimeout(timeoutId)

      // Check if this is still the current request
      if (analysisRequestIdRef.current !== requestId) {
        console.log('AI analysis cancelled - newer request started')
        return false
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`)
      }

      const data = await response.json()

      // Validate response data
      if (!data.analysis || !Array.isArray(data.analysis.projects)) {
        throw new Error('Invalid AI analysis response format')
      }

      // Update state with AI analysis results
      dispatch({ type: 'SET_AI_ANALYSIS', payload: data.analysis })

      // Convert AI results to project definitions
      const definitions: ProjectDefinitionForm[] = data.analysis.projects.map((p: any, index: number) => ({
        id: crypto.randomUUID(),
        startPage: p.startPage,
        endPage: p.endPage,
        mode: 'new' as const,
        tentativeName: p.projectName || `Project ${index + 1}`,
        tentativeAddress: p.projectAddress,
        confidence: p.confidence,
      }))

      dispatch({ type: 'SET_PROJECT_DEFINITIONS', payload: definitions })

      // Update page count if different from AI analysis
      if (data.analysis.totalPages && data.analysis.totalPages !== state.totalPages) {
        setTotalPages(data.analysis.totalPages)
      }

      // Show success message with cost information
      const costMessage = data.metadata?.costUsd
        ? ` (cost: $${data.metadata.costUsd})`
        : ''

      toast.success(
        `AI detected ${definitions.length} project${definitions.length !== 1 ? 's' : ''}${costMessage}`
      )

      // Move to define step
      dispatch({ type: 'SET_STEP', payload: 'define' })

      announceToScreenReader(
        `AI analysis complete. Found ${definitions.length} project${definitions.length !== 1 ? 's' : ''}. Please review and configure each project.`
      )

      return true

    } catch (error) {
      // Check if this is still the current request
      if (analysisRequestIdRef.current !== requestId) {
        console.log('AI analysis error ignored - newer request started')
        return false
      }

      console.error('AI analysis failed:', error)

      let errorMessage = 'AI analysis failed'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('AI analysis was cancelled')
          return false
        }
        errorMessage = error.message
      }

      toast.error(`${errorMessage}. Using manual mode.`)
      setError(errorMessage)

      // Fallback to manual mode
      dispatch({ type: 'SET_IS_PROCESSING', payload: false })
      dispatch({ type: 'SET_STEP', payload: 'upload' })

      return false
    } finally {
      // Check if this is still the current request
      if (analysisRequestIdRef.current === requestId) {
        dispatch({ type: 'SET_IS_PROCESSING', payload: false })
        analysisRequestIdRef.current = null
      }
    }
  }, [state.file, state.totalPages, dispatch, announceToScreenReader, setError, setStep, setTotalPages])

  // Cancel ongoing AI analysis
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (analysisRequestIdRef.current) {
      analysisRequestIdRef.current = null
    }

    dispatch({ type: 'SET_IS_PROCESSING', payload: false })
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: '' })
    toast.info('AI analysis cancelled')
  }, [dispatch])

  // Retry AI analysis
  const retryAnalysis = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: null })
    await analyzeWithAI()
  }, [analyzeWithAI, dispatch])

  // Get AI analysis status information
  const getAnalysisStatus = useCallback(() => {
    const isAnalyzing = state.step === 'analyze' && state.isProcessing
    const hasResults = state.aiAnalysis !== null
    const projectCount = state.aiAnalysis?.projects.length || 0
    const detectionMethod = state.aiAnalysis?.detectionMethod || ''
    const confidence = state.aiAnalysis?.projects.reduce((acc, p) => acc + p.confidence, 0) / projectCount || 0

    return {
      isAnalyzing,
      hasResults,
      projectCount,
      detectionMethod,
      averageConfidence: confidence,
      processingStatus: state.processingStatus,
    }
  }, [state.step, state.isProcessing, state.aiAnalysis, state.processingStatus])

  // Validate AI analysis results
  const validateAnalysisResults = useCallback((): boolean => {
    if (!state.aiAnalysis) {
      return false
    }

    const { projects, totalPages } = state.aiAnalysis

    if (!Array.isArray(projects) || projects.length === 0) {
      return false
    }

    // Check if all projects have valid page ranges
    for (const project of projects) {
      if (
        typeof project.startPage !== 'number' ||
        typeof project.endPage !== 'number' ||
        project.startPage < 1 ||
        project.endPage > totalPages ||
        project.startPage > project.endPage
      ) {
        return false
      }
    }

    return true
  }, [state.aiAnalysis])

  // Get analysis cost information
  const getAnalysisCost = useCallback(() => {
    if (!state.aiAnalysis) return null

    // This would come from the API response metadata
    return {
      estimatedCost: 0.05, // Default estimate
      actualCost: null, // Would be set from API response
      currency: 'USD',
    }
  }, [state.aiAnalysis])

  // Check if AI analysis should be retried
  const shouldRetryAnalysis = useCallback((): boolean => {
    return (
      state.error !== null &&
      state.step === 'analyze' &&
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
    analysisRequestIdRef.current = null
  }, [])

  return {
    // State
    isAnalyzing: state.step === 'analyze' && state.isProcessing,
    analysisResults: state.aiAnalysis,
    error: state.error,

    // Actions
    analyzeWithAI,
    cancelAnalysis,
    retryAnalysis,

    // Status and validation
    getAnalysisStatus,
    validateAnalysisResults,
    shouldRetryAnalysis,

    // Cost information
    getAnalysisCost,

    // Cleanup
    cleanup,
  }
}