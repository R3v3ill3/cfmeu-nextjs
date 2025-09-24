-- Add last_seen_projects_at to profiles and helpful indexes for project notifications

-- Profiles: track when the user last viewed projects
alter table if exists profiles
  add column if not exists last_seen_projects_at timestamptz null;

-- Projects: ensure created_at is indexed for fast sorting/filtering
create index if not exists projects_created_at_idx on projects (created_at desc);

-- Job sites: ensure patch filtering is efficient when deriving project ids
create index if not exists job_sites_patch_id_idx on job_sites (patch_id);

-- Optional: speed up distinct project lookups by (patch_id, project_id) if present
-- Uncomment if table exists in your schema
-- create index if not exists patch_job_sites_patch_site_idx on patch_job_sites (patch_id, job_site_id) where effective_to is null;


