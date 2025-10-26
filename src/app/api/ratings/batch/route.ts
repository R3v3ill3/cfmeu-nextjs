import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['lead_organiser', 'admin'] as const; // Restricted for batch operations
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface BatchRatingOperation {
  operation_type: 'calculate' | 'recalculate' | 'expire' | 'archive' | 'approve';
  employer_ids: string[];
  parameters?: {
    calculation_date?: string;
    project_weight?: number;
    expertise_weight?: number;
    eba_weight?: number;
    calculation_method?: string;
    force_recalculate?: boolean;
    approval_notes?: string;
  };
}

export interface BatchRatingRequest {
  batch_id?: string;
  operations: BatchRatingOperation[];
  dry_run?: boolean;
  notification_preferences?: {
    email_on_completion?: boolean;
    webhook_url?: string;
  };
}

export interface BatchRatingResponse {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_operations: number;
  completed_operations: number;
  failed_operations: number;
  results: Array<{
    employer_id: string;
    operation_type: string;
    status: 'success' | 'failed' | 'skipped';
    rating_id?: string;
    previous_rating?: string;
    new_rating?: string;
    score_change?: number;
    error_message?: string;
    processing_time_ms: number;
  }>;
  summary: {
    ratings_calculated: number;
    ratings_updated: number;
    ratings_expired: number;
    ratings_archived: number;
    ratings_approved: number;
    total_processing_time_ms: number;
    average_processing_time_ms: number;
  };
  errors: Array<{
    employer_id: string;
    operation: string;
    error_code: string;
    error_message: string;
    timestamp: string;
  }>;
  audit_trail: {
    initiated_by: string;
    initiated_at: string;
    completed_at?: string;
    ip_address: string;
    dry_run: boolean;
  };
}

export interface BatchStatusResponse {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total_operations: number;
    completed_operations: number;
    failed_operations: number;
    percentage_complete: number;
  };
  estimated_completion?: string;
  results?: BatchRatingResponse['results'];
  errors?: BatchRatingResponse['errors'];
  started_at?: string;
  completed_at?: string;
}

// POST handler - Execute batch rating operations
async function executeBatchRatingHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - restricted for batch operations
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, surname')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({
        error: 'Forbidden - only lead organisers and admins can execute batch operations'
      }, { status: 403 });
    }

    // Parse and validate request body
    const body: BatchRatingRequest = await request.json();

    if (!body.operations || !Array.isArray(body.operations) || body.operations.length === 0) {
      return NextResponse.json({ error: 'operations array is required and cannot be empty' }, { status: 400 });
    }

    if (body.operations.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 operations allowed per batch' }, { status: 400 });
    }

    // Validate each operation
    const totalEmployerIds = new Set<string>();
    for (const operation of body.operations) {
      if (!operation.operation_type || !['calculate', 'recalculate', 'expire', 'archive', 'approve'].includes(operation.operation_type)) {
        return NextResponse.json({ error: `Invalid operation_type: ${operation.operation_type}` }, { status: 400 });
      }

      if (!operation.employer_ids || !Array.isArray(operation.employer_ids) || operation.employer_ids.length === 0) {
        return NextResponse.json({ error: 'employer_ids array is required for each operation' }, { status: 400 });
      }

      operation.employer_ids.forEach(employerId => totalEmployerIds.add(employerId));

      // Validate weights if provided
      if (operation.parameters) {
        const { project_weight, expertise_weight, eba_weight } = operation.parameters;
        if (project_weight !== undefined && (project_weight < 0 || project_weight > 1)) {
          return NextResponse.json({ error: 'project_weight must be between 0 and 1' }, { status: 400 });
        }
        if (expertise_weight !== undefined && (expertise_weight < 0 || expertise_weight > 1)) {
          return NextResponse.json({ error: 'expertise_weight must be between 0 and 1' }, { status: 400 });
        }
        if (eba_weight !== undefined && (eba_weight < 0 || eba_weight > 1)) {
          return NextResponse.json({ error: 'eba_weight must be between 0 and 1' }, { status: 400 });
        }
      }
    }

    // Generate batch ID
    const batchId = body.batch_id || crypto.randomUUID();
    const startTime = Date.now();

    // Get client IP for audit trail
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Create batch job record
    const { error: batchError } = await supabase
      .from('rating_batch_jobs')
      .insert({
        id: batchId,
        initiated_by: user.id,
        status: 'processing',
        total_operations: body.operations.reduce((sum, op) => sum + op.employer_ids.length, 0),
        dry_run: body.dry_run || false,
        operations: body.operations,
        notification_preferences: body.notification_preferences,
        ip_address: ipAddress,
        started_at: new Date().toISOString(),
      });

    if (batchError) {
      console.error('Failed to create batch job record:', batchError);
      return NextResponse.json({ error: 'Failed to create batch job' }, { status: 500 });
    }

    // Process operations
    const results: any[] = [];
    const errors: any[] = [];
    let completedOperations = 0;
    let failedOperations = 0;

    const summary = {
      ratings_calculated: 0,
      ratings_updated: 0,
      ratings_expired: 0,
      ratings_archived: 0,
      ratings_approved: 0,
      total_processing_time_ms: 0,
      average_processing_time_ms: 0,
    };

    for (const operation of body.operations) {
      for (const employerId of operation.employer_ids) {
        const operationStartTime = Date.now();

        try {
          // Validate employer exists
          const { data: employer, error: employerError } = await supabase
            .from('employers')
            .select('id, name')
            .eq('id', employerId)
            .single();

          if (employerError || !employer) {
            results.push({
              employer_id: employerId,
              operation_type: operation.operation_type,
              status: 'failed',
              error_message: 'Employer not found',
              processing_time_ms: Date.now() - operationStartTime,
            });
            errors.push({
              employer_id: employerId,
              operation: operation.operation_type,
              error_code: 'EMPLOYER_NOT_FOUND',
              error_message: 'Employer not found',
              timestamp: new Date().toISOString(),
            });
            failedOperations++;
            continue;
          }

          // Skip if dry run
          if (body.dry_run) {
            results.push({
              employer_id: employerId,
              operation_type: operation.operation_type,
              status: 'skipped',
              error_message: 'Dry run - operation skipped',
              processing_time_ms: Date.now() - operationStartTime,
            });
            completedOperations++;
            continue;
          }

          // Execute operation based on type
          let result: any = null;

          switch (operation.operation_type) {
            case 'calculate':
              result = await executeCalculateOperation(supabase, employerId, operation.parameters, user.id);
              if (result.status === 'success') summary.ratings_calculated++;
              break;

            case 'recalculate':
              result = await executeRecalculateOperation(supabase, employerId, operation.parameters, user.id);
              if (result.status === 'success') summary.ratings_updated++;
              break;

            case 'expire':
              result = await executeExpireOperation(supabase, employerId, user.id);
              if (result.status === 'success') summary.ratings_expired++;
              break;

            case 'archive':
              result = await executeArchiveOperation(supabase, employerId, user.id);
              if (result.status === 'success') summary.ratings_archived++;
              break;

            case 'approve':
              result = await executeApproveOperation(supabase, employerId, operation.parameters, user.id);
              if (result.status === 'success') summary.ratings_approved++;
              break;

            default:
              throw new Error(`Unknown operation type: ${operation.operation_type}`);
          }

          result.processing_time_ms = Date.now() - operationStartTime;
          results.push(result);

          if (result.status === 'failed') {
            errors.push({
              employer_id: employerId,
              operation: operation.operation_type,
              error_code: 'OPERATION_FAILED',
              error_message: result.error_message || 'Operation failed',
              timestamp: new Date().toISOString(),
            });
            failedOperations++;
          } else {
            completedOperations++;
          }

          // Update progress
          const progress = Math.round(((completedOperations + failedOperations) / totalEmployerIds.size) * 100);
          await supabase
            .from('rating_batch_jobs')
            .update({
              completed_operations: completedOperations,
              failed_operations: failedOperations,
              progress_percentage: progress,
            })
            .eq('id', batchId);

        } catch (error) {
          const processingTime = Date.now() - operationStartTime;
          results.push({
            employer_id: employerId,
            operation_type: operation.operation_type,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            processing_time_ms: processingTime,
          });
          errors.push({
            employer_id: employerId,
            operation: operation.operation_type,
            error_code: 'UNKNOWN_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
          failedOperations++;
        }
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    summary.total_processing_time_ms = totalProcessingTime;
    summary.average_processing_time_ms = completedOperations > 0 ? Math.round(totalProcessingTime / completedOperations) : 0;

    // Update batch job record
    const finalStatus = failedOperations === 0 ? 'completed' : 'completed_with_errors';
    await supabase
      .from('rating_batch_jobs')
      .update({
        status: finalStatus,
        completed_operations: completedOperations,
        failed_operations: failedOperations,
        results,
        errors,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    const response: BatchRatingResponse = {
      batch_id: batchId,
      status: finalStatus,
      total_operations: totalEmployerIds.size,
      completed_operations: completedOperations,
      failed_operations: failedOperations,
      results,
      summary,
      errors,
      audit_trail: {
        initiated_by: user.id,
        initiated_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        ip_address: ipAddress,
        dry_run: body.dry_run || false,
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Execute batch rating API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET handler - Get batch job status
async function getBatchStatusHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: 'batchId parameter is required' }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get batch job status
    const { data: batchJob, error: batchError } = await supabase
      .from('rating_batch_jobs')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batchJob) {
      return NextResponse.json({ error: 'Batch job not found' }, { status: 404 });
    }

    // Calculate progress
    const totalOperations = batchJob.total_operations || 0;
    const completedOperations = batchJob.completed_operations || 0;
    const failedOperations = batchJob.failed_operations || 0;
    const percentageComplete = totalOperations > 0 ? Math.round(((completedOperations + failedOperations) / totalOperations) * 100) : 0;

    // Estimate completion time for processing jobs
    let estimatedCompletion: string | undefined;
    if (batchJob.status === 'processing' && batchJob.started_at && percentageComplete > 0) {
      const elapsed = Date.now() - new Date(batchJob.started_at).getTime();
      const estimatedTotal = (elapsed / percentageComplete) * 100;
      const remaining = estimatedTotal - elapsed;
      estimatedCompletion = new Date(Date.now() + remaining).toISOString();
    }

    const response: BatchStatusResponse = {
      batch_id: batchJob.id,
      status: batchJob.status,
      progress: {
        total_operations: totalOperations,
        completed_operations: completedOperations,
        failed_operations: failedOperations,
        percentage_complete: percentageComplete,
      },
      estimated_completion: estimatedCompletion,
      results: batchJob.results,
      errors: batchJob.errors,
      started_at: batchJob.started_at,
      completed_at: batchJob.completed_at,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Get batch status API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions for operations
async function executeCalculateOperation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  parameters: any,
  userId: string
): Promise<any> {
  try {
    const calculationDate = parameters?.calculation_date || new Date().toISOString().split('T')[0];

    // Calculate rating
    const { data: calculationResult, error: calculationError } = await supabase
      .rpc('calculate_final_employer_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_project_weight: parameters?.project_weight || 0.6,
        p_expertise_weight: parameters?.expertise_weight || 0.4,
        p_eba_weight: parameters?.eba_weight || 0.15,
        p_calculation_method: parameters?.calculation_method || 'hybrid_method',
      });

    if (calculationError) {
      return {
        employer_id: employerId,
        operation_type: 'calculate',
        status: 'failed',
        error_message: 'Failed to calculate rating',
      };
    }

    // Create rating record
    const { data: ratingId, error: createError } = await supabase
      .rpc('create_or_update_final_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_created_by: userId,
      });

    if (createError) {
      return {
        employer_id: employerId,
        operation_type: 'calculate',
        status: 'failed',
        error_message: 'Failed to save rating',
      };
    }

    return {
      employer_id: employerId,
      operation_type: 'calculate',
      status: 'success',
      rating_id: ratingId,
      new_rating: calculationResult.final_rating,
    };

  } catch (error) {
    return {
      employer_id: employerId,
      operation_type: 'calculate',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeRecalculateOperation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  parameters: any,
  userId: string
): Promise<any> {
  // Similar to calculate but with force_recalculate
  return executeCalculateOperation(supabase, employerId, { ...parameters, force_recalculate: true }, userId);
}

async function executeExpireOperation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  userId: string
): Promise<any> {
  try {
    const { error } = await supabase
      .from('employer_final_ratings')
      .update({
        rating_status: 'archived',
        review_required: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .eq('rating_status', 'active');

    if (error) {
      return {
        employer_id: employerId,
        operation_type: 'expire',
        status: 'failed',
        error_message: 'Failed to expire rating',
      };
    }

    return {
      employer_id: employerId,
      operation_type: 'expire',
      status: 'success',
    };

  } catch (error) {
    return {
      employer_id: employerId,
      operation_type: 'expire',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeArchiveOperation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  userId: string
): Promise<any> {
  try {
    const { error } = await supabase
      .from('employer_final_ratings')
      .update({
        is_active: false,
        rating_status: 'archived',
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('employer_id', employerId)
      .eq('is_active', true);

    if (error) {
      return {
        employer_id: employerId,
        operation_type: 'archive',
        status: 'failed',
        error_message: 'Failed to archive rating',
      };
    }

    return {
      employer_id: employerId,
      operation_type: 'archive',
      status: 'success',
    };

  } catch (error) {
    return {
      employer_id: employerId,
      operation_type: 'archive',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeApproveOperation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  parameters: any,
  userId: string
): Promise<any> {
  try {
    const { error } = await supabase
      .from('employer_final_ratings')
      .update({
        rating_status: 'active',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_notes: parameters?.approval_notes || 'Approved via batch operation',
        review_required: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .is('approved_by', null);

    if (error) {
      return {
        employer_id: employerId,
        operation_type: 'approve',
        status: 'failed',
        error_message: 'Failed to approve rating',
      };
    }

    return {
      employer_id: employerId,
      operation_type: 'approve',
      status: 'success',
    };

  } catch (error) {
    return {
      employer_id: employerId,
      operation_type: 'approve',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export handlers with rate limiting
export const POST = withRateLimit(
  executeBatchRatingHandler,
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

export const GET = withRateLimit(
  getBatchStatusHandler,
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('rating_batch_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Batch-Jobs': count?.toString() || '0',
        'X-Batch-System-Status': 'operational',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}