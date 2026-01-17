import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

interface ClaimProjectRequest {
  notes?: string;
}

interface ClaimProjectResponse {
  success: boolean;
  claimId: string;
  projectId: string;
  projectName: string;
}

interface ProjectAccessCheck {
  has_access: boolean;
  access_reason: string;
  is_claimable: boolean;
  assigned_to_names: string[] | null;
  patch_name: string | null;
}

/**
 * POST /api/projects/[projectId]/claim
 * Claim an unassigned project for the current user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    
    let body: ClaimProjectRequest = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // Create server-side Supabase client
    const supabase = await createServerSupabase();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[claim] Failed to load user profile:', profileError);
      return NextResponse.json(
        { error: 'Unable to load user profile' },
        { status: 500 }
      );
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json(
        { error: 'Only organisers, lead organisers, and admins can claim projects' },
        { status: 403 }
      );
    }

    // Use service role to check project access (bypasses RLS for the check)
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceSupabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if project exists and get its name
    const { data: project, error: projectError } = await serviceSupabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[claim] Project not found:', projectError);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check access status using our RPC function
    const { data: accessCheck, error: accessError } = await serviceSupabase
      .rpc('check_project_access', { p_project_id: projectId })
      .single<ProjectAccessCheck>();

    if (accessError) {
      console.error('[claim] Failed to check project access:', accessError);
      return NextResponse.json(
        { error: 'Failed to check project access' },
        { status: 500 }
      );
    }

    // If user already has access, no need to claim
    if (accessCheck?.has_access) {
      return NextResponse.json(
        {
          error: 'You already have access to this project',
          reason: accessCheck.access_reason,
        },
        { status: 400 }
      );
    }

    // If project is not claimable (assigned to other organisers), deny
    if (!accessCheck?.is_claimable) {
      const assignedNames = accessCheck?.assigned_to_names?.join(', ') || 'other organisers';
      return NextResponse.json(
        {
          error: `This project is assigned to ${assignedNames}. You cannot claim it.`,
          assigned_to: accessCheck?.assigned_to_names,
          patch_name: accessCheck?.patch_name,
        },
        { status: 403 }
      );
    }

    // Check if user already has an active claim (shouldn't happen, but safety check)
    const { data: existingClaim, error: existingClaimError } = await serviceSupabase
      .from('organiser_project_claims')
      .select('id')
      .eq('organiser_id', user.id)
      .eq('project_id', projectId)
      .is('released_at', null)
      .maybeSingle();

    if (existingClaimError) {
      console.error('[claim] Failed to check existing claims:', existingClaimError);
    }

    if (existingClaim) {
      return NextResponse.json(
        { error: 'You already have an active claim on this project' },
        { status: 400 }
      );
    }

    // Create the claim
    const { data: claim, error: claimError } = await serviceSupabase
      .from('organiser_project_claims')
      .insert({
        organiser_id: user.id,
        project_id: projectId,
        created_by: user.id,
        notes: body.notes || null,
      })
      .select('id')
      .single();

    if (claimError) {
      console.error('[claim] Failed to create claim:', claimError);
      return NextResponse.json(
        { error: 'Failed to claim project' },
        { status: 500 }
      );
    }

    console.log(
      `[claim] User ${profile?.full_name} (${user.id}) claimed project ${project.name} (${projectId})`
    );

    const response: ClaimProjectResponse = {
      success: true,
      claimId: claim.id,
      projectId: projectId,
      projectName: project.name,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[claim] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/claim
 * Release a claim on a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;

    // Create server-side Supabase client
    const supabase = await createServerSupabase();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Release the claim by setting released_at
    const { data: claim, error: claimError } = await supabase
      .from('organiser_project_claims')
      .update({ released_at: new Date().toISOString() })
      .eq('organiser_id', user.id)
      .eq('project_id', projectId)
      .is('released_at', null)
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('[claim] Failed to release claim:', claimError);
      return NextResponse.json(
        { error: 'Failed to release claim' },
        { status: 500 }
      );
    }

    if (!claim) {
      return NextResponse.json(
        { error: 'No active claim found for this project' },
        { status: 404 }
      );
    }

    console.log(`[claim] User ${user.id} released claim on project ${projectId}`);

    return NextResponse.json({ success: true, claimId: claim.id });
  } catch (error) {
    console.error('[claim] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
