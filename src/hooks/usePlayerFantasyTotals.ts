import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFantasyPoints, type PlayerStats } from '@/lib/fantasy-points-calculator';
import { useGameStore } from '@/store/useGameStore';

/**
 * Fetches cumulative fantasy points for all players in a league.
 * 
 * Strategy:
 * 1. Try league_player_match_scores (pre-computed, fastest)
 * 2. Fallback: fetch raw stats from match_player_stats for league matches
 *    and calculate points client-side using calculateFantasyPoints()
 *    (same approach as PlayerDetailDialog)
 * 
 * Only 1-2 DB queries, no per-player lookups.
 */
export function usePlayerFantasyTotals(leagueId: string | undefined) {
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const scoringRules = useGameStore(state => state.scoringRules);

  useEffect(() => {
    if (!leagueId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      // === Attempt 1: Pre-computed league scores (fastest path) ===
      const { data: precomputed } = await supabase
        .from('player_match_stats_compat')
        .select('player_id, fantasy_points')
        .eq('league_id', leagueId)
        .not('player_id', 'is', null)
        .not('fantasy_points', 'is', null)
        .limit(5000);

      if (cancelled) return;

      if (precomputed && precomputed.length > 0) {
        const map: Record<string, number> = {};
        for (const row of precomputed) {
          if (row.player_id) {
            map[row.player_id] = (map[row.player_id] ?? 0) + (row.fantasy_points ?? 0);
          }
        }
        setTotals(map);
        setLoading(false);
        return;
      }

      // === Attempt 2: Compute from raw stats (like PlayerDetailDialog) ===
      // Step A: Get match IDs for this league
      const { data: leagueMatches, error: lmError } = await supabase
        .from('league_matches')
        .select('match_id')
        .eq('league_id', leagueId);

      if (cancelled) return;

      if (lmError || !leagueMatches || leagueMatches.length === 0) {
        console.warn('[usePlayerFantasyTotals] No league matches found:', lmError?.message);
        setTotals({});
        setLoading(false);
        return;
      }

      const matchIds = leagueMatches.map(m => m.match_id);

      // Step B: Fetch raw stats for those matches (all players at once)
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
        setLoading(false);
        return;
      }

      // Step C: Calculate fantasy points per row and aggregate per player
      const map: Record<string, number> = {};
      for (const row of rawStats ?? []) {
        if (!row.player_id) continue;

        const stats: PlayerStats = {
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

        const points = calculateFantasyPoints(stats, scoringRules).total;
        map[row.player_id] = (map[row.player_id] ?? 0) + points;
      }

      console.log(`[usePlayerFantasyTotals] Computed from ${rawStats?.length ?? 0} raw stat rows, ${Object.keys(map).length} players, ${matchIds.length} matches`);
      setTotals(map);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [leagueId, scoringRules]);

  return { totals, loading };
}
