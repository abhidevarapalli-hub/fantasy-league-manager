/**
 * Cricbuzz API Client
 * Handles all communication with the Cricbuzz API via Supabase Edge Function proxy
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CricbuzzApiOptions {
  endpoint: string;
}

async function callCricbuzzApi<T>(options: CricbuzzApiOptions): Promise<T> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/cricbuzz-proxy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: options.endpoint }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Edge function error:', response.status, errorData);
    throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

// Types
export interface CricbuzzSeries {
  id: number;
  name: string;
  startDt: string;
  endDt: string;
}

export interface CricbuzzMatch {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDesc: string;
  matchFormat: string;
  startDate: string;
  endDate: string;
  state: 'Upcoming' | 'In Progress' | 'Complete';
  status: string;
  team1: {
    teamId: number;
    teamName: string;
    teamSName: string;
  };
  team2: {
    teamId: number;
    teamName: string;
    teamSName: string;
  };
  venueInfo: {
    ground: string;
    city: string;
  };
}

export interface CricbuzzPlayer {
  id: number;
  name: string;
  teamName?: string;
  faceImageId?: number;
}

export interface CricbuzzScorecard {
  scorecard: CricbuzzInnings[];
  ismatchcomplete: boolean;
  status: string;
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

// API Functions

/**
 * Get list of international cricket series
 */
export async function getSeriesList(type: 'international' | 'league' | 'domestic' | 'women' = 'international') {
  const data = await callCricbuzzApi<{
    seriesMapProto: Array<{
      date: string;
      series: CricbuzzSeries[];
    }>;
  }>({
    endpoint: `/series/v1/${type}`,
  });

  // Flatten the series list
  const allSeries: CricbuzzSeries[] = [];
  for (const group of data.seriesMapProto || []) {
    if (group.series) {
      allSeries.push(...group.series);
    }
  }
  return allSeries;
}

/**
 * Get matches for a specific series
 */
export async function getSeriesMatches(seriesId: number): Promise<CricbuzzMatch[]> {
  const data = await callCricbuzzApi<{
    matchDetails: Array<{
      matchDetailsMap?: {
        match: Array<{ matchInfo: CricbuzzMatch }>;
      };
    }>;
  }>({
    endpoint: `/series/v1/${seriesId}`,
  });

  const matches: CricbuzzMatch[] = [];
  for (const detail of data.matchDetails || []) {
    if (detail.matchDetailsMap?.match) {
      for (const m of detail.matchDetailsMap.match) {
        matches.push(m.matchInfo);
      }
    }
  }
  return matches;
}

/**
 * Get recent matches (completed)
 */
export async function getRecentMatches(): Promise<CricbuzzMatch[]> {
  const data = await callCricbuzzApi<{
    typeMatches: Array<{
      matchType: string;
      seriesMatches: Array<{
        seriesAdWrapper?: {
          matches: Array<{ matchInfo: CricbuzzMatch }>;
        };
      }>;
    }>;
  }>({
    endpoint: '/matches/v1/recent',
  });

  const matches: CricbuzzMatch[] = [];
  for (const type of data.typeMatches || []) {
    for (const series of type.seriesMatches || []) {
      if (series.seriesAdWrapper?.matches) {
        for (const m of series.seriesAdWrapper.matches) {
          matches.push(m.matchInfo);
        }
      }
    }
  }
  return matches;
}

/**
 * Search for a player by name
 */
export async function searchPlayer(name: string): Promise<CricbuzzPlayer[]> {
  const data = await callCricbuzzApi<{
    player: CricbuzzPlayer[];
  }>({
    endpoint: `/stats/v1/player/search?plrN=${encodeURIComponent(name)}`,
  });

  return data.player || [];
}

/**
 * Get player info by ID
 */
export async function getPlayerInfo(playerId: number) {
  return callCricbuzzApi<{
    id: number;
    name: string;
    teamName: string;
    role: string;
    bat: string;
    bowl: string;
    intlCareer: object;
  }>({
    endpoint: `/stats/v1/player/${playerId}`,
  });
}

/**
 * Get match scorecard
 */
export async function getMatchScorecard(matchId: number): Promise<CricbuzzScorecard> {
  return callCricbuzzApi<CricbuzzScorecard>({
    endpoint: `/mcenter/v1/${matchId}/hscard`,
  });
}

/**
 * Get match info
 */
export async function getMatchInfo(matchId: number) {
  return callCricbuzzApi<{
    matchInfo: CricbuzzMatch;
    venueInfo: object;
  }>({
    endpoint: `/mcenter/v1/${matchId}`,
  });
}

/**
 * Get Cricbuzz player profile URL
 */
export function getPlayerProfileUrl(playerId: number | string, playerName?: string): string {
  const slug = playerName
    ? playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : 'player';
  return `https://www.cricbuzz.com/profiles/${playerId}/${slug}`;
}
