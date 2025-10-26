import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface CreateExpertiseRatingRequest {
  overall_score?: number | null;
  overall_rating?: 'green' | 'amber' | 'red' | 'unknown' | null;
  confidence_level: 'high' | 'medium' | 'low' | 'very_low';
  assessment_basis: string;
  assessment_context?: string | null;
  eba_status_known?: boolean;
  eba_status?: 'green' | 'amber' | 'red' | 'unknown' | null;
  knowledge_beyond_projects?: boolean;
  knowledge_beyond_projects_details?: string | null;
  industry_reputation?: string | null;
  union_relationship_quality?: 'excellent' | 'good' | 'neutral' | 'poor' | 'very_poor';
  historical_issues?: string[] | null;
  recent_improvements?: boolean;
  improvement_details?: string | null;
  future_concerns?: boolean;
  concern_details?: string | null;
  assessment_notes?: string | null;
  assessment_date: string;
  expires_date?: string | null;
}

export interface ExpertiseRatingResponse {
  id: string;
  employer_id: string;
  organiser_id: string;
  assessment_date: string;
  overall_score: number | null;
  overall_rating: string | null;
  confidence_level: string;
  assessment_basis: string;
  assessment_context: string | null;
  eba_status_known: boolean;
  eba_status: string | null;
  knowledge_beyond_projects: boolean;
  knowledge_beyond_projects_details: string | null;
  industry_reputation: string | null;
  union_relationship_quality: string | null;
  historical_issues: string[] | null;
  recent_improvements: boolean;
  improvement_details: string | null;
  future_concerns: boolean;
  concern_details: string | null;
  assessment_notes: string | null;
  is_active: boolean;
  expires_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Related data
  organiser?: {
    id: string;
    name: string;
    role: string;
    reputation_score?: number;
  };
  validation_records?: Array<{
    id: string;
    validation_date: string;
    rating_match: boolean;
    score_difference: number;
  }>;
}

export interface ExpertiseRatingsListResponse {
  ratings: ExpertiseRatingResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_ratings: number;
    average_score: number | null;
    latest_rating_date: string | null;
    confidence_distribution: Record<string, number>;
    rating_distribution: Record<string, number>;
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

function validateUnionRelationship(quality: string): boolean {
  const validQualities = ['excellent', 'good', 'neutral', 'poor', 'very_poor'];
  return validQualities.includes(quality);
}

// GET handler - List expertise ratings for an employer
async function getExpertiseRatingsHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
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
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const confidenceLevel = searchParams.get('confidenceLevel');
    const sortBy = searchParams.get('sortBy') || 'assessment_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const organiserId = searchParams.get('organiserId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('organiser_overall_expertise_ratings')
      .select(`
        *,
        profiles!organiser_id(id, first_name, surname, role),
        profiles!created_by(id, first_name, surname),
        profiles!updated_by(id, first_name, surname),
        organiser_expertise_reputation!inner(
          reputation_period_start,
          reputation_period_end,
          overall_reputation_score
        )
      `, { count: 'exact' });

    // Apply filters
    query = query.eq('employer_id', employerId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (confidenceLevel && validateConfidenceLevel(confidenceLevel)) {
      query = query.eq('confidence_level', confidenceLevel);
    }

    if (organiserId) {
      query = query.eq('organiser_id', organiserId);
    }

    if (dateFrom) {
      query = query.gte('assessment_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('assessment_date', dateTo);
    }

    // Apply sorting
    const validSortFields = ['assessment_date', 'overall_score', 'confidence_level', 'created_at'];
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
      console.error('Expertise ratings API error:', error);
      return NextResponse.json({ error: 'Failed to fetch expertise ratings' }, { status: 500 });
    }

    // Transform data for response
    const ratings: ExpertiseRatingResponse[] = (data || []).map((row: any) => ({
      id: row.id,
      employer_id: row.employer_id,
      organiser_id: row.organiser_id,
      assessment_date: row.assessment_date,
      overall_score: row.overall_score,
      overall_rating: row.overall_rating,
      confidence_level: row.confidence_level,
      assessment_basis: row.assessment_basis,
      assessment_context: row.assessment_context,
      eba_status_known: row.eba_status_known,
      eba_status: row.eba_status,
      knowledge_beyond_projects: row.knowledge_beyond_projects,
      knowledge_beyond_projects_details: row.knowledge_beyond_projects_details,
      industry_reputation: row.industry_reputation,
      union_relationship_quality: row.union_relationship_quality,
      historical_issues: row.historical_issues,
      recent_improvements: row.recent_improvements,
      improvement_details: row.improvement_details,
      future_concerns: row.future_concerns,
      concern_details: row.concern_details,
      assessment_notes: row.assessment_notes,
      is_active: row.is_active,
      expires_date: row.expires_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,

      // Related data
      organiser: row.profiles_organiser_id ? {
        id: row.profiles_organiser_id.id,
        name: `${row.profiles_organiser_id.first_name} ${row.profiles_organiser_id.surname}`.trim(),
        role: row.profiles_organiser_id.role,
        reputation_score: row.organiser_expertise_reputation?.overall_reputation_score,
      } : undefined,
    }));

    // Get validation records for each rating
    for (const rating of ratings) {
      const { data: validations } = await supabase
        .from('expertise_validation_records')
        .select('id, validation_date, rating_match, score_difference')
        .eq('employer_id', employerId)
        .eq('organiser_id', rating.organiser_id)
        .order('validation_date', { ascending: false })
        .limit(5);

      rating.validation_records = validations || [];
    }

    // Calculate summary statistics
    const summary = {
      total_ratings: ratings.length,
      average_score: ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.overall_score || 0), 0) / ratings.filter(r => r.overall_score !== null).length
        : null,
      latest_rating_date: ratings.length > 0
        ? Math.max(...ratings.map(r => new Date(r.assessment_date).getTime()))
        : null,
      confidence_distribution: ratings.reduce((acc, rating) => {
        acc[rating.confidence_level] = (acc[rating.confidence_level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      rating_distribution: ratings.reduce((acc, rating) => {
        const ratingKey = rating.overall_rating || 'unknown';
        acc[ratingKey] = (acc[ratingKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const response: ExpertiseRatingsListResponse = {
      ratings,
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
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Expertise ratings API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST handler - Create new expertise rating
async function createExpertiseRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
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
    const body: CreateExpertiseRatingRequest = await request.json();

    // Validation
    if (!body.confidence_level || !validateConfidenceLevel(body.confidence_level)) {
      return NextResponse.json({ error: 'Invalid or missing confidence_level' }, { status: 400 });
    }

    if (!body.assessment_basis) {
      return NextResponse.json({ error: 'assessment_basis is required' }, { status: 400 });
    }

    if (!body.assessment_date) {
      return NextResponse.json({ error: 'assessment_date is required' }, { status: 400 });
    }

    if (body.overall_score !== undefined && !validateScore(body.overall_score)) {
      return NextResponse.json({ error: 'Score must be between -100 and 100' }, { status: 400 });
    }

    if (body.overall_rating !== undefined && !validateRating(body.overall_rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    if (body.union_relationship_quality && !validateUnionRelationship(body.union_relationship_quality)) {
      return NextResponse.json({ error: 'Invalid union_relationship_quality' }, { status: 400 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Check for existing assessment by same organiser on same date
    const { data: existingAssessment, error: existingError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .select('id')
      .eq('employer_id', employerId)
      .eq('organiser_id', user.id)
      .eq('assessment_date', body.assessment_date)
      .single();

    if (existingAssessment) {
      return NextResponse.json({
        error: 'An assessment for this employer by this organiser already exists for this date',
        existingAssessmentId: existingAssessment.id
      }, { status: 409 });
    }

    // Set default expiry date (6 months from assessment date) if not provided
    const expiresDate = body.expires_date ||
      new Date(new Date(body.assessment_date).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create expertise rating
    const { data: rating, error: insertError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .insert({
        employer_id: employerId,
        organiser_id: user.id, // The current user is the organiser making the assessment
        assessment_date: body.assessment_date,
        overall_score: body.overall_score || null,
        overall_rating: body.overall_rating || null,
        confidence_level: body.confidence_level,
        assessment_basis: body.assessment_basis,
        assessment_context: body.assessment_context || null,
        eba_status_known: body.eba_status_known || false,
        eba_status: body.eba_status || null,
        knowledge_beyond_projects: body.knowledge_beyond_projects || false,
        knowledge_beyond_projects_details: body.knowledge_beyond_projects_details || null,
        industry_reputation: body.industry_reputation || null,
        union_relationship_quality: body.union_relationship_quality || null,
        historical_issues: body.historical_issues || null,
        recent_improvements: body.recent_improvements || false,
        improvement_details: body.improvement_details || null,
        future_concerns: body.future_concerns || false,
        concern_details: body.concern_details || null,
        assessment_notes: body.assessment_notes || null,
        is_active: true,
        expires_date: expiresDate,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create expertise rating:', insertError);
      return NextResponse.json({ error: 'Failed to create expertise rating' }, { status: 500 });
    }

    // Create audit log entry
    if (body.overall_rating || body.overall_score) {
      await supabase
        .from('rating_audit_log')
        .insert({
          employer_id: employerId,
          new_rating: body.overall_rating || null,
          new_score: body.overall_score || null,
          rating_source: 'organiser_expertise',
          source_id: rating.id,
          reason_for_change: `New expertise assessment created by ${profile.role}`,
          changed_by: user.id,
        });
    }

    // Get organiser info for response
    const { data: organiserInfo } = await supabase
      .from('profiles')
      .select('first_name, surname, role')
      .eq('id', user.id)
      .single();

    // Return created rating
    const response: ExpertiseRatingResponse = {
      id: rating.id,
      employer_id: rating.employer_id,
      organiser_id: rating.organiser_id,
      assessment_date: rating.assessment_date,
      overall_score: rating.overall_score,
      overall_rating: rating.overall_rating,
      confidence_level: rating.confidence_level,
      assessment_basis: rating.assessment_basis,
      assessment_context: rating.assessment_context,
      eba_status_known: rating.eba_status_known,
      eba_status: rating.eba_status,
      knowledge_beyond_projects: rating.knowledge_beyond_projects,
      knowledge_beyond_projects_details: rating.knowledge_beyond_projects_details,
      industry_reputation: rating.industry_reputation,
      union_relationship_quality: rating.union_relationship_quality,
      historical_issues: rating.historical_issues,
      recent_improvements: rating.recent_improvements,
      improvement_details: rating.improvement_details,
      future_concerns: rating.future_concerns,
      concern_details: rating.concern_details,
      assessment_notes: rating.assessment_notes,
      is_active: rating.is_active,
      expires_date: rating.expires_date,
      created_at: rating.created_at,
      updated_at: rating.updated_at,
      created_by: rating.created_by,
      updated_by: rating.updated_by,

      organiser: organiserInfo ? {
        id: user.id,
        name: `${organiserInfo.first_name} ${organiserInfo.surname}`.trim(),
        role: organiserInfo.role,
      } : undefined,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Create expertise rating API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getExpertiseRatingsHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export const POST = withRateLimit(
  (request, context) => createExpertiseRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('organiser_overall_expertise_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Ratings': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}