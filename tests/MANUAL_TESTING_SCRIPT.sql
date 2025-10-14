-- Manual Testing Script for Alias Initiative
-- Run these commands in Supabase SQL Editor to create test data

-- ============================================================================
-- STEP 1: Create test employers (if you don't have any suitable ones already)
-- ============================================================================

-- Create a test employer
INSERT INTO employers (id, name, employer_type, bci_company_id, incolink_id)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'ABC Construction Pty Ltd', 'main_contractor', 'BCI12345', NULL),
  ('22222222-2222-2222-2222-222222222222', 'XYZ Builders Group', 'builder', NULL, 'INCO67890'),
  ('33333333-3333-3333-3333-333333333333', 'Delta Engineering Services', 'large_contractor', 'BCI99999', 'INCO11111')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create authoritative aliases (these will appear in Canonical Names queue)
-- ============================================================================

-- Authoritative alias from BCI (will appear in canonical promotion queue)
INSERT INTO employer_aliases (
  id,
  employer_id, 
  alias, 
  alias_normalized,
  source_system,
  source_identifier,
  is_authoritative,
  collected_at,
  notes
) VALUES 
  (
    '11111111-aaaa-aaaa-aaaa-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'ABC Constructions Limited',  -- Different from canonical name
    'abc constructions limited',
    'bci',
    'BCI12345',
    true,  -- Authoritative = will appear in queue
    NOW() - INTERVAL '2 days',
    'Imported from BCI during test setup'
  ),
  (
    '22222222-aaaa-aaaa-aaaa-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'XYZ Building Services',  -- Different from canonical
    'xyz building services',
    'incolink',
    'INCO67890',
    true,  -- Authoritative
    NOW() - INTERVAL '5 days',
    'Imported from Incolink'
  )
ON CONFLICT (employer_id, alias_normalized) DO NOTHING;

-- Non-authoritative aliases (won't appear in queue unless employer has external ID)
INSERT INTO employer_aliases (
  id,
  employer_id,
  alias,
  alias_normalized,
  source_system,
  source_identifier,
  is_authoritative,
  collected_at,
  notes
) VALUES
  (
    '11111111-bbbb-bbbb-bbbb-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'ABC Construction Company',
    'abc construction company',
    'manual',
    'MANUAL-001',
    false,
    NOW() - INTERVAL '10 days',
    'Historical name from old records'
  ),
  (
    '33333333-aaaa-aaaa-aaaa-333333333333',
    '33333333-3333-3333-3333-333333333333',
    'Delta Engineering',
    'delta engineering',
    'bci',
    'BCI99999',
    true,
    NOW() - INTERVAL '1 day',
    'Recent BCI import'
  )
ON CONFLICT (employer_id, alias_normalized) DO NOTHING;

-- ============================================================================
-- STEP 3: Create a conflict scenario (optional - for testing conflict detection)
-- ============================================================================

-- Create another employer with similar name to test conflict warnings
INSERT INTO employers (id, name, employer_type)
VALUES ('44444444-4444-4444-4444-444444444444', 'ABC Constructions', 'small_contractor')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Verify test data created
-- ============================================================================

-- Check employers
SELECT id, name, employer_type, bci_company_id, incolink_id
FROM employers
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

-- Check aliases
SELECT 
  ea.id,
  ea.alias,
  ea.is_authoritative,
  ea.source_system,
  e.name as employer_canonical_name
FROM employer_aliases ea
JOIN employers e ON e.id = ea.employer_id
WHERE ea.employer_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY ea.is_authoritative DESC, ea.collected_at DESC;

-- Expected: 4 aliases total

-- ============================================================================
-- STEP 5: Verify features are working
-- ============================================================================

-- Check Canonical Promotion Queue (should show 3 items now)
SELECT 
  proposed_name,
  current_canonical_name,
  priority,
  is_authoritative,
  source_system,
  conflict_warnings
FROM canonical_promotion_queue
ORDER BY priority DESC;

-- Expected: 3 items (the 3 authoritative aliases)

-- Check Analytics Summary (should show non-zero counts now)
SELECT 
  total_aliases,
  employers_with_aliases,
  authoritative_aliases,
  bci_aliases,
  incolink_aliases,
  manual_aliases
FROM alias_metrics_summary;

-- Expected: total_aliases = 4, authoritative = 3, etc.

-- Test Alias Search
SELECT id, name, aliases, match_type, search_score
FROM search_employers_with_aliases('ABC', 10, 0, true, 'any');

-- Expected: Should return ABC Construction Pty Ltd with aliases array

-- ============================================================================
-- CLEANUP (run this after testing to remove test data)
-- ============================================================================

/*
-- Uncomment to clean up test data:

DELETE FROM employer_aliases 
WHERE employer_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

DELETE FROM employers 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);
*/

