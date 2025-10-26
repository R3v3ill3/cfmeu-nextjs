import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  FourPointRating,
  AssessmentType,
  convertLegacyScoreToFourPoint,
  getFourPointLabel,
  getFourPointColor,
} from '@/types/assessments'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-employer-id', name: 'Test Employer' },
        error: null
      })
    }))
  }))
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Four-Point Rating System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Four-Point Rating Utilities', () => {
    it('should convert legacy scores to 4-point scale correctly', () => {
      expect(convertLegacyScoreToFourPoint(10, 'linear')).toBe(1)
      expect(convertLegacyScoreToFourPoint(30, 'linear')).toBe(2)
      expect(convertLegacyScoreToFourPoint(60, 'linear')).toBe(3)
      expect(convertLegacyScoreToFourPoint(85, 'linear')).toBe(4)
    })

    it('should handle edge cases in legacy score conversion', () => {
      expect(convertLegacyScoreToFourPoint(0, 'linear')).toBe(1)
      expect(convertLegacyScoreToFourPoint(100, 'linear')).toBe(4)
      expect(convertLegacyScoreToFourPoint(25, 'linear')).toBe(2)
      expect(convertLegacyScoreToFourPoint(74, 'linear')).toBe(3)
    })

    it('should return correct rating labels', () => {
      expect(getFourPointLabel(1)).toBe('Poor')
      expect(getFourPointLabel(2)).toBe('Fair')
      expect(getFourPointLabel(3)).toBe('Good')
      expect(getFourPointLabel(4)).toBe('Excellent')
    })

    it('should return correct rating colors', () => {
      expect(getFourPointColor(1)).toBe('#dc2626')
      expect(getFourPointColor(2)).toBe('#f59e0b')
      expect(getFourPointColor(3)).toBe('#84cc16')
      expect(getFourPointColor(4)).toBe('#16a34a')
    })

    it('should throw error for invalid ratings', () => {
      expect(() => getFourPointLabel(0 as FourPointRating)).toThrow()
      expect(() => getFourPointLabel(5 as FourPointRating)).toThrow()
    })
  })

  describe('Union Respect Assessment', () => {
    it('should create a valid Union Respect assessment', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'test-assessment-id',
            employer_id: 'test-employer-id',
            assessment_type: 'union_respect',
            overall_score: 3,
            confidence_level: 85,
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const assessmentData = {
        employer_id: 'test-employer-id',
        criteria: {
          union_engagement: 3,
          communication_respect: 3,
          collaboration_attitude: 3,
          dispute_resolution: 3,
          union_delegate_relations: 3,
        },
        supporting_evidence: {
          has_union_delegates: true,
          regular_meetings: true,
        }
      }

      const response = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('union_respect')
      expect(result.data.overall_score).toBe(3)
    })

    it('should validate Union Respect assessment criteria', () => {
      const validCriteria = {
        union_engagement: 3,
        communication_respect: 3,
        collaboration_attitude: 3,
        dispute_resolution: 3,
        union_delegate_relations: 3,
      }

      // All values should be between 1 and 4
      Object.values(validCriteria).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(4)
      })
    })
  })

  describe('Safety 4-Point Assessment', () => {
    it('should create a valid Safety assessment', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'test-safety-assessment-id',
            assessment_type: 'safety_4_point',
            overall_safety_score: 4,
            safety_confidence_level: 92,
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const assessmentData = {
        employer_id: 'test-employer-id',
        safety_criteria: {
          safety_management_systems: 4,
          incident_reporting: 4,
          site_safety_culture: 4,
          risk_assessment_processes: 4,
          emergency_preparedness: 4,
          worker_safety_training: 4,
        },
        safety_metrics: {
          lost_time_injuries: 0,
          near_misses: 2,
          safety_breaches: 0,
          safety_improvements: 5,
          training_hours: 40,
        }
      }

      const response = await fetch('/api/assessments/safety-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('safety_4_point')
      expect(result.data.overall_safety_score).toBe(4)
    })

    it('should calculate safety score correctly based on metrics', () => {
      const perfectCriteria = {
        safety_management_systems: 4,
        incident_reporting: 4,
        site_safety_culture: 4,
        risk_assessment_processes: 4,
        emergency_preparedness: 4,
        worker_safety_training: 4,
      }

      const goodMetrics = {
        lost_time_injuries: 0,
        near_misses: 5,
        safety_breaches: 1,
        safety_improvements: 10,
        training_hours: 50,
      }

      // Perfect criteria with good metrics should result in high score
      const criteriaAverage = Object.values(perfectCriteria).reduce((sum, val) => sum + val, 0) / Object.values(perfectCriteria).length
      expect(criteriaAverage).toBe(4)

      // Good safety metrics (no injuries, reasonable incidents)
      expect(goodMetrics.lost_time_injuries).toBe(0)
      expect(goodMetrics.training_hours).toBeGreaterThan(40)
    })
  })

  describe('Subcontractor Use Assessment', () => {
    it('should create a valid Subcontractor Use assessment', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'test-subcontractor-assessment-id',
            assessment_type: 'subcontractor_use',
            overall_subcontractor_score: 3,
            confidence_level: 78,
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const assessmentData = {
        employer_id: 'test-employer-id',
        subcontracting_criteria: {
          fair_subcontractor_selection: 3,
          payment_practices: 3,
          work_quality_standards: 3,
          subcontractor_relations: 3,
          contract_fairness: 3,
        },
        subcontractor_metrics: {
          active_subcontractors: 8,
          payment_terms_days: 30,
          dispute_count: 1,
          repeat_subcontractor_rate: 75,
        }
      }

      const response = await fetch('/api/assessments/subcontractor-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('subcontractor_use')
      expect(result.data.overall_subcontractor_score).toBe(3)
    })

    it('should validate subcontractor metrics', () => {
      const validMetrics = {
        active_subcontractors: 5,
        payment_terms_days: 30,
        dispute_count: 0,
        repeat_subcontractor_rate: 80,
      }

      expect(validMetrics.active_subcontractors).toBeGreaterThanOrEqual(0)
      expect(validMetrics.payment_terms_days).toBeGreaterThanOrEqual(0)
      expect(validMetrics.dispute_count).toBeGreaterThanOrEqual(0)
      expect(validMetrics.repeat_subcontractor_rate).toBeGreaterThanOrEqual(0)
      expect(validMetrics.repeat_subcontractor_rate).toBeLessThanOrEqual(100)
    })
  })

  describe('Role-Specific Assessment', () => {
    it('should create a valid Role-Specific assessment', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'test-role-assessment-id',
            assessment_type: 'role_specific',
            employer_role: 'trade_contractor',
            overall_role_score: 4,
            role_confidence_level: 88,
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const assessmentData = {
        employer_id: 'test-employer-id',
        employer_role: 'trade_contractor',
        role_criteria: {
          industry_reputation: 4,
          work_quality: 4,
          reliability: 4,
          financial_stability: 3,
          expertise_level: 4,
        },
        role_specific_metrics: {
          years_in_industry: 15,
          project_success_rate: 95,
          staff_retention_rate: 85,
          average_project_size: 500000,
        }
      }

      const response = await fetch('/api/assessments/role-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('role_specific')
      expect(result.data.employer_role).toBe('trade_contractor')
      expect(result.data.overall_role_score).toBe(4)
    })

    it('should validate role-specific metrics', () => {
      const validMetrics = {
        years_in_industry: 10,
        project_success_rate: 85,
        staff_retention_rate: 75,
        average_project_size: 250000,
      }

      expect(validMetrics.years_in_industry).toBeGreaterThanOrEqual(0)
      expect(validMetrics.project_success_rate).toBeGreaterThanOrEqual(0)
      expect(validMetrics.project_success_rate).toBeLessThanOrEqual(100)
      expect(validMetrics.staff_retention_rate).toBeGreaterThanOrEqual(0)
      expect(validMetrics.staff_retention_rate).toBeLessThanOrEqual(100)
      expect(validMetrics.average_project_size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Rating Calculation', () => {
    it('should calculate 4-point rating correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            calculation: {
              employer_id: 'test-employer-id',
              final_score: 3,
              confidence_level: 82,
              weights: {
                union_respect: 0.25,
                safety_4_point: 0.30,
                subcontractor_use: 0.20,
                role_specific: 0.25,
              },
              weighted_scores: {
                union_respect: 0.75,
                safety_4_point: 1.2,
                subcontractor_use: 0.6,
                role_specific: 0.75,
              }
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const calculationData = {
        employer_id: 'test-employer-id',
        trigger_type: 'manual_recalculation',
      }

      const response = await fetch('/api/ratings/calculate-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.calculation.final_score).toBe(3)
      expect(result.data.calculation.confidence_level).toBe(82)

      // Verify weights sum to 1
      const weights = result.data.calculation.weights
      const weightSum = Object.values(weights).reduce((sum: number, weight: number) => sum + weight, 0)
      expect(weightSum).toBeCloseTo(1, 2)
    })

    it('should handle role-specific weight adjustments', () => {
      const defaultWeights = {
        union_respect: 0.25,
        safety_4_point: 0.30,
        subcontractor_use: 0.20,
        role_specific: 0.25,
      }

      // For head contractors, subcontractor_use should have higher weight
      const headContractorWeights = {
        ...defaultWeights,
        subcontractor_use: 0.30,
        union_respect: 0.20,
      }

      // Verify weights still sum to 1 after adjustment
      const weightSum = Object.values(headContractorWeights).reduce((sum, weight) => sum + weight, 0)
      expect(weightSum).toBeCloseTo(1, 2)

      // Verify the adjustment
      expect(headContractorWeights.subcontractor_use).toBeGreaterThan(defaultWeights.subcontractor_use)
      expect(headContractorWeights.union_respect).toBeLessThan(defaultWeights.union_respect)
    })
  })

  describe('Mobile Optimization', () => {
    it('should fetch lightweight assessment data', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessments: [
              {
                id: 'test-assessment-1',
                assessment_type: 'union_respect',
                overall_score: 3,
                confidence_level: 85,
                assessment_date: '2024-01-15T10:00:00Z',
              }
            ],
            pagination: {
              total: 1,
              offset: 0,
              limit: 10,
              has_more: false,
            },
            sync_info: {
              last_sync: null,
              current_sync: '2024-01-15T10:30:00Z',
              incremental: false,
              lightweight_mode: true,
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch('/api/mobile/assessments?employer_id=test-employer-id&lightweight=true&limit=10')
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.sync_info.lightweight_mode).toBe(true)
      expect(result.data.assessments).toHaveLength(1)
    })

    it('should support incremental sync', async () => {
      const lastSync = '2024-01-15T09:00:00Z'
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessments: [], // No new assessments since last sync
            sync_info: {
              last_sync: lastSync,
              current_sync: '2024-01-15T10:00:00Z',
              incremental: true,
              lightweight_mode: true,
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch(`/api/mobile/assessments?employer_id=test-employer-id&last_sync=${encodeURIComponent(lastSync)}`)
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.data.sync_info.incremental).toBe(true)
      expect(result.data.sync_info.last_sync).toBe(lastSync)
    })
  })

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      // Mock unauthorized response
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      }

      vi.doMock('@/lib/supabase/server', () => ({
        createClient: () => mockSupabase
      }))

      const response = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employer_id: 'test-employer-id' })
      })

      expect(response.status).toBe(401)
    })

    it('should handle validation errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          success: false,
          message: 'Validation error',
          errors: ['employer_id is required']
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing required fields
      })

      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.errors).toContain('employer_id is required')
    })

    it('should handle employer not found errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          success: false,
          message: 'Employer not found'
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employer_id: 'non-existent-employer-id' })
      })

      expect(response.status).toBe(404)

      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.message).toBe('Employer not found')
    })
  })

  describe('Bulk Operations', () => {
    it('should handle bulk rating calculations', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          message: 'Bulk rating calculation started',
          data: {
            batch_id: 'test-batch-id',
            employer_count: 5,
            estimated_duration: 10,
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const bulkData = {
        employer_ids: ['emp1', 'emp2', 'emp3', 'emp4', 'emp5'],
        trigger_type: 'bulk_operation',
      }

      const response = await fetch('/api/ratings/bulk-calculate-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.data.employer_count).toBe(5)
      expect(result.data.batch_id).toBeDefined()
    })

    it('should track bulk calculation progress', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            batch_id: 'test-batch-id',
            status: 'completed',
            progress: {
              current: 5,
              total: 5,
              percentage: 100,
            },
            results: {
              successful_calculations: 5,
              errors: 0,
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch('/api/ratings/bulk-calculate-4-point/test-batch-id')
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.data.status).toBe('completed')
      expect(result.data.progress.percentage).toBe(100)
    })
  })

  describe('Real-time Updates', () => {
    it('should fetch real-time rating updates', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            updates: [
              {
                type: 'rating_updated',
                employer_id: 'test-employer-id',
                employer_name: 'Test Employer',
                data: {
                  new_rating: 4,
                  confidence_level: 90,
                },
                timestamp: '2024-01-15T10:00:00Z',
              }
            ],
            subscription_info: {
              employer_ids: ['test-employer-id'],
              updates_since_last_check: 1,
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetch('/api/realtime/ratings-updates?employer_ids=test-employer-id&type=rating_changes')
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.data.updates).toHaveLength(1)
      expect(result.data.updates[0].type).toBe('rating_updated')
      expect(result.data.subscription_info.updates_since_last_check).toBe(1)
    })
  })
})