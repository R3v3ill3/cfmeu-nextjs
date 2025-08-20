-- Patches core schema
-- Safe to run multiple times using IF NOT EXISTS where supported

-- Extensions (if not present in your Supabase project, enable in dashboard)
-- create extension if not exists pgcrypto;

create table if not exists patches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('geo','trade')),
  status text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists patches_name_lower_idx on patches (lower(name));

create table if not exists patch_job_sites (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references patches(id) on delete cascade,
  job_site_id uuid not null references job_sites(id) on delete cascade,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);
create unique index if not exists patch_job_sites_open_uidx
  on patch_job_sites(patch_id, job_site_id)
  where effective_to is null;

create table if not exists patch_employers (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references patches(id) on delete cascade,
  employer_id uuid not null references employers(id) on delete cascade,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);
create unique index if not exists patch_employers_open_uidx
  on patch_employers(patch_id, employer_id)
  where effective_to is null;

create table if not exists organiser_patch_assignments (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references profiles(id) on delete cascade,
  patch_id uuid not null references patches(id) on delete cascade,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);
create unique index if not exists organiser_patch_assignments_open_uidx
  on organiser_patch_assignments(organiser_id, patch_id)
  where effective_to is null;

create table if not exists lead_organiser_patch_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_organiser_id uuid not null references profiles(id) on delete cascade,
  patch_id uuid not null references patches(id) on delete cascade,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);
create unique index if not exists lead_organiser_patch_assignments_open_uidx
  on lead_organiser_patch_assignments(lead_organiser_id, patch_id)
  where effective_to is null;

-- Views for convenience
create or replace view v_patch_sites_current as
  select patch_id, job_site_id from patch_job_sites where effective_to is null;

create or replace view v_patch_employers_current as
  select patch_id, employer_id from patch_employers where effective_to is null;

create or replace view v_organiser_patches_current as
  select organiser_id, patch_id from organiser_patch_assignments where effective_to is null;

create or replace view v_lead_patches_current as
  select lead_organiser_id, patch_id from lead_organiser_patch_assignments where effective_to is null;

-- Helper functions
create or replace function close_patch_site(p_patch uuid, p_site uuid)
returns void language sql as $$
  update patch_job_sites
    set effective_to = now()
    where patch_id = p_patch and job_site_id = p_site and effective_to is null;
$$;

create or replace function upsert_patch_site(p_patch uuid, p_site uuid)
returns void language plpgsql as $$
begin
  insert into patch_job_sites(patch_id, job_site_id) values (p_patch, p_site)
  on conflict (patch_id, job_site_id) where effective_to is null do nothing;
end;
$$;

create or replace function close_patch_employer(p_patch uuid, p_emp uuid)
returns void language sql as $$
  update patch_employers
    set effective_to = now()
    where patch_id = p_patch and employer_id = p_emp and effective_to is null;
$$;

create or replace function upsert_patch_employer(p_patch uuid, p_emp uuid)
returns void language plpgsql as $$
begin
  insert into patch_employers(patch_id, employer_id) values (p_patch, p_emp)
  on conflict (patch_id, employer_id) where effective_to is null do nothing;
end;
$$;

create or replace function close_organiser_patch(p_org uuid, p_patch uuid)
returns void language sql as $$
  update organiser_patch_assignments
    set effective_to = now()
    where organiser_id = p_org and patch_id = p_patch and effective_to is null;
$$;

create or replace function upsert_organiser_patch(p_org uuid, p_patch uuid)
returns void language plpgsql as $$
begin
  insert into organiser_patch_assignments(organiser_id, patch_id) values (p_org, p_patch)
  on conflict (organiser_id, patch_id) where effective_to is null do nothing;
end;
$$;

create or replace function upsert_lead_patch(p_lead uuid, p_patch uuid)
returns void language plpgsql as $$
begin
  insert into lead_organiser_patch_assignments(lead_organiser_id, patch_id) values (p_lead, p_patch)
  on conflict (lead_organiser_id, patch_id) where effective_to is null do nothing;
end;
$$;

