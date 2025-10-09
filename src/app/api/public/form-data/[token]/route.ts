/**
 * Public Form API - RLS-backed version (F-001 security fix)
 *
 * This version uses anon SSR client + RLS-backed RPCs instead of service-role key.
 * All database operations happen via SECURITY DEFINER RPCs that validate tokens internally.
 *
 * To activate: rename this file to route.ts (backup the old one first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic'

export interface PublicFormData {
  token: string;
  resourceType: string;
  resourceId: string;
  project?: any;
  siteContacts?: any[];
  mappingSheetData?: {
    contractorRoles: any[];
    tradeContractors: any[];
  };
  employers?: any[];
  contractorRoleTypes?: any[];
  tradeOptions?: any[];
  expiresAt: string;
  allowedActions: string[];
}

export interface PublicFormSubmission {
  projectUpdates?: any;
  addressUpdate?: string;
  siteContactUpdates?: any[];
  contractorRoleUpdates?: any[];
  tradeContractorUpdates?: any[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Use anon SSR client (no service-role key!)
    const supabase = await createServerSupabase();

    // Call RPC to get base form data (validates token internally)
    const { data: baseData, error: baseError } = await supabase
      .rpc('get_public_form_data', { p_token: token });

    if (baseError || !baseData) {
      console.error('Failed to fetch public form data:', baseError);
      return NextResponse.json(
        { error: baseData?.error || 'Failed to fetch form data' },
        { status: baseData?.status || 500 }
      );
    }

    // If base data fetch succeeded, get additional data
    const projectId = baseData.resourceId;

    // Fetch contractor roles via RPC
    const { data: contractorRoles } = await supabase
      .rpc('get_public_form_contractor_roles', {
        p_token: token,
        p_project_id: projectId
      });

    // Fetch trade contractors via RPC
    const { data: tradeContractors } = await supabase
      .rpc('get_public_form_trade_contractors', {
        p_token: token,
        p_project_id: projectId
      });

    // Fetch reference data via RPC
    const { data: refData } = await supabase
      .rpc('get_public_form_reference_data', { p_token: token });

    // Assemble complete response
    const formData: PublicFormData = {
      ...baseData,
      mappingSheetData: {
        contractorRoles: contractorRoles || [],
        tradeContractors: tradeContractors || [],
      },
      employers: refData?.employers || [],
      contractorRoleTypes: refData?.contractorRoleTypes || [],
      tradeOptions: [
        // Early Works
        { value: 'demolition', label: 'Demolition', stage: 'early_works' },
        { value: 'earthworks', label: 'Earthworks', stage: 'early_works' },
        { value: 'piling', label: 'Piling', stage: 'early_works' },
        { value: 'scaffolding', label: 'Scaffolding', stage: 'early_works' },
        { value: 'traffic_control', label: 'Traffic Control', stage: 'early_works' },
        { value: 'labour_hire', label: 'Labour Hire', stage: 'early_works' },
        // Structure
        { value: 'concrete', label: 'Concrete', stage: 'structure' },
        { value: 'form_work', label: 'Formwork', stage: 'structure' },
        { value: 'structural_steel', label: 'Structural Steel', stage: 'structure' },
        { value: 'reinforcing_steel', label: 'Reinforcing Steel', stage: 'structure' },
        { value: 'tower_crane', label: 'Tower Crane', stage: 'structure' },
        { value: 'mobile_crane', label: 'Mobile Crane', stage: 'structure' },
        // Finishing
        { value: 'electrical', label: 'Electrical', stage: 'finishing' },
        { value: 'plumbing', label: 'Plumbing', stage: 'finishing' },
        { value: 'painting', label: 'Painting', stage: 'finishing' },
        { value: 'carpentry', label: 'Carpentry', stage: 'finishing' },
        { value: 'tiling', label: 'Tiling', stage: 'finishing' },
        { value: 'flooring', label: 'Flooring', stage: 'finishing' },
        // Other
        { value: 'general_construction', label: 'General Construction', stage: 'other' },
        { value: 'other', label: 'Other', stage: 'other' },
      ],
    };

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

    // Use anon SSR client (no service-role key!)
    const supabase = await createServerSupabase();

    // Submit basic form data (project, address, contacts) via RPC
    const { data: submitResult, error: submitError } = await supabase
      .rpc('submit_public_form', {
        p_token: token,
        p_submission: submission as any
      });

    if (submitError || submitResult?.error) {
      console.error('Failed to submit form:', submitError || submitResult?.error);
      return NextResponse.json(
        { error: 'Failed to submit form' },
        { status: 500 }
      );
    }

    // Get project ID from token validation
    const { data: validation } = await supabase
      .rpc('validate_public_token', { p_token: token });

    if (!validation || validation.length === 0 || !validation[0].valid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const projectId = validation[0].resource_id;

    // Handle contractor role updates via RPC
    if (submission.contractorRoleUpdates && submission.contractorRoleUpdates.length > 0) {
      const { error: roleError } = await supabase
        .rpc('handle_contractor_role_updates', {
          p_token: token,
          p_project_id: projectId,
          p_updates: submission.contractorRoleUpdates as any
        });

      if (roleError) {
        console.error('Failed to update contractor roles:', roleError);
      }
    }

    // Handle trade contractor updates via RPC
    if (submission.tradeContractorUpdates && submission.tradeContractorUpdates.length > 0) {
      const { error: tradeError } = await supabase
        .rpc('handle_trade_contractor_updates', {
          p_token: token,
          p_project_id: projectId,
          p_updates: submission.tradeContractorUpdates as any
        });

      if (tradeError) {
        console.error('Failed to update trade contractors:', tradeError);
      }
    }

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
