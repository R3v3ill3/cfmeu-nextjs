-- CFMEU Employer Rating System - Weighting Configuration Schema
-- Migration: Create comprehensive weighting system tables
-- Created: 2025-10-26
-- Purpose: Enable user-configurable weightings for rating calculations

-- Create the main user weighting profiles table
CREATE TABLE IF NOT EXISTS user_weighting_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL,
  description TEXT,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('personal', 'role_template', 'project_specific', 'experimental')),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false, -- For sharing templates between users
  version INTEGER DEFAULT 1,
  parent_profile_id UUID REFERENCES user_weighting_profiles(id) ON DELETE SET NULL,

  -- Role-based configuration
  user_role TEXT NOT NULL CHECK (user_role IN ('lead_organiser', 'admin', 'organiser', 'delegate', 'observer')),
  employer_category_focus TEXT CHECK (employer_category_focus IN ('builders', 'trade_contractors', 'all')),

  -- Overall system balance weightings (Track 1 vs Track 2)
  project_data_weight DECIMAL(3,2) DEFAULT 0.60 CHECK (project_data_weight >= 0 AND project_data_weight <= 1),
  organiser_expertise_weight DECIMAL(3,2) DEFAULT 0.40 CHECK (organiser_expertise_weight >= 0 AND organiser_expertise_weight <= 1),

  -- Minimum requirements and thresholds
  min_data_requirements JSONB DEFAULT '{}',
  confidence_thresholds JSONB DEFAULT '{}',

  -- Metadata and audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_updated_by UUID REFERENCES auth.users(id),

  -- Ensure each user can only have one default profile per role
  CONSTRAINT unique_user_default_per_role UNIQUE (user_id, user_role, is_default)
    DEFERRABLE INITIALLY DEFERRED
);

-- Create Track 1 (Project Compliance Data) weightings table
CREATE TABLE IF NOT EXISTS track1_weightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_weighting_profiles(id) ON DELETE CASCADE,

  -- CBUS compliance weightings
  cbus_paying_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (cbus_paying_weight >= 0 AND cbus_paying_weight <= 1),
  cbus_on_time_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (cbus_on_time_weight >= 0 AND cbus_on_time_weight <= 1),
  cbus_all_workers_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (cbus_all_workers_weight >= 0 AND cbus_all_workers_weight <= 1),

  -- Incolink compliance weightings
  incolink_entitlements_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (incolink_entitlements_weight >= 0 AND incolink_entitlements_weight <= 1),
  incolink_on_time_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (incolink_on_time_weight >= 0 AND incolink_on_time_weight <= 1),
  incolink_all_workers_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (incolink_all_workers_weight >= 0 AND incolink_all_workers_weight <= 1),

  -- Union relations weightings
  union_relations_right_of_entry_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (union_relations_right_of_entry_weight >= 0 AND union_relations_right_of_entry_weight <= 1),
  union_relations_delegate_accommodation_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (union_relations_delegate_accommodation_weight >= 0 AND union_relations_delegate_accommodation_weight <= 1),
  union_relations_access_to_info_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (union_relations_access_to_info_weight >= 0 AND union_relations_access_to_info_weight <= 1),
  union_relations_access_to_inductions_weight DECIMAL(3,2) DEFAULT 0.05 CHECK (union_relations_access_to_inductions_weight >= 0 AND union_relations_access_to_inductions_weight <= 1),

  -- Safety performance weightings
  safety_hsr_respect_weight DECIMAL(3,2) DEFAULT 0.20 CHECK (safety_hsr_respect_weight >= 0 AND safety_hsr_respect_weight <= 1),
  safety_general_standards_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (safety_general_standards_weight >= 0 AND safety_general_standards_weight <= 1),
  safety_incidents_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (safety_incidents_weight >= 0 AND safety_incidents_weight <= 1),

  -- Subcontractor management weightings
  subcontractor_usage_levels_weight DECIMAL(3,2) DEFAULT 0.30 CHECK (subcontractor_usage_levels_weight >= 0 AND subcontractor_usage_levels_weight <= 1),
  subcontractor_practices_weight DECIMAL(3,2) DEFAULT 0.70 CHECK (subcontractor_practices_weight >= 0 AND subcontractor_practices_weight <= 1),

  -- Builder-specific weightings (only for builders)
  builder_tender_consultation_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (builder_tender_consultation_weight >= 0 AND builder_tender_consultation_weight <= 1),
  builder_communication_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (builder_communication_weight >= 0 AND builder_communication_weight <= 1),
  builder_delegate_facilities_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (builder_delegate_facilities_weight >= 0 AND builder_delegate_facilities_weight <= 1),
  builder_contractor_compliance_weight DECIMAL(3,2) DEFAULT 0.20 CHECK (builder_contractor_compliance_weight >= 0 AND builder_contractor_compliance_weight <= 1),
  builder_eba_contractor_percentage_weight DECIMAL(3,2) DEFAULT 0.40 CHECK (builder_eba_contractor_percentage_weight >= 0 AND builder_eba_contractor_percentage_weight <= 1),

  -- Validation check - all track 1 weights should sum to 1.0 for their categories
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Track 2 (Organiser Expertise) weightings table
CREATE TABLE IF NOT EXISTS track2_weightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_weighting_profiles(id) ON DELETE CASCADE,

  -- Individual assessment weightings
  cbus_overall_assessment_weight DECIMAL(3,2) DEFAULT 0.20 CHECK (cbus_overall_assessment_weight >= 0 AND cbus_overall_assessment_weight <= 1),
  incolink_overall_assessment_weight DECIMAL(3,2) DEFAULT 0.20 CHECK (incolink_overall_assessment_weight >= 0 AND incolink_overall_assessment_weight <= 1),
  union_relations_overall_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (union_relations_overall_weight >= 0 AND union_relations_overall_weight <= 1),
  safety_culture_overall_weight DECIMAL(3,2) DEFAULT 0.20 CHECK (safety_culture_overall_weight >= 0 AND safety_culture_overall_weight <= 1),

  -- Relationship and historical factors
  historical_relationship_quality_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (historical_relationship_quality_weight >= 0 AND historical_relationship_quality_weight <= 1),
  eba_status_weight DECIMAL(3,2) DEFAULT 0.05 CHECK (eba_status_weight >= 0 AND eba_status_weight <= 1),

  -- Expertise confidence weighting based on organiser reputation
  organiser_confidence_multiplier DECIMAL(3,2) DEFAULT 1.00 CHECK (organiser_confidence_multiplier >= 0.5 AND organiser_confidence_multiplier <= 2.0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weighting presets/templates table
CREATE TABLE IF NOT EXISTS weighting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_category TEXT NOT NULL CHECK (template_category IN ('beginner', 'intermediate', 'advanced', 'specialized')),
  target_role TEXT NOT NULL CHECK (target_role IN ('lead_organiser', 'admin', 'organiser', 'delegate', 'observer')),
  target_employer_type TEXT CHECK (target_employer_type IN ('builders', 'trade_contractors', 'all')),

  -- Template metadata
  is_system_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  average_rating DECIMAL(2,1) CHECK (average_rating >= 1 AND average_rating <= 5),

  -- Template content (copy of profile structure)
  template_data JSONB NOT NULL,

  -- Validation results
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'invalid')),
  validation_notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create weighting change history/audit trail table
CREATE TABLE IF NOT EXISTS weighting_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_weighting_profiles(id) ON DELETE CASCADE,

  -- Change details
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'activate', 'deactivate', 'clone')),
  change_description TEXT,

  -- Previous and new values for tracking
  previous_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Impact assessment
  affected_employers TEXT[] DEFAULT '{}',
  estimated_impact_score DECIMAL(3,2) CHECK (estimated_impact_score >= 0 AND estimated_impact_score <= 1),

  -- Change metadata
  change_reason TEXT,
  change_context TEXT,

  -- Audit fields
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Approval workflow for significant changes
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT
);

-- Create weighting performance analytics table
CREATE TABLE IF NOT EXISTS weighting_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_weighting_profiles(id) ON DELETE CASCADE,

  -- Analytics period
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,

  -- Performance metrics
  total_employers_rated INTEGER DEFAULT 0,
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  confidence_distribution JSONB DEFAULT '{}',
  rating_distribution JSONB DEFAULT '{}',

  -- Discrepancy analysis
  average_discrepancy_score DECIMAL(3,2) DEFAULT 0 CHECK (average_discrepancy_score >= 0 AND average_discrepancy_score <= 1),
  manual_override_rate DECIMAL(3,2) DEFAULT 0 CHECK (manual_override_rate >= 0 AND manual_override_rate <= 1),

  -- Effectiveness metrics
  prediction_accuracy DECIMAL(3,2) CHECK (prediction_accuracy >= 0 AND prediction_accuracy <= 1),
  user_satisfaction_score DECIMAL(3,2) CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),

  -- Comparative analysis
  performance_vs_default DECIMAL(3,2) DEFAULT 0 CHECK (performance_vs_default >= -1 AND performance_vs_default <= 1),
  performance_rank_percentile DECIMAL(3,2) CHECK (performance_rank_percentile >= 0 AND performance_rank_percentile <= 1),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weighting preview calculations table (temporary storage for real-time previews)
CREATE TABLE IF NOT EXISTS weighting_preview_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES user_weighting_profiles(id) ON DELETE CASCADE,

  -- Preview parameters
  sample_employers TEXT[] NOT NULL,
  proposed_weightings JSONB NOT NULL,

  -- Preview results
  calculation_results JSONB NOT NULL,
  impact_analysis JSONB NOT NULL,

  -- Preview metadata
  preview_type TEXT NOT NULL CHECK (preview_type IN ('real_time', 'batch', 'comparison')),
  comparison_profile_id UUID REFERENCES user_weighting_profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

  -- Auto-cleanup expired previews
  CONSTRAINT preview_expiry_check CHECK (expires_at > created_at)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_user_weighting_profiles_user_id ON user_weighting_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weighting_profiles_user_role ON user_weighting_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_weighting_profiles_is_default ON user_weighting_profiles(user_id, user_role, is_default);
CREATE INDEX IF NOT EXISTS idx_user_weighting_profiles_is_active ON user_weighting_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_weighting_profiles_profile_type ON user_weighting_profiles(profile_type);

CREATE INDEX IF NOT EXISTS idx_track1_weightings_profile_id ON track1_weightings(profile_id);
CREATE INDEX IF NOT EXISTS idx_track2_weightings_profile_id ON track2_weightings(profile_id);

CREATE INDEX IF NOT EXISTS idx_weighting_templates_category ON weighting_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_weighting_templates_target_role ON weighting_templates(target_role);
CREATE INDEX IF NOT EXISTS idx_weighting_templates_is_active ON weighting_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_weighting_change_history_profile_id ON weighting_change_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_weighting_change_history_changed_by ON weighting_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_weighting_change_history_changed_at ON weighting_change_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_weighting_performance_analytics_profile_id ON weighting_performance_analytics(profile_id);
CREATE INDEX IF NOT EXISTS idx_weighting_performance_analytics_period ON weighting_performance_analytics(analysis_period_start, analysis_period_end);

CREATE INDEX IF NOT EXISTS idx_weighting_preview_calculations_user_id ON weighting_preview_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_weighting_preview_calculations_expires_at ON weighting_preview_calculations(expires_at);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE user_weighting_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE track1_weightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE track2_weightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighting_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighting_performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighting_preview_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_weighting_profiles
-- Users can view their own profiles and public templates
CREATE POLICY "Users can view own weighting profiles" ON user_weighting_profiles
  FOR SELECT USING (
    auth.uid() = user_id OR
    is_public = true
  );

-- Users can manage their own profiles
CREATE POLICY "Users can manage own weighting profiles" ON user_weighting_profiles
  FOR ALL USING (
    auth.uid() = user_id
  );

-- Admins can view all profiles
CREATE POLICY "Admins can view all weighting profiles" ON user_weighting_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for track1_weightings and track2_weightings (inherited from profiles)
CREATE POLICY "Users can view weightings for own profiles" ON track1_weightings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = track1_weightings.profile_id
      AND (user_weighting_profiles.user_id = auth.uid() OR user_weighting_profiles.is_public = true)
    )
  );

CREATE POLICY "Users can manage weightings for own profiles" ON track1_weightings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = track1_weightings.profile_id
      AND user_weighting_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view track2 weightings for own profiles" ON track2_weightings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = track2_weightings.profile_id
      AND (user_weighting_profiles.user_id = auth.uid() OR user_weighting_profiles.is_public = true)
    )
  );

CREATE POLICY "Users can manage track2 weightings for own profiles" ON track2_weightings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = track2_weightings.profile_id
      AND user_weighting_profiles.user_id = auth.uid()
    )
  );

-- RLS Policies for weighting_templates
-- All authenticated users can view active templates
CREATE POLICY "Authenticated users can view active templates" ON weighting_templates
  FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

-- Admins can manage all templates
CREATE POLICY "Admins can manage all templates" ON weighting_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Template creators can manage their own templates
CREATE POLICY "Users can manage own templates" ON weighting_templates
  FOR ALL USING (created_by = auth.uid());

-- RLS Policies for change history and analytics (inherited access)
CREATE POLICY "Users can view history for own profiles" ON weighting_change_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = weighting_change_history.profile_id
      AND user_weighting_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view analytics for own profiles" ON weighting_performance_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_weighting_profiles
      WHERE user_weighting_profiles.id = weighting_performance_analytics.profile_id
      AND user_weighting_profiles.user_id = auth.uid()
    )
  );

-- RLS Policies for preview calculations
CREATE POLICY "Users can manage own preview calculations" ON weighting_preview_calculations
  FOR ALL USING (auth.uid() = user_id);

-- Create triggers for timestamp updates and audit trails
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at columns
CREATE TRIGGER update_user_weighting_profiles_updated_at
  BEFORE UPDATE ON user_weighting_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_track1_weightings_updated_at
  BEFORE UPDATE ON track1_weightings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_track2_weightings_updated_at
  BEFORE UPDATE ON track2_weightings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weighting_templates_updated_at
  BEFORE UPDATE ON weighting_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weighting_performance_analytics_updated_at
  BEFORE UPDATE ON weighting_performance_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger for tracking profile changes
CREATE OR REPLACE FUNCTION track_weighting_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Record changes for update operations
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO weighting_change_history (
      profile_id,
      change_type,
      change_description,
      previous_values,
      new_values,
      changed_fields,
      changed_by
    ) VALUES (
      NEW.id,
      'update',
      'Profile updated via trigger',
      row_to_json(OLD),
      row_to_json(NEW),
      -- Detect which fields actually changed
      ARRAY_REMOVE(ARRAY[
        CASE WHEN NEW.profile_name IS DISTINCT FROM OLD.profile_name THEN 'profile_name' END,
        CASE WHEN NEW.description IS DISTINCT FROM OLD.description THEN 'description' END,
        CASE WHEN NEW.project_data_weight IS DISTINCT FROM OLD.project_data_weight THEN 'project_data_weight' END,
        CASE WHEN NEW.organiser_expertise_weight IS DISTINCT FROM OLD.organiser_expertise_weight THEN 'organiser_expertise_weight' END
      ], NULL),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_weighting_profile_changes_trigger
  AFTER UPDATE ON user_weighting_profiles
  FOR EACH ROW EXECUTE FUNCTION track_weighting_profile_changes();

-- Create function for automatic cleanup of expired preview calculations
CREATE OR REPLACE FUNCTION cleanup_expired_preview_calculations()
RETURNS void AS $$
BEGIN
  DELETE FROM weighting_preview_calculations
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled cleanup function (to be called by cron or similar)
COMMENT ON FUNCTION cleanup_expired_preview_calculations() IS 'Cleans up expired preview calculations to maintain table performance';

-- Insert default system templates
INSERT INTO weighting_templates (
  template_name,
  description,
  template_category,
  target_role,
  target_employer_type,
  is_system_template,
  template_data,
  validation_status
) VALUES
(
  'Balanced Lead Organiser',
  'Balanced weighting approach for lead organisers with equal emphasis on project data and organiser expertise',
  'intermediate',
  'lead_organiser',
  'all',
  true,
  jsonb_build_object(
    'project_data_weight', 0.60,
    'organiser_expertise_weight', 0.40,
    'track1_weightings', jsonb_build_object(
      'cbus_paying_weight', 0.15,
      'cbus_on_time_weight', 0.10,
      'cbus_all_workers_weight', 0.10,
      'incolink_entitlements_weight', 0.15,
      'incolink_on_time_weight', 0.10,
      'incolink_all_workers_weight', 0.10,
      'union_relations_right_of_entry_weight', 0.15,
      'union_relations_delegate_accommodation_weight', 0.10,
      'union_relations_access_to_info_weight', 0.10,
      'union_relations_access_to_inductions_weight', 0.05,
      'safety_hsr_respect_weight', 0.20,
      'safety_general_standards_weight', 0.15,
      'safety_incidents_weight', 0.25,
      'subcontractor_usage_levels_weight', 0.30,
      'subcontractor_practices_weight', 0.70
    ),
    'track2_weightings', jsonb_build_object(
      'cbus_overall_assessment_weight', 0.20,
      'incolink_overall_assessment_weight', 0.20,
      'union_relations_overall_weight', 0.25,
      'safety_culture_overall_weight', 0.20,
      'historical_relationship_quality_weight', 0.10,
      'eba_status_weight', 0.05,
      'organiser_confidence_multiplier', 1.00
    )
  ),
  'validated'
),
(
  'Data-First Admin',
  'Heavy emphasis on automated compliance data for admin users who prioritize objective metrics',
  'advanced',
  'admin',
  'all',
  true,
  jsonb_build_object(
    'project_data_weight', 0.80,
    'organiser_expertise_weight', 0.20,
    'track1_weightings', jsonb_build_object(
      'cbus_paying_weight', 0.20,
      'cbus_on_time_weight', 0.15,
      'cbus_all_workers_weight', 0.15,
      'incolink_entitlements_weight', 0.20,
      'incolink_on_time_weight', 0.15,
      'incolink_all_workers_weight', 0.15,
      'union_relations_right_of_entry_weight', 0.10,
      'union_relations_delegate_accommodation_weight', 0.08,
      'union_relations_access_to_info_weight', 0.07,
      'union_relations_access_to_inductions_weight', 0.05,
      'safety_hsr_respect_weight', 0.25,
      'safety_general_standards_weight', 0.20,
      'safety_incidents_weight', 0.30,
      'subcontractor_usage_levels_weight', 0.40,
      'subcontractor_practices_weight', 0.60
    ),
    'track2_weightings', jsonb_build_object(
      'cbus_overall_assessment_weight', 0.15,
      'incolink_overall_assessment_weight', 0.15,
      'union_relations_overall_weight', 0.20,
      'safety_culture_overall_weight', 0.15,
      'historical_relationship_quality_weight', 0.05,
      'eba_status_weight', 0.10,
      'organiser_confidence_multiplier', 0.80
    )
  ),
  'validated'
),
(
  'Expertise-Focused Organiser',
  'Emphasizes organiser expertise and relationship knowledge for experienced organisers',
  'advanced',
  'organiser',
  'all',
  true,
  jsonb_build_object(
    'project_data_weight', 0.30,
    'organiser_expertise_weight', 0.70,
    'track1_weightings', jsonb_build_object(
      'cbus_paying_weight', 0.10,
      'cbus_on_time_weight', 0.08,
      'cbus_all_workers_weight', 0.07,
      'incolink_entitlements_weight', 0.10,
      'incolink_on_time_weight', 0.08,
      'incolink_all_workers_weight', 0.07,
      'union_relations_right_of_entry_weight', 0.20,
      'union_relations_delegate_accommodation_weight', 0.15,
      'union_relations_access_to_info_weight', 0.12,
      'union_relations_access_to_inductions_weight', 0.08,
      'safety_hsr_respect_weight', 0.15,
      'safety_general_standards_weight', 0.10,
      'safety_incidents_weight', 0.20,
      'subcontractor_usage_levels_weight', 0.20,
      'subcontractor_practices_weight', 0.40
    ),
    'track2_weightings', jsonb_build_object(
      'cbus_overall_assessment_weight', 0.25,
      'incolink_overall_assessment_weight', 0.25,
      'union_relations_overall_weight', 0.30,
      'safety_culture_overall_weight', 0.25,
      'historical_relationship_quality_weight', 0.20,
      'eba_status_weight', 0.05,
      'organiser_confidence_multiplier', 1.50
    )
  ),
  'validated'
)
ON CONFLICT (template_name) DO NOTHING;

-- Create helper functions for weighting validation and calculation
CREATE OR REPLACE FUNCTION validate_weighting_sum(profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  track1_sum DECIMAL;
  track2_sum DECIMAL;
  main_sum DECIMAL;
BEGIN
  -- Validate main weightings sum to 1.0
  SELECT (project_data_weight + organiser_expertise_weight) INTO main_sum
  FROM user_weighting_profiles
  WHERE id = profile_id;

  -- Validate Track 1 weightings
  SELECT (
    COALESCE(cbus_paying_weight, 0) + COALESCE(cbus_on_time_weight, 0) + COALESCE(cbus_all_workers_weight, 0) +
    COALESCE(incolink_entitlements_weight, 0) + COALESCE(incolink_on_time_weight, 0) + COALESCE(incolink_all_workers_weight, 0) +
    COALESCE(union_relations_right_of_entry_weight, 0) + COALESCE(union_relations_delegate_accommodation_weight, 0) +
    COALESCE(union_relations_access_to_info_weight, 0) + COALESCE(union_relations_access_to_inductions_weight, 0) +
    COALESCE(safety_hsr_respect_weight, 0) + COALESCE(safety_general_standards_weight, 0) + COALESCE(safety_incidents_weight, 0) +
    COALESCE(subcontractor_usage_levels_weight, 0) + COALESCE(subcontractor_practices_weight, 0)
  ) INTO track1_sum
  FROM track1_weightings
  WHERE profile_id = profile_id;

  -- Validate Track 2 weightings
  SELECT (
    COALESCE(cbus_overall_assessment_weight, 0) + COALESCE(incolink_overall_assessment_weight, 0) +
    COALESCE(union_relations_overall_weight, 0) + COALESCE(safety_culture_overall_weight, 0) +
    COALESCE(historical_relationship_quality_weight, 0) + COALESCE(eba_status_weight, 0)
  ) INTO track2_sum
  FROM track2_weightings
  WHERE profile_id = profile_id;

  -- Return true if all sums are approximately 1.0 (allowing for small floating point differences)
  RETURN ABS(main_sum - 1.0) < 0.01
         AND ABS(track1_sum - 1.0) < 0.01
         AND ABS(track2_sum - 1.0) < 0.01;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_weighting_profiles IS 'Main table storing user-configurable weighting profiles for employer ratings';
COMMENT ON TABLE track1_weightings IS 'Track 1 weightings for project compliance data (CBUS, Incolink, Union Relations, Safety, Subcontractor Management)';
COMMENT ON TABLE track2_weightings IS 'Track 2 weightings for organiser expertise assessments';
COMMENT ON TABLE weighting_templates IS 'Pre-defined weighting templates and presets for different user roles and scenarios';
COMMENT ON TABLE weighting_change_history IS 'Audit trail for all weighting configuration changes';
COMMENT ON TABLE weighting_performance_analytics IS 'Performance metrics and effectiveness analysis for weighting configurations';
COMMENT ON TABLE weighting_preview_calculations IS 'Temporary storage for real-time preview calculations';