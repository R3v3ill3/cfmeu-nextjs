'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useBulkUpload } from '@/contexts/BulkUploadContext'
import { ProjectDefinitionForm, Step } from '@/contexts/BulkUploadContext'

/**
 * Custom hook for managing bulk upload state and business logic
 * Handles project definition management, validation, and state transitions
 */
export function useBulkUploadState() {
  const { state, dispatch, updateProjectDefinition, removeProjectDefinition, setSelectedProject } = useBulkUpload()

  // Add new project definition
  const addProjectDefinition = useCallback(() => {
    const lastDef = state.projectDefinitions[state.projectDefinitions.length - 1]
    const newStartPage = lastDef ? lastDef.endPage + 1 : 1

    if (newStartPage > state.totalPages) {
      toast.error('All pages have been assigned')
      return
    }

    const newDefinition: ProjectDefinitionForm = {
      id: crypto.randomUUID(),
      startPage: newStartPage,
      endPage: state.totalPages,
      mode: 'new',
      tentativeName: `Section ${state.projectDefinitions.filter(def => def.mode !== 'skip').length + 1} (Pages ${newStartPage}-${state.totalPages})`,
    }

    dispatch({ type: 'ADD_PROJECT_DEFINITION', payload: newDefinition })
  }, [state.projectDefinitions, state.totalPages, dispatch])

  // Auto-segment projects (fallback when AI analysis fails)
  const autoSegmentProjects = useCallback(() => {
    const pagesPerProject = 2
    const numProjects = Math.ceil(state.totalPages / pagesPerProject)
    const definitions: ProjectDefinitionForm[] = []

    for (let i = 0; i < numProjects; i++) {
      const startPage = i * pagesPerProject + 1
      const endPage = Math.min((i + 1) * pagesPerProject, state.totalPages)

      // Create more descriptive project names using page ranges
      const projectName = numProjects === 1
        ? `Full Document (Pages ${startPage}-${endPage})`
        : `Section ${i + 1} (Pages ${startPage}-${endPage})`

      definitions.push({
        id: crypto.randomUUID(),
        startPage,
        endPage,
        mode: 'new',
        tentativeName: projectName,
      })
    }

    dispatch({ type: 'SET_PROJECT_DEFINITIONS', payload: definitions })
    dispatch({ type: 'SET_STEP', payload: 'define' })
  }, [state.totalPages, dispatch])

  // Validate project definitions before processing
  const validateDefinitions = useCallback((): boolean => {
    // Filter out skipped projects for validation
    const activeDefinitions = state.projectDefinitions.filter((def) => def.mode !== 'skip')

    if (activeDefinitions.length === 0) {
      toast.error('At least one project must be selected for processing')
      return false
    }

    for (const def of activeDefinitions) {
      if (def.startPage < 1 || def.endPage > state.totalPages) {
        toast.error(`Invalid page range: ${def.startPage}-${def.endPage}`)
        return false
      }
      if (def.startPage > def.endPage) {
        toast.error(`Start page cannot be greater than end page`)
        return false
      }
      if (def.mode === 'match' && !def.projectId) {
        toast.error(`Please select a project to match or change to "Create New"`)
        return false
      }
    }

    // Check for overlaps (only among active definitions)
    const sorted = [...activeDefinitions].sort((a, b) => a.startPage - b.startPage)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endPage >= sorted[i + 1].startPage) {
        toast.error('Page ranges cannot overlap')
        return false
      }
    }

    return true
  }, [state.projectDefinitions, state.totalPages])

  // Get active project definitions (excluding skipped ones)
  const activeProjectDefinitions = useMemo(() => {
    return state.projectDefinitions.filter((def) => def.mode !== 'skip')
  }, [state.projectDefinitions])

  // Check if can proceed to next step
  const canProceedFromUpload = useMemo(() => {
    return state.file && state.totalPages > 0
  }, [state.file, state.totalPages])

  const canProceedFromDefine = useMemo(() => {
    return validateDefinitions()
  }, [validateDefinitions])

  // Get step-specific configuration
  const stepConfig = useMemo(() => {
    return {
      canProceed: {
        upload: canProceedFromUpload,
        analyze: false, // AI analysis step doesn't have manual proceed
        define: canProceedFromDefine,
        processing: false, // Processing is automatic
        complete: false, // Complete is final step
      },
      canGoBack: {
        upload: false,
        analyze: true,
        define: true,
        processing: false,
        complete: false,
      },
    }
  }, [canProceedFromUpload, canProceedFromDefine])

  // Handle project selection from search dialog
  const handleProjectSelect = useCallback((defId: string, project: any) => {
    setSelectedProject(defId, project)
    updateProjectDefinition(defId, {
      mode: 'match',
      projectId: project.id,
    })
  }, [setSelectedProject, updateProjectDefinition])

  // Open search dialog for project matching
  const openSearchDialog = useCallback((defId: string) => {
    dispatch({ type: 'SET_SEARCHING_FOR_DEF_ID', payload: defId })
    dispatch({ type: 'SET_SEARCH_DIALOG_OPEN', payload: true })
  }, [dispatch])

  // Close search dialog
  const closeSearchDialog = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_DIALOG_OPEN', payload: false })
    dispatch({ type: 'SET_SEARCHING_FOR_DEF_ID', payload: null })
  }, [dispatch])

  // Proceed from upload step
  const proceedFromUpload = useCallback(() => {
    if (state.useAI) {
      dispatch({ type: 'SET_STEP', payload: 'analyze' })
    } else {
      autoSegmentProjects()
    }
  }, [state.useAI, autoSegmentProjects, dispatch])

  // Go back to previous step
  const goBack = useCallback(() => {
    switch (state.step) {
      case 'analyze':
        dispatch({ type: 'SET_STEP', payload: 'upload' })
        break
      case 'define':
        dispatch({ type: 'SET_STEP', payload: 'upload' })
        break
      default:
        break
    }
  }, [state.step, dispatch])

  // Get confidence badge configuration
  const getConfidenceBadge = useCallback((confidence?: number) => {
    if (!confidence) return null

    const percentage = Math.round(confidence * 100)
    const variant =
      confidence >= 0.85 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive'

    return {
      percentage,
      variant,
    }
  }, [])

  // Get project definition by ID
  const getProjectDefinition = useCallback((id: string) => {
    return state.projectDefinitions.find(def => def.id === id)
  }, [state.projectDefinitions])

  // Get selected project for a definition
  const getSelectedProject = useCallback((defId: string) => {
    return state.selectedProjects[defId]
  }, [state.selectedProjects])

  return {
    // State
    state,

    // Project management
    addProjectDefinition,
    updateProjectDefinition,
    removeProjectDefinition,
    autoSegmentProjects,

    // Validation
    validateDefinitions,
    activeProjectDefinitions,

    // Navigation
    proceedFromUpload,
    goBack,
    stepConfig,

    // Search dialog
    openSearchDialog,
    closeSearchDialog,
    handleProjectSelect,

    // Utilities
    getConfidenceBadge,
    getProjectDefinition,
    getSelectedProject,
    canProceedFromUpload,
    canProceedFromDefine,
  }
}