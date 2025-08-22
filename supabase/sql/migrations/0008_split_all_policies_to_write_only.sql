-- Purpose: Reduce duplicate permissive SELECT policies by removing SELECT from broad "FOR ALL" policies.
-- Strategy: For each policy in schema public with polcmd = 'a' (ALL), drop it and create three policies
--           for INSERT, UPDATE, DELETE with identical role targets and expressions. This preserves
--           write permissions while leaving read (SELECT) to dedicated view policies.
-- Caveat: This assumes a separate SELECT policy exists. Review after migration for any tables lacking
--         an explicit SELECT policy and add one if needed.

DO $$
DECLARE
    rec RECORD;
    role_list TEXT;
    using_expr TEXT;
    check_expr TEXT;
    ins_name TEXT;
    upd_name TEXT;
    del_name TEXT;
BEGIN
    FOR rec IN (
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name,
            p.polname AS policy_name,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
            p.polrelid,
            p.polroles
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND p.polcmd = 'a' -- FOR ALL
    ) LOOP
        -- Build role list (TO ...)
        role_list := NULL;
        IF rec.polroles IS NOT NULL THEN
            SELECT string_agg(format('%I', r.rolname), ', ' ORDER BY r.rolname)
            INTO role_list
            FROM pg_roles r
            WHERE r.oid = ANY (rec.polroles);
        END IF;

        using_expr := COALESCE(rec.using_expr, 'true');
        check_expr := COALESCE(rec.check_expr, rec.using_expr, 'true');

        ins_name := rec.policy_name || '_ins';
        upd_name := rec.policy_name || '_upd';
        del_name := rec.policy_name || '_del';

        RAISE NOTICE 'Rewriting policy % on %.% (FOR ALL -> write-only)', rec.policy_name, rec.schema_name, rec.table_name;

        -- Drop original policy and any previously-created split variants
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', rec.policy_name, rec.schema_name, rec.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', ins_name, rec.schema_name, rec.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', upd_name, rec.schema_name, rec.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', del_name, rec.schema_name, rec.table_name);

        -- INSERT policy
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I FOR INSERT %s WITH CHECK (%s);',
            ins_name,
            rec.schema_name, rec.table_name,
            COALESCE(CASE WHEN role_list IS NOT NULL THEN 'TO ' || role_list ELSE NULL END, ''),
            check_expr
        );

        -- UPDATE policy
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I FOR UPDATE %s USING (%s) WITH CHECK (%s);',
            upd_name,
            rec.schema_name, rec.table_name,
            COALESCE(CASE WHEN role_list IS NOT NULL THEN 'TO ' || role_list ELSE NULL END, ''),
            using_expr,
            check_expr
        );

        -- DELETE policy
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I FOR DELETE %s USING (%s);',
            del_name,
            rec.schema_name, rec.table_name,
            COALESCE(CASE WHEN role_list IS NOT NULL THEN 'TO ' || role_list ELSE NULL END, ''),
            using_expr
        );
    END LOOP;
END $$;