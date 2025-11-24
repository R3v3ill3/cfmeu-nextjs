// Comprehensive validation utilities for the Employer Traffic Light Rating System API
// This module provides centralized validation logic for all API endpoints

import { NextRequest, NextResponse } from 'next/server';
import type {
  ValidationError,
  ValidationResult,
  TrafficLightRating,
  ComplianceAssessmentType,
  ConfidenceLevel,
  RatingStatus
} from '@/types/rating-api';

// =============================================================================
// VALIDATION CONFIGURATION
// =============================================================================

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'email' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any, context?: any) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

// =============================================================================
// ENUM VALIDATORS
// =============================================================================

export const TRAFFIC_LIGHT_RATINGS: TrafficLightRating[] = ['green', 'amber', 'red', 'unknown'];
export const COMPLIANCE_ASSESSMENT_TYPES: ComplianceAssessmentType[] = [
  'cbus_status',
  'incolink_status',
  'site_visit_report',
  'delegate_report',
  'organiser_verbal_report',
  'organiser_written_report',
  'eca_status',
  'safety_incidents',
  'industrial_disputes',
  'payment_issues'
];
export const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low', 'very_low'];
export const RATING_STATUSES: RatingStatus[] = ['active', 'under_review', 'disputed', 'superseded', 'archived'];
export const UNION_RELATIONSHIP_QUALITIES = ['excellent', 'good', 'neutral', 'poor', 'very_poor'];

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// Track 1: Project Compliance Assessments
export const COMPLIANCE_ASSESSMENT_SCHEMA: ValidationSchema = {
  employer_id: {
    required: true,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateEmployerExists,
  },
  project_id: {
    required: true,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateProjectExists,
  },
  assessment_type: {
    required: true,
    type: 'string',
    enum: COMPLIANCE_ASSESSMENT_TYPES,
  },
  score: {
    type: 'number',
    min: -100,
    max: 100,
    custom: (value: number) => {
      if (value !== null && (value < -100 || value > 100)) {
        return 'Score must be between -100 and 100';
      }
      return null;
    },
  },
  rating: {
    type: 'string',
    enum: TRAFFIC_LIGHT_RATINGS,
    custom: (value: string | null) => {
      if (value !== null && !TRAFFIC_LIGHT_RATINGS.includes(value as TrafficLightRating)) {
        return 'Invalid rating value';
      }
      return null;
    },
  },
  confidence_level: {
    required: true,
    type: 'string',
    enum: CONFIDENCE_LEVELS,
  },
  severity_level: {
    type: 'number',
    min: 1,
    max: 5,
    custom: (value: number) => {
      if (value !== null && (value < 1 || value > 5)) {
        return 'Severity level must be between 1 and 5';
      }
      return null;
    },
  },
  assessment_notes: {
    type: 'string',
    maxLength: 5000,
  },
  assessment_date: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: validateDateNotInFuture,
  },
  evidence_attachments: {
    type: 'array',
    custom: validateEvidenceAttachments,
  },
  follow_up_required: {
    type: 'boolean',
  },
  follow_up_date: {
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: (value: string, context: any) => {
      if (value && context?.follow_up_required) {
        const followUpDate = new Date(value);
        const today = new Date();
        if (followUpDate < today) {
          return 'Follow-up date cannot be in the past';
        }
      }
      return null;
    },
  },
  organiser_id: {
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateOrganiserExists,
  },
  site_visit_id: {
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateSiteVisitExists,
  },
};

// Track 2: Organiser Expertise Ratings
export const EXPERTISE_RATING_SCHEMA: ValidationSchema = {
  employer_id: {
    required: true,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateEmployerExists,
  },
  overall_score: {
    type: 'number',
    min: -100,
    max: 100,
    custom: (value: number) => {
      if (value !== null && (value < -100 || value > 100)) {
        return 'Overall score must be between -100 and 100';
      }
      return null;
    },
  },
  overall_rating: {
    type: 'string',
    enum: TRAFFIC_LIGHT_RATINGS,
    custom: (value: string | null) => {
      if (value !== null && !TRAFFIC_LIGHT_RATINGS.includes(value as TrafficLightRating)) {
        return 'Invalid overall rating value';
      }
      return null;
    },
  },
  confidence_level: {
    required: true,
    type: 'string',
    enum: CONFIDENCE_LEVELS,
  },
  assessment_basis: {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 2000,
  },
  assessment_context: {
    type: 'string',
    maxLength: 5000,
  },
  eba_status_known: {
    type: 'boolean',
  },
  eba_status: {
    type: 'string',
    enum: TRAFFIC_LIGHT_RATINGS,
    custom: (value: string | null, context: any) => {
      if (value && !context?.eba_status_known) {
        return 'EBA status known must be true if EBA status is provided';
      }
      if (value !== null && !TRAFFIC_LIGHT_RATINGS.includes(value as TrafficLightRating)) {
        return 'Invalid EBA status value';
      }
      return null;
    },
  },
  knowledge_beyond_projects: {
    type: 'boolean',
  },
  industry_reputation: {
    type: 'string',
    maxLength: 1000,
  },
  union_relationship_quality: {
    type: 'string',
    enum: UNION_RELATIONSHIP_QUALITIES,
  },
  historical_issues: {
    type: 'array',
    custom: validateHistoricalIssues,
  },
  recent_improvements: {
    type: 'boolean',
  },
  future_concerns: {
    type: 'boolean',
  },
  assessment_notes: {
    type: 'string',
    maxLength: 10000,
  },
  assessment_date: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: validateDateNotInFuture,
  },
  expires_date: {
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: (value: string) => {
      if (value) {
        const expiryDate = new Date(value);
        const today = new Date();
        const minExpiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days minimum
        if (expiryDate < minExpiry) {
          return 'Expiry date must be at least 30 days in the future';
        }
      }
      return null;
    },
  },
};

// Wizard Assessment
export const WIZARD_STEP_SCHEMA: ValidationSchema = {
  wizard_step_id: {
    required: true,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    custom: validateWizardStepExists,
  },
  step_response: {
    required: true,
    type: 'object',
  },
  response_value: {
    type: 'string',
  },
  session_started_at: {
    required: true,
    type: 'string',
    custom: validateTimestamp,
  },
};

// Final Ratings
export const RATING_CALCULATION_SCHEMA: ValidationSchema = {
  calculation_date: {
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: validateDateNotInFuture,
  },
  project_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  expertise_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  eba_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  calculation_method: {
    type: 'string',
    enum: ['weighted_average', 'weighted_sum', 'minimum_score', 'hybrid_method'],
  },
  force_recalculate: {
    type: 'boolean',
  },
  custom_adjustment: {
    type: 'number',
    min: -50,
    max: 50,
  },
  notes: {
    type: 'string',
    maxLength: 1000,
  },
};

// Batch Operations
export const BATCH_OPERATION_SCHEMA: ValidationSchema = {
  operation_type: {
    required: true,
    type: 'string',
    enum: ['calculate', 'recalculate', 'expire', 'archive', 'approve'],
  },
  employer_ids: {
    required: true,
    type: 'array',
    minLength: 1,
    maxLength: 100,
    custom: validateEmployerIdsArray,
  },
  calculation_date: {
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: validateDateNotInFuture,
  },
  project_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  expertise_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  eba_weight: {
    type: 'number',
    min: 0,
    max: 1,
  },
  approval_notes: {
    type: 'string',
    maxLength: 2000,
  },
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export async function validateRequestBody(
  request: NextRequest,
  schema: ValidationSchema
): Promise<{ data: any; errors: ValidationError[] }> {
  try {
    const body = await request.json();
    const validation = validateObject(body, schema);
    return {
      data: body,
      errors: validation.errors,
    };
  } catch (error) {
    return {
      data: null,
      errors: [{
        field: 'body',
        message: error instanceof Error ? error.message : 'Invalid JSON',
        value: null,
      }],
    };
  }
}

export function validateObject(data: any, schema: ValidationSchema, context?: any): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors = validateField(field, value, rule, context, data);
    errors.push(...fieldErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateField(
  fieldName: string,
  value: any,
  rule: ValidationRule,
  context?: any,
  fullObject?: any
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required validation
  if (rule.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value,
      constraint: 'required',
    });
    return errors; // Skip other validations if required field is missing
  }

  // If field is not required and is empty, skip other validations
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  if (rule.type && !validateType(value, rule.type)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be of type ${rule.type}`,
      value,
      constraint: 'type',
    });
  }

  // String validations
  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rule.minLength} characters long`,
        value,
        constraint: 'minLength',
      });
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be no more than ${rule.maxLength} characters long`,
        value,
        constraint: 'maxLength',
      });
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} format is invalid`,
        value,
        constraint: 'pattern',
      });
    }
  }

  // Number validations
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rule.min}`,
        value,
        constraint: 'min',
      });
    }

    if (rule.max !== undefined && value > rule.max) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be no more than ${rule.max}`,
        value,
        constraint: 'max',
      });
    }
  }

  // Array validations
  if (rule.type === 'array' && Array.isArray(value)) {
    if (rule.minLength && value.length < rule.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have at least ${rule.minLength} items`,
        value,
        constraint: 'minLength',
      });
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have no more than ${rule.maxLength} items`,
        value,
        constraint: 'maxLength',
      });
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
      value,
      constraint: 'enum',
    });
  }

  // Custom validation
  if (rule.custom) {
    const customError = rule.custom(value, context || fullObject);
    if (customError) {
      errors.push({
        field: fieldName,
        message: customError,
        value,
        constraint: 'custom',
      });
    }
  }

  return errors;
}

export function validateType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'date':
      return typeof value === 'string' && !isNaN(Date.parse(value));
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'uuid':
      return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    default:
      return true;
  }
}

// =============================================================================
// DATABASE VALIDATION FUNCTIONS (Would be implemented with actual DB calls)
// =============================================================================

export function validateEmployerExists(employerId: string): string | null {
  // In a real implementation, this would check against the database
  // For now, we'll do basic format validation
  if (!employerId || typeof employerId !== 'string') {
    return 'Employer ID is required';
  }
  return null;
}

export function validateProjectExists(projectId: string): string | null {
  if (!projectId || typeof projectId !== 'string') {
    return 'Project ID is required';
  }
  return null;
}

export function validateOrganiserExists(organiserId: string): string | null {
  if (!organiserId || typeof organiserId !== 'string') {
    return 'Organiser ID is required';
  }
  return null;
}

export function validateSiteVisitExists(siteVisitId: string): string | null {
  if (!siteVisitId || typeof siteVisitId !== 'string') {
    return 'Site visit ID is required';
  }
  return null;
}

export function validateWizardStepExists(stepId: string): string | null {
  if (!stepId || typeof stepId !== 'string') {
    return 'Wizard step ID is required';
  }
  return null;
}

export function validateDateNotInFuture(dateString: string): string | null {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison

  if (date > today) {
    return 'Date cannot be in the future';
  }
  return null;
}

export function validateTimestamp(timestampString: string): string | null {
  const timestamp = new Date(timestampString);
  if (isNaN(timestamp.getTime())) {
    return 'Invalid timestamp format';
  }
  return null;
}

export function validateEvidenceAttachments(attachments: any): string | null {
  if (!Array.isArray(attachments)) {
    return 'Evidence attachments must be an array';
  }

  for (const attachment of attachments) {
    if (typeof attachment !== 'string') {
      return 'All evidence attachments must be strings';
    }
    if (attachment.length > 500) {
      return 'Evidence attachment names must be 500 characters or less';
    }
  }

  return null;
}

export function validateHistoricalIssues(issues: any): string | null {
  if (!Array.isArray(issues)) {
    return 'Historical issues must be an array';
  }

  for (const issue of issues) {
    if (typeof issue !== 'string') {
      return 'All historical issues must be strings';
    }
    if (issue.length > 200) {
      return 'Historical issue descriptions must be 200 characters or less';
    }
  }

  return null;
}

export function validateEmployerIdsArray(employerIds: any): string | null {
  if (!Array.isArray(employerIds)) {
    return 'Employer IDs must be an array';
  }

  if (employerIds.length === 0) {
    return 'At least one employer ID is required';
  }

  if (employerIds.length > 100) {
    return 'Maximum 100 employers allowed per batch operation';
  }

  for (const employerId of employerIds) {
    if (typeof employerId !== 'string') {
      return 'All employer IDs must be strings';
    }
  }

  // Check for duplicates
  const uniqueIds = new Set(employerIds);
  if (uniqueIds.size !== employerIds.length) {
    return 'Duplicate employer IDs are not allowed';
  }

  return null;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

export function createValidationError(
  field: string,
  message: string,
  value?: any,
  constraint?: string
): ValidationError {
  return {
    field,
    message,
    value,
    constraint,
  };
}

export function createValidationResponse(
  isValid: boolean,
  errors: ValidationError[],
  warnings?: ValidationError[]
): ValidationResult {
  return {
    isValid,
    errors,
    warnings: warnings || [],
  };
}

export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Validation successful';
  }

  return errors
    .map(error => `${error.field}: ${error.message}`)
    .join('; ');
}

export function sendValidationErrorResponse(errors: ValidationError[]): NextResponse {
  const errorMessages = errors.map(error => ({
    field: error.field,
    message: error.message,
    value: error.value,
  }));

  return NextResponse.json(
    {
      error: 'Validation failed',
      message: formatValidationErrors(errors),
      details: errorMessages,
    },
    { status: 400 }
  );
}

// =============================================================================
// RATE LIMITING VALIDATION
// =============================================================================

export function validateRateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number
): { allowed: boolean; resetTime?: number; remaining?: number } {
  // This would integrate with the existing rate limiting system
  // For now, return a placeholder
  return { allowed: true };
}

// =============================================================================
// AUTHENTICATION VALIDATION
// =============================================================================

export function validateAuthenticationHeader(headers: Headers): {
  isValid: boolean;
  error?: string;
} {
  const authHeader = headers.get('authorization');

  if (!authHeader) {
    return { isValid: false, error: 'Authorization header is required' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Invalid authorization header format' };
  }

  return { isValid: true };
}

// =============================================================================
// SANITIZATION UTILITIES
// =============================================================================

export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Basic HTML sanitization - in production, use a proper library like DOMPurify
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
}

export default {
  // Schemas
  COMPLIANCE_ASSESSMENT_SCHEMA,
  EXPERTISE_RATING_SCHEMA,
  WIZARD_STEP_SCHEMA,
  RATING_CALCULATION_SCHEMA,
  BATCH_OPERATION_SCHEMA,

  // Enums
  TRAFFIC_LIGHT_RATINGS,
  COMPLIANCE_ASSESSMENT_TYPES,
  CONFIDENCE_LEVELS,
  RATING_STATUSES,
  UNION_RELATIONSHIP_QUALITIES,

  // Core validation functions
  validateRequestBody,
  validateObject,
  validateField,
  validateType,

  // Utility functions
  createValidationError,
  createValidationResponse,
  formatValidationErrors,
  sendValidationErrorResponse,
  validateRateLimit,
  validateAuthenticationHeader,
  sanitizeString,
  sanitizeHtml,

  // Database validation functions
  validateEmployerExists,
  validateProjectExists,
  validateOrganiserExists,
  validateSiteVisitExists,
  validateWizardStepExists,
  validateDateNotInFuture,
  validateTimestamp,
  validateEvidenceAttachments,
  validateHistoricalIssues,
  validateEmployerIdsArray,
};