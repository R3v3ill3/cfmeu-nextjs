-- Draft Lead ↔ Organiser (live or draft) links and helpers

-- Ensure helper exists to maintain updated_at (noop if already defined)
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- New table to allow draft lead organisers (pending_users with role lead_organiser)
-- to be linked to either active organisers (profiles) or draft organisers (pending_users)
create table if not exists draft_lead_organiser_links (
  id uuid primary key default gen_random_uuid(),
  draft_lead_pending_user_id uuid not null references pending_users(id) on delete cascade,
  organiser_user_id uuid references profiles(id) on delete cascade,
  organiser_pending_user_id uuid references pending_users(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_lead_organiser_links_child_chk
    check ((organiser_user_id is not null)::int + (organiser_pending_user_id is not null)::int = 1)
);

create index if not exists idx_dlol_draft_lead on draft_lead_organiser_links(draft_lead_pending_user_id, is_active);
create index if not exists idx_dlol_child_user on draft_lead_organiser_links(organiser_user_id, is_active);
create index if not exists idx_dlol_child_pending on draft_lead_organiser_links(organiser_pending_user_id, is_active);

create trigger update_dlol_updated_at before update on draft_lead_organiser_links for each row execute function update_updated_at_column();

-- RLS: admin-only for all actions (align with existing admin-managed relationship tables)
alter table if exists draft_lead_organiser_links enable row level security;

drop policy if exists dlol_admin_all on draft_lead_organiser_links;
create policy dlol_admin_all on draft_lead_organiser_links for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Helper to close a lead_organiser ↔ patch assignment
create or replace function close_lead_patch(p_lead uuid, p_patch uuid)
returns void language sql as $$
  update lead_organiser_patch_assignments
    set effective_to = now()
    where lead_organiser_id = p_lead and patch_id = p_patch and effective_to is null;
$$;

-- Extend login helper to migrate draft lead links upon first login
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
  -- Get current user's email (if available)
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

  -- Set live profile role based on pending record
  update profiles set role = v_role where id = auth.uid();

  -- If the user is a pending organiser becoming live, migrate any live-lead ↔ draft-organiser links
  if v_pending_id is not null and v_role = 'organiser' then
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select l.lead_user_id, auth.uid(), coalesce(l.assigned_by, auth.uid())
    from lead_draft_organiser_links l
    where l.pending_user_id = v_pending_id
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
      and l.lead_user_id is not null
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Soft-close the draft links for audit (those which have been migrated)
    update lead_draft_organiser_links
      set is_active = false, end_date = current_date
      where pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date) and lead_user_id is not null;
  end if;

  -- If the user is a pending lead_becoming live, migrate draft lead links
  if v_pending_id is not null and v_role = 'lead_organiser' then
    -- Convert draft lead -> live organiser links into live role_hierarchy
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select auth.uid(), l.organiser_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Convert draft lead -> draft organiser links into live lead ↔ draft organiser links
    insert into lead_draft_organiser_links(lead_user_id, pending_user_id, assigned_by)
    select auth.uid(), l.organiser_pending_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_pending_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict do nothing;

    -- Soft-close all processed draft lead links
    update draft_lead_organiser_links
      set is_active = false, end_date = current_date
      where draft_lead_pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date);
  end if;
end;
$$;