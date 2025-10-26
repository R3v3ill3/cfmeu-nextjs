# CFMEU Employer Traffic Light Rating System - API Documentation

## Overview

The Employer Traffic Light Rating System API provides comprehensive endpoints for managing employer ratings through two distinct tracks:

- **Track 1**: Project Compliance Assessments
- **Track 2**: Organiser Expertise Ratings
- **Final Ratings**: Combined scoring system
- **Batch Operations**: Bulk processing capabilities
- **Analytics**: Trends and insights
- **Mobile Dashboard**: Optimized for field use

## Base URL

```
https://your-domain.com/api/ratings
```

## Authentication & Authorization

All API endpoints require authentication using Bearer tokens. Users must have one of the following roles:

- `organiser`: Standard access to ratings for their assigned employers
- `lead_organiser`: Enhanced access including bulk operations
- `admin`: Full system access including maintenance operations

### Authentication Header

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All responses follow a consistent format:

```json
{
  "data": { ... },
  "error": "Error message (if applicable)",
  "meta": {
    "timestamp": "2025-01-26T10:30:00.000Z",
    "requestId": "req_1643217000_abc123def"
  }
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

Error responses include detailed information:

```json
{
  "error": "Validation failed",
  "message": "Invalid request data",
  "details": [
    {
      "field": "score",
      "message": "Score must be between -100 and 100",
      "value": 150
    }
  ],
  "code": "VALIDATION_ERROR",
  "type": "validation",
  "severity": "low",
  "timestamp": "2025-01-26T10:30:00.000Z"
}
```

---

## Track 1: Project Compliance Assessments

### Create Compliance Assessment

**Endpoint**: `POST /api/projects/{projectId}/compliance-assessessments`

Creates a new project compliance assessment for an employer.

#### Request Body

```json
{
  "employer_id": "uuid",
  "project_id": "uuid",
  "assessment_type": "eca_status",
  "score": 25,
  "rating": "green",
  "confidence_level": "high",
  "severity_level": 1,
  "assessment_notes": "Active EBA with good compliance",
  "assessment_date": "2025-01-26",
  "evidence_attachments": ["document1.pdf", "image1.jpg"],
  "follow_up_required": false,
  "organiser_id": "uuid"
}
```

#### Response

```json
{
  "id": "uuid",
  "employer_id": "uuid",
  "project_id": "uuid",
  "assessment_type": "eca_status",
  "score": 25,
  "rating": "green",
  "confidence_level": "high",
  "severity_level": 1,
  "assessment_notes": "Active EBA with good compliance",
  "assessment_date": "2025-01-26",
  "evidence_attachments": ["document1.pdf"],
  "follow_up_required": false,
  "organiser_id": "uuid",
  "created_at": "2025-01-26T10:30:00.000Z"
}
```

### Get Project Compliance Assessments

**Endpoint**: `GET /api/projects/{projectId}/compliance-assessessments`

Retrieves compliance assessments for a specific project with filtering and pagination.

#### Query Parameters

- `page` (number): Page number (default: 1)
- `pageSize` (number): Items per page (default: 50, max: 100)
- `assessmentType` (string): Filter by assessment type
- `confidenceLevel` (string): Filter by confidence level
- `dateFrom` (string): Start date filter (YYYY-MM-DD)
- `dateTo` (string): End date filter (YYYY-MM-DD)
- `sortBy` (string): Sort field (default: assessment_date)
- `sortOrder` (string): Sort direction (asc/desc, default: desc)
- `includeInactive` (boolean): Include inactive assessments (default: false)

#### Response

```json
{
  "assessments": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalCount": 156,
    "totalPages": 4
  },
  "summary": {
    "total_assessments": 156,
    "assessments_by_type": {
      "eca_status": 45,
      "cbus_status": 32,
      "safety_incidents": 18
    },
    "average_score": 72.5,
    "latest_assessment_date": "2025-01-25"
  }
}
```

### Get Project Compliance Summary

**Endpoint**: `GET /api/employers/{employerId}/project-compliance`

Retrieves aggregated project compliance data for an employer.

#### Query Parameters

- `lookbackDays` (number): Days to look back (default: 365)
- `calculationDate` (string): Specific date for calculation
- `includeAnalytics` (boolean): Include analytics data (default: true)
- `includeComparison` (boolean): Include comparison data (default: false)

#### Response

```json
{
  "employer_id": "uuid",
  "current_summary": {
    "project_rating": "green",
    "project_score": 78,
    "data_quality": "high",
    "assessment_count": 12,
    "latest_assessment_date": "2025-01-25"
  },
  "analytics": {
    "by_assessment_type": {...},
    "trends": {...},
    "recommendations": [...]
  },
  "insights": {
    "strengths": [...],
    "concerns": [...],
    "recommended_actions": [...]
  }
}
```

### Update Compliance Assessment

**Endpoint**: `PUT /api/compliance-assessments/{assessmentId}`

Updates an existing compliance assessment.

### Delete Compliance Assessment

**Endpoint**: `DELETE /api/compliance-assessments/{assessmentId}`

Soft deletes (deactivates) a compliance assessment.

---

## Track 2: Organiser Expertise Ratings

### Create Expertise Rating

**Endpoint**: `POST /api/employers/{employerId}/expertise-ratings`

Creates a new organiser expertise assessment.

#### Request Body

```json
{
  "overall_score": 75,
  "overall_rating": "green",
  "confidence_level": "medium",
  "assessment_basis": "Based on industry knowledge and recent project interactions",
  "assessment_context": "Employer has shown consistent compliance and good union relationship",
  "eba_status_known": true,
  "eba_status": "green",
  "knowledge_beyond_projects": true,
  "industry_reputation": "Generally positive with some isolated concerns",
  "union_relationship_quality": "good",
  "assessment_date": "2025-01-26",
  "assessment_notes": "Strong EBA compliance, good payment history, positive industry reputation"
}
```

### Get Expertise Ratings

**Endpoint**: `GET /api/employers/{employerId}/expertise-ratings`

Retrieves expertise assessments for an employer.

#### Query Parameters

- `page` (number): Page number
- `pageSize` (number): Items per page (default: 20, max: 100)
- `confidenceLevel` (string): Filter by confidence level
- `organiserId` (string): Filter by organiser
- `dateFrom` (string): Start date filter
- `dateTo` (string): End date filter
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort direction
- `includeInactive` (boolean): Include inactive assessments

### Wizard Configuration

**Endpoint**: `GET /api/expertise-wizard/config`

Retrieves wizard configuration for expertise assessments.

#### Response

```json
{
  "steps": [
    {
      "id": "uuid",
      "wizard_step": 1,
      "step_name": "EBA Status",
      "step_description": "Does the employer have an active enterprise agreement?",
      "step_type": "question",
      "is_required": true,
      "display_order": 1,
      "options": [
        {
          "id": "uuid",
          "option_value": "yes",
          "option_text": "Yes, active EBA",
          "score_impact": 25,
          "explanation": "Employer has current enterprise agreement"
        }
      ]
    }
  ],
  "version": "1.0",
  "last_updated": "2025-01-26T10:30:00.000Z"
}
```

### Submit Wizard Assessment

**Endpoint**: `POST /api/expertise-wizard/submit`

Submits a completed wizard assessment.

#### Request Body

```json
{
  "employer_id": "uuid",
  "steps": [
    {
      "wizard_step_id": "uuid",
      "step_response": {...},
      "response_value": "yes",
      "session_started_at": "2025-01-26T09:00:00.000Z"
    }
  ],
  "organiser_notes": "Comprehensive assessment completed with full confidence"
}
```

#### Response

```json
{
  "wizard_session_id": "uuid",
  "employer_id": "uuid",
  "organiser_id": "uuid",
  "session_date": "2025-01-26",
  "total_score": 85,
  "final_rating": "green",
  "completion_percentage": 100,
  "time_spent_minutes": 12,
  "assessment_summary": "Excellent performance with strong EBA compliance",
  "key_factors": ["Active enterprise agreement", "Good payment history"],
  "confidence_level": "high",
  "is_complete": true,
  "created_expertise_rating_id": "uuid"
}
```

---

## Final Ratings API

### Get Final Ratings

**Endpoint**: `GET /api/employers/{employerId}/ratings`

Retrieves final combined ratings for an employer.

#### Query Parameters

- `page` (number): Page number
- `pageSize` (number): Items per page (default: 10, max: 50)
- `status` (string): Filter by rating status
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort direction
- `dateFrom` (string): Start date filter
- `dateTo` (string): End date filter
- `includeInactive` (boolean): Include inactive ratings

#### Response

```json
{
  "ratings": [...],
  "current_rating": {
    "id": "uuid",
    "final_rating": "green",
    "final_score": 78,
    "project_based_rating": "green",
    "expertise_based_rating": "amber",
    "overall_confidence": "high",
    "rating_status": "active"
  },
  "summary": {
    "total_ratings": 5,
    "current_rating_score": 78,
    "rating_trend": "stable",
    "last_updated": "2025-01-26",
    "next_review_due": "2025-04-26"
  }
}
```

### Calculate Final Rating

**Endpoint**: `POST /api/employers/{employerId}/ratings`

Calculates a new final rating for an employer.

#### Request Body

```json
{
  "calculation_date": "2025-01-26",
  "project_weight": 0.6,
  "expertise_weight": 0.4,
  "eba_weight": 0.15,
  "calculation_method": "hybrid_method",
  "force_recalculate": false,
  "notes": "Monthly rating calculation"
}
```

#### Response

```json
{
  "rating_id": "uuid",
  "calculation_result": {
    "final_rating": "green",
    "final_score": 78,
    "overall_confidence": "high",
    "data_completeness": 85,
    "discrepancy_detected": false
  },
  "components": {
    "project_data": {...},
    "expertise_data": {...},
    "eba_data": {...}
  },
  "warnings": [],
  "recommendations": []
}
```

### Compare Ratings

**Endpoint**: `GET /api/employers/{employerId}/ratings/compare`

Compares project data vs expertise ratings for an employer.

#### Response

```json
{
  "employer_id": "uuid",
  "comparison_date": "2025-01-26",
  "project_vs_expertise": {
    "project_rating": "green",
    "project_score": 75,
    "expertise_rating": "amber",
    "expertise_score": 65,
    "rating_match": false,
    "discrepancy_level": "minor",
    "alignment_quality": "good"
  },
  "recommendations": {
    "immediate_actions": [...],
    "investigation_areas": [...],
    "data_improvements": [...]
  }
}
```

### Recalculate Rating

**Endpoint**: `POST /api/employers/{employerId}/ratings/recalculate`

Forces recalculation of an employer's rating (admin/lead organiser only).

#### Request Body

```json
{
  "project_weight": 0.7,
  "expertise_weight": 0.3,
  "force_recalculate": true,
  "custom_adjustment": 5,
  "adjustment_reason": "Updated weighting based on new guidelines",
  "approval_notes": "Approved by regional manager"
}
```

---

## Batch Operations API

### Execute Batch Operations

**Endpoint**: `POST /api/ratings/batch`

Executes batch rating operations on multiple employers (admin/lead organiser only).

#### Request Body

```json
{
  "operations": [
    {
      "operation_type": "calculate",
      "employer_ids": ["uuid1", "uuid2", "uuid3"],
      "parameters": {
        "calculation_date": "2025-01-26",
        "project_weight": 0.6
      }
    }
  ],
  "dry_run": false,
  "notification_preferences": {
    "email_on_completion": true
  }
}
```

#### Response

```json
{
  "batch_id": "uuid",
  "status": "completed",
  "total_operations": 3,
  "completed_operations": 3,
  "failed_operations": 0,
  "results": [
    {
      "employer_id": "uuid1",
      "operation_type": "calculate",
      "status": "success",
      "rating_id": "uuid"
    }
  ],
  "summary": {
    "ratings_calculated": 3,
    "total_processing_time_ms": 2500
  }
}
```

### Get Batch Status

**Endpoint**: `GET /api/ratings/batch?batchId={batchId}`

Checks the status of a batch operation.

---

## Analytics API

### Get Rating Trends

**Endpoint**: `GET /api/ratings/analytics/trends`

Retrieves rating trends and analytics.

#### Query Parameters

- `period` (string): Time period (`7d`, `30d`, `90d`, `180d`, `1y`)
- `employerType` (string): Filter by employer type
- `granularity` (string): Data granularity (`daily`, `weekly`, `monthly`)

#### Response

```json
{
  "overview": {
    "total_employers": 1250,
    "employers_with_ratings": 890,
    "current_rating_distribution": {
      "green": 450,
      "amber": 280,
      "red": 120,
      "unknown": 40
    }
  },
  "time_series": [...],
  "rating_changes": {
    "improvements": 45,
    "declines": 12,
    "net_change": 33
  },
  "insights": {
    "positive_trends": ["Increasing green ratings"],
    "concerns": ["High number of unknown ratings"],
    "recommendations": ["Focus on data collection"]
  }
}
```

### Export Data

**Endpoint**: `POST /api/ratings/export`

Exports rating data in various formats.

#### Request Body

```json
{
  "format": "csv",
  "employer_ids": ["uuid1", "uuid2"],
  "date_range": {
    "from": "2025-01-01",
    "to": "2025-01-31"
  },
  "rating_status": ["active"],
  "include_details": true,
  "include_history": false
}
```

#### Response

```json
{
  "export_id": "uuid",
  "status": "processing",
  "format": "csv",
  "record_count": 150,
  "expires_at": "2025-01-27T10:30:00.000Z"
}
```

---

## Maintenance API

### Refresh System

**Endpoint**: `POST /api/ratings/maintenance/refresh`

Refreshes materialized views, statistics, and cache (admin only).

#### Request Body

```json
{
  "operation": "all",
  "force_refresh": true,
  "dry_run": false
}
```

#### Response

```json
{
  "refresh_id": "uuid",
  "status": "completed",
  "operation": "all",
  "results": {
    "materialized_views": {
      "refreshed": ["view1", "view2"],
      "failed": [],
      "total_refresh_time_ms": 5000
    }
  },
  "performance_impact": {
    "duration": "15s",
    "estimated_user_impact": "moderate"
  }
}
```

---

## Mobile Dashboard API

### Get Dashboard Data

**Endpoint**: `GET /api/ratings/dashboard`

Mobile-optimized dashboard data for field use.

#### Query Parameters

- `limit` (number): Number of items to return (default: 10)
- `includeAlerts` (boolean): Include alert data (default: true)
- `patch` (string): Filter by patch ID

#### Response

```json
{
  "overview": {
    "total_employers": 1250,
    "rated_employers": 890,
    "current_rating_distribution": {...},
    "system_health": {
      "data_quality_score": 0.85,
      "active_alerts": 5
    }
  },
  "top_concerns": [...],
  "top_performers": [...],
  "recent_activities": [...],
  "alerts": [...],
  "quick_actions": {
    "pending_reviews": 12,
    "ratings_expiring_soon": 8
  }
}
```

---

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Standard endpoints**: 60 requests per minute
- **Expensive queries** (analytics, batch operations): 30 requests per minute
- **Relaxed endpoints** (configuration, simple lookups): 120 requests per minute
- **Authentication endpoints**: 10 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1643217060
Retry-After: 60
```

---

## Caching

The API implements intelligent caching to improve performance:

- **Dashboard data**: 5 minutes
- **Analytics data**: 10 minutes
- **Configuration data**: 1 hour
- **Export data**: Until expiration (24 hours)

Cache headers:

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

---

## Mobile Optimization

The API includes several optimizations for mobile use:

1. **Minimal data transfer**: Dashboard endpoints return only essential data
2. **Longer cache times**: Reduces battery usage and data costs
3. **Offline-friendly**: Data structured for easy local storage
4. **Progressive loading**: Critical data loads first, details load on demand

---

## Integration Examples

### JavaScript/TypeScript Example

```typescript
// Create compliance assessment
const createAssessment = async (projectId: string, assessmentData: any) => {
  const response = await fetch(`/api/projects/${projectId}/compliance-assessments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assessmentData),
  });

  return response.json();
};

// Get dashboard data
const getDashboard = async () => {
  const response = await fetch('/api/ratings/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.json();
};
```

### cURL Example

```bash
# Create compliance assessment
curl -X POST https://your-domain.com/api/projects/uuid/compliance-assessments \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "employer_id": "uuid",
    "project_id": "uuid",
    "assessment_type": "eca_status",
    "score": 25,
    "confidence_level": "high"
  }'

# Get dashboard data
curl -X GET https://your-domain.com/api/ratings/dashboard \
  -H "Authorization: Bearer your-token"

# Calculate final rating
curl -X POST https://your-domain.com/api/employers/uuid/ratings \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "project_weight": 0.6,
    "expertise_weight": 0.4,
    "eba_weight": 0.15
  }'
```

---

## Testing

The API includes comprehensive error handling and validation. When implementing:

1. Always validate request data before sending
2. Check HTTP status codes in responses
3. Handle rate limit responses appropriately
4. Implement retry logic for retryable errors
5. Log errors for debugging

### Testing Checklist

- [ ] Authentication with different user roles
- [ ] Request validation with invalid data
- [ ] Rate limiting behavior
- [ ] Error responses include proper information
- [ ] Mobile-optimized endpoints work correctly
- [ ] Batch operations handle errors gracefully
- [ ] Cache headers are respected

---

## Support

For API support, questions, or issues:

1. Check the API documentation first
2. Review error messages for specific guidance
3. Contact the development team with:
   - Request ID
   - Error details
   - Steps to reproduce
   - Browser/device information

## Version History

- **v1.0.0**: Initial release with complete rating system API
- Includes Track 1, Track 2, and Final Ratings APIs
- Mobile-optimized dashboard
- Batch operations and analytics
- Comprehensive error handling and validation

---

*Last updated: January 26, 2025*