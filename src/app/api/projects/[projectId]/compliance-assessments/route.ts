import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types for API requests/responses
export interface CreateComplianceAssessmentRequest {
  employer_id: string;
  project_id: string;
  assessment_type: 'cbus_status' | 'incolink_status' | 'site_visit_report' | 'delegate_report' | 'organiser_verbal_report' | 'organiser_written_report' | 'eca_status' | 'safety_incidents' | 'industrial_disputes' | 'payment_issues';
  score?: number | null;
  rating?: 'green' | 'amber' | 'red' | 'unknown' | null;
  confidence_level: 'high' | 'medium' | 'low' | 'very_low';
  severity_level?: number | null;
  assessment_notes?: string | null;
  assessment_date: string;
  evidence_attachments?: string[] | null;
  follow_up_required?: boolean;
  follow_up_date?: string | null;
  organiser_id?: string | null;
  site_visit_id?: string | null;
}

export interface ComplianceAssessmentResponse {
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
}

export interface ComplianceAssessmentsListResponse {
  assessments: ComplianceAssessmentResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_assessments: number;
    assessments_by_type: Record<string, number>;
    average_score: number | null;
    latest_assessment_date: string | null;
  };
}

// Validation helpers
function validateAssessmentType(type: string): boolean {
  const validTypes = [
    'cbus_status', 'incolink_status', 'site_visit_report', 'delegate_report',
    'organiser_verbal_report', 'organiser_written_report', 'eca_status',
    'safety_incidents', 'industrial_disputes', 'payment_issues'
  ];
  return validTypes.includes(type);
}

function validateConfidenceLevel(level: string): boolean {
  const validLevels = ['high', 'medium', 'low', 'very_low'];
  return validLevels.includes(level);
}

function validateRating(rating: string | null | undefined): boolean {
  if (!rating) return true; // null is allowed
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

// GET handler - List compliance assessments for a project
async function getComplianceAssessmentsHandler(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const { projectId } = params;
    const searchParams = request.nextUrl.searchParams;

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

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100);
    const assessmentType = searchParams.get('assessmentType');
    const confidenceLevel = searchParams.get('confidenceLevel');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sortBy = searchParams.get('sortBy') || 'assessment_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Validate project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('project_compliance_assessments')
      .select(`
        *,
        profiles!organiser_id(id, first_name, surname),
        profiles!created_by(id, first_name, surname),
        profiles!updated_by(id, first_name, surname)
      `, { count: 'exact' });

    // Apply filters
    query = query.eq('project_id', projectId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (assessmentType && validateAssessmentType(assessmentType)) {
      query = query.eq('assessment_type', assessmentType);
    }

    if (confidenceLevel && validateConfidenceLevel(confidenceLevel)) {
      query = query.eq('confidence_level', confidenceLevel);
    }

    if (dateFrom) {
      query = query.gte('assessment_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('assessment_date', dateTo);
    }

    // Apply sorting
    const validSortFields = ['assessment_date', 'assessment_type', 'score', 'confidence_level', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'assessment_date';
    const sortDirection = sortOrder === 'asc' ? true : false;
    query = query.order(sortField, { ascending: sortDirection });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Compliance assessments API error:', error);
      return NextResponse.json({ error: 'Failed to fetch compliance assessments' }, { status: 500 });
    }

    // Transform data for response
    const assessments: ComplianceAssessmentResponse[] = (data || []).map((row: any) => ({
      id: row.id,
      employer_id: row.employer_id,
      project_id: row.project_id,
      assessment_type: row.assessment_type,
      score: row.score,
      rating: row.rating,
      confidence_level: row.confidence_level,
      severity_level: row.severity_level,
      assessment_notes: row.assessment_notes,
      assessment_date: row.assessment_date,
      evidence_attachments: row.evidence_attachments,
      follow_up_required: row.follow_up_required,
      follow_up_date: row.follow_up_date,
      organiser_id: row.organiser_id,
      site_visit_id: row.site_visit_id,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
    }));

    // Calculate summary statistics
    const summary = {
      total_assessments: assessments.length,
      assessments_by_type: assessments.reduce((acc, assessment) => {
        acc[assessment.assessment_type] = (acc[assessment.assessment_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      average_score: assessments.length > 0
        ? assessments.reduce((sum, a) => sum + (a.score || 0), 0) / assessments.filter(a => a.score !== null).length
        : null,
      latest_assessment_date: assessments.length > 0
        ? Math.max(...assessments.map(a => new Date(a.assessment_date).getTime()))
        : null,
    };

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const response: ComplianceAssessmentsListResponse = {
      assessments,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      summary,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Compliance assessments API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST handler - Create new compliance assessment
async function createComplianceAssessmentHandler(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const { projectId } = params;
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

    // Parse and validate request body
    const body: CreateComplianceAssessmentRequest = await request.json();

    // Validation
    if (!body.employer_id) {
      return NextResponse.json({ error: 'employer_id is required' }, { status: 400 });
    }

    if (!body.assessment_type || !validateAssessmentType(body.assessment_type)) {
      return NextResponse.json({ error: 'Invalid or missing assessment_type' }, { status: 400 });
    }

    if (!body.confidence_level || !validateConfidenceLevel(body.confidence_level)) {
      return NextResponse.json({ error: 'Invalid or missing confidence_level' }, { status: 400 });
    }

    if (!body.assessment_date) {
      return NextResponse.json({ error: 'assessment_date is required' }, { status: 400 });
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

    // Validate project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id')
      .eq('id', body.employer_id)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
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

    if (body.site_visit_id) {
      const { data: siteVisit, error: siteVisitError } = await supabase
        .from('site_visits')
        .select('id')
        .eq('id', body.site_visit_id)
        .single();

      if (siteVisitError || !siteVisit) {
        return NextResponse.json({ error: 'Invalid site_visit_id' }, { status: 400 });
      }
    }

    // Create compliance assessment
    const { data: assessment, error: insertError } = await supabase
      .from('project_compliance_assessments')
      .insert({
        employer_id: body.employer_id,
        project_id: projectId,
        assessment_type: body.assessment_type,
        score: body.score || null,
        rating: body.rating || null,
        confidence_level: body.confidence_level,
        severity_level: body.severity_level || null,
        assessment_notes: body.assessment_notes || null,
        assessment_date: body.assessment_date,
        evidence_attachments: body.evidence_attachments || null,
        follow_up_required: body.follow_up_required || false,
        follow_up_date: body.follow_up_date || null,
        organiser_id: body.organiser_id || null,
        site_visit_id: body.site_visit_id || null,
        is_active: true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create compliance assessment:', insertError);
      return NextResponse.json({ error: 'Failed to create compliance assessment' }, { status: 500 });
    }

    // Create audit log entry
    await supabase
      .from('rating_audit_log')
      .insert({
        employer_id: body.employer_id,
        new_rating: body.rating || null,
        new_score: body.score || null,
        rating_source: 'project_assessment',
        source_id: assessment.id,
        reason_for_change: `New ${body.assessment_type} assessment created`,
        changed_by: user.id,
      });

    // Return created assessment
    const response: ComplianceAssessmentResponse = {
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
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Create compliance assessment API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getComplianceAssessmentsHandler(request, context as { params: { projectId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export const POST = withRateLimit(
  (request, context) => createComplianceAssessmentHandler(request, context as { params: { projectId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const { projectId } = params;
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('project_compliance_assessments')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Assessments': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}