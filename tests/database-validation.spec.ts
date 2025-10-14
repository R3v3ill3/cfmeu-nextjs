import { test, expect } from '@playwright/test';
import { testSupabase, verifyDatabaseObjects, getAliasMetricsSummary, getCanonicalPromotionQueue } from './helpers/database';

/**
 * Database Validation Tests for Alias Initiative
 * 
 * These tests verify that all database objects were created correctly
 * Can run without UI/authentication
 */

test.describe('Alias Initiative - Database Validation', () => {
  test('should have Supabase client configured', () => {
    expect(testSupabase).not.toBeNull();
  });

  test('should verify all database objects exist', async () => {
    test.setTimeout(15000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const verification = await verifyDatabaseObjects();
    
    expect(verification.tables).toBe(true);
    expect(verification.views).toBe(true);
    expect(verification.functions).toBe(true);
  });

  test('should query alias_metrics_summary view', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('alias_metrics_summary')
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    if (data) {
      // Verify structure
      expect(data).toHaveProperty('total_aliases');
      expect(data).toHaveProperty('employers_with_aliases');
      expect(data).toHaveProperty('authoritative_aliases');
      expect(data).toHaveProperty('computed_at');
      
      // Log metrics for visibility
      console.log('Alias Metrics Summary:', {
        total_aliases: data.total_aliases,
        employers_with_aliases: data.employers_with_aliases,
        authoritative_aliases: data.authoritative_aliases,
      });
    }
  });

  test('should query canonical_review_metrics view', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('canonical_review_metrics')
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    if (data) {
      expect(data).toHaveProperty('pending_reviews');
      expect(data).toHaveProperty('high_priority_reviews');
      expect(data).toHaveProperty('median_resolution_hours');
      
      console.log('Canonical Review Metrics:', {
        pending_reviews: data.pending_reviews,
        high_priority_reviews: data.high_priority_reviews,
        median_resolution_hours: data.median_resolution_hours,
      });
    }
  });

  test('should query alias_source_system_stats view', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('alias_source_system_stats')
      .select('*');

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    if (data && data.length > 0) {
      console.log(`Source System Stats: ${data.length} source systems found`);
      data.forEach((source: any) => {
        console.log(`  - ${source.source_system}: ${source.total_aliases} aliases`);
      });
    } else {
      console.log('No source system stats yet (database may be empty)');
    }
  });

  test('should query employer_alias_coverage view', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('employer_alias_coverage')
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    if (data) {
      expect(data).toHaveProperty('total_employers');
      expect(data).toHaveProperty('coverage_percentage');
      
      console.log('Alias Coverage:', {
        total_employers: data.total_employers,
        employers_with_aliases: data.employers_with_aliases,
        coverage_percentage: `${data.coverage_percentage}%`,
      });
    }
  });

  test('should query canonical_promotion_queue view', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('canonical_promotion_queue')
      .select('*')
      .limit(10);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    if (data && data.length > 0) {
      console.log(`Canonical Promotion Queue: ${data.length} items pending`);
      data.forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. ${item.proposed_name} (priority: ${item.priority})`);
      });
    } else {
      console.log('Canonical Promotion Queue is empty (all caught up!)');
    }
  });

  test('should call search_employers_with_aliases RPC', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase.rpc('search_employers_with_aliases', {
      p_query: 'test',
      p_limit: 10,
      p_offset: 0,
      p_include_aliases: true,
      p_alias_match_mode: 'any',
    });

    // Function should exist (even if no results)
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`Search RPC returned ${data?.length || 0} results`);
  });

  test('should call get_employer_aliases RPC', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    // Use a dummy UUID
    const { data, error } = await testSupabase.rpc('get_employer_aliases', {
      p_employer_id: '00000000-0000-0000-0000-000000000000',
    });

    // Function should exist and return empty array for non-existent employer
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    
    console.log('get_employer_aliases RPC is functional');
  });

  test('should call get_alias_metrics_range RPC', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const { data, error } = await testSupabase.rpc('get_alias_metrics_range', {
      p_start_date: startDate.toISOString().split('T')[0],
      p_end_date: endDate.toISOString().split('T')[0],
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`Metrics range returned ${data?.length || 0} daily records`);
  });

  test('should verify employer_canonical_audit table exists', async () => {
    test.setTimeout(10000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const { data, error } = await testSupabase
      .from('employer_canonical_audit')
      .select('id')
      .limit(1);

    // Table should exist (may be empty)
    expect(error).toBeNull();
    
    console.log('employer_canonical_audit table is accessible');
  });

  test('should verify all RPC functions are callable', async () => {
    test.setTimeout(15000);
    
    if (!testSupabase) {
      test.skip();
      return;
    }

    const functions = [
      'promote_alias_to_canonical',
      'reject_canonical_promotion',
      'defer_canonical_promotion',
      'search_employers_with_aliases',
      'get_employer_aliases',
      'get_alias_metrics_range',
    ];

    const results: Record<string, boolean> = {};

    for (const funcName of functions) {
      try {
        // Try to call each function (will fail due to missing params, but proves it exists)
        const { error } = await testSupabase.rpc(funcName as any, {});
        
        // Function exists if error is about params, not "function does not exist"
        const exists = !error || !error.message?.includes('does not exist');
        results[funcName] = exists;
      } catch (e) {
        results[funcName] = false;
      }
    }

    console.log('RPC Function Verification:', results);

    // All functions should exist
    Object.entries(results).forEach(([funcName, exists]) => {
      expect(exists).toBe(true);
    });
  });
});

