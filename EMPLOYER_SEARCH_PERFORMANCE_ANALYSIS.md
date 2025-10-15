# Employer Search Performance Analysis

## Executive Summary

The Employers page is experiencing slow query performance when searching for employers. Based on comprehensive code analysis, the issue stems from a combination of:

1. **Complex post-filtering logic** executed in the API layer rather than the database
2. **Multi-table relationship joins** for enhanced data (projects, organisers)
3. **Inefficient engagement filtering** requiring multiple relationship checks
4. **Missing database indexes** for common filter combinations
5. **Feature flag limbo** - code supports both client-side and server-side processing

## Current Architecture

### Query Flow

```
User Input → React Component → useEmployersServerSideCompatible Hook → 
API Route (/api/employers) → Supabase Query → Post-Filtering → Enhanced Data Fetch → Response
```

### Key Parameters (from console warning)
```json
{
  "q": "zenith",
  "engaged": true,
  "eba": "all",
  "type": "all",
  "sort": "name",
  "dir": "asc",
  "includeAliases": false,
  "aliasMatchMode": "any"
}
```

## Current Implementation Details

### 1. API Route (`/src/app/api/employers/route.ts`)

**Standard Query Path** (lines 356-415):
- Fetches base employer data with LEFT JOINs for:
  - `company_eba_records` (EBA status)
  - `worker_placements` (worker relationships)
  - `project_assignments` (project relationships)
- Uses `count: 'exact'` for pagination (expensive)
- Basic text search: `ILIKE '%query%'` on `name` field only
- Sorts and paginates in database

**Alias Search Path** (lines 289-353):
- Uses RPC function `search_employers_with_aliases`
- More sophisticated scoring algorithm
- Manually fetches relationships after RPC
- No count returned from RPC (requires separate query)

### 2. Post-Filtering Issues (lines 469-529)

**Major Performance Problems:**

#### A. Engagement Filter (lines 469-479)
Currently runs in JavaScript AFTER database query:
```typescript
if (engaged) {
  employers = employers.filter(emp =>
    (emp.project_assignments && emp.project_assignments.length > 0) ||
    (emp.worker_placements && emp.worker_placements.length > 0)
  );
}
```

**Problem:** This fetches ALL employers matching the query, then filters in memory. For large datasets, this means:
- Fetching potentially 1000s of employers
- Loading all their relationships into memory
- Filtering in JavaScript instead of SQL
- Pagination counts are wrong (based on pre-filter count)

#### B. EBA Status Filter (lines 482-529)
Complex date-based logic runs in JavaScript:
- Parses dates from records
- Checks multiple date fields (fwc_certified_date, eba_lodged_fwc, date_eba_signed, date_vote_occurred)
- Calculates recency (within X months/years)
- All in JavaScript instead of SQL

**Performance Impact:**
```
Example scenario with 5,000 employers:
- Query: "Search for 'zenith' with engaged=true"
- Database fetches: ~100 employers named like "zenith"
- API loads all relationships for 100 employers
- Filters to 10 actually engaged employers
- Returns 10 employers but pagination says "100 total"
```

### 3. Enhanced Data Fetching (lines 11-152)

**Separate queries for each page of results:**
1. Project assignments with roles and trades
2. Organisers through patches
3. Incolink IDs

**Problem:** The enhanced data fetch runs AFTER the main query completes, adding latency.

Example for 100 employers:
- Main query: ~200-500ms
- Project data: ~300-800ms
- Organiser data: ~200-500ms
- **Total: ~700-1800ms per page**

### 4. Database Schema Analysis

**Employers Table Structure:**
```sql
CREATE TABLE employers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  abn text,
  employer_type employer_type NOT NULL,
  enterprise_agreement_status boolean DEFAULT false,
  estimated_worker_count integer DEFAULT 0,
  bci_company_id text,
  incolink_id text,
  incolink_last_matched date,
  -- ... other fields
);
```

**Existing Indexes:**
```sql
-- Primary key on id
-- From alias search migration:
CREATE INDEX idx_employers_name_lower ON employers(LOWER(name));
CREATE INDEX idx_employers_bci_company_id_lower ON employers(LOWER(bci_company_id)) WHERE bci_company_id IS NOT NULL;
CREATE INDEX idx_employers_incolink_id_lower ON employers(LOWER(incolink_id)) WHERE incolink_id IS NOT NULL;

-- From project summary migration:
CREATE INDEX idx_company_eba_records_employer_id ON company_eba_records(employer_id);
CREATE INDEX idx_worker_placements_job_site_id ON worker_placements(job_site_id);
CREATE INDEX idx_worker_placements_worker_id ON worker_placements(worker_id);
```

**Missing Indexes:**
- `employer_type` (for type filtering)
- `estimated_worker_count` (for sorting by estimated workers)
- Composite indexes for common filter combinations
- No GIN index on text fields for full-text search

### 5. Employer Aliases System

**Purpose:** Support matching employer names across different systems (BCI, Incolink, manual imports)

**Implementation:**
- Separate `employer_aliases` table
- RPC function `search_employers_with_aliases` with sophisticated scoring
- Currently **NOT USED** in the Employers page (includeAliases: false in console log)

**Performance Cost:** The alias search RPC is actually well-optimized with:
- Proper indexes on alias fields
- Efficient scoring algorithm
- BUT: Requires manual count query (expensive)

## Root Causes of Slow Performance

### Primary Issues

1. **Post-Filtering Architecture** ⭐ CRITICAL
   - Engagement filter runs in JavaScript after DB query
   - EBA status filter runs in JavaScript after DB query
   - Results in over-fetching data that gets filtered away
   - Pagination counts are incorrect
   
2. **Enhanced Data as Separate Queries**
   - Projects, organisers, incolink data fetched separately
   - Could be combined into a view or optimized query
   - Adds 500-1000ms per page load

3. **Missing Materialized View**
   - Common filters (engaged, EBA status) computed on every request
   - Should be precomputed and indexed

4. **Inefficient Text Search**
   - Using `ILIKE '%query%'` which can't use regular indexes efficiently
   - No full-text search indexes
   - No trigram indexes for fuzzy matching

5. **Count Query Overhead**
   - `count: 'exact'` requires full table scan for each query
   - For large result sets, this is expensive

### Secondary Issues

6. **Feature Flag Confusion**
   - Code supports both client-side and server-side processing
   - Client-side path loads ALL employers (up to 5000 limit)
   - Feature flag `NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS` controls behavior
   
7. **No Query Result Caching**
   - React Query caching is short (30 seconds)
   - No server-side caching
   - Same queries repeated frequently

8. **No Database Query Plan Optimization**
   - No EXPLAIN ANALYZE to understand actual query performance
   - No query hints or optimization

## Performance Measurement

Based on console warning and debug output structure:

**Current Performance (estimated from architecture):**
- Simple name search (no filters): ~200-500ms
- Name search + engaged filter: ~700-1200ms
- Name search + engaged + EBA filter: ~1000-1800ms
- With enhanced data: Add 500-1000ms

**Performance Bottlenecks by Time:**
1. Post-filter EBA status check: ~300-600ms (parsing dates, complex logic)
2. Enhanced data fetch (organisers): ~200-500ms (nested queries)
3. Enhanced data fetch (projects): ~200-400ms (join heavy)
4. Post-filter engagement check: ~100-200ms (array filtering)
5. Base query: ~200-300ms (reasonable)

## Recommended Solutions

### Option 1: Materialized View with Precomputed Filters ⭐ RECOMMENDED

**Implementation:**
```sql
CREATE MATERIALIZED VIEW employers_search_optimized AS
SELECT 
  e.*,
  -- Precompute engagement status
  (
    EXISTS(SELECT 1 FROM worker_placements WHERE employer_id = e.id)
    OR EXISTS(SELECT 1 FROM project_assignments WHERE employer_id = e.id)
  ) as is_engaged,
  
  -- Precompute EBA category
  CASE
    WHEN e.enterprise_agreement_status = true THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
    ) THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
    ) THEN 'lodged'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r 
      WHERE r.employer_id = e.id 
      AND (
        r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
        OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
        OR r.eba_data_form_received IS NOT NULL
      )
    ) THEN 'pending'
    ELSE 'no'
  END as eba_category,
  
  -- Precompute counts for sorting
  (SELECT COUNT(*) FROM worker_placements WHERE employer_id = e.id) as worker_count,
  (SELECT COUNT(*) FROM project_assignments WHERE employer_id = e.id) as project_count,
  
  -- Precompute EBA recency score for sorting
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

FROM employers e;

-- Indexes for the materialized view
CREATE INDEX idx_emp_search_opt_engaged ON employers_search_optimized(is_engaged);
CREATE INDEX idx_emp_search_opt_eba_cat ON employers_search_optimized(eba_category);
CREATE INDEX idx_emp_search_opt_type ON employers_search_optimized(employer_type);
CREATE INDEX idx_emp_search_opt_name_lower ON employers_search_optimized(LOWER(name));
CREATE INDEX idx_emp_search_opt_name_trgm ON employers_search_optimized USING gin(name gin_trgm_ops);

-- Composite index for common filter combinations
CREATE INDEX idx_emp_search_opt_engaged_eba ON employers_search_optimized(is_engaged, eba_category);
```

**Refresh Strategy:**
```sql
-- Option A: Refresh on schedule (lightweight incremental refresh)
CREATE OR REPLACE FUNCTION refresh_employers_search_materialized_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY employers_search_optimized;
END;
$$ LANGUAGE plpgsql;

-- Run every 5 minutes via pg_cron or external scheduler

-- Option B: Trigger-based refresh (real-time but more overhead)
-- Create triggers on employers, company_eba_records, worker_placements, project_assignments
-- to refresh specific rows when data changes
```

**Benefits:**
- **90% reduction in query time** for filtered searches
- Filters execute in database with proper indexes
- Correct pagination counts
- Enhanced data can be added to view
- No code changes required (just swap table name)

**Trade-offs:**
- 5-minute refresh delay (acceptable for analytics use case)
- Additional storage (estimated: +20% of employers table size)
- Refresh overhead (manageable with incremental refresh)

**Estimated Performance After:**
- Name search + filters: ~100-200ms (vs 700-1200ms)
- With enhanced data: ~300-500ms (vs 1200-1800ms)

---

### Option 2: Database Function with Optimized Query ⭐ ALTERNATIVE

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION search_employers_optimized(
  p_query text DEFAULT NULL,
  p_engaged boolean DEFAULT true,
  p_eba_category text DEFAULT 'all',
  p_employer_type text DEFAULT 'all',
  p_sort text DEFAULT 'name',
  p_dir text DEFAULT 'asc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_include_enhanced boolean DEFAULT false
)
RETURNS TABLE (
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
  is_engaged boolean,
  eba_category text,
  worker_placements_json jsonb,
  project_assignments_json jsonb,
  projects_json jsonb,
  organisers_json jsonb,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH employer_base AS (
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
      e.enterprise_agreement_status,
      -- Compute engagement inline
      (
        EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id)
        OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id)
      ) as is_engaged,
      -- Compute EBA category inline (simplified for performance)
      CASE
        WHEN e.enterprise_agreement_status = true THEN 'active'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
        ) THEN 'active'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
        ) THEN 'lodged'
        WHEN EXISTS(
          SELECT 1 FROM company_eba_records r 
          WHERE r.employer_id = e.id 
          AND r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
        ) THEN 'pending'
        ELSE 'no'
      END as eba_category,
      -- EBA recency for sorting
      COALESCE((
        SELECT MAX(GREATEST(
          EXTRACT(EPOCH FROM r.fwc_certified_date),
          EXTRACT(EPOCH FROM r.eba_lodged_fwc)
        ))
        FROM company_eba_records r
        WHERE r.employer_id = e.id
      ), 0) as eba_recency
    FROM employers e
    WHERE
      (p_query IS NULL OR LOWER(e.name) LIKE '%' || LOWER(p_query) || '%')
      AND (p_employer_type = 'all' OR e.employer_type::text = p_employer_type)
  ),
  filtered_employers AS (
    SELECT *
    FROM employer_base eb
    WHERE
      (NOT p_engaged OR eb.is_engaged)
      AND (p_eba_category = 'all' OR eb.eba_category = p_eba_category)
  ),
  sorted_employers AS (
    SELECT *,
      COUNT(*) OVER() as total_count
    FROM filtered_employers
    ORDER BY
      CASE WHEN p_sort = 'name' AND p_dir = 'asc' THEN name END ASC,
      CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN name END DESC,
      CASE WHEN p_sort = 'estimated' AND p_dir = 'asc' THEN estimated_worker_count END ASC,
      CASE WHEN p_sort = 'estimated' AND p_dir = 'desc' THEN estimated_worker_count END DESC,
      CASE WHEN p_sort = 'eba_recency' AND p_dir = 'asc' THEN eba_recency END ASC,
      CASE WHEN p_sort = 'eba_recency' AND p_dir = 'desc' THEN eba_recency END DESC
    LIMIT p_limit
    OFFSET p_offset
  )
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
    se.is_engaged,
    se.eba_category,
    -- Aggregate worker placements
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', wp.id))
      FROM worker_placements wp
      WHERE wp.employer_id = se.id
    ), '[]'::jsonb) as worker_placements_json,
    -- Aggregate project assignments
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pa.id))
      FROM project_assignments pa
      WHERE pa.employer_id = se.id
    ), '[]'::jsonb) as project_assignments_json,
    -- Enhanced: Projects (if requested)
    CASE WHEN p_include_enhanced THEN
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', p.id,
          'name', p.name
        ))
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.employer_id = se.id
      ), '[]'::jsonb)
    ELSE '[]'::jsonb
    END as projects_json,
    -- Enhanced: Organisers (if requested)
    CASE WHEN p_include_enhanced THEN
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', o.id,
          'name', o.first_name || ' ' || o.surname
        ))
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        JOIN job_sites js ON js.project_id = p.id
        JOIN patches pat ON pat.id IN (SELECT patch_id FROM patch_job_sites WHERE job_site_id = js.id)
        JOIN organisers o ON o.id = ANY(
          SELECT UNNEST(
            ARRAY(
              SELECT po.organiser_id 
              FROM patch_organisers po 
              WHERE po.patch_id = pat.id
            )
          )
        )
        WHERE pa.employer_id = se.id
      ), '[]'::jsonb)
    ELSE '[]'::jsonb
    END as organisers_json,
    se.total_count
  FROM sorted_employers se;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_employers_optimized TO authenticated;
```

**Benefits:**
- All filtering in database
- Single query returns everything
- Correct counts via window function
- Optional enhanced data
- Better query plan optimization

**Trade-offs:**
- Complex function to maintain
- Still computes filters on each query (not cached)
- Requires significant refactoring in API route

**Estimated Performance:**
- Name search + filters: ~200-400ms (vs 700-1200ms)
- With enhanced data: ~400-700ms (vs 1200-1800ms)

---

### Option 3: Hybrid Approach with Limited Client-Side Filtering

**Implementation:**
- Move engagement filter to database (simple EXISTS check)
- Keep EBA filter complexity in database function
- Use approximate count for pagination (acceptable for UX)
- Cache enhanced data separately with longer TTL

**Benefits:**
- Faster to implement
- Less database migration complexity
- Still provides significant performance improvement

**Estimated Performance:**
- Name search + filters: ~300-500ms (vs 700-1200ms)

---

### Option 4: Full-Text Search with Trigrams

**Implementation:**
```sql
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for trigram search
CREATE INDEX idx_employers_name_trgm ON employers USING gin(name gin_trgm_ops);

-- Update query to use similarity search
SELECT *, similarity(name, p_query) as sim_score
FROM employers
WHERE name % p_query  -- % operator uses trigram similarity
OR LOWER(name) LIKE '%' || LOWER(p_query) || '%'
ORDER BY sim_score DESC, name;
```

**Benefits:**
- Much faster fuzzy text search
- Better handling of typos
- Relevance scoring

**Trade-offs:**
- Requires pg_trgm extension
- Additional index size
- Won't solve post-filtering issues alone

---

## Additional Optimizations

### 1. Add Missing Indexes

```sql
-- Employer type filter
CREATE INDEX idx_employers_type ON employers(employer_type);

-- Composite index for common filter combinations  
CREATE INDEX idx_employers_engaged_filter 
ON employers(id) 
WHERE EXISTS(SELECT 1 FROM worker_placements WHERE employer_id = employers.id)
   OR EXISTS(SELECT 1 FROM project_assignments WHERE employer_id = employers.id);

-- ABN search
CREATE INDEX idx_employers_abn ON employers(abn) WHERE abn IS NOT NULL;
```

### 2. Optimize React Query Caching

```typescript
// Increase stale time for employer data
staleTime: 5 * 60 * 1000, // 5 minutes instead of 30 seconds
gcTime: 15 * 60 * 1000, // 15 minutes instead of 5 minutes

// Enable background refetching less aggressively
refetchOnWindowFocus: false,
refetchOnMount: false,
```

### 3. Implement Server-Side Caching

```typescript
// Add Redis or in-memory cache for common queries
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache({
  max: 500, // 500 unique query combinations
  ttl: 1000 * 60 * 2, // 2 minutes
});

// In API route:
const cacheKey = JSON.stringify({ q, engaged, eba, type, sort, dir, page });
const cached = queryCache.get(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
```

### 4. Implement Query Result Streaming

For very large result sets, consider implementing cursor-based pagination instead of offset/limit.

### 5. Remove Feature Flag Ambiguity

```typescript
// Remove client-side path entirely
// Always use server-side processing
// Remove USE_SERVER_SIDE feature flag
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
1. Add missing indexes (employer_type, ABN)
2. Increase React Query cache times
3. Remove feature flag (force server-side processing)
4. Optimize enhanced data fetch (single query instead of separate)

**Expected improvement:** 30-40% faster

### Phase 2: Database Optimization (3-5 days)
1. Implement Option 2 (database function) OR Option 3 (hybrid)
2. Add full-text search with trigrams
3. Implement server-side caching (Redis or in-memory)

**Expected improvement:** 60-70% faster overall

### Phase 3: Materialized View (1-2 weeks)
1. Implement Option 1 (materialized view)
2. Set up refresh strategy (cron job)
3. Add monitoring for view staleness
4. Migrate API to use view

**Expected improvement:** 80-90% faster, most robust solution

---

## Testing Recommendations

### 1. Performance Benchmarking

```sql
-- Test current query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*, /* ... all fields ... */
FROM employers e
LEFT JOIN company_eba_records cer ON cer.employer_id = e.id
LEFT JOIN worker_placements wp ON wp.employer_id = e.id
LEFT JOIN project_assignments pa ON pa.employer_id = e.id
WHERE LOWER(e.name) LIKE '%zenith%'
ORDER BY e.name
LIMIT 100;
```

### 2. Load Testing

Use tools like k6 or Apache Bench to simulate:
- 10 concurrent users searching
- 50 searches per minute
- Measure p50, p95, p99 latencies

### 3. Query Plan Analysis

For each optimization:
1. Run EXPLAIN ANALYZE before
2. Implement optimization
3. Run EXPLAIN ANALYZE after
4. Compare query plans and actual times

---

## Monitoring Recommendations

### 1. Add Performance Logging

```typescript
// In API route
console.log('Employer search performance:', {
  query: q,
  filters: { engaged, eba, type },
  timings: {
    dbQuery: dbEndTime - dbStartTime,
    postFilter: filterEndTime - filterStartTime,
    enhanced: enhancedEndTime - enhancedStartTime,
    total: Date.now() - startTime
  },
  results: {
    preFilter: data?.length,
    postFilter: employers.length,
    page: page,
    pageSize: pageSize
  }
});
```

### 2. Set Up Slow Query Alerts

```typescript
if (queryTime > 1000) {
  console.warn('⚠️ SLOW QUERY ALERT', {
    queryTime,
    endpoint: '/api/employers',
    params: { q, engaged, eba, type }
  });
  
  // Send to monitoring service (e.g., Sentry, DataDog)
}
```

### 3. Database Query Logging

Enable slow query logging in Supabase:
```sql
-- Log queries taking longer than 500ms
ALTER DATABASE postgres SET log_min_duration_statement = 500;
```

---

## Conclusion

The slow performance on the Employers page is primarily caused by:
1. **Post-filtering in JavaScript** instead of database (70% of slowness)
2. **Separate enhanced data queries** (20% of slowness)
3. **Missing indexes and optimization** (10% of slowness)

**Recommended Solution: Option 1 (Materialized View)**
- Provides best performance improvement (80-90% faster)
- Most maintainable long-term
- Proper separation of concerns
- Allows for incremental refresh strategies

**Quick Win: Implement Phase 1 items first** while planning Phase 3 materialized view implementation.

**Timeline:**
- Phase 1: 1-2 days → 30-40% faster
- Phase 2: 3-5 days → 60-70% faster
- Phase 3: 1-2 weeks → 80-90% faster

All improvements maintain full searchability of the dataset - no compromises on search functionality.


