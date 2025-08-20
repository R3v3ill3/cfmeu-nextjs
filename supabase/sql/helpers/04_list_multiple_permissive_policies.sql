-- Helper: List tables that have multiple permissive policies per (table, role, action)
-- Usage: Run in Supabase SQL Editor to identify consolidation targets

with policies as (
  select
    n.nspname  as schema_name,
    c.relname  as table_name,
    pol.polname as policy_name,
    pol.polcmd  as action, -- r=select, a=insert, w=update, d=delete
    pol.polroles as role_oids,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
expanded as (
  select
    schema_name,
    table_name,
    policy_name,
    action,
    (select string_agg(rol.rolname, ',') from pg_roles rol where rol.oid = any(role_oids)) as roles,
    using_expr,
    check_expr
  from policies
)
select schema_name,
       table_name,
       action,
       roles,
       count(*) as policy_count,
       string_agg(policy_name, ', ' order by policy_name) as policy_names
from expanded
group by schema_name, table_name, action, roles
having count(*) > 1
order by schema_name, table_name, action;

