-- Purpose: Re-apply RLS initplan fix after other policy-creating migrations.
--          Wrap auth.*() and current_setting() calls inside scalar subselects per Supabase guidance.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DO $$
DECLARE
    rec RECORD;
    new_using TEXT;
    new_check TEXT;
    changed BOOLEAN;
BEGIN
    FOR rec IN (
        SELECT
            n.nspname AS schema_name,
            rel.relname AS table_name,
            pol.polname AS policy_name,
            pol.polcmd AS policy_cmd,
            pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
        FROM pg_policy pol
        JOIN pg_class rel ON rel.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        WHERE n.nspname = 'public'
          AND (
            pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%auth.%()%' OR
            pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%auth.%()%' OR
            pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%current_setting(%' OR
            pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%current_setting(%'
          )
    ) LOOP
        changed := FALSE;

        new_using := rec.using_expr;
        IF new_using IS NOT NULL THEN
            new_using := regexp_replace(new_using, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
            new_using := regexp_replace(new_using, '\bauth\.role\(\)', '(select auth.role())', 'gi');
            new_using := regexp_replace(new_using, '\bauth\.email\(\)', '(select auth.email())', 'gi');
            new_using := regexp_replace(new_using, '\bcurrent_setting\s*\(', '(select current_setting(', 'gi');
            IF new_using IS DISTINCT FROM rec.using_expr THEN
                changed := TRUE;
            END IF;
        END IF;

        new_check := rec.check_expr;
        IF new_check IS NOT NULL THEN
            new_check := regexp_replace(new_check, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
            new_check := regexp_replace(new_check, '\bauth\.role\(\)', '(select auth.role())', 'gi');
            new_check := regexp_replace(new_check, '\bauth\.email\(\)', '(select auth.email())', 'gi');
            new_check := regexp_replace(new_check, '\bcurrent_setting\s*\(', '(select current_setting(', 'gi');
            IF new_check IS DISTINCT FROM rec.check_expr THEN
                changed := TRUE;
            END IF;
        END IF;

        IF changed THEN
            RAISE NOTICE 'Altering policy %.% on %.%', rec.policy_name, rec.policy_cmd, rec.schema_name, rec.table_name;
            IF new_check IS NULL THEN
                EXECUTE format(
                    'ALTER POLICY %I ON %I.%I USING (%s);',
                    rec.policy_name, rec.schema_name, rec.table_name, new_using
                );
            ELSE
                EXECUTE format(
                    'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s);',
                    rec.policy_name, rec.schema_name, rec.table_name, new_using, new_check
                );
            END IF;
        END IF;
    END LOOP;
END $$;