"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mobileApi } from '@/lib/api/mobile-api-optimizations';
import { offlineSearchManager, type OfflineSearchResult } from '@/lib/search/offline';
import {
  Search,
  Building,
  Users,
  MapPin,
  ChevronRight,
  Star,
  AlertTriangle,
  TrendingUp,
  Clock,
  Filter,
  X,
  Wifi,
  WifiOff,
  Loader2,
  Map,
  FileText,
  Phone,
  Mail,
  Shield,
  DollarSign,
  Calendar,
  Tag
} from 'lucide-react';

// Universal search interfaces
export interface UniversalSearchResult {
  id: string;
  type: 'project' | 'employer' | 'worker' | 'site';
  title: string;
  subtitle?: string;
  description?: string;
  metadata: {
    // Project metadata
    stage?: string;
    value?: number;
    complianceRating?: 'green' | 'amber' | 'red';
    ebaStatus?: 'yes' | 'no' | 'pending';
    address?: string;
    builder?: string;
    startDate?: string;
    endDate?: string;

    // Employer metadata
    abn?: string;
    contactPhone?: string;
    contactEmail?: string;
    employeeCount?: number;
    industry?: string;

    // Worker metadata
    unionStatus?: 'member' | 'non_member' | 'potential' | 'declined';
    skills?: string[];
    role?: string;

    // Site metadata
    coordinates?: { lat: number; lng: number };
    distance?: number;
    lastVisited?: string;

    // Common metadata
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    lastUpdated?: string;
  };
  relevanceScore: number;
  location?: {
    latitude: number;
    longitude: number;
    distance?: number;
  };
}

export interface UniversalSearchFilters {
  entityTypes: string[];
  projectStage?: string;
  complianceRating?: string;
  ebaStatus?: string;
  unionStatus?: string;
  priority?: string;
  distance?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  valueRange?: {
    min: number;
    max: number;
  };
}

export interface UniversalSearchProps {
  // Core search functionality
  placeholder?: string;
  onResultSelect?: (result: UniversalSearchResult) => void;
  onResultsChange?: (results: UniversalSearchResult[]) => void;
  enableVoiceSearch?: boolean;
  enableFilters?: boolean;
  enableOfflineMode?: boolean;

  // User context for smart suggestions
  userRole?: 'admin' | 'lead_organiser' | 'organiser' | 'delegate' | 'viewer';
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  userPatches?: string[];

  // Styling and display
  className?: string;
  inputClassName?: string;
  maxResults?: number;
  groupByEntityType?: boolean;
  showMetadata?: boolean;
  compactMode?: boolean;

  // Advanced features
  enableSmartSuggestions?: boolean;
  enableLocationSearch?: boolean;
  enableFuzzySearch?: boolean;
  searchDebounceMs?: number;
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({
  placeholder = 'Search projects, employers, workers, and sites...',
  onResultSelect,
  onResultsChange,
  enableVoiceSearch = true,
  enableFilters = true,
  enableOfflineMode = true,
  userRole = 'organiser',
  userLocation,
  userPatches = [],
  className,
  inputClassName,
  maxResults = 50,
  groupByEntityType = true,
  showMetadata = true,
  compactMode = false,
  enableSmartSuggestions = true,
  enableLocationSearch = true,
  enableFuzzySearch = true,
  searchDebounceMs = 300,
}) => {
  // State management
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [filters, setFilters] = useState<UniversalSearchFilters>({ entityTypes: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize network status and search history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Load search history
      loadSearchHistory();

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query.trim());
      }, searchDebounceMs);
    } else {
      setResults([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, filters, searchDebounceMs]);

  // Load search history from localStorage
  const loadSearchHistory = useCallback(async () => {
    try {
      const history = localStorage.getItem('universal-search-history');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }

      // Load recent offline searches
      if (enableOfflineMode) {
        const offlineSearches = await offlineSearchManager.getRecentSearches(5);
        const offlineQueries = offlineSearches.map(search => search.query);
        setSearchHistory(prev => [...new Set([...prev, ...offlineQueries])]);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, [enableOfflineMode]);

  // Save search to history
  const saveToHistory = useCallback((searchQuery: string) => {
    try {
      const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 20);
      setSearchHistory(newHistory);
      localStorage.setItem('universal-search-history', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [searchHistory]);

  // Load smart suggestions
  const loadSmartSuggestions = useCallback(async (searchQuery: string) => {
    if (!enableSmartSuggestions) return [];

    const suggestions: string[] = [];

    try {
      // Load offline suggestions
      if (enableOfflineMode) {
        const offlineSuggestions = await offlineSearchManager.getSearchSuggestions(searchQuery, 8);
        suggestions.push(...offlineSuggestions.map(s => s.text));
      }

      // Add context-aware suggestions based on user role
      if (userRole) {
        const roleBasedSuggestions = getContextAwareSuggestions(searchQuery, userRole, userPatches);
        suggestions.push(...roleBasedSuggestions);
      }

      // Add location-based suggestions
      if (enableLocationSearch && userLocation) {
        const locationSuggestions = getLocationBasedSuggestions(searchQuery, userLocation);
        suggestions.push(...locationSuggestions);
      }

      return [...new Set(suggestions)].slice(0, 8);
    } catch (error) {
      console.error('Failed to load smart suggestions:', error);
      return [];
    }
  }, [enableSmartSuggestions, enableOfflineMode, userRole, userPatches, enableLocationSearch, userLocation]);

  // Get context-aware suggestions based on user role
  const getContextAwareSuggestions = (query: string, role: string, patches: string[]): string[] => {
    const suggestions: string[] = [];

    switch (role) {
      case 'organiser':
        if (patches.length > 0) {
          suggestions.push(`projects in ${patches[0]}`);
          suggestions.push('compliance issues');
          suggestions.push('sites needing visit');
          suggestions.push('union members');
        }
        break;
      case 'lead_organiser':
        suggestions.push('high risk projects');
        suggestions.push('pending audits');
        suggestions.push('delegate tasks');
        suggestions.push('eba negotiations');
        break;
      case 'admin':
        suggestions.push('system reports');
        suggestions.push('user management');
        suggestions.push('compliance dashboard');
        suggestions.push('data exports');
        break;
    }

    return suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()));
  };

  // Get location-based suggestions
  const getLocationBasedSuggestions = (query: string, location: { latitude: number; longitude: number }): string[] => {
    return [
      'nearby projects',
      'sites within 5km',
      'local employers',
      'projects in my area'
    ].filter(s => s.toLowerCase().includes(query.toLowerCase()));
  };

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    setIsSearching(true);

    try {
      let searchResults: UniversalSearchResult[] = [];

      if (isOnline) {
        // Online search
        searchResults = await performOnlineSearch(searchQuery, filters);
      } else if (enableOfflineMode) {
        // Offline search
        const offlineResults = await offlineSearchManager.performOfflineSearch(searchQuery, filters);
        searchResults = convertOfflineResults(offlineResults);
      }

      // Apply result filtering and sorting
      searchResults = applyResultFiltering(searchResults, filters);
      searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Limit results
      searchResults = searchResults.slice(0, maxResults);

      setResults(searchResults);
      onResultsChange?.(searchResults);

      // Save to history
      saveToHistory(searchQuery);

      // Save to offline cache if online
      if (isOnline && enableOfflineMode && searchResults.length > 0) {
        await offlineSearchManager.saveSearchQuery(searchQuery, filters, searchResults.length);
        await offlineSearchManager.saveSearchResults(
          `search_${Date.now()}`,
          searchResults.map(r => ({
            entityId: r.id,
            entityType: r.type,
            title: r.title,
            subtitle: r.subtitle,
            description: r.description,
            metadata: r.metadata
          }))
        );
      }
    } catch (error) {
      console.error('Search failed:', error);

      // Fallback to offline search if online search fails
      if (enableOfflineMode && isOnline) {
        try {
          const offlineResults = await offlineSearchManager.performOfflineSearch(searchQuery, filters);
          const convertedResults = convertOfflineResults(offlineResults);
          setResults(convertedResults.slice(0, maxResults));
          onResultsChange?.(convertedResults.slice(0, maxResults));
        } catch (offlineError) {
          console.error('Offline search fallback failed:', offlineError);
          setResults([]);
        }
      }
    } finally {
      setIsSearching(false);
    }
  }, [isOnline, filters, maxResults, enableOfflineMode, onResultsChange, saveToHistory]);

  // Perform online search
  const performOnlineSearch = async (searchQuery: string, searchFilters: UniversalSearchFilters): Promise<UniversalSearchResult[]> => {
    try {
      const response = await mobileApi.search(searchQuery, '/api/universal/search', {
        limit: maxResults * 2, // Fetch more to account for filtering
        fuzzy: enableFuzzySearch,
        fields: ['title', 'subtitle', 'description', 'metadata'],
        ...searchFilters,
        userRole,
        userLocation,
        userPatches
      });

      return response.map((item: any) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        metadata: item.metadata || {},
        relevanceScore: item.relevanceScore || Math.random(),
        location: item.location
      }));
    } catch (error) {
      console.error('Online search failed:', error);
      throw error;
    }
  };

  // Convert offline search results to universal format
  const convertOfflineResults = (offlineResults: OfflineSearchResult[]): UniversalSearchResult[] => {
    return offlineResults.map(result => ({
      id: result.entityId,
      type: result.entityType,
      title: result.title,
      subtitle: result.subtitle,
      description: result.description,
      metadata: result.metadata || {},
      relevanceScore: result.relevanceScore,
      location: result.metadata.coordinates ? {
        latitude: result.metadata.coordinates.lat,
        longitude: result.metadata.coordinates.lng
      } : undefined
    }));
  };

  // Apply additional filtering to results
  const applyResultFiltering = (searchResults: UniversalSearchResult[], searchFilters: UniversalSearchFilters): UniversalSearchResult[] => {
    return searchResults.filter(result => {
      // Entity type filter
      if (searchFilters.entityTypes.length > 0 && !searchFilters.entityTypes.includes(result.type)) {
        return false;
      }

      // Project-specific filters
      if (result.type === 'project') {
        if (searchFilters.projectStage && result.metadata.stage !== searchFilters.projectStage) {
          return false;
        }
        if (searchFilters.complianceRating && result.metadata.complianceRating !== searchFilters.complianceRating) {
          return false;
        }
        if (searchFilters.ebaStatus && result.metadata.ebaStatus !== searchFilters.ebaStatus) {
          return false;
        }
      }

      // Worker-specific filters
      if (result.type === 'worker') {
        if (searchFilters.unionStatus && result.metadata.unionStatus !== searchFilters.unionStatus) {
          return false;
        }
      }

      // Common filters
      if (searchFilters.priority && result.metadata.priority !== searchFilters.priority) {
        return false;
      }

      if (searchFilters.distance && result.location && userLocation) {
        const distance = calculateDistance(userLocation, result.location);
        if (distance > searchFilters.distance) {
          return false;
        }
      }

      if (searchFilters.tags && searchFilters.tags.length > 0) {
        const resultTags = result.metadata.tags || [];
        const hasMatchingTag = searchFilters.tags.some(tag => resultTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  };

  // Calculate distance between two points
  const calculateDistance = (point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLng = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle input change
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (newQuery.trim()) {
      setShowSuggestions(true);
      const smartSuggestions = await loadSmartSuggestions(newQuery.trim());
      setSuggestions(smartSuggestions);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle search submission
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      performSearch(query.trim());
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  // Handle result selection
  const handleResultSelect = (result: UniversalSearchResult) => {
    onResultSelect?.(result);
  };

  // Update filters
  const updateFilters = (newFilters: Partial<UniversalSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ entityTypes: [] });
  };

  // Get entity type icon
  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case 'project':
        return Building;
      case 'employer':
        return Users;
      case 'worker':
        return Shield;
      case 'site':
        return MapPin;
      default:
        return Search;
    }
  };

  // Get compliance rating color
  const getComplianceRatingColor = (rating?: string) => {
    switch (rating) {
      case 'green':
        return 'bg-green-500';
      case 'amber':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Group results by entity type
  const groupResultsByType = (searchResults: UniversalSearchResult[]) => {
    const grouped: Record<string, UniversalSearchResult[]> = {};

    searchResults.forEach(result => {
      if (!grouped[result.type]) {
        grouped[result.type] = [];
      }
      grouped[result.type].push(result);
    });

    return grouped;
  };

  const groupedResults = groupByEntityType ? groupResultsByType(results) : { all: results };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Search input */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-5 h-5 text-gray-400" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            className={cn(
              'pl-10 pr-24',
              compactMode ? 'h-10' : 'h-12',
              inputClassName
            )}
          />

          {/* Input action buttons */}
          <div className="absolute right-2 flex items-center gap-1">
            {/* Network status indicator */}
            <div className="flex items-center text-xs text-gray-500">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>

            {/* Voice search button */}
            {enableVoiceSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="w-8 h-8"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}

            {/* Filters button */}
            {enableFilters && (
              <Button
                type="button"
                variant={Object.keys(filters).some(key => filters[key as keyof UniversalSearchFilters]) ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="w-8 h-8"
              >
                <Filter className="w-4 h-4" />
              </Button>
            )}

            {/* Clear button */}
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuery('')}
                className="w-8 h-8"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 rounded-md"
                >
                  <TrendingUp className="w-3 h-3 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Search history section */}
            {searchHistory.length > 0 && (
              <div className="border-t border-gray-200 p-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500">
                  <Clock className="w-3 h-3" />
                  RECENT SEARCHES
                </div>
                {searchHistory.slice(0, 5).map((historyItem, index) => (
                  <button
                    key={`history-${index}`}
                    type="button"
                    onClick={() => handleSuggestionSelect(historyItem)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 rounded-md"
                  >
                    <Clock className="w-3 h-3 text-gray-400" />
                    {historyItem}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced filters panel */}
      {enableFilters && showFilters && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Advanced Filters</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Entity type filters */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Entity Types</label>
                {['project', 'employer', 'worker', 'site'].map(type => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.entityTypes.includes(type)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...filters.entityTypes, type]
                          : filters.entityTypes.filter(t => t !== type);
                        updateFilters({ entityTypes: newTypes });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>

              {/* Project stage filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Project Stage</label>
                <select
                  value={filters.projectStage || ''}
                  onChange={(e) => updateFilters({ projectStage: e.target.value || undefined })}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Stages</option>
                  <option value="pre_construction">Pre Construction</option>
                  <option value="construction">Construction</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Compliance rating filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Compliance</label>
                <select
                  value={filters.complianceRating || ''}
                  onChange={(e) => updateFilters({ complianceRating: e.target.value || undefined })}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Ratings</option>
                  <option value="green">Green</option>
                  <option value="amber">Amber</option>
                  <option value="red">Red</option>
                </select>
              </div>

              {/* Priority filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Priority</label>
                <select
                  value={filters.priority || ''}
                  onChange={(e) => updateFilters({ priority: e.target.value || undefined })}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-6">
          {Object.entries(groupedResults).map(([entityType, entityResults]) => (
            <div key={entityType}>
              {groupByEntityType && (
                <div className="flex items-center gap-2 mb-3">
                  {React.createElement(getEntityTypeIcon(entityType), {
                    className: 'w-5 h-5 text-gray-500'
                  })}
                  <h3 className="text-sm font-medium text-gray-900 capitalize">
                    {entityType === 'all' ? 'All Results' : `${entityType}s`} ({entityResults.length})
                  </h3>
                </div>
              )}

              <div className="space-y-3">
                {entityResults.map((result) => {
                  const Icon = getEntityTypeIcon(result.type);
                  return (
                    <div
                      key={result.id}
                      onClick={() => handleResultSelect(result)}
                      className={cn(
                        'flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors',
                        compactMode ? 'p-3' : 'p-4'
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          result.type === 'project' && 'bg-blue-100 text-blue-600',
                          result.type === 'employer' && 'bg-green-100 text-green-600',
                          result.type === 'worker' && 'bg-purple-100 text-purple-600',
                          result.type === 'site' && 'bg-orange-100 text-orange-600'
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {result.title}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {result.metadata.complianceRating && (
                              <div className={cn(
                                'w-2 h-2 rounded-full',
                                getComplianceRatingColor(result.metadata.complianceRating)
                              )} />
                            )}
                            {result.metadata.priority && (
                              <Badge variant="outline" className="text-xs">
                                {result.metadata.priority}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {result.subtitle && (
                          <p className="text-sm text-gray-600 mb-1">{result.subtitle}</p>
                        )}

                        {showMetadata && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {result.metadata.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {result.metadata.address}
                              </span>
                            )}

                            {result.metadata.contactPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {result.metadata.contactPhone}
                              </span>
                            )}

                            {result.metadata.stage && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {result.metadata.stage.replace('_', ' ')}
                              </span>
                            )}

                            {result.metadata.value && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${result.metadata.value.toLocaleString()}
                              </span>
                            )}

                            {result.location?.distance && (
                              <span className="flex items-center gap-1">
                                <Map className="w-3 h-3" />
                                {Math.round(result.location.distance)}km
                              </span>
                            )}

                            {result.metadata.lastUpdated && (
                              <span>
                                Updated {new Date(result.metadata.lastUpdated).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}

                        {result.metadata.tags && result.metadata.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.metadata.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {!isSearching && query && results.length === 0 && (
        <div className="mt-6 text-center py-8">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search terms or filters
          </p>
          {!isOnline && enableOfflineMode && (
            <div className="flex items-center justify-center gap-2 text-sm text-orange-600">
              <WifiOff className="w-4 h-4" />
              Offline mode - showing cached results only
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalSearch;