-- NEW FOUNDATION: flexible roles + multiple trades per employer per project

-- Reference tables
CREATE TABLE IF NOT EXISTS trade_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text not null,
  description text,
  sort_order int default 999,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS contractor_role_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text not null,           -- 'senior' | 'specialist' | 'support'
  hierarchy_level int default 999,  -- 1 highest
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Employer capabilities (global abilities)
CREATE TABLE IF NOT EXISTS employer_capabilities (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references employers(id) on delete cascade,
  capability_type text not null check (capability_type in ('trade','contractor_role')),
  trade_type_id uuid references trade_types(id) on delete cascade,
  contractor_role_type_id uuid references contractor_role_types(id) on delete cascade,
  proficiency_level text check (proficiency_level in ('basic','intermediate','advanced','expert')) default 'intermediate',
  is_primary boolean default false,
  years_experience int,
  certification_details jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint check_capability_fields check (
    (capability_type='trade' and trade_type_id is not null and contractor_role_type_id is null) or
    (capability_type='contractor_role' and contractor_role_type_id is not null and trade_type_id is null)
  )
);

-- Assignments per project (supports many roles + many trades)
CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  employer_id uuid not null references employers(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('contractor_role','trade_work')),
  contractor_role_type_id uuid references contractor_role_types(id) on delete cascade,
  is_primary_for_role boolean default false,
  trade_type_id uuid references trade_types(id) on delete cascade,
  estimated_workers int check (estimated_workers >= 0),
  actual_workers int check (actual_workers >= 0),
  start_date date,
  end_date date,
  status text default 'active' check (status in ('planned','active','completed','cancelled','on_hold')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint check_assignment_fields check (
    (assignment_type='contractor_role' and contractor_role_type_id is not null and trade_type_id is null) or
    (assignment_type='trade_work' and trade_type_id is not null and contractor_role_type_id is null)
  ),
  constraint check_dates_ok check (end_date is null or end_date >= start_date)
);

-- Seed contractor roles (expand later)
INSERT INTO contractor_role_types (code, name, category, hierarchy_level) VALUES
('builder','Builder / Main Contractor','senior',1),
('building_contractor','Building Contractor','senior',2),
('construction_manager','Construction Manager','senior',2),
('managing_contractor','Managing Contractor','senior',2),
('contractor','Contractor','general',3),
('fitout_contractor','Fitout Contractor','specialist',4),
('piling_foundation_contractor','Piling & Foundation Contractor','specialist',4),
('road_work_contractor','Road Work Contractor','specialist',3),
('superstructure_contractor','Superstructure Contractor','specialist',4),
('turnkey_contractor','Turnkey Contractor','senior',1)
ON CONFLICT (code) DO NOTHING;

-- Seed core trades (expand later)
INSERT INTO trade_types (code,name,category,sort_order) VALUES
('general_construction','General Construction','construction',1),
('electrical','Electrical','services',10),
('plumbing','Plumbing','services',11),
('mechanical_services','Mechanical Services','services',12),
('concrete','Concrete & Concreting','construction',2),
('structural_steel','Structural Steel','construction',3),
('carpentry','Carpentry & Joinery','construction',4),
('facade','Facade & Cladding','specialist',21),
('roofing','Roofing','specialist',20),
('earthworks','Earthworks','civil',30),
('piling','Piling','civil',32)
ON CONFLICT (code) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pa_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pa_employer ON project_assignments(employer_id);
CREATE INDEX IF NOT EXISTS idx_pa_type ON project_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_pa_role ON project_assignments(contractor_role_type_id) WHERE contractor_role_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pa_trade ON project_assignments(trade_type_id) WHERE trade_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cap_employer ON employer_capabilities(employer_id);
CREATE INDEX IF NOT EXISTS idx_cap_trade ON employer_capabilities(trade_type_id) WHERE trade_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cap_role ON employer_capabilities(contractor_role_type_id) WHERE contractor_role_type_id IS NOT NULL;

-- Update triggers
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cap_updated BEFORE UPDATE ON employer_capabilities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_pa_updated  BEFORE UPDATE ON project_assignments     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RPCs for imports
CREATE OR REPLACE FUNCTION assign_contractor_role(
  p_project_id uuid,
  p_employer_id uuid,
  p_role_code text,
  p_company_name text,
  p_is_primary boolean default false,
  p_estimated_workers int default null
) RETURNS TABLE(success boolean, message text) AS $$
DECLARE role_id uuid;
BEGIN
  SELECT id INTO role_id FROM contractor_role_types WHERE code=p_role_code AND is_active=true;
  IF role_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid contractor role: %s', p_role_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND contractor_role_type_id=role_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned as %s', p_company_name, p_role_code); RETURN;
  END IF;

  INSERT INTO project_assignments(project_id,employer_id,assignment_type,contractor_role_type_id,is_primary_for_role,estimated_workers)
  VALUES (p_project_id,p_employer_id,'contractor_role',role_id,p_is_primary,p_estimated_workers);

  RETURN QUERY SELECT true, format('Assigned %s as %s', p_company_name, p_role_code);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_trade_work(
  p_project_id uuid,
  p_employer_id uuid,
  p_trade_code text,
  p_company_name text,
  p_estimated_workers int default null
) RETURNS TABLE(success boolean, message text) AS $$
DECLARE trade_id uuid;
BEGIN
  SELECT id INTO trade_id FROM trade_types WHERE code=p_trade_code AND is_active=true;
  IF trade_id IS NULL THEN RETURN QUERY SELECT false, format('Invalid trade type: %s', p_trade_code); RETURN; END IF;

  IF EXISTS (SELECT 1 FROM project_assignments
             WHERE project_id=p_project_id AND employer_id=p_employer_id AND trade_type_id=trade_id) THEN
    RETURN QUERY SELECT true, format('%s already assigned to %s trade', p_company_name, p_trade_code); RETURN;
  END IF;

  INSERT INTO project_assignments(project_id,employer_id,assignment_type,trade_type_id,estimated_workers)
  VALUES (p_project_id,p_employer_id,'trade_work',trade_id,p_estimated_workers);

  RETURN QUERY SELECT true, format('Assigned %s to %s trade', p_company_name, p_trade_code);
END; $$ LANGUAGE plpgsql;

-- Compatibility wrappers for existing code paths
CREATE OR REPLACE FUNCTION assign_bci_builder(p_project_id uuid, p_employer_id uuid, p_company_name text)
RETURNS TABLE(success boolean, message text) AS $$
BEGIN
  RETURN QUERY SELECT * FROM assign_contractor_role(p_project_id, p_employer_id, 'builder', p_company_name, true);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_contractor_trade(p_project_id uuid, p_employer_id uuid, p_trade_type text, p_company_name text)
RETURNS TABLE(success boolean, message text) AS $$
BEGIN
  RETURN QUERY SELECT * FROM assign_trade_work(p_project_id, p_employer_id, p_trade_type, p_company_name);
END; $$ LANGUAGE plpgsql;

-- Helpful view
CREATE OR REPLACE VIEW project_assignments_detailed AS
SELECT 
  pa.id, pa.project_id, p.name AS project_name,
  pa.employer_id, e.name AS employer_name,
  pa.assignment_type,
  crt.code AS contractor_role_code, crt.name AS contractor_role_name, crt.category AS contractor_role_category, pa.is_primary_for_role,
  tt.code  AS trade_code,  tt.name  AS trade_name,  tt.category  AS trade_category,
  pa.estimated_workers, pa.actual_workers, pa.status, pa.start_date, pa.end_date, pa.notes,
  pa.created_at, pa.updated_at
FROM project_assignments pa
JOIN projects p  ON p.id = pa.project_id
JOIN employers e ON e.id = pa.employer_id
LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
LEFT JOIN trade_types tt ON tt.id = pa.trade_type_id;

-- Partial unique indexes (Postgres requires these as indexes, not inline)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cap_employer_trade
  ON employer_capabilities (employer_id, trade_type_id)
  WHERE trade_type_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cap_employer_role
  ON employer_capabilities (employer_id, contractor_role_type_id)
  WHERE contractor_role_type_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pa_role
  ON project_assignments (project_id, employer_id, contractor_role_type_id)
  WHERE contractor_role_type_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pa_trade
  ON project_assignments (project_id, employer_id, trade_type_id)
  WHERE trade_type_id IS NOT NULL;
