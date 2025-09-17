-- Fix project_dashboard_summary view to correctly populate patch and organiser information
-- Issues fixed:
-- 1. Add effective_to IS NULL condition for patch queries  
-- 2. Update engaged employers query to use project_assignments instead of project_employer_roles
-- 3. Add organiser names field to the view

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

  -- FIXED: Engaged employers using current project_assignments table instead of deprecated project_employer_roles
  coalesce((
    select count(distinct e_id)
    from (
      select sct.employer_id as e_id
      from site_contractor_trades sct
      join job_sites js on js.id = sct.job_site_id
      where js.project_id = p.id
      union
      select pa.employer_id as e_id
      from project_assignments pa
      where pa.project_id = p.id 
        and pa.assignment_type = 'contractor_role'
    ) engaged
  ), 0) as engaged_employer_count,

  -- FIXED: Engaged employers with at least one EBA record (updated to use project_assignments)
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
        select pa.employer_id as e_id
        from project_assignments pa
        where pa.project_id = p.id 
          and pa.assignment_type = 'contractor_role'
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

  -- FIXED: First linked patch name with effective_to IS NULL condition
  (
    select p2.name
    from patch_job_sites pjs
    join patches p2 on p2.id = pjs.patch_id
    where pjs.job_site_id in (select id from job_sites where project_id = p.id)
      and pjs.effective_to is null  -- FIXED: Only get current patch assignments
    order by p2.name  -- For consistent ordering
    limit 1
  ) as first_patch_name,

  -- NEW: Organiser names for the project (comma-separated list)
  (
    select string_agg(distinct prof.full_name, ', ' order by prof.full_name)
    from patch_job_sites pjs
    join patches patch on patch.id = pjs.patch_id
    join organiser_patch_assignments opa on opa.patch_id = patch.id
    join profiles prof on prof.id = opa.organiser_id
    where pjs.job_site_id in (select id from job_sites where project_id = p.id)
      and pjs.effective_to is null  -- Only current patch assignments
      and opa.effective_to is null  -- Only current organiser assignments
  ) as organiser_names

from projects p;

-- Grant appropriate permissions
grant select on public.project_dashboard_summary to authenticated, anon;

-- Add helpful comment
comment on view public.project_dashboard_summary is 'Summarized project data for dashboard cards including fixed patch and organiser information';
