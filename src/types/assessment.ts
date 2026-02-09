// Assessment types for the 4-point rating system

export type RatingCriterion = {
  id: string
  name: string
  description: string
  weight: number
}

export type ConfidenceLevel = "very_high" | "high" | "medium" | "low"

export type AssessmentMethod =
  | "site_visit"
  | "phone_call"
  | "union_meeting"
  | "subcontractor_meeting"
  | "worker_interview"
  | "document_review"
  | "other"

// Union Respect Assessment (4-point system)
export interface UnionRespectAssessmentData {
  employer_id: string
  project_id?: string | null
  criteria: {
    right_of_entry: number // 1-4 scale (1=good, 4=terrible)
    delegate_accommodation: number
    access_to_information: number
    access_to_inductions: number
    eba_status: number
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  evidence_urls?: string[]
  follow_up_required?: boolean
  follow_up_date?: string | null
}

// Safety Assessment (4-point system)
export interface SafetyAssessmentData {
  employer_id: string
  project_id?: string | null
  criteria: {
    site_safety: number // 1-4 scale (1=good, 4=terrible)
    safety_procedures: number
    incident_reporting: number
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  evidence_urls?: string[]
  follow_up_required?: boolean
  follow_up_date?: string | null
}

// Subcontractor Assessment (4-point system)
export interface SubcontractorAssessmentData {
  employer_id: string
  project_id?: string | null
  criteria: {
    subcontractor_usage: number // 1-4 scale (1=good, 4=terrible)
    payment_terms: number
    treatment_of_subbies: number
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  evidence_urls?: string[]
  follow_up_required?: boolean
  follow_up_date?: string | null
}

// Final Employer Rating (4-point system)
export interface EmployerRating4PointData {
  employer_id: string
  project_id?: string | null
  overall_rating: number // 1-4 scale
  overall_rating_label: "red" | "amber" | "yellow" | "green"
  eba_status_rating: number
  union_respect_rating: number
  safety_rating: number
  subcontractor_rating: number
  calculation_method: "automatic_calculation" | "manual_override" | "hybrid"
  weights?: {
    eba_status: number
    union_respect: number
    safety: number
    subcontractor: number
  }
  rating_factors?: any
  rating_basis: "site_visit" | "compliance_check" | "document_review" | "union_knowledge" | "hybrid"
  changed_by?: string
  rating_change_reason?: string
}

// Assessment response from API
export interface AssessmentResponse<T = any> {
  success: boolean
  message: string
  data?: T
  metadata?: {
    calculation_time: number
    overall_rating?: number
    confidence_level?: ConfidenceLevel
    created_at: string
  }
}

// Assessment list response with pagination
export interface AssessmentListResponse<T = any> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}