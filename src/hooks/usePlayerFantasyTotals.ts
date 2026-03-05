import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFantasyPoints, type PlayerStats } from '@/lib/fantasy-points-calculator';
import { useGameStore } from '@/store/useGameStore';

export interface PlayerAggregateStats {
  fantasyPoints: number;
  matches: number;
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  // Bowling
  wickets: number;
  overs: number;
  runsConceded: number;
  maidens: number;
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;
}

/**
 * Fetches cumulative fantasy points AND aggregate stats for all players in a league.
 * Optionally filter by week (null/undefined = all weeks / "Season").
 */
export function usePlayerFantasyTotals(leagueId: string | undefined, week?: number | null) {
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, PlayerAggregateStats>>({});
  const [loading, setLoading] = useState(false);
  const scoringRules = useGameStore(state => state.scoringRules);

  useEffect(() => {
    if (!leagueId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      // Get match IDs for this league (optionally filtered by week)
      let matchQuery = supabase
        .from('league_matches')
        .select('match_id')
        .eq('league_id', leagueId);

      if (week != null) {
        matchQuery = matchQuery.eq('week', week);
      }

      const { data: leagueMatches, error: lmError } = await matchQuery;

      if (cancelled) return;

      console.log(`[usePlayerFantasyTotals] week=${week ?? 'all'}, league_matches=${leagueMatches?.length ?? 0}`, lmError?.message ?? '');

      if (lmError || !leagueMatches || leagueMatches.length === 0) {
        setTotals({});
        setStats({});
        setLoading(false);
        return;
      }

      const matchIds = leagueMatches.map(m => m.match_id);

      // Fetch raw stats for those matches (all players at once)
      const { data: rawStats, error: rsError } = await supabase
        .from('match_player_stats')
        .select('player_id, runs, balls_faced, fours, sixes, is_out, overs, maidens, runs_conceded, wickets, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, is_impact_player, is_man_of_match, team_won')
        .in('match_id', matchIds)
        .not('player_id', 'is', null)
        .limit(10000);

      if (cancelled) return;

      if (rsError) {
        console.warn('[usePlayerFantasyTotals] Raw stats error:', rsError.message);
        setTotals({});
        setStats({});
        setLoading(false);
        return;
      }

      // Calculate fantasy points per row and aggregate per player
      const pointsMap: Record<string, number> = {};
      const statsMap: Record<string, PlayerAggregateStats> = {};

      for (const row of rawStats ?? []) {
        if (!row.player_id) continue;

        const playerStats: PlayerStats = {
          runs: row.runs ?? 0,
          ballsFaced: row.balls_faced ?? 0,
          fours: row.fours ?? 0,
          sixes: row.sixes ?? 0,
          isOut: row.is_out ?? false,
          overs: row.overs ?? 0,
          maidens: row.maidens ?? 0,
          runsConceded: row.runs_conceded ?? 0,
          wickets: row.wickets ?? 0,
          dots: row.dots ?? 0,
          wides: row.wides ?? 0,
          noBalls: row.no_balls ?? 0,
          lbwBowledCount: row.lbw_bowled_count ?? 0,
          catches: row.catches ?? 0,
          stumpings: row.stumpings ?? 0,
          runOuts: row.run_outs ?? 0,
          isInPlaying11: row.is_in_playing_11 ?? false,
          isImpactPlayer: row.is_impact_player ?? false,
          isManOfMatch: row.is_man_of_match ?? false,
          teamWon: row.team_won ?? false,
        };

        const points = calculateFantasyPoints(playerStats, scoringRules).total;
        pointsMap[row.player_id] = (pointsMap[row.player_id] ?? 0) + points;

        // Aggregate raw stats
        if (!statsMap[row.player_id]) {
          statsMap[row.player_id] = {
            fantasyPoints: 0, matches: 0,
            runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
            wickets: 0, overs: 0, runsConceded: 0, maidens: 0,
            catches: 0, stumpings: 0, runOuts: 0,
          };
        }
        const agg = statsMap[row.player_id];
        agg.fantasyPoints += points;
        agg.matches += 1;
        agg.runs += row.runs ?? 0;
        agg.ballsFaced += row.balls_faced ?? 0;
        agg.fours += row.fours ?? 0;
        agg.sixes += row.sixes ?? 0;
        agg.wickets += row.wickets ?? 0;
        agg.overs += row.overs ?? 0;
        agg.runsConceded += row.runs_conceded ?? 0;
        agg.maidens += row.maidens ?? 0;
        agg.catches += row.catches ?? 0;
        agg.stumpings += row.stumpings ?? 0;
        agg.runOuts += row.run_outs ?? 0;
      }

      setTotals(pointsMap);
      setStats(statsMap);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [leagueId, week, scoringRules]);

  return { totals, stats, loading };
}
