-- Add 'mapping_sheet_scan' to scraper_job_type enum
-- This job type is used for processing mapping sheet PDF scans via AI

ALTER TYPE public.scraper_job_type ADD VALUE IF NOT EXISTS 'mapping_sheet_scan';

COMMENT ON TYPE public.scraper_job_type IS 'Valid job types: fwc_lookup, incolink_sync, mapping_sheet_scan';
