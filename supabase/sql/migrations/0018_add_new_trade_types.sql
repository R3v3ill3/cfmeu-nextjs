-- Add 10 new trade types to the trade_type enum
-- Based on BCI import analysis and user requirements

-- Add new trade types to the enum
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'foundations';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'ceilings';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'stairs_balustrades';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'building_services';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'civil_infrastructure';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'fitout';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'insulation';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'technology';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'pools';
ALTER TYPE public.trade_type ADD VALUE IF NOT EXISTS 'pipeline';

-- Update the get_trade_type_enum function to ensure it returns the new values
-- (This should work automatically, but we'll refresh it to be sure)
DROP FUNCTION IF EXISTS public.get_trade_type_enum();
CREATE OR REPLACE FUNCTION public.get_trade_type_enum()
RETURNS SETOF text
LANGUAGE sql
STABLE
AS $$
  SELECT unnest(enum_range(null::public.trade_type))::text;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_trade_type_enum() TO anon, authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_trade_type_enum() IS 'Returns all available trade_type enum values. Updated to include 10 new trade types for BCI import compatibility.';
