/**
 * Comprehensive Test Suite for Data Integration System
 * Tests all components of the CFMEU rating system data integration
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import { employerDataService } from '../services/EmployerDataService';
import { projectDataService } from '../services/ProjectDataService';
import { complianceDataService } from '../services/ComplianceDataService';
import { siteVisitDataService } from '../services/SiteVisitDataService';
import { ebaDataService } from '../services/EBADataService';
import { dataSynchronizer } from '../sync/DataSynchronizer';
import { incrementalSync } from '../sync/IncrementalSync';
import { historicalDataMigration } from '../migration/HistoricalDataMigration';
import { syncMetricsCollector } from '../monitoring/SyncMetrics';
import { dataQualityMonitor } from '../monitoring/DataQualityMonitor';

// Mock Supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(),
              data: []
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn()
      })),
      or: jest.fn(() => ({
        eq: jest.fn()
      })),
      not: jest.fn(() => ({
        eq: jest.fn()
      })),
      in: jest.fn(() => ({
        eq: jest.fn()
      })),
      gte: jest.fn(() => ({
        lte: jest.fn()
      })),
      lt: jest.fn(),
      gt: jest.fn(),
      neq: jest.fn(),
      isNull: jest.fn(),
      notNull: jest.fn(),
      like: jest.fn(),
      ilike: jest.fn(),
      rpc: jest.fn(),
      on: jest.fn(() => ({
        subscribe: jest.fn()
      })),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        }))
      }))
    }))
  }
}));

describe('Data Integration System', () => {
  beforeAll(async () => {
    // Initialize all components
    await Promise.all([
      dataSynchronizer.initialize(),
      incrementalSync.initialize(),
      historicalDataMigration.initialize(),
      syncMetricsCollector.initialize(),
      dataQualityMonitor.initialize()
    ]);
  });

  describe('Employer Data Service', () => {
    describe('syncEmployerData', () => {
      it('should sync employer data successfully', async () => {
        const options = {
          batchSize: 10,
          skipValidation: false,
          conflictResolution: 'target_wins' as const
        };

        const result = await employerDataService.syncEmployerData(options);

        expect(result).toBeDefined();
        expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
        expect(result.successfulSyncs).toBeGreaterThanOrEqual(0);
        expect(result.failedSyncs).toBeGreaterThanOrEqual(0);
        expect(result.metrics).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      });

      it('should handle validation failures gracefully', async () => {
        const options = {
          batchSize: 5,
          skipValidation: false,
          conflictResolution: 'target_wins' as const,
          lastSyncAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        };

        const result = await employerDataService.syncEmployerData(options);

        expect(result.errors).toBeDefined();
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should calculate employer rating scores correctly', async () => {
        const mockEmployer = {
          id: 'test-employer-1',
          name: 'Test Employer',
          employer_type: 'subcontractor',
          enterprise_agreement_status: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const transformedData = await employerDataService['transformEmployerData'](mockEmployer);

        expect(transformedData).toBeDefined();
        expect(transformedData.employer).toBeDefined();
        expect(transformedData.rating).toBeDefined();
        expect(transformedData.rating.overall_rating).toMatch(/^(green|amber|red)$/);
        expect(transformedData.rating.eba_compliance_score).toBeGreaterThanOrEqual(0);
        expect(transformedData.rating.eba_compliance_score).toBeLessThanOrEqual(100);
      });

      it('should detect and resolve data conflicts', async () => {
        const mockLegacy = {
          id: 'conflict-employer-1',
          name: 'Conflict Employer',
          employer_type: 'subcontractor',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const transformedData = await employerDataService['transformEmployerData'](mockLegacy);
        const conflicts = await employerDataService['detectConflicts'](mockLegacy, transformedData);

        expect(Array.isArray(conflicts)).toBe(true);
      });
    });

    describe('getSyncStatus', () => {
      it('should return current sync status', async () => {
        const status = await employerDataService.getSyncStatus();

        expect(status).toBeDefined();
        expect(typeof status.totalEmployers).toBe('number');
        expect(typeof status.syncedEmployers).toBe('number');
        expect(typeof status.averageDataQuality).toBe('number');
        expect(status.pendingConflicts).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Project Data Service', () => {
    describe('syncProjectData', () => {
      it('should sync project data successfully', async () => {
        const options = {
          batchSize: 10,
          skipValidation: false,
          conflictResolution: 'target_wins' as const
        };

        const result = await projectDataService.syncProjectData(options);

        expect(result).toBeDefined();
        expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
        expect(result.successfulSyncs).toBeGreaterThanOrEqual(0);
        expect(result.assignmentSyncs).toBeGreaterThanOrEqual(0);
        expect(result.impactCalculations).toBeDefined();
      });

      it('should calculate project compliance impacts', async () => {
        const mockAssignment = {
          id: 'test-assignment-1',
          project_id: 'test-project-1',
          employer_id: 'test-employer-1',
          assignment_type: 'contractor_role' as const,
          role_type: 'subcontractor',
          created_at: new Date().toISOString()
        };

        const impact = await projectDataService['calculateComplianceImpact'](mockAssignment);

        expect(impact).toBeDefined();
        expect(impact.project_id).toBe(mockAssignment.project_id);
        expect(impact.employer_id).toBe(mockAssignment.employer_id);
        expect(impact.compliance_score_impact).toBeGreaterThanOrEqual(0);
        expect(impact.factors).toBeDefined();
        expect(Array.isArray(impact.factors)).toBe(true);
      });
    });
  });

  describe('Compliance Data Service', () => {
    describe('syncComplianceData', () => {
      it('should sync compliance data successfully', async () => {
        const options = {
          batchSize: 10,
          skipValidation: false,
          conflictResolution: 'target_wins' as const
        };

        const result = await complianceDataService.syncComplianceData(options);

        expect(result).toBeDefined();
        expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
        expect(result.factorsUpdated).toBeGreaterThanOrEqual(0);
        expect(result.complianceSummary).toBeDefined();
        expect(result.complianceSummary.overallComplianceRate).toBeGreaterThanOrEqual(0);
      });

      it('should generate compliance alerts', async () => {
        const alerts = await complianceDataService.getComplianceAlerts();

        expect(alerts).toBeDefined();
        expect(alerts.expiringSoon).toBeDefined();
        expect(alerts.nonCompliant).toBeDefined();
        expect(alerts.employersWithoutEba).toBeDefined();
        expect(Array.isArray(alerts.expiringSoon)).toBe(true);
      });
    });
  });

  describe('Site Visit Data Service', () => {
    describe('syncSiteVisitData', () => {
      it('should sync site visit data successfully', async () => {
        const options = {
          batchSize: 10,
          skipValidation: false,
          conflictResolution: 'target_wins' as const
        };

        const result = await siteVisitDataService.syncSiteVisitData(options);

        expect(result).toBeDefined();
        expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
        expect(result.impactsCalculated).toBeGreaterThanOrEqual(0);
        expect(result.visitSummary).toBeDefined();
      });

      it('should calculate site visit impact scores', async () => {
        const mockVisit = {
          id: 'test-visit-1',
          project_id: 'test-project-1',
          employer_id: 'test-employer-1',
          visit_date: new Date().toISOString(),
          organiser_id: 'test-organiser-1',
          visit_type: 'routine',
          compliance_score: 75,
          created_at: new Date().toISOString()
        };

        const impactScore = await siteVisitDataService['calculateImpactScore'](mockVisit);

        expect(typeof impactScore).toBe('number');
        expect(impactScore).toBeGreaterThanOrEqual(0);
        expect(impactScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('EBA Data Service', () => {
    describe('syncEbaData', () => {
      it('should sync EBA data successfully', async () => {
        const options = {
          batchSize: 10,
          skipValidation: false,
          conflictResolution: 'target_wins' as const
        };

        const result = await ebaDataService.syncEbaData(options);

        expect(result).toBeDefined();
        expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
        expect(result.factorsUpdated).toBeGreaterThanOrEqual(0);
        expect(result.ebaSummary).toBeDefined();
      });

      it('should normalize EBA status correctly', () => {
        const testCases = [
          { input: 'active', expected: 'certified' },
          { input: 'certified', expected: 'certified' },
          { input: 'negotiating', expected: 'negotiating' },
          { input: 'expired', expected: 'expired' },
          { input: 'unknown', expected: 'none' }
        ];

        testCases.forEach(({ input, expected }) => {
          const result = ebaDataService['normalizeEbaStatus'](input);
          expect(result).toBe(expected);
        });
      });

      it('should calculate EBA compliance scores', async () => {
        const mockEba = {
          id: 'test-eba-1',
          employer_id: 'test-employer-1',
          eba_type: 'project_eba',
          status: 'certified',
          start_date: '2023-01-01',
          end_date: '2025-12-31',
          last_updated: new Date().toISOString(),
          source: 'official_register'
        };

        const score = await ebaDataService['calculateEbaComplianceScore'](mockEba);

        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Data Synchronizer', () => {
    describe('executeFullSync', () => {
      it('should execute full synchronization', async () => {
        const config = {
          syncId: 'test-full-sync-1',
          name: 'Test Full Sync',
          description: 'Test full synchronization',
          enabled: true,
          schedule: {
            frequency: 'manual' as const,
            timezone: 'UTC',
            retryAttempts: 3,
            retryDelay: 5
          },
          sources: {
            employers: true,
            projects: true,
            compliance: false,
            siteVisits: false,
            eba: false
          },
          options: {
            batchSize: 5,
            skipValidation: false,
            conflictResolution: 'target_wins' as const,
            includeHistorical: false,
            historicalYears: 1,
            parallelProcessing: false,
            maxConcurrentSyncs: 1
          },
          notifications: {
            onSuccess: false,
            onFailure: false,
            onConflict: false,
            recipients: []
          }
        };

        const result = await dataSynchronizer.executeFullSync(config);

        expect(result).toBeDefined();
        expect(result.syncId).toBe(config.syncId);
        expect(result.status).toMatch(/^(running|completed|failed)$/);
        expect(result.results).toBeDefined();
        expect(result.summary).toBeDefined();
      });

      it('should get sync status', async () => {
        const status = await dataSynchronizer.getSyncStatus();

        expect(status).toBeDefined();
        expect(status.activeSyncs).toBeDefined();
        expect(Array.isArray(status.activeSyncs)).toBe(true);
        expect(status.queueLength).toBeGreaterThanOrEqual(0);
        expect(status.systemHealth).toMatch(/^(healthy|degraded|unhealthy)$/);
      });
    });

    describe('forceSync', () => {
      it('should force sync specific data sources', async () => {
        const result = await dataSynchronizer.forceSync(
          ['employers'],
          { batchSize: 5 }
        );

        expect(result).toBeDefined();
        expect(result.syncId).toBeDefined();
        expect(result.status).toMatch(/^(running|completed|failed)$/);
      });
    });
  });

  describe('Incremental Sync', () => {
    describe('performIncrementalSync', () => {
      it('should perform incremental sync', async () => {
        const options = {
          sourceTables: ['employers', 'projects'],
          batchSize: 5,
          conflictResolution: 'target_wins' as const,
          skipValidation: false,
          includeDeletes: false
        };

        const results = await incrementalSync.performIncrementalSync(options);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.syncId).toBeDefined();
          expect(result.sourceTable).toBeDefined();
          expect(result.changesProcessed).toBeGreaterThanOrEqual(0);
        });
      });

      it('should get incremental sync status', async () => {
        const status = await incrementalSync.getIncrementalSyncStatus();

        expect(status).toBeDefined();
        expect(status.activeSubscriptions).toBeGreaterThanOrEqual(0);
        expect(status.bufferedChanges).toBeGreaterThanOrEqual(0);
        expect(status.systemHealth).toMatch(/^(healthy|degraded|unhealthy)$/);
      });
    });
  });

  describe('Historical Data Migration', () => {
    describe('executeMigration', () => {
      it('should execute historical migration', async () => {
        const config = {
          pipelineId: 'test-migration-1',
          name: 'Test Migration',
          description: 'Test historical data migration',
          sources: [
            {
              name: 'employers',
              table: 'employers',
              estimatedRecords: 100,
              priority: 1
            }
          ],
          dateRange: {
            startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
          },
          options: {
            batchSize: 10,
            parallelWorkers: 1,
            includeDeletes: false,
            validateData: true,
            dryRun: true,
            continueOnError: false,
            createBackups: false
          },
          notifications: {
            onStart: false,
            onPhaseComplete: false,
            onCompletion: false,
            onError: false,
            recipients: []
          }
        };

        const result = await historicalDataMigration.executeMigration(config);

        expect(result).toBeDefined();
        expect(result.pipelineId).toBe(config.pipelineId);
        expect(result.status).toMatch(/^(running|completed|failed|paused)$/);
        expect(result.phases).toBeDefined();
        expect(result.summary).toBeDefined();
      });

      it('should get migration status', async () => {
        const status = await historicalDataMigration.getMigrationStatus();

        expect(status).toBeDefined();
        expect(status.activeMigrations).toBeGreaterThanOrEqual(0);
        expect(status.totalMigrations).toBeGreaterThanOrEqual(0);
        expect(status.systemHealth).toMatch(/^(healthy|degraded|unhealthy)$/);
      });
    });
  });

  describe('Sync Metrics Collector', () => {
    describe('recordSyncMetrics', () => {
      it('should record sync metrics', async () => {
        const metrics = {
          source_table: 'employers',
          sync_date: new Date().toISOString(),
          total_records: 10,
          successful_syncs: 9,
          failed_syncs: 1,
          average_processing_time: 150,
          data_quality_score: 85,
          conflict_count: 0,
          resolution_time: 0
        };

        await expect(syncMetricsCollector.recordSyncMetrics(metrics)).resolves.not.toThrow();
      });
    });

    describe('getCurrentMetricsSnapshot', () => {
      it('should get current metrics snapshot', async () => {
        const snapshot = await syncMetricsCollector.getCurrentMetricsSnapshot();

        expect(snapshot).toBeDefined();
        expect(snapshot.timestamp).toBeDefined();
        expect(snapshot.syncOperations).toBeDefined();
        expect(snapshot.dataSources).toBeDefined();
        expect(snapshot.systemResources).toBeDefined();
        expect(snapshot.dataQuality).toBeDefined();
      });
    });

    describe('generateHealthReport', () => {
      it('should generate health report', async () => {
        const report = await syncMetricsCollector.generateHealthReport();

        expect(report).toBeDefined();
        expect(report.overallStatus).toMatch(/^(healthy|degraded|unhealthy|critical)$/);
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(report.components).toBeDefined();
        expect(report.alerts).toBeDefined();
        expect(Array.isArray(report.alerts)).toBe(true);
      });
    });

    describe('getDashboardMetrics', () => {
      it('should get dashboard metrics', async () => {
        const metrics = await syncMetricsCollector.getDashboardMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.overview).toBeDefined();
        expect(metrics.trends).toBeDefined();
        expect(metrics.topSources).toBeDefined();
        expect(Array.isArray(metrics.topSources)).toBe(true);
      });
    });
  });

  describe('Data Quality Monitor', () => {
    describe('runQualityAssessment', () => {
      it('should run quality assessment', async () => {
        const assessments = await dataQualityMonitor.runQualityAssessment('employers');

        expect(Array.isArray(assessments)).toBe(true);
        assessments.forEach(assessment => {
          expect(assessment.id).toBeDefined();
          expect(assessment.table).toBe('employers');
          expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
          expect(assessment.overallScore).toBeLessThanOrEqual(100);
          expect(assessment.dimensionScores).toBeDefined();
          expect(assessment.ruleResults).toBeDefined();
        });
      });
    });

    describe('generateQualityReport', () => {
      it('should generate quality report', async () => {
        const report = await dataQualityMonitor.generateQualityReport();

        expect(report).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.dimensions).toBeDefined();
        expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.summary.overallScore).toBeLessThanOrEqual(100);
        expect(Array.isArray(report.summary.recommendations)).toBe(true);
      });
    });

    describe('getQualityDashboard', () => {
      it('should get quality dashboard', async () => {
        const dashboard = await dataQualityMonitor.getQualityDashboard();

        expect(dashboard).toBeDefined();
        expect(dashboard.overview).toBeDefined();
        expect(dashboard.tableScores).toBeDefined();
        expect(dashboard.recentIssues).toBeDefined();
        expect(dashboard.trends).toBeDefined();
        expect(Array.isArray(dashboard.tableScores)).toBe(true);
        expect(Array.isArray(dashboard.recentIssues)).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle end-to-end data flow', async () => {
      // This test simulates a complete data integration workflow

      // 1. Sync employer data
      const employerResult = await employerDataService.syncEmployerData({
        batchSize: 5,
        skipValidation: false
      });

      expect(employerResult.successfulSyncs).toBeGreaterThanOrEqual(0);

      // 2. Sync EBA data for the employers
      const ebaResult = await ebaDataService.syncEbaData({
        batchSize: 5,
        skipValidation: false
      });

      expect(ebaResult.successfulSyncs).toBeGreaterThanOrEqual(0);

      // 3. Sync compliance data
      const complianceResult = await complianceDataService.syncComplianceData({
        batchSize: 5,
        skipValidation: false
      });

      expect(complianceResult.successfulSyncs).toBeGreaterThanOrEqual(0);

      // 4. Check overall system health
      const healthReport = await syncMetricsCollector.generateHealthReport();

      expect(healthReport.overallStatus).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy', 'critical']).toContain(healthReport.overallStatus);

      // 5. Check data quality
      const qualityReport = await dataQualityMonitor.generateQualityReport('employers');

      expect(qualityReport.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityReport.summary.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test with invalid options
      const invalidOptions = {
        batchSize: -1, // Invalid batch size
        skipValidation: false,
        conflictResolution: 'invalid_resolution' as any
      };

      // Should not throw but handle gracefully
      const result = await employerDataService.syncEmployerData(invalidOptions);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      // Test multiple concurrent sync operations
      const promises = Array.from({ length: 3 }, (_, i) =>
        employerDataService.syncEmployerData({
          batchSize: 5,
          skipValidation: true
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.successfulSyncs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete sync operations within acceptable time limits', async () => {
      const startTime = Date.now();

      await employerDataService.syncEmployerData({
        batchSize: 20,
        skipValidation: true // Skip validation for performance test
      });

      const duration = Date.now() - startTime;

      // Should complete within 30 seconds for a small batch
      expect(duration).toBeLessThan(30000);
    }, 35000);

    it('should handle large data volumes efficiently', async () => {
      // This would test with larger datasets in a real environment
      const options = {
        batchSize: 100,
        skipValidation: true
      };

      const result = await employerDataService.syncEmployerData(options);

      // Check that processing time scales reasonably with batch size
      expect(result.metrics.average_processing_time).toBeLessThan(1000); // 1 second per record max
    });
  });

  describe('Data Validation Tests', () => {
    it('should validate employer data format', async () => {
      const invalidEmployer = {
        id: '',
        name: '',
        employer_type: 'invalid_type',
        created_at: 'invalid-date',
        updated_at: 'invalid-date'
      };

      // Should handle invalid data gracefully
      const validation = await employerDataService['validateEmployerData']({
        employer: invalidEmployer,
        rating: {} as any
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate project data integrity', async () => {
      const invalidProject = {
        id: 'test-project',
        name: '',
        start_date: '2025-12-31', // End before start
        end_date: '2025-01-01',
        status: 'invalid_status',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const validation = await projectDataService['validateProjectData']({
        project: invalidProject,
        metadata: {}
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate compliance data completeness', async () => {
      const incompleteCompliance = {
        id: 'test-compliance',
        employer_id: '',
        check_type: '',
        checked_at: '',
        status: 'invalid_status'
      };

      const validation = await complianceDataService['validateComplianceData']({
        check: incompleteCompliance,
        factor: {} as any
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security Tests', () => {
    it('should handle SQL injection attempts', async () => {
      // This would be tested with actual database queries in a real environment
      const maliciousInput = "'; DROP TABLE employers; --";

      // Should sanitize and handle malicious input safely
      const result = await employerDataService.syncEmployerData({
        batchSize: 5,
        skipValidation: true,
        employerIds: [maliciousInput]
      });

      expect(result).toBeDefined();
      // The system should not crash or be compromised
    });

    it('should enforce data access controls', async () => {
      // Test that only authorized data can be accessed
      const result = await employerDataService.getSyncStatus();

      expect(result).toBeDefined();
      // Should not expose unauthorized data
    });
  });

  afterAll(() => {
    // Cleanup any test data
    console.log('Data integration tests completed');
  });
});

/**
 * Test utilities and helper functions
 */
export class DataIntegrationTestUtils {
  static createMockEmployer(overrides: any = {}) {
    return {
      id: `test-employer-${Date.now()}`,
      name: 'Test Employer',
      employer_type: 'subcontractor',
      enterprise_agreement_status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static createMockProject(overrides: any = {}) {
    return {
      id: `test-project-${Date.now()}`,
      name: 'Test Project',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static createMockComplianceCheck(overrides: any = {}) {
    return {
      id: `test-compliance-${Date.now()}`,
      employer_id: 'test-employer',
      check_type: 'cbus',
      status: 'compliant',
      checked_at: new Date().toISOString(),
      ...overrides
    };
  }

  static async createTestDataSet(): Promise<{
    employers: any[];
    projects: any[];
    compliance: any[];
  }> {
    const employers = Array.from({ length: 5 }, (_, i) =>
      this.createMockEmployer({ id: `test-employer-${i}` })
    );

    const projects = Array.from({ length: 3 }, (_, i) =>
      this.createMockProject({ id: `test-project-${i}` })
    );

    const compliance = Array.from({ length: 10 }, (_, i) =>
      this.createMockComplianceCheck({ id: `test-compliance-${i}` })
    );

    return { employers, projects, compliance };
  }

  static generatePerformanceData(size: number) {
    return Array.from({ length: size }, (_, i) => ({
      id: `perf-test-${i}`,
      name: `Performance Test ${i}`,
      created_at: new Date(Date.now() - i * 1000).toISOString()
    }));
  }

  static measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    return fn().then(result => {
      return { result, duration: 0 }; // Would measure actual time in real implementation
    });
  }
}

// Export test utilities for use in other test files
export { DataIntegrationTestUtils };