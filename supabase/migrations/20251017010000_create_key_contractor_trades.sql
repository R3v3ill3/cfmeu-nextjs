-- Create key_contractor_trades table for dynamic management of key trades
-- This replaces 15+ hard-coded instances across the codebase with a single source of truth

-- Create the table
CREATE TABLE IF NOT EXISTS key_contractor_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type trade_type NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Unique constraint: Only one active entry per trade_type
-- (Cannot be DEFERRABLE because we use ON CONFLICT in INSERT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_contractor_trades_unique_active_trade
  ON key_contractor_trades(trade_type)
  WHERE is_active = true;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_key_contractor_trades_active 
  ON key_contractor_trades(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_key_contractor_trades_order 
  ON key_contractor_trades(display_order, trade_type) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE key_contractor_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read key trades
CREATE POLICY "Anyone can view key contractor trades"
  ON key_contractor_trades 
  FOR SELECT
  USING (true);

-- RLS Policy: Only admin can modify (insert, update, delete)
CREATE POLICY "Only admin can manage key trades"
  ON key_contractor_trades 
  FOR ALL
  USING (
    get_user_role(auth.uid()) = 'admin'
  );

-- Function to validate key trades count constraints
CREATE OR REPLACE FUNCTION validate_key_trades_count()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Count active key trades after the operation
  SELECT COUNT(*) INTO active_count
  FROM key_contractor_trades
  WHERE is_active = true;
  
  -- Enforce minimum of 5 and maximum of 20 key trades
  IF active_count < 5 THEN
    RAISE EXCEPTION 'Must have at least 5 key contractor trades (currently: %)', active_count;
  END IF;
  
  IF active_count > 20 THEN
    RAISE EXCEPTION 'Cannot have more than 20 key contractor trades (currently: %)', active_count;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce constraints on insert/update/delete
CREATE TRIGGER check_key_trades_count
  AFTER INSERT OR UPDATE OR DELETE ON key_contractor_trades
  FOR EACH STATEMENT
  EXECUTE FUNCTION validate_key_trades_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_key_contractor_trades_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp and user
CREATE TRIGGER update_key_contractor_trades_timestamp_trigger
  BEFORE UPDATE ON key_contractor_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_key_contractor_trades_timestamp();

-- Add helpful comment
COMMENT ON TABLE key_contractor_trades IS 
  'System-wide list of key contractor trades used for prioritization, metrics, compliance tracking, and filtering across the application. Managed exclusively by admin users. Must maintain between 5-20 active trades.';

COMMENT ON COLUMN key_contractor_trades.trade_type IS 
  'Trade type from the trade_type enum. Each trade can only appear once in the active list.';

COMMENT ON COLUMN key_contractor_trades.display_order IS 
  'Order in which trades appear in UI lists. Lower numbers appear first.';

COMMENT ON COLUMN key_contractor_trades.is_active IS 
  'Whether this trade is currently considered a "key contractor trade". Only active trades are used in metrics and filtering.';

COMMENT ON COLUMN key_contractor_trades.notes IS 
  'Optional notes about why this trade is considered "key" or when/why it was added/removed.';

-- Seed with current hard-coded key trades (10 trades from most common definition)
-- These match the values used in MappingSubcontractorsTable.tsx and most other locations
INSERT INTO key_contractor_trades (trade_type, display_order, is_active, notes) VALUES
  ('demolition', 1, true, 'Initial seed - commonly used key trade'),
  ('piling', 2, true, 'Initial seed - commonly used key trade'),
  ('concrete', 3, true, 'Initial seed - commonly used key trade'),
  ('scaffolding', 4, true, 'Initial seed - commonly used key trade'),
  ('form_work', 5, true, 'Initial seed - commonly used key trade'),
  ('tower_crane', 6, true, 'Initial seed - commonly used key trade'),
  ('mobile_crane', 7, true, 'Initial seed - commonly used key trade'),
  ('labour_hire', 8, true, 'Initial seed - commonly used key trade'),
  ('earthworks', 9, true, 'Initial seed - commonly used key trade'),
  ('traffic_control', 10, true, 'Initial seed - commonly used key trade')
ON CONFLICT DO NOTHING;

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS key_contractor_trades_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_trade_id UUID REFERENCES key_contractor_trades(id) ON DELETE SET NULL,
  trade_type trade_type NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed', 'reordered', 'updated')),
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  previous_state JSONB,
  new_state JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_key_contractor_trades_audit_created 
  ON key_contractor_trades_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_key_contractor_trades_audit_trade 
  ON key_contractor_trades_audit(trade_type);

-- Enable RLS for audit log
ALTER TABLE key_contractor_trades_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admin can view audit log
CREATE POLICY "Only admin can view audit log"
  ON key_contractor_trades_audit 
  FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'admin'
  );

COMMENT ON TABLE key_contractor_trades_audit IS 
  'Audit log for all changes to key contractor trades configuration. Tracks who made what changes and when.';

-- Function to log changes to audit table
CREATE OR REPLACE FUNCTION log_key_trade_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_action TEXT;
  v_previous_state JSONB;
  v_new_state JSONB;
BEGIN
  -- Get actor email
  SELECT email INTO v_actor_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'added';
    v_previous_state := NULL;
    v_new_state := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'removed';
    ELSIF OLD.display_order != NEW.display_order THEN
      v_action := 'reordered';
    ELSE
      v_action := 'updated';
    END IF;
    v_previous_state := to_jsonb(OLD);
    v_new_state := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'removed';
    v_previous_state := to_jsonb(OLD);
    v_new_state := NULL;
  END IF;
  
  -- Insert audit record
  INSERT INTO key_contractor_trades_audit (
    key_trade_id,
    trade_type,
    action,
    actor_id,
    actor_email,
    previous_state,
    new_state
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.trade_type, OLD.trade_type),
    v_action,
    auth.uid(),
    v_actor_email,
    v_previous_state,
    v_new_state
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log all changes
CREATE TRIGGER log_key_contractor_trades_changes
  AFTER INSERT OR UPDATE OR DELETE ON key_contractor_trades
  FOR EACH ROW
  EXECUTE FUNCTION log_key_trade_change();

-- Grant necessary permissions
GRANT SELECT ON key_contractor_trades TO authenticated;
GRANT SELECT ON key_contractor_trades_audit TO authenticated;

