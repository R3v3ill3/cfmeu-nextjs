-- Helper: List public tables that currently have no explicit SELECT (FOR SELECT) policy
-- Usage: Run in Supabase SQL Editor to identify tables needing read policies

WITH tables AS (
  SELECT c.oid AS relid, n.nspname AS schema_name, c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
select_policies AS (
  SELECT polrelid
  FROM pg_policy
  WHERE polcmd = 'r'
)
SELECT t.schema_name, t.table_name
FROM tables t
LEFT JOIN select_policies sp ON sp.polrelid = t.relid
WHERE sp.polrelid IS NULL
ORDER BY t.schema_name, t.table_name;