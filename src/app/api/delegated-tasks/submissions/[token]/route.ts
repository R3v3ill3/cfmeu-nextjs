import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export interface SubmissionContentResponse {
  token: string;
  projectId: string;
  projectName: string;
  resourceType: string;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  submissionData: any;
  metadata: any;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
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

    // Get submission content via RPC (which handles permission checking)
    const { data: content, error: contentError } = await supabase
      .rpc('get_delegated_tasks_submission_content', {
        p_token: token,
        p_requesting_user_id: user.id,
      });

    if (contentError) {
      console.error('Failed to get submission content:', contentError);
      return NextResponse.json({ error: 'Failed to fetch submission content' }, { status: 500 });
    }

    if (content?.error) {
      return NextResponse.json(
        { error: content.error },
        { status: content.status || 500 }
      );
    }

    return NextResponse.json(content);
  } catch (error) {
    console.error('Submission content error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

