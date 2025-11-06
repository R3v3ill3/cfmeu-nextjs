# Type Auditor Skill

Comprehensively audit TypeScript code for type safety issues and provide a roadmap to improve type coverage.

## Purpose

Improve type safety across the codebase by identifying weak typing, unsafe patterns, and opportunities to leverage TypeScript's type system. This skill helps migrate from permissive typing toward strict TypeScript configuration.

## When to Use This Skill

- Before enabling strict mode in tsconfig.json
- During code quality improvement sprints
- When preparing for major refactoring
- After TypeScript version upgrades
- When reducing technical debt
- Before adding new type-dependent features

## Analysis Scope

### 1. Type Weakness Patterns

#### Any Type Usage
- Explicit `any` declarations
- Implicit `any` from missing annotations
- `any` in function parameters
- `any` in return types
- `any` in type assertions
- `any[]` array types

#### Type Assertions (as/!)
- Type assertions using `as` keyword
- Non-null assertions using `!` operator
- Double assertions (`as unknown as T`)
- Assertions without validation
- Downcasting to narrower types

#### Unknown and Never
- `unknown` without proper type guards
- Incorrect `never` usage
- Functions that should return `never` but don't

### 2. Missing Type Annotations

- Functions without return types
- Function parameters without types
- Class properties without types
- Callbacks without type signatures
- Generic constraints missing
- Event handlers with `any` events

### 3. Type Definition Quality

- Interfaces vs types (consistency)
- Missing readonly modifiers
- Optional vs undefined inconsistency
- Union types that should be discriminated
- Overly broad types (string when literal types better)
- Missing generic constraints

### 4. Type Safety Violations

- Unsafe type guards
- Type narrowing without runtime checks
- Accessing properties without checking existence
- Array access without bounds checking
- Object property access without checking
- Parsing JSON without validation

### 5. Database Types

- Supabase generated types usage
- Manual types that duplicate generated types
- Inconsistent column name typing
- Missing null checks for nullable columns
- Type mismatches between DB and app

## Search Commands

Use these patterns to identify type issues:

```bash
# Find all 'any' types
grep -n ":\s*any\b" --include="*.ts" --include="*.tsx" -r src/ | wc -l

# Find type assertions
grep -n " as " --include="*.ts" --include="*.tsx" -r src/ | wc -l

# Find non-null assertions
grep -n "!\." --include="*.ts" --include="*.tsx" -r src/ | wc -l

# Find implicit any in parameters
grep -n "function.*([^)]*[^:)]\)" --include="*.ts" --include="*.tsx" -r src/

# Find @ts-ignore and @ts-expect-error
grep -n "@ts-ignore\|@ts-expect-error" --include="*.ts" --include="*.tsx" -r src/

# Find unsafe array access
grep -n "\[[0-9]\]" --include="*.ts" --include="*.tsx" -r src/

# Find object property access without optional chaining
grep -n "\.[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_]" --include="*.ts" --include="*.tsx" -r src/
```

## Analysis Process

1. **Quantitative Analysis**
   - Count files analyzed
   - Count `any` occurrences
   - Count type assertions
   - Count `@ts-ignore` comments
   - Calculate type safety score

2. **Qualitative Analysis**
   - Identify most problematic files
   - Find patterns of weak typing
   - Locate critical paths with weak types
   - Identify shared utilities needing better types

3. **Impact Assessment**
   - High-impact: API boundaries, database queries
   - Medium-impact: Component props, business logic
   - Low-impact: Internal helper functions, constants

4. **Migration Planning**
   - Group related type improvements
   - Suggest incremental migration path
   - Identify breaking changes
   - Recommend tooling (ts-migrate, etc.)

## Output Format

### Type Safety Report

```markdown
# Type Safety Audit Report

## Executive Summary

**Type Safety Score**: [0-100]%
- Files with perfect types: [count] ([percentage]%)
- Files with some issues: [count] ([percentage]%)
- Files with critical issues: [count] ([percentage]%)

**Total Issues**: [number]
- `any` usages: [count]
- Type assertions: [count]
- Non-null assertions: [count]
- Missing return types: [count]
- Missing parameter types: [count]
- @ts-ignore directives: [count]

## Most Problematic Files

1. `path/to/file1.ts` - [issue count] issues
   - Primary issues: [list]
2. `path/to/file2.ts` - [issue count] issues
   - Primary issues: [list]
...

## Critical Issues (High Priority)

### Issue Category: [e.g., Database Query Types]

**Affected Files**: [count]

**Example from** `file/path.ts:line`
```typescript
// Current (unsafe)
const data: any = await supabase.from('employers').select('*')

// Recommended
const { data, error }: { data: Employer[] | null; error: PostgrestError | null } =
  await supabase.from('employers').select('*')
```

**Impact**: [Explanation of why this matters]

**Fix Complexity**: [Simple/Moderate/Complex]

---

## Detailed Findings by Category

### 1. Any Types ([count] occurrences)

#### Explicit Any Declarations
- `path/file.ts:42` - Function parameter `data: any`
- `path/file.ts:87` - Variable `result: any`

#### Implicit Any
- `path/file.ts:123` - Function missing return type
- `path/file.ts:156` - Callback parameter not typed

### 2. Type Assertions ([count] occurrences)

#### Potentially Unsafe Casts
- `path/file.ts:200` - `response as ApiResponse` without validation
- `path/file.ts:234` - `data as Employer[]` in error handler

### 3. Non-Null Assertions ([count] occurrences)

#### Missing Null Checks
- `path/file.ts:56` - `employer!.name` without checking if employer exists
- `path/file.ts:78` - `data![0]` without checking array length

### 4. Missing Type Annotations ([count] occurrences)

#### Functions Without Return Types
- `path/file.ts:100` - `async function fetchData(id)`
- `path/file.ts:145` - `const processResults = (items) => { ... }`

#### Parameters Without Types
- `path/file.ts:200` - Callback `(item) => { ... }`
- `path/file.ts:234` - Event handler `(e) => { ... }`

## Type Improvement Recommendations

### Phase 1: Quick Wins (Low Effort, High Impact)
1. **Add return types to all exported functions**
   - Files: [list top 10]
   - Effort: 2-3 hours
   - Impact: Immediate type safety at module boundaries

2. **Replace common `any` with proper types**
   - Supabase query results: Use generated types
   - API responses: Define interface types
   - Event handlers: Use React.MouseEvent, etc.

### Phase 2: Moderate Improvements
3. **Add Zod schemas for runtime validation**
   - API route input validation
   - External data parsing (CSV, PDF imports)
   - User form submissions

4. **Improve generic constraints**
   - Add proper type parameters to utility functions
   - Constrain generic types appropriately
   - Use discriminated unions where applicable

### Phase 3: Advanced Type Safety
5. **Enable strict TypeScript flags incrementally**
   - `strictNullChecks`: true
   - `noImplicitAny`: true
   - `strictFunctionTypes`: true
   - `strictPropertyInitialization`: true

6. **Add branded types for domain safety**
   - `EmployerId extends string`
   - `ProjectId extends string`
   - `TradeType extends string`

## Type Definition Templates

### For Database Queries
```typescript
import type { Database } from '@/types/database'
type Employer = Database['public']['Tables']['employers']['Row']
type EmployerInsert = Database['public']['Tables']['employers']['Insert']
type EmployerUpdate = Database['public']['Tables']['employers']['Update']
```

### For API Routes
```typescript
import type { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  // Implementation
}

interface ApiResponse {
  data?: Employer[]
  error?: string
  metadata?: {
    page: number
    total: number
  }
}
```

### For React Components
```typescript
interface EmployerCardProps {
  employer: Employer
  onSelect?: (id: string) => void
  showActions?: boolean
  className?: string
}

export function EmployerCard({
  employer,
  onSelect,
  showActions = true,
  className
}: EmployerCardProps) {
  // Implementation
}
```

### For Hooks
```typescript
import type { UseQueryResult } from '@tanstack/react-query'

export function useEmployers(
  filters?: EmployerFilters
): UseQueryResult<Employer[], Error> {
  // Implementation
}

interface EmployerFilters {
  search?: string
  category?: string
  ebaStatus?: boolean
}
```

## Migration Strategy

### Step-by-Step Plan

1. **Baseline**: Enable type checking in CI
   - Ensure current code passes TypeScript compilation
   - Set up CI to fail on type errors

2. **Low-Hanging Fruit** (Week 1)
   - Add return types to all public functions
   - Replace `any` in API routes with proper types
   - Add types to React component props

3. **Database Types** (Week 2)
   - Regenerate Supabase types: `npx supabase gen types typescript`
   - Replace manual database types with generated types
   - Update all database queries to use typed results

4. **Strict Null Checks** (Week 3)
   - Enable `strictNullChecks` in tsconfig
   - Fix null/undefined issues file by file
   - Add optional chaining where appropriate

5. **No Implicit Any** (Week 4)
   - Enable `noImplicitAny` in tsconfig
   - Add explicit types to all parameters
   - Add return types to all functions

6. **Full Strict Mode** (Week 5+)
   - Enable remaining strict flags
   - Add runtime validation with Zod
   - Document type patterns for team

## Code Quality Metrics

Track these metrics over time:

```typescript
interface TypeSafetyMetrics {
  typeScore: number              // 0-100
  anyCount: number               // Target: 0
  assertionCount: number         // Target: minimize
  tsIgnoreCount: number          // Target: 0
  strictFlagsEnabled: string[]   // Target: all
  filesWithTypes: number         // Target: 100%
  publicFunctionsCovered: number // Target: 100%
}
```

## Automated Tools Recommendations

1. **ts-migrate**: Automatically add types to existing code
2. **ts-prune**: Find unused exports
3. **dpdm**: Detect circular dependencies
4. **eslint-plugin-typescript**: Enforce type rules
5. **type-coverage**: Track type coverage percentage

## Special Considerations for This Codebase

### Supabase Integration
- Always use generated types from `src/types/database.ts`
- Regenerate types after database migrations
- Use specific table types, not generic `any`

### React Query
- Properly type query keys
- Define response types for all queries
- Use TypeScript generics for reusable queries

### API Routes
- Validate input with Zod schemas
- Type all request/response bodies
- Use NextResponse<T> for typed responses

### Forms
- Use react-hook-form with TypeScript
- Define Zod schemas for validation
- Match form types to database types

## Next Steps

After receiving this report:

1. **Review Priorities**: Discuss which issues to tackle first
2. **Create Tasks**: Break down improvements into tickets
3. **Incremental Migration**: Fix issues in logical groups
4. **Add Tooling**: Set up linters and type checkers
5. **Documentation**: Document type patterns for team
6. **Training**: Share TypeScript best practices

## Example Invocation

**User**: "Run type-auditor on the employer components"

**You should**:
1. Scan `src/components/employers/**/*.{ts,tsx}`
2. Count and categorize type issues
3. Identify top 5 most problematic files
4. Provide specific examples with fixes
5. Give prioritized recommendations
6. Offer to implement fixes for selected issues
