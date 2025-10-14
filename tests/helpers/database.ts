/**
 * Database helper for Playwright tests
 * 
 * Provides utilities for:
 * - Setting up test data
 * - Cleaning up after tests
 * - Verifying database state
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for tests
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const testSupabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export interface TestEmployer {
  id: string;
  name: string;
  employer_type: string;
}

export interface TestAlias {
  id: string;
  alias: string;
  employer_id: string;
  is_authoritative: boolean;
  source_system: string;
}

/**
 * Create a test employer
 */
export async function createTestEmployer(
  name: string = 'Test Employer for E2E',
  employerType: string = 'main_contractor'
): Promise<TestEmployer | null> {
  if (!testSupabase) {
    console.warn('Supabase client not initialized for tests');
    return null;
  }

  const { data, error } = await testSupabase
    .from('employers')
    .insert({
      name,
      employer_type: employerType,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create test employer:', error);
    return null;
  }

  return data as TestEmployer;
}

/**
 * Create a test alias
 */
export async function createTestAlias(
  employerId: string,
  alias: string,
  isAuthoritative: boolean = true,
  sourceSystem: string = 'test'
): Promise<TestAlias | null> {
  if (!testSupabase) {
    console.warn('Supabase client not initialized for tests');
    return null;
  }

  const { data, error } = await testSupabase
    .from('employer_aliases')
    .insert({
      employer_id: employerId,
      alias,
      alias_normalized: alias.toLowerCase(),
      is_authoritative: isAuthoritative,
      source_system: sourceSystem,
      source_identifier: `TEST-${Date.now()}`,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create test alias:', error);
    return null;
  }

  return data as TestAlias;
}

/**
 * Clean up test data
 */
export async function cleanupTestEmployer(employerId: string): Promise<void> {
  if (!testSupabase) return;

  // Delete aliases first (foreign key constraint)
  await testSupabase
    .from('employer_aliases')
    .delete()
    .eq('employer_id', employerId);

  // Delete employer
  await testSupabase
    .from('employers')
    .delete()
    .eq('id', employerId);
}

/**
 * Get canonical promotion queue
 */
export async function getCanonicalPromotionQueue(): Promise<any[]> {
  if (!testSupabase) return [];

  const { data } = await testSupabase
    .from('canonical_promotion_queue')
    .select('*')
    .limit(10);

  return data || [];
}

/**
 * Get alias metrics summary
 */
export async function getAliasMetricsSummary(): Promise<any> {
  if (!testSupabase) return null;

  const { data } = await testSupabase
    .from('alias_metrics_summary')
    .select('*')
    .single();

  return data;
}

/**
 * Verify database objects exist
 */
export async function verifyDatabaseObjects(): Promise<{
  tables: boolean;
  views: boolean;
  functions: boolean;
}> {
  if (!testSupabase) {
    return { tables: false, views: false, functions: false };
  }

  try {
    // Check table
    const { error: tableError } = await testSupabase
      .from('employer_canonical_audit')
      .select('id')
      .limit(1);

    // Check view
    const { error: viewError } = await testSupabase
      .from('canonical_promotion_queue')
      .select('*')
      .limit(1);

    // Check function via RPC
    const { error: rpcError } = await testSupabase
      .rpc('get_employer_aliases', { p_employer_id: '00000000-0000-0000-0000-000000000000' });

    return {
      tables: !tableError,
      views: !viewError,
      functions: !rpcError || rpcError.message?.includes('null'), // Function exists but returns null for fake ID
    };
  } catch (error) {
    console.error('Error verifying database objects:', error);
    return { tables: false, views: false, functions: false };
  }
}

