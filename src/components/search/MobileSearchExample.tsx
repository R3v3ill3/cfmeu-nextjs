"use client";

import {  useState, useEffect, useCallback  } from 'react';
import { cn } from '@/lib/utils';
import { MobileSearchInput } from './MobileSearchInput';
import { MobileEmployerSearch } from './MobileEmployerSearch';
import { MobileProjectSearch } from './MobileProjectSearch';
import { MobileFilterPanel, FilterSection } from '@/components/ui/MobileFilterPanel';
import { MobileSwipeFilters, QuickFilter } from '@/components/ui/MobileSwipeFilters';
import { MobileTableWithSearch } from '@/components/ui/MobileTableWithSearch';
import { SearchSuggestionsPanel } from './SearchSuggestionsPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchHistory, SearchContext } from '@/lib/search-history';
import {
  Search,
  Filter,
  Building2,
  MapPin,
  Calendar,
  Users,
  Shield,
  TrendingUp,
  Clock,
  Star,
  Target,
  Package,
  Zap
} from 'lucide-react';

// Mock data for demonstration
const mockEmployers = [
  {
    id: '1',
    name: 'ABC Construction',
    abn: '12345678901',
    address: '123 Main St, Sydney NSW 2000',
    phone: '02 1234 5678',
    email: 'info@abcconstruction.com.au',
    employee_count: 150,
    has_eba: true,
    eba_count: 3,
    compliance_status: 'compliant' as const,
    last_activity: '2024-01-15',
    rating: 4.5,
    industry: 'Construction',
    created_at: '2023-01-01',
    updated_at: '2024-01-15',
    projects_count: 12,
    workers_count: 250,
    status: 'active' as const,
    tags: ['Large Scale', 'Commercial', 'Union Friendly'],
  },
  {
    id: '2',
    name: 'Electrical Services Pty Ltd',
    abn: '98765432109',
    address: '456 Circuit Rd, Melbourne VIC 3000',
    phone: '03 9876 5432',
    email: 'contact@electricalservices.com.au',
    employee_count: 45,
    has_eba: false,
    eba_count: 0,
    compliance_status: 'pending' as const,
    last_activity: '2024-01-10',
    rating: 3.8,
    industry: 'Electrical',
    created_at: '2023-06-15',
    updated_at: '2024-01-10',
    projects_count: 8,
    workers_count: 60,
    status: 'active' as const,
    tags: ['Electrical', 'Maintenance', 'Industrial'],
  },
  {
    id: '3',
    name: 'Prime Plumbing Solutions',
    abn: '55566677788',
    address: '789 Pipeline Ave, Brisbane QLD 4000',
    phone: '07 5555 6666',
    email: 'admin@primeplumbing.com.au',
    employee_count: 25,
    has_eba: true,
    eba_count: 1,
    compliance_status: 'compliant' as const,
    last_activity: '2024-01-08',
    rating: 4.2,
    industry: 'Plumbing',
    created_at: '2023-03-20',
    updated_at: '2024-01-08',
    projects_count: 15,
    workers_count: 35,
    status: 'active' as const,
    tags: ['Plumbing', 'Residential', 'Commercial'],
  },
];

const mockProjects = [
  {
    id: '1',
    name: 'Sydney CBD Hospital Redevelopment',
    address: '1 Hospital Road, Sydney NSW 2000',
    city: 'Sydney',
    state: 'NSW',
    postcode: '2000',
    status: 'active' as const,
    start_date: '2023-06-01',
    completion_date: '2025-12-31',
    estimated_value: 250000000,
    tier: 'tier_1' as const,
    industry: 'Healthcare',
    description: 'Major redevelopment of Sydney CBD hospital including new wings and facilities.',
    employer_count: 12,
    worker_count: 450,
    subcontractor_count: 8,
    compliance_score: 92,
    progress_percentage: 65,
    risk_level: 'medium' as const,
    tags: ['Healthcare', 'Government', 'High Value'],
    organizing_universe: 'NSW Health',
    lead_organizer: 'John Smith',
    lat: -33.8688,
    lng: 151.2093,
  },
  {
    id: '2',
    name: 'Melbourne Residential Tower',
    address: '123 Queen St, Melbourne VIC 3000',
    city: 'Melbourne',
    state: 'VIC',
    postcode: '3000',
    status: 'active' as const,
    start_date: '2023-09-01',
    completion_date: '2024-12-31',
    estimated_value: 85000000,
    tier: 'tier_2' as const,
    industry: 'Residential',
    description: '35-story residential apartment tower in Melbourne CBD.',
    employer_count: 6,
    worker_count: 180,
    subcontractor_count: 4,
    compliance_score: 88,
    progress_percentage: 45,
    risk_level: 'low' as const,
    tags: ['Residential', 'High Rise', 'Private'],
    organizing_universe: 'Victorian Construction',
    lead_organizer: 'Sarah Wilson',
    lat: -37.8136,
    lng: 144.9631,
  },
];

export type SearchMode = 'employers' | 'projects' | 'unified';

interface MobileSearchExampleProps {
  mode?: SearchMode;
  userLocation?: { lat: number; lng: number; address?: string };
  userRole?: string;
  className?: string;
}

export const MobileSearchExample: React.FC<MobileSearchExampleProps> = ({
  mode = 'employers',
  userLocation = { lat: -33.8688, lng: 151.2093, address: 'Sydney, NSW' },
  userRole = 'organizer',
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>(mode);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search history integration
  const { addToHistory, getSuggestions } = useSearchHistory();
  const [searchContext] = useState<SearchContext>({
    page: `search_${searchMode}`,
    userRole,
    location: userLocation,
    recentActivity: [
      { type: 'employer_view', timestamp: Date.now() - 3600000 },
      { type: 'project_search', timestamp: Date.now() - 7200000 },
    ],
    preferences: {
      industries: ['Construction', 'Electrical'],
      locations: ['Sydney', 'Melbourne'],
      categories: ['Tier 1', 'Compliant'],
    },
  });

  // Quick filters for swipe functionality
  const quickFilters: QuickFilter[] = [
    {
      id: 'has_eba',
      label: 'EBA',
      icon: <Shield className="w-5 h-5" />,
      color: 'success',
      active: activeFilters.has_eba === true,
      description: 'Employers with Enterprise Bargaining Agreements',
    },
    {
      id: 'compliant',
      label: 'Compliant',
      icon: <Star className="w-5 h-5" />,
      color: 'primary',
      active: activeFilters.compliance_status?.includes('compliant'),
      description: 'Fully compliant employers',
    },
    {
      id: 'high_risk',
      label: 'High Risk',
      icon: <Target className="w-5 h-5" />,
      color: 'error',
      active: activeFilters.risk_level?.includes('high'),
      description: 'High risk projects requiring attention',
    },
    {
      id: 'nearby',
      label: 'Near Me',
      icon: <MapPin className="w-5 h-5" />,
      color: 'warning',
      active: !!activeFilters.radius,
      description: 'Employers and projects near your location',
    },
    {
      id: 'recent',
      label: 'Recent',
      icon: <Clock className="w-5 h-5" />,
      color: 'secondary',
      active: !!activeFilters.date_range,
      description: 'Recently active items',
    },
    {
      id: 'tier_1',
      label: 'Tier 1',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'primary',
      active: activeFilters.tier?.includes('tier_1'),
      description: 'Tier 1 major projects',
    },
  ];

  // Filter sections for the filter panel
  const filterSections: FilterSection[] = [
    {
      id: 'status',
      title: 'Status',
      type: 'multiselect',
      options: [
        { value: 'active', label: 'Active', count: 45 },
        { value: 'planning', label: 'Planning', count: 12 },
        { value: 'completed', label: 'Completed', count: 28 },
        { value: 'on_hold', label: 'On Hold', count: 3 },
      ],
    },
    {
      id: 'compliance',
      title: 'Compliance Status',
      type: 'multiselect',
      options: [
        { value: 'compliant', label: 'Compliant', count: 65 },
        { value: 'non_compliant', label: 'Non-Compliant', count: 8 },
        { value: 'pending', label: 'Pending', count: 15 },
      ],
    },
    {
      id: 'industry',
      title: 'Industry',
      type: 'multiselect',
      options: [
        { value: 'Construction', label: 'Construction', count: 42 },
        { value: 'Electrical', label: 'Electrical', count: 18 },
        { value: 'Plumbing', label: 'Plumbing', count: 15 },
        { value: 'HVAC', label: 'HVAC', count: 8 },
        { value: 'Healthcare', label: 'Healthcare', count: 5 },
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
      id: 'project_value',
      title: 'Project Value',
      type: 'range',
      min: 0,
      max: 500000000,
      step: 1000000,
      unit: '$',
    },
    {
      id: 'has_eba',
      title: 'Has EBA',
      type: 'toggle',
    },
  ];

  // Handle search
  const handleSearch = useCallback(async (query: string, filters?: Record<string, any>) => {
    setLoading(true);
    setSearchQuery(query);

    // Add to search history
    addToHistory({
      query,
      category: searchMode,
      resultCount: mockEmployers.length, // In real app, this would be the actual result count
    });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    setLoading(false);
  }, [addToHistory, searchMode]);

  // Handle filter toggle
  const handleFilterToggle = useCallback((filterId: string, value?: any) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };

      switch (filterId) {
        case 'has_eba':
          newFilters.has_eba = !prev.has_eba;
          break;
        case 'compliant':
          newFilters.compliance_status = !prev.compliance_status?.includes('compliant')
            ? ['compliant']
            : [];
          break;
        case 'high_risk':
          newFilters.risk_level = !prev.risk_level?.includes('high')
            ? ['high']
            : [];
          break;
        case 'nearby':
          newFilters.radius = !prev.radius ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            km: 50,
          } : undefined;
          break;
        case 'recent':
          newFilters.date_range = !prev.date_range ? {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          } : undefined;
          break;
        case 'tier_1':
          newFilters.tier = !prev.tier?.includes('tier_1')
            ? ['tier_1']
            : [];
          break;
        default:
          newFilters[filterId] = value;
      }

      return newFilters;
    });

    // Trigger search with new filters
    handleSearch(searchQuery, activeFilters);
  }, [activeFilters, handleSearch, searchQuery, userLocation]);

  // Handle filter panel
  const handleFilterApply = useCallback((filters: Record<string, any>) => {
    setActiveFilters(filters);
    handleSearch(searchQuery, filters);
    setShowFilterPanel(false);
  }, [handleSearch, searchQuery]);

  const handleFilterReset = useCallback(() => {
    setActiveFilters({});
    handleSearch(searchQuery, {});
    setShowFilterPanel(false);
  }, [handleSearch, searchQuery]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    handleSearch(suggestion, activeFilters);
  }, [handleSearch, activeFilters]);

  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* Search Mode Toggle */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex p-2 bg-gray-100">
          <Button
            variant={searchMode === 'employers' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSearchMode('employers')}
            className="flex-1 min-h-[44px] touch-manipulation"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Employers
          </Button>
          <Button
            variant={searchMode === 'projects' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSearchMode('projects')}
            className="flex-1 min-h-[44px] touch-manipulation"
          >
            <Target className="w-4 h-4 mr-2" />
            Projects
          </Button>
          <Button
            variant={searchMode === 'unified' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSearchMode('unified')}
            className="flex-1 min-h-[44px] touch-manipulation"
          >
            <Search className="w-4 h-4 mr-2" />
            All
          </Button>
        </div>

        {/* Search Input */}
        <div className="p-4">
          <MobileSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(query) => handleSearch(query, activeFilters)}
            placeholder={`Search ${searchMode === 'employers' ? 'employers' : searchMode === 'projects' ? 'projects' : 'everything'}...`}
            enableVoiceSearch={true}
            enableHistory={true}
            showSuggestions={true}
            className="mb-3"
          />
        </div>
      </div>

      {/* Quick Swipe Filters */}
      <div className="bg-white border-b border-gray-200 p-4">
        <MobileSwipeFilters
          quickFilters={quickFilters}
          onFilterToggle={handleFilterToggle}
          groupByCategory={true}
          variant="horizontal"
          showLabels={true}
          showBadges={true}
          compact={false}
          animated={true}
          maxSelections={3}
          minSelections={0}
          onFilterAnalytics={(action, filter) => {
            console.log(`Filter action: ${action}`, filter);
          }}
        />
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-hidden">
        {searchMode === 'employers' && (
          <MobileEmployerSearch
            employers={mockEmployers}
            loading={loading}
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            filters={activeFilters}
            onFiltersChange={setActiveFilters}
            enableFilters={true}
            availableFilters={{
              industries: [
                { value: 'Construction', label: 'Construction', count: 42 },
                { value: 'Electrical', label: 'Electrical', count: 18 },
              ],
            }}
            variant="cards"
            showEBABadge={true}
            showComplianceStatus={true}
            showEmployeeCount={true}
            pullToRefresh={true}
            infiniteScroll={false}
            actions={[
              {
                icon: <Package className="w-4 h-4" />,
                label: 'View Projects',
                onPress: (employer) => console.log('View projects for:', employer.name),
                color: 'primary',
              },
              {
                icon: <Users className="w-4 h-4" />,
                label: 'View Workers',
                onPress: (employer) => console.log('View workers for:', employer.name),
                color: 'secondary',
              },
            ]}
            quickFilters={[
              {
                key: 'with_eba',
                label: 'Has EBA',
                filter: { has_eba: true },
                icon: <Shield className="w-4 h-4" />,
              },
              {
                key: 'compliant',
                label: 'Compliant',
                filter: { compliance_status: ['compliant'] },
                icon: <Star className="w-4 h-4" />,
              },
            ]}
            emptyMessage="No employers found matching your criteria"
          />
        )}

        {searchMode === 'projects' && (
          <MobileProjectSearch
            projects={mockProjects}
            loading={loading}
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            filters={activeFilters}
            onFiltersChange={setActiveFilters}
            enableFilters={true}
            variant="cards"
            showMapView={true}
            showProgressBar={true}
            showComplianceScore={true}
            pullToRefresh={true}
            infiniteScroll={false}
            userLocation={userLocation}
            actions={[
              {
                icon: <Building2 className="w-4 h-4" />,
                label: 'View Details',
                onPress: (project) => console.log('View project details:', project.name),
                color: 'primary',
              },
              {
                icon: <Users className="w-4 h-4" />,
                label: 'View Workers',
                onPress: (project) => console.log('View workers for:', project.name),
                color: 'secondary',
              },
            ]}
            quickFilters={[
              {
                key: 'active',
                label: 'Active',
                filter: { status: ['active'] },
                icon: <Target className="w-4 h-4" />,
                color: 'success',
              },
              {
                key: 'high_risk',
                label: 'High Risk',
                filter: { risk_level: ['high'] },
                icon: <Shield className="w-4 h-4" />,
                color: 'error',
              },
            ]}
            emptyMessage="No projects found matching your criteria"
          />
        )}

        {searchMode === 'unified' && (
          <div className="p-4 space-y-6">
            {/* Unified search results would show both employers and projects mixed */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Employers</h3>
              <MobileEmployerSearch
                employers={mockEmployers}
                loading={loading}
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                variant="cards"
                showEBABadge={true}
                showComplianceStatus={true}
                maxResults={3}
                emptyMessage="No employers found"
              />
            </div>

            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Projects</h3>
              <MobileProjectSearch
                projects={mockProjects}
                loading={loading}
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                variant="cards"
                showProgressBar={true}
                maxResults={3}
                emptyMessage="No projects found"
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <MobileFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        initialFilters={activeFilters}
        sections={filterSections}
        activeFiltersCount={Object.keys(activeFilters).length}
        showSearch={true}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-4 right-4 z-30 flex flex-col gap-2">
        <Button
          variant="default"
          size="icon"
          onClick={() => setShowFilterPanel(true)}
          className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full shadow-lg touch-manipulation"
        >
          <Filter className="w-6 h-6" />
          {Object.keys(activeFilters).length > 0 && (
            <Badge variant="secondary" className="absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center text-xs">
              {Object.keys(activeFilters).length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MobileSearchExample;