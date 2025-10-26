import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface ProjectComplianceSummary {
  employer_id: string;
  calculation_date: string;
  project_rating: 'green' | 'amber' | 'red' | 'unknown';
  project_score: number | null;
  data_quality: 'high' | 'medium' | 'low' | 'very_low';
  assessment_count: number;
  assessments: ProjectComplianceAssessment[];
  latest_assessment_date: string | null;
  earliest_assessment_date: string | null;
  data_age_days: number | null;
}

export interface ProjectComplianceAssessment {
  assessment_type: string;
  score: number | null;
  confidence_level: string;
  assessment_date: string;
  weight: number;
  severity_level: number | null;
  severity_name: string | null;
  project_id: string | null;
  project_name: string | null;
  project_tier: string | null;
  assessment_notes: string | null;
}

export interface ProjectComplianceAnalytics {
  by_assessment_type: Record<string, {
    count: number;
    average_score: number;
    latest_date: string;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  by_project: Record<string, {
    project_name: string;
    assessment_count: number;
    average_score: number;
    latest_date: string;
  }>;
  trends: {
    last_30_days: number;
    last_90_days: number;
    last_180_days: number;
    direction: 'improving' | 'stable' | 'declining';
    trend_strength: number; // 0-100
  };
  recommendations: string[];
}

export interface ProjectComplianceResponse {
  employer_id: string;
  current_summary: ProjectComplianceSummary;
  analytics: ProjectComplianceAnalytics;
  comparison: {
    industry_average: number | null;
    industry_percentile: number | null;
    similar_employers_count: number;
    rating_distribution: Record<string, number>;
  };
  insights: {
    strengths: string[];
    concerns: string[];
    recommended_actions: string[];
    data_gaps: string[];
  };
}

// GET handler - Get aggregated project compliance data for employer
async function getProjectComplianceHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
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
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '365');
    const calculationDate = searchParams.get('calculationDate') || new Date().toISOString().split('T')[0];
    const includeAnalytics = searchParams.get('includeAnalytics') !== 'false';
    const includeComparison = searchParams.get('includeComparison') === 'true';

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name, employer_type')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Calculate project compliance rating using database function
    const { data: calculationResult, error: calculationError } = await supabase
      .rpc('calculate_project_compliance_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_lookback_days: lookbackDays,
      });

    if (calculationError) {
      console.error('Failed to calculate project compliance rating:', calculationError);
      return NextResponse.json({ error: 'Failed to calculate project compliance rating' }, { status: 500 });
    }

    // Parse calculation result
    const summary: ProjectComplianceSummary = {
      employer_id: employerId,
      calculation_date,
      project_rating: calculationResult.project_rating || 'unknown',
      project_score: calculationResult.project_score,
      data_quality: calculationResult.data_quality || 'very_low',
      assessment_count: calculationResult.assessment_count || 0,
      assessments: (calculationResult.assessments || []).map((assessment: any) => ({
        assessment_type: assessment.assessment_type,
        score: assessment.score,
        confidence_level: assessment.confidence_level,
        assessment_date: assessment.assessment_date,
        weight: assessment.weight,
        severity_level: assessment.severity_level,
        severity_name: assessment.severity_name,
        project_id: assessment.project_id,
        project_name: assessment.project_name,
        project_tier: assessment.project_tier,
        assessment_notes: assessment.assessment_notes,
      })),
      latest_assessment_date: calculationResult.latest_assessment_date,
      earliest_assessment_date: calculationResult.earliest_assessment_date,
      data_age_days: calculationResult.data_age_days,
    };

    let analytics: ProjectComplianceAnalytics | undefined;
    let comparison: any | undefined;

    if (includeAnalytics) {
      // Generate analytics
      analytics = await generateProjectComplianceAnalytics(supabase, employerId, lookbackDays);
    }

    if (includeComparison) {
      // Generate comparison data
      comparison = await generateComparisonData(supabase, employer, summary.project_score);
    }

    // Generate insights
    const insights = generateInsights(summary, analytics);

    const response: ProjectComplianceResponse = {
      employer_id: employerId,
      current_summary: summary,
      analytics: analytics || {
        by_assessment_type: {},
        by_project: {},
        trends: {
          last_30_days: 0,
          last_90_days: 0,
          last_180_days: 0,
          direction: 'stable',
          trend_strength: 0,
        },
        recommendations: [],
      },
      comparison: comparison || {
        industry_average: null,
        industry_percentile: null,
        similar_employers_count: 0,
        rating_distribution: {},
      },
      insights,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      'Content-Type': 'application/json',
      'X-Rating-Cache-Key': `project-compliance-${employerId}-${calculationDate}`,
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get project compliance API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate analytics
async function generateProjectComplianceAnalytics(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  lookbackDays: number
): Promise<ProjectComplianceAnalytics> {
  try {
    // Get detailed assessments for analytics
    const { data: assessments, error } = await supabase
      .from('project_compliance_assessments')
      .select(`
        assessment_type,
        score,
        confidence_level,
        assessment_date,
        severity_level,
        projects!project_id(id, name, tier),
        compliance_assessment_weights!inner(weight)
      `)
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .gte('assessment_date', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('assessment_date', { ascending: false });

    if (error || !assessments) {
      throw new Error('Failed to fetch assessments for analytics');
    }

    // Group by assessment type
    const byAssessmentType: Record<string, any> = {};
    const byProject: Record<string, any> = {};

    assessments.forEach((assessment: any) => {
      const type = assessment.assessment_type;
      const score = assessment.score;
      const project = assessment.projects;

      // Group by assessment type
      if (!byAssessmentType[type]) {
        byAssessmentType[type] = {
          count: 0,
          totalScore: 0,
          latestDate: assessment.assessment_date,
          scores: [],
        };
      }

      byAssessmentType[type].count++;
      if (score !== null) {
        byAssessmentType[type].totalScore += score;
        byAssessmentType[type].scores.push(score);
      }
      if (assessment.assessment_date > byAssessmentType[type].latestDate) {
        byAssessmentType[type].latestDate = assessment.assessment_date;
      }

      // Group by project
      if (project) {
        const projectId = project.id;
        if (!byProject[projectId]) {
          byProject[projectId] = {
            project_name: project.name,
            assessment_count: 0,
            totalScore: 0,
            latestDate: assessment.assessment_date,
          };
        }

        byProject[projectId].assessment_count++;
        if (score !== null) {
          byProject[projectId].totalScore += score;
        }
        if (assessment.assessment_date > byProject[projectId].latestDate) {
          byProject[projectId].latestDate = assessment.assessment_date;
        }
      }
    });

    // Calculate averages and trends for assessment types
    Object.keys(byAssessmentType).forEach(type => {
      const data = byAssessmentType[type];
      data.average_score = data.count > 0 ? data.totalScore / data.count : 0;
      data.latest_date = data.latestDate;

      // Calculate trend (simple linear trend)
      if (data.scores.length >= 3) {
        const recentScores = data.scores.slice(0, Math.min(10, data.scores.length));
        const olderScores = data.scores.slice(Math.min(10, data.scores.length), Math.min(20, data.scores.length));

        const recentAvg = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
        const olderAvg = olderScores.length > 0 ? olderScores.reduce((a: number, b: number) => a + b, 0) / olderScores.length : recentAvg;

        if (recentAvg > olderAvg + 5) {
          data.trend = 'improving';
        } else if (recentAvg < olderAvg - 5) {
          data.trend = 'declining';
        } else {
          data.trend = 'stable';
        }
      } else {
        data.trend = 'stable';
      }

      // Clean up
      delete data.totalScore;
      delete data.scores;
    });

    // Calculate averages for projects
    Object.keys(byProject).forEach(projectId => {
      const data = byProject[projectId];
      data.average_score = data.assessment_count > 0 ? data.totalScore / data.assessment_count : 0;
      data.latest_date = data.latestDate;
      delete data.totalScore;
    });

    // Calculate overall trends
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const recent30Days = assessments.filter((a: any) => new Date(a.assessment_date) >= thirtyDaysAgo);
    const recent90Days = assessments.filter((a: any) => new Date(a.assessment_date) >= ninetyDaysAgo);
    const recent180Days = assessments.filter((a: any) => new Date(a.assessment_date) >= oneEightyDaysAgo);

    const avgScore30Days = recent30Days.length > 0
      ? recent30Days.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / recent30Days.filter((a: any) => a.score !== null).length
      : 0;

    const avgScore90Days = recent90Days.length > 0
      ? recent90Days.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / recent90Days.filter((a: any) => a.score !== null).length
      : 0;

    const avgScore180Days = recent180Days.length > 0
      ? recent180Days.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / recent180Days.filter((a: any) => a.score !== null).length
      : 0;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    let trendStrength = 0;

    if (avgScore30Days > avgScore90Days + 3 && avgScore90Days > avgScore180Days + 3) {
      direction = 'improving';
      trendStrength = Math.min(100, Math.abs(avgScore30Days - avgScore180Days) * 2);
    } else if (avgScore30Days < avgScore90Days - 3 && avgScore90Days < avgScore180Days - 3) {
      direction = 'declining';
      trendStrength = Math.min(100, Math.abs(avgScore30Days - avgScore180Days) * 2);
    } else {
      trendStrength = Math.max(0, 100 - Math.abs(avgScore30Days - avgScore180Days) * 2);
    }

    // Generate recommendations
    const recommendations = generateRecommendations(byAssessmentType, avgScore30Days);

    return {
      by_assessment_type: byAssessmentType,
      by_project: byProject,
      trends: {
        last_30_days: Math.round(avgScore30Days),
        last_90_days: Math.round(avgScore90Days),
        last_180_days: Math.round(avgScore180Days),
        direction,
        trend_strength: Math.round(trendStrength),
      },
      recommendations,
    };

  } catch (error) {
    console.error('Error generating project compliance analytics:', error);
    return {
      by_assessment_type: {},
      by_project: {},
      trends: {
        last_30_days: 0,
        last_90_days: 0,
        last_180_days: 0,
        direction: 'stable',
        trend_strength: 0,
      },
      recommendations: [],
    };
  }
}

// Helper function to generate comparison data
async function generateComparisonData(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employer: any,
  currentScore: number | null
): Promise<any> {
  try {
    // Get similar employers (same type)
    const { data: similarEmployers, error } = await supabase
      .rpc('calculate_project_compliance_rating', {
        p_employer_id: employer.id,
        p_calculation_date: new Date().toISOString().split('T')[0],
        p_lookback_days: 365,
      });

    // This is a simplified comparison - in production, you'd want a more sophisticated approach
    const ratingDistribution: Record<string, number> = {
      green: 0,
      amber: 0,
      red: 0,
      unknown: 0,
    };

    // For now, use some example data - this would be calculated from actual similar employers
    ratingDistribution.green = 45;
    ratingDistribution.amber = 30;
    ratingDistribution.red = 15;
    ratingDistribution.unknown = 10;

    const industryAverage = 65; // This would be calculated from actual data
    const industryPercentile = currentScore ? Math.min(99, Math.max(1, (currentScore / 100) * 99)) : null;

    return {
      industry_average: industryAverage,
      industry_percentile: industryPercentile,
      similar_employers_count: 150, // This would be the actual count
      rating_distribution: ratingDistribution,
    };

  } catch (error) {
    console.error('Error generating comparison data:', error);
    return {
      industry_average: null,
      industry_percentile: null,
      similar_employers_count: 0,
      rating_distribution: {},
    };
  }
}

// Helper function to generate insights
function generateInsights(
  summary: ProjectComplianceSummary,
  analytics?: ProjectComplianceAnalytics
): any {
  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendedActions: string[] = [];
  const dataGaps: string[] = [];

  // Analyze data quality
  if (summary.data_quality === 'high') {
    strengths.push('Comprehensive assessment data with recent updates');
  } else if (summary.data_quality === 'very_low') {
    concerns.push('Very limited assessment data available');
    recommendedActions.push('Increase frequency of project compliance assessments');
  }

  // Analyze score
  if (summary.project_score && summary.project_score >= 80) {
    strengths.push('Excellent overall project compliance performance');
  } else if (summary.project_score && summary.project_score <= 30) {
    concerns.push('Significant compliance issues identified');
    recommendedActions.push('Immediate review and intervention required');
  }

  // Analyze assessment types
  const assessmentTypes = summary.assessments.map(a => a.assessment_type);
  const criticalTypes = ['eca_status', 'cbus_status', 'safety_incidents'];

  criticalTypes.forEach(type => {
    if (!assessmentTypes.includes(type)) {
      dataGaps.push(`Missing critical assessment: ${type.replace('_', ' ')}`);
      recommendedActions.push(`Complete ${type.replace('_', ' ')} assessment`);
    }
  });

  // Analyze trends if available
  if (analytics) {
    if (analytics.trends.direction === 'improving' && analytics.trends.trend_strength > 50) {
      strengths.push('Strong positive trend in compliance performance');
    } else if (analytics.trends.direction === 'declining' && analytics.trends.trend_strength > 50) {
      concerns.push('Declining trend in compliance performance');
      recommendedActions.push('Investigate causes of performance decline');
    }

    // Add analytics recommendations
    recommendedActions.push(...analytics.recommendations);
  }

  // Data recency
  if (summary.data_age_days && summary.data_age_days > 90) {
    concerns.push('Assessment data is significantly outdated');
    recommendedActions.push('Schedule fresh compliance assessments');
  }

  return {
    strengths,
    concerns,
    recommended_actions: [...new Set(recommendedActions)], // Remove duplicates
    data_gaps,
  };
}

// Helper function to generate recommendations
function generateRecommendations(
  byAssessmentType: Record<string, any>,
  currentScore: number
): string[] {
  const recommendations: string[] = [];

  // Low-scoring assessment types
  Object.entries(byAssessmentType).forEach(([type, data]: [string, any]) => {
    if (data.average_score < 30 && data.count > 2) {
      recommendations.push(`Address critical issues in ${type.replace('_', ' ')} - average score: ${Math.round(data.average_score)}`);
    }
  });

  // General recommendations based on score
  if (currentScore < 50) {
    recommendations.push('Develop comprehensive improvement plan for all compliance areas');
    recommendations.push('Consider external compliance audit to identify issues');
  } else if (currentScore < 70) {
    recommendations.push('Focus on improving consistency across assessment types');
    recommendations.push('Implement regular monitoring and reporting');
  } else {
    recommendations.push('Maintain current standards and focus on continuous improvement');
  }

  return recommendations;
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getProjectComplianceHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('project_compliance_assessments')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .eq('is_active', true);

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