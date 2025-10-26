// 4-Point Rating System Types for CFMEU Transformation
// This file contains all the types for the new 4-point assessment system

export type FourPointRating = 1 | 2 | 3 | 4

export type FourPointRatingLabel = 'Poor' | 'Fair' | 'Good' | 'Excellent'

export type AssessmentType =
  | 'union_respect'
  | 'safety_4_point'
  | 'subcontractor_use'
  | 'role_specific'

export type EmployerRole =
  | 'head_contractor'
  | 'subcontractor'
  | 'trade_contractor'
  | 'labour_hire'
  | 'consultant'
  | 'other'

// Base assessment interface
export interface BaseAssessment {
  id: string
  employer_id: string
  assessment_type: AssessmentType
  assessor_id: string
  assessment_date: string
  created_at: string
  updated_at: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved'
  notes?: string
  evidence_files?: string[]
}

// Union Respect Assessment
export interface UnionRespectAssessment extends BaseAssessment {
  assessment_type: 'union_respect'
  criteria: {
    union_engagement: FourPointRating
    communication_respect: FourPointRating
    collaboration_attitude: FourPointRating
    dispute_resolution: FourPointRating
    union_delegate_relations: FourPointRating
  }
  additional_comments?: {
    union_engagement?: string
    communication_respect?: string
    collaboration_attitude?: string
    dispute_resolution?: string
    union_delegate_relations?: string
  }
  overall_score: FourPointRating
  confidence_level: number // 0-100
  supporting_evidence: {
    has_union_delegates: boolean
    regular_meetings: boolean
    formal_communication_channels: boolean
    joint_safety_committee: boolean
    union_training_participation: boolean
  }
}

// Safety Assessment (4-point scale)
export interface Safety4PointAssessment extends BaseAssessment {
  assessment_type: 'safety_4_point'
  safety_criteria: {
    safety_management_systems: FourPointRating
    incident_reporting: FourPointRating
    site_safety_culture: FourPointRating
    risk_assessment_processes: FourPointRating
    emergency_preparedness: FourPointRating
    worker_safety_training: FourPointRating
  }
  safety_metrics: {
    lost_time_injuries: number
    near_misses: number
    safety_breaches: number
    safety_improvements: number
    training_hours: number
  }
  audit_compliance: {
    last_audit_date?: string
    audit_score?: FourPointRating
    outstanding_actions: number
    critical_risks_identified: number
  }
  overall_safety_score: FourPointRating
  safety_confidence_level: number // 0-100
}

// Subcontractor Use Assessment
export interface SubcontractorUseAssessment extends BaseAssessment {
  assessment_type: 'subcontractor_use'
  subcontracting_criteria: {
    fair_subcontractor_selection: FourPointRating
    payment_practices: FourPointRating
    work_quality_standards: FourPointRating
    subcontractor_relations: FourPointRating
    contract_fairness: FourPointRating
  }
  subcontractor_metrics: {
    active_subcontractors: number
    payment_terms_days: number
    dispute_count: number
    repeat_subcontractor_rate: number // percentage
  }
  compliance_records: {
    abn_verified: boolean
    insurance_valid: boolean
    licences_current: boolean
    payment_history_clean: boolean
  }
  overall_subcontractor_score: FourPointRating
  confidence_level: number // 0-100
}

// Role-Specific Assessment
export interface RoleSpecificAssessment extends BaseAssessment {
  assessment_type: 'role_specific'
  employer_role: EmployerRole
  role_criteria: {
    industry_reputation: FourPointRating
    work_quality: FourPointRating
    reliability: FourPointRating
    financial_stability: FourPointRating
    expertise_level: FourPointRating
  }
  role_specific_metrics: {
    years_in_industry: number
    project_success_rate: number // percentage
    staff_retention_rate: number // percentage
    average_project_size: number
  }
  certifications: {
    industry_certifications: string[]
    quality_assurance_cert: boolean
    environmental_cert: boolean
    safety_certifications: string[]
  }
  overall_role_score: FourPointRating
  role_confidence_level: number // 0-100
}

// Assessment union type
export type Assessment =
  | UnionRespectAssessment
  | Safety4PointAssessment
  | SubcontractorUseAssessment
  | RoleSpecificAssessment

// Assessment creation/update payloads
export interface CreateUnionRespectAssessmentPayload {
  employer_id: string
  criteria: UnionRespectAssessment['criteria']
  additional_comments?: UnionRespectAssessment['additional_comments']
  supporting_evidence?: Partial<UnionRespectAssessment['supporting_evidence']>
  notes?: string
}

export interface CreateSafety4PointAssessmentPayload {
  employer_id: string
  safety_criteria: Safety4PointAssessment['safety_criteria']
  safety_metrics: Safety4PointAssessment['safety_metrics']
  audit_compliance?: Partial<Safety4PointAssessment['audit_compliance']>
  notes?: string
}

export interface CreateSubcontractorUseAssessmentPayload {
  employer_id: string
  subcontracting_criteria: SubcontractorUseAssessment['subcontracting_criteria']
  subcontractor_metrics: SubcontractorUseAssessment['subcontractor_metrics']
  compliance_records?: Partial<SubcontractorUseAssessment['compliance_records']>
  notes?: string
}

export interface CreateRoleSpecificAssessmentPayload {
  employer_id: string
  employer_role: EmployerRole
  role_criteria: RoleSpecificAssessment['role_criteria']
  role_specific_metrics: RoleSpecificAssessment['role_specific_metrics']
  certifications?: Partial<RoleSpecificAssessment['certifications']>
  notes?: string
}

// 4-Point Rating Calculation Types
export interface FourPointRatingCalculation {
  employer_id: string
  calculation_date: string
  calculated_by: string
  assessments_used: string[]
  weights: {
    union_respect: number
    safety_4_point: number
    subcontractor_use: number
    role_specific: number
  }
  weighted_scores: {
    union_respect: number
    safety_4_point: number
    subcontractor_use: number
    role_specific: number
  }
  final_score: FourPointRating
  confidence_level: number // 0-100
  calculation_breakdown: {
    total_assessments: number
    assessment_types_used: AssessmentType[]
    recent_assessments: number // count in last 90 days
    data_quality_score: number // 0-100
  }
}

// Bulk assessment operations
export interface BulkAssessmentOperation {
  employer_ids: string[]
  assessment_type: AssessmentType
  operation: 'create' | 'update' | 'calculate'
  payload?: Partial<Assessment>
}

// Assessment validation and quality assurance
export interface AssessmentValidation {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  completeness_score: number // 0-100
  confidence_indicators: {
    recent_data: boolean
    sufficient_evidence: boolean
    consistent_ratings: boolean
    complete_coverage: boolean
  }
}

// Assessment API response types
export interface AssessmentResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
  metadata?: {
    calculation_time: number
    confidence_level: number
    last_updated: string
  }
}

// Assessment filters and search
export interface AssessmentFilters {
  assessment_type?: AssessmentType[]
  employer_id?: string[]
  assessor_id?: string[]
  date_range?: {
    start: string
    end: string
  }
  status?: BaseAssessment['status'][]
  min_score?: FourPointRating
  max_score?: FourPointRating
  employer_role?: EmployerRole[]
}

export interface AssessmentSearch {
  query?: string
  filters?: AssessmentFilters
  sort_by?: 'assessment_date' | 'overall_score' | 'employer_name' | 'confidence_level'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Assessment analytics and reporting
export interface AssessmentAnalytics {
  total_assessments: number
  assessments_by_type: Record<AssessmentType, number>
  average_scores: Record<AssessmentType, number>
  distribution: Record<FourPointRating, number>
  trends: {
    period: 'week' | 'month' | 'quarter' | 'year'
    data_points: {
      date: string
      average_score: number
      assessment_count: number
    }[]
  }
  compliance_metrics: {
    completion_rate: number // percentage
    quality_score: number // 0-100
    timeliness_score: number // 0-100
  }
}

// Legacy data conversion
export interface LegacyDataConversion {
  legacy_score: number // 0-100
  converted_four_point_rating: FourPointRating
  conversion_confidence: number // 0-100
  conversion_method: 'linear' | 'quartile' | 'custom'
  legacy_assessment_type: string
  new_assessment_type: AssessmentType
  conversion_date: string
  converted_by: string
}

// Helper functions
export const getFourPointLabel = (rating: FourPointRating): FourPointRatingLabel => {
  switch (rating) {
    case 1: return 'Poor'
    case 2: return 'Fair'
    case 3: return 'Good'
    case 4: return 'Excellent'
    default:
      throw new Error(`Invalid 4-point rating: ${rating}`)
  }
}

export const getFourPointColor = (rating: FourPointRating): string => {
  switch (rating) {
    case 1: return '#dc2626' // red-600
    case 2: return '#f59e0b' // amber-500
    case 3: return '#84cc16' // lime-500
    case 4: return '#16a34a' // green-600
    default:
      return '#6b7280' // gray-500
  }
}

export const convertLegacyScoreToFourPoint = (
  legacyScore: number,
  method: 'linear' | 'quartile' = 'linear'
): FourPointRating => {
  if (method === 'linear') {
    if (legacyScore < 25) return 1
    if (legacyScore < 50) return 2
    if (legacyScore < 75) return 3
    return 4
  }

  // Quartile method would need historical data
  // For now, fall back to linear
  return convertLegacyScoreToFourPoint(legacyScore, 'linear')
}