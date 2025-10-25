/**
 * Type definitions for bulk upload functionality
 */

// Re-export types from context for external use
export type {
  Step,
  Project,
  ProjectDefinition,
  ProjectDefinitionForm,
  AnalysisResult,
  SavedProgress,
} from '@/contexts/BulkUploadContext'

// Additional types for API responses and utilities
export interface BatchUploadInitResponse {
  batchId: string
  uploaderId?: string
  fileUrl: string
  fileName: string
  fileSize: number
  totalPages: number
}

export interface BatchUploadProcessResponse {
  batchId: string
  scanIds: string[]
  totalScans: number
}

export interface BatchStatusResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
  total_scans: number
  projects_completed: number
  error_message?: string
  created_at: string
  updated_at: string
}

export interface AIAnalysisRequest {
  file: File
  requestId: string
}

export interface AIAnalysisResponse {
  analysis: {
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
  metadata: {
    costUsd?: number
    processingTimeMs?: number
    model?: string
  }
}

export interface SplitPDFRequest {
  pdfBytes: Uint8Array
  definitions: Array<{
    startPage: number
    endPage: number
    tentativeName?: string
    mode: 'new_project' | 'existing_project'
    projectId?: string
  }>
}

export interface UploadedScan {
  id: string
  url: string
  filename: string
  size: number
  projectDefinitionIndex: number
}

// Error types
export interface BulkUploadError extends Error {
  operation: 'file-upload' | 'ai-analysis' | 'pdf-splitting' | 'batch-processing'
  code?: string
  details?: Record<string, any>
  retryable?: boolean
}

// Progress types
export interface ProcessingProgress {
  step: string
  progress: number
  status: string
  completed: number
  total: number
  error?: string
}

// Validation types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ProjectDefinitionValidation extends ValidationResult {
  projectIndex?: number
  field?: string
}

// UI state types
export interface UIDialogState {
  searchDialogOpen: boolean
  searchingForDefId: string | null
  recoveryDialogOpen: boolean
  cancellationDialogOpen: boolean
}

export interface UIAccessibilityState {
  screenReaderAnnouncement: string
  focusedElementId?: string
  keyboardNavigation: boolean
}

// Configuration types
export interface BulkUploadConfig {
  maxFileSize: number
  maxPages: number
  supportedFileTypes: Record<string, string[]>
  aiAnalysisEnabled: boolean
  autoSaveEnabled: boolean
  progressPersistence: boolean
}

// Hook return types
export interface BulkUploadStateReturn {
  state: any // Would be BulkUploadState from context
  actions: {
    addProjectDefinition: () => void
    updateProjectDefinition: (id: string, updates: Partial<any>) => void
    removeProjectDefinition: (id: string) => void
    validateDefinitions: () => boolean
    proceedFromUpload: () => void
    goBack: () => void
  }
  computed: {
    activeProjectDefinitions: any[]
    canProceedFromUpload: boolean
    canProceedFromDefine: boolean
    stepConfig: any
  }
}

export interface PDFProcessingReturn {
  file: File | null
  pdfBytes: Uint8Array | null
  totalPages: number
  isProcessing: boolean
  fileInfo: {
    name: string
    size: number
    sizeFormatted: string
    lastModified: number
    lastModifiedFormatted: string
  } | null
  actions: {
    handleFileUpload: (file: File) => Promise<boolean>
    clearFile: () => void
    validateCurrentFile: () => boolean
  }
  dropzone: {
    getRootProps: () => any
    getInputProps: () => any
    isDragActive: boolean
    fileRejections: any[]
  }
}

export interface AIAnalysisReturn {
  isAnalyzing: boolean
  analysisResults: any
  error: string | null
  actions: {
    analyzeWithAI: () => Promise<boolean>
    cancelAnalysis: () => void
    retryAnalysis: () => Promise<void>
  }
  status: {
    getAnalysisStatus: () => any
    validateAnalysisResults: () => boolean
    shouldRetryAnalysis: () => boolean
  }
  cost: {
    getAnalysisCost: () => any
  }
}

export interface BatchProcessingReturn {
  isProcessing: boolean
  step: string
  progress: number
  status: string
  completedScans: number
  totalScans: number
  error: string | null
  batchId: string
  isCancelling: boolean
  actions: {
    processBatchUpload: () => Promise<boolean>
    cancelProcessing: () => void
    retryProcessing: () => Promise<void>
  }
  statusInfo: {
    getProcessingStatus: () => any
    canRetryProcessing: () => boolean
  }
}

export interface ProgressPersistenceReturn {
  showRecoveryDialog: boolean
  savedProgress: any
  step: string
  actions: {
    saveProgress: () => void
    loadSavedProgress: () => any
    clearSavedProgress: () => void
    restoreProgress: (progress: any) => Promise<void>
    manualSave: () => void
    handleRestoreProgress: () => void
    handleStartFresh: () => void
  }
  status: {
    getRecoveryStatus: () => any
  }
}

// Event types
export interface BulkUploadEvent {
  type: 'file-selected' | 'analysis-started' | 'analysis-completed' | 'processing-started' | 'processing-completed' | 'error' | 'cancelled'
  payload?: any
  timestamp: number
}

// Analytics types
export interface BulkUploadAnalytics {
  sessionId: string
  userId?: string
  startTime: number
  endTime?: number
  events: BulkUploadEvent[]
  finalState?: {
    step: string
    projectsProcessed: number
    totalPages: number
    success: boolean
    error?: string
  }
}