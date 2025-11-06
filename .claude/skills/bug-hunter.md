# Bug Hunter Skill

Systematically scan the codebase for common bug patterns, anti-patterns, and potential runtime issues.

## Purpose

Proactively identify bugs, code smells, and error-prone patterns before they cause production issues. This skill performs deep analysis across TypeScript/JavaScript code to find issues that might not be caught by linters or type checkers.

## When to Use This Skill

- After major feature additions or refactoring
- Before production releases or deployments
- When investigating recurring production issues
- During code quality audits or security reviews
- When onboarding to a new codebase section

## Analysis Scope

When invoked, analyze the following patterns:

### 1. Async/Await Issues
- **Unhandled Promise Rejections**: Async functions without try/catch or .catch()
- **Missing await**: Promises created but not awaited
- **Sequential Awaits**: Awaits that could be parallelized with Promise.all()
- **Race Conditions**: Async operations on shared state without proper synchronization
- **Floating Promises**: Promises that are never awaited or caught

### 2. Type Safety Issues
- **Dangerous Type Assertions**: Using `as` to cast between incompatible types
- **Any Type Usage**: Functions or variables typed as `any`
- **Non-null Assertions**: Using `!` operator without proper validation
- **Implicit Any**: Missing type annotations where inference fails
- **Type Guards Missing**: Narrow types accessed without proper type guards

### 3. Error Handling
- **Empty Catch Blocks**: Catching errors without logging or handling
- **Generic Error Messages**: Error messages without context
- **Thrown Strings**: Throwing non-Error objects
- **Missing Error Boundaries**: React components without error boundaries
- **Uncaught Errors**: Try/catch blocks that don't handle all error types

### 4. Resource Management
- **Memory Leaks**: Event listeners not cleaned up
- **Unclosed Connections**: Database connections or file handles not closed
- **Infinite Loops**: While loops without proper exit conditions
- **Large Data in State**: Storing large datasets in React state
- **Missing Cleanup**: useEffect without cleanup functions

### 5. Security Issues
- **SQL Injection Risks**: String concatenation in database queries
- **XSS Vulnerabilities**: Dangerously setting innerHTML
- **Unsafe Eval**: Usage of eval(), Function constructor
- **Sensitive Data Logging**: Logging passwords, tokens, or PII
- **Missing Input Validation**: User input used without sanitization

### 6. React-Specific Issues
- **Missing Keys**: List items without proper key prop
- **Stale Closures**: Accessing stale state in callbacks
- **Unnecessary Re-renders**: Missing memoization for expensive operations
- **Prop Drilling**: Deep prop passing that should use Context
- **Side Effects in Render**: API calls or mutations in render functions

### 7. Database Issues
- **N+1 Queries**: Sequential database calls in loops
- **Missing Transactions**: Related operations not wrapped in transactions
- **Inefficient Queries**: Selecting all columns when only few needed
- **Missing Indexes**: Frequent queries on unindexed columns
- **Stale Cache**: Not invalidating cache after mutations

### 8. Logic Errors
- **Off-by-One Errors**: Array indexing or loop boundary issues
- **Incorrect Equality**: Using == instead of ===
- **Null/Undefined Confusion**: Not properly checking for null vs undefined
- **Floating Point Comparison**: Comparing floats with ===
- **Timezone Issues**: Date manipulation without timezone consideration

## Search Commands

Use these Grep patterns to identify issues:

```bash
# Unhandled promises
grep -n "async.*=>" --include="*.ts" --include="*.tsx" -r src/

# Empty catch blocks
grep -n "catch.*{[\s]*}" --include="*.ts" --include="*.tsx" -r src/

# Any types
grep -n ":\s*any\s*[,;)\]]" --include="*.ts" --include="*.tsx" -r src/

# Non-null assertions
grep -n "!\." --include="*.ts" --include="*.tsx" -r src/

# Missing await
grep -n "Promise\." --include="*.ts" --include="*.tsx" -r src/

# SQL string concatenation
grep -n "SELECT.*\+" --include="*.ts" --include="*.tsx" -r src/

# eval usage
grep -n "\beval\(" --include="*.ts" --include="*.tsx" -r src/

# console.log in production
grep -n "console\.(log|debug)" --include="*.ts" --include="*.tsx" -r src/app/

# Missing error handling
grep -n "supabase\.from.*\.then\(" --include="*.ts" --include="*.tsx" -r src/
```

## Output Format

Provide findings in this structured format:

### Bug Report Summary
```
Total Issues Found: [number]
Critical: [number]
High: [number]
Medium: [number]
Low: [number]

Files Analyzed: [number]
Most Problematic Files: [list top 5]
```

### Detailed Findings

For each issue found:

```markdown
## [SEVERITY] Issue #[number]: [Issue Type]

**Location**: `file/path/name.ts:line_number`

**Pattern Detected**:
[Code snippet showing the problem]

**Why This Is Problematic**:
[Explanation of the bug or risk]

**Potential Impact**:
- [Impact point 1]
- [Impact point 2]

**Recommended Fix**:
```typescript
// Before
[problematic code]

// After
[corrected code]
```

**Priority**: [Critical/High/Medium/Low]
```

## Priority Definitions

- **Critical**: Will cause crashes, data loss, or security breaches
- **High**: Likely to cause bugs in common scenarios
- **Medium**: May cause issues in edge cases or affect maintainability
- **Low**: Code smells or style issues that don't affect functionality

## Example Usage

**User Request**: "Run bug-hunter on the employer API routes"

**Your Response**:
1. Use Grep to scan `src/app/api/employers/**/*.ts`
2. Identify patterns matching the categories above
3. Read files with concerning patterns
4. Analyze context to confirm if it's a real issue
5. Generate structured report with findings
6. Provide specific, actionable recommendations

## Special Considerations for This Codebase

- **Supabase Queries**: Check for proper error handling on all `.from()` calls
- **RLS Policies**: Verify queries work with Row Level Security
- **Server Components**: Check async Server Components handle errors
- **API Routes**: Ensure all routes validate input and handle errors
- **React Query**: Check for proper error states and retry logic
- **Background Workers**: Verify proper connection cleanup
- **AI Integrations**: Check for timeout handling and API key validation

## Follow-up Actions

After providing the report:
1. Ask user which issues to fix first
2. Offer to create detailed fix implementations
3. Suggest adding ESLint rules to prevent recurrence
4. Recommend adding tests to catch similar issues

## Notes

- Focus on actual bugs, not style preferences
- Provide context for why something is problematic
- Consider the specific domain (union organizing, construction compliance)
- Some patterns may be intentional - flag for review rather than assuming bug
- Group similar issues together for efficiency
