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

export interface MappingSheetScan {
  id: string
  project_id: string
  uploaded_by: string
  file_url: string
  file_name: string
  file_size_bytes: number
  page_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'under_review' | 'confirmed' | 'rejected'
  extracted_data: ExtractedMappingSheetData | null
  confidence_scores: any
  ai_provider: 'claude' | 'openai' | null
  extraction_attempted_at: string | null
  extraction_completed_at: string | null
  extraction_cost_usd: number | null
  review_started_at: string | null
  reviewed_by: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
  notes: string | null
}
