/**
 * Utility functions for bulk upload functionality
 */

import { ProjectDefinitionForm, AnalysisResult, SavedProgress } from '@/contexts/BulkUploadContext'
import { CONFIDENCE_THRESHOLDS, VALIDATION_RULES, ERROR_MESSAGES } from './constants'

// File utilities
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function validatePDFFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE }
  }

  // Check file size
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (file.size > maxSize) {
    return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE }
  }

  // Check file name
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE }
  }

  return { isValid: true }
}

// Project definition utilities
export function validateProjectDefinition(
  def: ProjectDefinitionForm,
  totalPages: number
): { isValid: boolean; error?: string } {
  if (def.startPage < 1 || def.endPage > totalPages) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_PAGE_RANGE }
  }

  if (def.startPage > def.endPage) {
    return { isValid: false, error: ERROR_MESSAGES.START_AFTER_END }
  }

  if (def.mode === 'match' && !def.projectId) {
    return { isValid: false, error: ERROR_MESSAGES.MISSING_PROJECT_MATCH }
  }

  // Validate tentative name length
  if (def.tentativeName && def.tentativeName.length > VALIDATION_RULES.PROJECT_NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Project name must be less than ${VALIDATION_RULES.PROJECT_NAME_MAX_LENGTH} characters`
    }
  }

  // Validate tentative address length
  if (def.tentativeAddress && def.tentativeAddress.length > VALIDATION_RULES.PROJECT_ADDRESS_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Project address must be less than ${VALIDATION_RULES.PROJECT_ADDRESS_MAX_LENGTH} characters`
    }
  }

  return { isValid: true }
}

export function validateProjectDefinitions(
  definitions: ProjectDefinitionForm[],
  totalPages: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Filter out skipped projects for validation
  const activeDefinitions = definitions.filter(def => def.mode !== 'skip')

  if (activeDefinitions.length === 0) {
    errors.push(ERROR_MESSAGES.NO_PROJECTS_SELECTED)
    return { isValid: false, errors }
  }

  // Validate each definition
  for (const def of activeDefinitions) {
    const validation = validateProjectDefinition(def, totalPages)
    if (!validation.isValid && validation.error) {
      errors.push(validation.error)
    }
  }

  // Check for overlapping page ranges
  const sortedDefinitions = [...activeDefinitions].sort((a, b) => a.startPage - b.startPage)
  for (let i = 0; i < sortedDefinitions.length - 1; i++) {
    if (sortedDefinitions[i].endPage >= sortedDefinitions[i + 1].startPage) {
      errors.push(ERROR_MESSAGES.OVERLAPPING_RANGES)
      break
    }
  }

  // Check if all pages are covered (optional validation)
  const coveredPages = new Set<number>()
  for (const def of activeDefinitions) {
    for (let page = def.startPage; page <= def.endPage; page++) {
      coveredPages.add(page)
    }
  }

  const uncoveredPages = []
  for (let page = 1; page <= totalPages; page++) {
    if (!coveredPages.has(page)) {
      uncoveredPages.push(page)
    }
  }

  if (uncoveredPages.length > 0) {
    // This is a warning, not an error
    console.warn(`Pages ${uncoveredPages.slice(0, 10).join(', ')}${uncoveredPages.length > 10 ? '...' : ''} are not covered by any project definition`)
  }

  return { isValid: errors.length === 0, errors }
}

// AI analysis utilities
export function convertAIToProjectDefinitions(
  aiAnalysis: AnalysisResult
): ProjectDefinitionForm[] {
  return aiAnalysis.projects.map((project, index) => ({
    id: crypto.randomUUID(),
    startPage: project.startPage,
    endPage: project.endPage,
    mode: 'new' as const,
    tentativeName: project.projectName || `Project ${index + 1}`,
    tentativeAddress: project.projectAddress,
    confidence: project.confidence,
  }))
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high'
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium'
  return 'low'
}

export function getConfidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'destructive' {
  const level = getConfidenceLevel(confidence)
  switch (level) {
    case 'high': return 'default'
    case 'medium': return 'secondary'
    case 'low': return 'destructive'
    default: return 'secondary'
  }
}

// Progress utilities
export function calculateProgress(
  completedSteps: number,
  totalSteps: number,
  currentStepProgress: number = 0
): number {
  const baseProgress = (completedSteps / totalSteps) * 100
  const stepProgress = (currentStepProgress / totalSteps)
  return Math.min(baseProgress + stepProgress, 100)
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
}

// Storage utilities
export function isProgressExpired(progress: SavedProgress): boolean {
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours
  return (Date.now() - progress.timestamp) > maxAge
}

export function sanitizeProgressForStorage(progress: Partial<SavedProgress>): Partial<SavedProgress> {
  // Remove sensitive or non-serializable data
  const sanitized = { ...progress }

  // Remove large binary data
  if (sanitized.file && typeof sanitized.file === 'object') {
    // Keep only file metadata, not the actual file
    sanitized.file = {
      name: sanitized.file.name,
      size: sanitized.file.size,
      lastModified: sanitized.file.lastModified,
    }
  }

  return sanitized
}

// Error handling utilities
export function createErrorContext(
  operation: string,
  additionalData?: Record<string, any>
): Record<string, any> {
  return {
    operation,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
    url: typeof window !== 'undefined' ? window.location.href : 'Server',
    ...additionalData,
  }
}

export function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'NetworkError',
    'TimeoutError',
    'AbortError',
    'connection refused',
    'timeout',
    'network',
    'fetch',
  ]

  const errorMessage = error.message.toLowerCase()
  return retryableErrors.some(retryableError =>
    errorMessage.includes(retryableError.toLowerCase())
  )
}

// Request utilities
export function createRequestId(): string {
  return `bulk-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function createAbortControllerWithTimeout(timeoutMs: number): AbortController {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  // Store timeout ID for cleanup
  (controller as any)._timeoutId = timeoutId

  return controller
}

export function cleanupAbortController(controller?: AbortController | null): void {
  if (controller) {
    controller.abort()
    const timeoutId = (controller as any)._timeoutId
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

// Validation utilities
export function sanitizeProjectName(name: string): string {
  return name
    .trim()
    .slice(0, VALIDATION_RULES.PROJECT_NAME_MAX_LENGTH)
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
}

export function sanitizeProjectAddress(address: string): string {
  return address
    .trim()
    .slice(0, VALIDATION_RULES.PROJECT_ADDRESS_MAX_LENGTH)
}

// Batch utilities
export function generateProjectSuggestion(
  index: number,
  startPage: number,
  endPage: number,
  totalProjects: number
): string {
  if (totalProjects === 1) {
    return `Full Document (Pages ${startPage}-${endPage})`
  }
  return `Section ${index + 1} (Pages ${startPage}-${endPage})`
}

export function calculateEstimatedProcessingTime(
  totalPages: number,
  projectCount: number,
  useAI: boolean
): { minSeconds: number; maxSeconds: number; description: string } {
  let baseTime = 30 // Base processing time in seconds

  if (useAI) {
    baseTime += 20 // AI analysis time
  }

  // Add time based on complexity
  baseTime += (totalPages * 0.5) + (projectCount * 2)

  const minSeconds = Math.round(baseTime * 0.8)
  const maxSeconds = Math.round(baseTime * 1.5)

  const description = formatTimeRange(minSeconds, maxSeconds)

  return { minSeconds, maxSeconds, description }
}

function formatTimeRange(minSeconds: number, maxSeconds: number): string {
  if (minSeconds < 60 && maxSeconds < 60) {
    return `${minSeconds}-${maxSeconds} seconds`
  } else if (minSeconds < 120 && maxSeconds < 120) {
    return `${Math.round(minSeconds / 60)}-${Math.round(maxSeconds / 60)} minute`
  } else {
    return `${Math.round(minSeconds / 60)}-${Math.round(maxSeconds / 60)} minutes`
  }
}