import { supabase } from '@/integrations/supabase/client';
import { normalizeEmployerName } from '@/lib/employers/normalize';

// Types for employer alias operations
export interface EmployerAlias {
  id: string;
  alias: string;
  alias_normalized: string;
  employer_id: string;
  created_at: string;
  created_by: string | null;
  source_system: string | null;
  source_identifier: string | null;
  collected_at: string | null;
  collected_by: string | null;
  is_authoritative: boolean;
  notes: string | null;
}

export interface CreateEmployerAliasRequest {
  alias: string;
  employer_id: string;
  source_system?: string;
  source_identifier?: string;
  is_authoritative?: boolean;
  notes?: string;
  created_by?: string;
}

export interface BulkCreateAliasesRequest {
  aliases: CreateEmployerAliasRequest[];
  skip_duplicates?: boolean;
}

export interface BulkUpdateAliasesRequest {
  updates: Array<{
    id: string;
    alias?: string;
    is_authoritative?: boolean;
    notes?: string;
  }>;
}

export interface EbaEmployerFilter {
  trade_type?: string;
  search?: string;
  limit?: number;
  offset?: number;
  include_active_eba_only?: boolean;
}

export interface EbaEmployerResult {
  id: string;
  name: string;
  employer_type: string;
  enterprise_agreement_status: boolean;
  eba_status_source: string | null;
  eba_status_updated_at: string | null;
  estimated_worker_count: number | null;
  trades: Array<{
    code: string;
    name: string;
  }>;
  projects_count: number;
  last_eba_activity: string | null;
}

/**
 * Create a new employer alias with validation and provenance tracking
 */
export async function createEmployerAlias(
  request: CreateEmployerAliasRequest
): Promise<{ success: boolean; data?: EmployerAlias; error?: string }> {
  try {
    // Normalize the alias for consistent matching
    const normalizedAlias = normalizeEmployerName(request.alias).normalized;

    // Check for duplicate alias for this employer
    const { data: existing, error: checkError } = await supabase
      .from('employer_aliases')
      .select('id, alias_normalized')
      .eq('employer_id', request.employer_id)
      .eq('alias_normalized', normalizedAlias)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for duplicate alias:', checkError);
      return { success: false, error: 'Failed to validate alias uniqueness' };
    }

    if (existing) {
      return { success: false, error: 'This alias already exists for this employer' };
    }

    // Create the alias with provenance tracking
    const { data, error } = await supabase
      .from('employer_aliases')
      .insert({
        alias: request.alias.trim(),
        alias_normalized: normalizedAlias,
        employer_id: request.employer_id,
        source_system: request.source_system || 'manual',
        source_identifier: request.source_identifier || request.alias.trim(),
        collected_at: new Date().toISOString(),
        collected_by: request.created_by || null,
        is_authoritative: request.is_authoritative !== undefined ? request.is_authoritative : true,
        notes: request.notes || null,
        created_by: request.created_by || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error creating employer alias:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Get all aliases for a specific employer with provenance information
 */
export async function getEmployerAliases(
  employerId: string,
  includeInactive: boolean = false
): Promise<{ success: boolean; data?: EmployerAlias[]; error?: string }> {
  try {
    let query = supabase
      .from('employer_aliases')
      .select('*')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employer aliases:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error fetching employer aliases:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Search employers with alias support
 */
export async function searchEmployersWithAliases(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    includeAliases?: boolean;
    aliasMatchMode?: 'any' | 'authoritative' | 'canonical';
    employerType?: string;
    ebaStatus?: 'active' | 'inactive' | 'all';
  } = {}
): Promise<{ success: boolean; data?: any[]; error?: string; count?: number }> {
  try {
    const {
      limit = 50,
      offset = 0,
      includeAliases = true,
      aliasMatchMode = 'any',
      employerType,
      ebaStatus = 'all'
    } = options;

    let result: any[] = [];
    let totalCount = 0;

    if (includeAliases && query.trim()) {
      // Use the enhanced search with aliases
      const { data: searchResults, error: searchError } = await supabase.rpc(
        'search_employers_with_aliases',
        {
          p_query: query.trim(),
          p_limit: limit,
          p_offset: offset,
          p_include_aliases: true,
          p_alias_match_mode: aliasMatchMode
        }
      );

      if (searchError) {
        console.error('Error in alias search:', searchError);
        return { success: false, error: searchError.message };
      }

      result = searchResults || [];
    } else {
      // Standard search without aliases
      let dbQuery = supabase
        .from('employers_search_optimized')
        .select('*', { count: 'exact' });

      if (query.trim()) {
        dbQuery = dbQuery.ilike('name', `%${query.trim()}%`);
      }

      if (employerType && employerType !== 'all') {
        dbQuery = dbQuery.eq('employer_type', employerType);
      }

      if (ebaStatus === 'active') {
        dbQuery = dbQuery.eq('enterprise_agreement_status', true);
      } else if (ebaStatus === 'inactive') {
        dbQuery = dbQuery.or('enterprise_agreement_status.is.null,enterprise_agreement_status.eq.false');
      }

      const { data, error, count } = await dbQuery
        .range(offset, offset + limit - 1)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error in standard search:', error);
        return { success: false, error: error.message };
      }

      result = data || [];
      totalCount = count || 0;
    }

    return { success: true, data: result, count: totalCount };
  } catch (error) {
    console.error('Unexpected error searching employers with aliases:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Validate alias uniqueness to prevent duplicates
 */
export async function validateAliasUniqueness(
  alias: string,
  employerId: string,
  excludeAliasId?: string
): Promise<{ success: boolean; isUnique: boolean; error?: string }> {
  try {
    const normalizedAlias = normalizeEmployerName(alias).normalized;

    let query = supabase
      .from('employer_aliases')
      .select('id, alias, employer_id')
      .eq('alias_normalized', normalizedAlias);

    // Exclude current alias if updating
    if (excludeAliasId) {
      query = query.neq('id', excludeAliasId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error validating alias uniqueness:', error);
      return { success: false, isUnique: false, error: error.message };
    }

    const conflicts = data || [];
    const sameEmployerConflict = conflicts.find(c => c.employer_id === employerId);
    const otherEmployerConflict = conflicts.find(c => c.employer_id !== employerId);

    return {
      success: true,
      isUnique: !sameEmployerConflict,
      error: sameEmployerConflict
        ? 'This alias already exists for this employer'
        : otherEmployerConflict
        ? 'Warning: This alias is already used by another employer'
        : undefined
    };
  } catch (error) {
    console.error('Unexpected error validating alias uniqueness:', error);
    return { success: false, isUnique: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Get EBA employers filtered by trade type
 */
export async function getEbaEmployersByTrade(
  filter: EbaEmployerFilter
): Promise<{ success: boolean; data?: EbaEmployerResult[]; error?: string; count?: number }> {
  try {
    const {
      trade_type,
      search,
      limit = 100,
      offset = 0,
      include_active_eba_only = true
    } = filter;

    let query = supabase
      .from('employers_search_optimized')
      .select(`
        id,
        name,
        employer_type,
        enterprise_agreement_status,
        eba_status_source,
        eba_status_updated_at,
        estimated_worker_count,
        project_count,
        most_recent_eba_date,
        category_trades_json
      `, { count: 'exact' });

    // Apply EBA status filter
    if (include_active_eba_only) {
      query = query.eq('enterprise_agreement_status', true);
    }

    // Apply trade type filter
    if (trade_type) {
      query = query.contains('category_trades_json', [{ code: trade_type }]);
    }

    // Apply search filter
    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Apply pagination and ordering
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('most_recent_eba_date', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching EBA employers by trade:', error);
      return { success: false, error: error.message };
    }

    // Transform data to match expected format
    const transformedData: EbaEmployerResult[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      employer_type: row.employer_type,
      enterprise_agreement_status: row.enterprise_agreement_status,
      eba_status_source: row.eba_status_source,
      eba_status_updated_at: row.eba_status_updated_at,
      estimated_worker_count: row.estimated_worker_count,
      trades: (row.category_trades_json || [])
        .filter((trade: any) => trade_type ? trade.code === trade_type : true)
        .map((trade: any) => ({
          code: trade.code,
          name: trade.name
        })),
      projects_count: row.project_count || 0,
      last_eba_activity: row.most_recent_eba_date
    }));

    return {
      success: true,
      data: transformedData,
      count: count || 0
    };
  } catch (error) {
    console.error('Unexpected error fetching EBA employers by trade:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Delete an employer alias
 */
export async function deleteEmployerAlias(
  aliasId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employer_aliases')
      .delete()
      .eq('id', aliasId);

    if (error) {
      console.error('Error deleting employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting employer alias:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Update an employer alias
 */
export async function updateEmployerAlias(
  aliasId: string,
  updates: {
    alias?: string;
    is_authoritative?: boolean;
    notes?: string;
  },
  userId?: string
): Promise<{ success: boolean; data?: EmployerAlias; error?: string }> {
  try {
    const updateData: any = { ...updates };

    // If alias is being updated, normalize it
    if (updates.alias) {
      updateData.alias_normalized = normalizeEmployerName(updates.alias).normalized;
      updateData.alias = updates.alias.trim();
    }

    const { data, error } = await supabase
      .from('employer_aliases')
      .update(updateData)
      .eq('id', aliasId)
      .select()
      .single();

    if (error) {
      console.error('Error updating employer alias:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error updating employer alias:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}