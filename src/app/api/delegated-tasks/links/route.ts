import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

const VALID_PERIODS = ['week', 'month', '3months'] as const;
const VALID_RESOURCE_TYPES = ['PROJECT_AUDIT_COMPLIANCE', 'PROJECT_MAPPING_SHEET'] as const;
const VALID_STATUSES = ['all', 'pending', 'submitted', 'expired'] as const;

export interface DelegatedTaskLink {
  id: string;
  token: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  status: 'pending' | 'submitted' | 'expired';
  createdBy: string;
  createdByName: string;
}

export interface DelegatedTasksLinksResponse {
  links: DelegatedTaskLink[];
  total: number;
  page: number;
  limit: number;
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
    const status = (searchParams.get('status') || 'all') as typeof VALID_STATUSES[number];
    const organiserId = searchParams.get('organiserId');
    const teamLeadId = searchParams.get('teamLeadId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Validate parameters
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Calculate period start date
    let periodStart: Date;
    switch (period) {
      case 'week':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'month':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case '3months':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 90);
        break;
    }

    // Build query based on role
    let query = supabase
      .from('secure_access_tokens')
      .select(`
        id,
        token,
        resource_id,
        created_at,
        expires_at,
        submitted_at,
        viewed_at,
        view_count,
        created_by,
        profiles!secure_access_tokens_created_by_fkey(full_name)
      `, { count: 'exact' })
      .eq('resource_type', resourceType)
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: false });

    // Apply role-based filtering
    if (role === 'organiser') {
      // Organiser: Only their own links
      query = query.eq('created_by', user.id);
    } else if (role === 'lead_organiser') {
      // Lead organiser: Their team's links
      if (organiserId) {
        // Filter by specific organiser (must be in their team)
        query = query.eq('created_by', organiserId);
        // Verify organiser is in their team via role_hierarchy
        const { data: hierarchyCheck } = await supabase
          .from('role_hierarchy')
          .select('id')
          .eq('parent_user_id', user.id)
          .eq('child_user_id', organiserId)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!hierarchyCheck) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
      } else {
        // Get all organisers in their team
        const { data: teamOrganisers } = await supabase
          .from('role_hierarchy')
          .select('child_user_id')
          .eq('parent_user_id', user.id)
          .eq('is_active', true);
        
        if (teamOrganisers && teamOrganisers.length > 0) {
          const organiserIds = teamOrganisers.map(o => o.child_user_id);
          query = query.in('created_by', organiserIds);
        } else {
          // No team members, return empty
          return NextResponse.json({
            links: [],
            total: 0,
            page: 1,
            limit: 50,
          });
        }
      }
    } else if (role === 'admin') {
      // Admin: All links, optionally filtered
      if (organiserId) {
        query = query.eq('created_by', organiserId);
      } else if (teamLeadId) {
        // Get organisers under this lead
        const { data: teamOrganisers } = await supabase
          .from('role_hierarchy')
          .select('child_user_id')
          .eq('parent_user_id', teamLeadId)
          .eq('is_active', true);
        
        if (teamOrganisers && teamOrganisers.length > 0) {
          const organiserIds = teamOrganisers.map(o => o.child_user_id);
          query = query.in('created_by', organiserIds);
        } else {
          return NextResponse.json({
            links: [],
            total: 0,
            page: 1,
            limit: 50,
          });
        }
      }
    }

    // Apply status filter
    if (status === 'pending') {
      query = query.is('submitted_at', null).gt('expires_at', new Date().toISOString());
    } else if (status === 'submitted') {
      query = query.not('submitted_at', 'is', null);
    } else if (status === 'expired') {
      query = query.lt('expires_at', new Date().toISOString());
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data: tokens, error: tokensError, count } = await query;

    if (tokensError) {
      console.error('Failed to fetch links:', tokensError);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    // Get project names
    const projectIds = [...new Set((tokens || []).map(t => t.resource_id))];
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);

    const projectMap = new Map((projects || []).map(p => [p.id, p.name]));

    // Transform data
    const links: DelegatedTaskLink[] = (tokens || []).map((token: any) => {
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      const submittedAt = token.submitted_at ? new Date(token.submitted_at) : null;
      
      let linkStatus: 'pending' | 'submitted' | 'expired';
      if (submittedAt) {
        linkStatus = 'submitted';
      } else if (expiresAt < now) {
        linkStatus = 'expired';
      } else {
        linkStatus = 'pending';
      }

      return {
        id: token.id,
        token: token.token,
        projectId: token.resource_id,
        projectName: projectMap.get(token.resource_id) || 'Unknown Project',
        createdAt: token.created_at,
        expiresAt: token.expires_at,
        submittedAt: token.submitted_at,
        viewedAt: token.viewed_at,
        viewCount: token.view_count || 0,
        status: linkStatus,
        createdBy: token.created_by,
        createdByName: token.profiles?.full_name || 'Unknown',
      };
    });

    return NextResponse.json({
      links,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Delegated tasks links error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

