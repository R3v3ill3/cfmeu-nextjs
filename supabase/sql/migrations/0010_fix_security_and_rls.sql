-- Fix SECURITY INVOKER on views flagged by Supabase linter

-- Ensure views run with the querying user's permissions and RLS
alter view if exists public.employers_with_eba set (security_invoker = true);
alter view if exists public.v_project_site_contractors set (security_invoker = true);
alter view if exists public.v_project_workers set (security_invoker = true);
alter view if exists public.patches_with_geojson set (security_invoker = true);
alter view if exists public.unallocated_workers_analysis set (security_invoker = true);
alter view if exists public.v_organiser_patches_current set (security_invoker = true);
alter view if exists public.v_patch_employers_current set (security_invoker = true);
alter view if exists public.employer_analytics set (security_invoker = true);
alter view if exists public.v_patch_sites_current set (security_invoker = true);
alter view if exists public.v_lead_patches_current set (security_invoker = true);
alter view if exists public.v_project_current_roles set (security_invoker = true);

-- Re-enable RLS on assignment tables and add safe read policies
alter table if exists public.organiser_patch_assignments enable row level security;
alter table if exists public.lead_organiser_patch_assignments enable row level security;

-- organiser_patch_assignments: allow organisers to see their own rows; leads can see rows for their patches; admins can see all
drop policy if exists opas_self_read on public.organiser_patch_assignments;
drop policy if exists opas_lead_read on public.organiser_patch_assignments;
create policy opas_self_read on public.organiser_patch_assignments for select
  using (
    organiser_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy opas_lead_read on public.organiser_patch_assignments for select
  using (
    exists (
      select 1 from public.lead_organiser_patch_assignments la
      where la.patch_id = organiser_patch_assignments.patch_id
        and la.lead_organiser_id = auth.uid()
        and la.effective_to is null
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- lead_organiser_patch_assignments: allow leads to see their own rows; admins can see all
drop policy if exists lopas_self_read on public.lead_organiser_patch_assignments;
create policy lopas_self_read on public.lead_organiser_patch_assignments for select
  using (
    lead_organiser_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- spatial_ref_sys: enable RLS and allow read for API roles (anon/authenticated)
-- This table is readonly metadata from PostGIS; safe to expose for reads if needed
alter table if exists public.spatial_ref_sys enable row level security;
drop policy if exists srs_read_all on public.spatial_ref_sys;
create policy srs_read_all on public.spatial_ref_sys for select to anon, authenticated
  using (true);