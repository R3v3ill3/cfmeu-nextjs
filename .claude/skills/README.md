# Claude Skills for CFMEU Next.js Project

This directory contains specialized Claude skills designed to help with systematic code analysis, bug identification, and refactoring for the CFMEU construction site compliance management platform.

## Overview

These skills enable Claude to perform deep, structured analysis of the codebase following best practices and systematic methodologies. Each skill is designed to identify specific types of issues and provide actionable recommendations.

## Available Skills

### Phase 1: Critical Skills (Immediate Value)

#### 1. bug-hunter
**Purpose**: Proactively identify bugs, code smells, and error-prone patterns

**When to use**:
- After major feature additions
- Before production releases
- When investigating production issues
- During code audits

**Analyzes**:
- Async/await issues and unhandled promises
- Type safety issues and dangerous assertions
- Error handling patterns
- Resource management and memory leaks
- Security vulnerabilities
- React-specific issues
- Database N+1 queries
- Logic errors

**Example usage**:
```
Run bug-hunter on the API routes
Run bug-hunter on src/components/employers
```

#### 2. type-auditor
**Purpose**: Improve TypeScript type safety and reduce `any` usage

**When to use**:
- Before enabling strict mode
- During code quality improvements
- Before major refactoring
- After TypeScript upgrades

**Analyzes**:
- `any` type usage (explicit and implicit)
- Type assertions and non-null assertions
- Missing type annotations
- Database type consistency
- Type definition quality

**Example usage**:
```
Run type-auditor on src/utils
Run type-auditor on all hooks
```

#### 3. error-handler-standardizer
**Purpose**: Ensure consistent error handling across the application

**When to use**:
- When debugging production errors
- Before implementing error monitoring
- During API standardization
- When improving error messages

**Analyzes**:
- Try/catch patterns and empty catch blocks
- API route error handling
- React component error boundaries
- Error logging and monitoring patterns
- User-facing error messages

**Example usage**:
```
Run error-handler-standardizer on API routes
Standardize error handling across components
```

---

### Phase 2: Stability Skills (Short-term Value)

#### 4. query-optimizer
**Purpose**: Analyze database queries for performance bottlenecks

**When to use**:
- When experiencing slow page loads
- Before scaling to more users
- After adding new features
- During performance optimization

**Analyzes**:
- N+1 query patterns
- Missing database indexes
- Inefficient queries (SELECT *, no LIMIT)
- React Query configuration
- Caching opportunities
- Query parallelization opportunities

**Example usage**:
```
Run query-optimizer on dashboard components
Analyze queries in the employer API
```

#### 5. data-flow-analyzer
**Purpose**: Identify data consistency issues and multiple sources of truth

**When to use**:
- When data appears inconsistent
- After schema changes
- When debugging sync issues
- Before data architecture refactoring

**Analyzes**:
- Multiple sources of truth (ENUMs, tables, constants)
- Cache invalidation issues
- Schema mismatches
- Data synchronization gaps
- Legacy vs new systems

**Example usage**:
```
Analyze trade types data flow
Find duplicate employer data sources
Run data-flow-analyzer on employer categories
```

#### 6. migration-safety-checker
**Purpose**: Validate database migrations for safety before deployment

**When to use**:
- Before running any migration
- After writing new migrations
- During code review of schema changes
- Before production deployments

**Analyzes**:
- Breaking changes and data loss risks
- Blocking operations (indexes without CONCURRENTLY)
- Performance impact
- Migration dependencies and order
- Application code compatibility
- Rollback planning

**Example usage**:
```
Run migration-safety-checker on pending migrations
Check safety of employer_capabilities migration
```

---

## How to Use Skills

### Basic Invocation

Simply ask Claude to run a skill:

```
Run bug-hunter on the API routes
```

Claude will:
1. Execute the skill's analysis methodology
2. Scan the specified code using appropriate search commands
3. Identify issues based on the skill's criteria
4. Generate a structured report with findings
5. Provide specific, actionable recommendations
6. Offer to implement fixes

### With Specific Scope

You can narrow the scope to specific areas:

```
Run type-auditor on src/components/employers
Run query-optimizer on the dashboard page
Run migration-safety-checker on the latest migration
```

### For Specific Issues

Ask Claude to focus on particular concerns:

```
Use bug-hunter to find all unhandled promises
Use query-optimizer to identify N+1 patterns in the project detail page
Use data-flow-analyzer to check trade types consistency
```

## Skill Output

Each skill provides structured output including:

### 1. Executive Summary
- Total issues found
- Severity breakdown (Critical/High/Medium/Low)
- Quick statistics

### 2. Detailed Findings
- File locations with line numbers
- Code examples showing the problem
- Explanation of why it's problematic
- Potential impact
- Recommended fix with code

### 3. Prioritized Recommendations
- Quick wins (low effort, high impact)
- Short-term improvements
- Long-term architectural changes

### 4. Implementation Guidance
- Step-by-step migration plans
- Code templates and utilities
- Testing strategies
- Rollback procedures

## Best Practices

### 1. Run Skills Regularly

**Development Workflow**:
- `bug-hunter`: After completing features
- `type-auditor`: Monthly or before strict mode changes
- `error-handler-standardizer`: When adding new routes/features
- `query-optimizer`: When pages feel slow
- `data-flow-analyzer`: After schema changes
- `migration-safety-checker`: Before every migration

### 2. Start with Critical Skills

If you're new to these skills, start with:
1. **migration-safety-checker** - Prevent data loss (if deploying migrations)
2. **bug-hunter** - Find immediate issues
3. **query-optimizer** - Improve performance

### 3. Combine Skills

Skills work well together:
```
1. Run data-flow-analyzer on trade types
2. Then run bug-hunter on the affected components
3. Then run migration-safety-checker on the consolidation migration
```

### 4. Prioritize Findings

Focus on:
- 🔴 Critical: Fix immediately
- 🟡 High: Schedule within sprint
- 🟢 Medium: Add to backlog
- ⚪ Low: Address during refactoring

## Skill Development Phases

### ✅ Phase 1: Complete (Critical Skills)
- [x] bug-hunter
- [x] type-auditor
- [x] error-handler-standardizer

### ✅ Phase 2: Complete (Stability Skills)
- [x] query-optimizer
- [x] data-flow-analyzer
- [x] migration-safety-checker

### 📋 Phase 3: Planned (Quality Skills)
- [ ] api-standardizer
- [ ] test-coverage-mapper
- [ ] react-performance-auditor

### 📋 Phase 4: Planned (Maintenance Skills)
- [ ] architectural-debt-scanner
- [ ] dependency-auditor
- [ ] hook-pattern-enforcer
- [ ] state-management-analyzer
- [ ] mobile-responsive-auditor

## Common Scenarios

### Scenario 1: Before Production Release
```bash
# Run comprehensive checks
1. Run bug-hunter on the entire codebase
2. Run migration-safety-checker on pending migrations
3. Run query-optimizer on critical pages
4. Run error-handler-standardizer on API routes
```

### Scenario 2: Performance Issue
```bash
# Diagnose slow pages
1. Run query-optimizer on the slow page/component
2. Run data-flow-analyzer to check for cache issues
3. Implement recommended optimizations
```

### Scenario 3: After Schema Change
```bash
# Ensure consistency
1. Run migration-safety-checker on the new migration
2. Run data-flow-analyzer on affected entities
3. Run type-auditor to regenerate types
4. Run bug-hunter on affected code
```

### Scenario 4: Code Quality Improvement
```bash
# Systematic improvement
1. Run type-auditor to find weak typing
2. Run error-handler-standardizer for consistency
3. Run bug-hunter for final check
```

## Integration with Development Workflow

### Pre-commit Checks
- Run `bug-hunter` on changed files
- Run `type-auditor` on new TypeScript files

### Pull Request Checklist
- Run `migration-safety-checker` if migrations included
- Run relevant skill on changed code area
- Include skill report summary in PR description

### CI/CD Pipeline
- Automate skill execution in CI
- Fail build on critical issues
- Generate reports for review

## Maintenance

### Keeping Skills Updated

Skills should be updated when:
- New patterns or anti-patterns are discovered
- New tools or libraries are added
- Best practices evolve
- Framework versions change

### Contribution Guidelines

When updating skills:
1. Add new patterns to the "Analysis Scope" section
2. Include search commands for finding the pattern
3. Provide clear examples with fixes
4. Update the output format if needed

## Support

If a skill isn't working as expected:
1. Check that you're using the correct skill name
2. Verify the scope is appropriate (file paths exist)
3. Review the skill's documentation for usage examples
4. Try narrowing the scope to a specific area

For skill improvements or new skill requests:
- Document the issue or need
- Provide examples of what should be detected
- Suggest the analysis methodology

---

## Quick Reference

| Need | Skill | Priority |
|------|-------|----------|
| Find bugs before release | bug-hunter | 🔴 Critical |
| Slow page loads | query-optimizer | 🔴 Critical |
| About to run migration | migration-safety-checker | 🔴 Critical |
| Improve type safety | type-auditor | 🟡 High |
| Inconsistent data | data-flow-analyzer | 🟡 High |
| Standardize errors | error-handler-standardizer | 🟡 High |

---

**Note**: These skills are designed specifically for the CFMEU Next.js codebase but can be adapted for other projects with similar tech stacks (Next.js, Supabase, TypeScript, React Query).

**Last Updated**: 2025-11-06
**Skills Version**: 1.0
**Phases Complete**: 1-2 of 4
