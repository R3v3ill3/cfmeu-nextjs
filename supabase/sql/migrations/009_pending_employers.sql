-- Pending employers queue for later import
create table if not exists public.pending_employers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  csv_role text,
  source text,
  raw jsonb,
  created_by uuid references auth.users(id)
);

alter table public.pending_employers enable row level security;

do $$ begin
  create policy "allow_read_own_and_admin" on public.pending_employers
    for select using (
      auth.role() = 'anon' is false
    );
exception when others then null; end $$;

do $$ begin
  create policy "allow_insert_authenticated" on public.pending_employers
    for insert with check (auth.uid() is not null);
exception when others then null; end $$;


