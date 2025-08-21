-- Helper: apply any pending user role on login
-- This is a no-op if nothing is pending.
create or replace function apply_pending_user_on_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
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
  select role into v_role
  from pending_users
  where lower(email) = lower(v_email)
  order by invited_at desc nulls last, created_at desc
  limit 1;

  if v_role is null then
    return;
  end if;

  update profiles set role = v_role where id = auth.uid();
  -- Do not delete pending row to preserve audit; leave as-is
end;
$$;

