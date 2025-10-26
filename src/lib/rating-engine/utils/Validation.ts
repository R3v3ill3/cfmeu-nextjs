// Comprehensive Validation and Error Handling Utilities for the Rating Calculation Engine

import {
  TrafficLightRating,
  ConfidenceLevel,
  ComplianceAssessmentType,
  RatingCalculationRequest,
  ValidationError,
  ValidationResult
} from '../types/RatingTypes';
import {
  CalculationInput,
  CalculationContext,
  CalculationConfig,
  DiscrepancyCheck,
  ValidationRule,
  ValidationSchema,
  ConfidenceLevel,
  RatingStatus
} from '../types/CalculationTypes';

// =============================================================================
// VALIDATION INTERFACES
// =============================================================================

export interface IValidator {
  validateCalculationRequest(request: RatingCalculationRequest): Promise<ValidationResult>;
  validateConfiguration(config: CalculationConfig): Promise<ValidationResult>;
  validateInputData(input: CalculationInput): Promise<ValidationResult>;
  validateCalculationContext(context: CalculationContext): Promise<ValidationResult>;
  validateDiscrepancyCheck(discrepancy: DiscrepancyCheck): Promise<ValidationResult>;
  sanitizeInput<T>(data: T, schema: ValidationSchema): T;
}

export interface IErrorHandler {
  handleValidationError(error: ValidationError): ErrorResponse;
  handleCalculationError(error: Error, context?: any): ErrorResponse;
  logError(error: Error, context: any, severity: 'low' | 'medium' | 'high' | 'critical'): void;
  createError(code: string, message: string, details?: any): ValidationError;
  recoverFromError(error: Error, fallback: any): any;
}

// =============================================================================
// VALIDATION IMPLEMENTATION
// =============================================================================

export class Validator implements IValidator {
  private schemas: Map<string, ValidationSchema>;
  private validationRules: Map<string, ValidationRule[]>;

  constructor() {
    this.schemas = new Map();
    this.validationRules = new Map();
    this.initializeSchemas();
    this.initializeRules();
  }

  // -------------------------------------------------------------------------
  // MAIN VALIDATION METHODS
  // -------------------------------------------------------------------------

  async validateCalculationRequest(request: RatingCalculationRequest): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Validate required fields
      if (!request.employer_id) {
        errors.push(this.createError('MISSING_EMPLOYER_ID', 'Employer ID is required'));
      }

      if (!this.isValidUUID(request.employer_id)) {
        errors.push(this.createError('INVALID_EMPLOYER_ID', 'Employer ID must be a valid UUID', { value: request.employer_id }));
      }

      // Validate optional fields
      if (request.calculation_date && !this.isValidDate(request.calculation_date)) {
        errors.push(this.createError('INVALID_CALCULATION_DATE', 'Invalid calculation date format', { value: request.calculation_date }));
      }

      if (request.calculation_date && new Date(request.calculation_date) > new Date()) {
        warnings.push(this.createError('FUTURE_CALCULATION_DATE', 'Calculation date is in the future', { value: request.calculation_date }));
      }

      // Validate weights
      if (request.project_weight !== undefined) {
        if (!this.isValidWeight(request.project_weight)) {
          errors.push(this.createError('INVALID_PROJECT_WEIGHT', 'Project weight must be between 0 and 1', { value: request.project_weight }));
        }
      }

      if (request.expertise_weight !== undefined) {
        if (!this.isValidWeight(request.expertise_weight)) {
          errors.push(this.createError('INVALID_EXPERTISE_WEIGHT', 'Expertise weight must be between 0 and 1', { value: request.expertise_weight }));
        }
      }

      if (request.eba_weight !== undefined) {
        if (!this.isValidWeight(request.eba_weight)) {
          errors.push(this.createError('INVALID_EBA_WEIGHT', 'EBA weight must be between 0 and 1', { value: request.eba_weight }));
        }
      }

      // Validate weight totals
      const totalWeight = (request.project_weight || 0.6) + (request.expertise_weight || 0.4) + (request.eba_weight || 0.15);
      if (totalWeight > 2) { // Allow some flexibility
        warnings.push(this.createError('HIGH_TOTAL_WEIGHT', 'Total weights exceed recommended maximum', { total_weight: totalWeight }));
      }

      // Validate custom adjustment
      if (request.custom_adjustment !== undefined) {
        if (!this.isValidAdjustment(request.custom_adjustment)) {
          errors.push(this.createError('INVALID_CUSTOM_ADJUSTMENT', 'Custom adjustment must be between -50 and 50', { value: request.custom_adjustment }));
        }
      }

      // Validate calculation method
      if (request.calculation_method && !this.isValidCalculationMethod(request.calculation_method)) {
        errors.push(this.createError('INVALID_CALCULATION_METHOD', 'Invalid calculation method', { value: request.calculation_method }));
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      throw new ValidationError('VALIDATION_ERROR', `Request validation failed: ${(error as Error).message}`, { request });
    }
  }

  async validateConfiguration(config: CalculationConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Validate score thresholds
      if (!config.score_thresholds) {
        errors.push(this.createError('MISSING_SCORE_THRESHOLDS', 'Score thresholds configuration is required'));
      } else {
        this.validateScoreThresholds(config.score_thresholds, errors);
      }

      // Validate confidence thresholds
      if (!config.confidence_thresholds) {
        errors.push(this.createError('MISSING_CONFIDENCE_THRESHOLDS', 'Confidence thresholds configuration is required'));
      } else {
        this.validateConfidenceThresholds(config.confidence_thresholds, errors);
      }

      // Validate assessment weights
      if (!config.assessment_weights) {
        errors.push(this.createError('MISSING_ASSESSMENT_WEIGHTS', 'Assessment weights configuration is required'));
      } else {
        this.validateAssessmentWeights(config.assessment_weights, errors, warnings);
      }

      // Validate decay settings
      if (config.decay_settings) {
        this.validateDecaySettings(config.decay_settings, errors, warnings);
      }

      // Validate quality requirements
      if (config.quality_requirements) {
        this.validateQualityRequirements(config.quality_requirements, errors);
      }

      // Validate discrepancy thresholds
      if (config.discrepancy_thresholds) {
        this.validateDiscrepancyThresholds(config.discrepancy_thresholds, errors);
      }

      // Validate performance settings
      if (config.performance) {
        this.validatePerformanceSettings(config.performance, warnings);
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      throw new ValidationError('CONFIG_VALIDATION_ERROR', `Configuration validation failed: ${(error as Error).message}`, { config });
    }
  }

  async validateInputData(input: CalculationInput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Validate basic structure
      if (!input.employer_id) {
        errors.push(this.createError('MISSING_EMPLOYER_ID', 'Employer ID is required in input data'));
      }

      if (!input.context) {
        errors.push(this.createError('MISSING_CONTEXT', 'Calculation context is required'));
      } else {
        const contextValidation = await this.validateCalculationContext(input.context);
        errors.push(...contextValidation.errors);
        warnings.push(...contextValidation.warnings);
      }

      // Validate project assessments
      if (input.project_assessments) {
        const projectValidation = this.validateProjectAssessments(input.project_assessments);
        errors.push(...projectValidation.errors);
        warnings.push(...projectValidation.warnings);
      }

      // Validate expertise assessments
      if (input.expertise_assessments) {
        const expertiseValidation = this.validateExpertiseAssessments(input.expertise_assessments);
        errors.push(...expertiseValidation.errors);
        warnings.push(...expertiseValidation.warnings);
      }

      // Validate EBA records
      if (input.eba_records) {
        const ebaValidation = this.validateEBARecords(input.eba_records);
        errors.push(...ebaValidation.errors);
        warnings.push(...ebaValidation.warnings);
      }

      // Validate organiser profiles
      if (input.organiser_profiles) {
        const profileValidation = this.validateOrganiserProfiles(input.organiser_profiles);
        errors.push(...profileValidation.errors);
        warnings.push(...profileValidation.warnings);
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      throw new ValidationError('INPUT_VALIDATION_ERROR', `Input data validation failed: ${(error as Error).message}`, { input });
    }
  }

  async validateCalculationContext(context: CalculationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!context.employer_id) {
      errors.push(this.createError('MISSING_EMPLOYER_ID', 'Employer ID is required in context'));
    }

    if (!context.calculation_date) {
      errors.push(this.createError('MISSING_CALCULATION_DATE', 'Calculation date is required in context'));
    } else if (!this.isValidDate(context.calculation_date)) {
      errors.push(this.createError('INVALID_CALCULATION_DATE', 'Invalid calculation date in context', { value: context.calculation_date }));
    }

    // Validate lookback days
    if (context.lookback_days) {
      if (context.lookback_days.project && context.lookback_days.project <= 0) {
        errors.push(this.createError('INVALID_PROJECT_LOOKBACK', 'Project lookback days must be positive', { value: context.lookback_days.project }));
      }

      if (context.lookback_days.expertise && context.lookback_days.expertise <= 0) {
        errors.push(this.createError('INVALID_EXPERTISE_LOOKBACK', 'Expertise lookback days must be positive', { value: context.lookback_days.expertise }));
      }

      if (context.lookback_days.eba && context.lookback_days.eba <= 0) {
        errors.push(this.createError('INVALID_EBA_LOOKBACK', 'EBA lookback days must be positive', { value: context.lookback_days.eba }));
      }
    }

    // Validate weights
    if (context.weights) {
      const totalWeight = context.weights.project + context.weights.expertise + context.weights.eba;
      if (totalWeight === 0) {
        errors.push(this.createError('ZERO_TOTAL_WEIGHT', 'Total weights cannot be zero'));
      } else if (totalWeight > 2.5) {
        warnings.push(this.createError('HIGH_TOTAL_WEIGHT', 'Total weights are unusually high', { total_weight: totalWeight }));
      }
    }

    // Validate calculation method
    if (context.method && !this.isValidCalculationMethod(context.method)) {
      errors.push(this.createError('INVALID_CALCULATION_METHOD', 'Invalid calculation method', { value: context.method }));
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateDiscrepancyCheck(discrepancy: DiscrepancyCheck): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (discrepancy.score_difference === undefined || discrepancy.score_difference === null) {
      errors.push(this.createError('MISSING_SCORE_DIFFERENCE', 'Score difference is required'));
    } else if (discrepancy.score_difference < 0) {
      errors.push(this.createError('INVALID_SCORE_DIFFERENCE', 'Score difference cannot be negative', { value: discrepancy.score_difference }));
    }

    if (discrepancy.discrepancy_level === undefined) {
      errors.push(this.createError('MISSING_DISCREPANCY_LEVEL', 'Discrepancy level is required'));
    } else if (!this.isValidDiscrepancyLevel(discrepancy.discrepancy_level)) {
      errors.push(this.createError('INVALID_DISCREPANCY_LEVEL', 'Invalid discrepancy level', { value: discrepancy.discrepancy_level }));
    }

    if (discrepancy.confidence_gap !== undefined && (discrepancy.confidence_gap < 0 || discrepancy.confidence_gap > 1)) {
      errors.push(this.createError('INVALID_CONFIDENCE_GAP', 'Confidence gap must be between 0 and 1', { value: discrepancy.confidence_gap }));
    }

    // Validate consistency
    if (discrepancy.score_difference > 50 && discrepancy.discrepancy_level === 'minor') {
      warnings.push(this.createError('INCONSISTENT_SEVERITY', 'Large score difference but minor discrepancy level', {
        score_difference: discrepancy.score_difference,
        discrepancy_level: discrepancy.discrepancy_level
      }));
    }

    if (discrepancy.score_difference < 10 && discrepancy.discrepancy_level === 'critical') {
      warnings.push(this.createError('INCONSISTENT_SEVERITY', 'Small score difference but critical discrepancy level', {
        score_difference: discrepancy.score_difference,
        discrepancy_level: discrepancy.discrepancy_level
      }));
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  sanitizeInput<T>(data: T, schema: ValidationSchema): T {
    const sanitized = { ...data };

    for (const [field, rule] of Object.entries(schema)) {
      const value = (sanitized as any)[field];

      if (value === undefined || value === null) {
        if (rule.required) {
          throw new ValidationError('SANITIZATION_ERROR', `Required field ${field} is missing`);
        }
        continue;
      }

      // Type-based sanitization
      if (rule.type) {
        (sanitized as any)[field] = this.sanitizeValue(value, rule);
      }

      // Custom sanitization
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult) {
          throw new ValidationError('SANITIZATION_ERROR', customResult, { field, value });
        }
      }

      // Length validation
      if (rule.type === 'string') {
        const stringValue = String(value);
        if (rule.maxLength && stringValue.length > rule.maxLength) {
          (sanitized as any)[field] = stringValue.substring(0, rule.maxLength);
        }
        if (rule.minLength && stringValue.length < rule.minLength) {
          throw new ValidationError('SANITIZATION_ERROR', `Field ${field} is too short`, { field, value });
        }
      }

      // Range validation
      if (rule.type === 'number') {
        const numberValue = Number(value);
        if (rule.min !== undefined && numberValue < rule.min) {
          (sanitized as any)[field] = rule.min;
        }
        if (rule.max !== undefined && numberValue > rule.max) {
          (sanitized as any)[field] = rule.max;
        }
      }
    }

    return sanitized;
  }

  // -------------------------------------------------------------------------
  // PRIVATE VALIDATION HELPERS
  // -------------------------------------------------------------------------

  private initializeSchemas(): void {
    // Calculation Request Schema
    this.schemas.set('calculation_request', {
      employer_id: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
      calculation_date: { required: false, type: 'date' },
      project_weight: { required: false, type: 'number', min: 0, max: 2 },
      expertise_weight: { required: false, type: 'number', min: 0, max: 2 },
      eba_weight: { required: false, type: 'number', min: 0, max: 2 },
      calculation_method: { required: false, type: 'string', enum: ['weighted_average', 'weighted_sum', 'minimum_score', 'hybrid_method'] },
      custom_adjustment: { required: false, type: 'number', min: -50, max: 50 },
      notes: { required: false, type: 'string', maxLength: 1000 }
    });

    // Assessment Schema
    this.schemas.set('assessment', {
      id: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
      assessment_type: { required: true, type: 'string', enum: ['cbus_status', 'incolink_status', 'site_visit_report', 'delegate_report', 'organiser_verbal_report', 'organiser_written_report', 'eca_status', 'safety_incidents', 'industrial_disputes', 'payment_issues'] },
      score: { required: false, type: 'number', min: -100, max: 100 },
      confidence_level: { required: true, type: 'string', enum: ['high', 'medium', 'low', 'very_low'] },
      assessment_date: { required: true, type: 'date' },
      assessment_notes: { required: false, type: 'string', maxLength: 5000 }
    });
  }

  private initializeRules(): void {
    // UUID validation rule
    this.validationRules.set('uuid', {
      validate: (value: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)),
      message: 'Invalid UUID format'
    });

    // Date validation rule
    this.validationRules.set('date', {
      validate: (value: any) => !isNaN(Date.parse(value)),
      message: 'Invalid date format'
    });

    // Email validation rule
    this.validationRules.set('email', {
      validate: (value: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
      message: 'Invalid email format'
    });

    // Weight validation rule
    this.validationRules.set('weight', {
      validate: (value: any) => {
        const num = Number(value);
        return !isNaN(num) && num >= 0 && num <= 2;
      },
      message: 'Weight must be between 0 and 2'
    });
  }

  private validateScoreThresholds(thresholds: any, errors: ValidationError[]): void {
    const requiredRatings: TrafficLightRating[] = ['green', 'amber', 'red', 'unknown'];

    for (const rating of requiredRatings) {
      if (!thresholds[rating]) {
        errors.push(this.createError('MISSING_RATING_THRESHOLD', `Missing threshold for rating: ${rating}`));
        continue;
      }

      const threshold = thresholds[rating];
      if (typeof threshold.min !== 'number' || typeof threshold.max !== 'number') {
        errors.push(this.createError('INVALID_THRESHOLD_FORMAT', `Threshold for ${rating} must have min and max numbers`));
      }

      if (threshold.min > threshold.max) {
        errors.push(this.createError('INVALID_THRESHOLD_RANGE', `Threshold min cannot be greater than max for ${rating}`));
      }

      if (threshold.min < -100 || threshold.max > 100) {
        errors.push(this.createError('THRESHOLD_OUT_OF_RANGE', `Threshold for ${rating} must be between -100 and 100`));
      }
    }

    // Check for overlapping thresholds
    const ranges = Object.values(thresholds).sort((a: any, b: any) => a.min - b.min);
    for (let i = 0; i < ranges.length - 1; i++) {
      const current = ranges[i] as any;
      const next = ranges[i + 1] as any;
      if (current.max > next.min) {
        errors.push(this.createError('OVERLAPPING_THRESHOLDS', 'Score thresholds cannot overlap'));
      }
    }
  }

  private validateConfidenceThresholds(thresholds: any, errors: ValidationError[]): void {
    const requiredLevels: ConfidenceLevel[] = ['high', 'medium', 'low', 'very_low'];

    for (const level of requiredLevels) {
      if (!thresholds[level]) {
        errors.push(this.createError('MISSING_CONFIDENCE_THRESHOLD', `Missing threshold for confidence level: ${level}`));
        continue;
      }

      const threshold = thresholds[level];
      if (typeof threshold.min !== 'number' || typeof threshold.max !== 'number') {
        errors.push(this.createError('INVALID_CONFIDENCE_FORMAT', `Confidence threshold for ${level} must have min and max numbers`));
      }

      if (threshold.min < 0 || threshold.max > 1) {
        errors.push(this.createError('CONFIDENCE_THRESHOLD_OUT_OF_RANGE', `Confidence threshold for ${level} must be between 0 and 1`));
      }

      if (threshold.min > threshold.max) {
        errors.push(this.createError('INVALID_CONFIDENCE_RANGE', `Confidence threshold min cannot be greater than max for ${level}`));
      }
    }
  }

  private validateAssessmentWeights(weights: any, errors: ValidationError[], warnings: ValidationError[]): void {
    let totalWeight = 0;

    for (const [assessmentType, weight] of Object.entries(weights)) {
      if (typeof weight !== 'number' || weight < 0 || weight > 10) {
        errors.push(this.createError('INVALID_ASSESSMENT_WEIGHT', `Invalid weight for assessment type: ${assessmentType}`, { value: weight }));
        continue;
      }

      if (weight === 0) {
        warnings.push(this.createError('ZERO_ASSESSMENT_WEIGHT', `Assessment type ${assessmentType} has zero weight`));
      }

      totalWeight += weight;
    }

    if (totalWeight === 0) {
      errors.push(this.createError('ZERO_TOTAL_ASSESSMENT_WEIGHT', 'Total assessment weights cannot be zero'));
    } else if (totalWeight > 50) {
      warnings.push(this.createError('HIGH_TOTAL_ASSESSMENT_WEIGHT', 'Total assessment weights are very high', { total_weight: totalWeight }));
    }
  }

  private validateDecaySettings(settings: any, errors: ValidationError[], warnings: ValidationError[]): void {
    if (settings.enabled !== undefined && typeof settings.enabled !== 'boolean') {
      errors.push(this.createError('INVALID_DECAY_ENABLED', 'Decay enabled setting must be boolean'));
    }

    if (settings.half_life_days !== undefined) {
      if (typeof settings.half_life_days !== 'number' || settings.half_life_days <= 0) {
        errors.push(this.createError('INVALID_HALF_LIFE', 'Half life days must be a positive number'));
      } else if (settings.half_life_days > 1095) { // 3 years
        warnings.push(this.createError('LONG_HALF_LIFE', 'Half life is very long, may result in slow decay'));
      }
    }

    if (settings.minimum_weight !== undefined) {
      if (typeof settings.minimum_weight !== 'number' || settings.minimum_weight < 0 || settings.minimum_weight > 1) {
        errors.push(this.createError('INVALID_MINIMUM_WEIGHT', 'Minimum weight must be between 0 and 1'));
      }
    }

    if (settings.maximum_weight !== undefined) {
      if (typeof settings.maximum_weight !== 'number' || settings.maximum_weight <= 0 || settings.maximum_weight > 10) {
        errors.push(this.createError('INVALID_MAXIMUM_WEIGHT', 'Maximum weight must be between 0 and 10'));
      }
    }

    if (settings.minimum_weight !== undefined && settings.maximum_weight !== undefined) {
      if (settings.minimum_weight >= settings.maximum_weight) {
        errors.push(this.createError('INVALID_WEIGHT_RANGE', 'Minimum weight must be less than maximum weight'));
      }
    }
  }

  private validateQualityRequirements(requirements: any, errors: ValidationError[]): void {
    if (requirements.minimum_assessments) {
      if (!requirements.minimum_assessments.project || requirements.minimum_assessments.project <= 0) {
        errors.push(this.createError('INVALID_MINIMUM_PROJECT_ASSESSMENTS', 'Minimum project assessments must be positive'));
      }

      if (!requirements.minimum_assessments.expertise || requirements.minimum_assessments.expertise <= 0) {
        errors.push(this.createError('INVALID_MINIMUM_EXPERTISE_ASSESSMENTS', 'Minimum expertise assessments must be positive'));
      }
    }

    if (requirements.maximum_data_age) {
      if (typeof requirements.maximum_data_age !== 'object') {
        errors.push(this.createError('INVALID_MAX_DATA_AGE_FORMAT', 'Maximum data age must be an object'));
      } else {
        if (requirements.maximum_data_age.high !== undefined && (requirements.maximum_data_age.high <= 0 || requirements.maximum_data_age.high > 365)) {
          errors.push(this.createError('INVALID_HIGH_MAX_AGE', 'High confidence max age must be between 1 and 365 days'));
        }

        if (requirements.maximum_data_age.medium !== undefined && (requirements.maximum_data_age.medium <= 0 || requirements.maximum_data_age.medium > 365)) {
          errors.push(this.createError('INVALID_MEDIUM_MAX_AGE', 'Medium confidence max age must be between 1 and 365 days'));
        }

        if (requirements.maximum_data_age.low !== undefined && (requirements.maximum_data_age.low <= 0 || requirements.maximum_data_age.low > 365)) {
          errors.push(this.createError('INVALID_LOW_MAX_AGE', 'Low confidence max age must be between 1 and 365 days'));
        }
      }
    }
  }

  private validateDiscrepancyThresholds(thresholds: any, errors: ValidationError[]): void {
    const requiredLevels = ['none', 'minor', 'moderate', 'major', 'critical'];

    for (const level of requiredLevels) {
      if (thresholds.score_difference && thresholds.score_difference[level] !== undefined) {
        if (typeof thresholds.score_difference[level] !== 'number' || thresholds.score_difference[level] < 0) {
          errors.push(this.createError('INVALID_SCORE_DIFFERENCE_THRESHOLD', `Score difference threshold for ${level} must be non-negative`));
        }
      }

      if (thresholds.rating_mismatch && thresholds.rating_mismatch[level] !== undefined) {
        if (typeof thresholds.rating_mismatch[level] !== 'number' || thresholds.rating_mismatch[level] < 0) {
          errors.push(this.createError('INVALID_RATING_MISMATCH_THRESHOLD', `Rating mismatch threshold for ${level} must be non-negative`));
        }
      }
    }
  }

  private validatePerformanceSettings(settings: any, warnings: ValidationError[]): void {
    if (settings.enable_caching !== undefined && typeof settings.enable_caching !== 'boolean') {
      // This would be an error, but for performance settings we'll just warn
      warnings.push(this.createError('INVALID_CACHE_SETTING', 'Enable caching setting should be boolean'));
    }

    if (settings.cache_ttl_seconds !== undefined) {
      if (typeof settings.cache_ttl_seconds !== 'number' || settings.cache_ttl_seconds <= 0) {
        warnings.push(this.createError('INVALID_CACHE_TTL', 'Cache TTL should be a positive number'));
      } else if (settings.cache_ttl_seconds > 3600) { // 1 hour
        warnings.push(this.createError('LONG_CACHE_TTL', 'Cache TTL is very long, may result in stale data'));
      }
    }

    if (settings.batch_size !== undefined) {
      if (typeof settings.batch_size !== 'number' || settings.batch_size <= 0) {
        warnings.push(this.createError('INVALID_BATCH_SIZE', 'Batch size must be a positive number'));
      } else if (settings.batch_size > 1000) {
        warnings.push(this.createError('LARGE_BATCH_SIZE', 'Batch size is very large, may impact performance'));
      }
    }
  }

  private validateProjectAssessments(assessments: any[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!Array.isArray(assessments)) {
      errors.push(this.createError('INVALID_PROJECT_ASSESSMENTS', 'Project assessments must be an array'));
      return { is_valid: false, errors, warnings };
    }

    for (let i = 0; i < assessments.length; i++) {
      const assessment = assessments[i];
      const assessmentErrors = this.validateAssessment(assessment, `project_assessment[${i}]`);
      errors.push(...assessmentErrors);
    }

    // Check for duplicate IDs
    const ids = assessments.map(a => a.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      warnings.push(this.createError('DUPLICATE_ASSESSMENT_IDS', 'Duplicate assessment IDs found in project assessments'));
    }

    return { is_valid: errors.length === 0, errors, warnings };
  }

  private validateExpertiseAssessments(assessments: any[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!Array.isArray(assessments)) {
      errors.push(this.createError('INVALID_EXPERTISE_ASSESSMENTS', 'Expertise assessments must be an array'));
      return { is_valid: false, errors, warnings };
    }

    for (let i = 0; i < assessments.length; i++) {
      const assessment = assessments[i];
      const assessmentErrors = this.validateAssessment(assessment, `expertise_assessment[${i}]`);
      errors.push(...assessmentErrors);

      // Additional expertise-specific validation
      if (!assessment.organiser_id) {
        errors.push(this.createError('MISSING_ORGANISER_ID', `Organiser ID is required for expertise assessment ${i}`, { assessment }));
      }

      if (!assessment.assessment_basis || (typeof assessment.assessment_basis === 'string' && assessment.assessment_basis.trim().length < 10)) {
        warnings.push(this.createError('WEAK_ASSESSMENT_BASIS', `Expertise assessment ${i} has weak or missing assessment basis`));
      }
    }

    return { is_valid: errors.length === 0, errors, warnings };
  }

  private validateEBARecords(records: any[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!Array.isArray(records)) {
      errors.push(this.createError('INVALID_EBA_RECORDS', 'EBA records must be an array'));
      return { is_valid: false, errors, warnings };
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      if (!record.id) {
        errors.push(this.createError('MISSING_EBA_ID', `EBA record ${i} is missing ID`));
      }

      if (record.fwc_certified_date && !this.isValidDate(record.fwc_certified_date)) {
        errors.push(this.createError('INVALID_EBA_DATE', `EBA record ${i} has invalid certified date`, { date: record.fwc_certified_date }));
      }

      if (record.fwc_certified_date) {
        const certifiedDate = new Date(record.fwc_certified_date);
        const now = new Date();
        if (certifiedDate > now) {
          warnings.push(this.createError('FUTURE_EBA_DATE', `EBA record ${i} has certified date in the future`));
        }
      }
    }

    return { is_valid: errors.length === 0, errors, warnings };
  }

  private validateOrganiserProfiles(profiles: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const [organiserId, profile] of Object.entries(profiles)) {
      if (!profile || typeof profile !== 'object') {
        errors.push(this.createError('INVALID_PROFILE_FORMAT', `Invalid profile format for organiser: ${organiserId}`));
        continue;
      }

      if (!profile.name || typeof profile.name !== 'string') {
        errors.push(this.createError('MISSING_PROFILE_NAME', `Profile missing name for organiser: ${organiserId}`));
      }

      if (profile.accuracy_percentage !== undefined) {
        if (typeof profile.accuracy_percentage !== 'number' || profile.accuracy_percentage < 0 || profile.accuracy_percentage > 100) {
          errors.push(this.createError('INVALID_ACCURACY_PERCENTAGE', `Invalid accuracy percentage for organiser: ${organiserId}`));
        }
      }

      if (profile.overall_reputation_score !== undefined) {
        if (typeof profile.overall_reputation_score !== 'number' || profile.overall_reputation_score < 0 || profile.overall_reputation_score > 100) {
          errors.push(this.createError('INVALID_REPUTATION_SCORE', `Invalid reputation score for organiser: ${organiserId}`));
        }
      }
    }

    return { is_valid: errors.length === 0, errors, warnings };
  }

  private validateAssessment(assessment: any, context: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const schema = this.schemas.get('assessment');
      if (schema) {
        for (const [field, rule] of Object.entries(schema)) {
          const value = assessment[field];

          if (rule.required && (value === undefined || value === null)) {
            errors.push(this.createError('MISSING_REQUIRED_FIELD', `Required field ${field} is missing in ${context}`, { field, context }));
            continue;
          }

          if (value !== undefined && value !== null) {
            // Type validation
            if (rule.type && !this.validateType(value, rule.type)) {
              errors.push(this.createError('INVALID_TYPE', `Field ${field} in ${context} must be of type ${rule.type}`, { field, value, expectedType: rule.type }));
            }

            // Enum validation
            if (rule.enum && !rule.enum.includes(value)) {
              errors.push(this.createError('INVALID_ENUM_VALUE', `Field ${field} in ${context} has invalid value`, { field, value, validValues: rule.enum }));
            }

            // Range validation
            if (rule.type === 'number') {
              if (rule.min !== undefined && value < rule.min) {
                errors.push(this.createError('VALUE_TOO_LOW', `Field ${field} in ${context} is below minimum`, { field, value, min: rule.min }));
              }
              if (rule.max !== undefined && value > rule.max) {
                errors.push(this.createError('VALUE_TOO_HIGH', `Field ${field} in ${context} is above maximum`, { field, value, max: rule.max }));
              }
            }

            // String validation
            if (rule.type === 'string') {
              if (rule.minLength && String(value).length < rule.minLength) {
                errors.push(this.createError('STRING_TOO_SHORT', `Field ${field} in ${context} is too short`, { field, value, minLength: rule.minLength }));
              }
              if (rule.maxLength && String(value).length > rule.maxLength) {
                errors.push(this.createError('STRING_TOO_LONG', `Field ${field} in ${context} is too long`, { field, value, maxLength: rule.maxLength }));
              }
              if (rule.pattern && !rule.pattern.test(String(value))) {
                errors.push(this.createError('INVALID_PATTERN', `Field ${field} in ${context} does not match required pattern`, { field, value }));
              }
            }
          }
        }
      }
    } catch (error) {
      errors.push(this.createError('VALIDATION_ERROR', `Error validating assessment in ${context}: ${(error as Error).message}`, { context }));
    }

    return errors;
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value)) || value instanceof Date;
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'uuid':
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      default:
        return true;
    }
  }

  private sanitizeValue(value: any, rule: ValidationRule): any {
    switch (rule.type) {
      case 'string':
        return String(value).trim();
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  // -------------------------------------------------------------------------
  // UTILITY VALIDATION METHODS
  // -------------------------------------------------------------------------

  private isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }

  private isValidDate(date: any): boolean {
    return !isNaN(Date.parse(date));
  }

  private isValidWeight(weight: number): boolean {
    return typeof weight === 'number' && weight >= 0 && weight <= 2;
  }

  private isValidAdjustment(adjustment: number): boolean {
    return typeof adjustment === 'number' && adjustment >= -50 && adjustment <= 50;
  }

  private isValidCalculationMethod(method: string): boolean {
    return ['weighted_average', 'weighted_sum', 'minimum_score', 'hybrid_method'].includes(method);
  }

  private isValidDiscrepancyLevel(level: string): boolean {
    return ['none', 'minor', 'moderate', 'major', 'critical'].includes(level);
  }

  private createError(code: string, message: string, details?: any): ValidationError {
    return {
      code,
      message,
      value: details?.value,
      constraint: details?.constraint,
      field: details?.field
    };
  }
}

// =============================================================================
// ERROR HANDLER IMPLEMENTATION
// =============================================================================

export class ErrorHandler implements IErrorHandler {
  private errorLog: Array<{ error: Error; context: any; severity: string; timestamp: Date }> = [];

  handleValidationError(error: ValidationError): ErrorResponse {
    this.logError(error, { type: 'validation' }, 'medium');

    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error,
        type: 'validation_error',
        timestamp: new Date()
      },
      suggestions: this.generateErrorSuggestions(error)
    };
  }

  handleCalculationError(error: Error, context?: any): ErrorResponse {
    this.logError(error, context || {}, 'high');

    return {
      success: false,
      error: {
        code: (error as any).code || 'CALCULATION_ERROR',
        message: error.message,
        details: context,
        type: 'calculation_error',
        timestamp: new Date(),
        stack: error.stack
      },
      suggestions: this.generateCalculationErrorSuggestions(error, context)
    };
  }

  logError(error: Error, context: any, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const logEntry = {
      error,
      context,
      severity,
      timestamp: new Date()
    };

    this.errorLog.push(logEntry);

    // Keep only last 1000 errors
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${error.message}`, {
        context,
        stack: error.stack
      });
    }
  }

  createError(code: string, message: string, details?: any): ValidationError {
    return {
      code,
      message,
      value: details?.value,
      constraint: details?.constraint,
      field: details?.field
    };
  }

  recoverFromError(error: Error, fallback: any): any {
    this.logError(error, { fallback_provided: true }, 'medium');

    // In a real implementation, this might trigger alternative calculation paths
    return {
      ...fallback,
      error_recovery_applied: true,
      original_error: {
        message: error.message,
        code: (error as any).code
      },
      recovery_timestamp: new Date()
    };
  }

  private generateErrorSuggestions(error: ValidationError): string[] {
    const suggestions: string[] = [];

    switch (error.code) {
      case 'MISSING_EMPLOYER_ID':
        suggestions.push('Provide a valid employer ID');
        suggestions.push('Check if employer exists in the system');
        break;

      case 'INVALID_EMPLOYER_ID':
        suggestions.push('Ensure employer ID is in valid UUID format');
        suggestions.push('Example: 123e4567-e89b-12d3-a456-426614174000');
        break;

      case 'INVALID_PROJECT_WEIGHT':
      case 'INVALID_EXPERTISE_WEIGHT':
      case 'INVALID_EBA_WEIGHT':
        suggestions.push('Weight must be a number between 0 and 2');
        suggestions.push('Consider using default weights: project=0.6, expertise=0.4, eba=0.15');
        break;

      case 'MISSING_REQUIRED_FIELD':
        suggestions.push(`Provide the required field: ${error.field}`);
        suggestions.push('Check the API documentation for required fields');
        break;

      case 'INVALID_TYPE':
        suggestions.push(`Ensure field ${error.field} is of type ${error.details?.expectedType}`);
        break;

      default:
        suggestions.push('Check the error details for specific guidance');
        suggestions.push('Contact support if the issue persists');
    }

    return suggestions;
  }

  private generateCalculationErrorSuggestions(error: Error, context?: any): string[] {
    const suggestions: string[] = [];

    const errorCode = (error as any).code;

    if (errorCode?.includes('VALIDATION')) {
      suggestions.push('Check input data for missing or invalid fields');
      suggestions.push('Run validation on the request before calculation');
    } else if (errorCode?.includes('DATA')) {
      suggestions.push('Verify data source is available and accessible');
      suggestions.push('Check database connections and permissions');
    } else if (errorCode?.includes('CONFIGURATION')) {
      suggestions.push('Validate rating calculation configuration');
      suggestions.push('Ensure all required configuration values are set');
    } else {
      suggestions.push('Check calculation parameters and input data');
      suggestions.push('Review error details for specific guidance');
      suggestions.push('Try again with different parameters');
    }

    if (context?.employer_id) {
      suggestions.push(`Verify employer ${context.employer_id} exists and has required data`);
    }

    return suggestions;
  }

  getErrorLog(): Array<{ error: Error; context: any; severity: string; timestamp: Date }> {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    type: string;
    timestamp: Date;
    stack?: string;
  };
  suggestions: string[];
}

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class ValidationError extends Error {
  public readonly code: string;
  public readonly field?: string;
  public readonly value?: any;
  public readonly constraint?: string;

  constructor(code: string, message: string, details?: { field?: string; value?: any; constraint?: string }) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = details?.field;
    this.value = details?.value;
    this.constraint = details?.constraint;
  }
}