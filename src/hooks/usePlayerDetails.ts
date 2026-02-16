/**
 * Hook for fetching player details from Cricbuzz API
 * Implements on-demand fetching with caching via React Query
 */

import { useQuery } from '@tanstack/react-query';
import { Tables } from '@/integrations/supabase/types';
import {
  fetchPlayerInfo,
  fetchPlayerBattingStats,
  fetchPlayerBowlingStats,
  fetchScorecardDetails,
  fetchSeriesMatches,
  extractSeriesMatches,
  isApiConfigured,
  PlayerInfoResponse,
  ScorecardResponse,
} from '@/integrations/cricbuzz/client';
import { supabase } from '@/integrations/supabase/client';
import { TournamentPlayer } from '@/lib/cricket-types';

/**
 * Ranking entry for a specific format
 */
interface RankingEntry {
  type: string;
  rank: number;
  best?: number;
}

/**
 * Extended player details combining API data
 */
export interface PlayerDetails {
  id: string;
  name: string;
  nickName?: string;
  role?: string;
  team?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  birthPlace?: string;
  dateOfBirth?: string;
  height?: string;
  imageId?: number;
  bio?: string;
  rankings?: {
    batting?: RankingEntry[];
    bowling?: RankingEntry[];
    allRounder?: RankingEntry[];
  };
}

/**
 * Transform API rankings object to array format
 */
/**
 * Transform API rankings object to array format
 * Note: New API response structure already returns array, so we just pass it through or return empty
 */
function transformRankings(apiRankings: unknown): RankingEntry[] {
  if (Array.isArray(apiRankings)) {
    return apiRankings as RankingEntry[];
  }
  return [];
}

/**
 * Extended player data from database (links to Cricbuzz)
 */
export interface ExtendedPlayerData {
  playerId: string;
  cricbuzzId: string;
  imageId: number | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  dob: string | null;
  birthPlace: string | null;
  height: string | null;
  bio: string | null;
}

/**
 * Transform API response to PlayerDetails
 */
function transformPlayerInfo(response: PlayerInfoResponse): PlayerDetails {
  return {
    id: response.id,
    name: response.name,
    nickName: response.nickName,
    role: response.role,
    team: response.intlTeam,
    battingStyle: response.bat,
    bowlingStyle: response.bowl,
    birthPlace: response.birthPlace,
    dateOfBirth: response.DoB,
    height: response.height,
    imageId: response.faceImageId || response.imageId,
    bio: response.bio,
    rankings: response.rankings ? {
      batting: transformRankings(response.rankings.bat),
      bowling: transformRankings(response.rankings.bowl),
      allRounder: transformRankings(response.rankings.all),
    } : undefined,
  };
}

/**
 * Fetch extended player data from the database
 * This includes the Cricbuzz ID and extended info from master_players
 * @param playerId - The app's player UUID (from master_players table)
 */
export function useExtendedPlayer(playerId: string | null) {
  return useQuery({
    queryKey: ['extended-player', playerId],
    queryFn: async () => {
      if (!playerId) throw new Error('Player ID required');

      const { data, error } = await supabase
        .from('master_players')
        .select('*')
        .eq('id', playerId)
        .maybeSingle();

      if (error) {
        // Table doesn't exist or permission issues - return null gracefully
        if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('406')) {
          return null;
        }
        // Log but don't throw for other errors - extended data is optional
        console.warn('[useExtendedPlayerData] Error fetching extended data:', error.message);
        return null;
      }

      if (!data) return null;

      return {
        playerId: data.id,
        cricbuzzId: data.cricbuzz_id,
        imageId: data.image_id,
        battingStyle: data.batting_style,
        bowlingStyle: data.bowling_style,
        dob: data.dob,
        birthPlace: data.birth_place,
        height: data.height,
        bio: data.bio,
      } as ExtendedPlayerData;
    },
    enabled: !!playerId,
    staleTime: 30 * 60 * 1000, // 30 minutes - extended data doesn't change often
    retry: 1,
  });
}

/**
 * Fetch detailed player information
 * Strategy: Database Cache First -> API Fallback -> Cache Update
 * @param cricbuzzPlayerId - The Cricbuzz player ID (from TournamentPlayer.id)
 */
export function usePlayerInfo(cricbuzzPlayerId: string | null) {
  return useQuery({
    queryKey: ['player', 'info', cricbuzzPlayerId],
    queryFn: async () => {
      console.log(`[TRACE] 1. 🏁 usePlayerInfo Query STARTED for ID: ${cricbuzzPlayerId}`);
      if (!cricbuzzPlayerId) throw new Error('Player ID required');

      const startDb = performance.now();
      console.log(`[TRACE] 2. 🔍 Checking Supabase 'master_players' for cached data...`);

      // 1. Try to fetch from Database Cache (master_players now stores extended info)
      const { data: dbData, error: dbError } = await supabase
        .from('master_players')
        .select('*')
        .eq('cricbuzz_id', cricbuzzPlayerId)
        .maybeSingle();

      const endDb = performance.now();

      if (dbError) console.error('[TRACE] ❌ DB Error:', dbError);

      // 2. Check if Cache Hit (Must have Bio and DOB to be considered valid cache for details)
      if (dbData && dbData.bio && dbData.dob) {
        console.log(`[TRACE] 3. ✅ Supabase CACHE HIT! Returning DB data. (Latency: ${(endDb - startDb).toFixed(2)}ms)`);

        return {
          id: cricbuzzPlayerId,
          name: dbData.name || '',
          role: dbData.primary_role,
          team: dbData.teams?.[0],
          battingStyle: dbData.batting_style,
          bowlingStyle: dbData.bowling_style,
          birthPlace: dbData.birth_place,
          dateOfBirth: dbData.dob,
          height: dbData.height,
          imageId: dbData.image_id,
          bio: dbData.bio,
          // Rankings are not cached in DB
          rankings: undefined,
        } as PlayerDetails;
      }

      console.log(`[TRACE] 3. ⚠️ Supabase CACHE MISS or INCOMPLETE. (Bio/Born missing). Fetching from Cricbuzz API...`);

      // 3. Cache Miss or Incomplete Data -> Fetch from API
      try {
        const startApi = performance.now();
        const response = await fetchPlayerInfo(cricbuzzPlayerId);
        const endApi = performance.now();

        console.log(`[TRACE] 4. 🌐 Cricbuzz API SUCCESS. (Latency: ${(endApi - startApi).toFixed(2)}ms)`);

        const transformed = transformPlayerInfo(response);

        // 4. Update Cache in master_players (Fire and Forget - don't block return)
        if (dbData) {
          console.log(`[TRACE] 5. 💾 Updating Supabase cache with new data...`);
          const updatePayload = {
            bio: transformed.bio,
            dob: transformed.dateOfBirth,
            birth_place: transformed.birthPlace,
            height: transformed.height,
            batting_style: transformed.battingStyle,
            bowling_style: transformed.bowlingStyle,
            image_id: transformed.imageId,
          };

          // Don't await this, let it happen in background
          supabase
            .from('master_players')
            .update(updatePayload)
            .eq('cricbuzz_id', cricbuzzPlayerId)
            .then(({ error }) => {
              if (error) console.error('[TRACE] ❌ Failed to update cache:', error);
              else console.log('[TRACE] ✅ Supabase cache updated successfully');
            });
        } else {
          console.log(`[TRACE] 5. ⚠️ No 'master_players' record found for this cricbuzz_id. Sync might be needed.`);
        }

        return transformed;
      } catch (error) {
        console.error('[TRACE] ❌ Cricbuzz API Fetch Failed:', error);
        throw error;
      }
    },
    enabled: !!cricbuzzPlayerId && isApiConfigured(),
    staleTime: 0,
    gcTime: 0, // Disable caching completely to allow debugging every click
    retry: 2,
  });
}

/**
 * Fetch player's batting statistics
 */
export function usePlayerBattingStats(cricbuzzPlayerId: string | null) {
  return useQuery({
    queryKey: ['player', 'batting-stats', cricbuzzPlayerId],
    queryFn: () => fetchPlayerBattingStats(cricbuzzPlayerId!),
    enabled: !!cricbuzzPlayerId && isApiConfigured(),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch player's bowling statistics
 */
export function usePlayerBowlingStats(cricbuzzPlayerId: string | null) {
  return useQuery({
    queryKey: ['player', 'bowling-stats', cricbuzzPlayerId],
    queryFn: () => fetchPlayerBowlingStats(cricbuzzPlayerId!),
    enabled: !!cricbuzzPlayerId && isApiConfigured(),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch match scorecard
 */
export function useMatchScorecard(matchId: number | null) {
  return useQuery({
    queryKey: ['match', 'scorecard', matchId],
    queryFn: () => fetchScorecardDetails(matchId!),
    enabled: !!matchId && isApiConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes - scores can update during live matches
    retry: 2,
  });
}

/**
 * Fetch all matches for a series/tournament
 */
export function useSeriesMatches(seriesId: number | null) {
  return useQuery({
    queryKey: ['series', 'matches', seriesId],
    queryFn: async () => {
      if (!seriesId) throw new Error('Series ID required');

      // T20 WC 2026: Fetch from Database
      if (seriesId === 11253) {
        const { data, error } = await supabase
          .from('cricket_matches')
          .select('*')
          .eq('series_id', seriesId);

        if (error) {
          console.error('Error fetching schedule from DB:', error);
          throw error;
        }

        // Helper to normalize team codes from DB to match App/Cricbuzz standard
        const normalizeDBTeamCode = (code: string) => {
          const map: Record<string, string> = {
            'OMAN': 'OMN',
            'RSA': 'SA',
            'USA': 'US'
          };
          return map[code] || code;
        };

        // Map DB structure to API structure to maintain compatibility
        return data.map((m: Tables<"cricket_matches">) => ({
          matchInfo: {
            matchId: m.cricbuzz_match_id,
            matchDesc: m.match_description || '',
            matchFormat: m.match_format || 'T20',
            startDate: new Date(m.match_date || Date.now()).getTime().toString(),
            endDate: new Date(m.match_date || Date.now()).getTime().toString(), // Placeholder
            state: m.state || 'Upcoming',
            status: m.result || '',
            team1: {
              teamId: m.team1_id || 0,
              teamName: m.team1_name || '',
              teamSName: normalizeDBTeamCode(m.team1_short || ''),
            },
            team2: {
              teamId: m.team2_id || 0,
              teamName: m.team2_name || '',
              teamSName: normalizeDBTeamCode(m.team2_short || ''),
            },
            venueInfo: {
              ground: m.venue || '',
              city: m.city || '',
              timezone: 'GMT',
            },
            week: m.match_week || 6, // Default to week 6 if null (Knockouts/Super 8)
          },
          matchScore: undefined, // No scores in schedule table yet
        }));
      }

      const response = await fetchSeriesMatches(seriesId);
      return extractSeriesMatches(response);
    },
    enabled: !!seriesId && (seriesId === 11253 || isApiConfigured()),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Player match performance extracted from scorecard
 */
export interface PlayerMatchPerformance {
  matchId: number;
  matchDate: Date;
  opponent: string;
  opponentShort: string;
  venue?: string;
  result?: string;
  /** Whether this is a completed match with stats or an upcoming match */
  isUpcoming?: boolean;
  /** Match state from API (Complete, Upcoming, Live, etc) */
  matchState?: string;
  // Batting
  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  isNotOut?: boolean;
  dismissal?: string;
  battingPosition?: number;
  // Bowling
  overs?: number;
  maidens?: number;
  runsConceded?: number;
  wickets?: number;
  economy?: number;
  // Fielding
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  // Fantasy
  fantasyPoints?: number;
}

/**
 * Hook to get player's schedule (upcoming + past matches) for a series
 * Filters matches by player's team
 */
export function usePlayerSchedule(
  seriesId: number | null,
  playerTeamShort: string | null
) {
  const { data: seriesMatches, isLoading, error } = useSeriesMatches(seriesId);

  // Filter matches for the player's team and sort by date
  const playerMatches = seriesMatches
    ?.filter(match => {
      const { matchInfo } = match;
      return (
        matchInfo.team1.teamSName === playerTeamShort ||
        matchInfo.team2.teamSName === playerTeamShort
      );
    })
    .map(match => {
      const { matchInfo, matchScore } = match;
      const isTeam1 = matchInfo.team1.teamSName === playerTeamShort;
      const opponent = isTeam1 ? matchInfo.team2.teamName : matchInfo.team1.teamName;
      const opponentShort = isTeam1 ? matchInfo.team2.teamSName : matchInfo.team1.teamSName;
      const matchDate = new Date(parseInt(matchInfo.startDate, 10));
      const isUpcoming = matchInfo.state === 'Upcoming' || matchInfo.state === 'Preview';

      return {
        matchId: matchInfo.matchId,
        matchDate,
        opponent,
        opponentShort,
        venue: matchInfo.venueInfo?.ground,
        result: matchInfo.status,
        isUpcoming,
        matchState: matchInfo.state,
        week: matchInfo.week,
        // Score summary for completed matches
        teamScore: isTeam1 ? matchScore?.team1Score : matchScore?.team2Score,
        opponentScore: isTeam1 ? matchScore?.team2Score : matchScore?.team1Score,
      };
    })
    .sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime()) || [];

  return {
    data: playerMatches,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch a player's match stats from player_match_stats table
 * Returns stats keyed by cricbuzz_match_id for easy merging with schedule data
 */
export function usePlayerMatchStats(
  playerId: string | null,
  leagueId: string | null
) {
  return useQuery({
    queryKey: ['player-match-stats', playerId, leagueId],
    queryFn: async () => {
      if (!playerId || !leagueId) throw new Error('Player ID and League ID required');

      const { data, error } = await supabase
        .from('player_match_stats_compat')
        .select(`
          *,
          match:cricket_matches (
            cricbuzz_match_id
          )
        `)
        .eq('player_id', playerId)
        .eq('league_id', leagueId);

      if (error) {
        console.error('[usePlayerMatchStats] Error:', error);
        return new Map<number, PlayerMatchPerformance>();
      }

      // Build a map from cricbuzz_match_id to stats
      const statsMap = new Map<number, PlayerMatchPerformance>();
      for (const row of data || []) {
        const cricbuzzMatchId = row.match?.cricbuzz_match_id;
        if (!cricbuzzMatchId) continue;

        statsMap.set(cricbuzzMatchId, {
          matchId: cricbuzzMatchId,
          matchDate: new Date(row.created_at),
          opponent: '',
          opponentShort: '',
          runs: row.runs ?? undefined,
          ballsFaced: row.balls_faced ?? undefined,
          fours: row.fours ?? undefined,
          sixes: row.sixes ?? undefined,
          strikeRate: row.strike_rate != null ? Number(row.strike_rate) : undefined,
          isNotOut: row.is_out === false,
          overs: row.overs != null ? Number(row.overs) : undefined,
          maidens: row.maidens ?? undefined,
          runsConceded: row.runs_conceded ?? undefined,
          wickets: row.wickets ?? undefined,
          economy: row.economy != null ? Number(row.economy) : undefined,
          catches: row.catches ?? undefined,
          stumpings: row.stumpings ?? undefined,
          runOuts: row.run_outs ?? undefined,
          fantasyPoints: row.fantasy_points != null ? Number(row.fantasy_points) : undefined,
        });
      }

      return statsMap;
    },
    enabled: !!playerId && !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Extract player's performance from a scorecard
 */
export function extractPlayerPerformance(
  scorecard: ScorecardResponse,
  cricbuzzPlayerId: string,
  playerTeamShort?: string
): PlayerMatchPerformance | null {
  const playerId = parseInt(cricbuzzPlayerId, 10);
  const header = scorecard.matchHeader;

  // Determine opponent based on player's team
  const isTeam1 = playerTeamShort === header.team1.shortName;
  const opponent = isTeam1 ? header.team2.name : header.team1.name;
  const opponentShort = isTeam1 ? header.team2.shortName : header.team1.shortName;

  let battingStats: Partial<PlayerMatchPerformance> = {};
  let bowlingStats: Partial<PlayerMatchPerformance> = {};

  // Search through all innings for this player
  for (const innings of scorecard.scoreCard || []) {
    // Check batting data
    if (innings.batsmanData) {
      for (const batsman of Object.values(innings.batsmanData)) {
        if (batsman.batId === playerId) {
          battingStats = {
            runs: batsman.runs,
            ballsFaced: batsman.balls,
            fours: batsman.fours,
            sixes: batsman.sixes,
            strikeRate: batsman.strikeRate,
            isNotOut: batsman.isNotOut,
            dismissal: batsman.outDesc,
            battingPosition: batsman.batOrder,
          };
        }
      }
    }

    // Check bowling data
    if (innings.bowlersData) {
      for (const bowler of Object.values(innings.bowlersData)) {
        if (bowler.bowlerId === playerId) {
          bowlingStats = {
            overs: bowler.overs,
            maidens: bowler.maidens,
            runsConceded: bowler.runs,
            wickets: bowler.wickets,
            economy: bowler.economy,
          };
        }
      }
    }
  }

  // If player didn't play in this match, return null
  if (!battingStats.runs && battingStats.runs !== 0 && !bowlingStats.overs) {
    return null;
  }

  return {
    matchId: header.matchId,
    matchDate: new Date(header.matchStartTimestamp),
    opponent,
    opponentShort,
    venue: scorecard.venueInfo?.ground,
    result: header.result?.resultType,
    ...battingStats,
    ...bowlingStats,
    // TODO: Add fielding stats when available in API
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}
