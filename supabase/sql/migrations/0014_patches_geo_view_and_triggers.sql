-- Unify patches as single source and auto-assign job_sites to geo patches

-- 1) RPC returning geo patches with WKT geometry text from public.patches
create or replace function public.get_patches_with_geometry_text()
returns table (
  id uuid,
  name text,
  code text,
  type text,
  status text,
  geom text
)
language sql
stable
as $$
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

-- 2) Auto-assign job_sites.patch_id from coordinates using geo patches
create or replace function public.job_sites_set_patch_from_coords()
returns trigger
language plpgsql
as $$
declare
  v_patch_id uuid;
begin
  -- Only assign if unset and coordinates present
  if (new.patch_id is null) and (new.latitude is not null) and (new.longitude is not null) then
    select p.id
    into v_patch_id
    from public.patches p
    where p.type = 'geo'
      and p.status = 'active'
      and p.geom is not null
      and ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326))
    limit 1;

    if found then
      new.patch_id := v_patch_id;

      -- Keep link table in sync for downstream UIs
      begin
        insert into public.patch_job_sites (patch_id, job_site_id)
        values (v_patch_id, new.id)
        on conflict (patch_id, job_site_id)
          where effective_to is null
        do nothing;
      exception when others then
        -- ignore duplicates or partial index differences
        null;
      end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_job_sites_auto_patch on public.job_sites;
create trigger trg_job_sites_auto_patch
before insert or update of latitude, longitude
on public.job_sites
for each row
execute function public.job_sites_set_patch_from_coords();

-- 3) Optional: ensure a convenience view exposing GeoJSON from the same source
create or replace view public.patches_with_geojson
  (code, created_at, created_by, geom, geom_geojson, id, name, source_kml_path, updated_at, updated_by)
as
select
  p.code,
  p.created_at,
  p.created_by,
  p.geom,
  (ST_AsGeoJSON(p.geom))::json,
  p.id,
  p.name,
  p.source_kml_path,
  p.updated_at,
  p.updated_by
from public.patches p;

-- 4) One-time backfill: reflect any existing job_sites.patch_id into link table
insert into public.patch_job_sites (patch_id, job_site_id)
select js.patch_id, js.id
from public.job_sites js
left join public.patch_job_sites pjs
  on pjs.patch_id = js.patch_id
 and pjs.job_site_id = js.id
 and pjs.effective_to is null
where js.patch_id is not null
  and pjs.job_site_id is null;


