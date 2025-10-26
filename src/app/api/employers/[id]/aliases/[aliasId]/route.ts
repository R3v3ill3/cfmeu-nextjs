import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { deleteEmployerAlias, updateEmployerAlias } from '@/lib/database/employerOperations';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// DELETE /api/employers/[id]/aliases/[aliasId] - Delete specific alias
async function deleteAliasHandler(
  request: NextRequest,
  { params }: { params: { id: string; aliasId: string } }
) {
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

    const { id: employerId, aliasId } = params;

    if (!employerId || !aliasId) {
      return NextResponse.json({ error: 'Employer ID and Alias ID are required' }, { status: 400 });
    }

    // Verify that the alias belongs to the specified employer
    const { data: alias, error: aliasError } = await supabase
      .from('employer_aliases')
      .select('id, employer_id, alias')
      .eq('id', aliasId)
      .eq('employer_id', employerId)
      .single();

    if (aliasError || !alias) {
      return NextResponse.json({ error: 'Alias not found or does not belong to this employer' }, { status: 404 });
    }

    // Delete the alias
    const { success, error } = await deleteEmployerAlias(aliasId, user.id);

    if (!success) {
      console.error('Failed to delete employer alias:', error);
      return NextResponse.json({ error: error || 'Failed to delete alias' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alias deleted successfully',
      deleted_alias: {
        id: alias.id,
        alias: alias.alias
      }
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/employers/[id]/aliases/[aliasId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/employers/[id]/aliases/[aliasId] - Update specific alias
async function updateAliasHandler(
  request: NextRequest,
  { params }: { params: { id: string; aliasId: string } }
) {
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

    const { id: employerId, aliasId } = params;

    if (!employerId || !aliasId) {
      return NextResponse.json({ error: 'Employer ID and Alias ID are required' }, { status: 400 });
    }

    // Verify that the alias belongs to the specified employer
    const { data: alias, error: aliasError } = await supabase
      .from('employer_aliases')
      .select('id, employer_id, alias')
      .eq('id', aliasId)
      .eq('employer_id', employerId)
      .single();

    if (aliasError || !alias) {
      return NextResponse.json({ error: 'Alias not found or does not belong to this employer' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { alias: newAlias, is_authoritative, notes } = body;

    // Validate update data
    const updates: any = {};
    if (newAlias !== undefined) {
      if (typeof newAlias !== 'string' || newAlias.trim().length === 0) {
        return NextResponse.json({ error: 'Alias must be a non-empty string if provided' }, { status: 400 });
      }
      updates.alias = newAlias.trim();
    }

    if (is_authoritative !== undefined) {
      updates.is_authoritative = Boolean(is_authoritative);
    }

    if (notes !== undefined) {
      updates.notes = notes === null ? null : String(notes);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'At least one field must be provided for update' }, { status: 400 });
    }

    // Update the alias
    const { success, data, error } = await updateEmployerAlias(aliasId, updates, user.id);

    if (!success) {
      console.error('Failed to update employer alias:', error);
      return NextResponse.json({ error: error || 'Failed to update alias' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alias updated successfully',
      alias: data
    });

  } catch (error) {
    console.error('Unexpected error in PATCH /api/employers/[id]/aliases/[aliasId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export the handlers with rate limiting
export const DELETE = withRateLimit(deleteAliasHandler, RATE_LIMIT_PRESETS.DEFAULT);
export const PATCH = withRateLimit(updateAliasHandler, RATE_LIMIT_PRESETS.DEFAULT);