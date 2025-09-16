import { supabase } from '@/integrations/supabase/client';

/**
 * Utility functions to refresh materialized views after data upload processes
 * This ensures users see their uploaded data immediately in listing pages
 */

export type RefreshScope = 
  | 'employers'    // After employer/EBA uploads
  | 'workers'      // After worker uploads  
  | 'projects'     // After project uploads
  | 'site_visits'  // After site visit uploads
  | 'all';         // After major changes

export interface RefreshResult {
  success: boolean;
  duration: number;
  scope: RefreshScope;
  error?: string;
}

/**
 * Refresh materialized views based on what type of data was uploaded
 * This is more efficient than refreshing everything
 */
export async function refreshMaterializedViews(scope: RefreshScope): Promise<RefreshResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Refreshing materialized views for scope: ${scope}`);

    switch (scope) {
      case 'employers':
        // Refresh employer and project views (projects depend on employer EBA status)
        await supabase.rpc('refresh_employer_related_views');
        break;
        
      case 'workers':
        // Refresh worker and project views (projects depend on worker counts)
        await supabase.rpc('refresh_worker_related_views');
        break;
        
      case 'projects':
        // Refresh project views and patch mappings
        await supabase.rpc('refresh_project_related_views');
        break;
        
      case 'site_visits':
        // Refresh site visit views
        await supabase.rpc('refresh_site_visit_related_views');
        break;
        
      case 'all':
        // Refresh everything (use sparingly - takes 2-5 minutes)
        await supabase.rpc('refresh_all_materialized_views');
        break;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Materialized views refreshed (${scope}) in ${duration}ms`);
    
    return {
      success: true,
      duration,
      scope,
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Failed to refresh materialized views (${scope}):`, error);
    
    return {
      success: false,
      duration,
      scope,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Refresh views with user feedback using toast notifications
 * Shows progress during the refresh process
 */
export async function refreshMaterializedViewsWithFeedback(
  scope: RefreshScope, 
  showToast?: (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => void
): Promise<RefreshResult> {
  
  if (showToast) {
    const scopeLabels = {
      employers: 'employer and EBA data',
      workers: 'worker and placement data', 
      projects: 'project and assignment data',
      site_visits: 'site visit data',
      all: 'all data views'
    };
    
    showToast({
      title: "Updating listings...",
      description: `Refreshing ${scopeLabels[scope]} to show your uploads immediately`
    });
  }

  const result = await refreshMaterializedViews(scope);

  if (showToast) {
    if (result.success) {
      showToast({
        title: "Upload complete!",
        description: `Your data is now visible in all listing pages (${result.duration}ms)`
      });
    } else {
      showToast({
        title: "Upload completed with warning",
        description: "Data was uploaded but listing refresh failed. Data will appear within 24 hours.",
        variant: 'destructive'
      });
    }
  }

  return result;
}

/**
 * Check if server-side processing is enabled for any page
 * Only refresh if server-side is actually being used
 */
export function shouldRefreshMaterializedViews(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS === 'true' ||
    process.env.NEXT_PUBLIC_USE_SERVER_SIDE_WORKERS === 'true' ||
    process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EBA_TRACKING === 'true' ||
    process.env.NEXT_PUBLIC_USE_SERVER_SIDE_PROJECTS === 'true'
  );
}

/**
 * Smart refresh that only runs if server-side processing is enabled
 * This prevents unnecessary work when using client-side processing
 */
export async function conditionalRefreshMaterializedViews(
  scope: RefreshScope,
  showToast?: (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => void
): Promise<RefreshResult | null> {
  
  if (shouldRefreshMaterializedViews()) {
    return await refreshMaterializedViewsWithFeedback(scope, showToast);
  } else {
    console.log(`ℹ️ Skipping materialized view refresh - server-side processing disabled`);
    return null;
  }
}

/**
 * Determine the appropriate refresh scope based on table name
 * Used by generic import processes
 */
export function getRefreshScopeForTable(tableName: string): RefreshScope {
  const tableToScope: Record<string, RefreshScope> = {
    // Employer-related tables
    'employers': 'employers',
    'company_eba_records': 'employers',
    'contractor_trade_capabilities': 'employers',
    
    // Worker-related tables
    'workers': 'workers',
    'worker_placements': 'workers',
    'union_roles': 'workers',
    
    // Project-related tables
    'projects': 'projects',
    'project_assignments': 'projects',
    'project_employer_roles': 'projects',
    'project_contractor_trades': 'projects',
    'patch_job_sites': 'projects',
    
    // Site visit tables
    'site_visit': 'site_visits',
    
    // Default to all for unknown tables
  };
  
  return tableToScope[tableName] || 'all';
}

/**
 * Batch refresh for multiple upload types
 * Use when an upload process affects multiple data types
 */
export async function batchRefreshMaterializedViews(
  scopes: RefreshScope[],
  showToast?: (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => void
): Promise<RefreshResult[]> {
  
  if (!shouldRefreshMaterializedViews()) {
    console.log(`ℹ️ Skipping batch refresh - server-side processing disabled`);
    return [];
  }

  const results: RefreshResult[] = [];
  const uniqueScopes = Array.from(new Set(scopes));
  
  if (showToast) {
    showToast({
      title: "Updating multiple data views...",
      description: `Refreshing ${uniqueScopes.join(', ')} data to show your uploads`
    });
  }

  for (const scope of uniqueScopes) {
    const result = await refreshMaterializedViews(scope);
    results.push(result);
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const allSuccessful = results.every(r => r.success);

  if (showToast) {
    if (allSuccessful) {
      showToast({
        title: "Batch update complete!",
        description: `All data views updated in ${totalDuration}ms`
      });
    } else {
      showToast({
        title: "Batch update completed with warnings",
        description: "Some view refreshes failed. Data will appear within 24 hours.",
        variant: 'destructive'
      });
    }
  }

  return results;
}
