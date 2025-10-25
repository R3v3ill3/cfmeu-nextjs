'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useBulkUpload } from '@/contexts/BulkUploadContext'
import { SavedProgress } from '@/contexts/BulkUploadContext'

/**
 * Custom hook for managing progress persistence and recovery
 * Handles auto-save, recovery dialog, and progress restoration
 */
export function useProgressPersistence() {
  const { state, dispatch, resetState } = useBulkUpload()

  // Configuration
  const PROGRESS_STORAGE_KEY = 'bulk_upload_progress'
  const AUTO_SAVE_INTERVAL = 30000 // 30 seconds
  const MAX_PROGRESS_AGE = 24 * 60 * 60 * 1000 // 24 hours

  // Refs for cleanup
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Save current progress to sessionStorage
  const saveProgress = useCallback(() => {
    if (!state.file || state.step === 'upload' || state.step === 'complete') {
      return
    }

    try {
      const progress: SavedProgress = {
        step: state.step,
        file: {
          name: state.file.name,
          size: state.file.size,
          lastModified: state.file.lastModified,
        },
        totalPages: state.totalPages,
        projectDefinitions: state.projectDefinitions,
        batchId: state.batchId,
        batchUploaderId: state.batchUploaderId,
        useAI: state.useAI,
        aiAnalysis: state.aiAnalysis,
        selectedProjects: state.selectedProjects,
        timestamp: Date.now(),
      }

      // Validate progress data before saving
      if (!progress.file || progress.totalPages === 0 || progress.projectDefinitions.length === 0) {
        console.warn('[progress-persistence] Invalid progress data, skipping save')
        return
      }

      sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
      console.log('[progress-persistence] Progress saved successfully')
    } catch (error) {
      console.warn('[progress-persistence] Failed to save progress:', error)

      // Clear corrupted data
      try {
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
      } catch (clearError) {
        console.warn('[progress-persistence] Failed to clear corrupted data:', clearError)
      }
    }
  }, [
    state.file,
    state.step,
    state.totalPages,
    state.projectDefinitions,
    state.batchId,
    state.batchUploaderId,
    state.useAI,
    state.aiAnalysis,
    state.selectedProjects,
  ])

  // Load saved progress from sessionStorage
  const loadSavedProgress = useCallback((): SavedProgress | null => {
    try {
      const saved = sessionStorage.getItem(PROGRESS_STORAGE_KEY)
      if (!saved) {
        console.log('[progress-persistence] No saved progress found')
        return null
      }

      const progress = JSON.parse(saved) as SavedProgress

      // Validate progress structure
      if (!progress || typeof progress !== 'object') {
        console.warn('[progress-persistence] Invalid progress structure')
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
        return null
      }

      // Check if progress is recent
      const hoursSince = Date.now() - progress.timestamp
      if (hoursSince > MAX_PROGRESS_AGE) {
        console.log('[progress-persistence] Progress expired, removing')
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
        return null
      }

      // Additional validation
      if (!progress.file || !progress.step || !Array.isArray(progress.projectDefinitions)) {
        console.warn('[progress-persistence] Invalid progress data')
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
        return null
      }

      console.log('[progress-persistence] Progress loaded successfully')
      return progress
    } catch (error) {
      console.warn('[progress-persistence] Failed to load saved progress:', error)

      // Clear corrupted data
      try {
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
      } catch (clearError) {
        console.warn('[progress-persistence] Failed to clear corrupted data:', clearError)
      }

      return null
    }
  }, [])

  // Clear saved progress
  const clearSavedProgress = useCallback(() => {
    try {
      sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
      console.log('[progress-persistence] Progress cleared successfully')
    } catch (error) {
      console.warn('[progress-persistence] Failed to clear saved progress:', error)
    }
  }, [])

  // Restore progress from saved data
  const restoreProgress = useCallback(async (progress: SavedProgress) => {
    try {
      console.log('[progress-persistence] Restoring progress...')

      // Restore file information (note: actual file needs re-upload)
      if (progress.file) {
        toast.info('Please re-upload your PDF file to restore progress')
        dispatch({ type: 'SET_STEP', payload: 'upload' })
        dispatch({ type: 'SET_USE_AI', payload: progress.useAI })

        // Store progress for when file is re-uploaded
        dispatch({ type: 'SET_SAVED_PROGRESS', payload: progress })

        return
      }

      // Restore other state
      const restoredState: Partial<SavedProgress> = {
        step: progress.step,
        totalPages: progress.totalPages,
        projectDefinitions: progress.projectDefinitions,
        batchId: progress.batchId,
        batchUploaderId: progress.batchUploaderId,
        useAI: progress.useAI,
        aiAnalysis: progress.aiAnalysis,
        selectedProjects: progress.selectedProjects,
      }

      dispatch({ type: 'RESTORE_PROGRESS', payload: restoredState })

      toast.success('Progress restored successfully')
      console.log('[progress-persistence] Progress restored successfully')
    } catch (error) {
      console.error('[progress-persistence] Failed to restore progress:', error)
      toast.error('Failed to restore progress')
    }
  }, [dispatch])

  // Handle recovery dialog response
  const handleRestoreProgress = useCallback(() => {
    if (state.savedProgress) {
      restoreProgress(state.savedProgress)
    }
    dispatch({ type: 'SET_SHOW_RECOVERY_DIALOG', payload: false })
  }, [state.savedProgress, restoreProgress, dispatch])

  const handleStartFresh = useCallback(() => {
    clearSavedProgress()
    dispatch({ type: 'SET_SHOW_RECOVERY_DIALOG', payload: false })
    dispatch({ type: 'SET_SAVED_PROGRESS', payload: null })
    resetState()
  }, [clearSavedProgress, dispatch, resetState])

  // Check for saved progress on mount and when dialog opens
  useEffect(() => {
    if (!state.showRecoveryDialog) {
      const progress = loadSavedProgress()
      if (progress) {
        dispatch({ type: 'SET_SAVED_PROGRESS', payload: progress })
        dispatch({ type: 'SET_SHOW_RECOVERY_DIALOG', payload: true })
      }
    }
  }, [loadSavedProgress, state.showRecoveryDialog, dispatch])

  // Auto-save effect
  useEffect(() => {
    // Start auto-save when we're past the upload step and not complete
    if (state.step !== 'upload' && state.step !== 'complete' && !state.isProcessing) {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }

      autoSaveIntervalRef.current = setInterval(saveProgress, AUTO_SAVE_INTERVAL)
      console.log('[progress-persistence] Auto-save started')
    } else {
      // Stop auto-save when not needed
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
        console.log('[progress-persistence] Auto-save stopped')
      }
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }
  }, [state.step, state.isProcessing, saveProgress])

  // Save progress before completing
  useEffect(() => {
    if (state.step === 'complete') {
      // Save final state
      saveProgress()
      // Then clear it since we're done
      setTimeout(() => {
        clearSavedProgress()
      }, 5000) // Clear after 5 seconds
    }
  }, [state.step, saveProgress, clearSavedProgress])

  // Get recovery status information
  const getRecoveryStatus = useCallback(() => {
    if (!state.savedProgress) {
      return {
        hasRecoverableProgress: false,
        progressAge: null,
        projectCount: 0,
        pageInfo: null,
      }
    }

    const ageHours = (Date.now() - state.savedProgress.timestamp) / (1000 * 60 * 60)
    const isRecent = ageHours < 24

    return {
      hasRecoverableProgress: true,
      progressAge: ageHours,
      isRecent,
      projectCount: state.savedProgress.projectDefinitions.length,
      pageInfo: state.savedProgress.file ? {
        name: state.savedProgress.file.name,
        size: state.savedProgress.file.size,
        pages: state.savedProgress.totalPages,
      } : null,
    }
  }, [state.savedProgress])

  // Manual save trigger
  const manualSave = useCallback(() => {
    saveProgress()
    toast.success('Progress saved manually')
  }, [saveProgress])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
      autoSaveIntervalRef.current = null
    }
  }, [])

  return {
    // State
    showRecoveryDialog: state.showRecoveryDialog,
    savedProgress: state.savedProgress,
    step: state.step,

    // Actions
    saveProgress,
    loadSavedProgress,
    clearSavedProgress,
    restoreProgress,
    manualSave,

    // Recovery dialog handlers
    handleRestoreProgress,
    handleStartFresh,

    // Status
    getRecoveryStatus,

    // Cleanup
    cleanup,
  }
}