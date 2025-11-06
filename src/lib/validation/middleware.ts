/**
 * Validation Middleware for API Routes
 *
 * Provides standardized validation and error handling for Next.js API routes
 * with helpful error messages for internal users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  field?: string
  details?: any
}

export interface ValidationOptions {
  requireAuth?: boolean
  requiredRoles?: Array<'admin' | 'lead_organiser' | 'organiser' | 'delegate' | 'viewer'>
  skipValidation?: boolean
  returnValidationErrors?: boolean // For development/debugging
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()

    // If validation is explicitly skipped, return raw data
    if (options.skipValidation) {
      return { success: true, data: body }
    }

    const result = schema.parse(body)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0]
      const field = firstError?.path.join('.')
      const message = formatZodError(firstError)

      return {
        success: false,
        error: message,
        field,
        details: options.returnValidationErrors ? error.errors : undefined
      }
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: 'Invalid JSON format in request body'
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }
  }
}

/**
 * Validates URL query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    // Convert URLSearchParams to plain object
    const params: Record<string, any> = {}

    for (const [key, value] of searchParams.entries()) {
      // Handle array parameters (e.g., ?id=1&id=2)
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value)
        } else {
          params[key] = [params[key], value]
        }
      } else {
        params[key] = value
      }
    }

    // Type conversion for common fields
    if (params.page) params.page = parseInt(params.page, 10)
    if (params.pageSize) params.pageSize = parseInt(params.pageSize, 10)
    if (params.limit) params.limit = parseInt(params.limit, 10)
    if (params.offset) params.offset = parseInt(params.offset, 10)
    if (params.autoMerge) params.autoMerge = params.autoMerge === 'true'
    if (params.force) params.force = params.force === 'true'

    const result = schema.parse(params)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0]
      const field = firstError?.path.join('.')
      const message = formatZodError(firstError)

      return {
        success: false,
        error: message,
        field,
        details: options.returnValidationErrors ? error.errors : undefined
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query parameter validation failed'
    }
  }
}

/**
 * Validates user authentication and roles
 */
export async function validateUserAuth(
  request: NextRequest,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required - please log in',
        field: 'auth'
      }
    }

    // If no role validation required, return basic user info
    if (!options.requiredRoles || options.requiredRoles.length === 0) {
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email
        }
      }
    }

    // Check user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        error: 'User profile not found',
        field: 'profile'
      }
    }

    if (!options.requiredRoles.includes(profile.role as any)) {
      const rolesList = options.requiredRoles.join(', ')
      return {
        success: false,
        error: `Access denied. Required role: ${rolesList}. Current role: ${profile.role}`,
        field: 'role'
      }
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: profile.role,
        full_name: profile.full_name
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Authentication validation failed',
      details: error instanceof Error ? error.message : undefined
    }
  }
}

/**
 * Comprehensive validation function that combines body, query, and auth validation
 */
export async function validateRequest<T = any>(
  request: NextRequest,
  schema?: ZodSchema<T>,
  options: ValidationOptions = {}
): Promise<ValidationResult & { user?: any }> {
  const results = {
    success: true,
    data: {} as any,
    user: undefined as any,
    error: undefined as string | undefined,
    field: undefined as string | undefined,
    details: undefined as any
  }

  // Validate authentication first if required
  if (options.requireAuth !== false) {
    const authResult = await validateUserAuth(request, options)
    if (!authResult.success) {
      return {
        ...authResult,
        success: false
      }
    }
    results.user = authResult.data
  }

  // Validate request body if schema provided
  if (schema) {
    const bodyResult = await validateRequestBody(request, schema, options)
    if (!bodyResult.success) {
      return {
        ...bodyResult,
        success: false
      }
    }
    results.data = bodyResult.data
  }

  return results
}

/**
 * Creates a standardized error response
 */
export function createValidationErrorResponse(
  validation: ValidationResult,
  status: number = 400
): NextResponse {
  const response: any = {
    success: false,
    error: validation.error,
    ...(validation.field && { field: validation.field }),
    ...(validation.details && { details: validation.details })
  }

  // Add helpful hints for common validation errors
  if (validation.field === 'auth') {
    response.hint = 'Please log in and try again'
  } else if (validation.field === 'role') {
    response.hint = 'Contact your administrator if you believe you should have access'
  } else if (validation.error?.includes('UUID')) {
    response.hint = 'Ensure you are providing a valid ID from the system'
  } else if (validation.error?.includes('email')) {
    response.hint = 'Please provide a valid email address'
  } else if (validation.error?.includes('phone')) {
    response.hint = 'Please provide a valid phone number with country code'
  }

  return NextResponse.json(response, { status })
}

/**
 * Formats Zod errors into user-friendly messages
 */
function formatZodError(error: any): string {
  if (!error) return 'Validation error'

  const { code, message, path } = error

  // Common error patterns with user-friendly messages
  switch (code) {
    case 'invalid_string':
      if (message.includes('email')) return 'Please provide a valid email address'
      if (message.includes('uuid')) return 'Invalid ID format - must be a valid UUID'
      if (message.includes('datetime')) return 'Please provide a valid date and time'
      return message

    case 'invalid_type':
      const expectedType = message.includes('number') ? 'number' :
                         message.includes('string') ? 'text' :
                         message.includes('boolean') ? 'true/false' : 'value'
      return `Expected ${expectedType} for ${path.join('.')}`

    case 'too_small':
      if (message.includes('string')) return 'Text cannot be empty'
      if (message.includes('number')) return 'Number must be greater than 0'
      if (message.includes('array')) return 'At least one item is required'
      return message

    case 'too_big':
      if (message.includes('string')) return 'Text is too long'
      if (message.includes('number')) return 'Number is too large'
      if (message.includes('array')) return 'Too many items provided'
      return message

    case 'invalid_enum_value':
      return `Invalid option for ${path.join('.')}. ${message.split('.')[1] || 'Please choose from the available options'}`

    default:
      return message || 'Invalid input'
  }
}

/**
 * Higher-order function to wrap API handlers with validation
 */
export function withValidation<T = any>(
  handler: (request: NextRequest, context: { data: T; user: any }) => Promise<NextResponse>,
  schema?: ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const validation = await validateRequest(request, schema, options)

    if (!validation.success) {
      return createValidationErrorResponse(validation)
    }

    try {
      return await handler(request, {
        data: validation.data,
        user: validation.user,
        ...context
      })
    } catch (error) {
      console.error('API handler error:', error)
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Business logic validation helpers specific to CFMEU
 */
export const businessValidation = {
  /**
   * Validates that a project can transition to a new stage
   */
  validateProjectStageTransition: (currentStage: string, newStage: string): ValidationResult => {
    const validTransitions: Record<string, string[]> = {
      'future': ['pre_construction', 'construction'],
      'pre_construction': ['construction'],
      'construction': ['archived'],
      'archived': [] // No transitions from archived
    }

    if (currentStage === newStage) {
      return {
        success: false,
        error: `Project is already in stage: ${newStage}`
      }
    }

    const allowedStages = validTransitions[currentStage] || []
    if (!allowedStages.includes(newStage)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStage} to ${newStage}. Valid transitions: ${allowedStages.join(', ')}`
      }
    }

    return { success: true }
  },

  /**
   * Validates that an employer can be assigned a specific role
   */
  validateEmployerRole: (role: string, employerType?: string): ValidationResult => {
    const validRoles = ['builder', 'head_contractor', 'contractor', 'trade_subcontractor', 'project_manager']

    if (!validRoles.includes(role)) {
      return {
        success: false,
        error: `Invalid employer role. Valid roles: ${validRoles.join(', ')}`
      }
    }

    // Additional business logic can be added here
    if (role === 'builder' && employerType === 'trade_subcontractor') {
      return {
        success: false,
        error: 'Trade subcontractors cannot be assigned as builders'
      }
    }

    return { success: true }
  },

  /**
   * Validates geographic assignments make sense
   */
  validateGeographicAssignment: (userLocation: { lat: number; lng: number },
                                patches: Array<{ id: string; name: string }>): ValidationResult => {
    if (patches.length === 0) {
      return {
        success: false,
        error: 'User must be assigned to at least one geographic patch'
      }
    }

    if (patches.length > 5) {
      return {
        success: false,
        error: 'User cannot be assigned to more than 5 patches for efficiency'
      }
    }

    return { success: true }
  }
}