"use client"

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type WizardPhase = 'project-selection' | 'action-menu'
export type WizardView = 
  | 'contacts' 
  | 'mapping' 
  | 'ratings' 
  | 'eba' 
  | 'incolink' 
  | 'project-details' 
  | null

export interface SelectedProject {
  id: string
  name: string
  address?: string | null
  builderName?: string | null
  mainJobSiteId?: string | null
}

export interface WizardState {
  phase: WizardPhase
  view: WizardView
  selectedProject: SelectedProject | null
  showSiteVisitDialog: boolean
  siteVisitDialogMode: 'entry' | 'exit'
}

export interface UseWizardStateReturn {
  state: WizardState
  // Phase navigation
  goToProjectSelection: () => void
  goToActionMenu: (project: SelectedProject) => void
  // View navigation
  openView: (view: WizardView) => void
  closeView: () => void
  // Site visit dialog
  showEntryDialog: () => void
  showExitDialog: () => void
  closeSiteVisitDialog: () => void
  // Project
  selectProject: (project: SelectedProject) => void
  clearProject: () => void
  // Utils
  canGoBack: boolean
  goBack: () => void
}

const DEFAULT_STATE: WizardState = {
  phase: 'project-selection',
  view: null,
  selectedProject: null,
  showSiteVisitDialog: false,
  siteVisitDialogMode: 'entry',
}

export function useWizardState(): UseWizardStateReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Parse initial state from URL params
  const initialState = useMemo((): WizardState => {
    const phase = searchParams.get('phase') as WizardPhase || 'project-selection'
    const view = searchParams.get('view') as WizardView || null
    const projectId = searchParams.get('projectId')
    const projectName = searchParams.get('projectName')
    
    return {
      phase,
      view,
      selectedProject: projectId && projectName ? {
        id: projectId,
        name: decodeURIComponent(projectName),
        address: searchParams.get('projectAddress') ? decodeURIComponent(searchParams.get('projectAddress')!) : null,
        builderName: searchParams.get('builderName') ? decodeURIComponent(searchParams.get('builderName')!) : null,
        mainJobSiteId: searchParams.get('mainJobSiteId') || null,
      } : null,
      showSiteVisitDialog: false,
      siteVisitDialogMode: 'entry',
    }
  }, [searchParams])
  
  const [state, setState] = useState<WizardState>(initialState)
  
  // Update URL to reflect current state (for deep linking)
  const updateUrl = useCallback((newState: Partial<WizardState>) => {
    const params = new URLSearchParams()
    
    const merged = { ...state, ...newState }
    
    if (merged.phase !== 'project-selection') {
      params.set('phase', merged.phase)
    }
    if (merged.view) {
      params.set('view', merged.view)
    }
    if (merged.selectedProject) {
      params.set('projectId', merged.selectedProject.id)
      params.set('projectName', encodeURIComponent(merged.selectedProject.name))
      if (merged.selectedProject.address) {
        params.set('projectAddress', encodeURIComponent(merged.selectedProject.address))
      }
      if (merged.selectedProject.builderName) {
        params.set('builderName', encodeURIComponent(merged.selectedProject.builderName))
      }
      if (merged.selectedProject.mainJobSiteId) {
        params.set('mainJobSiteId', merged.selectedProject.mainJobSiteId)
      }
    }
    
    const queryString = params.toString()
    router.replace(`/site-visit-wizard${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [router, state])
  
  // Phase navigation
  const goToProjectSelection = useCallback(() => {
    const newState = {
      phase: 'project-selection' as const,
      view: null as WizardView,
      selectedProject: null,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const goToActionMenu = useCallback((project: SelectedProject) => {
    const newState = {
      phase: 'action-menu' as const,
      view: null as WizardView,
      selectedProject: project,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  // View navigation
  const openView = useCallback((view: WizardView) => {
    setState(prev => ({ ...prev, view }))
    updateUrl({ view })
  }, [updateUrl])
  
  const closeView = useCallback(() => {
    setState(prev => ({ ...prev, view: null }))
    updateUrl({ view: null })
  }, [updateUrl])
  
  // Site visit dialog
  const showEntryDialog = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showSiteVisitDialog: true, 
      siteVisitDialogMode: 'entry' 
    }))
  }, [])
  
  const showExitDialog = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showSiteVisitDialog: true, 
      siteVisitDialogMode: 'exit' 
    }))
  }, [])
  
  const closeSiteVisitDialog = useCallback(() => {
    setState(prev => ({ ...prev, showSiteVisitDialog: false }))
  }, [])
  
  // Project selection
  const selectProject = useCallback((project: SelectedProject) => {
    setState(prev => ({ ...prev, selectedProject: project }))
  }, [])
  
  const clearProject = useCallback(() => {
    setState(prev => ({ ...prev, selectedProject: null }))
  }, [])
  
  // Back navigation
  const canGoBack = useMemo(() => {
    if (state.view !== null) return true
    if (state.phase === 'action-menu') return true
    return false
  }, [state.view, state.phase])
  
  const goBack = useCallback(() => {
    if (state.view !== null) {
      closeView()
    } else if (state.phase === 'action-menu') {
      // Show exit dialog when leaving action menu
      showExitDialog()
    }
  }, [state.view, state.phase, closeView, showExitDialog])
  
  return {
    state,
    goToProjectSelection,
    goToActionMenu,
    openView,
    closeView,
    showEntryDialog,
    showExitDialog,
    closeSiteVisitDialog,
    selectProject,
    clearProject,
    canGoBack,
    goBack,
  }
}

