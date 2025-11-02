import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type TrafficLightRating = 'red' | 'amber' | 'yellow' | 'green';
type EbaStatusFilter = 'all' | 'active' | 'inactive' | 'unknown';
type ProjectTier = 'all' | 'tier_1' | 'tier_2' | 'tier_3';
type ProjectStatusFilter = 'all' | 'construction' | 'pre_construction' | 'future' | 'archived';

interface RatingDistribution {
  red: number;
  amber: number;
  yellow: number;
  green: number;
}

interface RatingDistributionResponse {
  projects: {
    distribution: RatingDistribution;
    percentages: RatingDistribution;
    total: number;
  };
  employers: {
    distribution: RatingDistribution;
    percentages: RatingDistribution;
    total: number;
  };
}

// Map rating to traffic light colors
// The final_rating field uses traffic_light_rating enum ('green', 'amber', 'red', 'unknown')
// The 4-point system uses red/amber/yellow/green, where yellow maps to 'unknown' in the enum
// or we need to check project_based_rating which might use numeric values
function mapRatingToColor(rating: string | number | null | undefined): TrafficLightRating {
  if (rating === null || rating === undefined) return 'red';
  
  if (typeof rating === 'number') {
    switch (rating) {
      case 1: return 'red';
      case 2: return 'amber';
      case 3: return 'yellow'; // Yellow in 4-point system
      case 4: return 'green';
      default: return 'red';
    }
  }
  
  // Handle string ratings - enum has 'unknown' which we map to 'yellow'
  const ratingStr = String(rating).toLowerCase();
  if (ratingStr === 'red' || ratingStr === '1') return 'red';
  if (ratingStr === 'amber' || ratingStr === '2') return 'amber';
  if (ratingStr === 'yellow' || ratingStr === '3' || ratingStr === 'unknown') return 'yellow';
  if (ratingStr === 'green' || ratingStr === '4') return 'green';
  
  return 'red'; // Default
}

function calculatePercentages(distribution: RatingDistribution, total: number): RatingDistribution {
  if (total === 0) {
    return { red: 0, amber: 0, yellow: 0, green: 0 };
  }
  
  return {
    red: Math.round((distribution.red / total) * 100 * 100) / 100,
    amber: Math.round((distribution.amber / total) * 100 * 100) / 100,
    yellow: Math.round((distribution.yellow / total) * 100 * 100) / 100,
    green: Math.round((distribution.green / total) * 100 * 100) / 100,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ebaStatus = (searchParams.get('ebaStatus') || 'all') as EbaStatusFilter;
    const projectTier = (searchParams.get('projectTier') || 'all') as ProjectTier;
    const projectStatus = (searchParams.get('projectStatus') || 'all') as ProjectStatusFilter;

    let supabase;
    try {
      supabase = await createServerSupabase();
    } catch (supabaseError) {
      console.error('Error creating Supabase client:', supabaseError);
      throw new Error(`Failed to initialize Supabase client: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}`);
    }

    // Start with base query for projects - only active projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, tier, stage_class')
      .eq('organising_universe', 'active');

    // Apply project tier filter
    if (projectTier !== 'all') {
      projectsQuery = projectsQuery.eq('tier', projectTier);
    }

    // Apply project status filter
    if (projectStatus !== 'all') {
      projectsQuery = projectsQuery.eq('stage_class', projectStatus);
    }

    const { data: filteredProjects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    const projectIds = filteredProjects?.map(p => p.id) || [];

    if (projectIds.length === 0) {
      return NextResponse.json({
        projects: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        },
        employers: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        }
      } as RatingDistributionResponse);
    }

    // Get employers associated with these projects via project_assignments
    let projectAssignments: any[] = [];
    let paError: any = null;
    
    if (projectIds.length > 0) {
      const result = await supabase
        .from('project_assignments')
        .select('employer_id, project_id')
        .in('project_id', projectIds);
      projectAssignments = result.data || [];
      paError = result.error;
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

    const employerIdArray = Array.from(employerIds);

    if (employerIdArray.length === 0) {
      return NextResponse.json({
        projects: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        },
        employers: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        }
      } as RatingDistributionResponse);
    }

    // Get the latest rating for each employer with EBA status
    // Batch queries to avoid PostgREST limits on .in() clause size (typically 200-1000 items)
    const chunkSize = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < employerIdArray.length; i += chunkSize) {
      chunks.push(employerIdArray.slice(i, i + chunkSize));
    }

    // Execute all chunk queries in parallel
    const ratingQueries = chunks.map(chunk => {
      let query = supabase
        .from('employer_final_ratings')
        .select('employer_id, final_rating, eba_status, rating_date')
        .in('employer_id', chunk)
        .eq('is_active', true);

      // Apply EBA status filter if needed
      if (ebaStatus === 'active') {
        query = query.eq('eba_status', 'green');
      } else if (ebaStatus === 'inactive') {
        query = query.eq('eba_status', 'red');
      } else if (ebaStatus === 'unknown') {
        query = query.eq('eba_status', 'unknown');
      }

      return query;
    });

    let latestRatingsData: any[] | null = null;
    let ratingsError: any = null;
    
    try {
      const results = await Promise.all(ratingQueries);
      
      // Combine results from all chunks
      const allRatings: any[] = [];
      for (const result of results) {
        if (result.error) {
          console.error('Error in chunk query:', result.error);
          ratingsError = result.error;
          break;
        }
        if (result.data) {
          allRatings.push(...result.data);
        }
      }

      if (!ratingsError && allRatings.length > 0) {
        // Sort by rating_date descending to get latest ratings first
        allRatings.sort((a, b) => {
          const dateA = new Date(a.rating_date).getTime();
          const dateB = new Date(b.rating_date).getTime();
          return dateB - dateA;
        });

        latestRatingsData = allRatings;
      } else {
        latestRatingsData = allRatings.length > 0 ? allRatings : null;
      }
    } catch (fetchError) {
      console.error('Exception during latest ratings query:', fetchError);
      console.error('Query parameters:', {
        employerIdCount: employerIdArray.length,
        chunkCount: chunks.length,
        ebaStatus,
        hasEbaFilter: ebaStatus !== 'all'
      });
      throw new Error(`Supabase query failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    if (ratingsError) {
      console.error('Error fetching employer ratings:', ratingsError);
      console.error('Error details:', JSON.stringify(ratingsError, null, 2));
      throw ratingsError;
    }

    // Get the latest rating per employer
    const latestRatingsByEmployer = new Map<string, string>();
    const seenEmployers = new Set<string>();
    if (latestRatingsData) {
      for (const rating of latestRatingsData) {
        if (!seenEmployers.has(rating.employer_id)) {
          latestRatingsByEmployer.set(rating.employer_id, rating.final_rating);
          seenEmployers.add(rating.employer_id);
        }
      }
    }

    if (latestRatingsByEmployer.size === 0) {
      return NextResponse.json({
        projects: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        },
        employers: {
          distribution: { red: 0, amber: 0, yellow: 0, green: 0 },
          percentages: { red: 0, amber: 0, yellow: 0, green: 0 },
          total: 0
        }
      } as RatingDistributionResponse);
    }

    const filteredEmployerIds = Array.from(latestRatingsByEmployer.keys());

    // Calculate employer distribution
    const employerDistribution: RatingDistribution = { red: 0, amber: 0, yellow: 0, green: 0 };
    latestRatingsByEmployer.forEach((rating) => {
      const color = mapRatingToColor(rating);
      employerDistribution[color]++;
    });

    const totalEmployers = latestRatingsByEmployer.size;
    const employerPercentages = calculatePercentages(employerDistribution, totalEmployers);

    // Calculate project distribution - a project gets a rating if it has at least one rated employer
    // We'll use the most common rating among its employers, or the highest priority rating
    const projectRatings = new Map<string, TrafficLightRating>();
    
    // Group employers by project
    const employersByProject = new Map<string, Set<string>>();
    if (projectAssignments) {
      for (const pa of projectAssignments) {
        if (pa.project_id && pa.employer_id && latestRatingsByEmployer.has(pa.employer_id)) {
          if (!employersByProject.has(pa.project_id)) {
            employersByProject.set(pa.project_id, new Set());
          }
          employersByProject.get(pa.project_id)!.add(pa.employer_id);
        }
      }
    }

    // For each project, assign a rating based on its employers
    // Priority: if any employer is red, project is red; else if any amber, amber; etc.
    employersByProject.forEach((employerIdsForProject, projectId) => {
      let projectRating: TrafficLightRating = 'green'; // Default to green
      
      for (const employerId of employerIdsForProject) {
        const employerRating = latestRatingsByEmployer.get(employerId);
        if (employerRating) {
          const color = mapRatingToColor(employerRating);
          // Priority: red > amber > yellow > green
          if (color === 'red') {
            projectRating = 'red';
            break;
          } else if (color === 'amber' && projectRating !== 'red') {
            projectRating = 'amber';
          } else if (color === 'yellow' && projectRating === 'green') {
            projectRating = 'yellow';
          }
        }
      }
      
      projectRatings.set(projectId, projectRating);
    });

    // Calculate project distribution
    const projectDistribution: RatingDistribution = { red: 0, amber: 0, yellow: 0, green: 0 };
    projectRatings.forEach((rating) => {
      projectDistribution[rating]++;
    });

    const totalProjects = projectRatings.size;
    const projectPercentages = calculatePercentages(projectDistribution, totalProjects);

    return NextResponse.json({
      projects: {
        distribution: projectDistribution,
        percentages: projectPercentages,
        total: totalProjects
      },
      employers: {
        distribution: employerDistribution,
        percentages: employerPercentages,
        total: totalEmployers
      }
    } as RatingDistributionResponse);
  } catch (error) {
    console.error('Error in traffic-light-distribution API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    // Check if this is a network/fetch error
    if (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError')) {
      console.error('Network error detected - this may be a temporary Supabase connection issue');
      console.error('Supabase URL:', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET');
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch traffic light distribution data',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

