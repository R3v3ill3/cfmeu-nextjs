"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MobileSearchInput, SearchSuggestion } from './MobileSearchInput';
import { MobileCard, MobileCardListItem } from '@/components/ui/MobileCard';
import { MobileTable } from '@/components/ui/MobileTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { mobileTokens, device } from '@/styles/mobile-design-tokens';
import {
  MapPin,
  Calendar,
  Users,
  Building2,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Filter,
  Star,
  Target,
  Flag,
  ChevronRight,
  MoreVertical,
  Package,
  Shield,
  Zap
} from 'lucide-react';

// Project interfaces
interface Project {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date?: string;
  completion_date?: string;
  estimated_value?: number;
  tier?: 'tier_1' | 'tier_2' | 'tier_3';
  industry?: string;
  description?: string;
  employer_count?: number;
  worker_count?: number;
  subcontractor_count?: number;
  compliance_score?: number;
  progress_percentage?: number;
  risk_level?: 'low' | 'medium' | 'high';
  tags?: string[];
  organizing_universe?: string;
  lead_organizer?: string;
  created_at?: string;
  updated_at?: string;
  lat?: number;
  lng?: number;
}

interface ProjectSearchFilters {
  status?: string[];
  tier?: string[];
  industry?: string[];
  state?: string[];
  city?: string[];
  value_range?: {
    min?: number;
    max?: number;
  };
  date_range?: {
    start?: string;
    end?: string;
  };
  risk_level?: string[];
  compliance_score_range?: {
    min?: number;
    max?: number;
  };
  has_organizers?: boolean;
  tags?: string[];
  organizing_universe?: string[];
  radius?: {
    lat?: number;
    lng?: number;
    km?: number;
  };
}

interface MobileProjectSearchProps {
  // Data props
  projects?: Project[];
  loading?: boolean;
  error?: string;

  // Search props
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (project: Project) => void;
  onSearch?: (query: string, filters: ProjectSearchFilters) => void;

  // Filter props
  enableFilters?: boolean;
  filters?: ProjectSearchFilters;
  onFiltersChange?: (filters: ProjectSearchFilters) => void;
  availableFilters?: {
    industries: Array<{ value: string; label: string; count: number }>;
    cities: Array<{ value: string; label: string; count: number }>;
    states: Array<{ value: string; label: string; count: number }>;
    tags: Array<{ value: string; label: string; count: number }>;
    organizingUniverses: Array<{ value: string; label: string; count: number }>;
  };

  // Display props
  variant?: 'list' | 'cards' | 'table';
  showMapView?: boolean;
  showProgressBar?: boolean;
  showComplianceScore?: boolean;
  maxResults?: number;

  // Mobile-specific props
  pullToRefresh?: boolean;
  infiniteScroll?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  userLocation?: { lat: number; lng: number };

  // Action props
  actions?: Array<{
    icon: React.ReactNode;
    label: string;
    onPress: (project: Project) => void;
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  }>;

  // Quick filters
  quickFilters?: Array<{
    key: string;
    label: string;
    filter: Partial<ProjectSearchFilters>;
    icon?: React.ReactNode;
    color?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  }>;

  // Styling
  className?: string;
  emptyMessage?: string;
}

export const MobileProjectSearch: React.FC<MobileProjectSearchProps> = ({
  projects = [],
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
  showMapView = true,
  showProgressBar = true,
  showComplianceScore = true,
  maxResults,
  pullToRefresh = true,
  infiniteScroll = false,
  onLoadMore,
  hasMore,
  userLocation,
  actions = [],
  quickFilters = [
    {
      key: 'active',
      label: 'Active',
      filter: { status: ['active'] },
      icon: <Play className="w-4 h-4" />,
      color: 'success' as const,
    },
    {
      key: 'nearby',
      label: 'Near Me',
      filter: userLocation ? {
        radius: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          km: 50
        }
      } : {},
      icon: <MapPin className="w-4 h-4" />,
      color: 'primary' as const,
    },
    {
      key: 'high_risk',
      label: 'High Risk',
      filter: { risk_level: ['high'] },
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'error' as const,
    },
    {
      key: 'tier_1',
      label: 'Tier 1',
      filter: { tier: ['tier_1'] },
      icon: <Star className="w-4 h-4" />,
      color: 'warning' as const,
    },
  ],
  className,
  emptyMessage = 'No projects found',
}) => {
  const [searchQuery, setSearchQuery] = useState(value);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'map'>(
    device.isMobile() ? 'cards' : 'table'
  );

  // Filter projects based on search query and filters
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.address?.toLowerCase().includes(query) ||
        project.city?.toLowerCase().includes(query) ||
        project.state?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        project.organizing_universe?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(project =>
        filters.status!.includes(project.status)
      );
    }

    if (filters.tier && filters.tier.length > 0) {
      filtered = filtered.filter(project =>
        project.tier && filters.tier!.includes(project.tier)
      );
    }

    if (filters.industry && filters.industry.length > 0) {
      filtered = filtered.filter(project =>
        project.industry && filters.industry!.includes(project.industry)
      );
    }

    if (filters.state && filters.state.length > 0) {
      filtered = filtered.filter(project =>
        project.state && filters.state!.includes(project.state)
      );
    }

    if (filters.city && filters.city.length > 0) {
      filtered = filtered.filter(project =>
        project.city && filters.city!.includes(project.city)
      );
    }

    if (filters.risk_level && filters.risk_level.length > 0) {
      filtered = filtered.filter(project =>
        project.risk_level && filters.risk_level!.includes(project.risk_level)
      );
    }

    if (filters.value_range) {
      const { min, max } = filters.value_range;
      filtered = filtered.filter(project => {
        const value = project.estimated_value || 0;
        return (min === undefined || value >= min) && (max === undefined || value <= max);
      });
    }

    if (filters.compliance_score_range) {
      const { min, max } = filters.compliance_score_range;
      filtered = filtered.filter(project => {
        const score = project.compliance_score || 0;
        return (min === undefined || score >= min) && (max === undefined || score <= max);
      });
    }

    if (filters.radius && filters.radius.lat && filters.radius.lng && filters.radius.km) {
      // Simple distance calculation (would use proper geospatial query in production)
      filtered = filtered.filter(project => {
        if (!project.lat || !project.lng) return false;
        const distance = calculateDistance(
          filters.radius!.lat!,
          filters.radius!.lng!,
          project.lat,
          project.lng
        );
        return distance <= filters.radius!.km!;
      });
    }

    // Sort by status priority and updated date
    filtered = filtered.sort((a, b) => {
      const statusPriority = {
        active: 4,
        planning: 3,
        on_hold: 2,
        completed: 1,
        cancelled: 0,
      };

      const aPriority = statusPriority[a.status] || 0;
      const bPriority = statusPriority[b.status] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Then by updated date (newest first)
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });

    // Limit results if specified
    if (maxResults) {
      filtered = filtered.slice(0, maxResults);
    }

    return filtered;
  }, [projects, searchQuery, filters, maxResults]);

  // Calculate distance between two points (simple haversine)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Generate search suggestions
  const searchSuggestions = useMemo((): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = [];

    // Add trending searches
    suggestions.push(
      { id: 'trending-1', text: 'Hospital construction', type: 'trending', count: 456 },
      { id: 'trending-2', text: 'School renovations', type: 'trending', count: 324 },
      { id: 'trending-3', text: 'Infrastructure projects', type: 'trending', count: 289 },
    );

    // Add location-based suggestions if user location is available
    if (userLocation) {
      suggestions.push({
        id: 'nearby',
        text: 'Projects near me',
        type: 'suggestion',
        count: 23,
      });
    }

    return suggestions;
  }, [userLocation]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onChange?.(query);
    onSearch?.(query, filters);
  }, [onChange, onSearch, filters]);

  // Handle quick filter selection
  const handleQuickFilter = useCallback((quickFilter: typeof quickFilters[0]) => {
    const newActiveFilter = activeQuickFilter === quickFilter.key ? null : quickFilter.key;
    setActiveQuickFilter(newActiveFilter);

    const newFilters = newActiveFilter
      ? quickFilter.filter
      : {}; // Clear quick filter

    onFiltersChange?.({ ...filters, ...newFilters });
  }, [activeQuickFilter, filters, onFiltersChange, quickFilters]);

  // Handle project selection
  const handleProjectSelect = useCallback((project: Project) => {
    onSelect?.(project);
  }, [onSelect]);

  // Status component
  const ProjectStatusBadge: React.FC<{ status: string; progress?: number }> = ({ status, progress }) => {
    const statusConfig = {
      planning: {
        color: 'secondary' as const,
        label: 'Planning',
        icon: <Clock className="w-3 h-3" />,
      },
      active: {
        color: 'success' as const,
        label: 'Active',
        icon: <Play className="w-3 h-3" />,
      },
      on_hold: {
        color: 'warning' as const,
        label: 'On Hold',
        icon: <Pause className="w-3 h-3" />,
      },
      completed: {
        color: 'primary' as const,
        label: 'Completed',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      cancelled: {
        color: 'error' as const,
        label: 'Cancelled',
        icon: <XCircle className="w-3 h-3" />,
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <Badge variant={config.color} className="text-xs">
        <span className="flex items-center gap-1">
          {config.icon}
          {config.label}
          {showProgressBar && status === 'active' && progress !== undefined && (
            <span className="ml-1">({progress}%)</span>
          )}
        </span>
      </Badge>
    );
  };

  // Tier component
  const ProjectTierBadge: React.FC<{ tier?: string }> = ({ tier }) => {
    if (!tier) return null;

    const tierConfig = {
      tier_1: { label: 'Tier 1', color: 'warning' as const },
      tier_2: { label: 'Tier 2', color: 'primary' as const },
      tier_3: { label: 'Tier 3', color: 'secondary' as const },
    };

    const config = tierConfig[tier as keyof typeof tierConfig];
    if (!config) return null;

    return <Badge variant={config.color} className="text-xs">{config.label}</Badge>;
  };

  // Risk level component
  const RiskLevelIndicator: React.FC<{ riskLevel?: string }> = ({ riskLevel }) => {
    if (!riskLevel || riskLevel === 'low') return null;

    const riskConfig = {
      medium: {
        color: 'warning' as const,
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'Medium Risk',
      },
      high: {
        color: 'error' as const,
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'High Risk',
      },
    };

    const config = riskConfig[riskLevel as keyof typeof riskConfig];
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

  // Project card component
  const ProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
    const distance = userLocation && project.lat && project.lng
      ? calculateDistance(userLocation.lat, userLocation.lng, project.lat, project.lng)
      : null;

    return (
      <MobileCardListItem
        index={index}
        totalItems={filteredProjects.length}
        clickable
        onPress={() => handleProjectSelect(project)}
        swipeActions={actions.length > 0 ? {
          left: actions.filter(action => action.color !== 'error').slice(0, 2),
          right: actions.filter(action => action.color === 'error').slice(0, 2),
        } : undefined}
        className="hover:shadow-md transition-shadow"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1 truncate">{project.name}</h3>
            {project.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
            <ProjectStatusBadge status={project.status} progress={project.progress_percentage} />
            <ProjectTierBadge tier={project.tier} />
          </div>
        </div>

        {/* Location */}
        {project.address && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {project.address}
              {project.city && `, ${project.city}`}
              {project.state && ` ${project.state}`}
              {distance && ` • ${distance.toFixed(1)}km away`}
            </span>
          </div>
        )}

        {/* Date information */}
        {(project.start_date || project.completion_date) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>
              {project.start_date && `Started ${new Date(project.start_date).toLocaleDateString()}`}
              {project.start_date && project.completion_date && ' • '}
              {project.completion_date && `Complete ${new Date(project.completion_date).toLocaleDateString()}`}
            </span>
          </div>
        )}

        {/* Progress bar for active projects */}
        {showProgressBar && project.status === 'active' && project.progress_percentage !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{project.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${project.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          {project.employer_count && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{project.employer_count} employer{project.employer_count !== 1 ? 's' : ''}</span>
            </div>
          )}
          {project.worker_count && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{project.worker_count} worker{project.worker_count !== 1 ? 's' : ''}</span>
            </div>
          )}
          {project.subcontractor_count && (
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{project.subcontractor_count} sub{project.subcontractor_count !== 1 ? 's' : ''}</span>
            </div>
          )}
          {project.estimated_value && (
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                ${(project.estimated_value / 1000000).toFixed(1)}M
              </span>
            </div>
          )}
        </div>

        {/* Compliance and risk indicators */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {showComplianceScore && project.compliance_score !== undefined && (
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">
                  Compliance: {project.compliance_score}%
                </span>
              </div>
            )}
          </div>
          <RiskLevelIndicator riskLevel={project.risk_level} />
        </div>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {project.tags.slice(0, 3).map((tag, tagIndex) => (
              <Badge key={tagIndex} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{project.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Organizing universe */}
        {project.organizing_universe && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Flag className="w-4 h-4 flex-shrink-0" />
            <span>{project.organizing_universe}</span>
          </div>
        )}
      </MobileCardListItem>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="p-4 pb-3">
          <MobileSearchInput
            value={value}
            onChange={handleSearch}
            onSubmit={handleSearch}
            placeholder="Search projects by name, location, or industry..."
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
                const isDisabled = filter.key === 'nearby' && !userLocation;

                return (
                  <Button
                    key={filter.key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => !isDisabled && handleQuickFilter(filter)}
                    disabled={isDisabled}
                    className={cn(
                      'flex-shrink-0 touch-manipulation',
                      'min-h-[44px] min-w-[44px]',
                      isActive && 'bg-blue-600 text-white',
                      isDisabled && 'opacity-50 cursor-not-allowed'
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

              {/* View mode toggle */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
                <Button
                  variant={viewMode === 'cards' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="min-h-[32px] min-w-[32px] p-0"
                >
                  <div className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="min-h-[32px] min-w-[32px] p-0"
                >
                  <div className="w-8 h-4 border border-gray-400" />
                </Button>
                {showMapView && (
                  <Button
                    variant={viewMode === 'map' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('map')}
                    className="min-h-[32px] min-w-[32px] p-0"
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      {searchQuery || Object.keys(filters).some(key => {
        const filterValue = filters[key as keyof ProjectSearchFilters];
        return filterValue !== undefined &&
               (Array.isArray(filterValue) ? filterValue.length > 0 : true);
      }) ? (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            {loading ? 'Searching...' : (
              <>
                Found {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
                {searchQuery && ` for "${searchQuery}"`}
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {loading && filteredProjects.length === 0 ? (
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
        ) : filteredProjects.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No projects found' : 'No projects available'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? `No projects match "${searchQuery}". Try different search terms or filters.`
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
        ) : viewMode === 'cards' ? (
          <div className="divide-y divide-gray-200">
            {filteredProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        ) : viewMode === 'table' ? (
          <MobileTable
            data={filteredProjects}
            columns={[
              {
                key: 'name',
                title: 'Project',
                render: (value, project) => (
                  <div>
                    <div className="font-medium">{value}</div>
                    {project.city && (
                      <div className="text-sm text-gray-500">{project.city}</div>
                    )}
                  </div>
                ),
                mobile: { priority: 'high' },
              },
              {
                key: 'status',
                title: 'Status',
                render: (_, project) => (
                  <ProjectStatusBadge status={project.status} />
                ),
                mobile: { priority: 'high' },
              },
              {
                key: 'tier',
                title: 'Tier',
                render: (_, project) => (
                  <ProjectTierBadge tier={project.tier} />
                ),
                mobile: { priority: 'medium' },
              },
              {
                key: 'estimated_value',
                title: 'Value',
                render: (value) => value ? `$${(value / 1000000).toFixed(1)}M` : '-',
                mobile: { priority: 'low' },
              },
              {
                key: 'worker_count',
                title: 'Workers',
                render: (value) => value?.toLocaleString() || '-',
                mobile: { priority: 'low' },
              },
            ]}
            variant="table"
            onRowClick={handleProjectSelect}
            className="border-t border-gray-200"
          />
        ) : (
          /* Map view placeholder - would integrate with mapping library */
          <div className="p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Map View</h3>
            <p className="text-gray-600 mb-4">
              Interactive map view coming soon...
            </p>
          </div>
        )}

        {/* Infinite scroll loading */}
        {infiniteScroll && hasMore && viewMode !== 'map' && (
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
      </div>

      {/* Filter panel placeholder */}
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

export default MobileProjectSearch;