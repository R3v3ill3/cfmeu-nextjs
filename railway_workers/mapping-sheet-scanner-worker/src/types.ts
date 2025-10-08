export interface MappingSheetScanJob {
  id: string
  job_type: 'mapping_sheet_scan'
  status: 'queued' | 'processing' | 'succeeded' | 'failed'
  payload: {
    scanId: string
    projectId?: string
    fileUrl: string
    fileName: string
    pageCount?: number
    selectedPages?: number[]
  }
  attempts: number
  max_attempts: number
  run_at: string
  locked_at: string | null
  lock_token: string | null
  last_error: string | null
  progress_completed: number
  progress_total: number
}

export interface ExtractedMappingSheetData {
  extraction_version: string
  pages_processed: number
  
  project?: {
    organiser?: string
    project_name?: string
    project_value?: number
    address?: string
    builder?: string
    proposed_start_date?: string
    proposed_finish_date?: string
    eba_with_cfmeu?: boolean
    roe_email?: string
    project_type?: 'government' | 'private'
    state_funding?: number
    federal_funding?: number
  }
  
  site_contacts?: Array<{
    role: 'project_manager' | 'site_manager' | 'site_delegate' | 'site_hsr'
    name?: string
    email?: string
    phone?: string
  }>
  
  subcontractors?: Array<{
    stage: 'early_works' | 'structure' | 'finishing' | 'other'
    trade: string
    company?: string
    eba?: boolean
  }>
  
  confidence: {
    overall: number
    project?: Record<string, number>
    site_contacts?: number[]
    subcontractors?: number[]
  }
  
  notes?: string[]
  warnings?: string[]
}

export interface ProcessingResult {
  success: boolean
  extractedData?: ExtractedMappingSheetData
  provider: 'claude' | 'openai'
  costUsd: number
  processingTimeMs: number
  inputTokens?: number
  outputTokens?: number
  imagesProcessed: number
  error?: string
}
