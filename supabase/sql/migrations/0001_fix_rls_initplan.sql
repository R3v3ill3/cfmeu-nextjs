-- Purpose: Fix RLS initplan regressions by wrapping auth.*() and current_setting() calls
--           inside scalar subselects per Supabase guidance.
-- Safe behavior: Only changes USING / WITH CHECK expressions when they contain the
--                targeted function patterns. No change to TO roles or policy commands.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

do $$
declare
	rec record;
	new_using text;
	new_check text;
	changed boolean;
begin
	for rec in (
		select
			n.nspname as schema_name,
			rel.relname as table_name,
			pol.polname as policy_name,
			pol.polcmd as policy_cmd,
			pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
			pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
		from pg_policy pol
		join pg_class rel on rel.oid = pol.polrelid
		join pg_namespace n on n.oid = rel.relnamespace
		where n.nspname = 'public'
			and (
				pg_get_expr(pol.polqual, pol.polrelid) ilike '%auth.%()%' or
				pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%auth.%()%' or
				pg_get_expr(pol.polqual, pol.polrelid) ilike '%current_setting(%' or
				pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%current_setting(%'
			)
	) loop
		changed := false;

		new_using := rec.using_expr;
		if new_using is not null then
			-- Wrap common auth.*() calls and current_setting() with scalar subselects
			new_using := regexp_replace(new_using, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
			new_using := regexp_replace(new_using, '\bauth\.role\(\)', '(select auth.role())', 'gi');
			new_using := regexp_replace(new_using, '\bauth\.email\(\)', '(select auth.email())', 'gi');
			new_using := regexp_replace(new_using, '\bcurrent_setting\s*\(', '(select current_setting(', 'gi');
			if new_using is distinct from rec.using_expr then
				changed := true;
			end if;
		end if;

		new_check := rec.check_expr;
		if new_check is not null then
			new_check := regexp_replace(new_check, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
			new_check := regexp_replace(new_check, '\bauth\.role\(\)', '(select auth.role())', 'gi');
			new_check := regexp_replace(new_check, '\bauth\.email\(\)', '(select auth.email())', 'gi');
			new_check := regexp_replace(new_check, '\bcurrent_setting\s*\(', '(select current_setting(', 'gi');
			if new_check is distinct from rec.check_expr then
				changed := true;
			end if;
		end if;

		if changed then
			raise notice 'Altering policy %.% on %.%', rec.policy_name, rec.policy_cmd, rec.schema_name, rec.table_name;
			if new_check is null then
				execute format(
					'alter policy %I on %I.%I using (%s);',
					rec.policy_name, rec.schema_name, rec.table_name, new_using
				);
			else
				execute format(
					'alter policy %I on %I.%I using (%s) with check (%s);',
					rec.policy_name, rec.schema_name, rec.table_name, new_using, new_check
				);
			end if;
		end if;
	end loop;
end $$;

