"use client";

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mobileTokens } from '@/styles/mobile-design-tokens';
import {
  SearchSuggestion,
  useSearchHistory,
  SearchContext
} from '@/lib/search-history';
import {
  Clock,
  TrendingUp,
  Star,
  MapPin,
  Mic,
  Users,
  Building2,
  X,
  ChevronRight,
  Sparkles,
  Brain
} from 'lucide-react';

export interface SearchSuggestionsPanelProps {
  query: string;
  onSelect: (suggestion: SearchSuggestion | string) => void;
  onClear?: () => void;
  maxSuggestions?: number;
  showHistory?: boolean;
  showTrending?: boolean;
  showContextual?: boolean;
  context?: SearchContext;
  className?: string;
  showCategories?: boolean;
  groupByCategory?: boolean;
  onSelectAnalytics?: (suggestion: SearchSuggestion) => void;
}

// Icon mapping for suggestion types
const getSuggestionIcon = (type: SearchSuggestion['type']) => {
  switch (type) {
    case 'history': return <Clock className="w-4 h-4" />;
    case 'trending': return <TrendingUp className="w-4 h-4" />;
    case 'popular': return <Star className="w-4 h-4" />;
    case 'recent': return <Clock className="w-4 h-4" />;
    case 'contextual': return <Sparkles className="w-4 h-4" />;
    case 'voice': return <Mic className="w-4 h-4" />;
    default: return <Search className="w-4 h-4" />;
  }
};

// Color mapping for suggestion types
const getSuggestionColorClass = (type: SearchSuggestion['type']) => {
  switch (type) {
    case 'history': return 'text-gray-500';
    case 'trending': return 'text-green-500';
    case 'popular': return 'text-yellow-500';
    case 'recent': return 'text-blue-500';
    case 'contextual': return 'text-purple-500';
    case 'voice': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

// Category mapping
const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'location': return <MapPin className="w-3 h-3" />;
    case 'industry': return <Building2 className="w-3 h-3" />;
    case 'role': return <Users className="w-3 h-3" />;
    case 'activity': return <Brain className="w-3 h-3" />;
    case 'voice': return <Mic className="w-3 h-3" />;
    default: return null;
  }
};

export const SearchSuggestionsPanel: React.FC<SearchSuggestionsPanelProps> = ({
  query,
  onSelect,
  onClear,
  maxSuggestions = 8,
  showHistory = true,
  showTrending = true,
  showContextual = true,
  context,
  className,
  showCategories = true,
  groupByCategory = false,
  onSelectAnalytics,
}) => {
  const {
    suggestions,
    loading,
    getSuggestions,
    getHistory,
    getTrendingSearches,
    clearHistory,
    addToHistory,
  } = useSearchHistory();

  const [activeIndex, setActiveIndex] = useState(-1);
  const [showMore, setShowMore] = useState(false);

  // Load suggestions when query or context changes
  useEffect(() => {
    const debouncedLoad = setTimeout(() => {
      getSuggestions(query, context);
    }, 300);

    return () => clearTimeout(debouncedLoad);
  }, [query, context, getSuggestions]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const filteredSuggestions = getFilteredSuggestions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev + 1;
          return next < filteredSuggestions.length ? next : 0;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev - 1;
          return next >= 0 ? next : filteredSuggestions.length - 1;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filteredSuggestions[activeIndex]) {
          handleSelect(filteredSuggestions[activeIndex]);
        } else if (query.trim()) {
          handleSelect(query);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClear?.();
        break;
    }
  }, [activeIndex, query, onClear]);

  // Handle suggestion selection
  const handleSelect = useCallback((suggestion: SearchSuggestion | string) => {
    if (typeof suggestion === 'string') {
      onSelect(suggestion);
      addToHistory({ query: suggestion, category: 'manual_search' });
    } else {
      onSelect(suggestion.text);
      onSelectAnalytics?.(suggestion);
      addToHistory({
        query: suggestion.text,
        category: suggestion.category || 'suggestion',
        resultCount: suggestion.metadata?.resultCount,
      });
    }
  }, [onSelect, addToHistory, onSelectAnalytics]);

  // Get filtered suggestions
  const getFilteredSuggestions = useCallback((): SearchSuggestion[] => {
    let filtered = [...suggestions];

    // Filter by type based on props
    if (!showHistory) {
      filtered = filtered.filter(s => s.type !== 'history' && s.type !== 'recent');
    }
    if (!showTrending) {
      filtered = filtered.filter(s => s.type !== 'trending' && s.type !== 'popular');
    }
    if (!showContextual) {
      filtered = filtered.filter(s => s.type !== 'contextual');
    }

    return filtered.slice(0, maxSuggestions);
  }, [suggestions, showHistory, showTrending, showContextual, maxSuggestions]);

  const filteredSuggestions = getFilteredSuggestions();

  // Group suggestions by category
  const groupedSuggestions = useMemo(() => {
    if (!groupByCategory) return {};

    const groups: Record<string, SearchSuggestion[]> = {};
    filteredSuggestions.forEach(suggestion => {
      const category = suggestion.category || 'general';
      if (!groups[category]) groups[category] = [];
      groups[category].push(suggestion);
    });

    return groups;
  }, [filteredSuggestions, groupByCategory]);

  // Clear search history
  const handleClearHistory = useCallback(() => {
    clearHistory();
    getSuggestions(query, context);
  }, [clearHistory, getSuggestions, query, context]);

  // Render suggestion item
  const renderSuggestionItem = useCallback((
    suggestion: SearchSuggestion,
    index: number,
    isActive: boolean
  ) => {
    const isTypeOnly = showCategories && suggestion.category && !groupByCategory;

    return (
      <button
        key={suggestion.id}
        onClick={() => handleSelect(suggestion)}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors min-h-[44px] touch-manipulation',
          'hover:bg-gray-50 focus:outline-none focus:bg-gray-50',
          isActive && 'bg-gray-50',
          isTypeOnly && 'bg-gray-50/50'
        )}
      >
        {/* Icon */}
        <div className={cn('flex-shrink-0', getSuggestionColorClass(suggestion.type))}>
          {getSuggestionIcon(suggestion.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900 truncate">
              {suggestion.text}
            </span>

            {/* Category indicator */}
            {showCategories && suggestion.category && !groupByCategory && (
              <Badge variant="outline" className="text-xs">
                <span className="flex items-center gap-1">
                  {getCategoryIcon(suggestion.category)}
                  {suggestion.category}
                </span>
              </Badge>
            )}

            {/* Trend indicator */}
            {suggestion.trend && (
              <Badge variant="outline" className={cn(
                'text-xs',
                suggestion.trend === 'up' && 'text-green-600 border-green-200',
                suggestion.trend === 'down' && 'text-red-600 border-red-200',
                suggestion.trend === 'stable' && 'text-gray-600 border-gray-200'
              ))}>
                {suggestion.trend === 'up' && '↗'}
                {suggestion.trend === 'down' && '↘'}
                {suggestion.trend === 'stable' && '→'}
              </Badge>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 mt-1">
            {suggestion.count && (
              <span className="text-xs text-gray-500">
                {suggestion.count.toLocaleString()} results
              </span>
            )}
            {suggestion.timestamp && (
              <span className="text-xs text-gray-500">
                {new Date(suggestion.timestamp).toLocaleDateString()}
              </span>
            )}
            {suggestion.metadata?.successRate && (
              <span className="text-xs text-gray-500">
                {Math.round(suggestion.metadata.successRate * 100)}% success
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
    );
  }, [handleSelect, showCategories, groupByCategory]);

  if (loading && filteredSuggestions.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-500">Getting suggestions...</p>
      </div>
    );
  }

  if (filteredSuggestions.length === 0 && !query.trim()) {
    return (
      <div className="p-4">
        {/* Empty state with quick actions */}
        <div className="space-y-4">
          {/* Quick suggestions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Quick Suggestions
            </h3>
            <div className="space-y-1">
              {[
                { text: 'High priority projects', category: 'priority' },
                { text: 'Employers near me', category: 'location' },
                { text: 'Recent compliance issues', category: 'compliance' },
                { text: 'Union meetings this week', category: 'events' },
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(item.text)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors min-h-[44px] touch-manipulation"
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>

          {/* Voice search prompt */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Try Voice Search</span>
            </div>
            <p className="text-xs text-purple-700">
              Tap the microphone icon to search using your voice
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('divide-y divide-gray-100', className)}>
      {/* Query suggestion */}
      {query.trim() && (
        <button
          onClick={() => handleSelect(query)}
          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors min-h-[44px] touch-manipulation"
        >
          <div className="text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-sm text-gray-900">Search for "{query}"</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      )}

      {/* Grouped suggestions */}
      {groupByCategory ? (
        Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => (
          <div key={category}>
            <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-2">
                {getCategoryIcon(category)}
                {category}
              </h3>
              {category === 'history' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="text-xs h-6 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div>
              {categorySuggestions.map((suggestion, index) => {
                const globalIndex = filteredSuggestions.indexOf(suggestion);
                return renderSuggestionItem(
                  suggestion,
                  globalIndex,
                  globalIndex === activeIndex
                );
              })}
            </div>
          </div>
        ))
      ) : (
        /* Regular list */
        <div>
          {/* Section headers */}
          {query.trim() && filteredSuggestions.length > 0 && (
            <div className="px-4 py-2 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">
                Suggestions
              </h3>
            </div>
          )}

          {/* Suggestion items */}
          {filteredSuggestions.map((suggestion, index) =>
            renderSuggestionItem(suggestion, index, index === activeIndex)
          )}

          {/* Show more */}
          {filteredSuggestions.length >= maxSuggestions && !showMore && (
            <button
              onClick={() => setShowMore(true)}
              className="w-full px-4 py-3 text-center text-sm text-blue-600 hover:text-blue-700 font-medium min-h-[44px] touch-manipulation"
            >
              Show More Suggestions
            </button>
          )}
        </div>
      )}

      {/* Clear history button */}
      {!query.trim() && showHistory && getHistory().length > 0 && (
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            className="w-full min-h-[44px] text-gray-600 hover:text-gray-900"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Search History
          </Button>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestionsPanel;