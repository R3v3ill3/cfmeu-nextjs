import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FourPointRating, AssessmentType } from '@/types/assessments'

// Integration tests for the complete rating workflow
describe('Rating Workflow Integration', () => {
  const mockEmployerId = 'integration-test-employer-id'
  const mockUserId = 'integration-test-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Assessment Workflow', () => {
    it('should complete full assessment workflow for a trade contractor', async () => {
      // Mock responses for each step
      const mockEmployerResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: mockEmployerId,
            name: 'Test Trade Contractor',
            employer_type: 'trade_contractor'
          }
        })
      }

      const mockUnionAssessmentResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'union-assessment-id',
              assessment_type: 'union_respect',
              overall_score: 3,
              confidence_level: 85
            }
          }
        })
      }

      const mockSafetyAssessmentResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'safety-assessment-id',
              assessment_type: 'safety_4_point',
              overall_safety_score: 4,
              safety_confidence_level: 92
            }
          }
        })
      }

      const mockRoleAssessmentResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'role-assessment-id',
              assessment_type: 'role_specific',
              employer_role: 'trade_contractor',
              overall_role_score: 4,
              role_confidence_level: 88
            }
          }
        })
      }

      const mockRatingCalculationResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            calculation: {
              employer_id: mockEmployerId,
              final_score: 4,
              confidence_level: 88,
              weights: {
                union_respect: 0.20,
                safety_4_point: 0.35,
                subcontractor_use: 0.15,
                role_specific: 0.30
              },
              calculation_breakdown: {
                total_assessments: 3,
                assessment_types_used: ['union_respect', 'safety_4_point', 'role_specific'],
                data_quality_score: 90
              }
            }
          }
        })
      }

      // Mock fetch to return different responses based on URL
      ;(global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/employers/') && options?.method !== 'POST') {
          return Promise.resolve(mockEmployerResponse)
        }
        if (url.includes('/assessments/union-respect') && options?.method === 'POST') {
          return Promise.resolve(mockUnionAssessmentResponse)
        }
        if (url.includes('/assessments/safety-4-point') && options?.method === 'POST') {
          return Promise.resolve(mockSafetyAssessmentResponse)
        }
        if (url.includes('/assessments/role-specific') && options?.method === 'POST') {
          return Promise.resolve(mockRoleAssessmentResponse)
        }
        if (url.includes('/ratings/calculate-4-point') && options?.method === 'POST') {
          return Promise.resolve(mockRatingCalculationResponse)
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      // Step 1: Create Union Respect Assessment
      const unionResponse = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
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
        })
      })

      expect(unionResponse.ok).toBe(true)
      const unionResult = await unionResponse.json()
      expect(unionResult.data.assessment.overall_score).toBe(3)

      // Step 2: Create Safety Assessment
      const safetyResponse = await fetch('/api/assessments/safety-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
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
            safety_improvements: 8,
            training_hours: 60,
          }
        })
      })

      expect(safetyResponse.ok).toBe(true)
      const safetyResult = await safetyResponse.json()
      expect(safetyResult.data.assessment.overall_safety_score).toBe(4)

      // Step 3: Create Role-Specific Assessment
      const roleResponse = await fetch('/api/assessments/role-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          employer_role: 'trade_contractor',
          role_criteria: {
            industry_reputation: 4,
            work_quality: 4,
            reliability: 4,
            financial_stability: 3,
            expertise_level: 4,
          },
          role_specific_metrics: {
            years_in_industry: 12,
            project_success_rate: 95,
            staff_retention_rate: 85,
            average_project_size: 350000,
          }
        })
      })

      expect(roleResponse.ok).toBe(true)
      const roleResult = await roleResponse.json()
      expect(roleResult.data.assessment.overall_role_score).toBe(4)

      // Step 4: Calculate Final Rating
      const ratingResponse = await fetch('/api/ratings/calculate-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          trigger_type: 'manual_recalculation'
        })
      })

      expect(ratingResponse.ok).toBe(true)
      const ratingResult = await ratingResponse.json()

      // Verify the final rating calculation
      expect(ratingResult.data.calculation.final_score).toBe(4)
      expect(ratingResult.data.calculation.confidence_level).toBe(88)
      expect(ratingResult.data.calculation.weights.safety_4_point).toBe(0.35) // Higher weight for trade contractor
      expect(ratingResult.data.calculation.weights.role_specific).toBe(0.30) // High weight for expertise
      expect(ratingResult.data.calculation.calculation_breakdown.total_assessments).toBe(3)
    })

    it('should handle subcontractor-specific workflow correctly', async () => {
      // Mock assessment responses for subcontractor
      const mockSubcontractorAssessmentResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'subcontractor-assessment-id',
              assessment_type: 'subcontractor_use',
              overall_subcontractor_score: 2,
              confidence_level: 75
            }
          }
        })
      }

      const mockSubcontractorRatingResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            calculation: {
              employer_id: mockEmployerId,
              final_score: 3,
              confidence_level: 78,
              weights: {
                union_respect: 0.25,
                safety_4_point: 0.25,
                subcontractor_use: 0.10, // Lower weight for subcontractors
                role_specific: 0.30,
              }
            }
          }
        })
      }

      ;(global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/assessments/subcontractor-use') && options?.method === 'POST') {
          return Promise.resolve(mockSubcontractorAssessmentResponse)
        }
        if (url.includes('/ratings/calculate-4-point') && options?.method === 'POST') {
          return Promise.resolve(mockSubcontractorRatingResponse)
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      // Create subcontractor use assessment
      const subcontractorResponse = await fetch('/api/assessments/subcontractor-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          subcontracting_criteria: {
            fair_subcontractor_selection: 2,
            payment_practices: 2,
            work_quality_standards: 3,
            subcontractor_relations: 2,
            contract_fairness: 2,
          },
          subcontractor_metrics: {
            active_subcontractors: 0, // This is a subcontractor, not a head contractor
            payment_terms_days: 45,
            dispute_count: 2,
            repeat_subcontractor_rate: 0,
          }
        })
      })

      expect(subcontractorResponse.ok).toBe(true)

      // Calculate rating with subcontractor-specific weights
      const ratingResponse = await fetch('/api/ratings/calculate-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          trigger_type: 'manual_recalculation'
        })
      })

      expect(ratingResponse.ok).toBe(true)
      const result = await ratingResponse.json()

      // Verify subcontractor-specific weight adjustments
      expect(result.data.calculation.weights.subcontractor_use).toBe(0.10) // Lower weight
      expect(result.data.calculation.weights.role_specific).toBe(0.30) // Higher weight
    })
  })

  describe('Mobile Workflow Integration', () => {
    it('should handle complete mobile assessment workflow', async () => {
      // Mock mobile endpoints
      const mockMobileCreateResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'mobile-assessment-id',
              assessment_type: 'safety_4_point',
              overall_safety_score: 3,
              safety_confidence_level: 82,
              metadata: {
                client_timestamp: '2024-01-15T10:00:00Z',
                server_timestamp: '2024-01-15T10:00:05Z',
                source: 'mobile_app',
                offline_id: null,
              }
            }
          }
        })
      }

      const mockMobileListResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessments: [
              {
                id: 'mobile-assessment-id',
                assessment_type: 'safety_4_point',
                overall_safety_score: 3,
                safety_confidence_level: 82,
                assessment_date: '2024-01-15T10:00:00Z',
                status: 'submitted'
              }
            ],
            pagination: {
              total: 1,
              has_more: false,
            },
            sync_info: {
              lightweight_mode: true,
              incremental: false,
            }
          }
        })
      }

      const mockRealtimeResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            updates: [
              {
                type: 'assessment_created',
                employer_id: mockEmployerId,
                data: {
                  assessment_id: 'mobile-assessment-id',
                  assessment_type: 'safety_4_point',
                  status: 'submitted'
                },
                timestamp: '2024-01-15T10:00:05Z'
              }
            ],
            subscription_info: {
              updates_since_last_check: 1
            }
          }
        })
      }

      ;(global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/mobile/assessments') && options?.method === 'POST') {
          return Promise.resolve(mockMobileCreateResponse)
        }
        if (url.includes('/mobile/assessments') && options?.method === 'GET') {
          return Promise.resolve(mockMobileListResponse)
        }
        if (url.includes('/realtime/ratings-updates')) {
          return Promise.resolve(mockRealtimeResponse)
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      // Step 1: Create assessment via mobile endpoint
      const mobileCreateResponse = await fetch('/api/mobile/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          assessment_type: 'safety_4_point',
          assessment_data: {
            safety_criteria: {
              safety_management_systems: 3,
              incident_reporting: 3,
              site_safety_culture: 3,
              risk_assessment_processes: 3,
              emergency_preparedness: 3,
              worker_safety_training: 3,
            },
            safety_metrics: {
              lost_time_injuries: 1,
              near_misses: 5,
              safety_breaches: 2,
              safety_improvements: 3,
              training_hours: 30,
            }
          },
          client_timestamp: '2024-01-15T10:00:00Z',
          device_info: {
            platform: 'iOS',
            user_agent: 'MobileApp/1.0'
          }
        })
      })

      expect(mobileCreateResponse.ok).toBe(true)
      const createResult = await mobileCreateResponse.json()
      expect(createResult.data.assessment.metadata.source).toBe('mobile_app')

      // Step 2: Fetch assessments via mobile endpoint
      const mobileListResponse = await fetch('/api/mobile/assessments?employer_id=' + mockEmployerId + '&lightweight=true')
      expect(mobileListResponse.ok).toBe(true)
      const listResult = await mobileListResponse.json()
      expect(listResult.data.sync_info.lightweight_mode).toBe(true)
      expect(listResult.data.assessments).toHaveLength(1)

      // Step 3: Check for real-time updates
      const realtimeResponse = await fetch(`/api/realtime/ratings-updates?employer_ids=${mockEmployerId}&type=assessment_changes`)
      expect(realtimeResponse.ok).toBe(true)
      const realtimeResult = await realtimeResponse.json()
      expect(realtimeResult.data.updates).toHaveLength(1)
      expect(realtimeResult.data.updates[0].type).toBe('assessment_created')
    })
  })

  describe('Error Recovery and Validation', () => {
    it('should handle assessment validation errors gracefully', async () => {
      const mockValidationErrorResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          success: false,
          message: 'Validation error',
          errors: [
            'criteria.union_engagement must be between 1 and 4',
            'safety_metrics.lost_time_injuries must be non-negative'
          ]
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockValidationErrorResponse)

      const response = await fetch('/api/assessments/safety-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_id: mockEmployerId,
          safety_criteria: {
            safety_management_systems: 5, // Invalid - above 4
            incident_reporting: 3,
            site_safety_culture: 0, // Invalid - below 1
            risk_assessment_processes: 3,
            emergency_preparedness: 3,
            worker_safety_training: 3,
          },
          safety_metrics: {
            lost_time_injuries: -1, // Invalid - negative
            near_misses: 5,
            safety_breaches: 0,
            safety_improvements: 3,
            training_hours: 20,
          }
        })
      })

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle partial assessment updates', async () => {
      const mockUpdateResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            assessment: {
              id: 'existing-assessment-id',
              assessment_type: 'union_respect',
              overall_score: 4, // Updated from 3 to 4
              confidence_level: 90, // Updated from 85 to 90
              updated_at: '2024-01-15T11:00:00Z',
              criteria: {
                union_engagement: 4, // Updated
                communication_respect: 3, // Unchanged
                collaboration_attitude: 3, // Unchanged
                dispute_resolution: 3, // Unchanged
                union_delegate_relations: 3, // Unchanged
              }
            }
          }
        })
      }

      ;(global.fetch as any).mockResolvedValue(mockUpdateResponse)

      const response = await fetch('/api/assessments/union-respect/existing-assessment-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: {
            union_engagement: 4, // Only updating this field
          },
          notes: 'Updated assessment based on new information'
        })
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.data.assessment.overall_score).toBe(4)
      expect(result.data.assessment.criteria.union_engagement).toBe(4)
      expect(result.data.assessment.criteria.communication_respect).toBe(3) // Unchanged
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const employerIds = Array.from({ length: 10 }, (_, i) => `bulk-test-employer-${i}`)

      const mockBulkResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            batch_id: 'bulk-test-batch-id',
            employer_count: 10,
            estimated_duration: 25,
          }
        })
      }

      const mockBulkProgressResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            batch_id: 'bulk-test-batch-id',
            status: 'completed',
            progress: {
              current: 10,
              total: 10,
              percentage: 100,
            },
            results: {
              successful_calculations: 10,
              errors: 0,
              details: {
                results: employerIds.map(id => ({
                  employer_id: id,
                  success: true,
                  final_score: 3,
                  confidence_level: 80
                })),
                errors: []
              }
            }
          }
        })
      }

      ;(global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/bulk-calculate-4-point') && options?.method === 'POST') {
          return Promise.resolve(mockBulkResponse)
        }
        if (url.includes('/bulk-calculate-4-point/') && options?.method === 'GET') {
          return Promise.resolve(mockBulkProgressResponse)
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      // Start bulk calculation
      const bulkResponse = await fetch('/api/ratings/bulk-calculate-4-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_ids: employerIds,
          trigger_type: 'bulk_operation',
          priority: 'normal'
        })
      })

      expect(bulkResponse.ok).toBe(true)
      const bulkResult = await bulkResponse.json()
      expect(bulkResult.data.employer_count).toBe(10)

      // Check progress
      const progressResponse = await fetch('/api/ratings/bulk-calculate-4-point/bulk-test-batch-id')
      expect(progressResponse.ok).toBe(true)
      const progressResult = await progressResponse.json()
      expect(progressResult.data.progress.percentage).toBe(100)
      expect(progressResult.data.results.successful_calculations).toBe(10)
    })
  })
})