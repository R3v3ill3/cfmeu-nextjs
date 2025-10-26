import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import {
  createEmployerAlias,
  getEmployerAliases,
  deleteEmployerAlias,
  updateEmployerAlias,
  validateAliasUniqueness
} from '@/lib/database/employerOperations';
import type { CreateEmployerAliasRequest } from '@/lib/database/employerOperations';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// GET /api/employers/[id]/aliases - List all aliases for an employer
async function getAliasesHandler(request: NextRequest, { params }: { params: { id: string } }) {
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

    const employerId = params.id;
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

    // Fetch aliases
    const { success, data, error } = await getEmployerAliases(employerId, includeInactive);

    if (!success) {
      console.error('Failed to fetch employer aliases:', error);
      return NextResponse.json({ error: 'Failed to fetch aliases' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      employer: {
        id: employer.id,
        name: employer.name
      },
      aliases: data || [],
      count: (data || []).length
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/employers/[id]/aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/employers/[id]/aliases - Create new alias for employer
async function createAliasHandler(request: NextRequest, { params }: { params: { id: string } }) {
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

    const employerId = params.id;
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
    const { success, data, error } = await createEmployerAlias(aliasRequest);

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