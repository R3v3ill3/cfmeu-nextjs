import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '@/lib/share-links';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

// Resource types that can be shared
const VALID_RESOURCE_TYPES = [
  'PROJECT_MAPPING_SHEET',
  'PROJECT_SITE_VISIT',
  // Add more resource types as needed
] as const;
type ResourceType = typeof VALID_RESOURCE_TYPES[number];

export interface GenerateShareLinkRequest {
  resourceType: ResourceType;
  expiresInHours?: number; // Default: 48 hours
}

export interface GenerateShareLinkResponse {
  shareUrl: string;
  token: string;
  expiresAt: string;
  resourceType: ResourceType;
  resourceId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const body: GenerateShareLinkRequest = await request.json();
    
    // Validate request body
    if (!body.resourceType || !VALID_RESOURCE_TYPES.includes(body.resourceType)) {
      return NextResponse.json(
        { error: 'Invalid or missing resourceType' },
        { status: 400 }
      );
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
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load user profile:', profileError);
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate secure token using a service role client to bypass RLS
    // Use same fallback pattern as createServerSupabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceSupabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Generate token using the database function
    const { data: tokenData, error: tokenError } = await serviceSupabase
      .rpc('generate_secure_token', { length: 48 });

    if (tokenError || !tokenData) {
      console.error('Failed to generate secure token:', tokenError);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    // Calculate expiry date
    const expiresInHours = body.expiresInHours || 48;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store token in database
    const { data: tokenRecord, error: insertError } = await serviceSupabase
      .from('secure_access_tokens')
      .insert({
        token: tokenData,
        resource_type: body.resourceType,
        resource_id: projectId,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, token, expires_at')
      .single();

    if (insertError || !tokenRecord) {
      console.error('Failed to store secure token:', insertError);
      return NextResponse.json({ error: 'Failed to create secure link' }, { status: 500 });
    }

    // Generate the share URL using the robust getBaseUrl function
    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/share/${tokenRecord.token}`;

    const response: GenerateShareLinkResponse = {
      shareUrl,
      token: tokenRecord.token,
      expiresAt: tokenRecord.expires_at,
      resourceType: body.resourceType,
      resourceId: projectId,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Generate share link error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
