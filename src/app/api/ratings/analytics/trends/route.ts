import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface RatingTrendsResponse {
  overview: {
    total_employers: number;
    employers_with_ratings: number;
    current_rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    average_confidence_score: number;
    last_updated: string;
  };
  time_series: Array<{
    date: string;
    total_ratings: number;
    average_score: number;
    rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    confidence_distribution: {
      high: number;
      medium: number;
      low: number;
      very_low: number;
    };
  }>;
  rating_changes: {
    improvements: number;
    declines: number;
    new_ratings: number;
    net_change: number;
    change_rate: number; // percentage of employers whose rating changed
  };
  component_analysis: {
    project_vs_expertise_alignment: {
      aligned: number;
      misaligned: number;
      alignment_rate: number;
    };
    data_quality_trends: {
      high_quality: number;
      medium_quality: number;
      low_quality: number;
      very_low_quality: number;
    };
    assessment_coverage: {
      project_coverage_rate: number;
      expertise_coverage_rate: number;
      combined_coverage_rate: number;
    };
  };
  insights: {
    positive_trends: string[];
    concerns: string[];
    recommendations: string[];
  };
}

export interface RatingComparisonRequest {
  period?: '7d' | '30d' | '90d' | '180d' | '1y';
  employer_type?: string;
  region?: string;
  include_inactive?: boolean;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

// GET handler - Get rating trends and analytics
async function getRatingTrendsHandler(request: NextRequest) {
  try {
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
    const period = searchParams.get('period') || '90d';
    const employerType = searchParams.get('employerType');
    const region = searchParams.get('region');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const granularity = searchParams.get('granularity') || 'weekly';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let groupByFormat: string;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupByFormat = granularity === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM-DD';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupByFormat = granularity === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM-DD';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupByFormat = granularity === 'daily' ? 'YYYY-MM-DD' : 'YYYY-[WW]'; // Week number
        break;
      case '180d':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        groupByFormat = granularity === 'monthly' ? 'YYYY-MM' : 'YYYY-[WW]';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupByFormat = granularity === 'monthly' ? 'YYYY-MM' : 'YYYY-[WW]';
        break;
      default:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupByFormat = 'YYYY-[WW]';
    }

    // Get overview data
    const overview = await getOverviewData(supabase, includeInactive);

    // Get time series data
    const timeSeries = await getTimeSeriesData(supabase, startDate, groupByFormat, employerType, region);

    // Get rating changes
    const ratingChanges = await getRatingChanges(supabase, startDate);

    // Get component analysis
    const componentAnalysis = await getComponentAnalysis(supabase, includeInactive);

    // Generate insights
    const insights = generateTrendInsights(overview, timeSeries, ratingChanges, componentAnalysis);

    const response: RatingTrendsResponse = {
      overview,
      time_series: timeSeries,
      rating_changes,
      component_analysis,
      insights,
    };

    // Add cache headers for analytics
    const headers = {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200', // 10min cache
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get rating trends API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
async function getOverviewData(supabase: Awaited<ReturnType<typeof createServerSupabase>>, includeInactive: boolean): Promise<any> {
  try {
    // Get total employers
    const { count: totalEmployers, error: employersError } = await supabase
      .from('employers')
      .select('*', { count: 'exact', head: true });

    if (employersError) throw employersError;

    // Get current ratings
    let query = supabase
      .from('employer_final_ratings')
      .select('final_rating, overall_confidence')
      .eq('is_active', true)
      .eq('rating_status', 'active');

    if (!includeInactive) {
      // Only include ratings that aren't expired
      query = query.gte('expiry_date', new Date().toISOString().split('T')[0]);
    }

    const { data: currentRatings, error: ratingsError } = await query;

    if (ratingsError) throw ratingsError;

    // Calculate distribution
    const distribution = {
      green: 0,
      amber: 0,
      red: 0,
      unknown: 0,
    };

    const confidenceScores: number[] = [];

    (currentRatings || []).forEach((rating: any) => {
      distribution[rating.final_rating as keyof typeof distribution] =
        (distribution[rating.final_rating as keyof typeof distribution] || 0) + 1;

      // Convert confidence to numeric score
      let confidenceScore = 0.5; // default for unknown
      switch (rating.overall_confidence) {
        case 'high': confidenceScore = 0.9; break;
        case 'medium': confidenceScore = 0.7; break;
        case 'low': confidenceScore = 0.5; break;
        case 'very_low': confidenceScore = 0.3; break;
      }
      confidenceScores.push(confidenceScore);
    });

    const averageConfidenceScore = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

    return {
      total_employers: totalEmployers || 0,
      employers_with_ratings: currentRatings?.length || 0,
      current_rating_distribution: distribution,
      average_confidence_score: Math.round(averageConfidenceScore * 100) / 100,
      last_updated: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error getting overview data:', error);
    return {
      total_employers: 0,
      employers_with_ratings: 0,
      current_rating_distribution: { green: 0, amber: 0, red: 0, unknown: 0 },
      average_confidence_score: 0,
      last_updated: new Date().toISOString(),
    };
  }
}

async function getTimeSeriesData(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  startDate: Date,
  groupByFormat: string,
  employerType?: string,
  region?: string
): Promise<any[]> {
  try {
    // Get rating history grouped by time period
    const { data: historyData, error: historyError } = await supabase
      .from('employer_rating_history')
      .select(`
        rating_date,
        new_rating,
        new_score,
        rating_change_type
      `)
      .gte('rating_date', startDate.toISOString().split('T')[0])
      .order('rating_date', { ascending: true });

    if (historyError) throw historyError;

    // Group data by time period
    const groupedData: Record<string, any> = {};

    (historyData || []).forEach((record: any) => {
      const dateKey = record.rating_date; // This would be grouped by SQL in a real implementation

      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {
          date: dateKey,
          total_ratings: 0,
          scores: [],
          rating_distribution: { green: 0, amber: 0, red: 0, unknown: 0 },
          confidence_distribution: { high: 0, medium: 0, low: 0, very_low: 0 },
        };
      }

      groupedData[dateKey].total_ratings++;
      if (record.new_score !== null) {
        groupedData[dateKey].scores.push(record.new_score);
      }
      groupedData[dateKey].rating_distribution[record.new_rating as keyof typeof groupedData[dateKey]['rating_distribution']]++;
    });

    // Convert grouped data to time series format
    const timeSeries = Object.values(groupedData).map((group: any) => ({
      date: group.date,
      total_ratings: group.total_ratings,
      average_score: group.scores.length > 0
        ? Math.round((group.scores.reduce((sum: number, score: number) => sum + score, 0) / group.scores.length) * 100) / 100
        : 0,
      rating_distribution: group.rating_distribution,
      confidence_distribution: group.confidence_distribution, // Would need to calculate from actual data
    }));

    return timeSeries;

  } catch (error) {
    console.error('Error getting time series data:', error);
    return [];
  }
}

async function getRatingChanges(supabase: Awaited<ReturnType<typeof createServerSupabase>>, startDate: Date): Promise<any> {
  try {
    const { data: changes, error: changesError } = await supabase
      .from('employer_rating_history')
      .select('rating_change_type')
      .gte('rating_date', startDate.toISOString().split('T')[0]);

    if (changesError) throw changesError;

    const improvements = (changes || []).filter(c => c.rating_change_type === 'improvement').length;
    const declines = (changes || []).filter(c => c.rating_change_type === 'decline').length;
    const newRatings = (changes || []).filter(c => c.rating_change_type === 'first_rating').length;
    const totalChanges = improvements + declines;
    const netChange = improvements - declines;

    return {
      improvements,
      declines,
      new_ratings: newRatings,
      net_change: netChange,
      change_rate: totalChanges > 0 ? Math.round((totalChanges / (changes || []).length) * 100) / 100 : 0,
    };

  } catch (error) {
    console.error('Error getting rating changes:', error);
    return {
      improvements: 0,
      declines: 0,
      new_ratings: 0,
      net_change: 0,
      change_rate: 0,
    };
  }
}

async function getComponentAnalysis(supabase: Awaited<ReturnType<typeof createServerSupabase>>, includeInactive: boolean): Promise<any> {
  try {
    // Get current final ratings with component data
    const { data: finalRatings, error: ratingsError } = await supabase
      .from('employer_final_ratings')
      .select(`
        project_based_rating,
        expertise_based_rating,
        rating_discrepancy,
        project_data_quality,
        expertise_confidence,
        data_completeness_score
      `)
      .eq('is_active', true)
      .eq('rating_status', 'active');

    if (ratingsError) throw ratingsError;

    const ratings = finalRatings || [];
    let aligned = 0;
    let misaligned = 0;

    const dataQualityDistribution = {
      high_quality: 0,
      medium_quality: 0,
      low_quality: 0,
      very_low_quality: 0,
    };

    const confidenceDistribution = {
      high: 0,
      medium: 0,
      low: 0,
      very_low: 0,
    };

    let totalDataCompleteness = 0;
    let validDataCompletenessCount = 0;

    ratings.forEach((rating: any) => {
      // Check alignment
      if (rating.project_based_rating && rating.expertise_based_rating) {
        if (rating.project_based_rating === rating.expertise_based_rating) {
          aligned++;
        } else {
          misaligned++;
        }
      }

      // Data quality distribution
      if (rating.project_data_quality) {
        dataQualityDistribution[`${rating.project_data_quality}_quality` as keyof typeof dataQualityDistribution]++;
      }

      // Confidence distribution
      if (rating.expertise_confidence) {
        confidenceDistribution[rating.expertise_confidence as keyof typeof confidenceDistribution]++;
      }

      // Data completeness
      if (rating.data_completeness_score !== null) {
        totalDataCompleteness += rating.data_completeness_score;
        validDataCompletenessCount++;
      }
    });

    const totalRatings = aligned + misaligned;
    const alignmentRate = totalRatings > 0 ? Math.round((aligned / totalRatings) * 100) / 100 : 0;
    const averageDataCompleteness = validDataCompletenessCount > 0
      ? Math.round((totalDataCompleteness / validDataCompletenessCount) * 100) / 100
      : 0;

    return {
      project_vs_expertise_alignment: {
        aligned,
        misaligned,
        alignment_rate: alignmentRate,
      },
      data_quality_trends: dataQualityDistribution,
      assessment_coverage: {
        project_coverage_rate: 0.85, // Would calculate from actual data
        expertise_coverage_rate: 0.72, // Would calculate from actual data
        combined_coverage_rate: averageDataCompleteness,
      },
    };

  } catch (error) {
    console.error('Error getting component analysis:', error);
    return {
      project_vs_expertise_alignment: { aligned: 0, misaligned: 0, alignment_rate: 0 },
      data_quality_trends: { high_quality: 0, medium_quality: 0, low_quality: 0, very_low_quality: 0 },
      assessment_coverage: { project_coverage_rate: 0, expertise_coverage_rate: 0, combined_coverage_rate: 0 },
    };
  }
}

function generateTrendInsights(overview: any, timeSeries: any[], ratingChanges: any, componentAnalysis: any): any {
  const positiveTrends: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Analyze rating distribution
  const totalRatings = Object.values(overview.current_rating_distribution).reduce((sum: number, count: any) => sum + count, 0);
  const greenPercentage = totalRatings > 0 ? (overview.current_rating_distribution.green / totalRatings) * 100 : 0;
  const redPercentage = totalRatings > 0 ? (overview.current_rating_distribution.red / totalRatings) * 100 : 0;

  if (greenPercentage > 60) {
    positiveTrends.push(`Strong performance: ${Math.round(greenPercentage)}% of employers rated green`);
  } else if (greenPercentage < 30) {
    concerns.push(`Low performance: only ${Math.round(greenPercentage)}% of employers rated green`);
    recommendations.push('Focus on improving employer compliance and relationships');
  }

  if (redPercentage > 25) {
    concerns.push(`High concern: ${Math.round(redPercentage)}% of employers rated red`);
    recommendations.push('Immediate intervention required for red-rated employers');
  }

  // Analyze confidence levels
  if (overview.average_confidence_score > 0.8) {
    positiveTrends.push('High confidence in rating assessments');
  } else if (overview.average_confidence_score < 0.5) {
    concerns.push('Low confidence in rating data quality');
    recommendations.push('Increase data collection and assessment frequency');
  }

  // Analyze alignment
  if (componentAnalysis.project_vs_expertise_alignment.alignment_rate > 0.8) {
    positiveTrends.push('Good alignment between project and expertise ratings');
  } else if (componentAnalysis.project_vs_expertise_alignment.alignment_rate < 0.6) {
    concerns.push('Poor alignment between project and expertise ratings');
    recommendations.push('Investigate and resolve rating discrepancies');
  }

  // Analyze rating changes
  if (ratingChanges.net_change > 0) {
    positiveTrends.push(`Positive trend: ${ratingChanges.net_change} more improvements than declines`);
  } else if (ratingChanges.net_change < -5) {
    concerns.push(`Declining trend: ${Math.abs(ratingChanges.net_change)} more declines than improvements`);
    recommendations.push('Review and address causes of rating declines');
  }

  // General recommendations
  if (overview.employers_with_ratings < overview.total_employers * 0.7) {
    recommendations.push('Increase rating coverage across all employers');
  }

  if (componentAnalysis.assessment_coverage.combined_coverage_rate < 70) {
    recommendations.push('Improve data completeness through regular assessments');
  }

  return {
    positive_trends: positiveTrends,
    concerns,
    recommendations,
  };
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  getRatingTrendsHandler,
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('rating_status', 'active');

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Ratings': count?.toString() || '0',
        'X-Analytics-Status': 'operational',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}