/**
 * Fantasy Points Calculator
 * Calculates fantasy points based on player stats and scoring rules
 */

import type { ScoringRules } from './scoring-types';
import type { PlayerMatchStats } from './supabase-types';

// Input stats for calculation (subset of PlayerMatchStats)
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

  // Duck penalty (0 runs and out)
  const duckPenalty = stats.runs === 0 && stats.isOut ? rules.duckDismissal : 0;

  // Low score penalty (1-5 runs and out, but not a duck)
  const lowScorePenalty =
    stats.runs > 0 && stats.runs <= 5 && stats.isOut ? rules.lowScoreDismissal : 0;

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

/**
 * Calculate fantasy points from PlayerMatchStats
 */
export function calculatePointsFromMatchStats(
  matchStats: PlayerMatchStats,
  rules: ScoringRules
): PointsBreakdown {
  const stats: PlayerStats = {
    runs: matchStats.runs,
    ballsFaced: matchStats.ballsFaced,
    fours: matchStats.fours,
    sixes: matchStats.sixes,
    isOut: matchStats.isOut,
    overs: matchStats.overs,
    maidens: matchStats.maidens,
    runsConceded: matchStats.runsConceded,
    wickets: matchStats.wickets,
    dots: matchStats.dots,
    wides: matchStats.wides,
    noBalls: matchStats.noBalls,
    lbwBowledCount: matchStats.lbwBowledCount,
    catches: matchStats.catches,
    stumpings: matchStats.stumpings,
    runOuts: matchStats.runOuts,
    isInPlaying11: matchStats.isInPlaying11,
    isImpactPlayer: matchStats.isImpactPlayer,
    isManOfMatch: matchStats.isManOfMatch,
    teamWon: matchStats.teamWon,
  };

  return calculateFantasyPoints(stats, rules);
}

/**
 * Format points breakdown as a human-readable string
 */
export function formatPointsBreakdown(breakdown: PointsBreakdown): string {
  const lines: string[] = [];

  // Common points
  if (breakdown.common.total !== 0) {
    lines.push('Common:');
    if (breakdown.common.starting11) lines.push(`  Playing XI: +${breakdown.common.starting11}`);
    if (breakdown.common.matchWinningTeam) lines.push(`  Winning Team: +${breakdown.common.matchWinningTeam}`);
    if (breakdown.common.impactPlayer) lines.push(`  Impact Player: +${breakdown.common.impactPlayer}`);
    if (breakdown.common.impactPlayerWinBonus) lines.push(`  Impact Win Bonus: +${breakdown.common.impactPlayerWinBonus}`);
    if (breakdown.common.manOfTheMatch) lines.push(`  Man of Match: +${breakdown.common.manOfTheMatch}`);
  }

  // Batting points
  if (breakdown.batting.total !== 0) {
    lines.push('Batting:');
    if (breakdown.batting.runs) lines.push(`  Runs: +${breakdown.batting.runs}`);
    if (breakdown.batting.fours) lines.push(`  Fours: +${breakdown.batting.fours}`);
    if (breakdown.batting.sixes) lines.push(`  Sixes: +${breakdown.batting.sixes}`);
    if (breakdown.batting.milestoneBonus) lines.push(`  Milestone: +${breakdown.batting.milestoneBonus}`);
    if (breakdown.batting.duckPenalty) lines.push(`  Duck: ${breakdown.batting.duckPenalty}`);
    if (breakdown.batting.lowScorePenalty) lines.push(`  Low Score: ${breakdown.batting.lowScorePenalty}`);
    if (breakdown.batting.strikeRateBonus > 0) lines.push(`  Strike Rate Bonus: +${breakdown.batting.strikeRateBonus}`);
    if (breakdown.batting.strikeRateBonus < 0) lines.push(`  Strike Rate Penalty: ${breakdown.batting.strikeRateBonus}`);
  }

  // Bowling points
  if (breakdown.bowling.total !== 0) {
    lines.push('Bowling:');
    if (breakdown.bowling.wickets) lines.push(`  Wickets: +${breakdown.bowling.wickets}`);
    if (breakdown.bowling.milestoneBonus) lines.push(`  Milestone: +${breakdown.bowling.milestoneBonus}`);
    if (breakdown.bowling.dots) lines.push(`  Dots: +${breakdown.bowling.dots}`);
    if (breakdown.bowling.lbwBowledBonus) lines.push(`  LBW/Bowled: +${breakdown.bowling.lbwBowledBonus}`);
    if (breakdown.bowling.maidens) lines.push(`  Maidens: +${breakdown.bowling.maidens}`);
    if (breakdown.bowling.widePenalty) lines.push(`  Wides: ${breakdown.bowling.widePenalty}`);
    if (breakdown.bowling.noBallPenalty) lines.push(`  No Balls: ${breakdown.bowling.noBallPenalty}`);
    if (breakdown.bowling.economyBonus > 0) lines.push(`  Economy Bonus: +${breakdown.bowling.economyBonus}`);
    if (breakdown.bowling.economyBonus < 0) lines.push(`  Economy Penalty: ${breakdown.bowling.economyBonus}`);
  }

  // Fielding points
  if (breakdown.fielding.total !== 0) {
    lines.push('Fielding:');
    if (breakdown.fielding.catches) lines.push(`  Catches: +${breakdown.fielding.catches}`);
    if (breakdown.fielding.stumpings) lines.push(`  Stumpings: +${breakdown.fielding.stumpings}`);
    if (breakdown.fielding.runOuts) lines.push(`  Run Outs: +${breakdown.fielding.runOuts}`);
    if (breakdown.fielding.multiCatchBonus) lines.push(`  Multi-Catch: +${breakdown.fielding.multiCatchBonus}`);
  }

  lines.push(`Total: ${breakdown.total}`);

  return lines.join('\n');
}
