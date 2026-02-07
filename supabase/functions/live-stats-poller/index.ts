import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const RAPIDAPI_HOST = 'cricbuzz-cricket.p.rapidapi.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface CricbuzzBatsman {
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

interface CricbuzzBowler {
  id: number;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  dots: number;
}

interface CricbuzzInnings {
  inningsid: number;
  batsman: CricbuzzBatsman[];
  bowler: CricbuzzBowler[];
  batteamname: string;
  batteamsname: string;
  score: number;
  wickets: number;
  overs: number;
}

interface CricbuzzScorecard {
  scorecard: CricbuzzInnings[];
  ismatchcomplete: boolean;
  status: string;
  playersOfTheMatch?: Array<{ id: number; name: string }>;
  playersOfTheSeries?: Array<{ id: number; name: string }>;
}

interface ParsedPlayerStats {
  cricbuzzPlayerId: number;
  playerName: string;
  teamName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: string | null;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  lbwBowledCount: number;
  isInPlaying11: boolean;
  teamWon: boolean;
}

interface ScoringRules {
  common: {
    starting11: number;
    matchWinningTeam: number;
    impactPlayer: number;
    impactPlayerWinBonus: number;
    manOfTheMatch: number;
  };
  batting: {
    runs: number;
    four: number;
    six: number;
    milestones: { runs: number; points: number }[];
    duckDismissal: number;
    lowScoreDismissal: number;
    strikeRateBonuses: { minSR: number; maxSR: number; points: number; minBalls?: number; minRuns?: number }[];
  };
  bowling: {
    wickets: number;
    milestones: { wickets: number; points: number }[];
    dotBall: number;
    lbwOrBowledBonus: number;
    widePenalty: number;
    noBallPenalty: number;
    maidenOver: number;
    economyRateBonuses: { minER: number; maxER: number; points: number; minOvers?: number }[];
  };
  fielding: {
    catch: number;
    stumping: number;
    runOut: number;
    multiCatchBonus: { count: number; points: number };
  };
}

// Parse dismissal to extract fielding credits
function parseDismissal(outdec: string): {
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

  const catchMatch = outdec.match(/^c\s+(.+?)\s+b\s+/i);
  if (catchMatch) {
    result.catcherId = catchMatch[1].trim();
  }

  const stumpMatch = outdec.match(/^st\s+(.+?)\s+b\s+/i);
  if (stumpMatch) {
    result.stumperId = stumpMatch[1].trim();
  }

  const runOutMatch = outdec.match(/run out\s*\(([^)]+)\)/i);
  if (runOutMatch) {
    result.runOutContributors = runOutMatch[1].split('/').map(n => n.trim());
  }

  if (outdec.toLowerCase().startsWith('lbw') || outdec.toLowerCase().startsWith('b ')) {
    result.isLbwOrBowled = true;
  }

  return result;
}

function nameMatches(fullName: string, partialName: string): boolean {
  const full = fullName.toLowerCase().trim();
  const partial = partialName.toLowerCase().trim();

  if (full === partial) return true;
  if (full.includes(partial)) return true;

  const lastName = full.split(' ').pop() || '';
  if (partial.includes(lastName) && lastName.length > 2) return true;

  return false;
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

// Parse scorecard and extract all player stats
function parseScorecard(
  scorecard: CricbuzzScorecard,
  winnerTeamName: string | null
): ParsedPlayerStats[] {
  const playerStatsMap = new Map<number, ParsedPlayerStats>();
  const fieldingCredits = new Map<string, { catches: number; stumpings: number; runOuts: number }>();

  for (const innings of scorecard.scorecard) {
    const battingTeamWon = winnerTeamName === innings.batteamname;

    for (const batsman of innings.batsman) {
      const isOut = batsman.outdec !== '' && batsman.outdec !== 'not out';
      const dismissal = parseDismissal(batsman.outdec);

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

      let stats = playerStatsMap.get(batsman.id);
      if (!stats) {
        stats = createEmptyStats(batsman.id, batsman.name, innings.batteamname);
        playerStatsMap.set(batsman.id, stats);
      }

      stats.runs = batsman.runs;
      stats.ballsFaced = batsman.balls;
      stats.fours = batsman.fours;
      stats.sixes = batsman.sixes;
      stats.isOut = isOut;
      stats.dismissalType = isOut ? batsman.outdec : null;
      stats.isInPlaying11 = true;
      stats.teamWon = battingTeamWon;
    }

    const bowlingTeamWon = !battingTeamWon;
    for (const bowler of innings.bowler) {
      let stats = playerStatsMap.get(bowler.id);
      if (!stats) {
        stats = createEmptyStats(bowler.id, bowler.name, 'Unknown');
        playerStatsMap.set(bowler.id, stats);
      }

      stats.overs += parseFloat(bowler.overs) || 0;
      stats.maidens += bowler.maidens;
      stats.runsConceded += bowler.runs;
      stats.wickets += bowler.wickets;
      stats.dots += bowler.dots || 0;
      stats.isInPlaying11 = true;
      stats.teamWon = bowlingTeamWon;
    }
  }

  const allStats = Array.from(playerStatsMap.values());
  for (const stats of allStats) {
    for (const [fielderName, credits] of fieldingCredits.entries()) {
      if (nameMatches(stats.playerName, fielderName)) {
        stats.catches += credits.catches;
        stats.stumpings += credits.stumpings;
        stats.runOuts += credits.runOuts;
        fieldingCredits.delete(fielderName);
        break;
      }
    }
  }

  // Count LBW/Bowled dismissals
  for (const innings of scorecard.scorecard) {
    for (const batsman of innings.batsman) {
      const dismissal = parseDismissal(batsman.outdec);
      if (dismissal.isLbwOrBowled) {
        const bowlerMatch = batsman.outdec.match(/b\s+(.+)$/i);
        if (bowlerMatch) {
          const bowlerName = bowlerMatch[1].trim();
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

// Calculate fantasy points for a player
function calculateFantasyPoints(stats: ParsedPlayerStats, rules: ScoringRules, isManOfMatch: boolean): number {
  let total = 0;

  // Common points
  if (stats.isInPlaying11) total += rules.common.starting11;
  if (stats.teamWon) total += rules.common.matchWinningTeam;
  if (isManOfMatch) total += rules.common.manOfTheMatch;

  // Batting points
  total += stats.runs * rules.batting.runs;
  total += stats.fours * rules.batting.four;
  total += stats.sixes * rules.batting.six;

  // Batting milestones
  for (const milestone of rules.batting.milestones) {
    if (stats.runs >= milestone.runs) {
      total = total - (total > 0 ? 0 : 0); // Reset milestone
      total += milestone.points;
    }
  }
  // Only apply highest milestone
  let milestoneBonus = 0;
  for (const milestone of rules.batting.milestones) {
    if (stats.runs >= milestone.runs) {
      milestoneBonus = milestone.points;
    }
  }
  total += milestoneBonus;

  // Duck penalty
  if (stats.runs === 0 && stats.isOut) {
    total += rules.batting.duckDismissal;
  } else if (stats.runs > 0 && stats.runs <= 5 && stats.isOut) {
    total += rules.batting.lowScoreDismissal;
  }

  // Strike rate bonus/penalty
  if (stats.ballsFaced > 0) {
    const strikeRate = (stats.runs / stats.ballsFaced) * 100;
    for (const srBonus of rules.batting.strikeRateBonuses) {
      const meetsMinBalls = !srBonus.minBalls || stats.ballsFaced >= srBonus.minBalls;
      const meetsMinRuns = !srBonus.minRuns || stats.runs >= srBonus.minRuns;
      if (strikeRate >= srBonus.minSR && strikeRate <= srBonus.maxSR && meetsMinBalls && meetsMinRuns) {
        total += srBonus.points;
        break;
      }
    }
  }

  // Bowling points
  total += stats.wickets * rules.bowling.wickets;

  // Bowling milestones
  let wicketMilestoneBonus = 0;
  for (const milestone of rules.bowling.milestones) {
    if (stats.wickets >= milestone.wickets) {
      wicketMilestoneBonus = milestone.points;
    }
  }
  total += wicketMilestoneBonus;

  total += stats.dots * rules.bowling.dotBall;
  total += stats.lbwBowledCount * rules.bowling.lbwOrBowledBonus;
  total += stats.maidens * rules.bowling.maidenOver;

  // Economy rate bonus/penalty
  if (stats.overs >= 1) {
    const economy = stats.runsConceded / stats.overs;
    for (const erBonus of rules.bowling.economyRateBonuses) {
      const meetsMinOvers = !erBonus.minOvers || stats.overs >= erBonus.minOvers;
      if (economy >= erBonus.minER && economy <= erBonus.maxER && meetsMinOvers) {
        total += erBonus.points;
        break;
      }
    }
  }

  // Fielding points
  total += stats.catches * rules.fielding.catch;
  total += stats.stumpings * rules.fielding.stumping;
  total += stats.runOuts * rules.fielding.runOut;

  if (stats.catches >= rules.fielding.multiCatchBonus.count) {
    total += rules.fielding.multiCatchBonus.points;
  }

  return total;
}

// Extract Man of Match from scorecard response
function extractManOfMatch(scorecard: CricbuzzScorecard): { id: number; name: string } | null {
  if (scorecard.playersOfTheMatch && scorecard.playersOfTheMatch.length > 0) {
    return scorecard.playersOfTheMatch[0];
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');

    if (!rapidApiKey) {
      throw new Error('RAPIDAPI_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { cricbuzz_match_id } = body;

    if (!cricbuzz_match_id) {
      return new Response(
        JSON.stringify({ error: 'Missing cricbuzz_match_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Polling match ${cricbuzz_match_id}...`);

    // Fetch scorecard from Cricbuzz
    const cricbuzzUrl = `https://${RAPIDAPI_HOST}/mcenter/v1/${cricbuzz_match_id}/hscard`;
    const response = await fetch(cricbuzzUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      throw new Error(`Cricbuzz API error: ${response.status}`);
    }

    const scorecard: CricbuzzScorecard = await response.json();
    const isMatchComplete = scorecard.ismatchcomplete;
    const matchState = isMatchComplete ? 'Complete' : 'Live';

    // Determine winner from status
    const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
    const winnerTeamName = winnerMatch ? winnerMatch[1] : null;

    // Parse scorecard
    const parsedStats = parseScorecard(scorecard, winnerTeamName);

    // Extract Man of Match if match is complete
    const manOfMatch = isMatchComplete ? extractManOfMatch(scorecard) : null;

    // Find all leagues that have this match
    const { data: leagues, error: leaguesError } = await supabase
      .rpc('get_leagues_for_cricbuzz_match', { p_cricbuzz_match_id: cricbuzz_match_id });

    if (leaguesError) {
      throw new Error(`Failed to get leagues: ${leaguesError.message}`);
    }

    if (!leagues || leagues.length === 0) {
      console.log(`No leagues found for match ${cricbuzz_match_id}`);
      // Still record success to update poll count
      await supabase.rpc('record_poll_success', {
        p_cricbuzz_match_id: cricbuzz_match_id,
        p_match_state: matchState,
      });

      return new Response(
        JSON.stringify({
          success: true,
          matchId: cricbuzz_match_id,
          matchState,
          leaguesProcessed: 0,
          message: 'No leagues found for this match',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalStatsUpserted = 0;

    // Process each league
    for (const league of leagues) {
      const { league_id, match_id, scoring_rules } = league;

      // Default scoring rules if not set
      const rules: ScoringRules = scoring_rules || {
        common: { starting11: 5, matchWinningTeam: 5, impactPlayer: 5, impactPlayerWinBonus: 5, manOfTheMatch: 50 },
        batting: {
          runs: 1, four: 1, six: 2,
          milestones: [
            { runs: 25, points: 10 }, { runs: 40, points: 15 }, { runs: 60, points: 20 },
            { runs: 80, points: 25 }, { runs: 100, points: 40 }, { runs: 150, points: 80 },
          ],
          duckDismissal: -10, lowScoreDismissal: -5,
          strikeRateBonuses: [
            { minSR: 0, maxSR: 99.99, points: -30, minBalls: 10 },
            { minSR: 200.01, maxSR: 999.99, points: 30, minRuns: 10 },
          ],
        },
        bowling: {
          wickets: 30,
          milestones: [
            { wickets: 2, points: 10 }, { wickets: 3, points: 20 }, { wickets: 4, points: 30 },
            { wickets: 5, points: 40 }, { wickets: 6, points: 60 },
          ],
          dotBall: 1, lbwOrBowledBonus: 5, widePenalty: -1, noBallPenalty: -5, maidenOver: 40,
          economyRateBonuses: [
            { minER: 0, maxER: 3.99, points: 40, minOvers: 2 },
            { minER: 10.01, maxER: 99.99, points: -15, minOvers: 2 },
          ],
        },
        fielding: { catch: 10, stumping: 20, runOut: 10, multiCatchBonus: { count: 2, points: 10 } },
      };

      // Get league players with cricbuzz_id mapping
      const { data: leaguePlayers } = await supabase
        .from('league_players')
        .select('id, name, cricbuzz_id')
        .eq('league_id', league_id);

      // Get managers with rosters
      const { data: managers } = await supabase
        .from('managers')
        .select('id, name, roster, bench')
        .eq('league_id', league_id);

      // Create lookup maps
      const cricbuzzToPlayer = new Map<string, { playerId: string; playerName: string }>();
      if (leaguePlayers) {
        for (const player of leaguePlayers) {
          if (player.cricbuzz_id) {
            cricbuzzToPlayer.set(player.cricbuzz_id, {
              playerId: player.id!,
              playerName: player.name!,
            });
          }
        }
      }

      const playerToManager = new Map<string, { managerId: string; isActive: boolean }>();
      if (managers) {
        for (const manager of managers) {
          const roster = manager.roster || [];
          const bench = manager.bench || [];

          for (const playerId of roster) {
            playerToManager.set(playerId, { managerId: manager.id, isActive: true });
          }
          for (const playerId of bench) {
            playerToManager.set(playerId, { managerId: manager.id, isActive: false });
          }
        }
      }

      // Get current week from league_matches (league-specific data)
      const { data: leagueMatchData } = await supabase
        .from('league_matches')
        .select('week')
        .eq('league_id', league_id)
        .eq('match_id', match_id)
        .single();

      const week = leagueMatchData?.week || 1;

      // Prepare stats records
      const records = parsedStats
        .filter(s => cricbuzzToPlayer.has(s.cricbuzzPlayerId.toString()))
        .map(s => {
          const cricbuzzId = s.cricbuzzPlayerId.toString();
          const leaguePlayer = cricbuzzToPlayer.get(cricbuzzId)!;
          const ownership = playerToManager.get(leaguePlayer.playerId);
          const isManOfMatch = manOfMatch?.id === s.cricbuzzPlayerId;
          const fantasyPoints = calculateFantasyPoints(s, rules, isManOfMatch);

          return {
            league_id,
            match_id,
            player_id: leaguePlayer.playerId,
            cricbuzz_player_id: cricbuzzId,
            manager_id: ownership?.managerId || null,
            was_in_active_roster: ownership?.isActive ?? false,
            week,
            runs: s.runs,
            balls_faced: s.ballsFaced,
            fours: s.fours,
            sixes: s.sixes,
            strike_rate: s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : null,
            is_out: s.isOut,
            dismissal_type: s.dismissalType,
            overs: s.overs,
            maidens: s.maidens,
            runs_conceded: s.runsConceded,
            wickets: s.wickets,
            economy: s.overs > 0 ? s.runsConceded / s.overs : null,
            dots: s.dots,
            lbw_bowled_count: s.lbwBowledCount,
            catches: s.catches,
            stumpings: s.stumpings,
            run_outs: s.runOuts,
            is_in_playing_11: s.isInPlaying11,
            is_impact_player: false,
            is_man_of_match: isManOfMatch,
            team_won: s.teamWon,
            fantasy_points: fantasyPoints,
            is_live_stats: !isMatchComplete,
            live_updated_at: new Date().toISOString(),
            finalized_at: isMatchComplete ? new Date().toISOString() : null,
          };
        });

      if (records.length > 0) {
        const { error: upsertError } = await supabase
          .from('player_match_stats')
          .upsert(records, {
            onConflict: 'league_id,cricbuzz_player_id,match_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Error upserting stats for league ${league_id}:`, upsertError);
        } else {
          totalStatsUpserted += records.length;
        }
      }

      // Update cricket_matches (shared data)
      if (isMatchComplete) {
        await supabase
          .from('cricket_matches')
          .update({
            match_state: 'Complete',
            man_of_match_id: manOfMatch?.id?.toString() || null,
            man_of_match_name: manOfMatch?.name || null,
            result: scorecard.status,
          })
          .eq('id', match_id);

        // Update league_matches (league-specific data)
        await supabase
          .from('league_matches')
          .update({
            stats_imported: true,
            stats_imported_at: new Date().toISOString(),
          })
          .eq('league_id', league_id)
          .eq('match_id', match_id);
      } else {
        // Update match state to Live (shared data only)
        await supabase
          .from('cricket_matches')
          .update({
            match_state: 'Live',
            result: scorecard.status,
          })
          .eq('id', match_id);
      }
    }

    // Record successful poll
    await supabase.rpc('record_poll_success', {
      p_cricbuzz_match_id: cricbuzz_match_id,
      p_match_state: matchState,
    });

    console.log(`Poll complete for match ${cricbuzz_match_id}: ${totalStatsUpserted} stats upserted across ${leagues.length} leagues`);

    return new Response(
      JSON.stringify({
        success: true,
        matchId: cricbuzz_match_id,
        matchState,
        isComplete: isMatchComplete,
        manOfMatch: manOfMatch,
        leaguesProcessed: leagues.length,
        statsUpserted: totalStatsUpserted,
        status: scorecard.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Live stats poller error:', error);

    // Try to record the error
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.cricbuzz_match_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase.rpc('record_poll_error', {
          p_cricbuzz_match_id: body.cricbuzz_match_id,
          p_error_message: error.message,
        });
      }
    } catch (e) {
      console.error('Failed to record error:', e);
    }

    return new Response(
      JSON.stringify({ error: 'Polling failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
