import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import * as Sentry from '@sentry/nextjs';

// TypeScript interfaces for 4-point rating system
interface ProjectAssessment4Point {
  id: string;
  project_id: string;
  project_name: string;
  assessment_date: string;
  overall_rating: number;
  overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  assessment_type: string;
  confidence_level: 'very_high' | 'high' | 'medium' | 'low';
  assessor_name?: string;
  notes?: string;
}

interface ExpertiseAssessment4Point {
  id: string;
  assessment_date: string;
  overall_rating: number;
  overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  confidence_level: 'very_high' | 'high' | 'medium' | 'low';
  organiser_name: string;
  assessment_basis: string;
  notes?: string;
}

interface EmployerRating4PointResponse {
  employer_id: string;
  eba_status?: {
    hasActiveEba: boolean;
    status: 'red' | 'amber' | 'yellow' | 'green';
  };
  current_rating: {
    // Overall current rating (using weighted calculation)
    rating: 'red' | 'amber' | 'yellow' | 'green';
    score: number;
    confidence: 'very_high' | 'high' | 'medium' | 'low';
    source: 'organiser_expertise' | 'project_average' | 'hybrid';
    calculated_at: string;
  } | null;

  // Project-based assessments (Track 1)
  project_assessments: {
    summary: {
      average_rating: number;
      average_rating_label: 'red' | 'amber' | 'yellow' | 'green';
      total_assessments: number;
      unique_projects: number;
      latest_assessment_date: string | null;
      assessment_types: string[];
    };
    assessments: ProjectAssessment4Point[];
  };

  // Organiser expertise assessments (Track 2)
  expertise_assessments: {
    summary: {
      average_rating: number;
      average_rating_label: 'red' | 'amber' | 'yellow' | 'green';
      total_assessments: number;
      unique_organisers: number;
      latest_assessment_date: string | null;
      has_conflicts: boolean;
    };
    assessments: ExpertiseAssessment4Point[];
  };

  // Rating history
  rating_history: Array<{
    date: string;
    project_rating: number;
    project_rating_label: 'red' | 'amber' | 'yellow' | 'green';
    expertise_rating: number;
    expertise_rating_label: 'red' | 'amber' | 'yellow' | 'green';
    final_rating: 'red' | 'amber' | 'yellow' | 'green';
    final_source: 'organiser_expertise' | 'project_average' | 'calculated';
  }>;

  // Project count data for visualization
  project_count_data?: {
    assessed_projects: number;
    total_projects: number;
    weight_distribution: {
      project_data: number;
      organiser_expertise: number;
    };
    data_quality: 'high' | 'medium' | 'low';
  };

  // Metadata
  retrieved_at: string;
  data_quality: 'high' | 'medium' | 'low' | 'very_low';
  error?: string;
}

export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  // #region agent log
  const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2';
  const debugLog = (location: string, message: string, data: any, hypothesisId: string) => {
    // Log to Sentry breadcrumbs in production and local debug endpoint in dev
    Sentry.addBreadcrumb({ category: 'ratings-4point', message, data: { ...data, location, hypothesisId }, level: 'info' });
    if (process.env.NODE_ENV === 'development') {
      fetch(DEBUG_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId }) }).catch(() => {});
    }
  };
  const serializeError = (err: any): Record<string, unknown> => {
    if (!err) return { raw: err };
    if (typeof err !== 'object') return { raw: err };
    return { message: err.message, code: err.code, details: err.details, hint: err.hint, status: err.status, statusCode: err.statusCode };
  };
  // #endregion
  const apiStartTime = Date.now();
  try {
    const { employerId } = params;
    // #region agent log
    debugLog('route.ts:GET:entry', 'ratings-4point API called', { employerId }, 'A');
    console.log('[ratings-4point] API started', { employerId, timestamp: new Date().toISOString() });
    // #endregion

    // Check if 4-point rating system is enabled
    // In development, always enable. In production, check feature flag.
    const isEnabled = process.env.NODE_ENV === 'development' ||
                     (process.env.RATING_SYSTEM_4POINT === 'true');
    if (!isEnabled) {
      console.log('4-point rating system is disabled via feature flag');
      return NextResponse.json({
        employer_id: employerId,
        current_rating: null,
        project_assessments: { summary: null, assessments: [] },
        expertise_assessments: { summary: null, assessments: [] },
        rating_history: [],
        retrieved_at: new Date().toISOString(),
        data_quality: 'very_low',
        error: '4-point rating system not enabled'
      });
    }

    const supabase = await createServerSupabase();

    // #region agent log - Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[ratings-4point] Auth error:', JSON.stringify(serializeError(authError)));
      Sentry.captureException(new Error(`Auth error in ratings-4point: ${authError.message}`), {
        extra: { employerId, authError: serializeError(authError) }
      });
    }
    if (!user) {
      // NOTE: Previously this let unauthenticated requests through to fail via RLS.
      // This caused confusing "permission denied" errors instead of clear 401s.
      // Now returning 401 consistent with other API routes for better error handling.
      console.warn('[ratings-4point] No authenticated user - returning 401', { employerId, hasAuthError: !!authError });
      Sentry.addBreadcrumb({ category: 'ratings-4point', message: 'No authenticated user - 401', level: 'warning', data: { employerId, hasAuthError: !!authError } });
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to access employer ratings' },
        { status: 401 }
      );
    } else {
      debugLog('route.ts:auth', 'User authenticated', { employerId, userId: user.id }, 'A');
    }
    // #endregion

    // First check if the required tables exist by attempting a simple query
    try {
      const { error: tableCheckError } = await supabase
        .from('union_respect_assessments_4point')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist
        console.log('4-point rating tables do not exist yet');
        return NextResponse.json({
          employer_id: employerId,
          current_rating: null,
          project_assessments: { summary: null, assessments: [] },
          expertise_assessments: { summary: null, assessments: [] },
          rating_history: [],
          retrieved_at: new Date().toISOString(),
          data_quality: 'very_low',
          error: '4-point rating tables not found - migrations may need to be run'
        });
      }
    } catch (error) {
      console.log('Error checking tables, proceeding with queries:', error);
    }

    // Get current employer rating using the weighted calculation function
    let currentRating = null;
    let weightedRatingData = null;
    let ebaStatus = null;

    try {
      // Use the weighted rating calculation function
      // #region agent log
      const rpcStart = Date.now();
      debugLog('route.ts:rpc:start', 'Starting weighted rating RPC', { employerId }, 'A');
      // #endregion
      const { data: weightedData, error: weightedError } = await supabase
        .rpc('calculate_weighted_employer_rating_4point', {
          p_employer_id: employerId
        });
      // #region agent log
      debugLog('route.ts:rpc:complete', 'Weighted rating RPC completed', { employerId, durationMs: Date.now() - rpcStart, hasError: !!weightedError, errorMessage: weightedError?.message, errorCode: weightedError?.code, errorDetails: weightedError?.details }, 'A');
      // #endregion

      if (weightedError) {
        console.error('Error in weighted rating calculation:', weightedError);
      } else {
        weightedRatingData = weightedData;

        // Also get EBA status
        const { data: ebaData, error: ebaError } = await supabase
          .from('employers')
          .select('enterprise_agreement_status')
          .eq('id', employerId)
          .single();

        if (!ebaError && ebaData) {
          ebaStatus = {
            hasActiveEba: ebaData.enterprise_agreement_status === true,
            status: ebaData.enterprise_agreement_status === true ? 'yellow' : 'red'
          };
        }

        // Convert weighted rating data to the expected format
        if (weightedData) {
          currentRating = {
            id: weightedData.employer_id,
            employer_id: weightedData.employer_id,
            rating_date: weightedData.calculation_date,
            current_rating: parseInt(weightedData.final_score),
            current_score: parseFloat(weightedData.final_score),
            eba_status_rating: weightedData.eba_data?.rating || null,
            project_based_rating: parseInt(weightedData.project_rating),
            expertise_rating: parseInt(weightedData.organiser_rating),
            data_quality: weightedData.data_quality,
            rating_source: 'hybrid',
            weight_distribution: weightedData.weight_distribution,
            calculation_audit: weightedData.calculation_audit,
            rating_status: 'active',
            has_project_data: weightedData.project_assessments_exist || false,
            has_expertise_data: weightedData.organiser_assessments_exist || false,
            has_eba_data: ebaStatus?.hasActiveEba || false,
            last_updated: weightedData.calculated_at
          };
        }
      }
    } catch (error) {
      console.error('Error in weighted rating calculation:', error);
    }

    // Get project-based assessments (Track 1) - with error handling
    let projectAssessments: any[] = [];
    let safetyAssessments: any[] = [];
    let subcontractorAssessments: any[] = [];

    // First get the employer's projects
    let employerProjectIds: string[] = [];
    try {
      const { data: employerProjects } = await supabase
        .rpc('get_employer_sites', { p_employer_id: employerId });

      if (employerProjects) {
        employerProjectIds = [...new Set(employerProjects.map(p => p.project_id))];
      }
    } catch (error) {
      console.error('Error fetching employer projects:', error);
    }

    // Only fetch assessments if we have associated projects
    if (employerProjectIds.length > 0) {
      try {
        const { data, error: projectError } = await supabase
          .from('union_respect_assessments_4point')
          .select(`
            id,
            project_id,
            assessment_date,
            overall_union_respect_rating,
            confidence_level,
            notes,
            projects!inner(name)
          `)
          .eq('employer_id', employerId)
          .in('project_id', employerProjectIds)
          .order('assessment_date', { ascending: false })
          .limit(50);

        if (projectError) {
          console.error('Error fetching union respect assessments:', projectError);
        } else {
          projectAssessments = data || [];
        }
      } catch (error) {
        console.error('Error in union respect assessments query:', error);
      }

      try {
        const { data, error: safetyError } = await supabase
          .from('safety_assessments_4point')
          .select(`
            id,
            project_id,
            assessment_date,
            overall_safety_rating,
            confidence_level,
            notes,
            projects!inner(name)
          `)
          .eq('employer_id', employerId)
          .in('project_id', employerProjectIds)
          .order('assessment_date', { ascending: false })
          .limit(50);

        if (safetyError) {
          console.error('Error fetching safety assessments:', safetyError);
        } else {
          safetyAssessments = data || [];
        }
      } catch (error) {
        console.error('Error in safety assessments query:', error);
      }

      try {
        const { data, error: subcontractorError } = await supabase
          .from('subcontractor_assessments_4point')
          .select(`
            id,
            project_id,
            assessment_date,
            usage_rating,
            confidence_level,
            notes,
            projects!inner(name)
          `)
          .eq('employer_id', employerId)
          .in('project_id', employerProjectIds)
          .order('assessment_date', { ascending: false })
          .limit(50);

        if (subcontractorError) {
          console.error('Error fetching subcontractor assessments:', subcontractorError);
        } else {
          subcontractorAssessments = data || [];
        }
      } catch (error) {
        console.error('Error in subcontractor assessments query:', error);
      }
    }

    // Get organiser expertise assessments (Track 2) - with error handling
    let expertiseAssessments: any[] = [];
    try {
      // #region agent log
      const expertiseStart = Date.now();
      debugLog('route.ts:expertise:start', 'Starting expertise assessments query', { employerId }, 'B');
      // #endregion
      const { data, error: expertiseError } = await supabase
        .from('organiser_overall_expertise_ratings')
        .select(`
          id,
          assessment_date,
          overall_score,
          overall_rating,
          confidence_level,
          assessment_basis,
          organiser_id,
          profiles!organiser_overall_expertise_ratings_organiser_id_fkey(full_name)
        `)
        .eq('employer_id', employerId)
        .eq('is_active', true)
        .order('assessment_date', { ascending: false })
        .limit(50);
      // #region agent log
      debugLog('route.ts:expertise:complete', 'Expertise assessments query completed', { employerId, durationMs: Date.now() - expertiseStart, hasError: !!expertiseError, errorMessage: expertiseError?.message, errorCode: expertiseError?.code, errorDetails: expertiseError?.details, errorHint: expertiseError?.hint, resultCount: data?.length }, 'B');
      // #endregion

      if (expertiseError) {
        // #region agent log
        const serialized = serializeError(expertiseError);
        debugLog('route.ts:expertise:error', 'Expertise error details', { employerId, ...serialized }, 'C');
        Sentry.captureException(new Error(`Expertise assessments query failed: ${serialized.message || 'Unknown error'}`), {
          extra: { employerId, errorCode: serialized.code, errorDetails: serialized.details, errorHint: serialized.hint }
        });
        // #endregion
        console.error('[ratings-4point] Error fetching expertise assessments:', JSON.stringify(serialized), 'employerId:', employerId);
      } else {
        expertiseAssessments = data || [];
      }
    } catch (error) {
      // #region agent log
      debugLog('route.ts:expertise:exception', 'Exception in expertise query', { employerId, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'B');
      // #endregion
      console.error('Error in expertise assessments query:', error);
    }

    // Process project assessments
    const processedProjectAssessments: ProjectAssessment4Point[] = [];

    // Process union respect assessments
    for (const assessment of projectAssessments || []) {
      try {
        processedProjectAssessments.push({
          id: assessment.id,
          project_id: assessment.project_id,
          project_name: (assessment.projects as any)?.name || 'Unknown Project',
          assessment_date: assessment.assessment_date,
          overall_rating: assessment.overall_union_respect_rating,
          overall_rating_label: convertNumericToLabel(assessment.overall_union_respect_rating),
          assessment_type: 'union_respect',
          confidence_level: assessment.confidence_level as any,
          notes: assessment.notes
        });
      } catch (error) {
        console.error('Error processing union respect assessment:', error, assessment);
      }
    }

    // Process safety assessments
    for (const assessment of safetyAssessments || []) {
      try {
        processedProjectAssessments.push({
          id: assessment.id,
          project_id: assessment.project_id,
          project_name: (assessment.projects as any)?.name || 'Unknown Project',
          assessment_date: assessment.assessment_date,
          overall_rating: assessment.overall_safety_rating,
          overall_rating_label: convertNumericToLabel(assessment.overall_safety_rating),
          assessment_type: 'safety',
          confidence_level: assessment.confidence_level as any,
          notes: assessment.notes
        });
      } catch (error) {
        console.error('Error processing safety assessment:', error, assessment);
      }
    }

    // Process subcontractor assessments
    for (const assessment of subcontractorAssessments || []) {
      try {
        processedProjectAssessments.push({
          id: assessment.id,
          project_id: assessment.project_id,
          project_name: (assessment.projects as any)?.name || 'Unknown Project',
          assessment_date: assessment.assessment_date,
          overall_rating: assessment.usage_rating,
          overall_rating_label: convertNumericToLabel(assessment.usage_rating),
          assessment_type: 'subcontractor',
          confidence_level: assessment.confidence_level as any,
          notes: assessment.notes
        });
      } catch (error) {
        console.error('Error processing subcontractor assessment:', error, assessment);
      }
    }

    // Group project assessments by project and calculate averages
    const projectGroups = new Map<string, ProjectAssessment4Point[]>();
    for (const assessment of processedProjectAssessments) {
      if (!projectGroups.has(assessment.project_id)) {
        projectGroups.set(assessment.project_id, []);
      }
      projectGroups.get(assessment.project_id)!.push(assessment);
    }

    // Calculate project summary
    let projectSummary = {
      average_rating: 0,
      average_rating_label: 'red' as const,
      total_assessments: 0,
      unique_projects: 0,
      latest_assessment_date: null as string | null,
      assessment_types: [] as string[]
    };

    if (processedProjectAssessments.length > 0) {
      const totalScore = processedProjectAssessments.reduce((sum, a) => sum + a.overall_rating, 0);
      projectSummary.average_rating = totalScore / processedProjectAssessments.length;
      projectSummary.average_rating_label = convertNumericToLabel(Math.round(projectSummary.average_rating));
      projectSummary.total_assessments = processedProjectAssessments.length;
      projectSummary.unique_projects = projectGroups.size;
      projectSummary.latest_assessment_date = processedProjectAssessments[0].assessment_date;
      projectSummary.assessment_types = [...new Set(processedProjectAssessments.map(a => a.assessment_type))];
    } else {
      projectSummary = {
        average_rating: 0,
        average_rating_label: 'red' as const,
        total_assessments: 0,
        unique_projects: 0,
        latest_assessment_date: null,
        assessment_types: []
      };
    }

    // Process expertise assessments
    const processedExpertiseAssessments: ExpertiseAssessment4Point[] = [];
    for (const assessment of expertiseAssessments || []) {
      try {
        processedExpertiseAssessments.push({
          id: assessment.id,
          assessment_date: assessment.assessment_date,
          overall_rating: assessment.overall_score || 1,
          overall_rating_label: convertNumericToLabel(assessment.overall_score || 1),
          confidence_level: assessment.confidence_level as any,
          organiser_name: (assessment.profiles as any)?.full_name || 'Unknown Organiser',
          assessment_basis: assessment.assessment_basis || 'Not specified',
          notes: null
        });
      } catch (error) {
        console.error('Error processing expertise assessment:', error, assessment);
      }
    }

    // Calculate expertise summary
    let expertiseSummary = {
      average_rating: 0,
      average_rating_label: 'red' as const,
      total_assessments: 0,
      unique_organisers: 0,
      latest_assessment_date: null as string | null,
      has_conflicts: false
    };

    if (processedExpertiseAssessments.length > 0) {
      const totalScore = processedExpertiseAssessments.reduce((sum, a) => sum + a.overall_rating, 0);
      expertiseSummary.average_rating = totalScore / processedExpertiseAssessments.length;
      expertiseSummary.average_rating_label = convertNumericToLabel(Math.round(expertiseSummary.average_rating));
      expertiseSummary.total_assessments = processedExpertiseAssessments.length;
      expertiseSummary.unique_organisers = new Set(processedExpertiseAssessments.map(a => a.organiser_name)).size;
      expertiseSummary.latest_assessment_date = processedExpertiseAssessments[0].assessment_date;

      // Check for conflicts between project and expertise ratings
      const projectRatingRounded = Math.round(projectSummary.average_rating);
      const expertiseRatingRounded = Math.round(expertiseSummary.average_rating);
      expertiseSummary.has_conflicts = Math.abs(projectRatingRounded - expertiseRatingRounded) >= 1;
    } else {
      expertiseSummary = {
        average_rating: 0,
        average_rating_label: 'red' as const,
        total_assessments: 0,
        unique_organisers: 0,
        latest_assessment_date: null,
        has_conflicts: false
      };
    }

    // Use weighted calculation if available, otherwise fall back to the old logic
    let currentOverallRating = null;
    if (weightedRatingData) {
      // Use the weighted calculation result
      const finalScore = parseFloat(weightedRatingData.final_score);
      currentOverallRating = {
        rating: weightedRatingData.final_rating as 'red' | 'amber' | 'yellow' | 'green',
        score: finalScore,
        confidence: weightedRatingData.data_quality as 'very_high' | 'high' | 'medium' | 'low',
        source: 'hybrid' as const,
        calculated_at: weightedRatingData.calculated_at
      };
    } else if (expertiseSummary.total_assessments > 0) {
      // Use expertise rating as primary (fallback)
      currentOverallRating = {
        rating: expertiseSummary.average_rating_label,
        score: Math.round(expertiseSummary.average_rating),
        confidence: expertiseSummary.total_assessments >= 3 ? 'high' : expertiseSummary.total_assessments >= 1 ? 'medium' : 'low',
        source: 'organiser_expertise',
        calculated_at: expertiseSummary.latest_assessment_date || new Date().toISOString()
      };
    } else if (projectSummary.total_assessments > 0) {
      // Fall back to project rating (fallback)
      currentOverallRating = {
        rating: projectSummary.average_rating_label,
        score: Math.round(projectSummary.average_rating),
        confidence: projectSummary.total_assessments >= 5 ? 'high' : projectSummary.total_assessments >= 2 ? 'medium' : 'low',
        source: 'project_average',
        calculated_at: projectSummary.latest_assessment_date || new Date().toISOString()
      };
    }

    // Generate rating history (simplified - last 6 months)
    const ratingHistory = [];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Group assessments by month
    const monthlyProjectData = new Map<string, number[]>();
    const monthlyExpertiseData = new Map<string, number[]>();

    for (const assessment of processedProjectAssessments) {
      if (new Date(assessment.assessment_date) >= sixMonthsAgo) {
        const monthKey = assessment.assessment_date.substring(0, 7); // YYYY-MM
        if (!monthlyProjectData.has(monthKey)) {
          monthlyProjectData.set(monthKey, []);
        }
        monthlyProjectData.get(monthKey)!.push(assessment.overall_rating);
      }
    }

    for (const assessment of processedExpertiseAssessments) {
      if (new Date(assessment.assessment_date) >= sixMonthsAgo) {
        const monthKey = assessment.assessment_date.substring(0, 7);
        if (!monthlyExpertiseData.has(monthKey)) {
          monthlyExpertiseData.set(monthKey, []);
        }
        monthlyExpertiseData.get(monthKey)!.push(assessment.overall_rating);
      }
    }

    // Create history entries
    const allMonths = new Set([...monthlyProjectData.keys(), ...monthlyExpertiseData.keys()]);
    const sortedMonths = Array.from(allMonths).sort();

    for (const month of sortedMonths) {
      const projectRatings = monthlyProjectData.get(month) || [];
      const expertiseRatings = monthlyExpertiseData.get(month) || [];

      const avgProjectRating = projectRatings.length > 0 ? projectRatings.reduce((sum, r) => sum + r, 0) / projectRatings.length : 0;
      const avgExpertiseRating = expertiseRatings.length > 0 ? expertiseRatings.reduce((sum, r) => sum + r, 0) / expertiseRatings.length : 0;

      // Determine final rating for this month (expertise priority)
      let finalRating = avgProjectRating;
      let finalSource: 'organiser_expertise' | 'project_average' | 'calculated' = 'project_average';

      if (expertiseRatings.length > 0) {
        finalRating = avgExpertiseRating;
        finalSource = 'organiser_expertise';
      }

      ratingHistory.push({
        date: month + '-01',
        project_rating: Math.round(avgProjectRating * 10) / 10,
        project_rating_label: convertNumericToLabel(Math.round(avgProjectRating)),
        expertise_rating: Math.round(avgExpertiseRating * 10) / 10,
        expertise_rating_label: convertNumericToLabel(Math.round(avgExpertiseRating)),
        final_rating: convertNumericToLabel(Math.round(finalRating)),
        final_source: finalSource
      });
    }

    // Determine overall data quality
    let dataQuality: 'high' | 'medium' | 'low' | 'very_low' = 'very_low';
    if (expertiseSummary.total_assessments >= 3 && projectSummary.total_assessments >= 5) {
      dataQuality = 'high';
    } else if (expertiseSummary.total_assessments >= 1 && projectSummary.total_assessments >= 2) {
      dataQuality = 'medium';
    } else if (expertiseSummary.total_assessments >= 1 || projectSummary.total_assessments >= 1) {
      dataQuality = 'low';
    }

    // Get total project count for this employer
    // Use the same logic as get_employer_sites function
    let totalProjects = projectSummary.unique_projects; // Default to assessed projects
    try {
      // First get all projects where employer has a role or is builder
      const { data: employerProjects, error: projectError } = await supabase
        .rpc('get_employer_sites', { p_employer_id: employerId });

      if (!projectError && employerProjects) {
        // Count unique projects
        const uniqueProjectIds = new Set(employerProjects.map(p => p.project_id));
        totalProjects = uniqueProjectIds.size;
      }
    } catch (error) {
      console.error('Error fetching total project count:', error);
    }

    // Calculate weight distribution using the new formula: project_count * 0.10, capped at 90%
    let projectDataWeight = 0;
    let organiserExpertiseWeight = 100;

    if (weightedRatingData && weightedRatingData.weight_distribution) {
      // Use the calculated weights from the weighted function
      projectDataWeight = Math.round((weightedRatingData.weight_distribution.project_weight || 0) * 100);
      organiserExpertiseWeight = Math.round((weightedRatingData.weight_distribution.organiser_weight || 0) * 100);
    } else {
      // Fall back to the new formula if weighted calculation failed
      const projectCount = projectSummary.unique_projects;
      projectDataWeight = Math.min(90, projectCount * 10);
      organiserExpertiseWeight = 100 - projectDataWeight;
    }

    const projectCountData = {
      assessed_projects: projectSummary.unique_projects,
      total_projects: totalProjects,
      weight_distribution: {
        project_data: projectDataWeight,
        organiser_expertise: organiserExpertiseWeight
      },
      data_quality: dataQuality === 'very_low' ? 'low' : dataQuality as 'high' | 'medium' | 'low'
    };

    const response: EmployerRating4PointResponse = {
      employer_id: employerId,
      eba_status: ebaStatus || undefined,
      current_rating: currentOverallRating,
      project_assessments: {
        summary: projectSummary,
        assessments: processedProjectAssessments.sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
      },
      expertise_assessments: {
        summary: expertiseSummary,
        assessments: processedExpertiseAssessments.sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
      },
      rating_history: ratingHistory,
      project_count_data: projectCountData,
      retrieved_at: new Date().toISOString(),
      data_quality: dataQuality
    };

    // #region agent log
    const totalDuration = Date.now() - apiStartTime;
    debugLog('route.ts:success', 'API completed successfully', { employerId, projectAssessmentCount: processedProjectAssessments.length, expertiseAssessmentCount: processedExpertiseAssessments.length, dataQuality, totalDurationMs: totalDuration }, 'D');
    console.log('[ratings-4point] API completed', { employerId, totalDurationMs: totalDuration, projectAssessments: processedProjectAssessments.length, expertiseAssessments: processedExpertiseAssessments.length });
    // #endregion

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    // #region agent log
    const totalDuration = Date.now() - apiStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog('route.ts:catch', 'Unhandled exception in ratings-4point', { employerId: params.employerId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined, errorType: typeof error, totalDurationMs: totalDuration }, 'D');
    console.error('[ratings-4point] Unhandled exception:', { employerId: params.employerId, error: errorMessage, totalDurationMs: totalDuration });
    Sentry.captureException(error, { extra: { employerId: params.employerId, totalDurationMs: totalDuration } });
    // #endregion
    console.error('Error fetching 4-point employer ratings:', error);

    return NextResponse.json({
      employer_id: params.employerId,
      current_rating: null,
      project_assessments: { summary: null, assessments: [] },
      expertise_assessments: { summary: null, assessments: [] },
      rating_history: [],
      retrieved_at: new Date().toISOString(),
      data_quality: 'very_low',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Content-Type': 'application/json'
      }
    });
  }
}

function convertNumericToLabel(rating: number): 'red' | 'amber' | 'yellow' | 'green' {
  switch (rating) {
    case 1: return 'red';
    case 2: return 'amber';
    case 3: return 'yellow';
    case 4: return 'green';
    default: return 'red';
  }
}
