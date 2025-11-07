import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getProjectIdsForPatches } from '@/lib/patch-filtering';
import { withTimeout, isDatabaseTimeoutError } from '@/lib/query-timeout';

export const dynamic = 'force-dynamic';
export const maxDuration = 20; // Vercel timeout limit
export const revalidate = 60; // Cache for 60 seconds

type TimeFrame = '6_weeks' | '3_months' | '6_months' | '12_months' | 'ever';

interface RatingCompletionResponse {
  projectsRatedPercentage: number;
  employersRatedPercentage: number;
  projectsRatedCount: number;
  totalProjects: number;
  employersRatedCount: number;
  totalEmployers: number;
  timeFrame: TimeFrame;
}

function getCutoffDate(timeFrame: TimeFrame): Date | null {
  const now = new Date();
  const cutoff = new Date(now);

  switch (timeFrame) {
    case '6_weeks':
      cutoff.setDate(cutoff.getDate() - 42); // 6 weeks = 42 days
      break;
    case '3_months':
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case '6_months':
      cutoff.setMonth(cutoff.getMonth() - 6);
      break;
    case '12_months':
      cutoff.setMonth(cutoff.getMonth() - 12);
      break;
    case 'ever':
      return null; // No cutoff date
    default:
      cutoff.setDate(cutoff.getDate() - 42); // Default to 6 weeks
  }

  return cutoff;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const timeFrame = (searchParams.get('timeFrame') || '3_months') as TimeFrame;
  try {
    const patchIds = searchParams.get('patchIds')?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
    const universe = searchParams.get('universe') || 'active';
    const stage = searchParams.get('stage') || 'construction';

    // Validate timeFrame
    if (!['6_weeks', '3_months', '6_months', '12_months', 'ever'].includes(timeFrame)) {
      return NextResponse.json(
        { error: 'Invalid timeFrame parameter. Must be one of: 6_weeks, 3_months, 6_months, 12_months, ever' },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = await createServerSupabase();
    } catch (supabaseError) {
      console.error('Error creating Supabase client:', supabaseError);
      throw new Error(`Failed to initialize Supabase client: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}`);
    }
    
    const cutoffDate = getCutoffDate(timeFrame);
    const cutoffDateStr = cutoffDate ? cutoffDate.toISOString().split('T')[0] : null;

    // Get filtered project IDs based on universe, stage, and patch selections
    let projectsQuery = supabase
      .from('projects')
      .select('id, main_job_site_id, organising_universe, stage_class');

    if (universe !== 'all') {
      projectsQuery = projectsQuery.eq('organising_universe', universe);
    }

    if (stage !== 'all') {
      projectsQuery = projectsQuery.eq('stage_class', stage);
    }

    if (patchIds.length > 0) {
      try {
        const projectIds = await withTimeout(
          getProjectIdsForPatches(supabase, patchIds),
          10000,
          'Patch filtering query timeout'
        );

        if (projectIds.length === 0) {
          return NextResponse.json({
            projectsRatedPercentage: 0,
            employersRatedPercentage: 0,
            projectsRatedCount: 0,
            totalProjects: 0,
            employersRatedCount: 0,
            totalEmployers: 0,
            timeFrame
          } as RatingCompletionResponse);
        }

        projectsQuery = projectsQuery.in('id', projectIds);
      } catch (error) {
        console.error('Error in patch filtering:', error);
        if (isDatabaseTimeoutError(error)) {
          return NextResponse.json({
            projectsRatedPercentage: 0,
            employersRatedPercentage: 0,
            projectsRatedCount: 0,
            totalProjects: 0,
            employersRatedCount: 0,
            totalEmployers: 0,
            timeFrame
          } as RatingCompletionResponse);
        }
        throw error;
      }
    }

    const { data: filteredProjects, error: projectsError } = await withTimeout(
      projectsQuery,
      10000,
      'Projects query timeout'
    );

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    const totalProjects = filteredProjects?.length || 0;
    const projectIds = filteredProjects?.map(p => p.id) || [];

    if (totalProjects === 0) {
      return NextResponse.json({
        projectsRatedPercentage: 0,
        employersRatedPercentage: 0,
        projectsRatedCount: 0,
        totalProjects: 0,
        employersRatedCount: 0,
        totalEmployers: 0,
        timeFrame
      } as RatingCompletionResponse);
    }

    // Get all employers associated with active projects via project_assignments
    let projectAssignments: any[] = [];
    let paError: any = null;
    
    if (projectIds.length > 0) {
      try {
        const result = await withTimeout(
          supabase
            .from('project_assignments')
            .select('employer_id')
            .in('project_id', projectIds),
          10000,
          'Project assignments query timeout'
        );
        projectAssignments = result.data || [];
        paError = result.error;
      } catch (error) {
        console.error('Error fetching project assignments:', error);
        if (isDatabaseTimeoutError(error)) {
          return NextResponse.json({
            projectsRatedPercentage: 0,
            employersRatedPercentage: 0,
            projectsRatedCount: 0,
            totalProjects: totalProjects || 0,
            employersRatedCount: 0,
            totalEmployers: 0,
            timeFrame
          } as RatingCompletionResponse);
        }
        throw error;
      }
    }

    if (paError) {
      console.error('Error fetching project assignments:', paError);
      throw paError;
    }

    const employerIds = new Set<string>();
    if (projectAssignments) {
      projectAssignments.forEach(pa => {
        if (pa.employer_id) employerIds.add(pa.employer_id);
      });
    }

    const totalEmployers = employerIds.size;
    const employerIdArray = Array.from(employerIds);

    // Get projects with rated employers in the time frame
    let projectsRatedCount = 0;
    let employersRatedCount = 0;
    let employersRatedPercentage = 0;

    if (employerIdArray.length > 0) {
      // Batch queries to avoid PostgREST limits on .in() clause size (typically 200-1000 items)
      const chunkSize = 200;
      const chunks: string[][] = [];
      for (let i = 0; i < employerIdArray.length; i += chunkSize) {
        chunks.push(employerIdArray.slice(i, i + chunkSize));
      }

      // Execute all chunk queries in parallel with timeouts
      const ratingQueries = chunks.map(chunk => {
        let query = supabase
          .from('employer_final_ratings')
          .select('employer_id')
          .in('employer_id', chunk)
          .eq('is_active', true);

        if (cutoffDateStr) {
          query = query.gte('rating_date', cutoffDateStr);
        }

        return withTimeout(query, 8000, 'Employer ratings query timeout');
      });

      let ratedEmployers: any[] | null = null;
      let ratedError: any = null;
      
      try {
        const results = await Promise.all(ratingQueries);
        
        // Combine results from all chunks
        const allRatings: any[] = [];
        for (const result of results) {
          if (result.error) {
            console.error('Error in chunk query:', result.error);
            ratedError = result.error;
            break;
          }
          if (result.data) {
            allRatings.push(...result.data);
          }
        }

        ratedEmployers = allRatings.length > 0 ? allRatings : null;
      } catch (fetchError) {
        console.error('Exception during rated employers query:', fetchError);
        console.error('Query parameters:', {
          employerIdCount: employerIdArray.length,
          chunkCount: chunks.length,
          cutoffDateStr,
          hasCutoffDate: !!cutoffDateStr
        });
        throw new Error(`Supabase query failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }

      if (ratedError) {
        console.error('Error fetching rated employers:', ratedError);
        console.error('Error details:', JSON.stringify(ratedError, null, 2));
        throw ratedError;
      }

      const ratedEmployerIds = new Set(
        (ratedEmployers || []).map((r: any) => r.employer_id)
      );
      employersRatedCount = ratedEmployerIds.size;
      employersRatedPercentage = totalEmployers > 0
        ? Math.round((employersRatedCount / totalEmployers) * 100 * 100) / 100
        : 0;

      // Now get projects that have at least one of these rated employers
      if (ratedEmployerIds.size > 0) {
        const ratedEmployerIdArray = Array.from(ratedEmployerIds);
        
        // Batch the employer_id filter if needed
        const chunkSize = 200;
        const chunks: string[][] = [];
        for (let i = 0; i < ratedEmployerIdArray.length; i += chunkSize) {
          chunks.push(ratedEmployerIdArray.slice(i, i + chunkSize));
        }

        // Execute all chunk queries in parallel with timeouts
        const projectQueries = chunks.map(chunk =>
          withTimeout(
            supabase
              .from('project_assignments')
              .select('project_id')
              .in('project_id', projectIds)
              .in('employer_id', chunk),
            8000,
            'Project assignments query timeout'
          )
        );

        const projectResults = await Promise.all(projectQueries);

        // Combine results from all chunks
        const allProjectAssignments: any[] = [];
        for (const result of projectResults) {
          if (result.error) {
            console.error('Error in project assignments chunk query:', result.error);
            throw result.error;
          }
          if (result.data) {
            allProjectAssignments.push(...result.data);
          }
        }

        const ratedProjectIds = new Set(
          allProjectAssignments.map((pa: any) => pa.project_id)
        );
        projectsRatedCount = ratedProjectIds.size;
      }
    }

    const projectsRatedPercentage = totalProjects > 0 
      ? Math.round((projectsRatedCount / totalProjects) * 100 * 100) / 100
      : 0;

    return NextResponse.json({
      projectsRatedPercentage,
      employersRatedPercentage,
      projectsRatedCount,
      totalProjects,
      employersRatedCount,
      totalEmployers,
      timeFrame
    } as RatingCompletionResponse);
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error('Error in rating-completion API:', error);
    console.error('Query execution time:', queryTime, 'ms');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    if (isDatabaseTimeoutError(error)) {
      console.error('Database timeout error detected');
      return NextResponse.json({
        projectsRatedPercentage: 0,
        employersRatedPercentage: 0,
        projectsRatedCount: 0,
        totalProjects: 0,
        employersRatedCount: 0,
        totalEmployers: 0,
        timeFrame
      } as RatingCompletionResponse);
    }
    
    // Check if this is a network/fetch error
    if (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError')) {
      console.error('Network error detected - this may be a temporary Supabase connection issue');
      console.error('Supabase URL:', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET');
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch rating completion data',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

