import { Tables } from '@/integrations/supabase/types';
import { Player, Manager, Match, Activity, PlayerTransaction } from '@/lib/supabase-types';
import { DraftPick, DraftOrder, DraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';

// Type for manager_roster junction table entries
export interface ManagerRosterEntry {
  id: string;
  manager_id: string;
  player_id: string;
  league_id: string;
  slot_type: 'active' | 'bench';
  position: number;
}

// Maps data from league_players view (which joins master_players + league_player_pool)
export const mapDbPlayer = (db: Tables<"league_players">): Player => ({
  id: db.id!,
  name: db.name!,
  team: db.team!,
  role: db.role as Player["role"],
  isInternational: db.is_international ?? false,
  imageId: db.image_id ?? undefined,
  cachedUrl: db.cached_image_url || null,
});

// Legacy mapper - prefer mapDbManagerWithRoster for proper roster handling
// This creates empty rosters since the columns were moved to manager_roster junction table
export const mapDbManager = (db: Tables<"managers">): Manager => ({
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

// Maps manager data with roster entries from junction table
// This reconstructs the activeRoster and bench arrays from manager_roster entries
export const mapDbManagerWithRoster = (
  db: Tables<"managers">,
  rosterEntries: ManagerRosterEntry[]
): Manager => {
  // Filter entries for this manager and sort by position
  const managerEntries = rosterEntries.filter(e => e.manager_id === db.id);

  const activeRoster = managerEntries
    .filter(e => e.slot_type === 'active')
    .sort((a, b) => a.position - b.position)
    .map(e => e.player_id);

  const bench = managerEntries
    .filter(e => e.slot_type === 'bench')
    .sort((a, b) => a.position - b.position)
    .map(e => e.player_id);

  return {
    id: db.id,
    name: db.name,
    teamName: db.team_name,
    wins: db.wins,
    losses: db.losses,
    points: db.points,
    userId: db.user_id,
    activeRoster,
    bench,
  };
};

export const mapDbSchedule = (db: Tables<"league_schedules">): Match => ({
  id: db.id,
  week: db.week,
  home: db.manager1_id || "",
  away: db.manager2_id || "",
  homeScore: db.manager1_score ?? undefined,
  awayScore: db.manager2_score ?? undefined,
  completed: db.is_finalized,
});

export const mapDbTransaction = (db: Tables<"transactions">): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type as Activity["type"],
  managerId: db.manager_id || "system",
  description: db.description,
  players: (db.players as unknown as PlayerTransaction[] | null) || undefined,
});

export const mapDbDraftPick = (db: DbDraftPick | Tables<"draft_picks"> | Record<string, unknown>): DraftPick => {
  const row = db as DbDraftPick;
  return {
    id: row.id,
    leagueId: row.league_id,
    round: row.round,
    pickPosition: row.pick_position,
    managerId: row.manager_id,
    playerId: row.player_id,
    isAutoDraft: row.is_auto_draft,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
};

export const mapDbDraftOrder = (db: DbDraftOrder | Tables<"draft_order"> | Record<string, unknown>): DraftOrder => {
  const row = db as DbDraftOrder;
  return {
    id: row.id,
    leagueId: row.league_id,
    position: row.position,
    managerId: row.manager_id,
    autoDraftEnabled: row.auto_draft_enabled,
  };
};

export const mapDbDraftState = (db: DbDraftState | Tables<"draft_state"> | Record<string, unknown>): DraftState => {
  const row = db as DbDraftState;
  return {
    id: row.id,
    leagueId: row.league_id,
    isFinalized: row.is_finalized,
    finalizedAt: row.finalized_at ? new Date(row.finalized_at) : null,
    isActive: row.is_active,
    currentPickStartAt: row.current_pick_start_at ? new Date(row.current_pick_start_at) : null,
    pausedAt: row.paused_at ? new Date(row.paused_at) : null,
  };
};
