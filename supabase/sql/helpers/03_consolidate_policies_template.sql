-- Template: Consolidate multiple permissive policies into one per (table, role, action)
-- Usage: Customize TABLE_NAME, ROLE_NAME, ACTION and conditions; run in Supabase SQL Editor

-- Example for SELECT on public.activity_delegations to role authenticated
-- 1) Inspect current policies
--    select pol.polname, pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid) as using_expr
--    from pg_policy pol join pg_class c on c.oid = pol.polrelid
--    join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname='public' and c.relname='activity_delegations' and pol.polcmd='r';

-- 2) Drop old permissive policies (replace names accordingly)
-- drop policy if exists "Admins and organisers can manage activity delegations" on public.activity_delegations;
-- drop policy if exists "Authenticated users can view activity delegations" on public.activity_delegations;

-- 3) Create a single permissive policy that OR's prior conditions
-- create policy "activity_delegations_select_authenticated"
-- on public.activity_delegations
-- for select
-- to authenticated
-- using (
--   (/* condition from A, after initplan fix */) OR
--   (/* condition from B, after initplan fix */)
-- );

-- Optional: add restrictive policies only where required
-- create policy "activity_delegations_select_restrictive"
-- as restrictive
-- on public.activity_delegations
-- for select
-- to authenticated
-- using (/* narrow gating condition */);

