"use client";

import {  useState, useEffect, useCallback, useMemo  } from 'react'
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MobileSearchInput, SearchSuggestion } from './MobileSearchInput';
import { MobileCard, MobileCardListItem } from '@/components/ui/MobileCard';
import { MobileTable } from '@/components/ui/MobileTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { mobileTokens, device } from '@/styles/mobile-design-tokens';
import {
  Building2,
  MapPin,
  Users,
  Star,
  Phone,
  Mail,
  Globe,
  Calendar,
  Filter,
  ChevronRight,
  MoreVertical,
  TrendingUp,
  Clock,
  Shield,
  AlertCircle
} from 'lucide-react';

// Employer interfaces
interface Employer {
  id: string;
  name: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  employee_count?: number;
  has_eba?: boolean;
  eba_count?: number;
  compliance_status?: 'compliant' | 'non_compliant' | 'pending' | 'unknown';
  last_activity?: string;
  rating?: number;
  industry?: string;
  created_at?: string;
  updated_at?: string;
  projects_count?: number;
  workers_count?: number;
  status?: 'active' | 'inactive' | 'suspended';
  tags?: string[];
}

interface EmployerSearchFilters {
  has_eba?: boolean;
  compliance_status?: string[];
  industry?: string[];
  employee_count_range?: {
    min?: number;
    max?: number;
  };
  location?: string;
  status?: string[];
  date_range?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
}

interface MobileEmployerSearchProps {
  // Data props
  employers?: Employer[];
  loading?: boolean;
  error?: string;

  // Search props
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (employer: Employer) => void;
  onSearch?: (query: string, filters: EmployerSearchFilters) => void;

  // Filter props
  enableFilters?: boolean;
  filters?: EmployerSearchFilters;
  onFiltersChange?: (filters: EmployerSearchFilters) => void;
  availableFilters?: {
    industries: Array<{ value: string; label: string; count: number }>;
    locations: Array<{ value: string; label: string; count: number }>;
    tags: Array<{ value: string; label: string; count: number }>;
  };

  // Display props
  variant?: 'list' | 'cards' | 'table';
  showEBABadge?: boolean;
  showComplianceStatus?: boolean;
  showEmployeeCount?: boolean;
  showContactInfo?: boolean;
  maxResults?: number;

  // Mobile-specific props
  pullToRefresh?: boolean;
  infiniteScroll?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;

  // Action props
  actions?: Array<{
    icon: ReactNode;
    label: string;
    onPress: (employer: Employer) => void;
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  }>;

  // Quick filters
  quickFilters?: Array<{
    key: string;
    label: string;
    filter: Partial<EmployerSearchFilters>;
    icon?: ReactNode;
  }>;

  // Styling
  className?: string;
  emptyMessage?: string;
}

export const MobileEmployerSearch: React.FC<MobileEmployerSearchProps> = ({
  employers = [],
  loading = false,
  error,
  value = '',
  onChange,
  onSelect,
  onSearch,
  enableFilters = true,
  filters = {},
  onFiltersChange,
  availableFilters,
  variant = device.isMobile() ? 'cards' : 'table',
  showEBABadge = true,
  showComplianceStatus = true,
  showEmployeeCount = true,
  showContactInfo = false,
  maxResults,
  pullToRefresh = true,
  infiniteScroll = false,
  onLoadMore,
  hasMore,
  actions = [],
  quickFilters = [
    { key: 'with_eba', label: 'Has EBA', filter: { has_eba: true }, icon: <Shield className="w-4 h-4" /> },
    { key: 'compliant', label: 'Compliant', filter: { compliance_status: ['compliant'] }, icon: <Star className="w-4 h-4" /> },
    { key: 'recent', label: 'Recent', filter: { date_range: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } }, icon: <Clock className="w-4 h-4" /> },
  ],
  className,
  emptyMessage = 'No employers found',
}) => {
  const [searchQuery, setSearchQuery] = useState(value);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

  // Filter employers based on search query and filters
  const filteredEmployers = useMemo(() => {
    let filtered = employers;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(employer =>
        employer.name.toLowerCase().includes(query) ||
        employer.abn?.toLowerCase().includes(query) ||
        employer.industry?.toLowerCase().includes(query) ||
        employer.address?.toLowerCase().includes(query) ||
        employer.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.has_eba !== undefined) {
      filtered = filtered.filter(employer => employer.has_eba === filters.has_eba);
    }

    if (filters.compliance_status && filters.compliance_status.length > 0) {
      filtered = filtered.filter(employer =>
        filters.compliance_status!.includes(employer.compliance_status || 'unknown')
      );
    }

    if (filters.industry && filters.industry.length > 0) {
      filtered = filtered.filter(employer =>
        employer.industry && filters.industry!.includes(employer.industry)
      );
    }

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(employer =>
        filters.status!.includes(employer.status || 'active')
      );
    }

    if (filters.employee_count_range) {
      const { min, max } = filters.employee_count_range;
      filtered = filtered.filter(employer => {
        const count = employer.employee_count || 0;
        return (min === undefined || count >= min) && (max === undefined || count <= max);
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(employer =>
        employer.tags && filters.tags!.some(tag => employer.tags!.includes(tag))
      );
    }

    // Limit results if specified
    if (maxResults) {
      filtered = filtered.slice(0, maxResults);
    }

    return filtered;
  }, [employers, searchQuery, filters, maxResults]);

  // Generate search suggestions
  const searchSuggestions = useMemo((): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = [];

    // Add trending searches (simulated)
    suggestions.push(
      { id: 'trending-1', text: 'Construction companies', type: 'trending', count: 1234 },
      { id: 'trending-2', text: 'Electrical contractors', type: 'trending', count: 892 },
      { id: 'trending-3', text: 'Plumbing services', type: 'trending', count: 657 },
    );

    // Add recent searches (would come from local storage)
    const recentSearches = ['ABC Construction', 'BuildCo', 'Elite Trades'];
    recentSearches.forEach((search, index) => {
      suggestions.push({
        id: `recent-${index}`,
        text: search,
        type: 'history',
      });
    });

    return suggestions;
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onChange?.(query);
    onSearch?.(query, filters);
  }, [onChange, onSearch, filters]);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    if (pullToRefresh && onSearch) {
      setIsRefreshing(true);
      try {
        await onSearch(searchQuery, filters);
      } finally {
        setTimeout(() => setIsRefreshing(false), 500); // Minimum visual feedback
      }
    }
  }, [pullToRefresh, onSearch, searchQuery, filters]);

  // Handle quick filter selection
  const handleQuickFilter = useCallback((quickFilter: typeof quickFilters[0]) => {
    const newActiveFilter = activeQuickFilter === quickFilter.key ? null : quickFilter.key;
    setActiveQuickFilter(newActiveFilter);

    const newFilters = newActiveFilter
      ? quickFilter.filter
      : {}; // Clear quick filter

    onFiltersChange?.({ ...filters, ...newFilters });
  }, [activeQuickFilter, filters, onFiltersChange, quickFilters]);

  // Handle employer selection
  const handleEmployerSelect = useCallback((employer: Employer) => {
    onSelect?.(employer);
  }, [onSelect]);

  // Compliance status component
  const ComplianceStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status || status === 'unknown') return null;

    const statusConfig = {
      compliant: { color: 'success' as const, label: 'Compliant', icon: <Shield className="w-3 h-3" /> },
      non_compliant: { color: 'error' as const, label: 'Non-Compliant', icon: <AlertCircle className="w-3 h-3" /> },
      pending: { color: 'warning' as const, label: 'Pending', icon: <Clock className="w-3 h-3" /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <Badge variant={config.color} className="text-xs">
        <span className="flex items-center gap-1">
          {config.icon}
          {config.label}
        </span>
      </Badge>
    );
  };

  // Employer card component
  const EmployerCard: React.FC<{ employer: Employer; index: number }> = ({ employer, index }) => (
    <MobileCardListItem
      index={index}
      totalItems={filteredEmployers.length}
      clickable
      onPress={() => handleEmployerSelect(employer)}
      swipeActions={actions.length > 0 ? {
        left: actions.filter(action => action.color !== 'error').slice(0, 2),
        right: actions.filter(action => action.color === 'error').slice(0, 2),
      } : undefined}
      className="hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 truncate">{employer.name}</h3>
          </div>
          {employer.industry && (
            <p className="text-sm text-gray-600">{employer.industry}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showEBABadge && employer.has_eba && (
            <Badge variant="default" className="text-xs">EBA</Badge>
          )}
          {showComplianceStatus && (
            <ComplianceStatusBadge status={employer.compliance_status} />
          )}
        </div>
      </div>

      {/* Contact and location info */}
      <div className="space-y-2 mb-3">
        {employer.address && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{employer.address}</span>
          </div>
        )}

        {showContactInfo && (
          <>
            {employer.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{employer.phone}</span>
              </div>
            )}
            {employer.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{employer.email}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {showEmployeeCount && employer.employee_count && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">{employer.employee_count} employees</span>
          </div>
        )}
        {employer.projects_count && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">{employer.projects_count} projects</span>
          </div>
        )}
        {employer.workers_count && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">{employer.workers_count} workers</span>
          </div>
        )}
        {employer.eba_count && employer.eba_count > 0 && (
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">{employer.eba_count} EBAs</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {employer.tags && employer.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {employer.tags.slice(0, 3).map((tag, tagIndex) => (
            <Badge key={tagIndex} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {employer.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{employer.tags.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </MobileCardListItem>
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="p-4 pb-3">
          <MobileSearchInput
            value={value}
            onChange={handleSearch}
            onSubmit={handleSearch}
            placeholder="Search employers by name, ABN, or industry..."
            enableVoiceSearch={true}
            suggestions={searchSuggestions}
            enableHistory={true}
            showCancelButton={true}
            className="mb-3"
          />

          {/* Quick filters */}
          {quickFilters.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {quickFilters.map((filter) => {
                const isActive = activeQuickFilter === filter.key;
                return (
                  <Button
                    key={filter.key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickFilter(filter)}
                    className={cn(
                      'flex-shrink-0 touch-manipulation',
                      'min-h-[44px] min-w-[44px]',
                      isActive && 'bg-blue-600 text-white'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {filter.icon}
                      <span>{filter.label}</span>
                    </span>
                  </Button>
                );
              })}

              {enableFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterPanel(true)}
                  className="flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px]"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      {searchQuery || Object.keys(filters).some(key => {
        const filterValue = filters[key as keyof EmployerSearchFilters];
        return filterValue !== undefined &&
               (Array.isArray(filterValue) ? filterValue.length > 0 : true);
      }) ? (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            {loading ? 'Searching...' : (
              <>
                Found {filteredEmployers.length} employer{filteredEmployers.length !== 1 ? 's' : ''}
                {searchQuery && ` for "${searchQuery}"`}
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {loading && filteredEmployers.length === 0 ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <MobileCard key={index} loading>
                <SkeletonLoader lines={3} />
              </MobileCard>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <div className="text-red-500 mb-2">{error}</div>
            <Button onClick={() => handleSearch(searchQuery)} variant="outline">
              Try Again
            </Button>
          </div>
        ) : filteredEmployers.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No employers found' : 'No employers available'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? `No employers match "${searchQuery}". Try different search terms or filters.`
                : emptyMessage
              }
            </p>
            {(searchQuery || activeQuickFilter) && (
              <Button
                onClick={() => {
                  handleSearch('');
                  setActiveQuickFilter(null);
                  onFiltersChange?.({});
                }}
                variant="outline"
              >
                Clear Search & Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards view */}
            {variant === 'cards' && (
              <div className="divide-y divide-gray-200">
                {filteredEmployers.map((employer, index) => (
                  <EmployerCard key={employer.id} employer={employer} index={index} />
                ))}
              </div>
            )}

            {/* Table view for desktop */}
            {variant === 'table' && (
              <MobileTable
                data={filteredEmployers}
                columns={[
                  {
                    key: 'name',
                    title: 'Employer',
                    render: (value, employer) => (
                      <div className="font-medium">{value}</div>
                    ),
                    mobile: { priority: 'high' },
                  },
                  {
                    key: 'industry',
                    title: 'Industry',
                    mobile: { priority: 'medium' },
                  },
                  {
                    key: 'employee_count',
                    title: 'Employees',
                    render: (value) => value?.toLocaleString() || '-',
                    mobile: { priority: 'low' },
                  },
                  {
                    key: 'has_eba',
                    title: 'EBA',
                    render: (value) => value ? (
                      <Badge variant="default" className="text-xs">Yes</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No</Badge>
                    ),
                    mobile: { priority: 'medium' },
                  },
                  {
                    key: 'compliance_status',
                    title: 'Compliance',
                    render: (_, employer) => (
                      <ComplianceStatusBadge status={employer.compliance_status} />
                    ),
                    mobile: { priority: 'medium' },
                  },
                ]}
                variant="table"
                onRowClick={handleEmployerSelect}
                className="border-t border-gray-200"
              />
            )}

            {/* Infinite scroll loading */}
            {infiniteScroll && hasMore && (
              <div className="p-4 text-center">
                <Button
                  onClick={onLoadMore}
                  variant="outline"
                  disabled={loading}
                  className="min-h-[44px] min-w-[44px] touch-manipulation"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter panel placeholder - would be implemented as separate component */}
      {showFilterPanel && (
        <div className="fixed inset-0 z-50 flex items-end bg-black bg-opacity-50">
          <div className="bg-white w-full max-h-[80vh] rounded-t-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterPanel(false)}
              >
                Close
              </Button>
            </div>
            <div className="p-4">
              <p className="text-center text-gray-500 py-8">
                Advanced filters coming soon...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileEmployerSearch;