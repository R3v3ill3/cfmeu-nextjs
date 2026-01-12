"use client"

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type WizardPhase = 
  | 'project-selection' 
  | 'action-menu'
  // Add project flow phases
  | 'add-project-options'
  | 'bci-import'
  | 'bci-project-select'
  | 'bci-importing'
  | 'manual-create'

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

// BCI import data types
export interface BCINormalizedProject {
  projectId: string
  projectName: string
  projectStage: string
  projectStatus?: string
  localValue?: number
  projectAddress?: string
  projectTown?: string
  projectState?: string
  postCode?: string
  latitude?: number
  longitude?: number
}

export interface BCINormalizedCompany {
  projectId: string
  companyId?: string
  companyName: string
  roleOnProject: string
}

export interface BCIImportData {
  projects: BCINormalizedProject[]
  companies: BCINormalizedCompany[]
  selectedProjectId?: string
}

export interface WizardState {
  phase: WizardPhase
  view: WizardView
  selectedProject: SelectedProject | null
  showSiteVisitDialog: boolean
  siteVisitDialogMode: 'entry' | 'exit'
  // Track which views have been visited for pre-selecting reasons
  visitedViews: Set<WizardView>
  // BCI import data
  bciImportData: BCIImportData | null
}

export interface UseWizardStateReturn {
  state: WizardState
  // Phase navigation
  goToProjectSelection: () => void
  goToActionMenu: (project: SelectedProject) => void
  // Add project flow navigation
  goToAddProjectOptions: () => void
  goToBCIImport: () => void
  goToBCIProjectSelect: (data: BCIImportData) => void
  goToBCIImporting: (selectedProjectId: string) => void
  goToManualCreate: () => void
  // View navigation
  openView: (view: WizardView) => void
  closeView: () => void
  // Site visit dialog
  showExitDialog: () => void
  closeSiteVisitDialog: () => void
  // Project
  selectProject: (project: SelectedProject) => void
  clearProject: () => void
  // BCI data
  setBCIImportData: (data: BCIImportData | null) => void
  // Utils
  canGoBack: boolean
  goBack: () => void
  // Get pre-selected reason names based on visited views
  getPreSelectedReasonNames: () => string[]
}

const DEFAULT_STATE: WizardState = {
  phase: 'project-selection',
  view: null,
  selectedProject: null,
  showSiteVisitDialog: false,
  siteVisitDialogMode: 'exit', // Only exit mode now
  visitedViews: new Set(),
  bciImportData: null,
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
      siteVisitDialogMode: 'exit',
      visitedViews: new Set(),
      bciImportData: null,
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
      visitedViews: new Set() as Set<WizardView>,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const goToActionMenu = useCallback((project: SelectedProject) => {
    const newState = {
      phase: 'action-menu' as const,
      view: null as WizardView,
      selectedProject: project,
      bciImportData: null, // Clear BCI data when navigating to action menu
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  // Add project flow navigation
  const goToAddProjectOptions = useCallback(() => {
    const newState = {
      phase: 'add-project-options' as const,
      view: null as WizardView,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const goToBCIImport = useCallback(() => {
    const newState = {
      phase: 'bci-import' as const,
      view: null as WizardView,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const goToBCIProjectSelect = useCallback((data: BCIImportData) => {
    const newState = {
      phase: 'bci-project-select' as const,
      view: null as WizardView,
      bciImportData: data,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const goToBCIImporting = useCallback((selectedProjectId: string) => {
    setState(prev => ({
      ...prev,
      phase: 'bci-importing' as const,
      view: null as WizardView,
      bciImportData: prev.bciImportData ? {
        ...prev.bciImportData,
        selectedProjectId,
      } : null,
    }))
    updateUrl({ phase: 'bci-importing' as const, view: null })
  }, [updateUrl])
  
  const goToManualCreate = useCallback(() => {
    const newState = {
      phase: 'manual-create' as const,
      view: null as WizardView,
    }
    setState(prev => ({ ...prev, ...newState }))
    updateUrl(newState)
  }, [updateUrl])
  
  const setBCIImportData = useCallback((data: BCIImportData | null) => {
    setState(prev => ({ ...prev, bciImportData: data }))
  }, [])
  
  // View navigation - track which views are visited
  const openView = useCallback((view: WizardView) => {
    setState(prev => {
      const newVisitedViews = new Set(prev.visitedViews)
      if (view) {
        newVisitedViews.add(view)
      }
      return { ...prev, view, visitedViews: newVisitedViews }
    })
    updateUrl({ view })
  }, [updateUrl])
  
  const closeView = useCallback(() => {
    setState(prev => ({ ...prev, view: null }))
    updateUrl({ view: null })
  }, [updateUrl])
  
  // Site visit dialog - only exit mode now
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
    // New phases can go back
    if (state.phase === 'add-project-options') return true
    if (state.phase === 'bci-import') return true
    if (state.phase === 'bci-project-select') return true
    if (state.phase === 'manual-create') return true
    return false
  }, [state.view, state.phase])
  
  // Use a callback that reads current state to avoid stale closures
  const goBack = useCallback(() => {
    setState(currentState => {
      // If we're in a view, close it and return to action menu
      if (currentState.view !== null) {
        // Close the view by updating state
        const newState = { ...currentState, view: null as WizardView }
        // Update URL
        const params = new URLSearchParams()
        params.set('phase', currentState.phase)
        if (currentState.selectedProject) {
          params.set('projectId', currentState.selectedProject.id)
          params.set('projectName', encodeURIComponent(currentState.selectedProject.name))
          if (currentState.selectedProject.address) {
            params.set('projectAddress', encodeURIComponent(currentState.selectedProject.address))
          }
          if (currentState.selectedProject.builderName) {
            params.set('builderName', encodeURIComponent(currentState.selectedProject.builderName))
          }
          if (currentState.selectedProject.mainJobSiteId) {
            params.set('mainJobSiteId', currentState.selectedProject.mainJobSiteId)
          }
        }
        router.replace(`/site-visit-wizard?${params.toString()}`, { scroll: false })
        return newState
      }
      
      // If we're in action-menu phase with no view, show exit dialog
      if (currentState.phase === 'action-menu') {
        return { ...currentState, showSiteVisitDialog: true, siteVisitDialogMode: 'exit' as const }
      }
      
      // Handle back navigation for add-project flow phases
      if (currentState.phase === 'add-project-options') {
        // Go back to project selection
        router.replace('/site-visit-wizard', { scroll: false })
        return { ...currentState, phase: 'project-selection' as const }
      }
      
      if (currentState.phase === 'bci-import' || currentState.phase === 'manual-create') {
        // Go back to add-project-options
        router.replace('/site-visit-wizard?phase=add-project-options', { scroll: false })
        return { ...currentState, phase: 'add-project-options' as const }
      }
      
      if (currentState.phase === 'bci-project-select') {
        // Go back to BCI import
        router.replace('/site-visit-wizard?phase=bci-import', { scroll: false })
        return { ...currentState, phase: 'bci-import' as const, bciImportData: null }
      }
      
      return currentState
    })
  }, [router])
  
  // Get pre-selected reason names based on visited views
  const getPreSelectedReasonNames = useCallback((): string[] => {
    const reasonNames: string[] = []
    
    // If visited mapping, could add a mapping-specific reason here if one exists
    // Currently no specific mapping reason in the database
    
    // If visited ratings/compliance, pre-select "compliance_audit"
    if (state.visitedViews.has('ratings')) {
      reasonNames.push('compliance_audit')
    }
    
    // If visited any views, add general_visit as a default
    if (state.visitedViews.size > 0 && reasonNames.length === 0) {
      reasonNames.push('general_visit')
    }
    
    return reasonNames
  }, [state.visitedViews])
  
  return {
    state,
    goToProjectSelection,
    goToActionMenu,
    // Add project flow navigation
    goToAddProjectOptions,
    goToBCIImport,
    goToBCIProjectSelect,
    goToBCIImporting,
    goToManualCreate,
    openView,
    closeView,
    showExitDialog,
    closeSiteVisitDialog,
    selectProject,
    clearProject,
    setBCIImportData,
    canGoBack,
    goBack,
    getPreSelectedReasonNames,
  }
}
