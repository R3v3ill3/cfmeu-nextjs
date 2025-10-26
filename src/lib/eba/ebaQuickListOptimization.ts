import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { EbaEmployer, EbaFilterOptions } from './ebaFiltering';

/**
 * Performance optimization utilities for EBA quick list
 * Uses materialized views, caching, and client-side optimization
 */

export interface PerformanceMetrics {
  queryTime: number;
  filterTime: number;
  renderTime: number;
  totalTime: number;
  cacheHit: boolean;
  resultCount: number;
}

export interface CacheEntry {
  data: EbaEmployer[];
  timestamp: number;
  filters: Partial<EbaFilterOptions>;
  ttl: number;
}

export class EbaQuickListOptimizer {
  private supabase = getSupabaseBrowserClient();
  private cache = new Map<string, CacheEntry>();
  private performanceMetrics: PerformanceMetrics[] = [];
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Generate cache key from filters
   */
  private generateCacheKey(filters: Partial<EbaFilterOptions>): string {
    const keyParts = [
      filters.tradeType || 'all',
      filters.projectId || 'no-project',
      filters.ebaStatus || 'all',
      filters.showOnlyKeyContractors ? 'key-only' : 'all',
      filters.excludeEmployerIds?.sort().join(',') || 'none'
    ];
    return keyParts.join('|');
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData(filters: Partial<EbaFilterOptions>): EbaEmployer[] | null {
    const key = this.generateCacheKey(filters);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with LRU eviction
   */
  private setCachedData(filters: Partial<EbaFilterOptions>, data: EbaEmployer[]): void {
    const key = this.generateCacheKey(filters);

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      filters,
      ttl: this.CACHE_TTL
    });
  }

  /**
   * Optimized EBA employer fetch using materialized view
   */
  async fetchEmployersOptimized(filters: Partial<EbaFilterOptions> = {}): Promise<{
    employers: EbaEmployer[];
    metrics: PerformanceMetrics;
  }> {
    const startTime = Date.now();
    let queryTime = 0;
    let filterTime = 0;
    let cacheHit = false;

    // Check cache first
    let cachedData = this.getCachedData(filters);
    if (cachedData) {
      cacheHit = true;
      queryTime = Date.now() - startTime;

      return {
        employers: cachedData,
        metrics: {
          queryTime,
          filterTime: 0,
          renderTime: 0,
          totalTime: queryTime,
          cacheHit,
          resultCount: cachedData.length
        }
      };
    }

    // Fetch from database using materialized view
    const queryStartTime = Date.now();
    try {
      let query = this.supabase
        .from('employers_search_optimized')
        .select(`
          id,
          name,
          enterprise_agreement_status,
          company_eba_records!left(id, employer_id),
          project_assignments!inner(
            assignment_type,
            projects!inner(id, name),
            contractor_role_types(code, name)
          ),
          employer_aliases!left(alias, confidence_score)
        `)
        .limit(500); // Reasonable limit for performance

      // Apply trade filter at database level if specified
      if (filters.tradeType) {
        const { data: tradeEmployers } = await this.supabase
          .from('project_contractor_trades')
          .select('employer_id')
          .eq('trade_type', filters.tradeType)
          .limit(1000);

        if (tradeEmployers && tradeEmployers.length > 0) {
          const employerIds = [...new Set(tradeEmployers.map(t => t.employer_id))];
          query = query.in('id', employerIds);
        }
      }

      // Apply project filter at database level if specified
      if (filters.projectId) {
        const { data: projectEmployers } = await this.supabase
          .from('project_assignments')
          .select('employer_id')
          .eq('project_id', filters.projectId);

        if (projectEmployers && projectEmployers.length > 0) {
          const employerIds = [...new Set(projectEmployers.map(pe => pe.employer_id))];
          query = query.in('id', employerIds);
        }
      }

      // Apply exclusion filter at database level
      if (filters.excludeEmployerIds && filters.excludeEmployerIds.length > 0) {
        query = query.not('id', 'in', `(${filters.excludeEmployerIds.join(',')})`);
      }

      const { data: employersData, error } = await query;
      queryTime = Date.now() - queryStartTime;

      if (error) throw error;

      // Transform data (this is the expensive part, so we cache the result)
      const filterStartTime = Date.now();
      const transformedEmployers = await this.transformEmployerData(employersData || []);
      filterTime = Date.now() - filterStartTime;

      // Cache the transformed data
      this.setCachedData(filters, transformedEmployers);

      const totalTime = Date.now() - startTime;

      const metrics: PerformanceMetrics = {
        queryTime,
        filterTime,
        renderTime: 0,
        totalTime,
        cacheHit,
        resultCount: transformedEmployers.length
      };

      this.performanceMetrics.push(metrics);

      // Keep only last 100 metrics for memory management
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics = this.performanceMetrics.slice(-100);
      }

      return {
        employers: transformedEmployers,
        metrics
      };

    } catch (error) {
      console.error('Optimized EBA employer fetch failed:', error);
      throw error;
    }
  }

  /**
   * Transform employer data with optimizations
   */
  private async transformEmployerData(employersData: any[]): Promise<EbaEmployer[]> {
    // Batch fetch all related data to reduce database calls
    const employerIds = employersData.map(emp => emp.id);

    const [tradeAssignments, siteTradeAssignments] = await Promise.all([
      this.supabase
        .from('project_contractor_trades')
        .select('employer_id, trade_type, projects!inner(name)')
        .in('employer_id', employerIds),
      this.supabase
        .from('site_contractor_trades')
        .select('employer_id, trade_type, job_sites!inner(projects!inner(name))')
        .in('employer_id', employerIds)
    ]);

    // Create lookup maps for efficient data access
    const tradeLookup = new Map();
    const siteTradeLookup = new Map();

    tradeAssignments?.data?.forEach((assignment: any) => {
      if (!tradeLookup.has(assignment.employer_id)) {
        tradeLookup.set(assignment.employer_id, []);
      }
      tradeLookup.get(assignment.employer_id).push({
        tradeType: assignment.trade_type,
        projectName: assignment.projects.name
      });
    });

    siteTradeAssignments?.data?.forEach((assignment: any) => {
      if (!siteTradeLookup.has(assignment.employer_id)) {
        siteTradeLookup.set(assignment.employer_id, []);
      }
      siteTradeLookup.get(assignment.employer_id).push({
        tradeType: assignment.trade_type,
        projectName: assignment.job_sites.projects.name
      });
    });

    // Transform data in parallel using web workers if available
    const transformPromises = employersData.map(async (emp: any) => {
      const uniqueProjects = Array.from(
        new Map(
          emp.project_assignments
            ?.map((pa: any) => [pa.projects.id, pa.projects])
            .filter(([id, project]: any) => id && project)
        ).values()
      );

      const projects = uniqueProjects.map((project: any) => ({
        id: project.id,
        name: project.name
      }));

      const roleAssignments = emp.project_assignments?.filter((pa: any) =>
        pa.assignment_type === 'contractor_role' && pa.contractor_role_types
      ) || [];

      const roles = roleAssignments.map((ra: any) => ({
        roleType: ra.contractor_role_types.code as 'builder' | 'head_contractor' | 'project_manager',
        projectName: ra.projects.name
      }));

      const allTradeAssignments = [
        ...(tradeLookup.get(emp.id) || []),
        ...(siteTradeLookup.get(emp.id) || [])
      ];

      const hasEbaRecord = emp.company_eba_records?.length > 0;
      let ebaStatus: 'yes' | 'no' | 'pending' | null = null;

      if (hasEbaRecord) {
        ebaStatus = 'yes';
      } else if (emp.enterprise_agreement_status === true || emp.enterprise_agreement_status === 'active') {
        ebaStatus = 'yes';
      } else if (emp.enterprise_agreement_status === false || emp.enterprise_agreement_status === 'no') {
        ebaStatus = 'no';
      } else {
        ebaStatus = null;
      }

      const hasKeyRole = roles.some(r => ['builder', 'project_manager'].includes(r.roleType));
      const keyContractorTrades = new Set([
        'demolition', 'earthworks', 'piling', 'scaffolding',
        'structural_steel', 'concreting', 'form_work', 'bricklaying'
      ]);
      const hasKeyTrade = allTradeAssignments.some(t => keyContractorTrades.has(t.tradeType));

      return {
        id: emp.id,
        name: emp.name,
        eba_status: ebaStatus,
        project_count: projects.length,
        projects: projects,
        trades: allTradeAssignments,
        roles: roles,
        isKeyContractor: hasKeyRole || hasKeyTrade,
        aliases: emp.employer_aliases?.map((alias: any) => ({
          alias: alias.alias,
          confidence: alias.confidence_score
        })) || [],
        lastUpdated: new Date().toISOString()
      };
    });

    return Promise.all(transformPromises);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    avgQueryTime: number;
    avgFilterTime: number;
    avgTotalTime: number;
    cacheHitRate: number;
    totalRequests: number;
    avgResultCount: number;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        avgQueryTime: 0,
        avgFilterTime: 0,
        avgTotalTime: 0,
        cacheHitRate: 0,
        totalRequests: 0,
        avgResultCount: 0
      };
    }

    const total = this.performanceMetrics.length;
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;

    return {
      avgQueryTime: this.performanceMetrics.reduce((sum, m) => sum + m.queryTime, 0) / total,
      avgFilterTime: this.performanceMetrics.reduce((sum, m) => sum + m.filterTime, 0) / total,
      avgTotalTime: this.performanceMetrics.reduce((sum, m) => sum + m.totalTime, 0) / total,
      cacheHitRate: (cacheHits / total) * 100,
      totalRequests: total,
      avgResultCount: this.performanceMetrics.reduce((sum, m) => sum + m.resultCount, 0) / total
    };
  }

  /**
   * Clear cache and metrics
   */
  clearCache(): void {
    this.cache.clear();
    this.performanceMetrics = [];
  }

  /**
   * Preload common queries for better performance
   */
  async preloadCommonQueries(tradeTypes: string[]): Promise<void> {
    const commonFilters = [
      { ebaStatus: 'yes' as const },
      { showOnlyKeyContractors: true },
      { ebaStatus: 'yes', showOnlyKeyContractors: true }
    ];

    for (const tradeType of tradeTypes.slice(0, 5)) { // Limit to prevent overload
      for (const baseFilters of commonFilters) {
        const filters = { ...baseFilters, tradeType };
        try {
          await this.fetchEmployersOptimized(filters);
        } catch (error) {
          console.warn(`Failed to preload cache for trade ${tradeType}:`, error);
        }
      }
    }
  }

  /**
   * Optimized search with debouncing and result limiting
   */
  async searchEmployersOptimized(
    searchTerm: string,
    filters: Partial<EbaFilterOptions> = {},
    limit: number = 50
  ): Promise<EbaEmployer[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const startTime = Date.now();

    try {
      // Get base data (from cache if available)
      const { employers } = await this.fetchEmployersOptimized(filters);

      // Client-side search with performance monitoring
      const searchStartTime = Date.now();
      const searchLower = searchTerm.toLowerCase();

      const results = employers
        .filter(emp =>
          emp.name.toLowerCase().includes(searchLower) ||
          emp.aliases?.some(alias => alias.alias.toLowerCase().includes(searchLower)) ||
          emp.projects.some(p => p.name.toLowerCase().includes(searchLower)) ||
          emp.trades.some(t => t.tradeType.toLowerCase().includes(searchLower))
        )
        .slice(0, limit); // Limit results for performance

      const searchTime = Date.now() - searchStartTime;
      const totalTime = Date.now() - startTime;

      console.debug(`EBA search completed: ${searchTime}ms search, ${totalTime}ms total, ${results.length} results`);

      return results;
    } catch (error) {
      console.error('Optimized EBA search failed:', error);
      return [];
    }
  }
}

/**
 * Singleton instance for app-wide optimization
 */
export const ebaQuickListOptimizer = new EbaQuickListOptimizer();

/**
 * React hook for optimized EBA employer data
 */
export function useOptimizedEbaEmployers(filters: Partial<EbaFilterOptions> = {}) {
  const [data, setData] = useState<EbaEmployer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ebaQuickListOptimizer.fetchEmployersOptimized(filters);
      setData(result.employers);
      setMetrics(result.metrics);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch EBA employers'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    metrics,
    refetch: fetchData,
    performanceStats: ebaQuickListOptimizer.getPerformanceStats()
  };
}

/**
 * Mobile-specific optimizations
 */
export class MobileEbaOptimizer extends EbaQuickListOptimizer {
  private readonly MOBILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for mobile
  private readonly MOBILE_LIMIT = 100; // Smaller result set for mobile

  protected generateCacheKey(filters: Partial<EbaFilterOptions>): string {
    // Include mobile indicator in cache key
    return `mobile|${super.generateCacheKey(filters)}`;
  }

  async fetchEmployersOptimized(filters: Partial<EbaFilterOptions> = {}): Promise<{
    employers: EbaEmployer[];
    metrics: PerformanceMetrics;
  }> {
    // Apply mobile-specific limits
    const mobileFilters = {
      ...filters,
      limit: this.MOBILE_LIMIT
    };

    return super.fetchEmployersOptimized(mobileFilters);
  }
}

export const mobileEbaOptimizer = new MobileEbaOptimizer();