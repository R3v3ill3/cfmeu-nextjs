## Supabase SQL: One-PR cleanup for linter findings

This folder contains a single PR worth of SQL changes and helpers that address:

- RLS initplan inefficiencies (auth.* and current_setting calls)
- Multiple permissive policies per table/role/action
- Unindexed foreign keys (helper to generate CREATE INDEX DDL)
- Unused indexes (helper to generate DROP INDEX DDL)

### Order of operations

1) Run migration `migrations/0001_fix_rls_initplan.sql`.
   - This automatically alters policies in `public` to wrap auth.*() and current_setting() calls with scalar subselects.

2) Consolidate permissive policies as needed using `helpers/03_consolidate_policies_template.sql`.
   - Edit the template per table to merge duplicate SELECT/INSERT/UPDATE/DELETE policies.
   - Keep one permissive policy per (table, role, action). Use restrictive policies where required.

3) Create missing FK indexes.
   - In Supabase SQL Editor, run `helpers/01_generate_fk_index_ddl.sql` to output `CREATE INDEX CONCURRENTLY` statements.
   - Review and execute the generated statements in batches during low traffic.

4) Drop truly unused indexes.
   - In Supabase SQL Editor, run `helpers/02_drop_unused_indexes.sql` to list `DROP INDEX CONCURRENTLY` statements for zero-scan indexes.
   - Review carefully (exclude PK/unique; consider rare but critical queries) then execute as appropriate.

Notes:
- Steps 3 and 4 can be executed before or after the PR; they are independent. Prefer after deploying step 1/2 so stats reflect current policy behavior.
- `CONCURRENTLY` statements cannot be wrapped in a transaction block.

