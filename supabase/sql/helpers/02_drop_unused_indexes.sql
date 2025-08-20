-- Helper: Report DROP INDEX statements for indexes with zero scans
-- Usage: Run in Supabase SQL Editor, review output; consider executing during low traffic
-- Excludes primary/unique indexes. Validate business-critical but rarely-used indexes before dropping.

select format(
  'drop index concurrently if exists %I.%I;',
  s.schemaname,
  s.indexrelname
) as drop_index_sql,
  s.schemaname,
  s.relname as table_name,
  s.indexrelname as index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where s.idx_scan = 0
  and not i.indisprimary
  and not i.indisunique
order by pg_relation_size(s.indexrelid) desc;

