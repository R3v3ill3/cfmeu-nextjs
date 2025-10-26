import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { bulkCreateAliases, bulkUpdateAliases, bulkDeleteAliases } from '@/lib/database/bulkAliasOperations';
import type { CreateEmployerAliasRequest, BulkUpdateAliasesRequest } from '@/lib/database/employerOperations';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// POST /api/employers/bulk-aliases - Create multiple aliases
async function bulkCreateHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { aliases, skip_duplicates = true, batch_size = 50 } = body;

    if (!Array.isArray(aliases) || aliases.length === 0) {
      return NextResponse.json({ error: 'Aliases array is required and must not be empty' }, { status: 400 });
    }

    // Validate alias structure
    const validationErrors: string[] = [];
    aliases.forEach((alias, index) => {
      if (!alias.alias || typeof alias.alias !== 'string' || alias.alias.trim().length === 0) {
        validationErrors.push(`Alias ${index + 1}: alias is required and must be a non-empty string`);
      }
      if (!alias.employer_id || typeof alias.employer_id !== 'string') {
        validationErrors.push(`Alias ${index + 1}: employer_id is required and must be a string`);
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Validate that all employers exist (batch check)
    const employerIds = [...new Set(aliases.map(a => a.employer_id))];
    const { data: employers, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .in('id', employerIds);

    if (employerError) {
      console.error('Error validating employers:', employerError);
      return NextResponse.json({ error: 'Failed to validate employers' }, { status: 500 });
    }

    const existingEmployerIds = new Set((employers || []).map(e => e.id));
    const missingEmployerIds = employerIds.filter(id => !existingEmployerIds.has(id));

    if (missingEmployerIds.length > 0) {
      return NextResponse.json({
        error: 'Some employers not found',
        missing_employer_ids: missingEmployerIds
      }, { status: 404 });
    }

    // Prepare alias requests
    const aliasRequests: CreateEmployerAliasRequest[] = aliases.map(alias => ({
      alias: alias.alias.trim(),
      employer_id: alias.employer_id,
      source_system: alias.source_system || 'bulk_import',
      source_identifier: alias.source_identifier || alias.alias.trim(),
      is_authoritative: Boolean(alias.is_authoritative),
      notes: alias.notes || null,
      created_by: user.id
    }));

    // Process bulk creation
    const result = await bulkCreateAliases(aliasRequests, {
      batchSize: Math.min(batch_size, 100), // Cap at 100 for performance
      skipDuplicates: skip_duplicates,
      validateBeforeInsert: true,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${result.totalProcessed} aliases`,
      summary: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount
      },
      successful: result.successful,
      failed: result.failed,
      skipped: result.skipped
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/employers/bulk-aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/employers/bulk-aliases - Update multiple aliases
async function bulkUpdateHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { updates, batch_size = 50 } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required and must not be empty' }, { status: 400 });
    }

    // Validate update structure
    const validationErrors: string[] = [];
    updates.forEach((update, index) => {
      if (!update.id || typeof update.id !== 'string') {
        validationErrors.push(`Update ${index + 1}: id is required and must be a string`);
      }
      if (update.alias !== undefined && (typeof update.alias !== 'string' || update.alias.trim().length === 0)) {
        validationErrors.push(`Update ${index + 1}: alias must be a non-empty string if provided`);
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    const updateRequest: BulkUpdateAliasesRequest = { updates };

    // Process bulk update
    const result = await bulkUpdateAliases(updateRequest, {
      batchSize: Math.min(batch_size, 100),
      validateBeforeUpdate: true,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${result.totalProcessed} alias updates`,
      summary: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount
      },
      successful: result.successful,
      failed: result.failed
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/employers/bulk-aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/employers/bulk-aliases - Delete multiple aliases
async function bulkDeleteHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { alias_ids, batch_size = 50 } = body;

    if (!Array.isArray(alias_ids) || alias_ids.length === 0) {
      return NextResponse.json({ error: 'Alias IDs array is required and must not be empty' }, { status: 400 });
    }

    // Validate alias IDs
    const validationErrors: string[] = [];
    alias_ids.forEach((id, index) => {
      if (!id || typeof id !== 'string') {
        validationErrors.push(`Alias ID ${index + 1}: must be a non-empty string`);
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Process bulk deletion
    const result = await bulkDeleteAliases(alias_ids, {
      batchSize: Math.min(batch_size, 100),
      validateBeforeDelete: true,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${result.totalProcessed} alias deletions`,
      summary: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount
      },
      successful: result.successful,
      failed: result.failed
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/employers/bulk-aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export the handlers with rate limiting
export const POST = withRateLimit(bulkCreateHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY);
export const PUT = withRateLimit(bulkUpdateHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY);
export const DELETE = withRateLimit(bulkDeleteHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY);