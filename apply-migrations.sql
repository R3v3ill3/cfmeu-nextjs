-- Apply this in your Supabase SQL editor

-- 0. Ensure RLS and privileges for map-related objects
alter table if exists patches enable row level security;
alter table if exists job_sites enable row level security;

-- Ensure view is invoker-secured and readable by authenticated users
do $$ begin
  perform 1 from pg_views where schemaname = 'public' and viewname = 'patches_with_geojson';
  if found then
    execute 'alter view public.patches_with_geojson set (security_invoker = on)';
    execute 'grant select on public.patches_with_geojson to authenticated';
  end if;
exception when others then
  -- ignore if view does not exist yet
  null;
end $$;

-- 1. Add policies to allow map viewing for all authenticated users
DROP POLICY IF EXISTS patches_map_read ON patches;
CREATE POLICY patches_map_read ON patches FOR SELECT TO authenticated
  USING (type = 'geo' AND status = 'active');

DROP POLICY IF EXISTS job_sites_map_read ON job_sites;
CREATE POLICY job_sites_map_read ON job_sites FOR SELECT TO authenticated
  USING (true);

-- Ensure table-level select privileges (RLS still applies)
grant select on public.patches to authenticated;
grant select on public.job_sites to authenticated;

-- 2. Create test data if none exists
DO $$
DECLARE
    patch_count INTEGER;
BEGIN
    -- Check if any geo patches exist
    SELECT COUNT(*) INTO patch_count 
    FROM patches 
    WHERE type = 'geo' AND status = 'active' AND geom IS NOT NULL;
    
    -- If no geo patches exist, create a test one
    IF patch_count = 0 THEN
        -- Create a test patch around Sydney CBD area
        INSERT INTO patches (
            name,
            code, 
            type,
            status,
            geom,
            description
        ) VALUES (
            'Test Sydney CBD',
            'SYD-CBD-TEST',
            'geo',
            'active',
            ST_GeomFromText('POLYGON((151.200 -33.860, 151.220 -33.860, 151.220 -33.880, 151.200 -33.880, 151.200 -33.860))', 4326),
            'Test geographic patch for map display around Sydney CBD'
        );
        
        RAISE NOTICE 'Created test patch: Test Sydney CBD';
        
        -- Also create a test job site within this patch
        INSERT INTO job_sites (
            name,
            location,
            latitude,
            longitude
        ) VALUES (
            'Test Sydney Job Site',
            'Sydney CBD, NSW',
            -33.8700,
            151.2100
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Created test job site: Test Sydney Job Site';
    ELSE
        RAISE NOTICE 'Found % existing geo patches, skipping test patch creation', patch_count;
    END IF;
END $$;

-- 1) Allow MultiPolygon in patches.geom
alter table public.patches
  alter column geom type geometry(MultiPolygon, 4326)
  using ST_Multi(geom);

-- 2) Safer merge function (unions and validates)
create or replace function public.merge_patch_geometry(p_patch_id uuid, p_wkt text, p_srid int default 4326)
returns void
language plpgsql
as $$
declare
  v_new geometry;
begin
  if p_wkt is null or length(p_wkt) = 0 then
    return;
  end if;

  v_new := ST_Multi(ST_SetSRID(ST_GeomFromText(p_wkt), p_srid));

  update public.patches p
  set geom = case
    when p.geom is null then ST_MakeValid(v_new)
    else ST_MakeValid(ST_UnaryUnion(ST_Union(p.geom, v_new)))
  end
  where p.id = p_patch_id;
end;
$$;

grant execute on function public.merge_patch_geometry(uuid, text, int) to authenticated;

-- 3) Optional: make GeoJSON resilient to invalid shapes
create or replace view public.patches_with_geojson
  (code, created_at, created_by, geom, geom_geojson, id, name, source_kml_path, updated_at, updated_by)
as
select
  p.code,
  p.created_at,
  p.created_by,
  p.geom,
  (ST_AsGeoJSON(ST_MakeValid(p.geom)))::json as geom_geojson,
  p.id,
  p.name,
  p.source_kml_path,
  p.updated_at,
  p.updated_by
from public.patches p;
