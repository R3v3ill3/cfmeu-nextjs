'use client';

import { useState, useCallback, useRef } from 'react';
import type { MatchSearchResult } from '@/types/pendingEmployerReview';

interface UseAliasAwareEmployerSearchOptions {
  limit?: number;
  debounceMs?: number;
  includeAliases?: boolean;
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical';
}

interface AliasAwareSearchState {
  results: MatchSearchResult[];
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
}

interface AliasAwareSearchActions {
  search: (query: string) => void;
  clear: () => void;
}

export function useAliasAwareEmployerSearch(
  options: UseAliasAwareEmployerSearchOptions = {}
): [AliasAwareSearchState, AliasAwareSearchActions] {
  const {
    limit = 30,
    debounceMs = 250,
    includeAliases = true,
    aliasMatchMode = 'any',
  } = options;

  const [results, setResults] = useState<MatchSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setResults([]);
      setError(null);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: trimmed,
        limit: String(limit),
        includeAliases: includeAliases ? 'true' : 'false',
        aliasMatchMode,
      });

      const response = await fetch(`/api/admin/pending-employers/search?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error || `Search failed (${response.status})`;
        throw new Error(message);
      }

      const payload = await response.json();
      const rows: any[] = Array.isArray(payload?.results) ? payload.results : [];

      const mapped: MatchSearchResult[] = rows.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        employer_type: emp.employer_type ?? null,
        address_line_1: emp.address_line_1 ?? null,
        suburb: emp.suburb ?? null,
        state: emp.state ?? null,
        postcode: emp.postcode ?? null,
        phone: emp.phone ?? null,
        email: emp.email ?? null,
        website: emp.website ?? null,
        enterprise_agreement_status: emp.enterprise_agreement_status ?? null,
        matchType: emp.match_type,
        matchedAlias: emp.match_details?.matched_alias ?? null,
        externalIdMatch: emp.match_details?.external_id_match ?? null,
        searchScore: Number(emp.search_score ?? 0),
        aliases: Array.isArray(emp.aliases) ? emp.aliases : [],
        matchDetails: emp.match_details ?? null,
      }));

      mapped.sort((a, b) => b.searchScore - a.searchScore);
      setResults(mapped);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        return;
      }

      console.error('[useAliasAwareEmployerSearch] search error:', err);
      setResults([]);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err && 'message' in err) {
        setError(String((err as any).message));
      } else {
        setError('Failed to search employers');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsSearching(false);
    }
  }, [aliasMatchMode, includeAliases, limit]);

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        runSearch(query);
      }, debounceMs);
    },
    [debounceMs, runSearch]
  );

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setResults([]);
    setIsSearching(false);
    setError(null);
    setHasSearched(false);
  }, []);

  return [
    {
      results,
      isSearching,
      error,
      hasSearched,
    },
    {
      search,
      clear,
    },
  ];
}

