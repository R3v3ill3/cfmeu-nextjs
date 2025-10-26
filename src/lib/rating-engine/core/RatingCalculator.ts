// Core Rating Calculator - Main interface and abstract base class for all rating calculations

import {
  TrafficLightRating,
  ConfidenceLevel,
  FinalRatingResult,
  ProjectRatingResult,
  ExpertiseRatingResult,
  EBARatingResult,
  RatingCalculationRequest,
  RatingWeights,
  CalculationMethod
} from '../types/RatingTypes';
import {
  CalculationContext,
  CalculationInput,
  CalculationConfig,
  CalculationState,
  CalculationOutput,
  CalculationValidationResult,
  PerformanceProfile
} from '../types/CalculationTypes';
import { CacheStrategy, LogLevel } from '../types/CalculationTypes';

// =============================================================================
// MAIN RATING CALCULATOR INTERFACE
// =============================================================================

export interface IRatingCalculator {
  // Core calculation methods
  calculateFinalRating(request: RatingCalculationRequest): Promise<FinalRatingResult>;
  calculateProjectRating(employerId: string, context: CalculationContext): Promise<ProjectRatingResult>;
  calculateExpertiseRating(employerId: string, context: CalculationContext): Promise<ExpertiseRatingResult>;
  calculateEBARating(employerId: string, context: CalculationContext): Promise<EBARatingResult>;

  // Batch operations
  calculateBatchRatings(employerIds: string[], request: RatingCalculationRequest): Promise<FinalRatingResult[]>;
  recalculateEmployerRating(employerId: string, request: RatingCalculationRequest): Promise<FinalRatingResult>;

  // Validation and configuration
  validateCalculationRequest(request: RatingCalculationRequest): Promise<CalculationValidationResult>;
  updateConfiguration(config: Partial<CalculationConfig>): Promise<void>;
  getConfiguration(): Promise<CalculationConfig>;

  // Caching and performance
  clearCache(employerId?: string): Promise<void>;
  getPerformanceMetrics(): Promise<PerformanceProfile>;
  warmCache(employerIds: string[]): Promise<void>;

  // Status and monitoring
  getCalculationStatus(employerId: string): Promise<CalculationState | null>;
  cancelCalculation(employerId: string): Promise<boolean>;

  // Export and reporting
  exportRatings(request: RatingCalculationRequest, format: 'json' | 'csv' | 'excel'): Promise<Blob>;
  generateReport(employerId: string, reportType: 'summary' | 'detailed' | 'audit'): Promise<string>;
}

// =============================================================================
// ABSTRACT BASE CALCULATOR CLASS
// =============================================================================

export abstract class BaseRatingCalculator implements IRatingCalculator {
  protected config: CalculationConfig;
  protected cache: Map<string, CacheEntry<any>>;
  protected logger: ILogger;
  protected performanceTracker: IPerformanceTracker;
  protected validator: IValidator;
  protected dataSource: IDataSource;

  constructor(
    config: CalculationConfig,
    dependencies: RatingCalculatorDependencies
  ) {
    this.config = config;
    this.cache = new Map();
    this.logger = dependencies.logger;
    this.performanceTracker = dependencies.performanceTracker;
    this.validator = dependencies.validator;
    this.dataSource = dependencies.dataSource;
  }

  // -------------------------------------------------------------------------
  // PUBLIC INTERFACE IMPLEMENTATION
  // -------------------------------------------------------------------------

  async calculateFinalRating(request: RatingCalculationRequest): Promise<FinalRatingResult> {
    const calculationId = this.generateCalculationId(request.employer_id);
    const startTime = Date.now();

    try {
      // Initialize calculation state
      const state = this.initializeCalculationState(calculationId, request);
      await this.updateCalculationState(calculationId, state);

      this.logger.info('Starting final rating calculation', {
        employer_id: request.employer_id,
        calculation_id: calculationId,
        method: request.calculation_method
      });

      // Validate request
      const validation = await this.validateCalculationRequest(request);
      if (!validation.is_valid) {
        throw new RatingCalculationError(
          'VALIDATION_ERROR',
          'Calculation request failed validation',
          { validation_errors: validation.errors }
        );
      }

      // Check cache first
      if (!request.force_recalculate) {
        const cached = await this.getCachedResult(request);
        if (cached) {
          this.logger.info('Returning cached result', { calculation_id: calculationId });
          return cached;
        }
      }

      // Load input data
      state.phase = 'loading_data';
      await this.updateCalculationState(calculationId, state);
      const input = await this.loadCalculationInput(request);

      // Perform calculation
      const result = await this.performCalculation(request, input, state);

      // Cache result
      await this.cacheResult(request, result);

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      await this.performanceTracker.recordCalculation(processingTime, result);

      this.logger.info('Calculation completed successfully', {
        calculation_id: calculationId,
        processing_time_ms: processingTime,
        final_rating: result.final_rating,
        final_score: result.final_score
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.handleCalculationError(calculationId, error as Error, processingTime);
      throw error;
    } finally {
      // Cleanup
      await this.cleanupCalculation(calculationId);
    }
  }

  async calculateProjectRating(employerId: string, context: CalculationContext): Promise<ProjectRatingResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting project rating calculation', { employer_id: employerId });

      // Load project assessment data
      const assessments = await this.dataSource.loadProjectAssessments(
        employerId,
        context.calculation_date,
        context.lookback_days.project
      );

      // Calculate rating using Track 1 calculator
      const track1Calculator = this.getTrack1Calculator();
      const result = await track1Calculator.calculateRating(assessments, context);

      this.logger.info('Project rating calculation completed', {
        employer_id: employerId,
        rating: result.rating,
        score: result.score,
        processing_time_ms: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Project rating calculation failed', {
        employer_id: employerId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async calculateExpertiseRating(employerId: string, context: CalculationContext): Promise<ExpertiseRatingResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting expertise rating calculation', { employer_id: employerId });

      // Load expertise assessment data
      const assessments = await this.dataSource.loadExpertiseAssessments(
        employerId,
        context.calculation_date,
        context.lookback_days.expertise
      );

      // Load organiser profiles
      const organiserIds = [...new Set(assessments.map(a => a.organiser_id))];
      const organiserProfiles = await this.dataSource.loadOrganiserProfiles(organiserIds);

      // Calculate rating using Track 2 calculator
      const track2Calculator = this.getTrack2Calculator();
      const result = await track2Calculator.calculateRating(assessments, organiserProfiles, context);

      this.logger.info('Expertise rating calculation completed', {
        employer_id: employerId,
        rating: result.rating,
        score: result.score,
        processing_time_ms: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Expertise rating calculation failed', {
        employer_id: employerId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async calculateEBARating(employerId: string, context: CalculationContext): Promise<EBARatingResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting EBA rating calculation', { employer_id: employerId });

      // Load EBA records
      const ebaRecords = await this.dataSource.loadEBARecords(employerId);

      // Calculate EBA rating
      const ebaCalculator = this.getEBACalculator();
      const result = await ebaCalculator.calculateRating(ebaRecords, context);

      this.logger.info('EBA rating calculation completed', {
        employer_id: employerId,
        eba_status: result.eba_status,
        eba_score: result.eba_score,
        processing_time_ms: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('EBA rating calculation failed', {
        employer_id: employerId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async calculateBatchRatings(employerIds: string[], request: RatingCalculationRequest): Promise<FinalRatingResult[]> {
    this.logger.info('Starting batch rating calculation', {
      employer_count: employerIds.length,
      method: request.calculation_method
    });

    const results: FinalRatingResult[] = [];
    const batchSize = this.config.performance.batch_size;

    // Process in batches to manage memory and performance
    for (let i = 0; i < employerIds.length; i += batchSize) {
      const batch = employerIds.slice(i, i + batchSize);
      this.logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}`, {
        batch_size: batch.length,
        progress: `${Math.round((i / employerIds.length) * 100)}%`
      });

      // Process batch in parallel with limited concurrency
      const batchPromises = batch.map(async (employerId) => {
        try {
          const employerRequest = { ...request, employer_id: employerId };
          return await this.calculateFinalRating(employerRequest);
        } catch (error) {
          this.logger.error('Batch calculation failed for employer', {
            employer_id: employerId,
            error: (error as Error).message
          });
          throw error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    this.logger.info('Batch rating calculation completed', {
      total_processed: results.length,
      successful: results.filter(r => r.final_rating !== 'unknown').length
    });

    return results;
  }

  async recalculateEmployerRating(employerId: string, request: RatingCalculationRequest): Promise<FinalRatingResult> {
    // Clear cache for this employer
    await this.clearCache(employerId);

    // Force recalculation
    const recalcRequest = { ...request, employer_id: employerId, force_recalculate: true };
    return await this.calculateFinalRating(recalcRequest);
  }

  // -------------------------------------------------------------------------
  // VALIDATION AND CONFIGURATION
  // -------------------------------------------------------------------------

  async validateCalculationRequest(request: RatingCalculationRequest): Promise<CalculationValidationResult> {
    return await this.validator.validateCalculationRequest(request);
  }

  async updateConfiguration(configUpdates: Partial<CalculationConfig>): Promise<void> {
    this.config = { ...this.config, ...configUpdates };
    await this.validator.validateConfiguration(this.config);
    this.logger.info('Configuration updated', { updates: Object.keys(configUpdates) });
  }

  async getConfiguration(): Promise<CalculationConfig> {
    return { ...this.config };
  }

  // -------------------------------------------------------------------------
  // CACHING AND PERFORMANCE
  // -------------------------------------------------------------------------

  async clearCache(employerId?: string): Promise<void> {
    if (employerId) {
      // Clear specific employer cache entries
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (key.includes(employerId)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }

    this.logger.info('Cache cleared', { employer_id: employerId || 'all' });
  }

  async getPerformanceMetrics(): Promise<PerformanceProfile> {
    return await this.performanceTracker.getCurrentMetrics();
  }

  async warmCache(employerIds: string[]): Promise<void> {
    this.logger.info('Starting cache warm-up', { employer_count: employerIds.length });

    const warmUpRequest: RatingCalculationRequest = {
      employer_id: '', // Will be set for each employer
      calculation_method: 'hybrid_method',
      force_recalculate: false
    };

    // Warm up cache in parallel with limited concurrency
    const concurrencyLimit = 5;
    for (let i = 0; i < employerIds.length; i += concurrencyLimit) {
      const batch = employerIds.slice(i, i + concurrencyLimit);
      await Promise.all(
        batch.map(async (employerId) => {
          try {
            await this.calculateFinalRating({ ...warmUpRequest, employer_id });
          } catch (error) {
            this.logger.warn('Cache warm-up failed for employer', {
              employer_id: employerId,
              error: (error as Error).message
            });
          }
        })
      );
    }

    this.logger.info('Cache warm-up completed');
  }

  // -------------------------------------------------------------------------
  // STATUS AND MONITORING
  // -------------------------------------------------------------------------

  async getCalculationStatus(employerId: string): Promise<CalculationState | null> {
    // This would typically be stored in a persistent cache or database
    // For now, return null as this is a placeholder implementation
    return null;
  }

  async cancelCalculation(employerId: string): Promise<boolean> {
    // Implementation would set a cancellation flag for the calculation
    this.logger.info('Calculation cancellation requested', { employer_id: employerId });
    return true;
  }

  // -------------------------------------------------------------------------
  // EXPORT AND REPORTING
  // -------------------------------------------------------------------------

  async exportRatings(
    request: RatingCalculationRequest,
    format: 'json' | 'csv' | 'excel'
  ): Promise<Blob> {
    const result = await this.calculateFinalRating(request);

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      case 'csv':
        return this.generateCSVExport(result);
      case 'excel':
        return this.generateExcelExport(result);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async generateReport(employerId: string, reportType: 'summary' | 'detailed' | 'audit'): Promise<string> {
    const request: RatingCalculationRequest = { employer_id: employer_id };
    const result = await this.calculateFinalRating(request);

    switch (reportType) {
      case 'summary':
        return this.generateSummaryReport(result);
      case 'detailed':
        return this.generateDetailedReport(result);
      case 'audit':
        return this.generateAuditReport(result);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  // -------------------------------------------------------------------------
  // ABSTRACT METHODS (TO BE IMPLEMENTED BY CONCRETE CLASSES)
  // -------------------------------------------------------------------------

  protected abstract getTrack1Calculator(): ITrack1Calculator;
  protected abstract getTrack2Calculator(): ITrack2Calculator;
  protected abstract getEBACalculator(): IEBACalculator;
  protected abstract getCombinedCalculator(): ICombinedCalculator;

  // -------------------------------------------------------------------------
  // PROTECTED HELPER METHODS
  // -------------------------------------------------------------------------

  protected async performCalculation(
    request: RatingCalculationRequest,
    input: CalculationInput,
    state: CalculationState
  ): Promise<FinalRatingResult> {
    const context = input.context;

    // Calculate component ratings
    state.phase = 'calculating_project';
    await this.updateCalculationState(this.generateCalculationId(request.employer_id), state);
    const projectResult = await this.calculateProjectRating(request.employer_id, context);

    state.phase = 'calculating_expertise';
    await this.updateCalculationState(this.generateCalculationId(request.employer_id), state);
    const expertiseResult = await this.calculateExpertiseRating(request.employer_id, context);

    state.phase = 'calculating_eba';
    await this.updateCalculationState(this.generateCalculationId(request.employer_id), state);
    const ebaResult = await this.calculateEBARating(request.employer_id, context);

    // Combine and reconcile ratings
    state.phase = 'reconciling';
    await this.updateCalculationState(this.generateCalculationId(request.employer_id), state);
    const combinedCalculator = this.getCombinedCalculator();
    const finalResult = await combinedCalculator.calculateFinalRating(
      projectResult,
      expertiseResult,
      ebaResult,
      context
    );

    return finalResult;
  }

  protected async loadCalculationInput(request: RatingCalculationRequest): Promise<CalculationInput> {
    const context: CalculationContext = {
      employer_id: request.employer_id,
      calculation_date: request.calculation_date || new Date(),
      lookback_days: {
        project: 365,
        expertise: 180,
        eba: 1460 // 4 years
      },
      weights: {
        project: request.project_weight || 0.6,
        expertise: request.expertise_weight || 0.4,
        eba: request.eba_weight || 0.15
      },
      method: request.calculation_method || 'hybrid_method',
      force_recalculate: request.force_recalculate || false,
      debug_mode: false
    };

    // Load data in parallel
    const [projectAssessments, expertiseAssessments, ebaRecords] = await Promise.all([
      this.dataSource.loadProjectAssessments(request.employer_id, context.calculation_date, context.lookback_days.project),
      this.dataSource.loadExpertiseAssessments(request.employer_id, context.calculation_date, context.lookback_days.expertise),
      this.dataSource.loadEBARecords(request.employer_id)
    ]);

    // Load organiser profiles for expertise assessments
    const organiserIds = [...new Set(expertiseAssessments.map(a => a.organiser_id))];
    const organiserProfiles = await this.dataSource.loadOrganiserProfiles(organiserIds);

    return {
      employer_id: request.employer_id,
      project_assessments: projectAssessments,
      expertise_assessments: expertiseAssessments,
      eba_records: ebaRecords,
      organiser_profiles: organiserProfiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>),
      context
    };
  }

  protected initializeCalculationState(calculationId: string, request: RatingCalculationRequest): CalculationState {
    return {
      phase: 'initializing',
      progress: 0,
      current_step: 'Initializing calculation',
      start_time: new Date(),
      elapsed_ms: 0,
      warnings: [],
      errors: [],
      debug_info: {
        calculation_id: calculationId,
        employer_id: request.employer_id,
        method: request.calculation_method
      }
    };
  }

  protected async updateCalculationState(calculationId: string, state: CalculationState): Promise<void> {
    state.elapsed_ms = Date.now() - state.start_time.getTime();
    // In a real implementation, this would be stored in a persistent cache
  }

  protected async cleanupCalculation(calculationId: string): Promise<void> {
    // Cleanup any temporary data or state
  }

  protected generateCalculationId(employerId: string): string {
    return `${employerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async getCachedResult(request: RatingCalculationRequest): Promise<FinalRatingResult | null> {
    if (!this.config.performance.enable_caching) {
      return null;
    }

    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry_date > new Date()) {
      cached.hit_count++;
      cached.last_accessed = new Date();
      return cached.data as FinalRatingResult;
    }

    return null;
  }

  protected async cacheResult(request: RatingCalculationRequest, result: FinalRatingResult): Promise<void> {
    if (!this.config.performance.enable_caching) {
      return;
    }

    const cacheKey = this.generateCacheKey(request);
    const expiryDate = new Date(Date.now() + this.config.performance.cache_ttl_seconds * 1000);

    const cacheEntry: CacheEntry<FinalRatingResult> = {
      data: result,
      timestamp: new Date(),
      expiry_date: expiryDate,
      key_hash: this.hashString(cacheKey),
      size_bytes: JSON.stringify(result).length,
      hit_count: 0,
      last_accessed: new Date()
    };

    this.cache.set(cacheKey, cacheEntry);
  }

  protected generateCacheKey(request: RatingCalculationRequest): string {
    const keyData = {
      employer_id: request.employer_id,
      calculation_date: request.calculation_date?.toISOString() || 'today',
      method: request.calculation_method,
      weights: {
        project: request.project_weight,
        expertise: request.expertise_weight,
        eba: request.eba_weight
      }
    };
    return JSON.stringify(keyData);
  }

  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  protected async handleCalculationError(calculationId: string, error: Error, processingTime: number): Promise<void> {
    this.logger.error('Calculation failed', {
      calculation_id: calculationId,
      error: error.message,
      stack: error.stack,
      processing_time_ms: processingTime
    });

    // Record error in performance tracker
    await this.performanceTracker.recordError(error, processingTime);
  }

  // -------------------------------------------------------------------------
  // EXPORT HELPER METHODS
  // -------------------------------------------------------------------------

  protected generateCSVExport(result: FinalRatingResult): Blob {
    const csvData = this.convertToCSV(result);
    return new Blob([csvData], { type: 'text/csv' });
  }

  protected generateExcelExport(result: FinalRatingResult): Blob {
    // This would use a library like ExcelJS
    // For now, return JSON as placeholder
    const jsonData = JSON.stringify(result, null, 2);
    return new Blob([jsonData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  protected convertToCSV(result: FinalRatingResult): string {
    const headers = [
      'Employer ID', 'Final Rating', 'Final Score', 'Overall Confidence',
      'Project Rating', 'Project Score', 'Expertise Rating', 'Expertise Score',
      'EBA Status', 'Calculation Date', 'Review Required'
    ];

    const row = [
      result.employer_id,
      result.final_rating,
      result.final_score,
      result.overall_confidence,
      result.project_data.rating,
      result.project_data.score,
      result.expertise_data.rating,
      result.expertise_data.score,
      result.eba_data.eba_status,
      result.calculation_date.toISOString(),
      result.review_required
    ];

    return [headers.join(','), row.join(',')].join('\n');
  }

  protected generateSummaryReport(result: FinalRatingResult): string {
    return `
Employer Rating Summary Report
=============================
Employer ID: ${result.employer_id}
Generated: ${new Date().toISOString()}

Overall Rating: ${result.final_rating.toUpperCase()}
Overall Score: ${result.final_score}
Confidence Level: ${result.overall_confidence}
Data Completeness: ${result.data_completeness}%

Component Ratings:
- Project Based: ${result.project_data.rating} (${result.project_data.score})
- Expertise Based: ${result.expertise_data.rating} (${result.expertise_data.score})
- EBA Status: ${result.eba_data.eba_status}

Review Required: ${result.review_required ? 'Yes' : 'No'}
Next Review Date: ${result.next_review_date?.toISOString() || 'Not set'}
    `.trim();
  }

  protected generateDetailedReport(result: FinalRatingResult): string {
    return JSON.stringify(result, null, 2);
  }

  protected generateAuditReport(result: FinalRatingResult): string {
    return `
Employer Rating Audit Report
============================
Employer ID: ${result.employer_id}
Audit Date: ${new Date().toISOString()}

Calculation Details:
- Method: ${result.calculation_method}
- Algorithm: ${result.algorithm_type}
- Weights: Project=${result.weights.project}, Expertise=${result.weights.expertise}, EBA=${result.weights.eba}
- Processing Time: ${result.performance.calculation_time_ms}ms

Component Analysis:
${this.generateComponentAnalysis(result.project_data, 'Project Data')}
${this.generateComponentAnalysis(result.expertise_data, 'Expertise Data')}
${this.generateComponentAnalysis(result.eba_data, 'EBA Data')}

Discrepancy Analysis:
- Discrepancy Detected: ${result.discrepancy_check.discrepancy_detected}
- Discrepancy Level: ${result.discrepancy_check.discrepancy_level}
- Score Difference: ${result.discrepancy_check.score_difference}
- Requires Review: ${result.discrepancy_check.requires_review}

Validation Issues:
${result.validation.errors.map(e => `- ${e.message}`).join('\n') || 'None'}
    `.trim();
  }

  protected generateComponentAnalysis(data: any, title: string): string {
    return `
${title}:
- Rating: ${data.rating || data.eba_status}
- Score: ${data.score || data.eba_score}
- Assessment Count: ${data.assessment_count || 'N/A'}
- Data Quality: ${data.data_quality || data.eba_status}
- Latest Assessment: ${data.latest_assessment_date || data.latest_eba_date || 'N/A'}
    `;
  }
}

// =============================================================================
// SUPPORTING INTERFACES
// =============================================================================

export interface ILogger {
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
  debug(message: string, data?: Record<string, any>): void;
}

export interface IPerformanceTracker {
  recordCalculation(processingTime: number, result: FinalRatingResult): Promise<void>;
  recordError(error: Error, processingTime: number): Promise<void>;
  getCurrentMetrics(): Promise<PerformanceProfile>;
}

export interface IValidator {
  validateCalculationRequest(request: RatingCalculationRequest): Promise<CalculationValidationResult>;
  validateConfiguration(config: CalculationConfig): Promise<void>;
}

export interface IDataSource {
  loadProjectAssessments(employerId: string, calculationDate: Date, lookbackDays: number): Promise<any[]>;
  loadExpertiseAssessments(employerId: string, calculationDate: Date, lookbackDays: number): Promise<any[]>;
  loadEBARecords(employerId: string): Promise<any[]>;
  loadOrganiserProfiles(organiserIds: string[]): Promise<any[]>;
}

export interface ITrack1Calculator {
  calculateRating(assessments: any[], context: CalculationContext): Promise<ProjectRatingResult>;
}

export interface ITrack2Calculator {
  calculateRating(assessments: any[], organiserProfiles: Record<string, any>, context: CalculationContext): Promise<ExpertiseRatingResult>;
}

export interface IEBACalculator {
  calculateRating(ebaRecords: any[], context: CalculationContext): Promise<EBARatingResult>;
}

export interface ICombinedCalculator {
  calculateFinalRating(
    projectResult: ProjectRatingResult,
    expertiseResult: ExpertiseRatingResult,
    ebaResult: EBARatingResult,
    context: CalculationContext
  ): Promise<FinalRatingResult>;
}

export interface RatingCalculatorDependencies {
  logger: ILogger;
  performanceTracker: IPerformanceTracker;
  validator: IValidator;
  dataSource: IDataSource;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiry_date: Date;
  key_hash: string;
  size_bytes: number;
  hit_count: number;
  last_accessed: Date;
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class RatingCalculationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'RatingCalculationError';
    this.code = code;
    this.details = details;
  }
}