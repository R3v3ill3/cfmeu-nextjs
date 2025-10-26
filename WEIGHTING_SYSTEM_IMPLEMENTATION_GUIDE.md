# CFMEU Employer Rating System - Weighting System Implementation Guide

## Overview

This guide demonstrates the complete implementation of the user-configurable weighting system for the CFMEU Employer Traffic Light Rating System. The system allows lead organisers and admin users to set bespoke weightings for different rating factors, providing flexibility and control over how employer ratings are calculated.

## System Architecture

### Core Components

1. **Database Schema** (`supabase/migrations/20251026010000_create_weighting_system_tables.sql`)
   - `user_weighting_profiles`: Main profile storage
   - `track1_weightings`: Project compliance data weightings
   - `track2_weightings`: Organiser expertise weightings
   - `weighting_templates`: Pre-configured templates
   - `weighting_change_history`: Audit trail
   - `weighting_performance_analytics`: Performance metrics
   - `weighting_preview_calculations`: Temporary preview storage

2. **TypeScript Types** (`src/lib/weighting-system/types/WeightingTypes.ts`)
   - Comprehensive type definitions for all weighting entities
   - Validation and error types
   - API request/response types
   - Analytics and comparison types

3. **Core Engine** (`src/lib/weighting-system/WeightingEngine.ts`)
   - Weight calculation algorithms
   - Rating application logic
   - Confidence calculation methods
   - Discrepancy detection

4. **Validation System** (`src/lib/weighting-system/WeightingValidator.ts`)
   - Real-time validation logic
   - Business rule enforcement
   - Error and warning generation
   - Quick validation for preview

5. **API Endpoints** (`src/app/api/weightings/`)
   - Main CRUD operations (`route.ts`)
   - Real-time preview (`preview/route.ts`)
   - Template management (`templates/route.ts`)

6. **React Hooks** (`src/hooks/`)
   - `useWeightingConfiguration.ts`: Profile management
   - `useWeightingPreview.ts`: Real-time preview
   - `useWeightingTemplates.ts`: Template management

7. **UI Components** (`src/components/weighting-system/`)
   - `WeightingManager.tsx`: Main management interface
   - `WeightingForm.tsx`: Configuration form
   - `WeightingPreview.tsx`: Preview component
   - `WeightingTemplates.tsx`: Template management
   - `WeightingComparison.tsx`: Comparison tool
   - Mobile-optimized components

## Quick Start

### 1. Database Setup

Run the migration to create the required tables:

```sql
-- The migration is automatically applied when you run:
npm run supabase:migrate
```

### 2. Basic Usage

```tsx
import { WeightingManager } from '@/components/weighting-system/WeightingManager';

function MyWeightingPage() {
  return (
    <WeightingManager
      userRole="lead_organiser"
      showPreview={true}
      showTemplates={true}
      showComparison={true}
    />
  );
}
```

### 3. Mobile-Optimized Usage

```tsx
import { MobileWeightingManager } from '@/components/weighting-system/MobileWeightingManager';

function MyMobileWeightingPage() {
  return (
    <MobileWeightingManager
      userRole="lead_organiser"
    />
  );
}
```

## Detailed Implementation

### 1. Creating a Weighting Profile

```tsx
import { useWeightingConfiguration } from '@/hooks/useWeightingConfiguration';

function CreateProfileExample() {
  const { createProfile } = useWeightingConfiguration();

  const handleCreateProfile = async () => {
    await createProfile({
      profile_name: "Lead Organiser Balanced",
      description: "Balanced approach for lead organisers",
      profile_type: "personal",
      user_role: "lead_organiser",
      employer_category_focus: "all",
      project_data_weight: 0.6,
      organiser_expertise_weight: 0.4,
      min_data_requirements: {
        min_project_assessments: 3,
        min_expertise_assessments: 1,
        min_data_age_days: 365,
        require_eba_status: false,
        require_safety_data: false
      },
      confidence_thresholds: {
        high_confidence_min: 0.8,
        medium_confidence_min: 0.6,
        low_confidence_min: 0.4,
        very_low_confidence_max: 0.4
      },
      is_default: false,
      is_public: false
    });
  };

  return (
    <button onClick={handleCreateProfile}>
      Create Profile
    </button>
  );
}
```

### 2. Updating Weightings

```tsx
import { useWeightingConfiguration } from '@/hooks/useWeightingConfiguration';

function UpdateWeightingsExample() {
  const {
    currentProfile,
    updateTrack1Weightings,
    updateTrack2Weightings
  } = useWeightingConfiguration();

  const handleUpdateTrack1 = async () => {
    if (!currentProfile) return;

    await updateTrack1Weightings({
      cbus_paying_weight: 0.20,
      safety_hsr_respect_weight: 0.25,
      union_relations_right_of_entry_weight: 0.15
    });
  };

  const handleUpdateTrack2 = async () => {
    if (!currentProfile) return;

    await updateTrack2Weightings({
      organiser_confidence_multiplier: 1.2,
      union_relations_overall_weight: 0.30
    });
  };

  return (
    <div>
      <button onClick={handleUpdateTrack1}>Update Project Data Weights</button>
      <button onClick={handleUpdateTrack2}>Update Expertise Weights</button>
    </div>
  );
}
```

### 3. Real-time Preview

```tsx
import { useWeightingPreview } from '@/hooks/useWeightingPreview';

function PreviewExample() {
  const {
    preview,
    generatePreview,
    loading,
    getSignificantChanges
  } = useWeightingPreview({
    autoDebounce: true,
    debounceMs: 800,
    sampleSize: 20
  });

  const handleGeneratePreview = async () => {
    await generatePreview({
      profile_id: "profile-id",
      proposed_changes: {
        track1: {
          cbus_paying_weight: 0.25
        }
      },
      sample_size: 25
    });
  };

  const significantChanges = getSignificantChanges();

  return (
    <div>
      <button onClick={handleGeneratePreview} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Preview'}
      </button>

      {preview && (
        <div>
          <h3>Preview Results</h3>
          <p>Ratings Improved: {preview.calculation_results?.summary_statistics?.ratings_improved}</p>
          <p>Ratings Declined: {preview.calculation_results?.summary_statistics?.ratings_declined}</p>

          {significantChanges.length > 0 && (
            <div>
              <h4>Significant Changes:</h4>
              <ul>
                {significantChanges.map((change, index) => (
                  <li key={index}>
                    {change.employer_name}: {change.previous_score} → {change.new_score}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4. Template Management

```tsx
import { useWeightingTemplates } from '@/hooks/useWeightingTemplates';

function TemplateExample() {
  const {
    templates,
    createTemplate,
    applyTemplate,
    getPopularTemplates
  } = useWeightingTemplates({
    targetRole: "lead_organiser"
  });

  const handleCreateTemplate = async () => {
    await createTemplate({
      template_name: "Conservative Lead Organiser",
      description: "Conservative weighting approach focused on compliance data",
      template_category: "intermediate",
      target_role: "lead_organiser",
      target_employer_type: "all",
      template_data: {
        profile_name: "Conservative Template",
        profile_type: "role_template",
        user_role: "lead_organiser",
        employer_category_focus: "all",
        project_data_weight: 0.7,
        organiser_expertise_weight: 0.3,
        track1_weightings: {
          cbus_paying_weight: 0.20,
          incolink_entitlements_weight: 0.20,
          safety_hsr_respect_weight: 0.25
        },
        track2_weightings: {
          organiser_confidence_multiplier: 0.8
        }
      }
    });
  };

  const handleApplyTemplate = async (templateId: string) => {
    await applyTemplate(templateId);
  };

  const popularTemplates = getPopularTemplates(3);

  return (
    <div>
      <button onClick={handleCreateTemplate}>Create Template</button>

      <div>
        <h3>Popular Templates:</h3>
        {popularTemplates.map((template) => (
          <div key={template.id}>
            <h4>{template.template_name}</h4>
            <p>{template.description}</p>
            <button onClick={() => handleApplyTemplate(template.id)}>
              Apply Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Weighting Comparison

```tsx
import { WeightingComparison } from '@/components/weighting-system/WeightingComparison';

function ComparisonExample() {
  const profiles = [
    { id: "1", profile_name: "Profile A", /* ... */ },
    { id: "2", profile_name: "Profile B", /* ... */ }
  ];

  return (
    <WeightingComparison
      profiles={profiles}
      currentProfile={profiles[0]}
      allowProfileSelection={true}
    />
  );
}
```

## Weighting Categories Explained

### Track 1 (Project Compliance Data) Weightings

**CBUS Compliance:**
- `cbus_paying_weight`: CBUS payment compliance
- `cbus_on_time_weight`: CBUS on-time payment record
- `cbus_all_workers_weight`: CBUS coverage for all workers

**Incolink Compliance:**
- `incolink_entitlements_weight`: Incolink entitlement compliance
- `incolink_on_time_weight`: Incolink on-time payment record
- `incolink_all_workers_weight`: Incolink coverage for all workers

**Union Relations:**
- `union_relations_right_of_entry_weight`: Union right of entry compliance
- `union_relations_delegate_accommodation_weight`: Delegate accommodation practices
- `union_relations_access_to_info_weight`: Information access transparency
- `union_relations_access_to_inductions_weight`: Union induction access

**Safety Performance:**
- `safety_hsr_respect_weight`: HSR respect
- `safety_general_standards_weight`: Overall safety standards
- `safety_incidents_weight`: Safety incident record

**Subcontractor Management:**
- `subcontractor_usage_levels_weight`: Subcontractor usage levels
- `subcontractor_practices_weight`: Management quality

**Builder-Specific (for builders only):**
- `builder_tender_consultation_weight`: Tender consultation practices
- `builder_communication_weight`: Communication quality
- `builder_delegate_facilities_weight`: Delegate facilities
- `builder_contractor_compliance_weight`: Contractor compliance
- `builder_eba_contractor_percentage_weight`: EBA contractor percentage

### Track 2 (Organiser Expertise) Weightings

**Individual Assessments:**
- `cbus_overall_assessment_weight`: Overall CBUS assessment
- `incolink_overall_assessment_weight`: Overall Incolink assessment
- `union_relations_overall_weight`: Overall union relations assessment
- `safety_culture_overall_weight`: Overall safety culture assessment

**Relationship Factors:**
- `historical_relationship_quality_weight`: Historical relationship quality
- `eba_status_weight`: Current EBA status

**Confidence Adjustment:**
- `organiser_confidence_multiplier`: Multiplier based on organiser reputation (0.5-2.0)

## Validation Rules

### Sum Requirements
- Main weightings (`project_data_weight` + `organiser_expertise_weight`) must sum to 1.0
- Track 1 category weights should ideally sum to 1.0 within their categories
- Track 2 assessment weights should sum to 1.0

### Range Validation
- All individual weights must be between 0.0 and 1.0
- Organiser confidence multiplier must be between 0.5 and 2.0
- Minimum data requirements must be within specified ranges

### Business Rules
- Lead organisers typically benefit from organiser expertise weight ≥ 0.3
- Admin users typically prioritize project data weight ≥ 0.6
- Extreme weightings (> 0.4 for individual factors) generate warnings
- High weighting on limited data points generates warnings

## Mobile Features

### Responsive Design
- Mobile-optimized components with touch-friendly interfaces
- Bottom sheets for mobile forms
- Swipe gestures and haptic feedback
- Collapsible sections for better mobile navigation

### Accessibility Features
- Full ARIA label support
- Keyboard navigation
- Screen reader compatibility
- High contrast mode support
- Focus management

### Offline Support
- Offline mode detection
- Cached data for offline viewing
- Sync when connection restored

## Performance Considerations

### Database Optimization
- Indexed queries for fast profile retrieval
- Materialized views for complex calculations
- Efficient join strategies for preview calculations

### Client-Side Optimization
- Debounced validation (500ms default)
- Lazy loading of preview data
- Optimistic updates for better UX
- Component-level memoization

### API Performance
- Request batching for multiple operations
- Cached preview calculations
- Efficient data pagination
- Compression for large datasets

## Security Features

### Access Control
- Row-level security (RLS) on all tables
- Role-based permissions
- User ownership validation
- Admin override capabilities

### Audit Trail
- Complete change history tracking
- User attribution for all changes
- Timestamped records
- IP address logging

### Data Validation
- Server-side validation enforcement
- SQL injection prevention
- Input sanitization
- Type safety throughout

## Monitoring and Analytics

### Performance Metrics
- Weighting calculation performance tracking
- API response time monitoring
- Database query optimization
- User interaction analytics

### Usage Analytics
- Template popularity tracking
- Weighting configuration analysis
- User preference patterns
- Effectiveness measurement

### Error Tracking
- Comprehensive error logging
- Validation failure tracking
- Performance issue detection
- User feedback collection

## Testing Strategy

### Unit Tests
- Weighting engine calculation tests
- Validation logic tests
- Type safety verification
- Edge case handling

### Integration Tests
- API endpoint testing
- Database interaction tests
- Hook functionality tests
- Component integration tests

### End-to-End Tests
- Complete user journey testing
- Mobile responsiveness testing
- Accessibility testing
- Performance testing

## Deployment Considerations

### Database Migration
- Zero-downtime migration strategy
- Data consistency validation
- Rollback procedures
- Performance monitoring

### Feature Flags
- Gradual rollout capability
- A/B testing support
- Emergency disable options
- User segmentation

### Monitoring Setup
- Application performance monitoring
- Database performance tracking
- Error alerting
- Usage analytics

## Future Enhancements

### Advanced Features
- Machine learning optimization suggestions
- Automatic weighting recommendations
- A/B testing framework
- Advanced analytics dashboard

### Integration Opportunities
- External data source integration
- Third-party analytics tools
- Reporting system integration
- Mobile app integration

### Scalability Improvements
- Distributed calculation engine
- Real-time collaboration features
- Advanced caching strategies
- Load balancing optimization

## Conclusion

The CFMEU Weighting System provides a comprehensive, user-configurable solution for employer rating calculations. It balances flexibility with validation, provides both desktop and mobile experiences, and includes robust security and performance features.

The system successfully enables lead organisers and admin users to:
- Configure bespoke weightings for different rating factors
- Maintain role-based weighting profiles
- Preview the impact of weighting changes in real-time
- Use pre-configured templates for common scenarios
- Compare different weighting configurations
- Access the system on mobile devices with full functionality

This implementation serves as a foundation for continuous improvement and adaptation to changing business requirements and user needs.