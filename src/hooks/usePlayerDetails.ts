/**
 * Hook for fetching player details from Cricbuzz API
 * Implements on-demand fetching with caching via React Query
 */

import { useQuery } from '@tanstack/react-query';
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
function transformRankings(apiRankings: Record<string, string> | undefined): RankingEntry[] {
  if (!apiRankings || Object.keys(apiRankings).length === 0) return [];

  const entries: RankingEntry[] = [];

  // Map API fields to display format
  const formats = [
    { key: 'testRank', bestKey: 'testBestRank', type: 'Test' },
    { key: 't20Rank', bestKey: 't20BestRank', type: 'T20I' },
    { key: 'odiRank', bestKey: 'odiBestRank', type: 'ODI' },
  ];

  for (const format of formats) {
    const rank = apiRankings[format.key];
    if (rank && rank !== '-') {
      entries.push({
        type: format.type,
        rank: parseInt(rank, 10),
        best: apiRankings[format.bestKey] ? parseInt(apiRankings[format.bestKey], 10) : undefined,
      });
    }
  }

  return entries;
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
 * This includes the Cricbuzz ID and image ID linked to our player records
 * @param playerId - The app's player UUID (from players table)
 */
export function useExtendedPlayer(playerId: string | null) {
  return useQuery({
    queryKey: ['extended-player', playerId],
    queryFn: async () => {
      if (!playerId) throw new Error('Player ID required');

      const { data, error } = await supabase
        .from('extended_players' as any)
        .select('*')
        .eq('player_id', playerId)
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
      
      // Cast to any to access fields not in generated types
      const row = data as any;
      
      return {
        playerId: row.player_id,
        cricbuzzId: row.cricbuzz_id,
        imageId: row.image_id,
        battingStyle: row.batting_style,
        bowlingStyle: row.bowling_style,
        dob: row.dob,
        birthPlace: row.birth_place,
        height: row.height,
        bio: row.bio,
      } as ExtendedPlayerData;
    },
    enabled: !!playerId,
    staleTime: 30 * 60 * 1000, // 30 minutes - extended data doesn't change often
    retry: 1,
  });
}

/**
 * Fetch detailed player information
 * @param cricbuzzPlayerId - The Cricbuzz player ID (from TournamentPlayer.id)
 */
export function usePlayerInfo(cricbuzzPlayerId: string | null) {
  return useQuery({
    queryKey: ['player', 'info', cricbuzzPlayerId],
    queryFn: async () => {
      if (!cricbuzzPlayerId) throw new Error('Player ID required');
      const response = await fetchPlayerInfo(cricbuzzPlayerId);
      return transformPlayerInfo(response);
    },
    enabled: !!cricbuzzPlayerId && isApiConfigured(),
    staleTime: 10 * 60 * 1000, // 10 minutes - player info doesn't change often
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
      const response = await fetchSeriesMatches(seriesId);
      return extractSeriesMatches(response);
    },
    enabled: !!seriesId && isApiConfigured(),
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
