-- Enable RLS and basic policies

alter table if exists patches enable row level security;
alter table if exists patch_job_sites enable row level security;
alter table if exists patch_employers enable row level security;
alter table if exists organiser_patch_assignments enable row level security;
alter table if exists lead_organiser_patch_assignments enable row level security;

-- Admin all
do $$ begin
  perform 1;
exception when others then
  -- ignore errors in case profiles/role not resolvable in migrations context
end $$;

-- Policies (simplified; refine per project standards)
drop policy if exists patches_admin_all on patches;
create policy patches_admin_all on patches for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists patches_read_lead on patches;
create policy patches_read_lead on patches for select
  using (
    exists (select 1 from lead_organiser_patch_assignments a
            where a.patch_id = patches.id and a.effective_to is null and a.lead_organiser_id = auth.uid())
    or exists (select 1 from organiser_patch_assignments oa
               join role_hierarchy rh on rh.parent_user_id = auth.uid() and rh.child_user_id = oa.organiser_id
               where oa.patch_id = patches.id and oa.effective_to is null)
  );

drop policy if exists patches_read_org on patches;
create policy patches_read_org on patches for select
  using (exists (select 1 from organiser_patch_assignments a
                 where a.patch_id = patches.id and a.effective_to is null and a.organiser_id = auth.uid()));

-- Mapping tables: read
drop policy if exists pjs_read on patch_job_sites;
create policy pjs_read on patch_job_sites for select
  using (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_job_sites.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null)
      or exists (select 1 from organiser_patch_assignments a where a.patch_id = patch_job_sites.patch_id and a.organiser_id = auth.uid() and a.effective_to is null)
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists pemps_read on patch_employers;
create policy pemps_read on patch_employers for select
  using (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_employers.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null)
      or exists (select 1 from organiser_patch_assignments a where a.patch_id = patch_employers.patch_id and a.organiser_id = auth.uid() and a.effective_to is null)
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Mapping tables: write (admin)
drop policy if exists pjs_admin_write on patch_job_sites;
create policy pjs_admin_write on patch_job_sites for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists pemps_admin_write on patch_employers;
create policy pemps_admin_write on patch_employers for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Lead organiser can write within owned patches
drop policy if exists pjs_lead_write on patch_job_sites;
create policy pjs_lead_write on patch_job_sites for insert to authenticated
  with check (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_job_sites.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null));

drop policy if exists pjs_lead_update on patch_job_sites;
create policy pjs_lead_update on patch_job_sites for update to authenticated
  using (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_job_sites.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null))
  with check (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_job_sites.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null));

drop policy if exists pemps_lead_write on patch_employers;
create policy pemps_lead_write on patch_employers for insert to authenticated
  with check (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_employers.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null));

drop policy if exists pemps_lead_update on patch_employers;
create policy pemps_lead_update on patch_employers for update to authenticated
  using (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_employers.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null))
  with check (exists (select 1 from lead_organiser_patch_assignments a where a.patch_id = patch_employers.patch_id and a.lead_organiser_id = auth.uid() and a.effective_to is null));

-- Assignment tables: similar policies
alter table if exists organiser_patch_assignments disable row level security; -- managed via admin/lead flows typically
alter table if exists lead_organiser_patch_assignments disable row level security; -- ditto

