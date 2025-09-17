-- Auto-assign invited organisers to their inviting lead organiser
-- When a pending user with role 'organiser' becomes active, automatically assign them to the inviting lead organiser

-- Function to extract lead organiser ID from pending user notes or created_by field
CREATE OR REPLACE FUNCTION extract_lead_organiser_from_pending_user(p_pending_user_id UUID)
RETURNS UUID AS $$
DECLARE
  lead_id UUID;
  pending_rec record;
BEGIN
  -- Get pending user record
  SELECT * INTO pending_rec 
  FROM pending_users 
  WHERE id = p_pending_user_id;
  
  -- If created_by is a lead organiser, use that
  IF pending_rec.created_by IS NOT NULL THEN
    SELECT id INTO lead_id
    FROM profiles 
    WHERE id = pending_rec.created_by 
      AND role = 'lead_organiser';
    
    IF lead_id IS NOT NULL THEN
      RETURN lead_id;
    END IF;
  END IF;
  
  -- Try to extract from notes field (backup method)
  IF pending_rec.notes IS NOT NULL AND pending_rec.notes LIKE '%Auto-assign to lead organiser:%' THEN
    -- Extract UUID from notes pattern like "Auto-assign to lead organiser: uuid-here"
    SELECT substring(pending_rec.notes from 'Auto-assign to lead organiser: ([a-f0-9-]{36})')::UUID INTO lead_id;
    
    -- Verify this is actually a lead organiser
    IF lead_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM profiles WHERE id = lead_id AND role = 'lead_organiser') THEN
        RETURN lead_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-assign organiser to lead organiser patches
CREATE OR REPLACE FUNCTION auto_assign_organiser_to_lead_patches(p_organiser_id UUID, p_lead_organiser_id UUID)
RETURNS INTEGER AS $$
DECLARE
  patch_count INTEGER := 0;
  patch_record record;
BEGIN
  -- Get all patches assigned to the lead organiser
  FOR patch_record IN 
    SELECT patch_id 
    FROM lead_organiser_patch_assignments 
    WHERE lead_organiser_id = p_lead_organiser_id 
      AND effective_to IS NULL
  LOOP
    -- Assign organiser to each patch (use upsert to avoid conflicts)
    INSERT INTO organiser_patch_assignments (organiser_id, patch_id, effective_from, effective_to)
    VALUES (p_organiser_id, patch_record.patch_id, NOW(), NULL)
    ON CONFLICT (organiser_id, patch_id) 
    DO UPDATE SET 
      effective_from = CASE WHEN organiser_patch_assignments.effective_to IS NOT NULL THEN NOW() ELSE organiser_patch_assignments.effective_from END,
      effective_to = NULL;
    
    patch_count := patch_count + 1;
  END LOOP;
  
  RETURN patch_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user profile creation from pending users
CREATE OR REPLACE FUNCTION handle_new_organiser_assignment()
RETURNS TRIGGER AS $$
DECLARE
  pending_user_rec record;
  lead_organiser_id UUID;
  assigned_patches INTEGER;
BEGIN
  -- Only process if this is a new profile with role 'organiser'
  IF NEW.role != 'organiser' OR OLD IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find matching pending user record
  SELECT * INTO pending_user_rec
  FROM pending_users 
  WHERE email = LOWER(NEW.email) 
    AND role = 'organiser'
    AND status = 'invited'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF pending_user_rec IS NOT NULL THEN
    -- Extract lead organiser ID
    lead_organiser_id := extract_lead_organiser_from_pending_user(pending_user_rec.id);
    
    IF lead_organiser_id IS NOT NULL THEN
      -- Auto-assign to lead organiser's patches
      assigned_patches := auto_assign_organiser_to_lead_patches(NEW.id, lead_organiser_id);
      
      -- Log the assignment
      RAISE NOTICE 'Auto-assigned organiser % to % patches under lead organiser %', 
        NEW.id, assigned_patches, lead_organiser_id;
        
      -- Update the pending user record to mark it as processed
      UPDATE pending_users 
      SET notes = COALESCE(notes, '') || ' [PROCESSED: Auto-assigned to ' || assigned_patches || ' patches]'
      WHERE id = pending_user_rec.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table to auto-assign new organisers
DROP TRIGGER IF EXISTS trigger_auto_assign_organiser ON profiles;
CREATE TRIGGER trigger_auto_assign_organiser
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organiser_assignment();

-- Update the existing RPC function to handle organiser-patch assignment with lead organiser context
CREATE OR REPLACE FUNCTION upsert_organiser_patch(p_org UUID, p_patch UUID, p_lead_organiser UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- Close any existing assignment for this organiser-patch combination
  UPDATE organiser_patch_assignments 
  SET effective_to = NOW()
  WHERE organiser_id = p_org 
    AND patch_id = p_patch 
    AND effective_to IS NULL;
  
  -- Create new assignment
  INSERT INTO organiser_patch_assignments (organiser_id, patch_id, effective_from, effective_to)
  VALUES (p_org, p_patch, NOW(), NULL);
  
  -- If lead organiser context is provided, ensure the lead is also assigned to this patch
  IF p_lead_organiser IS NOT NULL THEN
    INSERT INTO lead_organiser_patch_assignments (lead_organiser_id, patch_id, effective_from, effective_to)
    VALUES (p_lead_organiser, p_patch, NOW(), NULL)
    ON CONFLICT (lead_organiser_id, patch_id)
    DO UPDATE SET 
      effective_from = CASE WHEN lead_organiser_patch_assignments.effective_to IS NOT NULL THEN NOW() ELSE lead_organiser_patch_assignments.effective_from END,
      effective_to = NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_lead_organiser_from_pending_user TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auto_assign_organiser_to_lead_patches TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION handle_new_organiser_assignment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_organiser_patch TO authenticated, service_role;

-- Add comments
COMMENT ON FUNCTION extract_lead_organiser_from_pending_user IS 'Extract lead organiser ID from pending user record for auto-assignment';
COMMENT ON FUNCTION auto_assign_organiser_to_lead_patches IS 'Automatically assign an organiser to all patches managed by a lead organiser';
COMMENT ON FUNCTION handle_new_organiser_assignment IS 'Trigger function to auto-assign new organisers to their inviting lead organiser';
COMMENT ON TRIGGER trigger_auto_assign_organiser ON profiles IS 'Auto-assigns new organiser profiles to patches based on their inviting lead organiser';
