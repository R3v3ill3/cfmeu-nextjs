/**
 * Mobile Search History and Suggestions System
 *
 * This module provides a comprehensive search history and suggestions system
 * optimized for mobile devices with offline support and intelligent recommendations.
 */

import { useState, useCallback } from 'react';

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  category?: string;
  resultCount?: number;
  filters?: Record<string, any>;
  context?: {
    page?: string;
    action?: string;
    userAgent?: string;
  };
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'trending' | 'popular' | 'recent' | 'contextual' | 'voice';
  category?: string;
  count?: number;
  trend?: 'up' | 'down' | 'stable';
  timestamp?: number;
  metadata?: {
    resultCount?: number;
    averageTime?: number;
    successRate?: number;
  };
}

export interface SearchContext {
  page?: string;
  userRole?: string;
  location?: { lat: number; lng: number; address?: string };
  recentActivity?: Array<{
    type: string;
    timestamp: number;
    data?: any;
  }>;
  preferences?: {
    industries?: string[];
    locations?: string[];
    categories?: string[];
  };
}

export interface SearchHistoryOptions {
  maxHistoryItems?: number;
  maxSuggestions?: number;
  retentionDays?: number;
  enableOfflineCache?: boolean;
  enableTrendingSearches?: boolean;
  enableContextualSuggestions?: boolean;
  enableVoiceSearchHistory?: boolean;
}

class SearchHistoryManager {
  private storageKey = 'mobile-search-history';
  private trendingKey = 'mobile-search-trending';
  private preferencesKey = 'mobile-search-preferences';
  private options: Required<SearchHistoryOptions>;

  constructor(options: SearchHistoryOptions = {}) {
    this.options = {
      maxHistoryItems: 50,
      maxSuggestions: 10,
      retentionDays: 90,
      enableOfflineCache: true,
      enableTrendingSearches: true,
      enableContextualSuggestions: true,
      enableVoiceSearchHistory: true,
      ...options,
    };
  }

  // Core search history management
  addToHistory(item: Omit<SearchHistoryItem, 'id' | 'timestamp'>): void {
    try {
      const history = this.getHistory();
      const newItem: SearchHistoryItem = {
        ...item,
        id: this.generateId(),
        timestamp: Date.now(),
      };

      // Remove existing identical queries
      const filteredHistory = history.filter(h => h.query.toLowerCase() !== item.query.toLowerCase());

      // Add new item at the beginning
      const updatedHistory = [newItem, ...filteredHistory].slice(0, this.options.maxHistoryItems);

      if (this.options.enableOfflineCache) {
        localStorage.setItem(this.storageKey, JSON.stringify(updatedHistory));
      }

      // Update trending searches
      this.updateTrendingSearches(item.query);

      // Trigger analytics event (in real app)
      this.trackSearchEvent('search_history_add', newItem);
    } catch (error) {
      console.error('Failed to add search to history:', error);
    }
  }

  getHistory(): SearchHistoryItem[] {
    try {
      if (!this.options.enableOfflineCache) return [];

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const history: SearchHistoryItem[] = JSON.parse(stored);

      // Filter out old items based on retention
      const cutoff = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);
      return history.filter(item => item.timestamp > cutoff);
    } catch (error) {
      console.error('Failed to load search history:', error);
      return [];
    }
  }

  removeFromHistory(id: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter(item => item.id !== id);

      if (this.options.enableOfflineCache) {
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      }

      this.trackSearchEvent('search_history_remove', { id });
    } catch (error) {
      console.error('Failed to remove from history:', error);
    }
  }

  clearHistory(): void {
    try {
      if (this.options.enableOfflineCache) {
        localStorage.removeItem(this.storageKey);
      }

      this.trackSearchEvent('search_history_clear', {});
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }

  // Suggestions generation
  async getSuggestions(query: string, context?: SearchContext): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const history = this.getHistory();
    const trending = this.getTrendingSearches();

    // History-based suggestions
    if (query.trim()) {
      const historyMatches = history
        .filter(item => item.query.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(item => ({
          id: `history-${item.id}`,
          text: item.query,
          type: 'history' as const,
          category: item.category,
          timestamp: item.timestamp,
          metadata: {
            resultCount: item.resultCount,
          },
        }));

      suggestions.push(...historyMatches);
    } else {
      // Recent searches when no query
      const recent = history
        .slice(0, 5)
        .map(item => ({
          id: `recent-${item.id}`,
          text: item.query,
          type: 'recent' as const,
          category: item.category,
          timestamp: item.timestamp,
        }));

      suggestions.push(...recent);
    }

    // Trending searches
    if (this.options.enableTrendingSearches) {
      const trendingSuggestions = trending
        .filter(item => !query.trim() || item.text.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(item => ({
          ...item,
          type: 'trending' as const,
        }));

      suggestions.push(...trendingSuggestions);
    }

    // Contextual suggestions
    if (this.options.enableContextualSuggestions && context) {
      const contextualSuggestions = this.getContextualSuggestions(query, context);
      suggestions.push(...contextualSuggestions);
    }

    // Voice search suggestions
    if (this.options.enableVoiceSearchHistory) {
      const voiceSuggestions = this.getVoiceSearchSuggestions(query);
      suggestions.push(...voiceSuggestions);
    }

    // Remove duplicates and limit
    const uniqueSuggestions = suggestions.filter((suggestion, index, arr) =>
      arr.findIndex(item => item.text.toLowerCase() === suggestion.text.toLowerCase()) === index
    );

    return uniqueSuggestions.slice(0, this.options.maxSuggestions);
  }

  // Trending searches management
  private updateTrendingSearches(query: string): void {
    try {
      if (!this.options.enableTrendingSearches) return;

      const trending = this.getTrendingSearches();
      const existing = trending.find(item => item.text.toLowerCase() === query.toLowerCase());

      if (existing) {
        existing.count = (existing.count || 0) + 1;
        existing.trend = 'up';
      } else {
        trending.push({
          id: `trending-${this.generateId()}`,
          text: query,
          type: 'trending',
          count: 1,
          trend: 'up',
        });
      }

      // Sort by count and limit
      trending.sort((a, b) => (b.count || 0) - (a.count || 0));
      const limited = trending.slice(0, 20);

      localStorage.setItem(this.trendingKey, JSON.stringify(limited));
    } catch (error) {
      console.error('Failed to update trending searches:', error);
    }
  }

  getTrendingSearches(): SearchSuggestion[] {
    try {
      if (!this.options.enableTrendingSearches) return [];

      const stored = localStorage.getItem(this.trendingKey);
      if (!stored) return [];

      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load trending searches:', error);
      return [];
    }
  }

  // Contextual suggestions
  private getContextualSuggestions(query: string, context: SearchContext): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Location-based suggestions
    if (context.location?.address) {
      const locationTerms = [
        `near ${context.location.address}`,
        `close to ${context.location.address}`,
        `in ${context.location.address.split(',')[0]}`,
      ];

      locationTerms.forEach(term => {
        if (!query.trim() || term.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            id: `location-${this.generateId()}`,
            text: term,
            type: 'contextual',
            category: 'location',
          });
        }
      });
    }

    // User role-based suggestions
    if (context.userRole) {
      const roleSuggestions = this.getRoleBasedSuggestions(context.userRole);
      suggestions.push(...roleSuggestions);
    }

    // Recent activity-based suggestions
    if (context.recentActivity) {
      const activitySuggestions = this.getActivityBasedSuggestions(context.recentActivity);
      suggestions.push(...activitySuggestions);
    }

    // User preferences-based suggestions
    if (context.preferences) {
      const preferenceSuggestions = this.getPreferenceBasedSuggestions(context.preferences, query);
      suggestions.push(...preferenceSuggestions);
    }

    return suggestions.slice(0, 3);
  }

  private getRoleBasedSuggestions(userRole: string): SearchSuggestion[] {
    const roleSuggestions: Record<string, string[]> = {
      'organizer': [
        'High risk employers',
        'Non-compliant projects',
        'New construction sites',
        'Union meetings nearby',
        'Recruitment opportunities',
      ],
      'field_worker': [
        'Job opportunities',
        'Skills training',
        'Union benefits',
        'Safety courses',
        'Community events',
      ],
      'admin': [
        'System reports',
        'User management',
        'Compliance audits',
        'Data exports',
        'Security logs',
      ],
    };

    const suggestions = roleSuggestions[userRole] || [];
    return suggestions.map(text => ({
      id: `role-${this.generateId()}`,
      text,
      type: 'contextual',
      category: 'role',
    }));
  }

  private getActivityBasedSuggestions(recentActivity: SearchContext['recentActivity']): SearchSuggestion[] {
    // Analyze recent activity and suggest related searches
    const activityMap = new Map<string, number>();

    recentActivity?.forEach(activity => {
      if (activity.type === 'employer_view' || activity.type === 'project_view') {
        // Extract keywords from viewed items
        // This is simplified - in real implementation would analyze actual data
        const keywords = ['Construction', 'Electrical', 'Plumbing', 'HVAC'];
        keywords.forEach(keyword => {
          activityMap.set(keyword, (activityMap.get(keyword) || 0) + 1);
        });
      }
    });

    return Array.from(activityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([text]) => ({
        id: `activity-${this.generateId()}`,
        text,
        type: 'contextual',
        category: 'activity',
      }));
  }

  private getPreferenceBasedSuggestions(
    preferences: SearchContext['preferences'],
    query: string
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Industry preferences
    preferences.industries?.forEach(industry => {
      const suggestionText = `${industry} projects`;
      if (!query.trim() || suggestionText.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          id: `pref-industry-${this.generateId()}`,
          text: suggestionText,
          type: 'contextual',
          category: 'industry',
        });
      }
    });

    // Location preferences
    preferences.locations?.forEach(location => {
      const suggestionText = `Projects in ${location}`;
      if (!query.trim() || suggestionText.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          id: `pref-location-${this.generateId()}`,
          text: suggestionText,
          type: 'contextual',
          category: 'location',
        });
      }
    });

    return suggestions;
  }

  // Voice search suggestions
  private getVoiceSearchSuggestions(query: string): SearchSuggestion[] {
    const voiceCommands = [
      'Show me employers near me',
      'Find construction projects',
      'Search for electrical contractors',
      'Find union members',
      'Show compliance reports',
      'Find training opportunities',
      'Search by phone number',
      'Find projects by address',
    ];

    return voiceCommands
      .filter(command => !query.trim() || command.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map(text => ({
        id: `voice-${this.generateId()}`,
        text,
        type: 'voice',
        category: 'voice command',
      }));
  }

  // Analytics tracking
  private trackSearchEvent(event: string, data: any): void {
    // In real implementation, this would send to analytics service
    console.log('Search Analytics:', event, data);
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public utility methods
  getPopularSearches(limit: number = 10): SearchSuggestion[] {
    const history = this.getHistory();
    const frequencyMap = new Map<string, number>();

    history.forEach(item => {
      const key = item.query.toLowerCase();
      frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    });

    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text, count]) => ({
        id: `popular-${this.generateId()}`,
        text,
        type: 'popular',
        count,
      }));
  }

  exportHistory(): SearchHistoryItem[] {
    return this.getHistory();
  }

  importHistory(items: SearchHistoryItem[]): void {
    try {
      const existing = this.getHistory();
      const combined = [...items, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.options.maxHistoryItems);

      if (this.options.enableOfflineCache) {
        localStorage.setItem(this.storageKey, JSON.stringify(combined));
      }
    } catch (error) {
      console.error('Failed to import search history:', error);
    }
  }

  getSearchStats(): {
    totalSearches: number;
    averageSearchesPerDay: number;
    mostPopularQueries: string[];
    searchCategories: Record<string, number>;
  } {
    const history = this.getHistory();
    const totalSearches = history.length;

    // Calculate average per day
    const oldestSearch = Math.min(...history.map(item => item.timestamp));
    const daysSinceOldest = Math.max(1, Math.ceil((Date.now() - oldestSearch) / (24 * 60 * 60 * 1000)));
    const averageSearchesPerDay = totalSearches / daysSinceOldest;

    // Most popular queries
    const frequencyMap = new Map<string, number>();
    history.forEach(item => {
      frequencyMap.set(item.query, (frequencyMap.get(item.query) || 0) + 1);
    });
    const mostPopularQueries = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query]) => query);

    // Search categories
    const categoryMap = new Map<string, number>();
    history.forEach(item => {
      if (item.category) {
        categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
      }
    });
    const searchCategories = Object.fromEntries(categoryMap);

    return {
      totalSearches,
      averageSearchesPerDay,
      mostPopularQueries,
      searchCategories,
    };
  }
}

// Create singleton instance
export const searchHistoryManager = new SearchHistoryManager();

// React hook for search history
export function useSearchHistory(options?: SearchHistoryOptions) {
  const [manager] = useState(() => new SearchHistoryManager(options));
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const getSuggestions = useCallback(async (query: string, context?: SearchContext) => {
    setLoading(true);
    try {
      const result = await manager.getSuggestions(query, context);
      setSuggestions(result);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [manager]);

  const addToHistory = useCallback((item: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => {
    manager.addToHistory(item);
  }, [manager]);

  const clearHistory = useCallback(() => {
    manager.clearHistory();
    setSuggestions([]);
  }, [manager]);

  return {
    manager,
    suggestions,
    loading,
    getSuggestions,
    addToHistory,
    clearHistory,
    getHistory: () => manager.getHistory(),
    getTrendingSearches: () => manager.getTrendingSearches(),
    getPopularSearches: () => manager.getPopularSearches(),
  };
}