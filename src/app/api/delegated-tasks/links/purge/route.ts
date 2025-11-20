import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['admin', 'organiser', 'lead_organiser'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

const VALID_PURGE_OPTIONS = ['all', '4weeks', '2weeks', '1week'] as const;
type PurgeOption = typeof VALID_PURGE_OPTIONS[number];

export interface PurgeLinksRequest {
  purgeOption: PurgeOption;
  organiserId: string;
  resourceType?: 'PROJECT_AUDIT_COMPLIANCE' | 'PROJECT_MAPPING_SHEET';
}

export interface PurgeLinksResponse {
  deletedCount: number;
  purgeOption: PurgeOption;
  organiserId: string;
  resourceType?: string;
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ 
        error: 'Forbidden',
        details: 'You do not have permission to purge links'
      }, { status: 403 });
    }

    // Parse request body
    const body: PurgeLinksRequest = await request.json();
    const { purgeOption, organiserId, resourceType } = body;

    // Validate purge option
    if (!VALID_PURGE_OPTIONS.includes(purgeOption)) {
      return NextResponse.json({ 
        error: 'Invalid purge option',
        details: `Must be one of: ${VALID_PURGE_OPTIONS.join(', ')}`
      }, { status: 400 });
    }

    // Validate organiserId
    if (!organiserId || typeof organiserId !== 'string') {
      return NextResponse.json({ 
        error: 'Invalid organiser ID',
        details: 'organiserId is required'
      }, { status: 400 });
    }

    // Check permissions: 
    // - Admins can purge any organiser's links
    // - Lead organisers can purge their team members' links
    // - Organisers can only purge their own links
    if (role === 'admin') {
      // Admin can purge any organiser's links - no additional check needed
    } else if (role === 'lead_organiser') {
      // Lead organiser can purge their team members' links
      // Verify the organiser is in their team via role_hierarchy
      const { data: hierarchyCheck } = await supabase
        .from('role_hierarchy')
        .select('id')
        .eq('parent_user_id', user.id)
        .eq('child_user_id', organiserId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (!hierarchyCheck && organiserId !== user.id) {
        return NextResponse.json({ 
          error: 'Forbidden',
          details: 'You can only purge links for organisers in your team or your own links'
        }, { status: 403 });
      }
    } else if (role === 'organiser') {
      // Organiser can only purge their own links
      if (organiserId !== user.id) {
        return NextResponse.json({ 
          error: 'Forbidden',
          details: 'You can only purge your own links'
        }, { status: 403 });
      }
    }

    // Calculate cutoff date based on purge option
    let cutoffDate: Date = new Date();
    switch (purgeOption) {
      case 'all':
        // All expired links (no additional time requirement)
        cutoffDate = new Date(0); // Start of epoch
        break;
      case '4weeks':
        cutoffDate.setDate(cutoffDate.getDate() - 28);
        break;
      case '2weeks':
        cutoffDate.setDate(cutoffDate.getDate() - 14);
        break;
      case '1week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
    }

    // Execute delete query
    // Note: We need to use a service role client to bypass RLS for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { createClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build the base query conditions
    // Only purge links for the specified organiser
    let countQuery = serviceSupabase
      .from('secure_access_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', organiserId) // Only this organiser's links
      .lt('expires_at', new Date().toISOString()) // Expired
      .is('viewed_at', null) // Never viewed
      .eq('view_count', 0); // View count is 0

    let deleteQuery = serviceSupabase
      .from('secure_access_tokens')
      .delete()
      .eq('created_by', organiserId) // Only this organiser's links
      .lt('expires_at', new Date().toISOString()) // Expired
      .is('viewed_at', null) // Never viewed
      .eq('view_count', 0); // View count is 0

    // Apply time cutoff (for options other than 'all')
    if (purgeOption !== 'all') {
      countQuery = countQuery.lt('expires_at', cutoffDate.toISOString());
      deleteQuery = deleteQuery.lt('expires_at', cutoffDate.toISOString());
    }

    // Apply resource type filter if provided
    if (resourceType) {
      countQuery = countQuery.eq('resource_type', resourceType);
      deleteQuery = deleteQuery.eq('resource_type', resourceType);
    }

    // First, count how many will be deleted
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Failed to count links for purge:', countError);
      return NextResponse.json({ 
        error: 'Failed to count links',
        details: countError.message
      }, { status: 500 });
    }

    // Now perform the delete
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('Failed to purge links:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to purge links',
        details: deleteError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      deletedCount: count || 0,
      purgeOption,
      organiserId,
      resourceType: resourceType || 'all',
    } as PurgeLinksResponse);
  } catch (error) {
    console.error('Purge links error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

