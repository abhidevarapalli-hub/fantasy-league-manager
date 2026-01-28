/**
 * Cricbuzz API Client
 * Uses RapidAPI to fetch cricket data
 */

import {
  LiveMatchesResponse,
  MatchDetailResponse,
  CricketMatch,
  extractMatchesFromResponse,
  SeriesSquadsResponse,
  SquadPlayersResponse,
  TournamentSquad,
  TournamentPlayer,
  extractSquadsFromResponse,
  extractPlayersFromResponse,
} from '@/lib/cricket-types';

// API Configuration
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const RAPIDAPI_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'cricbuzz-cricket.p.rapidapi.com';

// Use Vite proxy in development to avoid CORS issues
// In production, calls go directly to RapidAPI (requires server-side proxy or CORS-enabled endpoint)
const BASE_URL = import.meta.env.DEV ? '/api/cricbuzz' : `https://${RAPIDAPI_HOST}`;

// Common headers for all requests
const getHeaders = () => ({
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
});

// Custom error class for API errors
export class CricbuzzApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CricbuzzApiError';
  }
}

// Check if API is configured
export function isApiConfigured(): boolean {
  return Boolean(RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here');
}

/**
 * Sleep helper for rate limiting and retries
 */
function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generic fetch wrapper with error handling and retry for rate limits
async function fetchFromApi<T>(endpoint: string, retryCount = 0): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 500; // 500ms base delay for retries
  
  if (retryCount === 0) {
    console.log(`[CricbuzzAPI] 📡 Fetching: ${endpoint}`);
  } else {
    console.log(`[CricbuzzAPI] 🔄 Retry ${retryCount}/${MAX_RETRIES} for: ${endpoint}`);
  }
  
  if (!isApiConfigured()) {
    throw new CricbuzzApiError(
      'RapidAPI key is not configured. Please add VITE_RAPIDAPI_KEY to your .env file.'
    );
  }

  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    // Handle rate limiting with retry
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`[CricbuzzAPI] ⏳ Rate limited, waiting ${delay}ms before retry...`);
      await sleepMs(delay);
      return fetchFromApi<T>(endpoint, retryCount + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[CricbuzzAPI] ❌ Error response (${response.status}):`, errorBody.substring(0, 200));
      throw new CricbuzzApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
    console.log(`[CricbuzzAPI] ✅ Success for ${endpoint.split('/').pop()}`);
    return data as T;
  } catch (error) {
    if (error instanceof CricbuzzApiError) {
      throw error;
    }
    throw new CricbuzzApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch all currently live matches
 */
export async function fetchLiveMatches(): Promise<CricketMatch[]> {
  const response = await fetchFromApi<LiveMatchesResponse>('/matches/v1/live');
  return extractMatchesFromResponse(response);
}

/**
 * Fetch matches by type: 'live' | 'recent' | 'upcoming'
 */
export async function fetchMatchesByType(
  type: 'live' | 'recent' | 'upcoming'
): Promise<CricketMatch[]> {
  const response = await fetchFromApi<LiveMatchesResponse>(`/matches/v1/${type}`);
  return extractMatchesFromResponse(response);
}

/**
 * Fetch detailed match information
 */
export async function fetchMatchInfo(matchId: number): Promise<MatchDetailResponse> {
  return fetchFromApi<MatchDetailResponse>(`/mcenter/v1/${matchId}`);
}

/**
 * Fetch match scorecard
 */
export async function fetchMatchScorecard(matchId: number): Promise<unknown> {
  return fetchFromApi(`/mcenter/v1/${matchId}/scard`);
}

/**
 * Fetch match commentary
 */
export async function fetchMatchCommentary(
  matchId: number,
  inningsId?: number
): Promise<unknown> {
  const endpoint = inningsId
    ? `/mcenter/v1/${matchId}/comm?iid=${inningsId}`
    : `/mcenter/v1/${matchId}/comm`;
  return fetchFromApi(endpoint);
}

/**
 * Fetch over-by-over details
 */
export async function fetchMatchOvers(
  matchId: number,
  inningsId?: number
): Promise<unknown> {
  const endpoint = inningsId
    ? `/mcenter/v1/${matchId}/overs?iid=${inningsId}`
    : `/mcenter/v1/${matchId}/overs`;
  return fetchFromApi(endpoint);
}

// ============================================
// Series/Tournament API Functions
// ============================================

/**
 * Fetch all squads (teams) for a series/tournament
 * @param seriesId - The Cricbuzz series ID (e.g., 11253 for T20 WC 2026)
 */
export async function fetchSeriesSquads(seriesId: number): Promise<TournamentSquad[]> {
  const response = await fetchFromApi<SeriesSquadsResponse>(`/series/v1/${seriesId}/squads`);
  return extractSquadsFromResponse(response);
}

/**
 * Fetch all players for a specific squad in a series
 * @param seriesId - The Cricbuzz series ID
 * @param squadId - The squad ID from fetchSeriesSquads
 */
export async function fetchSquadPlayers(
  seriesId: number,
  squadId: number
): Promise<TournamentPlayer[]> {
  const response = await fetchFromApi<SquadPlayersResponse>(
    `/series/v1/${seriesId}/squads/${squadId}`
  );
  return extractPlayersFromResponse(response);
}

/**
 * Fetch all players for all squads in a tournament
 * Returns players grouped by team
 * 
 * Note: Uses sequential fetching with delays to avoid RapidAPI rate limits
 */
export async function fetchAllTournamentPlayers(
  seriesId: number
): Promise<Array<{ team: TournamentSquad; players: TournamentPlayer[] }>> {
  // First, fetch all squads
  const squads = await fetchSeriesSquads(seriesId);
  console.log(`[CricbuzzAPI] 📋 Found ${squads.length} squads, fetching players sequentially...`);
  
  // Fetch players for each squad SEQUENTIALLY with delay to avoid rate limiting
  // RapidAPI BASIC plan has ~5 requests/second limit
  const results: Array<{ team: TournamentSquad; players: TournamentPlayer[] }> = [];
  
  for (let i = 0; i < squads.length; i++) {
    const squad = squads[i];
    console.log(`[CricbuzzAPI] 📥 Fetching squad ${i + 1}/${squads.length}: ${squad.teamName}`);
    
    try {
      const players = await fetchSquadPlayers(seriesId, squad.squadId);
      results.push({ team: squad, players });
      console.log(`[CricbuzzAPI] ✅ ${squad.teamName}: ${players.length} players`);
    } catch (error) {
      console.error(`[CricbuzzAPI] ❌ Failed to fetch ${squad.teamName}:`, error);
      // Continue with other squads even if one fails
      results.push({ team: squad, players: [] });
    }
    
    // Add 300ms delay between requests to stay under rate limit (~3 req/sec)
    if (i < squads.length - 1) {
      await sleepMs(300);
    }
  }
  
  return results;
}

// ============================================
// Player Detail API Functions
// ============================================

/**
 * Player info response from Cricbuzz API
 */
export interface PlayerInfoResponse {
  id: string;
  name: string;
  nickName?: string;
  role?: string;
  intlTeam?: string;
  bat?: string; // Batting style
  bowl?: string; // Bowling style
  birthPlace?: string;
  DoB?: string; // Date of birth
  height?: string;
  teams?: string;
  imageId?: number;
  bio?: string;
  rankings?: {
    bat?: Array<{ type: string; rank: number; best?: number }>;
    bowl?: Array<{ type: string; rank: number; best?: number }>;
    all?: Array<{ type: string; rank: number; best?: number }>;
  };
  DoBFormat?: string;
  faceImageId?: number;
  appIndex?: unknown;
}

/**
 * Fetch detailed player information from Cricbuzz
 * @param playerId - The Cricbuzz player ID
 */
export async function fetchPlayerInfo(playerId: string | number): Promise<PlayerInfoResponse> {
  return fetchFromApi<PlayerInfoResponse>(`/stats/v1/player/${playerId}`);
}

/**
 * Player batting stats from Cricbuzz API
 */
export interface PlayerBattingStatsResponse {
  headers: string[];
  values: Array<{
    values: string[];
  }>;
}

/**
 * Fetch player's batting statistics
 * @param playerId - The Cricbuzz player ID
 */
export async function fetchPlayerBattingStats(playerId: string | number): Promise<PlayerBattingStatsResponse> {
  return fetchFromApi<PlayerBattingStatsResponse>(`/stats/v1/player/${playerId}/batting`);
}

/**
 * Player bowling stats from Cricbuzz API
 */
export interface PlayerBowlingStatsResponse {
  headers: string[];
  values: Array<{
    values: string[];
  }>;
}

/**
 * Fetch player's bowling statistics
 * @param playerId - The Cricbuzz player ID
 */
export async function fetchPlayerBowlingStats(playerId: string | number): Promise<PlayerBowlingStatsResponse> {
  return fetchFromApi<PlayerBowlingStatsResponse>(`/stats/v1/player/${playerId}/bowling`);
}

// ============================================
// Match Scorecard Types and Functions
// ============================================

/**
 * Batsman scorecard entry
 */
export interface BatsmanScore {
  batId: number;
  batName: string;
  batShortName?: string;
  isCaptain?: boolean;
  isKeeper?: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  outDesc?: string; // Dismissal description
  isNotOut?: boolean;
  batOrder?: number;
}

/**
 * Bowler scorecard entry
 */
export interface BowlerScore {
  bowlerId: number;
  bowlName: string;
  bowlShortName?: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  noBalls?: number;
  wides?: number;
  dots?: number;
}

/**
 * Fielder stats (catches, stumpings, run outs)
 */
export interface FielderStats {
  fielderId: number;
  fielderName: string;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
}

/**
 * Innings scorecard
 */
export interface InningsScorecard {
  inningsId: number;
  batTeamId: number;
  batTeamName: string;
  batTeamShortName?: string;
  score: number;
  wickets: number;
  overs: number;
  isDeclared?: boolean;
  isFollowOn?: boolean;
  batsmanData?: Record<string, BatsmanScore>;
  bowlersData?: Record<string, BowlerScore>;
  extrasData?: {
    byes?: number;
    legByes?: number;
    wides?: number;
    noBalls?: number;
    penalty?: number;
    total?: number;
  };
  partnershipsData?: unknown;
  wicketsData?: unknown;
}

/**
 * Match scorecard response
 */
export interface ScorecardResponse {
  scoreCard: InningsScorecard[];
  matchHeader: {
    matchId: number;
    matchDescription: string;
    matchFormat: string;
    matchType: string;
    complete: boolean;
    domestic: boolean;
    matchStartTimestamp: number;
    matchCompleteTimestamp?: number;
    state: string;
    status: string;
    team1: {
      id: number;
      name: string;
      shortName: string;
      imageId?: number;
    };
    team2: {
      id: number;
      name: string;
      shortName: string;
      imageId?: number;
    };
    seriesId: number;
    seriesName: string;
    result?: {
      resultType: string;
      winningTeam?: string;
      winningTeamId?: number;
      winByRuns?: number;
      winByInnings?: number;
    };
    tossResults?: {
      tossWinnerId: number;
      tossWinnerName: string;
      decision: string;
    };
    playersOfTheMatch?: Array<{
      id: number;
      name: string;
      fullName?: string;
      teamId: number;
    }>;
  };
  isMatchComplete?: boolean;
  status?: string;
  venueInfo?: {
    ground: string;
    city: string;
    timezone: string;
  };
}

/**
 * Fetch complete match scorecard
 * @param matchId - The Cricbuzz match ID
 */
export async function fetchScorecardDetails(matchId: number): Promise<ScorecardResponse> {
  return fetchFromApi<ScorecardResponse>(`/mcenter/v1/${matchId}/scard`);
}

// ============================================
// Series/Tournament Match Functions
// ============================================

/**
 * Series match info from the matches list
 */
export interface SeriesMatchInfo {
  matchId: number;
  matchDesc: string;
  matchFormat: string;
  startDate: string;
  endDate: string;
  state: string;
  status: string;
  team1: {
    teamId: number;
    teamName: string;
    teamSName: string;
    imageId?: number;
  };
  team2: {
    teamId: number;
    teamName: string;
    teamSName: string;
    imageId?: number;
  };
  venueInfo: {
    ground: string;
    city: string;
    timezone: string;
  };
  seriesStartDt?: string;
  seriesEndDt?: string;
}

/**
 * Series matches response
 */
export interface SeriesMatchesResponse {
  matchDetails?: Array<{
    matchDetailsMap?: {
      key: string;
      match: Array<{
        matchInfo: SeriesMatchInfo;
        matchScore?: {
          team1Score?: {
            inngs1?: { runs: number; wickets: number; overs: number };
            inngs2?: { runs: number; wickets: number; overs: number };
          };
          team2Score?: {
            inngs1?: { runs: number; wickets: number; overs: number };
            inngs2?: { runs: number; wickets: number; overs: number };
          };
        };
      }>;
    };
  }>;
  appIndex?: unknown;
}

/**
 * Fetch all matches for a series/tournament
 * @param seriesId - The Cricbuzz series ID
 */
export async function fetchSeriesMatches(seriesId: number): Promise<SeriesMatchesResponse> {
  return fetchFromApi<SeriesMatchesResponse>(`/series/v1/${seriesId}`);
}

/**
 * Extract flat list of matches from series response
 */
export function extractSeriesMatches(response: SeriesMatchesResponse): Array<{
  matchInfo: SeriesMatchInfo;
  matchScore?: {
    team1Score?: string;
    team2Score?: string;
  };
}> {
  const matches: Array<{
    matchInfo: SeriesMatchInfo;
    matchScore?: {
      team1Score?: string;
      team2Score?: string;
    };
  }> = [];

  for (const detail of response.matchDetails || []) {
    if (detail.matchDetailsMap?.match) {
      for (const match of detail.matchDetailsMap.match) {
        const scoreData = match.matchScore;
        let team1Score: string | undefined;
        let team2Score: string | undefined;

        if (scoreData?.team1Score?.inngs1) {
          const inngs = scoreData.team1Score.inngs1;
          team1Score = `${inngs.runs}/${inngs.wickets}`;
          if (scoreData.team1Score.inngs2) {
            const inngs2 = scoreData.team1Score.inngs2;
            team1Score += ` & ${inngs2.runs}/${inngs2.wickets}`;
          }
        }

        if (scoreData?.team2Score?.inngs1) {
          const inngs = scoreData.team2Score.inngs1;
          team2Score = `${inngs.runs}/${inngs.wickets}`;
          if (scoreData.team2Score.inngs2) {
            const inngs2 = scoreData.team2Score.inngs2;
            team2Score += ` & ${inngs2.runs}/${inngs2.wickets}`;
          }
        }

        matches.push({
          matchInfo: match.matchInfo,
          matchScore: team1Score || team2Score ? { team1Score, team2Score } : undefined,
        });
      }
    }
  }

  return matches;
}
