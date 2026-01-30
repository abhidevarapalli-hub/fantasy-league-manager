/**
 * Cricbuzz Stats Service
 * Handles fetching and parsing match scorecards from Cricbuzz API
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateFantasyPoints, type PlayerStats } from './fantasy-points-calculator';
import type { ScoringRules } from './scoring-types';

// Types for Cricbuzz API responses
export interface CricbuzzBatsman {
  id: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strkrate: string;
  outdec: string;
  iscaptain: boolean;
  iskeeper: boolean;
}

export interface CricbuzzBowler {
  id: number;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  dots: number;
}

export interface CricbuzzInnings {
  inningsid: number;
  batsman: CricbuzzBatsman[];
  bowler: CricbuzzBowler[];
  batteamname: string;
  batteamsname: string;
  score: number;
  wickets: number;
  overs: number;
}

export interface CricbuzzScorecard {
  scorecard: CricbuzzInnings[];
  ismatchcomplete: boolean;
  status: string;
}

export interface CricbuzzMatchInfo {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDesc: string;
  matchFormat: string;
  team1: { teamId: number; teamName: string; teamSName: string };
  team2: { teamId: number; teamName: string; teamSName: string };
  venueInfo: { ground: string; city: string };
  status: string;
  state: string;
}

// Parsed player stats for our system
export interface ParsedPlayerStats {
  cricbuzzPlayerId: number;
  playerName: string;
  teamName: string;
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: string | null;
  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  // Derived
  catches: number;
  stumpings: number;
  runOuts: number;
  lbwBowledCount: number;
  // Context
  isInPlaying11: boolean;
  teamWon: boolean;
}

// Player with ownership info for import preview
export interface PlayerStatsWithOwnership extends ParsedPlayerStats {
  leaguePlayerId: string | null;
  leaguePlayerName: string | null;
  managerId: string | null;
  managerName: string | null;
  teamName: string;
  isInActiveRoster: boolean;
  fantasyPoints: number;
  pointsBreakdown: ReturnType<typeof calculateFantasyPoints>;
}

/**
 * Parse dismissal string to extract fielding contributions
 * Examples:
 * - "c Hardik Pandya b Harshit Rana" -> catch by Hardik Pandya
 * - "st Ishan Kishan b Kuldeep" -> stumping by Ishan Kishan
 * - "run out (Jadeja/Kishan)" -> run out contribution
 * - "lbw b Bumrah" -> LBW dismissal
 * - "b Bumrah" -> bowled
 */
export function parseDismissal(outdec: string): {
  catcherId: string | null;
  stumperId: string | null;
  runOutContributors: string[];
  isLbwOrBowled: boolean;
} {
  const result = {
    catcherId: null as string | null,
    stumperId: null as string | null,
    runOutContributors: [] as string[],
    isLbwOrBowled: false,
  };

  if (!outdec || outdec === 'not out') return result;

  // Check for catch: "c FielderName b BowlerName"
  const catchMatch = outdec.match(/^c\s+(.+?)\s+b\s+/i);
  if (catchMatch) {
    result.catcherId = catchMatch[1].trim();
  }

  // Check for stumping: "st KeeperName b BowlerName"
  const stumpMatch = outdec.match(/^st\s+(.+?)\s+b\s+/i);
  if (stumpMatch) {
    result.stumperId = stumpMatch[1].trim();
  }

  // Check for run out: "run out (Name)" or "run out (Name1/Name2)"
  const runOutMatch = outdec.match(/run out\s*\(([^)]+)\)/i);
  if (runOutMatch) {
    result.runOutContributors = runOutMatch[1].split('/').map(n => n.trim());
  }

  // Check for LBW or bowled
  if (outdec.toLowerCase().startsWith('lbw') || outdec.toLowerCase().startsWith('b ')) {
    result.isLbwOrBowled = true;
  }

  return result;
}

/**
 * Parse scorecard and extract all player stats
 */
export function parseScorecard(
  scorecard: CricbuzzScorecard,
  winnerTeamName: string | null
): ParsedPlayerStats[] {
  const playerStatsMap = new Map<number, ParsedPlayerStats>();
  const fieldingCredits = new Map<string, { catches: number; stumpings: number; runOuts: number }>();
  const bowlerLbwBowledCount = new Map<number, number>();

  // Process each innings
  for (const innings of scorecard.scorecard) {
    const battingTeamWon = winnerTeamName === innings.batteamname;

    // Process batsmen
    for (const batsman of innings.batsman) {
      const isOut = batsman.outdec !== '' && batsman.outdec !== 'not out';

      // Parse dismissal for fielding credits
      const dismissal = parseDismissal(batsman.outdec);

      // Track fielding credits by name (we'll match to IDs later)
      if (dismissal.catcherId) {
        const credits = fieldingCredits.get(dismissal.catcherId) || { catches: 0, stumpings: 0, runOuts: 0 };
        credits.catches++;
        fieldingCredits.set(dismissal.catcherId, credits);
      }
      if (dismissal.stumperId) {
        const credits = fieldingCredits.get(dismissal.stumperId) || { catches: 0, stumpings: 0, runOuts: 0 };
        credits.stumpings++;
        fieldingCredits.set(dismissal.stumperId, credits);
      }
      for (const contributor of dismissal.runOutContributors) {
        const credits = fieldingCredits.get(contributor) || { catches: 0, stumpings: 0, runOuts: 0 };
        credits.runOuts++;
        fieldingCredits.set(contributor, credits);
      }

      // Track LBW/Bowled for bowlers
      if (dismissal.isLbwOrBowled) {
        const bowlerMatch = batsman.outdec.match(/b\s+(.+)$/i);
        if (bowlerMatch) {
          // We'll match bowler name to ID later
        }
      }

      // Get or create player stats
      let stats = playerStatsMap.get(batsman.id);
      if (!stats) {
        stats = createEmptyStats(batsman.id, batsman.name, innings.batteamname);
        playerStatsMap.set(batsman.id, stats);
      }

      // Update batting stats
      stats.runs = batsman.runs;
      stats.ballsFaced = batsman.balls;
      stats.fours = batsman.fours;
      stats.sixes = batsman.sixes;
      stats.isOut = isOut;
      stats.dismissalType = isOut ? batsman.outdec : null;
      stats.isInPlaying11 = true;
      stats.teamWon = battingTeamWon;
    }

    // Process bowlers (bowling team is opposite of batting team)
    const bowlingTeamWon = !battingTeamWon;
    for (const bowler of innings.bowler) {
      let stats = playerStatsMap.get(bowler.id);
      if (!stats) {
        // Bowler's team is opposite of batting team
        const bowlerTeam = innings.batteamname; // This is wrong, we need to figure out bowling team
        stats = createEmptyStats(bowler.id, bowler.name, 'Unknown');
        playerStatsMap.set(bowler.id, stats);
      }

      // Update bowling stats (accumulate across innings)
      stats.overs += parseFloat(bowler.overs) || 0;
      stats.maidens += bowler.maidens;
      stats.runsConceded += bowler.runs;
      stats.wickets += bowler.wickets;
      stats.dots += bowler.dots || 0;
      stats.isInPlaying11 = true;
      stats.teamWon = bowlingTeamWon;
    }
  }

  // Apply fielding credits by matching names
  const allStats = Array.from(playerStatsMap.values());
  for (const stats of allStats) {
    // Try to find fielding credits by player name (partial match)
    for (const [fielderName, credits] of fieldingCredits.entries()) {
      if (nameMatches(stats.playerName, fielderName)) {
        stats.catches += credits.catches;
        stats.stumpings += credits.stumpings;
        stats.runOuts += credits.runOuts;
        fieldingCredits.delete(fielderName); // Remove to avoid double counting
        break;
      }
    }
  }

  // Count LBW/Bowled dismissals for each bowler
  for (const innings of scorecard.scorecard) {
    for (const batsman of innings.batsman) {
      const dismissal = parseDismissal(batsman.outdec);
      if (dismissal.isLbwOrBowled) {
        const bowlerMatch = batsman.outdec.match(/b\s+(.+)$/i);
        if (bowlerMatch) {
          const bowlerName = bowlerMatch[1].trim();
          // Find bowler by name
          for (const stats of allStats) {
            if (nameMatches(stats.playerName, bowlerName) && stats.wickets > 0) {
              stats.lbwBowledCount++;
              break;
            }
          }
        }
      }
    }
  }

  return allStats;
}

function createEmptyStats(id: number, name: string, team: string): ParsedPlayerStats {
  return {
    cricbuzzPlayerId: id,
    playerName: name,
    teamName: team,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    dismissalType: null,
    overs: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    dots: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    lbwBowledCount: 0,
    isInPlaying11: false,
    teamWon: false,
  };
}

function nameMatches(fullName: string, partialName: string): boolean {
  const full = fullName.toLowerCase().trim();
  const partial = partialName.toLowerCase().trim();

  // Exact match
  if (full === partial) return true;

  // Full name contains partial
  if (full.includes(partial)) return true;

  // Partial contains last name
  const lastName = full.split(' ').pop() || '';
  if (partial.includes(lastName) && lastName.length > 2) return true;

  return false;
}

/**
 * Match parsed stats to league players and calculate fantasy points
 */
export async function matchStatsToLeaguePlayers(
  parsedStats: ParsedPlayerStats[],
  leagueId: string,
  scoringRules: ScoringRules
): Promise<PlayerStatsWithOwnership[]> {
  // Fetch league players with their cricbuzz mappings
  const { data: extendedPlayers } = await supabase
    .from('extended_players')
    .select(`
      player_id,
      cricbuzz_id,
      players!inner (
        id,
        name,
        team,
        league_id
      )
    `)
    .eq('players.league_id', leagueId);

  // Fetch managers with their rosters
  const { data: managers } = await supabase
    .from('managers')
    .select('id, name, team_name, roster, bench')
    .eq('league_id', leagueId);

  // Create lookup maps
  const cricbuzzToPlayer = new Map<string, { playerId: string; playerName: string }>();
  if (extendedPlayers) {
    for (const ep of extendedPlayers) {
      const player = ep.players as unknown as { id: string; name: string };
      cricbuzzToPlayer.set(ep.cricbuzz_id, {
        playerId: player.id,
        playerName: player.name,
      });
    }
  }

  const playerToManager = new Map<string, { managerId: string; managerName: string; teamName: string; isActive: boolean }>();
  if (managers) {
    for (const manager of managers) {
      const roster = manager.roster || [];
      const bench = manager.bench || [];

      for (const playerId of roster) {
        playerToManager.set(playerId, {
          managerId: manager.id,
          managerName: manager.name,
          teamName: manager.team_name,
          isActive: true,
        });
      }
      for (const playerId of bench) {
        playerToManager.set(playerId, {
          managerId: manager.id,
          managerName: manager.name,
          teamName: manager.team_name,
          isActive: false,
        });
      }
    }
  }

  // Match stats to league players and calculate points
  const results: PlayerStatsWithOwnership[] = [];

  for (const stats of parsedStats) {
    const cricbuzzId = stats.cricbuzzPlayerId.toString();
    const leaguePlayer = cricbuzzToPlayer.get(cricbuzzId);
    const ownership = leaguePlayer ? playerToManager.get(leaguePlayer.playerId) : null;

    // Convert to PlayerStats format for calculation
    const playerStats: PlayerStats = {
      runs: stats.runs,
      ballsFaced: stats.ballsFaced,
      fours: stats.fours,
      sixes: stats.sixes,
      isOut: stats.isOut,
      overs: stats.overs,
      maidens: stats.maidens,
      runsConceded: stats.runsConceded,
      wickets: stats.wickets,
      dots: stats.dots,
      wides: 0, // Not available from scorecard
      noBalls: 0, // Not available from scorecard
      lbwBowledCount: stats.lbwBowledCount,
      catches: stats.catches,
      stumpings: stats.stumpings,
      runOuts: stats.runOuts,
      isInPlaying11: stats.isInPlaying11,
      isImpactPlayer: false, // Would need to be set manually
      isManOfMatch: false, // Would need to be set manually
      teamWon: stats.teamWon,
    };

    const pointsBreakdown = calculateFantasyPoints(playerStats, scoringRules);

    results.push({
      ...stats,
      leaguePlayerId: leaguePlayer?.playerId || null,
      leaguePlayerName: leaguePlayer?.playerName || null,
      managerId: ownership?.managerId || null,
      managerName: ownership?.managerName || null,
      teamName: ownership?.teamName || stats.teamName,
      isInActiveRoster: ownership?.isActive ?? false,
      fantasyPoints: pointsBreakdown.total,
      pointsBreakdown,
    });
  }

  // Sort: owned players first, then by points
  results.sort((a, b) => {
    if (a.managerId && !b.managerId) return -1;
    if (!a.managerId && b.managerId) return 1;
    return b.fantasyPoints - a.fantasyPoints;
  });

  return results;
}

/**
 * Save imported stats to database
 */
export async function saveMatchStats(
  leagueId: string,
  matchId: string,
  week: number,
  stats: PlayerStatsWithOwnership[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prepare records for insertion
    const records = stats
      .filter(s => s.leaguePlayerId) // Only save stats for players in the league
      .map(s => ({
        league_id: leagueId,
        match_id: matchId,
        player_id: s.leaguePlayerId,
        cricbuzz_player_id: s.cricbuzzPlayerId.toString(),
        manager_id: s.managerId,
        was_in_active_roster: s.isInActiveRoster,
        week: week,
        // Batting
        runs: s.runs,
        balls_faced: s.ballsFaced,
        fours: s.fours,
        sixes: s.sixes,
        strike_rate: s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : null,
        is_out: s.isOut,
        dismissal_type: s.dismissalType,
        // Bowling
        overs: s.overs,
        maidens: s.maidens,
        runs_conceded: s.runsConceded,
        wickets: s.wickets,
        economy: s.overs > 0 ? s.runsConceded / s.overs : null,
        dots: s.dots,
        lbw_bowled_count: s.lbwBowledCount,
        // Fielding
        catches: s.catches,
        stumpings: s.stumpings,
        run_outs: s.runOuts,
        // Context
        is_in_playing_11: s.isInPlaying11,
        is_impact_player: false,
        is_man_of_match: false,
        team_won: s.teamWon,
        // Calculated
        fantasy_points: s.fantasyPoints,
      }));

    if (records.length === 0) {
      return { success: false, error: 'No league players found in this match' };
    }

    // Upsert stats (update if exists, insert if not)
    const { error } = await supabase
      .from('player_match_stats')
      .upsert(records, {
        onConflict: 'league_id,cricbuzz_player_id,match_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error saving match stats:', error);
      return { success: false, error: error.message };
    }

    // Mark match as imported
    await supabase
      .from('cricket_matches')
      .update({
        stats_imported: true,
        stats_imported_at: new Date().toISOString(),
        week: week,
      })
      .eq('id', matchId);

    return { success: true };
  } catch (err) {
    console.error('Error in saveMatchStats:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}
