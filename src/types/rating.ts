// Traffic light rating values
export type TrafficLightRating = 'red' | 'amber' | 'yellow' | 'green'

// Role types for rating context
export type RoleType = 'trade' | 'builder' | 'admin' | 'organiser'

// Rating tracks
export type RatingTrack = 'project_data' | 'organiser_expertise'

// Rating confidence levels
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'

// Base rating interface
export interface BaseRating {
  id: string
  employer_id: string
  rating: TrafficLightRating
  confidence: ConfidenceLevel
  track: RatingTrack
  role_context: RoleType
  calculated_at: string
  calculated_by: string
}

// Project data rating
export interface ProjectDataRating extends BaseRating {
  track: 'project_data'
  project_id: string
  compliance_score: number
  participation_rate: number
  dispute_count: number
  safety_incidents: number
  eba_compliance: number
}

// Organiser expertise rating
export interface OrganiserExpertiseRating extends BaseRating {
  track: 'organiser_expertise'
  organiser_id: string
  relationship_quality: number
  communication_effectiveness: number
  cooperation_level: number
  problem_solving: number
  historical_performance: number
}

// Employer rating card data
export interface EmployerRatingData {
  id: string
  employer_name: string
  abn?: string
  project_count: number
  primary_trade?: string
  location?: string
  // Current ratings
  project_data_rating?: ProjectDataRating
  organiser_expertise_rating?: OrganiserExpertiseRating
  // Historical data
  rating_history: BaseRating[]
  last_updated: string
}

// Rating calculation inputs
export interface RatingCalculationInput {
  employer_id: string
  track: RatingTrack
  role_context: RoleType
  project_id?: string
  organiser_id?: string
  weighting_template?: string
}

// Weighting configuration
export interface WeightingConfig {
  id: string
  name: string
  description?: string
  track: RatingTrack
  role_context: RoleType
  factors: RatingFactor[]
  is_default: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// Rating factor with weight
export interface RatingFactor {
  id: string
  name: string
  description?: string
  weight: number // 0-100
  min_value: number
  max_value: number
  required: boolean
}

// Rating calculation result
export interface RatingCalculationResult {
  rating: TrafficLightRating
  confidence: ConfidenceLevel
  score: number
  breakdown: FactorBreakdown[]
  calculation_details: {
    formula: string
    inputs: Record<string, number>
    weighting_used: string
  }
  calculated_at: string
}

// Factor breakdown for detailed rating explanation
export interface FactorBreakdown {
  factor_id: string
  factor_name: string
  value: number
  weight: number
  contribution: number // contribution to overall score
  status: 'excellent' | 'good' | 'average' | 'poor' | 'critical'
}

// Rating comparison data
export interface RatingComparison {
  employer_id: string
  employer_name: string
  role_context: RoleType
  project_data_rating: ProjectDataRating | null
  organiser_expertise_rating: OrganiserExpertiseRating | null
  discrepancy: {
    exists: boolean
    severity: 'none' | 'minor' | 'moderate' | 'significant' | 'critical'
    explanation: string
    recommended_action?: string
  }
  last_updated: string
}

// Rating trend data
export interface RatingTrend {
  employer_id: string
  track: RatingTrack
  role_context: RoleType
  period: 'week' | 'month' | 'quarter' | 'year'
  data_points: TrendDataPoint[]
}

export interface TrendDataPoint {
  date: string
  rating: TrafficLightRating
  confidence: ConfidenceLevel
  score: number
  sample_size?: number
}

// Mobile UI specific types
export interface MobileRatingDisplayOptions {
  show_confidence: boolean
  show_trend: boolean
  show_breakdown: boolean
  compact_mode: boolean
  role_aware: boolean
}

// Form data for rating wizard
export interface RatingWizardFormData {
  employer_id: string
  track: RatingTrack
  role_context: RoleType
  project_id?: string
  responses: Record<string, number | string | boolean>
  notes?: string
  confidence_factors: Record<string, number>
}

// API response types
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
}

// Filter and search types
export interface RatingFilters {
  track?: RatingTrack
  role_context?: RoleType
  rating?: TrafficLightRating[]
  confidence?: ConfidenceLevel[]
  date_range?: {
    start: string
    end: string
  }
  location?: string[]
  trade?: string[]
}

export interface RatingSearch {
  query?: string
  filters?: RatingFilters
  sort_by?: 'employer_name' | 'rating' | 'confidence' | 'last_updated'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Export a union type for all rating types
export type Rating = ProjectDataRating | OrganiserExpertiseRating