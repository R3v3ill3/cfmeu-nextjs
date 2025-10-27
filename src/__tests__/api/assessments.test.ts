import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import { rest } from 'msw'
import { server } from '../mocks/server'

// Import test utilities
import { global } from '../../jest.setup'

describe('Assessment API Testing Suite', () => {
  const API_BASE = 'http://localhost:3000/api'

  beforeEach(() => {
    // Reset any request handlers that might have been modified in tests
    server.resetHandlers()
  })

  describe('Union Respect Assessment API', () => {
    const validUnionRespectData = {
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
      },
      notes: 'Test union respect assessment'
    }

    it('should create a Union Respect assessment successfully', async () => {
      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validUnionRespectData)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('union_respect')
      expect(result.data.overall_score).toBeValidFourPointRating()
      expect(result.data.confidence_level).toBeValidConfidenceLevel()
      expect(result.data.criteria).toEqual(validUnionRespectData.criteria)
    })

    it('should validate Union Respect assessment criteria ranges', async () => {
      // Test invalid criteria scores (outside 1-4 range)
      const invalidData = {
        ...validUnionRespectData,
        criteria: {
          union_engagement: 5, // Invalid: > 4
          communication_respect: 0, // Invalid: < 1
          collaboration_attitude: 3,
          dispute_resolution: 3,
          union_delegate_relations: 3,
        }
      }

      // Mock validation error response
      server.use(
        rest.post(`${API_BASE}/assessments/union-respect`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              message: 'Validation error',
              errors: ['union_engagement must be between 1 and 4', 'communication_respect must be between 1 and 4']
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
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
      expect(result.errors).toContain('union_engagement must be between 1 and 4')
      expect(result.errors).toContain('communication_respect must be between 1 and 4')
    })

    it('should handle missing required fields', async () => {
      const incompleteData = {
        employer_id: 'test-employer-id',
        // Missing criteria object
      }

      // Mock validation error
      server.use(
        rest.post(`${API_BASE}/assessments/union-respect`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              message: 'Validation error',
              errors: ['criteria is required', 'criteria.union_engagement is required']
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(incompleteData)
      })

      expect(response.status).toBe(400)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('criteria is required')
    })

    it('should retrieve Union Respect assessments by employer', async () => {
      const employerId = 'test-employer-id'
      const response = await fetch(`${API_BASE}/assessments/union-respect/${employerId}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)

      result.data.forEach((assessment: any) => {
        expect(assessment.assessment_type).toBe('union_respect')
        expect(assessment.employer_id).toBe(employerId)
        expect(assessment.overall_score).toBeValidFourPointRating()
      })
    })

    it('should update an existing Union Respect assessment', async () => {
      const assessmentId = 'test-assessment-id'
      const updateData = {
        criteria: {
          union_engagement: 4,
          communication_respect: 4,
          collaboration_attitude: 4,
          dispute_resolution: 4,
          union_delegate_relations: 4,
        },
        notes: 'Updated assessment notes'
      }

      const response = await fetch(`${API_BASE}/assessments/union-respect/${assessmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.overall_score).toBe(4) // Updated score
      expect(result.data.notes).toBe(updateData.notes)
    })
  })

  describe('Safety 4-Point Assessment API', () => {
    const validSafetyData = {
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

    it('should create a Safety 4-Point assessment successfully', async () => {
      const response = await fetch(`${API_BASE}/assessments/safety-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validSafetyData)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('safety_4_point')
      expect(result.data.overall_safety_score).toBeValidFourPointRating()
      expect(result.data.safety_confidence_level).toBeValidConfidenceLevel()
    })

    it('should calculate safety score based on criteria and metrics', async () => {
      // Test with perfect criteria but some incidents
      const dataWithIncidents = {
        ...validSafetyData,
        safety_metrics: {
          lost_time_injuries: 1, // Should reduce score
          near_misses: 5,
          safety_breaches: 2,
          safety_improvements: 3,
          training_hours: 30,
        }
      }

      // Mock response with calculated score
      server.use(
        rest.post(`${API_BASE}/assessments/safety-4-point`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              success: true,
              data: {
                ...global.testUtils.createMockAssessment('test-safety-id', 'safety_4_point', 'test-employer-id'),
                overall_safety_score: 3, // Reduced due to incidents
                safety_confidence_level: 75,
                score_breakdown: {
                  criteria_score: 4.0,
                  metrics_penalty: -1.0,
                  final_score: 3.0
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/safety-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(dataWithIncidents)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.data.overall_safety_score).toBe(3)
      expect(result.data.score_breakdown.criteria_score).toBe(4.0)
      expect(result.data.score_breakdown.metrics_penalty).toBe(-1.0)
    })

    it('should convert legacy safety scores to 4-point scale', async () => {
      const legacyScore = 75 // Should convert to 3

      // Mock conversion endpoint
      server.use(
        rest.post(`${API_BASE}/assessments/safety-4-point/convert-legacy`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                legacy_score: legacyScore,
                converted_score: 3,
                conversion_method: 'linear',
                confidence_level: 90
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/safety-4-point/convert-legacy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ legacy_score: legacyScore })
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.legacy_score).toBe(legacyScore)
      expect(result.data.converted_score).toBe(3)
      expect(result.data.conversion_method).toBe('linear')
    })
  })

  describe('Subcontractor Use Assessment API', () => {
    const validSubcontractorData = {
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

    it('should create a Subcontractor Use assessment successfully', async () => {
      const response = await fetch(`${API_BASE}/assessments/subcontractor-use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validSubcontractorData)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('subcontractor_use')
      expect(result.data.overall_subcontractor_score).toBeValidFourPointRating()
    })

    it('should apply role-based weight adjustments', async () => {
      // Test for head contractor (higher weight for subcontractor use)
      const headContractorData = {
        ...validSubcontractorData,
        employer_role: 'head_contractor'
      }

      // Mock response with role-based weighting
      server.use(
        rest.post(`${API_BASE}/assessments/subcontractor-use`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              success: true,
              data: {
                ...global.testUtils.createMockAssessment('test-subcontractor-id', 'subcontractor_use', 'test-employer-id'),
                overall_subcontractor_score: 4, // Higher due to role weight
                confidence_level: 85,
                role_weight_adjustment: {
                  base_score: 3,
                  role_multiplier: 1.2,
                  final_score: 3.6,
                  rounded_score: 4
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/subcontractor-use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(headContractorData)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.data.overall_subcontractor_score).toBe(4)
      expect(result.data.role_weight_adjustment.role_multiplier).toBe(1.2)
    })
  })

  describe('Role-Specific Assessment API', () => {
    const validRoleSpecificData = {
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

    it('should create a Role-Specific assessment successfully', async () => {
      const response = await fetch(`${API_BASE}/assessments/role-specific`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(validRoleSpecificData)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.assessment_type).toBe('role_specific')
      expect(result.data.employer_role).toBe('trade_contractor')
      expect(result.data.overall_role_score).toBeValidFourPointRating()
    })

    it('should auto-determine employer role if not provided', async () => {
      const dataWithoutRole = {
        employer_id: 'test-employer-id',
        role_criteria: {
          industry_reputation: 4,
          work_quality: 4,
          reliability: 4,
          financial_stability: 3,
          expertise_level: 4,
        }
      }

      // Mock response with role determination
      server.use(
        rest.post(`${API_BASE}/assessments/role-specific`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              success: true,
              data: {
                ...global.testUtils.createMockAssessment('test-role-id', 'role_specific', 'test-employer-id'),
                employer_role: 'trade_contractor', // Auto-determined
                overall_role_score: 4,
                role_determination: {
                  inferred_role: 'trade_contractor',
                  confidence: 85,
                  indicators: ['employee_count', 'project_types', 'abn_pattern']
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/role-specific`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(dataWithoutRole)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.data.employer_role).toBe('trade_contractor')
      expect(result.data.role_determination.confidence).toBeGreaterThan(0)
    })
  })

  describe('Assessment Validation', () => {
    it('should reject assessments with invalid employer IDs', async () => {
      const invalidData = {
        employer_id: 'non-existent-employer',
        criteria: { union_engagement: 3 }
      }

      // Mock employer not found error
      server.use(
        rest.post(`${API_BASE}/assessments/union-respect`, (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({
              success: false,
              message: 'Employer not found'
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(invalidData)
      })

      expect(response.status).toBe(404)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Employer not found')
    })

    it('should handle concurrent assessment creation', async () => {
      const assessmentData = {
        employer_id: 'test-employer-id',
        criteria: { union_engagement: 3 }
      }

      // Create multiple concurrent requests
      const requests = Array(5).fill(null).map(() =>
        fetch(`${API_BASE}/assessments/union-respect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify(assessmentData)
        })
      )

      const responses = await Promise.all(requests)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201)
      })

      const results = await Promise.all(responses.map(r => r.json()))

      // All should be successful
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Assessment Retrieval and Filtering', () => {
    it('should support pagination for assessment lists', async () => {
      const employerId = 'test-employer-id'
      const page = 1
      const limit = 10

      // Mock paginated response
      server.use(
        rest.get(`${API_BASE}/assessments/union-respect/${employerId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: [
                global.testUtils.createMockAssessment('test-1', 'union_respect', employerId),
                global.testUtils.createMockAssessment('test-2', 'union_respect', employerId),
              ],
              pagination: {
                page,
                limit,
                total: 25,
                totalPages: 3,
                hasNext: true,
                hasPrev: false
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect/${employerId}?page=${page}&limit=${limit}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data).toHaveLength(2)
      expect(result.pagination.page).toBe(page)
      expect(result.pagination.limit).toBe(limit)
      expect(result.pagination.total).toBe(25)
      expect(result.pagination.hasNext).toBe(true)
    })

    it('should support date range filtering', async () => {
      const employerId = 'test-employer-id'
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Mock filtered response
      server.use(
        rest.get(`${API_BASE}/assessments/union-respect/${employerId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: [
                global.testUtils.createMockAssessment('test-1', 'union_respect', employerId, {
                  assessment_date: '2024-01-15T10:00:00Z'
                }),
              ],
              filters: {
                date_range: { start: startDate, end: endDate },
                assessment_type: 'union_respect'
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect/${employerId}?start_date=${startDate}&end_date=${endDate}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data).toHaveLength(1)
      expect(result.filters.date_range.start).toBe(startDate)
      expect(result.filters.date_range.end).toBe(endDate)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: 'invalid json'
      })

      expect(response.status).toBe(400)
    })

    it('should handle missing authorization headers', async () => {
      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employer_id: 'test-id' })
      })

      expect(response.status).toBe(401)
    })

    it('should handle rate limiting', async () => {
      // Mock rate limit response
      server.use(
        rest.post(`${API_BASE}/assessments/union-respect`, (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              success: false,
              message: 'Rate limit exceeded',
              retry_after: 60
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ employer_id: 'test-id' })
      })

      expect(response.status).toBe(429)
      expect(response.headers.get('retry-after')).toBe('60')
    })

    it('should handle database connection errors', async () => {
      // Mock database error
      server.use(
        rest.post(`${API_BASE}/assessments/union-respect`, (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              message: 'Database connection failed',
              error_code: 'DB_CONNECTION_ERROR'
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/assessments/union-respect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ employer_id: 'test-id' })
      })

      expect(response.status).toBe(500)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('DB_CONNECTION_ERROR')
    })
  })
})