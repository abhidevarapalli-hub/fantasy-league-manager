/**
 * Cricket Types for Cricbuzz API Integration
 * Extensible for future fantasy league integration
 */

// Venue information
export interface VenueInfo {
  id: number;
  ground: string;
  city: string;
  timezone: string;
}

// Team information with score
export interface CricketTeam {
  teamId: number;
  teamName: string;
  teamSName: string; // Short name (e.g., "IND", "AUS")
  imageId?: number;
  // Score information (available during/after match)
  score?: string;
  overs?: string;
}

// Match state types
export type MatchState = 'Live' | 'Complete' | 'Upcoming' | 'Preview' | 'In Progress' | 'Stumps' | 'Innings Break';

// Match format types
export type MatchFormat = 'T20' | 'ODI' | 'TEST' | 'T10';

// Core match type
export interface CricketMatch {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDescription: string;
  matchFormat: MatchFormat | string;
  state: MatchState | string;
  status: string; // e.g., "India need 45 runs to win"
  team1: CricketTeam;
  team2: CricketTeam;
  venueInfo: VenueInfo;
  currentBatTeamId?: number;
  startDate?: string;
  endDate?: string;
  // Extensible for fantasy integration
  fantasyEnabled?: boolean;
}

// Series grouping for matches
export interface MatchSeries {
  seriesId: number;
  seriesName: string;
  seriesAdName?: string;
  matches: CricketMatch[];
}

// API Response types
export interface LiveMatchesResponse {
  typeMatches: TypeMatch[];
}

export interface TypeMatch {
  matchType: string;
  seriesMatches: SeriesMatch[];
}

export interface SeriesMatch {
  seriesAdWrapper?: {
    seriesId: number;
    seriesName: string;
    matches: MatchInfo[];
  };
  adDetail?: unknown;
}

export interface MatchInfo {
  matchInfo: {
    matchId: number;
    seriesId: number;
    seriesName: string;
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
      imageId: number;
    };
    team2: {
      teamId: number;
      teamName: string;
      teamSName: string;
      imageId: number;
    };
    venueInfo: {
      id: number;
      ground: string;
      city: string;
      timezone: string;
    };
    currBatTeamId?: number;
    seriesStartDt?: string;
    seriesEndDt?: string;
  };
  matchScore?: {
    team1Score?: {
      inngs1?: { inningsId: number; runs: number; wickets: number; overs: number };
      inngs2?: { inningsId: number; runs: number; wickets: number; overs: number };
    };
    team2Score?: {
      inngs1?: { inningsId: number; runs: number; wickets: number; overs: number };
      inngs2?: { inningsId: number; runs: number; wickets: number; overs: number };
    };
  };
}

// Match detail response (for future expansion)
export interface MatchDetailResponse {
  matchHeader: {
    matchId: number;
    matchDescription: string;
    matchFormat: string;
    matchType: string;
    complete: boolean;
    domestic: boolean;
    matchStartTimestamp: number;
    matchCompleteTimestamp?: number;
    dayNight: boolean;
    year: number;
    state: string;
    status: string;
    tossResults?: {
      tossWinnerId: number;
      tossWinnerName: string;
      decision: string;
    };
    result?: {
      resultType: string;
      winningTeam: string;
      winningTeamId: number;
      winByRuns?: number;
      winByInnings?: number;
    };
    playersOfTheMatch?: Array<{
      id: number;
      name: string;
      fullName: string;
      teamId: number;
    }>;
    playersOfTheSeries?: Array<{
      id: number;
      name: string;
      fullName: string;
      teamId: number;
    }>;
    team1: CricketTeam;
    team2: CricketTeam;
    seriesDesc: string;
    seriesId: number;
    seriesName: string;
  };
  venueInfo: VenueInfo;
}

// Helper function to transform API response to clean CricketMatch
export function transformMatchInfo(matchInfo: MatchInfo): CricketMatch {
  const info = matchInfo.matchInfo;
  const score = matchInfo.matchScore;

  // Build score strings
  let team1Score: string | undefined;
  let team1Overs: string | undefined;
  let team2Score: string | undefined;
  let team2Overs: string | undefined;

  if (score?.team1Score?.inngs1) {
    const inngs = score.team1Score.inngs1;
    team1Score = `${inngs.runs}/${inngs.wickets}`;
    team1Overs = `${inngs.overs}`;
    if (score.team1Score.inngs2) {
      const inngs2 = score.team1Score.inngs2;
      team1Score += ` & ${inngs2.runs}/${inngs2.wickets}`;
    }
  }

  if (score?.team2Score?.inngs1) {
    const inngs = score.team2Score.inngs1;
    team2Score = `${inngs.runs}/${inngs.wickets}`;
    team2Overs = `${inngs.overs}`;
    if (score.team2Score.inngs2) {
      const inngs2 = score.team2Score.inngs2;
      team2Score += ` & ${inngs2.runs}/${inngs2.wickets}`;
    }
  }

  return {
    matchId: info.matchId,
    seriesId: info.seriesId,
    seriesName: info.seriesName,
    matchDescription: info.matchDesc,
    matchFormat: info.matchFormat,
    state: info.state,
    status: info.status,
    team1: {
      teamId: info.team1.teamId,
      teamName: info.team1.teamName,
      teamSName: info.team1.teamSName,
      imageId: info.team1.imageId,
      score: team1Score,
      overs: team1Overs,
    },
    team2: {
      teamId: info.team2.teamId,
      teamName: info.team2.teamName,
      teamSName: info.team2.teamSName,
      imageId: info.team2.imageId,
      score: team2Score,
      overs: team2Overs,
    },
    venueInfo: {
      id: info.venueInfo.id,
      ground: info.venueInfo.ground,
      city: info.venueInfo.city,
      timezone: info.venueInfo.timezone,
    },
    currentBatTeamId: info.currBatTeamId,
    startDate: info.startDate,
    endDate: info.endDate,
  };
}

// Helper to extract all matches from the API response
export function extractMatchesFromResponse(response: LiveMatchesResponse): CricketMatch[] {
  const matches: CricketMatch[] = [];

  for (const typeMatch of response.typeMatches || []) {
    for (const seriesMatch of typeMatch.seriesMatches || []) {
      if (seriesMatch.seriesAdWrapper?.matches) {
        for (const match of seriesMatch.seriesAdWrapper.matches) {
          matches.push(transformMatchInfo(match));
        }
      }
    }
  }

  return matches;
}

// ============================================
// Tournament/Series Types (for player seeding)
// ============================================

// Squad info from series/squads endpoint
export interface TournamentSquad {
  squadId: number;
  teamName: string;  // e.g., "India", "Australia" or "Mumbai Indians"
  teamId: number;
  imageId?: number;
}

// Raw API response for series squads
export interface SeriesSquadsResponse {
  squads: Array<{
    squadId?: number;
    squadType: string;  // Team name or header like "T20"
    teamId?: number;
    imageId?: number;
    isHeader?: boolean;
  }>;
  seriesName: string;
  seriesId: number;
}

// Player info from series/squads/{squadId} endpoint
export interface TournamentPlayer {
  id: string;
  name: string;
  role: string;  // API roles: Batsman, Bowler, WK-Batsman, Batting Allrounder, Bowling Allrounder
  captain?: boolean;
  imageId?: number;
  battingStyle?: string;
  bowlingStyle?: string;
}

// Raw API response for squad players
export interface SquadPlayersResponse {
  player: Array<{
    id?: string;
    name: string;
    role?: string;
    captain?: boolean;
    imageId?: number;
    battingStyle?: string;
    bowlingStyle?: string;
    isHeader?: boolean;
  }>;
}

// Helper to extract squads from API response (filters out headers)
export function extractSquadsFromResponse(response: SeriesSquadsResponse): TournamentSquad[] {
  return response.squads
    .filter(squad => !squad.isHeader && squad.squadId !== undefined)
    .map(squad => ({
      squadId: squad.squadId!,
      teamName: squad.squadType,
      teamId: squad.teamId || 0,
      imageId: squad.imageId,
    }));
}

// Helper to extract players from API response (filters out headers)
export function extractPlayersFromResponse(response: SquadPlayersResponse): TournamentPlayer[] {
  return response.player
    .filter(player => !player.isHeader && player.id !== undefined)
    .map(player => ({
      id: player.id!,
      name: player.name,
      role: player.role || 'Unknown',
      captain: player.captain,
      imageId: player.imageId,
      battingStyle: player.battingStyle,
      bowlingStyle: player.bowlingStyle,
    }));
}
