-- Test script to verify search_employers_with_aliases is working correctly
-- Run this in Supabase SQL Editor or via psql

-- Step 1: Verify function signature includes address fields
-- Expected to see: address_line_1, suburb, state, postcode in the RETURNS TABLE clause
\df search_employers_with_aliases

-- Step 2: Test the function with a simple query
SELECT
  id,
  name,
  address_line_1,  -- This should NOT error if migration applied
  suburb,
  state,
  postcode,
  match_type,
  search_score
FROM search_employers_with_aliases(
  p_query := 'REDS GLOBAL',
  p_limit := 10,
  p_offset := 0,
  p_include_aliases := true,
  p_alias_match_mode := 'any'
);

-- Step 3: Test with another common search term
SELECT
  id,
  name,
  address_line_1,
  suburb,
  state,
  postcode,
  match_type,
  search_score
FROM search_employers_with_aliases(
  p_query := 'construction',
  p_limit := 5,
  p_offset := 0,
  p_include_aliases := true,
  p_alias_match_mode := 'any'
);

-- Step 4: Check if any results are being returned at all
SELECT COUNT(*) as total_results
FROM search_employers_with_aliases(
  p_query := 'a',  -- Single letter should match many
  p_limit := 100,
  p_offset := 0,
  p_include_aliases := true,
  p_alias_match_mode := 'any'
);

-- If you get errors, check the exact error message and report it back
-- If you get results, the function is working correctly!
