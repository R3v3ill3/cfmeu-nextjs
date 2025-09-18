-- Persistent queue for FWC / Incolink scrapers
-- Note: apply manually if migrations history is out of sync

create type public.scraper_job_type as enum ('fwc_lookup','incolink_sync');
create type public.scraper_job_status as enum ('queued','running','succeeded','failed','cancelled');

create table public.scraper_jobs (
    id uuid primary key default gen_random_uuid(),
    job_type public.scraper_job_type not null,
    payload jsonb not null,
    progress_total integer not null default 0,
    progress_completed integer not null default 0,
    status public.scraper_job_status not null default 'queued',
    priority smallint not null default 5 check (priority between 1 and 10),
    attempts integer not null default 0,
    max_attempts integer not null default 5,
    lock_token uuid,
    locked_at timestamptz,
    run_at timestamptz not null default now(),
    last_error text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create table public.scraper_job_events (
    id bigserial primary key,
    job_id uuid not null references public.scraper_jobs(id) on delete cascade,
    event_type text not null,
    payload jsonb,
    created_at timestamptz not null default now()
);

create index idx_scraper_jobs_status_run_at on public.scraper_jobs(status, run_at);
create index idx_scraper_jobs_priority on public.scraper_jobs(priority desc);
create index idx_scraper_jobs_lock on public.scraper_jobs(lock_token) where lock_token is not null;

create function public.set_scraper_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_scraper_jobs_updated_at
before update on public.scraper_jobs
for each row execute function public.set_scraper_jobs_updated_at();

alter table public.scraper_jobs enable row level security;
alter table public.scraper_job_events enable row level security;

-- Allow authenticated users to enqueue jobs but only service_role/worker to run them
create policy "scraper_jobs_insert_authenticated" on public.scraper_jobs
for insert with check (
  auth.uid() = created_by
);

create policy "scraper_jobs_select_owner" on public.scraper_jobs
for select using (
  auth.role() = 'service_role' or auth.uid() = created_by
);

create policy "scraper_jobs_worker_manage" on public.scraper_jobs
for all using (
  auth.role() = 'service_role'
);

create policy "scraper_job_events_owner" on public.scraper_job_events
for select using (
  auth.role() = 'service_role' or exists (
    select 1 from public.scraper_jobs j
    where j.id = scraper_job_events.job_id and auth.uid() = j.created_by
  )
);

create policy "scraper_job_events_owner_insert" on public.scraper_job_events
for insert with check (
  auth.role() = 'service_role' or exists (
    select 1 from public.scraper_jobs j
    where j.id = scraper_job_events.job_id and auth.uid() = j.created_by
  )
);

create policy "scraper_job_events_worker" on public.scraper_job_events
for all using (auth.role() = 'service_role');

comment on table public.scraper_jobs is 'Durable job queue for scraper workers (FWC, Incolink)';
comment on table public.scraper_job_events is 'Audit trail for scraper job lifecycle changes';
