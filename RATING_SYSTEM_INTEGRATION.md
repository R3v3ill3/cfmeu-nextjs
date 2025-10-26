# CFMEU Rating System Integration

This document outlines the complete integration of the employer traffic light rating system into the existing CFMEU application.

## Overview

The rating system provides a two-track assessment of employers based on:
1. **Project Data** - Quantitative metrics from project performance
2. **Organiser Expertise** - Qualitative assessment from field experience

## Integration Architecture

### 1. Data Flow

```
Database → API Routes → React Query Hooks → Components → UI
    ↓           ↓            ↓              ↓       ↓
Supabase → /api/ratings → useRatings() → RatingDisplay → User
```

### 2. Key Components

#### Core Infrastructure
- **`src/hooks/useRatings.ts`** - React Query hooks for data fetching
- **`src/context/RatingContext.tsx`** - Global state management
- **`src/types/rating.ts`** - TypeScript type definitions

#### UI Components
- **`src/components/ratings/RatingDisplay.tsx`** - Rating badge and display components
- **`src/components/ratings/RatingFilters.tsx`** - Filter components
- **`src/components/ratings/RatingErrorBoundary.tsx`** - Error handling

#### Optimization
- **`src/hooks/useRatingOptimization.ts`** - Performance optimization hooks

### 3. Integration Points

#### Employer Cards (`src/components/employers/EmployerCard.tsx`)
- Added rating display in badges section
- Shows compact rating badge with confidence indicator
- Includes trend information when available

#### Project Cards (`src/components/projects/ProjectCard.tsx`)
- Added builder rating section
- Shows rating for primary contractor/builder
- Integrated with existing project data

#### Navigation (`src/components/Layout.tsx`)
- Added "Ratings" menu item for organiser+ roles
- Links to `/ratings` dashboard
- Uses TrendingUp icon

#### Search & Filtering
- Added rating filter to employer search
- Integrated with existing filter system
- Supports multiple rating levels

#### Mobile Views
- Created responsive rating dashboard (`/ratings`)
- Optimized for touch interfaces
- Integrated with existing mobile layout

## Usage Examples

### Displaying Employer Ratings

```tsx
import { RatingDisplay } from "@/components/ratings/RatingDisplay"

// In employer card
<RatingDisplay
  employerId={employer.id}
  employerName={employer.name}
  variant="compact"
  showDetails={true}
/>
```

### Using Rating Filters

```tsx
import { RatingFiltersComponent } from "@/components/ratings/RatingFilters"

// In search page
<RatingFiltersComponent
  onFiltersChange={handleFilterChange}
  showResetButton={true}
/>
```

### Accessing Rating Data

```tsx
import { useEmployerRatings } from "@/hooks/useRatings"
import { useRatingContext } from "@/context/RatingContext"

// Hook usage
const { data: ratingData, isLoading } = useEmployerRatings(employerId)

// Context usage
const { state, setFilters, refreshData } = useRatingContext()
```

## Performance Features

### 1. Caching
- LRU cache for rating data
- React Query caching with configurable TTL
- Filter result caching

### 2. Optimizations
- Debounced search
- Throttled updates
- Virtual scrolling for large lists
- Prefetching for likely-to-be-viewed data

### 3. Error Handling
- Comprehensive error boundaries
- Graceful degradation
- Retry mechanisms
- Error reporting

## Mobile Optimization

### Touch Interface
- Minimum touch target size (44px)
- Gesture-friendly controls
- Optimized layouts

### Performance
- Reduced bundle size
- Lazy loading components
- Optimized API calls

### Offline Support
- Cached rating data
- Sync when online
- Offline indicators

## Data Integration

### Existing Data Sources
- **Employer profiles** - Basic employer information
- **Project assignments** - Project-based metrics
- **EBA records** - Enterprise agreement data
- **Worker placements** - Employment metrics

### New Data Tables
- `employer_ratings` - Rating calculations
- `rating_history` - Historical data
- `rating_weightings` - Configuration

## API Endpoints

### Rating Data
- `GET /api/ratings/employers/{id}` - Individual employer rating
- `GET /api/ratings/employers/bulk` - Multiple employers
- `GET /api/ratings/search` - Search and filter
- `GET /api/ratings/stats` - Statistics

### Rating Management
- `POST /api/ratings/calculate` - Calculate new rating
- `PUT /api/ratings/weightings/{id}` - Update weights
- `POST /api/ratings/alerts/{id}/acknowledge` - Acknowledge alerts

## Configuration

### Feature Flags
- `NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS` - Server-side processing
- `NEXT_PUBLIC_SHOW_DEBUG_BADGES` - Debug information

### Cache Settings
- Default TTL: 5 minutes for rating data
- Stats cache: 10 minutes
- Maximum cache size: 100 items

## Testing

### Component Tests
- Rating display components
- Filter functionality
- Error boundaries

### Integration Tests
- Data flow testing
- API integration
- User workflows

### Performance Tests
- Load testing
- Cache effectiveness
- Mobile performance

## Deployment Considerations

### Database Migrations
- Rating tables and indexes
- Data migration scripts
- Backward compatibility

### Monitoring
- Error tracking
- Performance metrics
- Usage analytics

### Rollback Plan
- Feature flags for disabling
- Database rollback procedures
- UI fallbacks

## Future Enhancements

### Advanced Features
- Machine learning predictions
- Advanced analytics
- Export capabilities

### Integration Opportunities
- Calendar integration
- Notification system
- Reporting dashboard

## Troubleshooting

### Common Issues
1. **Rating not showing** - Check API endpoints and data availability
2. **Slow performance** - Verify caching configuration
3. **Mobile layout issues** - Check responsive design settings
4. **Filter problems** - Validate filter syntax and data types

### Debug Tools
- React DevTools for component state
- Network tab for API calls
- Console for error messages
- Performance profiling

## Support

For issues with the rating system integration:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Confirm database migrations have run
4. Review feature flag settings

---

**Last Updated**: October 26, 2025
**Version**: 1.0.0
**Maintainer**: CFMEU Development Team