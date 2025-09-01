-- Create a summarized view for project cards to avoid N+1 queries
-- Includes: total_workers, total_members, engaged_employer_count, eba_active_employer_count,
-- estimated_total, delegate_name, first_patch_name

create or replace view public.project_dashboard_summary as
select
  p.id as project_id,

  -- Distinct workers placed on any site within the project
  coalesce((
    select count(distinct wp.worker_id)
    from job_sites js
    join worker_placements wp on wp.job_site_id = js.id
    where js.project_id = p.id
  ), 0) as total_workers,

  -- Distinct members among those workers
  coalesce((
    select count(distinct wp.worker_id)
    from job_sites js
    join worker_placements wp on wp.job_site_id = js.id
    join workers w on w.id = wp.worker_id
    where js.project_id = p.id
      and w.union_membership_status = 'member'
  ), 0) as total_members,

  -- Engaged employers: contractors on sites + head contractor role
  coalesce((
    select count(distinct e_id)
    from (
      select sct.employer_id as e_id
      from site_contractor_trades sct
      join job_sites js on js.id = sct.job_site_id
      where js.project_id = p.id
      union
      select per.employer_id as e_id
      from project_employer_roles per
      where per.project_id = p.id and per.role in ('head_contractor')
    ) engaged
  ), 0) as engaged_employer_count,

  -- Engaged employers with at least one EBA record
  coalesce((
    select count(distinct cer.employer_id)
    from company_eba_records cer
    where cer.employer_id in (
      select e_id from (
        select sct.employer_id as e_id
        from site_contractor_trades sct
        join job_sites js on js.id = sct.job_site_id
        where js.project_id = p.id
        union
        select per.employer_id as e_id
        from project_employer_roles per
        where per.project_id = p.id and per.role in ('head_contractor')
      ) engaged_e
    )
  ), 0) as eba_active_employer_count,

  -- Estimated total workers: sum of max(est) per employer (avoid double count across multiple trades)
  coalesce((
    select sum(est) from (
      select max(coalesce(pct.estimated_project_workforce, 0)) as est
      from project_contractor_trades pct
      where pct.project_id = p.id
      group by pct.employer_id
    ) x
  ), 0) as estimated_total,

  -- Prefer site_delegate, else shift_delegate, else company_delegate, else hsr
  (
    select trim(concat(coalesce(w.first_name, ''), ' ', coalesce(w.surname, '')))
    from union_roles ur
    join workers w on w.id = ur.worker_id
    where ur.job_site_id in (select id from job_sites where project_id = p.id)
      and (ur.end_date is null or ur.end_date >= current_date)
      and ur.name in ('site_delegate','shift_delegate','company_delegate','hsr')
    order by case ur.name
      when 'site_delegate' then 1
      when 'shift_delegate' then 2
      when 'company_delegate' then 3
      when 'hsr' then 4
      else 5
    end, ur.worker_id
    limit 1
  ) as delegate_name,

  -- First linked patch name (arbitrary stable choice)
  (
    select p2.name
    from patch_job_sites pjs
    join patches p2 on p2.id = pjs.patch_id
    where pjs.job_site_id in (select id from job_sites where project_id = p.id)
    limit 1
  ) as first_patch_name
from projects p;

-- Helpful indexes on base tables (safe if not already present)
create index if not exists idx_worker_placements_job_site_id on worker_placements(job_site_id);
create index if not exists idx_worker_placements_worker_id on worker_placements(worker_id);
create index if not exists idx_job_sites_project_id on job_sites(project_id);
create index if not exists idx_site_contractor_trades_job_site_id on site_contractor_trades(job_site_id);
create index if not exists idx_project_employer_roles_project_id on project_employer_roles(project_id);
create index if not exists idx_project_employer_roles_role on project_employer_roles(role);
create index if not exists idx_company_eba_records_employer_id on company_eba_records(employer_id);
create index if not exists idx_project_contractor_trades_project_id on project_contractor_trades(project_id);
create index if not exists idx_union_roles_job_site_id on union_roles(job_site_id);
create index if not exists idx_union_roles_end_date on union_roles(end_date);
create index if not exists idx_patch_job_sites_job_site_id on patch_job_sites(job_site_id);

