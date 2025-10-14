-- Shared employer name normalization function

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_employer_name(input_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  working text := input_name;
  original text := input_name;
  suffixes text[] := ARRAY[
    'PTY LTD', 'PTY. LTD.', 'PROPRIETARY LIMITED', 'LIMITED', 'LTD',
    'INCORPORATED', 'INC', 'CORPORATION', 'CORP', 'COMPANY', 'CO',
    'GROUP', 'HOLDINGS', 'ENTERPRISES', 'SERVICES', 'SOLUTIONS', 'TRUST',
    'PLC', 'LLC', 'LLP', 'BV', 'GMBH', 'SARL'
  ];
  prefixes text[] := ARRAY['THE', 'A', 'AN'];
  preserve_tokens text[] := ARRAY['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'NZ'];
  prefix text;
  suffix text;
  changed boolean;
BEGIN
  IF working IS NULL OR btrim(working) = '' THEN
    RETURN '';
  END IF;

  working := regexp_replace(working, '(?i)(T\/A|TRADING AS|ATF|AS TRUSTEE FOR).*$', '', 'g');
  working := btrim(working);

  IF working = '' THEN
    RETURN '';
  END IF;

  working := unaccent(working);
  working := upper(working);
  working := regexp_replace(working, '\\bAND\\b', ' & ', 'g');
  working := regexp_replace(working, '\\+', ' & ', 'g');
  working := regexp_replace(working, '\\s*&\\s*', ' & ', 'g');
  working := regexp_replace(working, '[^A-Z0-9&\\s]', ' ', 'g');
  working := regexp_replace(working, '\\s+', ' ', 'g');
  working := btrim(working);

  FOREACH prefix IN ARRAY prefixes LOOP
    IF working LIKE prefix || ' %' THEN
      working := btrim(substring(working FROM length(prefix) + 2));
      EXIT;
    END IF;
  END LOOP;

  LOOP
    changed := FALSE;
    FOREACH suffix IN ARRAY suffixes LOOP
      IF array_position(preserve_tokens, suffix) IS NOT NULL THEN
        CONTINUE;
      END IF;

      IF working = suffix THEN
        working := '';
        changed := TRUE;
        EXIT;
      ELSIF working LIKE '% ' || suffix THEN
        working := btrim(substring(working FROM 1 FOR length(working) - length(suffix) - 1));
        changed := TRUE;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN NOT changed OR working = '';
  END LOOP;

  working := regexp_replace(working, '\\s+', ' ', 'g');
  working := btrim(working);

  IF working = '' THEN
    RETURN COALESCE(upper(original), '');
  END IF;

  RETURN working;
END;
$$;

COMMENT ON FUNCTION public.normalize_employer_name(text)
IS 'Normalizes employer names for alias matching, removing punctuation, diacritics, and common corporate suffixes.';


