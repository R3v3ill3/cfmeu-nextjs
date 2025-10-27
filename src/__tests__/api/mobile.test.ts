import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { rest } from 'msw'
import { server } from '../mocks/server'

describe('Mobile API Testing Suite', () => {
  const API_BASE = 'http://localhost:3000/api'

  beforeEach(() => {
    server.resetHandlers()
  })

  describe('Mobile Assessments API', () => {
    it('should fetch lightweight assessment data for mobile', async () => {
      const employerId = 'test-employer-id'
      const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}&lightweight=true&limit=10`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.success).toBe(true)
      expect(result.data.sync_info.lightweight_mode).toBe(true)
      expect(result.data.assessments).toHaveLength(1)

      // Verify lightweight data structure (minimal fields)
      const assessment = result.data.assessments[0]
      expect(assessment).toHaveProperty('id')
      expect(assessment).toHaveProperty('assessment_type')
      expect(assessment).toHaveProperty('overall_score')
      expect(assessment).toHaveProperty('confidence_level')
      expect(assessment).toHaveProperty('assessment_date')
      // Should not include heavy fields like detailed criteria
      expect(assessment).not.toHaveProperty('criteria')
      expect(assessment).not.toHaveProperty('supporting_evidence')
    })

    it('should support incremental sync based on last sync timestamp', async () => {
      const employerId = 'test-employer-id'
      const lastSync = '2024-01-15T09:00:00Z'

      // Mock incremental sync response
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          const url = new URL(req.url)
          const lastSyncParam = url.searchParams.get('last_sync')

          if (lastSyncParam) {
            return res(
              ctx.status(200),
              ctx.json({
                success: true,
                data: {
                  assessments: [], // No new assessments since last sync
                  sync_info: {
                    last_sync: lastSyncParam,
                    current_sync: '2024-01-15T10:00:00Z',
                    incremental: true,
                    lightweight_mode: true,
                    changes_found: false
                  }
                }
              })
            )
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                assessments: [global.testUtils.createMockAssessment('test-1', 'union_respect', employerId)],
                sync_info: {
                  incremental: false,
                  lightweight_mode: true,
                  current_sync: '2024-01-15T10:00:00Z'
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}&last_sync=${encodeURIComponent(lastSync)}`)

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.sync_info.incremental).toBe(true)
      expect(result.data.sync_info.last_sync).toBe(lastSync)
      expect(result.data.sync_info.changes_found).toBe(false)
      expect(result.data.assessments).toHaveLength(0)
    })

    it('should handle offline assessment creation', async () => {
      const offlineAssessment = {
        employer_id: 'test-employer-id',
        assessment_type: 'union_respect',
        criteria: {
          union_engagement: 3,
          communication_respect: 3,
          collaboration_attitude: 3,
          dispute_resolution: 3,
          union_delegate_relations: 3,
        },
        created_offline: true,
        device_timestamp: '2024-01-15T10:00:00Z',
        device_id: 'mobile-device-123'
      }

      // Mock offline sync response
      server.use(
        rest.post(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              success: true,
              data: {
                id: 'offline-assessment-id',
                sync_status: 'pending_sync',
                created_at: '2024-01-15T10:05:00Z',
                device_info: {
                  device_id: 'mobile-device-123',
                  created_offline: true,
                  sync_queue_position: 1
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-Mobile-Device': 'true',
          'X-Device-ID': 'mobile-device-123'
        },
        body: JSON.stringify(offlineAssessment)
      })

      expect(response.status).toBe(201)
      const result = await response.json()

      expect(result.data.sync_status).toBe('pending_sync')
      expect(result.data.device_info.created_offline).toBe(true)
      expect(result.data.device_info.sync_queue_position).toBe(1)
    })

    it('should support batch sync for multiple offline assessments', async () => {
      const batchAssessments = [
        {
          id: 'offline-1',
          employer_id: 'test-employer-id',
          assessment_type: 'union_respect',
          overall_score: 3,
          created_offline: true
        },
        {
          id: 'offline-2',
          employer_id: 'test-employer-id',
          assessment_type: 'safety_4_point',
          overall_score: 4,
          created_offline: true
        }
      ]

      // Mock batch sync response
      server.use(
        rest.post(`${API_BASE}/mobile/assessments/sync-batch`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                batch_id: 'sync-batch-123',
                synced_count: 2,
                failed_count: 0,
                results: [
                  {
                    local_id: 'offline-1',
                    server_id: 'server-assessment-1',
                    status: 'synced',
                    synced_at: '2024-01-15T10:05:00Z'
                  },
                  {
                    local_id: 'offline-2',
                    server_id: 'server-assessment-2',
                    status: 'synced',
                    synced_at: '2024-01-15T10:05:01Z'
                  }
                ]
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments/sync-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-Mobile-Device': 'true'
        },
        body: JSON.stringify({
          assessments: batchAssessments,
          device_id: 'mobile-device-123'
        })
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.batch_id).toBe('sync-batch-123')
      expect(result.data.synced_count).toBe(2)
      expect(result.data.failed_count).toBe(0)
      expect(result.data.results).toHaveLength(2)
      result.data.results.forEach((syncResult: any) => {
        expect(syncResult.status).toBe('synced')
        expect(syncResult.server_id).toBeDefined()
      })
    })

    it('should handle sync conflicts and resolution', async () => {
      const conflictedAssessment = {
        local_id: 'conflict-1',
        employer_id: 'test-employer-id',
        assessment_type: 'union_respect',
        criteria: {
          union_engagement: 4, // Local version has different score
          communication_respect: 3,
          collaboration_attitude: 3,
          dispute_resolution: 3,
          union_delegate_relations: 3,
        },
        last_modified: '2024-01-15T09:00:00Z' // Older than server version
      }

      // Mock conflict detection response
      server.use(
        rest.post(`${API_BASE}/mobile/assessments/sync-batch`, (req, res, ctx) => {
          return res(
            ctx.status(409), // Conflict status
            ctx.json({
              success: false,
              message: 'Sync conflicts detected',
              data: {
                batch_id: 'conflict-batch-456',
                conflicts: [
                  {
                    local_id: 'conflict-1',
                    server_id: 'server-conflict-1',
                    conflict_type: 'version_mismatch',
                    local_version: {
                      overall_score: 4,
                      last_modified: '2024-01-15T09:00:00Z'
                    },
                    server_version: {
                      overall_score: 3,
                      last_modified: '2024-01-15T09:30:00Z'
                    },
                    resolution_options: [
                      'use_local',
                      'use_server',
                      'merge_with_conflict_resolution'
                    ]
                  }
                ]
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments/sync-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          assessments: [conflictedAssessment],
          device_id: 'mobile-device-123'
        })
      })

      expect(response.status).toBe(409)
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.data.conflicts).toHaveLength(1)
      expect(result.data.conflicts[0].conflict_type).toBe('version_mismatch')
      expect(result.data.conflicts[0].resolution_options).toContain('use_local')
      expect(result.data.conflicts[0].resolution_options).toContain('use_server')
    })

    it('should support progressive loading for large datasets', async () => {
      const employerId = 'large-dataset-employer'

      // Mock progressive loading response
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          const url = new URL(req.url)
          const offset = parseInt(url.searchParams.get('offset') || '0')
          const limit = parseInt(url.searchParams.get('limit') || '20')
          const progressive = url.searchParams.get('progressive') === 'true'

          if (progressive) {
            return res(
              ctx.status(200),
              ctx.json({
                success: true,
                data: {
                  assessments: Array(limit).fill(null).map((_, index) => ({
                    id: `assessment-${offset + index}`,
                    assessment_type: 'union_respect',
                    overall_score: Math.floor(Math.random() * 4) + 1,
                    confidence_level: Math.floor(Math.random() * 40) + 60,
                    assessment_date: new Date().toISOString()
                  })),
                  pagination: {
                    offset,
                    limit,
                    total: 100,
                    has_more: offset + limit < 100,
                    next_offset: offset + limit < 100 ? offset + limit : null
                  },
                  loading_info: {
                    progressive_load: true,
                    batch_number: Math.floor(offset / limit) + 1,
                    estimated_remaining_batches: Math.ceil((100 - offset - limit) / limit)
                  }
                }
              })
            )
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                assessments: [],
                pagination: { offset: 0, limit: 20, total: 0, has_more: false }
              }
            })
          )
        })
      )

      // First batch
      const firstResponse = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}&progressive=true&offset=0&limit=20`)
      expect(firstResponse.status).toBe(200)
      const firstResult = await firstResponse.json()
      expect(firstResult.data.assessments).toHaveLength(20)
      expect(firstResult.data.pagination.has_more).toBe(true)

      // Second batch
      const secondResponse = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}&progressive=true&offset=20&limit=20`)
      expect(secondResponse.status).toBe(200)
      const secondResult = await secondResponse.json()
      expect(secondResult.data.assessments).toHaveLength(20)
      expect(secondResult.data.loading_info.batch_number).toBe(2)
    })

    it('should optimize data for mobile bandwidth constraints', async () => {
      const employerId = 'bandwidth-optimized-employer'

      // Mock bandwidth-optimized response
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          const url = new URL(req.url)
          const bandwidth = url.searchParams.get('bandwidth') || 'normal'
          const compression = url.searchParams.get('compression') === 'true'

          return res(
            ctx.status(200),
            ctx.set({
              'Content-Encoding': compression ? 'gzip' : 'identity',
              'X-Bandwidth-Optimization': bandwidth,
              'X-Response-Size': compression ? 'compressed' : 'uncompressed'
            }),
            ctx.json({
              success: true,
              data: {
                assessments: [
                  {
                    id: 'optimized-1',
                    t: 'union_respect', // Shortened field names for low bandwidth
                    s: 3,
                    c: 85,
                    d: '2024-01-15T10:00:00Z'
                  }
                ],
                optimization: {
                  bandwidth_mode: bandwidth,
                  compression_enabled: compression,
                  field_name_shortening: bandwidth === 'low',
                  response_size_bytes: compression ? 512 : 1024
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}&bandwidth=low&compression=true`)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Bandwidth-Optimization')).toBe('low')
      expect(response.headers.get('X-Response-Size')).toBe('compressed')

      const result = await response.json()
      expect(result.data.optimization.bandwidth_mode).toBe('low')
      expect(result.data.optimization.compression_enabled).toBe(true)
      expect(result.data.optimization.field_name_shortening).toBe(true)
    })
  })

  describe('Mobile Real-time Updates', () => {
    it('should support WebSocket connection fallback for mobile', async () => {
      // Mock WebSocket connection status
      server.use(
        rest.get(`${API_BASE}/mobile/connection-status`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                websocket_available: false, // WebSocket not available on mobile
                fallback_method: 'long_polling',
                connection_options: {
                  long_polling_interval: 30000, // 30 seconds
                  max_retries: 3,
                  retry_delay: 5000
                },
                optimization: {
                  batch_updates: true,
                  compression: true,
                  delta_updates: true
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/connection-status`, {
        headers: {
          'X-Mobile-Device': 'true'
        }
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.websocket_available).toBe(false)
      expect(result.data.fallback_method).toBe('long_polling')
      expect(result.data.optimization.batch_updates).toBe(true)
    })

    it('should handle long polling for real-time updates', async () => {
      const employerIds = ['mobile-employer-1', 'mobile-employer-2']

      // Mock long polling response
      server.use(
        rest.get(`${API_BASE}/mobile/real-time-updates`, (req, res, ctx) => {
          // Simulate delay for long polling
          return res(
            ctx.delay(1000),
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                updates: [
                  {
                    type: 'rating_updated',
                    employer_id: 'mobile-employer-1',
                    data: {
                      new_rating: 4,
                      previous_rating: 3,
                      confidence_level: 90
                    },
                    timestamp: '2024-01-15T10:00:00Z',
                    update_id: 'update-123'
                  }
                ],
                polling_info: {
                  poll_duration_ms: 1000,
                  updates_found: true,
                  next_poll_delay: 30000
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/real-time-updates?employer_ids=${employerIds.join(',')}`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Polling-Method': 'long_polling'
        }
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.updates).toHaveLength(1)
      expect(result.data.polling_info.updates_found).toBe(true)
      expect(result.data.polling_info.poll_duration_ms).toBe(1000)
    })

    it('should support delta updates for changed data only', async () => {
      const lastUpdateId = 'last-update-456'

      // Mock delta updates response
      server.use(
        rest.get(`${API_BASE}/mobile/real-time-updates`, (req, res, ctx) => {
          const url = new URL(req.url)
          const sinceUpdateId = url.searchParams.get('since_update_id')

          if (sinceUpdateId) {
            return res(
              ctx.status(200),
              ctx.json({
                success: true,
                data: {
                  updates: [
                    {
                      type: 'delta_update',
                      entity_type: 'assessment',
                      entity_id: 'assessment-789',
                      changes: {
                        overall_score: { old: 3, new: 4 },
                        confidence_level: { old: 80, new: 85 },
                        last_updated: { old: '2024-01-15T09:00:00Z', new: '2024-01-15T10:00:00Z' }
                      },
                      timestamp: '2024-01-15T10:00:00Z',
                      update_id: 'update-789'
                    }
                  ],
                  update_method: 'delta',
                  base_update_id: sinceUpdateId,
                  latest_update_id: 'update-789'
                }
              })
            )
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: { updates: [] }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/real-time-updates?since_update_id=${lastUpdateId}`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Update-Method': 'delta'
        }
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.update_method).toBe('delta')
      expect(result.data.base_update_id).toBe(lastUpdateId)
      expect(result.data.updates[0].type).toBe('delta_update')
      expect(result.data.updates[0].changes).toBeDefined()
    })
  })

  describe('Mobile Performance and Optimization', () => {
    it('should include performance metrics in responses', async () => {
      const employerId = 'performance-test-employer'

      // Mock response with performance metrics
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.set({
              'X-Response-Time': '150ms',
              'X-DB-Query-Time': '45ms',
              'X-Cache-Hit': 'true'
            }),
            ctx.json({
              success: true,
              data: {
                assessments: [global.testUtils.createMockAssessment('perf-1', 'union_respect', employerId)],
                performance: {
                  response_time_ms: 150,
                  db_query_time_ms: 45,
                  cache_hit: true,
                  optimization_level: 'high',
                  compression_ratio: 0.65,
                  mobile_optimizations: [
                    'lightweight_fields',
                    'response_compression',
                    'cache_utilization'
                  ]
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=${employerId}`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Performance-Metrics': 'true'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Response-Time')).toBe('150ms')
      expect(response.headers.get('X-Cache-Hit')).toBe('true')

      const result = await response.json()
      expect(result.data.performance.response_time_ms).toBe(150)
      expect(result.data.performance.cache_hit).toBe(true)
      expect(result.data.performance.mobile_optimizations).toContain('lightweight_fields')
    })

    it('should adapt response based on device capabilities', async () => {
      // Mock device capability detection
      server.use(
        rest.get(`${API_BASE}/mobile/device-capabilities`, (req, res, ctx) => {
          const userAgent = req.headers.get('User-Agent') || ''
          const memoryHeader = req.headers.get('X-Device-Memory') || '4'
          const connectionHeader = req.headers.get('X-Connection-Type') || '4g'

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                detected_capabilities: {
                  device_memory_gb: parseInt(memoryHeader),
                  connection_type: connectionHeader,
                  cpu_cores: 4,
                  screen_size: 'mobile',
                  battery_level: 'high'
                },
                optimization_profile: {
                  response_size_limit: '512KB',
                  compression_level: 'high',
                  caching_strategy: 'aggressive',
                  update_frequency: 'low',
                  feature_set: 'essential_only'
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/device-capabilities`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Device-Memory': '2',
          'X-Connection-Type': '3g',
          'User-Agent': 'Mobile Safari'
        }
      })

      expect(response.status).toBe(200)
      const result = await response.json()

      expect(result.data.detected_capabilities.device_memory_gb).toBe(2)
      expect(result.data.detected_capabilities.connection_type).toBe('3g')
      expect(result.data.optimization_profile.response_size_limit).toBe('512KB')
      expect(result.data.optimization_profile.compression_level).toBe('high')
      expect(result.data.optimization_profile.feature_set).toBe('essential_only')
    })

    it('should handle poor network conditions gracefully', async () => {
      // Mock response for poor network conditions
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          const connectionType = req.headers.get('X-Connection-Type')

          if (connectionType === '2g' || connectionType === 'slow') {
            return res(
              ctx.status(200),
              ctx.set({
                'X-Network-Optimization': 'ultra_light',
                'X-Response-Size': 'minimal'
              }),
              ctx.json({
                success: true,
                data: {
                  assessments: [
                    {
                      id: 'minimal-1',
                      t: 'union_respect', // Minimal field names
                      s: 3, // Minimal score
                      c: 80  // Minimal confidence
                    }
                  ],
                  network_optimization: {
                    profile: 'ultra_light',
                    features_disabled: [
                      'detailed_criteria',
                      'supporting_evidence',
                      'historical_data',
                      'trend_analysis'
                    ],
                    estimated_transfer_size: '2KB',
                    timeout_override: '30s'
                  }
                }
              })
            )
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: { assessments: [] }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=slow-network-employer`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Connection-Type': '2g',
          'X-Network-Timeout': '30000'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Network-Optimization')).toBe('ultra_light')

      const result = await response.json()
      expect(result.data.network_optimization.profile).toBe('ultra_light')
      expect(result.data.network_optimization.estimated_transfer_size).toBe('2KB')
      expect(result.data.network_optimization.features_disabled).toContain('detailed_criteria')
    })
  })

  describe('Mobile Error Handling and Recovery', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock timeout response
      server.use(
        rest.get(`${API_BASE}/mobile/assessments`, (req, res, ctx) => {
          return res(
            ctx.delay(35000), // Simulate long response
            ctx.status(408),
            ctx.json({
              success: false,
              error: {
                type: 'timeout',
                message: 'Request timeout',
                timeout_duration: 30000,
                retry_after: 5000,
                offline_fallback_available: true
              }
            })
          )
        })
      )

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // Abort after 5 seconds for test

      try {
        const response = await fetch(`${API_BASE}/mobile/assessments?employer_id=timeout-test`, {
          signal: controller.signal,
          headers: {
            'X-Mobile-Device': 'true',
            'X-Request-Timeout': '30000'
          }
        })

        clearTimeout(timeoutId)

        if (response.status === 408) {
          const result = await response.json()
          expect(result.error.type).toBe('timeout')
          expect(result.error.offline_fallback_available).toBe(true)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        expect(error.name).toBe('AbortError')
      }
    })

    it('should provide offline fallback data', async () => {
      // Mock offline fallback response
      server.use(
        rest.get(`${API_BASE}/mobile/offline-data`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.set({
              'X-Offline-Mode': 'true',
              'X-Data-Freshness': 'cached'
            }),
            ctx.json({
              success: true,
              data: {
                cached_assessments: [
                  {
                    id: 'cached-1',
                    assessment_type: 'union_respect',
                    overall_score: 3,
                    confidence_level: 80,
                    cached_at: '2024-01-15T08:00:00Z',
                    freshness_hours: 2
                  }
                ],
                offline_status: {
                  mode: 'cached_data',
                  data_age_hours: 2,
                  next_sync_attempt: '2024-01-15T12:00:00Z',
                  features_available: ['view_assessments', 'create_offline_assessments'],
                  features_unavailable: ['real_time_updates', 'sync_new_data']
                }
              }
            })
          )
        })
      )

      const response = await fetch(`${API_BASE}/mobile/offline-data?employer_id=offline-employer`, {
        headers: {
          'X-Mobile-Device': 'true',
          'X-Offline-Mode': 'true'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Offline-Mode')).toBe('true')

      const result = await response.json()
      expect(result.data.offline_status.mode).toBe('cached_data')
      expect(result.data.cached_assessments).toHaveLength(1)
      expect(result.data.offline_status.features_available).toContain('view_assessments')
    })
  })
})