-- Helper: Generate CREATE INDEX statements for foreign keys lacking a covering index
-- Usage: Run in Supabase SQL Editor, copy output, review, then execute
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
-- Note: Excludes Supabase-managed and system schemas to avoid ownership errors

with fks as (
  select
    con.oid as constraint_oid,
    n.nspname  as schema_name,
    c.relname  as table_name,
    con.conname as constraint_name,
    con.conkey  as key_attnums,
    array_agg(quote_ident(a.attname) order by k.ordinality) as key_attnames
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join unnest(con.conkey) with ordinality as k(attnum, ordinality) on true
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
  where con.contype = 'f'
    and n.nspname not in (
      'pg_catalog',
      'information_schema',
      'pg_toast',
      'extensions',
      'auth',
      'storage',
      'graphql_public',
      'realtime',
      'supabase_functions',
      'supabase_migrations'
    )
    and n.nspname not like 'pg_%'
    and pg_has_role(current_user, c.relowner, 'USAGE')
  group by con.oid, n.nspname, c.relname, con.conname, con.conkey
),
indexed as (
  select
    f.*,
    exists (
      select 1
      from pg_indexes i
      where i.schemaname = f.schema_name
        and i.tablename  = f.table_name
        and (
          -- naive cover check: all fk columns appear in indexdef and in order
          -- good enough for most practical cases
          i.indexdef ilike '%' || array_to_string(f.key_attnames, '%') || '%'
        )
    ) as has_covering_index
  from fks f
)
select format(
  'create index concurrently if not exists %I on %I.%I (%s);',
  'fki_'||constraint_name,
  schema_name,
  table_name,
  array_to_string(key_attnames, ', ')
) as create_index_sql
from indexed
where not has_covering_index
order by schema_name, table_name;

