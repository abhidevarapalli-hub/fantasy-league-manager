/**
 * Cricbuzz API Client
 * Uses RapidAPI to fetch cricket data
 */

import {
  LiveMatchesResponse,
  MatchDetailResponse,
  CricketMatch,
  extractMatchesFromResponse,
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

// Generic fetch wrapper with error handling
async function fetchFromApi<T>(endpoint: string): Promise<T> {
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

    if (!response.ok) {
      const errorBody = await response.text();
      throw new CricbuzzApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
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
