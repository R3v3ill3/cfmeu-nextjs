-- Add missing columns to company_eba_records table for FWC scraper integration
ALTER TABLE company_eba_records 
ADD COLUMN IF NOT EXISTS agreement_title TEXT,
ADD COLUMN IF NOT EXISTS status TEXT;
