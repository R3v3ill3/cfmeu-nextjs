# Employer Search Performance: Detailed Options Comparison

## Performance Comparison Matrix

| Metric | Current | Option 1 (Materialized View) | Option 2 (DB Function) | Option 3 (Hybrid) | Option 4 (Full-Text Only) |
|--------|---------|------------------------------|----------------------|-------------------|------------------------|
| **Query Time (simple)** | 200-500ms | 50-100ms | 100-200ms | 150-300ms | 150-250ms |
| **Query Time (filtered)** | 700-1200ms | 100-200ms | 200-400ms | 300-500ms | 400-600ms |
| **Query Time (enhanced)** | 1200-1800ms | 300-500ms | 400-700ms | 500-800ms | 700-1000ms |
| **Implementation Time** | - | 1-2 weeks | 3-5 days | 1-2 days | 2-3 days |
| **Maintenance Overhead** | High | Low | Medium | Medium | Low |
| **Data Freshness** | Real-time | 5 min delay | Real-time | Real-time | Real-time |
| **Storage Overhead** | Baseline | +20% | None | None | +5% (indexes) |
| **Code Changes** | - | Minimal | Moderate | Minor | Minor |
| **Search Quality** | Good | Good | Good | Good | Excellent |
| **Scalability** | Poor | Excellent | Good | Fair | Good |
| **Risk Level** | - | Low | Medium | Low | Low |

## Cost-Benefit Analysis

### Option 1: Materialized View ⭐⭐⭐⭐⭐
**Best for:** Long-term maintainability and maximum performance

**Pros:**
- ✅ 80-90% performance improvement
- ✅ Minimal code changes (just swap table name)
- ✅ Excellent for analytics/dashboard use case
- ✅ Easy to add more precomputed columns later
- ✅ Query plan is simple and predictable
- ✅ Reduces API layer complexity

**Cons:**
- ❌ 5-minute data staleness (acceptable for this use case)
- ❌ Additional storage (~20% of employers table)
- ❌ Requires refresh strategy setup
- ❌ Initial migration complexity

**When to Choose:**
- You need best possible performance
- 5-minute data delay is acceptable
- You have long-term maintenance in mind
- You want to add more computed fields later

---

### Option 2: Database Function ⭐⭐⭐⭐
**Best for:** Real-time data with good performance

**Pros:**
- ✅ 60-70% performance improvement
- ✅ Real-time data (no staleness)
- ✅ All logic in database (proper separation)
- ✅ Flexible parameter handling
- ✅ Can use in multiple contexts

**Cons:**
- ❌ Complex SQL function to maintain
- ❌ Still computing filters on each query
- ❌ Requires significant API refactoring
- ❌ More complex query plans

**When to Choose:**
- Real-time data is critical
- You have SQL expertise on team
- You want flexibility in query parameters
- You're okay with moderate maintenance

---

### Option 3: Hybrid Approach ⭐⭐⭐
**Best for:** Quick improvement with minimal risk

**Pros:**
- ✅ 30-40% performance improvement
- ✅ Quick to implement (1-2 days)
- ✅ Low risk
- ✅ Real-time data
- ✅ Can iterate incrementally

**Cons:**
- ❌ Not as fast as other options
- ❌ Still some API complexity
- ❌ Partial solution
- ❌ May need further optimization later

**When to Choose:**
- You need improvement NOW
- You want to minimize risk
- You'll implement better solution later
- You're resource-constrained

---

### Option 4: Full-Text Search Only ⭐⭐
**Best for:** Search quality improvement, not comprehensive solution

**Pros:**
- ✅ Better search experience (fuzzy matching)
- ✅ Handles typos well
- ✅ Easy to implement
- ✅ Relevance scoring

**Cons:**
- ❌ Doesn't solve post-filtering issues
- ❌ Only 20-30% improvement overall
- ❌ Requires pg_trgm extension
- ❌ Must combine with other options

**When to Choose:**
- As supplement to other options
- Search quality is poor
- You have typo problems
- NOT as standalone solution

---

## Detailed SQL Examples

### Option 1: Complete Materialized View Implementation

```sql
-- ============================================================================
-- OPTION 1: MATERIALIZED VIEW
-- Complete implementation with refresh strategy
-- ============================================================================

-- Step 1: Create the materialized view
CREATE MATERIALIZED VIEW employers_search_optimized AS
SELECT 
  -- Base employer fields
  e.id,
  e.name,
  e.abn,
  e.employer_type,
  e.website,
  e.email,
  e.phone,
  e.estimated_worker_count,
  e.incolink_id,
  e.bci_company_id,
  e.enterprise_agreement_status,
  e.address_line_1,
  e.address_line_2,
  e.suburb,
  e.state,
  e.postcode,
  e.created_at,
  e.updated_at,
  
  -- PRECOMPUTED: Engagement status
  (
    EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id)
    OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id)
  ) as is_engaged,
  
  -- PRECOMPUTED: Worker and project counts
  (SELECT COUNT(*) FROM worker_placements wp WHERE wp.employer_id = e.id)::int 
    as actual_worker_count,
  (SELECT COUNT(*) FROM project_assignments pa WHERE pa.employer_id = e.id)::int 
    as project_count,
  
  -- PRECOMPUTED: EBA category with full date logic
  CASE
    -- Active: Has override status OR recent certification
    WHEN e.enterprise_agreement_status = true THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
    ) THEN 'active'
    
    -- Lodged: Recent lodgement with FWC
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
    ) THEN 'lodged'
    
    -- Pending: Recent signing, voting, or in progress
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND (
        r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
        OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
        OR r.eba_data_form_received IS NOT NULL
        OR r.date_draft_signing_sent IS NOT NULL
        OR r.date_barg_docs_sent IS NOT NULL
      )
    ) THEN 'pending'
    
    -- No EBA
    ELSE 'no'
  END as eba_category,
  
  -- PRECOMPUTED: EBA recency score for sorting (Unix timestamp of most recent EBA activity)
  COALESCE((
    SELECT MAX(GREATEST(
      EXTRACT(EPOCH FROM r.fwc_certified_date),
      EXTRACT(EPOCH FROM r.eba_lodged_fwc),
      EXTRACT(EPOCH FROM r.date_eba_signed),
      EXTRACT(EPOCH FROM r.date_vote_occurred)
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), 0) as eba_recency_score,
  
  -- PRECOMPUTED: Most recent EBA date (for display)
  (
    SELECT MAX(GREATEST(
      r.fwc_certified_date,
      r.eba_lodged_fwc,
      r.date_eba_signed,
      r.date_vote_occurred
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ) as most_recent_eba_date,
  
  -- PRECOMPUTED: Company EBA records as JSONB
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'nominal_expiry_date', r.nominal_expiry_date,
        'fwc_certified_date', r.fwc_certified_date,
        'eba_lodged_fwc', r.eba_lodged_fwc,
        'date_eba_signed', r.date_eba_signed,
        'date_vote_occurred', r.date_vote_occurred
      ) ORDER BY GREATEST(
        r.fwc_certified_date,
        r.eba_lodged_fwc,
        r.date_eba_signed,
        r.date_vote_occurred
      ) DESC NULLS LAST
    )
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), '[]'::jsonb) as company_eba_records_json,
  
  -- PRECOMPUTED: Worker placements as JSONB (just IDs for engagement check)
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', wp.id))
    FROM worker_placements wp
    WHERE wp.employer_id = e.id
  ), '[]'::jsonb) as worker_placements_json,
  
  -- PRECOMPUTED: Project assignments as JSONB (just IDs)
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', pa.id))
    FROM project_assignments pa
    WHERE pa.employer_id = e.id
  ), '[]'::jsonb) as project_assignments_json,
  
  -- PRECOMPUTED: Projects summary
  COALESCE((
    SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'roles', (
        SELECT jsonb_agg(DISTINCT crt.code)
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt ON pa2.contractor_role_id = crt.id
        WHERE pa2.employer_id = e.id 
          AND pa2.project_id = p.id
          AND pa2.assignment_type = 'contractor_role'
      ),
      'trades', (
        SELECT jsonb_agg(DISTINCT tt.code)
        FROM project_assignments pa3
        LEFT JOIN trade_types tt ON pa3.trade_type_id = tt.id
        WHERE pa3.employer_id = e.id 
          AND pa3.project_id = p.id
          AND pa3.assignment_type = 'trade_work'
      )
    ))
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.employer_id = e.id
  ), '[]'::jsonb) as projects_json,
  
  -- PRECOMPUTED: Organisers (through patches and job sites)
  COALESCE((
    SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'id', o.id,
      'name', o.first_name || ' ' || o.surname,
      'patch_name', pat.name
    ))
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    JOIN job_sites js ON js.project_id = p.id
    JOIN patch_job_sites pjs ON pjs.job_site_id = js.id
    JOIN patches pat ON pat.id = pjs.patch_id
    JOIN patch_organisers po ON po.patch_id = pat.id
    JOIN organisers o ON o.id = po.organiser_id
    WHERE pa.employer_id = e.id
  ), '[]'::jsonb) as organisers_json,
  
  -- Incolink info (for enhanced view)
  e.incolink_last_matched,
  
  -- Search optimization: Lowercase name for case-insensitive search
  LOWER(e.name) as name_lower,
  
  -- Last refreshed timestamp
  NOW() as view_refreshed_at

FROM employers e;

-- Step 2: Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_emp_search_opt_id ON employers_search_optimized(id);

-- Step 3: Create indexes for filtering and searching
CREATE INDEX idx_emp_search_opt_engaged 
  ON employers_search_optimized(is_engaged);

CREATE INDEX idx_emp_search_opt_eba_category 
  ON employers_search_optimized(eba_category);

CREATE INDEX idx_emp_search_opt_employer_type 
  ON employers_search_optimized(employer_type);

CREATE INDEX idx_emp_search_opt_name_lower 
  ON employers_search_optimized(name_lower);

CREATE INDEX idx_emp_search_opt_name_trgm 
  ON employers_search_optimized USING gin(name gin_trgm_ops);

-- Composite index for most common filter combination
CREATE INDEX idx_emp_search_opt_engaged_eba_type 
  ON employers_search_optimized(is_engaged, eba_category, employer_type);

-- Index for sorting by estimated workers
CREATE INDEX idx_emp_search_opt_estimated_workers 
  ON employers_search_optimized(estimated_worker_count DESC NULLS LAST);

-- Index for sorting by EBA recency
CREATE INDEX idx_emp_search_opt_eba_recency 
  ON employers_search_optimized(eba_recency_score DESC);

-- Step 4: Grant permissions
GRANT SELECT ON employers_search_optimized TO authenticated;

-- ============================================================================
-- REFRESH STRATEGIES
-- ============================================================================

-- Strategy A: Manual refresh function
CREATE OR REPLACE FUNCTION refresh_employers_search_view()
RETURNS TABLE (
  success boolean,
  duration_ms integer,
  rows_refreshed bigint,
  last_refresh timestamptz
) AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_row_count bigint;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Concurrent refresh allows reads during refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY employers_search_optimized;
  
  v_end_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_row_count 
  FROM employers_search_optimized;
  
  RETURN QUERY
  SELECT 
    true as success,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer as duration_ms,
    v_row_count as rows_refreshed,
    NOW() as last_refresh;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_employers_search_view TO authenticated, service_role;

-- Strategy B: Automatic refresh via pg_cron (if available)
-- Requires: CREATE EXTENSION pg_cron;
-- Schedule refresh every 5 minutes:
-- SELECT cron.schedule('refresh-employers-view', '*/5 * * * *', 
--   'SELECT refresh_employers_search_view();');

-- Strategy C: Trigger-based incremental refresh (real-time, more complex)
-- This would require:
-- 1. Tracking changed employer IDs in a queue table
-- 2. Background process to refresh specific rows
-- 3. More complex but provides real-time updates

-- ============================================================================
-- MONITORING
-- ============================================================================

-- View to monitor refresh status
CREATE OR REPLACE VIEW employers_search_view_status AS
SELECT 
  schemaname,
  matviewname,
  matviewowner,
  tablespace,
  hasindexes,
  ispopulated,
  (SELECT view_refreshed_at FROM employers_search_optimized LIMIT 1) as last_refresh,
  NOW() - (SELECT view_refreshed_at FROM employers_search_optimized LIMIT 1) as staleness,
  pg_size_pretty(pg_total_relation_size('employers_search_optimized')) as total_size,
  (SELECT COUNT(*) FROM employers_search_optimized) as row_count
FROM pg_matviews
WHERE matviewname = 'employers_search_optimized';

GRANT SELECT ON employers_search_view_status TO authenticated;

-- ============================================================================
-- API USAGE (TypeScript)
-- ============================================================================

/*
// In your API route, simply replace 'employers' with 'employers_search_optimized':

let query = supabase.from('employers_search_optimized').select(`
  id,
  name,
  abn,
  employer_type,
  website,
  email,
  phone,
  estimated_worker_count,
  incolink_id,
  bci_company_id,
  is_engaged,
  eba_category,
  company_eba_records_json,
  worker_placements_json,
  project_assignments_json,
  projects_json,
  organisers_json
`, { count: 'exact' });

// Apply filters (now using precomputed columns)
if (q) {
  query = query.ilike('name', `%${q}%`);
}

if (engaged) {
  query = query.eq('is_engaged', true);
}

if (eba !== 'all') {
  query = query.eq('eba_category', eba);
}

if (type !== 'all') {
  query = query.eq('employer_type', type);
}

// Sorting (now using precomputed scores)
if (sort === 'name') {
  query = query.order('name', { ascending: dir === 'asc' });
} else if (sort === 'estimated') {
  query = query.order('estimated_worker_count', { ascending: dir === 'asc', nullsFirst: false });
} else if (sort === 'eba_recency') {
  query = query.order('eba_recency_score', { ascending: dir === 'asc' });
}

// Pagination
query = query.range(from, to);

const { data, error, count } = await query;

// Transform JSON fields back to arrays (if needed)
const employers = data.map(emp => ({
  ...emp,
  company_eba_records: emp.company_eba_records_json || [],
  worker_placements: emp.worker_placements_json || [],
  project_assignments: emp.project_assignments_json || [],
  projects: emp.projects_json || [],
  organisers: emp.organisers_json || []
}));
*/
```

---

### Option 2: Database Function Implementation

```sql
-- ============================================================================
-- OPTION 2: OPTIMIZED DATABASE FUNCTION
-- Single function that handles all filtering and data aggregation
-- ============================================================================

CREATE OR REPLACE FUNCTION search_employers_optimized(
  p_query text DEFAULT NULL,
  p_engaged boolean DEFAULT NULL,
  p_eba_category text DEFAULT 'all',
  p_employer_type text DEFAULT 'all',
  p_sort text DEFAULT 'name',
  p_dir text DEFAULT 'asc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_include_enhanced boolean DEFAULT false
)
RETURNS TABLE (
  -- Employer fields
  id uuid,
  name text,
  abn text,
  employer_type employer_type,
  website text,
  email text,
  phone text,
  estimated_worker_count int,
  incolink_id text,
  bci_company_id text,
  incolink_last_matched date,
  enterprise_agreement_status boolean,
  
  -- Computed fields
  is_engaged boolean,
  eba_category text,
  
  -- Relationship data as JSONB
  company_eba_records jsonb,
  worker_placements jsonb,
  project_assignments jsonb,
  
  -- Enhanced data (optional)
  projects jsonb,
  organisers jsonb,
  
  -- Metadata
  total_count bigint
) AS $$
DECLARE
  v_query_lower text;
BEGIN
  -- Normalize query
  v_query_lower := LOWER(TRIM(COALESCE(p_query, '')));
  
  RETURN QUERY
  WITH employer_base AS (
    -- Step 1: Base employer data with computed engagement and EBA status
    SELECT 
      e.id,
      e.name,
      e.abn,
      e.employer_type,
      e.website,
      e.email,
      e.phone,
      e.estimated_worker_count,
      e.incolink_id,
      e.bci_company_id,
      e.incolink_last_matched,
      e.enterprise_agreement_status,
      
      -- Compute engagement (EXISTS is efficient)
      (
        EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id LIMIT 1)
        OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id LIMIT 1)
      ) as is_engaged,
      
      -- Compute EBA category
      CASE
        WHEN e.enterprise_agreement_status = true THEN 'active'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
          LIMIT 1
        ) THEN 'active'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
          LIMIT 1
        ) THEN 'lodged'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND (
            r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
            OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
            OR r.eba_data_form_received IS NOT NULL
          )
          LIMIT 1
        ) THEN 'pending'
        ELSE 'no'
      END as eba_category,
      
      -- For sorting by EBA recency
      COALESCE((
        SELECT MAX(GREATEST(
          EXTRACT(EPOCH FROM r.fwc_certified_date),
          EXTRACT(EPOCH FROM r.eba_lodged_fwc),
          EXTRACT(EPOCH FROM r.date_eba_signed),
          EXTRACT(EPOCH FROM r.date_vote_occurred)
        ))
        FROM company_eba_records r
        WHERE r.employer_id = e.id
      ), 0) as eba_recency_score
      
    FROM employers e
    WHERE
      -- Text search filter (applied early)
      (p_query IS NULL OR p_query = '' OR LOWER(e.name) LIKE '%' || v_query_lower || '%')
      -- Employer type filter (indexed)
      AND (p_employer_type = 'all' OR e.employer_type::text = p_employer_type)
  ),
  filtered_employers AS (
    -- Step 2: Apply engagement and EBA filters
    SELECT *
    FROM employer_base eb
    WHERE
      -- Engagement filter
      (p_engaged IS NULL OR (p_engaged AND eb.is_engaged) OR (NOT p_engaged AND NOT eb.is_engaged))
      -- EBA category filter
      AND (p_eba_category = 'all' OR eb.eba_category = p_eba_category)
  ),
  sorted_employers AS (
    -- Step 3: Sort and paginate, calculate total count via window function
    SELECT 
      *,
      COUNT(*) OVER() as total_count
    FROM filtered_employers
    ORDER BY
      -- Dynamic sorting based on parameters
      CASE WHEN p_sort = 'name' AND p_dir = 'asc' THEN name END ASC,
      CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN name END DESC,
      CASE WHEN p_sort = 'estimated' AND p_dir = 'asc' THEN estimated_worker_count END ASC NULLS LAST,
      CASE WHEN p_sort = 'estimated' AND p_dir = 'desc' THEN estimated_worker_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'eba_recency' AND p_dir = 'asc' THEN eba_recency_score END ASC,
      CASE WHEN p_sort = 'eba_recency' AND p_dir = 'desc' THEN eba_recency_score END DESC,
      name ASC  -- Secondary sort by name for stability
    LIMIT p_limit
    OFFSET p_offset
  ),
  with_relationships AS (
    -- Step 4: Aggregate relationship data as JSONB
    SELECT
      se.id,
      se.name,
      se.abn,
      se.employer_type,
      se.website,
      se.email,
      se.phone,
      se.estimated_worker_count,
      se.incolink_id,
      se.bci_company_id,
      se.incolink_last_matched,
      se.enterprise_agreement_status,
      se.is_engaged,
      se.eba_category,
      se.total_count,
      
      -- Aggregate EBA records
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'status', r.status,
            'nominal_expiry_date', r.nominal_expiry_date,
            'fwc_certified_date', r.fwc_certified_date,
            'eba_lodged_fwc', r.eba_lodged_fwc,
            'date_eba_signed', r.date_eba_signed,
            'date_vote_occurred', r.date_vote_occurred,
            'eba_data_form_received', r.eba_data_form_received,
            'date_draft_signing_sent', r.date_draft_signing_sent,
            'date_barg_docs_sent', r.date_barg_docs_sent
          )
        )
        FROM company_eba_records r
        WHERE r.employer_id = se.id
      ), '[]'::jsonb) as company_eba_records,
      
      -- Aggregate worker placements (just IDs for now)
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', wp.id))
        FROM worker_placements wp
        WHERE wp.employer_id = se.id
      ), '[]'::jsonb) as worker_placements,
      
      -- Aggregate project assignments (just IDs)
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', pa.id))
        FROM project_assignments pa
        WHERE pa.employer_id = se.id
      ), '[]'::jsonb) as project_assignments
      
    FROM sorted_employers se
  )
  -- Step 5: Optionally add enhanced data
  SELECT
    wr.id,
    wr.name,
    wr.abn,
    wr.employer_type,
    wr.website,
    wr.email,
    wr.phone,
    wr.estimated_worker_count,
    wr.incolink_id,
    wr.bci_company_id,
    wr.incolink_last_matched,
    wr.enterprise_agreement_status,
    wr.is_engaged,
    wr.eba_category,
    wr.company_eba_records,
    wr.worker_placements,
    wr.project_assignments,
    
    -- Enhanced: Projects (if requested)
    CASE WHEN p_include_enhanced THEN
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'roles', (
            SELECT jsonb_agg(DISTINCT crt.code)
            FROM project_assignments pa2
            LEFT JOIN contractor_role_types crt ON pa2.contractor_role_id = crt.id
            WHERE pa2.employer_id = wr.id 
              AND pa2.project_id = p.id
              AND pa2.assignment_type = 'contractor_role'
          ),
          'trades', (
            SELECT jsonb_agg(DISTINCT tt.code)
            FROM project_assignments pa3
            LEFT JOIN trade_types tt ON pa3.trade_type_id = tt.id
            WHERE pa3.employer_id = wr.id 
              AND pa3.project_id = p.id
              AND pa3.assignment_type = 'trade_work'
          )
        ))
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.employer_id = wr.id
      ), '[]'::jsonb)
    ELSE '[]'::jsonb
    END as projects,
    
    -- Enhanced: Organisers (if requested)
    CASE WHEN p_include_enhanced THEN
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', o.id,
          'name', o.first_name || ' ' || o.surname,
          'patch_name', pat.name
        ))
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        JOIN job_sites js ON js.project_id = p.id
        JOIN patch_job_sites pjs ON pjs.job_site_id = js.id
        JOIN patches pat ON pat.id = pjs.patch_id
        JOIN patch_organisers po ON po.patch_id = pat.id
        JOIN organisers o ON o.id = po.organiser_id
        WHERE pa.employer_id = wr.id
      ), '[]'::jsonb)
    ELSE '[]'::jsonb
    END as organisers,
    
    wr.total_count
    
  FROM with_relationships wr;
  
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_employers_optimized TO authenticated;

COMMENT ON FUNCTION search_employers_optimized IS 
  'Optimized employer search with all filtering in database. Returns JSONB for relationships.';

-- ============================================================================
-- API USAGE (TypeScript)
-- ============================================================================

/*
// In your API route:

const { data, error } = await supabase.rpc('search_employers_optimized', {
  p_query: q || null,
  p_engaged: engaged,
  p_eba_category: eba,
  p_employer_type: type,
  p_sort: sort,
  p_dir: dir,
  p_limit: pageSize,
  p_offset: (page - 1) * pageSize,
  p_include_enhanced: includeEnhanced
});

if (error) throw error;

// Total count is in each row (from window function)
const totalCount = data?.[0]?.total_count || 0;
const totalPages = Math.ceil(totalCount / pageSize);

// Transform JSONB back to arrays (already done by Supabase)
const employers = data.map(({ total_count, ...emp }) => ({
  ...emp,
  // JSONB fields are already parsed as JS arrays/objects
}));

return {
  employers,
  pagination: {
    page,
    pageSize,
    totalCount,
    totalPages
  }
};
*/
```

---

### Option 3: Hybrid Quick Win Implementation

```sql
-- ============================================================================
-- OPTION 3: HYBRID APPROACH - Quick Wins Only
-- Minimal changes for immediate improvement
-- ============================================================================

-- Step 1: Add missing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_type 
  ON employers(employer_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_abn 
  ON employers(abn) WHERE abn IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_name_pattern 
  ON employers(name text_pattern_ops);

-- Step 2: Simple engagement filter helper
CREATE OR REPLACE FUNCTION employer_is_engaged(p_employer_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM worker_placements WHERE employer_id = p_employer_id
    UNION ALL
    SELECT 1 FROM project_assignments WHERE employer_id = p_employer_id
    LIMIT 1
  );
$$ LANGUAGE sql STABLE;

-- Step 3: Simple EBA category helper
CREATE OR REPLACE FUNCTION employer_eba_category(p_employer_id uuid)
RETURNS text AS $$
  SELECT CASE
    WHEN e.enterprise_agreement_status = true THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = p_employer_id 
      AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
      LIMIT 1
    ) THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = p_employer_id 
      AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
      LIMIT 1
    ) THEN 'lodged'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = p_employer_id 
      AND (
        r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
        OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
      )
      LIMIT 1
    ) THEN 'pending'
    ELSE 'no'
  END
  FROM employers e
  WHERE e.id = p_employer_id;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- API USAGE (TypeScript)
-- ============================================================================

/*
// In API route, add WHERE clauses to filter in database instead of JS:

let query = supabase.from('employers').select(`
  id,
  name,
  abn,
  employer_type,
  ...
`, { count: 'exact' });

// Text search
if (q) {
  query = query.ilike('name', `%${q}%`);
}

// Type filter
if (type !== 'all') {
  query = query.eq('employer_type', type);
}

// ✅ NEW: Engagement filter in database using helper function
// Note: This requires PostgREST 10+ or custom RPC wrapper
// Fallback: Still filter in JS but with smaller dataset

// Fetch data
const { data, error, count } = await query.range(from, to);

// ⚠️ Still need to post-filter for engagement and EBA in JS for now
// But with proper indexes, the base query is much faster

// BETTER: Create a simple RPC that wraps the query with filters
const { data, error } = await supabase.rpc('search_employers_simple', {
  p_query: q,
  p_engaged: engaged,
  p_type: type,
  p_limit: pageSize,
  p_offset: (page - 1) * pageSize
});
*/

-- Simple wrapper RPC for hybrid approach
CREATE OR REPLACE FUNCTION search_employers_simple(
  p_query text DEFAULT NULL,
  p_engaged boolean DEFAULT NULL,
  p_type text DEFAULT 'all',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS SETOF employers AS $$
  SELECT e.*
  FROM employers e
  WHERE
    (p_query IS NULL OR LOWER(e.name) LIKE '%' || LOWER(p_query) || '%')
    AND (p_type = 'all' OR e.employer_type::text = p_type)
    AND (
      p_engaged IS NULL 
      OR (p_engaged AND employer_is_engaged(e.id))
      OR (NOT p_engaged AND NOT employer_is_engaged(e.id))
    )
  ORDER BY e.name
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION search_employers_simple TO authenticated;
```

---

### Option 4: Full-Text Search Enhancement

```sql
-- ============================================================================
-- OPTION 4: FULL-TEXT SEARCH WITH TRIGRAMS
-- Can be combined with any other option
-- ============================================================================

-- Step 1: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create GIN index for trigram search
CREATE INDEX CONCURRENTLY idx_employers_name_trgm 
  ON employers USING gin(name gin_trgm_ops);

-- Optional: Create GIN index for full-text search (more structured)
CREATE INDEX CONCURRENTLY idx_employers_name_fts
  ON employers USING gin(to_tsvector('english', name));

-- Step 3: Create search function with similarity scoring
CREATE OR REPLACE FUNCTION search_employers_fuzzy(
  p_query text,
  p_similarity_threshold real DEFAULT 0.3,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity_score real,
  match_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    GREATEST(
      similarity(e.name, p_query),
      similarity(LOWER(e.name), LOWER(p_query))
    ) as similarity_score,
    CASE
      WHEN LOWER(e.name) = LOWER(p_query) THEN 'exact'
      WHEN LOWER(e.name) LIKE LOWER(p_query) || '%' THEN 'prefix'
      WHEN LOWER(e.name) LIKE '%' || LOWER(p_query) || '%' THEN 'contains'
      ELSE 'fuzzy'
    END as match_type
  FROM employers e
  WHERE
    -- Trigram similarity search (uses index)
    e.name % p_query
    -- Or traditional LIKE search
    OR LOWER(e.name) LIKE '%' || LOWER(p_query) || '%'
    -- Or ABN search
    OR e.abn = p_query
    -- Or external IDs
    OR LOWER(e.bci_company_id) = LOWER(p_query)
    OR LOWER(e.incolink_id) = LOWER(p_query)
  ORDER BY similarity_score DESC, name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_employers_fuzzy TO authenticated;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Example 1: Fuzzy search handles typos
SELECT * FROM search_employers_fuzzy('Zenith')
-- Returns: Zenith, Zenith Construction, Zenith Holdings, ...

SELECT * FROM search_employers_fuzzy('Zeneth')  -- Typo!
-- Still returns: Zenith (similarity: 0.83), ...

-- Example 2: Combined with filters
SELECT e.*, s.similarity_score
FROM search_employers_fuzzy('const', 0.3, 1000) s
JOIN employers_search_optimized e ON e.id = s.id
WHERE e.is_engaged = true
  AND e.eba_category = 'active'
ORDER BY s.similarity_score DESC, e.name
LIMIT 100;

-- Example 3: Full-text search (alternative)
SELECT e.*, ts_rank(to_tsvector('english', e.name), query) as rank
FROM employers e,
     to_tsquery('english', 'Zenith | Construction') query
WHERE to_tsvector('english', e.name) @@ query
ORDER BY rank DESC;
*/
```

---

## Recommendation

**Primary Recommendation: Option 1 (Materialized View)**
- Implement in Phase 3 for best long-term performance
- Can handle 10,000+ employers without performance degradation
- Minimal ongoing maintenance

**Quick Win: Option 3 (Hybrid) + Option 4 (Full-Text)**
- Implement immediately for 30-40% improvement
- Low risk, fast to deploy
- Buy time for proper materialized view implementation

**Timeline:**
1. Week 1: Implement Option 3 + Option 4 (Hybrid + Full-Text)
2. Week 2-3: Implement Option 1 (Materialized View)
3. Week 4: Monitor and optimize

**Migration Path:**
```
Current State 
→ Add Indexes + Full-Text (Option 3 + 4) [30-40% faster]
→ Implement Materialized View (Option 1) [80-90% faster]
→ Remove hybrid code
→ Monitor and maintain
```


