/**
 * Project Data Integration Service
 * Handles synchronization of project data and project-employer relationships
 * between legacy CFMEU systems and the traffic light rating system
 */

import { supabase } from '@/integrations/supabase/client';
import {
  LegacyProject,
  LegacyProjectAssignment,
  ProjectComplianceImpact,
  SyncOperation,
  DataTransformation,
  IntegrationConfig,
  DataConflict,
  SyncMetrics
} from '../types/IntegrationTypes';
import { MigrationMetrics, DataLineageRecord, AuditLog } from '../types/MigrationTypes';

export interface ProjectSyncOptions {
  batchSize?: number;
  skipValidation?: boolean;
  includeCompleted?: boolean;
  lastSyncAfter?: string;
  updateAssignmentsOnly?: boolean;
  conflictResolution?: 'source_wins' | 'target_wins' | 'manual';
  projectTypes?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface ProjectSyncResult {
  totalProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  assignmentSyncs: number;
  conflicts: DataConflict[];
  metrics: SyncMetrics;
  duration: number;
  errors: Array<{
    projectId?: string;
    assignmentId?: string;
    error: string;
    phase: 'extraction' | 'transformation' | 'validation' | 'loading';
  }>;
  impactCalculations: {
    employersAffected: number;
    ratingsUpdated: number;
    averageImpactScore: number;
  };
}

export class ProjectDataService {
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly PROJECT_IMPACT_WEIGHTS = {
    project_value: 0.25,
    project_duration: 0.20,
    employer_role: 0.30,
    project_complexity: 0.15,
    compliance_history: 0.10
  };

  /**
   * Synchronizes project data from legacy system to rating system
   */
  async syncProjectData(options: ProjectSyncOptions = {}): Promise<ProjectSyncResult> {
    const startTime = Date.now();
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipValidation = false,
      includeCompleted = false,
      lastSyncAfter,
      updateAssignmentsOnly = false,
      conflictResolution = 'target_wins',
      projectTypes,
      dateRange
    } = options;

    try {
      console.log('Starting project data synchronization...');

      const result: ProjectSyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        assignmentSyncs: 0,
        conflicts: [],
        metrics: {
          source_table: 'projects',
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
        impactCalculations: {
          employersAffected: 0,
          ratingsUpdated: 0,
          averageImpactScore: 0
        }
      };

      if (!updateAssignmentsOnly) {
        // Sync project data
        const legacyProjects = await this.fetchLegacyProjects({
          includeCompleted,
          lastSyncAfter,
          projectTypes,
          dateRange
        });

        console.log(`Found ${legacyProjects.length} projects to process`);
        result.metrics.total_records = legacyProjects.length;

        // Process projects in batches
        for (let i = 0; i < legacyProjects.length; i += batchSize) {
          const batch = legacyProjects.slice(i, i + batchSize);
          console.log(`Processing project batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(legacyProjects.length / batchSize)}`);

          const batchResult = await this.processProjectBatch(batch, {
            skipValidation,
            conflictResolution
          });

          this.aggregateProjectBatchResult(result, batchResult);
        }
      }

      // Sync project assignments and calculate impacts
      console.log('Processing project assignments and impacts...');
      const assignmentResult = await this.syncProjectAssignments({
        batchSize,
        skipValidation,
        conflictResolution,
        lastSyncAfter
      });

      this.aggregateAssignmentResult(result, assignmentResult);

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.metrics.average_processing_time = result.duration / Math.max(result.totalProcessed, 1);
      result.metrics.successful_syncs = result.successfulSyncs + result.assignmentSyncs;
      result.metrics.failed_syncs = result.failedSyncs;
      result.metrics.conflict_count = result.conflicts.length;

      // Log the synchronization
      await this.logProjectSyncOperation(result);

      console.log(`Project sync completed: ${result.successfulSyncs} projects, ${result.assignmentSyncs} assignments processed`);
      return result;

    } catch (error) {
      console.error('Project data synchronization failed:', error);
      throw new Error(`Project sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches legacy projects from the source system
   */
  private async fetchLegacyProjects(options: {
    includeCompleted?: boolean;
    lastSyncAfter?: string;
    projectTypes?: string[];
    dateRange?: { startDate: string; endDate: string };
  }): Promise<LegacyProject[]> {
    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          project_assignments!inner(
            employer_id,
            assignment_type,
            role_type,
            trade_type
          ),
          job_sites!inner(
            address,
            suburb,
            state,
            postcode
          )
        `);

      // Apply filters
      if (!options.includeCompleted) {
        query = query.in('status', ['active', 'in_progress', 'planning', 'pending']);
      }

      if (options.lastSyncAfter) {
        query = query.gte('updated_at', options.lastSyncAfter);
      }

      if (options.projectTypes && options.projectTypes.length > 0) {
        query = query.in('project_type', options.projectTypes);
      }

      if (options.dateRange) {
        query = query
          .gte('start_date', options.dateRange.startDate)
          .lte('end_date', options.dateRange.endDate);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch legacy projects: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacyProject);

    } catch (error) {
      console.error('Error fetching legacy projects:', error);
      throw error;
    }
  }

  /**
   * Processes a batch of projects through the sync pipeline
   */
  private async processProjectBatch(
    projects: LegacyProject[],
    options: {
      skipValidation: boolean;
      conflictResolution: string;
    }
  ): Promise<Partial<ProjectSyncResult>> {
    const batchResult: Partial<ProjectSyncResult> = {
      totalProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflicts: [],
      errors: []
    };

    for (const project of projects) {
      try {
        batchResult.totalProcessed = (batchResult.totalProcessed || 0) + 1;

        // Transform project data
        const transformedData = await this.transformProjectData(project);

        // Validate data if not skipped
        if (!options.skipValidation) {
          const validation = await this.validateProjectData(transformedData);
          if (!validation.isValid) {
            batchResult.errors?.push({
              projectId: project.id,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              phase: 'validation'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Check for conflicts
        const conflicts = await this.detectProjectConflicts(project, transformedData);
        if (conflicts.length > 0) {
          batchResult.conflicts = [...(batchResult.conflicts || []), ...conflicts];

          const resolvedConflicts = await this.resolveProjectConflicts(conflicts, options.conflictResolution);
          if (!resolvedConflicts.allResolved) {
            batchResult.errors?.push({
              projectId: project.id,
              error: `Unresolved conflicts: ${resolvedConflicts.unresolved.join(', ')}`,
              phase: 'loading'
            });
            batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
            continue;
          }
        }

        // Load the data
        await this.loadProjectData(transformedData, project);
        batchResult.successfulSyncs = (batchResult.successfulSyncs || 0) + 1;

      } catch (error) {
        console.error(`Failed to process project ${project.id}:`, error);
        batchResult.errors?.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'transformation'
        });
        batchResult.failedSyncs = (batchResult.failedSyncs || 0) + 1;
      }
    }

    return batchResult;
  }

  /**
   * Synchronizes project assignments and calculates compliance impacts
   */
  private async syncProjectAssignments(options: {
    batchSize: number;
    skipValidation: boolean;
    conflictResolution: string;
    lastSyncAfter?: string;
  }): Promise<Partial<ProjectSyncResult>> {
    const result: Partial<ProjectSyncResult> = {
      assignmentSyncs: 0,
      errors: [],
      impactCalculations: {
        employersAffected: 0,
        ratingsUpdated: 0,
        averageImpactScore: 0
      }
    };

    try {
      // Fetch project assignments
      const assignments = await this.fetchProjectAssignments(options.lastSyncAfter);
      console.log(`Found ${assignments.length} project assignments to process`);

      const impactScores: number[] = [];
      const affectedEmployers = new Set<string>();

      // Process assignments in batches
      for (let i = 0; i < assignments.length; i += options.batchSize) {
        const batch = assignments.slice(i, i + options.batchSize);

        for (const assignment of batch) {
          try {
            // Transform assignment data
            const transformedAssignment = await this.transformAssignmentData(assignment);

            // Validate if required
            if (!options.skipValidation) {
              const validation = await this.validateAssignmentData(transformedAssignment);
              if (!validation.isValid) {
                result.errors?.push({
                  assignmentId: assignment.id,
                  error: `Assignment validation failed: ${validation.errors.join(', ')}`,
                  phase: 'validation'
                });
                continue;
              }
            }

            // Load assignment
            await this.loadAssignmentData(transformedAssignment, assignment);
            result.assignmentSyncs = (result.assignmentSyncs || 0) + 1;

            // Calculate compliance impact
            const impact = await this.calculateComplianceImpact(assignment);
            if (impact) {
              impactScores.push(impact.compliance_score_impact);
              affectedEmployers.add(assignment.employer_id);

              await this.saveComplianceImpact(impact);
            }

          } catch (error) {
            console.error(`Failed to process assignment ${assignment.id}:`, error);
            result.errors?.push({
              assignmentId: assignment.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              phase: 'transformation'
            });
          }
        }
      }

      // Update impact calculations
      if (result.impactCalculations) {
        result.impactCalculations.employersAffected = affectedEmployers.size;
        result.impactCalculations.averageImpactScore = impactScores.length > 0
          ? impactScores.reduce((sum, score) => sum + score, 0) / impactScores.length
          : 0;
      }

      return result;

    } catch (error) {
      console.error('Error syncing project assignments:', error);
      throw error;
    }
  }

  /**
   * Transforms legacy project data to the rating system format
   */
  private async transformProjectData(legacy: LegacyProject): Promise<{
    project: any;
    metadata: any;
  }> {
    try {
      // Transform project data
      const projectData = {
        id: legacy.id,
        name: legacy.name.trim(),
        description: legacy.description?.trim() || null,
        address: legacy.address || null,
        suburb: legacy.suburb || null,
        state: legacy.state || null,
        postcode: legacy.postcode || null,
        project_type: legacy.project_type || 'unknown',
        value: legacy.value || null,
        start_date: legacy.start_date || null,
        end_date: legacy.end_date || null,
        status: this.normalizeProjectStatus(legacy.status),
        created_at: legacy.created_at,
        updated_at: new Date().toISOString(),
        // Additional fields for rating system
        complexity_score: await this.calculateProjectComplexity(legacy),
        risk_level: await this.calculateProjectRiskLevel(legacy),
        estimated_duration_days: this.calculateEstimatedDuration(legacy),
        compliance_requirements: await this.determineComplianceRequirements(legacy)
      };

      // Create metadata
      const metadata = {
        source_system: 'legacy_cfmeu',
        transformed_at: new Date().toISOString(),
        data_quality_score: await this.calculateProjectDataQuality(legacy),
        transformation_hash: this.generateDataHash(projectData),
        enrichment_data: await this.enrichProjectData(legacy)
      };

      return {
        project: projectData,
        metadata
      };

    } catch (error) {
      console.error('Error transforming project data:', error);
      throw new Error(`Project transformation failed for ${legacy.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transforms assignment data
   */
  private async transformAssignmentData(legacy: LegacyProjectAssignment): Promise<any> {
    try {
      return {
        id: legacy.id,
        project_id: legacy.project_id,
        employer_id: legacy.employer_id,
        assignment_type: legacy.assignment_type,
        role_type: legacy.role_type || null,
        trade_type: legacy.trade_type || null,
        start_date: legacy.start_date || null,
        end_date: legacy.end_date || null,
        is_primary_contact: legacy.is_primary_contact || false,
        created_at: legacy.created_at,
        updated_at: new Date().toISOString(),
        // Additional fields
        role_importance: await this.calculateRoleImportance(legacy),
        assignment_weight: await this.calculateAssignmentWeight(legacy),
        compliance_impact_factor: await this.calculateComplianceImpactFactor(legacy)
      };

    } catch (error) {
      console.error('Error transforming assignment data:', error);
      throw error;
    }
  }

  /**
   * Calculates compliance impact for a project assignment
   */
  private async calculateComplianceImpact(assignment: LegacyProjectAssignment): Promise<ProjectComplianceImpact | null> {
    try {
      // Get project details
      const { data: project } = await supabase
        .from('projects')
        .select('value, project_type, start_date, end_date')
        .eq('id', assignment.project_id)
        .single();

      if (!project) return null;

      // Calculate impact factors
      const factors = await Promise.all([
        this.calculateProjectValueFactor(project.value, assignment.role_type),
        this.calculateProjectDurationFactor(project.start_date, project.end_date),
        this.calculateRoleImportanceFactor(assignment.role_type, assignment.trade_type),
        this.calculateProjectComplexityFactor(project.project_type),
        this.calculateComplianceHistoryFactor(assignment.employer_id)
      ]);

      // Calculate overall impact score
      const complianceScoreImpact = factors.reduce((sum, factor, index) => {
        const weight = Object.values(this.PROJECT_IMPACT_WEIGHTS)[index];
        return sum + (factor.impact * weight);
      }, 0);

      return {
        project_id: assignment.project_id,
        employer_id: assignment.employer_id,
        compliance_score_impact: Math.round(complianceScoreImpact * 100) / 100,
        factors: factors.map(f => ({
          factor: f.name,
          impact: f.impact,
          weight: f.weight
        })),
        calculated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error calculating compliance impact:', error);
      return null;
    }
  }

  // ============================================================================
  // Helper Methods for Project Calculations
  // ============================================================================

  private normalizeProjectStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'planning': 'planning',
      'planned': 'planning',
      'pending': 'pending',
      'active': 'active',
      'in_progress': 'active',
      'on_hold': 'on_hold',
      'completed': 'completed',
      'finished': 'completed',
      'cancelled': 'cancelled',
      'suspended': 'suspended'
    };

    return statusMap[status.toLowerCase()] || 'unknown';
  }

  private async calculateProjectComplexity(project: LegacyProject): Promise<number> {
    let complexityScore = 30; // Base complexity

    // Value-based complexity
    if (project.value) {
      if (project.value > 10000000) complexityScore += 30; // > $10M
      else if (project.value > 5000000) complexityScore += 20; // > $5M
      else if (project.value > 1000000) complexityScore += 10; // > $1M
    }

    // Duration-based complexity
    const duration = this.calculateEstimatedDuration(project);
    if (duration > 365) complexityScore += 20; // > 1 year
    else if (duration > 180) complexityScore += 10; // > 6 months

    // Type-based complexity
    const complexTypes = ['infrastructure', 'high_rise', 'industrial', 'healthcare'];
    if (complexTypes.includes(project.project_type?.toLowerCase() || '')) {
      complexityScore += 20;
    }

    return Math.min(complexityScore, 100);
  }

  private async calculateProjectRiskLevel(project: LegacyProject): Promise<'low' | 'medium' | 'high' | 'critical'> {
    const complexity = await this.calculateProjectComplexity(project);

    if (complexity >= 80) return 'critical';
    if (complexity >= 60) return 'high';
    if (complexity >= 40) return 'medium';
    return 'low';
  }

  private calculateEstimatedDuration(project: LegacyProject): number {
    if (!project.start_date) return 0;

    const startDate = new Date(project.start_date);
    const endDate = project.end_date ? new Date(project.end_date) : new Date();

    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async determineComplianceRequirements(project: LegacyProject): Promise<string[]> {
    const requirements: string[] = ['basic_safety'];

    // Value-based requirements
    if (project.value && project.value > 5000000) {
      requirements.push('enhanced_safety', 'regular_audits');
    }

    // Type-based requirements
    const highRiskTypes = ['infrastructure', 'high_rise', 'industrial', 'mining'];
    if (highRiskTypes.includes(project.project_type?.toLowerCase() || '')) {
      requirements.push('specialized_training', 'additional_insurance');
    }

    // Duration-based requirements
    const duration = this.calculateEstimatedDuration(project);
    if (duration > 180) {
      requirements.push('periodic_reviews');
    }

    return requirements;
  }

  private async calculateProjectDataQuality(project: LegacyProject): Promise<number> {
    let score = 0;
    let maxScore = 0;

    const fields = [
      { field: 'name', weight: 25 },
      { field: 'project_type', weight: 15 },
      { field: 'value', weight: 15 },
      { field: 'start_date', weight: 15 },
      { field: 'end_date', weight: 10 },
      { field: 'status', weight: 10 },
      { field: 'address', weight: 5 },
      { field: 'suburb', weight: 5 }
    ];

    for (const { field, weight } of fields) {
      maxScore += weight;
      if (project[field as keyof LegacyProject]) {
        score += weight;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  private async enrichProjectData(project: LegacyProject): Promise<any> {
    try {
      // Get additional data from related tables
      const [assignmentsCount, siteVisitsCount, complianceChecks] = await Promise.all([
        supabase
          .from('project_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id),
        supabase
          .from('site_visits')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id),
        supabase
          .from('compliance_checks')
          .select('status, check_type')
          .in('employer_id', (
            await supabase
              .from('project_assignments')
              .select('employer_id')
              .eq('project_id', project.id)
          ).data?.map(a => a.employer_id) || [])
      ]);

      return {
        assignments_count: assignmentsCount,
        site_visits_count: siteVisitsCount,
        compliance_summary: complianceChecks.data || [],
        estimated_team_size: await this.estimateTeamSize(project.id)
      };

    } catch (error) {
      console.error('Error enriching project data:', error);
      return {};
    }
  }

  private async fetchProjectAssignments(lastSyncAfter?: string): Promise<LegacyProjectAssignment[]> {
    try {
      let query = supabase
        .from('project_assignments')
        .select(`
          *,
          projects!inner(
            name,
            value,
            project_type,
            status
          ),
          employers!inner(
            name,
            employer_type
          )
        `);

      if (lastSyncAfter) {
        query = query.gte('updated_at', lastSyncAfter);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch project assignments: ${error.message}`);
      }

      return (data || []).map(this.mapToLegacyAssignment);

    } catch (error) {
      console.error('Error fetching project assignments:', error);
      throw error;
    }
  }

  // ============================================================================
  // Assignment-related Helper Methods
  // ============================================================================

  private async calculateRoleImportance(assignment: LegacyProjectAssignment): Promise<number> {
    const importanceMap: Record<string, number> = {
      'head_contractor': 100,
      'builder': 90,
      'project_manager': 85,
      'principal_contractor': 80,
      'civil_contractor': 70,
      'structural_contractor': 65,
      'services_contractor': 60,
      'finishing_contractor': 55,
      'subcontractor': 50,
      'supplier': 40,
      'labour_hire': 35,
      'consultant': 30
    };

    return importanceMap[assignment.role_type || ''] || 50;
  }

  private async calculateAssignmentWeight(assignment: LegacyProjectAssignment): Promise<number> {
    const roleImportance = await this.calculateRoleImportance(assignment);
    const durationWeight = await this.calculateDurationWeight(assignment);
    const tradeWeight = await this.calculateTradeWeight(assignment.trade_type);

    return Math.round((roleImportance * 0.5 + durationWeight * 0.3 + tradeWeight * 0.2));
  }

  private async calculateDurationWeight(assignment: LegacyProjectAssignment): Promise<number> {
    if (!assignment.start_date) return 50;

    const startDate = new Date(assignment.start_date);
    const endDate = assignment.end_date ? new Date(assignment.end_date) : new Date();
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (durationDays > 365) return 100;
    if (durationDays > 180) return 80;
    if (durationDays > 90) return 60;
    if (durationDays > 30) return 40;
    return 20;
  }

  private async calculateTradeWeight(tradeType?: string): Promise<number> {
    if (!tradeType) return 50;

    const criticalTrades = [
      'structural_steel', 'concrete', 'demolition', 'cranes', 'scaffolding',
      'electrical', 'plumbing', 'hvac', 'fire_protection'
    ];

    const importantTrades = [
      'carpentry', 'glazing', 'waterproofing', 'insulation', 'drywall',
      'painting', 'tiling', 'landscaping'
    ];

    if (criticalTrades.includes(tradeType.toLowerCase())) return 100;
    if (importantTrades.includes(tradeType.toLowerCase())) return 75;
    return 50;
  }

  private async calculateComplianceImpactFactor(assignment: LegacyProjectAssignment): Promise<number> {
    const roleImportance = await this.calculateRoleImportance(assignment);
    const assignmentWeight = await this.calculateAssignmentWeight(assignment);

    // Get employer's current compliance score
    const { data: rating } = await supabase
      .from('employer_final_ratings')
      .select('overall_rating')
      .eq('employer_id', assignment.employer_id)
      .single();

    const currentRating = rating?.overall_rating || 'amber';
    const ratingMultiplier = currentRating === 'red' ? 1.5 : currentRating === 'amber' ? 1.2 : 1.0;

    return Math.round((roleImportance * 0.6 + assignmentWeight * 0.4) * ratingMultiplier);
  }

  // ============================================================================
  // Impact Calculation Helper Methods
  // ============================================================================

  private async calculateProjectValueFactor(
    value?: number,
    roleType?: string
  ): Promise<{ name: string; impact: number; weight: number }> {
    let impact = 0;

    if (value) {
      if (value > 20000000) impact = 100; // > $20M
      else if (value > 10000000) impact = 85; // > $10M
      else if (value > 5000000) impact = 70; // > $5M
      else if (value > 1000000) impact = 50; // > $1M
      else impact = 25;
    }

    // Adjust based on role
    const roleMultiplier = roleType === 'head_contractor' ? 1.5 :
                          roleType === 'builder' ? 1.3 : 1.0;

    return {
      name: 'project_value',
      impact: impact * roleMultiplier,
      weight: this.PROJECT_IMPACT_WEIGHTS.project_value
    };
  }

  private async calculateProjectDurationFactor(
    startDate?: string,
    endDate?: string
  ): Promise<{ name: string; impact: number; weight: number }> {
    if (!startDate) return { name: 'project_duration', impact: 0, weight: this.PROJECT_IMPACT_WEIGHTS.project_duration };

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let impact = 0;
    if (durationDays > 730) impact = 100; // > 2 years
    else if (durationDays > 365) impact = 80; // > 1 year
    else if (durationDays > 180) impact = 60; // > 6 months
    else if (durationDays > 90) impact = 40; // > 3 months
    else impact = 20;

    return {
      name: 'project_duration',
      impact,
      weight: this.PROJECT_IMPACT_WEIGHTS.project_duration
    };
  }

  private async calculateRoleImportanceFactor(
    roleType?: string,
    tradeType?: string
  ): Promise<{ name: string; impact: number; weight: number }> {
    const roleImportance = await this.calculateRoleImportance({
      role_type: roleType,
      trade_type: tradeType
    } as LegacyProjectAssignment);

    return {
      name: 'employer_role',
      impact: roleImportance,
      weight: this.PROJECT_IMPACT_WEIGHTS.employer_role
    };
  }

  private async calculateProjectComplexityFactor(
    projectType?: string
  ): Promise<{ name: string; impact: number; weight: number }> {
    const complexityMap: Record<string, number> = {
      'infrastructure': 100,
      'high_rise': 95,
      'industrial': 90,
      'healthcare': 85,
      'education': 80,
      'commercial': 70,
      'residential': 60,
      'civil': 75,
      'renovation': 40,
      'maintenance': 30
    };

    const impact = complexityMap[projectType?.toLowerCase() || ''] || 50;

    return {
      name: 'project_complexity',
      impact,
      weight: this.PROJECT_IMPACT_WEIGHTS.project_complexity
    };
  }

  private async calculateComplianceHistoryFactor(
    employerId: string
  ): Promise<{ name: string; impact: number; weight: number }> {
    try {
      // Get employer's recent compliance history
      const { data: complianceChecks } = await supabase
        .from('compliance_checks')
        .select('status, check_type, checked_at')
        .eq('employer_id', employerId)
        .gte('checked_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('checked_at', { ascending: false });

      if (!complianceChecks || complianceChecks.length === 0) {
        return { name: 'compliance_history', impact: 50, weight: this.PROJECT_IMPACT_WEIGHTS.compliance_history };
      }

      const compliantCount = complianceChecks.filter(c => c.status === 'compliant').length;
      const totalCount = complianceChecks.length;
      const complianceRate = compliantCount / totalCount;

      let impact = complianceRate * 100;

      // Weight more recent checks more heavily
      const recentChecks = complianceChecks.slice(0, 5);
      if (recentChecks.length > 0) {
        const recentComplianceRate = recentChecks.filter(c => c.status === 'compliant').length / recentChecks.length;
        impact = (impact * 0.7) + (recentComplianceRate * 100 * 0.3);
      }

      return {
        name: 'compliance_history',
        impact: Math.round(impact),
        weight: this.PROJECT_IMPACT_WEIGHTS.compliance_history
      };

    } catch (error) {
      console.error('Error calculating compliance history factor:', error);
      return { name: 'compliance_history', impact: 50, weight: this.PROJECT_IMPACT_WEIGHTS.compliance_history };
    }
  }

  // ============================================================================
  // Validation and Conflict Resolution Methods
  // ============================================================================

  private async validateProjectData(data: { project: any; metadata: any }): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!data.project.name || data.project.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!data.project.status) {
      errors.push('Project status is required');
    }

    if (data.project.value && (data.project.value < 0 || !Number.isFinite(data.project.value))) {
      errors.push('Project value must be a positive number');
    }

    if (data.project.start_date && !this.isValidDate(data.project.start_date)) {
      errors.push('Invalid start date format');
    }

    if (data.project.end_date && !this.isValidDate(data.project.end_date)) {
      errors.push('Invalid end date format');
    }

    if (data.project.start_date && data.project.end_date) {
      const start = new Date(data.project.start_date);
      const end = new Date(data.project.end_date);
      if (end < start) {
        errors.push('End date must be after start date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateAssignmentData(data: any): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!data.project_id) {
      errors.push('Project ID is required');
    }

    if (!data.employer_id) {
      errors.push('Employer ID is required');
    }

    if (!data.assignment_type) {
      errors.push('Assignment type is required');
    }

    const validAssignmentTypes = ['contractor_role', 'trade_assignment', 'labour_hire'];
    if (!validAssignmentTypes.includes(data.assignment_type)) {
      errors.push('Invalid assignment type');
    }

    if (data.start_date && !this.isValidDate(data.start_date)) {
      errors.push('Invalid start date format');
    }

    if (data.end_date && !this.isValidDate(data.end_date)) {
      errors.push('Invalid end date format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async detectProjectConflicts(
    legacy: LegacyProject,
    transformed: { project: any; metadata: any }
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    try {
      // Check for existing project with same name but different ID
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id, name, updated_at, value')
        .eq('name', transformed.project.name)
        .neq('id', legacy.id)
        .maybeSingle();

      if (existingProject) {
        // Check if values differ significantly
        const valueDiff = Math.abs((existingProject.value || 0) - (legacy.value || 0));
        const valueDiffPercent = existingProject.value ? (valueDiff / existingProject.value) * 100 : 0;

        if (valueDiffPercent > 10) { // 10% threshold
          conflicts.push({
            id: this.generateConflictId(),
            source_table: 'projects',
            target_table: 'projects',
            record_id: legacy.id,
            field_name: 'value',
            source_value: legacy.value,
            target_value: existingProject.value,
            conflict_type: 'value_mismatch',
            severity: valueDiffPercent > 50 ? 'high' : 'medium',
            status: 'pending',
            detected_at: new Date().toISOString()
          });
        }
      }

      return conflicts;

    } catch (error) {
      console.error('Error detecting project conflicts:', error);
      return [];
    }
  }

  private async resolveProjectConflicts(
    conflicts: DataConflict[],
    strategy: string
  ): Promise<{ allResolved: boolean; unresolved: string[] }> {
    const unresolved: string[] = [];

    for (const conflict of conflicts) {
      try {
        switch (strategy) {
          case 'source_wins':
            await this.applySourceProjectResolution(conflict);
            break;
          case 'target_wins':
            await this.applyTargetProjectResolution(conflict);
            break;
          case 'manual':
            unresolved.push(`Manual review needed for project ${conflict.field_name}`);
            break;
          default:
            unresolved.push(`Unknown resolution strategy: ${strategy}`);
        }
      } catch (error) {
        console.error(`Failed to resolve project conflict ${conflict.id}:`, error);
        unresolved.push(conflict.id);
      }
    }

    return {
      allResolved: unresolved.length === 0,
      unresolved
    };
  }

  private async applySourceProjectResolution(conflict: DataConflict): Promise<void> {
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

  private async applyTargetProjectResolution(conflict: DataConflict): Promise<void> {
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

  private async loadProjectData(
    transformed: { project: any; metadata: any },
    legacy: LegacyProject
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('upsert_project_data', {
        p_project_data: transformed.project,
        p_metadata: transformed.metadata,
        p_legacy_id: legacy.id
      });

      if (error) throw error;

      await this.createProjectDataLineage(transformed, legacy);

    } catch (error) {
      console.error('Error loading project data:', error);
      throw error;
    }
  }

  private async loadAssignmentData(
    transformedAssignment: any,
    legacyAssignment: LegacyProjectAssignment
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('project_assignments')
        .upsert(transformedAssignment);

      if (error) throw error;

    } catch (error) {
      console.error('Error loading assignment data:', error);
      throw error;
    }
  }

  private async saveComplianceImpact(impact: ProjectComplianceImpact): Promise<void> {
    try {
      const { error } = await supabase
        .from('project_compliance_impacts')
        .upsert(impact);

      if (error) throw error;

      // Trigger rating recalculation for the employer
      await supabase.rpc('trigger_employer_rating_recalculation', {
        p_employer_id: impact.employer_id
      });

    } catch (error) {
      console.error('Error saving compliance impact:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapToLegacyProject(data: any): LegacyProject {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      address: data.job_sites?.address,
      suburb: data.job_sites?.suburb,
      state: data.job_sites?.state,
      postcode: data.job_sites?.postcode,
      project_type: data.project_type,
      value: data.value,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  private mapToLegacyAssignment(data: any): LegacyProjectAssignment {
    return {
      id: data.id,
      project_id: data.project_id,
      employer_id: data.employer_id,
      assignment_type: data.assignment_type,
      role_type: data.role_type,
      trade_type: data.trade_type,
      start_date: data.start_date,
      end_date: data.end_date,
      is_primary_contact: data.is_primary_contact,
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

  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private async estimateTeamSize(projectId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      // Estimate team size based on assignments and typical crew sizes
      const baseSize = (count || 0) * 3; // Average 3 people per assignment
      return Math.max(baseSize, 5); // Minimum 5 people for any project

    } catch (error) {
      console.error('Error estimating team size:', error);
      return 10; // Default estimate
    }
  }

  private aggregateProjectBatchResult(
    mainResult: ProjectSyncResult,
    batchResult: Partial<ProjectSyncResult>
  ): void {
    mainResult.totalProcessed += batchResult.totalProcessed || 0;
    mainResult.successfulSyncs += batchResult.successfulSyncs || 0;
    mainResult.failedSyncs += batchResult.failedSyncs || 0;
    mainResult.conflicts.push(...(batchResult.conflicts || []));
    mainResult.errors.push(...(batchResult.errors || []));
  }

  private aggregateAssignmentResult(
    mainResult: ProjectSyncResult,
    assignmentResult: Partial<ProjectSyncResult>
  ): void {
    mainResult.assignmentSyncs += assignmentResult.assignmentSyncs || 0;
    mainResult.errors.push(...(assignmentResult.errors || []));

    if (assignmentResult.impactCalculations) {
      mainResult.impactCalculations.employersAffected += assignmentResult.impactCalculations.employersAffected;
      mainResult.impactCalculations.ratingsUpdated += assignmentResult.impactCalculations.ratingsUpdated;

      const avgScore1 = mainResult.impactCalculations.averageImpactScore;
      const avgScore2 = assignmentResult.impactCalculations.averageImpactScore;
      const count1 = mainResult.impactCalculations.ratingsUpdated;
      const count2 = assignmentResult.impactCalculations.ratingsUpdated;

      if (count1 + count2 > 0) {
        mainResult.impactCalculations.averageImpactScore =
          (avgScore1 * count1 + avgScore2 * count2) / (count1 + count2);
      }
    }
  }

  private async createProjectDataLineage(
    transformed: { project: any; metadata: any },
    legacy: LegacyProject
  ): Promise<void> {
    try {
      const lineageRecord: DataLineageRecord = {
        id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_record_id: legacy.id,
        source_table: 'projects',
        target_record_id: transformed.project.id,
        target_table: 'projects',
        transformation_applied: JSON.stringify({
          project_fields: Object.keys(transformed.project),
          enrichments: Object.keys(transformed.metadata.enrichment_data || {})
        }),
        migration_id: `project_sync_${new Date().toISOString().split('T')[0]}`,
        transformed_at: new Date().toISOString(),
        transformation_hash: this.generateDataHash(transformed.project),
        quality_score: transformed.metadata.data_quality_score,
        confidence_level: 95
      };

      await supabase
        .from('data_lineage_records')
        .insert(lineageRecord);

    } catch (error) {
      console.error('Error creating project data lineage record:', error);
    }
  }

  private async logProjectSyncOperation(result: ProjectSyncResult): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        migration_id: `project_sync_${new Date().toISOString().split('T')[0]}`,
        action: 'project_data_synchronization',
        actor: 'system',
        object_type: 'migration',
        object_id: 'project_sync_batch',
        new_values: {
          projects_processed: result.totalProcessed,
          assignments_processed: result.assignmentSyncs,
          successful_syncs: result.successfulSyncs,
          failed_syncs: result.failedSyncs,
          conflicts: result.conflicts.length,
          duration: result.duration,
          impact_calculations: result.impactCalculations
        },
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('Error logging project sync operation:', error);
    }
  }

  /**
   * Get current project sync status for monitoring
   */
  async getProjectSyncStatus(): Promise<{
    lastSync: string | null;
    totalProjects: number;
    activeProjects: number;
    syncedProjects: number;
    pendingImpacts: number;
    averageComplexity: number;
  }> {
    try {
      const [
        { data: lastSync },
        { count: totalProjects },
        { count: activeProjects },
        { count: syncedProjects },
        { count: pendingImpacts },
        { data: complexityData }
      ] = await Promise.all([
        supabase
          .from('sync_metrics')
          .select('sync_date')
          .eq('source_table', 'projects')
          .order('sync_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .in('status', ['active', 'in_progress', 'planning']),
        supabase
          .from('project_data_lineage')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('project_compliance_impacts')
          .select('*', { count: 'exact', head: true })
          .eq('processed', false),
        supabase
          .from('projects')
          .select('complexity_score')
          .limit(1000)
      ]);

      const averageComplexity = complexityData && complexityData.length > 0
        ? complexityData.reduce((sum, p) => sum + (p.complexity_score || 0), 0) / complexityData.length
        : 0;

      return {
        lastSync: lastSync?.sync_date || null,
        totalProjects: totalProjects || 0,
        activeProjects: activeProjects || 0,
        syncedProjects: syncedProjects || 0,
        pendingImpacts: pendingImpacts || 0,
        averageComplexity: Math.round(averageComplexity)
      };

    } catch (error) {
      console.error('Error getting project sync status:', error);
      return {
        lastSync: null,
        totalProjects: 0,
        activeProjects: 0,
        syncedProjects: 0,
        pendingImpacts: 0,
        averageComplexity: 0
      };
    }
  }
}

// Export singleton instance
export const projectDataService = new ProjectDataService();