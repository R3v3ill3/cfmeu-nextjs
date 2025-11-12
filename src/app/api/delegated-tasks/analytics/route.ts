import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

const VALID_PERIODS = ['week', 'month', '3months'] as const;
const VALID_RESOURCE_TYPES = ['PROJECT_AUDIT_COMPLIANCE', 'PROJECT_MAPPING_SHEET'] as const;

export interface DelegatedTasksAnalyticsResponse {
  role: AllowedRole;
  period: string;
  resourceType: string;
  universe?: {
    generated: number;
    submitted: number;
    submissionRate: number;
    uniqueOrganisers: number;
    uniqueTeams: number;
  };
  teams?: Array<{
    leadOrganiserId: string;
    leadOrganiserName: string;
    generated: number;
    submitted: number;
    submissionRate: number;
    organiserCount: number;
  }>;
  organisers?: Array<{
    organiserId: string;
    organiserName: string;
    generated: number;
    submitted: number;
    submissionRate: number;
    teamLeadId?: string;
    teamLeadName?: string;
  }>;
  personal?: {
    generated: number;
    submitted: number;
    submissionRate: number;
    pending: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as typeof VALID_PERIODS[number];
    const resourceType = (searchParams.get('resourceType') || 'PROJECT_AUDIT_COMPLIANCE') as typeof VALID_RESOURCE_TYPES[number];
    const level = searchParams.get('level') || 'summary';

    // Validate parameters
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    const response: DelegatedTasksAnalyticsResponse = {
      role,
      period,
      resourceType,
    };

    // Get analytics based on role
    if (role === 'organiser') {
      // Organiser: Get their own stats
      const { data: organiserData, error: organiserError } = await supabase
        .rpc('get_delegated_tasks_organiser', {
          p_user_id: user.id,
          p_period: period,
          p_resource_type: resourceType,
        });

      if (organiserError) {
        console.error('Failed to get organiser analytics:', organiserError);
        return NextResponse.json({ 
          error: 'Failed to fetch analytics', 
          details: organiserError.message 
        }, { status: 500 });
      }

      response.personal = {
        generated: organiserData?.generated || 0,
        submitted: organiserData?.submitted || 0,
        submissionRate: organiserData?.submissionRate || 0,
        pending: organiserData?.pending || 0,
      };
    } else if (role === 'lead_organiser') {
      // Lead organiser: Get universe stats, all teams, and their team
      const { data: universeData, error: universeError } = await supabase
        .rpc('get_delegated_tasks_universe', {
          p_period: period,
          p_resource_type: resourceType,
        });

      if (universeError) {
        console.error('Failed to get universe analytics:', universeError);
        return NextResponse.json({ 
          error: 'Failed to fetch analytics', 
          details: universeError.message 
        }, { status: 500 });
      }

      // Get their team stats
      const { data: teamData, error: teamError } = await supabase
        .rpc('get_delegated_tasks_team', {
          p_lead_user_id: user.id,
          p_period: period,
          p_resource_type: resourceType,
        });

      if (teamError) {
        console.error('Failed to get team analytics:', teamError);
        return NextResponse.json({ 
          error: 'Failed to fetch analytics', 
          details: teamError.message 
        }, { status: 500 });
      }

      response.universe = universeData?.universe;
      response.teams = universeData?.teams || [];
      response.organisers = teamData?.organisers || [];
    } else if (role === 'admin') {
      // Admin: Get universe stats, all teams, and all organisers
      const { data: universeData, error: universeError } = await supabase
        .rpc('get_delegated_tasks_universe', {
          p_period: period,
          p_resource_type: resourceType,
        });

      if (universeError) {
        console.error('Failed to get universe analytics:', universeError);
        return NextResponse.json({ 
          error: 'Failed to fetch analytics', 
          details: universeError.message 
        }, { status: 500 });
      }

      response.universe = universeData?.universe;
      response.teams = universeData?.teams || [];
      response.organisers = universeData?.organisers || [];
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Delegated tasks analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

