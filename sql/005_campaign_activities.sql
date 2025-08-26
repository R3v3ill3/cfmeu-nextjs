-- Campaign activities schema (additive, non-destructive)

-- Link activities to campaigns and add UI-specific fields
alter table if exists union_activities
  add column if not exists campaign_id uuid references campaigns(id),
  add column if not exists activity_ui_type text,
  add column if not exists activity_call_to_action text;

-- Scope mapping for activities
create table if not exists union_activity_scopes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references union_activities(id) on delete cascade,
  project_id uuid references projects(id),
  employer_id uuid references employers(id),
  job_site_id uuid references job_sites(id),
  created_at timestamptz not null default now(),
  constraint union_activity_scopes_at_least_one_scope
    check (project_id is not null or employer_id is not null or job_site_id is not null)
);

-- Uniqueness across a given activity and the same scope triple (handle nulls via sentinel)
create unique index if not exists uidx_union_activity_scopes_unique
  on union_activity_scopes (
    activity_id,
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(employer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(job_site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_union_activity_scopes_activity_id on union_activity_scopes(activity_id);
create index if not exists idx_union_activity_scopes_project_id on union_activity_scopes(project_id);
create index if not exists idx_union_activity_scopes_employer_id on union_activity_scopes(employer_id);
create index if not exists idx_union_activity_scopes_job_site_id on union_activity_scopes(job_site_id);

-- Activity worker membership (separate from ratings)
create table if not exists activity_workers (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references union_activities(id) on delete cascade,
  worker_id uuid not null references workers(id),
  created_at timestamptz not null default now(),
  unique(activity_id, worker_id)
);
create index if not exists idx_activity_workers_activity_id on activity_workers(activity_id);
create index if not exists idx_activity_workers_worker_id on activity_workers(worker_id);

-- Per-activity rating definitions (1..5)
create table if not exists activity_rating_definitions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references union_activities(id) on delete cascade,
  level int not null check (level between 1 and 5),
  label text not null,
  definition text,
  created_at timestamptz not null default now(),
  unique(activity_id, level)
);
create index if not exists idx_activity_rating_definitions_activity_id on activity_rating_definitions(activity_id);

-- Objectives and subgroup targets
create table if not exists activity_objectives (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references union_activities(id) on delete cascade,
  name text not null,
  target_kind text not null check (target_kind in ('number','percent')),
  target_value numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_objectives_activity_id on activity_objectives(activity_id);

create table if not exists activity_objective_targets (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references activity_objectives(id) on delete cascade,
  dimension text not null check (dimension in ('project','employer','job_site')),
  dimension_id uuid not null,
  target_value numeric not null,
  created_at timestamptz not null default now(),
  unique(objective_id, dimension, dimension_id)
);
create index if not exists idx_activity_objective_targets_objective_id on activity_objective_targets(objective_id);