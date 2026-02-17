-- Migration: Fix leagues insert trigger after scoring rules refactor
-- Purpose:
-- 1) Remove any legacy leagues trigger whose function still references
--    scoring_rule_versions (dropped in refactor).
-- 2) Ensure every new league gets a scoring_rules row.

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'leagues'
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ILIKE '%scoring_rule_versions%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.leagues', trigger_record.tgname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_scoring_rules_row_for_league()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scoring_rules (league_id, rules)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (league_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_scoring_rules_row_after_league_insert ON public.leagues;
CREATE TRIGGER ensure_scoring_rules_row_after_league_insert
AFTER INSERT ON public.leagues
FOR EACH ROW
EXECUTE FUNCTION public.ensure_scoring_rules_row_for_league();
