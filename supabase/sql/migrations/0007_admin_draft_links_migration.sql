-- Extend apply_pending_user_on_login to migrate draft admin links and support role swaps

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

  -- If the user is a pending organiser becoming live, migrate any live-parent ↔ draft-organiser links
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

  -- If the user is a pending lead organiser becoming live, migrate draft lead links
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

    -- Convert draft lead -> draft organiser links into live parent ↔ draft organiser links
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

  -- If the user is a pending admin becoming live, migrate draft admin links (same as lead organiser)
  if v_pending_id is not null and v_role = 'admin' then
    -- Convert draft admin -> live organiser links into live role_hierarchy
    insert into role_hierarchy(parent_user_id, child_user_id, assigned_by)
    select auth.uid(), l.organiser_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict (parent_user_id, child_user_id, start_date) do nothing;

    -- Convert draft admin -> draft organiser links into live parent ↔ draft organiser links
    insert into lead_draft_organiser_links(lead_user_id, pending_user_id, assigned_by)
    select auth.uid(), l.organiser_pending_user_id, coalesce(l.assigned_by, auth.uid())
    from draft_lead_organiser_links l
    where l.draft_lead_pending_user_id = v_pending_id
      and l.organiser_pending_user_id is not null
      and l.is_active = true
      and (l.end_date is null or l.end_date >= current_date)
    on conflict do nothing;

    -- Soft-close all processed draft links
    update draft_lead_organiser_links
      set is_active = false, end_date = current_date
      where draft_lead_pending_user_id = v_pending_id and is_active = true and (end_date is null or end_date >= current_date);
  end if;
end;
$$;


