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
  roster: string[];
  bench: string[];
  user_id: string | null;
  created_at: string;
}

export interface DbSchedule {
  id: string;
  week: number;
  home_manager_id: string;
  away_manager_id: string;
  home_score: number | null;
  away_score: number | null;
  is_finalized: boolean;
  created_at: string;
}

export interface DbTransaction {
  id: string;
  type: 'add' | 'drop' | 'trade' | 'score';
  manager_id: string | null;
  manager_team_name: string | null;
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
  description: string;
  players?: PlayerTransaction[];
  managerTeamName?: string;
}

// Mappers
export const mapDbPlayer = (db: DbPlayer): Player => ({
  id: db.id,
  name: db.name,
  team: db.team,
  role: db.role,
  isInternational: db.is_international,
});

export const mapDbManager = (db: DbManager): Manager => ({
  id: db.id,
  name: db.name,
  teamName: db.team_name,
  wins: db.wins,
  losses: db.losses,
  points: db.points,
  userId: db.user_id,
  activeRoster: db.roster || [],
  bench: db.bench || [],
});

export const mapDbSchedule = (db: DbSchedule): Match => ({
  id: db.id,
  week: db.week,
  home: db.home_manager_id,
  away: db.away_manager_id,
  homeScore: db.home_score ?? undefined,
  awayScore: db.away_score ?? undefined,
  completed: db.is_finalized,
});

export const mapDbTransaction = (db: DbTransaction): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type,
  managerId: db.manager_id || 'system',
  description: db.description,
  players: db.players || undefined,
  managerTeamName: db.manager_team_name || undefined,
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
  league_id: string | null;
  week: number | null;
  stats_imported: boolean;
  stats_imported_at: string | null;
  created_at: string;
}

export interface DbPlayerMatchStats {
  id: string;
  player_id: string | null;
  match_id: string | null;
  cricbuzz_player_id: string;
  // Batting
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number | null;
  is_out: boolean;
  dismissal_type: string | null;
  batting_position: number | null;
  // Bowling
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  dots: number;
  wides: number;
  no_balls: number;
  lbw_bowled_count: number;
  // Fielding
  catches: number;
  stumpings: number;
  run_outs: number;
  // Fantasy context
  manager_id: string | null;
  was_in_active_roster: boolean;
  week: number | null;
  is_in_playing_11: boolean;
  is_impact_player: boolean;
  is_man_of_match: boolean;
  team_won: boolean;
  // Calculated
  fantasy_points: number | null;
  league_id: string | null;
  created_at: string;
}

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
  leagueId: string | null;
  week: number | null;
  statsImported: boolean;
  statsImportedAt: Date | null;
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
  leagueId: db.league_id,
  week: db.week,
  statsImported: db.stats_imported,
  statsImportedAt: db.stats_imported_at ? new Date(db.stats_imported_at) : null,
});

export const mapDbPlayerMatchStats = (db: DbPlayerMatchStats): PlayerMatchStats => ({
  id: db.id,
  playerId: db.player_id,
  matchId: db.match_id,
  cricbuzzPlayerId: db.cricbuzz_player_id,
  runs: db.runs,
  ballsFaced: db.balls_faced,
  fours: db.fours,
  sixes: db.sixes,
  strikeRate: db.strike_rate,
  isOut: db.is_out,
  dismissalType: db.dismissal_type,
  battingPosition: db.batting_position,
  overs: db.overs,
  maidens: db.maidens,
  runsConceded: db.runs_conceded,
  wickets: db.wickets,
  economy: db.economy,
  dots: db.dots,
  wides: db.wides,
  noBalls: db.no_balls,
  lbwBowledCount: db.lbw_bowled_count,
  catches: db.catches,
  stumpings: db.stumpings,
  runOuts: db.run_outs,
  managerId: db.manager_id,
  wasInActiveRoster: db.was_in_active_roster,
  week: db.week,
  isInPlaying11: db.is_in_playing_11,
  isImpactPlayer: db.is_impact_player,
  isManOfMatch: db.is_man_of_match,
  teamWon: db.team_won,
  fantasyPoints: db.fantasy_points,
  leagueId: db.league_id,
});
