/**
 * Comprehensive TypeScript Interfaces for Data Validation
 *
 * This file contains TypeScript interfaces that complement the Zod schemas
 * and provide type safety throughout the CFMEU application.
 */

import { Database } from './database'

// ============================================================================
// Core Database Types with Validation Annotations
// ============================================================================

/**
 * Validated Project Types
 */
export interface ValidatedProject {
  id: string
  name: string
  value: number
  stage: ProjectStage
  status: ProjectStatus
  organizing_universe?: string
  address?: string
  latitude?: number
  longitude?: number
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export type ProjectStage = 'future' | 'pre_construction' | 'construction' | 'archived'
export type ProjectStatus = 'pending' | 'approved' | 'rejected'

/**
 * Validated Employer Types
 */
export interface ValidatedEmployer {
  id: string
  name: string
  abn?: string
  trading_name?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  address?: string
  website?: string
  industry?: string
  notes?: string
  eba_status?: EbaStatus
  eba_expiry_date?: string
  created_at: string
  updated_at: string
  status: EmployerStatus
}

export type EbaStatus = 'yes' | 'no' | 'pending'
export type EmployerStatus = 'active' | 'inactive' | 'pending' | 'merged'

/**
 * Validated User/Profile Types
 */
export interface ValidatedProfile {
  id: string
  email: string
  full_name?: string
  role: UserRole
  phone?: string
  last_seen_projects_at?: string
  created_at: string
  updated_at: string
}

export type UserRole = 'admin' | 'lead_organiser' | 'organiser' | 'delegate' | 'viewer'

/**
 * Validated Assessment Types
 */
export interface ValidatedAssessment {
  id: string
  employer_id: string
  project_id?: string
  assessment_type: AssessmentType
  criteria: AssessmentCriteria
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  evidence_urls?: string[]
  follow_up_required: boolean
  follow_up_date?: string
  created_by: string
  created_at: string
  updated_at: string
}

export type AssessmentType = 'safety' | 'union_respect' | 'subcontractor' | 'role_specific'
export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low'
export type AssessmentMethod =
  | 'site_visit'
  | 'phone_call'
  | 'safety_meeting'
  | 'union_meeting'
  | 'contractor_meeting'
  | 'worker_interview'
  | 'document_review'
  | 'other'

export interface AssessmentCriteria {
  [key: string]: number // Rating values 1-4
}

// ============================================================================
// API Request/Response Types with Validation
// ============================================================================

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  field?: string
  hint?: string
  details?: any
  timestamp?: string
}

/**
 * Pagination Types
 */
export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Search and Filter Types
 */
export interface SearchParams {
  q?: string
  filters?: Record<string, any>
  pagination?: PaginationParams
}

export interface ProjectSearchParams extends SearchParams {
  stage?: ProjectStage
  status?: ProjectStatus
  patch_id?: string
  value_min?: number
  value_max?: number
  created_after?: string
  created_before?: string
}

export interface EmployerSearchParams extends SearchParams {
  abn?: string
  industry?: string
  eba_status?: EbaStatus
  status?: EmployerStatus
}

// ============================================================================
// Business Logic Types
// ============================================================================

/**
 * Geographic Assignment Types
 */
export interface GeographicAssignment {
  user_id: string
  patch_id: string
  role: UserRole
  assigned_at: string
  assigned_by: string
}

export interface Patch {
  id: string
  name: string
  description?: string
  geometry?: any // PostGIS geometry
  created_at: string
  updated_at: string
}

/**
 * Project-Employer Relationship Types
 */
export interface ProjectEmployerRole {
  id: string
  project_id: string
  employer_id: string
  role: EmployerRole
  created_at: string
  created_by: string
}

export type EmployerRole =
  | 'builder'
  | 'head_contractor'
  | 'contractor'
  | 'trade_subcontractor'
  | 'project_manager'

/**
 * Site-Employer Relationship Types
 */
export interface SiteEmployer {
  id: string
  job_site_id: string
  employer_id: string
  worker_count?: number
  start_date?: string
  end_date?: string
  notes?: string
  created_at: string
  created_by: string
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation Operation Results
 */
export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  errors?: ValidationError[]
  warnings?: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
  value?: any
}

/**
 * Business Rule Validation
 */
export interface BusinessRuleResult {
  valid: boolean
  rule: string
  message?: string
  suggestions?: string[]
}

// ============================================================================
// Merge Operation Types
// ============================================================================

/**
 * Merge Operation Configuration
 */
export interface MergeConfig {
  canonicalId: string
  mergeIds: string[]
  conflictResolutions: ConflictResolution
  autoMerge: boolean
  validateBeforeMerge: boolean
}

export interface ConflictResolution {
  [field: string]: ConflictResolutionStrategy
}

export type ConflictResolutionStrategy =
  | 'use_canonical'
  | 'use_merge'
  | 'merge_values'
  | 'custom'
  | 'skip'

/**
 * Merge Operation Results
 */
export interface MergeResult {
  success: boolean
  canonicalId: string
  mergedIds: string[]
  conflicts: ConflictDetail[]
  errors?: string[]
  warnings?: string[]
  mergedAt: string
  mergedBy: string
}

export interface ConflictDetail {
  field: string
  canonicalValue: any
  mergeValues: any[]
  resolution: ConflictResolutionStrategy
  resolvedValue: any
}

// ============================================================================
// Assessment and Rating Types
// ============================================================================

/**
 * Assessment Submission Types
 */
export interface SafetyAssessmentSubmission {
  employer_id: string
  project_id?: string
  criteria: {
    site_safety: RatingValue
    safety_procedures: RatingValue
    incident_reporting: RatingValue
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  evidence_urls?: string[]
  follow_up_required?: boolean
  follow_up_date?: string
}

export interface UnionRespectAssessmentSubmission {
  employer_id: string
  project_id?: string
  criteria: {
    respect_delegates: RatingValue
    union_rights: RatingValue
    worker_treatment: RatingValue
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  follow_up_required?: boolean
  follow_up_date?: string
}

export interface SubcontractorAssessmentSubmission {
  employer_id: string
  project_id?: string
  criteria: {
    payment_terms: RatingValue
    contract_fairness: RatingValue
    communication: RatingValue
  }
  confidence_level: ConfidenceLevel
  assessment_method: AssessmentMethod
  notes?: string
  follow_up_required?: boolean
  follow_up_date?: string
}

export type RatingValue = 1 | 2 | 3 | 4 // 1=excellent, 4=poor

/**
 * Rating Calculation Types
 */
export interface RatingCalculation {
  employer_id: string
  rating_type: AssessmentType
  overall_rating: number
  criteria_ratings: Record<string, number>
  confidence_score: number
  last_updated: string
  assessment_count: number
}

// ============================================================================
// System Administration Types
// ============================================================================

/**
 * Bulk Operation Types
 */
export interface BulkOperation {
  operation: BulkOperationType
  targetIds: string[]
  parameters?: Record<string, any>
  validateBeforeExecute: boolean
  confirmed: boolean
}

export type BulkOperationType = 'approve' | 'reject' | 'merge' | 'delete' | 'archive' | 'activate'

export interface BulkOperationResult {
  success: boolean
  operation: BulkOperationType
  totalTargets: number
  processedCount: number
  successCount: number
  failureCount: number
  results: BulkItemResult[]
  errors?: string[]
}

export interface BulkItemResult {
  id: string
  success: boolean
  error?: string
}

/**
 * System Health and Monitoring Types
 */
export interface SystemHealthCheck {
  timestamp: string
  database_connection: boolean
  authentication_service: boolean
  external_apis: Record<string, boolean>
  performance_metrics: PerformanceMetrics
  error_counts: Record<string, number>
}

export interface PerformanceMetrics {
  api_response_time_avg: number
  database_query_time_avg: number
  active_users: number
  memory_usage_mb: number
  cpu_usage_percent: number
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type Guard Functions
 */
export function isValidProjectStage(stage: string): stage is ProjectStage {
  return ['future', 'pre_construction', 'construction', 'archived'].includes(stage)
}

export function isValidUserRole(role: string): role is UserRole {
  return ['admin', 'lead_organiser', 'organiser', 'delegate', 'viewer'].includes(role)
}

export function isValidAssessmentType(type: string): type is AssessmentType {
  return ['safety', 'union_respect', 'subcontractor', 'role_specific'].includes(type)
}

export function isValidRatingValue(value: number): value is RatingValue {
  return [1, 2, 3, 4].includes(value)
}

/**
 * Database Type Utilities
 */
export type DatabaseTable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type DatabaseInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type DatabaseUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Common database row types
export type DatabaseProject = DatabaseTable<'projects'>
export type DatabaseEmployer = DatabaseTable<'employers'>
export type DatabaseProfile = DatabaseTable<'profiles'>
export type DatabaseAssessment = DatabaseTable<'assessments'>

// ============================================================================
// Export All Types for Easy Import
// ============================================================================

export type {
  // Core types
  ProjectStage,
  ProjectStatus,
  EbaStatus,
  EmployerStatus,
  UserRole,
  AssessmentType,
  ConfidenceLevel,
  AssessmentMethod,
  RatingValue,
  EmployerRole,
  ConflictResolutionStrategy,
  BulkOperationType,

  // Complex types
  ValidatedProject,
  ValidatedEmployer,
  ValidatedProfile,
  ValidatedAssessment,
  ApiResponse,
  PaginatedResponse,
  ValidationResult,
  MergeResult,
  RatingCalculation,
  SystemHealthCheck
}