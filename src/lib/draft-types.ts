// Types for Draft feature

export interface DraftPick {
  id: string;
  leagueId: string;
  round: number;
  pickNumber: number;
  managerId: string | null;
  playerId: string | null;
  isAutoDraft: boolean;
  createdAt: Date;
}

export interface DraftOrder {
  id: string;
  leagueId: string;
  position: number;
  managerId: string | null;
  autoDraftEnabled: boolean;
}

export interface DraftState {
  leagueId: string;
  status: 'pre_draft' | 'active' | 'paused' | 'completed';
  currentRound: number;
  currentPosition: number;
  clockDurationSeconds: number;
  lastPickAt: Date;
  pausedAt: Date | null;
  totalPausedDurationMs: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isFinalized: boolean;
}

// Database row types
export interface DbDraftPick {
  id: string;
  league_id: string;
  round: number;
  pick_number: number;
  manager_id: string | null;
  player_id: string | null;
  is_auto_draft: boolean;
  created_at: string;
}

export interface DbDraftOrder {
  id: string;
  league_id: string;
  position: number;
  manager_id: string | null;
  auto_draft_enabled: boolean;
}

export interface DbDraftState {
  league_id: string;
  status: 'pre_draft' | 'active' | 'paused' | 'completed';
  current_round: number;
  current_position: number;
  clock_duration_seconds: number;
  last_pick_at: string;
  paused_at: string | null;
  total_paused_duration_ms: number;
  version: number;
  created_at: string;
  updated_at: string;
}

// Mappers
export const mapDbDraftPick = (db: DbDraftPick): DraftPick => ({
  id: db.id,
  leagueId: db.league_id,
  round: db.round,
  pickNumber: db.pick_number,
  managerId: db.manager_id,
  playerId: db.player_id,
  isAutoDraft: db.is_auto_draft,
  createdAt: new Date(db.created_at),
});

export const mapDbDraftOrder = (db: DbDraftOrder): DraftOrder => ({
  id: db.id,
  leagueId: db.league_id,
  position: db.position,
  managerId: db.manager_id,
  autoDraftEnabled: db.auto_draft_enabled,
});

export const mapDbDraftState = (db: DbDraftState): DraftState => ({
  leagueId: db.league_id,
  status: db.status,
  currentRound: db.current_round,
  currentPosition: db.current_position,
  clockDurationSeconds: db.clock_duration_seconds,
  lastPickAt: new Date(db.last_pick_at),
  pausedAt: db.paused_at ? new Date(db.paused_at) : null,
  totalPausedDurationMs: db.total_paused_duration_ms,
  version: db.version,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
  isActive: db.status === 'active' || db.status === 'paused',
  isFinalized: db.status === 'completed',
});
