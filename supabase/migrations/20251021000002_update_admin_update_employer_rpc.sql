-- Migration: Update admin_update_employer_full RPC to use employer_capabilities
-- Phase 3: Update RPC Functions
-- This migration updates the admin_update_employer_full function to write to
-- employer_capabilities while maintaining dual-write for compatibility.

-- ============================================================================
-- STEP 1: Update the newer signature (with trade_types parameter)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_employer_full(
  p_employer_id uuid,
  p_update jsonb,
  p_role_tags public.employer_role_tag[],
  p_trade_types public.trade_type[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check permissions
  IF NOT (public.get_user_role(auth.uid()) = ANY (ARRAY['admin','organiser'])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Update employer basic fields with proper type casting
  UPDATE public.employers e
  SET 
    name = COALESCE(p_update->>'name', e.name),
    employer_type = COALESCE((p_update->>'employer_type')::public.employer_type, e.employer_type),
    abn = COALESCE(p_update->>'abn', e.abn),
    email = COALESCE(p_update->>'email', e.email),
    phone = COALESCE(p_update->>'phone', e.phone),
    website = COALESCE(p_update->>'website', e.website),
    address_line_1 = COALESCE(p_update->>'address_line_1', e.address_line_1),
    address_line_2 = COALESCE(p_update->>'address_line_2', e.address_line_2),
    suburb = COALESCE(p_update->>'suburb', e.suburb),
    state = COALESCE(p_update->>'state', e.state),
    postcode = COALESCE(p_update->>'postcode', e.postcode),
    primary_contact_name = COALESCE(p_update->>'primary_contact_name', e.primary_contact_name),
    contact_notes = COALESCE(p_update->>'contact_notes', e.contact_notes),
    estimated_worker_count = COALESCE((p_update->>'estimated_worker_count')::integer, e.estimated_worker_count),
    enterprise_agreement_status = COALESCE((p_update->>'enterprise_agreement_status')::boolean, e.enterprise_agreement_status),
    incolink_id = COALESCE(p_update->>'incolink_id', e.incolink_id),
    updated_at = now()
  WHERE e.id = p_employer_id;

  -- ========================================================================
  -- NEW: Handle role tags via employer_capabilities (PRIMARY SYSTEM)
  -- ========================================================================
  IF p_role_tags IS NOT NULL THEN
    -- Delete existing role capabilities
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id
      AND capability_type = 'contractor_role';
    
    -- Insert new role capabilities
    IF array_length(p_role_tags, 1) > 0 THEN
      INSERT INTO public.employer_capabilities (
        employer_id,
        capability_type,
        contractor_role_type_id,
        trade_type_id,
        is_primary
      )
      SELECT 
        p_employer_id,
        'contractor_role',
        crt.id,
        NULL::uuid,
        false
      FROM unnest(p_role_tags) AS tag
      INNER JOIN public.contractor_role_types crt ON crt.code = tag::text;
    END IF;
  END IF;

  -- ========================================================================
  -- NEW: Handle trade capabilities via employer_capabilities (PRIMARY SYSTEM)
  -- ========================================================================
  IF p_trade_types IS NOT NULL THEN
    -- Delete existing trade capabilities
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id
      AND capability_type = 'trade';
    
    -- Insert new trade capabilities
    IF array_length(p_trade_types, 1) > 0 THEN
      INSERT INTO public.employer_capabilities (
        employer_id,
        capability_type,
        contractor_role_type_id,
        trade_type_id,
        is_primary
      )
      SELECT 
        p_employer_id,
        'trade',
        NULL::uuid,
        tt.id,
        false
      FROM unnest(p_trade_types) AS trade
      INNER JOIN public.trade_types tt ON tt.code = trade::text;
    END IF;
  END IF;

  -- ========================================================================
  -- COMPATIBILITY: Also write to old tables (for backward compatibility)
  -- ========================================================================
  
  -- Handle role tags in old table
  IF p_role_tags IS NOT NULL THEN
    DELETE FROM public.employer_role_tags WHERE employer_id = p_employer_id;
    
    IF array_length(p_role_tags, 1) > 0 THEN
      INSERT INTO public.employer_role_tags (employer_id, tag)
      SELECT p_employer_id, unnest(p_role_tags);
    END IF;
  END IF;

  -- Handle trade capabilities in old table
  IF p_trade_types IS NOT NULL THEN
    DELETE FROM public.contractor_trade_capabilities WHERE employer_id = p_employer_id;
    
    IF array_length(p_trade_types, 1) > 0 THEN
      INSERT INTO public.contractor_trade_capabilities (employer_id, trade_type, is_primary)
      SELECT p_employer_id, unnest(p_trade_types), false;
    END IF;
  END IF;
  
END;
$$;

COMMENT ON FUNCTION public.admin_update_employer_full(uuid, jsonb, public.employer_role_tag[], public.trade_type[]) IS 
  'Updates employer record including capabilities. Writes to employer_capabilities (primary) and legacy tables (compatibility). Dual-write mode during migration.';

-- ============================================================================
-- STEP 2: Update the older signature (with trade_caps text[] parameter)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_employer_full(
  p_employer_id uuid,
  p_update jsonb,
  p_role_tags public.employer_role_tag[] DEFAULT NULL,
  p_trade_caps text[] DEFAULT NULL
)
RETURNS public.employers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row public.employers%ROWTYPE;
BEGIN
  -- Authorization: require admin or organiser/lead_organiser/delegate
  IF NOT (
    public.is_admin()
    OR public.has_role(auth.uid(), 'organiser')
    OR public.has_role(auth.uid(), 'lead_organiser')
    OR public.has_role(auth.uid(), 'delegate')
  ) THEN
    RAISE EXCEPTION 'Not allowed: requires admin or organiser role';
  END IF;

  -- Update employer basic fields
  UPDATE public.employers e
  SET
    name = CASE WHEN p_update ? 'name' THEN NULLIF(p_update->>'name','') ELSE e.name END,
    employer_type = CASE WHEN p_update ? 'employer_type' THEN (p_update->>'employer_type')::public.employer_type ELSE e.employer_type END,
    abn = CASE WHEN p_update ? 'abn' THEN NULLIF(p_update->>'abn','') ELSE e.abn END,
    primary_contact_name = CASE WHEN p_update ? 'primary_contact_name' THEN NULLIF(p_update->>'primary_contact_name','') ELSE e.primary_contact_name END,
    phone = CASE WHEN p_update ? 'phone' THEN NULLIF(p_update->>'phone','') ELSE e.phone END,
    email = CASE WHEN p_update ? 'email' THEN NULLIF(p_update->>'email','') ELSE e.email END,
    website = CASE WHEN p_update ? 'website' THEN NULLIF(p_update->>'website','') ELSE e.website END,
    address_line_1 = CASE WHEN p_update ? 'address_line_1' THEN NULLIF(p_update->>'address_line_1','') ELSE e.address_line_1 END,
    address_line_2 = CASE WHEN p_update ? 'address_line_2' THEN NULLIF(p_update->>'address_line_2','') ELSE e.address_line_2 END,
    suburb = CASE WHEN p_update ? 'suburb' THEN NULLIF(p_update->>'suburb','') ELSE e.suburb END,
    state = CASE WHEN p_update ? 'state' THEN NULLIF(p_update->>'state','') ELSE e.state END,
    postcode = CASE WHEN p_update ? 'postcode' THEN NULLIF(p_update->>'postcode','') ELSE e.postcode END,
    contact_notes = CASE WHEN p_update ? 'contact_notes' THEN NULLIF(p_update->>'contact_notes','') ELSE e.contact_notes END,
    estimated_worker_count = CASE WHEN p_update ? 'estimated_worker_count' THEN NULLIF(p_update->>'estimated_worker_count','')::int ELSE e.estimated_worker_count END,
    enterprise_agreement_status = CASE WHEN p_update ? 'enterprise_agreement_status' THEN
      CASE
        WHEN p_update->>'enterprise_agreement_status' IS NULL THEN NULL
        ELSE (p_update->>'enterprise_agreement_status')::boolean
      END
    ELSE e.enterprise_agreement_status END,
    incolink_id = CASE WHEN p_update ? 'incolink_id' THEN NULLIF(p_update->>'incolink_id','') ELSE e.incolink_id END,
    updated_at = now()
  WHERE e.id = p_employer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employer not found';
  END IF;

  -- ========================================================================
  -- NEW: Sync role tags to employer_capabilities (PRIMARY SYSTEM)
  -- ========================================================================
  IF p_role_tags IS NULL THEN
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id AND capability_type = 'contractor_role';
  ELSE
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id
      AND capability_type = 'contractor_role'
      AND contractor_role_type_id NOT IN (
        SELECT crt.id FROM unnest(p_role_tags) AS tag
        INNER JOIN public.contractor_role_types crt ON crt.code = tag::text
      );

    INSERT INTO public.employer_capabilities (
      employer_id,
      capability_type,
      contractor_role_type_id,
      is_primary
    )
    SELECT p_employer_id, 'contractor_role', crt.id, false
    FROM unnest(p_role_tags) AS tag
    INNER JOIN public.contractor_role_types crt ON crt.code = tag::text
    ON CONFLICT (employer_id, capability_type, contractor_role_type_id) DO NOTHING;
  END IF;

  -- ========================================================================
  -- NEW: Sync trade capabilities to employer_capabilities (PRIMARY SYSTEM)
  -- ========================================================================
  IF p_trade_caps IS NULL THEN
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id AND capability_type = 'trade';
  ELSE
    DELETE FROM public.employer_capabilities
    WHERE employer_id = p_employer_id
      AND capability_type = 'trade'
      AND trade_type_id NOT IN (
        SELECT tt.id FROM unnest(p_trade_caps) AS cap
        INNER JOIN public.trade_types tt ON tt.code = cap
      );

    INSERT INTO public.employer_capabilities (
      employer_id,
      capability_type,
      trade_type_id,
      is_primary
    )
    SELECT p_employer_id, 'trade', tt.id, false
    FROM unnest(p_trade_caps) AS cap
    INNER JOIN public.trade_types tt ON tt.code = cap
    WHERE NOT EXISTS (
      SELECT 1 FROM public.employer_capabilities ec
      WHERE ec.employer_id = p_employer_id
        AND ec.capability_type = 'trade'
        AND ec.trade_type_id = tt.id
    );
  END IF;

  -- ========================================================================
  -- COMPATIBILITY: Also sync to old tables (for backward compatibility)
  -- ========================================================================
  
  -- Sync role tags to old table
  IF p_role_tags IS NULL THEN
    DELETE FROM public.employer_role_tags WHERE employer_id = p_employer_id;
  ELSE
    DELETE FROM public.employer_role_tags
    WHERE employer_id = p_employer_id
      AND NOT (tag = ANY (p_role_tags));

    INSERT INTO public.employer_role_tags (employer_id, tag)
    SELECT p_employer_id, t
    FROM unnest(p_role_tags) AS t
    ON CONFLICT (employer_id, tag) DO NOTHING;
  END IF;

  -- Sync trade capabilities to old table
  IF p_trade_caps IS NULL THEN
    DELETE FROM public.contractor_trade_capabilities WHERE employer_id = p_employer_id;
  ELSE
    DELETE FROM public.contractor_trade_capabilities
    WHERE employer_id = p_employer_id
      AND NOT (trade_type::text = ANY (p_trade_caps));

    INSERT INTO public.contractor_trade_capabilities (employer_id, trade_type, is_primary)
    SELECT p_employer_id, v::public.trade_type, false
    FROM unnest(p_trade_caps) AS v
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contractor_trade_capabilities c
      WHERE c.employer_id = p_employer_id AND c.trade_type::text = v
    );
  END IF;

  SELECT * INTO v_row FROM public.employers WHERE id = p_employer_id;
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_update_employer_full(uuid, jsonb, public.employer_role_tag[], text[]) IS 
  'Updates employer record including capabilities. Writes to employer_capabilities (primary) and legacy tables (compatibility). Dual-write mode during migration.';

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'RPC functions updated successfully!';
  RAISE NOTICE 'Both function signatures now write to employer_capabilities (primary) and legacy tables (compatibility).';
  RAISE NOTICE '';
END $$;


