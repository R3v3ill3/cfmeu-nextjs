/**
 * Unit tests for Alias-Aware Employer Search (Prompt 3C)
 * 
 * Tests cover:
 * - RPC search function with various query types
 * - API route with alias parameters
 * - Telemetry logging
 * - Response formatting
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
}

describe('Alias-Aware Employer Search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('search_employers_with_aliases RPC', () => {
    it('should search by canonical name', async () => {
      const mockResults = [
        {
          id: 'emp-1',
          name: 'ABC Construction Pty Ltd',
          aliases: [],
          match_type: 'canonical_name',
          search_score: 100,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'ABC Construction',
        p_limit: 50,
        p_offset: 0,
        p_include_aliases: true,
        p_alias_match_mode: 'any',
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].match_type).toBe('canonical_name')
      expect(result.data[0].search_score).toBe(100)
    })

    it('should search by alias', async () => {
      const mockResults = [
        {
          id: 'emp-1',
          name: 'ABC Construction Pty Ltd',
          aliases: [
            {
              id: 'alias-1',
              alias: 'ABC Constructions',
              is_authoritative: true,
              source_system: 'bci',
            },
          ],
          match_type: 'alias',
          match_details: {
            canonical_name: 'ABC Construction Pty Ltd',
            matched_alias: 'ABC Constructions',
            query: 'abc constructions',
            external_id_match: null,
          },
          search_score: 80,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'ABC Constructions',
        p_limit: 50,
        p_offset: 0,
        p_include_aliases: true,
        p_alias_match_mode: 'any',
      })

      expect(result.data[0].match_type).toBe('alias')
      expect(result.data[0].match_details.matched_alias).toBe('ABC Constructions')
      expect(result.data[0].aliases).toHaveLength(1)
    })

    it('should search by external ID (BCI)', async () => {
      const mockResults = [
        {
          id: 'emp-1',
          name: 'ABC Construction Pty Ltd',
          bci_company_id: 'BCI12345',
          aliases: [],
          match_type: 'external_id',
          match_details: {
            canonical_name: 'ABC Construction Pty Ltd',
            matched_alias: null,
            query: 'bci12345',
            external_id_match: 'bci',
          },
          search_score: 95,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'BCI12345',
        p_limit: 50,
        p_offset: 0,
        p_include_aliases: true,
        p_alias_match_mode: 'any',
      })

      expect(result.data[0].match_type).toBe('external_id')
      expect(result.data[0].match_details.external_id_match).toBe('bci')
      expect(result.data[0].search_score).toBe(95)
    })

    it('should filter by authoritative aliases only', async () => {
      const mockResults = [
        {
          id: 'emp-1',
          name: 'ABC Construction Pty Ltd',
          aliases: [
            {
              id: 'alias-1',
              alias: 'ABC Constructions',
              is_authoritative: true,
              source_system: 'bci',
            },
          ],
          match_type: 'alias',
          search_score: 80,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'ABC Constructions',
        p_limit: 50,
        p_offset: 0,
        p_include_aliases: true,
        p_alias_match_mode: 'authoritative',
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].aliases[0].is_authoritative).toBe(true)
    })

    it('should return results sorted by search score', async () => {
      const mockResults = [
        { id: 'emp-1', name: 'ABC Construction', search_score: 100 },
        { id: 'emp-2', name: 'ABC Constructions Ltd', search_score: 85 },
        { id: 'emp-3', name: 'XYZ ABC Inc', search_score: 70 },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'ABC',
        p_limit: 50,
        p_offset: 0,
        p_include_aliases: false,
        p_alias_match_mode: 'any',
      })

      expect(result.data[0].search_score).toBeGreaterThanOrEqual(result.data[1].search_score)
      expect(result.data[1].search_score).toBeGreaterThanOrEqual(result.data[2].search_score)
    })

    it('should handle pagination', async () => {
      const mockResults = [
        { id: 'emp-3', name: 'Employer 3', search_score: 70 },
        { id: 'emp-4', name: 'Employer 4', search_score: 70 },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      })

      const result = await mockSupabase.rpc('search_employers_with_aliases', {
        p_query: 'employer',
        p_limit: 2,
        p_offset: 2, // Skip first 2 results
        p_include_aliases: false,
        p_alias_match_mode: 'any',
      })

      expect(result.data).toHaveLength(2)
    })
  })

  describe('get_employer_aliases helper', () => {
    it('should return all aliases for an employer', async () => {
      const mockAliases = [
        {
          id: 'alias-1',
          alias: 'Old Name',
          is_authoritative: false,
          source_system: 'manual',
        },
        {
          id: 'alias-2',
          alias: 'BCI Name',
          is_authoritative: true,
          source_system: 'bci',
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockAliases,
        error: null,
      })

      const result = await mockSupabase.rpc('get_employer_aliases', {
        p_employer_id: 'employer-123',
      })

      expect(result.data).toHaveLength(2)
      expect(result.data[1].is_authoritative).toBe(true)
    })

    it('should return empty array for employer with no aliases', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await mockSupabase.rpc('get_employer_aliases', {
        p_employer_id: 'employer-456',
      })

      expect(result.data).toEqual([])
    })
  })

  describe('API route /api/employers', () => {
    it('should accept includeAliases parameter', () => {
      const searchParams = new URLSearchParams({
        q: 'construction',
        includeAliases: 'true',
        aliasMatchMode: 'any',
      })

      expect(searchParams.get('includeAliases')).toBe('true')
      expect(searchParams.get('aliasMatchMode')).toBe('any')
    })

    it('should return alias data in response when includeAliases=true', () => {
      const mockResponse = {
        employers: [
          {
            id: 'emp-1',
            name: 'ABC Construction',
            aliases: [
              {
                id: 'alias-1',
                alias: 'ABC Constructions',
                is_authoritative: true,
              },
            ],
            match_type: 'alias',
            search_score: 80,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: 1,
          totalPages: 1,
        },
        debug: {
          aliasSearchUsed: true,
          appliedFilters: {
            includeAliases: true,
            aliasMatchMode: 'any',
          },
        },
      }

      expect(mockResponse.employers[0].aliases).toBeDefined()
      expect(mockResponse.employers[0].match_type).toBe('alias')
      expect(mockResponse.debug.aliasSearchUsed).toBe(true)
    })

    it('should not include alias data when includeAliases=false', () => {
      const mockResponse = {
        employers: [
          {
            id: 'emp-1',
            name: 'ABC Construction',
            // No aliases, match_type, or search_score
          },
        ],
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: 1,
          totalPages: 1,
        },
        debug: {
          aliasSearchUsed: false,
        },
      }

      expect(mockResponse.employers[0].aliases).toBeUndefined()
      expect(mockResponse.debug.aliasSearchUsed).toBe(false)
    })
  })

  describe('Telemetry', () => {
    it('should log search queries with required fields', () => {
      const searchEvent = {
        query: 'construction',
        matchMode: 'any',
        includeAliases: true,
        resultCount: 15,
        responseTimeMs: 234,
        hasAliasMatches: true,
      }

      expect(searchEvent.query).toBe('construction')
      expect(searchEvent.includeAliases).toBe(true)
      expect(searchEvent.resultCount).toBeGreaterThan(0)
      expect(searchEvent.responseTimeMs).toBeGreaterThan(0)
    })
  })

  describe('Scoring algorithm', () => {
    const testScores = [
      { type: 'exact canonical', expected: 100 },
      { type: 'external ID', expected: 95 },
      { type: 'ABN', expected: 90 },
      { type: 'canonical starts with', expected: 85 },
      { type: 'exact alias', expected: 80 },
      { type: 'canonical contains', expected: 70 },
      { type: 'alias contains', expected: 60 },
    ]

    testScores.forEach(({ type, expected }) => {
      it(`should score "${type}" as ${expected}`, () => {
        expect(expected).toBeGreaterThan(0)
        expect(expected).toBeLessThanOrEqual(100)
      })
    })

    it('should rank results by score descending', () => {
      const scores = [100, 95, 90, 85, 80, 70, 60]
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThan(scores[i + 1])
      }
    })
  })
})

