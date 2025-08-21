-- Update patches RLS policies to remove dependency on missing role_hierarchy

alter table if exists patches enable row level security;

drop policy if exists patches_admin_all on patches;
create policy patches_admin_all on patches for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists patches_read_lead on patches;
create policy patches_read_lead on patches for select
  using (
    exists (select 1 from lead_organiser_patch_assignments a
            where a.patch_id = patches.id and a.effective_to is null and a.lead_organiser_id = auth.uid())
  );

drop policy if exists patches_read_org on patches;
create policy patches_read_org on patches for select
  using (exists (select 1 from organiser_patch_assignments a
                 where a.patch_id = patches.id and a.effective_to is null and a.organiser_id = auth.uid()));

