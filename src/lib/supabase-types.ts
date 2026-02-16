import type { Tables } from '@/integrations/supabase/types';

// Types for Supabase database tables
export interface DbPlayer {
  id: string;
  name: string;
  team: string;
  role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
  is_international: boolean;
  created_at: string;
}

export interface DbManager {
  id: string;
  name: string;
  team_name: string;
  wins: number;
  losses: number;
  points: number;
  // Note: roster and bench are now stored in manager_roster junction table
  user_id: string | null;
  created_at: string;
}

export interface DbLeagueSchedule {
  id: string;
  league_id: string;
  week: number;
  manager1_id: string;
  manager2_id: string | null;
  manager1_score: number | null;
  manager2_score: number | null;
  winner_id: string | null;
  is_finalized: boolean;
  created_at: string | null;
}

// Keep backward-compatible alias
export type DbSchedule = DbLeagueSchedule;

export interface DbTransaction {
  id: string;
  type: 'add' | 'drop' | 'trade' | 'score';
  manager_id: string | null;
  description: string;
  players: PlayerTransaction[] | null;
  week: number | null;
  created_at: string;
}

export interface PlayerTransaction {
  type: 'add' | 'drop';
  playerName: string;
  role: string;
  team: string;
}

// Mapped types for frontend use
export interface Player {
  id: string;
  name: string;
  team: string;
  role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
  isInternational: boolean;
  imageId?: number;
}

export interface Manager {
  id: string;
  name: string;
  teamName: string;
  wins: number;
  losses: number;
  points: number;
  activeRoster: string[];
  bench: string[];
  userId?: string | null;
}

export interface Match {
  id: string;
  leagueId?: string;
  week: number;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  completed: boolean;
}

export interface Activity {
  id: string;
  timestamp: Date;
  type: 'add' | 'drop' | 'trade' | 'score';
  managerId: string;
  managerTeamName?: string;
  description: string;
  players?: PlayerTransaction[];
}

// Mappers
export const mapDbPlayer = (db: DbPlayer): Player => ({
  id: db.id,
  name: db.name,
  team: db.team,
  role: db.role,
  isInternational: db.is_international,
});

// Legacy mapper - rosters are now stored in manager_roster junction table
export const mapDbManager = (db: DbManager): Manager => ({
  id: db.id,
  name: db.name,
  teamName: db.team_name,
  wins: db.wins,
  losses: db.losses,
  points: db.points,
  userId: db.user_id,
  activeRoster: [],
  bench: [],
});

export const mapDbSchedule = (db: DbLeagueSchedule): Match => ({
  id: db.id,
  leagueId: db.league_id,
  week: db.week,
  home: db.manager1_id,
  away: db.manager2_id || '',
  homeScore: db.manager1_score ?? undefined,
  awayScore: db.manager2_score ?? undefined,
  completed: db.is_finalized,
});

// Alias for new name
export const mapDbLeagueSchedule = mapDbSchedule;

export const mapDbTransaction = (db: DbTransaction): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type,
  managerId: db.manager_id || 'system',
  description: db.description,
  players: db.players || undefined,
});

// ============================================
// Fantasy Points Tracking Types
// ============================================

// Database types
export interface DbExtendedPlayer {
  player_id: string;
  cricbuzz_id: string;
  image_id: number | null;
  batting_style: string | null;
  bowling_style: string | null;
  dob: string | null;
  birth_place: string | null;
  height: string | null;
  bio: string | null;
  teams: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DbCricketMatch {
  id: string;
  cricbuzz_match_id: number;
  series_id: number;
  match_description: string | null;
  match_format: string | null;
  match_date: string | null;
  team1_id: number | null;
  team1_name: string | null;
  team1_short: string | null;
  team1_score: string | null;
  team2_id: number | null;
  team2_name: string | null;
  team2_short: string | null;
  team2_score: string | null;
  result: string | null;
  winner_team_id: number | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  match_week: number | null;
  created_at: string;
}

// Type alias for the compat view (replaces old player_match_stats direct interface)
export type DbPlayerMatchStatsCompat = Tables<'player_match_stats_compat'>;

// New table types
export type DbMatchPlayerStats = Tables<'match_player_stats'>;
export type DbLeaguePlayerMatchScores = Tables<'league_player_match_scores'>;

// Keep backward compat alias — maps from compat view shape
export type DbPlayerMatchStats = DbPlayerMatchStatsCompat;

// Frontend types
export interface CricketMatch {
  id: string;
  cricbuzzMatchId: number;
  seriesId: number;
  matchDescription: string | null;
  matchFormat: string | null;
  matchDate: Date | null;
  team1: {
    id: number | null;
    name: string | null;
    shortName: string | null;
    score: string | null;
  };
  team2: {
    id: number | null;
    name: string | null;
    shortName: string | null;
    score: string | null;
  };
  result: string | null;
  winnerTeamId: number | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  // leagueId: string | null; // Removed
  week: number | null;
}

export interface PlayerMatchStats {
  id: string;
  playerId: string | null;
  matchId: string | null;
  cricbuzzPlayerId: string;
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number | null;
  isOut: boolean;
  dismissalType: string | null;
  battingPosition: number | null;
  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number | null;
  dots: number;
  wides: number;
  noBalls: number;
  lbwBowledCount: number;
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;
  // Fantasy context
  managerId: string | null;
  wasInActiveRoster: boolean;
  week: number | null;
  isInPlaying11: boolean;
  isImpactPlayer: boolean;
  isManOfMatch: boolean;
  teamWon: boolean;
  // Calculated
  fantasyPoints: number | null;
  leagueId: string | null;
}

export interface FantasyWeeklySummary {
  leagueId: string;
  week: number;
  managerId: string;
  managerName: string;
  teamName: string;
  playersWithStats: number;
  activePoints: number;
  benchPoints: number;
  totalPoints: number;
}

export interface PlayerFantasyPerformance {
  leagueId: string;
  playerId: string;
  playerName: string;
  iplTeam: string;
  role: string;
  matchesPlayed: number;
  totalRuns: number;
  totalWickets: number;
  totalDismissals: number;
  totalFantasyPoints: number;
  avgFantasyPoints: number;
}

// Mappers
export const mapDbCricketMatch = (db: DbCricketMatch): CricketMatch => ({
  id: db.id,
  cricbuzzMatchId: db.cricbuzz_match_id,
  seriesId: db.series_id,
  matchDescription: db.match_description,
  matchFormat: db.match_format,
  matchDate: db.match_date ? new Date(db.match_date) : null,
  team1: {
    id: db.team1_id,
    name: db.team1_name,
    shortName: db.team1_short,
    score: db.team1_score,
  },
  team2: {
    id: db.team2_id,
    name: db.team2_name,
    shortName: db.team2_short,
    score: db.team2_score,
  },
  result: db.result,
  winnerTeamId: db.winner_team_id,
  venue: db.venue,
  city: db.city,
  state: db.state,
  // leagueId: db.league_id, // Removed as it's not in DB
  week: db.match_week, // Mapped from match_week
});

export const mapDbPlayerMatchStats = (db: DbPlayerMatchStatsCompat): PlayerMatchStats => ({
  id: db.id ?? '',
  playerId: db.player_id,
  matchId: db.match_id,
  cricbuzzPlayerId: db.cricbuzz_player_id ?? '',
  runs: db.runs ?? 0,
  ballsFaced: db.balls_faced ?? 0,
  fours: db.fours ?? 0,
  sixes: db.sixes ?? 0,
  strikeRate: db.strike_rate ?? null,
  isOut: db.is_out ?? false,
  dismissalType: db.dismissal_type,
  battingPosition: db.batting_position ?? null,
  overs: db.overs ?? 0,
  maidens: db.maidens ?? 0,
  runsConceded: db.runs_conceded ?? 0,
  wickets: db.wickets ?? 0,
  economy: db.economy ?? null,
  dots: db.dots ?? 0,
  wides: db.wides ?? 0,
  noBalls: db.no_balls ?? 0,
  lbwBowledCount: db.lbw_bowled_count ?? 0,
  catches: db.catches ?? 0,
  stumpings: db.stumpings ?? 0,
  runOuts: db.run_outs ?? 0,
  managerId: db.manager_id,
  wasInActiveRoster: db.was_in_active_roster ?? false,
  week: db.week,
  isInPlaying11: db.is_in_playing_11 ?? false,
  isImpactPlayer: db.is_impact_player ?? false,
  isManOfMatch: db.is_man_of_match ?? false,
  teamWon: db.team_won ?? false,
  fantasyPoints: db.fantasy_points,
  leagueId: db.league_id,
});
