'use client'

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react'

// Types
export type Step = 'upload' | 'analyze' | 'define' | 'processing' | 'complete'

export interface Project {
  id: string
  project_name: string
  project_address: string
  project_number: string | null
  builder: string | null
}

export interface ProjectDefinition {
  startPage: number
  endPage: number
  tentativeName?: string
  tentativeAddress?: string | null
  confidence?: number
  mode: 'new' | 'match' | 'skip'
  projectId?: string
}

export interface ProjectDefinitionForm extends ProjectDefinition {
  id: string
}

export interface AnalysisResult {
  projects: Array<{
    startPage: number
    endPage: number
    projectName: string
    projectAddress?: string | null
    confidence: number
    reasoning?: string
  }>
  totalPages: number
  detectionMethod: string
  notes?: string[]
}

export interface SavedProgress {
  step: Step
  file: {
    name: string
    size: number
    lastModified: number
  } | null
  totalPages: number
  projectDefinitions: ProjectDefinitionForm[]
  batchId: string
  batchUploaderId: string
  useAI: boolean
  aiAnalysis: AnalysisResult | null
  selectedProjects: Record<string, Project>
  timestamp: number
}

// State interface
interface BulkUploadState {
  // Core state
  step: Step
  file: File | null
  pdfBytes: Uint8Array | null
  totalPages: number

  // Project definitions
  projectDefinitions: ProjectDefinitionForm[]
  selectedProjects: Record<string, Project>

  // Processing state
  batchId: string
  batchUploaderId: string
  uploadProgress: number
  processingStatus: string
  isProcessing: boolean
  error: string | null
  completedScans: number
  totalScans: number

  // AI state
  useAI: boolean
  aiAnalysis: AnalysisResult | null

  // UI state
  searchDialogOpen: boolean
  searchingForDefId: string | null
  screenReaderAnnouncement: string

  // Progress persistence
  showRecoveryDialog: boolean
  savedProgress: SavedProgress | null
  isCancelling: boolean
}

// Action types
type BulkUploadAction =
  | { type: 'SET_STEP'; payload: Step }
  | { type: 'SET_FILE'; payload: File | null }
  | { type: 'SET_PDF_BYTES'; payload: Uint8Array | null }
  | { type: 'SET_TOTAL_PAGES'; payload: number }
  | { type: 'SET_PROJECT_DEFINITIONS'; payload: ProjectDefinitionForm[] }
  | { type: 'ADD_PROJECT_DEFINITION'; payload: ProjectDefinitionForm }
  | { type: 'UPDATE_PROJECT_DEFINITION'; payload: { id: string; updates: Partial<ProjectDefinitionForm> } }
  | { type: 'REMOVE_PROJECT_DEFINITION'; payload: string }
  | { type: 'SET_SELECTED_PROJECTS'; payload: Record<string, Project> }
  | { type: 'SET_BATCH_ID'; payload: string }
  | { type: 'SET_BATCH_UPLOADER_ID'; payload: string }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_PROCESSING_STATUS'; payload: string }
  | { type: 'SET_IS_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COMPLETED_SCANS'; payload: number }
  | { type: 'SET_TOTAL_SCANS'; payload: number }
  | { type: 'SET_USE_AI'; payload: boolean }
  | { type: 'SET_AI_ANALYSIS'; payload: AnalysisResult | null }
  | { type: 'SET_SEARCH_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_SEARCHING_FOR_DEF_ID'; payload: string | null }
  | { type: 'SET_SCREEN_READER_ANNOUNCEMENT'; payload: string }
  | { type: 'SET_SHOW_RECOVERY_DIALOG'; payload: boolean }
  | { type: 'SET_SAVED_PROGRESS'; payload: SavedProgress | null }
  | { type: 'SET_IS_CANCELLING'; payload: boolean }
  | { type: 'RESET_STATE' }
  | { type: 'RESTORE_PROGRESS'; payload: Partial<SavedProgress> }

// Initial state
const initialState: BulkUploadState = {
  step: 'upload',
  file: null,
  pdfBytes: null,
  totalPages: 0,
  projectDefinitions: [],
  selectedProjects: {},
  batchId: '',
  batchUploaderId: '',
  uploadProgress: 0,
  processingStatus: '',
  isProcessing: false,
  error: null,
  completedScans: 0,
  totalScans: 0,
  useAI: true,
  aiAnalysis: null,
  searchDialogOpen: false,
  searchingForDefId: null,
  screenReaderAnnouncement: '',
  showRecoveryDialog: false,
  savedProgress: null,
  isCancelling: false,
}

// Reducer
function bulkUploadReducer(state: BulkUploadState, action: BulkUploadAction): BulkUploadState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }

    case 'SET_FILE':
      return { ...state, file: action.payload }

    case 'SET_PDF_BYTES':
      return { ...state, pdfBytes: action.payload }

    case 'SET_TOTAL_PAGES':
      return { ...state, totalPages: action.payload }

    case 'SET_PROJECT_DEFINITIONS':
      return { ...state, projectDefinitions: action.payload }

    case 'ADD_PROJECT_DEFINITION':
      return {
        ...state,
        projectDefinitions: [...state.projectDefinitions, action.payload]
      }

    case 'UPDATE_PROJECT_DEFINITION':
      return {
        ...state,
        projectDefinitions: state.projectDefinitions.map(def =>
          def.id === action.payload.id ? { ...def, ...action.payload.updates } : def
        )
      }

    case 'REMOVE_PROJECT_DEFINITION':
      return {
        ...state,
        projectDefinitions: state.projectDefinitions.filter(def => def.id !== action.payload)
      }

    case 'SET_SELECTED_PROJECTS':
      return { ...state, selectedProjects: action.payload }

    case 'SET_BATCH_ID':
      return { ...state, batchId: action.payload }

    case 'SET_BATCH_UPLOADER_ID':
      return { ...state, batchUploaderId: action.payload }

    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.payload }

    case 'SET_PROCESSING_STATUS':
      return { ...state, processingStatus: action.payload }

    case 'SET_IS_PROCESSING':
      return { ...state, isProcessing: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    case 'SET_COMPLETED_SCANS':
      return { ...state, completedScans: action.payload }

    case 'SET_TOTAL_SCANS':
      return { ...state, totalScans: action.payload }

    case 'SET_USE_AI':
      return { ...state, useAI: action.payload }

    case 'SET_AI_ANALYSIS':
      return { ...state, aiAnalysis: action.payload }

    case 'SET_SEARCH_DIALOG_OPEN':
      return { ...state, searchDialogOpen: action.payload }

    case 'SET_SEARCHING_FOR_DEF_ID':
      return { ...state, searchingForDefId: action.payload }

    case 'SET_SCREEN_READER_ANNOUNCEMENT':
      return { ...state, screenReaderAnnouncement: action.payload }

    case 'SET_SHOW_RECOVERY_DIALOG':
      return { ...state, showRecoveryDialog: action.payload }

    case 'SET_SAVED_PROGRESS':
      return { ...state, savedProgress: action.payload }

    case 'SET_IS_CANCELLING':
      return { ...state, isCancelling: action.payload }

    case 'RESET_STATE':
      return initialState

    case 'RESTORE_PROGRESS':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

// Context
interface BulkUploadContextType {
  state: BulkUploadState
  dispatch: React.Dispatch<BulkUploadAction>

  // Convenience actions
  setStep: (step: Step) => void
  setFile: (file: File | null) => void
  setPdfBytes: (bytes: Uint8Array | null) => void
  setTotalPages: (pages: number) => void
  updateProjectDefinition: (id: string, updates: Partial<ProjectDefinitionForm>) => void
  removeProjectDefinition: (id: string) => void
  setSelectedProject: (defId: string, project: Project) => void
  setError: (error: string | null) => void
  announceToScreenReader: (message: string) => void
  resetState: () => void
}

const BulkUploadContext = createContext<BulkUploadContextType | undefined>(undefined)

// Provider component
interface BulkUploadProviderProps {
  children: ReactNode
}

export function BulkUploadProvider({ children }: BulkUploadProviderProps) {
  const [state, dispatch] = useReducer(bulkUploadReducer, initialState)

  // Convenience actions
  const setStep = useCallback((step: Step) => {
    dispatch({ type: 'SET_STEP', payload: step })
  }, [])

  const setFile = useCallback((file: File | null) => {
    dispatch({ type: 'SET_FILE', payload: file })
  }, [])

  const setPdfBytes = useCallback((bytes: Uint8Array | null) => {
    dispatch({ type: 'SET_PDF_BYTES', payload: bytes })
  }, [])

  const setTotalPages = useCallback((pages: number) => {
    dispatch({ type: 'SET_TOTAL_PAGES', payload: pages })
  }, [])

  const updateProjectDefinition = useCallback((id: string, updates: Partial<ProjectDefinitionForm>) => {
    dispatch({ type: 'UPDATE_PROJECT_DEFINITION', payload: { id, updates } })
  }, [])

  const removeProjectDefinition = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PROJECT_DEFINITION', payload: id })
  }, [])

  const setSelectedProject = useCallback((defId: string, project: Project) => {
    dispatch({
      type: 'SET_SELECTED_PROJECTS',
      payload: { ...state.selectedProjects, [defId]: project }
    })
  }, [state.selectedProjects])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const announceToScreenReader = useCallback((message: string) => {
    dispatch({ type: 'SET_SCREEN_READER_ANNOUNCEMENT', payload: message })
    // Clear announcement after it's been read
    setTimeout(() => {
      dispatch({ type: 'SET_SCREEN_READER_ANNOUNCEMENT', payload: '' })
    }, 1000)
  }, [])

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' })
  }, [])

  const value: BulkUploadContextType = {
    state,
    dispatch,
    setStep,
    setFile,
    setPdfBytes,
    setTotalPages,
    updateProjectDefinition,
    removeProjectDefinition,
    setSelectedProject,
    setError,
    announceToScreenReader,
    resetState,
  }

  return (
    <BulkUploadContext.Provider value={value}>
      {children}
    </BulkUploadContext.Provider>
  )
}

// Hook to use the context
export function useBulkUpload() {
  const context = useContext(BulkUploadContext)
  if (context === undefined) {
    throw new Error('useBulkUpload must be used within a BulkUploadProvider')
  }
  return context
}

// Selectors for specific state slices
export const useBulkUploadStep = () => {
  const { state } = useBulkUpload()
  return state.step
}

export const useBulkUploadFile = () => {
  const { state } = useBulkUpload()
  return { file: state.file, pdfBytes: state.pdfBytes, totalPages: state.totalPages }
}

export const useBulkUploadProjects = () => {
  const { state } = useBulkUpload()
  return {
    projectDefinitions: state.projectDefinitions,
    selectedProjects: state.selectedProjects,
    aiAnalysis: state.aiAnalysis,
    useAI: state.useAI,
  }
}

export const useBulkUploadProcessing = () => {
  const { state } = useBulkUpload()
  return {
    batchId: state.batchId,
    batchUploaderId: state.batchUploaderId,
    uploadProgress: state.uploadProgress,
    processingStatus: state.processingStatus,
    isProcessing: state.isProcessing,
    error: state.error,
    completedScans: state.completedScans,
    totalScans: state.totalScans,
    isCancelling: state.isCancelling,
  }
}

export const useBulkUploadUI = () => {
  const { state } = useBulkUpload()
  return {
    searchDialogOpen: state.searchDialogOpen,
    searchingForDefId: state.searchingForDefId,
    screenReaderAnnouncement: state.screenReaderAnnouncement,
    showRecoveryDialog: state.showRecoveryDialog,
    savedProgress: state.savedProgress,
  }
}