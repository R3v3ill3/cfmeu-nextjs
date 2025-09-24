-- Add training and election tracking fields to union_roles table
ALTER TABLE union_roles 
ADD COLUMN elected_by TEXT,
ADD COLUMN date_elected DATE,
ADD COLUMN ohs_training_date DATE,
ADD COLUMN ohs_refresher_training_date DATE,
ADD COLUMN cfmeu_registration_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN cfmeu_registration_data JSONB;

-- Add OHS Committee Chair as a union role type
ALTER TYPE union_role_name ADD VALUE 'ohs_committee_chair';

-- Create a view to link site contacts with actual workers who have union roles
CREATE OR REPLACE VIEW site_representatives AS
SELECT 
  sc.id as site_contact_id,
  sc.job_site_id,
  sc.role as contact_role,
  sc.name as contact_name,
  sc.email as contact_email,
  sc.phone as contact_phone,
  ur.id as union_role_id,
  ur.worker_id,
  ur.name as union_role_name,
  ur.start_date,
  ur.end_date,
  ur.is_senior,
  ur.gets_paid_time,
  ur.elected_by,
  ur.date_elected,
  ur.ohs_training_date,
  ur.ohs_refresher_training_date,
  ur.cfmeu_registration_submitted_at,
  w.first_name,
  w.surname,
  w.mobile_phone,
  w.email as worker_email,
  w.home_address_line_1,
  w.home_address_line_2,
  w.home_address_suburb,
  w.home_address_postcode,
  w.home_address_state,
  w.union_membership_status,
  js.name as site_name,
  js.location as site_address,
  p.name as project_name,
  p.proposed_finish_date as site_estimated_completion_date
FROM site_contacts sc
LEFT JOIN union_roles ur ON (
  ur.job_site_id = sc.job_site_id 
  AND ((sc.role = 'site_delegate' AND ur.name IN ('site_delegate', 'shift_delegate', 'company_delegate'))
       OR (sc.role = 'site_hsr' AND ur.name IN ('hsr', 'ohs_committee_chair')))
  AND (ur.end_date IS NULL OR ur.end_date > CURRENT_DATE)
)
LEFT JOIN workers w ON w.id = ur.worker_id
LEFT JOIN job_sites js ON js.id = sc.job_site_id
LEFT JOIN projects p ON p.id = js.project_id
WHERE sc.role IN ('site_delegate', 'site_hsr');

-- Create function to get site manager contact phone for CFMEU form
CREATE OR REPLACE FUNCTION get_site_manager_phone(site_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT phone 
    FROM site_contacts 
    WHERE job_site_id = site_id 
    AND role = 'site_manager' 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;
