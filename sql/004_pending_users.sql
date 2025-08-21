-- Pending users (draft/invited) schema and policies

-- Table
create table if not exists pending_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role text not null check (role in ('admin','lead_organiser','organiser','delegate','viewer')),
  status text not null default 'draft' check (status in ('draft','invited')),
  notes text,
  assigned_patch_ids uuid[] not null default '{}'::uuid[],
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  invited_at timestamptz
);

-- Helpful unique to avoid duplicate drafts per role
create unique index if not exists pending_users_email_role_uidx on pending_users (lower(email), role);

-- RLS
alter table if exists pending_users enable row level security;

-- Admin full access
drop policy if exists pending_users_admin_all on pending_users;
create policy pending_users_admin_all on pending_users for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Allow authenticated users to create their own draft requests (e.g., self-signup)
drop policy if exists pending_users_self_insert on pending_users;
create policy pending_users_self_insert on pending_users for insert to authenticated
  with check (true);

-- Allow authenticated users to view their own rows by creator (optional, can be removed if not needed)
drop policy if exists pending_users_self_select on pending_users;
create policy pending_users_self_select on pending_users for select to authenticated
  using (created_by = auth.uid());

