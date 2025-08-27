-- Expose enum values for public.trade_type via RPC
-- Safe, read-only helper for clients
create or replace function public.get_trade_type_enum()
returns setof text
language sql
stable
as $$
  select unnest(enum_range(null::public.trade_type))::text;
$$;

-- Grant execute to authenticated and anon roles if needed
grant execute on function public.get_trade_type_enum() to anon, authenticated, service_role;

