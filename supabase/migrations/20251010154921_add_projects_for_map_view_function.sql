create or replace function get_projects_for_map_view()
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  tier text,
  organising_universe text,
  stage_class text,
  builder_status text
) as $$
begin
  return query
  with projects_with_main_site as (
    select
      p.id,
      p.name,
      p.tier,
      p.organising_universe,
      p.stage_class,
      js.latitude,
      js.longitude,
      p.builder_id
    from projects p
    join job_sites js on p.main_job_site_id = js.id
    where js.latitude is not null and js.longitude is not null
  ),
  builder_assignments as (
    select
      pa.project_id,
      max(case when e.enterprise_agreement_status = true then 2
               when e.enterprise_agreement_status = false then 1
               else 0
          end) as eba_status_code
    from project_assignments pa
    join contractor_role_types crt on pa.contractor_role_type_id = crt.id
    join employers e on pa.employer_id = e.id
    where pa.assignment_type = 'contractor_role'
      and crt.code in ('builder', 'head_contractor')
    group by pa.project_id
  )
  select
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    p.tier::text,
    p.organising_universe::text,
    p.stage_class::text,
    case
      when ba.eba_status_code = 2 then 'active_builder'
      when ba.eba_status_code = 1 then 'inactive_builder'
      when ba.project_id is not null then 'inactive_builder' -- Has builder assignment but not active EBA
      when p.builder_id is not null then 'unknown_builder' -- builder_id is present but no assignment match
      else 'unknown_builder'
    end::text as builder_status
  from projects_with_main_site p
  left join builder_assignments ba on p.id = ba.project_id;
end;
$$ language plpgsql;

