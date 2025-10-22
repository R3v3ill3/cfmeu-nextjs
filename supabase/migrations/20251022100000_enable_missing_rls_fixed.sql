-- ============================================================================
-- Migration: Enable RLS on 11 Missing Tables (FIXED - Shorter Policy Names)
-- ============================================================================
-- This migration enables Row Level Security on tables that were missing it
-- and creates appropriate policies with names under 63 characters.

-- ============================================================================
-- 1. REFERENCE/LOOKUP TABLES (Read-only for authenticated, service role can modify)
-- ============================================================================

-- contractor_role_types
ALTER TABLE contractor_role_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_contractor_roles" ON contractor_role_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_all_contractor_roles" ON contractor_role_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trade_types
ALTER TABLE trade_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_trade_types" ON trade_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_all_trade_types" ON trade_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. EMPLOYER-RELATED TABLES (Full CRUD for authenticated users)
-- ============================================================================

-- employer_aliases
ALTER TABLE employer_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_employer_aliases" ON employer_aliases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_employer_aliases" ON employer_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_employer_aliases" ON employer_aliases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- employer_capabilities
ALTER TABLE employer_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_emp_capabilities" ON employer_capabilities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_emp_capabilities" ON employer_capabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_emp_capabilities" ON employer_capabilities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_delete_emp_capabilities" ON employer_capabilities
  FOR DELETE
  TO authenticated
  USING (true);

-- employer_compliance_checks
ALTER TABLE employer_compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_emp_compliance" ON employer_compliance_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_emp_compliance" ON employer_compliance_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_emp_compliance" ON employer_compliance_checks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. PROJECT-RELATED TABLES (Full CRUD for authenticated users)
-- ============================================================================

-- project_assignments
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_proj_assignments" ON project_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_proj_assignments" ON project_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_proj_assignments" ON project_assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_delete_proj_assignments" ON project_assignments
  FOR DELETE
  TO authenticated
  USING (true);

-- project_compliance
ALTER TABLE project_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_proj_compliance" ON project_compliance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_proj_compliance" ON project_compliance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_proj_compliance" ON project_compliance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- project_trade_availability
ALTER TABLE project_trade_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_proj_trade_avail" ON project_trade_availability
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_proj_trade_avail" ON project_trade_availability
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_proj_trade_avail" ON project_trade_availability
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_delete_proj_trade_avail" ON project_trade_availability
  FOR DELETE
  TO authenticated
  USING (true);

-- compliance_alerts
ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_compliance_alerts" ON compliance_alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_compliance_alerts" ON compliance_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_compliance_alerts" ON compliance_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. AUDIT/BACKUP TABLES (Read for authenticated, write restricted to service_role)
-- ============================================================================

-- organising_universe_change_log
ALTER TABLE organising_universe_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_org_universe_log" ON organising_universe_change_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_insert_org_universe_log" ON organising_universe_change_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- projects_organising_universe_backup
ALTER TABLE projects_organising_universe_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_proj_org_backup" ON projects_organising_universe_backup
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_all_proj_org_backup" ON projects_organising_universe_backup
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- - 11 tables now have RLS enabled
-- - Reference tables (2): contractor_role_types, trade_types
-- - Employer tables (3): employer_aliases, employer_capabilities, employer_compliance_checks
-- - Project tables (4): project_assignments, project_compliance, project_trade_availability, compliance_alerts
-- - Audit tables (2): organising_universe_change_log, projects_organising_universe_backup
--
-- Security model:
-- - All authenticated users can read most tables
-- - Authenticated users can write to operational tables
-- - Audit/backup tables restricted to service_role for writes
-- - Reference tables restricted to service_role for modifications
-- - All policy names under 63 characters (PostgreSQL limit)
-- ============================================================================
