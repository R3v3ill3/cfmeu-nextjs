import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// Server-side implementation of deleteEmployerAlias
async function deleteEmployerAlias(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  aliasId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employer_aliases')
      .delete()
      .eq('id', aliasId);

    if (error) {
      console.error('Error deleting employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting employer alias:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Server-side implementation of updateEmployerAlias
async function updateEmployerAlias(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  aliasId: string,
  updates: any,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // If updating the alias itself, also update the normalized version
    if (updates.alias) {
      updates.alias_normalized = updates.alias.toLowerCase().trim();
    }

    const { data, error } = await supabase
      .from('employer_aliases')
      .update(updates)
      .eq('id', aliasId)
      .select()
      .single();

    if (error) {
      console.error('Error updating employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error updating employer alias:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// DELETE /api/employers/[employerId]/aliases/[aliasId] - Delete specific alias
async function deleteAliasHandler(
  request: NextRequest,
  { params }: { params: { employerId: string; aliasId: string } }
) {
  try {
    const startTime = Date.now();
    const supabase = await createServerSupabase();

    // Validate employer and alias ID formats to prevent database errors
    const { employerId, aliasId } = params;
    if (!employerId || typeof employerId !== 'string' || employerId.length < 10) {
      return NextResponse.json({ error: 'Invalid employer ID' }, { status: 400 });
    }
    if (!aliasId || typeof aliasId !== 'string' || aliasId.length < 10) {
      return NextResponse.json({ error: 'Invalid alias ID' }, { status: 400 });
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

    const { employerId, aliasId } = params;

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
    const { success, error } = await deleteEmployerAlias(supabase, aliasId, user.id);

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

// PATCH /api/employers/[employerId]/aliases/[aliasId] - Update specific alias
async function updateAliasHandler(
  request: NextRequest,
  { params }: { params: { employerId: string; aliasId: string } }
) {
  try {
    const startTime = Date.now();
    const supabase = await createServerSupabase();

    // Validate employer and alias ID formats to prevent database errors
    const { employerId, aliasId } = params;
    if (!employerId || typeof employerId !== 'string' || employerId.length < 10) {
      return NextResponse.json({ error: 'Invalid employer ID' }, { status: 400 });
    }
    if (!aliasId || typeof aliasId !== 'string' || aliasId.length < 10) {
      return NextResponse.json({ error: 'Invalid alias ID' }, { status: 400 });
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

    const { employerId, aliasId } = params;

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
    const { success, data, error } = await updateEmployerAlias(supabase, aliasId, updates, user.id);

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

// Export the handlers directly (rate limiting wrapper incompatible with dynamic params)
export const DELETE = deleteAliasHandler;
export const PATCH = updateAliasHandler;