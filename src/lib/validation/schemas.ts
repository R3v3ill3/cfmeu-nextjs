/**
 * Centralized Zod Validation Schemas for CFMEU Application
 *
 * This file contains all validation schemas used across the API routes
 * to ensure data consistency and prevent malformed inputs.
 */

import { z } from 'zod'

// Common UUID validation pattern
const uuidSchema = z.string().uuid('Invalid ID format - must be a valid UUID')

// Common validation patterns
export const commonSchemas = {
  uuid: uuidSchema,
  optionalUuid: uuidSchema.optional(),
  uuidArray: z.array(uuidSchema).min(1, 'At least one ID is required'),

  // String validations with reasonable limits
  shortString: z.string().min(1).max(100, 'Text must be less than 100 characters'),
  mediumString: z.string().min(1).max(500, 'Text must be less than 500 characters'),
  longString: z.string().min(1).max(2000, 'Text must be less than 2000 characters'),
  optionalShortString: z.string().max(100).optional(),
  optionalMediumString: z.string().max(500).optional(),
  optionalLongString: z.string().max(2000).optional(),

  // Contact information
  phone: z.string().regex(/^[+]?[0-9\s\-\(\)]+$/, 'Invalid phone number format').max(20),
  email: z.string().email('Invalid email format').max(255),

  // Numbers
  positiveNumber: z.number().positive('Value must be positive'),
  nonNegativeNumber: z.number().min(0, 'Value cannot be negative'),
  rating: z.number().min(1).max(4, 'Rating must be between 1 and 4'),
  percentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100'),

  // Dates
  dateString: z.string().datetime({ offset: true, message: 'Invalid date format' }),
  optionalDateString: z.string().datetime({ offset: true }).optional().nullable(),

  // Booleans
  boolean: z.boolean(),
  optionalBoolean: z.boolean().optional(),
}

// Project-specific schemas
export const projectSchemas = {
  // Core project data
  createProject: z.object({
    name: commonSchemas.shortString,
    value: commonSchemas.positiveNumber,
    stage: z.enum(['future', 'pre_construction', 'construction', 'archived'], {
      errorMap: () => ({ message: 'Stage must be one of: future, pre_construction, construction, archived' })
    }),
    organizing_universe: commonSchemas.mediumString.optional(),
    address: commonSchemas.mediumString.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    notes: commonSchemas.longString.optional(),
  }),

  // Project approval
  approveProject: z.object({
    projectId: commonSchemas.uuid.refine(
      async (id) => {
        // Note: This would need to be implemented at the API route level
        // to check if the project exists in the database
        return true // Placeholder for existence check
      },
      { message: 'Project does not exist' }
    ),
    notes: commonSchemas.optionalLongString,
  }),

  // Project merge operations
  mergeProjects: z.object({
    canonicalProjectId: commonSchemas.uuid,
    mergeProjectIds: commonSchemas.uuidArray,
    conflictResolutions: z.record(z.any()).optional(),
    autoMerge: commonSchemas.optionalBoolean.default(false),
  }),

  // Project search and filtering
  projectSearch: z.object({
    q: commonSchemas.optionalShortString,
    stage: z.enum(['future', 'pre_construction', 'construction', 'archived']).optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    patch_id: commonSchemas.optionalUuid,
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    sortBy: z.enum(['name', 'created_at', 'value', 'stage']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
}

// Employer-specific schemas
export const employerSchemas = {
  // Core employer data
  createEmployer: z.object({
    name: commonSchemas.shortString,
    abn: z.string().regex(/^\d{11}$/, 'ABN must be exactly 11 digits').optional(),
    contact_name: commonSchemas.shortString.optional(),
    contact_phone: commonSchemas.phone.optional(),
    contact_email: commonSchemas.email.optional(),
    address: commonSchemas.mediumString.optional(),
    website: z.string().url().optional().or(z.literal('')),
    industry: commonSchemas.shortString.optional(),
    notes: commonSchemas.longString.optional(),
  }),

  // Employer merge operations
  mergeEmployers: z.object({
    canonicalEmployerId: commonSchemas.uuid,
    mergeEmployerIds: commonSchemas.uuidArray,
    conflictResolutions: z.record(z.any()).optional(),
    autoMerge: commonSchemas.optionalBoolean.default(false),
  }),

  // EBA status updates
  updateEbaStatus: z.object({
    employerId: commonSchemas.uuid,
    ebaStatus: z.enum(['yes', 'no', 'pending']),
    ebaExpiryDate: commonSchemas.optionalDateString,
    certifiedDate: commonSchemas.optionalDateString,
    notes: commonSchemas.optionalMediumString,
  }),

  // Employer search
  employerSearch: z.object({
    q: commonSchemas.optionalShortString,
    abn: z.string().regex(/^\d{11}$/).optional(),
    industry: commonSchemas.optionalShortString,
    ebaStatus: z.enum(['yes', 'no', 'pending']).optional(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
  }),
}

// Assessment-specific schemas
export const assessmentSchemas = {
  // Safety assessment (4-point system)
  safetyAssessment: z.object({
    employer_id: commonSchemas.uuid,
    project_id: commonSchemas.optionalUuid,
    criteria: z.object({
      site_safety: commonSchemas.rating,
      safety_procedures: commonSchemas.rating,
      incident_reporting: commonSchemas.rating,
    }),
    confidence_level: z.enum(['very_high', 'high', 'medium', 'low']).default('medium'),
    assessment_method: z.enum([
      'site_visit', 'phone_call', 'safety_meeting',
      'worker_interview', 'document_review', 'other'
    ]).default('site_visit'),
    notes: commonSchemas.optionalLongString,
    evidence_urls: z.array(z.string().url()).optional(),
    follow_up_required: commonSchemas.optionalBoolean.default(false),
    follow_up_date: commonSchemas.optionalDateString,
  }),

  // Assessment search parameters
  assessmentSearch: z.object({
    employerId: commonSchemas.optionalUuid,
    projectId: commonSchemas.optionalUuid,
    assessorId: commonSchemas.optionalUuid,
    confidenceLevel: z.enum(['very_high', 'high', 'medium', 'low']).optional(),
    assessmentMethod: z.enum([
      'site_visit', 'phone_call', 'safety_meeting',
      'worker_interview', 'document_review', 'other'
    ]).optional(),
    minRating: z.number().min(1).max(4).optional(),
    maxRating: z.number().min(1).max(4).optional(),
    followUpRequired: z.boolean().optional(),
    dateFrom: commonSchemas.optionalDateString,
    dateTo: commonSchemas.optionalDateString,
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
  }),

  // Union respect assessment
  unionRespectAssessment: z.object({
    employer_id: commonSchemas.uuid,
    project_id: commonSchemas.optionalUuid,
    criteria: z.object({
      respect_delegates: commonSchemas.rating,
      union_rights: commonSchemas.rating,
      worker_treatment: commonSchemas.rating,
    }),
    confidence_level: z.enum(['very_high', 'high', 'medium', 'low']).default('medium'),
    assessment_method: z.enum([
      'site_visit', 'phone_call', 'union_meeting',
      'worker_interview', 'document_review', 'other'
    ]).default('site_visit'),
    notes: commonSchemas.optionalLongString,
    follow_up_required: commonSchemas.optionalBoolean.default(false),
    follow_up_date: commonSchemas.optionalDateString,
  }),

  // Subcontractor assessment
  subcontractorAssessment: z.object({
    employer_id: commonSchemas.uuid,
    project_id: commonSchemas.optionalUuid,
    criteria: z.object({
      payment_terms: commonSchemas.rating,
      contract_fairness: commonSchemas.rating,
      communication: commonSchemas.rating,
    }),
    confidence_level: z.enum(['very_high', 'high', 'medium', 'low']).default('medium'),
    assessment_method: z.enum([
      'site_visit', 'phone_call', 'contractor_meeting',
      'worker_interview', 'document_review', 'other'
    ]).default('site_visit'),
    notes: commonSchemas.optionalLongString,
    follow_up_required: commonSchemas.optionalBoolean.default(false),
    follow_up_date: commonSchemas.optionalDateString,
  }),
}

// User and profile schemas
export const userSchemas = {
  // Profile updates
  updateProfile: z.object({
    full_name: commonSchemas.optionalShortString,
    phone: commonSchemas.phone.optional(),
    email: commonSchemas.email.optional(),
    role: z.enum(['admin', 'lead_organiser', 'organiser', 'delegate', 'viewer']).optional(),
  }),

  // Patch assignments
  assignPatch: z.object({
    userId: commonSchemas.uuid,
    patchId: commonSchemas.uuid,
    role: z.enum(['organiser', 'lead_organiser']),
  }),

  // Pending user activation
  activatePendingUser: z.object({
    pendingUserId: commonSchemas.uuid,
    firstName: commonSchemas.shortString,
    surname: commonSchemas.shortString,
    email: commonSchemas.email,
    phone: commonSchemas.phone.optional(),
    role: z.enum(['admin', 'lead_organiser', 'organiser', 'delegate', 'viewer']),
    patchIds: z.array(commonSchemas.uuid).optional(),
  }),
}

// System and admin schemas
export const systemSchemas = {
  // View refresh operations
  refreshViews: z.object({
    views: z.array(z.string()).optional(),
    force: commonSchemas.optionalBoolean.default(false),
  }),

  // Bulk operations
  bulkOperation: z.object({
    operation: z.enum(['approve', 'reject', 'merge', 'delete']),
    targetIds: commonSchemas.uuidArray,
    parameters: z.record(z.any()).optional(),
    confirm: z.boolean().refine(val => val === true, {
      message: 'Confirmation required for bulk operations'
    }),
  }),

  // Rating weight updates
  updateRatingWeights: z.object({
    weights: z.record(z.number().min(0).max(1)),
    sector: z.string().optional(),
  }),
}

// Export all schemas for easy importing
export const schemas = {
  common: commonSchemas,
  project: projectSchemas,
  employer: employerSchemas,
  assessment: assessmentSchemas,
  user: userSchemas,
  system: systemSchemas,
}

// Type exports for use in components and other files
export type ProjectCreateInput = z.infer<typeof projectSchemas.createProject>
export type EmployerCreateInput = z.infer<typeof employerSchemas.createEmployer>
export type SafetyAssessmentInput = z.infer<typeof assessmentSchemas.safetyAssessment>
export type UnionRespectAssessmentInput = z.infer<typeof assessmentSchemas.unionRespectAssessment>
export type SubcontractorAssessmentInput = z.infer<typeof assessmentSchemas.subcontractorAssessment>
export type UserProfileInput = z.infer<typeof userSchemas.updateProfile>
export type ApproveProjectInput = z.infer<typeof projectSchemas.approveProject>
export type MergeProjectsInput = z.infer<typeof projectSchemas.mergeProjects>
export type MergeEmployersInput = z.infer<typeof employerSchemas.mergeEmployers>