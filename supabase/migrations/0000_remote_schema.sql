

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_type" AS ENUM (
    'strike',
    'training',
    'conversation',
    'action',
    'meeting',
    'financial_standing_list_audit'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."dd_status_type" AS ENUM (
    'not_started',
    'in_progress',
    'active',
    'failed'
);


ALTER TYPE "public"."dd_status_type" OWNER TO "postgres";


CREATE TYPE "public"."eba_status" AS ENUM (
    'yes',
    'no',
    'pending'
);


ALTER TYPE "public"."eba_status" OWNER TO "postgres";


CREATE TYPE "public"."eba_status_type" AS ENUM (
    'yes',
    'no',
    'not_specified'
);


ALTER TYPE "public"."eba_status_type" OWNER TO "postgres";


CREATE TYPE "public"."employer_role_tag" AS ENUM (
    'builder',
    'head_contractor'
);


ALTER TYPE "public"."employer_role_tag" OWNER TO "postgres";


CREATE TYPE "public"."employer_type" AS ENUM (
    'individual',
    'small_contractor',
    'large_contractor',
    'principal_contractor',
    'builder'
);


ALTER TYPE "public"."employer_type" OWNER TO "postgres";


CREATE TYPE "public"."employment_status" AS ENUM (
    'permanent',
    'casual',
    'subcontractor',
    'apprentice',
    'trainee'
);


ALTER TYPE "public"."employment_status" OWNER TO "postgres";


CREATE TYPE "public"."jv_status" AS ENUM (
    'yes',
    'no',
    'unsure'
);


ALTER TYPE "public"."jv_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method_type" AS ENUM (
    'direct_debit',
    'payroll_deduction',
    'cash',
    'card',
    'unknown'
);


ALTER TYPE "public"."payment_method_type" OWNER TO "postgres";


CREATE TYPE "public"."project_organising_universe" AS ENUM (
    'active',
    'potential',
    'excluded'
);


ALTER TYPE "public"."project_organising_universe" OWNER TO "postgres";


CREATE TYPE "public"."project_role" AS ENUM (
    'head_contractor',
    'contractor',
    'trade_subcontractor',
    'builder',
    'project_manager'
);


ALTER TYPE "public"."project_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."project_role" IS 'Roles that employers can have on projects: builder, head_contractor, contractor, project_manager';



CREATE TYPE "public"."project_stage_class" AS ENUM (
    'future',
    'pre_construction',
    'construction',
    'archived'
);


ALTER TYPE "public"."project_stage_class" OWNER TO "postgres";


CREATE TYPE "public"."project_type" AS ENUM (
    'government',
    'private',
    'mixed'
);


ALTER TYPE "public"."project_type" OWNER TO "postgres";


CREATE TYPE "public"."rating_type" AS ENUM (
    'support_level',
    'leadership',
    'risk',
    'activity_participation'
);


ALTER TYPE "public"."rating_type" OWNER TO "postgres";


CREATE TYPE "public"."shift_type" AS ENUM (
    'day',
    'night',
    'split',
    'weekend'
);


ALTER TYPE "public"."shift_type" OWNER TO "postgres";


CREATE TYPE "public"."site_contact_role" AS ENUM (
    'project_manager',
    'site_manager',
    'site_delegate',
    'site_hsr'
);


ALTER TYPE "public"."site_contact_role" OWNER TO "postgres";


CREATE TYPE "public"."trade_stage" AS ENUM (
    'early_works',
    'structure',
    'finishing',
    'other'
);


ALTER TYPE "public"."trade_stage" OWNER TO "postgres";


CREATE TYPE "public"."trade_type" AS ENUM (
    'scaffolding',
    'form_work',
    'reinforcing_steel',
    'concrete',
    'crane_and_rigging',
    'plant_and_equipment',
    'electrical',
    'plumbing',
    'carpentry',
    'painting',
    'flooring',
    'roofing',
    'glazing',
    'landscaping',
    'demolition',
    'earthworks',
    'structural_steel',
    'mechanical_services',
    'fire_protection',
    'security_systems',
    'cleaning',
    'traffic_management',
    'waste_management',
    'general_construction',
    'other',
    'tower_crane',
    'mobile_crane',
    'post_tensioning',
    'concreting',
    'steel_fixing',
    'bricklaying',
    'traffic_control',
    'labour_hire',
    'windows',
    'waterproofing',
    'plastering',
    'edge_protection',
    'hoist',
    'kitchens',
    'tiling',
    'piling',
    'excavations',
    'facade',
    'final_clean',
    'foundations',
    'ceilings',
    'stairs_balustrades',
    'building_services',
    'civil_infrastructure',
    'fitout',
    'insulation',
    'technology',
    'pools',
    'pipeline'
);


ALTER TYPE "public"."trade_type" OWNER TO "postgres";


CREATE TYPE "public"."training_status" AS ENUM (
    'completed',
    'in_progress',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."training_status" OWNER TO "postgres";


CREATE TYPE "public"."union_membership_status" AS ENUM (
    'member',
    'non_member',
    'potential',
    'declined'
);


ALTER TYPE "public"."union_membership_status" OWNER TO "postgres";


CREATE TYPE "public"."union_role_type" AS ENUM (
    'member',
    'hsr',
    'site_delegate',
    'shift_delegate',
    'company_delegate',
    'contact',
    'health_safety_committee'
);


ALTER TYPE "public"."union_role_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_project_managers"("p_project_id" "uuid", "p_employer_ids" "uuid"[], "p_start_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("employer_id" "uuid", "success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  employer_id_item uuid;
BEGIN
  FOREACH employer_id_item IN ARRAY p_employer_ids
  LOOP
    BEGIN
      -- Check if project exists
      IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
        RETURN QUERY SELECT employer_id_item, false, 'Project not found';
        CONTINUE;
      END IF;
      
      -- Check if employer exists  
      IF NOT EXISTS (SELECT 1 FROM employers WHERE id = employer_id_item) THEN
        RETURN QUERY SELECT employer_id_item, false, 'Employer not found';
        CONTINUE;
      END IF;
      
      -- Insert project manager role
      INSERT INTO project_employer_roles (project_id, employer_id, role, start_date)
      VALUES (p_project_id, employer_id_item, 'project_manager', p_start_date);
      
      RETURN QUERY SELECT employer_id_item, true, 'Successfully added as project manager';
    EXCEPTION WHEN unique_violation THEN
      RETURN QUERY SELECT employer_id_item, false, 'Already assigned as project manager';
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."add_project_managers"("p_project_id" "uuid", "p_employer_ids" "uuid"[], "p_start_date" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."employers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "abn" "text",
    "enterprise_agreement_status" boolean DEFAULT false,
    "parent_employer_id" "uuid",
    "employer_type" "public"."employer_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "email" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "suburb" "text",
    "state" "text",
    "postcode" "text",
    "website" "text",
    "contact_notes" "text",
    "primary_contact_name" "text",
    "estimated_worker_count" integer DEFAULT 0,
    "bci_company_id" "text",
    "incolink_last_matched" "date",
    "incolink_id" "text",
    "last_incolink_payment" "date"
);


ALTER TABLE "public"."employers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."employers"."estimated_worker_count" IS 'User-entered estimate of total workers for this employer';



COMMENT ON COLUMN "public"."employers"."incolink_last_matched" IS 'Date when this employer was last matched/updated with Incolink data';



COMMENT ON COLUMN "public"."employers"."incolink_id" IS 'Unique identifier from Incolink system for employer matching and integration';



COMMENT ON COLUMN "public"."employers"."last_incolink_payment" IS 'Date of the most recent Incolink invoice observed for this employer.';



CREATE OR REPLACE FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[] DEFAULT NULL::"public"."employer_role_tag"[], "p_trade_caps" "text"[] DEFAULT NULL::"text"[]) RETURNS "public"."employers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Update employer record using provided JSON keys
  UPDATE public.employers e
  SET
    name = COALESCE(NULLIF(p_update->>'name',''), e.name),
    employer_type = COALESCE(NULLIF(p_update->>'employer_type',''), e.employer_type),
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
    updated_at = now()
  WHERE e.id = p_employer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employer not found';
  END IF;

  -- Sync role tags
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

  -- Sync trade capabilities
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


ALTER FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_caps" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_types" "public"."trade_type"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check permissions
  IF NOT (get_user_role(auth.uid()) = ANY (ARRAY['admin','organiser'])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Update employer with proper type casting
  UPDATE public.employers e
  SET 
    name = COALESCE(p_update->>'name', e.name),
    employer_type = COALESCE((p_update->>'employer_type')::employer_type, e.employer_type),
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
    updated_at = now()
  WHERE e.id = p_employer_id;

  -- Handle role tags
  IF p_role_tags IS NOT NULL THEN
    -- Delete existing tags
    DELETE FROM public.employer_role_tags WHERE employer_id = p_employer_id;
    
    -- Insert new tags
    IF array_length(p_role_tags, 1) > 0 THEN
      INSERT INTO public.employer_role_tags (employer_id, tag)
      SELECT p_employer_id, unnest(p_role_tags);
    END IF;
  END IF;

  -- Handle trade capabilities
  IF p_trade_types IS NOT NULL THEN
    -- Delete existing capabilities
    DELETE FROM public.contractor_trade_capabilities WHERE employer_id = p_employer_id;
    
    -- Insert new capabilities
    IF array_length(p_trade_types, 1) > 0 THEN
      INSERT INTO public.contractor_trade_capabilities (employer_id, trade_type, is_primary)
      SELECT p_employer_id, unnest(p_trade_types), false;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_types" "public"."trade_type"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_user_scoping"("_user_id" "uuid", "_scoped_employers" "uuid"[], "_scoped_sites" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.profiles
  SET scoped_employers = COALESCE(_scoped_employers, '{}')::uuid[],
      scoped_sites = COALESCE(_scoped_sites, '{}')::uuid[],
      updated_at = now()
  WHERE id = _user_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_user_scoping"("_user_id" "uuid", "_scoped_employers" "uuid"[], "_scoped_sites" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[], "p_overwrite" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_geometries geometry[];
  v_final_geometry geometry;
  v_existing_geom geometry;
BEGIN
  -- Convert array of GeoJSON to array of valid geometries
  v_new_geometries := ARRAY(
    SELECT ST_MakeValid(ST_GeomFromGeoJSON(feature_geom))
    FROM unnest(p_feature_geometries_geojson) AS feature_geom
  );

  -- Union the new geometries together
  v_final_geometry := ST_Union(v_new_geometries);

  IF NOT p_overwrite THEN
    -- If not overwriting, union with existing geometry
    SELECT geom INTO v_existing_geom FROM patches WHERE id = p_patch_id;
    IF v_existing_geom IS NOT NULL THEN
      v_final_geometry := ST_Union(v_existing_geom, v_final_geometry);
    END IF;
  END IF;

  -- Update the patch with the final geometry
  UPDATE patches
  SET geom = v_final_geometry
  WHERE id = p_patch_id;

END;
$$;


ALTER FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[], "p_overwrite" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_geometry_collection_geojson" "jsonb", "p_overwrite" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_geom geometry;
  v_existing_geom geometry;
  v_final_geometry geometry;
BEGIN
  -- Convert GeoJSON GeometryCollection to a single PostGIS geometry
  v_new_geom := ST_GeomFromGeoJSON(p_geometry_collection_geojson);

  -- Union all the components of the collection into a single geometry (e.g. MultiPolygon)
  v_new_geom := ST_Union(ST_MakeValid(v_new_geom));
  
  IF p_overwrite THEN
    v_final_geometry := v_new_geom;
  ELSE
    SELECT geom INTO v_existing_geom FROM patches WHERE id = p_patch_id;
    IF v_existing_geom IS NOT NULL THEN
      v_final_geometry := ST_Union(v_existing_geom, v_new_geom);
    ELSE
      v_final_geometry := v_new_geom;
    END IF;
  END IF;

  -- Update the patch with the final geometry
  UPDATE patches
  SET geom = v_final_geometry
  WHERE id = p_patch_id;

END;
$$;


ALTER FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_geometry_collection_geojson" "jsonb", "p_overwrite" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_geometries_to_patch_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[], "p_overwrite" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_geoms geometry[];
  v_union geometry;
  v_existing_geom geometry;
BEGIN
  v_new_geoms := ARRAY(
    SELECT ST_GeomFromText(wkt, 4326)
    FROM unnest(p_geometries_wkt) AS wkt
  );
  v_union := ST_Union(v_new_geoms);
  IF p_overwrite THEN
    UPDATE patches SET geom = v_union WHERE id = p_patch_id;
  ELSE
    SELECT geom INTO v_existing_geom FROM patches WHERE id = p_patch_id;
    IF v_existing_geom IS NOT NULL THEN
      UPDATE patches SET geom = ST_Union(v_existing_geom, v_union) WHERE id = p_patch_id;
    ELSE
      UPDATE patches SET geom = v_union WHERE id = p_patch_id;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."apply_geometries_to_patch_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[], "p_overwrite" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_organising_universe_rules_retrospectively"("p_dry_run" boolean DEFAULT true, "p_applied_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_record RECORD;
  update_result JSONB;
  total_updated INTEGER := 0;
  total_eligible INTEGER := 0;
  results JSONB := '[]'::JSONB;
  summary JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚀 APPLYING ORGANIZING UNIVERSE RULES';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Dry Run: %', p_dry_run;
  RAISE NOTICE '';
  
  -- Process each eligible project
  FOR project_record IN 
    SELECT id, name, tier, organising_universe
    FROM projects 
    WHERE tier IS NOT NULL
    AND should_auto_update_organising_universe(id) = TRUE
    ORDER BY tier, name
  LOOP
    total_eligible := total_eligible + 1;
    
    IF NOT p_dry_run THEN
      -- Actually apply the update
      update_result := update_organising_universe_with_rules(
        project_record.id, 
        TRUE, -- Respect manual overrides
        p_applied_by
      );
      
      IF (update_result->>'updated')::BOOLEAN THEN
        total_updated := total_updated + 1;
        results := results || jsonb_build_array(update_result);
      END IF;
    ELSE
      -- Dry run - just log what would happen
      update_result := jsonb_build_object(
        'project_id', project_record.id,
        'project_name', project_record.name,
        'current_value', project_record.organising_universe,
        'calculated_value', calculate_default_organising_universe(project_record.id),
        'would_update', true
      );
      
      results := results || jsonb_build_array(update_result);
      total_updated := total_updated + 1;
      
      RAISE NOTICE 'DRY RUN: % (%) → %', 
        project_record.name,
        COALESCE(project_record.organising_universe::text, 'NULL'),
        calculate_default_organising_universe(project_record.id);
    END IF;
  END LOOP;
  
  -- Create summary
  summary := jsonb_build_object(
    'dry_run', p_dry_run,
    'total_eligible', total_eligible,
    'total_updated', total_updated,
    'applied_by', p_applied_by,
    'applied_at', NOW(),
    'changes', results
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 SUMMARY:';
  RAISE NOTICE '   Eligible Projects: %', total_eligible;
  RAISE NOTICE '   % Updated: %', 
    CASE WHEN p_dry_run THEN 'Would Be' ELSE 'Actually' END,
    total_updated;
  RAISE NOTICE '';
  
  IF p_dry_run THEN
    RAISE NOTICE '💡 This was a DRY RUN - no changes were made';
    RAISE NOTICE '✅ To apply for real, run:';
    RAISE NOTICE '   SELECT apply_organising_universe_rules_retrospectively(FALSE, auth.uid());';
  ELSE
    RAISE NOTICE '✅ CHANGES APPLIED SUCCESSFULLY';
    RAISE NOTICE '📋 Check audit log: SELECT * FROM organising_universe_change_log ORDER BY applied_at DESC;';
  END IF;
  
  RETURN summary;
END;
$$;


ALTER FUNCTION "public"."apply_organising_universe_rules_retrospectively"("p_dry_run" boolean, "p_applied_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_pending_user_on_login"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_role text;
  v_pending_id uuid;
begin
  -- Get current user's email (if available)
  begin
    v_email := (select auth.email());
  exception when others then
    v_email := null;
  end;
  if v_email is null then
    return;
  end if;

  -- If a pending row exists for this email, apply the role to the profile
  select id, role into v_pending_id, v_role
  from pending_users
  where lower(email) = lower(v_email)
  order by invited_at desc nulls last, created_at desc
  limit 1;

  if v_role is null then
    return;
  end if;

  -- Set live profile role based on pending record
  update profiles set role = v_role where id = auth.uid();

  -- If the user is a pending organiser becoming live, migrate any live-lead ↔ draft-organiser links
  if v_pending_id is not null and v_role = 'organiser' then
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select l.lead_user_id, auth.uid(), coalesce(l.assigned_by, auth.uid())
    from lead_draft_organiser_links l
    where l.pending_user_id = v_pending_id
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
      and l.lead_user_id is not null
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Soft-close the draft links for audit (those which have been migrated)
    update lead_draft_organiser_links
      set is_active = false, end_date = current_date
      where pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date) and lead_user_id is not null;
  end if;

  -- If the user is a pending lead_becoming live, migrate draft lead links
  if v_pending_id is not null and v_role = 'lead_organiser' then
    -- Convert draft lead -> live organiser links into live role_hierarchy
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select auth.uid(), l.organiser_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Convert draft lead -> draft organiser links into live lead ↔ draft organiser links
    insert into lead_draft_organiser_links(lead_user_id, pending_user_id, assigned_by)
    select auth.uid(), l.organiser_pending_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_pending_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict do nothing;

    -- Soft-close all processed draft lead links
    update draft_lead_organiser_links
      set is_active = false, end_date = current_date
      where draft_lead_pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date);
  end if;
end;
$$;


ALTER FUNCTION "public"."apply_pending_user_on_login"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_project_compliance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Archive current record
  UPDATE project_compliance 
  SET is_current = false, 
      effective_to = now() 
  WHERE project_id = NEW.project_id 
    AND is_current = true 
    AND id != NEW.id;
    
  NEW.version = COALESCE((
    SELECT MAX(version) + 1 
    FROM project_compliance 
    WHERE project_id = NEW.project_id
  ), 1);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."archive_project_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM assign_contractor_role(p_project_id, p_employer_id, 'builder', p_company_name, true);
END; $$;


ALTER FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") IS 'Assigns builders to projects, handling multiple builders by making additional ones head contractors';



CREATE OR REPLACE FUNCTION "public"."assign_bci_trade_contractor"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_stage" "text" DEFAULT 'other'::"text", "p_estimated_workforce" numeric DEFAULT NULL::numeric, "p_company_name" "text" DEFAULT 'Unknown'::"text", "p_match_confidence" numeric DEFAULT 0.8, "p_match_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if assignment already exists
  IF EXISTS (SELECT 1 FROM project_contractor_trades
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND trade_type=p_trade_type) THEN
    RETURN QUERY SELECT true, format('%s already assigned to %s trade', p_company_name, p_trade_type);
    RETURN;
  END IF;

  INSERT INTO project_contractor_trades(
    project_id,
    employer_id,
    trade_type,
    stage,
    estimated_project_workforce,
    source,
    match_status,
    match_confidence,
    matched_at,
    match_notes
  )
  VALUES (
    p_project_id,
    p_employer_id,
    p_trade_type,
    p_stage::trade_stage,
    p_estimated_workforce,
    'bci_import',
    'auto_matched',
    p_match_confidence,
    now(),
    COALESCE(p_match_notes, format('Auto-matched from BCI import: %s trade', p_trade_type))
  );

  RETURN QUERY SELECT true, format('Assigned %s to %s trade (auto-matched)', p_company_name, p_trade_type);
END; $$;


ALTER FUNCTION "public"."assign_bci_trade_contractor"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_stage" "text", "p_estimated_workforce" numeric, "p_company_name" "text", "p_match_confidence" numeric, "p_match_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean DEFAULT false, "p_estimated_workers" integer DEFAULT NULL::integer) RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE role_id uuid;
BEGIN
  SELECT id INTO role_id FROM contractor_role_types WHERE code=p_role_code AND is_active=true;
  IF role_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid contractor role: %s', p_role_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND contractor_role_type_id=role_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned as %s', p_company_name, p_role_code); RETURN;
  END IF;

  INSERT INTO project_assignments(project_id,employer_id,assignment_type,contractor_role_type_id,is_primary_for_role,estimated_workers)
  VALUES (p_project_id,p_employer_id,'contractor_role',role_id,p_is_primary,p_estimated_workers);

  RETURN QUERY SELECT true, format('Assigned %s as %s', p_company_name, p_role_code);
END; $$;


ALTER FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean DEFAULT false, "p_estimated_workers" integer DEFAULT NULL::integer, "p_source" "text" DEFAULT 'bci_import'::"text", "p_match_confidence" numeric DEFAULT 0.8, "p_match_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE role_id uuid;
BEGIN
  SELECT id INTO role_id FROM contractor_role_types WHERE code=p_role_code AND is_active=true;
  IF role_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid contractor role: %s', p_role_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND contractor_role_type_id=role_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned as %s', p_company_name, p_role_code); RETURN;
  END IF;

  INSERT INTO project_assignments(
    project_id,
    employer_id,
    assignment_type,
    contractor_role_type_id,
    is_primary_for_role,
    estimated_workers,
    source,
    match_status,
    match_confidence,
    matched_at,
    match_notes
  )
  VALUES (
    p_project_id,
    p_employer_id,
    'contractor_role',
    role_id,
    p_is_primary,
    p_estimated_workers,
    p_source,
    'auto_matched',
    p_match_confidence,
    now(),
    COALESCE(p_match_notes, format('Auto-matched from BCI import: %s role', p_role_code))
  );

  RETURN QUERY SELECT true, format('Assigned %s as %s (auto-matched)', p_company_name, p_role_code);
END; $$;


ALTER FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Simple insert with conflict handling - allows multiple trades per employer
  INSERT INTO project_contractor_trades (project_id, employer_id, trade_type)
  VALUES (p_project_id, p_employer_id, p_trade_type)
  ON CONFLICT (project_id, employer_id, trade_type) DO NOTHING;
  
  -- Check if the record exists (either just inserted or already existed)
  IF EXISTS (
    SELECT 1 FROM project_contractor_trades 
    WHERE project_id = p_project_id 
      AND employer_id = p_employer_id 
      AND trade_type = p_trade_type
  ) THEN
    RETURN QUERY SELECT TRUE, format('Assigned %s to %s trade on project', p_company_name, p_trade_type);
  ELSE
    RETURN QUERY SELECT FALSE, format('Failed to assign %s to %s trade', p_company_name, p_trade_type);
  END IF;
END;
$$;


ALTER FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") IS 'Assigns trade types to contractors, allows multiple trades per employer per project, prevents duplicate assignments';



CREATE OR REPLACE FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer DEFAULT NULL::integer, "p_eba_signatory" "text" DEFAULT 'not_specified'::"text", "p_stage" "text" DEFAULT 'structure'::"text") RETURNS TABLE("success" boolean, "project_role_id" "uuid", "site_trade_id" "uuid", "project_trade_id" "uuid", "assignment_id" "uuid", "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_project_role_id uuid;
  v_site_trade_id uuid;
  v_project_trade_id uuid;
  v_assignment_id uuid;
  v_message text := 'Successfully assigned contractor';
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, 'Project not found';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.job_sites WHERE id = p_job_site_id AND project_id = p_project_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, 'Job site not found or not part of project';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.employers WHERE id = p_employer_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, 'Employer not found';
    RETURN;
  END IF;
  
  -- 1. Assign to project_employer_roles (if not already assigned)
  INSERT INTO public.project_employer_roles (project_id, employer_id, role, start_date)
  VALUES (p_project_id, p_employer_id, 'contractor', CURRENT_DATE)
  ON CONFLICT (project_id, employer_id, role) DO NOTHING
  RETURNING id INTO v_project_role_id;
  
  -- If no ID returned, get the existing one
  IF v_project_role_id IS NULL THEN
    SELECT id INTO v_project_role_id 
    FROM public.project_employer_roles 
    WHERE project_id = p_project_id AND employer_id = p_employer_id AND role = 'contractor';
  END IF;
  
  -- 2. Assign to site_contractor_trades
  INSERT INTO public.site_contractor_trades (job_site_id, employer_id, trade_type, eba_signatory)
  VALUES (p_job_site_id, p_employer_id, p_trade_type::public.trade_type, p_eba_signatory::public.eba_signatory_status)
  ON CONFLICT (job_site_id, employer_id, trade_type) DO UPDATE SET
    eba_signatory = EXCLUDED.eba_signatory,
    updated_at = NOW()
  RETURNING id INTO v_site_trade_id;
  
  -- 3. Assign to project_contractor_trades with unique assignment_id (NEW - supports multiple trade types)
  v_assignment_id := gen_random_uuid();
  
  INSERT INTO public.project_contractor_trades (
    project_id, employer_id, trade_type, stage, estimated_project_workforce, 
    eba_signatory, assignment_id, created_at, assignment_notes
  )
  VALUES (
    p_project_id, p_employer_id, p_trade_type::public.trade_type, 
    p_stage::public.trade_stage, p_estimated_workforce, 
    p_eba_signatory::public.eba_signatory_status,
    v_assignment_id, now(), 
    format('Unified assignment - %s', p_trade_type)
  )
  RETURNING id INTO v_project_trade_id;
  
  IF p_estimated_workforce IS NOT NULL AND p_estimated_workforce > 0 THEN
    v_message := format('Successfully assigned contractor with %s estimated workers', p_estimated_workforce);
  END IF;
  
  RETURN QUERY SELECT true, v_project_role_id, v_site_trade_id, v_project_trade_id, v_assignment_id, v_message;
END;
$$;


ALTER FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text", "p_stage" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text", "p_stage" "text") IS 'Enhanced unified contractor assignment function supporting multiple trade types per employer via assignment_id';



CREATE OR REPLACE FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text" DEFAULT 'structure'::"text", "p_estimated_workforce" integer DEFAULT NULL::integer, "p_eba_signatory" "text" DEFAULT 'not_specified'::"text") RETURNS TABLE("assignment_id" "uuid", "trade_type" "text", "success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  trade_type_item text;
  new_assignment_id uuid;
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RETURN QUERY SELECT NULL::uuid, '', false, 'Project not found';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM employers WHERE id = p_employer_id) THEN
    RETURN QUERY SELECT NULL::uuid, '', false, 'Employer not found';
    RETURN;
  END IF;

  -- Assign each trade type
  FOREACH trade_type_item IN ARRAY p_trade_types
  LOOP
    new_assignment_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO project_contractor_trades (
        project_id, employer_id, trade_type, stage, 
        estimated_project_workforce, eba_signatory,
        assignment_id, created_at, assignment_notes
      )
      VALUES (
        p_project_id, p_employer_id, trade_type_item::trade_type, 
        p_stage::trade_stage, p_estimated_workforce, 
        p_eba_signatory::eba_signatory_status,
        new_assignment_id, now(),
        format('BCI import - %s assignment', trade_type_item)
      );
      
      RETURN QUERY SELECT new_assignment_id, trade_type_item, true, 'Successfully assigned';
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT new_assignment_id, trade_type_item, false, 
        format('Failed: %s', SQLERRM);
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text") IS 'Assigns multiple trade types to a single employer on a project, creating separate assignment records for each';



CREATE OR REPLACE FUNCTION "public"."assign_patches_for_all_job_sites"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.job_sites js
  set patch_id = p.id
  from public.patches p
  where js.geom is not null
    and p.geom is not null
    and st_covers(p.geom, js.geom);
end;
$$;


ALTER FUNCTION "public"."assign_patches_for_all_job_sites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer DEFAULT NULL::integer) RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE trade_id uuid;
BEGIN
  SELECT id INTO trade_id FROM trade_types WHERE code=p_trade_code AND is_active=true;
  IF trade_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid trade type: %s', p_trade_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND trade_type_id=trade_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned to %s trade', p_company_name, p_trade_code); RETURN;
  END IF;

  INSERT INTO project_assignments(project_id,employer_id,assignment_type,trade_type_id,estimated_workers)
  VALUES (p_project_id,p_employer_id,'trade_work',trade_id,p_estimated_workers);

  RETURN QUERY SELECT true, format('Assigned %s to %s trade', p_company_name, p_trade_code);
END; $$;


ALTER FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer DEFAULT NULL::integer, "p_source" "text" DEFAULT 'bci_import'::"text", "p_match_confidence" numeric DEFAULT 0.8, "p_match_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE trade_id uuid;
BEGIN
  SELECT id INTO trade_id FROM trade_types WHERE code=p_trade_code AND is_active=true;
  IF trade_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid trade type: %s', p_trade_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND trade_type_id=trade_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned to %s trade', p_company_name, p_trade_code); RETURN;
  END IF;

  INSERT INTO project_assignments(
    project_id,
    employer_id,
    assignment_type,
    trade_type_id,
    estimated_workers,
    source,
    match_status,
    match_confidence,
    matched_at,
    match_notes
  )
  VALUES (
    p_project_id,
    p_employer_id,
    'trade_work',
    trade_id,
    p_estimated_workers,
    p_source,
    'auto_matched',
    p_match_confidence,
    now(),
    COALESCE(p_match_notes, format('Auto-matched from BCI import: %s trade', p_trade_code))
  );

  RETURN QUERY SELECT true, format('Assigned %s to %s trade (auto-matched)', p_company_name, p_trade_code);
END; $$;


ALTER FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_refresh_employer_list_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only refresh if the view is more than 10 minutes old
    IF (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(computed_at))) FROM employer_list_view) > 600 THEN
        PERFORM refresh_employer_list_view();
    END IF;
END;
$$;


ALTER FUNCTION "public"."auto_refresh_employer_list_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_site_contractors_for_single_site"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_site_count integer;
BEGIN
  -- Count sites for this project after the insert
  SELECT COUNT(*) INTO v_site_count
  FROM public.job_sites
  WHERE project_id = NEW.project_id;

  -- If this is the only site for the project, copy all project-level contractor trades to this site
  IF v_site_count = 1 THEN
    INSERT INTO public.site_contractor_trades (job_site_id, employer_id, trade_type, eba_signatory, start_date, end_date)
    SELECT NEW.id, pct.employer_id, pct.trade_type::public.trade_type, COALESCE(pct.eba_signatory, 'not_specified'::public.eba_status_type), pct.start_date, pct.end_date
    FROM public.project_contractor_trades pct
    WHERE pct.project_id = NEW.project_id
    AND NOT EXISTS (
      SELECT 1 FROM public.site_contractor_trades sct
      WHERE sct.job_site_id = NEW.id
        AND sct.employer_id = pct.employer_id
        AND sct.trade_type = pct.trade_type::public.trade_type
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."backfill_site_contractors_for_single_site"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_assign_projects_to_patches"() RETURNS TABLE("assigned" integer, "errors" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  project_record record;
  patch_record record;
  assigned_count integer := 0;
  error_count integer := 0;
begin
  for project_record in
    select 
      js.id as site_id,
      js.project_id,
      js.latitude,
      js.longitude
    from job_sites js
    where js.patch_id is null
      and js.latitude is not null
      and js.longitude is not null
  loop
    begin
      -- Find containing patch
      select p.id, p.name into patch_record
      from patches p
      where p.type = 'geo'
        and p.status = 'active'
        and ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(project_record.longitude, project_record.latitude), 4326))
      limit 1;
      
      if found then
        -- Update job site with patch assignment
        update job_sites 
        set patch_id = patch_record.id
        where id = project_record.site_id;
        
        assigned_count := assigned_count + 1;
      end if;
      
    exception when others then
      error_count := error_count + 1;
      -- Log error details if needed
      raise notice 'Error assigning project %: %', project_record.project_id, sqlerrm;
    end;
  end loop;
  
  return query select assigned_count, error_count;
end;
$$;


ALTER FUNCTION "public"."bulk_assign_projects_to_patches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_set_organising_universe_manual"("p_project_ids" "uuid"[], "p_universe" "text", "p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_id UUID;
  result JSONB;
  results JSONB := '[]'::JSONB;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOREACH project_id IN ARRAY p_project_ids
  LOOP
    result := set_organising_universe_manual(project_id, p_universe, p_user_id, p_reason);
    
    IF (result->>'success')::BOOLEAN THEN
      success_count := success_count + 1;
    ELSE
      error_count := error_count + 1;
    END IF;
    
    results := results || jsonb_build_array(result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_projects', array_length(p_project_ids, 1),
    'success_count', success_count,
    'error_count', error_count,
    'results', results
  );
END;
$$;


ALTER FUNCTION "public"."bulk_set_organising_universe_manual"("p_project_ids" "uuid"[], "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_default_organising_universe"("p_project_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_tier TEXT;
  project_name TEXT;
  has_eba_builder BOOLEAN := FALSE;
  has_patch_assignment BOOLEAN := FALSE;
  result_universe TEXT;
  builder_name TEXT;
BEGIN
  -- Get project details
  SELECT tier, name INTO project_tier, project_name 
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_tier IS NULL THEN
    RETURN 'potential';
  END IF;
  
  -- Check for EBA active builder/main contractor
  SELECT EXISTS (
    SELECT 1 
    FROM project_assignments pa
    JOIN company_eba_records cer ON cer.employer_id = pa.employer_id
    WHERE pa.project_id = p_project_id 
    AND pa.assignment_type = 'contractor_role'
    AND pa.is_primary_for_role = true
    AND cer.fwc_certified_date IS NOT NULL
  ) INTO has_eba_builder;
  
  -- FIXED: Use direct job_sites.patch_id instead of linking table
  SELECT EXISTS (
    SELECT 1 
    FROM job_sites js
    WHERE js.project_id = p_project_id
    AND js.patch_id IS NOT NULL
  ) INTO has_patch_assignment;
  
  -- Apply business rules
  CASE 
    WHEN project_tier = 'tier_1' THEN
      result_universe := 'active';
    WHEN project_tier IN ('tier_2', 'tier_3') AND has_eba_builder AND has_patch_assignment THEN
      result_universe := 'active';
    WHEN project_tier IN ('tier_2', 'tier_3') AND has_patch_assignment AND NOT has_eba_builder THEN
      result_universe := 'potential';
    WHEN project_tier = 'tier_3' AND NOT has_eba_builder AND NOT has_patch_assignment THEN
      result_universe := 'excluded';
    ELSE
      result_universe := 'potential';
  END CASE;
  
  RAISE DEBUG 'Project %: tier=%, eba=%, patch=% → %', 
    project_name, project_tier, has_eba_builder, has_patch_assignment, result_universe;
  
  RETURN result_universe;
END;
$$;


ALTER FUNCTION "public"."calculate_default_organising_universe"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_eba_recency_score"("eba_record" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    max_timestamp BIGINT := 0;
    temp_timestamp BIGINT;
    date_fields TEXT[] := ARRAY[
        'fwc_certified_date',
        'eba_lodged_fwc', 
        'date_eba_signed',
        'date_vote_occurred',
        'date_vote_occured'
    ];
    field TEXT;
BEGIN
    -- Handle null input
    IF eba_record IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Check each date field and find the maximum timestamp
    FOREACH field IN ARRAY date_fields LOOP
        IF eba_record ? field AND eba_record->>field IS NOT NULL AND eba_record->>field != '' THEN
            BEGIN
                temp_timestamp := EXTRACT(EPOCH FROM (eba_record->>field)::TIMESTAMP) * 1000;
                IF temp_timestamp > max_timestamp THEN
                    max_timestamp := temp_timestamp;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Skip invalid dates
                    CONTINUE;
            END;
        END IF;
    END LOOP;
    
    RETURN max_timestamp;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$;


ALTER FUNCTION "public"."calculate_eba_recency_score"("eba_record" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_tier" "text" DEFAULT NULL::"text", "p_stage" "text" DEFAULT NULL::"text", "p_universe" "text" DEFAULT 'active'::"text", "p_eba_filter" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_user_role" "text" DEFAULT NULL::"text") RETURNS TABLE("eba_projects_percentage" integer, "eba_projects_count" integer, "total_active_projects" integer, "known_builder_percentage" integer, "known_builder_count" integer, "key_contractor_coverage_percentage" integer, "mapped_key_contractors" integer, "total_key_contractor_slots" integer, "key_contractor_eba_builder_percentage" integer, "key_contractors_on_eba_builder_projects" integer, "total_key_contractors_on_eba_builder_projects" integer, "key_contractor_eba_percentage" integer, "key_contractors_with_eba" integer, "total_mapped_key_contractors" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  key_contractor_trades TEXT[] := ARRAY['demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 'tower_crane', 'mobile_crane'];
  key_contractor_roles TEXT[] := ARRAY['head_contractor', 'builder'];
BEGIN
  RETURN QUERY
  WITH filtered_projects AS (
    SELECT DISTINCT p.id, p.name, p.organising_universe, p.stage_class, p.tier
    FROM projects p
    LEFT JOIN job_sites js ON js.project_id = p.id
    LEFT JOIN patch_job_sites pjs ON pjs.job_site_id = js.id AND pjs.effective_to IS NULL
    WHERE p.organising_universe::text = COALESCE(p_universe, 'active')
      AND (p_tier IS NULL OR p.tier::text = COALESCE(p_tier, p.tier::text))
      AND (p_stage IS NULL OR p.stage_class::text = COALESCE(p_stage, p.stage_class::text))
      AND (p_patch_ids IS NULL OR pjs.patch_id = ANY(p_patch_ids))
  ),
  project_builders AS (
    SELECT 
      fp.id as project_id,
      pa.employer_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM company_eba_records cer 
        WHERE cer.employer_id = pa.employer_id 
        AND cer.fwc_certified_date IS NOT NULL
      ) THEN true ELSE false END as has_eba
    FROM filtered_projects fp
    LEFT JOIN project_assignments pa ON pa.project_id = fp.id 
      AND pa.assignment_type = 'contractor_role'
    LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id 
      AND pa.is_primary_for_role = true
  ),
  project_metrics AS (
    SELECT 
      fp.id as project_id,
      -- EBA projects (builder has EBA)
      CASE WHEN pb.has_eba = true THEN 1 ELSE 0 END as is_eba_project,
      -- Known builder projects  
      CASE WHEN pb.employer_id IS NOT NULL THEN 1 ELSE 0 END as has_known_builder,
      -- Key contractor metrics calculation
      (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
      ) as mapped_key_contractors_count,
      (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
        AND EXISTS (
          SELECT 1 FROM company_eba_records cer 
          WHERE cer.employer_id = pa2.employer_id 
          AND cer.fwc_certified_date IS NOT NULL
        )
      ) as key_contractors_with_eba_count,
      -- Key contractors on EBA builder projects
      CASE WHEN pb.has_eba = true THEN (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
      ) ELSE 0 END as key_contractors_on_eba_builder_project,
      CASE WHEN pb.has_eba = true THEN (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
        AND EXISTS (
          SELECT 1 FROM company_eba_records cer 
          WHERE cer.employer_id = pa2.employer_id 
          AND cer.fwc_certified_date IS NOT NULL
        )
      ) ELSE 0 END as key_contractors_with_eba_on_eba_builder_project
    FROM filtered_projects fp
    LEFT JOIN project_builders pb ON pb.project_id = fp.id
  ),
  aggregated_metrics AS (
    SELECT 
      COUNT(*) as total_projects,
      SUM(is_eba_project) as eba_projects,
      SUM(has_known_builder) as known_builders,
      SUM(mapped_key_contractors_count) as total_mapped_key_contractors,
      SUM(key_contractors_with_eba_count) as total_key_contractors_with_eba,
      SUM(key_contractors_on_eba_builder_project) as total_key_contractors_on_eba_projects,
      SUM(key_contractors_with_eba_on_eba_builder_project) as total_key_contractors_eba_on_eba_projects,
      COUNT(*) * 9 as total_key_contractor_slots
    FROM project_metrics
  )
  SELECT 
    CASE WHEN am.total_projects > 0 THEN ROUND((am.eba_projects::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    am.eba_projects::INTEGER,
    am.total_projects::INTEGER,
    CASE WHEN am.total_projects > 0 THEN ROUND((am.known_builders::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    am.known_builders::INTEGER,
    CASE WHEN am.total_key_contractor_slots > 0 THEN ROUND((am.total_mapped_key_contractors::DECIMAL / am.total_key_contractor_slots) * 100) ELSE 0 END::INTEGER,
    am.total_mapped_key_contractors::INTEGER,
    am.total_key_contractor_slots::INTEGER,
    CASE WHEN am.total_key_contractors_on_eba_projects > 0 THEN ROUND((am.total_key_contractors_eba_on_eba_projects::DECIMAL / am.total_key_contractors_on_eba_projects) * 100) ELSE 0 END::INTEGER,
    am.total_key_contractors_eba_on_eba_projects::INTEGER,
    am.total_key_contractors_on_eba_projects::INTEGER,
    CASE WHEN am.total_mapped_key_contractors > 0 THEN ROUND((am.total_key_contractors_with_eba::DECIMAL / am.total_mapped_key_contractors) * 100) ELSE 0 END::INTEGER,
    am.total_key_contractors_with_eba::INTEGER,
    am.total_mapped_key_contractors::INTEGER
  FROM aggregated_metrics am;
END;
$$;


ALTER FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[], "p_tier" "text", "p_stage" "text", "p_universe" "text", "p_eba_filter" "text", "p_user_id" "uuid", "p_user_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[], "p_tier" "text", "p_stage" "text", "p_universe" "text", "p_eba_filter" "text", "p_user_id" "uuid", "p_user_role" "text") IS 'Optimized server-side calculation of organizing universe metrics with filtering support';



CREATE OR REPLACE FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  with me as (
    select role, scoped_sites, scoped_employers from public.profiles where id = auth.uid()
  )
  select
    (select role = 'admin' from me)
    or exists (
      select 1 from me
      where scoped_employers = '{}'::uuid[]
         or target_employer_id = any (scoped_employers)
         or exists (
             select 1
             from public.site_contractor_trades sct
             where sct.employer_id = target_employer_id
               and (scoped_sites = '{}'::uuid[] or sct.job_site_id = any (scoped_sites))
         )
    )
    or exists (
      select 1
      from public.role_hierarchy rh
      join public.profiles child on child.id = rh.child_user_id
      where rh.parent_user_id = auth.uid()
        and (
          child.scoped_employers = '{}'::uuid[]
          or target_employer_id = any (child.scoped_employers)
          or exists (
              select 1
              from public.site_contractor_trades sct
              where sct.employer_id = target_employer_id
                and (child.scoped_sites = '{}'::uuid[] or sct.job_site_id = any (child.scoped_sites))
          )
        )
    );
$$;


ALTER FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  with me as (
    select role, scoped_sites from public.profiles where id = auth.uid()
  )
  select
    (select role = 'admin' from me)
    or exists (
      select 1 from me
      where scoped_sites = '{}'::uuid[] or target_job_site_id = any (scoped_sites)
    )
    or exists (
      select 1
      from public.role_hierarchy rh
      join public.profiles child on child.id = rh.child_user_id
      where rh.parent_user_id = auth.uid()
        and (child.scoped_sites = '{}'::uuid[] or target_job_site_id = any (child.scoped_sites))
    );
$$;


ALTER FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_organiser"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    auth.uid() = target_user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1
      from public.role_hierarchy rh
      where rh.parent_user_id = auth.uid()
        and rh.child_user_id = target_user_id
    );
$$;


ALTER FUNCTION "public"."can_access_organiser"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_worker"("target_worker_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  with me as (
    select role, scoped_sites, scoped_employers from public.profiles where id = auth.uid()
  )
  select
    (select role = 'admin' from me)
    or exists (
      select 1
      from public.worker_placements wp
      join me on true
      where wp.worker_id = target_worker_id
        and (
          scoped_sites = '{}'::uuid[] or scoped_employers = '{}'::uuid[]
          or wp.job_site_id = any (scoped_sites)
          or wp.employer_id = any (scoped_employers)
        )
    )
    or exists (
      select 1
      from public.role_hierarchy rh
      join public.profiles child on child.id = rh.child_user_id
      join public.worker_placements wp on wp.worker_id = target_worker_id
      where rh.parent_user_id = auth.uid()
        and (
          child.scoped_sites = '{}'::uuid[] or child.scoped_employers = '{}'::uuid[]
          or wp.job_site_id = any (child.scoped_sites)
          or wp.employer_id = any (child.scoped_employers)
        )
    );
$$;


ALTER FUNCTION "public"."can_access_worker"("target_worker_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_materialized_view_staleness"() RETURNS TABLE("view_name" "text", "record_count" bigint, "minutes_old" numeric, "needs_refresh" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.view_name::text,
        v.record_count,
        EXTRACT(EPOCH FROM (NOW() - v.last_computed)) / 60 as minutes_old,
        (EXTRACT(EPOCH FROM (NOW() - v.last_computed)) / 60) > 60 as needs_refresh
    FROM (
        SELECT 'employer_list_view' as view_name, 
               COUNT(*) as record_count, 
               MAX(computed_at) as last_computed 
        FROM employer_list_view
        UNION ALL
        SELECT 'worker_list_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM worker_list_view
        UNION ALL  
        SELECT 'project_list_comprehensive_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM project_list_comprehensive_view
        UNION ALL
        SELECT 'site_visit_list_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM site_visit_list_view
        UNION ALL
        SELECT 'patch_project_mapping_view', 
               COUNT(*), 
               NULL::timestamp with time zone
        FROM patch_project_mapping_view
    ) v;
END;
$$;


ALTER FUNCTION "public"."check_materialized_view_staleness"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_organising_universe_automation"("p_confirm_clear" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  clear_count INTEGER;
BEGIN
  IF p_confirm_clear IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Clear not confirmed. Set p_confirm_clear = TRUE to proceed'
    );
  END IF;
  
  -- Reset all automation flags
  UPDATE projects 
  SET 
    organising_universe_auto_assigned = FALSE,
    organising_universe_manual_override = FALSE,
    organising_universe_last_auto_update = NULL,
    organising_universe_change_reason = NULL;
  
  GET DIAGNOSTICS clear_count = ROW_COUNT;
  
  -- Clear audit log
  DELETE FROM organising_universe_change_log;
  
  RAISE NOTICE 'Cleared automation settings for % projects', clear_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'cleared_count', clear_count,
    'message', 'All organizing universe automation cleared'
  );
END;
$$;


ALTER FUNCTION "public"."clear_organising_universe_automation"("p_confirm_clear" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update lead_organiser_patch_assignments
    set effective_to = now()
    where lead_organiser_id = p_lead and patch_id = p_patch and effective_to is null;
$$;


ALTER FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update organiser_patch_assignments
     set effective_to = now()
   where organiser_id = p_org
     and patch_id = p_patch
     and effective_to is null;
$$;


ALTER FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_patch_employer"("p_patch" "uuid", "p_emp" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update patch_employers
    set effective_to = now()
    where patch_id = p_patch and employer_id = p_emp and effective_to is null;
$$;


ALTER FUNCTION "public"."close_patch_employer"("p_patch" "uuid", "p_emp" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_patch_site"("p_patch" "uuid", "p_site" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update patch_job_sites
    set effective_to = now()
    where patch_id = p_patch and job_site_id = p_site and effective_to is null;
$$;


ALTER FUNCTION "public"."close_patch_site"("p_patch" "uuid", "p_site" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_eba_records_after_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.refresh_employer_eba_status(coalesce(new.employer_id, old.employer_id));
  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."company_eba_records_after_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_assignment"("assignment_table" "text", "assignment_id" "uuid", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF assignment_table = 'project_assignments' THEN
    UPDATE public.project_assignments 
    SET 
      match_status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = user_id
    WHERE id = assignment_id;
  ELSIF assignment_table = 'project_contractor_trades' THEN
    UPDATE public.project_contractor_trades 
    SET 
      match_status = 'confirmed',
      confirmed_at = now(), 
      confirmed_by = user_id
    WHERE id = assignment_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."confirm_assignment"("assignment_table" "text", "assignment_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consolidate_duplicate_assignments"() RETURNS TABLE("duplicates_removed" integer, "assignments_merged" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  dupe_count integer := 0;
  merge_count integer := 0;
BEGIN
  -- Remove exact duplicates in site_contractor_trades (keeping the first one)
  DELETE FROM public.site_contractor_trades sct1
  WHERE EXISTS (
    SELECT 1 FROM public.site_contractor_trades sct2
    WHERE sct2.job_site_id = sct1.job_site_id
    AND sct2.employer_id = sct1.employer_id
    AND sct2.trade_type = sct1.trade_type
    AND sct2.id < sct1.id  -- Keep the older record
  );
  
  GET DIAGNOSTICS dupe_count = ROW_COUNT;
  
  -- Merge project_contractor_trades with same employer/project/trade but different stages
  -- This is more complex - for now, we'll just identify them
  -- TODO: Implement intelligent merging logic based on business rules
  
  RETURN QUERY SELECT dupe_count, merge_count;
END;
$$;


ALTER FUNCTION "public"."consolidate_duplicate_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_patch_with_geometry"("p_name" "text", "p_code" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT 'geo'::"text", "p_geometry" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_patch_id uuid;
BEGIN
    INSERT INTO patches (
        name, 
        code, 
        type, 
        description, 
        created_by,
        geom
    ) VALUES (
        p_name,
        COALESCE(p_code, 'PATCH_' || gen_random_uuid()::text),
        p_type,
        p_description,
        p_created_by,
        CASE 
            WHEN p_geometry IS NOT NULL THEN ST_GeomFromText(p_geometry, 4326)
            ELSE NULL
        END
    ) RETURNING id INTO v_patch_id;
    
    RETURN v_patch_id;
END;
$$;


ALTER FUNCTION "public"."create_patch_with_geometry"("p_name" "text", "p_code" "text", "p_type" "text", "p_geometry" "text", "p_description" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_project_cascade"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- First, clear the main_job_site_id reference to break the circular constraint
  UPDATE projects 
  SET main_job_site_id = NULL 
  WHERE id = p_project_id;
  
  -- Delete all job sites associated with this project
  DELETE FROM job_sites 
  WHERE project_id = p_project_id;
  
  -- Delete project contractor trades
  DELETE FROM project_contractor_trades 
  WHERE project_id = p_project_id;
  
  -- Delete project employer roles
  DELETE FROM project_employer_roles 
  WHERE project_id = p_project_id;
  
  -- Delete project organisers
  DELETE FROM project_organisers 
  WHERE project_id = p_project_id;
  
  -- Delete project builder JV metadata
  DELETE FROM project_builder_jv 
  WHERE project_id = p_project_id;
  
  -- Delete project EBA details
  DELETE FROM project_eba_details 
  WHERE project_id = p_project_id;
  
  -- Finally, delete the project itself
  DELETE FROM projects 
  WHERE id = p_project_id;
  
  -- Log the deletion (optional)
  RAISE NOTICE 'Project % and all related data deleted successfully', p_project_id;
END;
$$;


ALTER FUNCTION "public"."delete_project_cascade"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_project_contractor_from_site"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Find the project for the site
  SELECT project_id INTO v_project_id
  FROM public.job_sites
  WHERE id = NEW.job_site_id;

  IF v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure a corresponding project-level record exists
  INSERT INTO public.project_contractor_trades (project_id, employer_id, trade_type, eba_signatory)
  SELECT v_project_id, NEW.employer_id, NEW.trade_type::text, COALESCE(NEW.eba_signatory, 'not_specified'::public.eba_status_type)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_contractor_trades pct
    WHERE pct.project_id = v_project_id
      AND pct.employer_id = NEW.employer_id
      AND pct.trade_type = NEW.trade_type::text
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_project_contractor_from_site"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_patch_for_coordinates"("lat" double precision, "lng" double precision) RETURNS TABLE("id" "uuid", "name" "text", "distance" double precision)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select 
    p.id,
    p.name,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      p.geom::geography
    ) as distance
  from patches p
  where p.type = 'geo' 
    and p.status = 'active'
    and ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  order by distance asc;
end;
$$;


ALTER FUNCTION "public"."find_patch_for_coordinates"("lat" double precision, "lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_compliance_alerts"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Clear old unacknowledged alerts
  DELETE FROM compliance_alerts WHERE created_at < NOW() - INTERVAL '30 days' AND acknowledged = false;
  
  -- Generate overdue CBUS/INCOLINK check alerts
  INSERT INTO compliance_alerts (alert_type, severity, entity_type, entity_id, project_id, message, due_date)
  SELECT 
    'overdue_check',
    'warning',
    'employer',
    ecc.employer_id,
    ecc.project_id,
    'CBUS check overdue for ' || e.name,
    CURRENT_DATE
  FROM employer_compliance_checks ecc
  JOIN employers e ON e.id = ecc.employer_id
  WHERE ecc.is_current = true
    AND (ecc.cbus_check_date IS NULL OR ecc.cbus_check_date < CURRENT_DATE - INTERVAL '30 days')
  ON CONFLICT DO NOTHING;
  
  -- Add more alert generation logic...
END;
$$;


ALTER FUNCTION "public"."generate_compliance_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accessible_workers"("user_id" "uuid") RETURNS TABLE("worker_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT w.id AS worker_id
  FROM public.workers w
  WHERE public.is_admin()
     OR public.has_role(user_id, 'organiser')
     OR public.has_role(user_id, 'lead_organiser');
$$;


ALTER FUNCTION "public"."get_accessible_workers"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_setting"("_key" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select value from public.app_settings where key = _key;
$$;


ALTER FUNCTION "public"."get_app_setting"("_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_eba_category"("eba_record" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    today DATE := CURRENT_DATE;
    certified_date DATE;
    lodged_date DATE;
    vote_occurred_date DATE;
    signed_date DATE;
BEGIN
    -- Handle null input
    IF eba_record IS NULL THEN
        RETURN 'no';
    END IF;
    
    -- Extract and parse dates (handle both potential spellings)
    certified_date := (eba_record->>'fwc_certified_date')::DATE;
    lodged_date := (eba_record->>'eba_lodged_fwc')::DATE;
    vote_occurred_date := COALESCE(
        (eba_record->>'date_vote_occurred')::DATE,
        (eba_record->>'date_vote_occured')::DATE
    );
    signed_date := (eba_record->>'date_eba_signed')::DATE;
    
    -- Check for active EBA (within 4 years)
    IF certified_date IS NOT NULL AND certified_date >= (today - INTERVAL '4 years') THEN
        RETURN 'active';
    END IF;
    
    -- Check for lodged EBA (within 1 year)
    IF lodged_date IS NOT NULL AND lodged_date >= (today - INTERVAL '1 year') THEN
        RETURN 'lodged';
    END IF;
    
    -- Check for pending EBA (vote or signed within 6 months)
    IF (vote_occurred_date IS NOT NULL AND vote_occurred_date >= (today - INTERVAL '6 months'))
       OR (signed_date IS NOT NULL AND signed_date >= (today - INTERVAL '6 months')) THEN
        RETURN 'pending';
    END IF;
    
    -- Default to no EBA
    RETURN 'no';
    
EXCEPTION
    WHEN OTHERS THEN
        -- If date parsing fails, return 'no'
        RETURN 'no';
END;
$$;


ALTER FUNCTION "public"."get_eba_category"("eba_record" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employer_merge_impact"("p_employer_ids" "uuid"[]) RETURNS TABLE("employer_id" "uuid", "employer_name" "text", "worker_placements_count" integer, "project_roles_count" integer, "project_trades_count" integer, "site_trades_count" integer, "eba_records_count" integer, "site_visits_count" integer, "trade_capabilities_count" integer, "aliases_count" integer, "builder_projects_count" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as employer_id,
    e.name as employer_name,
    COALESCE(wp.count, 0)::INTEGER as worker_placements_count,
    COALESCE(per.count, 0)::INTEGER as project_roles_count,
    COALESCE(pct.count, 0)::INTEGER as project_trades_count,
    COALESCE(sct.count, 0)::INTEGER as site_trades_count,
    COALESCE(eba.count, 0)::INTEGER as eba_records_count,
    COALESCE(sv.count, 0)::INTEGER as site_visits_count,
    COALESCE(tc.count, 0)::INTEGER as trade_capabilities_count,
    COALESCE(ea.count, 0)::INTEGER as aliases_count,
    COALESCE(bp.count, 0)::INTEGER as builder_projects_count
  FROM employers e
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM worker_placements 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) wp ON e.id = wp.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM project_employer_roles 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) per ON e.id = per.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM project_contractor_trades 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) pct ON e.id = pct.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM site_contractor_trades 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) sct ON e.id = sct.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM company_eba_records 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) eba ON e.id = eba.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM site_visit 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) sv ON e.id = sv.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM contractor_trade_capabilities 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) tc ON e.id = tc.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM employer_aliases 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) ea ON e.id = ea.employer_id
  LEFT JOIN (
    SELECT builder_id as employer_id, COUNT(*) as count 
    FROM projects 
    WHERE builder_id = ANY(p_employer_ids)
    GROUP BY builder_id
  ) bp ON e.id = bp.employer_id
  WHERE e.id = ANY(p_employer_ids)
  ORDER BY e.name;
END;
$$;


ALTER FUNCTION "public"."get_employer_merge_impact"("p_employer_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid" DEFAULT NULL::"uuid", "p_filters" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("patch_id" "uuid", "patch_name" "text", "organiser_names" "text"[], "project_count" integer, "eba_projects_count" integer, "eba_projects_percentage" integer, "known_builder_count" integer, "known_builder_percentage" integer, "key_contractor_coverage" integer, "key_contractor_eba_percentage" integer, "last_updated" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  patch_ids_filter UUID[];
BEGIN
  -- Get relevant patches based on user role
  IF p_user_role = 'organiser' THEN
    -- Get patches assigned to this organiser
    SELECT ARRAY_AGG(opa.patch_id) INTO patch_ids_filter
    FROM organiser_patch_assignments opa
    WHERE opa.organiser_id = p_user_id AND opa.effective_to IS NULL;
  ELSIF p_user_role = 'lead_organiser' THEN
    -- Get patches assigned to this lead organiser
    SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
    FROM lead_organiser_patch_assignments lopa
    WHERE lopa.lead_organiser_id = COALESCE(p_lead_organiser_id, p_user_id) 
    AND lopa.effective_to IS NULL;
  ELSIF p_user_role = 'admin' THEN
    -- Admin can see all patches, optionally filtered by lead organiser
    IF p_lead_organiser_id IS NOT NULL THEN
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = p_lead_organiser_id AND lopa.effective_to IS NULL;
    ELSE
      patch_ids_filter := NULL; -- No filter = all patches
    END IF;
  END IF;

  RETURN QUERY
  WITH relevant_patches AS (
    SELECT p.id, p.name
    FROM patches p
    WHERE (patch_ids_filter IS NULL OR p.id = ANY(patch_ids_filter))
  ),
  patch_projects AS (
    SELECT 
      rp.id as patch_id,
      rp.name as patch_name,
      COUNT(DISTINCT proj.id) as total_projects,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM project_assignments pa
          JOIN contractor_roles cr ON cr.id = pa.contractor_role_id
          WHERE pa.project_id = proj.id 
          AND pa.assignment_type = 'contractor_role' 
          AND cr.is_primary = true
          AND EXISTS (
            SELECT 1 FROM company_eba_records cer 
            WHERE cer.employer_id = pa.employer_id 
            AND cer.fwc_certified_date IS NOT NULL
          )
        ) THEN proj.id 
      END) as eba_projects,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM project_assignments pa
          JOIN contractor_roles cr ON cr.id = pa.contractor_role_id
          WHERE pa.project_id = proj.id 
          AND pa.assignment_type = 'contractor_role' 
          AND cr.is_primary = true
        ) THEN proj.id 
      END) as known_builder_projects
    FROM relevant_patches rp
    LEFT JOIN patch_job_sites pjs ON pjs.patch_id = rp.id AND pjs.effective_to IS NULL
    LEFT JOIN job_sites js ON js.id = pjs.job_site_id
    LEFT JOIN projects proj ON proj.id = js.project_id
    WHERE proj.organising_universe::text = 'active'
      AND (p_filters IS NULL OR (
        (p_filters->>'tier' IS NULL OR proj.tier::text = (p_filters->>'tier'))
        AND (p_filters->>'stage' IS NULL OR proj.stage_class::text = (p_filters->>'stage'))
        AND (p_filters->>'universe' IS NULL OR proj.organising_universe::text = (p_filters->>'universe'))
      ))
    GROUP BY rp.id, rp.name
  ),
  patch_organisers AS (
    SELECT 
      rp.id as patch_id,
      ARRAY_AGG(DISTINCT pr.full_name ORDER BY pr.full_name) as organiser_names
    FROM relevant_patches rp
    LEFT JOIN organiser_patch_assignments opa ON opa.patch_id = rp.id AND opa.effective_to IS NULL
    LEFT JOIN profiles pr ON pr.id = opa.organiser_id
    GROUP BY rp.id
  )
  SELECT 
    pp.patch_id,
    pp.patch_name,
    COALESCE(po.organiser_names, ARRAY[]::TEXT[]),
    pp.total_projects::INTEGER,
    pp.eba_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.eba_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    pp.known_builder_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.known_builder_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    0::INTEGER, -- key_contractor_coverage (calculated separately if needed)
    0::INTEGER, -- key_contractor_eba_percentage (calculated separately if needed)  
    NOW() as last_updated
  FROM patch_projects pp
  LEFT JOIN patch_organisers po ON po.patch_id = pp.patch_id
  ORDER BY pp.patch_name;
END;
$$;


ALTER FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid", "p_filters" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid", "p_filters" "jsonb") IS 'Role-based patch summaries with project counts and EBA metrics for dashboard';



CREATE OR REPLACE FUNCTION "public"."get_patches_with_geometry_text"() RETURNS TABLE("id" "uuid", "name" "text", "code" "text", "type" "text", "status" "text", "geom" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    p.id,
    p.name,
    p.code,
    p.type,
    p.status,
    ST_AsText(p.geom) as geom
  from public.patches p
  where p.type = 'geo'
    and p.status = 'active'
    and p.geom is not null
  order by p.name
$$;


ALTER FUNCTION "public"."get_patches_with_geometry_text"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_counts"() RETURNS TABLE("organising_universe" "text", "stage_class" "text", "count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    p.organising_universe::text,
    p.stage_class::text,
    COUNT(*) as count
  FROM projects p
  WHERE p.organising_universe IS NOT NULL 
    AND p.stage_class IS NOT NULL
  GROUP BY p.organising_universe, p.stage_class
  ORDER BY p.organising_universe, p.stage_class;
$$;


ALTER FUNCTION "public"."get_project_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_delete_impact"("p_project_id" "uuid") RETURNS TABLE("site_count" integer, "site_contractor_trades_count" integer, "site_contacts_count" integer, "site_employers_count" integer, "union_activities_count" integer, "worker_placements_count" integer, "project_contractor_trades_count" integer, "project_employer_roles_count" integer, "project_organisers_count" integer, "project_builder_jv_count" integer, "project_eba_details_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (get_user_role(auth.uid()) = ANY (ARRAY['admin','organiser'])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  WITH sites AS (
    SELECT id FROM public.job_sites WHERE project_id = p_project_id
  )
  SELECT
    (SELECT COUNT(*) FROM sites) AS site_count,
    (SELECT COUNT(*) FROM public.site_contractor_trades WHERE job_site_id IN (SELECT id FROM sites)) AS site_contractor_trades_count,
    (SELECT COUNT(*) FROM public.site_contacts WHERE job_site_id IN (SELECT id FROM sites)) AS site_contacts_count,
    (SELECT COUNT(*) FROM public.site_employers WHERE job_site_id IN (SELECT id FROM sites)) AS site_employers_count,
    (SELECT COUNT(*) FROM public.union_activities WHERE job_site_id IN (SELECT id FROM sites)) AS union_activities_count,
    (SELECT COUNT(*) FROM public.worker_placements WHERE job_site_id IN (SELECT id FROM sites)) AS worker_placements_count,
    (SELECT COUNT(*) FROM public.project_contractor_trades WHERE project_id = p_project_id) AS project_contractor_trades_count,
    (SELECT COUNT(*) FROM public.project_employer_roles WHERE project_id = p_project_id) AS project_employer_roles_count,
    (SELECT COUNT(*) FROM public.project_organisers WHERE project_id = p_project_id) AS project_organisers_count,
    (SELECT COUNT(*) FROM public.project_builder_jv WHERE project_id = p_project_id) AS project_builder_jv_count,
    (SELECT COUNT(*) FROM public.project_eba_details WHERE project_id = p_project_id) AS project_eba_details_count;
END;
$$;


ALTER FUNCTION "public"."get_project_delete_impact"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_employers_unknown_eba"() RETURNS TABLE("id" "uuid", "name" "text", "project_count" integer, "eba_status" "text", "projects" json)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH project_employers AS (
    -- Get employers from project_employer_roles
    SELECT DISTINCT 
      e.id,
      e.name,
      e.enterprise_agreement_status
    FROM employers e
    INNER JOIN project_employer_roles per ON e.id = per.employer_id
    
    UNION
    
    -- Get employers from project_contractor_trades
    SELECT DISTINCT 
      e.id,
      e.name,
      e.enterprise_agreement_status
    FROM employers e
    INNER JOIN project_contractor_trades pct ON e.id = pct.employer_id
    
    UNION
    
    -- Get employers from projects.builder_id
    SELECT DISTINCT 
      e.id,
      e.name,
      e.enterprise_agreement_status
    FROM employers e
    INNER JOIN projects p ON e.id = p.builder_id
  ),
  employer_projects AS (
    SELECT 
      pe.id,
      pe.name,
      pe.enterprise_agreement_status,
      COUNT(proj.id) as project_count,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', proj.id,
          'name', proj.name
        ) ORDER BY proj.name
      ) as projects
    FROM project_employers pe
    LEFT JOIN (
      -- Get all projects for each employer
      SELECT per.employer_id, p.id, p.name
      FROM project_employer_roles per
      JOIN projects p ON per.project_id = p.id
      
      UNION
      
      SELECT pct.employer_id, p.id, p.name
      FROM project_contractor_trades pct
      JOIN projects p ON pct.project_id = p.id
      
      UNION
      
      SELECT p.builder_id as employer_id, p.id, p.name
      FROM projects p
      WHERE p.builder_id IS NOT NULL
    ) proj ON pe.id = proj.employer_id
    GROUP BY pe.id, pe.name, pe.enterprise_agreement_status
  )
  SELECT 
    ep.id,
    ep.name,
    ep.project_count::INTEGER,
    COALESCE(ep.enterprise_agreement_status::TEXT, 'unknown') as eba_status,
    COALESCE(ep.projects, '[]'::JSON) as projects
  FROM employer_projects ep
  LEFT JOIN company_eba_records eba ON ep.id = eba.employer_id
  WHERE (eba.id IS NULL OR ep.enterprise_agreement_status IS NULL) -- No EBA records or status
    AND ep.project_count > 0 -- Must be connected to projects
  ORDER BY ep.project_count DESC, ep.name;
END;
$$;


ALTER FUNCTION "public"."get_project_employers_unknown_eba"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") RETURNS TABLE("known_employer_count" integer, "eba_active_count" integer, "eba_percentage" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_known_count integer := 0;
  v_eba_count integer := 0;
  v_percentage numeric := 0;
BEGIN
  -- Get subset employers for the project
  WITH subset_employers AS (
    -- 1. Builders from projects.builder_id (where employer_type = 'builder')
    SELECT DISTINCT e.id as employer_id, e.name, e.employer_type
    FROM projects p
    JOIN employers e ON e.id = p.builder_id
    WHERE p.id = p_project_id
      AND e.employer_type = 'builder'
    
    UNION
    
    -- 2. Project managers from project_assignments
    SELECT DISTINCT e.id as employer_id, e.name, e.employer_type
    FROM project_assignments pa
    JOIN employers e ON e.id = pa.employer_id
    JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
    WHERE pa.project_id = p_project_id
      AND pa.assignment_type = 'contractor_role'
      AND crt.code = 'project_manager'
    
    UNION
    
    -- 3. Trade contractors for specific trades from project_contractor_trades
    SELECT DISTINCT e.id as employer_id, e.name, e.employer_type
    FROM project_contractor_trades pct
    JOIN employers e ON e.id = pct.employer_id
    WHERE pct.project_id = p_project_id
      AND pct.trade_type IN ('demolition', 'piling', 'concrete', 'scaffolding', 'form_work', 'tower_crane', 'mobile_crane')
    
    UNION
    
    -- 4. Trade contractors from site_contractor_trades for project sites
    SELECT DISTINCT e.id as employer_id, e.name, e.employer_type
    FROM site_contractor_trades sct
    JOIN job_sites js ON js.id = sct.job_site_id
    JOIN employers e ON e.id = sct.employer_id
    WHERE js.project_id = p_project_id
      AND sct.trade_type IN ('demolition', 'piling', 'concrete', 'scaffolding', 'form_work', 'tower_crane', 'mobile_crane')
  ),
  eba_employers AS (
    -- Get subset employers that have active EBA records
    SELECT DISTINCT se.employer_id
    FROM subset_employers se
    JOIN company_eba_records cer ON cer.employer_id = se.employer_id
    -- Consider an EBA active if it has any of these statuses
    WHERE cer.fwc_certified_date IS NOT NULL 
       OR cer.date_eba_signed IS NOT NULL
       OR cer.eba_lodged_fwc IS NOT NULL
  )
  
  -- Calculate counts
  SELECT 
    COUNT(DISTINCT se.employer_id),
    COUNT(DISTINCT ee.employer_id)
  INTO v_known_count, v_eba_count
  FROM subset_employers se
  LEFT JOIN eba_employers ee ON ee.employer_id = se.employer_id;
  
  -- Calculate percentage
  IF v_known_count > 0 THEN
    v_percentage := ROUND((v_eba_count::numeric / v_known_count::numeric) * 100, 1);
  END IF;
  
  -- Return results
  RETURN QUERY SELECT v_known_count, v_eba_count, v_percentage;
END;
$$;


ALTER FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") IS 'Calculates known employer count and EBA percentage for builders, project managers, and specific trade types (demolition, piling, concrete, scaffolding, form_work, tower_crane, mobile_crane)';



CREATE OR REPLACE FUNCTION "public"."get_project_tier_color"("tier_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CASE tier_value
    WHEN 'tier_1' THEN 'red'
    WHEN 'tier_2' THEN 'orange'
    WHEN 'tier_3' THEN 'blue'
    ELSE 'gray'
  END;
END;
$$;


ALTER FUNCTION "public"."get_project_tier_color"("tier_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_tier_label"("tier_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CASE tier_value
    WHEN 'tier_1' THEN 'Tier 1'
    WHEN 'tier_2' THEN 'Tier 2'
    WHEN 'tier_3' THEN 'Tier 3'
    ELSE 'Unknown'
  END;
END;
$$;


ALTER FUNCTION "public"."get_project_tier_label"("tier_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) RETURNS TABLE("project_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT DISTINCT pa.project_id
  FROM project_assignments pa
  JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
  WHERE pa.project_id = ANY(project_ids)
  AND pa.assignment_type = 'contractor_role'
  AND crt.code IN ('builder', 'head_contractor')
  
  UNION
  
  -- Also check legacy projects.builder_id field for backward compatibility
  SELECT p.id as project_id
  FROM projects p
  WHERE p.id = ANY(project_ids)
  AND p.builder_id IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) IS 'Returns project IDs that have builder or head contractor assignments from either project_assignments table or legacy builder_id field';



CREATE OR REPLACE FUNCTION "public"."get_trade_type_enum"() RETURNS SETOF "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT unnest(enum_range(null::public.trade_type))::text;
$$;


ALTER FUNCTION "public"."get_trade_type_enum"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trade_type_enum"() IS 'Returns all available trade_type enum values. Updated to include 10 new trade types for BCI import compatibility.';



CREATE OR REPLACE FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") RETURNS TABLE("employer_id" "uuid", "employer_name" "text", "assignments" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH contractor_assignments AS (
    -- Project roles
    SELECT 
      per.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'project_role',
        'role', per.role,
        'start_date', per.start_date,
        'end_date', per.end_date
      ) as assignment
    FROM public.project_employer_roles per
    JOIN public.employers e ON e.id = per.employer_id
    WHERE per.project_id = p_project_id
    
    UNION ALL
    
    -- Site trades
    SELECT 
      sct.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'site_trade',
        'trade_type', sct.trade_type,
        'site_id', sct.job_site_id,
        'site_name', js.name,
        'eba_signatory', sct.eba_signatory
      ) as assignment
    FROM public.site_contractor_trades sct
    JOIN public.job_sites js ON js.id = sct.job_site_id
    JOIN public.employers e ON e.id = sct.employer_id
    WHERE js.project_id = p_project_id
    
    UNION ALL
    
    -- Project trades
    SELECT 
      pct.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'project_trade',
        'trade_type', pct.trade_type,
        'stage', pct.stage,
        'estimated_workforce', pct.estimated_project_workforce,
        'eba_signatory', pct.eba_signatory
      ) as assignment
    FROM public.project_contractor_trades pct
    JOIN public.employers e ON e.id = pct.employer_id
    WHERE pct.project_id = p_project_id
  )
  SELECT 
    ca.employer_id,
    ca.employer_name,
    jsonb_agg(ca.assignment ORDER BY ca.assignment->>'type') as assignments
  FROM contractor_assignments ca
  GROUP BY ca.employer_id, ca.employer_name
  ORDER BY ca.employer_name;
END;
$$;


ALTER FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") IS 'Returns all contractor assignments for a project in a unified format';



CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT role FROM public.profiles WHERE id = user_id;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_contractor_assignment_organising_universe_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  affected_project_id UUID;
  update_result JSONB;
BEGIN
  -- Get the project ID from the assignment
  IF TG_OP = 'INSERT' THEN
    affected_project_id := NEW.project_id;
  ELSIF TG_OP = 'UPDATE' THEN
    affected_project_id := NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_project_id := OLD.project_id;
  END IF;
  
  -- Only process contractor role assignments (builders/main contractors)
  IF (TG_OP = 'DELETE' AND OLD.assignment_type = 'contractor_role' AND OLD.is_primary_for_role = TRUE) OR
     (TG_OP != 'DELETE' AND NEW.assignment_type = 'contractor_role' AND NEW.is_primary_for_role = TRUE) THEN
    
    -- Update organizing universe for affected project
    update_result := update_organising_universe_with_rules(
      affected_project_id,
      TRUE, -- Respect manual overrides
      NULL  -- System update
    );
    
    IF (update_result->>'updated')::BOOLEAN THEN
      RAISE DEBUG 'Updated organizing universe for project % due to contractor assignment change', affected_project_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."handle_contractor_assignment_organising_universe_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_patch_assignment_organising_universe_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  affected_project_id UUID;
  update_result JSONB;
BEGIN
  -- Get the project ID from the job site
  IF TG_OP = 'INSERT' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = NEW.job_site_id;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = NEW.job_site_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = OLD.job_site_id;
  END IF;
  
  IF affected_project_id IS NOT NULL THEN
    -- Update organizing universe for affected project
    update_result := update_organising_universe_with_rules(
      affected_project_id,
      TRUE, -- Respect manual overrides
      NULL  -- System update
    );
    
    IF (update_result->>'updated')::BOOLEAN THEN
      RAISE DEBUG 'Updated organizing universe for project % due to patch assignment change', affected_project_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."handle_patch_assignment_organising_universe_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_project_organising_universe_auto_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  calculated_universe TEXT;
  should_assign BOOLEAN := FALSE;
BEGIN
  -- Only process if project has a tier
  IF NEW.tier IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if we should auto-assign
  IF TG_OP = 'INSERT' THEN
    -- New project - auto-assign if no universe specified
    should_assign := (NEW.organising_universe IS NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Updated project - only auto-assign if not manually overridden
    should_assign := (
      NEW.organising_universe_manual_override IS NOT TRUE
      AND (
        -- Tier changed
        OLD.tier IS DISTINCT FROM NEW.tier
        -- Or other relevant fields changed that we're not tracking yet
        -- (builder assignment changes will be handled separately)
      )
    );
  END IF;
  
  IF should_assign THEN
    calculated_universe := calculate_default_organising_universe(NEW.id);
    
    -- Update the organizing universe
    NEW.organising_universe := calculated_universe::public.organising_universe;
    NEW.organising_universe_auto_assigned := TRUE;
    NEW.organising_universe_last_auto_update := NOW();
    NEW.organising_universe_change_reason := format(
      'Auto-assigned on %s based on tier=%s rules', 
      CASE WHEN TG_OP = 'INSERT' THEN 'creation' ELSE 'update' END,
      NEW.tier
    );
    
    -- Log the change (for INSERT, this will happen after the row exists)
    IF TG_OP = 'UPDATE' THEN
      INSERT INTO organising_universe_change_log (
        project_id,
        old_value,
        new_value,
        change_reason,
        rule_applied,
        applied_by
      ) VALUES (
        NEW.id,
        OLD.organising_universe::text,
        calculated_universe,
        NEW.organising_universe_change_reason,
        'auto_trigger_on_update',
        NEW.updated_by -- Assuming you have updated_by column
      );
    END IF;
    
    RAISE DEBUG 'Auto-assigned organizing universe for project %: %', NEW.name, calculated_universe;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_project_organising_universe_auto_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = _user_id
      AND ura.role = _role
      AND ura.is_active
      AND ura.start_date <= CURRENT_DATE
      AND (ura.end_date IS NULL OR ura.end_date >= CURRENT_DATE)
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_site_access"("user_id" "uuid", "site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 
        CASE 
            WHEN public.get_user_role(user_id) = 'admin' THEN true
            WHEN public.get_user_role(user_id) = 'organiser' THEN 
                site_id = ANY(SELECT unnest(scoped_sites) FROM public.profiles WHERE id = user_id)
                OR array_length((SELECT scoped_sites FROM public.profiles WHERE id = user_id), 1) IS NULL
            ELSE false
        END;
$$;


ALTER FUNCTION "public"."has_site_access"("user_id" "uuid", "site_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."infer_project_classifications"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  s text;
  st text;
BEGIN
  -- Derive stage_class if not provided, using BCI stage/status text
  IF NEW.stage_class IS NULL THEN
    s := COALESCE(lower(NEW.project_stage), '');
    st := COALESCE(lower(NEW.project_status), '');
    IF st ~ '(cancel|complete|abandon|defer|hold)' OR s ~ '(complete|cancel|abandon|defer|hold)' THEN
      NEW.stage_class := 'archived';
    ELSIF s LIKE '%pre-construction%' THEN
      NEW.stage_class := 'pre_construction';
    ELSIF s LIKE '%construction%' THEN
      NEW.stage_class := 'construction';
    ELSIF s LIKE '%future%' THEN
      NEW.stage_class := 'future';
    ELSIF s ~ '(design|tender|award|planning|document)' THEN
      NEW.stage_class := 'pre_construction';
    ELSE
      NEW.stage_class := 'pre_construction';
    END IF;
  END IF;

  -- Derive organising_universe if not provided
  IF NEW.organising_universe IS NULL THEN
    -- Enhanced rule: Consider government projects with higher value threshold
    IF NEW.value IS NOT NULL AND (
         (NEW.value > 20000000 AND NEW.stage_class = 'construction') OR
         (NEW.value > 50000000 AND COALESCE(lower(NEW.owner_type_level_1), '') = 'government' AND NEW.stage_class IN ('construction', 'pre_construction'))
       ) THEN
      NEW.organising_universe := 'active';
    ELSE
      -- Default by stage_class
      IF NEW.stage_class = 'construction' THEN
        NEW.organising_universe := 'active';
      ELSIF NEW.stage_class = 'archived' THEN
        NEW.organising_universe := 'excluded';
      ELSE
        NEW.organising_universe := 'potential';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."infer_project_classifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_patch_from_geojson"("patch_code" "text", "patch_name" "text", "geojson_data" "text", "source_file" "text", "user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  patch_uuid UUID;
  patch_geom geometry;
BEGIN
  -- Generate UUID for the patch
  patch_uuid := gen_random_uuid();
  
  -- Convert GeoJSON to PostGIS geometry
  BEGIN
    patch_geom := ST_SetSRID(ST_GeomFromGeoJSON(geojson_data), 4326);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to convert GeoJSON to geometry: %', SQLERRM;
  END;
  
  -- Validate that it's a polygon
  IF ST_GeometryType(patch_geom) NOT IN ('ST_Polygon', 'ST_MultiPolygon') THEN
    RAISE EXCEPTION 'Only polygon geometries are supported, got: %', ST_GeometryType(patch_geom);
  END IF;
  
  -- Insert the patch
  INSERT INTO public.patches (
    id,
    code, 
    name,
    geom,
    source_kml_path,
    created_by,
    updated_by
  ) VALUES (
    patch_uuid,
    patch_code,
    patch_name,
    patch_geom,
    source_file,
    user_id,
    user_id
  );
  
  RETURN patch_uuid;
END;
$$;


ALTER FUNCTION "public"."insert_patch_from_geojson"("patch_code" "text", "patch_name" "text", "geojson_data" "text", "source_file" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_employer_engaged"("estimated_worker_count" integer, "worker_placement_count" integer, "project_assignment_count" integer, "eba_category" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    -- An employer is engaged if any of these conditions are true:
    -- 1. Has estimated workers > 0
    -- 2. Has actual worker placements > 0  
    -- 3. Has project assignments > 0
    -- 4. Has a recent EBA (not 'no')
    RETURN (
        COALESCE(estimated_worker_count, 0) > 0 
        OR COALESCE(worker_placement_count, 0) > 0
        OR COALESCE(project_assignment_count, 0) > 0  
        OR COALESCE(eba_category, 'no') != 'no'
    );
END;
$$;


ALTER FUNCTION "public"."is_employer_engaged"("estimated_worker_count" integer, "worker_placement_count" integer, "project_assignment_count" integer, "eba_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_lead"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'lead_organiser'
  );
$$;


ALTER FUNCTION "public"."is_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_lead_of"("_parent" "uuid", "_child" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_hierarchy rh
    WHERE rh.parent_user_id = _parent
      AND rh.child_user_id = _child
      AND rh.is_active
      AND rh.start_date <= CURRENT_DATE
      AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
  );
$$;


ALTER FUNCTION "public"."is_lead_of"("_parent" "uuid", "_child" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_sites_assign_patch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.geom is not null then
    -- Assign the first patch that covers the point (on-edge inclusive)
    select p.id into new.patch_id
    from public.patches p
    where p.geom is not null
      and st_covers(p.geom, new.geom)
    limit 1;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."job_sites_assign_patch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_sites_set_patch_from_coords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_patch_id uuid;
  v_fallback_patch_id uuid := 'b06b9622-024c-4cd7-8127-e4664f641034';
BEGIN
  -- Only assign if unset and coordinates present
  IF (new.patch_id IS NULL) AND (new.latitude IS NOT NULL) AND (new.longitude IS NOT NULL) THEN
    
    -- First try to find a geographic patch
    SELECT p.id
    INTO v_patch_id
    FROM public.patches p
    WHERE p.type = 'geo'
      AND p.status = 'active'
      AND p.geom IS NOT NULL
      AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326))
    LIMIT 1;

    -- If found, assign to geographic patch
    IF FOUND THEN
      new.patch_id := v_patch_id;
    ELSE
      -- If no geographic patch found, assign to fallback patch
      new.patch_id := v_fallback_patch_id;
      v_patch_id := v_fallback_patch_id;
    END IF;

    -- Keep link table in sync for downstream UIs
    BEGIN
      INSERT INTO public.patch_job_sites (patch_id, job_site_id)
      VALUES (v_patch_id, new.id)
      ON CONFLICT (patch_id, job_site_id)
        WHERE effective_to IS NULL
      DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- ignore duplicates or partial index differences
      NULL;
    END;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."job_sites_set_patch_from_coords"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_sites_sync_geom_latlng"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- If lat/lng present but geom is null, build geom
  if new.geom is null and new.longitude is not null and new.latitude is not null then
    new.geom := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326);
  end if;

  -- If geom is present, backfill lat/lng when missing
  if new.geom is not null then
    new.longitude := coalesce(new.longitude, st_x(new.geom));
    new.latitude  := coalesce(new.latitude,  st_y(new.geom));
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_sites_sync_geom_latlng"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_project_contractor_to_single_site"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_site_id uuid;
  v_site_count integer;
BEGIN
  -- Count sites for this project
  SELECT COUNT(*), (ARRAY_AGG(id ORDER BY created_at NULLS LAST, id))[1]
  INTO v_site_count, v_site_id
  FROM public.job_sites
  WHERE project_id = NEW.project_id;

  -- Only auto-link when there is exactly one site
  IF v_site_count = 1 AND v_site_id IS NOT NULL THEN
    INSERT INTO public.site_contractor_trades (job_site_id, employer_id, trade_type, eba_signatory)
    SELECT v_site_id, NEW.employer_id, NEW.trade_type::public.trade_type, COALESCE(NEW.eba_signatory, 'not_specified'::public.eba_status_type)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.site_contractor_trades sct
      WHERE sct.job_site_id = v_site_id
        AND sct.employer_id = NEW.employer_id
        AND sct.trade_type = NEW.trade_type::public.trade_type
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_project_contractor_to_single_site"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_assignment_auto_matched"("assignment_table" "text", "assignment_id" "uuid", "confidence" numeric DEFAULT 0.8, "notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF assignment_table = 'project_assignments' THEN
    UPDATE public.project_assignments 
    SET 
      source = 'bci_import',
      match_status = 'auto_matched',
      match_confidence = confidence,
      matched_at = now(),
      match_notes = notes
    WHERE id = assignment_id;
  ELSIF assignment_table = 'project_contractor_trades' THEN
    UPDATE public.project_contractor_trades 
    SET 
      source = 'bci_import', 
      match_status = 'auto_matched',
      match_confidence = confidence,
      matched_at = now(),
      match_notes = notes
    WHERE id = assignment_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."mark_assignment_auto_matched"("assignment_table" "text", "assignment_id" "uuid", "confidence" numeric, "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_job_sites_to_patches"() RETURNS TABLE("sites_processed" integer, "sites_matched" integer, "patches_used" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_processed integer := 0;
  v_matched integer := 0;
  v_patches_used integer := 0;
BEGIN
  -- Count sites before processing
  SELECT COUNT(*) INTO v_processed
  FROM job_sites
  WHERE patch_id IS NULL 
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL;

  -- Run the spatial matching
  UPDATE job_sites 
  SET patch_id = (
    SELECT p.id
    FROM patches p
    WHERE p.type = 'geo'
      AND p.status = 'active'
      AND p.geom IS NOT NULL
      AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(job_sites.longitude, job_sites.latitude), 4326))
    LIMIT 1
  )
  WHERE patch_id IS NULL 
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL;

  -- Sync the linking table
  INSERT INTO patch_job_sites (patch_id, job_site_id)
  SELECT js.patch_id, js.id
  FROM job_sites js
  LEFT JOIN patch_job_sites pjs 
    ON pjs.patch_id = js.patch_id 
    AND pjs.job_site_id = js.id 
    AND pjs.effective_to IS NULL
  WHERE js.patch_id IS NOT NULL 
    AND pjs.job_site_id IS NULL
  ON CONFLICT (patch_id, job_site_id) 
  WHERE effective_to IS NULL 
  DO NOTHING;

  -- Count results
  SELECT COUNT(*) INTO v_matched
  FROM job_sites
  WHERE patch_id IS NOT NULL;

  SELECT COUNT(DISTINCT patch_id) INTO v_patches_used
  FROM job_sites
  WHERE patch_id IS NOT NULL;

  RETURN QUERY SELECT v_processed, v_matched, v_patches_used;
END;
$$;


ALTER FUNCTION "public"."match_job_sites_to_patches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_employers"("p_primary_employer_id" "uuid", "p_duplicate_employer_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result JSON;
  v_relationships_moved INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_employer_name TEXT;
  v_duplicate_names TEXT[];
BEGIN
  -- Get employer names for logging
  SELECT name INTO v_employer_name FROM employers WHERE id = p_primary_employer_id;
  SELECT ARRAY_AGG(name) INTO v_duplicate_names FROM employers WHERE id = ANY(p_duplicate_employer_ids);
  
  -- Log the merge operation
  RAISE NOTICE 'Starting merge: Primary % (%), Duplicates: %', p_primary_employer_id, v_employer_name, v_duplicate_names;
  
  -- 1. Update worker_placements
  BEGIN
    UPDATE worker_placements 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % worker placements', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Worker placements: ' || SQLERRM);
  END;
  
  -- 2. Update project_employer_roles (handle duplicates)
  BEGIN
    -- First, delete any roles that would create duplicates
    DELETE FROM project_employer_roles 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (project_id, role) IN (
      SELECT project_id, role 
      FROM project_employer_roles 
      WHERE employer_id = p_primary_employer_id
    );
    
    -- Then update remaining roles
    UPDATE project_employer_roles 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project employer roles', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project roles: ' || SQLERRM);
  END;
  
  -- 3. Update project_contractor_trades (handle duplicates)
  BEGIN
    -- Delete trades that would create duplicates
    DELETE FROM project_contractor_trades 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (project_id, trade_type) IN (
      SELECT project_id, trade_type 
      FROM project_contractor_trades 
      WHERE employer_id = p_primary_employer_id
    );
    
    -- Update remaining trades
    UPDATE project_contractor_trades 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project contractor trades', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project trades: ' || SQLERRM);
  END;
  
  -- 4. Update site_contractor_trades (handle duplicates)
  BEGIN
    DELETE FROM site_contractor_trades 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (job_site_id, trade_type) IN (
      SELECT job_site_id, trade_type 
      FROM site_contractor_trades 
      WHERE employer_id = p_primary_employer_id
    );
    
    UPDATE site_contractor_trades 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % site contractor trades', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Site trades: ' || SQLERRM);
  END;
  
  -- 5. Update company_eba_records
  BEGIN
    UPDATE company_eba_records 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % EBA records', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('EBA records: ' || SQLERRM);
  END;
  
  -- 6. Update site_visit (if table exists)
  BEGIN
    UPDATE site_visit 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % site visits', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    -- Skip if table doesn't exist
    IF SQLSTATE = '42P01' THEN
      RAISE NOTICE 'site_visit table does not exist, skipping';
    ELSE
      v_errors := v_errors || ('Site visits: ' || SQLERRM);
    END IF;
  END;
  
  -- 7. Handle contractor_trade_capabilities (merge unique trades)
  BEGIN
    -- Insert unique trade capabilities from duplicates
    INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary, notes)
    SELECT 
      p_primary_employer_id,
      tc.trade_type,
      tc.is_primary,
      COALESCE(tc.notes, '') || ' (merged from duplicate employer)' as notes
    FROM contractor_trade_capabilities tc
    WHERE tc.employer_id = ANY(p_duplicate_employer_ids)
    AND NOT EXISTS (
      SELECT 1 FROM contractor_trade_capabilities existing
      WHERE existing.employer_id = p_primary_employer_id
      AND existing.trade_type = tc.trade_type
    );
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Added % unique trade capabilities', v_records_updated;
    
    -- Delete duplicate trade capabilities
    DELETE FROM contractor_trade_capabilities 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Trade capabilities: ' || SQLERRM);
  END;
  
  -- 8. Update employer_aliases (if table exists)
  BEGIN
    UPDATE employer_aliases 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % employer aliases', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    -- Skip if table doesn't exist
    IF SQLSTATE = '42P01' THEN
      RAISE NOTICE 'employer_aliases table does not exist, skipping';
    ELSE
      v_errors := v_errors || ('Aliases: ' || SQLERRM);
    END IF;
  END;
  
  -- 9. Update projects.builder_id
  BEGIN
    UPDATE projects 
    SET builder_id = p_primary_employer_id 
    WHERE builder_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project builder references', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project builders: ' || SQLERRM);
  END;
  
  -- 10. Create aliases for merged employer names (if table exists)
  BEGIN
    INSERT INTO employer_aliases (alias, alias_normalized, employer_id)
    SELECT 
      e.name as alias,
      LOWER(REGEXP_REPLACE(e.name, '[^a-zA-Z0-9\s]', '', 'g')) as alias_normalized,
      p_primary_employer_id
    FROM employers e
    WHERE e.id = ANY(p_duplicate_employer_ids)
    ON CONFLICT (alias_normalized) DO NOTHING;
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Created % new aliases', v_records_updated;
  EXCEPTION WHEN OTHERS THEN
    -- Skip if table doesn't exist
    IF SQLSTATE = '42P01' THEN
      RAISE NOTICE 'employer_aliases table does not exist, skipping';
    ELSE
      v_errors := v_errors || ('New aliases: ' || SQLERRM);
    END IF;
  END;
  
  -- 11. Finally, delete the duplicate employer records
  BEGIN
    DELETE FROM employers 
    WHERE id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate employer records', v_records_updated;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Delete duplicates: ' || SQLERRM);
  END;
  
  -- Return merge results
  SELECT json_build_object(
    'success', CASE WHEN array_length(v_errors, 1) IS NULL THEN true ELSE false END,
    'primary_employer_id', p_primary_employer_id,
    'merged_employer_ids', p_duplicate_employer_ids,
    'relationships_moved', v_relationships_moved,
    'records_updated', v_records_updated,
    'errors', v_errors
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."merge_employers"("p_primary_employer_id" "uuid", "p_duplicate_employer_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_patch_geometry"("p_patch_id" "uuid", "p_wkt" "text", "p_srid" integer DEFAULT 4326) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_new_geom geometry;
  v_existing_geom geometry;
  v_result_geom geometry;
begin
  if p_wkt is null or length(p_wkt) = 0 then
    return;
  end if;

  -- Parse the input geometry (untyped)
  v_new_geom := ST_SetSRID(ST_GeomFromText(p_wkt), p_srid);
  
  -- Make it valid
  v_new_geom := ST_MakeValid(v_new_geom);
  
  -- Convert to MultiPolygon explicitly
  if ST_GeometryType(v_new_geom) = 'ST_Polygon' then
    v_new_geom := ST_Multi(v_new_geom);
  end if;

  -- Get existing geometry (untyped)
  select geom::geometry into v_existing_geom 
  from public.patches 
  where id = p_patch_id;
  
  -- Merge geometries
  if v_existing_geom is null then
    v_result_geom := v_new_geom;
  else
    -- Convert existing to MultiPolygon if needed
    if ST_GeometryType(v_existing_geom) = 'ST_Polygon' then
      v_existing_geom := ST_Multi(v_existing_geom);
    end if;
    
    -- Union the geometries
    v_result_geom := ST_UnaryUnion(ST_Union(v_existing_geom, v_new_geom));
    v_result_geom := ST_MakeValid(v_result_geom);
  end if;

  -- Cast to MultiPolygon and update
  update public.patches 
  set geom = v_result_geom::geometry(MultiPolygon, 4326)
  where id = p_patch_id;
  
  if not found then
    raise exception 'Patch with id % not found', p_patch_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."merge_patch_geometry"("p_patch_id" "uuid", "p_wkt" "text", "p_srid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins_on_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_url text;
  v_secret text;
begin
  if new.status is distinct from 'requested' then
    return new;
  end if;

  v_url := public.get_app_setting('notify_admins_url');
  v_secret := public.get_app_setting('edge_function_secret');

  if v_url is null or v_url = '' then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json')
      || case when v_secret is null or v_secret = '' then '{}'::jsonb
              else jsonb_build_object('Authorization','Bearer '||v_secret) end,
    body := jsonb_build_object(
      'type','pending_user.requested',
      'id', new.id,
      'email', new.email,
      'full_name', new.full_name,
      'role', new.role,
      'notes', new.notes,
      'requested_at', new.updated_at
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_admins_on_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_kml_content"("kml_content" "text", "source_file" "text") RETURNS TABLE("patch_id" "uuid", "patch_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  geom_collection geometry;
  patch_geom geometry;
  patch_name TEXT;
  patch_code_val TEXT;
  patch_uuid UUID;
  counter INTEGER := 1;
  geom_dump RECORD;
BEGIN
  -- Extract geometry collection from KML content
  BEGIN
    geom_collection := ST_GeomFromKML(kml_content);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse KML content: %', SQLERRM;
  END;
  
  IF geom_collection IS NULL THEN
    RAISE EXCEPTION 'No valid geometry found in KML content';
  END IF;
  
  -- Handle multi-geometries by dumping them
  FOR geom_dump IN 
    SELECT (ST_Dump(geom_collection)).geom as geom
  LOOP
    patch_geom := geom_dump.geom;
    
    -- Only process polygons
    IF ST_GeometryType(patch_geom) IN ('ST_Polygon', 'ST_MultiPolygon') THEN
      patch_uuid := gen_random_uuid();
      patch_code_val := 'KML_' || LPAD(counter::text, 3, '0');
      patch_name := 'Imported Patch ' || counter;
      
      -- Insert into patches table with PostGIS geometry
      INSERT INTO public.patches (
        id,
        code, 
        name,
        geom,
        source_kml_path,
        created_by,
        updated_by
      ) VALUES (
        patch_uuid,
        patch_code_val,
        patch_name,
        patch_geom,
        source_file,
        auth.uid(),
        auth.uid()
      );
      
      counter := counter + 1;
      
      -- Return info about created patch
      patch_id := patch_uuid;
      patch_code := patch_code_val;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  IF counter = 1 THEN
    RAISE EXCEPTION 'No polygon geometries found in KML content';
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."parse_kml_content"("kml_content" "text", "source_file" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_profile_privilege_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Apply checks only when the user updates their own profile and is not admin
  IF auth.uid() = NEW.id AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Not allowed to change role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Not allowed to change is_active';
    END IF;
    IF NEW.scoped_sites IS DISTINCT FROM OLD.scoped_sites THEN
      RAISE EXCEPTION 'Not allowed to change scoped_sites';
    END IF;
    IF NEW.scoped_employers IS DISTINCT FROM OLD.scoped_employers THEN
      RAISE EXCEPTION 'Not allowed to change scoped_employers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_profile_privilege_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_time timestamp := clock_timestamp();
    view_count integer := 0;
BEGIN
    RAISE NOTICE 'Starting complete refresh of all materialized views at %', NOW();
    
    -- Refresh independent views in parallel-safe order
    PERFORM refresh_employer_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_worker_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_site_visit_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_patch_project_mapping_view();
    view_count := view_count + 1;
    
    -- Refresh project view last since it depends on others
    PERFORM refresh_project_list_comprehensive_view();
    view_count := view_count + 1;
    
    RAISE NOTICE 'Complete refresh finished: % views updated in % seconds', 
                 view_count, 
                 EXTRACT(EPOCH FROM clock_timestamp() - start_time);
END;
$$;


ALTER FUNCTION "public"."refresh_all_materialized_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_employer_eba_status"("p_employer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update employers e set enterprise_agreement_status = (
    exists (
      select 1
      from company_eba_records r
      where r.employer_id = p_employer_id
        and r.fwc_certified_date is not null
        and r.fwc_certified_date >= (current_date - interval '4 years')
    )
  )
  where e.id = p_employer_id;
end $$;


ALTER FUNCTION "public"."refresh_employer_eba_status"("p_employer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_employer_list_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW employer_list_view;
    RAISE NOTICE 'employer_list_view refreshed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."refresh_employer_list_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_employer_related_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Refresh views that depend on employer/EBA data
    PERFORM refresh_employer_list_view();
    
    -- Also refresh project view since it depends on employer enterprise_agreement_status
    PERFORM refresh_project_list_comprehensive_view();
    
    RAISE NOTICE 'Employer-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_employer_related_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_patch_project_mapping_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW patch_project_mapping_view;
    
    RAISE NOTICE 'Refreshed patch_project_mapping_view at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_patch_project_mapping_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_project_list_comprehensive_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW project_list_comprehensive_view;
    
    RAISE NOTICE 'Refreshed project_list_comprehensive_view at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_project_list_comprehensive_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_project_related_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Refresh project views and patch mappings
    PERFORM refresh_project_list_comprehensive_view();
    PERFORM refresh_patch_project_mapping_view();
    
    RAISE NOTICE 'Project-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_project_related_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_site_visit_list_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW site_visit_list_view;
    RAISE NOTICE 'site_visit_list_view refreshed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."refresh_site_visit_list_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_site_visit_related_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM refresh_site_visit_list_view();
    
    RAISE NOTICE 'Site visit views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_site_visit_related_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_worker_list_view"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW worker_list_view;
    RAISE NOTICE 'worker_list_view refreshed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."refresh_worker_list_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_worker_related_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Refresh views that depend on worker data
    PERFORM refresh_worker_list_view();
    
    -- Also refresh project view since it depends on worker counts
    PERFORM refresh_project_list_comprehensive_view();
    
    RAISE NOTICE 'Worker-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$;


ALTER FUNCTION "public"."refresh_worker_related_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_organising_universe_manual_override"("p_project_id" "uuid", "p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_name TEXT;
  current_value TEXT;
  calculated_value TEXT;
  update_result JSONB;
BEGIN
  -- Get current state
  SELECT name, organising_universe 
  INTO project_name, current_value
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;
  
  -- Remove manual override flag
  UPDATE projects 
  SET 
    organising_universe_manual_override = FALSE,
    organising_universe_change_reason = COALESCE(p_reason, 'Manual override removed - allowing auto-assignment'),
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Now apply automatic rules
  update_result := update_organising_universe_with_rules(p_project_id, FALSE, p_user_id);
  
  calculated_value := update_result->>'new_value';
  
  -- Log the override removal
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by,
    was_manual_override
  ) VALUES (
    p_project_id,
    current_value,
    calculated_value,
    COALESCE(p_reason, 'Manual override removed, auto-rules applied'),
    'remove_manual_override',
    p_user_id,
    FALSE
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'project_name', project_name,
    'old_value', current_value,
    'new_value', calculated_value,
    'message', format('Removed manual override, auto-assigned to %s', calculated_value)
  );
END;
$$;


ALTER FUNCTION "public"."remove_organising_universe_manual_override"("p_project_id" "uuid", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_trade_type_conflicts"() RETURNS TABLE("conflicts_found" integer, "conflicts_resolved" integer, "details" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  conflict_count integer := 0;
  resolved_count integer := 0;
BEGIN
  -- Count existing conflicts (same employer, project, trade, stage)
  SELECT COUNT(*) INTO conflict_count
  FROM (
    SELECT project_id, employer_id, trade_type, stage, COUNT(*) as count
    FROM project_contractor_trades
    GROUP BY project_id, employer_id, trade_type, stage
    HAVING COUNT(*) > 1
  ) conflicts;

  -- Resolve conflicts by ensuring each record has a unique assignment_id
  WITH ranked_trades AS (
    SELECT 
      id,
      project_id,
      employer_id, 
      trade_type,
      stage,
      ROW_NUMBER() OVER (
        PARTITION BY project_id, employer_id, trade_type, stage 
        ORDER BY COALESCE(updated_at, created_at, now()) DESC
      ) as rn
    FROM project_contractor_trades
    WHERE assignment_id IS NULL OR assignment_id IN (
      SELECT assignment_id 
      FROM project_contractor_trades 
      GROUP BY assignment_id 
      HAVING COUNT(*) > 1
    )
  )
  UPDATE project_contractor_trades pct
  SET 
    assignment_id = gen_random_uuid(),
    updated_at = now(),
    assignment_notes = CASE 
      WHEN rt.rn = 1 THEN 'Original assignment'
      ELSE 'Duplicate resolved - assignment ' || rt.rn 
    END
  FROM ranked_trades rt
  WHERE pct.id = rt.id;

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  RETURN QUERY SELECT conflict_count, resolved_count, 
    format('Found %s potential conflicts, updated %s records with unique assignment IDs', conflict_count, resolved_count);
END;
$$;


ALTER FUNCTION "public"."resolve_trade_type_conflicts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_organising_universe_changes"("p_confirm_rollback" boolean DEFAULT false, "p_applied_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  rollback_count INTEGER;
  backup_count INTEGER;
  project_record RECORD;
BEGIN
  -- Safety check
  IF p_confirm_rollback IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rollback not confirmed. Set p_confirm_rollback = TRUE to proceed'
    );
  END IF;
  
  -- Check if backup exists
  SELECT COUNT(*) INTO backup_count FROM projects_organising_universe_backup;
  
  IF backup_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No backup found. Cannot rollback safely.'
    );
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔄 ROLLING BACK ORGANIZING UNIVERSE CHANGES';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  
  -- Restore from backup
  FOR project_record IN 
    SELECT 
      p.id,
      p.name,
      p.organising_universe as current_value,
      b.organising_universe as backup_value
    FROM projects p
    JOIN projects_organising_universe_backup b ON b.id = p.id
    WHERE p.organising_universe::text IS DISTINCT FROM b.organising_universe::text
  LOOP
    -- Update project
    UPDATE projects 
    SET 
      organising_universe = project_record.backup_value::public.organising_universe,
      organising_universe_auto_assigned = FALSE,
      organising_universe_manual_override = TRUE, -- Mark as manual to prevent re-auto-assignment
      organising_universe_change_reason = 'Restored from backup via rollback function',
      organising_universe_last_auto_update = NULL,
      updated_at = NOW()
    WHERE id = project_record.id;
    
    -- Log the rollback
    INSERT INTO organising_universe_change_log (
      project_id,
      old_value,
      new_value,
      change_reason,
      rule_applied,
      applied_by
    ) VALUES (
      project_record.id,
      project_record.current_value,
      project_record.backup_value,
      'Rollback to original value',
      'rollback_function',
      p_applied_by
    );
    
    rollback_count := rollback_count + 1;
    
    RAISE NOTICE 'Rolled back %: % → %', 
      project_record.name, 
      project_record.current_value, 
      project_record.backup_value;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Rollback complete: % projects restored', rollback_count;
  RAISE NOTICE '';
  
  RETURN jsonb_build_object(
    'success', true,
    'rollback_count', rollback_count,
    'backup_count', backup_count,
    'message', format('Successfully rolled back %s projects to original values', rollback_count)
  );
END;
$$;


ALTER FUNCTION "public"."rollback_organising_universe_changes"("p_confirm_rollback" boolean, "p_applied_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_employers_by_exact_name"("name_query" "text") RETURNS SETOF "public"."employers"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.employers
    WHERE name ILIKE name_query;
END;
$$;


ALTER FUNCTION "public"."search_employers_by_exact_name"("name_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_employers_by_name_fuzzy"("search_term" "text") RETURNS SETOF "public"."employers"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.employers
    WHERE name ILIKE '%' || search_term || '%'
    ORDER BY name
    LIMIT 10; -- Limit results for performance in the UI
END;
$$;


ALTER FUNCTION "public"."search_employers_by_name_fuzzy"("search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_activities_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_activities_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organising_universe_manual"("p_project_id" "uuid", "p_universe" "text", "p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_name TEXT;
  old_value TEXT;
  new_value TEXT := p_universe;
BEGIN
  -- Get current state
  SELECT name, organising_universe 
  INTO project_name, old_value
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;
  
  -- Validate universe value
  IF p_universe NOT IN ('active', 'potential', 'excluded') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid universe value. Must be: active, potential, or excluded'
    );
  END IF;
  
  -- Update the project with manual override flag
  UPDATE projects 
  SET 
    organising_universe = new_value::public.organising_universe,
    organising_universe_manual_override = TRUE,
    organising_universe_auto_assigned = FALSE,
    organising_universe_change_reason = COALESCE(p_reason, format('Manually set to %s by user', new_value)),
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the manual change
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by,
    was_manual_override
  ) VALUES (
    p_project_id,
    old_value,
    new_value,
    COALESCE(p_reason, 'Manual override by user'),
    'manual_override',
    p_user_id,
    TRUE
  );
  
  RAISE NOTICE 'Manual override applied for project %: % → %', project_name, old_value, new_value;
  
  RETURN jsonb_build_object(
    'success', true,
    'project_name', project_name,
    'old_value', old_value,
    'new_value', new_value,
    'message', format('Successfully set organizing universe to %s', new_value)
  );
END;
$$;


ALTER FUNCTION "public"."set_organising_universe_manual"("p_project_id" "uuid", "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_overlay_images_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by = auth.uid();
    END IF;
    NEW.updated_by = auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_overlay_images_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_patch_geometries_from_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_geoms geometry[];
  v_union geometry;
  v_final_geom geometry;
BEGIN
  -- Convert array of WKT to array of geometries
  v_geoms := ARRAY(
    SELECT ST_GeomFromText(wkt, 4326)
    FROM unnest(p_geometries_wkt) AS wkt
  );

  -- Union all the geometries. This might result in a Polygon or MultiPolygon.
  v_union := ST_Union(v_geoms);

  -- Ensure the final geometry is always a MultiPolygon to match the column type.
  v_final_geom := ST_Multi(v_union);

  -- Update the patch with the final, correctly-typed geometry.
  UPDATE patches
  SET geom = v_final_geom
  WHERE id = p_patch_id;

END;
$$;


ALTER FUNCTION "public"."set_patch_geometries_from_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_patch_geometry_from_features"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_geoms geometry[];
  v_collection geometry;
  v_union geometry;
BEGIN
  -- Convert array of GeoJSON to array of geometries
  v_geoms := ARRAY(
    SELECT ST_GeomFromGeoJSON(feature_geom)
    FROM unnest(p_feature_geometries_geojson) AS feature_geom
  );

  -- Create a collection of the geometries
  v_collection := ST_Collect(v_geoms);

  -- Check for invalid geometries before unioning
  IF ST_IsValid(v_collection) THEN
    -- Union all geometries for the current patch
    v_union := ST_Union(v_collection);
    UPDATE patches
    SET geom = v_union
    WHERE id = p_patch_id;
  ELSE
    -- Attempt to make geometries valid
    v_collection := ST_MakeValid(v_collection);
    v_union := ST_Union(v_collection);
    UPDATE patches
    SET geom = v_union
    WHERE id = p_patch_id;
  END IF;

END;
$$;


ALTER FUNCTION "public"."set_patch_geometry_from_features"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_auto_update_organising_universe"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  manual_override BOOLEAN;
  current_value TEXT;
  calculated_value TEXT;
BEGIN
  -- Get current state
  SELECT 
    organising_universe_manual_override,
    organising_universe
  INTO manual_override, current_value
  FROM projects 
  WHERE id = p_project_id;
  
  -- Never update if user has manually overridden
  IF manual_override = TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- Get calculated value
  calculated_value := calculate_default_organising_universe(p_project_id);
  
  -- Only update if different from current value
  RETURN (current_value IS NULL OR current_value != calculated_value);
END;
$$;


ALTER FUNCTION "public"."should_auto_update_organising_universe"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_users"() RETURNS TABLE("synced_count" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sync_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Insert profiles for auth users that don't have them
  WITH missing_profiles AS (
    INSERT INTO public.profiles (id, email, full_name)
    SELECT 
      au.id,
      au.email,
      COALESCE(au.raw_user_meta_data->>'full_name', au.email)
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO sync_count FROM missing_profiles;
  
  RETURN QUERY SELECT sync_count, 
    CASE 
      WHEN sync_count > 0 THEN format('Synced %s users successfully', sync_count)
      ELSE 'All users already synced'
    END;
END;
$$;


ALTER FUNCTION "public"."sync_auth_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_employer_project_site_assignments"() RETURNS TABLE("synced_count" integer, "error_count" integer, "details" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sync_count integer := 0;
  err_count integer := 0;
  detail_msg text := '';
BEGIN
  -- Ensure all employers in site_contractor_trades are also in project_employer_roles
  INSERT INTO public.project_employer_roles (project_id, employer_id, role, start_date)
  SELECT DISTINCT 
    js.project_id,
    sct.employer_id,
    'contractor' as role,
    CURRENT_DATE as start_date
  FROM public.site_contractor_trades sct
  JOIN public.job_sites js ON js.id = sct.job_site_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_employer_roles per
    WHERE per.project_id = js.project_id 
    AND per.employer_id = sct.employer_id
  )
  ON CONFLICT (project_id, employer_id, role) DO NOTHING;
  
  GET DIAGNOSTICS sync_count = ROW_COUNT;
  
  detail_msg := format('Synced %s employer assignments from sites to projects', sync_count);
  
  RETURN QUERY SELECT sync_count, err_count, detail_msg;
END;
$$;


ALTER FUNCTION "public"."sync_employer_project_site_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_employer_role_tag_from_per"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND (NEW.role::text = 'builder' OR NEW.role::text = 'head_contractor') THEN
    INSERT INTO public.employer_role_tags (employer_id, tag)
    VALUES (NEW.employer_id, (NEW.role::text)::public.employer_role_tag)
    ON CONFLICT (employer_id, tag) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_employer_role_tag_from_per"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_trade_capability_from_pct"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.employer_id is not null and new.trade_type is not null then
    insert into public.contractor_trade_capabilities (employer_id, trade_type, is_primary)
    select new.employer_id, new.trade_type::public.trade_type, false
    where not exists (
      select 1
      from public.contractor_trade_capabilities c
      where c.employer_id = new.employer_id
        and c.trade_type = new.trade_type::public.trade_type
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_trade_capability_from_pct"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_refresh_employer_list_view"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Refresh the materialized view when key tables are modified
    PERFORM refresh_employer_list_view();
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_refresh_employer_list_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fwc_lookup_jobs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fwc_lookup_jobs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organising_universe_with_rules"("p_project_id" "uuid", "p_respect_manual_override" boolean DEFAULT true, "p_applied_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_value TEXT;
  calculated_value TEXT;
  project_name TEXT;
  change_reason TEXT;
  should_update BOOLEAN;
  result JSONB;
BEGIN
  -- Get current state
  SELECT organising_universe::text, name 
  INTO current_value, project_name
  FROM projects 
  WHERE id = p_project_id;
  
  -- Check if should update
  IF p_respect_manual_override THEN
    should_update := should_auto_update_organising_universe(p_project_id);
  ELSE
    should_update := TRUE; -- Force update (admin override)
  END IF;
  
  IF NOT should_update THEN
    RETURN jsonb_build_object(
      'updated', false,
      'reason', 'Manual override or no change needed',
      'current_value', current_value
    );
  END IF;
  
  -- Calculate new value
  calculated_value := calculate_default_organising_universe(p_project_id);
  
  -- Build change reason
  change_reason := format(
    'Auto-assigned based on tier and EBA/patch rules (was: %s)',
    COALESCE(current_value, 'NULL')
  );
  
  -- Apply the update (FIXED: correct enum type casting)
  UPDATE projects 
  SET 
    organising_universe = calculated_value::project_organising_universe,
    organising_universe_auto_assigned = TRUE,
    organising_universe_last_auto_update = NOW(),
    organising_universe_change_reason = change_reason,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the change
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by
  ) VALUES (
    p_project_id,
    current_value,
    calculated_value,
    change_reason,
    'tier_eba_patch_rules',
    p_applied_by
  );
  
  result := jsonb_build_object(
    'updated', true,
    'project_name', project_name,
    'old_value', current_value,
    'new_value', calculated_value,
    'change_reason', change_reason
  );
  
  RAISE NOTICE 'Updated project %: % → %', project_name, current_value, calculated_value;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_organising_universe_with_rules"("p_project_id" "uuid", "p_respect_manual_override" boolean, "p_applied_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_patch_geometry"("p_patch_id" "uuid", "p_geometry" "text", "p_updated_by" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE patches 
    SET 
        geom = ST_GeomFromText(p_geometry, 4326),
        updated_at = now(),
        updated_by = COALESCE(p_updated_by, updated_by)
    WHERE id = p_patch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patch with id % not found', p_patch_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_patch_geometry"("p_patch_id" "uuid", "p_geometry" "text", "p_updated_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pending_employers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pending_employers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into lead_organiser_patch_assignments(lead_organiser_id, patch_id) values (p_lead, p_patch)
  on conflict (lead_organiser_id, patch_id) where effective_to is null do nothing;
end;
$$;


ALTER FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into organiser_patch_assignments(organiser_id, patch_id)
  values (p_org, p_patch)
  on conflict (organiser_id, patch_id) where effective_to is null do nothing;
end;
$$;


ALTER FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_patch_employer"("p_patch" "uuid", "p_emp" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into patch_employers(patch_id, employer_id) values (p_patch, p_emp)
  on conflict (patch_id, employer_id) where effective_to is null do nothing;
end;
$$;


ALTER FUNCTION "public"."upsert_patch_employer"("p_patch" "uuid", "p_emp" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_patch_geometry"("p_feature_geometry" "jsonb", "p_patch_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_wkt text;
BEGIN
  -- Convert GeoJSON to WKT
  v_wkt := ST_AsText(ST_GeomFromGeoJSON(p_feature_geometry));

  -- Handle one-feature-to-many-patches by duplicating geometry
  IF array_length(p_patch_ids, 1) > 1 THEN
    UPDATE patches
    SET geom = ST_GeomFromText(v_wkt, 4326)
    WHERE id = ANY(p_patch_ids);
  ELSE
    -- Handle many-features-to-one-patch by unioning geometries
    UPDATE patches
    SET geom = ST_Union(geom, ST_GeomFromText(v_wkt, 4326))
    WHERE id = p_patch_ids[1];
  END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_patch_geometry"("p_feature_geometry" "jsonb", "p_patch_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_patch_site"("p_patch" "uuid", "p_site" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into patch_job_sites(patch_id, job_site_id) values (p_patch, p_site)
  on conflict (patch_id, job_site_id) where effective_to is null do nothing;
end;
$$;


ALTER FUNCTION "public"."upsert_patch_site"("p_patch" "uuid", "p_site" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_contractor_assignments"() RETURNS TABLE("validation_type" "text", "issue_count" integer, "details" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check for site contractors not in project roles
  RETURN QUERY
  SELECT 
    'missing_project_role' as validation_type,
    COUNT(*)::integer as issue_count,
    'Site contractors without project role assignments' as details
  FROM public.site_contractor_trades sct
  JOIN public.job_sites js ON js.id = sct.job_site_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_employer_roles per
    WHERE per.project_id = js.project_id 
    AND per.employer_id = sct.employer_id
  );
  
  -- Check for orphaned project contractor trades (employer doesn't exist)
  RETURN QUERY
  SELECT 
    'orphaned_project_trades' as validation_type,
    COUNT(*)::integer as issue_count,
    'Project contractor trades with non-existent employers' as details
  FROM public.project_contractor_trades pct
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employers e
    WHERE e.id = pct.employer_id
  );
  
  -- Check for orphaned site contractor trades
  RETURN QUERY
  SELECT 
    'orphaned_site_trades' as validation_type,
    COUNT(*)::integer as issue_count,
    'Site contractor trades with non-existent employers or sites' as details
  FROM public.site_contractor_trades sct
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employers e
    WHERE e.id = sct.employer_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.job_sites js
    WHERE js.id = sct.job_site_id
  );
END;
$$;


ALTER FUNCTION "public"."validate_contractor_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_trade_type"("trade_type_value" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN trade_type_value::public.trade_type IS NOT NULL;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."validate_trade_type"("trade_type_value" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "project_id" "uuid",
    "job_site_id" "uuid",
    "employer_id" "uuid",
    "topic" "text",
    "notes" "text",
    "type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."activities" IS 'Anchor table for activities; related tables include activity_participants and activity_delegations.';



COMMENT ON COLUMN "public"."activities"."created_by" IS 'References profiles.id (usually equals auth.users.id).';



CREATE TABLE IF NOT EXISTS "public"."activity_delegations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "delegate_worker_id" "uuid" NOT NULL,
    "assigned_worker_id" "uuid" NOT NULL,
    "source_activity_id" "uuid",
    "assignment_type" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_delegations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_objective_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "objective_id" "uuid" NOT NULL,
    "dimension" "text" NOT NULL,
    "dimension_id" "uuid" NOT NULL,
    "target_value" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_objective_targets_dimension_check" CHECK (("dimension" = ANY (ARRAY['project'::"text", 'employer'::"text", 'job_site'::"text"])))
);


ALTER TABLE "public"."activity_objective_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_objectives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_value" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_objectives_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['number'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."activity_objectives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "assignment_method" "text" NOT NULL,
    "assignment_source_id" "uuid",
    "participation_status" "text" DEFAULT 'invited'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_rating_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "level" integer NOT NULL,
    "label" "text" NOT NULL,
    "definition" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_rating_definitions_level_check" CHECK ((("level" >= 1) AND ("level" <= 5)))
);


ALTER TABLE "public"."activity_rating_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "is_predefined" boolean DEFAULT true NOT NULL,
    "default_rating_criteria" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_workers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_workers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "organiser_id" "uuid",
    "job_site_id" "uuid",
    "project_id" "uuid",
    "patch_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ca_scope_check" CHECK ((("organiser_id" IS NOT NULL) OR ("job_site_id" IS NOT NULL) OR ("project_id" IS NOT NULL) OR ("patch_id" IS NOT NULL)))
);


ALTER TABLE "public"."campaign_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'paused'::"text"]))),
    CONSTRAINT "campaigns_type_check" CHECK (("type" = ANY (ARRAY['compliance_blitz'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_eba_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "eba_file_number" "text",
    "sector" "text",
    "contact_name" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "comments" "text",
    "docs_prepared" "date",
    "date_barg_docs_sent" "date",
    "followup_email_sent" "date",
    "out_of_office_received" "date",
    "followup_phone_call" "date",
    "date_draft_signing_sent" "date",
    "eba_data_form_received" "date",
    "date_eba_signed" "date",
    "date_vote_occurred" "date",
    "eba_lodged_fwc" "date",
    "fwc_lodgement_number" "text",
    "fwc_matter_number" "text",
    "fwc_certified_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fwc_document_url" "text",
    "nominal_expiry_date" "date",
    "approved_date" "date",
    "eba_document_url" "text",
    "wage_rates_url" "text",
    "summary_url" "text"
);


ALTER TABLE "public"."company_eba_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "due_date" "date",
    "acknowledged" boolean DEFAULT false,
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "compliance_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['overdue_check'::"text", 'non_compliance'::"text", 'followup_required'::"text", 'report_due'::"text"]))),
    CONSTRAINT "compliance_alerts_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['project'::"text", 'employer'::"text"]))),
    CONSTRAINT "compliance_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."compliance_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_role_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "hierarchy_level" integer DEFAULT 999,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contractor_role_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_trade_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "trade_type" "public"."trade_type" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contractor_trade_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text" NOT NULL,
    "project_type" "text",
    "main_builder_id" "uuid",
    "shifts" "public"."shift_type"[] DEFAULT ARRAY['day'::"public"."shift_type"],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid",
    "is_main_site" boolean DEFAULT false,
    "full_address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "geom" "public"."geometry"(Point,4326),
    "patch_id" "uuid"
);


ALTER TABLE "public"."job_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_contractor_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "trade_type" "text" NOT NULL,
    "eba_signatory" "public"."eba_status_type" DEFAULT 'not_specified'::"public"."eba_status_type" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estimated_project_workforce" numeric,
    "stage" "public"."trade_stage",
    "assignment_id" "uuid" DEFAULT "gen_random_uuid"(),
    "assignment_notes" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "match_status" "text" DEFAULT 'confirmed'::"text",
    "match_confidence" numeric DEFAULT 1.0,
    "matched_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "confirmed_by" "uuid",
    "match_notes" "text",
    CONSTRAINT "project_contractor_trades_match_confidence_check" CHECK ((("match_confidence" >= (0)::numeric) AND ("match_confidence" <= (1)::numeric))),
    CONSTRAINT "project_contractor_trades_match_status_check" CHECK (("match_status" = ANY (ARRAY['auto_matched'::"text", 'confirmed'::"text", 'needs_review'::"text"]))),
    CONSTRAINT "project_contractor_trades_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'bci_import'::"text", 'other_import'::"text"])))
);


ALTER TABLE "public"."project_contractor_trades" OWNER TO "postgres";


COMMENT ON COLUMN "public"."project_contractor_trades"."assignment_id" IS 'Unique identifier for each trade type assignment, allows multiple trade types per employer per project';



CREATE TABLE IF NOT EXISTS "public"."project_employer_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "role" "public"."project_role" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_employer_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric,
    "main_job_site_id" "uuid",
    "builder_id" "uuid",
    "proposed_start_date" "date",
    "proposed_finish_date" "date",
    "roe_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_type" "public"."project_type",
    "state_funding" numeric DEFAULT 0 NOT NULL,
    "federal_funding" numeric DEFAULT 0 NOT NULL,
    "bci_project_id" "text",
    "project_stage" "text",
    "project_status" "text",
    "last_update_date" "date",
    "tier" "text" GENERATED ALWAYS AS (
CASE
    WHEN ("value" >= (500000000)::numeric) THEN 'tier_1'::"text"
    WHEN ("value" >= (100000000)::numeric) THEN 'tier_2'::"text"
    WHEN ("value" IS NOT NULL) THEN 'tier_3'::"text"
    ELSE NULL::"text"
END) STORED,
    "organising_universe" "public"."project_organising_universe" DEFAULT 'potential'::"public"."project_organising_universe" NOT NULL,
    "stage_class" "public"."project_stage_class" DEFAULT 'pre_construction'::"public"."project_stage_class" NOT NULL,
    "health_safety_committee_goal" integer DEFAULT 0,
    "funding_type_primary" "text",
    "owner_type_level_1" "text",
    "organising_universe_auto_assigned" boolean DEFAULT false,
    "organising_universe_manual_override" boolean DEFAULT false,
    "organising_universe_last_auto_update" timestamp with time zone,
    "organising_universe_change_reason" "text",
    CONSTRAINT "projects_health_safety_committee_goal_check" CHECK (("health_safety_committee_goal" >= 0))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."health_safety_committee_goal" IS 'Target number of HSRs needed for a "full" Health & Safety committee. When HSR count >= goal, committee status is "full"';



COMMENT ON COLUMN "public"."projects"."funding_type_primary" IS 'Primary funding source from BCI data: Federal, Federal State, Federal state local, local, state, state local, or blank';



COMMENT ON COLUMN "public"."projects"."owner_type_level_1" IS 'Primary owner type from BCI data: Government, or blank';



CREATE TABLE IF NOT EXISTS "public"."site_contractor_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_site_id" "uuid",
    "employer_id" "uuid",
    "trade_type" "public"."trade_type" NOT NULL,
    "eba_status" boolean DEFAULT false,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eba_signatory" "public"."eba_status_type" DEFAULT 'not_specified'::"public"."eba_status_type"
);


ALTER TABLE "public"."site_contractor_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."union_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "public"."union_role_type" NOT NULL,
    "worker_id" "uuid",
    "job_site_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_senior" boolean DEFAULT false,
    "rating" "text",
    "experience_level" "text",
    "gets_paid_time" boolean DEFAULT false,
    "notes" "text"
);


ALTER TABLE "public"."union_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_placements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid",
    "employer_id" "uuid",
    "job_site_id" "uuid",
    "employment_status" "public"."employment_status" NOT NULL,
    "job_title" "text",
    "shift" "public"."shift_type",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."worker_placements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "gender" "text",
    "date_of_birth" "date",
    "union_membership_status" "public"."union_membership_status" DEFAULT 'non_member'::"public"."union_membership_status",
    "informal_network_tags" "text"[],
    "superannuation_fund" "text",
    "redundancy_fund" "text",
    "other_industry_bodies" "text"[],
    "qualifications" "text"[],
    "inductions" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text" NOT NULL,
    "surname" "text" NOT NULL,
    "other_name" "text",
    "nickname" "text",
    "home_address_line_1" "text",
    "home_address_line_2" "text",
    "home_address_suburb" "text",
    "home_address_postcode" "text",
    "home_address_state" "text",
    "home_phone" "text",
    "work_phone" "text",
    "mobile_phone" "text",
    "member_number" "text",
    "organiser_id" "uuid",
    "incolink_member_id" "text",
    "last_incolink_payment" "date"
);


ALTER TABLE "public"."workers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workers"."incolink_member_id" IS 'Membership number from Incolink; used to match/import workers from ComplianceLink invoices';



COMMENT ON COLUMN "public"."workers"."last_incolink_payment" IS 'Date of the most recent Incolink invoice observed for this worker.';



CREATE OR REPLACE VIEW "public"."dashboard_project_metrics" AS
 WITH "project_workers" AS (
         SELECT "p_1"."id" AS "project_id",
            "count"(DISTINCT "wp"."worker_id") AS "total_workers",
            "count"(DISTINCT
                CASE
                    WHEN ("w"."union_membership_status" = 'member'::"public"."union_membership_status") THEN "wp"."worker_id"
                    ELSE NULL::"uuid"
                END) AS "total_members",
            "avg"(
                CASE
                    WHEN ("pct"."estimated_project_workforce" > (0)::numeric) THEN "pct"."estimated_project_workforce"
                    ELSE NULL::numeric
                END) AS "avg_estimated_workers"
           FROM (((("public"."projects" "p_1"
             LEFT JOIN "public"."job_sites" "js" ON (("js"."project_id" = "p_1"."id")))
             LEFT JOIN "public"."worker_placements" "wp" ON (("wp"."job_site_id" = "js"."id")))
             LEFT JOIN "public"."workers" "w" ON (("w"."id" = "wp"."worker_id")))
             LEFT JOIN "public"."project_contractor_trades" "pct" ON (("pct"."project_id" = "p_1"."id")))
          GROUP BY "p_1"."id"
        ), "project_delegates" AS (
         SELECT "p_1"."id" AS "project_id",
            "count"(DISTINCT
                CASE
                    WHEN ("ur"."name" = 'site_delegate'::"public"."union_role_type") THEN "ur"."worker_id"
                    ELSE NULL::"uuid"
                END) AS "site_delegates",
            "count"(DISTINCT
                CASE
                    WHEN ("ur"."name" = 'company_delegate'::"public"."union_role_type") THEN "ur"."worker_id"
                    ELSE NULL::"uuid"
                END) AS "company_delegates",
            "count"(DISTINCT
                CASE
                    WHEN ("ur"."name" = 'hsr'::"public"."union_role_type") THEN "ur"."worker_id"
                    ELSE NULL::"uuid"
                END) AS "hsrs",
            "count"(DISTINCT
                CASE
                    WHEN ("ur"."name" = 'health_safety_committee'::"public"."union_role_type") THEN "ur"."worker_id"
                    ELSE NULL::"uuid"
                END) AS "hs_committee_members"
           FROM (("public"."projects" "p_1"
             LEFT JOIN "public"."job_sites" "js" ON (("js"."project_id" = "p_1"."id")))
             LEFT JOIN "public"."union_roles" "ur" ON ((("ur"."job_site_id" = "js"."id") AND ("ur"."end_date" IS NULL))))
          GROUP BY "p_1"."id"
        ), "project_employers" AS (
         SELECT "p_1"."id" AS "project_id",
            "count"(DISTINCT "sct"."employer_id") AS "total_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("cer"."id" IS NOT NULL) THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "eba_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = 'demolition'::"public"."trade_type") THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "demolition_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = 'piling'::"public"."trade_type") THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "piling_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = ANY (ARRAY['concreting'::"public"."trade_type", 'concrete'::"public"."trade_type"])) THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "concreting_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = 'form_work'::"public"."trade_type") THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "formwork_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = 'scaffolding'::"public"."trade_type") THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "scaffold_employers",
            "count"(DISTINCT
                CASE
                    WHEN ("sct"."trade_type" = ANY (ARRAY['tower_crane'::"public"."trade_type", 'mobile_crane'::"public"."trade_type", 'crane_and_rigging'::"public"."trade_type"])) THEN "sct"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "crane_employers"
           FROM ((("public"."projects" "p_1"
             LEFT JOIN "public"."job_sites" "js" ON (("js"."project_id" = "p_1"."id")))
             LEFT JOIN "public"."site_contractor_trades" "sct" ON (("sct"."job_site_id" = "js"."id")))
             LEFT JOIN "public"."company_eba_records" "cer" ON (("cer"."employer_id" = "sct"."employer_id")))
          GROUP BY "p_1"."id"
        ), "project_builders" AS (
         SELECT "p_1"."id" AS "project_id",
            "count"(DISTINCT "per"."employer_id") AS "total_builders",
            "count"(DISTINCT
                CASE
                    WHEN ("cer"."id" IS NOT NULL) THEN "per"."employer_id"
                    ELSE NULL::"uuid"
                END) AS "eba_builders"
           FROM (("public"."projects" "p_1"
             LEFT JOIN "public"."project_employer_roles" "per" ON ((("per"."project_id" = "p_1"."id") AND ("per"."role" = ANY (ARRAY['builder'::"public"."project_role", 'head_contractor'::"public"."project_role", 'project_manager'::"public"."project_role"])))))
             LEFT JOIN "public"."company_eba_records" "cer" ON (("cer"."employer_id" = "per"."employer_id")))
          GROUP BY "p_1"."id"
        )
 SELECT "p"."id",
    "p"."name",
    "p"."organising_universe",
    "p"."stage_class",
    "p"."value",
    "p"."health_safety_committee_goal",
    COALESCE("pw"."total_workers", (0)::bigint) AS "total_workers",
    COALESCE("pw"."total_members", (0)::bigint) AS "total_members",
    COALESCE("pw"."avg_estimated_workers", (0)::numeric) AS "avg_estimated_workers",
    COALESCE("pd"."site_delegates", (0)::bigint) AS "site_delegates",
    COALESCE("pd"."company_delegates", (0)::bigint) AS "company_delegates",
    COALESCE("pd"."hsrs", (0)::bigint) AS "hsrs",
    COALESCE("pd"."hs_committee_members", (0)::bigint) AS "hs_committee_members",
        CASE
            WHEN (("p"."health_safety_committee_goal" > 0) AND (COALESCE("pd"."hsrs", (0)::bigint) >= "p"."health_safety_committee_goal")) THEN 'full'::"text"
            ELSE 'partial'::"text"
        END AS "hs_committee_status",
    COALESCE("pe"."total_employers", (0)::bigint) AS "total_employers",
    COALESCE("pe"."eba_employers", (0)::bigint) AS "eba_employers",
        CASE
            WHEN (COALESCE("pe"."total_employers", (0)::bigint) > 0) THEN "round"((((COALESCE("pe"."eba_employers", (0)::bigint))::numeric / ("pe"."total_employers")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "eba_employer_percentage",
    COALESCE("pb"."total_builders", (0)::bigint) AS "total_builders",
    COALESCE("pb"."eba_builders", (0)::bigint) AS "eba_builders",
        CASE
            WHEN (COALESCE("pb"."total_builders", (0)::bigint) > 0) THEN "round"((((COALESCE("pb"."eba_builders", (0)::bigint))::numeric / ("pb"."total_builders")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "eba_builder_percentage",
    COALESCE("pe"."demolition_employers", (0)::bigint) AS "demolition_employers",
    COALESCE("pe"."piling_employers", (0)::bigint) AS "piling_employers",
    COALESCE("pe"."concreting_employers", (0)::bigint) AS "concreting_employers",
    COALESCE("pe"."formwork_employers", (0)::bigint) AS "formwork_employers",
    COALESCE("pe"."scaffold_employers", (0)::bigint) AS "scaffold_employers",
    COALESCE("pe"."crane_employers", (0)::bigint) AS "crane_employers",
    (COALESCE("pd"."site_delegates", (0)::bigint) > 0) AS "has_site_delegates",
    (COALESCE("pd"."company_delegates", (0)::bigint) > 0) AS "has_company_delegates",
    (COALESCE("pd"."hsrs", (0)::bigint) > 0) AS "has_hsrs",
    (EXISTS ( SELECT 1
           FROM ("public"."union_roles" "ur"
             JOIN "public"."job_sites" "js" ON (("js"."id" = "ur"."job_site_id")))
          WHERE (("js"."project_id" = "p"."id") AND ("ur"."name" = 'hsr'::"public"."union_role_type") AND ("ur"."is_senior" = true) AND ("ur"."end_date" IS NULL)))) AS "has_hsr_chair_delegate"
   FROM (((("public"."projects" "p"
     LEFT JOIN "project_workers" "pw" ON (("pw"."project_id" = "p"."id")))
     LEFT JOIN "project_delegates" "pd" ON (("pd"."project_id" = "p"."id")))
     LEFT JOIN "project_employers" "pe" ON (("pe"."project_id" = "p"."id")))
     LEFT JOIN "project_builders" "pb" ON (("pb"."project_id" = "p"."id")));


ALTER VIEW "public"."dashboard_project_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dd_conversion_attempt" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_visit_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "method_code" "text" NOT NULL,
    "outcome_code" "text" NOT NULL,
    "client_generated_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dd_conversion_attempt" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delegate_assessment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_visit_id" "uuid" NOT NULL,
    "present" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delegate_assessment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delegate_field_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organiser_id" "uuid" NOT NULL,
    "entity_field_id" "uuid" NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delegate_field_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delegate_role_rating" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delegate_assessment_id" "uuid" NOT NULL,
    "role_type_code" "text" NOT NULL,
    "rating_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delegate_role_rating" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."draft_lead_organiser_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_lead_pending_user_id" "uuid" NOT NULL,
    "organiser_user_id" "uuid",
    "organiser_pending_user_id" "uuid",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "draft_lead_organiser_links_child_chk" CHECK ((((("organiser_user_id" IS NOT NULL))::integer + (("organiser_pending_user_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."draft_lead_organiser_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects_organising_universe_backup" (
    "id" "uuid",
    "organising_universe" "public"."project_organising_universe",
    "tier" "text",
    "name" "text",
    "value" numeric,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."projects_organising_universe_backup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."emergency_rollback_info" AS
 SELECT 'Current State'::"text" AS "info_type",
    "count"(*) AS "project_count",
    "string_agg"(DISTINCT ("projects"."organising_universe")::"text", ', '::"text") AS "universe_values"
   FROM "public"."projects"
  WHERE ("projects"."organising_universe" IS NOT NULL)
UNION ALL
 SELECT 'Backup State'::"text" AS "info_type",
    "count"(*) AS "project_count",
    "string_agg"(DISTINCT ("projects_organising_universe_backup"."organising_universe")::"text", ', '::"text") AS "universe_values"
   FROM "public"."projects_organising_universe_backup"
  WHERE ("projects_organising_universe_backup"."organising_universe" IS NOT NULL)
UNION ALL
 SELECT 'Would Rollback'::"text" AS "info_type",
    "count"(*) AS "project_count",
    "string_agg"(DISTINCT ("p"."organising_universe")::"text", ', '::"text") AS "universe_values"
   FROM ("public"."projects" "p"
     JOIN "public"."projects_organising_universe_backup" "b" ON (("b"."id" = "p"."id")))
  WHERE (("p"."organising_universe")::"text" IS DISTINCT FROM ("b"."organising_universe")::"text");


ALTER VIEW "public"."emergency_rollback_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employer_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alias" "text" NOT NULL,
    "alias_normalized" "text" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."employer_aliases" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employer_analytics" WITH ("security_invoker"='true') AS
 SELECT "e"."id" AS "employer_id",
    "e"."name" AS "employer_name",
    "e"."estimated_worker_count",
    "count"(DISTINCT "w"."id") AS "current_worker_count",
    "count"(DISTINCT
        CASE
            WHEN ("w"."union_membership_status" = 'member'::"public"."union_membership_status") THEN "w"."id"
            ELSE NULL::"uuid"
        END) AS "member_count",
    "count"(DISTINCT
        CASE
            WHEN ("wp"."job_site_id" IS NOT NULL) THEN "w"."id"
            ELSE NULL::"uuid"
        END) AS "workers_with_job_site",
    "count"(DISTINCT
        CASE
            WHEN ("wp"."job_site_id" IS NULL) THEN "w"."id"
            ELSE NULL::"uuid"
        END) AS "workers_without_job_site",
        CASE
            WHEN ("count"(DISTINCT "w"."id") > 0) THEN "round"(((("count"(DISTINCT
            CASE
                WHEN ("w"."union_membership_status" = 'member'::"public"."union_membership_status") THEN "w"."id"
                ELSE NULL::"uuid"
            END))::numeric * 100.0) / ("count"(DISTINCT "w"."id"))::numeric), 2)
            ELSE (0)::numeric
        END AS "member_density_percent",
        CASE
            WHEN ("e"."estimated_worker_count" > 0) THEN "round"(((("count"(DISTINCT
            CASE
                WHEN ("w"."union_membership_status" = 'member'::"public"."union_membership_status") THEN "w"."id"
                ELSE NULL::"uuid"
            END))::numeric * 100.0) / ("e"."estimated_worker_count")::numeric), 2)
            ELSE (0)::numeric
        END AS "estimated_density_percent"
   FROM (("public"."employers" "e"
     LEFT JOIN "public"."worker_placements" "wp" ON (("e"."id" = "wp"."employer_id")))
     LEFT JOIN "public"."workers" "w" ON (("wp"."worker_id" = "w"."id")))
  GROUP BY "e"."id", "e"."name", "e"."estimated_worker_count";


ALTER VIEW "public"."employer_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employer_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "capability_type" "text" NOT NULL,
    "trade_type_id" "uuid",
    "contractor_role_type_id" "uuid",
    "proficiency_level" "text" DEFAULT 'intermediate'::"text",
    "is_primary" boolean DEFAULT false,
    "years_experience" integer,
    "certification_details" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_capability_fields" CHECK (((("capability_type" = 'trade'::"text") AND ("trade_type_id" IS NOT NULL) AND ("contractor_role_type_id" IS NULL)) OR (("capability_type" = 'contractor_role'::"text") AND ("contractor_role_type_id" IS NOT NULL) AND ("trade_type_id" IS NULL)))),
    CONSTRAINT "employer_capabilities_capability_type_check" CHECK (("capability_type" = ANY (ARRAY['trade'::"text", 'contractor_role'::"text"]))),
    CONSTRAINT "employer_capabilities_proficiency_level_check" CHECK (("proficiency_level" = ANY (ARRAY['basic'::"text", 'intermediate'::"text", 'advanced'::"text", 'expert'::"text"])))
);


ALTER TABLE "public"."employer_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employer_compliance_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "cbus_check_conducted" boolean DEFAULT false,
    "cbus_check_date" "date",
    "cbus_checked_by" "text"[],
    "cbus_payment_status" "text",
    "cbus_payment_timing" "text",
    "cbus_worker_count_status" "text",
    "cbus_enforcement_flag" boolean DEFAULT false,
    "cbus_followup_required" boolean DEFAULT false,
    "cbus_notes" "text",
    "incolink_check_conducted" boolean DEFAULT false,
    "incolink_check_date" "date",
    "incolink_checked_by" "text"[],
    "incolink_payment_status" "text",
    "incolink_payment_timing" "text",
    "incolink_worker_count_status" "text",
    "incolink_enforcement_flag" boolean DEFAULT false,
    "incolink_followup_required" boolean DEFAULT false,
    "incolink_notes" "text",
    "incolink_company_id" "text",
    "site_visit_id" "uuid",
    "version" integer DEFAULT 1,
    "is_current" boolean DEFAULT true,
    "effective_from" timestamp with time zone DEFAULT "now"(),
    "effective_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "employer_compliance_checks_cbus_payment_status_check" CHECK (("cbus_payment_status" = ANY (ARRAY['correct'::"text", 'incorrect'::"text", 'uncertain'::"text"]))),
    CONSTRAINT "employer_compliance_checks_cbus_payment_timing_check" CHECK (("cbus_payment_timing" = ANY (ARRAY['on_time'::"text", 'late'::"text", 'uncertain'::"text"]))),
    CONSTRAINT "employer_compliance_checks_cbus_worker_count_status_check" CHECK (("cbus_worker_count_status" = ANY (ARRAY['correct'::"text", 'incorrect'::"text"]))),
    CONSTRAINT "employer_compliance_checks_incolink_payment_status_check" CHECK (("incolink_payment_status" = ANY (ARRAY['correct'::"text", 'incorrect'::"text", 'uncertain'::"text"]))),
    CONSTRAINT "employer_compliance_checks_incolink_payment_timing_check" CHECK (("incolink_payment_timing" = ANY (ARRAY['on_time'::"text", 'late'::"text", 'uncertain'::"text"]))),
    CONSTRAINT "employer_compliance_checks_incolink_worker_count_status_check" CHECK (("incolink_worker_count_status" = ANY (ARRAY['correct'::"text", 'incorrect'::"text"])))
);


ALTER TABLE "public"."employer_compliance_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employer_organisers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "organiser_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employer_organisers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employer_project_trades" AS
 SELECT "pct"."project_id",
    "p"."name" AS "project_name",
    "pct"."employer_id",
    "e"."name" AS "employer_name",
    "array_agg"(DISTINCT "pct"."trade_type" ORDER BY "pct"."trade_type") AS "all_trade_types",
    "array_agg"(DISTINCT ("pct"."stage")::"text" ORDER BY ("pct"."stage")::"text") AS "all_stages",
    "sum"("pct"."estimated_project_workforce") AS "total_estimated_workforce",
    "count"(DISTINCT "pct"."assignment_id") AS "total_assignments",
    "max"("pct"."created_at") AS "latest_assignment"
   FROM (("public"."project_contractor_trades" "pct"
     JOIN "public"."projects" "p" ON (("p"."id" = "pct"."project_id")))
     JOIN "public"."employers" "e" ON (("e"."id" = "pct"."employer_id")))
  GROUP BY "pct"."project_id", "p"."name", "pct"."employer_id", "e"."name"
  ORDER BY "p"."name", "e"."name";


ALTER VIEW "public"."employer_project_trades" OWNER TO "postgres";


COMMENT ON VIEW "public"."employer_project_trades" IS 'Shows all trade type assignments per employer per project, aggregated for easy viewing';



CREATE TABLE IF NOT EXISTS "public"."employer_role_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "tag" "public"."employer_role_tag" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employer_role_tags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employers_with_eba" WITH ("security_invoker"='true') AS
 WITH "latest" AS (
         SELECT DISTINCT ON ("company_eba_records"."employer_id") "company_eba_records"."id",
            "company_eba_records"."employer_id",
            "company_eba_records"."eba_file_number",
            "company_eba_records"."sector",
            "company_eba_records"."contact_name",
            "company_eba_records"."contact_phone",
            "company_eba_records"."contact_email",
            "company_eba_records"."comments",
            "company_eba_records"."docs_prepared",
            "company_eba_records"."date_barg_docs_sent",
            "company_eba_records"."followup_email_sent",
            "company_eba_records"."out_of_office_received",
            "company_eba_records"."followup_phone_call",
            "company_eba_records"."date_draft_signing_sent",
            "company_eba_records"."eba_data_form_received",
            "company_eba_records"."date_eba_signed",
            "company_eba_records"."date_vote_occurred",
            "company_eba_records"."eba_lodged_fwc",
            "company_eba_records"."fwc_lodgement_number",
            "company_eba_records"."fwc_matter_number",
            "company_eba_records"."fwc_certified_date",
            "company_eba_records"."created_at",
            "company_eba_records"."updated_at",
            "company_eba_records"."fwc_document_url",
            "company_eba_records"."nominal_expiry_date",
            "company_eba_records"."approved_date",
            "company_eba_records"."eba_document_url",
            "company_eba_records"."wage_rates_url",
            "company_eba_records"."summary_url"
           FROM "public"."company_eba_records"
          WHERE ("company_eba_records"."employer_id" IS NOT NULL)
          ORDER BY "company_eba_records"."employer_id", COALESCE("company_eba_records"."fwc_certified_date", "company_eba_records"."eba_lodged_fwc", "company_eba_records"."date_vote_occurred", "company_eba_records"."date_eba_signed", '1900-01-01'::"date") DESC
        )
 SELECT "e"."id",
    "e"."name",
    "e"."abn",
    "e"."enterprise_agreement_status",
    "e"."parent_employer_id",
    "e"."employer_type",
    "e"."created_at",
    "e"."updated_at",
    "e"."phone",
    "e"."email",
    "e"."address_line_1",
    "e"."address_line_2",
    "e"."suburb",
    "e"."state",
    "e"."postcode",
    "e"."website",
    "e"."contact_notes",
    "e"."primary_contact_name",
    "e"."estimated_worker_count",
        CASE
            WHEN (("l"."fwc_certified_date" IS NOT NULL) AND ("l"."fwc_certified_date" >= (CURRENT_DATE - '4 years'::interval))) THEN 'active'::"text"
            WHEN (("l"."eba_lodged_fwc" IS NOT NULL) AND ("l"."eba_lodged_fwc" >= (CURRENT_DATE - '1 year'::interval))) THEN 'lodged'::"text"
            WHEN ((("l"."date_vote_occurred" IS NOT NULL) AND ("l"."date_vote_occurred" >= (CURRENT_DATE - '6 mons'::interval))) OR (("l"."date_eba_signed" IS NOT NULL) AND ("l"."date_eba_signed" >= (CURRENT_DATE - '6 mons'::interval)))) THEN 'pending'::"text"
            ELSE 'no'::"text"
        END AS "eba_category"
   FROM ("public"."employers" "e"
     LEFT JOIN "latest" "l" ON (("l"."employer_id" = "e"."id")));


ALTER VIEW "public"."employers_with_eba" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entitlements_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_visit_id" "uuid" NOT NULL,
    "super_paid" boolean DEFAULT true NOT NULL,
    "super_paid_to_fund" boolean DEFAULT true NOT NULL,
    "redundancy_contributions_up_to_date" boolean DEFAULT true NOT NULL,
    "wages_correct" boolean DEFAULT true NOT NULL,
    "eba_allowances_correct" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entitlements_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_sensitive" boolean DEFAULT false NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "default_viewable" boolean DEFAULT true NOT NULL,
    "default_editable" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "entity_fields_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['workers'::"text", 'employers'::"text", 'projects'::"text", 'job_sites'::"text", 'company_eba_records'::"text", 'union_activities'::"text"]))),
    CONSTRAINT "entity_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'email'::"text", 'phone'::"text", 'date'::"text", 'number'::"text", 'boolean'::"text", 'array'::"text", 'select'::"text"])))
);


ALTER TABLE "public"."entity_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."field_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_field_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "can_view" boolean DEFAULT true NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "field_permissions_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'lead_organiser'::"text", 'organiser'::"text", 'delegate'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."field_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fwc_lookup_jobs" (
    "id" "text" NOT NULL,
    "employer_ids" "uuid"[] NOT NULL,
    "status" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "progress_completed" integer DEFAULT 0 NOT NULL,
    "progress_total" integer NOT NULL,
    "current_employer" "text",
    "batch_size" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "estimated_duration" integer,
    "options" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fwc_lookup_jobs_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text"]))),
    CONSTRAINT "fwc_lookup_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."fwc_lookup_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."fwc_lookup_jobs" IS 'Background jobs for FWC document lookup processing';



COMMENT ON COLUMN "public"."fwc_lookup_jobs"."employer_ids" IS 'Array of employer UUIDs to process';



COMMENT ON COLUMN "public"."fwc_lookup_jobs"."options" IS 'Job configuration options (skipExisting, autoSelectBest, etc.)';



CREATE TABLE IF NOT EXISTS "public"."fwc_lookup_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "text" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "employer_name" "text" NOT NULL,
    "success" boolean DEFAULT false NOT NULL,
    "fwc_results" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_result" "jsonb",
    "processing_time" integer NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fwc_lookup_results" OWNER TO "postgres";


COMMENT ON TABLE "public"."fwc_lookup_results" IS 'Results from FWC lookup jobs for individual employers';



COMMENT ON COLUMN "public"."fwc_lookup_results"."fwc_results" IS 'Array of FWC search results for this employer';



COMMENT ON COLUMN "public"."fwc_lookup_results"."selected_result" IS 'The FWC result that was selected/applied to the employer';



COMMENT ON COLUMN "public"."fwc_lookup_results"."processing_time" IS 'Time taken to process this employer in milliseconds';



CREATE TABLE IF NOT EXISTS "public"."kpi_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "source" "text" DEFAULT 'derived'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kpi_definitions_source_check" CHECK (("source" = ANY (ARRAY['derived'::"text", 'manual'::"text"]))),
    CONSTRAINT "kpi_definitions_unit_check" CHECK (("unit" = ANY (ARRAY['count'::"text", 'percent'::"text", 'boolean'::"text"])))
);


ALTER TABLE "public"."kpi_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "organiser_id" "uuid",
    "job_site_id" "uuid",
    "employer_id" "uuid",
    "worker_id" "uuid",
    "value" numeric DEFAULT 1 NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "organiser_id" "uuid",
    "job_site_id" "uuid",
    "target_value" numeric NOT NULL,
    "due_date" "date" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kpi_targets_scope_chk" CHECK ((("organiser_id" IS NOT NULL) OR ("job_site_id" IS NOT NULL)))
);


ALTER TABLE "public"."kpi_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_draft_organiser_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_user_id" "uuid" NOT NULL,
    "pending_user_id" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_draft_organiser_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_organiser_patch_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_organiser_id" "uuid" NOT NULL,
    "patch_id" "uuid" NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone
);


ALTER TABLE "public"."lead_organiser_patch_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organiser_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organiser_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "allocated_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organiser_allocations_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['project'::"text", 'job_site'::"text", 'employer'::"text"])))
);


ALTER TABLE "public"."organiser_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organiser_patch_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organiser_id" "uuid" NOT NULL,
    "patch_id" "uuid" NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "is_primary" boolean DEFAULT false
);


ALTER TABLE "public"."organiser_patch_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organisers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organisers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organising_universe_change_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "old_value" "text",
    "new_value" "text",
    "change_reason" "text",
    "rule_applied" "text",
    "applied_by" "uuid",
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "was_manual_override" boolean DEFAULT false
);


ALTER TABLE "public"."organising_universe_change_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patch_job_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patch_id" "uuid" NOT NULL,
    "job_site_id" "uuid" NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone
);


ALTER TABLE "public"."patch_job_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "assignment_type" "text" NOT NULL,
    "contractor_role_type_id" "uuid",
    "is_primary_for_role" boolean DEFAULT false,
    "trade_type_id" "uuid",
    "estimated_workers" integer,
    "actual_workers" integer,
    "start_date" "date",
    "end_date" "date",
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'manual'::"text",
    "match_status" "text" DEFAULT 'confirmed'::"text",
    "match_confidence" numeric DEFAULT 1.0,
    "matched_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "confirmed_by" "uuid",
    "match_notes" "text",
    CONSTRAINT "check_assignment_fields" CHECK (((("assignment_type" = 'contractor_role'::"text") AND ("contractor_role_type_id" IS NOT NULL) AND ("trade_type_id" IS NULL)) OR (("assignment_type" = 'trade_work'::"text") AND ("trade_type_id" IS NOT NULL) AND ("contractor_role_type_id" IS NULL)))),
    CONSTRAINT "check_dates_ok" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "project_assignments_actual_workers_check" CHECK (("actual_workers" >= 0)),
    CONSTRAINT "project_assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['contractor_role'::"text", 'trade_work'::"text"]))),
    CONSTRAINT "project_assignments_estimated_workers_check" CHECK (("estimated_workers" >= 0)),
    CONSTRAINT "project_assignments_match_confidence_check" CHECK ((("match_confidence" >= (0)::numeric) AND ("match_confidence" <= (1)::numeric))),
    CONSTRAINT "project_assignments_match_status_check" CHECK (("match_status" = ANY (ARRAY['auto_matched'::"text", 'confirmed'::"text", 'needs_review'::"text"]))),
    CONSTRAINT "project_assignments_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'bci_import'::"text", 'other_import'::"text"]))),
    CONSTRAINT "project_assignments_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "public"."project_assignments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organising_universe_impact_analysis" AS
 SELECT "id",
    "name",
    "tier",
    "value",
    "organising_universe" AS "current_universe",
    "public"."calculate_default_organising_universe"("id") AS "calculated_universe",
        CASE
            WHEN ("organising_universe" IS NULL) THEN 'NEW_ASSIGNMENT'::"text"
            WHEN (("organising_universe")::"text" = "public"."calculate_default_organising_universe"("id")) THEN 'NO_CHANGE'::"text"
            ELSE 'WOULD_CHANGE'::"text"
        END AS "change_type",
    ( SELECT "e"."name"
           FROM ("public"."project_assignments" "pa"
             JOIN "public"."employers" "e" ON (("e"."id" = "pa"."employer_id")))
          WHERE (("pa"."project_id" = "p"."id") AND ("pa"."assignment_type" = 'contractor_role'::"text") AND ("pa"."is_primary_for_role" = true))
         LIMIT 1) AS "builder_name",
    (EXISTS ( SELECT 1
           FROM ("public"."project_assignments" "pa"
             JOIN "public"."company_eba_records" "cer" ON (("cer"."employer_id" = "pa"."employer_id")))
          WHERE (("pa"."project_id" = "p"."id") AND ("pa"."assignment_type" = 'contractor_role'::"text") AND ("pa"."is_primary_for_role" = true) AND ("cer"."fwc_certified_date" IS NOT NULL)))) AS "builder_has_eba",
    (EXISTS ( SELECT 1
           FROM ("public"."patch_job_sites" "pjs"
             JOIN "public"."job_sites" "js" ON (("js"."id" = "pjs"."job_site_id")))
          WHERE (("js"."project_id" = "p"."id") AND ("pjs"."effective_to" IS NULL)))) AS "has_patch_assignment",
    "organising_universe_manual_override",
    "public"."should_auto_update_organising_universe"("id") AS "would_be_updated"
   FROM "public"."projects" "p"
  WHERE ("tier" IS NOT NULL)
  ORDER BY "tier", "name";


ALTER VIEW "public"."organising_universe_impact_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."overlay_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_path" "text" NOT NULL,
    "image_width" integer,
    "image_height" integer,
    "target_corners" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."overlay_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patch_employers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patch_id" "uuid" NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone
);


ALTER TABLE "public"."patch_employers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text",
    "geom" "public"."geometry"(MultiPolygon,4326),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "source_kml_path" "text",
    "description" "text",
    "sub_sectors" "text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "type" "text"
);


ALTER TABLE "public"."patches" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."patch_project_mapping_view" AS
 SELECT "pjs"."patch_id",
    "js"."project_id",
    "p"."name" AS "project_name",
    "pt"."name" AS "patch_name",
    "pjs"."effective_from",
    "pjs"."effective_to",
    "js"."id" AS "job_site_id",
    "js"."name" AS "job_site_name"
   FROM ((("public"."patch_job_sites" "pjs"
     JOIN "public"."job_sites" "js" ON (("js"."id" = "pjs"."job_site_id")))
     JOIN "public"."projects" "p" ON (("p"."id" = "js"."project_id")))
     LEFT JOIN "public"."patches" "pt" ON (("pt"."id" = "pjs"."patch_id")))
  WHERE ("pjs"."effective_to" IS NULL)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."patch_project_mapping_view" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."patch_project_mapping_view" IS 'Efficient mapping between patches and projects for filtering';



CREATE TABLE IF NOT EXISTS "public"."patch_regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "overlay_image_id" "uuid",
    "source_file_path" "text",
    "name" "text",
    "code" "text",
    "geojson" "jsonb" NOT NULL,
    "vertices_count" integer,
    "area_estimate" double precision,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."patch_regions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."patches_with_geojson" WITH ("security_invoker"='on') AS
 SELECT "code",
    "created_at",
    "created_by",
    "geom",
    ("public"."st_asgeojson"("public"."st_makevalid"("geom")))::json AS "geom_geojson",
    "id",
    "name",
    "source_kml_path",
    "updated_at",
    "updated_by"
   FROM "public"."patches" "p";


ALTER VIEW "public"."patches_with_geojson" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_employers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text" NOT NULL,
    "csv_role" "text",
    "source" "text",
    "raw" "jsonb",
    "created_by" "uuid",
    "inferred_trade_type" "text",
    "our_role" "text",
    "project_associations" "jsonb" DEFAULT '[]'::"jsonb",
    "user_confirmed_trade_type" "text",
    "import_status" "text" DEFAULT 'pending'::"text",
    "imported_employer_id" "uuid",
    "import_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bci_company_id" "text",
    CONSTRAINT "pending_employers_import_status_check" CHECK (("import_status" = ANY (ARRAY['pending'::"text", 'imported'::"text", 'skipped'::"text", 'error'::"text"]))),
    CONSTRAINT "pending_employers_our_role_check" CHECK (("our_role" = ANY (ARRAY['builder'::"text", 'head_contractor'::"text", 'subcontractor'::"text"])))
);


ALTER TABLE "public"."pending_employers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "scoped_employers" "uuid"[] DEFAULT '{}'::"uuid"[],
    "scoped_sites" "uuid"[] DEFAULT '{}'::"uuid"[],
    "notes" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "invited_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_patch_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "pending_users_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'requested'::"text", 'invited'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."pending_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "field_name" "text",
    "old_value" "text",
    "new_value" "text",
    "access_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'viewer'::"text",
    "scoped_sites" "uuid"[] DEFAULT '{}'::"uuid"[],
    "scoped_employers" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "last_login_at" timestamp with time zone,
    "phone" "text",
    CONSTRAINT "profiles_role_check" CHECK ((("role" IS NULL) OR ("role" = ANY (ARRAY['admin'::"text", 'lead_organiser'::"text", 'organiser'::"text", 'delegate'::"text", 'viewer'::"text"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_all_builders" AS
 SELECT "p"."id" AS "project_id",
    "p"."name" AS "project_name",
    "p"."builder_id" AS "primary_builder_id",
    "e1"."name" AS "primary_builder_name",
    COALESCE(( SELECT "json_agg"("json_build_object"('employer_id', "per"."employer_id", 'employer_name', "e2"."name", 'start_date', "per"."start_date", 'end_date', "per"."end_date") ORDER BY "per"."start_date") AS "json_agg"
           FROM ("public"."project_employer_roles" "per"
             JOIN "public"."employers" "e2" ON (("e2"."id" = "per"."employer_id")))
          WHERE (("per"."project_id" = "p"."id") AND ("per"."role" = 'project_manager'::"public"."project_role"))), '[]'::json) AS "project_managers",
    (
        CASE
            WHEN ("p"."builder_id" IS NOT NULL) THEN 1
            ELSE 0
        END + COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."project_employer_roles" "per"
          WHERE (("per"."project_id" = "p"."id") AND ("per"."role" = 'project_manager'::"public"."project_role"))), (0)::bigint)) AS "total_builder_count"
   FROM ("public"."projects" "p"
     LEFT JOIN "public"."employers" "e1" ON (("e1"."id" = "p"."builder_id")));


ALTER VIEW "public"."project_all_builders" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_all_builders" IS 'Shows all builders for a project: primary builder + additional project managers';



CREATE TABLE IF NOT EXISTS "public"."trade_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 999,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trade_types" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_assignments_detailed" AS
 SELECT "pa"."id",
    "pa"."project_id",
    "p"."name" AS "project_name",
    "pa"."employer_id",
    "e"."name" AS "employer_name",
    "pa"."assignment_type",
    "crt"."code" AS "contractor_role_code",
    "crt"."name" AS "contractor_role_name",
    "crt"."category" AS "contractor_role_category",
    "pa"."is_primary_for_role",
    "tt"."code" AS "trade_code",
    "tt"."name" AS "trade_name",
    "tt"."category" AS "trade_category",
    "pa"."estimated_workers",
    "pa"."actual_workers",
    "pa"."status",
    "pa"."start_date",
    "pa"."end_date",
    "pa"."notes",
    "pa"."created_at",
    "pa"."updated_at"
   FROM (((("public"."project_assignments" "pa"
     JOIN "public"."projects" "p" ON (("p"."id" = "pa"."project_id")))
     JOIN "public"."employers" "e" ON (("e"."id" = "pa"."employer_id")))
     LEFT JOIN "public"."contractor_role_types" "crt" ON (("crt"."id" = "pa"."contractor_role_type_id")))
     LEFT JOIN "public"."trade_types" "tt" ON (("tt"."id" = "pa"."trade_type_id")));


ALTER VIEW "public"."project_assignments_detailed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_builder_jv" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "label" "text",
    "status" "public"."jv_status" DEFAULT 'no'::"public"."jv_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_builder_jv" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_compliance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "delegate_identified" boolean DEFAULT false,
    "delegate_elected" boolean DEFAULT false,
    "delegate_elected_date" "date",
    "delegate_worker_id" "uuid",
    "hsr_chair_exists" boolean DEFAULT false,
    "hsr_is_delegate" boolean DEFAULT false,
    "hsr_worker_id" "uuid",
    "abn_worker_check_conducted" boolean DEFAULT false,
    "abn_worker_check_date" "date",
    "inductions_attended" boolean DEFAULT false,
    "last_induction_date" "date",
    "induction_attendees" "text"[],
    "delegate_site_access" "text",
    "delegate_site_access_other" "text",
    "reporting_frequency" "text" DEFAULT 'monthly'::"text",
    "next_report_date" "date",
    "version" integer DEFAULT 1,
    "is_current" boolean DEFAULT true,
    "effective_from" timestamp with time zone DEFAULT "now"(),
    "effective_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "project_compliance_delegate_site_access_check" CHECK (("delegate_site_access" = ANY (ARRAY['none'::"text", 'hammertech'::"text", 'other'::"text"]))),
    CONSTRAINT "project_compliance_reporting_frequency_check" CHECK (("reporting_frequency" = ANY (ARRAY['weekly'::"text", 'fortnightly'::"text", 'monthly'::"text", 'six_weekly'::"text", 'quarterly'::"text", 'ad_hoc'::"text"])))
);


ALTER TABLE "public"."project_compliance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_dashboard_summary" AS
 SELECT "id" AS "project_id",
    COALESCE(( SELECT "count"(DISTINCT "wp"."worker_id") AS "count"
           FROM ("public"."job_sites" "js"
             JOIN "public"."worker_placements" "wp" ON (("wp"."job_site_id" = "js"."id")))
          WHERE ("js"."project_id" = "p"."id")), (0)::bigint) AS "total_workers",
    COALESCE(( SELECT "count"(DISTINCT "wp"."worker_id") AS "count"
           FROM (("public"."job_sites" "js"
             JOIN "public"."worker_placements" "wp" ON (("wp"."job_site_id" = "js"."id")))
             JOIN "public"."workers" "w" ON (("w"."id" = "wp"."worker_id")))
          WHERE (("js"."project_id" = "p"."id") AND ("w"."union_membership_status" = 'member'::"public"."union_membership_status"))), (0)::bigint) AS "total_members",
    COALESCE(( SELECT "count"(DISTINCT "engaged"."e_id") AS "count"
           FROM ( SELECT "sct"."employer_id" AS "e_id"
                   FROM ("public"."site_contractor_trades" "sct"
                     JOIN "public"."job_sites" "js" ON (("js"."id" = "sct"."job_site_id")))
                  WHERE ("js"."project_id" = "p"."id")
                UNION
                 SELECT "per"."employer_id" AS "e_id"
                   FROM "public"."project_employer_roles" "per"
                  WHERE (("per"."project_id" = "p"."id") AND ("per"."role" = 'head_contractor'::"public"."project_role"))) "engaged"), (0)::bigint) AS "engaged_employer_count",
    COALESCE(( SELECT "count"(DISTINCT "cer"."employer_id") AS "count"
           FROM "public"."company_eba_records" "cer"
          WHERE ("cer"."employer_id" IN ( SELECT "engaged_e"."e_id"
                   FROM ( SELECT "sct"."employer_id" AS "e_id"
                           FROM ("public"."site_contractor_trades" "sct"
                             JOIN "public"."job_sites" "js" ON (("js"."id" = "sct"."job_site_id")))
                          WHERE ("js"."project_id" = "p"."id")
                        UNION
                         SELECT "per"."employer_id" AS "e_id"
                           FROM "public"."project_employer_roles" "per"
                          WHERE (("per"."project_id" = "p"."id") AND ("per"."role" = 'head_contractor'::"public"."project_role"))) "engaged_e"))), (0)::bigint) AS "eba_active_employer_count",
    COALESCE(( SELECT "sum"("x"."est") AS "sum"
           FROM ( SELECT "max"(COALESCE("pct"."estimated_project_workforce", (0)::numeric)) AS "est"
                   FROM "public"."project_contractor_trades" "pct"
                  WHERE ("pct"."project_id" = "p"."id")
                  GROUP BY "pct"."employer_id") "x"), (0)::numeric) AS "estimated_total",
    ( SELECT TRIM(BOTH FROM "concat"(COALESCE("w"."first_name", ''::"text"), ' ', COALESCE("w"."surname", ''::"text"))) AS "btrim"
           FROM ("public"."union_roles" "ur"
             JOIN "public"."workers" "w" ON (("w"."id" = "ur"."worker_id")))
          WHERE (("ur"."job_site_id" IN ( SELECT "job_sites"."id"
                   FROM "public"."job_sites"
                  WHERE ("job_sites"."project_id" = "p"."id"))) AND (("ur"."end_date" IS NULL) OR ("ur"."end_date" >= CURRENT_DATE)) AND ("ur"."name" = ANY (ARRAY['site_delegate'::"public"."union_role_type", 'shift_delegate'::"public"."union_role_type", 'company_delegate'::"public"."union_role_type", 'hsr'::"public"."union_role_type"])))
          ORDER BY
                CASE "ur"."name"
                    WHEN 'site_delegate'::"public"."union_role_type" THEN 1
                    WHEN 'shift_delegate'::"public"."union_role_type" THEN 2
                    WHEN 'company_delegate'::"public"."union_role_type" THEN 3
                    WHEN 'hsr'::"public"."union_role_type" THEN 4
                    ELSE 5
                END, "ur"."worker_id"
         LIMIT 1) AS "delegate_name",
    COALESCE(( SELECT "p2"."name"
           FROM ("public"."patch_job_sites" "pjs"
             JOIN "public"."patches" "p2" ON (("p2"."id" = "pjs"."patch_id")))
          WHERE (("pjs"."job_site_id" IN ( SELECT "job_sites"."id"
                   FROM "public"."job_sites"
                  WHERE ("job_sites"."project_id" = "p"."id"))) AND ("pjs"."effective_to" IS NULL))
         LIMIT 1), ( SELECT "p2"."name"
           FROM ("public"."job_sites" "js"
             JOIN "public"."patches" "p2" ON (("p2"."id" = "js"."patch_id")))
          WHERE (("js"."project_id" = "p"."id") AND ("js"."patch_id" IS NOT NULL))
         LIMIT 1)) AS "first_patch_name",
    ( SELECT "string_agg"(DISTINCT "all_organisers"."organiser_name", ', '::"text") AS "string_agg"
           FROM ( SELECT "prof"."full_name" AS "organiser_name"
                   FROM ((("public"."job_sites" "js"
                     JOIN "public"."patch_job_sites" "pjs" ON ((("pjs"."job_site_id" = "js"."id") AND ("pjs"."effective_to" IS NULL))))
                     JOIN "public"."organiser_patch_assignments" "opa" ON ((("opa"."patch_id" = "pjs"."patch_id") AND ("opa"."effective_to" IS NULL))))
                     JOIN "public"."profiles" "prof" ON (("prof"."id" = "opa"."organiser_id")))
                  WHERE (("js"."project_id" = "p"."id") AND ("prof"."full_name" IS NOT NULL))
                UNION
                 SELECT "pu"."full_name" AS "organiser_name"
                   FROM ("public"."pending_users" "pu"
                     CROSS JOIN LATERAL "unnest"("pu"."assigned_patch_ids") "assigned_patch_id"("assigned_patch_id"))
                  WHERE (("pu"."status" = ANY (ARRAY['draft'::"text", 'invited'::"text"])) AND ("pu"."role" = 'organiser'::"text") AND ("pu"."full_name" IS NOT NULL) AND ("assigned_patch_id"."assigned_patch_id" IN ( SELECT "pjs"."patch_id"
                           FROM ("public"."job_sites" "js"
                             JOIN "public"."patch_job_sites" "pjs" ON ((("pjs"."job_site_id" = "js"."id") AND ("pjs"."effective_to" IS NULL))))
                          WHERE ("js"."project_id" = "p"."id"))))) "all_organisers") AS "organiser_names"
   FROM "public"."projects" "p";


ALTER VIEW "public"."project_dashboard_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_dashboard_summary" IS 'Summarized project data for dashboard cards including fixed patch and organiser information';



CREATE TABLE IF NOT EXISTS "public"."project_eba_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "status" "public"."eba_status" DEFAULT 'no'::"public"."eba_status" NOT NULL,
    "registration_number" "text",
    "eba_title" "text",
    "bargaining_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_eba_details" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."project_list_comprehensive_view" AS
 SELECT "p"."id",
    "p"."name",
    "p"."main_job_site_id",
    "p"."value",
    "p"."tier",
    "p"."organising_universe",
    "p"."stage_class",
    "p"."created_at",
    "p"."updated_at",
    "js"."full_address",
    "lower"((((((("p"."name" || ' '::"text") || COALESCE(("p"."organising_universe")::"text", ''::"text")) || ' '::"text") || COALESCE(("p"."stage_class")::"text", ''::"text")) || ' '::"text") || COALESCE("js"."full_address", ''::"text"))) AS "search_text",
    COALESCE("pds"."total_workers", (0)::bigint) AS "total_workers",
    COALESCE("pds"."total_members", (0)::bigint) AS "total_members",
    COALESCE("pds"."engaged_employer_count", (0)::bigint) AS "engaged_employer_count",
    COALESCE("pds"."eba_active_employer_count", (0)::bigint) AS "eba_active_employer_count",
    COALESCE("pds"."estimated_total", (0)::numeric) AS "estimated_total",
    "pds"."delegate_name",
    "pds"."first_patch_name",
    ( SELECT "string_agg"(DISTINCT "pr"."full_name", ', '::"text" ORDER BY "pr"."full_name") AS "string_agg"
           FROM ((("public"."patch_job_sites" "pjs"
             JOIN "public"."job_sites" "js_1" ON (("js_1"."id" = "pjs"."job_site_id")))
             JOIN "public"."organiser_patch_assignments" "opa" ON ((("opa"."patch_id" = "pjs"."patch_id") AND ("opa"."effective_to" IS NULL))))
             JOIN "public"."profiles" "pr" ON (("pr"."id" = "opa"."organiser_id")))
          WHERE (("js_1"."project_id" = "p"."id") AND ("pjs"."effective_to" IS NULL))) AS "organiser_names",
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM "public"."project_assignments" "pa"
              WHERE (("pa"."project_id" = "p"."id") AND ("pa"."assignment_type" = 'contractor_role'::"text")))) THEN true
            ELSE false
        END AS "has_builder",
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM ("public"."project_assignments" "pa"
                 JOIN "public"."employers" "e" ON (("e"."id" = "pa"."employer_id")))
              WHERE (("pa"."project_id" = "p"."id") AND ("pa"."assignment_type" = 'contractor_role'::"text") AND ("e"."enterprise_agreement_status" = true)))) THEN true
            ELSE false
        END AS "builder_has_eba",
        CASE
            WHEN (COALESCE("pds"."engaged_employer_count", (0)::bigint) > 0) THEN "round"((((COALESCE("pds"."eba_active_employer_count", (0)::bigint))::numeric / ("pds"."engaged_employer_count")::numeric) * (100)::numeric))
            ELSE (0)::numeric
        END AS "eba_coverage_percent",
    ( SELECT COALESCE("json_agg"("json_build_object"('assignment_type', "pa"."assignment_type", 'employer_id', "pa"."employer_id", 'contractor_role_types',
                CASE
                    WHEN ("crt"."code" IS NOT NULL) THEN "json_build_object"('code', "crt"."code")
                    ELSE NULL::json
                END, 'trade_types',
                CASE
                    WHEN ("tt"."code" IS NOT NULL) THEN "json_build_object"('code', "tt"."code")
                    ELSE NULL::json
                END, 'employers',
                CASE
                    WHEN ("e"."name" IS NOT NULL) THEN "json_build_object"('name', "e"."name", 'enterprise_agreement_status', "e"."enterprise_agreement_status")
                    ELSE NULL::json
                END)), '[]'::json) AS "coalesce"
           FROM ((("public"."project_assignments" "pa"
             LEFT JOIN "public"."contractor_role_types" "crt" ON (("crt"."id" = "pa"."contractor_role_type_id")))
             LEFT JOIN "public"."trade_types" "tt" ON (("tt"."id" = "pa"."trade_type_id")))
             LEFT JOIN "public"."employers" "e" ON (("e"."id" = "pa"."employer_id")))
          WHERE ("pa"."project_id" = "p"."id")) AS "project_assignments_data",
    "now"() AS "computed_at"
   FROM (("public"."projects" "p"
     LEFT JOIN "public"."project_dashboard_summary" "pds" ON (("pds"."project_id" = "p"."id")))
     LEFT JOIN "public"."job_sites" "js" ON (("js"."id" = "p"."main_job_site_id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."project_list_comprehensive_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_organisers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "organiser_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_organisers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_subset_eba_stats" AS
 SELECT "p"."id" AS "project_id",
    "p"."name" AS "project_name",
    "stats"."known_employer_count",
    "stats"."eba_active_count",
    "stats"."eba_percentage"
   FROM ("public"."projects" "p"
     CROSS JOIN LATERAL "public"."get_project_subset_stats"("p"."id") "stats"("known_employer_count", "eba_active_count", "eba_percentage"));


ALTER VIEW "public"."project_subset_eba_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_subset_eba_stats" IS 'Pre-calculated subset EBA statistics for all projects, focusing on builders, project managers, and key trade types';



CREATE TABLE IF NOT EXISTS "public"."project_trade_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "stage" "public"."trade_stage" NOT NULL,
    "trade_type" "public"."trade_type" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_trade_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_hierarchy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_user_id" "uuid" NOT NULL,
    "child_user_id" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_hierarchy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_site_id" "uuid" NOT NULL,
    "role" "public"."site_contact_role" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_employers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_site_id" "uuid",
    "employer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."site_employers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "job_site_id" "uuid" NOT NULL,
    "sv_code" "text" NOT NULL,
    "objective" "text",
    "estimated_workers_count" integer,
    "scheduled_at" timestamp with time zone,
    "outcomes_locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_visit" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."site_visit_list_view" AS
 SELECT "sv"."id",
    "sv"."created_at",
    "sv"."updated_at",
    "sv"."scheduled_at",
    "sv"."objective",
    "sv"."estimated_workers_count",
    "sv"."outcomes_locked",
    "sv"."sv_code",
    "js"."name" AS "job_site_name",
    "js"."full_address" AS "job_site_address",
    "js"."location" AS "job_site_location",
    "js"."id" AS "job_site_id",
    "p"."name" AS "project_name",
    "p"."id" AS "project_id",
    "e"."name" AS "employer_name",
    "e"."id" AS "employer_id",
    "lower"(((((((((COALESCE("js"."name", ''::"text") || ' '::"text") || COALESCE("p"."name", ''::"text")) || ' '::"text") || COALESCE("e"."name", ''::"text")) || ' '::"text") || COALESCE("sv"."objective", ''::"text")) || ' '::"text") || COALESCE("sv"."sv_code", ''::"text"))) AS "search_text",
        CASE
            WHEN ("sv"."scheduled_at" IS NOT NULL) THEN ("sv"."scheduled_at" < (CURRENT_DATE - '7 days'::interval))
            ELSE ("sv"."created_at" < (CURRENT_DATE - '7 days'::interval))
        END AS "is_stale",
    "jsonb_build_object"('name', "js"."name", 'full_address', "js"."full_address", 'location', "js"."location", 'projects', "jsonb_build_object"('name', "p"."name")) AS "job_sites_data",
    "jsonb_build_object"('name', "e"."name") AS "employers_data",
    NULL::"jsonb" AS "profiles_data",
    "now"() AS "computed_at"
   FROM ((("public"."site_visit" "sv"
     LEFT JOIN "public"."job_sites" "js" ON (("sv"."job_site_id" = "js"."id")))
     LEFT JOIN "public"."projects" "p" ON (("js"."project_id" = "p"."id")))
     LEFT JOIN "public"."employers" "e" ON (("sv"."employer_id" = "e"."id")))
  ORDER BY COALESCE("sv"."scheduled_at", "sv"."created_at") DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."site_visit_list_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_participation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid",
    "training_type" "text" NOT NULL,
    "date" "date" NOT NULL,
    "status" "public"."training_status" DEFAULT 'completed'::"public"."training_status",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_participation" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unallocated_workers_analysis" WITH ("security_invoker"='true') AS
 SELECT "w"."id",
    "w"."first_name",
    "w"."surname",
    "w"."member_number",
    "w"."union_membership_status",
    "w"."email",
    "w"."mobile_phone",
        CASE
            WHEN ("wp"."employer_id" IS NULL) THEN 'no_employer'::"text"
            WHEN ("wp"."job_site_id" IS NULL) THEN 'no_job_site'::"text"
            ELSE 'allocated'::"text"
        END AS "allocation_status",
    "wp"."employer_id",
    "wp"."job_site_id",
    "e"."name" AS "employer_name",
    "js"."name" AS "job_site_name"
   FROM ((("public"."workers" "w"
     LEFT JOIN "public"."worker_placements" "wp" ON (("w"."id" = "wp"."worker_id")))
     LEFT JOIN "public"."employers" "e" ON (("wp"."employer_id" = "e"."id")))
     LEFT JOIN "public"."job_sites" "js" ON (("wp"."job_site_id" = "js"."id")))
  WHERE (("wp"."employer_id" IS NULL) OR ("wp"."job_site_id" IS NULL) OR ("wp"."id" IS NULL));


ALTER VIEW "public"."unallocated_workers_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."union_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_type" "public"."activity_type" NOT NULL,
    "topic" "text",
    "date" "date" NOT NULL,
    "job_site_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "template_id" "uuid",
    "custom_activity_type" "text",
    "assignment_metadata" "jsonb",
    "total_participants" integer DEFAULT 0,
    "total_delegates" integer DEFAULT 0,
    "campaign_id" "uuid",
    "activity_ui_type" "text",
    "activity_call_to_action" "text"
);


ALTER TABLE "public"."union_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."union_activity_scopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "employer_id" "uuid",
    "job_site_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "union_activity_scopes_at_least_one_scope" CHECK ((("project_id" IS NOT NULL) OR ("employer_id" IS NOT NULL) OR ("job_site_id" IS NOT NULL)))
);


ALTER TABLE "public"."union_activity_scopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_role_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "assigned_by" "uuid",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_role_assignments_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'lead_organiser'::"text", 'organiser'::"text", 'delegate'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."user_role_assignments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lead_patches_current" WITH ("security_invoker"='true') AS
 SELECT "lead_organiser_id",
    "patch_id"
   FROM "public"."lead_organiser_patch_assignments"
  WHERE ("effective_to" IS NULL);


ALTER VIEW "public"."v_lead_patches_current" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_organiser_patches_current" WITH ("security_invoker"='true') AS
 SELECT "organiser_id",
    "patch_id"
   FROM "public"."organiser_patch_assignments"
  WHERE ("effective_to" IS NULL);


ALTER VIEW "public"."v_organiser_patches_current" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_patch_employers_current" WITH ("security_invoker"='true') AS
 SELECT "patch_id",
    "employer_id"
   FROM "public"."patch_employers"
  WHERE ("effective_to" IS NULL);


ALTER VIEW "public"."v_patch_employers_current" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_patch_sites_current" WITH ("security_invoker"='true') AS
 SELECT "patch_id",
    "job_site_id"
   FROM "public"."patch_job_sites"
  WHERE ("effective_to" IS NULL);


ALTER VIEW "public"."v_patch_sites_current" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_project_current_roles" WITH ("security_invoker"='true') AS
 SELECT "project_id",
    "employer_id",
    "role"
   FROM "public"."project_employer_roles"
  WHERE (("start_date" <= CURRENT_DATE) AND (("end_date" IS NULL) OR ("end_date" >= CURRENT_DATE)));


ALTER VIEW "public"."v_project_current_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_project_site_contractors" WITH ("security_invoker"='true') AS
 SELECT "js"."project_id",
    "sct"."job_site_id",
    "sct"."employer_id",
    ("sct"."trade_type")::"text" AS "trade_type",
    "sct"."eba_status",
    ("sct"."eba_signatory")::"text" AS "eba_signatory",
    "sct"."start_date",
    "sct"."end_date"
   FROM ("public"."site_contractor_trades" "sct"
     JOIN "public"."job_sites" "js" ON (("js"."id" = "sct"."job_site_id")));


ALTER VIEW "public"."v_project_site_contractors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_project_workers" WITH ("security_invoker"='true') AS
 SELECT "js"."project_id",
    "wp"."worker_id",
    "wp"."employer_id",
    "wp"."job_site_id",
    "wp"."start_date",
    "wp"."end_date",
    ("wp"."employment_status")::"text" AS "employment_status"
   FROM ("public"."worker_placements" "wp"
     JOIN "public"."job_sites" "js" ON (("js"."id" = "wp"."job_site_id")));


ALTER VIEW "public"."v_project_workers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_unified_project_contractors" AS
 SELECT "p"."id" AS "project_id",
    "p"."builder_id" AS "employer_id",
    'builder'::"text" AS "role",
    'legacy_builder_id'::"text" AS "source"
   FROM "public"."projects" "p"
  WHERE ("p"."builder_id" IS NOT NULL)
UNION ALL
 SELECT "per"."project_id",
    "per"."employer_id",
    ("per"."role")::"text" AS "role",
    'project_employer_roles'::"text" AS "source"
   FROM "public"."project_employer_roles" "per"
UNION ALL
 SELECT "pa"."project_id",
    "pa"."employer_id",
    "crt"."name" AS "role",
    'project_assignments'::"text" AS "source"
   FROM ("public"."project_assignments" "pa"
     JOIN "public"."contractor_role_types" "crt" ON (("pa"."contractor_role_type_id" = "crt"."id")))
  WHERE ("pa"."assignment_type" = 'contractor_role'::"text");


ALTER VIEW "public"."v_unified_project_contractors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whs_assessment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_visit_id" "uuid" NOT NULL,
    "rating_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whs_assessment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whs_breach" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whs_assessment_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "rating_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whs_breach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_activity_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid",
    "activity_id" "uuid",
    "rating_type" "public"."rating_type" NOT NULL,
    "rating_value" integer,
    "rated_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_rating_value_range" CHECK ((("rating_value" IS NULL) OR (("rating_value" >= 1) AND ("rating_value" <= 5)))),
    CONSTRAINT "worker_activity_ratings_rating_value_check" CHECK ((("rating_value" >= 1) AND ("rating_value" <= 5)))
);


ALTER TABLE "public"."worker_activity_ratings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."worker_activity_ratings"."rating_value" IS 'Activity participation rating: 1=Supporter Activist, 2=Supporter, 3=Undecided, 4=Opposed, 5=Opposed Activist. NULL=Unassessed';



CREATE TABLE IF NOT EXISTS "public"."worker_delegate_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "delegate_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."worker_delegate_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_memberships" (
    "worker_id" "uuid" NOT NULL,
    "payment_method" "public"."payment_method_type" DEFAULT 'unknown'::"public"."payment_method_type" NOT NULL,
    "dd_status" "public"."dd_status_type" DEFAULT 'not_started'::"public"."dd_status_type" NOT NULL,
    "dd_mandate_id" "text",
    "arrears_amount" numeric(12,2) DEFAULT 0,
    "last_payment_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."worker_memberships" OWNER TO "postgres";


ALTER TABLE ONLY "public"."company_eba_records"
    ADD CONSTRAINT "company_eba_records_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "public"."employer_list_view" AS
 SELECT "e"."id",
    "e"."name",
    "e"."abn",
    "e"."employer_type",
    "e"."website",
    "e"."email",
    "e"."phone",
    "e"."estimated_worker_count",
    "count"(DISTINCT "wp"."id") AS "worker_placement_count",
    "count"(DISTINCT "pa"."id") AS "project_assignment_count",
    "public"."get_eba_category"("jsonb_build_object"('fwc_certified_date', "cer"."fwc_certified_date", 'eba_lodged_fwc', "cer"."eba_lodged_fwc", 'date_eba_signed', "cer"."date_eba_signed", 'date_vote_occurred', "cer"."date_vote_occurred")) AS "eba_category",
    "public"."calculate_eba_recency_score"("jsonb_build_object"('fwc_certified_date', "cer"."fwc_certified_date", 'eba_lodged_fwc', "cer"."eba_lodged_fwc", 'date_eba_signed', "cer"."date_eba_signed", 'date_vote_occurred', "cer"."date_vote_occurred")) AS "eba_recency_score",
    "row_to_json"("cer".*) AS "company_eba_record",
    "public"."is_employer_engaged"("e"."estimated_worker_count", ("count"(DISTINCT "wp"."id"))::integer, ("count"(DISTINCT "pa"."id"))::integer, "public"."get_eba_category"("jsonb_build_object"('fwc_certified_date', "cer"."fwc_certified_date", 'eba_lodged_fwc', "cer"."eba_lodged_fwc", 'date_eba_signed', "cer"."date_eba_signed", 'date_vote_occurred', "cer"."date_vote_occurred"))) AS "is_engaged",
    COALESCE("array_agg"(DISTINCT "wp"."id") FILTER (WHERE ("wp"."id" IS NOT NULL)), ARRAY[]::"uuid"[]) AS "worker_placement_ids",
    COALESCE("array_agg"(DISTINCT "pa"."id") FILTER (WHERE ("pa"."id" IS NOT NULL)), ARRAY[]::"uuid"[]) AS "project_assignment_ids",
    "lower"(((((((((COALESCE("e"."name", ''::"text") || ' '::"text") || COALESCE("e"."abn", ''::"text")) || ' '::"text") || COALESCE("e"."email", ''::"text")) || ' '::"text") || COALESCE("e"."phone", ''::"text")) || ' '::"text") || COALESCE("e"."website", ''::"text"))) AS "search_text",
    "now"() AS "computed_at"
   FROM ((("public"."employers" "e"
     LEFT JOIN "public"."company_eba_records" "cer" ON (("e"."id" = "cer"."employer_id")))
     LEFT JOIN "public"."worker_placements" "wp" ON (("e"."id" = "wp"."employer_id")))
     LEFT JOIN "public"."project_assignments" "pa" ON (("e"."id" = "pa"."employer_id")))
  GROUP BY "e"."id", "e"."name", "e"."abn", "e"."employer_type", "e"."website", "e"."email", "e"."phone", "e"."estimated_worker_count", "cer"."id", "cer"."fwc_certified_date", "cer"."eba_lodged_fwc", "cer"."date_eba_signed", "cer"."date_vote_occurred"
  ORDER BY "e"."name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."employer_list_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."organisers"
    ADD CONSTRAINT "organisers_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "public"."worker_list_view" AS
 SELECT "w"."id",
    "w"."first_name",
    "w"."surname",
    "w"."nickname",
    "w"."email",
    "w"."mobile_phone",
    "w"."member_number",
    "w"."union_membership_status",
    "count"(DISTINCT "wp"."id") AS "worker_placement_count",
    COALESCE("array_agg"(DISTINCT "wp"."job_title") FILTER (WHERE ("wp"."job_title" IS NOT NULL)), ARRAY[]::"text"[]) AS "job_titles",
    COALESCE("array_agg"(DISTINCT "js"."name") FILTER (WHERE ("js"."name" IS NOT NULL)), ARRAY[]::"text"[]) AS "job_site_names",
    "row_to_json"("o".*) AS "organiser_data",
    "lower"(((((((((((((((COALESCE("w"."first_name", ''::"text") || ' '::"text") || COALESCE("w"."surname", ''::"text")) || ' '::"text") || COALESCE("w"."nickname", ''::"text")) || ' '::"text") || COALESCE("w"."email", ''::"text")) || ' '::"text") || COALESCE("w"."mobile_phone", ''::"text")) || ' '::"text") || COALESCE("w"."member_number", ''::"text")) || ' '::"text") || COALESCE("string_agg"(DISTINCT "wp"."job_title", ' '::"text"), ''::"text")) || ' '::"text") || COALESCE("string_agg"(DISTINCT "js"."name", ' '::"text"), ''::"text"))) AS "search_text",
    COALESCE("array_agg"(DISTINCT "jsonb_build_object"('job_title', "wp"."job_title", 'job_sites', "jsonb_build_object"('name', "js"."name"))) FILTER (WHERE ("wp"."id" IS NOT NULL)), ARRAY[]::"jsonb"[]) AS "worker_placements_data",
    "now"() AS "computed_at"
   FROM ((("public"."workers" "w"
     LEFT JOIN "public"."worker_placements" "wp" ON (("w"."id" = "wp"."worker_id")))
     LEFT JOIN "public"."job_sites" "js" ON (("wp"."job_site_id" = "js"."id")))
     LEFT JOIN "public"."organisers" "o" ON (("w"."organiser_id" = "o"."id")))
  GROUP BY "w"."id", "w"."first_name", "w"."surname", "w"."nickname", "w"."email", "w"."mobile_phone", "w"."member_number", "w"."union_membership_status", "o"."id", "o"."first_name", "o"."last_name"
  ORDER BY "w"."first_name", "w"."surname"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."worker_list_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_delegations"
    ADD CONSTRAINT "activity_delegations_activity_id_assigned_worker_id_key" UNIQUE ("activity_id", "assigned_worker_id");



ALTER TABLE ONLY "public"."activity_delegations"
    ADD CONSTRAINT "activity_delegations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_objective_targets"
    ADD CONSTRAINT "activity_objective_targets_objective_id_dimension_dimension_key" UNIQUE ("objective_id", "dimension", "dimension_id");



ALTER TABLE ONLY "public"."activity_objective_targets"
    ADD CONSTRAINT "activity_objective_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_objectives"
    ADD CONSTRAINT "activity_objectives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_activity_id_worker_id_key" UNIQUE ("activity_id", "worker_id");



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_rating_definitions"
    ADD CONSTRAINT "activity_rating_definitions_activity_id_level_key" UNIQUE ("activity_id", "level");



ALTER TABLE ONLY "public"."activity_rating_definitions"
    ADD CONSTRAINT "activity_rating_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_templates"
    ADD CONSTRAINT "activity_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_workers"
    ADD CONSTRAINT "activity_workers_activity_id_worker_id_key" UNIQUE ("activity_id", "worker_id");



ALTER TABLE ONLY "public"."activity_workers"
    ADD CONSTRAINT "activity_workers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."campaign_assignments"
    ADD CONSTRAINT "campaign_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_kpis"
    ADD CONSTRAINT "campaign_kpis_campaign_id_kpi_id_key" UNIQUE ("campaign_id", "kpi_id");



ALTER TABLE ONLY "public"."campaign_kpis"
    ADD CONSTRAINT "campaign_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_alerts"
    ADD CONSTRAINT "compliance_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_role_types"
    ADD CONSTRAINT "contractor_role_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."contractor_role_types"
    ADD CONSTRAINT "contractor_role_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_trade_capabilities"
    ADD CONSTRAINT "contractor_trade_capabilities_employer_id_trade_type_key" UNIQUE ("employer_id", "trade_type");



ALTER TABLE ONLY "public"."contractor_trade_capabilities"
    ADD CONSTRAINT "contractor_trade_capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dd_conversion_attempt"
    ADD CONSTRAINT "dd_conversion_attempt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delegate_assessment"
    ADD CONSTRAINT "delegate_assessment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delegate_field_permissions"
    ADD CONSTRAINT "delegate_field_permissions_organiser_id_entity_field_id_key" UNIQUE ("organiser_id", "entity_field_id");



ALTER TABLE ONLY "public"."delegate_field_permissions"
    ADD CONSTRAINT "delegate_field_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delegate_role_rating"
    ADD CONSTRAINT "delegate_role_rating_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."draft_lead_organiser_links"
    ADD CONSTRAINT "draft_lead_organiser_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_aliases"
    ADD CONSTRAINT "employer_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_capabilities"
    ADD CONSTRAINT "employer_capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_compliance_checks"
    ADD CONSTRAINT "employer_compliance_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_organisers"
    ADD CONSTRAINT "employer_organisers_employer_id_organiser_id_key" UNIQUE ("employer_id", "organiser_id");



ALTER TABLE ONLY "public"."employer_organisers"
    ADD CONSTRAINT "employer_organisers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_role_tags"
    ADD CONSTRAINT "employer_role_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employer_role_tags"
    ADD CONSTRAINT "employer_role_tags_unique" UNIQUE ("employer_id", "tag");



ALTER TABLE ONLY "public"."employers"
    ADD CONSTRAINT "employers_incolink_employer_id_key" UNIQUE ("incolink_id");



ALTER TABLE ONLY "public"."employers"
    ADD CONSTRAINT "employers_incolink_id_unique" UNIQUE ("incolink_id");



ALTER TABLE ONLY "public"."employers"
    ADD CONSTRAINT "employers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entitlements_audit"
    ADD CONSTRAINT "entitlements_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_fields"
    ADD CONSTRAINT "entity_fields_entity_type_field_name_key" UNIQUE ("entity_type", "field_name");



ALTER TABLE ONLY "public"."entity_fields"
    ADD CONSTRAINT "entity_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."field_permissions"
    ADD CONSTRAINT "field_permissions_entity_field_id_role_key" UNIQUE ("entity_field_id", "role");



ALTER TABLE ONLY "public"."field_permissions"
    ADD CONSTRAINT "field_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fwc_lookup_jobs"
    ADD CONSTRAINT "fwc_lookup_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fwc_lookup_results"
    ADD CONSTRAINT "fwc_lookup_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_sites"
    ADD CONSTRAINT "job_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_definitions"
    ADD CONSTRAINT "kpi_definitions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."kpi_definitions"
    ADD CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_draft_organiser_links"
    ADD CONSTRAINT "lead_draft_organiser_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_draft_organiser_links"
    ADD CONSTRAINT "lead_draft_organiser_links_uidx" UNIQUE ("lead_user_id", "pending_user_id", "start_date");



ALTER TABLE ONLY "public"."lead_organiser_patch_assignments"
    ADD CONSTRAINT "lead_organiser_patch_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organiser_allocations"
    ADD CONSTRAINT "organiser_allocations_organiser_id_entity_type_entity_id_st_key" UNIQUE ("organiser_id", "entity_type", "entity_id", "start_date");



ALTER TABLE ONLY "public"."organiser_allocations"
    ADD CONSTRAINT "organiser_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organiser_patch_assignments"
    ADD CONSTRAINT "organiser_patch_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organising_universe_change_log"
    ADD CONSTRAINT "organising_universe_change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."overlay_images"
    ADD CONSTRAINT "overlay_images_file_path_key" UNIQUE ("file_path");



ALTER TABLE ONLY "public"."overlay_images"
    ADD CONSTRAINT "overlay_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patch_employers"
    ADD CONSTRAINT "patch_employers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patch_job_sites"
    ADD CONSTRAINT "patch_job_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patch_regions"
    ADD CONSTRAINT "patch_regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patches"
    ADD CONSTRAINT "patches_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."patches"
    ADD CONSTRAINT "patches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_employers"
    ADD CONSTRAINT "pending_employers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_users"
    ADD CONSTRAINT "pending_users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."pending_users"
    ADD CONSTRAINT "pending_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_builder_jv"
    ADD CONSTRAINT "project_builder_jv_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_contractor_trades"
    ADD CONSTRAINT "project_contractor_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_contractor_trades"
    ADD CONSTRAINT "project_contractor_trades_uniq" UNIQUE ("project_id", "employer_id", "trade_type");



ALTER TABLE ONLY "public"."project_eba_details"
    ADD CONSTRAINT "project_eba_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_eba_details"
    ADD CONSTRAINT "project_eba_details_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."project_employer_roles"
    ADD CONSTRAINT "project_employer_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_organisers"
    ADD CONSTRAINT "project_organisers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_organisers"
    ADD CONSTRAINT "project_organisers_project_id_organiser_id_key" UNIQUE ("project_id", "organiser_id");



ALTER TABLE ONLY "public"."project_trade_availability"
    ADD CONSTRAINT "project_trade_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_trade_availability"
    ADD CONSTRAINT "project_trade_availability_project_id_stage_trade_type_key" UNIQUE ("project_id", "stage", "trade_type");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_hierarchy"
    ADD CONSTRAINT "role_hierarchy_parent_user_id_child_user_id_start_date_key" UNIQUE ("parent_user_id", "child_user_id", "start_date");



ALTER TABLE ONLY "public"."role_hierarchy"
    ADD CONSTRAINT "role_hierarchy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_contacts"
    ADD CONSTRAINT "site_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_contractor_trades"
    ADD CONSTRAINT "site_contractor_trades_job_site_id_employer_id_trade_type_key" UNIQUE ("job_site_id", "employer_id", "trade_type");



ALTER TABLE ONLY "public"."site_contractor_trades"
    ADD CONSTRAINT "site_contractor_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_employers"
    ADD CONSTRAINT "site_employers_job_site_id_employer_id_key" UNIQUE ("job_site_id", "employer_id");



ALTER TABLE ONLY "public"."site_employers"
    ADD CONSTRAINT "site_employers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_visit"
    ADD CONSTRAINT "site_visit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_visit"
    ADD CONSTRAINT "site_visit_sv_code_key" UNIQUE ("sv_code");



ALTER TABLE ONLY "public"."trade_types"
    ADD CONSTRAINT "trade_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."trade_types"
    ADD CONSTRAINT "trade_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_participation"
    ADD CONSTRAINT "training_participation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."union_activities"
    ADD CONSTRAINT "union_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."union_activity_scopes"
    ADD CONSTRAINT "union_activity_scopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."union_roles"
    ADD CONSTRAINT "union_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_builder_jv"
    ADD CONSTRAINT "uniq_project_builder_jv" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_user_id_role_start_date_key" UNIQUE ("user_id", "role", "start_date");



ALTER TABLE ONLY "public"."whs_assessment"
    ADD CONSTRAINT "whs_assessment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whs_breach"
    ADD CONSTRAINT "whs_breach_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_activity_ratings"
    ADD CONSTRAINT "worker_activity_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_delegate_assignments"
    ADD CONSTRAINT "worker_delegate_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_delegate_assignments"
    ADD CONSTRAINT "worker_delegate_assignments_worker_id_delegate_id_start_dat_key" UNIQUE ("worker_id", "delegate_id", "start_date");



ALTER TABLE ONLY "public"."worker_memberships"
    ADD CONSTRAINT "worker_memberships_pkey" PRIMARY KEY ("worker_id");



ALTER TABLE ONLY "public"."worker_placements"
    ADD CONSTRAINT "worker_placements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "employer_aliases_alias_normalized_idx" ON "public"."employer_aliases" USING "btree" ("alias_normalized");



CREATE INDEX "employer_aliases_employer_id_idx" ON "public"."employer_aliases" USING "btree" ("employer_id");



CREATE INDEX "fki_campaign_assignments_campaign_id_fkey" ON "public"."campaign_assignments" USING "btree" ("campaign_id");



CREATE INDEX "fki_campaign_assignments_job_site_id_fkey" ON "public"."campaign_assignments" USING "btree" ("job_site_id");



CREATE INDEX "fki_campaign_assignments_organiser_id_fkey" ON "public"."campaign_assignments" USING "btree" ("organiser_id");



CREATE INDEX "fki_campaign_assignments_project_id_fkey" ON "public"."campaign_assignments" USING "btree" ("project_id");



CREATE INDEX "fki_campaign_kpis_created_by_fkey" ON "public"."campaign_kpis" USING "btree" ("created_by");



CREATE INDEX "fki_campaigns_created_by_fkey" ON "public"."campaigns" USING "btree" ("created_by");



CREATE INDEX "fki_employers_parent_employer_id_fkey" ON "public"."employers" USING "btree" ("parent_employer_id");



CREATE INDEX "fki_job_sites_main_builder_id_fkey" ON "public"."job_sites" USING "btree" ("main_builder_id");



CREATE INDEX "fki_kpi_events_created_by_fkey" ON "public"."kpi_events" USING "btree" ("created_by");



CREATE INDEX "fki_kpi_events_organiser_id_fkey" ON "public"."kpi_events" USING "btree" ("organiser_id");



CREATE INDEX "fki_kpi_targets_created_by_fkey" ON "public"."kpi_targets" USING "btree" ("created_by");



CREATE INDEX "fki_organiser_allocations_allocated_by_fkey" ON "public"."organiser_allocations" USING "btree" ("allocated_by");



CREATE INDEX "fki_overlay_images_created_by_fkey" ON "public"."overlay_images" USING "btree" ("created_by");



CREATE INDEX "fki_overlay_images_updated_by_fkey" ON "public"."overlay_images" USING "btree" ("updated_by");



CREATE INDEX "fki_patches_created_by_fkey" ON "public"."patches" USING "btree" ("created_by");



CREATE INDEX "fki_patches_updated_by_fkey" ON "public"."patches" USING "btree" ("updated_by");



CREATE INDEX "fki_permission_audit_log_user_id_fkey" ON "public"."permission_audit_log" USING "btree" ("user_id");



CREATE INDEX "fki_role_hierarchy_assigned_by_fkey" ON "public"."role_hierarchy" USING "btree" ("assigned_by");



CREATE INDEX "fki_training_participation_worker_id_fkey" ON "public"."training_participation" USING "btree" ("worker_id");



CREATE INDEX "fki_union_activities_job_site_id_fkey" ON "public"."union_activities" USING "btree" ("job_site_id");



CREATE INDEX "fki_union_roles_job_site_id_fkey" ON "public"."union_roles" USING "btree" ("job_site_id");



CREATE INDEX "fki_union_roles_worker_id_fkey" ON "public"."union_roles" USING "btree" ("worker_id");



CREATE INDEX "fki_user_role_assignments_assigned_by_fkey" ON "public"."user_role_assignments" USING "btree" ("assigned_by");



CREATE INDEX "fki_worker_activity_ratings_rated_by_fkey" ON "public"."worker_activity_ratings" USING "btree" ("rated_by");



CREATE INDEX "fki_worker_delegate_assignments_assigned_by_fkey" ON "public"."worker_delegate_assignments" USING "btree" ("assigned_by");



CREATE INDEX "fki_workers_organiser_id_fkey" ON "public"."workers" USING "btree" ("organiser_id");



CREATE INDEX "idx_activities_created_at" ON "public"."activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activities_created_by" ON "public"."activities" USING "btree" ("created_by");



CREATE INDEX "idx_activities_employer_id" ON "public"."activities" USING "btree" ("employer_id");



CREATE INDEX "idx_activities_job_site_id" ON "public"."activities" USING "btree" ("job_site_id");



CREATE INDEX "idx_activities_metadata_gin" ON "public"."activities" USING "gin" ("metadata");



CREATE INDEX "idx_activities_project_id" ON "public"."activities" USING "btree" ("project_id");



CREATE INDEX "idx_activity_delegations_activity" ON "public"."activity_delegations" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_delegations_assigned" ON "public"."activity_delegations" USING "btree" ("assigned_worker_id");



CREATE INDEX "idx_activity_delegations_delegate" ON "public"."activity_delegations" USING "btree" ("delegate_worker_id");



CREATE INDEX "idx_activity_objective_targets_objective_id" ON "public"."activity_objective_targets" USING "btree" ("objective_id");



CREATE INDEX "idx_activity_objectives_activity_id" ON "public"."activity_objectives" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_participants_activity" ON "public"."activity_participants" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_participants_assignment" ON "public"."activity_participants" USING "btree" ("assignment_method", "assignment_source_id");



CREATE INDEX "idx_activity_participants_worker" ON "public"."activity_participants" USING "btree" ("worker_id");



CREATE INDEX "idx_activity_rating_definitions_activity_id" ON "public"."activity_rating_definitions" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_templates_category" ON "public"."activity_templates" USING "btree" ("category");



CREATE INDEX "idx_activity_workers_activity_id" ON "public"."activity_workers" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_workers_worker_id" ON "public"."activity_workers" USING "btree" ("worker_id");



CREATE INDEX "idx_campaign_kpis_kpi_id" ON "public"."campaign_kpis" USING "btree" ("kpi_id");



CREATE INDEX "idx_cap_employer" ON "public"."employer_capabilities" USING "btree" ("employer_id");



CREATE INDEX "idx_cap_role" ON "public"."employer_capabilities" USING "btree" ("contractor_role_type_id") WHERE ("contractor_role_type_id" IS NOT NULL);



CREATE INDEX "idx_cap_trade" ON "public"."employer_capabilities" USING "btree" ("trade_type_id") WHERE ("trade_type_id" IS NOT NULL);



CREATE INDEX "idx_company_eba_records_eba_file_number" ON "public"."company_eba_records" USING "btree" ("eba_file_number");



CREATE INDEX "idx_company_eba_records_employer_id" ON "public"."company_eba_records" USING "btree" ("employer_id");



CREATE INDEX "idx_company_eba_records_sector" ON "public"."company_eba_records" USING "btree" ("sector");



CREATE INDEX "idx_ctc_employer_id" ON "public"."contractor_trade_capabilities" USING "btree" ("employer_id");



CREATE INDEX "idx_ctc_trade_type" ON "public"."contractor_trade_capabilities" USING "btree" ("trade_type");



CREATE INDEX "idx_dashboard_organising_universe_stage" ON "public"."projects" USING "btree" ("organising_universe", "stage_class") WHERE (("organising_universe" IS NOT NULL) AND ("stage_class" IS NOT NULL));



CREATE INDEX "idx_dd_conversion_attempt_site_visit_id" ON "public"."dd_conversion_attempt" USING "btree" ("site_visit_id");



CREATE INDEX "idx_dd_conversion_attempt_worker_id" ON "public"."dd_conversion_attempt" USING "btree" ("worker_id");



CREATE INDEX "idx_delegate_assessment_site_visit_id" ON "public"."delegate_assessment" USING "btree" ("site_visit_id");



CREATE INDEX "idx_delegate_field_permissions_entity_field_id" ON "public"."delegate_field_permissions" USING "btree" ("entity_field_id");



CREATE INDEX "idx_delegate_role_rating_delegate_assessment_id" ON "public"."delegate_role_rating" USING "btree" ("delegate_assessment_id");



CREATE INDEX "idx_dlol_child_pending" ON "public"."draft_lead_organiser_links" USING "btree" ("organiser_pending_user_id", "is_active");



CREATE INDEX "idx_dlol_child_user" ON "public"."draft_lead_organiser_links" USING "btree" ("organiser_user_id", "is_active");



CREATE INDEX "idx_dlol_draft_lead" ON "public"."draft_lead_organiser_links" USING "btree" ("draft_lead_pending_user_id", "is_active");



CREATE INDEX "idx_draft_lead_organiser_links_assigned_by" ON "public"."draft_lead_organiser_links" USING "btree" ("assigned_by");



CREATE INDEX "idx_employer_compliance_current" ON "public"."employer_compliance_checks" USING "btree" ("project_id", "employer_id") WHERE ("is_current" = true);



CREATE INDEX "idx_employer_compliance_site_visit" ON "public"."employer_compliance_checks" USING "btree" ("site_visit_id");



CREATE INDEX "idx_employer_list_composite" ON "public"."employer_list_view" USING "btree" ("is_engaged", "eba_category", "employer_type");



CREATE INDEX "idx_employer_list_eba_category" ON "public"."employer_list_view" USING "btree" ("eba_category");



CREATE INDEX "idx_employer_list_eba_recency" ON "public"."employer_list_view" USING "btree" ("eba_recency_score" DESC);



CREATE INDEX "idx_employer_list_engaged" ON "public"."employer_list_view" USING "btree" ("is_engaged");



CREATE INDEX "idx_employer_list_estimated_workers" ON "public"."employer_list_view" USING "btree" ("estimated_worker_count" DESC);



CREATE INDEX "idx_employer_list_name" ON "public"."employer_list_view" USING "btree" ("name");



CREATE INDEX "idx_employer_list_search_text" ON "public"."employer_list_view" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_employer_list_type" ON "public"."employer_list_view" USING "btree" ("employer_type");



CREATE INDEX "idx_employer_organisers_organiser_id" ON "public"."employer_organisers" USING "btree" ("organiser_id");



CREATE INDEX "idx_employers_bci_company_id" ON "public"."employers" USING "btree" ("bci_company_id");



CREATE INDEX "idx_employers_employer_type" ON "public"."employers" USING "btree" ("employer_type");



CREATE INDEX "idx_employers_incolink_employer_id" ON "public"."employers" USING "btree" ("incolink_id") WHERE ("incolink_id" IS NOT NULL);



CREATE INDEX "idx_employers_incolink_id" ON "public"."employers" USING "btree" ("incolink_id") WHERE ("incolink_id" IS NOT NULL);



CREATE INDEX "idx_employers_lower_name" ON "public"."employers" USING "btree" ("lower"("name"));



CREATE INDEX "idx_employers_name" ON "public"."employers" USING "btree" ("name");



CREATE INDEX "idx_employers_name_id" ON "public"."employers" USING "btree" ("name", "id");



CREATE INDEX "idx_entitlements_audit_site_visit_id" ON "public"."entitlements_audit" USING "btree" ("site_visit_id");



CREATE INDEX "idx_ert_employer_id" ON "public"."employer_role_tags" USING "btree" ("employer_id");



CREATE INDEX "idx_ert_tag" ON "public"."employer_role_tags" USING "btree" ("tag");



CREATE INDEX "idx_fwc_lookup_jobs_created_at" ON "public"."fwc_lookup_jobs" USING "btree" ("created_at");



CREATE INDEX "idx_fwc_lookup_jobs_priority" ON "public"."fwc_lookup_jobs" USING "btree" ("priority");



CREATE INDEX "idx_fwc_lookup_jobs_status" ON "public"."fwc_lookup_jobs" USING "btree" ("status");



CREATE INDEX "idx_fwc_lookup_results_employer_id" ON "public"."fwc_lookup_results" USING "btree" ("employer_id");



CREATE INDEX "idx_fwc_lookup_results_job_id" ON "public"."fwc_lookup_results" USING "btree" ("job_id");



CREATE INDEX "idx_fwc_lookup_results_success" ON "public"."fwc_lookup_results" USING "btree" ("success");



CREATE INDEX "idx_job_sites_coordinates" ON "public"."job_sites" USING "gist" ("public"."st_setsrid"("public"."st_makepoint"("longitude", "latitude"), 4326)) WHERE (("longitude" IS NOT NULL) AND ("latitude" IS NOT NULL));



CREATE INDEX "idx_job_sites_project" ON "public"."job_sites" USING "btree" ("project_id");



CREATE INDEX "idx_job_sites_project_id" ON "public"."job_sites" USING "btree" ("project_id");



CREATE INDEX "idx_kpi_events_campaign" ON "public"."kpi_events" USING "btree" ("campaign_id", "kpi_id");



CREATE INDEX "idx_kpi_events_employer_id" ON "public"."kpi_events" USING "btree" ("employer_id");



CREATE INDEX "idx_kpi_events_kpi_id" ON "public"."kpi_events" USING "btree" ("kpi_id");



CREATE INDEX "idx_kpi_events_scope" ON "public"."kpi_events" USING "btree" ("job_site_id", "employer_id", "worker_id");



CREATE INDEX "idx_kpi_events_time" ON "public"."kpi_events" USING "btree" ("occurred_at");



CREATE INDEX "idx_kpi_events_worker_id" ON "public"."kpi_events" USING "btree" ("worker_id");



CREATE INDEX "idx_kpi_targets_campaign" ON "public"."kpi_targets" USING "btree" ("campaign_id");



CREATE INDEX "idx_kpi_targets_job_site_id" ON "public"."kpi_targets" USING "btree" ("job_site_id");



CREATE INDEX "idx_kpi_targets_kpi_id" ON "public"."kpi_targets" USING "btree" ("kpi_id");



CREATE INDEX "idx_kpi_targets_scopes" ON "public"."kpi_targets" USING "btree" ("organiser_id", "job_site_id");



CREATE INDEX "idx_ldol_lead" ON "public"."lead_draft_organiser_links" USING "btree" ("lead_user_id", "is_active");



CREATE INDEX "idx_ldol_pending" ON "public"."lead_draft_organiser_links" USING "btree" ("pending_user_id", "is_active");



CREATE INDEX "idx_lead_draft_organiser_links_assigned_by" ON "public"."lead_draft_organiser_links" USING "btree" ("assigned_by");



CREATE INDEX "idx_lead_organiser_patch_assignments_patch_id" ON "public"."lead_organiser_patch_assignments" USING "btree" ("patch_id");



CREATE INDEX "idx_oa_entity" ON "public"."organiser_allocations" USING "btree" ("entity_type", "entity_id", "is_active");



CREATE INDEX "idx_organiser_patch_assignments_patch_id" ON "public"."organiser_patch_assignments" USING "btree" ("patch_id");



CREATE INDEX "idx_pa_employer" ON "public"."project_assignments" USING "btree" ("employer_id");



CREATE INDEX "idx_pa_project" ON "public"."project_assignments" USING "btree" ("project_id");



CREATE INDEX "idx_pa_role" ON "public"."project_assignments" USING "btree" ("contractor_role_type_id") WHERE ("contractor_role_type_id" IS NOT NULL);



CREATE INDEX "idx_pa_trade" ON "public"."project_assignments" USING "btree" ("trade_type_id") WHERE ("trade_type_id" IS NOT NULL);



CREATE INDEX "idx_pa_type" ON "public"."project_assignments" USING "btree" ("assignment_type");



CREATE INDEX "idx_patch_employers_employer_id" ON "public"."patch_employers" USING "btree" ("employer_id");



CREATE INDEX "idx_patch_job_sites_job_site_id" ON "public"."patch_job_sites" USING "btree" ("job_site_id");



CREATE INDEX "idx_patch_project_mapping_composite" ON "public"."patch_project_mapping_view" USING "btree" ("patch_id", "project_id");



CREATE INDEX "idx_patch_project_mapping_patch_id" ON "public"."patch_project_mapping_view" USING "btree" ("patch_id");



CREATE INDEX "idx_patch_project_mapping_project_id" ON "public"."patch_project_mapping_view" USING "btree" ("project_id");



CREATE INDEX "idx_patch_regions_created_at" ON "public"."patch_regions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_patches_code" ON "public"."patches" USING "btree" ("code") WHERE ("code" IS NOT NULL);



CREATE INDEX "idx_patches_geom" ON "public"."patches" USING "gist" ("geom");



CREATE INDEX "idx_pending_employers_bci_company_id" ON "public"."pending_employers" USING "btree" ("bci_company_id");



CREATE INDEX "idx_pending_employers_import_status" ON "public"."pending_employers" USING "btree" ("import_status");



CREATE INDEX "idx_pending_employers_inferred_trade_type" ON "public"."pending_employers" USING "btree" ("inferred_trade_type");



CREATE INDEX "idx_pending_employers_our_role" ON "public"."pending_employers" USING "btree" ("our_role");



CREATE INDEX "idx_pending_users_created_by" ON "public"."pending_users" USING "btree" ("created_by");



CREATE INDEX "idx_pending_users_status" ON "public"."pending_users" USING "btree" ("status");



CREATE INDEX "idx_per_employer" ON "public"."project_employer_roles" USING "btree" ("employer_id");



CREATE INDEX "idx_per_project" ON "public"."project_employer_roles" USING "btree" ("project_id");



CREATE INDEX "idx_per_role" ON "public"."project_employer_roles" USING "btree" ("role");



CREATE INDEX "idx_project_assignments_contractor_role" ON "public"."project_assignments" USING "btree" ("project_id", "assignment_type", "contractor_role_type_id") WHERE ("assignment_type" = 'contractor_role'::"text");



CREATE INDEX "idx_project_assignments_match_status" ON "public"."project_assignments" USING "btree" ("match_status");



CREATE INDEX "idx_project_assignments_source" ON "public"."project_assignments" USING "btree" ("source");



CREATE INDEX "idx_project_compliance_current" ON "public"."project_compliance" USING "btree" ("project_id") WHERE ("is_current" = true);



CREATE INDEX "idx_project_contractor_trades_composite" ON "public"."project_contractor_trades" USING "btree" ("project_id", "employer_id", "trade_type", "stage");



CREATE INDEX "idx_project_contractor_trades_employer_id" ON "public"."project_contractor_trades" USING "btree" ("employer_id");



CREATE INDEX "idx_project_contractor_trades_match_status" ON "public"."project_contractor_trades" USING "btree" ("match_status");



CREATE INDEX "idx_project_contractor_trades_project_id" ON "public"."project_contractor_trades" USING "btree" ("project_id");



CREATE INDEX "idx_project_contractor_trades_source" ON "public"."project_contractor_trades" USING "btree" ("source");



CREATE INDEX "idx_project_contractor_trades_subset" ON "public"."project_contractor_trades" USING "btree" ("project_id", "trade_type") WHERE ("trade_type" = ANY (ARRAY['demolition'::"text", 'piling'::"text", 'concrete'::"text", 'scaffolding'::"text", 'form_work'::"text", 'tower_crane'::"text", 'mobile_crane'::"text"]));



CREATE UNIQUE INDEX "idx_project_contractor_trades_unique" ON "public"."project_contractor_trades" USING "btree" ("project_id", "employer_id", "trade_type");



CREATE UNIQUE INDEX "idx_project_contractor_trades_unique_assignment" ON "public"."project_contractor_trades" USING "btree" ("project_id", "employer_id", "trade_type", "stage", "assignment_id");



CREATE INDEX "idx_project_eba_details_project" ON "public"."project_eba_details" USING "btree" ("project_id");



CREATE INDEX "idx_project_employer_roles_composite" ON "public"."project_employer_roles" USING "btree" ("project_id", "employer_id", "role");



CREATE INDEX "idx_project_employer_roles_project_id" ON "public"."project_employer_roles" USING "btree" ("project_id");



CREATE INDEX "idx_project_employer_roles_project_manager" ON "public"."project_employer_roles" USING "btree" ("project_id", "role") WHERE ("role" = 'project_manager'::"public"."project_role");



CREATE INDEX "idx_project_employer_roles_role" ON "public"."project_employer_roles" USING "btree" ("role");



CREATE UNIQUE INDEX "idx_project_employer_roles_unique" ON "public"."project_employer_roles" USING "btree" ("project_id", "employer_id", "role");



CREATE INDEX "idx_project_organisers_organiser" ON "public"."project_organisers" USING "btree" ("organiser_id");



CREATE INDEX "idx_project_organisers_project" ON "public"."project_organisers" USING "btree" ("project_id");



CREATE INDEX "idx_projects_builder" ON "public"."projects" USING "btree" ("builder_id");



CREATE INDEX "idx_projects_funding_type" ON "public"."projects" USING "btree" ("funding_type_primary") WHERE ("funding_type_primary" IS NOT NULL);



CREATE INDEX "idx_projects_hs_committee_goal" ON "public"."projects" USING "btree" ("health_safety_committee_goal") WHERE ("health_safety_committee_goal" > 0);



CREATE INDEX "idx_projects_main_job_site" ON "public"."projects" USING "btree" ("main_job_site_id");



CREATE INDEX "idx_projects_organising_universe" ON "public"."projects" USING "btree" ("organising_universe");



CREATE INDEX "idx_projects_organising_universe_auto" ON "public"."projects" USING "btree" ("organising_universe_auto_assigned");



CREATE INDEX "idx_projects_organising_universe_manual_override" ON "public"."projects" USING "btree" ("organising_universe_manual_override");



CREATE INDEX "idx_projects_owner_type" ON "public"."projects" USING "btree" ("owner_type_level_1") WHERE ("owner_type_level_1" IS NOT NULL);



CREATE INDEX "idx_projects_stage_class" ON "public"."projects" USING "btree" ("stage_class");



CREATE INDEX "idx_projects_tier" ON "public"."projects" USING "btree" ("tier");



CREATE INDEX "idx_rh_child" ON "public"."role_hierarchy" USING "btree" ("child_user_id", "is_active");



CREATE INDEX "idx_rh_parent" ON "public"."role_hierarchy" USING "btree" ("parent_user_id", "is_active");



CREATE INDEX "idx_site_contacts_job_site" ON "public"."site_contacts" USING "btree" ("job_site_id");



CREATE INDEX "idx_site_contractor_trades_composite" ON "public"."site_contractor_trades" USING "btree" ("job_site_id", "employer_id", "trade_type");



CREATE INDEX "idx_site_contractor_trades_employer" ON "public"."site_contractor_trades" USING "btree" ("employer_id");



CREATE INDEX "idx_site_contractor_trades_job_site" ON "public"."site_contractor_trades" USING "btree" ("job_site_id");



CREATE INDEX "idx_site_contractor_trades_job_site_id" ON "public"."site_contractor_trades" USING "btree" ("job_site_id");



CREATE INDEX "idx_site_contractor_trades_subset" ON "public"."site_contractor_trades" USING "btree" ("job_site_id", "trade_type") WHERE ("trade_type" = ANY (ARRAY['demolition'::"public"."trade_type", 'piling'::"public"."trade_type", 'concrete'::"public"."trade_type", 'scaffolding'::"public"."trade_type", 'form_work'::"public"."trade_type", 'tower_crane'::"public"."trade_type", 'mobile_crane'::"public"."trade_type"]));



CREATE INDEX "idx_site_contractor_trades_trade_type" ON "public"."site_contractor_trades" USING "btree" ("trade_type");



CREATE INDEX "idx_site_employers_employer_id" ON "public"."site_employers" USING "btree" ("employer_id");



CREATE INDEX "idx_site_visit_employer_id" ON "public"."site_visit" USING "btree" ("employer_id");



CREATE INDEX "idx_site_visit_job_site_id" ON "public"."site_visit" USING "btree" ("job_site_id");



CREATE INDEX "idx_site_visit_list_created" ON "public"."site_visit_list_view" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_site_visit_list_employer" ON "public"."site_visit_list_view" USING "btree" ("employer_id");



CREATE INDEX "idx_site_visit_list_job_site" ON "public"."site_visit_list_view" USING "btree" ("job_site_id");



CREATE INDEX "idx_site_visit_list_project" ON "public"."site_visit_list_view" USING "btree" ("project_id");



CREATE INDEX "idx_site_visit_list_scheduled" ON "public"."site_visit_list_view" USING "btree" ("scheduled_at" DESC);



CREATE INDEX "idx_site_visit_list_search_text" ON "public"."site_visit_list_view" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_site_visit_list_stale" ON "public"."site_visit_list_view" USING "btree" ("is_stale");



CREATE INDEX "idx_site_visit_sv_code" ON "public"."site_visit" USING "btree" ("sv_code");



CREATE INDEX "idx_union_activity_scopes_activity_id" ON "public"."union_activity_scopes" USING "btree" ("activity_id");



CREATE INDEX "idx_union_activity_scopes_employer_id" ON "public"."union_activity_scopes" USING "btree" ("employer_id");



CREATE INDEX "idx_union_activity_scopes_job_site_id" ON "public"."union_activity_scopes" USING "btree" ("job_site_id");



CREATE INDEX "idx_union_activity_scopes_project_id" ON "public"."union_activity_scopes" USING "btree" ("project_id");



CREATE INDEX "idx_union_roles_end_date" ON "public"."union_roles" USING "btree" ("end_date");



CREATE INDEX "idx_union_roles_job_site_id" ON "public"."union_roles" USING "btree" ("job_site_id");



CREATE INDEX "idx_ura_user_active" ON "public"."user_role_assignments" USING "btree" ("user_id", "is_active", "start_date", "end_date");



CREATE INDEX "idx_wda_delegate" ON "public"."worker_delegate_assignments" USING "btree" ("delegate_id", "is_active");



CREATE INDEX "idx_wda_worker" ON "public"."worker_delegate_assignments" USING "btree" ("worker_id", "is_active");



CREATE INDEX "idx_whs_assessment_site_visit_id" ON "public"."whs_assessment" USING "btree" ("site_visit_id");



CREATE INDEX "idx_whs_breach_whs_assessment_id" ON "public"."whs_breach" USING "btree" ("whs_assessment_id");



CREATE INDEX "idx_worker_activity_ratings_activity_worker" ON "public"."worker_activity_ratings" USING "btree" ("activity_id", "worker_id");



CREATE INDEX "idx_worker_activity_ratings_worker_activity" ON "public"."worker_activity_ratings" USING "btree" ("worker_id", "activity_id");



CREATE INDEX "idx_worker_list_email" ON "public"."worker_list_view" USING "btree" ("email");



CREATE INDEX "idx_worker_list_member_number" ON "public"."worker_list_view" USING "btree" ("member_number");



CREATE INDEX "idx_worker_list_membership_status" ON "public"."worker_list_view" USING "btree" ("union_membership_status");



CREATE INDEX "idx_worker_list_name" ON "public"."worker_list_view" USING "btree" ("first_name", "surname");



CREATE INDEX "idx_worker_list_placement_count" ON "public"."worker_list_view" USING "btree" ("worker_placement_count");



CREATE INDEX "idx_worker_list_search_text" ON "public"."worker_list_view" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_worker_memberships_dd_status" ON "public"."worker_memberships" USING "btree" ("dd_status");



CREATE INDEX "idx_worker_memberships_payment_method" ON "public"."worker_memberships" USING "btree" ("payment_method");



CREATE INDEX "idx_worker_placements_employer_site" ON "public"."worker_placements" USING "btree" ("employer_id", "job_site_id");



CREATE INDEX "idx_worker_placements_employer_worker" ON "public"."worker_placements" USING "btree" ("employer_id", "worker_id");



CREATE INDEX "idx_worker_placements_job_site_id" ON "public"."worker_placements" USING "btree" ("job_site_id");



CREATE INDEX "idx_worker_placements_worker_id" ON "public"."worker_placements" USING "btree" ("worker_id");



CREATE INDEX "idx_workers_union_status" ON "public"."workers" USING "btree" ("union_membership_status");



CREATE INDEX "job_sites_geom_gix" ON "public"."job_sites" USING "gist" ("geom");



CREATE INDEX "job_sites_patch_idx" ON "public"."job_sites" USING "btree" ("patch_id");



CREATE UNIQUE INDEX "kpi_targets_scope_uidx" ON "public"."kpi_targets" USING "btree" ("campaign_id", "kpi_id", COALESCE("organiser_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("job_site_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE UNIQUE INDEX "lead_organiser_patch_assignments_open_uidx" ON "public"."lead_organiser_patch_assignments" USING "btree" ("lead_organiser_id", "patch_id") WHERE ("effective_to" IS NULL);



CREATE UNIQUE INDEX "organiser_patch_assignments_open_uidx" ON "public"."organiser_patch_assignments" USING "btree" ("organiser_id", "patch_id") WHERE ("effective_to" IS NULL);



CREATE UNIQUE INDEX "patch_employers_open_uidx" ON "public"."patch_employers" USING "btree" ("patch_id", "employer_id") WHERE ("effective_to" IS NULL);



CREATE UNIQUE INDEX "patch_job_sites_open_uidx" ON "public"."patch_job_sites" USING "btree" ("patch_id", "job_site_id") WHERE ("effective_to" IS NULL);



CREATE UNIQUE INDEX "patches_code_uidx" ON "public"."patches" USING "btree" ("code") WHERE ("code" IS NOT NULL);



CREATE INDEX "patches_geom_gix" ON "public"."patches" USING "gist" ("geom");



CREATE UNIQUE INDEX "patches_name_lower_idx" ON "public"."patches" USING "btree" ("lower"("name"));



CREATE UNIQUE INDEX "pending_users_email_role_uidx" ON "public"."pending_users" USING "btree" ("lower"("email"), "role");



CREATE UNIQUE INDEX "pending_users_lower_email_unique" ON "public"."pending_users" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "projects_bci_project_id_idx" ON "public"."projects" USING "btree" ("bci_project_id") WHERE ("bci_project_id" IS NOT NULL);



CREATE UNIQUE INDEX "uidx_union_activity_scopes_unique" ON "public"."union_activity_scopes" USING "btree" ("activity_id", COALESCE("project_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("employer_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("job_site_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE UNIQUE INDEX "uniq_open_head_contractor_per_project" ON "public"."project_employer_roles" USING "btree" ("project_id") WHERE (("role" = 'head_contractor'::"public"."project_role") AND ("end_date" IS NULL));



CREATE UNIQUE INDEX "ux_cap_employer_role" ON "public"."employer_capabilities" USING "btree" ("employer_id", "contractor_role_type_id") WHERE ("contractor_role_type_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_cap_employer_trade" ON "public"."employer_capabilities" USING "btree" ("employer_id", "trade_type_id") WHERE ("trade_type_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_employers_bci_company_id" ON "public"."employers" USING "btree" ("bci_company_id") WHERE ("bci_company_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_pa_role" ON "public"."project_assignments" USING "btree" ("project_id", "employer_id", "contractor_role_type_id") WHERE ("contractor_role_type_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_pa_trade" ON "public"."project_assignments" USING "btree" ("project_id", "employer_id", "trade_type_id") WHERE ("trade_type_id" IS NOT NULL);



CREATE UNIQUE INDEX "workers_incolink_member_id_unique" ON "public"."workers" USING "btree" ("incolink_member_id") WHERE ("incolink_member_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "job_sites_assign_patch_trg" BEFORE INSERT OR UPDATE OF "latitude", "longitude", "geom" ON "public"."job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."job_sites_assign_patch"();



CREATE OR REPLACE TRIGGER "job_sites_sync_geom_latlng_trg" BEFORE INSERT OR UPDATE OF "latitude", "longitude", "geom" ON "public"."job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."job_sites_sync_geom_latlng"();



CREATE OR REPLACE TRIGGER "overlay_images_set_timestamp" BEFORE UPDATE ON "public"."overlay_images" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "patches_set_timestamp" BEFORE UPDATE ON "public"."patches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_overlay_images_audit_fields_ins" BEFORE INSERT ON "public"."overlay_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_overlay_images_audit_fields"();



CREATE OR REPLACE TRIGGER "set_overlay_images_audit_fields_upd" BEFORE UPDATE ON "public"."overlay_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_overlay_images_audit_fields"();



CREATE OR REPLACE TRIGGER "trg_cap_updated" BEFORE UPDATE ON "public"."employer_capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_company_eba_records_after_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_eba_records" FOR EACH ROW EXECUTE FUNCTION "public"."company_eba_records_after_change"();



CREATE OR REPLACE TRIGGER "trg_ensure_project_contractor_from_site" AFTER INSERT ON "public"."site_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_project_contractor_from_site"();



CREATE OR REPLACE TRIGGER "trg_infer_project_classifications" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."infer_project_classifications"();



CREATE OR REPLACE TRIGGER "trg_job_sites_after_insert_single_site" AFTER INSERT ON "public"."job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."backfill_site_contractors_for_single_site"();



CREATE OR REPLACE TRIGGER "trg_job_sites_auto_patch" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."job_sites_set_patch_from_coords"();



CREATE OR REPLACE TRIGGER "trg_link_project_contractor_to_single_site" AFTER INSERT ON "public"."project_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."link_project_contractor_to_single_site"();



CREATE OR REPLACE TRIGGER "trg_notify_admins_on_request" AFTER INSERT OR UPDATE OF "status" ON "public"."pending_users" FOR EACH ROW WHEN (("new"."status" = 'requested'::"text")) EXECUTE FUNCTION "public"."notify_admins_on_request"();



CREATE OR REPLACE TRIGGER "trg_overlay_images_audit_fields" BEFORE INSERT OR UPDATE ON "public"."overlay_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_overlay_images_audit_fields"();



CREATE OR REPLACE TRIGGER "trg_pa_updated" BEFORE UPDATE ON "public"."project_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pending_users_updated_at" BEFORE UPDATE ON "public"."pending_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_per_sync_role_tags_ins" AFTER INSERT ON "public"."project_employer_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_employer_role_tag_from_per"();



CREATE OR REPLACE TRIGGER "trg_per_sync_role_tags_upd" AFTER UPDATE ON "public"."project_employer_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_employer_role_tag_from_per"();



CREATE OR REPLACE TRIGGER "trg_prevent_profile_privilege_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_privilege_escalation"();



CREATE OR REPLACE TRIGGER "trg_project_contractor_trades_after_insert" AFTER INSERT ON "public"."project_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."link_project_contractor_to_single_site"();



CREATE OR REPLACE TRIGGER "trg_project_contractor_trades_sync_caps" AFTER INSERT OR UPDATE OF "trade_type", "employer_id" ON "public"."project_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."sync_trade_capability_from_pct"();



CREATE OR REPLACE TRIGGER "trg_project_employer_roles_sync_tags" AFTER INSERT OR UPDATE OF "role", "employer_id" ON "public"."project_employer_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_employer_role_tag_from_per"();



CREATE OR REPLACE TRIGGER "trg_set_activities_created_by" BEFORE INSERT ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_activities_created_by"();



CREATE OR REPLACE TRIGGER "trg_site_contractor_trades_after_insert" AFTER INSERT ON "public"."site_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_project_contractor_from_site"();



CREATE OR REPLACE TRIGGER "trigger_auto_assign_organising_universe" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_project_organising_universe_auto_assignment"();



CREATE OR REPLACE TRIGGER "trigger_contractor_organising_universe_update" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_contractor_assignment_organising_universe_update"();



CREATE OR REPLACE TRIGGER "trigger_patch_organising_universe_update" AFTER INSERT OR DELETE OR UPDATE ON "public"."patch_job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."handle_patch_assignment_organising_universe_update"();



CREATE OR REPLACE TRIGGER "trigger_update_fwc_lookup_jobs_updated_at" BEFORE UPDATE ON "public"."fwc_lookup_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_fwc_lookup_jobs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_pending_employers_updated_at" BEFORE UPDATE ON "public"."pending_employers" FOR EACH ROW EXECUTE FUNCTION "public"."update_pending_employers_updated_at"();



CREATE OR REPLACE TRIGGER "update_activity_delegations_updated_at" BEFORE UPDATE ON "public"."activity_delegations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_participants_updated_at" BEFORE UPDATE ON "public"."activity_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_templates_updated_at" BEFORE UPDATE ON "public"."activity_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_eba_records_updated_at" BEFORE UPDATE ON "public"."company_eba_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contractor_trade_capabilities_updated_at" BEFORE UPDATE ON "public"."contractor_trade_capabilities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_dlol_updated_at" BEFORE UPDATE ON "public"."draft_lead_organiser_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employer_organisers_updated_at" BEFORE UPDATE ON "public"."employer_organisers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employer_role_tags_updated_at" BEFORE UPDATE ON "public"."employer_role_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employers_updated_at" BEFORE UPDATE ON "public"."employers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_job_sites_updated_at" BEFORE UPDATE ON "public"."job_sites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ldol_updated_at" BEFORE UPDATE ON "public"."lead_draft_organiser_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_oa_updated_at" BEFORE UPDATE ON "public"."organiser_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organisers_updated_at" BEFORE UPDATE ON "public"."organisers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_builder_jv_updated_at" BEFORE UPDATE ON "public"."project_builder_jv" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_contractor_trades_updated_at" BEFORE UPDATE ON "public"."project_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_eba_details_updated_at" BEFORE UPDATE ON "public"."project_eba_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_employer_roles_updated_at" BEFORE UPDATE ON "public"."project_employer_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_organisers_updated_at" BEFORE UPDATE ON "public"."project_organisers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rh_updated_at" BEFORE UPDATE ON "public"."role_hierarchy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_contacts_updated_at" BEFORE UPDATE ON "public"."site_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_contractor_trades_updated_at" BEFORE UPDATE ON "public"."site_contractor_trades" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_participation_updated_at" BEFORE UPDATE ON "public"."training_participation" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_union_activities_updated_at" BEFORE UPDATE ON "public"."union_activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_union_roles_updated_at" BEFORE UPDATE ON "public"."union_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ura_updated_at" BEFORE UPDATE ON "public"."user_role_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wda_updated_at" BEFORE UPDATE ON "public"."worker_delegate_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_memberships_updated_at" BEFORE UPDATE ON "public"."worker_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_placements_updated_at" BEFORE UPDATE ON "public"."worker_placements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workers_updated_at" BEFORE UPDATE ON "public"."workers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_objective_targets"
    ADD CONSTRAINT "activity_objective_targets_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "public"."activity_objectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_objectives"
    ADD CONSTRAINT "activity_objectives_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."union_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_rating_definitions"
    ADD CONSTRAINT "activity_rating_definitions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."union_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_workers"
    ADD CONSTRAINT "activity_workers_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."union_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_workers"
    ADD CONSTRAINT "activity_workers_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id");



ALTER TABLE ONLY "public"."campaign_assignments"
    ADD CONSTRAINT "campaign_assignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_assignments"
    ADD CONSTRAINT "campaign_assignments_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."campaign_assignments"
    ADD CONSTRAINT "campaign_assignments_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaign_assignments"
    ADD CONSTRAINT "campaign_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."campaign_kpis"
    ADD CONSTRAINT "campaign_kpis_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_kpis"
    ADD CONSTRAINT "campaign_kpis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaign_kpis"
    ADD CONSTRAINT "campaign_kpis_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."company_eba_records"
    ADD CONSTRAINT "company_eba_records_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_alerts"
    ADD CONSTRAINT "compliance_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."compliance_alerts"
    ADD CONSTRAINT "compliance_alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_trade_capabilities"
    ADD CONSTRAINT "contractor_trade_capabilities_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_conversion_attempt"
    ADD CONSTRAINT "dd_conversion_attempt_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visit"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delegate_assessment"
    ADD CONSTRAINT "delegate_assessment_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visit"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delegate_field_permissions"
    ADD CONSTRAINT "delegate_field_permissions_entity_field_id_fkey" FOREIGN KEY ("entity_field_id") REFERENCES "public"."entity_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delegate_field_permissions"
    ADD CONSTRAINT "delegate_field_permissions_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delegate_role_rating"
    ADD CONSTRAINT "delegate_role_rating_delegate_assessment_id_fkey" FOREIGN KEY ("delegate_assessment_id") REFERENCES "public"."delegate_assessment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draft_lead_organiser_links"
    ADD CONSTRAINT "draft_lead_organiser_links_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."draft_lead_organiser_links"
    ADD CONSTRAINT "draft_lead_organiser_links_draft_lead_pending_user_id_fkey" FOREIGN KEY ("draft_lead_pending_user_id") REFERENCES "public"."pending_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draft_lead_organiser_links"
    ADD CONSTRAINT "draft_lead_organiser_links_organiser_pending_user_id_fkey" FOREIGN KEY ("organiser_pending_user_id") REFERENCES "public"."pending_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draft_lead_organiser_links"
    ADD CONSTRAINT "draft_lead_organiser_links_organiser_user_id_fkey" FOREIGN KEY ("organiser_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_aliases"
    ADD CONSTRAINT "employer_aliases_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_capabilities"
    ADD CONSTRAINT "employer_capabilities_contractor_role_type_id_fkey" FOREIGN KEY ("contractor_role_type_id") REFERENCES "public"."contractor_role_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_capabilities"
    ADD CONSTRAINT "employer_capabilities_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_capabilities"
    ADD CONSTRAINT "employer_capabilities_trade_type_id_fkey" FOREIGN KEY ("trade_type_id") REFERENCES "public"."trade_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_compliance_checks"
    ADD CONSTRAINT "employer_compliance_checks_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_compliance_checks"
    ADD CONSTRAINT "employer_compliance_checks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_compliance_checks"
    ADD CONSTRAINT "employer_compliance_checks_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visit"("id");



ALTER TABLE ONLY "public"."employer_compliance_checks"
    ADD CONSTRAINT "employer_compliance_checks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."employer_organisers"
    ADD CONSTRAINT "employer_organisers_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_organisers"
    ADD CONSTRAINT "employer_organisers_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."organisers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employer_role_tags"
    ADD CONSTRAINT "employer_role_tags_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employers"
    ADD CONSTRAINT "employers_parent_employer_id_fkey" FOREIGN KEY ("parent_employer_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."entitlements_audit"
    ADD CONSTRAINT "entitlements_audit_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visit"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_permissions"
    ADD CONSTRAINT "field_permissions_entity_field_id_fkey" FOREIGN KEY ("entity_field_id") REFERENCES "public"."entity_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_sites"
    ADD CONSTRAINT "fk_job_sites_project" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."project_eba_details"
    ADD CONSTRAINT "fk_project_eba_details_project" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_organisers"
    ADD CONSTRAINT "fk_project_organisers_organiser" FOREIGN KEY ("organiser_id") REFERENCES "public"."organisers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_organisers"
    ADD CONSTRAINT "fk_project_organisers_project" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "fk_projects_builder" FOREIGN KEY ("builder_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "fk_projects_main_job_site" FOREIGN KEY ("main_job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."site_contacts"
    ADD CONSTRAINT "fk_site_contacts_job_site" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fwc_lookup_results"
    ADD CONSTRAINT "fwc_lookup_results_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fwc_lookup_results"
    ADD CONSTRAINT "fwc_lookup_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."fwc_lookup_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_sites"
    ADD CONSTRAINT "job_sites_main_builder_id_fkey" FOREIGN KEY ("main_builder_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."job_sites"
    ADD CONSTRAINT "job_sites_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kpi_events"
    ADD CONSTRAINT "kpi_events_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id");



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kpi_targets"
    ADD CONSTRAINT "kpi_targets_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lead_draft_organiser_links"
    ADD CONSTRAINT "lead_draft_organiser_links_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lead_draft_organiser_links"
    ADD CONSTRAINT "lead_draft_organiser_links_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_draft_organiser_links"
    ADD CONSTRAINT "lead_draft_organiser_links_pending_user_id_fkey" FOREIGN KEY ("pending_user_id") REFERENCES "public"."pending_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_organiser_patch_assignments"
    ADD CONSTRAINT "lead_organiser_patch_assignments_lead_organiser_id_fkey" FOREIGN KEY ("lead_organiser_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_organiser_patch_assignments"
    ADD CONSTRAINT "lead_organiser_patch_assignments_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organiser_allocations"
    ADD CONSTRAINT "organiser_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organiser_allocations"
    ADD CONSTRAINT "organiser_allocations_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organiser_patch_assignments"
    ADD CONSTRAINT "organiser_patch_assignments_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organiser_patch_assignments"
    ADD CONSTRAINT "organiser_patch_assignments_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organising_universe_change_log"
    ADD CONSTRAINT "organising_universe_change_log_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organising_universe_change_log"
    ADD CONSTRAINT "organising_universe_change_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."overlay_images"
    ADD CONSTRAINT "overlay_images_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."overlay_images"
    ADD CONSTRAINT "overlay_images_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."patch_employers"
    ADD CONSTRAINT "patch_employers_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patch_employers"
    ADD CONSTRAINT "patch_employers_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patch_job_sites"
    ADD CONSTRAINT "patch_job_sites_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patch_job_sites"
    ADD CONSTRAINT "patch_job_sites_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patches"
    ADD CONSTRAINT "patches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."patches"
    ADD CONSTRAINT "patches_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pending_employers"
    ADD CONSTRAINT "pending_employers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_employers"
    ADD CONSTRAINT "pending_employers_imported_employer_id_fkey" FOREIGN KEY ("imported_employer_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."pending_users"
    ADD CONSTRAINT "pending_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_contractor_role_type_id_fkey" FOREIGN KEY ("contractor_role_type_id") REFERENCES "public"."contractor_role_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_trade_type_id_fkey" FOREIGN KEY ("trade_type_id") REFERENCES "public"."trade_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_builder_jv"
    ADD CONSTRAINT "project_builder_jv_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_delegate_worker_id_fkey" FOREIGN KEY ("delegate_worker_id") REFERENCES "public"."workers"("id");



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_hsr_worker_id_fkey" FOREIGN KEY ("hsr_worker_id") REFERENCES "public"."workers"("id");



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_compliance"
    ADD CONSTRAINT "project_compliance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_contractor_trades"
    ADD CONSTRAINT "project_contractor_trades_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_contractor_trades"
    ADD CONSTRAINT "project_contractor_trades_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_contractor_trades"
    ADD CONSTRAINT "project_contractor_trades_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_employer_roles"
    ADD CONSTRAINT "project_employer_roles_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_employer_roles"
    ADD CONSTRAINT "project_employer_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_trade_availability"
    ADD CONSTRAINT "project_trade_availability_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_hierarchy"
    ADD CONSTRAINT "role_hierarchy_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."role_hierarchy"
    ADD CONSTRAINT "role_hierarchy_child_user_id_fkey" FOREIGN KEY ("child_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_hierarchy"
    ADD CONSTRAINT "role_hierarchy_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_contractor_trades"
    ADD CONSTRAINT "site_contractor_trades_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_contractor_trades"
    ADD CONSTRAINT "site_contractor_trades_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_employers"
    ADD CONSTRAINT "site_employers_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_employers"
    ADD CONSTRAINT "site_employers_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_visit"
    ADD CONSTRAINT "site_visit_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_visit"
    ADD CONSTRAINT "site_visit_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_participation"
    ADD CONSTRAINT "training_participation_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."union_activities"
    ADD CONSTRAINT "union_activities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id");



ALTER TABLE ONLY "public"."union_activities"
    ADD CONSTRAINT "union_activities_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."union_activity_scopes"
    ADD CONSTRAINT "union_activity_scopes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."union_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."union_activity_scopes"
    ADD CONSTRAINT "union_activity_scopes_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."union_activity_scopes"
    ADD CONSTRAINT "union_activity_scopes_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."union_activity_scopes"
    ADD CONSTRAINT "union_activity_scopes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."union_roles"
    ADD CONSTRAINT "union_roles_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."union_roles"
    ADD CONSTRAINT "union_roles_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whs_assessment"
    ADD CONSTRAINT "whs_assessment_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visit"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whs_breach"
    ADD CONSTRAINT "whs_breach_whs_assessment_id_fkey" FOREIGN KEY ("whs_assessment_id") REFERENCES "public"."whs_assessment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_activity_ratings"
    ADD CONSTRAINT "worker_activity_ratings_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."union_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_activity_ratings"
    ADD CONSTRAINT "worker_activity_ratings_rated_by_fkey" FOREIGN KEY ("rated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."worker_activity_ratings"
    ADD CONSTRAINT "worker_activity_ratings_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_delegate_assignments"
    ADD CONSTRAINT "worker_delegate_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."worker_delegate_assignments"
    ADD CONSTRAINT "worker_delegate_assignments_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_delegate_assignments"
    ADD CONSTRAINT "worker_delegate_assignments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_memberships"
    ADD CONSTRAINT "worker_memberships_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_placements"
    ADD CONSTRAINT "worker_placements_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id");



ALTER TABLE ONLY "public"."worker_placements"
    ADD CONSTRAINT "worker_placements_job_site_id_fkey" FOREIGN KEY ("job_site_id") REFERENCES "public"."job_sites"("id");



ALTER TABLE ONLY "public"."worker_placements"
    ADD CONSTRAINT "worker_placements_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "public"."organisers"("id");



CREATE POLICY "Admins and organisers can manage activity delegations" ON "public"."activity_delegations" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage activity participants" ON "public"."activity_participants" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage activity templates" ON "public"."activity_templates" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage dd conversion attempts" ON "public"."dd_conversion_attempt" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage delegate assessments" ON "public"."delegate_assessment" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage delegate role ratings" ON "public"."delegate_role_rating" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage employer organisers" ON "public"."employer_organisers" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage entitlements audits" ON "public"."entitlements_audit" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage organisers" ON "public"."organisers" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage project EBA details" ON "public"."project_eba_details" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage project JV metadata" ON "public"."project_builder_jv" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"]))) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage project employer roles" ON "public"."project_employer_roles" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"]))) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage project organisers" ON "public"."project_organisers" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage project trade contractors" ON "public"."project_contractor_trades" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"]))) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage site contacts" ON "public"."site_contacts" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage site contractor trades" ON "public"."site_contractor_trades" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage site employers" ON "public"."site_employers" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage site visits" ON "public"."site_visit" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage training participation" ON "public"."training_participation" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage whs assessments" ON "public"."whs_assessment" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can manage whs breaches" ON "public"."whs_breach" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can view site contacts" ON "public"."site_contacts" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins and organisers can view training participation" ON "public"."training_participation" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'organiser'::"text"])));



CREATE POLICY "Admins, organisers, leads and delegates can delete contractor t" ON "public"."contractor_trade_capabilities" AS RESTRICTIVE FOR DELETE USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text")));



CREATE POLICY "Admins, organisers, leads and delegates can delete employer rol" ON "public"."employer_role_tags" AS RESTRICTIVE FOR DELETE USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text")));



CREATE POLICY "Admins, organisers, leads and delegates can update contractor t" ON "public"."contractor_trade_capabilities" AS RESTRICTIVE FOR UPDATE USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text")));



CREATE POLICY "Admins, organisers, leads and delegates can update employer rol" ON "public"."employer_role_tags" AS RESTRICTIVE FOR UPDATE USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR "public"."has_role"("auth"."uid"(), 'delegate'::"text")));



CREATE POLICY "Authenticated users can create contractor trade caps_del" ON "public"."contractor_trade_capabilities" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create contractor trade caps_ins" ON "public"."contractor_trade_capabilities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create contractor trade caps_upd" ON "public"."contractor_trade_capabilities" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can create employer role tags_del" ON "public"."employer_role_tags" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create employer role tags_ins" ON "public"."employer_role_tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create employer role tags_upd" ON "public"."employer_role_tags" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view activity delegations" ON "public"."activity_delegations" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view activity participants" ON "public"."activity_participants" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view activity templates" ON "public"."activity_templates" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view contractor trade capabilities" ON "public"."contractor_trade_capabilities" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view dd conversion attempts" ON "public"."dd_conversion_attempt" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view delegate assessments" ON "public"."delegate_assessment" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view delegate role ratings" ON "public"."delegate_role_rating" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view employer organisers" ON "public"."employer_organisers" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view employer role tags" ON "public"."employer_role_tags" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view entitlements audits" ON "public"."entitlements_audit" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view organisers" ON "public"."organisers" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view project EBA details" ON "public"."project_eba_details" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view project JV metadata" ON "public"."project_builder_jv" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view project employer roles" ON "public"."project_employer_roles" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view project organisers" ON "public"."project_organisers" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view project trade contractors" ON "public"."project_contractor_trades" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view site contractor trades" ON "public"."site_contractor_trades" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view site employers" ON "public"."site_employers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view site visits" ON "public"."site_visit" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view whs assessments" ON "public"."whs_assessment" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view whs breaches" ON "public"."whs_breach" FOR SELECT USING (true);



CREATE POLICY "Users can insert FWC lookup results" ON "public"."fwc_lookup_results" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can manage FWC lookup jobs" ON "public"."fwc_lookup_jobs" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update FWC lookup results" ON "public"."fwc_lookup_results" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view FWC lookup results" ON "public"."fwc_lookup_results" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activities_delete" ON "public"."activities" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR true));



CREATE POLICY "activities_insert_authenticated_ins" ON "public"."activities" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "activities_select_authenticated" ON "public"."activities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "activities_update" ON "public"."activities" FOR UPDATE TO "authenticated" USING ((true OR ("created_by" = "auth"."uid"()))) WITH CHECK ((("auth"."uid"() IS NOT NULL) OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."activity_delegations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_objective_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_objective_targets_admin_all" ON "public"."activity_objective_targets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "activity_objective_targets_auth_delete" ON "public"."activity_objective_targets" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "activity_objective_targets_auth_select" ON "public"."activity_objective_targets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "activity_objective_targets_auth_update" ON "public"."activity_objective_targets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "activity_objective_targets_auth_write" ON "public"."activity_objective_targets" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."activity_objectives" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_objectives_admin_all" ON "public"."activity_objectives" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "activity_objectives_auth_delete" ON "public"."activity_objectives" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "activity_objectives_auth_select" ON "public"."activity_objectives" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "activity_objectives_auth_update" ON "public"."activity_objectives" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "activity_objectives_auth_write" ON "public"."activity_objectives" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."activity_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_rating_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_rating_definitions_admin_all" ON "public"."activity_rating_definitions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "activity_rating_definitions_auth_delete" ON "public"."activity_rating_definitions" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "activity_rating_definitions_auth_select" ON "public"."activity_rating_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "activity_rating_definitions_auth_update" ON "public"."activity_rating_definitions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "activity_rating_definitions_auth_write" ON "public"."activity_rating_definitions" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."activity_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_workers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_workers_admin_all" ON "public"."activity_workers" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "activity_workers_auth_delete" ON "public"."activity_workers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "activity_workers_auth_select" ON "public"."activity_workers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "activity_workers_auth_update" ON "public"."activity_workers" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "activity_workers_auth_write" ON "public"."activity_workers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_authenticated" ON "public"."pending_employers" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "allow_read_own_and_admin" ON "public"."pending_employers" FOR SELECT USING ((("auth"."role"() = 'anon'::"text") IS FALSE));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "as_modify" ON "public"."app_settings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "ca_modify" ON "public"."campaign_assignments" TO "authenticated" USING (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"()) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "js"."project_id") AND "public"."can_access_job_site"("js"."id"))))))) WITH CHECK (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"()) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "js"."project_id") AND "public"."can_access_job_site"("js"."id")))))));



CREATE POLICY "ca_select" ON "public"."campaign_assignments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"()) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "js"."project_id") AND "public"."can_access_job_site"("js"."id")))))));



ALTER TABLE "public"."campaign_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_kpis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_kpis_modify" ON "public"."campaign_kpis" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "campaign_kpis_select" ON "public"."campaign_kpis" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_assignments" "ca"
     JOIN "public"."job_sites" "js" ON (("js"."id" = "ca"."job_site_id")))
  WHERE (("ca"."campaign_id" = "campaign_kpis"."campaign_id") AND "public"."can_access_job_site"("js"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_assignments" "ca"
     JOIN "public"."projects" "pr" ON (("pr"."id" = "ca"."project_id")))
  WHERE (("ca"."campaign_id" = "campaign_kpis"."campaign_id") AND (EXISTS ( SELECT 1
           FROM "public"."job_sites" "js"
          WHERE (("js"."project_id" = "pr"."id") AND "public"."can_access_job_site"("js"."id")))))))));



ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_modify" ON "public"."campaigns" TO "authenticated" USING (("public"."is_admin"() OR ("created_by" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR ("created_by" = "auth"."uid"())));



CREATE POLICY "campaigns_select" ON "public"."campaigns" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_assignments" "ca"
     JOIN "public"."job_sites" "js" ON (("js"."id" = "ca"."job_site_id")))
  WHERE (("ca"."campaign_id" = "campaigns"."id") AND "public"."can_access_job_site"("js"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_assignments" "ca"
     JOIN "public"."projects" "pr" ON (("pr"."id" = "ca"."project_id")))
  WHERE (("ca"."campaign_id" = "campaigns"."id") AND (EXISTS ( SELECT 1
           FROM "public"."job_sites" "js"
          WHERE (("js"."project_id" = "pr"."id") AND "public"."can_access_job_site"("js"."id")))))))));



ALTER TABLE "public"."company_eba_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractor_trade_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dd_conversion_attempt" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delegate_assessment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delegate_field_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delegate_role_rating" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dfp_modify" ON "public"."delegate_field_permissions" TO "authenticated" USING (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"())));



CREATE POLICY "dfp_select" ON "public"."delegate_field_permissions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("organiser_id" = "auth"."uid"())));



CREATE POLICY "dlol_admin_all" ON "public"."draft_lead_organiser_links" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."draft_lead_organiser_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eba_modify" ON "public"."company_eba_records" TO "authenticated" USING ((("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id"))) WITH CHECK ((("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id")));



CREATE POLICY "eba_select" ON "public"."company_eba_records" FOR SELECT TO "authenticated" USING ((("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id")));



CREATE POLICY "ef_modify" ON "public"."entity_fields" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "ef_select" ON "public"."entity_fields" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employer_organisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employer_role_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employers_delete" ON "public"."employers" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."can_access_employer"("id") OR true));



CREATE POLICY "employers_insert_ins" ON "public"."employers" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"])))))));



CREATE POLICY "employers_select" ON "public"."employers" FOR SELECT TO "authenticated" USING ("public"."can_access_employer"("id"));



CREATE POLICY "employers_update" ON "public"."employers" FOR UPDATE TO "authenticated" USING ((true OR "public"."can_access_employer"("id"))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"]))))) OR "public"."can_access_employer"("id")));



ALTER TABLE "public"."entitlements_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."field_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fp_modify" ON "public"."field_permissions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fp_select" ON "public"."field_permissions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fwc_lookup_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fwc_lookup_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_sites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_sites_delete" ON "public"."job_sites" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."can_access_job_site"("id") OR true));



CREATE POLICY "job_sites_insert_ins" ON "public"."job_sites" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"])))))));



CREATE POLICY "job_sites_map_read" ON "public"."job_sites" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "job_sites_select" ON "public"."job_sites" FOR SELECT TO "authenticated" USING ("public"."can_access_job_site"("id"));



CREATE POLICY "job_sites_update" ON "public"."job_sites" FOR UPDATE TO "authenticated" USING ((true OR "public"."can_access_job_site"("id"))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"]))))) OR "public"."can_access_job_site"("id")));



ALTER TABLE "public"."kpi_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_definitions_modify" ON "public"."kpi_definitions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "kpi_definitions_select" ON "public"."kpi_definitions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."kpi_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_events_modify" ON "public"."kpi_events" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id")) OR (("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id")))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id")) OR (("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id"))));



CREATE POLICY "kpi_events_select" ON "public"."kpi_events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")) OR (("employer_id" IS NOT NULL) AND "public"."can_access_employer"("employer_id")) OR (("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id"))));



ALTER TABLE "public"."kpi_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_targets_modify" ON "public"."kpi_targets" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id")))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id"))));



CREATE POLICY "kpi_targets_select" ON "public"."kpi_targets" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()) OR (("organiser_id" IS NOT NULL) AND "public"."can_access_organiser"("organiser_id")) OR (("job_site_id" IS NOT NULL) AND "public"."can_access_job_site"("job_site_id"))));



CREATE POLICY "ldol_admin_all" ON "public"."lead_draft_organiser_links" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."lead_draft_organiser_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_organiser_patch_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "oa_modify" ON "public"."organiser_allocations" TO "authenticated" USING (("public"."is_admin"() OR ("public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") AND "public"."is_lead_of"("auth"."uid"(), "organiser_id")))) WITH CHECK (("public"."is_admin"() OR ("public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") AND "public"."is_lead_of"("auth"."uid"(), "organiser_id"))));



CREATE POLICY "oa_select" ON "public"."organiser_allocations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."organiser_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organiser_patch_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."overlay_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "overlay_images_delete" ON "public"."overlay_images" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR true));



CREATE POLICY "overlay_images_insert_public_preview_ins" ON "public"."overlay_images" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text")));



CREATE POLICY "overlay_images_select" ON "public"."overlay_images" FOR SELECT USING (true);



CREATE POLICY "overlay_images_update" ON "public"."overlay_images" FOR UPDATE TO "authenticated" USING ((true OR ("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text")))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text") OR ("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text"))));



CREATE POLICY "p_select_lead_organiser_patch_assignments" ON "public"."lead_organiser_patch_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_select_organiser_patch_assignments" ON "public"."organiser_patch_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_write_lead_organiser_patch_assignments" ON "public"."lead_organiser_patch_assignments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "p_write_organiser_patch_assignments" ON "public"."organiser_patch_assignments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "pal_modify_del" ON "public"."permission_audit_log" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "pal_modify_ins" ON "public"."permission_audit_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "pal_modify_upd" ON "public"."permission_audit_log" FOR UPDATE TO "authenticated" USING (true) WITH CHECK ("public"."is_admin"());



CREATE POLICY "pal_select" ON "public"."permission_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."patch_employers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patch_job_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patch_regions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patch_regions_modify" ON "public"."patch_regions" USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text")));



CREATE POLICY "patch_regions_select" ON "public"."patch_regions" FOR SELECT USING (true);



ALTER TABLE "public"."patches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patches_admin_all" ON "public"."patches" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "patches_map_read" ON "public"."patches" FOR SELECT TO "authenticated" USING ((("type" = 'geo'::"text") AND ("status" = 'active'::"text")));



CREATE POLICY "patches_modify" ON "public"."patches" TO "authenticated" USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'lead_organiser'::"text")));



CREATE POLICY "patches_read" ON "public"."patches" FOR SELECT TO "authenticated" USING ((true OR (EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patches"."id") AND ("a"."effective_to" IS NULL) AND ("a"."lead_organiser_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patches"."id") AND ("a"."effective_to" IS NULL) AND ("a"."organiser_id" = "auth"."uid"())))) OR true));



CREATE POLICY "pemps_admin_write" ON "public"."patch_employers" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "pemps_lead_write_del" ON "public"."patch_employers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "pemps_lead_write_ins" ON "public"."patch_employers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))));



CREATE POLICY "pemps_read" ON "public"."patch_employers" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "pemps_update" ON "public"."patch_employers" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR true)) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_employers"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL))))));



ALTER TABLE "public"."pending_employers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pending_users_select" ON "public"."pending_users" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'lead_organiser'::"text")))) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "pending_users_self_insert_del" ON "public"."pending_users" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "pending_users_self_insert_ins" ON "public"."pending_users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "pending_users_update" ON "public"."pending_users" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'lead_organiser'::"text")))) OR true OR ("created_by" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'lead_organiser'::"text")))) OR true OR ("created_by" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."permission_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pjs_admin_write" ON "public"."patch_job_sites" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "pjs_lead_write_del" ON "public"."patch_job_sites" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "pjs_lead_write_ins" ON "public"."patch_job_sites" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))));



CREATE POLICY "pjs_read" ON "public"."patch_job_sites" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "pjs_update" ON "public"."patch_job_sites" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR true)) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."lead_organiser_patch_assignments" "a"
  WHERE (("a"."patch_id" = "patch_job_sites"."patch_id") AND ("a"."lead_organiser_id" = "auth"."uid"()) AND ("a"."effective_to" IS NULL))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_self_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."role_hierarchy" "rh"
  WHERE (("rh"."parent_user_id" = "auth"."uid"()) AND ("rh"."child_user_id" = "profiles"."id"))))));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."project_builder_jv" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_contractor_trades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_eba_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_employer_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_organisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_delete" ON "public"."projects" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR true));



CREATE POLICY "projects_insert_ins" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"])))))));



CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "projects"."id") AND "public"."can_access_job_site"("js"."id"))))));



CREATE POLICY "projects_update" ON "public"."projects" FOR UPDATE TO "authenticated" USING ((true OR ("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "projects"."id") AND "public"."can_access_job_site"("js"."id"))))))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"]))))) OR ("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."job_sites" "js"
  WHERE (("js"."project_id" = "projects"."id") AND "public"."can_access_job_site"("js"."id")))))));



CREATE POLICY "pu_select" ON "public"."pending_users" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "rh_modify" ON "public"."role_hierarchy" TO "authenticated" USING (("public"."is_admin"() OR ("parent_user_id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR ("parent_user_id" = "auth"."uid"())));



CREATE POLICY "rh_select" ON "public"."role_hierarchy" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("parent_user_id" = "auth"."uid"())));



ALTER TABLE "public"."role_hierarchy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_contacts_delete" ON "public"."site_contacts" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "site_contacts_insert" ON "public"."site_contacts" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "site_contacts_select" ON "public"."site_contacts" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "site_contacts_update" ON "public"."site_contacts" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."site_contractor_trades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_employers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_participation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ua_modify" ON "public"."union_activities" TO "authenticated" USING (("public"."is_admin"() OR "public"."can_access_job_site"("job_site_id"))) WITH CHECK (("public"."is_admin"() OR "public"."can_access_job_site"("job_site_id")));



CREATE POLICY "ua_select" ON "public"."union_activities" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."can_access_job_site"("job_site_id")));



ALTER TABLE "public"."union_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."union_activity_scopes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "union_activity_scopes_admin_all" ON "public"."union_activity_scopes" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "union_activity_scopes_auth_delete" ON "public"."union_activity_scopes" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "union_activity_scopes_auth_select" ON "public"."union_activity_scopes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "union_activity_scopes_auth_update" ON "public"."union_activity_scopes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "union_activity_scopes_auth_write" ON "public"."union_activity_scopes" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."union_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ur_modify" ON "public"."union_roles" TO "authenticated" USING ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id"))) WITH CHECK ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id")));



CREATE POLICY "ur_select" ON "public"."union_roles" FOR SELECT TO "authenticated" USING ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id")));



CREATE POLICY "ura_modify" ON "public"."user_role_assignments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "ura_select" ON "public"."user_role_assignments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."user_role_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "war_modify" ON "public"."worker_activity_ratings" TO "authenticated" USING ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id"))) WITH CHECK ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id")));



CREATE POLICY "war_select" ON "public"."worker_activity_ratings" FOR SELECT TO "authenticated" USING ((("worker_id" IS NOT NULL) AND "public"."can_access_worker"("worker_id")));



CREATE POLICY "wda_modify" ON "public"."worker_delegate_assignments" TO "authenticated" USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text")));



CREATE POLICY "wda_select" ON "public"."worker_delegate_assignments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."has_role"("auth"."uid"(), 'organiser'::"text") OR ("delegate_id" = "auth"."uid"())));



ALTER TABLE "public"."whs_assessment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whs_breach" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wm_modify" ON "public"."worker_memberships" TO "authenticated" USING ("public"."can_access_worker"("worker_id")) WITH CHECK ("public"."can_access_worker"("worker_id"));



CREATE POLICY "wm_select" ON "public"."worker_memberships" FOR SELECT TO "authenticated" USING ("public"."can_access_worker"("worker_id"));



ALTER TABLE "public"."worker_activity_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_delegate_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_placements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workers_delete" ON "public"."workers" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."can_access_worker"("id") OR true));



CREATE POLICY "workers_insert_ins" ON "public"."workers" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"])))))));



CREATE POLICY "workers_select" ON "public"."workers" FOR SELECT TO "authenticated" USING ("public"."can_access_worker"("id"));



CREATE POLICY "workers_update" ON "public"."workers" FOR UPDATE TO "authenticated" USING ((true OR "public"."can_access_worker"("id"))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organiser'::"text", 'lead_organiser'::"text"]))))) OR "public"."can_access_worker"("id")));



CREATE POLICY "wp_modify" ON "public"."worker_placements" TO "authenticated" USING (("public"."can_access_job_site"("job_site_id") OR "public"."can_access_employer"("employer_id"))) WITH CHECK (("public"."can_access_job_site"("job_site_id") OR "public"."can_access_employer"("employer_id")));



CREATE POLICY "wp_select" ON "public"."worker_placements" FOR SELECT TO "authenticated" USING (("public"."can_access_job_site"("job_site_id") OR "public"."can_access_employer"("employer_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_project_managers"("p_project_id" "uuid", "p_employer_ids" "uuid"[], "p_start_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."add_project_managers"("p_project_id" "uuid", "p_employer_ids" "uuid"[], "p_start_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_project_managers"("p_project_id" "uuid", "p_employer_ids" "uuid"[], "p_start_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."employers" TO "anon";
GRANT ALL ON TABLE "public"."employers" TO "authenticated";
GRANT ALL ON TABLE "public"."employers" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_caps" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_caps" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_caps" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_types" "public"."trade_type"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_types" "public"."trade_type"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_employer_full"("p_employer_id" "uuid", "p_update" "jsonb", "p_role_tags" "public"."employer_role_tag"[], "p_trade_types" "public"."trade_type"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_user_scoping"("_user_id" "uuid", "_scoped_employers" "uuid"[], "_scoped_sites" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_user_scoping"("_user_id" "uuid", "_scoped_employers" "uuid"[], "_scoped_sites" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_user_scoping"("_user_id" "uuid", "_scoped_employers" "uuid"[], "_scoped_sites" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[], "p_overwrite" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[], "p_overwrite" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[], "p_overwrite" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_geometry_collection_geojson" "jsonb", "p_overwrite" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_geometry_collection_geojson" "jsonb", "p_overwrite" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_feature_geometries_to_patch"("p_patch_id" "uuid", "p_geometry_collection_geojson" "jsonb", "p_overwrite" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_geometries_to_patch_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[], "p_overwrite" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_geometries_to_patch_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[], "p_overwrite" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_geometries_to_patch_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[], "p_overwrite" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_organising_universe_rules_retrospectively"("p_dry_run" boolean, "p_applied_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_organising_universe_rules_retrospectively"("p_dry_run" boolean, "p_applied_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_organising_universe_rules_retrospectively"("p_dry_run" boolean, "p_applied_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_pending_user_on_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_pending_user_on_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_pending_user_on_login"() TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_project_compliance"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_project_compliance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_project_compliance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_bci_builder"("p_project_id" "uuid", "p_employer_id" "uuid", "p_company_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_bci_trade_contractor"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_stage" "text", "p_estimated_workforce" numeric, "p_company_name" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_bci_trade_contractor"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_stage" "text", "p_estimated_workforce" numeric, "p_company_name" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_bci_trade_contractor"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_stage" "text", "p_estimated_workforce" numeric, "p_company_name" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_contractor_role"("p_project_id" "uuid", "p_employer_id" "uuid", "p_role_code" "text", "p_company_name" "text", "p_is_primary" boolean, "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_contractor_trade"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_company_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text", "p_stage" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text", "p_stage" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_contractor_unified"("p_project_id" "uuid", "p_job_site_id" "uuid", "p_employer_id" "uuid", "p_trade_type" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text", "p_stage" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_multiple_trade_types"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_types" "text"[], "p_stage" "text", "p_estimated_workforce" integer, "p_eba_signatory" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_patches_for_all_job_sites"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_patches_for_all_job_sites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_patches_for_all_job_sites"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_trade_work"("p_project_id" "uuid", "p_employer_id" "uuid", "p_trade_code" "text", "p_company_name" "text", "p_estimated_workers" integer, "p_source" "text", "p_match_confidence" numeric, "p_match_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_refresh_employer_list_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_refresh_employer_list_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_refresh_employer_list_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_site_contractors_for_single_site"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_site_contractors_for_single_site"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_site_contractors_for_single_site"() TO "service_role";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_assign_projects_to_patches"() TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_assign_projects_to_patches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_assign_projects_to_patches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_set_organising_universe_manual"("p_project_ids" "uuid"[], "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_set_organising_universe_manual"("p_project_ids" "uuid"[], "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_set_organising_universe_manual"("p_project_ids" "uuid"[], "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_default_organising_universe"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_default_organising_universe"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_default_organising_universe"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_eba_recency_score"("eba_record" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_eba_recency_score"("eba_record" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_eba_recency_score"("eba_record" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[], "p_tier" "text", "p_stage" "text", "p_universe" "text", "p_eba_filter" "text", "p_user_id" "uuid", "p_user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[], "p_tier" "text", "p_stage" "text", "p_universe" "text", "p_eba_filter" "text", "p_user_id" "uuid", "p_user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_organizing_universe_metrics"("p_patch_ids" "uuid"[], "p_tier" "text", "p_stage" "text", "p_universe" "text", "p_eba_filter" "text", "p_user_id" "uuid", "p_user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_organiser"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_organiser"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_organiser"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_worker"("target_worker_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_worker"("target_worker_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_worker"("target_worker_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_materialized_view_staleness"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_materialized_view_staleness"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_materialized_view_staleness"() TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_organising_universe_automation"("p_confirm_clear" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."clear_organising_universe_automation"("p_confirm_clear" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_organising_universe_automation"("p_confirm_clear" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."company_eba_records_after_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."company_eba_records_after_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."company_eba_records_after_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_assignment"("assignment_table" "text", "assignment_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_assignment"("assignment_table" "text", "assignment_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_assignment"("assignment_table" "text", "assignment_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consolidate_duplicate_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."consolidate_duplicate_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."consolidate_duplicate_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_patch_with_geometry"("p_name" "text", "p_code" "text", "p_type" "text", "p_geometry" "text", "p_description" "text", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_patch_with_geometry"("p_name" "text", "p_code" "text", "p_type" "text", "p_geometry" "text", "p_description" "text", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_patch_with_geometry"("p_name" "text", "p_code" "text", "p_type" "text", "p_geometry" "text", "p_description" "text", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_project_cascade"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_project_cascade"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_project_cascade"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_project_contractor_from_site"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_project_contractor_from_site"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_project_contractor_from_site"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_patch_for_coordinates"("lat" double precision, "lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_patch_for_coordinates"("lat" double precision, "lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_patch_for_coordinates"("lat" double precision, "lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_compliance_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_compliance_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_compliance_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accessible_workers"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_workers"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_workers"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_setting"("_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_setting"("_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_setting"("_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_eba_category"("eba_record" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_eba_category"("eba_record" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_eba_category"("eba_record" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employer_merge_impact"("p_employer_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_employer_merge_impact"("p_employer_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employer_merge_impact"("p_employer_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid", "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid", "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_patch_summaries_for_user"("p_user_id" "uuid", "p_user_role" "text", "p_lead_organiser_id" "uuid", "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_patches_with_geometry_text"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_patches_with_geometry_text"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_patches_with_geometry_text"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_delete_impact"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_delete_impact"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_delete_impact"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_employers_unknown_eba"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_employers_unknown_eba"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_employers_unknown_eba"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_subset_stats"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_tier_color"("tier_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_tier_color"("tier_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_tier_color"("tier_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_tier_label"("tier_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_tier_label"("tier_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_tier_label"("tier_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_projects_with_builder"("project_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trade_type_enum"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_trade_type_enum"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trade_type_enum"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unified_contractors"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_contractor_assignment_organising_universe_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_contractor_assignment_organising_universe_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_contractor_assignment_organising_universe_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_patch_assignment_organising_universe_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_patch_assignment_organising_universe_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_patch_assignment_organising_universe_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_project_organising_universe_auto_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_project_organising_universe_auto_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_project_organising_universe_auto_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_site_access"("user_id" "uuid", "site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_site_access"("user_id" "uuid", "site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_site_access"("user_id" "uuid", "site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."infer_project_classifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."infer_project_classifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."infer_project_classifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_patch_from_geojson"("patch_code" "text", "patch_name" "text", "geojson_data" "text", "source_file" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_patch_from_geojson"("patch_code" "text", "patch_name" "text", "geojson_data" "text", "source_file" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_patch_from_geojson"("patch_code" "text", "patch_name" "text", "geojson_data" "text", "source_file" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_employer_engaged"("estimated_worker_count" integer, "worker_placement_count" integer, "project_assignment_count" integer, "eba_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_employer_engaged"("estimated_worker_count" integer, "worker_placement_count" integer, "project_assignment_count" integer, "eba_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_employer_engaged"("estimated_worker_count" integer, "worker_placement_count" integer, "project_assignment_count" integer, "eba_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_lead_of"("_parent" "uuid", "_child" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_lead_of"("_parent" "uuid", "_child" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_lead_of"("_parent" "uuid", "_child" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."job_sites_assign_patch"() TO "anon";
GRANT ALL ON FUNCTION "public"."job_sites_assign_patch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_sites_assign_patch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."job_sites_set_patch_from_coords"() TO "anon";
GRANT ALL ON FUNCTION "public"."job_sites_set_patch_from_coords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_sites_set_patch_from_coords"() TO "service_role";



GRANT ALL ON FUNCTION "public"."job_sites_sync_geom_latlng"() TO "anon";
GRANT ALL ON FUNCTION "public"."job_sites_sync_geom_latlng"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_sites_sync_geom_latlng"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_project_contractor_to_single_site"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_project_contractor_to_single_site"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_project_contractor_to_single_site"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_assignment_auto_matched"("assignment_table" "text", "assignment_id" "uuid", "confidence" numeric, "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_assignment_auto_matched"("assignment_table" "text", "assignment_id" "uuid", "confidence" numeric, "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_assignment_auto_matched"("assignment_table" "text", "assignment_id" "uuid", "confidence" numeric, "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_job_sites_to_patches"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_job_sites_to_patches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_job_sites_to_patches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_employers"("p_primary_employer_id" "uuid", "p_duplicate_employer_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."merge_employers"("p_primary_employer_id" "uuid", "p_duplicate_employer_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_employers"("p_primary_employer_id" "uuid", "p_duplicate_employer_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_patch_geometry"("p_patch_id" "uuid", "p_wkt" "text", "p_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."merge_patch_geometry"("p_patch_id" "uuid", "p_wkt" "text", "p_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_patch_geometry"("p_patch_id" "uuid", "p_wkt" "text", "p_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admins_on_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins_on_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admins_on_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_kml_content"("kml_content" "text", "source_file" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_kml_content"("kml_content" "text", "source_file" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_kml_content"("kml_content" "text", "source_file" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_employer_eba_status"("p_employer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_employer_eba_status"("p_employer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_employer_eba_status"("p_employer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_employer_list_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_employer_list_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_employer_list_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_employer_related_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_employer_related_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_employer_related_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_patch_project_mapping_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_patch_project_mapping_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_patch_project_mapping_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_project_list_comprehensive_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_project_list_comprehensive_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_project_list_comprehensive_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_project_related_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_project_related_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_project_related_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_site_visit_list_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_site_visit_list_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_site_visit_list_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_site_visit_related_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_site_visit_related_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_site_visit_related_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_worker_list_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_worker_list_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_worker_list_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_worker_related_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_worker_related_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_worker_related_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_organising_universe_manual_override"("p_project_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_organising_universe_manual_override"("p_project_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_organising_universe_manual_override"("p_project_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_trade_type_conflicts"() TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_trade_type_conflicts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_trade_type_conflicts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_organising_universe_changes"("p_confirm_rollback" boolean, "p_applied_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_organising_universe_changes"("p_confirm_rollback" boolean, "p_applied_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_organising_universe_changes"("p_confirm_rollback" boolean, "p_applied_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_employers_by_exact_name"("name_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_employers_by_exact_name"("name_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_employers_by_exact_name"("name_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_employers_by_name_fuzzy"("search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_employers_by_name_fuzzy"("search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_employers_by_name_fuzzy"("search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_activities_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_activities_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_activities_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organising_universe_manual"("p_project_id" "uuid", "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_organising_universe_manual"("p_project_id" "uuid", "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organising_universe_manual"("p_project_id" "uuid", "p_universe" "text", "p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_overlay_images_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_overlay_images_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_overlay_images_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_patch_geometries_from_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_patch_geometries_from_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_patch_geometries_from_wkt"("p_patch_id" "uuid", "p_geometries_wkt" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_patch_geometry_from_features"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_patch_geometry_from_features"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_patch_geometry_from_features"("p_patch_id" "uuid", "p_feature_geometries_geojson" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."should_auto_update_organising_universe"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."should_auto_update_organising_universe"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_auto_update_organising_universe"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_employer_project_site_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_employer_project_site_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_employer_project_site_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_employer_role_tag_from_per"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_employer_role_tag_from_per"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_employer_role_tag_from_per"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_trade_capability_from_pct"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_trade_capability_from_pct"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_trade_capability_from_pct"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_employer_list_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_employer_list_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_employer_list_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_fwc_lookup_jobs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fwc_lookup_jobs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fwc_lookup_jobs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organising_universe_with_rules"("p_project_id" "uuid", "p_respect_manual_override" boolean, "p_applied_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_organising_universe_with_rules"("p_project_id" "uuid", "p_respect_manual_override" boolean, "p_applied_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organising_universe_with_rules"("p_project_id" "uuid", "p_respect_manual_override" boolean, "p_applied_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_patch_geometry"("p_patch_id" "uuid", "p_geometry" "text", "p_updated_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_patch_geometry"("p_patch_id" "uuid", "p_geometry" "text", "p_updated_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_patch_geometry"("p_patch_id" "uuid", "p_geometry" "text", "p_updated_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pending_employers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pending_employers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pending_employers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_patch_employer"("p_patch" "uuid", "p_emp" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_patch_geometry"("p_feature_geometry" "jsonb", "p_patch_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_patch_geometry"("p_feature_geometry" "jsonb", "p_patch_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_patch_geometry"("p_feature_geometry" "jsonb", "p_patch_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_patch_site"("p_patch" "uuid", "p_site" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_contractor_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_contractor_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_contractor_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_trade_type"("trade_type_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_trade_type"("trade_type_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_trade_type"("trade_type_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";









GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_delegations" TO "anon";
GRANT ALL ON TABLE "public"."activity_delegations" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_delegations" TO "service_role";



GRANT ALL ON TABLE "public"."activity_objective_targets" TO "anon";
GRANT ALL ON TABLE "public"."activity_objective_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_objective_targets" TO "service_role";



GRANT ALL ON TABLE "public"."activity_objectives" TO "anon";
GRANT ALL ON TABLE "public"."activity_objectives" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_objectives" TO "service_role";



GRANT ALL ON TABLE "public"."activity_participants" TO "anon";
GRANT ALL ON TABLE "public"."activity_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_participants" TO "service_role";



GRANT ALL ON TABLE "public"."activity_rating_definitions" TO "anon";
GRANT ALL ON TABLE "public"."activity_rating_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_rating_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."activity_templates" TO "anon";
GRANT ALL ON TABLE "public"."activity_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_templates" TO "service_role";



GRANT ALL ON TABLE "public"."activity_workers" TO "anon";
GRANT ALL ON TABLE "public"."activity_workers" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_workers" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_assignments" TO "anon";
GRANT ALL ON TABLE "public"."campaign_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_kpis" TO "anon";
GRANT ALL ON TABLE "public"."campaign_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."company_eba_records" TO "anon";
GRANT ALL ON TABLE "public"."company_eba_records" TO "authenticated";
GRANT ALL ON TABLE "public"."company_eba_records" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_alerts" TO "anon";
GRANT ALL ON TABLE "public"."compliance_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_role_types" TO "anon";
GRANT ALL ON TABLE "public"."contractor_role_types" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_role_types" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_trade_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."contractor_trade_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_trade_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."job_sites" TO "anon";
GRANT ALL ON TABLE "public"."job_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."job_sites" TO "service_role";



GRANT ALL ON TABLE "public"."project_contractor_trades" TO "anon";
GRANT ALL ON TABLE "public"."project_contractor_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."project_contractor_trades" TO "service_role";



GRANT ALL ON TABLE "public"."project_employer_roles" TO "anon";
GRANT ALL ON TABLE "public"."project_employer_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."project_employer_roles" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."site_contractor_trades" TO "anon";
GRANT ALL ON TABLE "public"."site_contractor_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."site_contractor_trades" TO "service_role";



GRANT ALL ON TABLE "public"."union_roles" TO "anon";
GRANT ALL ON TABLE "public"."union_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."union_roles" TO "service_role";



GRANT ALL ON TABLE "public"."worker_placements" TO "anon";
GRANT ALL ON TABLE "public"."worker_placements" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_placements" TO "service_role";



GRANT ALL ON TABLE "public"."workers" TO "anon";
GRANT ALL ON TABLE "public"."workers" TO "authenticated";
GRANT ALL ON TABLE "public"."workers" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_project_metrics" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_project_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_project_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."dd_conversion_attempt" TO "anon";
GRANT ALL ON TABLE "public"."dd_conversion_attempt" TO "authenticated";
GRANT ALL ON TABLE "public"."dd_conversion_attempt" TO "service_role";



GRANT ALL ON TABLE "public"."delegate_assessment" TO "anon";
GRANT ALL ON TABLE "public"."delegate_assessment" TO "authenticated";
GRANT ALL ON TABLE "public"."delegate_assessment" TO "service_role";



GRANT ALL ON TABLE "public"."delegate_field_permissions" TO "anon";
GRANT ALL ON TABLE "public"."delegate_field_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."delegate_field_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."delegate_role_rating" TO "anon";
GRANT ALL ON TABLE "public"."delegate_role_rating" TO "authenticated";
GRANT ALL ON TABLE "public"."delegate_role_rating" TO "service_role";



GRANT ALL ON TABLE "public"."draft_lead_organiser_links" TO "anon";
GRANT ALL ON TABLE "public"."draft_lead_organiser_links" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_lead_organiser_links" TO "service_role";



GRANT ALL ON TABLE "public"."projects_organising_universe_backup" TO "anon";
GRANT ALL ON TABLE "public"."projects_organising_universe_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."projects_organising_universe_backup" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_rollback_info" TO "anon";
GRANT ALL ON TABLE "public"."emergency_rollback_info" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_rollback_info" TO "service_role";



GRANT ALL ON TABLE "public"."employer_aliases" TO "anon";
GRANT ALL ON TABLE "public"."employer_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."employer_analytics" TO "anon";
GRANT ALL ON TABLE "public"."employer_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."employer_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."employer_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."employer_compliance_checks" TO "anon";
GRANT ALL ON TABLE "public"."employer_compliance_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_compliance_checks" TO "service_role";



GRANT ALL ON TABLE "public"."employer_organisers" TO "anon";
GRANT ALL ON TABLE "public"."employer_organisers" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_organisers" TO "service_role";



GRANT ALL ON TABLE "public"."employer_project_trades" TO "anon";
GRANT ALL ON TABLE "public"."employer_project_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_project_trades" TO "service_role";



GRANT ALL ON TABLE "public"."employer_role_tags" TO "anon";
GRANT ALL ON TABLE "public"."employer_role_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_role_tags" TO "service_role";



GRANT ALL ON TABLE "public"."employers_with_eba" TO "anon";
GRANT ALL ON TABLE "public"."employers_with_eba" TO "authenticated";
GRANT ALL ON TABLE "public"."employers_with_eba" TO "service_role";



GRANT ALL ON TABLE "public"."entitlements_audit" TO "anon";
GRANT ALL ON TABLE "public"."entitlements_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."entitlements_audit" TO "service_role";



GRANT ALL ON TABLE "public"."entity_fields" TO "anon";
GRANT ALL ON TABLE "public"."entity_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_fields" TO "service_role";



GRANT ALL ON TABLE "public"."field_permissions" TO "anon";
GRANT ALL ON TABLE "public"."field_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."field_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."fwc_lookup_jobs" TO "anon";
GRANT ALL ON TABLE "public"."fwc_lookup_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."fwc_lookup_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."fwc_lookup_results" TO "anon";
GRANT ALL ON TABLE "public"."fwc_lookup_results" TO "authenticated";
GRANT ALL ON TABLE "public"."fwc_lookup_results" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_definitions" TO "anon";
GRANT ALL ON TABLE "public"."kpi_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_events" TO "anon";
GRANT ALL ON TABLE "public"."kpi_events" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_events" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_targets" TO "anon";
GRANT ALL ON TABLE "public"."kpi_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_targets" TO "service_role";



GRANT ALL ON TABLE "public"."lead_draft_organiser_links" TO "anon";
GRANT ALL ON TABLE "public"."lead_draft_organiser_links" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_draft_organiser_links" TO "service_role";



GRANT ALL ON TABLE "public"."lead_organiser_patch_assignments" TO "anon";
GRANT ALL ON TABLE "public"."lead_organiser_patch_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_organiser_patch_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."organiser_allocations" TO "anon";
GRANT ALL ON TABLE "public"."organiser_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."organiser_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."organiser_patch_assignments" TO "anon";
GRANT ALL ON TABLE "public"."organiser_patch_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."organiser_patch_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."organisers" TO "anon";
GRANT ALL ON TABLE "public"."organisers" TO "authenticated";
GRANT ALL ON TABLE "public"."organisers" TO "service_role";



GRANT ALL ON TABLE "public"."organising_universe_change_log" TO "anon";
GRANT ALL ON TABLE "public"."organising_universe_change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."organising_universe_change_log" TO "service_role";



GRANT ALL ON TABLE "public"."patch_job_sites" TO "anon";
GRANT ALL ON TABLE "public"."patch_job_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."patch_job_sites" TO "service_role";



GRANT ALL ON TABLE "public"."project_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."organising_universe_impact_analysis" TO "anon";
GRANT ALL ON TABLE "public"."organising_universe_impact_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."organising_universe_impact_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."overlay_images" TO "anon";
GRANT ALL ON TABLE "public"."overlay_images" TO "authenticated";
GRANT ALL ON TABLE "public"."overlay_images" TO "service_role";



GRANT ALL ON TABLE "public"."patch_employers" TO "anon";
GRANT ALL ON TABLE "public"."patch_employers" TO "authenticated";
GRANT ALL ON TABLE "public"."patch_employers" TO "service_role";



GRANT ALL ON TABLE "public"."patches" TO "anon";
GRANT ALL ON TABLE "public"."patches" TO "authenticated";
GRANT ALL ON TABLE "public"."patches" TO "service_role";



GRANT ALL ON TABLE "public"."patch_project_mapping_view" TO "anon";
GRANT ALL ON TABLE "public"."patch_project_mapping_view" TO "authenticated";
GRANT ALL ON TABLE "public"."patch_project_mapping_view" TO "service_role";



GRANT ALL ON TABLE "public"."patch_regions" TO "anon";
GRANT ALL ON TABLE "public"."patch_regions" TO "authenticated";
GRANT ALL ON TABLE "public"."patch_regions" TO "service_role";



GRANT ALL ON TABLE "public"."patches_with_geojson" TO "anon";
GRANT ALL ON TABLE "public"."patches_with_geojson" TO "authenticated";
GRANT ALL ON TABLE "public"."patches_with_geojson" TO "service_role";



GRANT ALL ON TABLE "public"."pending_employers" TO "anon";
GRANT ALL ON TABLE "public"."pending_employers" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_employers" TO "service_role";



GRANT ALL ON TABLE "public"."pending_users" TO "anon";
GRANT ALL ON TABLE "public"."pending_users" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_users" TO "service_role";



GRANT ALL ON TABLE "public"."permission_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."permission_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_all_builders" TO "anon";
GRANT ALL ON TABLE "public"."project_all_builders" TO "authenticated";
GRANT ALL ON TABLE "public"."project_all_builders" TO "service_role";



GRANT ALL ON TABLE "public"."trade_types" TO "anon";
GRANT ALL ON TABLE "public"."trade_types" TO "authenticated";
GRANT ALL ON TABLE "public"."trade_types" TO "service_role";



GRANT ALL ON TABLE "public"."project_assignments_detailed" TO "anon";
GRANT ALL ON TABLE "public"."project_assignments_detailed" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assignments_detailed" TO "service_role";



GRANT ALL ON TABLE "public"."project_builder_jv" TO "anon";
GRANT ALL ON TABLE "public"."project_builder_jv" TO "authenticated";
GRANT ALL ON TABLE "public"."project_builder_jv" TO "service_role";



GRANT ALL ON TABLE "public"."project_compliance" TO "anon";
GRANT ALL ON TABLE "public"."project_compliance" TO "authenticated";
GRANT ALL ON TABLE "public"."project_compliance" TO "service_role";



GRANT ALL ON TABLE "public"."project_dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."project_dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."project_dashboard_summary" TO "service_role";



GRANT ALL ON TABLE "public"."project_eba_details" TO "anon";
GRANT ALL ON TABLE "public"."project_eba_details" TO "authenticated";
GRANT ALL ON TABLE "public"."project_eba_details" TO "service_role";



GRANT ALL ON TABLE "public"."project_list_comprehensive_view" TO "anon";
GRANT ALL ON TABLE "public"."project_list_comprehensive_view" TO "authenticated";
GRANT ALL ON TABLE "public"."project_list_comprehensive_view" TO "service_role";



GRANT ALL ON TABLE "public"."project_organisers" TO "anon";
GRANT ALL ON TABLE "public"."project_organisers" TO "authenticated";
GRANT ALL ON TABLE "public"."project_organisers" TO "service_role";



GRANT ALL ON TABLE "public"."project_subset_eba_stats" TO "anon";
GRANT ALL ON TABLE "public"."project_subset_eba_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."project_subset_eba_stats" TO "service_role";



GRANT ALL ON TABLE "public"."project_trade_availability" TO "anon";
GRANT ALL ON TABLE "public"."project_trade_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."project_trade_availability" TO "service_role";



GRANT ALL ON TABLE "public"."role_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."role_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."role_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."site_contacts" TO "anon";
GRANT ALL ON TABLE "public"."site_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."site_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."site_employers" TO "anon";
GRANT ALL ON TABLE "public"."site_employers" TO "authenticated";
GRANT ALL ON TABLE "public"."site_employers" TO "service_role";



GRANT ALL ON TABLE "public"."site_visit" TO "anon";
GRANT ALL ON TABLE "public"."site_visit" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visit" TO "service_role";



GRANT ALL ON TABLE "public"."site_visit_list_view" TO "anon";
GRANT ALL ON TABLE "public"."site_visit_list_view" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visit_list_view" TO "service_role";



GRANT ALL ON TABLE "public"."training_participation" TO "anon";
GRANT ALL ON TABLE "public"."training_participation" TO "authenticated";
GRANT ALL ON TABLE "public"."training_participation" TO "service_role";



GRANT ALL ON TABLE "public"."unallocated_workers_analysis" TO "anon";
GRANT ALL ON TABLE "public"."unallocated_workers_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."unallocated_workers_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."union_activities" TO "anon";
GRANT ALL ON TABLE "public"."union_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."union_activities" TO "service_role";



GRANT ALL ON TABLE "public"."union_activity_scopes" TO "anon";
GRANT ALL ON TABLE "public"."union_activity_scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."union_activity_scopes" TO "service_role";



GRANT ALL ON TABLE "public"."user_role_assignments" TO "anon";
GRANT ALL ON TABLE "public"."user_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."v_lead_patches_current" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_patches_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_patches_current" TO "service_role";



GRANT ALL ON TABLE "public"."v_organiser_patches_current" TO "anon";
GRANT ALL ON TABLE "public"."v_organiser_patches_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_organiser_patches_current" TO "service_role";



GRANT ALL ON TABLE "public"."v_patch_employers_current" TO "anon";
GRANT ALL ON TABLE "public"."v_patch_employers_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_patch_employers_current" TO "service_role";



GRANT ALL ON TABLE "public"."v_patch_sites_current" TO "anon";
GRANT ALL ON TABLE "public"."v_patch_sites_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_patch_sites_current" TO "service_role";



GRANT ALL ON TABLE "public"."v_project_current_roles" TO "anon";
GRANT ALL ON TABLE "public"."v_project_current_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."v_project_current_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_project_site_contractors" TO "anon";
GRANT ALL ON TABLE "public"."v_project_site_contractors" TO "authenticated";
GRANT ALL ON TABLE "public"."v_project_site_contractors" TO "service_role";



GRANT ALL ON TABLE "public"."v_project_workers" TO "anon";
GRANT ALL ON TABLE "public"."v_project_workers" TO "authenticated";
GRANT ALL ON TABLE "public"."v_project_workers" TO "service_role";



GRANT ALL ON TABLE "public"."v_unified_project_contractors" TO "anon";
GRANT ALL ON TABLE "public"."v_unified_project_contractors" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unified_project_contractors" TO "service_role";



GRANT ALL ON TABLE "public"."whs_assessment" TO "anon";
GRANT ALL ON TABLE "public"."whs_assessment" TO "authenticated";
GRANT ALL ON TABLE "public"."whs_assessment" TO "service_role";



GRANT ALL ON TABLE "public"."whs_breach" TO "anon";
GRANT ALL ON TABLE "public"."whs_breach" TO "authenticated";
GRANT ALL ON TABLE "public"."whs_breach" TO "service_role";



GRANT ALL ON TABLE "public"."worker_activity_ratings" TO "anon";
GRANT ALL ON TABLE "public"."worker_activity_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_activity_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."worker_delegate_assignments" TO "anon";
GRANT ALL ON TABLE "public"."worker_delegate_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_delegate_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."worker_memberships" TO "anon";
GRANT ALL ON TABLE "public"."worker_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_memberships" TO "service_role";









GRANT ALL ON TABLE "public"."employer_list_view" TO "anon";
GRANT ALL ON TABLE "public"."employer_list_view" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_list_view" TO "service_role";



GRANT ALL ON TABLE "public"."worker_list_view" TO "anon";
GRANT ALL ON TABLE "public"."worker_list_view" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_list_view" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
