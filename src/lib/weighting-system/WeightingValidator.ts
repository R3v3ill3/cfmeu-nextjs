// CFMEU Employer Rating System - Weighting Validation Module
// Comprehensive validation logic for weighting configurations

import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  WeightingValidationResult,
  WeightingValidationError,
  WeightingValidationWarning,
  WeightingValidationState,
  UpdateWeightingProfileRequest,
  UpdateTrack1WeightingsRequest,
  UpdateTrack2WeightingsRequest,
  WeightingFieldPath,
  WeightingImpactLevel
} from './types/WeightingTypes';

// =============================================================================
// VALIDATION CONFIGURATION
// =============================================================================

interface ValidationRule {
  field: string;
  required: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  dependsOn?: string[];
  customValidator?: (value: any, context: ValidationContext) => ValidationError | null;
}

interface ValidationContext {
  profile?: UserWeightingProfile;
  track1Weightings?: Track1Weightings;
  track2Weightings?: Track2Weightings;
  userRole?: string;
  employerCategory?: string;
}

interface ValidationError {
  field: string;
  message: string;
  current_value: any;
  expected_value?: any;
  severity: 'error' | 'warning';
  category: 'sum_validation' | 'range_validation' | 'logic_validation' | 'business_rule';
}

interface BusinessRule {
  name: string;
  description: string;
  validator: (context: ValidationContext) => ValidationError[];
}

// =============================================================================
// MAIN VALIDATOR CLASS
// =============================================================================

export class WeightingValidator {
  private static readonly PRECISION_TOLERANCE = 0.01;
  private static readonly WEIGHTING_PRECISION = 3;

  // Define validation rules for profile fields
  private static readonly PROFILE_VALIDATION_RULES: ValidationRule[] = [
    {
      field: 'profile_name',
      required: true,
      pattern: /^.{1,100}$/,
      customValidator: (value: string) => {
        if (!value || value.trim().length === 0) {
          return {
            field: 'profile_name',
            message: 'Profile name is required',
            current_value: value,
            severity: 'error',
            category: 'range_validation'
          };
        }
        if (value.length > 100) {
          return {
            field: 'profile_name',
            message: 'Profile name must be 100 characters or less',
            current_value: value,
            expected_value: 'max 100 characters',
            severity: 'error',
            category: 'range_validation'
          };
        }
        return null;
      }
    },
    {
      field: 'project_data_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: (value: number, context) => {
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: 'project_data_weight',
            message: 'Project data weight must be a valid number',
            current_value: value,
            severity: 'error',
            category: 'range_validation'
          };
        }
        if (value < 0 || value > 1) {
          return {
            field: 'project_data_weight',
            message: 'Project data weight must be between 0 and 1',
            current_value: value,
            expected_value: '0-1',
            severity: 'error',
            category: 'range_validation'
          };
        }
        return null;
      }
    },
    {
      field: 'organiser_expertise_weight',
      required: true,
      min: 0,
      max: 1,
      dependsOn: ['project_data_weight'],
      customValidator: (value: number, context) => {
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: 'organiser_expertise_weight',
            message: 'Organiser expertise weight must be a valid number',
            current_value: value,
            severity: 'error',
            category: 'range_validation'
          };
        }
        if (value < 0 || value > 1) {
          return {
            field: 'organiser_expertise_weight',
            message: 'Organiser expertise weight must be between 0 and 1',
            current_value: value,
            expected_value: '0-1',
            severity: 'error',
            category: 'range_validation'
          };
        }

        // Check balance with project data weight
        const projectWeight = context.profile?.project_data_weight;
        if (projectWeight !== undefined) {
          const sum = projectWeight + value;
          if (Math.abs(sum - 1.0) > this.PRECISION_TOLERANCE) {
            return {
              field: 'organiser_expertise_weight',
              message: `Project data and organiser expertise weights must sum to 1.0. Current sum: ${sum.toFixed(3)}`,
              current_value: value,
              expected_value: `${(1.0 - projectWeight).toFixed(3)}`,
              severity: 'error',
              category: 'sum_validation'
            };
          }
        }
        return null;
      }
    }
  ];

  // Define validation rules for Track 1 weightings
  private static readonly TRACK1_VALIDATION_RULES: ValidationRule[] = [
    // CBUS compliance weights
    {
      field: 'cbus_paying_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('CBUS paying compliance')
    },
    {
      field: 'cbus_on_time_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('CBUS on-time payments')
    },
    {
      field: 'cbus_all_workers_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('CBUS all workers coverage')
    },

    // Incolink compliance weights
    {
      field: 'incolink_entitlements_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Incolink entitlements compliance')
    },
    {
      field: 'incolink_on_time_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Incolink on-time payments')
    },
    {
      field: 'incolink_all_workers_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Incolink all workers coverage')
    },

    // Union relations weights
    {
      field: 'union_relations_right_of_entry_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Union right of entry')
    },
    {
      field: 'union_relations_delegate_accommodation_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Union delegate accommodation')
    },
    {
      field: 'union_relations_access_to_info_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Union access to information')
    },
    {
      field: 'union_relations_access_to_inductions_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Union access to inductions')
    },

    // Safety performance weights
    {
      field: 'safety_hsr_respect_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Safety HSR respect')
    },
    {
      field: 'safety_general_standards_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Safety general standards')
    },
    {
      field: 'safety_incidents_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Safety incidents')
    },

    // Subcontractor management weights
    {
      field: 'subcontractor_usage_levels_weight',
      required: true,
      min: 0,
      max: 1,
      dependsOn: ['subcontractor_practices_weight'],
      customValidator: (value: number, context) => {
        const error = this.createWeightingValidator('Subcontractor usage levels')(value, context);
        if (error) return error;

        const practicesWeight = context.track1Weightings?.subcontractor_practices_weight;
        if (practicesWeight !== undefined) {
          const sum = value + practicesWeight;
          if (Math.abs(sum - 1.0) > this.PRECISION_TOLERANCE) {
            return {
              field: 'subcontractor_usage_levels_weight',
              message: `Subcontractor weights must sum to 1.0. Current sum: ${sum.toFixed(3)}`,
              current_value: value,
              expected_value: `${(1.0 - practicesWeight).toFixed(3)}`,
              severity: 'error',
              category: 'sum_validation'
            };
          }
        }
        return null;
      }
    },
    {
      field: 'subcontractor_practices_weight',
      required: true,
      min: 0,
      max: 1,
      dependsOn: ['subcontractor_usage_levels_weight'],
      customValidator: (value: number, context) => {
        const error = this.createWeightingValidator('Subcontractor management practices')(value, context);
        if (error) return error;

        const usageWeight = context.track1Weightings?.subcontractor_usage_levels_weight;
        if (usageWeight !== undefined) {
          const sum = value + usageWeight;
          if (Math.abs(sum - 1.0) > this.PRECISION_TOLERANCE) {
            return {
              field: 'subcontractor_practices_weight',
              message: `Subcontractor weights must sum to 1.0. Current sum: ${sum.toFixed(3)}`,
              current_value: value,
              expected_value: `${(1.0 - usageWeight).toFixed(3)}`,
              severity: 'error',
              category: 'sum_validation'
            };
          }
        }
        return null;
      }
    }
  ];

  // Define validation rules for Track 2 weightings
  private static readonly TRACK2_VALIDATION_RULES: ValidationRule[] = [
    {
      field: 'cbus_overall_assessment_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('CBUS overall assessment')
    },
    {
      field: 'incolink_overall_assessment_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Incolink overall assessment')
    },
    {
      field: 'union_relations_overall_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Union relations overall assessment')
    },
    {
      field: 'safety_culture_overall_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Safety culture overall assessment')
    },
    {
      field: 'historical_relationship_quality_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('Historical relationship quality')
    },
    {
      field: 'eba_status_weight',
      required: true,
      min: 0,
      max: 1,
      customValidator: this.createWeightingValidator('EBA status')
    },
    {
      field: 'organiser_confidence_multiplier',
      required: true,
      min: 0.5,
      max: 2.0,
      customValidator: (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: 'organiser_confidence_multiplier',
            message: 'Organiser confidence multiplier must be a valid number',
            current_value: value,
            severity: 'error',
            category: 'range_validation'
          };
        }
        if (value < 0.5 || value > 2.0) {
          return {
            field: 'organiser_confidence_multiplier',
            message: 'Organiser confidence multiplier must be between 0.5 and 2.0',
            current_value: value,
            expected_value: '0.5-2.0',
            severity: 'error',
            category: 'range_validation'
          };
        }
        return null;
      }
    }
  ];

  // Business rules for weighting validation
  private static readonly BUSINESS_RULES: BusinessRule[] = [
    {
      name: 'balance_check',
      description: 'Ensure balanced weightings within reasonable ranges',
      validator: (context: ValidationContext) => {
        const errors: ValidationError[] = [];

        if (context.profile && context.track1Weightings) {
          // Check for extreme imbalances
          const maxTrack1Weight = Math.max(
            context.track1Weightings.cbus_paying_weight,
            context.track1Weightings.incolink_entitlements_weight,
            context.track1Weightings.union_relations_right_of_entry_weight,
            context.track1Weightings.safety_hsr_respect_weight
          );

          if (maxTrack1Weight > 0.4) {
            errors.push({
              field: 'track1_balance',
              message: `Individual weightings are extremely high (max: ${maxTrack1Weight.toFixed(3)}). Consider more balanced distribution.`,
              current_value: maxTrack1Weight,
              expected_value: '< 0.4',
              severity: 'warning',
              category: 'business_rule'
            });
          }
        }

        return errors;
      }
    },
    {
      name: 'role_appropriateness',
      description: 'Validate weightings are appropriate for user role',
      validator: (context: ValidationContext) => {
        const errors: ValidationError[] = [];

        if (context.profile && context.userRole) {
          const { project_data_weight, organiser_expertise_weight } = context.profile;

          // Role-specific recommendations
          switch (context.userRole) {
            case 'lead_organiser':
              if (organiser_expertise_weight < 0.3) {
                errors.push({
                  field: 'role_appropriateness',
                  message: 'Lead organisers typically benefit from higher organiser expertise weighting',
                  current_value: organiser_expertise_weight,
                  expected_value: '≥ 0.3',
                  severity: 'warning',
                  category: 'business_rule'
                });
              }
              break;

            case 'admin':
              if (project_data_weight < 0.6) {
                errors.push({
                  field: 'role_appropriateness',
                  message: 'Admin users typically prioritize objective project data',
                  current_value: project_data_weight,
                  expected_value: '≥ 0.6',
                  severity: 'warning',
                  category: 'business_rule'
                });
              }
              break;
          }
        }

        return errors;
      }
    },
    {
      name: 'data_feasibility',
      description: 'Check if weightings are feasible given typical data availability',
      validator: (context: ValidationContext) => {
        const errors: ValidationError[] = [];

        if (context.track1Weightings) {
          // Check for heavy reliance on less common data points
          const inductionWeight = context.track1Weightings.union_relations_access_to_inductions_weight;
          if (inductionWeight > 0.2) {
            errors.push({
              field: 'data_feasibility',
              message: 'High weighting on union access to inductions may be limited by data availability',
              current_value: inductionWeight,
              expected_value: '< 0.2',
              severity: 'warning',
              category: 'business_rule'
            });
          }
        }

        return errors;
      }
    }
  ];

  // =============================================================================
  // PUBLIC VALIDATION METHODS
  // =============================================================================

  /**
   * Validate a complete weighting configuration
   */
  static validateCompleteConfiguration(
    profile: UserWeightingProfile,
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings,
    userRole?: string
  ): WeightingValidationResult {
    const errors: WeightingValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    const context: ValidationContext = {
      profile,
      track1Weightings,
      track2Weightings,
      userRole,
      employerCategory: profile.employer_category_focus
    };

    // Validate profile
    const profileValidation = this.validateProfile(profile, context);
    errors.push(...profileValidation.errors);
    warnings.push(...profileValidation.warnings);

    // Validate Track 1 weightings
    const track1Validation = this.validateTrack1Weightings(track1Weightings, context);
    errors.push(...track1Validation.errors);
    warnings.push(...track1Validation.warnings);

    // Validate Track 2 weightings
    const track2Validation = this.validateTrack2Weightings(track2Weightings, context);
    errors.push(...track2Validation.errors);
    warnings.push(...track2Validation.warnings);

    // Apply business rules
    for (const rule of this.BUSINESS_RULES) {
      const ruleErrors = rule.validator(context);
      for (const error of ruleErrors) {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push({
            field: error.field,
            message: error.message,
            current_value: error.current_value,
            recommendation: this.getRecommendationForField(error.field),
            impact_description: this.getImpactDescription(error.field)
          });
        }
      }
    }

    // Calculate summary
    const summary = this.calculateValidationSummary(profile, track1Weightings, track2Weightings);

    // Determine validation state
    const validationState: WeightingValidationState = errors.length > 0
      ? 'invalid'
      : warnings.length > 0
      ? 'warning'
      : 'valid';

    return {
      is_valid: errors.length === 0,
      validation_state: validationState,
      errors,
      warnings,
      summary
    };
  }

  /**
   * Validate profile update request
   */
  static validateProfileUpdate(
    currentProfile: UserWeightingProfile,
    updateRequest: UpdateWeightingProfileRequest
  ): { isValid: boolean; errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Create temporary profile with updates applied
    const updatedProfile: UserWeightingProfile = {
      ...currentProfile,
      ...updateRequest
    };

    // Validate the updated profile
    const context: ValidationContext = {
      profile: updatedProfile,
      userRole: updatedProfile.user_role,
      employerCategory: updatedProfile.employer_category_focus
    };

    // Check main weightings balance
    if (updateRequest.project_data_weight !== undefined || updateRequest.organiser_expertise_weight !== undefined) {
      const projectWeight = updateRequest.project_data_weight ?? currentProfile.project_data_weight;
      const expertiseWeight = updateRequest.organiser_expertise_weight ?? currentProfile.organiser_expertise_weight;
      const sum = projectWeight + expertiseWeight;

      if (Math.abs(sum - 1.0) > this.PRECISION_TOLERANCE) {
        errors.push({
          field: 'main_weightings',
          message: `Weights must sum to 1.0. Current sum: ${sum.toFixed(3)}`,
          current_value: sum,
          expected_value: 1.0,
          severity: 'error',
          category: 'sum_validation'
        });
      }
    }

    // Validate individual fields
    for (const rule of this.PROFILE_VALIDATION_RULES) {
      if (updateRequest.hasOwnProperty(rule.field)) {
        const value = (updateRequest as any)[rule.field];
        const error = rule.customValidator ? rule.customValidator(value, context) : null;
        if (error) {
          errors.push(error);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Track 1 weightings update request
   */
  static validateTrack1Update(
    currentWeightings: Track1Weightings,
    updateRequest: UpdateTrack1WeightingsRequest
  ): { isValid: boolean; errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Create temporary weightings with updates applied
    const updatedWeightings: Track1Weightings = {
      ...currentWeightings,
      ...updateRequest
    };

    const context: ValidationContext = {
      track1Weightings: updatedWeightings
    };

    // Validate subcontractor weightings sum
    const subcontractorFields = ['subcontractor_usage_levels_weight', 'subcontractor_practices_weight'];
    const hasSubcontractorUpdate = subcontractorFields.some(field => updateRequest.hasOwnProperty(field));

    if (hasSubcontractorUpdate) {
      const usageWeight = updatedWeightings.subcontractor_usage_levels_weight;
      const practicesWeight = updatedWeightings.subcontractor_practices_weight;
      const sum = usageWeight + practicesWeight;

      if (Math.abs(sum - 1.0) > this.PRECISION_TOLERANCE) {
        errors.push({
          field: 'subcontractor_weights',
          message: `Subcontractor weights must sum to 1.0. Current sum: ${sum.toFixed(3)}`,
          current_value: sum,
          expected_value: 1.0,
          severity: 'error',
          category: 'sum_validation'
        });
      }
    }

    // Validate individual fields
    for (const rule of this.TRACK1_VALIDATION_RULES) {
      if (updateRequest.hasOwnProperty(rule.field)) {
        const value = (updateRequest as any)[rule.field];
        const error = rule.customValidator ? rule.customValidator(value, context) : null;
        if (error) {
          errors.push(error);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Track 2 weightings update request
   */
  static validateTrack2Update(
    currentWeightings: Track2Weightings,
    updateRequest: UpdateTrack2WeightingsRequest
  ): { isValid: boolean; errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Create temporary weightings with updates applied
    const updatedWeightings: Track2Weightings = {
      ...currentWeightings,
      ...updateRequest
    };

    const context: ValidationContext = {
      track2Weightings: updatedWeightings
    };

    // Validate individual fields
    for (const rule of this.TRACK2_VALIDATION_RULES) {
      if (updateRequest.hasOwnProperty(rule.field)) {
        const value = (updateRequest as any)[rule.field];
        const error = rule.customValidator ? rule.customValidator(value, context) : null;
        if (error) {
          errors.push(error);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Quick validation for real-time preview
   */
  static validateForPreview(
    updates: {
      profile?: Partial<UpdateWeightingProfileRequest>;
      track1?: Partial<UpdateTrack1WeightingsRequest>;
      track2?: Partial<UpdateTrack2WeightingsRequest>;
    }
  ): { isValid: boolean; criticalErrors: string[]; warnings: string[] } {
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    // Quick checks for critical errors
    if (updates.profile) {
      const { project_data_weight, organiser_expertise_weight } = updates.profile;

      if (project_data_weight !== undefined && (project_data_weight < 0 || project_data_weight > 1)) {
        criticalErrors.push('Project data weight must be between 0 and 1');
      }

      if (organiser_expertise_weight !== undefined && (organiser_expertise_weight < 0 || organiser_expertise_weight > 1)) {
        criticalErrors.push('Organiser expertise weight must be between 0 and 1');
      }
    }

    // Check track1 updates for negative values
    if (updates.track1) {
      for (const [key, value] of Object.entries(updates.track1)) {
        if (typeof value === 'number' && (value < 0 || value > 1)) {
          criticalErrors.push(`${key} must be between 0 and 1`);
        }
      }
    }

    // Check track2 updates for invalid ranges
    if (updates.track2) {
      for (const [key, value] of Object.entries(updates.track2)) {
        if (key === 'organiser_confidence_multiplier') {
          if (typeof value === 'number' && (value < 0.5 || value > 2.0)) {
            criticalErrors.push('Organiser confidence multiplier must be between 0.5 and 2.0');
          }
        } else if (typeof value === 'number' && (value < 0 || value > 1)) {
          criticalErrors.push(`${key} must be between 0 and 1`);
        }
      }
    }

    return {
      isValid: criticalErrors.length === 0,
      criticalErrors,
      warnings
    };
  }

  // =============================================================================
  // PRIVATE VALIDATION HELPERS
  // =============================================================================

  /**
   * Validate profile fields
   */
  private static validateProfile(
    profile: UserWeightingProfile,
    context: ValidationContext
  ): { errors: ValidationError[]; warnings: WeightingValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    for (const rule of this.PROFILE_VALIDATION_RULES) {
      const value = (profile as any)[rule.field];
      const error = rule.customValidator ? rule.customValidator(value, context) : null;
      if (error) {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push({
            field: error.field,
            message: error.message,
            current_value: error.current_value,
            recommendation: this.getRecommendationForField(error.field),
            impact_description: this.getImpactDescription(error.field)
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate Track 1 weightings
   */
  private static validateTrack1Weightings(
    weightings: Track1Weightings,
    context: ValidationContext
  ): { errors: ValidationError[]; warnings: WeightingValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    for (const rule of this.TRACK1_VALIDATION_RULES) {
      const value = (weightings as any)[rule.field];
      const error = rule.customValidator ? rule.customValidator(value, context) : null;
      if (error) {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push({
            field: error.field,
            message: error.message,
            current_value: error.current_value,
            recommendation: this.getRecommendationForField(error.field),
            impact_description: this.getImpactDescription(error.field)
          });
        }
      }
    }

    // Validate builder weightings sum
    const builderSum = this.calculateBuilderWeightSum(weightings);
    if (Math.abs(builderSum - 1.0) > this.PRECISION_TOLERANCE && builderSum > 0) {
      warnings.push({
        field: 'builder_weights',
        message: `Builder-specific weights ideally sum to 1.0. Current sum: ${builderSum.toFixed(3)}`,
        current_value: builderSum,
        recommendation: 'Consider adjusting builder weights to sum to 1.0 for consistent scoring',
        impact_description: 'May affect relative importance of builder-specific factors'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate Track 2 weightings
   */
  private static validateTrack2Weightings(
    weightings: Track2Weightings,
    context: ValidationContext
  ): { errors: ValidationError[]; warnings: WeightingValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: WeightingValidationWarning[] = [];

    for (const rule of this.TRACK2_VALIDATION_RULES) {
      const value = (weightings as any)[rule.field];
      const error = rule.customValidator ? rule.customValidator(value, context) : null;
      if (error) {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push({
            field: error.field,
            message: error.message,
            current_value: error.current_value,
            recommendation: this.getRecommendationForField(error.field),
            impact_description: this.getImpactDescription(error.field)
          });
        }
      }
    }

    // Check for extreme confidence multiplier
    if (Math.abs(weightings.organiser_confidence_multiplier - 1.0) > 0.5) {
      warnings.push({
        field: 'organiser_confidence_multiplier',
        message: `Organiser confidence multiplier is significantly different from default: ${weightings.organiser_confidence_multiplier.toFixed(2)}`,
        current_value: weightings.organiser_confidence_multiplier,
        recommendation: 'Consider if this level of confidence adjustment is appropriate',
        impact_description: 'Will significantly scale the impact of organiser expertise on final ratings'
      });
    }

    return { errors, warnings };
  }

  /**
   * Create weighting validator function
   */
  private static createWeightingValidator(description: string) {
    return (value: number, context?: ValidationContext): ValidationError | null => {
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          field: 'weighting',
          message: `${description} weight must be a valid number`,
          current_value: value,
          severity: 'error',
          category: 'range_validation'
        };
      }
      if (value < 0 || value > 1) {
        return {
          field: 'weighting',
          message: `${description} weight must be between 0 and 1`,
          current_value: value,
          expected_value: '0-1',
          severity: 'error',
          category: 'range_validation'
        };
      }
      return null;
    };
  }

  /**
   * Calculate builder weight sum
   */
  private static calculateBuilderWeightSum(weightings: Track1Weightings): number {
    return (
      weightings.builder_tender_consultation_weight +
      weightings.builder_communication_weight +
      weightings.builder_delegate_facilities_weight +
      weightings.builder_contractor_compliance_weight +
      weightings.builder_eba_contractor_percentage_weight
    );
  }

  /**
   * Calculate validation summary
   */
  private static calculateValidationSummary(
    profile: UserWeightingProfile,
    track1Weightings: Track1Weightings,
    track2Weightings: Track2Weightings
  ) {
    const mainSum = profile.project_data_weight + profile.organiser_expertise_weight;
    const track1Sum = this.calculateTrack1Sum(track1Weightings);
    const track2Sum = this.calculateTrack2Sum(track2Weightings);

    return {
      total_weight_sum: mainSum,
      track1_weight_sum: track1Sum,
      track2_weight_sum: track2Sum,
      balance_ratio: profile.organiser_expertise_weight > 0 ? profile.project_data_weight / profile.organiser_expertise_weight : Infinity
    };
  }

  /**
   * Calculate Track 1 weight sum
   */
  private static calculateTrack1Sum(weightings: Track1Weightings): number {
    return (
      weightings.cbus_paying_weight + weightings.cbus_on_time_weight + weightings.cbus_all_workers_weight +
      weightings.incolink_entitlements_weight + weightings.incolink_on_time_weight + weightings.incolink_all_workers_weight +
      weightings.union_relations_right_of_entry_weight + weightings.union_relations_delegate_accommodation_weight +
      weightings.union_relations_access_to_info_weight + weightings.union_relations_access_to_inductions_weight +
      weightings.safety_hsr_respect_weight + weightings.safety_general_standards_weight + weightings.safety_incidents_weight +
      weightings.subcontractor_usage_levels_weight + weightings.subcontractor_practices_weight
    );
  }

  /**
   * Calculate Track 2 weight sum
   */
  private static calculateTrack2Sum(weightings: Track2Weightings): number {
    return (
      weightings.cbus_overall_assessment_weight + weightings.incolink_overall_assessment_weight +
      weightings.union_relations_overall_weight + weightings.safety_culture_overall_weight +
      weightings.historical_relationship_quality_weight + weightings.eba_status_weight
    );
  }

  /**
   * Get recommendation for field
   */
  private static getRecommendationForField(field: string): string {
    const recommendations: Record<string, string> = {
      'project_data_weight': 'Consider the balance between objective data and expert judgement',
      'organiser_expertise_weight': 'Higher values emphasize organiser knowledge and relationships',
      'organiser_confidence_multiplier': 'Values > 1.0 increase organiser impact, < 1.0 decrease it',
      'subcontractor_weights': 'Ensure subcontractor factors reflect your project context',
      'builder_weights': 'Builder weights apply only to builder employers',
      'role_appropriateness': 'Consider your role and typical decision-making patterns',
      'data_feasibility': 'Consider data availability in your region/sector'
    };

    return recommendations[field] || 'Review this weighting for appropriateness';
  }

  /**
   * Get impact description for field
   */
  private static getImpactDescription(field: string): string {
    const impacts: Record<string, string> = {
      'project_data_weight': 'Affects relative importance of compliance data vs expert opinion',
      'organiser_expertise_weight': 'Changes how much organiser knowledge influences final ratings',
      'organiser_confidence_multiplier': 'Scales the impact of all organiser expertise assessments',
      'subcontractor_weights': 'Changes how subcontractor management affects overall ratings',
      'builder_weights': 'Modifies importance of builder-specific factors for builders',
      'role_appropriateness': 'May affect effectiveness of ratings for your decision-making',
      'data_feasibility': 'May result in ratings based on limited data availability'
    };

    return impacts[field] || 'Will affect the calculation of employer ratings';
  }
}