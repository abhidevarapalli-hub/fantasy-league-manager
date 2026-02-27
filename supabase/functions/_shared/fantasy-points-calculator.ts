/**
 * Fantasy Points Calculator (Shared Edge Function Version)
 * Calculates fantasy points based on player stats and scoring rules.
 * This is the edge-function-compatible version of src/lib/fantasy-points-calculator.ts.
 * Keep in sync using: npm run sync:scoring
 */

import type { ScoringRules } from './scoring-types.ts';

// Input stats for calculation
export interface PlayerStats {
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  wides: number;
  noBalls: number;
  lbwBowledCount: number;
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;
  // Context
  isInPlaying11: boolean;
  isImpactPlayer: boolean;
  isManOfMatch: boolean;
  teamWon: boolean;
  // Player role context
  playerRole?: string; // 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper'
}

// Detailed breakdown of points
export interface PointsBreakdown {
  common: {
    starting11: number;
    matchWinningTeam: number;
    impactPlayer: number;
    impactPlayerWinBonus: number;
    manOfTheMatch: number;
    total: number;
  };
  batting: {
    runs: number;
    fours: number;
    sixes: number;
    milestoneBonus: number;
    duckPenalty: number;
    lowScorePenalty: number;
    strikeRateBonus: number;
    total: number;
  };
  bowling: {
    wickets: number;
    milestoneBonus: number;
    dots: number;
    lbwBowledBonus: number;
    widePenalty: number;
    noBallPenalty: number;
    maidens: number;
    economyBonus: number;
    total: number;
  };
  fielding: {
    catches: number;
    stumpings: number;
    runOuts: number;
    multiCatchBonus: number;
    total: number;
  };
  total: number;
}

/**
 * Calculate common points (playing XI, man of match, etc.)
 */
function calculateCommonPoints(
  stats: PlayerStats,
  rules: ScoringRules['common']
): PointsBreakdown['common'] {
  const starting11 = stats.isInPlaying11 ? rules.starting11 : 0;
  const matchWinningTeam = stats.teamWon ? rules.matchWinningTeam : 0;
  const impactPlayer = stats.isImpactPlayer ? rules.impactPlayer : 0;
  const impactPlayerWinBonus = stats.isImpactPlayer && stats.teamWon ? rules.impactPlayerWinBonus : 0;
  const manOfTheMatch = stats.isManOfMatch ? rules.manOfTheMatch : 0;

  return {
    starting11,
    matchWinningTeam,
    impactPlayer,
    impactPlayerWinBonus,
    manOfTheMatch,
    total: starting11 + matchWinningTeam + impactPlayer + impactPlayerWinBonus + manOfTheMatch,
  };
}

/**
 * Calculate batting points
 */
function calculateBattingPoints(
  stats: PlayerStats,
  rules: ScoringRules['batting']
): PointsBreakdown['batting'] {
  // Base points
  const runs = stats.runs * rules.runs;
  const fours = stats.fours * rules.four;
  const sixes = stats.sixes * rules.six;

  // Milestone bonus - find highest milestone reached
  let milestoneBonus = 0;
  for (const milestone of rules.milestones) {
    if (stats.runs >= milestone.runs) {
      milestoneBonus = milestone.points;
    }
  }

  // Role-based penalty exemption: bowlers don't get duck/low-score penalties
  const isBowler = stats.playerRole === 'Bowler';

  // Duck penalty (0 runs and out) — exempt bowlers
  const duckPenalty = stats.runs === 0 && stats.isOut && !isBowler ? rules.duckDismissal : 0;

  // Low score penalty (1-5 runs and out, but not a duck) — exempt bowlers
  const lowScorePenalty =
    stats.runs > 0 && stats.runs <= 5 && stats.isOut && !isBowler ? rules.lowScoreDismissal : 0;

  // Strike rate bonus/penalty
  let strikeRateBonus = 0;
  if (stats.ballsFaced > 0) {
    const strikeRate = (stats.runs / stats.ballsFaced) * 100;
    for (const srBonus of rules.strikeRateBonuses) {
      const meetsMinBalls = !srBonus.minBalls || stats.ballsFaced >= srBonus.minBalls;
      const meetsMinRuns = !srBonus.minRuns || stats.runs >= srBonus.minRuns;
      if (strikeRate >= srBonus.minSR && strikeRate <= srBonus.maxSR && meetsMinBalls && meetsMinRuns) {
        strikeRateBonus = srBonus.points;
        break;
      }
    }
  }

  return {
    runs,
    fours,
    sixes,
    milestoneBonus,
    duckPenalty,
    lowScorePenalty,
    strikeRateBonus,
    total: runs + fours + sixes + milestoneBonus + duckPenalty + lowScorePenalty + strikeRateBonus,
  };
}

/**
 * Calculate bowling points
 */
function calculateBowlingPoints(
  stats: PlayerStats,
  rules: ScoringRules['bowling']
): PointsBreakdown['bowling'] {
  // Base wicket points
  const wickets = stats.wickets * rules.wickets;

  // Wicket milestone bonus - find highest milestone reached
  let milestoneBonus = 0;
  for (const milestone of rules.milestones) {
    if (stats.wickets >= milestone.wickets) {
      milestoneBonus = milestone.points;
    }
  }

  // Dot ball points
  const dots = stats.dots * rules.dotBall;

  // LBW/Bowled bonus
  const lbwBowledBonus = stats.lbwBowledCount * rules.lbwOrBowledBonus;

  // Wide penalty
  const widePenalty = stats.wides * rules.widePenalty;

  // No ball penalty
  const noBallPenalty = stats.noBalls * rules.noBallPenalty;

  // Maiden over points
  const maidens = stats.maidens * rules.maidenOver;

  // Economy rate bonus/penalty
  let economyBonus = 0;
  if (stats.overs >= 1) {
    const economy = stats.runsConceded / stats.overs;
    for (const erBonus of rules.economyRateBonuses) {
      const meetsMinOvers = !erBonus.minOvers || stats.overs >= erBonus.minOvers;
      if (economy >= erBonus.minER && economy <= erBonus.maxER && meetsMinOvers) {
        economyBonus = erBonus.points;
        break;
      }
    }
  }

  return {
    wickets,
    milestoneBonus,
    dots,
    lbwBowledBonus,
    widePenalty,
    noBallPenalty,
    maidens,
    economyBonus,
    total: wickets + milestoneBonus + dots + lbwBowledBonus + widePenalty + noBallPenalty + maidens + economyBonus,
  };
}

/**
 * Calculate fielding points
 */
function calculateFieldingPoints(
  stats: PlayerStats,
  rules: ScoringRules['fielding']
): PointsBreakdown['fielding'] {
  const catches = stats.catches * rules.catch;
  const stumpings = stats.stumpings * rules.stumping;
  const runOuts = stats.runOuts * rules.runOut;

  // Multi-catch bonus
  const multiCatchBonus =
    stats.catches >= rules.multiCatchBonus.count ? rules.multiCatchBonus.points : 0;

  return {
    catches,
    stumpings,
    runOuts,
    multiCatchBonus,
    total: catches + stumpings + runOuts + multiCatchBonus,
  };
}

/**
 * Calculate total fantasy points with detailed breakdown
 */
export function calculateFantasyPoints(
  stats: PlayerStats,
  rules: ScoringRules
): PointsBreakdown {
  const common = calculateCommonPoints(stats, rules.common);
  const batting = calculateBattingPoints(stats, rules.batting);
  const bowling = calculateBowlingPoints(stats, rules.bowling);
  const fielding = calculateFieldingPoints(stats, rules.fielding);

  return {
    common,
    batting,
    bowling,
    fielding,
    total: common.total + batting.total + bowling.total + fielding.total,
  };
}
