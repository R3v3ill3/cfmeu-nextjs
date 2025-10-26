import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Types for employer alias operations
interface EmployerAlias {
  id: string;
  alias: string;
  alias_normalized: string;
  employer_id: string;
  created_at: string;
  created_by: string | null;
  source_system: string | null;
  source_identifier: string | null;
  collected_at: string | null;
  collected_by: string | null;
  is_authoritative: boolean;
  notes: string | null;
}

interface CreateEmployerAliasRequest {
  alias: string;
  employer_id: string;
  source_system?: string;
  source_identifier?: string;
  is_authoritative?: boolean;
  notes?: string;
  created_by?: string;
}

// Server-side implementation of getEmployerAliases
async function getEmployerAliases(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  includeInactive: boolean = false
): Promise<{ success: boolean; data?: EmployerAlias[]; error?: string }> {
  try {
    let query = supabase
      .from('employer_aliases')
      .select('*')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employer aliases:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error fetching employer aliases:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Server-side implementation of createEmployerAlias
async function createEmployerAlias(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  request: CreateEmployerAliasRequest
): Promise<{ success: boolean; data?: EmployerAlias; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employer_aliases')
      .insert({
        alias: request.alias,
        employer_id: request.employer_id,
        source_system: request.source_system || 'manual',
        source_identifier: request.source_identifier || request.alias,
        is_authoritative: Boolean(request.is_authoritative),
        notes: request.notes || null,
        created_by: request.created_by || null,
        alias_normalized: request.alias.toLowerCase().trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error creating employer alias:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Server-side implementation of validateAliasUniqueness
async function validateAliasUniqueness(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  alias: string,
  employerId: string
): Promise<{ success: boolean; isUnique?: boolean; error?: string }> {
  try {
    const normalizedAlias = alias.toLowerCase().trim();

    const { data: existing, error } = await supabase
      .from('employer_aliases')
      .select('id')
      .eq('employer_id', employerId)
      .eq('alias_normalized', normalizedAlias)
      .maybeSingle();

    if (error) {
      console.error('Error checking alias uniqueness:', error);
      return { success: false, error: error.message };
    }

    return { success: true, isUnique: !existing };
  } catch (error) {
    console.error('Unexpected error validating alias uniqueness:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// GET /api/employers/[employerId]/aliases - List all aliases for an employer
async function getAliasesHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const startTime = Date.now();
    const supabase = await createServerSupabase();

    // Validate employer ID format to prevent database errors
    const { employerId } = params;
    if (!employerId || typeof employerId !== 'string' || employerId.length < 10) {
      return NextResponse.json({ error: 'Invalid employer ID' }, { status: 400 });
    }

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

    const employerId = params.employerId;
    if (!employerId) {
      return NextResponse.json({ error: 'Employer ID is required' }, { status: 400 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Fetch aliases with timeout to prevent cascading failures
    const fetchStartTime = Date.now();
    const { success, data, error } = await getEmployerAliases(supabase, employerId, includeInactive);
    const fetchDuration = Date.now() - fetchStartTime;

    if (!success) {
      console.error('Failed to fetch employer aliases:', error, {
        employerId,
        duration: fetchDuration,
        totalDuration: Date.now() - startTime
      });
      return NextResponse.json({ error: 'Failed to fetch aliases' }, { status: 500 });
    }

    // Log slow queries for monitoring
    if (fetchDuration > 1000) {
      console.warn('Slow employer aliases query detected:', {
        employerId,
        duration: fetchDuration,
        aliasCount: (data || []).length
      });
    }

    const response = {
      success: true,
      employer: {
        id: employer.id,
        name: employer.name
      },
      data: data || [],
      aliases: data || [], // Keep for backward compatibility
      count: (data || []).length,
      timing: {
        fetch: fetchDuration,
        total: Date.now() - startTime
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in GET /api/employers/[id]/aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/employers/[employerId]/aliases - Create new alias for employer
async function createAliasHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const startTime = Date.now();
    const supabase = await createServerSupabase();

    // Validate employer ID format to prevent database errors
    const { employerId } = params;
    if (!employerId || typeof employerId !== 'string' || employerId.length < 10) {
      return NextResponse.json({ error: 'Invalid employer ID' }, { status: 400 });
    }

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

    const employerId = params.employerId;
    if (!employerId) {
      return NextResponse.json({ error: 'Employer ID is required' }, { status: 400 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { alias, source_system, source_identifier, is_authoritative, notes } = body;

    if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
      return NextResponse.json({ error: 'Alias is required and must be a non-empty string' }, { status: 400 });
    }

    const aliasRequest: CreateEmployerAliasRequest = {
      alias: alias.trim(),
      employer_id: employerId,
      source_system: source_system || 'manual',
      source_identifier: source_identifier || alias.trim(),
      is_authoritative: Boolean(is_authoritative),
      notes: notes || null,
      created_by: user.id
    };

    // Validate alias uniqueness
    const { success: validationSuccess, isUnique, error: validationError } = await validateAliasUniqueness(
      supabase,
      aliasRequest.alias,
      employerId
    );

    if (!validationSuccess) {
      return NextResponse.json({ error: 'Failed to validate alias' }, { status: 500 });
    }

    if (!isUnique) {
      return NextResponse.json({ error: validationError || 'This alias already exists for this employer' }, { status: 409 });
    }

    // Create the alias
    const { success, data, error } = await createEmployerAlias(supabase, aliasRequest);

    if (!success) {
      console.error('Failed to create employer alias:', error);
      return NextResponse.json({ error: error || 'Failed to create alias' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alias created successfully',
      alias: data
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/employers/[id]/aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export the handlers with rate limiting
export const GET = withRateLimit(getAliasesHandler, RATE_LIMIT_PRESETS.DEFAULT);
export const POST = withRateLimit(createAliasHandler, RATE_LIMIT_PRESETS.DEFAULT);

// DELETE handler for individual alias will be in /api/employers/[id]/aliases/[aliasId]/route.ts