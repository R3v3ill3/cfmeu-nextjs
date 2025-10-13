-- Note: scraper_jobs table uses TEXT columns with CHECK constraints, not ENUMs
-- The job_type column accepts any text value, so 'mapping_sheet_scan' is already valid
-- No migration needed - just documenting that 'mapping_sheet_scan' is a valid job_type value

COMMENT ON TABLE scraper_jobs IS 'Job queue for async processing. Valid job_type values include: mapping_sheet_scan';
