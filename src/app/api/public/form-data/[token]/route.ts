import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public API - uses service role to bypass RLS where needed
// Use same fallback pattern as createServerSupabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabase = createClient(
  supabaseUrl!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PublicFormData {
  token: string;
  resourceType: string;
  resourceId: string;
  project?: {
    id: string;
    name: string;
    value: number | null;
    tier: string | null;
    proposed_start_date: string | null;
    proposed_finish_date: string | null;
    roe_email: string | null;
    project_type: string | null;
    state_funding: number;
    federal_funding: number;
    address: string | null;
  };
  mappingSheetData?: {
    contractorRoles: Array<{
      id: string;
      employerId: string;
      employerName: string;
      roleLabel: string;
      ebaStatus?: boolean | null;
    }>;
    tradeContractors: Array<{
      id: string;
      employerId: string;
      employerName: string;
      tradeLabel: string;
      stage: string;
      ebaStatus?: boolean | null;
    }>;
  };
  employers?: Array<{
    id: string;
    name: string;
    enterprise_agreement_status?: boolean | null;
  }>;
  expiresAt: string;
  allowedActions: string[];
}

export interface PublicFormSubmission {
  // Define the structure for form submissions
  projectUpdates?: {
    name?: string;
    value?: number;
    proposed_start_date?: string;
    proposed_finish_date?: string;
    project_type?: string;
    state_funding?: number;
    federal_funding?: number;
    roe_email?: string;
  };
  addressUpdate?: string;
  contractorUpdates?: Array<{
    id: string;
    employerId: string;
    role: string;
  }>;
}

async function validateToken(token: string) {
  const { data: tokenRecord, error } = await supabase
    .from('secure_access_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !tokenRecord) {
    return { valid: false, error: 'Token not found' };
  }

  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);

  if (expiresAt < now) {
    return { valid: false, error: 'Token has expired' };
  }

  if (tokenRecord.used_at) {
    // For now, allow multiple uses. Could be changed to single-use if needed
    // return { valid: false, error: 'Token has already been used' };
  }

  return { valid: true, tokenRecord };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Validate token
    const validation = await validateToken(token);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 404 });
    }

    const tokenRecord = validation.tokenRecord!;
    const { resource_type, resource_id } = tokenRecord;

    // Prepare response data based on resource type
    let formData: PublicFormData = {
      token,
      resourceType: resource_type,
      resourceId: resource_id,
      expiresAt: tokenRecord.expires_at,
      allowedActions: ['view', 'update'],
    };

    if (resource_type === 'PROJECT_MAPPING_SHEET') {
      // Fetch project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          id, name, value, tier, 
          proposed_start_date, proposed_finish_date, 
          roe_email, project_type, state_funding, federal_funding,
          main_job_site_id
        `)
        .eq('id', resource_id)
        .single();

      if (projectError) {
        console.error('Failed to fetch project:', projectError);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      formData.project = {
        ...project,
        address: null, // Will be populated from job site
      };

      // Fetch main job site address
      if (project.main_job_site_id) {
        const { data: jobSite } = await supabase
          .from('job_sites')
          .select('full_address')
          .eq('id', project.main_job_site_id)
          .single();

        if (jobSite) {
          formData.project.address = jobSite.full_address;
        }
      }

      // Fetch contractor roles (simplified for public access)
      const { data: roleAssignments } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employer_id,
          employers(name, enterprise_agreement_status),
          contractor_role_types(code, name)
        `)
        .eq('project_id', resource_id)
        .eq('assignment_type', 'contractor_role');

      // Fetch trade contractors (simplified)
      const { data: tradeAssignments } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employer_id,
          employers(name, enterprise_agreement_status),
          trade_types(code, name)
        `)
        .eq('project_id', resource_id)
        .eq('assignment_type', 'trade_work');

      formData.mappingSheetData = {
        contractorRoles: (roleAssignments || []).map((r: any) => ({
          id: r.id,
          employerId: r.employer_id,
          employerName: r.employers?.name || 'Unknown',
          roleLabel: r.contractor_role_types?.name || 'Other',
          ebaStatus: r.employers?.enterprise_agreement_status !== false,
        })),
        tradeContractors: (tradeAssignments || []).map((t: any) => ({
          id: t.id,
          employerId: t.employer_id,
          employerName: t.employers?.name || 'Unknown',
          tradeLabel: t.trade_types?.name || 'Other',
          stage: 'other', // Simplified for now
          ebaStatus: t.employers?.enterprise_agreement_status !== false,
        })),
      };

      // Fetch available employers for selection
      const { data: employers } = await supabase
        .from('employers')
        .select('id, name, enterprise_agreement_status')
        .limit(1000) // Reasonable limit for dropdown
        .order('name');

      formData.employers = employers || [];
    }

    return NextResponse.json(formData);

  } catch (error) {
    console.error('Public form data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const submission: PublicFormSubmission = await request.json();

    // Validate token
    const validation = await validateToken(token);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 404 });
    }

    const tokenRecord = validation.tokenRecord!;
    const { resource_type, resource_id } = tokenRecord;

    if (resource_type === 'PROJECT_MAPPING_SHEET') {
      // Handle project updates
      if (submission.projectUpdates) {
        const { error: projectUpdateError } = await supabase
          .from('projects')
          .update(submission.projectUpdates)
          .eq('id', resource_id);

        if (projectUpdateError) {
          console.error('Failed to update project:', projectUpdateError);
          return NextResponse.json(
            { error: 'Failed to update project' },
            { status: 500 }
          );
        }
      }

      // Handle address updates
      if (submission.addressUpdate) {
        // Get the main job site
        const { data: project } = await supabase
          .from('projects')
          .select('main_job_site_id')
          .eq('id', resource_id)
          .single();

        if (project?.main_job_site_id) {
          const { error: addressError } = await supabase
            .from('job_sites')
            .update({
              full_address: submission.addressUpdate,
              location: submission.addressUpdate
            })
            .eq('id', project.main_job_site_id);

          if (addressError) {
            console.error('Failed to update address:', addressError);
            return NextResponse.json(
              { error: 'Failed to update address' },
              { status: 500 }
            );
          }
        }
      }

      // Handle contractor updates
      if (submission.contractorUpdates) {
        // This would handle updating contractor assignments
        // Implementation depends on the specific requirements
        for (const update of submission.contractorUpdates) {
          const { error } = await supabase
            .from('project_assignments')
            .update({ employer_id: update.employerId })
            .eq('id', update.id);

          if (error) {
            console.error('Failed to update contractor:', error);
          }
        }
      }
    }

    // Mark token as used
    await supabase
      .from('secure_access_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return NextResponse.json({ 
      success: true, 
      message: 'Form submitted successfully' 
    });

  } catch (error) {
    console.error('Public form submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}