// Types for Draft feature

export interface DraftPick {
  id: string;
  leagueId: string;
  round: number;
  pickPosition: number;
  managerId: string | null;
  playerId: string | null;
  isAutoDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftOrder {
  id: string;
  leagueId: string;
  position: number;
  managerId: string | null;
  autoDraftEnabled: boolean;
}

export interface DraftState {
  id: string;
  leagueId: string;
  isFinalized: boolean;
  finalizedAt: Date | null;
  isActive: boolean;
  currentPickStartAt: Date | null;
  pausedAt: Date | null;
}

// Database row types
export interface DbDraftPick {
  id: string;
  league_id: string;
  round: number;
  pick_position: number;
  manager_id: string | null;
  player_id: string | null;
  is_auto_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbDraftOrder {
  id: string;
  league_id: string;
  position: number;
  manager_id: string | null;
  auto_draft_enabled: boolean;
  created_at: string;
}

export interface DbDraftState {
  id: string;
  league_id: string;
  is_finalized: boolean;
  finalized_at: string | null;
  is_active: boolean;
  current_pick_start_at: string | null;
  paused_at: string | null;
  created_at: string;
}

// Mappers
export const mapDbDraftPick = (db: DbDraftPick): DraftPick => ({
  id: db.id,
  leagueId: db.league_id,
  round: db.round,
  pickPosition: db.pick_position,
  managerId: db.manager_id,
  playerId: db.player_id,
  isAutoDraft: db.is_auto_draft,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
});

export const mapDbDraftOrder = (db: DbDraftOrder): DraftOrder => ({
  id: db.id,
  leagueId: db.league_id,
  position: db.position,
  managerId: db.manager_id,
  autoDraftEnabled: db.auto_draft_enabled,
});

export const mapDbDraftState = (db: DbDraftState): DraftState => ({
  id: db.id,
  leagueId: db.league_id,
  isFinalized: db.is_finalized,
  finalizedAt: db.finalized_at ? new Date(db.finalized_at) : null,
  isActive: db.is_active,
  currentPickStartAt: db.current_pick_start_at ? new Date(db.current_pick_start_at) : null,
  pausedAt: db.paused_at ? new Date(db.paused_at) : null,
});
