// Types for Draft feature

export interface DraftPick {
  id: string;
  round: number;
  pickPosition: number;
  managerId: string | null;
  playerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftOrder {
  id: string;
  position: number;
  managerId: string | null;
}

export interface DraftState {
  id: string;
  isFinalized: boolean;
  finalizedAt: Date | null;
}

// Database row types
export interface DbDraftPick {
  id: string;
  round: number;
  pick_position: number;
  manager_id: string | null;
  player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDraftOrder {
  id: string;
  position: number;
  manager_id: string | null;
  created_at: string;
}

export interface DbDraftState {
  id: string;
  is_finalized: boolean;
  finalized_at: string | null;
  created_at: string;
}

// Mappers
export const mapDbDraftPick = (db: DbDraftPick): DraftPick => ({
  id: db.id,
  round: db.round,
  pickPosition: db.pick_position,
  managerId: db.manager_id,
  playerId: db.player_id,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
});

export const mapDbDraftOrder = (db: DbDraftOrder): DraftOrder => ({
  id: db.id,
  position: db.position,
  managerId: db.manager_id,
});

export const mapDbDraftState = (db: DbDraftState): DraftState => ({
  id: db.id,
  isFinalized: db.is_finalized,
  finalizedAt: db.finalized_at ? new Date(db.finalized_at) : null,
});
