/**
 * Scoring Recompute Utility
 * Recomputes all league_player_match_scores for a league using the current scoring rules.
 * Uses the existing calculateFantasyPoints() as the single source of truth.
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateFantasyPoints, type PlayerStats, type PointsBreakdown } from './fantasy-points-calculator';
import type { ScoringRules } from './scoring-types';

const BATCH_SIZE = 500;

interface RecomputeRow {
  score_id: string;
  player_id: string;
  match_id: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_out: boolean;
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  dots: number;
  wides: number;
  no_balls: number;
  lbw_bowled_count: number;
  catches: number;
  stumpings: number;
  run_outs: number;
  is_in_playing_11: boolean;
  is_impact_player: boolean;
  is_man_of_match: boolean;
  team_won: boolean;
}

interface BatchUpdate {
  id: string;
  total_points: number;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  common_points: number;
  points_breakdown: PointsBreakdown;
}

/**
 * Recompute all fantasy points for a league using the given scoring rules.
 * Fetches raw stats via RPC, recalculates using calculateFantasyPoints(),
 * and batch-updates league_player_match_scores.
 *
 * @returns Number of rows updated, or throws on error
 */
export async function recomputeLeaguePoints(
  leagueId: string,
  rules: ScoringRules
): Promise<number> {
  // 1. Fetch all raw stats for the league
  const { data: rows, error: fetchError } = await supabase
    .rpc('get_league_match_stats_for_recompute', { p_league_id: leagueId });

  if (fetchError) {
    throw new Error(`Failed to fetch stats for recompute: ${fetchError.message}`);
  }

  if (!rows || rows.length === 0) {
    return 0;
  }

  // 2. Calculate new points for each row
  const updates: BatchUpdate[] = (rows as RecomputeRow[]).map(row => {
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

    const breakdown = calculateFantasyPoints(stats, rules);

    return {
      id: row.score_id,
      total_points: breakdown.total,
      batting_points: breakdown.batting.total,
      bowling_points: breakdown.bowling.total,
      fielding_points: breakdown.fielding.total,
      common_points: breakdown.common.total,
      points_breakdown: breakdown,
    };
  });

  // 3. Batch update in chunks
  let totalUpdated = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const { data: count, error: updateError } = await supabase
      .rpc('batch_update_league_scores', { p_updates: JSON.parse(JSON.stringify(chunk)) });

    if (updateError) {
      throw new Error(`Batch update failed at offset ${i}: ${updateError.message}`);
    }
    totalUpdated += (count as number) || chunk.length;
  }

  return totalUpdated;
}
