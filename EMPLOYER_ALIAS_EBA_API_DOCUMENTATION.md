# Employer Alias & EBA Quick List API Documentation

## Overview

This document outlines the comprehensive backend implementation for employer alias management and EBA quick list features. The implementation provides robust data layer and API foundation with performance optimizations, role-based access control, and comprehensive error handling.

## Features Implemented

### 1. Enhanced Employer Matching with Aliases
- **Location**: `/src/utils/employerMatching.ts`
- **Key Functions**:
  - `matchEmployerAdvanced()` - Multi-algorithm matching with alias support
  - `findBestEmployerMatch()` - Optimized quick lookup
  - `batchMatchEmployers()` - Bulk processing with alias support

### 2. Alias Management APIs
- **Base Endpoint**: `/api/employers/[id]/aliases`
- **Bulk Operations**: `/api/employers/bulk-aliases`
- **Individual Alias**: `/api/employers/[id]/aliases/[aliasId]`

### 3. EBA Quick List API
- **Endpoint**: `/api/employers/eba-quick-list`
- **Trade Types**: `/api/employers/eba-quick-list/trades`

### 4. Database Operations Layer
- **Employer Operations**: `/src/lib/database/employerOperations.ts`
- **Bulk Operations**: `/src/lib/database/bulkAliasOperations.ts`

### 5. Performance Optimizations
- **Migration**: `/supabase/migrations/20251026000000_employer_alias_performance_optimizations.sql`
- **Features**: Optimized indexes, materialized views, and monitoring

---

## API Endpoints

### Alias Management

#### GET /api/employers/[id]/aliases
List all aliases for a specific employer.

**Parameters**:
- `id` (path): Employer UUID
- `includeInactive` (query, optional): Include inactive aliases (default: false)

**Response**:
```json
{
  "success": true,
  "employer": {
    "id": "uuid",
    "name": "Employer Name"
  },
  "aliases": [
    {
      "id": "uuid",
      "alias": "Alias Name",
      "alias_normalized": "normalized-alias",
      "employer_id": "uuid",
      "created_at": "2024-01-01T00:00:00Z",
      "created_by": "uuid",
      "source_system": "manual",
      "source_identifier": "source-id",
      "collected_at": "2024-01-01T00:00:00Z",
      "collected_by": "uuid",
      "is_authoritative": false,
      "notes": null
    }
  ],
  "count": 1
}
```

#### POST /api/employers/[id]/aliases
Create a new alias for an employer.

**Request Body**:
```json
{
  "alias": "New Alias Name",
  "source_system": "manual",
  "source_identifier": "source-id",
  "is_authoritative": false,
  "notes": "Optional notes"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Alias created successfully",
  "alias": { /* full alias object */ }
}
```

#### PATCH /api/employers/[id]/aliases/[aliasId]
Update an existing alias.

**Request Body**:
```json
{
  "alias": "Updated Alias Name",
  "is_authoritative": true,
  "notes": "Updated notes"
}
```

#### DELETE /api/employers/[id]/aliases/[aliasId]
Delete a specific alias.

**Response**:
```json
{
  "success": true,
  "message": "Alias deleted successfully",
  "deleted_alias": {
    "id": "uuid",
    "alias": "Deleted Alias"
  }
}
```

### Bulk Operations

#### POST /api/employers/bulk-aliases
Create multiple aliases in bulk.

**Request Body**:
```json
{
  "aliases": [
    {
      "alias": "Alias 1",
      "employer_id": "uuid",
      "source_system": "bulk_import",
      "is_authoritative": false,
      "notes": "Bulk import"
    }
  ],
  "skip_duplicates": true,
  "batch_size": 50
}
```

**Response**:
```json
{
  "success": true,
  "message": "Processed 1 aliases",
  "summary": {
    "totalProcessed": 1,
    "successCount": 1,
    "failureCount": 0,
    "skippedCount": 0
  },
  "successful": [/* successful aliases */],
  "failed": [/* failed aliases */],
  "skipped": [/* skipped aliases */]
}
```

#### PUT /api/employers/bulk-aliases
Update multiple aliases in bulk.

**Request Body**:
```json
{
  "updates": [
    {
      "id": "uuid",
      "alias": "Updated Name",
      "is_authoritative": true,
      "notes": "Updated notes"
    }
  ],
  "batch_size": 50
}
```

#### DELETE /api/employers/bulk-aliases
Delete multiple aliases in bulk.

**Request Body**:
```json
{
  "alias_ids": ["uuid1", "uuid2"],
  "batch_size": 50
}
```

### EBA Quick List

#### GET /api/employers/eba-quick-list
Get EBA employers filtered by trade type and search criteria.

**Parameters**:
- `trade_type` (query, optional): Filter by specific trade type
- `search` (query, optional): Search query for employer names
- `page` (query, optional): Page number (default: 1)
- `pageSize` (query, optional): Page size (default: 50, max: 200)
- `include_active_eba_only` (query, optional): Only include active EBA employers (default: true)
- `include_aliases` (query, optional): Include alias-aware search (default: false)
- `alias_match_mode` (query, optional): Alias matching mode ('any', 'authoritative', 'canonical')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Employer Name",
      "employer_type": "builder",
      "enterprise_agreement_status": true,
      "eba_status_source": "manual",
      "eba_status_updated_at": "2024-01-01T00:00:00Z",
      "estimated_worker_count": 50,
      "trades": [
        {
          "code": "CARPENTER",
          "name": "Carpentry"
        }
      ],
      "projects_count": 5,
      "last_eba_activity": "2024-01-01T00:00:00Z",
      "search_score": 0.95,
      "match_type": "alias",
      "matched_alias": "Alternative Name"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalCount": 100,
    "totalPages": 2
  },
  "filters_applied": {
    "trade_type": "CARPENTER",
    "search": "Construction Co",
    "include_active_eba_only": true
  },
  "debug": {
    "queryTime": 45,
    "cacheHit": false,
    "usedAliasSearch": true
  }
}
```

#### GET /api/employers/eba-quick-list/trades
Get available trade types for EBA filtering.

**Response**:
```json
{
  "success": true,
  "trade_types": [
    {
      "code": "CARPENTER",
      "name": "Carpentry",
      "count": 25
    },
    {
      "code": "ELECTRICIAN",
      "name": "Electrical",
      "count": 18
    }
  ],
  "total_types": 2
}
```

---

## Database Operations

### Core Functions

#### createEmployerAlias(request)
Creates a new employer alias with validation and provenance tracking.

**Parameters**:
- `alias`: The alias text
- `employer_id`: Target employer UUID
- `source_system`: Source system identifier
- `is_authoritative`: Whether this is an authoritative alias
- `notes`: Optional notes
- `created_by`: User UUID who created the alias

**Returns**: Success status with created alias data or error message.

#### getEmployerAliases(employerId, includeInactive)
Retrieves all aliases for a specific employer.

**Parameters**:
- `employerId`: Employer UUID
- `includeInactive`: Include inactive aliases

**Returns**: Array of employer alias objects.

#### searchEmployersWithAliases(query, options)
Search employers with alias support.

**Parameters**:
- `query`: Search query
- `limit`: Result limit (default: 50)
- `offset`: Pagination offset
- `includeAliases`: Include alias-aware search
- `aliasMatchMode`: 'any' | 'authoritative' | 'canonical'
- `employerType`: Filter by employer type
- `ebaStatus`: Filter by EBA status

**Returns**: Search results with match details and scores.

#### getEbaEmployersByTrade(filter)
Get EBA employers filtered by trade type.

**Parameters**:
- `trade_type`: Trade type filter
- `search`: Search query
- `limit`: Result limit
- `offset`: Pagination offset
- `include_active_eba_only`: Filter by active EBA status

**Returns**: Filtered employer list with EBA details.

### Bulk Operations

#### bulkCreateAliases(requests, options)
Efficiently create multiple aliases with batch processing and duplicate detection.

**Features**:
- Batch processing with configurable batch sizes
- Duplicate detection within batch and against database
- Comprehensive error reporting
- Performance optimization for large datasets

#### bulkUpdateAliases(request, options)
Update multiple aliases with validation.

**Features**:
- Batch updates with validation
- Alias uniqueness checking
- Detailed error reporting
- Transaction safety

#### bulkDeleteAliases(aliasIds, options)
Delete multiple aliases safely.

**Features**:
- Batch deletion with validation
- Existence checking before deletion
- Comprehensive error reporting
- Audit trail support

---

## Performance Optimizations

### Database Indexes

#### Alias Search Indexes
- `employer_aliases_search_idx`: Composite index for alias searches
- `employer_aliases_provenance_idx`: Provenance tracking index
- `employer_aliases_authoritative_idx`: Partial index for authoritative aliases

#### EBA Quick List Indexes
- `employers_search_optimized_eba_trade_idx`: Trade-based filtering index
- `employers_search_optimized_eba_recency_idx`: EBA recency scoring
- `employers_search_optimized_quick_list_idx`: Common query patterns

#### Text Search Optimization
- `employers_name_trgm_idx`: Trigram index for fuzzy name search
- `employers_search_optimized_refresh_idx`: Materialized view refresh optimization

### Materialized View Functions

#### search_employers_with_aliases_optimized()
Optimized RPC function for alias-aware employer search using materialized view.

#### get_eba_employers_by_trade_optimized()
Optimized RPC function for EBA trade filtering.

#### refresh_employers_search_optimized_incremental()
Incremental materialized view refresh with change detection.

### Monitoring Views

#### employer_alias_metrics
View for monitoring alias usage and performance.

#### eba_quick_list_metrics
View for monitoring EBA quick list performance.

---

## Rate Limiting

All API endpoints are protected with appropriate rate limiting:

- **Default Operations**: Standard rate limits
- **Expensive Queries**: Enhanced rate limits for bulk operations and complex searches
- **Database Protection**: Built-in query optimization and caching

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error description",
  "details": ["Detailed error messages"],
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `400`: Bad Request - Validation errors
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Duplicate resource
- `500`: Internal Server Error - Unexpected error

### Bulk Operation Error Handling
Bulk operations provide detailed error reporting with success/failure breakdowns:
- Successful operations with returned data
- Failed operations with specific error messages
- Skipped operations with reasons for skipping

---

## Authentication & Authorization

### Required Roles
- `organiser`: Basic access
- `lead_organiser`: Enhanced access
- `admin`: Full access

### Security Features
- Role-based access control on all endpoints
- User attribution for created/modified records
- Audit trail through created_by/collected_by fields
- Input validation and sanitization
- SQL injection protection through parameterized queries

---

## Integration Examples

### Frontend Integration

```typescript
// Search employers with alias support
const searchEmployers = async (query: string) => {
  const response = await fetch(`/api/employers/eba-quick-list?search=${encodeURIComponent(query)}&include_aliases=true`);
  const data = await response.json();
  return data;
};

// Create employer alias
const createAlias = async (employerId: string, alias: string) => {
  const response = await fetch(`/api/employers/${employerId}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alias,
      source_system: 'manual',
      is_authoritative: false
    })
  });
  return response.json();
};

// Bulk create aliases
const bulkCreateAliases = async (aliases: CreateEmployerAliasRequest[]) => {
  const response = await fetch('/api/employers/bulk-aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aliases,
      skip_duplicates: true,
      batch_size: 50
    })
  });
  return response.json();
};
```

### Database Integration

```typescript
import { createEmployerAlias, getEbaEmployersByTrade } from '@/lib/database/employerOperations';

// Create alias with validation
const aliasResult = await createEmployerAlias({
  alias: 'Construction Co Pty Ltd',
  employer_id: 'employer-uuid',
  source_system: 'manual',
  is_authoritative: true,
  created_by: 'user-uuid'
});

// Get EBA employers by trade
const ebaResult = await getEbaEmployersByTrade({
  trade_type: 'CARPENTER',
  search: 'construction',
  limit: 100,
  include_active_eba_only: true
});
```

---

## Migration and Deployment

### Database Migration
Run the performance optimization migration:
```sql
-- Apply the migration
\i supabase/migrations/20251026000000_employer_alias_performance_optimizations.sql
```

### Environment Variables
No additional environment variables required. Uses existing Supabase configuration.

### Monitoring
- Use the provided monitoring views to track performance
- Materialized view refresh is logged in `system_logs` table
- Query performance metrics available in response headers

---

## Summary

This implementation provides a comprehensive, performant, and secure backend foundation for employer alias management and EBA quick list features. Key achievements include:

1. **Enhanced Matching**: Multi-algorithm employer matching with alias support
2. **Comprehensive APIs**: Full CRUD operations for aliases with bulk support
3. **EBA Integration**: Trade-based EBA employer filtering with search capabilities
4. **Performance**: Optimized queries, indexes, and materialized views
5. **Security**: Role-based access control with audit trails
6. **Monitoring**: Built-in performance monitoring and logging
7. **Scalability**: Bulk operations with batch processing and error handling

The implementation maintains backward compatibility while adding powerful new features for managing employer relationships and EBA tracking.