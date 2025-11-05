# Employer Search Function Analysis - Subcontractors Review Tab

## Current Implementation Analysis

### Data Loading (SubcontractorsReview.tsx, lines 151-181)

**Location**: `src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`

**How it works**:
1. Uses React Query to fetch ALL employers from the database
2. Paginates through employers in batches of 1000
3. Orders by `name` alphabetically in the database query
4. Caches results for 5 minutes
5. Only selects: `id, name, enterprise_agreement_status`

**Query Structure**:
```typescript
const { data: allEmployers = [] } = useQuery({
  queryKey: ['employers-all'],
  queryFn: async () => {
    let allData: any[] = []
    let from = 0
    const pageSize = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, enterprise_agreement_status')
        .order('name')  // ← Alphabetical ordering
        .range(from, from + pageSize - 1)
      
      // ... pagination logic
      allData = allData.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    
    return allData
  },
  staleTime: 5 * 60 * 1000
})
```

**Status**: ✅ **CORRECT** - This should load ALL employers from the database

---

### Search Functionality (EmployerMatchDialog.tsx, lines 53-107)

**Location**: `src/components/projects/mapping/scan-review/EmployerMatchDialog.tsx`

**How it works**:
1. Takes `allEmployers` array as input
2. Client-side filtering (no server-side search)
3. Filters based on query matching
4. Sorts by relevance
5. Limits to first 200 results

**Search Filtering Logic** (lines 60-87):
```typescript
const matches = allEmployers
  .filter(emp => {
    const name = emp.name.toLowerCase()
    const query = searchQuery.toLowerCase()
    
    // 1. Exact match
    if (name === query) return true
    
    // 2. Contains query (e.g., "Australia" contains "oz")
    if (name.includes(query)) return true
    
    // 3. Query contains name (e.g., "formwork" matches "form")
    if (query.includes(name)) return true
    
    // 4. Word-based matching (e.g., "Superior Formwork" matches "form")
    const nameWords = name.split(/\s+/)
    const queryWords = query.split(/\s+/)
    
    for (const nameWord of nameWords) {
      for (const queryWord of queryWords) {
        if (nameWord.startsWith(queryWord) || queryWord.startsWith(nameWord)) {
          return true
        }
      }
    }
    
    return false
  })
```

**Sorting Logic** (lines 88-103):
```typescript
.sort((a, b) => {
  const aName = a.name.toLowerCase()
  const bName = b.name.toLowerCase()
  
  // 1. Exact matches first
  if (aName === query && bName !== query) return -1
  if (bName === query && aName !== query) return 1
  
  // 2. Then "starts with" matches
  if (aName.startsWith(query) && !bName.startsWith(query)) return -1
  if (bName.startsWith(query) && !aName.startsWith(query)) return 1
  
  // 3. Then alphabetical (⚠️ THIS IS THE PROBLEM)
  return aName.localeCompare(bName)
})
.slice(0, 200)  // Limit to 200 results
```

---

## The Problem

### Issue Identified

When searching for broad terms like "oz" or "alt", the search results are limited because:

1. **Alphabetical Sorting**: After filtering all matches, results are sorted alphabetically for non-exact/non-starts-with matches
2. **200 Result Limit**: Only the first 200 results are shown
3. **Result Distribution**: If there are many matches, and they're sorted alphabetically, you might only see employers starting with A and B before hitting the 200 limit

### Example Scenario

**Search Query**: "oz"

**Potential Matches** (if there are 500 total):
- "A Oz Construction" (contains "oz", starts with A)
- "A & B Oz Builders" (contains "oz", starts with A)
- "Alt Oz Company" (contains "oz", starts with A)
- ... (50 more starting with A)
- "B Oz Builders" (contains "oz", starts with B)
- ... (50 more starting with B)
- "Oz Building Company" (starts with "oz" - should be first)
- "Z Oz Construction" (contains "oz", starts with Z - might not appear)

**What User Sees**:
- "Oz Building Company" (correctly prioritized)
- ~199 other results, mostly starting with A and B
- Employers starting with C-Z that contain "oz" are cut off

### Root Cause

The alphabetical sorting in step 3 of the sort logic means that when there are many matches, the results are heavily biased towards employers whose names start with letters near the beginning of the alphabet, even if they're less relevant matches.

---

## Additional Issues

### 1. No Position-Based Relevance
The search doesn't consider WHERE in the name the match occurs:
- "Oz Building" (match at start) should rank higher than
- "A Oz Construction" (match in middle)

### 2. No Word Boundary Matching
The search doesn't prioritize word boundaries:
- "Alt Construction" (complete word) should rank higher than
- "Alternative Builders" (partial match in "Alternative")

### 3. No Frequency-Based Scoring
The search doesn't consider how many times the query appears or how "close" the match is.

---

## Recommended Solutions

### Option 1: Improve Sorting Algorithm (Recommended)
Add position-based and word-boundary scoring to prioritize better matches:

```typescript
.sort((a, b) => {
  const aName = a.name.toLowerCase()
  const bName = b.name.toLowerCase()
  
  // Calculate relevance scores
  const aScore = calculateRelevanceScore(aName, query)
  const bScore = calculateRelevanceScore(bName, query)
  
  // Sort by score (higher is better)
  return bScore - aScore
})

function calculateRelevanceScore(name: string, query: string): number {
  let score = 0
  
  // Exact match: 1000 points
  if (name === query) return 1000
  
  // Starts with: 500 points
  if (name.startsWith(query)) score += 500
  
  // Word boundary match: 300 points
  const wordBoundaryRegex = new RegExp(`\\b${query}`, 'i')
  if (wordBoundaryRegex.test(name)) score += 300
  
  // Contains: 100 points
  if (name.includes(query)) score += 100
  
  // Position bonus: earlier matches are better
  const position = name.indexOf(query)
  if (position >= 0) {
    score += Math.max(0, 50 - position)
  }
  
  return score
}
```

### Option 2: Increase Result Limit
Increase from 200 to 500 or 1000 results, but this doesn't solve the fundamental sorting issue.

### Option 3: Server-Side Search
Move search to server-side using PostgreSQL full-text search or a search service, which would provide better relevance ranking.

### Option 4: Virtual Scrolling
Implement virtual scrolling to show all results without performance issues.

---

## Testing Recommendations

1. **Test with broad search terms**:
   - Search "oz" - should see employers containing "oz" at any position
   - Search "alt" - should see employers containing "alt" at any position
   - Search "con" - should see all construction-related employers

2. **Verify result distribution**:
   - Check that results aren't limited to A-B
   - Verify employers starting with Z are also shown if they match

3. **Check relevance**:
   - Employers starting with the query should appear first
   - Exact matches should appear before partial matches

---

## Current Status

- ✅ Data loading works correctly (loads all employers)
- ✅ Search filtering works correctly (finds all matches)
- ❌ Sorting algorithm biased towards alphabetical order
- ❌ 200 result limit may cut off relevant matches
- ❌ No position-based or word-boundary relevance scoring

**Conclusion**: The search function correctly finds all matching employers, but the sorting algorithm and result limit cause users to only see employers starting with A-B when searching for broad terms.

