import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { rest } from 'msw'
import { server } from '../mocks/server'

describe('Rating Calculation API Testing Suite', () => {
  const API_BASE = 'http://localhost:3000/api'

  beforeEach(() => {
    server.resetHandlers()
  })

  describe('4-Point Rating Calculation API', () => {
    const validCalculationData = {
      employer_id: 'test-employer-id',
      trigger_type: 'manual_recalculation',
      force_recalculate: false
    }

    it('should calculate 4-point rating successfully', async () => {
      const response = await fetch(`${API_BASE}/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validCalculationData)
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.calculation.final_score).toBeValidFourPointRating()
      expect(result.data.calculation.confidence_level).toBeValidConfidenceLevel()
      expect(result.data.calculation.weights).toBeDefined()
      expect(result.data.calculation.weighted_scores).toBeDefined()

      // Verify weights sum to 1
      const weights = result.data.calculation.weights
      const weightSum = Object.values(weights).reduce((sum: number, weight: number) => sum + weight, 0)
      expect(weightSum).toBeCloseTo(1, 2)
    })

    it('should apply role-specific weight adjustments', async () => {
      // Mock head contractor calculation with adjusted weights
      server.use(
        rest.post(`${API_BASE}/ratings/calculate-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                calculation: {
                  employer_id: 'head-contractor-id',
                  employer_role: 'head_contractor',
                  final_score: 3,
                  confidence_level: 85,
                  weights: {
                    union_respect: 0.20,      // Reduced for head contractors
                    safety_4_point: 0.30,
                    subcontractor_use: 0.30,  // Increased for head contractors
                    role_specific: 0.20,
                  },
                  weighted_scores: {
                    union_respect: 0.6,
                    safety_4_point: 1.2,
                    subcontractor_use: 0.9,
                    role_specific: 0.6,
                  },
                  weight_adjustments: {
                    role: 'head_contractor',
                    base_weights: {
                      union_respect: 0.25,
                      subcontractor_use: 0.20,
                    },
                    adjusted_weights: {
                      union_respect: 0.20,
                      subcontractor_use: 0.30,
                    }
                  }
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          employer_id: 'head-contractor-id',
          trigger_type: 'manual_recalculation'
        })
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.calculation.weights.subcontractor_use).toBe(0.30)
      expect(result.data.calculation.weights.union_respect).toBe(0.20)
      expect(result.data.calculation.weight_adjustments.role).toBe('head_contractor')
    })

    it('should handle missing assessments gracefully', async () => {
      // Mock calculation with missing assessments
      server.use(
        rest.post(`${API_BASE}/ratings/calculate-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                calculation: {
                  employer_id: 'partial-data-employer',
                  final_score: 2,
                  confidence_level: 45, // Lower confidence due to missing data
                  weights: {
                    union_respect: 0.25,
                    safety_4_point: 0.30,
                    subcontractor_use: 0.20,
                    role_specific: 0.25,
                  },
                  weighted_scores: {
                    union_respect: 0.75,
                    safety_4_point: 0,     // Missing assessment
                    subcontractor_use: 0.6,
                    role_specific: 0,
                  },
                  assessment_availability: {
                    union_respect: true,
                    safety_4_point: false,
                    subcontractor_use: true,
                    role_specific: false,
                  },
                  warnings: [
                    'Safety assessment not found - using default score',
                    'Role-specific assessment not found - using default score'
                  ]
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          employer_id: 'partial-data-employer',
          trigger_type: 'manual_recalculation'
        })
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.calculation.confidence_level).toBeLessThan(50)
      expect(result.data.calculation.warnings).toHaveLength(2)
      expect(result.data.calculation.assessment_availability.safety_4_point).toBe(false)
    })

    it('should validate calculation input parameters', async () => {
      const invalidData = {
        employer_id: '', // Invalid: empty string
        trigger_type: 'invalid_trigger' // Invalid trigger type
      }

      // Mock validation error
      server.use(
        rest.post(`${API_BASE}/ratings/calculate-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              message: 'Validation error',
              errors: [
                'employer_id is required',
                'trigger_type must be one of: manual_recalculation, assessment_update, bulk_operation'
              ]
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(invalidData)
      })

      expect(response.status).toBe(400)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('employer_id is required')
    })
  })

  describe('Rating Summary API', () => {
    it('should retrieve 4-point rating summary for employer', async () => {
      const employerId = 'test-employer-id'
      const response = await fetch(`${API_BASE}/ratings/${employerId}/4-point-summary`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.final_score).toBeValidFourPointRating()
      expect(result.data.confidence_level).toBeValidConfidenceLevel()
      expect(result.data.breakdown).toBeDefined()

      // Verify breakdown structure
      const breakdown = result.data.breakdown
      expect(breakdown.union_respect).toBeDefined()
      expect(breakdown.safety_4_point).toBeDefined()
      expect(breakdown.subcontractor_use).toBeDefined()
      expect(breakdown.role_specific).toBeDefined()

      Object.values(breakdown).forEach((assessment: any) => {
        expect(assessment.score).toBeValidFourPointRating()
        expect(assessment.confidence).toBeValidConfidenceLevel()
        expect(assessment.last_assessed).toBeDefined()
      })
    })

    it('should include rating trend information', async () => {
      const employerId = 'trend-test-employer'

      // Mock response with trend data
      server.use(
        rest.get(`${API_BASE}/ratings/${employerId}/4-point-summary`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                employer_id: employerId,
                final_score: 3,
                confidence_level: 85,
                breakdown: {
                  union_respect: { score: 3, confidence: 85, last_assessed: '2024-01-15T10:00:00Z' },
                  safety_4_point: { score: 4, confidence: 92, last_assessed: '2024-01-14T15:30:00Z' },
                  subcontractor_use: { score: 3, confidence: 78, last_assessed: '2024-01-13T09:15:00Z' },
                  role_specific: { score: 3, confidence: 88, last_assessed: '2024-01-12T11:45:00Z' },
                },
                trend: {
                  current_period: {
                    score: 3,
                    confidence: 85,
                    period_start: '2024-01-01T00:00:00Z',
                    period_end: '2024-01-15T23:59:59Z'
                  },
                  previous_period: {
                    score: 2,
                    confidence: 80,
                    period_start: '2023-12-01T00:00:00Z',
                    period_end: '2023-12-31T23:59:59Z'
                  },
                  trend_direction: 'improving',
                  trend_magnitude: 1,
                  trend_confidence: 75
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/${employerId}/4-point-summary?include_trend=true`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.trend).toBeDefined()
      expect(result.data.trend.current_period.score).toBe(3)
      expect(result.data.trend.previous_period.score).toBe(2)
      expect(result.data.trend.trend_direction).toBe('improving')
      expect(result.data.trend.trend_magnitude).toBe(1)
    })

    it('should handle employer with no rating data', async () => {
      const employerId = 'no-data-employer'

      // Mock response for employer with no data
      server.use(
        rest.get(`${API_BASE}/ratings/${employerId}/4-point-summary`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                employer_id: employerId,
                final_score: null,
                confidence_level: 0,
                breakdown: {
                  union_respect: null,
                  safety_4_point: null,
                  subcontractor_use: null,
                  role_specific: null,
                },
                status: 'no_data',
                message: 'No assessments found for this employer'
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/${employerId}/4-point-summary`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.final_score).toBeNull()
      expect(result.data.confidence_level).toBe(0)
      expect(result.data.status).toBe('no_data')
    })
  })

  describe('Bulk Rating Calculation API', () => {
    const validBulkData = {
      employer_ids: ['emp1', 'emp2', 'emp3', 'emp4', 'emp5'],
      trigger_type: 'bulk_operation',
      priority: 'normal'
    }

    it('should start bulk rating calculation', async () => {
      const response = await fetch(`${API_BASE}/ratings/bulk-calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validBulkData)
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.batch_id).toBeDefined()
      expect(result.data.employer_count).toBe(5)
      expect(result.data.estimated_duration).toBeGreaterThan(0)
      expect(result.data.status).toBe('queued')
    })

    it('should track bulk calculation progress', async () => {
      const batchId = 'test-batch-id'

      // Mock progress response
      server.use(
        rest.get(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                batch_id: batchId,
                status: 'in_progress',
                progress: {
                  current: 3,
                  total: 5,
                  percentage: 60,
                  estimated_remaining: 4,
                },
                started_at: '2024-01-15T10:00:00Z',
                estimated_completion: '2024-01-15T10:10:00Z',
                results: {
                  successful_calculations: 3,
                  errors: 0,
                  skipped: 0,
                },
                current_employer: {
                  id: 'emp3',
                  name: 'Test Employer 3',
                  status: 'processing'
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.status).toBe('in_progress')
      expect(result.data.progress.percentage).toBe(60)
      expect(result.data.results.successful_calculations).toBe(3)
      expect(result.data.current_employer.id).toBe('emp3')
    })

    it('should handle completed bulk calculation', async () => {
      const batchId = 'completed-batch-id'

      // Mock completed response
      server.use(
        rest.get(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                batch_id: batchId,
                status: 'completed',
                progress: {
                  current: 5,
                  total: 5,
                  percentage: 100,
                  estimated_remaining: 0,
                },
                started_at: '2024-01-15T10:00:00Z',
                completed_at: '2024-01-15T10:08:00Z',
                duration_seconds: 480,
                results: {
                  successful_calculations: 5,
                  errors: 0,
                  skipped: 0,
                },
                summary: {
                  average_rating: 3.2,
                  average_confidence: 82.5,
                  rating_distribution: {
                    1: 0,
                    2: 1,
                    3: 2,
                    4: 2,
                  }
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.status).toBe('completed')
      expect(result.data.progress.percentage).toBe(100)
      expect(result.data.results.successful_calculations).toBe(5)
      expect(result.data.summary.average_rating).toBe(3.2)
      expect(result.data.summary.rating_distribution).toBeDefined()
    })

    it('should handle bulk calculation errors', async () => {
      const batchId = 'error-batch-id'

      // Mock error response
      server.use(
        rest.get(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                batch_id: batchId,
                status: 'failed',
                progress: {
                  current: 2,
                  total: 5,
                  percentage: 40,
                  estimated_remaining: 0,
                },
                error: {
                  type: 'database_error',
                  message: 'Connection timeout during calculation',
                  failed_at_employer: 'emp3',
                  retry_available: true
                },
                results: {
                  successful_calculations: 2,
                  errors: 1,
                  skipped: 0,
                },
                error_details: [
                  {
                    employer_id: 'emp3',
                    error_type: 'database_timeout',
                    error_message: 'Query timeout after 30 seconds',
                    timestamp: '2024-01-15T10:05:00Z'
                  }
                ]
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/bulk-calculate-4-point/${batchId}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.status).toBe('failed')
      expect(result.data.error.type).toBe('database_error')
      expect(result.data.error.retry_available).toBe(true)
      expect(result.data.error_details).toHaveLength(1)
    })

    it('should validate bulk calculation request', async () => {
      const invalidBulkData = {
        employer_ids: [], // Empty array
        trigger_type: 'bulk_operation'
      }

      // Mock validation error
      server.use(
        rest.post(`${API_BASE}/ratings/bulk-calculate-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              message: 'Validation error',
              errors: ['employer_ids must contain at least 1 employer']
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/bulk-calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(invalidBulkData)
      })

      expect(response.status).toBe(400)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('employer_ids must contain at least 1 employer')
    })
  })

  describe('Rating Distribution and Analytics API', () => {
    it('should retrieve rating distribution statistics', async () => {
      // Mock distribution response
      server.use(
        rest.get(`${API_BASE}/ratings/distribution-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                overall_distribution: {
                  1: { count: 15, percentage: 15.0 },
                  2: { count: 25, percentage: 25.0 },
                  3: { count: 40, percentage: 40.0 },
                  4: { count: 20, percentage: 20.0 },
                },
                total_employers: 100,
                average_rating: 2.95,
                median_rating: 3,
                confidence_distribution: {
                  high: 45,    // > 80%
                  medium: 35,  // 60-80%
                  low: 20      // < 60%
                },
                by_role: {
                  trade_contractor: {
                    distribution: { 1: 8, 2: 15, 3: 25, 4: 12 },
                    count: 60,
                    average: 3.02
                  },
                  head_contractor: {
                    distribution: { 1: 7, 2: 10, 3: 15, 4: 8 },
                    count: 40,
                    average: 2.85
                  }
                },
                last_updated: '2024-01-15T10:00:00Z'
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/distribution-4-point`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.overall_distribution).toBeDefined()
      expect(result.data.total_employers).toBe(100)
      expect(result.data.average_rating).toBe(2.95)
      expect(result.data.confidence_distribution).toBeDefined()
      expect(result.data.by_role).toBeDefined()

      // Verify distribution percentages sum to 100
      const totalPercentage = Object.values(result.data.overall_distribution)
        .reduce((sum: number, rating: any) => sum + rating.percentage, 0)
      expect(totalPercentage).toBeCloseTo(100, 1)
    })

    it('should support filtered distribution queries', async () => {
      const queryParams = new URLSearchParams({
        role: 'trade_contractor',
        min_confidence: '80',
        date_range: '2024-01-01,2024-01-31'
      })

      // Mock filtered response
      server.use(
        rest.get(`${API_BASE}/ratings/distribution-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                overall_distribution: {
                  1: { count: 3, percentage: 10.0 },
                  2: { count: 6, percentage: 20.0 },
                  3: { count: 12, percentage: 40.0 },
                  4: { count: 9, percentage: 30.0 },
                },
                total_employers: 30,
                average_rating: 3.1,
                filters_applied: {
                  role: 'trade_contractor',
                  min_confidence: 80,
                  date_range: '2024-01-01 to 2024-01-31'
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/distribution-4-point?${queryParams}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.total_employers).toBe(30)
      expect(result.data.filters_applied.role).toBe('trade_contractor')
      expect(result.data.filters_applied.min_confidence).toBe(80)
    })
  })

  describe('Rating Performance and Caching', () => {
    it('should include caching headers in responses', async () => {
      const employerId = 'cached-employer'

      // Mock response with caching headers
      server.use(
        rest.get(`${API_BASE}/ratings/${employerId}/4-point-summary`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.set({
              'Cache-Control': 'public, max-age=300', // 5 minutes
              'ETag': 'W/"test-etag-123"',
              'Last-Modified': 'Mon, 15 Jan 2024 10:00:00 GMT'
            }),
            ctx.json({
              success: true,
              data: global.testUtils.createMockRating(employerId)
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/${employerId}/4-point-summary`)

      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
      expect(response.headers.get('ETag')).toBe('W/"test-etag-123"')
      expect(response.headers.get('Last-Modified')).toBeDefined()
    })

    it('should handle conditional requests with ETags', async () => {
      const employerId = 'conditional-employer'
      const eTag = 'W/"test-etag-456"'

      // Mock 304 Not Modified response
      server.use(
        rest.get(`${API_BASE}/ratings/${employerId}/4-point-summary`, (req, res, ctx) => {
          const ifNoneMatch = req.headers.get('If-None-Match')

          if (ifNoneMatch === eTag) {
            return res(
              ctx.status(304),
              ctx.set('ETag', eTag)
            )
          }

          return res(
            ctx.status(200),
            ctx.set('ETag', eTag),
            ctx.json({
              success: true,
              data: global.testUtils.createMockRating(employerId)
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/ratings/${employerId}/4-point-summary`, {
        headers: {
          'If-None-Match': eTag
        }
      })

      expect(response.status).toBe(304)
    })
  })
})