-- Purpose: Restrict broad policies (no TO clause) that reference auth.uid() to authenticated users only.
-- Rationale: Policies without TO apply to all roles (including anon, authenticator, dashboard_user),
--            which leads to multiple permissive SELECT warnings and unintended exposure.
--            If a policy references auth.uid(), it implicitly targets authenticated users.

DO $$
DECLARE
    rec RECORD;
    using_expr TEXT;
    check_expr TEXT;
    action_sql TEXT;
BEGIN
    FOR rec IN (
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name,
            p.polname AS policy_name,
            p.polcmd  AS action, -- r=select, a=all, w=update, d=delete
            pg_get_expr(p.polqual, p.polrelid) AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND p.polroles IS NULL -- no explicit TO roles => all roles
          AND p.polcmd <> 'a'    -- 'ALL' handled in separate migration
          AND (
            pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.uid()%' OR
            pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%auth.uid()%'
          )
    ) LOOP
        using_expr := rec.using_expr;
        check_expr := rec.check_expr;

        -- Form action
        action_sql := CASE rec.action
            WHEN 'r' THEN 'FOR SELECT'
            WHEN 'w' THEN 'FOR UPDATE'
            WHEN 'd' THEN 'FOR DELETE'
            ELSE NULL
        END;

        IF action_sql IS NULL THEN
            CONTINUE;
        END IF;

        RAISE NOTICE 'Restricting policy % on %.% to authenticated', rec.policy_name, rec.schema_name, rec.table_name;

        -- Drop and recreate with TO authenticated
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', rec.policy_name, rec.schema_name, rec.table_name);

        IF rec.action = 'r' THEN
            -- SELECT policies use USING only
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I %s TO authenticated USING (%s);',
                rec.policy_name, rec.schema_name, rec.table_name, action_sql, using_expr
            );
        ELSIF rec.action = 'w' THEN
            -- UPDATE policies use USING and WITH CHECK
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I %s TO authenticated USING (%s) WITH CHECK (%s);',
                rec.policy_name, rec.schema_name, rec.table_name, action_sql, COALESCE(using_expr, 'true'), COALESCE(check_expr, using_expr, 'true')
            );
        ELSIF rec.action = 'd' THEN
            -- DELETE policies use USING only
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I %s TO authenticated USING (%s);',
                rec.policy_name, rec.schema_name, rec.table_name, action_sql, COALESCE(using_expr, 'true')
            );
        END IF;
    END LOOP;
END $$;