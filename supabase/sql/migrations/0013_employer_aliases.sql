-- Create employer_aliases table to persist alias-to-employer mappings
-- This supports remembering manual matches during imports.

create table if not exists public.employer_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  alias_normalized text not null,
  employer_id uuid not null references public.employers(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null
);

-- Ensure alias uniqueness by normalized form
create unique index if not exists employer_aliases_alias_normalized_idx
  on public.employer_aliases (alias_normalized);

-- Helpful index for reverse lookups
create index if not exists employer_aliases_employer_id_idx
  on public.employer_aliases (employer_id);

-- Note: RLS intentionally not enabled to match existing client-side insert/select patterns.
-- If you later enable RLS, add appropriate policies for authenticated users.


