/**
 * Offline Search Capabilities using IndexedDB
 *
 * This module provides comprehensive offline search functionality including:
 * - Caching recent searches for offline access
 * - Storing search results for quick retrieval
 * - Syncing cached data when connection is restored
 * - Leveraging existing mobile-api-optimizations patterns
 */

import { generalStorage, IndexedDBStorage } from '@/lib/mobile/offline-storage';
import { mobileApiManager } from '@/lib/api/mobile-api-optimizations';

// Search interfaces
export interface OfflineSearchQuery {
  id: string;
  query: string;
  filters: Record<string, any>;
  timestamp: number;
  resultCount: number;
  userId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface OfflineSearchResult {
  id: string;
  queryId: string;
  entityId: string;
  entityType: 'project' | 'employer' | 'worker' | 'site';
  title: string;
  subtitle?: string;
  description?: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  timestamp: number;
}

export interface OfflineSearchCache {
  id: string;
  query: string;
  filters: Record<string, any>;
  results: OfflineSearchResult[];
  timestamp: number;
  expiresAt: number;
  hitCount: number;
  lastAccessed: number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'trending';
  category?: string;
  count?: number;
  frequency: number;
  lastUsed: number;
}

// Configuration
const OFFLINE_SEARCH_CONFIG = {
  dbName: 'CFMEU-Offline-Search',
  version: 1,
  stores: {
    searchQueries: 'search_queries',
    searchResults: 'search_results',
    searchCache: 'search_cache',
    searchSuggestions: 'search_suggestions',
    syncQueue: 'sync_queue'
  },
  cache: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxCacheSize: 100, // Maximum number of cached searches
    maxSuggestions: 50 // Maximum number of suggestions to store
  },
  sync: {
    batchSize: 10,
    retryDelay: 5000,
    maxRetries: 3
  }
};

class OfflineSearchManager {
  private storage: IndexedDBStorage;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private syncTimer?: NodeJS.Timeout;

  constructor() {
    this.storage = new IndexedDBStorage({
      dbName: OFFLINE_SEARCH_CONFIG.dbName,
      version: OFFLINE_SEARCH_CONFIG.version,
      storeName: OFFLINE_SEARCH_CONFIG.stores.searchQueries,
      maxAge: OFFLINE_SEARCH_CONFIG.cache.maxAge,
      maxSize: 50 * 1024 * 1024 // 50MB
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize network status monitoring
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.handleConnectionRestored();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.handleConnectionLost();
      });

      // Start periodic sync
      this.startPeriodicSync();
    }
  }

  /**
   * Save a search query for offline access
   */
  async saveSearchQuery(
    query: string,
    filters: Record<string, any> = {},
    resultCount: number = 0,
    userId?: string
  ): Promise<void> {
    try {
      const searchQuery: OfflineSearchQuery = {
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        filters,
        timestamp: Date.now(),
        resultCount,
        userId,
        location: await this.getCurrentLocation()
      };

      await this.storage.set(`query:${searchQuery.id}`, searchQuery);

      // Update search suggestions
      await this.updateSearchSuggestions(query);

      console.log('📝 Search query saved for offline access:', query);
    } catch (error) {
      console.error('Failed to save search query:', error);
    }
  }

  /**
   * Save search results for offline access
   */
  async saveSearchResults(
    queryId: string,
    results: Array<{
      entityId: string;
      entityType: string;
      title: string;
      subtitle?: string;
      description?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    try {
      const offlineResults: OfflineSearchResult[] = results.map((result, index) => ({
        id: `result_${Date.now()}_${index}`,
        queryId,
        entityId: result.entityId,
        entityType: result.entityType as any,
        title: result.title,
        subtitle: result.subtitle,
        description: result.description,
        metadata: result.metadata || {},
        relevanceScore: 1 - (index / results.length), // Simple relevance scoring
        timestamp: Date.now()
      }));

      // Save results individually for better performance
      for (const result of offlineResults) {
        await this.storage.set(`result:${result.id}`, result);
      }

      // Create or update cache entry
      await this.updateSearchCache(queryId, results);

      console.log(`💾 Saved ${results.length} search results for offline access`);
    } catch (error) {
      console.error('Failed to save search results:', error);
    }
  }

  /**
   * Get recent search queries
   */
  async getRecentSearches(limit: number = 10): Promise<OfflineSearchQuery[]> {
    try {
      const allItems = await this.storage.getAll();
      const queries = allItems
        .filter(item => item.id.startsWith('query:'))
        .map(item => item.data as OfflineSearchQuery)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return queries;
    } catch (error) {
      console.error('Failed to get recent searches:', error);
      return [];
    }
  }

  /**
   * Get cached search results for a query
   */
  async getCachedResults(query: string, filters: Record<string, any> = {}): Promise<OfflineSearchResult[]> {
    try {
      const cacheKey = this.generateCacheKey(query, filters);
      const cached = await this.storage.get(`cache:${cacheKey}`);

      if (cached) {
        const cache = cached as OfflineSearchCache;

        // Check if cache is still valid
        if (cache.expiresAt > Date.now()) {
          // Update last accessed time and hit count
          cache.lastAccessed = Date.now();
          cache.hitCount++;
          await this.storage.set(`cache:${cacheKey}`, cache);

          console.log('📋 Retrieved cached search results:', cache.results.length);
          return cache.results;
        } else {
          // Remove expired cache
          await this.storage.delete(`cache:${cacheKey}`);
        }
      }

      return [];
    } catch (error) {
      console.error('Failed to get cached results:', error);
      return [];
    }
  }

  /**
   * Perform offline search using cached data
   */
  async performOfflineSearch(query: string, filters: Record<string, any> = {}): Promise<OfflineSearchResult[]> {
    try {
      console.log('🔍 Performing offline search for:', query);

      // Get all cached results
      const allItems = await this.storage.getAll();
      const allResults = allItems
        .filter(item => item.id.startsWith('result:'))
        .map(item => item.data as OfflineSearchResult);

      if (allResults.length === 0) {
        console.log('No cached search results available');
        return [];
      }

      // Simple text matching and filtering
      const queryLower = query.toLowerCase();
      let filteredResults = allResults.filter(result => {
        const matchesQuery = !query ||
          result.title.toLowerCase().includes(queryLower) ||
          (result.subtitle && result.subtitle.toLowerCase().includes(queryLower)) ||
          (result.description && result.description.toLowerCase().includes(queryLower));

        const matchesFilters = this.matchesFilters(result, filters);

        return matchesQuery && matchesFilters;
      });

      // Sort by relevance score and timestamp
      filteredResults.sort((a, b) => {
        // Prioritize exact title matches
        const aExactMatch = a.title.toLowerCase().includes(queryLower);
        const bExactMatch = b.title.toLowerCase().includes(queryLower);

        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // Then by relevance score
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }

        // Finally by timestamp (most recent)
        return b.timestamp - a.timestamp;
      });

      console.log(`📱 Offline search found ${filteredResults.length} results`);
      return filteredResults.slice(0, 50); // Limit results for performance
    } catch (error) {
      console.error('Failed to perform offline search:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on offline data
   */
  async getSearchSuggestions(query: string = '', limit: number = 8): Promise<SearchSuggestion[]> {
    try {
      // Get recent searches
      const recentSearches = await this.getRecentSearches(20);
      const suggestions: SearchSuggestion[] = [];

      // Add recent search suggestions
      for (const search of recentSearches) {
        if (search.query.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            id: `recent_${search.id}`,
            text: search.query,
            type: 'recent',
            frequency: search.resultCount,
            lastUsed: search.timestamp
          });
        }
      }

      // Get popular suggestions from stored data
      const popularItems = await this.storage.getAll();
      const queryCounts = new Map<string, number>();

      for (const item of popularItems) {
        if (item.id.startsWith('query:')) {
          const searchQuery = item.data as OfflineSearchQuery;
          queryCounts.set(searchQuery.query, (queryCounts.get(searchQuery.query) || 0) + 1);
        }
      }

      // Add popular suggestions
      const popularQueries = Array.from(queryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      for (const [queryText, count] of popularQueries) {
        if (queryText.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            id: `popular_${queryText}`,
            text: queryText,
            type: 'popular',
            frequency: count,
            lastUsed: Date.now()
          });
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueSuggestions = suggestions
        .filter((suggestion, index, arr) =>
          arr.findIndex(s => s.text === suggestion.text) === index
        )
        .sort((a, b) => {
          // Prioritize recent searches
          if (a.type === 'recent' && b.type !== 'recent') return -1;
          if (b.type === 'recent' && a.type !== 'recent') return 1;

          // Then by frequency
          if (a.frequency !== b.frequency) return b.frequency - a.frequency;

          // Finally by last used time
          return b.lastUsed - a.lastUsed;
        })
        .slice(0, limit);

      return uniqueSuggestions;
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Clear search cache and history
   */
  async clearSearchCache(): Promise<void> {
    try {
      await this.storage.clear();
      console.log('🧹 Search cache cleared');
    } catch (error) {
      console.error('Failed to clear search cache:', error);
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    used: number;
    available: number;
    itemCount: number;
    cacheSize: number;
  }> {
    try {
      const info = await this.storage.getStorageInfo();
      const cacheItems = await this.storage.getAll();
      const cacheSize = cacheItems.reduce((size, item) => {
        return size + JSON.stringify(item).length;
      }, 0);

      return {
        ...info,
        cacheSize
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        used: 0,
        available: 0,
        itemCount: 0,
        cacheSize: 0
      };
    }
  }

  /**
   * Sync offline data with server when connection is restored
   */
  private async handleConnectionRestored(): Promise<void> {
    console.log('🟢 Connection restored - starting search sync');

    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    this.syncInProgress = true;

    try {
      // Sync any queued searches
      await this.syncQueuedSearches();

      // Refresh cached data if needed
      await this.refreshStaleCache();

      console.log('✅ Search sync completed');
    } catch (error) {
      console.error('Failed to sync search data:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Handle connection loss
   */
  private handleConnectionLost(): void {
    console.log('🔴 Connection lost - entering offline mode');
  }

  /**
   * Start periodic sync process
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.performPeriodicSync();
      }
    }, 60000); // Sync every minute
  }

  /**
   * Perform periodic sync
   */
  private async performPeriodicSync(): Promise<void> {
    try {
      // Clean up expired cache entries
      await this.cleanupExpiredCache();

      // Sync popular searches to server for analytics
      await this.syncSearchAnalytics();
    } catch (error) {
      console.error('Periodic sync failed:', error);
    }
  }

  /**
   * Update search suggestions based on query
   */
  private async updateSearchSuggestions(query: string): Promise<void> {
    try {
      const suggestionId = `suggestion:${query.toLowerCase()}`;
      const existing = await this.storage.get(suggestionId);

      if (existing) {
        // Update frequency and last used time
        const suggestion = existing as SearchSuggestion;
        suggestion.frequency++;
        suggestion.lastUsed = Date.now();
        await this.storage.set(suggestionId, suggestion);
      } else {
        // Create new suggestion
        const suggestion: SearchSuggestion = {
          id: suggestionId,
          text: query,
          type: 'recent',
          frequency: 1,
          lastUsed: Date.now()
        };
        await this.storage.set(suggestionId, suggestion);
      }
    } catch (error) {
      console.error('Failed to update search suggestions:', error);
    }
  }

  /**
   * Update search cache with new results
   */
  private async updateSearchCache(queryId: string, results: any[]): Promise<void> {
    try {
      const query = await this.storage.get(`query:${queryId}`);
      if (!query) return;

      const searchQuery = query as OfflineSearchQuery;
      const cacheKey = this.generateCacheKey(searchQuery.query, searchQuery.filters);

      const cache: OfflineSearchCache = {
        id: cacheKey,
        query: searchQuery.query,
        filters: searchQuery.filters,
        results: results.map((result, index) => ({
          id: `result_${Date.now()}_${index}`,
          queryId,
          entityId: result.entityId,
          entityType: result.entityType as any,
          title: result.title,
          subtitle: result.subtitle,
          description: result.description,
          metadata: result.metadata || {},
          relevanceScore: 1 - (index / results.length),
          timestamp: Date.now()
        })),
        timestamp: Date.now(),
        expiresAt: Date.now() + OFFLINE_SEARCH_CONFIG.cache.maxAge,
        hitCount: 0,
        lastAccessed: Date.now()
      };

      await this.storage.set(`cache:${cacheKey}`, cache);
    } catch (error) {
      console.error('Failed to update search cache:', error);
    }
  }

  /**
   * Generate cache key for query and filters
   */
  private generateCacheKey(query: string, filters: Record<string, any>): string {
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return btoa(`${query}:${filterString}`).replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
  }

  /**
   * Check if result matches filters
   */
  private matchesFilters(result: OfflineSearchResult, filters: Record<string, any>): boolean {
    if (!filters || Object.keys(filters).length === 0) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      switch (key) {
        case 'entityTypes':
          if (Array.isArray(value) && !value.includes(result.entityType)) return false;
          break;
        case 'projectStage':
          if (result.metadata.projectStage !== value) return false;
          break;
        case 'complianceRating':
          if (result.metadata.complianceRating !== value) return false;
          break;
        case 'ebaStatus':
          if (result.metadata.ebaStatus !== value) return false;
          break;
        case 'priority':
          if (result.metadata.priority !== value) return false;
          break;
        case 'unionMembership':
          if (result.metadata.unionMembership !== value) return false;
          break;
        // Add more filter matching logic as needed
      }
    }

    return true;
  }

  /**
   * Get current location for context-aware searches
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | undefined> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return undefined;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          resolve(undefined);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  }

  /**
   * Sync queued searches to server
   */
  private async syncQueuedSearches(): Promise<void> {
    try {
      const queuedSearches = await this.storage.getAll();
      const searchQueue = queuedSearches.filter(item => item.id.startsWith('queue:'));

      for (const item of searchQueue.slice(0, OFFLINE_SEARCH_CONFIG.sync.batchSize)) {
        const search = item.data;

        try {
          // Sync with server using mobile API manager
          await mobileApiManager.makeRequest('/api/search/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(search)
          });

          // Remove from queue after successful sync
          await this.storage.delete(item.id);
        } catch (error) {
          console.error('Failed to sync queued search:', error);
        }
      }
    } catch (error) {
      console.error('Failed to sync queued searches:', error);
    }
  }

  /**
   * Refresh stale cache entries
   */
  private async refreshStaleCache(): Promise<void> {
    try {
      const cacheItems = await this.storage.getAll();
      const staleItems = cacheItems.filter(item => {
        if (item.id.startsWith('cache:')) {
          const cache = item.data as OfflineSearchCache;
          return cache.expiresAt < Date.now();
        }
        return false;
      });

      for (const item of staleItems) {
        await this.storage.delete(item.id);
      }

      console.log(`🗑️ Cleaned up ${staleItems.length} stale cache entries`);
    } catch (error) {
      console.error('Failed to refresh stale cache:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      const allItems = await this.storage.getAll();
      const expiredItems = allItems.filter(item => {
        if (item.id.startsWith('cache:')) {
          const cache = item.data as OfflineSearchCache;
          return cache.expiresAt < Date.now() - (24 * 60 * 60 * 1000); // Remove items older than 1 day past expiry
        }
        return false;
      });

      for (const item of expiredItems) {
        await this.storage.delete(item.id);
      }

      if (expiredItems.length > 0) {
        console.log(`🧹 Cleaned up ${expiredItems.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
    }
  }

  /**
   * Sync search analytics to server
   */
  private async syncSearchAnalytics(): Promise<void> {
    try {
      const recentSearches = await this.getRecentSearches(100);

      if (recentSearches.length > 0 && this.isOnline) {
        await mobileApiManager.makeRequest('/api/search/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searches: recentSearches,
            timestamp: Date.now()
          })
        });
      }
    } catch (error) {
      console.error('Failed to sync search analytics:', error);
    }
  }
}

// Export singleton instance
export const offlineSearchManager = new OfflineSearchManager();

// Export types and utilities
export { OFFLINE_SEARCH_CONFIG };
export default offlineSearchManager;