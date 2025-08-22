-- Lead ↔ Draft organiser links and helpers

-- Ensure helper exists to maintain updated_at
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Linking table between lead organisers (profiles) and draft/invited organisers (pending_users)
create table if not exists lead_draft_organiser_links (
  id uuid primary key default gen_random_uuid(),
  lead_user_id uuid not null references profiles(id) on delete cascade,
  pending_user_id uuid not null references pending_users(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_draft_organiser_links_uidx unique (lead_user_id, pending_user_id, start_date)
);

create index if not exists idx_ldol_lead on lead_draft_organiser_links(lead_user_id, is_active);
create index if not exists idx_ldol_pending on lead_draft_organiser_links(pending_user_id, is_active);

create trigger update_ldol_updated_at before update on lead_draft_organiser_links for each row execute function update_updated_at_column();

-- RLS: admin-only for all actions
alter table if exists lead_draft_organiser_links enable row level security;

drop policy if exists ldol_admin_all on lead_draft_organiser_links;
create policy ldol_admin_all on lead_draft_organiser_links for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Extend login helper to migrate draft links upon first login
create or replace function apply_pending_user_on_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
  v_pending_id uuid;
begin
  -- Get current user's email
  begin
    v_email := (select auth.email());
  exception when others then
    v_email := null;
  end;
  if v_email is null then
    return;
  end if;

  -- If a pending row exists for this email, apply the role to the profile
  select id, role into v_pending_id, v_role
  from pending_users
  where lower(email) = lower(v_email)
  order by invited_at desc nulls last, created_at desc
  limit 1;

  if v_role is null then
    return;
  end if;

  update profiles set role = v_role where id = auth.uid();

  -- Migrate any active lead ↔ draft organiser links to live role_hierarchy
  if v_pending_id is not null then
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select l.lead_user_id, auth.uid(), coalesce(l.assigned_by, auth.uid())
    from lead_draft_organiser_links l
    where l.pending_user_id = v_pending_id
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Soft-close the draft links for audit
    update lead_draft_organiser_links
      set is_active = false, end_date = current_date
      where pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date);
  end if;
end;
$$;