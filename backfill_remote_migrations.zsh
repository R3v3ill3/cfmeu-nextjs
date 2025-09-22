set -e
mkdir -p supabase/migrations
VERSIONS=(20250918072812 20250918073046 20250918073655 20250918073926 20250918074716)

ptype=$(psql "$DSN" -X -At -c "SELECT CASE WHEN pg_typeof(statements)::text IN ('jsonb','json') THEN 'json' ELSE 'text' END FROM supabase_migrations.schema_migrations LIMIT 1")

for v in $VERSIONS; do
  name=$(psql "$DSN" -X -At -c "SELECT name FROM supabase_migrations.schema_migrations WHERE version='${v}'")
  [[ -z "$name" ]] && { echo "Version ${v} not found"; exit 1; }

  if [[ "$ptype" == "json" ]]; then
    sql=$(psql "$DSN" -X -At -c "
      SELECT string_agg(elem, E'\n\n' ORDER BY ord)
      FROM supabase_migrations.schema_migrations m,
           LATERAL jsonb_array_elements_text(m.statements) WITH ORDINALITY AS t(elem, ord)
      WHERE m.version='${v}'
    ")
  else
    sql=$(psql "$DSN" -X -At -c "
      SELECT array_to_string(statements, E'\n\n')
      FROM supabase_migrations.schema_migrations
      WHERE version='${v}'
    ")
  fi

  [[ -z "$sql" ]] && { echo "Empty SQL for ${v}"; exit 1; }

  out="supabase/migrations/${v}_${name}.sql"
  printf "%s" "$sql" > "$out"
  echo "Wrote $out"
done
