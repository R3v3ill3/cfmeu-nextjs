# Mobile Search and Filtering Optimization Documentation

This document provides comprehensive guidance on implementing mobile search and filtering optimization to improve user efficiency and data discovery on mobile devices.

## Overview

The mobile search and filtering system consists of several interconnected components designed specifically for field workers and mobile productivity:

### Core Components

1. **MobileSearchInput** - Voice-enabled search input with mobile optimizations
2. **MobileEmployerSearch** - Specialized employer search with mobile features
3. **MobileProjectSearch** - Project discovery with location-based features
4. **MobileFilterPanel** - Touch-friendly filtering interface
5. **MobileSwipeFilters** - Gesture-based filter selection
6. **MobileTableWithSearch** - Enhanced table with integrated search
7. **SearchSuggestionsPanel** - Intelligent search suggestions
8. **SearchHistoryManager** - Search history and analytics system

## Key Features

### Voice Search Integration
- Web Speech API integration with offline fallback
- Multi-language support (optimized for Australian English)
- Voice commands for common operations
- Visual feedback during voice recognition
- Accent and dialect support for field workers

### Mobile-Optimized Interactions
- 44x44px minimum touch targets
- Pull-to-refresh functionality
- Swipe gestures for filter actions
- Haptic feedback support
- Progressive disclosure of advanced options

### Intelligent Search System
- Search history with local storage
- Contextual suggestions based on user role
- Trending searches analytics
- Weighted search results
- Offline search capabilities

## Implementation Guide

### Basic Usage

#### Simple Search Input

```tsx
import { MobileSearchInput } from '@/components/search/MobileSearchInput';

function MySearchComponent() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <MobileSearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      onSubmit={(query) => console.log('Search:', query)}
      placeholder="Search employers..."
      enableVoiceSearch={true}
      enableHistory={true}
      suggestions={searchSuggestions}
    />
  );
}
```

#### Advanced Employer Search

```tsx
import { MobileEmployerSearch } from '@/components/search/MobileEmployerSearch';
import type { Employer, EmployerSearchFilters } from '@/components/search/MobileEmployerSearch';

function EmployerSearchPage() {
  const [filters, setFilters] = useState<EmployerSearchFilters>({});

  return (
    <MobileEmployerSearch
      employers={employers}
      loading={loading}
      value={searchQuery}
      onChange={setSearchQuery}
      onSearch={handleSearch}
      filters={filters}
      onFiltersChange={setFilters}
      enableFilters={true}
      variant="cards"
      showEBABadge={true}
      showComplianceStatus={true}
      pullToRefresh={true}
      actions={[
        {
          icon: <Phone className="w-4 h-4" />,
          label: 'Call',
          onPress: (employer) => handleCall(employer),
          color: 'primary',
        },
      ]}
      quickFilters={[
        {
          key: 'with_eba',
          label: 'Has EBA',
          filter: { has_eba: true },
          icon: <Shield className="w-4 h-4" />,
        },
      ]}
    />
  );
}
```

#### Project Search with Location

```tsx
import { MobileProjectSearch } from '@/components/search/MobileProjectSearch';

function ProjectSearchPage() {
  const [userLocation] = useState({ lat: -33.8688, lng: 151.2093 });

  return (
    <MobileProjectSearch
      projects={projects}
      userLocation={userLocation}
      enableFilters={true}
      showMapView={true}
      showProgressBar={true}
      pullToRefresh={true}
      infiniteScroll={true}
      onLoadMore={loadMoreProjects}
      quickFilters={[
        {
          key: 'nearby',
          label: 'Near Me',
          filter: {
            radius: { lat: userLocation.lat, lng: userLocation.lng, km: 50 }
          },
          icon: <MapPin className="w-4 h-4" />,
        },
      ]}
    />
  );
}
```

### Filter Panel Integration

```tsx
import { MobileFilterPanel, FilterSection } from '@/components/ui/MobileFilterPanel';

function FilteredSearchPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});

  const filterSections: FilterSection[] = [
    {
      id: 'status',
      title: 'Status',
      type: 'multiselect',
      options: [
        { value: 'active', label: 'Active', count: 45 },
        { value: 'pending', label: 'Pending', count: 12 },
      ],
    },
    {
      id: 'employee_count',
      title: 'Employee Count',
      type: 'range',
      min: 0,
      max: 500,
      step: 10,
      unit: 'employees',
    },
    {
      id: 'has_eba',
      title: 'Has EBA',
      type: 'toggle',
    },
  ];

  return (
    <>
      {/* Your search content */}

      <MobileFilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={setFilters}
        onReset={() => setFilters({})}
        sections={filterSections}
        activeFiltersCount={Object.keys(filters).length}
      />
    </>
  );
}
```

### Swipe Filter Integration

```tsx
import { MobileSwipeFilters, QuickFilter } from '@/components/ui/MobileSwipeFilters';

function QuickFilterBar() {
  const [selectedFilters, setSelectedFilters] = useState({});

  const quickFilters: QuickFilter[] = [
    {
      id: 'has_eba',
      label: 'EBA',
      icon: <Shield className="w-5 h-5" />,
      color: 'success',
      active: selectedFilters.has_eba === true,
    },
    {
      id: 'compliant',
      label: 'Compliant',
      icon: <Star className="w-5 h-5" />,
      color: 'primary',
      active: selectedFilters.compliance_status?.includes('compliant'),
    },
  ];

  return (
    <MobileSwipeFilters
      quickFilters={quickFilters}
      onFilterToggle={(filterId, value) => {
        setSelectedFilters(prev => ({ ...prev, [filterId]: value }));
      }}
      variant="horizontal"
      groupByCategory={true}
      maxSelections={3}
    />
  );
}
```

### Search History Integration

```tsx
import { useSearchHistory, SearchContext } from '@/lib/search-history';

function SmartSearchPage() {
  const { suggestions, getSuggestions, addToHistory } = useSearchHistory();

  const searchContext: SearchContext = {
    page: 'employer_search',
    userRole: 'organizer',
    location: { lat: -33.8688, lng: 151.2093, address: 'Sydney' },
    recentActivity: [
      { type: 'employer_view', timestamp: Date.now() - 3600000 },
    ],
    preferences: {
      industries: ['Construction', 'Electrical'],
      locations: ['Sydney', 'Melbourne'],
    },
  };

  const handleSearch = async (query: string) => {
    // Add to search history
    addToHistory({
      query,
      category: 'employer',
      resultCount: results.length,
    });

    // Perform search
    await performSearch(query);
  };

  useEffect(() => {
    // Load contextual suggestions
    getSuggestions('', searchContext);
  }, []);

  return (
    {/* Your search implementation */}
  );
}
```

## Advanced Features

### Custom Voice Commands

```tsx
const customVoiceCommands = {
  'show me employers near me': () => {
    setFilters({ radius: { km: 50, lat: userLocation.lat, lng: userLocation.lng }});
  },
  'find high risk projects': () => {
    setFilters({ risk_level: ['high'] });
  },
  'show compliant employers': () => {
    setFilters({ compliance_status: ['compliant'] });
  },
};
```

### Search Analytics

```tsx
import { searchHistoryManager } from '@/lib/search-history';

function SearchAnalytics() {
  const stats = searchHistoryManager.getSearchStats();

  console.log('Search Analytics:', {
    totalSearches: stats.totalSearches,
    averagePerDay: stats.averageSearchesPerDay,
    topQueries: stats.mostPopularQueries,
    categories: stats.searchCategories,
  });

  return (
    <div>
      <h3>Search Statistics</h3>
      <p>Total searches: {stats.totalSearches}</p>
      <p>Average per day: {stats.averageSearchesPerDay.toFixed(1)}</p>
      <div>
        <h4>Top Queries:</h4>
        {stats.mostPopularQueries.map((query, index) => (
          <div key={index}>{index + 1}. {query}</div>
        ))}
      </div>
    </div>
  );
}
```

### Custom Filter Components

```tsx
import { FilterSection } from '@/components/ui/MobileFilterPanel';

// Custom date range filter
const CustomDateRangeFilter: React.FC<{
  value: { start?: string; end?: string };
  onChange: (value: { start?: string; end?: string }) => void;
}> = ({ value, onChange }) => (
  <div className="space-y-3">
    <input
      type="date"
      value={value.start || ''}
      onChange={(e) => onChange({ ...value, start: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    />
    <input
      type="date"
      value={value.end || ''}
      onChange={(e) => onChange({ ...value, end: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    />
  </div>
);

const customFilterSection: FilterSection = {
  id: 'custom_date',
  title: 'Custom Date Range',
  type: 'date', // This would be handled specially in your implementation
};
```

## Performance Optimizations

### Debounced Search

```tsx
import { useState, useEffect, useMemo } from 'react';

function useDebouncedSearch<T>(
  searchFunction: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useMemo(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setLoading(true);
        searchFunction(query).then(setResults).finally(() => setLoading(false));
      } else {
        setResults([]);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay, searchFunction]);

  useEffect(() => {
    return debouncedQuery;
  }, [debouncedQuery]);

  return { query, setQuery, results, loading };
}
```

### Virtual Scrolling

```tsx
import { FixedSizeList as List } from 'react-window';

function VirtualizedSearchResults({ results }: { results: any[] }) {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      <SearchResultItem result={results[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={results.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

## Accessibility Considerations

### Screen Reader Support

```tsx
<MobileSearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  onSubmit={handleSearch}
  aria-label="Search employers and projects"
  aria-describedby="search-help"
  role="searchbox"
  aria-expanded={showSuggestions}
  aria-activedescendant={activeSuggestionId}
/>

<div id="search-help" className="sr-only">
  Use voice search by tapping the microphone icon, or type to search
</div>
```

### Keyboard Navigation

```tsx
function handleKeyDown(e: React.KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActiveSuggestion(prev => Math.max(prev - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      if (activeSuggestion >= 0) {
        selectSuggestion(suggestions[activeSuggestion]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      clearSearch();
      break;
  }
}
```

## Testing Guidelines

### Unit Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileSearchInput } from '@/components/search/MobileSearchInput';

describe('MobileSearchInput', () => {
  it('should call onSubmit when Enter is pressed', () => {
    const onSubmit = jest.fn();
    render(
      <MobileSearchInput
        value="test query"
        onChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });

    expect(onSubmit).toHaveBeenCalledWith('test query');
  });

  it('should show voice search button when enabled', () => {
    render(
      <MobileSearchInput
        enableVoiceSearch={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Start voice search')).toBeInTheDocument();
  });
});
```

### E2E Tests

```typescript
// Cypress example
describe('Mobile Search Flow', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.visit('/search');
  });

  it('should perform voice search and show results', () => {
    cy.get('[data-testid="voice-search-button"]').click();
    cy.get('[data-testid="voice-feedback"]').should('be.visible');

    // Mock speech recognition
    cy.window().then((win) => {
      win.SpeechRecognition = class MockSpeechRecognition {
        start = () => {};
        onresult = (event: any) => {
          event.results[0][0].transcript = 'construction companies';
          event.results[0].isFinal = true;
        };
      };
    });

    cy.get('[data-testid="search-input"]').should('have.value', 'construction companies');
    cy.get('[data-testid="search-results"]').should('be.visible');
  });
});
```

## Deployment Considerations

### Service Worker for Offline Support

```typescript
// public/sw.js
const CACHE_NAME = 'search-cache-v1';
const urlsToCache = [
  '/api/search-suggestions',
  '/api/quick-filters',
  '/api/trending-searches',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});
```

### Progressive Web App Configuration

```json
// public/manifest.json
{
  "name": "CFMEU Mobile Search",
  "short_name": "CFMEU Search",
  "description": "Mobile-optimized employer and project search",
  "start_url": "/search",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## Best Practices

### Performance
- Implement debounced search to reduce API calls
- Use virtual scrolling for large result sets
- Cache search results and suggestions
- Optimize images for mobile devices
- Minimize JavaScript bundle size

### User Experience
- Provide immediate visual feedback for all interactions
- Use skeleton loaders for loading states
- Implement pull-to-refresh for content updates
- Support both voice and text input
- Remember user preferences and search history

### Accessibility
- Ensure minimum 44x44px touch targets
- Provide proper ARIA labels and descriptions
- Support keyboard navigation
- Maintain high contrast ratios for outdoor use
- Test with screen readers

### Security
- Sanitize all search inputs
- Implement rate limiting for search API calls
- Use HTTPS for all communications
- Validate filter parameters on the backend
- Implement proper authentication and authorization

## Troubleshooting

### Common Issues

1. **Voice Search Not Working**
   - Check browser support for Web Speech API
   - Ensure microphone permissions are granted
   - Test with HTTPS (required for voice APIs)

2. **Slow Search Performance**
   - Implement proper indexing on the backend
   - Add search result caching
   - Use pagination or infinite scrolling
   - Consider implementing search result pagination

3. **Touch Target Issues**
   - Ensure all interactive elements are at least 44x44px
   - Check for overlapping touch targets
   - Test on actual mobile devices, not just emulators

4. **Swipe Gestures Not Working**
   - Verify `touch-action: manipulation` CSS property
   - Check for conflicting touch event handlers
   - Ensure proper preventDefault() calls

### Debug Tools

```typescript
// Enable debug mode for search components
const DEBUG_MODE = process.env.NODE_ENV === 'development';

if (DEBUG_MODE) {
  console.log('Search Debug:', {
    query: searchQuery,
    filters: activeFilters,
    results: searchResults,
    performance: searchPerformance,
  });
}
```

## Support and Maintenance

### Regular Updates
- Update voice search models for better accuracy
- Refresh search suggestions based on user behavior
- Optimize performance based on analytics
- Add new filter options based on user feedback

### Monitoring
- Track search success rates
- Monitor voice search usage
- Analyze filter usage patterns
- Measure search result click-through rates

This comprehensive mobile search and filtering system provides field workers with powerful, intuitive tools to quickly find the information they need, dramatically improving productivity and user satisfaction.