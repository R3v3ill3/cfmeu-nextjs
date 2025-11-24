-- Weekly Dashboard Snapshot System
-- Tracks historical dashboard metrics with frozen configuration state
-- This allows historical comparisons even when organiser/patch assignments or key contractor lists change

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('weekly', 'monthly')),
  
  -- Snapshot metadata (frozen state at snapshot time)
  key_contractor_trades JSONB NOT NULL, -- Array of trade types at snapshot time
  key_contractor_roles JSONB NOT NULL, -- Array of role codes at snapshot time
  
  -- Coverage metrics
  total_projects INTEGER NOT NULL DEFAULT 0,
  unknown_builders INTEGER NOT NULL DEFAULT 0,
  known_builders INTEGER NOT NULL DEFAULT 0,
  eba_builders INTEGER NOT NULL DEFAULT 0,
  total_contractor_slots INTEGER NOT NULL DEFAULT 0,
  unidentified_slots INTEGER NOT NULL DEFAULT 0,
  identified_contractors INTEGER NOT NULL DEFAULT 0,
  eba_contractors INTEGER NOT NULL DEFAULT 0,
  
  -- Patch/organiser context (for historical queries)
  patch_assignments JSONB, -- Snapshot of patch assignments: {patch_id: [organiser_ids], ...}
  organiser_assignments JSONB, -- Snapshot of organiser assignments: {organiser_id: [patch_ids], ...}
  
  -- Additional metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_date 
  ON dashboard_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_type_date 
  ON dashboard_snapshots(snapshot_type, snapshot_date DESC);

-- Unique constraint: one snapshot per date per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_snapshots_unique 
  ON dashboard_snapshots(snapshot_date, snapshot_type);

-- Enable RLS
ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone authenticated can read snapshots
CREATE POLICY "Anyone can view dashboard snapshots"
  ON dashboard_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policy: Only service role can create snapshots (for background jobs)
CREATE POLICY "Service role can create snapshots"
  ON dashboard_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Function to create a weekly snapshot
CREATE OR REPLACE FUNCTION create_dashboard_snapshot(
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_snapshot_type TEXT DEFAULT 'weekly'
)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_key_trades JSONB;
  v_key_roles JSONB := '["head_contractor", "builder"]'::JSONB;
  v_total_projects INTEGER;
  v_unknown_builders INTEGER;
  v_known_builders INTEGER;
  v_eba_builders INTEGER;
  v_total_slots INTEGER;
  v_unidentified_slots INTEGER;
  v_identified_contractors INTEGER;
  v_eba_contractors INTEGER;
  v_patch_assignments JSONB;
  v_organiser_assignments JSONB;
  v_key_trades_count INTEGER;
  v_key_roles_count INTEGER := 2; -- head_contractor, builder
BEGIN
  -- Get current key contractor trades as JSONB array
  SELECT jsonb_agg(trade_type ORDER BY display_order)
  INTO v_key_trades
  FROM key_contractor_trades
  WHERE is_active = true;
  
  -- Get key trades count for slot calculation
  SELECT COUNT(*) INTO v_key_trades_count
  FROM key_contractor_trades
  WHERE is_active = true;
  
  -- Calculate current metrics using existing function
  WITH metrics AS (
    SELECT 
      total_active_projects,
      known_builder_count,
      eba_projects_count,
      mapped_key_contractors,
      total_key_contractor_slots,
      key_contractors_with_eba
    FROM calculate_organizing_universe_metrics(
      p_patch_ids := NULL,
      p_tier := NULL,
      p_stage := NULL,
      p_universe := 'active',
      p_eba_filter := NULL,
      p_user_id := NULL,
      p_user_role := 'admin'
    )
  )
  SELECT 
    m.total_active_projects,
    m.total_active_projects - m.known_builder_count, -- unknown builders
    m.known_builder_count,
    m.eba_projects_count,
    m.total_key_contractor_slots,
    m.total_key_contractor_slots - m.mapped_key_contractors, -- unidentified slots
    m.mapped_key_contractors,
    m.key_contractors_with_eba
  INTO 
    v_total_projects,
    v_unknown_builders,
    v_known_builders,
    v_eba_builders,
    v_total_slots,
    v_unidentified_slots,
    v_identified_contractors,
    v_eba_contractors
  FROM metrics m;
  
  -- Capture current patch assignments
  SELECT jsonb_object_agg(
    patch_id::TEXT,
    (
      SELECT jsonb_agg(organiser_id::TEXT)
      FROM organiser_patch_assignments opa2
      WHERE opa2.patch_id = opa1.patch_id
        AND opa2.effective_to IS NULL
    )
  )
  INTO v_patch_assignments
  FROM (
    SELECT DISTINCT patch_id
    FROM organiser_patch_assignments
    WHERE effective_to IS NULL
  ) opa1;
  
  -- Capture current organiser assignments
  SELECT jsonb_object_agg(
    organiser_id::TEXT,
    (
      SELECT jsonb_agg(patch_id::TEXT)
      FROM organiser_patch_assignments opa2
      WHERE opa2.organiser_id = opa1.organiser_id
        AND opa2.effective_to IS NULL
    )
  )
  INTO v_organiser_assignments
  FROM (
    SELECT DISTINCT organiser_id
    FROM organiser_patch_assignments
    WHERE effective_to IS NULL
  ) opa1;
  
  -- Insert snapshot
  INSERT INTO dashboard_snapshots (
    snapshot_date,
    snapshot_type,
    key_contractor_trades,
    key_contractor_roles,
    total_projects,
    unknown_builders,
    known_builders,
    eba_builders,
    total_contractor_slots,
    unidentified_slots,
    identified_contractors,
    eba_contractors,
    patch_assignments,
    organiser_assignments
  ) VALUES (
    p_snapshot_date,
    p_snapshot_type,
    COALESCE(v_key_trades, '[]'::JSONB),
    v_key_roles,
    COALESCE(v_total_projects, 0),
    COALESCE(v_unknown_builders, 0),
    COALESCE(v_known_builders, 0),
    COALESCE(v_eba_builders, 0),
    COALESCE(v_total_slots, 0),
    COALESCE(v_unidentified_slots, 0),
    COALESCE(v_identified_contractors, 0),
    COALESCE(v_eba_contractors, 0),
    COALESCE(v_patch_assignments, '{}'::JSONB),
    COALESCE(v_organiser_assignments, '{}'::JSONB)
  )
  ON CONFLICT (snapshot_date, snapshot_type) 
  DO UPDATE SET
    key_contractor_trades = EXCLUDED.key_contractor_trades,
    key_contractor_roles = EXCLUDED.key_contractor_roles,
    total_projects = EXCLUDED.total_projects,
    unknown_builders = EXCLUDED.unknown_builders,
    known_builders = EXCLUDED.known_builders,
    eba_builders = EXCLUDED.eba_builders,
    total_contractor_slots = EXCLUDED.total_contractor_slots,
    unidentified_slots = EXCLUDED.unidentified_slots,
    identified_contractors = EXCLUDED.identified_contractors,
    eba_contractors = EXCLUDED.eba_contractors,
    patch_assignments = EXCLUDED.patch_assignments,
    organiser_assignments = EXCLUDED.organiser_assignments,
    created_at = NOW()
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_dashboard_snapshot TO authenticated, service_role;

COMMENT ON TABLE dashboard_snapshots IS 'Weekly/monthly snapshots of dashboard metrics with frozen configuration state for historical comparisons';
COMMENT ON FUNCTION create_dashboard_snapshot IS 'Creates a snapshot of current dashboard metrics with frozen key contractor list and patch assignments';






