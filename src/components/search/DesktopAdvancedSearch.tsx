"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { desktopDesignSystem } from '@/lib/desktop-design-system';
import {
  Search,
  Mic,
  MicOff,
  X,
  History,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertTriangle,
  Building,
  Users,
  Star,
  Clock,
  Shield,
  Save,
  FolderOpen,
  Download,
  Upload,
  Settings,
  CheckSquare,
  Square,
  Grid3X3,
  List
} from 'lucide-react';

// Voice search interface
interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

// Search suggestion interface
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'trending' | 'suggestion';
  category?: string;
  count?: number;
}

// Advanced filter interfaces
interface SearchFilters {
  entityTypes: string[];
  projectStage?: string;
  complianceRating?: string;
  ebaStatus?: string;
  distance?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  unionMembership?: string;
  valueRange?: {
    min: number;
    max: number;
  };
}

interface QuickFilterPreset {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  filters: Partial<SearchFilters>;
  color: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: string;
  lastUsed: string;
  usageCount: number;
}

interface SearchResult {
  id: string;
  type: 'project' | 'employer' | 'worker' | 'site';
  title: string;
  subtitle?: string;
  description?: string;
  metadata: Record<string, any>;
  selected: boolean;
}

export interface DesktopAdvancedSearchProps {
  // Basic input props
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string, filters: SearchFilters) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;

  // Voice search props
  enableVoiceSearch?: boolean;
  onVoiceResult?: (result: VoiceRecognitionResult) => void;
  voiceLanguage?: string;

  // Search suggestions
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  showSuggestions?: boolean;
  maxSuggestions?: number;

  // Search history
  enableHistory?: boolean;
  searchHistory?: string[];
  onHistorySelect?: (query: string) => void;
  onHistoryClear?: () => void;

  // Advanced filtering
  enableAdvancedFilters?: boolean;
  filters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  quickFilterPresets?: QuickFilterPreset[];
  onQuickFilterSelect?: (preset: QuickFilterPreset) => void;
  enableFilterPersistence?: boolean;
  filterStorageKey?: string;

  // Search results
  results?: SearchResult[];
  onResultsChange?: (results: SearchResult[]) => void;
  enableBulkSelection?: boolean;
  onBulkAction?: (selectedIds: string[], action: string) => void;

  // Saved searches
  enableSavedSearches?: boolean;
  savedSearches?: SavedSearch[];
  onSaveSearch?: (search: Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'>) => void;
  onLoadSavedSearch?: (searchId: string) => void;
  onDeleteSavedSearch?: (searchId: string) => void;

  // View settings
  viewMode?: 'list' | 'grid';
  onViewModeChange?: (mode: 'list' | 'grid') => void;

  // Styling
  className?: string;
  inputClassName?: string;
  variant?: 'default' | 'compact' | 'expanded';
}

export const DesktopAdvancedSearch: React.FC<DesktopAdvancedSearchProps> = ({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Search employers, projects, or workers...',
  disabled = false,
  loading = false,
  enableVoiceSearch = true,
  onVoiceResult,
  voiceLanguage = 'en-AU',
  suggestions = [],
  onSuggestionSelect,
  showSuggestions = true,
  maxSuggestions = 10,
  enableHistory = true,
  searchHistory = [],
  onHistorySelect,
  onHistoryClear,
  enableAdvancedFilters = true,
  filters = { entityTypes: [] },
  onFiltersChange,
  quickFilterPresets = [],
  onQuickFilterSelect,
  enableFilterPersistence = true,
  filterStorageKey = 'desktop-search-filters',
  results = [],
  onResultsChange,
  enableBulkSelection = true,
  onBulkAction,
  enableSavedSearches = true,
  savedSearches = [],
  onSaveSearch,
  onLoadSavedSearch,
  onDeleteSavedSearch,
  viewMode = 'list',
  onViewModeChange,
  className,
  inputClassName,
  variant = 'default',
}) => {
  // State management
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>(filters);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>(results);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && enableVoiceSearch && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = voiceLanguage;
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognitionRef.current.onresult = (event: any) => {
          const result = event.results[0][0];
          const voiceResult: VoiceRecognitionResult = {
            transcript: result.transcript,
            confidence: result.confidence,
            isFinal: event.results[0].isFinal,
          };

          if (event.results[0].isFinal) {
            onChange?.(result.transcript);
            onVoiceResult?.(voiceResult);
            stopVoiceRecognition();
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Voice recognition error:', event.error);
          setVoiceError(getVoiceErrorMessage(event.error));
          stopVoiceRecognition();
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [enableVoiceSearch, voiceLanguage, onChange, onVoiceResult]);

  // Initialize default quick filter presets
  useEffect(() => {
    if (quickFilterPresets.length === 0) {
      // Default presets would be provided by props
    }
  }, [quickFilterPresets]);

  // Filter persistence in localStorage
  useEffect(() => {
    if (enableFilterPersistence && typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem(filterStorageKey);
        if (savedFilters) {
          const parsedFilters = JSON.parse(savedFilters);
          setActiveFilters(parsedFilters);
          onFiltersChange?.(parsedFilters);
        }
      } catch (error) {
        console.warn('Failed to load saved filters:', error);
      }
    }
  }, [enableFilterPersistence, filterStorageKey, onFiltersChange]);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (enableFilterPersistence && typeof window !== 'undefined') {
      try {
        localStorage.setItem(filterStorageKey, JSON.stringify(activeFilters));
      } catch (error) {
        console.warn('Failed to save filters:', error);
      }
    }
  }, [activeFilters, enableFilterPersistence, filterStorageKey]);

  // Sync filters with props
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(activeFilters)) {
      setActiveFilters(filters);
    }
  }, [filters]);

  // Sync results with props
  useEffect(() => {
    if (JSON.stringify(results) !== JSON.stringify(searchResults)) {
      setSearchResults(results);
    }
  }, [results]);

  // Voice recognition handlers
  const startVoiceRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      setVoiceError('Voice search not supported in this browser');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      setVoiceError('Failed to start voice search');
    }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const getVoiceErrorMessage = (error: string): string => {
    switch (error) {
      case 'not-allowed':
        return 'Microphone access denied. Please enable microphone permissions.';
      case 'no-speech':
        return 'No speech detected. Please try again.';
      case 'network':
        return 'Network error. Please check your connection.';
      case 'service-not-allowed':
        return 'Voice recognition service not available.';
      default:
        return 'Voice search error. Please try again.';
    }
  };

  // Filter management functions
  const updateFilter = useCallback((filterUpdates: Partial<SearchFilters>) => {
    const newFilters = { ...activeFilters, ...filterUpdates };
    setActiveFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [activeFilters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    const clearedFilters: SearchFilters = { entityTypes: [] };
    setActiveFilters(clearedFilters);
    setActiveQuickFilter(null);
    onFiltersChange?.(clearedFilters);
  }, [onFiltersChange]);

  const applyQuickFilter = useCallback((preset: QuickFilterPreset) => {
    setActiveQuickFilter(preset.id);
    const newFilters = { ...activeFilters, ...preset.filters };
    setActiveFilters(newFilters);
    onFiltersChange?.(newFilters);
    onQuickFilterSelect?.(preset);
  }, [activeFilters, onFiltersChange, onQuickFilterSelect]);

  const hasActiveFilters = useCallback(() => {
    return (
      activeFilters.entityTypes.length > 0 ||
      !!activeFilters.projectStage ||
      !!activeFilters.complianceRating ||
      !!activeFilters.ebaStatus ||
      !!activeFilters.distance ||
      !!activeFilters.dateRange ||
      (activeFilters.tags && activeFilters.tags.length > 0) ||
      !!activeFilters.priority ||
      !!activeFilters.unionMembership ||
      !!activeFilters.valueRange
    );
  }, [activeFilters]);

  // Search handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    setShowSuggestionsPanel(true);
  }, [onChange]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) {
      onSubmit?.(value.trim(), activeFilters);
      setShowSuggestionsPanel(false);
      setActiveSuggestionIndex(-1);
    }
  }, [value, activeFilters, onSubmit]);

  // Bulk selection handlers
  const toggleAllSelection = useCallback(() => {
    const allSelected = searchResults.every(result => result.selected);
    const newResults = searchResults.map(result => ({ ...result, selected: !allSelected }));
    setSearchResults(newResults);
    onResultsChange?.(newResults);
  }, [searchResults, onResultsChange]);

  const toggleSelection = useCallback((resultId: string) => {
    const newResults = searchResults.map(result =>
      result.id === resultId ? { ...result, selected: !result.selected } : result
    );
    setSearchResults(newResults);
    onResultsChange?.(newResults);
  }, [searchResults, onResultsChange]);

  const getSelectedCount = useCallback(() => {
    return searchResults.filter(result => result.selected).length;
  }, [searchResults]);

  // Saved search handlers
  const handleSaveSearch = useCallback(() => {
    const searchName = prompt('Enter a name for this search:');
    if (searchName && onSaveSearch) {
      onSaveSearch({
        name: searchName,
        query: value,
        filters: activeFilters,
      });
    }
  }, [value, activeFilters, onSaveSearch]);

  // Styling variants
  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
        return 'p-4';
      case 'expanded':
        return 'p-6';
      default:
        return 'p-4';
    }
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Main search container */}
      <Card className={cn(desktopDesignSystem.components.card.base, getVariantClasses())}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Advanced Search
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center border border-gray-300 rounded-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewModeChange?.('list')}
                  className={cn(
                    'px-3 py-1 rounded-r-none border-r border-gray-300',
                    viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewModeChange?.('grid')}
                  className={cn(
                    'px-3 py-1 rounded-l-none',
                    viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>

              {/* Save search button */}
              {enableSavedSearches && (value.trim() || hasActiveFilters()) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSearch}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Search
                </Button>
              )}

              {/* Saved searches button */}
              {enableSavedSearches && savedSearches.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavedSearches(!showSavedSearches)}
                  className="flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  Saved Searches ({savedSearches.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick filter presets */}
          {enableAdvancedFilters && (quickFilterPresets.length > 0 || activeQuickFilter) && (
            <div className="flex flex-wrap gap-2">
              {(quickFilterPresets.length > 0 ? quickFilterPresets : [
                {
                  id: 'active-projects',
                  name: 'Active Projects',
                  icon: Building,
                  description: 'Projects currently under construction',
                  filters: { entityTypes: ['projects'], projectStage: 'construction' },
                  color: 'bg-blue-500'
                },
                {
                  id: 'nearby-projects',
                  name: 'Nearby Projects',
                  icon: MapPin,
                  description: 'Projects within 10km',
                  filters: { entityTypes: ['projects'], distance: 10 },
                  color: 'bg-green-500'
                },
                {
                  id: 'high-risk',
                  name: 'High Risk',
                  icon: AlertTriangle,
                  description: 'Compliance issues',
                  filters: { entityTypes: ['projects'], complianceRating: 'red', priority: 'high' },
                  color: 'bg-red-500'
                }
              ]).map((preset) => {
                const Icon = preset.icon;
                const isActive = activeQuickFilter === preset.id;

                return (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => isActive ? clearAllFilters() : applyQuickFilter(preset)}
                    className={cn(
                      'flex items-center gap-2',
                      isActive && preset.color
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {preset.name}
                    {isActive && <X className="w-3 h-3 ml-1" />}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Search input row */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <form onSubmit={handleSubmit}>
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-5 h-5 text-gray-400" />
                  <Input
                    ref={inputRef}
                    type="search"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => {
                      setIsFocused(true);
                      setShowSuggestionsPanel(true);
                    }}
                    onBlur={() => {
                      setIsFocused(false);
                      setTimeout(() => setShowSuggestionsPanel(false), 150);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                      'pl-10 pr-24',
                      desktopDesignSystem.components.card.interactive,
                      inputClassName
                    )}
                  />

                  {/* Input action buttons */}
                  <div className="absolute right-2 flex items-center gap-1">
                    {/* Voice search button */}
                    {enableVoiceSearch && !disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                        className={cn(
                          'w-8 h-8',
                          isListening ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'
                        )}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                    )}

                    {/* Clear button */}
                    {value && !disabled && !loading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onChange?.('')}
                        className="w-8 h-8 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>

              {/* Suggestions panel */}
              {showSuggestionsPanel && (showSuggestions || (enableHistory && searchHistory.length > 0)) && (
                <div className={cn(
                  'absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50',
                  'max-h-80 overflow-y-auto'
                )}>
                  {/* History section */}
                  {!value.trim() && enableHistory && searchHistory.length > 0 && (
                    <div className="border-b border-gray-200">
                      <div className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Recent Searches</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onHistoryClear}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </Button>
                      </div>
                      {searchHistory.slice(0, 5).map((item, index) => (
                        <button
                          key={`history-${index}`}
                          type="button"
                          onClick={() => {
                            onChange?.(item);
                            onHistorySelect?.(item);
                            setShowSuggestionsPanel(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <History className="w-3 h-3 text-gray-400" />
                          {item}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestions section */}
                  {value.trim() && suggestions.length > 0 && (
                    <div>
                      {suggestions.slice(0, maxSuggestions).map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => {
                            onChange?.(suggestion.text);
                            onSuggestionSelect?.(suggestion);
                            setShowSuggestionsPanel(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Search className="w-3 h-3 text-gray-400" />
                          <div className="flex-1">
                            <div className="text-gray-900">{suggestion.text}</div>
                            {suggestion.category && (
                              <div className="text-xs text-gray-500">in {suggestion.category}</div>
                            )}
                          </div>
                          {suggestion.count && (
                            <span className="text-xs text-gray-400">{suggestion.count.toLocaleString()}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Advanced filters toggle */}
            {enableAdvancedFilters && (
              <Button
                type="button"
                variant={hasActiveFilters() ? 'default' : 'outline'}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters() && (
                  <Badge variant="secondary" className="ml-1">
                    {Object.values(activeFilters).filter(v =>
                      v !== undefined && v !== null &&
                      (Array.isArray(v) ? v.length > 0 : true)
                    ).length}
                  </Badge>
                )}
              </Button>
            )}

            {/* Search button */}
            <Button
              type="submit"
              onClick={() => handleSubmit()}
              disabled={disabled || loading || !value.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </Button>
          </div>

          {/* Advanced filters panel */}
          {enableAdvancedFilters && showAdvancedFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Advanced Filters
                </h3>
                {hasActiveFilters() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Entity types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search in
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'projects', label: 'Projects', icon: Building },
                      { value: 'employers', label: 'Employers', icon: Users },
                      { value: 'workers', label: 'Workers', icon: Users },
                      { value: 'sites', label: 'Sites', icon: MapPin },
                    ].map((option) => {
                      const Icon = option.icon;
                      const isSelected = activeFilters.entityTypes.includes(option.value);

                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newTypes = checked
                                ? [...activeFilters.entityTypes, option.value]
                                : activeFilters.entityTypes.filter(t => t !== option.value);
                              updateFilter({ entityTypes: newTypes });
                            }}
                          />
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Project filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Details
                  </label>
                  <div className="space-y-3">
                    <select
                      value={activeFilters.projectStage || ''}
                      onChange={(e) => updateFilter({ projectStage: e.target.value || undefined })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Stages</option>
                      <option value="pre_construction">Pre Construction</option>
                      <option value="construction">Under Construction</option>
                      <option value="archived">Archived</option>
                      <option value="future">Future</option>
                    </select>

                    <select
                      value={activeFilters.priority || ''}
                      onChange={(e) => updateFilter({
                        priority: e.target.value ? e.target.value as 'low' | 'medium' | 'high' : undefined
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>

                    <select
                      value={activeFilters.ebaStatus || ''}
                      onChange={(e) => updateFilter({ ebaStatus: e.target.value || undefined })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All EBA Status</option>
                      <option value="yes">Has EBA</option>
                      <option value="no">No EBA</option>
                      <option value="pending">EBA Pending</option>
                    </select>
                  </div>
                </div>

                {/* Compliance and location filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Compliance & Location
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Compliance Rating</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'green', label: 'Green', color: 'bg-green-500' },
                          { value: 'amber', label: 'Amber', color: 'bg-yellow-500' },
                          { value: 'red', label: 'Red', color: 'bg-red-500' },
                        ].map((rating) => {
                          const isSelected = activeFilters.complianceRating === rating.value;

                          return (
                            <Button
                              key={rating.value}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateFilter({
                                complianceRating: isSelected ? undefined : rating.value
                              })}
                              className="flex items-center justify-center gap-1"
                            >
                              <div className={cn('w-2 h-2 rounded-full', rating.color)} />
                              {rating.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Distance: {activeFilters.distance || 10}km
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={activeFilters.distance || 10}
                        onChange={(e) => updateFilter({ distance: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Date range filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={activeFilters.dateRange?.start || ''}
                      onChange={(e) => updateFilter({
                        dateRange: {
                          ...activeFilters.dateRange,
                          start: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="date"
                      value={activeFilters.dateRange?.end || ''}
                      onChange={(e) => updateFilter({
                        dateRange: {
                          ...activeFilters.dateRange,
                          end: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Value range filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Value Range
                  </label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="Min value"
                      value={activeFilters.valueRange?.min || ''}
                      onChange={(e) => updateFilter({
                        valueRange: {
                          ...activeFilters.valueRange,
                          min: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max value"
                      value={activeFilters.valueRange?.max || ''}
                      onChange={(e) => updateFilter({
                        valueRange: {
                          ...activeFilters.valueRange,
                          max: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Union membership filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Union Membership
                  </label>
                  <select
                    value={activeFilters.unionMembership || ''}
                    onChange={(e) => updateFilter({ unionMembership: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Members</option>
                    <option value="member">Union Member</option>
                    <option value="non_member">Non Member</option>
                    <option value="potential">Potential Member</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved searches panel */}
      {enableSavedSearches && showSavedSearches && savedSearches.length > 0 && (
        <Card className={desktopDesignSystem.components.card.base}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Saved Searches
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSavedSearches(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedSearches.map((savedSearch) => (
                <div
                  key={savedSearch.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    onLoadSavedSearch?.(savedSearch.id);
                    setShowSavedSearches(false);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{savedSearch.name}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSavedSearch?.(savedSearch.id);
                      }}
                      className="w-6 h-6 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 truncate">{savedSearch.query}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{savedSearch.usageCount} uses</span>
                    <span>{new Date(savedSearch.lastUsed).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search results with bulk actions */}
      {searchResults.length > 0 && (
        <Card className={desktopDesignSystem.components.card.base}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Search Results ({searchResults.length})
              </CardTitle>
              {enableBulkSelection && (
                <div className="flex items-center gap-3">
                  {getSelectedCount() > 0 && (
                    <>
                      <span className="text-sm text-gray-600">
                        {getSelectedCount()} selected
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onBulkAction?.(
                            searchResults.filter(r => r.selected).map(r => r.id),
                            'export'
                          )}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onBulkAction?.(
                            searchResults.filter(r => r.selected).map(r => r.id),
                            'assign'
                          )}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllSelection}
                    className="flex items-center gap-2"
                  >
                    {searchResults.every(r => r.selected) ? (
                      <>
                        <Square className="w-4 h-4" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        Select All
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'list' ? (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50',
                      result.selected && 'bg-blue-50 border-blue-300'
                    )}
                  >
                    {enableBulkSelection && (
                      <Checkbox
                        checked={result.selected}
                        onCheckedChange={() => toggleSelection(result.id)}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {result.type}
                        </Badge>
                        <h4 className="font-medium text-gray-900">{result.title}</h4>
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-gray-600">{result.subtitle}</p>
                      )}
                      {result.description && (
                        <p className="text-sm text-gray-500 mt-1">{result.description}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={cn(
                      'p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer',
                      result.selected && 'bg-blue-50 border-blue-300'
                    )}
                  >
                    {enableBulkSelection && (
                      <div className="flex justify-end mb-2">
                        <Checkbox
                          checked={result.selected}
                          onCheckedChange={() => toggleSelection(result.id)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-xs">
                        {result.type}
                      </Badge>
                      <h4 className="font-medium text-gray-900">{result.title}</h4>
                      {result.subtitle && (
                        <p className="text-sm text-gray-600">{result.subtitle}</p>
                      )}
                      {result.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">{result.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Voice error message */}
      {voiceError && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-900">Voice Search Error</h4>
              <p className="text-sm text-red-700 mt-1">{voiceError}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setVoiceError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopAdvancedSearch;