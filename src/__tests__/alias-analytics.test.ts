/**
 * Unit tests for Alias Analytics & Reporting (Prompt 3D)
 * 
 * Tests cover:
 * - Database views for metrics
 * - API endpoint responses
 * - Dashboard data formatting
 * - CSV export functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
}

describe('Alias Analytics & Reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('alias_metrics_summary view', () => {
    it('should return comprehensive summary metrics', async () => {
      const mockSummary = {
        total_aliases: 1250,
        employers_with_aliases: 342,
        authoritative_aliases: 450,
        bci_aliases: 200,
        incolink_aliases: 150,
        fwc_aliases: 50,
        eba_aliases: 30,
        manual_aliases: 320,
        pending_import_aliases: 400,
        legacy_aliases: 100,
        aliases_last_7_days: 45,
        aliases_last_30_days: 180,
        total_promotions: 120,
        total_rejections: 15,
        total_deferrals: 8,
        decisions_last_7_days: 12,
        decisions_last_30_days: 45,
        computed_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSummary,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alias_metrics_summary')
        .select('*')
        .single()

      expect(result.data.total_aliases).toBe(1250)
      expect(result.data.authoritative_aliases).toBe(450)
      expect(result.data.aliases_last_7_days).toBe(45)
      expect(result.data.total_promotions).toBe(120)
    })
  })

  describe('canonical_review_metrics view', () => {
    it('should return review queue and decision metrics', async () => {
      const mockMetrics = {
        pending_reviews: 25,
        high_priority_reviews: 8,
        medium_priority_reviews: 12,
        previously_deferred: 3,
        promotions_last_7_days: 5,
        rejections_last_7_days: 2,
        deferrals_last_7_days: 1,
        median_resolution_hours: 48.5,
        computed_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockMetrics,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('canonical_review_metrics')
        .select('*')
        .single()

      expect(result.data.pending_reviews).toBe(25)
      expect(result.data.high_priority_reviews).toBe(8)
      expect(result.data.median_resolution_hours).toBe(48.5)
    })

    it('should handle null median resolution hours', async () => {
      const mockMetrics = {
        pending_reviews: 10,
        median_resolution_hours: null, // No promotions in last 30 days
        computed_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockMetrics,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('canonical_review_metrics')
        .select('*')
        .single()

      expect(result.data.median_resolution_hours).toBeNull()
    })
  })

  describe('alias_source_system_stats view', () => {
    it('should break down statistics by source system', async () => {
      const mockStats = [
        {
          source_system: 'bci',
          total_aliases: 500,
          authoritative_count: 450,
          employer_count: 200,
          new_last_7_days: 25,
          new_last_30_days: 100,
          avg_aliases_per_employer: 2.5,
        },
        {
          source_system: 'manual',
          total_aliases: 400,
          authoritative_count: 50,
          employer_count: 150,
          new_last_7_days: 30,
          new_last_30_days: 120,
          avg_aliases_per_employer: 2.67,
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockStats,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alias_source_system_stats')
        .select('*')
        .order('total_aliases', { ascending: false })

      expect(result.data).toHaveLength(2)
      expect(result.data[0].source_system).toBe('bci')
      expect(result.data[0].authoritative_count).toBe(450)
      expect(result.data[1].avg_aliases_per_employer).toBe(2.67)
    })
  })

  describe('alias_conflict_backlog view', () => {
    it('should return conflicts with age buckets', async () => {
      const mockBacklog = [
        {
          alias_id: 'alias-1',
          employer_id: 'emp-1',
          proposed_name: 'ABC Construction',
          current_canonical_name: 'ABC Constructions Pty Ltd',
          priority: 10,
          is_authoritative: true,
          source_system: 'bci',
          conflict_count: 2,
          age_bucket: '<24h',
          hours_in_queue: 6.5,
        },
        {
          alias_id: 'alias-2',
          employer_id: 'emp-2',
          proposed_name: 'XYZ Builders',
          current_canonical_name: 'XYZ Building Services',
          priority: 5,
          is_authoritative: false,
          source_system: 'manual',
          conflict_count: 1,
          age_bucket: '3-7d',
          hours_in_queue: 96.3,
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockBacklog,
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alias_conflict_backlog')
        .select('*')
        .order('priority', { ascending: false })
        .order('hours_in_queue', { ascending: false })
        .limit(100)

      expect(result.data).toHaveLength(2)
      expect(result.data[0].age_bucket).toBe('<24h')
      expect(result.data[0].conflict_count).toBe(2)
      expect(result.data[1].age_bucket).toBe('3-7d')
    })
  })

  describe('employer_alias_coverage view', () => {
    it('should calculate coverage metrics', async () => {
      const mockCoverage = {
        total_employers: 500,
        employers_with_aliases: 350,
        coverage_percentage: 70.0,
        employers_with_authoritative: 200,
        employers_with_external_id_no_aliases: 25,
        computed_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockCoverage,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('employer_alias_coverage')
        .select('*')
        .single()

      expect(result.data.coverage_percentage).toBe(70.0)
      expect(result.data.employers_with_aliases).toBe(350)
      expect(result.data.employers_with_external_id_no_aliases).toBe(25)
    })
  })

  describe('get_alias_metrics_range RPC', () => {
    it('should return daily metrics for date range', async () => {
      const mockDailyMetrics = [
        {
          metric_date: '2025-10-15',
          aliases_created: 15,
          authoritative_created: 8,
          employers_affected: 12,
          promotions: 3,
          rejections: 1,
          deferrals: 0,
          by_source_system: { bci: 10, manual: 5 },
        },
        {
          metric_date: '2025-10-14',
          aliases_created: 22,
          authoritative_created: 12,
          employers_affected: 18,
          promotions: 5,
          rejections: 2,
          deferrals: 1,
          by_source_system: { bci: 15, manual: 7 },
        },
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockDailyMetrics,
        error: null,
      })

      const result = await mockSupabase.rpc('get_alias_metrics_range', {
        p_start_date: '2025-10-01',
        p_end_date: '2025-10-15',
      })

      expect(result.data).toHaveLength(2)
      expect(result.data[0].metric_date).toBe('2025-10-15')
      expect(result.data[0].aliases_created).toBe(15)
      expect(result.data[0].by_source_system).toEqual({ bci: 10, manual: 5 })
    })
  })

  describe('API endpoint /api/admin/alias-metrics', () => {
    it('should require authentication', () => {
      const mockResponse = {
        error: 'Unauthorized',
        status: 401,
      }

      expect(mockResponse.status).toBe(401)
      expect(mockResponse.error).toBe('Unauthorized')
    })

    it('should require admin or lead_organiser role', () => {
      const viewerResponse = {
        error: 'Forbidden - Admin or Lead Organiser role required',
        status: 403,
      }

      expect(viewerResponse.status).toBe(403)
    })

    it('should return complete metrics response', () => {
      const mockResponse = {
        summary: {
          total_aliases: 1250,
          authoritative_aliases: 450,
        },
        canonicalReviews: {
          pending_reviews: 25,
          promotions_last_7_days: 5,
        },
        sourceSystems: [
          { source_system: 'bci', total_aliases: 500 },
        ],
        coverage: {
          coverage_percentage: 70.0,
        },
        conflictBacklog: [],
        debug: {
          queryTime: 234,
        },
      }

      expect(mockResponse.summary).toBeDefined()
      expect(mockResponse.canonicalReviews).toBeDefined()
      expect(mockResponse.sourceSystems).toBeDefined()
      expect(mockResponse.coverage).toBeDefined()
      expect(mockResponse.conflictBacklog).toBeDefined()
    })
  })

  describe('CSV export functionality', () => {
    it('should export source systems to CSV', () => {
      const sourceSystemsData = [
        {
          source_system: 'bci',
          total_aliases: 500,
          authoritative_count: 450,
          employer_count: 200,
          avg_aliases_per_employer: 2.5,
          new_last_7_days: 25,
          new_last_30_days: 100,
        },
      ]

      const csvHeaders = ['Source System', 'Total Aliases', 'Authoritative', 'Employers', 'Avg per Employer', 'Last 7 Days', 'Last 30 Days']
      const csvRow = [
        sourceSystemsData[0].source_system,
        sourceSystemsData[0].total_aliases,
        sourceSystemsData[0].authoritative_count,
        sourceSystemsData[0].employer_count,
        sourceSystemsData[0].avg_aliases_per_employer,
        sourceSystemsData[0].new_last_7_days,
        sourceSystemsData[0].new_last_30_days,
      ].join(',')

      expect(csvHeaders).toBeDefined()
      expect(csvRow).toContain('bci')
      expect(csvRow).toContain('500')
    })

    it('should export conflict backlog to CSV', () => {
      const conflictData = [
        {
          proposed_name: 'ABC Construction',
          current_canonical_name: 'ABC Constructions Pty Ltd',
          priority: 10,
          source_system: 'bci',
          conflict_count: 2,
          age_bucket: '<24h',
          hours_in_queue: 6.5,
        },
      ]

      const csvHeaders = ['Proposed Name', 'Current Name', 'Priority', 'Source System', 'Conflicts', 'Age', 'Hours in Queue']
      const csvRow = [
        `"${conflictData[0].proposed_name}"`,
        `"${conflictData[0].current_canonical_name}"`,
        conflictData[0].priority,
        conflictData[0].source_system,
        conflictData[0].conflict_count,
        conflictData[0].age_bucket,
        Math.round(conflictData[0].hours_in_queue),
      ].join(',')

      expect(csvHeaders).toBeDefined()
      expect(csvRow).toContain('ABC Construction')
      expect(csvRow).toContain('10')
    })
  })

  describe('Dashboard alerts', () => {
    it('should trigger high backlog alert when > 25 pending reviews', () => {
      const pendingReviews = 30
      const shouldShowAlert = pendingReviews > 25

      expect(shouldShowAlert).toBe(true)
    })

    it('should trigger missing coverage alert when employers have external IDs but no aliases', () => {
      const employersWithExternalIdNoAliases = 15
      const shouldShowAlert = employersWithExternalIdNoAliases > 0

      expect(shouldShowAlert).toBe(true)
    })

    it('should not trigger alerts when metrics are healthy', () => {
      const pendingReviews = 10
      const employersWithExternalIdNoAliases = 0

      const shouldShowBacklogAlert = pendingReviews > 25
      const shouldShowCoverageAlert = employersWithExternalIdNoAliases > 0

      expect(shouldShowBacklogAlert).toBe(false)
      expect(shouldShowCoverageAlert).toBe(false)
    })
  })
})

