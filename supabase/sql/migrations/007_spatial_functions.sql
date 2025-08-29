-- Enable PostGIS extension if not already enabled
create extension if not exists postgis;

-- Function to find which patch contains given coordinates
create or replace function find_patch_for_coordinates(lat double precision, lng double precision)
returns table(id uuid, name text, distance double precision)
language plpgsql
as $$
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

-- Function to bulk assign projects to patches based on coordinates
create or replace function bulk_assign_projects_to_patches()
returns table(assigned integer, errors integer)
language plpgsql
as $$
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

-- Add spatial index on patches.geom for better performance
create index if not exists idx_patches_geom on patches using gist(geom);

-- Add spatial index on job_sites coordinates for better performance
create index if not exists idx_job_sites_coordinates on job_sites using gist(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) where longitude is not null and latitude is not null;
