import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';

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
  current_rating: {
    // Overall current rating (organiser expertise takes priority)
    rating: 'red' | 'amber' | 'yellow' | 'green';
    score: number;
    confidence: 'very_high' | 'high' | 'medium' | 'low';
    source: 'organiser_expertise' | 'project_average' | 'calculated';
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

  // Metadata
  retrieved_at: string;
  data_quality: 'high' | 'medium' | 'low' | 'very_low';
}

export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    // Check if 4-point rating system is enabled
    if (!featureFlags.isEnabled('RATING_SYSTEM_4POINT')) {
      return NextResponse.json({
        employer_id: employerId,
        current_rating: null,
        project_assessments: { summary: null, assessments: [] },
        expertise_assessments: { summary: null, assessments: [] },
        rating_history: [],
        retrieved_at: new Date().toISOString(),
        data_quality: 'very_low'
      });
    }

    const supabase = await createServerSupabase();

    // Get current employer rating
    const { data: currentRating, error: currentRatingError } = await supabase
      .from('current_employer_ratings_4point')
      .select('*')
      .eq('employer_id', employerId)
      .order('rating_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentRatingError && currentRatingError.code !== 'PGRST116') {
      console.error('Error fetching current rating:', currentRatingError);
    }

    // Get project-based assessments (Track 1)
    const { data: projectAssessments, error: projectError } = await supabase
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
      .eq('projects.is_active', true)
      .order('assessment_date', { ascending: false })
      .limit(50);

    if (projectError) {
      console.error('Error fetching project assessments:', projectError);
    }

    // Get safety assessments
    const { data: safetyAssessments, error: safetyError } = await supabase
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
      .eq('projects.is_active', true)
      .order('assessment_date', { ascending: false })
      .limit(50);

    if (safetyError) {
      console.error('Error fetching safety assessments:', safetyError);
    }

    // Get subcontractor assessments
    const { data: subcontractorAssessments, error: subcontractorError } = await supabase
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
      .eq('projects.is_active', true)
      .order('assessment_date', { ascending: false })
      .limit(50);

    if (subcontractorError) {
      console.error('Error fetching subcontractor assessments:', subcontractorError);
    }

    // Get organiser expertise assessments (Track 2) - from the actual organiser input table
    const { data: expertiseAssessments, error: expertiseError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .select(`
        id,
        assessment_date,
        overall_score,
        overall_rating,
        confidence_level,
        assessment_basis,
        organiser_id,
        profiles!organiser_overall_expertise_ratings_organiser_id_fkey(name)
      `)
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .order('assessment_date', { ascending: false })
      .limit(50);

    if (expertiseError) {
      console.error('Error fetching expertise assessments:', expertiseError);
    }

    // Process project assessments
    const processedProjectAssessments: ProjectAssessment4Point[] = [];

    if (projectAssessments) {
      for (const assessment of projectAssessments) {
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
      }
    }

    if (safetyAssessments) {
      for (const assessment of safetyAssessments) {
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
      }
    }

    if (subcontractorAssessments) {
      for (const assessment of subcontractorAssessments) {
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
    }

    // Process expertise assessments
    const processedExpertiseAssessments: ExpertiseAssessment4Point[] = [];
    if (expertiseAssessments) {
      for (const assessment of expertiseAssessments) {
        processedExpertiseAssessments.push({
          id: assessment.id,
          assessment_date: assessment.assessment_date,
          overall_rating: assessment.overall_score || 1,
          overall_rating_label: convertNumericToLabel(assessment.overall_score || 1),
          confidence_level: assessment.confidence_level as any,
          organiser_name: (assessment.profiles as any)?.name || 'Unknown Organiser',
          assessment_basis: assessment.assessment_basis || 'Not specified',
          notes: null
        });
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
    }

    // Determine current overall rating (organiser expertise takes priority)
    let currentOverallRating = null;
    if (expertiseSummary.total_assessments > 0) {
      // Use expertise rating as primary
      currentOverallRating = {
        rating: expertiseSummary.average_rating_label,
        score: Math.round(expertiseSummary.average_rating),
        confidence: expertiseSummary.total_assessments >= 3 ? 'high' : expertiseSummary.total_assessments >= 1 ? 'medium' : 'low',
        source: 'organiser_expertise',
        calculated_at: expertiseSummary.latest_assessment_date || new Date().toISOString()
      };
    } else if (projectSummary.total_assessments > 0) {
      // Fall back to project rating
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

    const response: EmployerRating4PointResponse = {
      employer_id: employerId,
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
      retrieved_at: new Date().toISOString(),
      data_quality: dataQuality
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error fetching 4-point employer ratings:', error);

    return NextResponse.json({
      employer_id: params.employerId,
      current_rating: null,
      project_assessments: { summary: null, assessments: [] },
      expertise_assessments: { summary: null, assessments: [] },
      rating_history: [],
      retrieved_at: new Date().toISOString(),
      data_quality: 'very_low'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
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
