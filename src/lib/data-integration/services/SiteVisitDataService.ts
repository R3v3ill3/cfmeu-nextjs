/**
 * Site Visit Data Integration Service
 * Handles synchronization of site visit data and assessments
 * between legacy CFMEU systems and the traffic light rating system
 */

import { supabase } from '@/integrations/supabase/client';
import {
  LegacySiteVisit,
  SiteVisitRatingImpact,
  SyncOperation,
  DataTransformation,
  IntegrationConfig,
  DataConflict,
  SyncMetrics
} from '../types/IntegrationTypes';
import { MigrationMetrics, DataLineageRecord, AuditLog } from '../types/MigrationTypes';

export interface SiteVisitSyncOptions {
  batchSize?: number;
  skipValidation?: boolean;
  includeOldVisits?: boolean;
  lastSyncAfter?: string;
  projectIds?: string[];
  employerIds?: string[];
  organiserIds?: string[];
  updateImpactsOnly?: boolean;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
  impactDecayDays?: number;
}

export interface SiteVisitSyncResult {
  totalProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  impactsCalculated: number;
  conflicts: DataConflict[];
  metrics: SyncMetrics;
  duration: number;
  errors: Array<{
    visitId?: string;
    projectId?: string;
    employerId?: string;
    error: string;
    phase: 'extraction' | 'transformation' | 'validation' | 'loading';
  }>;
  visitSummary: {
    byProject: Record<string, {
      visitCount: number;
      averageScore: number;
      issuesFound: number;
      followUpsRequired: number;
    }>;
    byOrganiser: Record<string, {
      visitCount: number;
      averageScore: number;
      projectsVisited: number;
    }>;
    overallMetrics: {
      totalVisits: number;
      averageScore: number;
      complianceRate: number;
      followUpRate: number;
      highRiskFindings: number;
    };
  };
}

export class SiteVisitDataService {
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly DEFAULT_IMPACT_DECAY_DAYS = 180; // 6 months
  private readonly SITE_VISIT_WEIGHTS = {
    safety_compliance: 0.35,
    worker_conditions: 0.25,
    industrial_relations: 0.20,
    compliance_documentation: 0.15,
    site_management: 0.05
  };

  private readonly FINDING_CATEGORIES = {
    safety: { weight: 0.4, severityMultiplier: { low: 1, medium: 1.5, high: 2, critical: 3 } },
    compliance: { weight: 0.3, severityMultiplier: { low: 1, medium: 1.3, high: 1.6, critical: 2 } },
    worker_welfare: { weight: 0.2, severityMultiplier: { low: 1, medium: 1.2, high: 1.4, critical: 1.8 } },
    industrial_relations: { weight: 0.1, severityMultiplier: { low: 1, medium: 1.1, high: 1.2, critical: 1.5 } }
  };

  /**
   * Synchronizes site visit data from legacy system to rating system
   */
  async syncSiteVisitData(options: SiteVisitSyncOptions = {}): Promise<SiteVisitSyncResult> {
    const startTime = Date.now();
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipValidation = false,
      includeOldVisits = false,
      lastSyncAfter,
      projectIds,
      employerIds,
      organiserIds,
      updateImpactsOnly = false,
      conflictResolution = 'target_wins',
      impactDecayDays = this.DEFAULT_IMPACT_DECAY_DAYS
    } = options;

    try {
      console.log('Starting site visit data synchronization...');

      const result: SiteVisitSyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        impactsCalculated: 0,
        conflicts: [],
        metrics: {
          source_table: 'site_visits',
          sync_date: new Date().toISOString(),
          total_records: 0,
          successful_syncs: 0,
          failed_syncs: 0,
          average_processing_time: 0,
          data_quality_score: 0,
          conflict_count: 0,
          resolution_time: 0
        },
        duration: 0,
        errors: [],
        visitSummary: {
          byProject: {},
          byOrganiser: {},
          overallMetrics: {
            totalVisits: 0,
            averageScore: 0,
            complianceRate: 0,
            followUpRate: 0,
            highRiskFindings: 0
          }
        }
      };

      if (!updateImpactsOnly) {
        // Sync site visit data
        const siteVisits = await this.fetchSiteVisits({
          includeOldVisits,
          lastSyncAfter,
          projectIds,
          employerIds,
          organiserIds
        });

        console.log(`Found ${siteVisits.length} site visits to process`);
        result.metrics.total_records = siteVisits.length;

        // Process in batches
        for (let i = 0; i < siteVisits.length; i += batchSize) {
          const batch = siteVisits.slice(i, i + batchSize);
          console.log(`Processing site visit batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(siteVisits.length / batchSize)}`);

          const batchResult = await this.processSiteVisitBatch(batch, {
            skipValidation,
            conflictResolution
          });

          this.aggregateBatchResult(result, batchResult);
        }
      }

      // Calculate and update site visit impacts
      console.log('Calculating site visit rating impacts...');
      const impactResult = await this.updateSiteVisitImpacts({
        employerIds,
        projectIds,
        impactDecayDays,
        batchSize
      });

      this.aggregateImpactResult(result, impactResult);

      // Calculate visit summary
      result.visitSummary = await this.calculateVisitSummary(employerIds, projectIds);

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.metrics.average_processing_time = result.duration / Math.max(result.totalProcessed, 1);
      result.metrics.successful_syncs = result.successfulSyncs + result.impactsCalculated;
      result.metrics.failed_syncs = result.failedSyncs;
      result.metrics.conflict_count = result.conflicts.length;

      // Log the synchronization
      await this.logSiteVisitSyncOperation(result);

      console.log(`Site visit sync completed: ${result.successfulSyncs} visits, ${result.impactsCalculated} impacts calculated`);
      return result;

    } catch (error) {
      console.error('Site visit data synchronization failed:', error);
      throw new Error(`Site visit sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches site visits from the source system
   */
  private async fetchSiteVisits(options: {
    includeOldVisits?: boolean;
    lastSyncAfter?: string;
    projectIds?: string[];
    employerIds?: string[];
    organiserIds?: string[];
  }): Promise<LegacySiteVisit[]> {
    try {
      let query = supabase
        .from('site_visits')
        .select(`
          *,
          projects!inner(
            name,
            project_type,
            status,
            employers!inner(name, employer_type)
          ),
          job_sites!inner(
            address,
            suburb,
            state
          ),
          organisers!inner(
            name,
            email
          )
        `);

      // Apply filters
      if (!options.includeOldVisits) {
        const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
        query = query.gte('visit_date', cutoffDate.toISOString());
      }

      if (options.lastSyncAfter) {
        query = query.gte('updated_at', options.lastSyncAfter);
      }

      if (options.projectIds && options.projectIds.length > 0) {
        query = query.in('project_id', options.projectIds);
      }

      if (options.employerIds && options.employerIds.length > 0) {
        query = query.in('employer_id', options.employerIds);
      }

      if (options.organiserIds && options.organiserIds.length > 0) {
        query = query.in('organiser_id', options.organiserIds);
      }

      const { data, error } = await query.order('visit_date', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch site visits: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacySiteVisit);

    } catch (error) {
      console.error('Error fetching site visits:', error);
      throw error;
    }
  }

  /**
   * Processes a batch of site visits through the sync pipeline
   */
  private async processSiteVisitBatch(
    visits: LegacySiteVisit[],
    options: {
      skipValidation: boolean;
      conflictResolution: string;
    }
  ): Promise<Partial<SiteVisitSyncResult>> {
    const batchResult: Partial<SiteVisitSyncResult> = {
      totalProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: [],
      errors: []
    };

    for (const visit of visits) {
      try {
        batchResult.totalProcessed = (batchResult.totalProcessed || 0) + 1;

        // Transform site visit data
        const transformedData = await this.transformSiteVisitData(visit);

        // Validate data if not skipped
        if (!options.skipValidation) {
          const validation = await this.validateSiteVisitData(transformedData);
          if (!validation.isValid) {
            batchResult.errors?.push({
              visitId: visit.id,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              phase: 'validation'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Check for conflicts
        const conflicts = await this.detectSiteVisitConflicts(visit, transformedData);
        if (conflicts.length > 0) {
          batchResult.conflicts = [...(batchResult.conflicts || []), ...conflicts];

          const resolvedConflicts = await this.resolveSiteVisitConflicts(conflicts, options.conflictResolution);
          if (!resolvedConflicts.allResolved) {
            batchResult.errors?.push({
              visitId: visit.id,
              error: `Unresolved conflicts: ${resolvedConflicts.unresolved.join(', ')}`,
              phase: 'loading'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Load the data
        await this.loadSiteVisitData(transformedData, visit);
        batchResult.successfulSyncs = (batchResult.successfulSyncs || 0) + 1;

      } catch (error) {
        console.error(`Failed to process site visit ${visit.id}:`, error);
        batchResult.errors?.push({
          visitId: visit.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'transformation'
        });
        batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
      }
    }

    return batchResult;
  }

  /**
   * Updates site visit impacts for employers
   */
  private async updateSiteVisitImpacts(options: {
    employerIds?: string[];
    projectIds?: string[];
    impactDecayDays: number;
    batchSize: number;
  }): Promise<Partial<SiteVisitSyncResult>> {
    const result: Partial<SiteVisitSyncResult> = {
      impactsCalculated: 0,
      errors: []
    };

    try {
      // Get employers for impact calculation
      const employers = await this.getEmployersForImpactCalculation(options.employerIds, options.projectIds);
      console.log(`Calculating site visit impacts for ${employers.length} employers`);

      // Process employers in batches
      for (let i = 0; i < employers.length; i += options.batchSize) {
        const batch = employers.slice(i, i + options.batchSize);

        for (const employer of batch) {
          try {
            const impacts = await this.calculateEmployerSiteVisitImpacts(
              employer.id,
              options.impactDecayDays
            );

            for (const impact of impacts) {
              await this.saveSiteVisitImpact(impact);
              result.impactsCalculated = (result.impactsCalculated || 0) + 1;
            }

            // Trigger rating recalculation
            await supabase.rpc('trigger_employer_rating_recalculation', {
              p_employer_id: employer.id
            });

          } catch (error) {
            console.error(`Failed to calculate site visit impacts for employer ${employer.id}:`, error);
            result.errors?.push({
              employerId: employer.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              phase: 'loading'
            });
          }
        }
      }

      return result;

    } catch (error) {
      console.error('Error updating site visit impacts:', error);
      throw error;
    }
  }

  /**
   * Transforms site visit data to the rating system format
   */
  private async transformSiteVisitData(legacy: LegacySiteVisit): Promise<{
    visit: any;
    impact: SiteVisitRatingImpact;
  }> {
    try {
      // Transform site visit
      const visitData = {
        id: legacy.id,
        project_id: legacy.project_id,
        job_site_id: legacy.job_site_id || null,
        employer_id: legacy.employer_id || null,
        visit_date: legacy.visit_date,
        organiser_id: legacy.organiser_id,
        visit_type: legacy.visit_type,
        findings: legacy.findings || {},
        compliance_score: legacy.compliance_score || await this.calculateComplianceScore(legacy),
        recommendations: legacy.recommendations || [],
        follow_up_required: legacy.follow_up_required || false,
        follow_up_date: legacy.follow_up_date || null,
        created_at: legacy.created_at,
        updated_at: new Date().toISOString(),
        // Additional fields for rating system
        visit_duration: await this.calculateVisitDuration(legacy),
        risk_level: await this.calculateVisitRiskLevel(legacy),
        finding_categories: await this.categorizeFindings(legacy.findings),
        overall_assessment: await this.generateOverallAssessment(legacy),
        data_quality_score: await this.calculateVisitDataQuality(legacy)
      };

      // Create rating impact
      const impactData: SiteVisitRatingImpact = {
        employer_id: legacy.employer_id || '',
        site_visit_id: legacy.id,
        impact_score: await this.calculateImpactScore(legacy),
        impact_factors: await this.calculateImpactFactors(legacy),
        project_id: legacy.project_id,
        visit_date: legacy.visit_date,
        decay_rate: await this.calculateDecayRate(legacy)
      };

      return {
        visit: visitData,
        impact: impactData
      };

    } catch (error) {
      console.error('Error transforming site visit data:', error);
      throw new Error(`Site visit transformation failed for ${legacy.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates site visit impacts for an employer
   */
  private async calculateEmployerSiteVisitImpacts(
    employerId: string,
    decayDays: number
  ): Promise<SiteVisitRatingImpact[]> {
    try {
      // Get recent site visits for this employer
      const cutoffDate = new Date(Date.now() - decayDays * 24 * 60 * 60 * 1000);

      const { data: visits } = await supabase
        .from('site_visits')
        .select(`
          *,
          projects!inner(name, project_type),
          job_sites!inner(location, full_address)
        `)
        .eq('employer_id', employerId)
        .gte('visit_date', cutoffDate.toISOString())
        .order('visit_date', { ascending: false });

      const impacts: SiteVisitRatingImpact[] = [];

      for (const visit of visits || []) {
        const impact: SiteVisitRatingImpact = {
          employer_id: employerId,
          site_visit_id: visit.id,
          impact_score: await this.calculateImpactScore(visit),
          impact_factors: await this.calculateImpactFactors(visit),
          project_id: visit.project_id,
          visit_date: visit.visit_date,
          decay_rate: await this.calculateDecayRate(visit)
        };

        impacts.push(impact);
      }

      return impacts;

    } catch (error) {
      console.error('Error calculating employer site visit impacts:', error);
      return [];
    }
  }

  /**
   * Calculates overall impact score for a site visit
   */
  private async calculateImpactScore(visit: LegacySiteVisit): Promise<number> {
    let baseScore = visit.compliance_score || 50;

    // Adjust based on findings
    if (visit.findings) {
      const findings = Array.isArray(visit.findings) ? visit.findings : [];

      for (const finding of findings) {
        const category = this.FINDING_CATEGORIES[finding.category as keyof typeof this.FINDING_CATEGORIES];
        if (category) {
          const severity = finding.severity || 'medium';
          const multiplier = category.severityMultiplier[severity as keyof typeof category.severityMultiplier] || 1;
          const weight = category.weight;

          // Deduct points based on finding severity and category
          const deduction = weight * multiplier * 10;
          baseScore = Math.max(0, baseScore - deduction);
        }
      }
    }

    // Adjust based on follow-up requirements
    if (visit.follow_up_required) {
      baseScore = Math.max(0, baseScore - 15);
    }

    // Adjust based on visit type
    const visitTypeMultiplier = {
      'routine': 1.0,
      'follow_up': 1.2,
      'complaint': 1.5,
      'incident': 2.0,
      'audit': 0.8
    }[visit.visit_type] || 1.0;

    return Math.round(baseScore * visitTypeMultiplier);
  }

  /**
   * Calculates impact factors for a site visit
   */
  private async calculateImpactFactors(visit: LegacySiteVisit): Promise<Array<{
    factor: string;
    impact: number;
    category: 'safety' | 'compliance' | 'worker_welfare' | 'industrial_relations';
  }>> {
    const factors: Array<{
      factor: string;
      impact: number;
      category: 'safety' | 'compliance' | 'worker_welfare' | 'industrial_relations';
    }> = [];

    // Base factors from visit score
    const complianceScore = visit.compliance_score || 50;

    factors.push({
      factor: 'safety_compliance',
      impact: complianceScore * this.SITE_VISIT_WEIGHTS.safety_compliance,
      category: 'safety'
    });

    factors.push({
      factor: 'worker_conditions',
      impact: complianceScore * this.SITE_VISIT_WEIGHTS.worker_conditions,
      category: 'worker_welfare'
    });

    factors.push({
      factor: 'industrial_relations',
      impact: complianceScore * this.SITE_VISIT_WEIGHTS.industrial_relations,
      category: 'industrial_relations'
    });

    factors.push({
      factor: 'compliance_documentation',
      impact: complianceScore * this.SITE_VISIT_WEIGHTS.compliance_documentation,
      category: 'compliance'
    });

    factors.push({
      factor: 'site_management',
      impact: complianceScore * this.SITE_VISIT_WEIGHTS.site_management,
      category: 'safety'
    });

    // Adjust based on specific findings
    if (visit.findings && Array.isArray(visit.findings)) {
      for (const finding of visit.findings) {
        const category = finding.category as keyof typeof this.FINDING_CATEGORIES;
        if (category && this.FINDING_CATEGORIES[category]) {
          const severity = finding.severity || 'medium';
          const severityMultipliers = this.FINDING_CATEGORIES[category].severityMultiplier;
          const severityKey = severity as keyof typeof severityMultipliers;
          const multiplier = severityMultipliers[severityKey] || 1;

          // Apply negative impact for findings
          const impact = -10 * multiplier;

          factors.push({
            factor: `${category}_finding`,
            impact: Math.max(-30, impact), // Cap negative impact
            category: category as any
          });
        }
      }
    }

    return factors;
  }

  /**
   * Calculates visit summary statistics
   */
  private async calculateVisitSummary(
    employerIds?: string[],
    projectIds?: string[]
  ): Promise<SiteVisitSyncResult['visitSummary']> {
    try {
      let query = supabase
        .from('site_visits')
        .select(`
          id,
          project_id,
          organiser_id,
          compliance_score,
          follow_up_required,
          findings,
          projects!inner(name),
          organisers!inner(name)
        `);

      if (employerIds && employerIds.length > 0) {
        query = query.in('employer_id', employerIds);
      }

      if (projectIds && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      }

      const { data: visits } = await query;

      const summary: SiteVisitSyncResult['visitSummary'] = {
        byProject: {},
        byOrganiser: {},
        overallMetrics: {
          totalVisits: visits?.length || 0,
          averageScore: 0,
          complianceRate: 0,
          followUpRate: 0,
          highRiskFindings: 0
        }
      };

      if (!visits || visits.length === 0) {
        return summary;
      }

      // Calculate by project
      const projectGroups = this.groupBy(visits, 'project_id');
      for (const [projectId, projectVisits] of Object.entries(projectGroups)) {
        const scores = projectVisits.map(v => v.compliance_score || 0);
        const findings = projectVisits.flatMap(v => Array.isArray(v.findings) ? v.findings : []);
        const highRiskFindings = findings.filter(f => f.severity === 'high' || f.severity === 'critical');

        summary.byProject[projectId] = {
          visitCount: projectVisits.length,
          averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
          issuesFound: findings.length,
          followUpsRequired: projectVisits.filter(v => v.follow_up_required).length
        };
      }

      // Calculate by organiser
      const organiserGroups = this.groupBy(visits, 'organiser_id');
      for (const [organiserId, organiserVisits] of Object.entries(organiserGroups)) {
        const scores = organiserVisits.map(v => v.compliance_score || 0);
        const uniqueProjects = new Set(organiserVisits.map(v => v.project_id));

        summary.byOrganiser[organiserId] = {
          visitCount: organiserVisits.length,
          averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
          projectsVisited: uniqueProjects.size
        };
      }

      // Calculate overall metrics
      const allScores = visits.map(v => v.compliance_score || 0);
      const allFindings = visits.flatMap(v => Array.isArray(v.findings) ? v.findings : []);
      const highRiskFindings = allFindings.filter(f => f.severity === 'high' || f.severity === 'critical');

      summary.overallMetrics = {
        totalVisits: visits.length,
        averageScore: allScores.reduce((sum, score) => sum + score, 0) / allScores.length,
        complianceRate: (allScores.filter(s => s >= 70).length / allScores.length) * 100,
        followUpRate: (visits.filter(v => v.follow_up_required).length / visits.length) * 100,
        highRiskFindings: highRiskFindings.length
      };

      return summary;

    } catch (error) {
      console.error('Error calculating visit summary:', error);
      return {
        byProject: {},
        byOrganiser: {},
        overallMetrics: {
          totalVisits: 0,
          averageScore: 0,
          complianceRate: 0,
          followUpRate: 0,
          highRiskFindings: 0
        }
      };
    }
  }

  // ============================================================================
  // Helper Methods for Site Visit Calculations
  // ============================================================================

  private async calculateComplianceScore(visit: LegacySiteVisit): Promise<number> {
    if (visit.compliance_score) return visit.compliance_score;

    // Calculate score based on findings
    let score = 80; // Base score

    if (visit.findings && Array.isArray(visit.findings)) {
      for (const finding of visit.findings) {
        const category = this.FINDING_CATEGORIES[finding.category as keyof typeof this.FINDING_CATEGORIES];
        if (category) {
          const severity = finding.severity || 'medium';
          const multiplier = category.severityMultiplier[severity as keyof typeof category.severityMultiplier] || 1;
          const weight = category.weight;

          score -= weight * multiplier * 10;
        }
      }
    }

    // Adjust for follow-up requirements
    if (visit.follow_up_required) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async calculateVisitDuration(visit: LegacySiteVisit): Promise<number> {
    // Estimate duration based on visit type
    const durationMap: Record<string, number> = {
      'routine': 120, // 2 hours
      'follow_up': 90, // 1.5 hours
      'complaint': 150, // 2.5 hours
      'incident': 180, // 3 hours
      'audit': 240 // 4 hours
    };

    return durationMap[visit.visit_type] || 120;
  }

  private async calculateVisitRiskLevel(visit: LegacySiteVisit): Promise<'low' | 'medium' | 'high' | 'critical'> {
    const score = await this.calculateComplianceScore(visit);

    if (score >= 85) return 'low';
    if (score >= 70) return 'medium';
    if (score >= 50) return 'high';
    return 'critical';
  }

  private async categorizeFindings(findings?: any): Promise<Record<string, number>> {
    const categories: Record<string, number> = {
      safety: 0,
      compliance: 0,
      worker_welfare: 0,
      industrial_relations: 0
    };

    if (!findings || !Array.isArray(findings)) return categories;

    for (const finding of findings) {
      const category = finding.category as keyof typeof categories;
      if (category && categories[category] !== undefined) {
        categories[category]++;
      }
    }

    return categories;
  }

  private async generateOverallAssessment(visit: LegacySiteVisit): Promise<string> {
    const score = await this.calculateComplianceScore(visit);
    const riskLevel = await this.calculateVisitRiskLevel(visit);

    let assessment = `Overall compliance score: ${score}/100 (${riskLevel} risk)`;

    if (visit.follow_up_required) {
      assessment += '. Follow-up required';
    }

    if (visit.findings && Array.isArray(visit.findings) && visit.findings.length > 0) {
      const criticalFindings = visit.findings.filter(f => f.severity === 'critical').length;
      const highFindings = visit.findings.filter(f => f.severity === 'high').length;

      if (criticalFindings > 0) {
        assessment += `. ${criticalFindings} critical finding(s) identified`;
      } else if (highFindings > 0) {
        assessment += `. ${highFindings} high-priority finding(s) identified`;
      }
    }

    return assessment;
  }

  private async calculateVisitDataQuality(visit: LegacySiteVisit): Promise<number> {
    let score = 0;
    let maxScore = 0;

    const fields = [
      { field: 'project_id', weight: 20 },
      { field: 'organiser_id', weight: 15 },
      { field: 'visit_date', weight: 15 },
      { field: 'visit_type', weight: 10 },
      { field: 'compliance_score', weight: 20 },
      { field: 'findings', weight: 15 },
      { field: 'follow_up_required', weight: 5 }
    ];

    for (const { field, weight } of fields) {
      maxScore += weight;
      if (visit[field as keyof LegacySiteVisit]) {
        score += weight;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  private async calculateDecayRate(visit: LegacySiteVisit): Promise<number> {
    // Calculate decay rate based on visit age and severity
    const daysSinceVisit = this.calculateDaysSince(visit.visit_date);

    // Base decay: 1% per week
    let decayRate = 0.01 * 7;

    // Adjust based on visit type
    const visitTypeMultiplier = {
      'routine': 1.0,
      'follow_up': 0.8,
      'complaint': 0.6,
      'incident': 0.4,
      'audit': 1.2
    }[visit.visit_type] || 1.0;

    decayRate *= visitTypeMultiplier;

    // Adjust based on findings severity
    if (visit.findings && Array.isArray(visit.findings)) {
      const hasCriticalFindings = visit.findings.some(f => f.severity === 'critical');
      const hasHighFindings = visit.findings.some(f => f.severity === 'high');

      if (hasCriticalFindings) decayRate *= 0.3; // Slower decay for critical issues
      else if (hasHighFindings) decayRate *= 0.5; // Slower decay for high issues
    }

    return Math.min(0.1, decayRate); // Cap at 10% per day maximum
  }

  private calculateDaysSince(date: string): number {
    const past = new Date(date);
    const now = new Date();
    const diffTime = now.getTime() - past.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async getEmployersForImpactCalculation(
    employerIds?: string[],
    projectIds?: string[]
  ): Promise<Array<{ id: string }>> {
    try {
      let query = supabase
        .from('employers')
        .select('id');

      if (employerIds && employerIds.length > 0) {
        query = query.in('id', employerIds);
      } else if (projectIds && projectIds.length > 0) {
        // Get employers from project assignments
        const { data: assignments } = await supabase
          .from('project_assignments')
          .select('employer_id')
          .in('project_id', projectIds);

        const uniqueEmployerIds = [...new Set((assignments || []).map(a => a.employer_id))];
        if (uniqueEmployerIds.length > 0) {
          query = query.in('id', uniqueEmployerIds);
        }
      }

      const { data, error } = await query.limit(1000); // Limit for performance

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error getting employers for impact calculation:', error);
      return [];
    }
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  // ============================================================================
  // Validation and Conflict Resolution Methods
  // ============================================================================

  private async validateSiteVisitData(data: {
    visit: any;
    impact: SiteVisitRatingImpact;
  }): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate visit data
    if (!data.visit.project_id) {
      errors.push('Project ID is required');
    }

    if (!data.visit.organiser_id) {
      errors.push('Organiser ID is required');
    }

    if (!data.visit.visit_date) {
      errors.push('Visit date is required');
    }

    if (!this.isValidDate(data.visit.visit_date)) {
      errors.push('Invalid visit date format');
    }

    if (!data.visit.visit_type) {
      errors.push('Visit type is required');
    }

    const validVisitTypes = ['routine', 'follow_up', 'complaint', 'incident', 'audit'];
    if (!validVisitTypes.includes(data.visit.visit_type)) {
      errors.push('Invalid visit type');
    }

    if (data.visit.compliance_score < 0 || data.visit.compliance_score > 100) {
      errors.push('Compliance score must be between 0 and 100');
    }

    // Validate impact data
    if (data.impact.impact_score < 0 || data.impact.impact_score > 100) {
      errors.push('Impact score must be between 0 and 100');
    }

    if (data.impact.impact_factors.length === 0) {
      errors.push('At least one impact factor is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async detectSiteVisitConflicts(
    legacy: LegacySiteVisit,
    transformed: { visit: any; impact: SiteVisitRatingImpact }
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for existing site visit
      const { data: existingVisit } = await supabase
        .from('site_visits')
        .select('id, compliance_score, visit_date, findings')
        .eq('id', legacy.id)
        .single();

      if (existingVisit) {
        // Check for score differences
        if (Math.abs((existingVisit.compliance_score || 0) - (transformed.visit.compliance_score || 0)) > 10) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'site_visits',
            target_table: 'site_visits',
            record_id: legacy.id,
            field_name: 'compliance_score',
            source_value: transformed.visit.compliance_score,
            target_value: existingVisit.compliance_score,
            conflict_type: 'value_mismatch',
            severity: 'medium',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }

        // Check for findings differences
        const sourceFindings = JSON.stringify(transformed.visit.findings || {});
        const targetFindings = JSON.stringify(existingVisit.findings || {});

        if (sourceFindings !== targetFindings) {
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'site_visits',
            target_table: 'site_visits',
            record_id: legacy.id,
            field_name: 'findings',
            source_value: sourceFindings,
            target_value: targetFindings,
            conflict_type: 'value_mismatch',
            severity: 'low',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

      return conflicts;

    } catch (error) {
      console.error('Error detecting site visit conflicts:', error);
      return [];
    }
  }

  private async resolveSiteVisitConflicts(
    conflicts: DataConflict[],
    strategy: string
  ): Promise<{ allResolved: boolean; unresolved: string[] }> {
    const unresolved: string[] = [];

    for (const conflict of conflicts) {
      try {
        switch (strategy) {
          case 'source_wins':
            await this.applySourceSiteVisitResolution(conflict);
            break;
          case 'target_wins':
            await this.applyTargetSiteVisitResolution(conflict);
            break;
          case 'manual':
            unresolved.push(`Manual review needed for site visit ${conflict.field_name}`);
            break;
          default:
            unresolved.push(`Unknown resolution strategy: ${strategy}`);
        }
      } catch (error) {
        console.error(`Failed to resolve site visit conflict ${conflict.id}:`, error);
        unresolved.push(conflict.id);
      }
    }

    return {
      allResolved: unresolved.length === 0,
      unresolved
    };
  }

  private async applySourceSiteVisitResolution(conflict: DataConflict): Promise<void> {
    const { error } = await supabase
      .from(conflict.target_table)
      .update({ [conflict.field_name]: conflict.source_value })
      .eq('id', conflict.record_id);

    if (error) throw error;

    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_source',
          resolved_by: 'system',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  private async applyTargetSiteVisitResolution(conflict: DataConflict): Promise<void> {
    await supabase
      .from('data_conflicts')
      .update({
        status: 'resolved',
        resolution: {
          action: 'use_target',
          resolved_by: 'system',
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', conflict.id);
  }

  // ============================================================================
  // Data Loading Methods
  // ============================================================================

  private async loadSiteVisitData(
    transformed: { visit: any; impact: SiteVisitRatingImpact },
    legacy: LegacySiteVisit
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('upsert_site_visit_data', {
        p_visit_data: transformed.visit,
        p_impact_data: transformed.impact,
        p_legacy_id: legacy.id
      });

      if (error) throw error;

      await this.createSiteVisitDataLineage(transformed, legacy);

    } catch (error) {
      console.error('Error loading site visit data:', error);
      throw error;
    }
  }

  private async saveSiteVisitImpact(impact: SiteVisitRatingImpact): Promise<void> {
    try {
      const { error } = await supabase
        .from('site_visit_rating_impacts')
        .upsert({
          ...impact,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Error saving site visit impact:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapToLegacySiteVisit(data: any): LegacySiteVisit {
    return {
      id: data.id,
      project_id: data.project_id,
      job_site_id: data.job_site_id,
      employer_id: data.employer_id,
      visit_date: data.visit_date,
      organiser_id: data.organiser_id,
      visit_type: data.visit_type,
      findings: data.findings,
      compliance_score: data.compliance_score,
      recommendations: data.recommendations,
      follow_up_required: data.follow_up_required,
      follow_up_date: data.follow_up_date,
      created_at: data.created_at
    };
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private aggregateBatchResult(
    mainResult: SiteVisitSyncResult,
    batchResult: Partial<SiteVisitSyncResult>
  ): void {
    mainResult.totalProcessed += batchResult.totalProcessed || 0;
    mainResult.successfulSyncs += batchResult.successfulSyncs || 0;
    mainResult.failedSyncs += batchResult.failedSyncs || 0;
    mainResult.conflicts.push(...(batchResult.conflicts || []));
    mainResult.errors.push(...(batchResult.errors || []));
  }

  private aggregateImpactResult(
    mainResult: SiteVisitSyncResult,
    impactResult: Partial<SiteVisitSyncResult>
  ): void {
    mainResult.impactsCalculated += impactResult.impactsCalculated || 0;
    mainResult.errors.push(...(impactResult.errors || []));
  }

  private async createSiteVisitDataLineage(
    transformed: { visit: any; impact: SiteVisitRatingImpact },
    legacy: LegacySiteVisit
  ): Promise<void> {
    try {
      const lineageRecord: DataLineageRecord = {
        id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_record_id: legacy.id,
        source_table: 'site_visits',
        target_record_id: transformed.visit.id,
        target_table: 'site_visits',
        transformation_applied: JSON.stringify({
          visit_fields: Object.keys(transformed.visit),
          impact_calculations: {
            impact_score: transformed.impact.impact_score,
            decay_rate: transformed.impact.decay_rate,
            factor_count: transformed.impact.impact_factors.length
          }
        }),
        migration_id: `site_visit_sync_${new Date().toISOString().split('T')[0]}`,
        transformed_at: new Date().toISOString(),
        transformation_hash: this.generateDataHash(transformed.visit),
        quality_score: transformed.visit.data_quality_score,
        confidence_level: 90
      };

      await supabase
        .from('data_lineage_records')
        .insert(lineageRecord);

    } catch (error) {
      console.error('Error creating site visit data lineage record:', error);
    }
  }

  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private async logSiteVisitSyncOperation(result: SiteVisitSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        migration_id: `site_visit_sync_${new Date().toISOString().split('T')[0]}`,
        action: 'site_visit_data_synchronization',
        actor: 'system',
        object_type: 'migration',
        object_id: 'site_visit_sync_batch',
        new_values: {
          visits_processed: result.totalProcessed,
          impacts_calculated: result.impactsCalculated,
          successful_syncs: result.successfulSyncs,
          failed_syncs: result.failedSyncs,
          conflicts: result.conflicts.length,
          duration: result.duration,
          visit_summary: result.visitSummary
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging site visit sync operation:', error);
    }
  }

  /**
   * Get site visit alerts for monitoring
   */
  async getSiteVisitAlerts(): Promise<{
    overdueFollowUps: Array<{
      employerId: string;
      employerName: string;
      projectId: string;
      projectName: string;
      followUpDate: string;
      daysOverdue: number;
    }>;
    highRiskVisits: Array<{
      employerId: string;
      employerName: string;
      projectId: string;
      projectName: string;
      visitDate: string;
      riskLevel: string;
      score: number;
    }>;
    pendingIncidents: Array<{
      employerId: string;
      employerName: string;
      projectId: string;
      projectName: string;
      visitDate: string;
      incidentType: string;
    }>;
  }> {
    try {
      const now = new Date();

      // Get overdue follow-ups
      const { data: overdueFollowUps } = await supabase
        .from('site_visits')
        .select(`
          employer_id,
          project_id,
          follow_up_date,
          projects!inner(name),
          employers!inner(name)
        `)
        .lt('follow_up_date', now.toISOString())
        .eq('follow_up_required', true);

      // Get high-risk visits (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: highRiskVisits } = await supabase
        .from('site_visits')
        .select(`
          employer_id,
          project_id,
          visit_date,
          compliance_score,
          projects!inner(name),
          employers!inner(name)
        `)
        .gte('visit_date', thirtyDaysAgo.toISOString())
        .lt('compliance_score', 50);

      // Get pending incidents
      const { data: pendingIncidents } = await supabase
        .from('site_visits')
        .select(`
          employer_id,
          project_id,
          visit_date,
          visit_type,
          projects!inner(name),
          employers!inner(name)
        `)
        .eq('visit_type', 'incident')
        .gte('visit_date', thirtyDaysAgo.toISOString());

      return {
        overdueFollowUps: (overdueFollowUps || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          projectId: item.project_id,
          projectName: item.projects.name,
          followUpDate: item.follow_up_date,
          daysOverdue: this.calculateDaysSince(item.follow_up_date)
        })),
        highRiskVisits: (highRiskVisits || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          projectId: item.project_id,
          projectName: item.projects.name,
          visitDate: item.visit_date,
          riskLevel: item.compliance_score < 30 ? 'critical' : 'high',
          score: item.compliance_score
        })),
        pendingIncidents: (pendingIncidents || []).map(item => ({
          employerId: item.employer_id,
          employerName: item.employers.name,
          projectId: item.project_id,
          projectName: item.projects.name,
          visitDate: item.visit_date,
          incidentType: item.visit_type
        }))
      };

    } catch (error) {
      console.error('Error getting site visit alerts:', error);
      return {
        overdueFollowUps: [],
        highRiskVisits: [],
        pendingIncidents: []
      };
    }
  }

  /**
   * Get current site visit sync status for monitoring
   */
  async getSiteVisitSyncStatus(): Promise<{
    lastSync: string | null;
    totalVisits: number;
    activeImpacts: number;
    averageScore: number;
    complianceRate: number;
    alertsCount: number;
  }> {
    try {
      const [
        { data: lastSync },
        { count: totalVisits },
        { count: activeImpacts },
        { data: recentSummary },
        alerts
      ] = await Promise.all([
        supabase
          .from('sync_metrics')
          .select('sync_date')
          .eq('source_table', 'site_visits')
          .order('sync_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('site_visits')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('site_visit_rating_impacts')
          .select('*', { count: 'exact', head: true })
          .gt('decay_rate', 0),
        supabase
          .from('site_visit_summary')
          .select('average_score, compliance_rate')
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single(),
        this.getSiteVisitAlerts()
      ]);

      return {
        lastSync: lastSync?.sync_date || null,
        totalVisits: totalVisits || 0,
        activeImpacts: activeImpacts || 0,
        averageScore: recentSummary?.average_score || 0,
        complianceRate: recentSummary?.compliance_rate || 0,
        alertsCount: alerts.overdueFollowUps.length + alerts.highRiskVisits.length + alerts.pendingIncidents.length
      };

    } catch (error) {
      console.error('Error getting site visit sync status:', error);
      return {
        lastSync: null,
        totalVisits: 0,
        activeImpacts: 0,
        averageScore: 0,
        complianceRate: 0,
        alertsCount: 0
      };
    }
  }
}

// Export singleton instance
export const siteVisitDataService = new SiteVisitDataService();