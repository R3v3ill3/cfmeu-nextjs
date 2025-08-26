-- Add project_type enum if missing
DO $$ BEGIN
  CREATE TYPE public.project_type AS ENUM ('government', 'private', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add trade_stage enum if missing
DO $$ BEGIN
  CREATE TYPE public.trade_stage AS ENUM ('early_works', 'structure', 'finishing', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend site_contact_role enum with site_delegate and site_hsr (if not present)
DO $$ BEGIN
  ALTER TYPE public.site_contact_role ADD VALUE IF NOT EXISTS 'site_delegate';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.site_contact_role ADD VALUE IF NOT EXISTS 'site_hsr';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Extend trade_type enum with new values (non-destructive)
DO $$ BEGIN
  ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'piling';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'excavations';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'facade';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'final_clean';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Add new columns to projects (non-blocking defaults)
ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS project_type public.project_type,
  ADD COLUMN IF NOT EXISTS state_funding numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS federal_funding numeric DEFAULT 0 NOT NULL;

-- Add stage column to project_contractor_trades
ALTER TABLE IF EXISTS public.project_contractor_trades
  ADD COLUMN IF NOT EXISTS stage public.trade_stage;

-- N/A tracking per trade per project
CREATE TABLE IF NOT EXISTS public.project_trade_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
  stage public.trade_stage NOT NULL,
  trade_type public.trade_type NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'na'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, stage, trade_type)
);

-- Optional: policy scaffolding (commented for review)
-- ALTER TABLE public.project_trade_availability ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY project_trade_availability_read ON public.project_trade_availability FOR SELECT USING (true);
-- CREATE POLICY project_trade_availability_write ON public.project_trade_availability FOR INSERT WITH CHECK (true);
-- CREATE POLICY project_trade_availability_update ON public.project_trade_availability FOR UPDATE USING (true) WITH CHECK (true);