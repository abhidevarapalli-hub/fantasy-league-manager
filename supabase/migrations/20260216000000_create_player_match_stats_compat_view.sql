-- Create backwards-compatible view that joins match_player_stats + league_player_match_scores
-- into the flat shape the frontend expects (matching the old player_match_stats table).

CREATE OR REPLACE VIEW public.player_match_stats_compat AS
SELECT
  lpms.id,
  lpms.match_id,
  mps.cricbuzz_player_id,
  lpms.player_id,
  -- Batting
  mps.runs,
  mps.balls_faced,
  mps.fours,
  mps.sixes,
  mps.strike_rate,
  mps.is_out,
  mps.dismissal_type,
  mps.batting_position,
  -- Bowling
  mps.overs,
  mps.maidens,
  mps.runs_conceded,
  mps.wickets,
  mps.economy,
  mps.dots,
  mps.wides,
  mps.no_balls,
  mps.lbw_bowled_count,
  -- Fielding
  mps.catches,
  mps.stumpings,
  mps.run_outs,
  -- Match context
  mps.is_in_playing_11,
  mps.is_impact_player,
  mps.is_man_of_match,
  mps.team_won,
  -- League context (from league_player_match_scores)
  lpms.league_id,
  lpms.manager_id,
  lpms.total_points AS fantasy_points,
  lpms.was_in_active_roster,
  lpms.week,
  lpms.is_live AS is_live_stats,
  lpms.computed_at AS live_updated_at,
  lpms.finalized_at,
  mps.created_at
FROM league_player_match_scores lpms
JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id;

-- Grant read access to authenticated users (matches RLS on underlying tables)
GRANT SELECT ON public.player_match_stats_compat TO authenticated;
GRANT SELECT ON public.player_match_stats_compat TO service_role;

-- Fix leagues insert trigger after scoring rules refactor
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
