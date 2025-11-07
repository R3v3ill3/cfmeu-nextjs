# Query Optimizer Skill

Analyze database queries for performance issues and identify optimization opportunities across the application.

## Purpose

Identify and resolve database performance bottlenecks by analyzing query patterns, detecting N+1 queries, finding missing indexes, and suggesting optimization strategies. This skill helps ensure the application scales efficiently as data grows.

## When to Use This Skill

- When experiencing slow page loads or API responses
- Before scaling to more users or data
- After adding new features that query the database
- During performance optimization sprints
- When investigating database CPU or memory issues
- Before production launch or major releases
- After receiving slow query alerts

## Analysis Scope

### 1. Query Performance Patterns

#### N+1 Query Detection
- Sequential queries in loops
- Multiple similar queries with different parameters
- Queries inside React component renders
- Queries inside .map() operations
- Missing batch loading

#### Inefficient Queries
- SELECT * when only few columns needed
- Missing WHERE clauses on large tables
- Queries without LIMIT on unbounded results
- Inefficient JOIN strategies
- Missing aggregate functions (doing aggregation in JS)

#### Missing Indexes
- WHERE clauses on unindexed columns
- ORDER BY on unindexed columns
- JOIN columns without indexes
- Foreign keys without indexes
- Full-text search without GIN indexes

### 2. Supabase-Specific Issues

#### RLS Performance
- Complex RLS policies causing slow queries
- RLS policies forcing sequential scans
- Multiple policy checks per query
- Missing indexes on RLS filter columns

#### Real-time Subscriptions
- Too many active subscriptions
- Subscriptions on large tables
- Missing filters on subscriptions
- Duplicate subscriptions

#### API Usage
- Over-fetching data from Supabase
- Not using select() to limit columns
- Missing query pagination
- Not using count() option properly

### 3. Caching Opportunities

#### Missing Caching
- Repeated identical queries
- Static data queried frequently
- Expensive aggregations without caching
- Materialized views not used

#### Stale Cache Issues
- Cache not invalidated on mutations
- Cache TTL too long or too short
- Missing cache keys for variants
- No cache warming strategy

### 4. React Query Patterns

#### Inefficient Fetching
- Missing query key dependencies
- Queries without staleTime
- Missing query prefetching
- Not using placeholderData
- Refetching too aggressively

#### Parallel vs Sequential
- Sequential queries that could be parallel
- Missing Promise.all() opportunities
- Dependent queries not using enabled option
- Waterfall query patterns

## Search Commands

Use these patterns to identify query issues:

```bash
# Find database queries in components (potential N+1)
grep -n "\.from(" --include="*.tsx" -r src/components/ | head -50

# Find queries in loops
grep -n "\.map.*\.from\|\.forEach.*\.from" --include="*.ts" --include="*.tsx" -r src/

# Find SELECT * patterns
grep -n "\.select\(\s*'\*'" --include="*.ts" --include="*.tsx" -r src/

# Find queries without LIMIT
grep -n "\.from\(.*\)\.select" --include="*.ts" --include="*.tsx" -r src/ | grep -v "limit\|range"

# Find sequential awaits (could be parallel)
grep -n "await.*\nawait" --include="*.ts" --include="*.tsx" -r src/

# Find React Query usage
grep -n "useQuery\|useMutation" --include="*.ts" --include="*.tsx" -r src/

# Find materialized views
grep -n "MATERIALIZED VIEW" -r supabase/

# Find hooks with database queries
grep -n "export.*function use.*{" --include="*.ts" -r src/hooks/
```

## Analysis Process

1. **Query Inventory**
   - Map all database queries in the application
   - Categorize by table and operation type
   - Identify query frequency and volume

2. **Performance Measurement**
   - Identify slow queries (>100ms)
   - Find queries executed most frequently
   - Calculate total time per query type

3. **Pattern Recognition**
   - Detect N+1 patterns
   - Find missing indexes
   - Identify overfetching

4. **Optimization Planning**
   - Prioritize by impact (frequency × duration)
   - Suggest specific optimizations
   - Estimate performance improvement

## Output Format

### Query Performance Analysis Report

```markdown
# Database Query Performance Analysis

## Executive Summary

**Total Queries Analyzed**: [count]
**Slow Queries Identified**: [count] (>100ms)
**N+1 Patterns Found**: [count]
**Missing Indexes**: [count]
**Estimated Performance Gain**: [percentage]%

**Priority Issues**:
- 🔴 Critical: [count] (>1000ms or very frequent)
- 🟡 High: [count] (>500ms or N+1)
- 🟢 Medium: [count] (>100ms or optimization opportunity)

---

## Critical Performance Issues

### Issue #1: N+1 Query in Dashboard Component

**Location**: `src/components/dashboard/DashboardView.tsx:145-167`

**Pattern Detected**:
```typescript
// Current implementation (N+1 query)
const { data: projects } = useQuery(['projects'], async () => {
  const { data } = await supabase.from('projects').select('*')
  return data
})

// In render
{projects?.map(project => {
  const { data: employer } = useQuery(
    ['employer', project.builder_id],
    async () => {
      const { data } = await supabase
        .from('employers')
        .select('name')
        .eq('id', project.builder_id)
        .single()
      return data
    }
  )
  return <div>{employer?.name}</div>
})}
```

**Performance Impact**:
- Query count: 1 + N (where N = number of projects)
- If 100 projects: 101 queries instead of 1
- Estimated time: 100ms × 100 = 10,000ms (10 seconds!)

**Recommended Fix**:
```typescript
// Use JOIN to get all data in one query
const { data: projectsWithEmployers } = useQuery(
  ['projects-with-employers'],
  async () => {
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        builder:employers!builder_id (
          id,
          name
        )
      `)
    return data
  }
)

// In render (no additional queries)
{projectsWithEmployers?.map(project => (
  <div key={project.id}>{project.builder?.name}</div>
))}
```

**Performance Gain**: 99% reduction in queries, ~9.9 seconds saved

**Priority**: 🔴 Critical

---

### Issue #2: Missing Index on Frequently Filtered Column

**Location**: Multiple API routes and components

**Pattern Detected**:
```sql
-- Query executed 500+ times per hour
SELECT * FROM employers
WHERE enterprise_agreement_status = true
ORDER BY name;

-- EXPLAIN shows sequential scan
Seq Scan on employers (cost=0.00..1234.56 rows=5000 width=500)
  Filter: (enterprise_agreement_status = true)
```

**Performance Impact**:
- Current: ~800ms for 10,000 employers
- With index: ~15ms (53x faster)
- Total savings: 785ms × 500 = 392 seconds per hour

**Recommended Fix**:
```sql
-- Add index on filter column
CREATE INDEX idx_employers_eba_status
ON employers (enterprise_agreement_status)
WHERE enterprise_agreement_status = true;

-- Also add composite index for common query pattern
CREATE INDEX idx_employers_eba_status_name
ON employers (enterprise_agreement_status, name)
WHERE enterprise_agreement_status = true;
```

**Performance Gain**: 98% reduction in query time

**Priority**: 🔴 Critical

---

### Issue #3: Overfetching Data (SELECT *)

**Location**: `src/hooks/useEmployers.ts:23`

**Pattern Detected**:
```typescript
// Current: Fetches all 30+ columns
const { data } = await supabase
  .from('employers')
  .select('*')
  .eq('our_role', 'subcontractor')

// Only 3 columns actually used in component
employers.map(e => ({
  id: e.id,
  name: e.name,
  ebaStatus: e.enterprise_agreement_status
}))
```

**Performance Impact**:
- Current payload: ~5 KB per employer
- Optimized payload: ~0.3 KB per employer
- For 1000 employers: 5 MB → 300 KB (94% reduction)

**Recommended Fix**:
```typescript
// Only select needed columns
const { data } = await supabase
  .from('employers')
  .select('id, name, enterprise_agreement_status')
  .eq('our_role', 'subcontractor')
```

**Performance Gain**: 94% reduction in data transfer, faster parsing

**Priority**: 🟡 High

---

## Query Optimization Recommendations

### 1. Add Missing Indexes

**Impact**: High | **Effort**: Low

```sql
-- Indexes for employer searches
CREATE INDEX idx_employers_name_trgm ON employers USING gin (name gin_trgm_ops);
CREATE INDEX idx_employers_search_vector ON employers USING gin (search_vector);

-- Indexes for project queries
CREATE INDEX idx_projects_builder_id ON projects (builder_id);
CREATE INDEX idx_projects_status ON projects (status) WHERE status != 'archived';

-- Indexes for project_assignments
CREATE INDEX idx_project_assignments_employer
ON project_assignments (employer_id, project_id);

-- Indexes for RLS performance
CREATE INDEX idx_job_sites_user_id ON job_sites (user_id);
CREATE INDEX idx_patches_organiser_id ON patches (organiser_id);
```

### 2. Optimize N+1 Patterns

**Impact**: Very High | **Effort**: Medium

**Pattern 1**: Dashboard employer loading
- Current: 1 + N queries
- Optimized: 1 query with JOIN
- Files: `DashboardView.tsx`, `ProjectList.tsx`

**Pattern 2**: Project contractors loading
- Current: 1 + N queries
- Optimized: 1 query with array aggregation
- Files: `ProjectDetail.tsx`, `ComplianceView.tsx`

**Pattern 3**: EBA status checking
- Current: N queries in loop
- Optimized: Batch query with IN clause
- Files: `BulkUploadDialog.tsx`, `EmployerBatchUpdate.tsx`

### 3. Implement Query Batching

**Impact**: High | **Effort**: Medium

Create utility for batching Supabase queries:

```typescript
// src/lib/query-batcher.ts
export async function batchQuery<T>(
  table: string,
  ids: string[],
  select: string = '*'
): Promise<T[]> {
  // Split into batches of 100 to avoid URL length limits
  const batches = chunk(ids, 100)

  const results = await Promise.all(
    batches.map(batch =>
      supabase
        .from(table)
        .select(select)
        .in('id', batch)
        .then(({ data }) => data || [])
    )
  )

  return results.flat()
}

// Usage
const employers = await batchQuery<Employer>(
  'employers',
  employerIds,
  'id, name, enterprise_agreement_status'
)
```

### 4. Leverage Materialized Views

**Impact**: Very High | **Effort**: Low (already exists)

The codebase has materialized views for search:
- `projects_quick_search`
- `employer_search_index` (recommended to add)

**Optimization**:
```sql
-- Create materialized view for employer search
CREATE MATERIALIZED VIEW employer_search_index AS
SELECT
  id,
  name,
  enterprise_agreement_status,
  our_role,
  to_tsvector('english', name) as search_vector
FROM employers
WHERE deleted_at IS NULL;

-- Create indexes on materialized view
CREATE INDEX idx_employer_search_vector
ON employer_search_index USING gin(search_vector);

CREATE UNIQUE INDEX idx_employer_search_id
ON employer_search_index (id);

-- Refresh strategy (in background worker)
REFRESH MATERIALIZED VIEW CONCURRENTLY employer_search_index;
```

**Usage**:
```typescript
// Use materialized view for searches
const { data } = await supabase
  .from('employer_search_index')
  .select('*')
  .textSearch('search_vector', query)
  .limit(50)
```

### 5. Optimize React Query Configuration

**Impact**: Medium | **Effort**: Low

```typescript
// src/lib/react-query-config.ts
export const queryClientConfig = {
  defaultOptions: {
    queries: {
      // Reduce unnecessary refetches
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes

      // Retry strategy
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      },

      // Prefetch on hover
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
}

// Implement query prefetching
export function usePrefetchEmployer() {
  const queryClient = useQueryClient()

  return (employerId: string) => {
    queryClient.prefetchQuery(
      ['employer', employerId],
      () => fetchEmployer(employerId),
      { staleTime: 5 * 60 * 1000 }
    )
  }
}

// Use in list items
function EmployerCard({ employer }) {
  const prefetch = usePrefetchEmployer()

  return (
    <div onMouseEnter={() => prefetch(employer.id)}>
      {/* Card content */}
    </div>
  )
}
```

### 6. Implement Pagination Everywhere

**Impact**: High | **Effort**: Medium

**Current Issues**:
- Several queries fetch unlimited results
- Some use `.limit(1000)` hardcoded
- No offset or cursor pagination

**Recommended Pagination Utility**:
```typescript
// src/lib/pagination.ts
export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string
}

export async function paginatedQuery<T>(
  query: any, // Supabase query builder
  { page = 1, pageSize = 50 }: PaginationParams
) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await query
    .range(from, to)
    .count('exact')

  if (error) throw error

  return {
    data: data as T[],
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      hasNext: to < (count || 0) - 1,
      hasPrev: page > 1
    }
  }
}

// Usage
const result = await paginatedQuery<Employer>(
  supabase.from('employers').select('*', { count: 'exact' }),
  { page: 1, pageSize: 50 }
)
```

---

## Parallel Query Opportunities

### Current Sequential Pattern
```typescript
// Takes 300ms + 200ms + 150ms = 650ms total
const employers = await fetchEmployers()  // 300ms
const projects = await fetchProjects()    // 200ms
const stats = await fetchStats()          // 150ms
```

### Optimized Parallel Pattern
```typescript
// Takes max(300ms, 200ms, 150ms) = 300ms total (54% faster)
const [employers, projects, stats] = await Promise.all([
  fetchEmployers(),   // 300ms
  fetchProjects(),    // 200ms
  fetchStats()        // 150ms
])
```

**Files with Sequential Query Opportunities**:
1. `src/app/(app)/dashboard/page.tsx:45-67` - Dashboard data loading
2. `src/components/employers/EmployerDetail.tsx:89-112` - Detail page loading
3. `src/hooks/useDashboardData.ts:34-78` - Dashboard hook
4. `src/app/api/analytics/overview/route.ts:23-56` - Analytics API

---

## Performance Monitoring Recommendations

### 1. Add Query Performance Logging

```typescript
// src/lib/supabase/client.ts
const supabaseWithLogging = createClient(url, key)

// Wrap queries with performance monitoring
export async function monitoredQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - start

    if (duration > 100) {
      console.warn(`[Slow Query] ${queryName} took ${duration.toFixed(2)}ms`)

      // Log to monitoring service
      // logSlowQuery({ name: queryName, duration, timestamp: new Date() })
    }

    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[Query Error] ${queryName} failed after ${duration.toFixed(2)}ms`, error)
    throw error
  }
}
```

### 2. Database Query Analysis

```sql
-- Enable query logging in Supabase dashboard
-- Or use pg_stat_statements extension

-- Find slowest queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Find most frequent queries
SELECT
  query,
  calls,
  total_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
ORDER BY abs(correlation) ASC;
```

## Implementation Priority

### Week 1: Quick Wins
- [ ] Add missing indexes (highest impact, lowest effort)
- [ ] Fix SELECT * to select only needed columns
- [ ] Add LIMIT to unbounded queries
- [ ] Implement query batching utility

### Week 2: N+1 Fixes
- [ ] Fix dashboard N+1 queries with JOINs
- [ ] Fix project detail N+1 queries
- [ ] Fix bulk upload N+1 queries
- [ ] Add query batching to remaining loops

### Week 3: Parallelization
- [ ] Convert sequential queries to Promise.all
- [ ] Implement query prefetching
- [ ] Optimize React Query configuration
- [ ] Add pagination utilities

### Week 4: Advanced Optimization
- [ ] Create/refresh materialized views
- [ ] Implement cache warming strategy
- [ ] Add query performance monitoring
- [ ] Optimize RLS policies

## Expected Performance Improvements

| Optimization | Estimated Gain | Effort |
|-------------|----------------|--------|
| Add indexes | 50-90% faster | Low |
| Fix N+1 queries | 80-95% faster | Medium |
| Parallel queries | 40-60% faster | Low |
| Remove SELECT * | 20-40% faster | Low |
| Materialized views | 60-80% faster | Low |
| Query batching | 70-90% faster | Medium |

**Overall Expected Improvement**: 3-5x faster page loads, 10x reduction in database load

## Special Considerations for This Codebase

### Supabase-Specific
- Use RLS policies efficiently (indexed columns)
- Leverage generated TypeScript types
- Use select() to limit columns
- Implement proper error handling for Supabase errors

### React Query Best Practices
- Use proper query keys with dependencies
- Implement optimistic updates for mutations
- Prefetch data on hover or navigation
- Use placeholderData for instant UX

### Mobile Optimization
- Reduce payload sizes (critical for mobile networks)
- Implement infinite scroll instead of pagination
- Use optimistic UI for instant feedback
- Cache aggressively with service workers

## Next Steps

After receiving this report:

1. **Validate Findings**: Test slow queries in production
2. **Prioritize**: Focus on highest impact optimizations first
3. **Implement**: Add indexes and fix N+1 queries
4. **Measure**: Track performance improvements
5. **Monitor**: Set up ongoing query performance monitoring
6. **Document**: Create query optimization guidelines

## Example Invocation

**User**: "Run query-optimizer on the dashboard components"

**You should**:
1. Scan `src/components/dashboard/**/*.tsx`
2. Find all database queries
3. Analyze query patterns (N+1, overfetching, etc.)
4. Check for missing indexes
5. Identify parallelization opportunities
6. Provide specific optimization recommendations with code examples
7. Estimate performance improvements
8. Offer to implement the optimizations
