-- Prompt 1B — Alias Schema Migration
-- Extend employer_aliases with provenance metadata and scope uniqueness to employer_id + alias_normalized.

ALTER TABLE public.employer_aliases
  ADD COLUMN source_system text,
  ADD COLUMN source_identifier text,
  ADD COLUMN collected_at timestamptz,
  ADD COLUMN collected_by uuid,
  ADD COLUMN is_authoritative boolean NOT NULL DEFAULT false,
  ADD COLUMN notes text;

DROP INDEX IF EXISTS employer_aliases_alias_normalized_idx;

CREATE UNIQUE INDEX IF NOT EXISTS employer_aliases_employer_id_alias_normalized_idx
  ON public.employer_aliases (employer_id, alias_normalized);

COMMENT ON INDEX public.employer_aliases_employer_id_alias_normalized_idx
  IS 'Enforces alias uniqueness per employer, enabling cross-employer triage collisions.';

UPDATE public.employer_aliases
SET
  source_system = COALESCE(source_system, 'legacy_migration'),
  source_identifier = COALESCE(source_identifier, alias),
  collected_at = COALESCE(collected_at, created_at),
  collected_by = COALESCE(collected_by, created_by),
  notes = CASE
    WHEN notes IS NULL THEN 'Backfilled during Prompt 1B migration'
    ELSE notes
  END
WHERE source_system IS NULL
   OR source_identifier IS NULL
   OR collected_at IS NULL
   OR collected_by IS NULL
   OR notes IS NULL;


