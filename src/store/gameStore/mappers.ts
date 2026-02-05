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
});

export const mapDbManager = (db: Tables<"managers">): Manager => ({
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

export const mapDbSchedule = (db: Tables<"schedule">): Match => ({
  id: db.id,
  week: db.week,
  home: db.home_manager_id || "",
  away: db.away_manager_id || "",
  homeScore: db.home_score ?? undefined,
  awayScore: db.away_score ?? undefined,
  completed: db.is_finalized,
});

export const mapDbTransaction = (db: Tables<"transactions">): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type as Activity["type"],
  managerId: db.manager_id || "system",
  description: db.description,
  players: (db.players as unknown as PlayerTransaction[] | null) || undefined,
  managerTeamName: db.manager_team_name || undefined,
});

export const mapDbDraftPick = (db: any): DraftPick => ({
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

export const mapDbDraftOrder = (db: any): DraftOrder => ({
  id: db.id,
  leagueId: db.league_id,
  position: db.position,
  managerId: db.manager_id,
  autoDraftEnabled: db.auto_draft_enabled,
});

export const mapDbDraftState = (db: any): DraftState => ({
  id: db.id,
  leagueId: db.league_id,
  isFinalized: db.is_finalized,
  finalizedAt: db.finalized_at ? new Date(db.finalized_at) : null,
  isActive: db.is_active,
  currentPickStartAt: db.current_pick_start_at ? new Date(db.current_pick_start_at) : null,
  pausedAt: db.paused_at ? new Date(db.paused_at) : null,
});
