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
const BASE_URL = `https://${RAPIDAPI_HOST}`;

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
