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
    main_job_site_id: string | null;
  };
  siteContacts?: Array<{
    id?: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }>;
  mappingSheetData?: {
    contractorRoles: Array<{
      id: string;
      employerId: string;
      employerName: string;
      roleLabel: string;
      roleCode: string;
      ebaStatus?: boolean | null;
      dataSource?: string;
      matchStatus?: string;
    }>;
    tradeContractors: Array<{
      id: string;
      employerId: string;
      employerName: string;
      tradeType: string;
      tradeLabel: string;
      stage: string;
      estimatedWorkforce?: number | null;
      ebaStatus?: boolean | null;
      dataSource?: string;
      matchStatus?: string;
    }>;
  };
  employers?: Array<{
    id: string;
    name: string;
    enterprise_agreement_status?: boolean | null;
  }>;
  tradeOptions?: Array<{
    value: string;
    label: string;
    stage: string;
  }>;
  contractorRoleTypes?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  expiresAt: string;
  allowedActions: string[];
}

export interface PublicFormSubmission {
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
  siteContactUpdates?: Array<{
    id?: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }>;
  contractorRoleUpdates?: Array<{
    id?: string;
    employerId?: string;
    roleCode?: string;
    action: 'update' | 'create' | 'delete' | 'confirm_match' | 'mark_wrong';
  }>;
  tradeContractorUpdates?: Array<{
    id?: string;
    employerId?: string;
    tradeType?: string;
    estimatedWorkforce?: number;
    action: 'update' | 'create' | 'delete' | 'confirm_match' | 'mark_wrong';
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
      console.log('Project data being returned:', formData.project);

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

      // Fetch site contacts
      if (project.main_job_site_id) {
        const { data: siteContacts } = await supabase
          .from('site_contacts')
          .select('id, role, name, email, phone')
          .eq('job_site_id', project.main_job_site_id);

        formData.siteContacts = siteContacts || [];
      }

      // Fetch contractor roles (simplified for public access)
      const { data: roleAssignments, error: roleError } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employer_id,
          source,
          match_status,
          match_confidence,
          matched_at,
          confirmed_at,
          match_notes,
          employers(name, enterprise_agreement_status),
          contractor_role_types(code, name)
        `)
        .eq('project_id', resource_id)
        .eq('assignment_type', 'contractor_role');
        
      if (roleError) {
        console.error('Error fetching contractor roles:', roleError);
      }
      console.log('Raw role assignments from DB:', roleAssignments);

      // Fetch trade contractors - project_assignments uses trade_type_id (foreign key)
      const { data: tradeAssignments, error: tradeError } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employer_id,
          source,
          match_status,
          match_confidence,
          matched_at,
          confirmed_at,
          match_notes,
          trade_type_id,
          estimated_workforce,
          employers(name, enterprise_agreement_status),
          trade_types(code, name)
        `)
        .eq('project_id', resource_id)
        .eq('assignment_type', 'trade_work');
        
      if (tradeError) {
        console.error('Error fetching trade assignments:', tradeError);
      }
      console.log('🔧 Raw trade assignments from project_assignments table:', tradeAssignments);
      
      // Also check legacy trade contractor tables for this project
      const { data: legacyProjectTrades } = await supabase
        .from('project_contractor_trades')
        .select('id, employer_id, trade_type, stage, estimated_project_workforce, source, match_status, match_confidence, matched_at, confirmed_at, match_notes, employers(name, enterprise_agreement_status)')
        .eq('project_id', resource_id);
      
      console.log('🏗️ Legacy project_contractor_trades data:', legacyProjectTrades);
      
      // Check site contractor trades if there's a main site
      let legacySiteTrades: any[] = [];
      if (project.main_job_site_id) {
        const { data: siteTrades } = await supabase
          .from('site_contractor_trades')
          .select('id, employer_id, trade_type, employers(name, enterprise_agreement_status)')
          .eq('job_site_id', project.main_job_site_id);
        legacySiteTrades = siteTrades || [];
        console.log('🏗️ Legacy site_contractor_trades data:', legacySiteTrades);
      }

      const contractorRoles = (roleAssignments || []).map((r: any) => {
        console.log('Processing contractor role:', r);
        return {
          id: r.id,
          employerId: r.employer_id,
          employerName: r.employers?.name || 'Unknown',
          roleLabel: r.contractor_role_types?.name || 'Other',
          roleCode: r.contractor_role_types?.code || 'other',
          ebaStatus: r.employers?.enterprise_agreement_status !== false,
          dataSource: r.source,
          matchStatus: r.match_status,
        };
      });
      console.log('✅ Final contractor roles being returned:', contractorRoles);

      formData.mappingSheetData = {
        contractorRoles,
        tradeContractors: (() => {
          const allTradeContractors: any[] = [];
          
          // Enhanced stage mapping based on trade type enum
          const stageMapping: Record<string, string> = {
            // Early Works
            'demolition': 'early_works', 'earthworks': 'early_works', 'piling': 'early_works',
            'excavations': 'early_works', 'scaffolding': 'early_works', 'traffic_control': 'early_works',
            'traffic_management': 'early_works', 'waste_management': 'early_works', 'cleaning': 'early_works',
            'labour_hire': 'early_works',
            // Structure
            'tower_crane': 'structure', 'mobile_crane': 'structure', 'crane_and_rigging': 'structure',
            'concrete': 'structure', 'concreting': 'structure', 'form_work': 'structure',
            'reinforcing_steel': 'structure', 'steel_fixing': 'structure', 'post_tensioning': 'structure',
            'structural_steel': 'structure', 'bricklaying': 'structure', 'foundations': 'structure',
            // Finishing
            'carpentry': 'finishing', 'electrical': 'finishing', 'plumbing': 'finishing',
            'mechanical_services': 'finishing', 'painting': 'finishing', 'plastering': 'finishing',
            'waterproofing': 'finishing', 'tiling': 'finishing', 'flooring': 'finishing',
            'roofing': 'finishing', 'windows': 'finishing', 'facade': 'finishing', 'glazing': 'finishing',
            'kitchens': 'finishing', 'landscaping': 'finishing', 'final_clean': 'finishing',
            'insulation': 'finishing', 'internal_walls': 'finishing', 'ceilings': 'finishing',
            'stairs_balustrades': 'finishing', 'fire_protection': 'finishing', 'security_systems': 'finishing',
            'building_services': 'finishing', 'fitout': 'finishing', 'technology': 'finishing'
          };
          
          // 1. Add trade contractors from new project_assignments table
          (tradeAssignments || []).forEach((t: any) => {
            if (!t.employer_id) return;
            
            const tradeType = t.trade_types?.code || 'other'; // Use the joined trade_types table
            const stage = stageMapping[tradeType] || 'other';
            const tradeLabel = t.trade_types?.name || tradeType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            
            allTradeContractors.push({
              id: `assignment_trade:${t.id}`,
              employerId: t.employer_id,
              employerName: t.employers?.name || 'Unknown',
              tradeType,
              tradeLabel,
              stage,
              estimatedWorkforce: t.estimated_workforce || null,
              ebaStatus: t.employers?.enterprise_agreement_status !== false,
              dataSource: t.source,
              matchStatus: t.match_status,
            });
          });
          
          // 2. Add trade contractors from legacy project_contractor_trades
          (legacyProjectTrades || []).forEach((t: any) => {
            if (!t.employer_id) return;
            
            // Avoid duplicates from the new system
            const existing = allTradeContractors.find(tc => tc.employerId === t.employer_id && tc.tradeType === t.trade_type);
            if (existing) return;
            
            const tradeType = t.trade_type || 'other';
            const stage = t.stage || stageMapping[tradeType] || 'other';
            const tradeLabel = tradeType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            
            allTradeContractors.push({
              id: `project_trade:${t.id}`,
              employerId: t.employer_id,
              employerName: t.employers?.name || 'Unknown',
              tradeType,
              tradeLabel,
              stage,
              estimatedWorkforce: t.estimated_project_workforce || null,
              ebaStatus: t.employers?.enterprise_agreement_status !== false,
              dataSource: t.source,
              matchStatus: t.match_status,
            });
          });
          
          // 3. Add trade contractors from legacy site_contractor_trades
          legacySiteTrades.forEach((st: any) => {
            if (!st.employer_id) return;
            
            // Avoid duplicates from project_contractor_trades
            const existing = allTradeContractors.find(tc => tc.employerId === st.employer_id && tc.tradeType === st.trade_type);
            if (existing) return;
            
            const tradeType = st.trade_type || 'other';
            const stage = stageMapping[tradeType] || 'other';
            const tradeLabel = tradeType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            
            allTradeContractors.push({
              id: `site_trade:${st.id}`,
              employerId: st.employer_id,
              employerName: st.employers?.name || 'Unknown',
              tradeType,
              tradeLabel,
              stage,
              estimatedWorkforce: null,
              ebaStatus: st.employers?.enterprise_agreement_status !== false,
              dataSource: 'legacy_site_trades',
              matchStatus: null,
            });
          });
          
          console.log('✅ Final combined trade contractors:', allTradeContractors);
          return allTradeContractors;
        })(),
      };

      // Fetch available employers for selection
      const { data: employers } = await supabase
        .from('employers')
        .select('id, name, enterprise_agreement_status')
        .limit(1000) // Reasonable limit for dropdown
        .order('name');

      formData.employers = employers || [];

      // Fetch available contractor role types
      const { data: contractorRoleTypes } = await supabase
        .from('contractor_role_types')
        .select('id, code, name')
        .order('name');

      formData.contractorRoleTypes = contractorRoleTypes || [];

      // Add trade options with stages
      const tradeOptions = [
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
      ];

      formData.tradeOptions = tradeOptions;
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
    console.log('🚀 Received form submission:', JSON.stringify(submission, null, 2));

    // Validate token
    const validation = await validateToken(token);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 404 });
    }

    const tokenRecord = validation.tokenRecord!;
    const { resource_type, resource_id } = tokenRecord;

    if (resource_type === 'PROJECT_MAPPING_SHEET') {
      // Get project's main job site for some operations
      const { data: project } = await supabase
        .from('projects')
        .select('main_job_site_id')
        .eq('id', resource_id)
        .single();

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
      if (submission.addressUpdate && project?.main_job_site_id) {
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

      // Handle site contact updates
      if (submission.siteContactUpdates && project?.main_job_site_id) {
        for (const contact of submission.siteContactUpdates) {
          const payload = {
            job_site_id: project.main_job_site_id,
            role: contact.role,
            name: contact.name.trim(),
            email: contact.email || null,
            phone: contact.phone || null,
          };

          if (contact.id) {
            // Update existing contact
            const { error } = await supabase
              .from('site_contacts')
              .update(payload)
              .eq('id', contact.id);
            
            if (error) {
              console.error('Failed to update site contact:', error);
            }
          } else {
            // Create new contact
            const { error } = await supabase
              .from('site_contacts')
              .insert(payload);
            
            if (error) {
              console.error('Failed to create site contact:', error);
            }
          }
        }
      }

      // Handle contractor role updates
      if (submission.contractorRoleUpdates) {
        for (const update of submission.contractorRoleUpdates) {
          if (update.action === 'create' && update.employerId && update.roleCode) {
            // First, get the contractor_role_type_id from the code
            const { data: roleType } = await supabase
              .from('contractor_role_types')
              .select('id')
              .eq('code', update.roleCode)
              .single();
            
            if (roleType) {
              const { error } = await supabase
                .from('project_assignments')
                .insert({
                  project_id: resource_id,
                  employer_id: update.employerId,
                  assignment_type: 'contractor_role',
                  contractor_role_type_id: roleType.id,
                  source: 'public_form',
                  match_status: 'manual',
                });
              
              if (error) {
                console.error('Failed to create contractor role:', error);
              }
            } else {
              console.error('Contractor role type not found for code:', update.roleCode);
            }
          } else if (update.action === 'update' && update.id && update.employerId) {
            // Update existing contractor role
            const { error } = await supabase
              .from('project_assignments')
              .update({ 
                employer_id: update.employerId,
                match_status: 'delegate_confirmed',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to update contractor role:', error);
            }
          } else if (update.action === 'confirm_match' && update.id) {
            // Confirm the existing match
            const { error } = await supabase
              .from('project_assignments')
              .update({ 
                match_status: 'delegate_confirmed',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to confirm contractor role:', error);
            }
          } else if (update.action === 'mark_wrong' && update.id) {
            // Mark the match as wrong
            const { error } = await supabase
              .from('project_assignments')
              .update({ 
                match_status: 'incorrect_via_delegate',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to mark contractor role as wrong:', error);
            }
          } else if (update.action === 'delete' && update.id) {
            // Delete contractor role
            const { error } = await supabase
              .from('project_assignments')
              .delete()
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to delete contractor role:', error);
            }
          }
        }
      }

      // Handle trade contractor updates
      if (submission.tradeContractorUpdates) {
        for (const update of submission.tradeContractorUpdates) {
          if (update.action === 'create' && update.employerId && update.tradeType) {
            // Use the trade_type enum directly - no need for ID lookup
            const { error } = await supabase
              .from('project_assignments')
              .insert({
                project_id: resource_id,
                employer_id: update.employerId,
                assignment_type: 'trade_work',
                trade_type: update.tradeType, // Use the enum value directly
                estimated_workforce: update.estimatedWorkforce,
                source: 'public_form',
                match_status: 'manual',
              });
            
            if (error) {
              console.error('Failed to create trade contractor:', error);
            }
          } else if (update.action === 'update' && update.id) {
            // Update existing trade assignment
            const updateData: any = {
              match_status: 'delegate_confirmed',
              confirmed_at: new Date().toISOString(),
            };
            
            if (update.employerId) updateData.employer_id = update.employerId;
            if (update.estimatedWorkforce !== undefined) updateData.estimated_workforce = update.estimatedWorkforce;
            
            const { error } = await supabase
              .from('project_assignments')
              .update(updateData)
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to update trade contractor:', error);
            }
          } else if (update.action === 'confirm_match' && update.id) {
            // Confirm the existing match
            console.log('✅ Confirming trade contractor match for ID:', update.id);
            
            // First check if this is a project_assignments record
            const { data: existingAssignment } = await supabase
              .from('project_assignments')
              .select('id, assignment_type, match_status')
              .eq('id', update.id)
              .single();
            
            if (existingAssignment) {
              console.log('🔍 Found existing assignment:', existingAssignment);
              const { error } = await supabase
                .from('project_assignments')
                .update({ 
                  match_status: 'delegate_confirmed',
                  confirmed_at: new Date().toISOString(),
                })
                .eq('id', update.id);
              
              if (error) {
                console.error('❌ Failed to confirm trade contractor in project_assignments:', error);
              } else {
                console.log('✅ Successfully confirmed trade contractor in project_assignments:', update.id);
              }
            } else {
              // Try legacy tables
              console.log('🔍 Not found in project_assignments, trying legacy tables...');
              
              // Try project_contractor_trades
              const { data: legacyProject } = await supabase
                .from('project_contractor_trades')
                .select('id, match_status')
                .eq('id', update.id)
                .single();
              
              if (legacyProject) {
                console.log('🔍 Found in project_contractor_trades:', legacyProject);
                const { error } = await supabase
                  .from('project_contractor_trades')
                  .update({ 
                    match_status: 'delegate_confirmed',
                    confirmed_at: new Date().toISOString(),
                  })
                  .eq('id', update.id);
                
                if (error) {
                  console.error('❌ Failed to confirm in project_contractor_trades:', error);
                } else {
                  console.log('✅ Successfully confirmed in project_contractor_trades:', update.id);
                }
              } else {
                console.log('❌ Could not find trade contractor with ID:', update.id);
              }
            }
          } else if (update.action === 'mark_wrong' && update.id) {
            // Mark the match as wrong
            const { error } = await supabase
              .from('project_assignments')
              .update({ 
                match_status: 'incorrect_via_delegate',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to mark trade contractor as wrong:', error);
            }
          } else if (update.action === 'delete' && update.id) {
            // Delete trade assignment
            const { error } = await supabase
              .from('project_assignments')
              .delete()
              .eq('id', update.id);
            
            if (error) {
              console.error('Failed to delete trade contractor:', error);
            }
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