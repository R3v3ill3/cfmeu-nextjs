# CFMEU Data Validation System Documentation

## Overview

This document describes the comprehensive data validation and quality control system implemented for the CFMEU Next.js application. The system prevents accidental data corruption and ensures business rule compliance across all API endpoints.

## Architecture

### Core Components

1. **Validation Schemas** (`/src/lib/validation/schemas.ts`)
   - Centralized Zod schemas for all data structures
   - Type-safe validation with clear error messages
   - Business rule enforcement

2. **Validation Middleware** (`/src/lib/validation/middleware.ts`)
   - Reusable validation functions for API routes
   - Standardized error handling and response formatting
   - Authentication and authorization validation

3. **Type Definitions** (`/src/types/validation.ts`)
   - Comprehensive TypeScript interfaces
   - Type guards and utility functions
   - API request/response type definitions

4. **Enhanced API Routes**
   - Updated with validation middleware
   - Business logic validation
   - Helpful error messages for internal users

## Key Features

### 1. Input Validation

All API routes now validate:
- **UUID Format**: Ensures proper ID format for database lookups
- **String Lengths**: Prevents database overflow and truncation
- **Numeric Ranges**: Validates ratings, percentages, and other numeric inputs
- **Date Formats**: Ensures consistent date handling
- **Email/Phone Formats**: Validates contact information

### 2. Business Logic Validation

CFMEU-specific business rules enforced:
- **Project Stage Transitions**: Validates logical project progression
- **Employer Role Assignments**: Ensures construction industry compliance
- **Assessment Criteria**: Validates rating consistency and logic
- **Geographic Assignments**: Validates patch assignments and access
- **Merge Operations**: Prevents data conflicts and circular references

### 3. Authentication & Authorization

- **Role-based Access**: Different validation levels for different user roles
- **Geographic Restrictions**: Organizers can only access assigned patches
- **Permission Validation**: Database-level permission enforcement
- **Audit Logging**: Tracks who performed what operations

### 4. Error Handling

- **User-Friendly Messages**: Clear, actionable error messages for internal users
- **Development Details**: Detailed validation errors in development mode
- **Hints and Suggestions**: Contextual help for common errors
- **Standardized Format**: Consistent error response structure

## Implementation Details

### Using the Validation System

#### 1. Basic API Route Validation

```typescript
import { withValidation } from '@/lib/validation/middleware'
import { schemas } from '@/lib/validation/schemas'

export const POST = withValidation(
  async (request, { data, user }) => {
    // Your API logic here
    // data is validated and typed
    // user is authenticated and authorized
    return NextResponse.json({ success: true, data })
  },
  schemas.yourSchema,
  {
    requireAuth: true,
    requiredRoles: ['admin', 'lead_organiser']
  }
)
```

#### 2. Custom Validation Logic

```typescript
// Add business logic validation in your API route
const businessValidation = validateBusinessRules(data)
if (!businessValidation.valid) {
  return NextResponse.json({
    success: false,
    error: businessValidation.error,
    hint: businessValidation.hint
  }, { status: 400 })
}
```

#### 3. Using Existing Schemas

```typescript
// Import specific schemas
import { schemas } from '@/lib/validation/schemas'

// Use in your components or API routes
const validatedData = schemas.project.createProject.parse(inputData)
```

### Available Schemas

#### Project Schemas
- `schemas.project.createProject` - New project creation
- `schemas.project.approveProject` - Project approval workflow
- `schemas.project.mergeProjects` - Project merge operations
- `schemas.project.projectSearch` - Project search and filtering

#### Employer Schemas
- `schemas.employer.createEmployer` - New employer creation
- `schemas.employer.mergeEmployers` - Employer merge operations
- `schemas.employer.updateEbaStatus` - EBA status updates
- `schemas.employer.employerSearch` - Employer search and filtering

#### Assessment Schemas
- `schemas.assessment.safetyAssessment` - Safety assessment submission
- `schemas.assessment.unionRespectAssessment` - Union respect assessment
- `schemas.assessment.subcontractorAssessment` - Subcontractor assessment
- `schemas.assessment.assessmentSearch` - Assessment search parameters

#### User Schemas
- `schemas.user.updateProfile` - Profile updates
- `schemas.user.assignPatch` - Patch assignments
- `schemas.user.activatePendingUser` - Pending user activation

### Business Logic Rules

#### Project Validation
- Projects must progress through stages logically
- Value differences in merged projects must be reasonable
- Only appropriate project stages allow certain operations

#### Employer Validation
- ABN format validation (11 digits)
- Role assignments must match construction industry standards
- Merge operations prevent conflicting ABNs without resolution

#### Assessment Validation
- Ratings must be within 1-4 range
- Extreme rating disparities trigger warnings
- Follow-up dates must be future dates when required
- Safety assessments typically for construction-stage projects

#### Geographic Validation
- Users limited to assigned geographic patches
- Lead organizers can access patches they lead
- Maximum patch assignments for efficiency

## Migration Guide

### Converting Existing API Routes

1. **Import Validation Middleware**
   ```typescript
   import { withValidation } from '@/lib/validation/middleware'
   import { schemas } from '@/lib/validation/schemas'
   ```

2. **Replace Manual Validation**
   ```typescript
   // OLD
   export async function POST(request: NextRequest) {
     const { projectId, notes } = await request.json()
     if (!projectId) {
       return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
     }
     // ... auth checks ...
   }

   // NEW
   export const POST = withValidation(
     async (request, { data, user }) => {
       // Business logic here
     },
     schemas.yourValidationSchema,
     { requireAuth: true, requiredRoles: ['admin'] }
   )
   ```

3. **Update Response Format**
   ```typescript
   // OLD
   return NextResponse.json({ success: true, data: result })

   // NEW (enhanced)
   return NextResponse.json({
     success: true,
     data: result,
     metadata: {
       processedBy: user.full_name,
       processedAt: new Date().toISOString()
     }
   })
   ```

## Testing the Validation System

### Unit Testing
```typescript
import { schemas } from '@/lib/validation/schemas'

describe('Validation Schemas', () => {
  it('should validate project creation', () => {
    const validProject = {
      name: 'Test Project',
      value: 1000000,
      stage: 'construction'
    }
    expect(() => schemas.project.createProject.parse(validProject)).not.toThrow()
  })

  it('should reject invalid project data', () => {
    const invalidProject = {
      name: '',
      value: -1000,
      stage: 'invalid_stage'
    }
    expect(() => schemas.project.createProject.parse(invalidProject)).toThrow()
  })
})
```

### Integration Testing
```typescript
describe('API Validation', () => {
  it('should reject requests with invalid data', async () => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' })
    })
    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error.success).toBe(false)
    expect(error.error).toBeDefined()
  })
})
```

## Error Response Format

### Standard Error Response
```json
{
  "success": false,
  "error": "Human-readable error message",
  "field": "field_name_if_applicable",
  "hint": "Contextual help for fixing the error",
  "details": { /* Additional error details */ }
}
```

### Validation Error Details
```json
{
  "success": false,
  "error": "Validation failed",
  "field": "criteria.site_safety",
  "hint": "Rating must be between 1 and 4",
  "details": {
    "expected": "number between 1 and 4",
    "received": 5,
    "path": ["criteria", "site_safety"]
  }
}
```

## Performance Considerations

### Validation Overhead
- Zod validation is extremely fast (< 1ms for typical payloads)
- Database lookups for existence checks add minimal overhead
- Business logic validation prevents expensive database operations

### Caching
- Validation schemas are created once and reused
- Authentication results cached by Supabase client
- Role-based queries optimized with proper indexing

### Recommendations
- Use `returnValidationErrors: true` only in development
- Implement client-side validation to reduce server load
- Monitor validation error rates for data quality insights

## Security Considerations

### Data Protection
- Input validation prevents SQL injection attempts
- UUID validation prevents database enumeration
- Length limits prevent DoS attacks via large payloads

### Access Control
- Authentication required for all data-modifying operations
- Role-based validation prevents privilege escalation
- Geographic restrictions enforce data access boundaries

### Audit Trail
- All validated operations include user context
- Validation errors logged for security monitoring
- Business rule violations tracked for compliance

## Future Enhancements

### Planned Features
1. **Client-Side Validation**: React hook for form validation
2. **Advanced Business Rules**: More sophisticated validation logic
3. **Data Quality Metrics**: Automated data quality scoring
4. **Validation Dashboard**: Monitoring and analytics interface

### Extension Points
- Custom validation schemas for new features
- Plugin architecture for domain-specific validation
- Integration with external validation services
- Machine learning for anomaly detection

## Support and Maintenance

### Common Issues
1. **Import Errors**: Ensure correct import paths for validation utilities
2. **Schema Mismatches**: Keep schemas in sync with database changes
3. **Performance**: Monitor validation impact on API response times

### Getting Help
- Check validation error messages for specific issues
- Review this documentation for implementation guidance
- Consult existing API routes for implementation patterns
- Contact development team for complex validation requirements

---

**Last Updated**: November 2024
**Version**: 1.0
**Maintainer**: CFMEU Development Team