/**
 * Constants and configuration for bulk upload functionality
 */

// Storage and persistence
export const PROGRESS_STORAGE_KEY = 'bulk_upload_progress'
export const AUTO_SAVE_INTERVAL = 30000 // 30 seconds
export const MAX_PROGRESS_AGE = 24 * 60 * 60 * 1000 // 24 hours

// File handling limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
export const MAX_PAGES = 1000
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
} as const

// Processing configuration
export const DEFAULT_PAGES_PER_PROJECT = 2
export const MAX_POLLING_ATTEMPTS = 150
export const POLLING_INTERVAL = 2000 // 2 seconds
export const AI_ANALYSIS_TIMEOUT = 60000 // 60 seconds

// Cost and pricing
export const AI_ANALYSIS_ESTIMATED_COST = 0.05 // USD
export const COST_CURRENCY = 'USD'

// UI and accessibility
export const ANNOUNCEMENT_DURATION = 1000 // 1 second
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.6,
  LOW: 0,
} as const

// Error messages
export const ERROR_MESSAGES = {
  NO_FILE_SELECTED: 'No file selected',
  INVALID_FILE_TYPE: 'Please upload a PDF file',
  FILE_TOO_LARGE: `PDF file is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
  EMPTY_PDF: 'PDF appears to be empty or corrupted',
  TOO_MANY_PAGES: `PDF contains too many pages. Maximum is ${MAX_PAGES} pages.`,
  INVALID_PAGE_RANGE: 'Invalid page range',
  OVERLAPPING_RANGES: 'Page ranges cannot overlap',
  START_AFTER_END: 'Start page cannot be greater than end page',
  NO_PROJECTS_SELECTED: 'At least one project must be selected for processing',
  MISSING_PROJECT_MATCH: 'Please select a project to match or change to "Create New"',
  USER_NOT_AUTHENTICATED: 'User not authenticated',
  PROCESSING_CANCELLED: 'Processing was cancelled',
  PROCESSING_TIMEOUT: (minutes: number, completed: number, total: number) =>
    `Processing timeout after ${minutes} minutes. ${completed}/${total} scans completed. Check batch status page for details.`,
  AI_ANALYSIS_FAILED: 'AI analysis failed',
  BATCH_INIT_FAILED: 'Failed to initialize batch upload',
  BATCH_PROCESS_FAILED: 'Failed to process batch upload',
  NETWORK_ERROR: 'Network error occurred',
  UNKNOWN_ERROR: 'An unexpected error occurred',
} as const

// Success messages
export const SUCCESS_MESSAGES = {
  FILE_LOADED: (pages: number) => `PDF loaded: ${pages} page${pages !== 1 ? 's' : ''}`,
  AI_ANALYSIS_COMPLETE: (count: number, cost?: string) =>
    `AI detected ${count} project${count !== 1 ? 's' : ''}${cost ? ` (cost: ${cost})` : ''}`,
  BATCH_UPLOAD_COMPLETE: 'Batch upload completed successfully!',
  PROGRESS_SAVED: 'Progress saved manually',
  PROGRESS_RESTORED: 'Progress restored successfully',
} as const

// Warning messages
export const WARNING_MESSAGES = {
  LARGE_FILE_WARNING: 'This PDF contains a large number of pages. Processing may take some time.',
  AI_FALLBACK: 'AI analysis failed. Using manual mode.',
  PROCESSING_CANCELLED: 'Processing cancelled',
  PROGRESS_EXPIRED: 'Saved progress has expired and was removed',
} as const

// Step configuration
export const STEP_CONFIG = {
  upload: {
    title: 'Upload File',
    description: 'Upload a PDF containing multiple mapping sheets',
    canProceed: false, // Determined by file selection
    canGoBack: false,
    showProgress: false,
  },
  analyze: {
    title: 'AI Analysis',
    description: 'Analyzing PDF with AI to detect projects',
    canProceed: false,
    canGoBack: true,
    showProgress: true,
    estimatedTime: '10-20 seconds',
  },
  define: {
    title: 'Define Projects',
    description: 'Review and configure project definitions',
    canProceed: false, // Determined by validation
    canGoBack: true,
    showProgress: false,
  },
  processing: {
    title: 'Processing Upload',
    description: 'Uploading and processing your files',
    canProceed: false,
    canGoBack: false,
    showProgress: true,
    estimatedTime: '2-5 minutes',
  },
  complete: {
    title: 'Upload Complete',
    description: 'Your files have been successfully processed',
    canProceed: false,
    canGoBack: false,
    showProgress: false,
  },
} as const

// Progress percentage milestones
export const PROGRESS_MILESTONES = {
  INIT: 10,
  PDF_SPLIT: 50,
  UPLOAD_SPLIT: 75,
  CREATE_RECORDS: 90,
  COMPLETE: 100,
} as const

// Project mode configuration
export const PROJECT_MODES = {
  new: {
    label: 'Create New Project',
    description: 'Create a new project from these pages',
    icon: 'Plus',
  },
  match: {
    label: 'Match to Existing Project',
    description: 'Add these pages to an existing project',
    icon: 'Search',
  },
  skip: {
    label: 'Skip Project',
    description: "Don't process these pages",
    icon: 'SkipForward',
  },
} as const

// Accessibility configuration
export const ARIA_LABELS = {
  DRAG_ZONE: 'PDF upload area. Drop file here or click to browse',
  PROGRESS_BAR: 'Upload progress',
  PROCESSING_STATUS: 'Current processing status',
  CONFIDENCE_BADGE: (confidence: number) => `${Math.round(confidence * 100)}% confidence`,
  PROJECT_DEFINITION: (index: number) => `Project definition ${index + 1}`,
  PAGE_RANGE_INPUT: (type: 'start' | 'end', projectIndex: number) =>
    `${type} page for project ${projectIndex + 1}`,
  SCREEN_READER_ANNOUNCEMENT: 'Bulk upload status announcement',
} as const

// Request tracking
export const REQUEST_HEADERS = {
  REQUEST_ID: 'X-Request-ID',
  CACHE_CONTROL: 'Cache-Control',
} as const

// Validation rules
export const VALIDATION_RULES = {
  PROJECT_NAME_MAX_LENGTH: 100,
  PROJECT_ADDRESS_MAX_LENGTH: 200,
  MIN_PAGE_NUMBER: 1,
  MAX_PROJECTS_PER_BATCH: 50,
} as const

// Animation durations
export const ANIMATION_DURATIONS = {
  TOAST: 3000,
  PROGRESS_UPDATE: 200,
  SCREEN_READER: 1000,
  ERROR_RECOVERY: 500,
} as const