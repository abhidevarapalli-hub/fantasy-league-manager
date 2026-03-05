import { Tables } from '@/integrations/supabase/types';
import { Player, Manager, Match, Activity, PlayerTransaction, PlayerMatchStats, CricketMatch } from '@/lib/supabase-types';
import { DraftPick, DraftOrder, DraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';

import { ManagerRosterEntry } from './types';

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

  const captainEntry = managerEntries.find(e => e.is_captain);
  const viceCaptainEntry = managerEntries.find(e => e.is_vice_captain);

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
    captainId: captainEntry?.player_id ?? null,
    viceCaptainId: viceCaptainEntry?.player_id ?? null,
  };
};

export const mapDbMatchup = (db: Tables<"league_matchups">): Match => ({
  id: db.id!,
  week: db.week!,
  home: db.manager1_id || "",
  away: db.manager2_id || "",
  homeScore: db.manager1_score ?? undefined,
  awayScore: db.manager2_score ?? undefined,
  completed: db.is_finalized ?? false,
  modifiedBy: db.modified_by ?? null,
  modifiedAt: db.modified_at ?? null,
});

// Alias for transition
export const mapDbSchedule = mapDbMatchup;

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
    pickNumber: row.pick_number,
    managerId: row.manager_id,
    playerId: row.player_id,
    isAutoDraft: row.is_auto_draft,
    createdAt: new Date(row.created_at),
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
    leagueId: row.league_id,
    status: row.status as DraftState['status'],
    currentRound: row.current_round,
    currentPosition: row.current_position,
    clockDurationSeconds: row.clock_duration_seconds,
    lastPickAt: new Date(row.last_pick_at),
    pausedAt: row.paused_at ? new Date(row.paused_at) : null,
    totalPausedDurationMs: row.total_paused_duration_ms,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    isActive: row.status === 'active' || row.status === 'paused',
    isFinalized: row.status === 'completed',
  };
};

export const mapDbCricketMatch = (db: Tables<'cricket_matches'>): CricketMatch => ({
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
  week: db.match_week,
  matchState: db.match_state,
});

export const mapDbPlayerMatchStats = (db: Tables<'player_match_stats'>): PlayerMatchStats => ({
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
  isLiveStats: db.is_live_stats ?? false,
});
