-- Add missing 'internal_walls' trade type for Gyprock/internal walls contractors
-- This is used by EBA Trade Import for "Gyprock" PDFs

ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'internal_walls';

COMMENT ON TYPE public.trade_type IS 'Trade types including internal_walls (gyprock/plasterboard installation)';
