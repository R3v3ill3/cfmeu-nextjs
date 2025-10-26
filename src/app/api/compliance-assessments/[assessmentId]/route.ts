import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface UpdateComplianceAssessmentRequest {
  score?: number | null;
  rating?: 'green' | 'amber' | 'red' | 'unknown' | null;
  confidence_level?: 'high' | 'medium' | 'low' | 'very_low';
  severity_level?: number | null;
  assessment_notes?: string | null;
  assessment_date?: string;
  evidence_attachments?: string[] | null;
  follow_up_required?: boolean;
  follow_up_date?: string | null;
  organiser_id?: string | null;
  is_active?: boolean;
}

export interface ComplianceAssessmentDetailResponse {
  id: string;
  employer_id: string;
  project_id: string;
  assessment_type: string;
  score: number | null;
  rating: string | null;
  confidence_level: string;
  severity_level: number | null;
  assessment_notes: string | null;
  assessment_date: string;
  evidence_attachments: string[] | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  organiser_id: string | null;
  site_visit_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Related data
  employer?: {
    id: string;
    name: string;
    abn: string | null;
  };
  project?: {
    id: string;
    name: string;
    tier: string | null;
  };
  organiser?: {
    id: string;
    name: string;
    role: string;
  };
  site_visit?: {
    id: string;
    visit_date: string;
    visit_type: string;
  };
  creator?: {
    id: string;
    name: string;
  };
  updater?: {
    id: string;
    name: string;
  };
}

// Validation helpers
function validateConfidenceLevel(level: string): boolean {
  const validLevels = ['high', 'medium', 'low', 'very_low'];
  return validLevels.includes(level);
}

function validateRating(rating: string | null | undefined): boolean {
  if (!rating) return true;
  const validRatings = ['green', 'amber', 'red', 'unknown'];
  return validRatings.includes(rating);
}

function validateScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return true;
  return score >= -100 && score <= 100;
}

function validateSeverityLevel(level: number | null | undefined): boolean {
  if (level === null || level === undefined) return true;
  return level >= 1 && level <= 5;
}

// GET handler - Get single compliance assessment
async function getComplianceAssessmentHandler(request: NextRequest, { params }: { params: { assessmentId: string } }) {
  try {
    const { assessmentId } = params;
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get assessment with related data
    const { data: assessment, error: assessmentError } = await supabase
      .from('project_compliance_assessments')
      .select(`
        *,
        employers!employer_id(id, name, abn),
        projects!project_id(id, name, tier),
        profiles!organiser_id(id, first_name, surname, role),
        site_visits!site_visit_id(id, visit_date, visit_type),
        profiles!created_by(id, first_name, surname),
        profiles!updated_by(id, first_name, surname)
      `)
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Build response with related data
    const response: ComplianceAssessmentDetailResponse = {
      id: assessment.id,
      employer_id: assessment.employer_id,
      project_id: assessment.project_id,
      assessment_type: assessment.assessment_type,
      score: assessment.score,
      rating: assessment.rating,
      confidence_level: assessment.confidence_level,
      severity_level: assessment.severity_level,
      assessment_notes: assessment.assessment_notes,
      assessment_date: assessment.assessment_date,
      evidence_attachments: assessment.evidence_attachments,
      follow_up_required: assessment.follow_up_required,
      follow_up_date: assessment.follow_up_date,
      organiser_id: assessment.organiser_id,
      site_visit_id: assessment.site_visit_id,
      is_active: assessment.is_active,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      created_by: assessment.created_by,
      updated_by: assessment.updated_by,

      // Related data
      employer: assessment.employers ? {
        id: assessment.employers.id,
        name: assessment.employers.name,
        abn: assessment.employers.abn,
      } : undefined,

      project: assessment.projects ? {
        id: assessment.projects.id,
        name: assessment.projects.name,
        tier: assessment.projects.tier,
      } : undefined,

      organiser: assessment.profiles_organiser_id ? {
        id: assessment.profiles_organiser_id.id,
        name: `${assessment.profiles_organiser_id.first_name} ${assessment.profiles_organiser_id.surname}`.trim(),
        role: assessment.profiles_organiser_id.role,
      } : undefined,

      site_visit: assessment.site_visits ? {
        id: assessment.site_visits.id,
        visit_date: assessment.site_visits.visit_date,
        visit_type: assessment.site_visits.visit_type,
      } : undefined,

      creator: assessment.profiles_created_by ? {
        id: assessment.profiles_created_by.id,
        name: `${assessment.profiles_created_by.first_name} ${assessment.profiles_created_by.surname}`.trim(),
      } : undefined,

      updater: assessment.profiles_updated_by ? {
        id: assessment.profiles_updated_by.id,
        name: `${assessment.profiles_updated_by.first_name} ${assessment.profiles_updated_by.surname}`.trim(),
      } : undefined,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get compliance assessment API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT handler - Update compliance assessment
async function updateComplianceAssessmentHandler(request: NextRequest, { params }: { params: { assessmentId: string } }) {
  try {
    const { assessmentId } = params;
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get existing assessment
    const { data: existingAssessment, error: fetchError } = await supabase
      .from('project_compliance_assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (fetchError || !existingAssessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body: UpdateComplianceAssessmentRequest = await request.json();

    // Validation
    if (body.confidence_level && !validateConfidenceLevel(body.confidence_level)) {
      return NextResponse.json({ error: 'Invalid confidence_level' }, { status: 400 });
    }

    if (body.score !== undefined && !validateScore(body.score)) {
      return NextResponse.json({ error: 'Score must be between -100 and 100' }, { status: 400 });
    }

    if (body.rating !== undefined && !validateRating(body.rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    if (body.severity_level !== undefined && !validateSeverityLevel(body.severity_level)) {
      return NextResponse.json({ error: 'Severity level must be between 1 and 5' }, { status: 400 });
    }

    // Validate optional references
    if (body.organiser_id) {
      const { data: organiser, error: organiserError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', body.organiser_id)
        .single();

      if (organiserError || !organiser || !['organiser', 'lead_organiser', 'admin'].includes(organiser.role)) {
        return NextResponse.json({ error: 'Invalid organiser_id' }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are being updated
    if (body.score !== undefined) updateData.score = body.score;
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.confidence_level !== undefined) updateData.confidence_level = body.confidence_level;
    if (body.severity_level !== undefined) updateData.severity_level = body.severity_level;
    if (body.assessment_notes !== undefined) updateData.assessment_notes = body.assessment_notes;
    if (body.assessment_date !== undefined) updateData.assessment_date = body.assessment_date;
    if (body.evidence_attachments !== undefined) updateData.evidence_attachments = body.evidence_attachments;
    if (body.follow_up_required !== undefined) updateData.follow_up_required = body.follow_up_required;
    if (body.follow_up_date !== undefined) updateData.follow_up_date = body.follow_up_date;
    if (body.organiser_id !== undefined) updateData.organiser_id = body.organiser_id;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Update assessment
    const { data: updatedAssessment, error: updateError } = await supabase
      .from('project_compliance_assessments')
      .update(updateData)
      .eq('id', assessmentId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update compliance assessment:', updateError);
      return NextResponse.json({ error: 'Failed to update compliance assessment' }, { status: 500 });
    }

    // Create audit log entry if rating or score changed
    if (body.rating !== undefined || body.score !== undefined) {
      const previousRating = existingAssessment.rating;
      const newRating = updatedAssessment.rating;
      const previousScore = existingAssessment.score;
      const newScore = updatedAssessment.score;

      if (previousRating !== newRating || previousScore !== newScore) {
        await supabase
          .from('rating_audit_log')
          .insert({
            employer_id: existingAssessment.employer_id,
            previous_rating: previousRating,
            new_rating: newRating,
            previous_score: previousScore,
            new_score: newScore,
            rating_source: 'project_assessment',
            source_id: assessmentId,
            reason_for_change: `${existingAssessment.assessment_type} assessment updated`,
            changed_by: user.id,
          });
      }
    }

    // Return updated assessment
    const response: ComplianceAssessmentDetailResponse = {
      id: updatedAssessment.id,
      employer_id: updatedAssessment.employer_id,
      project_id: updatedAssessment.project_id,
      assessment_type: updatedAssessment.assessment_type,
      score: updatedAssessment.score,
      rating: updatedAssessment.rating,
      confidence_level: updatedAssessment.confidence_level,
      severity_level: updatedAssessment.severity_level,
      assessment_notes: updatedAssessment.assessment_notes,
      assessment_date: updatedAssessment.assessment_date,
      evidence_attachments: updatedAssessment.evidence_attachments,
      follow_up_required: updatedAssessment.follow_up_required,
      follow_up_date: updatedAssessment.follow_up_date,
      organiser_id: updatedAssessment.organiser_id,
      site_visit_id: updatedAssessment.site_visit_id,
      is_active: updatedAssessment.is_active,
      created_at: updatedAssessment.created_at,
      updated_at: updatedAssessment.updated_at,
      created_by: updatedAssessment.created_by,
      updated_by: updatedAssessment.updated_by,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Update compliance assessment API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE handler - Delete/deactivate compliance assessment
async function deleteComplianceAssessmentHandler(request: NextRequest, { params }: { params: { assessmentId: string } }) {
  try {
    const { assessmentId } = params;
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get existing assessment
    const { data: existingAssessment, error: fetchError } = await supabase
      .from('project_compliance_assessments')
      .select('id, rating, score, employer_id')
      .eq('id', assessmentId)
      .single();

    if (fetchError || !existingAssessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Soft delete (deactivate) instead of hard delete
    const { error: deleteError } = await supabase
      .from('project_compliance_assessments')
      .update({
        is_active: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId);

    if (deleteError) {
      console.error('Failed to deactivate compliance assessment:', deleteError);
      return NextResponse.json({ error: 'Failed to delete compliance assessment' }, { status: 500 });
    }

    // Create audit log entry
    await supabase
      .from('rating_audit_log')
      .insert({
        employer_id: existingAssessment.employer_id,
        previous_rating: existingAssessment.rating,
        previous_score: existingAssessment.score,
        rating_source: 'project_assessment',
        source_id: assessmentId,
        reason_for_change: 'Compliance assessment deleted/deactivated',
        changed_by: user.id,
      });

    return NextResponse.json({ message: 'Assessment deactivated successfully' }, { status: 200 });

  } catch (error) {
    console.error('Delete compliance assessment API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getComplianceAssessmentHandler(request, context as { params: { assessmentId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export const PUT = withRateLimit(
  (request, context) => updateComplianceAssessmentHandler(request, context as { params: { assessmentId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export const DELETE = withRateLimit(
  (request, context) => deleteComplianceAssessmentHandler(request, context as { params: { assessmentId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { assessmentId: string } }) {
  try {
    const { assessmentId } = params;
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from('project_compliance_assessments')
      .select('id, is_active, updated_at')
      .eq('id', assessmentId)
      .single();

    if (error) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Assessment-Active': data.is_active.toString(),
        'X-Last-Updated': data.updated_at,
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}