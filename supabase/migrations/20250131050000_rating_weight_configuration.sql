-- Rating System Weight Configuration
-- This migration creates a table for storing configurable weights for different rating tracks
-- allowing administrators to adjust weightings without code changes

-- Create rating weight configurations table
CREATE TABLE IF NOT EXISTS public.rating_weight_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Configuration identification
    track text NOT NULL CHECK (track IN ('project_data', 'organiser_expertise')),
    role_context text CHECK (role_context IN ('trade', 'builder', 'admin', 'organiser')),

    -- Weight configuration
    weights jsonb NOT NULL,

    -- Metadata
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,

    -- EBA settings (always treated as gating factor)
    eba_as_gating_factor boolean DEFAULT true,
    eba_weight_excluded boolean DEFAULT true, -- EBA is not part of weight calculations

    -- Validation
    weight_sum numeric GENERATED ALWAYS AS (
        (weights->>'union_respect')::numeric +
        (weights->>'safety')::numeric +
        (weights->>'subcontractor')::numeric +
        (weights->>'compliance')::numeric
    ) STORED,

    CHECK (
        (weights->>'union_respect') IS NOT NULL AND
        (weights->>'safety') IS NOT NULL AND
        (weights->>'subcontractor') IS NOT NULL AND
        (weights->>'compliance') IS NOT NULL
    ),

    -- Audit trail
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    -- Constraints
    UNIQUE(track, is_active),
    CONSTRAINT weights_sum_to_one CHECK (weight_sum = 1.0)
);

-- Create default weight configurations
INSERT INTO public.rating_weight_configs (
    track,
    name,
    description,
    weights,
    is_default,
    is_active
) VALUES
-- Organiser Expertise Track - Equal weights (25% each)
(
    'organiser_expertise',
    'Organiser Expertise - Equal Weights',
    'Equal weighting for all organiser expertise assessment categories (25% each)',
    '{"union_respect": 0.25, "safety": 0.25, "subcontractor": 0.25, "compliance": 0.25}'::jsonb,
    true,
    true
),
-- Project Data Track - Original weights (EBA excluded from calculations)
(
    'project_data',
    'Project Data - Standard Weights',
    'Standard weighting for project-based assessments. EBA is treated as gating factor, not included in weight calculations.',
    '{"union_respect": 0.357, "safety": 0.357, "subcontractor": 0.286, "compliance": 0}'::jsonb,
    true,
    true
)
ON CONFLICT (track, is_active) DO NOTHING;

-- Function to get current weights for a track
CREATE OR REPLACE FUNCTION public.get_rating_weights(
    p_track text,
    p_role_context text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_weights jsonb;
BEGIN
    SELECT weights INTO v_weights
    FROM public.rating_weight_configs
    WHERE track = p_track
      AND is_active = true
      AND (p_role_context IS NULL OR role_context = p_role_context OR role_context IS NULL)
    ORDER BY is_default DESC
    LIMIT 1;

    RETURN COALESCE(v_weights, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update weights (admin only)
CREATE OR REPLACE FUNCTION public.update_rating_weights(
    p_track text,
    p_weights jsonb,
    p_name text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_updated_by uuid DEFAULT NULL
) RETURNS TABLE (
    success boolean,
    message text,
    config_id uuid
) AS $$
DECLARE
    v_config_id uuid;
    v_weight_sum numeric;
BEGIN
    -- Validate weights sum to 1.0
    v_weight_sum := (p_weights->>'union_respect')::numeric +
                   (p_weights->>'safety')::numeric +
                   (p_weights->>'subcontractor')::numeric +
                   (p_weights->>'compliance')::numeric;

    IF ABS(v_weight_sum - 1.0) > 0.001 THEN
        RETURN QUERY SELECT false, 'Weights must sum to 1.0. Current sum: ' || v_weight_sum, NULL::uuid;
        RETURN;
    END IF;

    -- Validate track
    IF p_track NOT IN ('project_data', 'organiser_expertise') THEN
        RETURN QUERY SELECT false, 'Invalid track: ' || p_track, NULL::uuid;
        RETURN;
    END IF;

    -- Deactivate existing configuration
    UPDATE public.rating_weight_configs
    SET is_active = false,
        updated_at = now()
    WHERE track = p_track;

    -- Insert new configuration
    INSERT INTO public.rating_weight_configs (
        track,
        weights,
        name,
        description,
        is_active,
        updated_by
    ) VALUES (
        p_track,
        p_weights,
        COALESCE(p_name, 'Updated weights for ' || p_track),
        COALESCE(p_description, 'Weight configuration updated on ' || now()),
        true,
        p_updated_by
    ) RETURNING id INTO v_config_id;

    RETURN QUERY SELECT true, 'Weights updated successfully', v_config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weight history for audit
CREATE OR REPLACE FUNCTION public.get_weight_history(
    p_track text DEFAULT NULL,
    p_limit integer DEFAULT 50
) RETURNS TABLE (
    id uuid,
    track text,
    weights jsonb,
    name text,
    is_active boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by_name text,
    updated_by_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rwc.id,
        rwc.track,
        rwc.weights,
        rwc.name,
        rwc.is_active,
        rwc.created_at,
        rwc.updated_at,
        p1.name as created_by_name,
        p2.name as updated_by_name
    FROM public.rating_weight_configs rwc
    LEFT JOIN public.profiles p1 ON rwc.created_by = p1.id
    LEFT JOIN public.profiles p2 ON rwc.updated_by = p2.id
    WHERE (p_track IS NULL OR rwc.track = p_track)
    ORDER BY rwc.track, rwc.updated_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rating_weight_configs_track_active ON public.rating_weight_configs(track, is_active);
CREATE INDEX IF NOT EXISTS idx_rating_weight_configs_updated_at ON public.rating_weight_configs(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.rating_weight_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Read access for authenticated users
CREATE POLICY "Rating weight configs - Read access" ON public.rating_weight_configs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admin write access
CREATE POLICY "Rating weight configs - Admin write access" ON public.rating_weight_configs
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Grant permissions
GRANT SELECT ON public.rating_weight_configs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rating_weights(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weight_history(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_rating_weights(text, jsonb, text, text, uuid) TO authenticated;

-- Comments
COMMENT ON TABLE public.rating_weight_configs IS 'Configurable weights for rating system tracks allowing admin adjustment without code changes';
COMMENT ON FUNCTION public.get_rating_weights IS 'Get current active weights for a specific rating track';
COMMENT ON FUNCTION public.update_rating_weights IS 'Update weights for a rating track (admin only)';
COMMENT ON FUNCTION public.get_weight_history IS 'Get audit history of weight changes';