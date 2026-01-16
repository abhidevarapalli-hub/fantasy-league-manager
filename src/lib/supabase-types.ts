// Types for Supabase database tables
export interface DbPlayer {
  id: string;
  name: string;
  team: string;
  role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
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
});

export const mapDbManager = (db: DbManager): Manager => ({
  id: db.id,
  name: db.name,
  teamName: db.team_name,
  wins: db.wins,
  losses: db.losses,
  points: db.points,
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
