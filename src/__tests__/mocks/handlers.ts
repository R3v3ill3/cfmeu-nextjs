import { rest } from 'msw'

// Base API URL
const API_URL = 'http://localhost:3000/api'

// Mock data factories
const createMockEmployer = (id: string, overrides = {}) => ({
  id,
  name: `Test Employer ${id}`,
  abn: '12345678901',
  role: 'trade_contractor',
  cbus_status: 'compliant',
  incocolink_status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createMockAssessment = (id: string, type: string, employerId: string, overrides = {}) => ({
  id,
  employer_id: employerId,
  assessment_type: type,
  overall_score: 3,
  confidence_level: 80,
  assessment_date: new Date().toISOString(),
  assessor_id: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createMockRating = (employerId: string, overrides = {}) => ({
  employer_id: employerId,
  final_score: 3,
  confidence_level: 85,
  union_respect_score: 3,
  safety_score: 3,
  subcontractor_score: 3,
  role_specific_score: 3,
  last_updated: new Date().toISOString(),
  weights: {
    union_respect: 0.25,
    safety_4_point: 0.30,
    subcontractor_use: 0.20,
    role_specific: 0.25,
  },
  ...overrides,
})

// API Handlers
export const handlers = [
  // Assessment Endpoints
  rest.post(`${API_URL}/assessments/union-respect`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-union-assessment', 'union_respect', 'test-employer-id', {
          overall_score: 3,
          confidence_level: 85,
          criteria: {
            union_engagement: 3,
            communication_respect: 3,
            collaboration_attitude: 3,
            dispute_resolution: 3,
            union_delegate_relations: 3,
          },
        }),
      })
    )
  }),

  rest.post(`${API_URL}/assessments/safety-4-point`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-safety-assessment', 'safety_4_point', 'test-employer-id', {
          overall_safety_score: 4,
          safety_confidence_level: 92,
          safety_criteria: {
            safety_management_systems: 4,
            incident_reporting: 4,
            site_safety_culture: 4,
            risk_assessment_processes: 4,
            emergency_preparedness: 4,
            worker_safety_training: 4,
          },
        }),
      })
    )
  }),

  rest.post(`${API_URL}/assessments/subcontractor-use`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-subcontractor-assessment', 'subcontractor_use', 'test-employer-id', {
          overall_subcontractor_score: 3,
          confidence_level: 78,
          subcontracting_criteria: {
            fair_subcontractor_selection: 3,
            payment_practices: 3,
            work_quality_standards: 3,
            subcontractor_relations: 3,
            contract_fairness: 3,
          },
        }),
      })
    )
  }),

  rest.post(`${API_URL}/assessments/role-specific`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-role-assessment', 'role_specific', 'test-employer-id', {
          employer_role: 'trade_contractor',
          overall_role_score: 4,
          role_confidence_level: 88,
          role_criteria: {
            industry_reputation: 4,
            work_quality: 4,
            reliability: 4,
            financial_stability: 3,
            expertise_level: 4,
          },
        }),
      })
    )
  }),

  // GET assessments by type and employer
  rest.get(`${API_URL}/assessments/:type/:employerId`, (req, res, ctx) => {
    const { type, employerId } = req.params

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: [
          createMockAssessment('test-assessment-1', type as string, employerId as string, {
            overall_score: 3,
            assessment_date: '2024-01-15T10:00:00Z',
          }),
          createMockAssessment('test-assessment-2', type as string, employerId as string, {
            overall_score: 4,
            assessment_date: '2024-01-10T14:30:00Z',
          }),
        ],
      })
    )
  }),

  // PUT assessment update
  rest.put(`${API_URL}/assessments/:type/:id`, (req, res, ctx) => {
    const { type, id } = req.params

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: createMockAssessment(id as string, type as string, 'test-employer-id', {
          overall_score: 4,
          updated_at: new Date().toISOString(),
        }),
      })
    )
  }),

  // Rating Calculation Endpoints
  rest.post(`${API_URL}/ratings/calculate-4-point`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          calculation: createMockRating('test-employer-id', {
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
            },
          }),
        },
      })
    )
  }),

  rest.get(`${API_URL}/ratings/:employerId/4-point-summary`, (req, res, ctx) => {
    const { employerId } = req.params

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: createMockRating(employerId as string, {
          final_score: 3,
          confidence_level: 85,
          breakdown: {
            union_respect: { score: 3, confidence: 85, last_assessed: '2024-01-15T10:00:00Z' },
            safety_4_point: { score: 4, confidence: 92, last_assessed: '2024-01-14T15:30:00Z' },
            subcontractor_use: { score: 3, confidence: 78, last_assessed: '2024-01-13T09:15:00Z' },
            role_specific: { score: 3, confidence: 88, last_assessed: '2024-01-12T11:45:00Z' },
          },
        }),
      })
    )
  }),

  rest.post(`${API_URL}/ratings/bulk-calculate-4-point`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: 'Bulk rating calculation started',
        data: {
          batch_id: 'test-batch-id',
          employer_count: 5,
          estimated_duration: 10,
        },
      })
    )
  }),

  rest.get(`${API_URL}/ratings/bulk-calculate-4-point/:batchId`, (req, res, ctx) => {
    const { batchId } = req.params

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
          },
          results: {
            successful_calculations: 5,
            errors: 0,
          },
        },
      })
    )
  }),

  // Mobile API Endpoints
  rest.get(`${API_URL}/mobile/assessments`, (req, res, ctx) => {
    const url = new URL(req.url)
    const lightweight = url.searchParams.get('lightweight') === 'true'
    const lastSync = url.searchParams.get('last_sync')

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          assessments: lightweight ? [
            {
              id: 'test-assessment-1',
              assessment_type: 'union_respect',
              overall_score: 3,
              confidence_level: 85,
              assessment_date: '2024-01-15T10:00:00Z',
            }
          ] : [
            createMockAssessment('test-assessment-1', 'union_respect', 'test-employer-id'),
            createMockAssessment('test-assessment-2', 'safety_4_point', 'test-employer-id'),
          ],
          pagination: {
            total: lightweight ? 1 : 2,
            offset: 0,
            limit: 10,
            has_more: false,
          },
          sync_info: {
            last_sync: lastSync,
            current_sync: '2024-01-15T10:30:00Z',
            incremental: !!lastSync,
            lightweight_mode: lightweight,
          },
        },
      })
    )
  }),

  rest.post(`${API_URL}/mobile/assessments`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: 'mobile-assessment-id',
          sync_status: 'synced',
          created_at: new Date().toISOString(),
        },
      })
    )
  }),

  // Real-time Updates
  rest.get(`${API_URL}/realtime/ratings-updates`, (req, res, ctx) => {
    const url = new URL(req.url)
    const employerIds = url.searchParams.get('employer_ids')?.split(',') || ['test-employer-id']

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          updates: employerIds.map((employerId, index) => ({
            type: 'rating_updated',
            employer_id: employerId,
            employer_name: `Test Employer ${index + 1}`,
            data: {
              new_rating: 4,
              confidence_level: 90,
            },
            timestamp: '2024-01-15T10:00:00Z',
          })),
          subscription_info: {
            employer_ids: employerIds,
            updates_since_last_check: employerIds.length,
          },
        },
      })
    )
  }),

  // Employer Endpoints
  rest.get(`${API_URL}/employers/:employerId`, (req, res, ctx) => {
    const { employerId } = req.params

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: createMockEmployer(employerId as string),
      })
    )
  }),

  rest.get(`${API_URL}/employers/:employerId/role-determination`, (req, res, ctx) => {
    const { employerId } = req.params

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          employer_id: employerId,
          inferred_role: 'trade_contractor',
          confidence: 85,
          indicators: {
            employee_count: 25,
            project_types: ['construction', 'maintenance'],
            abn_pattern: 'individual',
          },
        },
      })
    )
  }),

  // Health Check
  rest.get(`${API_URL}/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          services: {
            database: 'healthy',
            redis: 'healthy',
            auth: 'healthy',
          },
        },
      })
    )
  }),

  // Error Handlers
  rest.post(`${API_URL}/assessments/union-respect`, (req, res, ctx) => {
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          message: 'Unauthorized',
        })
      )
    }

    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-assessment', 'union_respect', 'test-employer-id'),
      })
    )
  }),

  // Validation Error Handler
  rest.post(`${API_URL}/assessments/safety-4-point`, (req, res, ctx) => {
    // Simulate validation error for invalid data
    if (!req.body || JSON.stringify(req.body).includes('invalid')) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          message: 'Validation error',
          errors: ['Invalid assessment data provided'],
        })
      )
    }

    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: createMockAssessment('test-assessment', 'safety_4_point', 'test-employer-id'),
      })
    )
  }),

  // Not Found Handler
  rest.get(`${API_URL}/employers/:employerId`, (req, res, ctx) => {
    const { employerId } = req.params

    if (employerId === 'non-existent') {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          message: 'Employer not found',
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: createMockEmployer(employerId as string),
      })
    )
  }),
]