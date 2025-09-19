import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/withTimeout";
import { useAuth } from "@/hooks/useAuth";

export interface DashboardProjectCounts {
  active_construction: number;
  active_pre_construction: number;
  potential_construction: number;
  potential_pre_construction: number;
  potential_future: number;
  potential_archived: number;
  excluded_construction: number;
  excluded_pre_construction: number;
  excluded_future: number;
  excluded_archived: number;
  total: number;
}

export interface DashboardProject {
  id: string;
  tier: string | null;
  organising_universe: string | null;
  stage_class: string | null;
}

export interface CoreTradeEmployers {
  demolition: number;
  piling: number;
  concreting: number;
  formwork: number;
  scaffold: number;
  cranes: number;
}

export interface ActiveConstructionMetrics {
  total_projects: number;
  total_builders: number;
  eba_builders: number;
  eba_builder_percentage: number;
  total_employers: number;
  eba_employers: number;
  eba_employer_percentage: number;
  core_trades: CoreTradeEmployers;
  projects_with_site_delegates: number;
  projects_with_company_delegates: number;
  projects_with_hsrs: number;
  projects_with_hsr_chair_delegate: number;
  projects_with_full_hs_committee: number;
  avg_estimated_workers: number;
  avg_assigned_workers: number;
  avg_members: number;
  financial_audit_activities: number;
}

export interface PreConstructionMetrics {
  total_projects: number;
  total_builders: number;
  eba_builders: number;
  eba_builder_percentage: number;
  total_employers: number;
  eba_employers: number;
  eba_employer_percentage: number;
  avg_estimated_workers: number;
  avg_assigned_workers: number;
  avg_members: number;
}

export interface NewDashboardData {
  project_counts: DashboardProjectCounts;
  active_construction: ActiveConstructionMetrics;
  active_pre_construction: PreConstructionMetrics;
  projects: DashboardProject[];
  errors: string[];
}

export const useNewDashboardData = (opts?: { patchIds?: string[]; tier?: string; stage?: string; universe?: string }) => {
  const { session, loading } = useAuth();

  return useQuery({
    queryKey: ["new-dashboard-data", opts?.patchIds?.slice().sort() || []],
    enabled: !loading && !!session,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
    queryFn: async (): Promise<NewDashboardData> => {
      const errors: string[] = [];
      
      console.log('Loading dashboard with REAL data...');
      
      try {
        // Optional patch scoping: resolve project IDs for selected patches
        let scopedProjectIds: string[] | null = null
        if (opts?.patchIds && opts.patchIds.length > 0) {
          const { data: js, error: jsError } = await supabase
            .from("job_sites")
            .select("project_id")
            .in("patch_id", opts.patchIds)
            .not("project_id", "is", null)
          if (jsError) {
            console.error('Patch scoping error:', jsError)
            errors.push('Failed to load projects for selected patches')
          } else {
            scopedProjectIds = Array.from(new Set(((js as any[]) || []).map((r: any) => r.project_id).filter(Boolean)))
          }
        }

        // Get real project counts by organising_universe and stage_class
        let projectsQuery = supabase
          .from("projects")
          .select("id, organising_universe, stage_class, tier")
        if (scopedProjectIds && scopedProjectIds.length > 0) {
          projectsQuery = projectsQuery.in('id', scopedProjectIds)
        }
        if (opts?.tier && opts.tier !== 'all') {
          projectsQuery = projectsQuery.eq('tier', opts.tier)
        }
        if (opts?.universe && opts.universe !== 'all') {
          projectsQuery = projectsQuery.eq('organising_universe', opts.universe)
        }
        if (opts?.stage && opts.stage !== 'all') {
          projectsQuery = projectsQuery.eq('stage_class', opts.stage)
        }
        const { data: projects, error: projectsError } = await projectsQuery;

        if (projectsError) {
          console.error('Projects query error:', projectsError);
          errors.push('Failed to load projects data');
          throw projectsError;
        }

        const projectRows = (projects || []) as any[];

        console.log(`📊 Loaded ${projectRows.length} total projects from database`);

        // Calculate real project counts
        const projectCounts = projectRows.reduce((acc: any, project) => {
          const universe = project.organising_universe || 'excluded';
          const stage = project.stage_class || 'archived';
          const key = `${universe}_${stage}`;
          
          acc[key] = (acc[key] || 0) + 1;
          acc.total = (acc.total || 0) + 1;
          
          return acc;
        }, {});

        const project_counts: DashboardProjectCounts = {
          active_construction: projectCounts.active_construction || 0,
          active_pre_construction: projectCounts.active_pre_construction || 0,
          potential_construction: projectCounts.potential_construction || 0,
          potential_pre_construction: projectCounts.potential_pre_construction || 0,
          potential_future: projectCounts.potential_future || 0,
          potential_archived: projectCounts.potential_archived || 0,
          excluded_construction: projectCounts.excluded_construction || 0,
          excluded_pre_construction: projectCounts.excluded_pre_construction || 0,
          excluded_future: projectCounts.excluded_future || 0,
          excluded_archived: projectCounts.excluded_archived || 0,
          total: projectCounts.total || 0
        };

        console.log('📊 Real project counts calculated:', project_counts);

        // Get active construction projects for detailed metrics
        const activeConstructionProjects = projectRows.filter(p => 
          p.organising_universe === 'active' && p.stage_class === 'construction'
        );

        console.log(`🏗️ Found ${activeConstructionProjects.length} active construction projects`);

        // Get builder/employer data for active construction projects
        let total_builders = 0;
        let eba_builders = 0;
        
        if (activeConstructionProjects.length > 0) {
          const { data: activeBuilders, error: buildersError } = await supabase
            .from("project_assignments")
            .select(`
              employer_id, 
              employers!inner(
                id, 
                name, 
                company_eba_records(id, fwc_certified_date)
              )
            `)
            .eq("assignment_type", "contractor_role")
            .in("project_id", activeConstructionProjects.map(p => p.id));

          if (buildersError) {
            console.error('Builders query error:', buildersError);
            errors.push('Failed to load builders data');
          } else {
            const uniqueBuilders = new Set((activeBuilders || []).map(b => b.employer_id));
            total_builders = uniqueBuilders.size;
            
            const buildersWithEba = (activeBuilders || []).filter((b: any) => {
              const employer = Array.isArray(b.employers) ? b.employers[0] : b.employers
              const records = employer?.company_eba_records as any[] | undefined
              return Array.isArray(records) && records.some((eba: any) => eba.fwc_certified_date)
            });
            eba_builders = new Set(buildersWithEba.map(b => b.employer_id)).size;
            
            console.log(`👷 Active construction: ${total_builders} builders, ${eba_builders} with EBA`);
          }
        }

        const active_construction: ActiveConstructionMetrics = {
          total_projects: activeConstructionProjects.length,
          total_builders,
          eba_builders,
          eba_builder_percentage: total_builders > 0 ? 
            Math.round((eba_builders / total_builders) * 100) : 0,
          total_employers: 0, // Will be enhanced by server-side functions
          eba_employers: 0,
          eba_employer_percentage: 0,
          core_trades: {
            demolition: 0,
            piling: 0,
            concreting: 0,
            formwork: 0,
            scaffold: 0,
            cranes: 0
          },
          projects_with_site_delegates: 0,
          projects_with_company_delegates: 0,
          projects_with_hsrs: 0,
          projects_with_hsr_chair_delegate: 0,
          projects_with_full_hs_committee: 0,
          avg_estimated_workers: 0,
          avg_assigned_workers: 0,
          avg_members: 0,
          financial_audit_activities: 0
        };

        // Active pre-construction metrics
        const preConstructionProjects = projectRows.filter(p => 
          p.organising_universe === 'active' && p.stage_class === 'pre_construction'
        );

        const dashboardProjects: DashboardProject[] = projectRows.map((project) => ({
          id: String(project.id),
          tier: project.tier ?? null,
          organising_universe: project.organising_universe ?? null,
          stage_class: project.stage_class ?? null,
        }));

        const active_pre_construction: PreConstructionMetrics = {
          total_projects: preConstructionProjects.length,
          total_builders: 0,
          eba_builders: 0,
          eba_builder_percentage: 0,
          total_employers: 0,
          eba_employers: 0,
          eba_employer_percentage: 0,
          avg_estimated_workers: 0,
          avg_assigned_workers: 0,
          avg_members: 0
        };

        console.log('✅ Dashboard data loaded successfully:', {
          totalProjects: project_counts.total,
          activeConstruction: active_construction.total_projects,
          activePreConstruction: active_pre_construction.total_projects,
          errors: errors.length
        });

        return {
          project_counts,
          active_construction,
          active_pre_construction,
          projects: dashboardProjects,
          errors
        };
        
      } catch (error) {
        console.error('Dashboard data loading error:', error);
        errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Return empty but valid structure on error
        return {
          project_counts: {
            active_construction: 0,
            active_pre_construction: 0,
            potential_construction: 0,
            potential_pre_construction: 0,
            potential_future: 0,
            potential_archived: 0,
            excluded_construction: 0,
            excluded_pre_construction: 0,
            excluded_future: 0,
            excluded_archived: 0,
            total: 0
          },
          active_construction: {
            total_projects: 0,
            total_builders: 0,
            eba_builders: 0,
            eba_builder_percentage: 0,
            total_employers: 0,
            eba_employers: 0,
            eba_employer_percentage: 0,
            core_trades: {
              demolition: 0, piling: 0, concreting: 0,
              formwork: 0, scaffold: 0, cranes: 0
            },
            projects_with_site_delegates: 0,
            projects_with_company_delegates: 0,
            projects_with_hsrs: 0,
            projects_with_hsr_chair_delegate: 0,
            projects_with_full_hs_committee: 0,
            avg_estimated_workers: 0,
            avg_assigned_workers: 0,
            avg_members: 0,
            financial_audit_activities: 0
          },
          active_pre_construction: {
            total_projects: 0,
            total_builders: 0,
            eba_builders: 0,
            eba_builder_percentage: 0,
            total_employers: 0,
            eba_employers: 0,
            eba_employer_percentage: 0,
            avg_estimated_workers: 0,
            avg_assigned_workers: 0,
            avg_members: 0
          },
          projects: [],
          errors
        };
      }
    }
  });
};
