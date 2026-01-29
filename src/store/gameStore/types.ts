import { Player, Manager, Match, Activity } from '@/lib/supabase-types';
import { LeagueConfig } from '@/lib/roster-validation';
import { ScoringRules } from '@/lib/scoring-types';

export interface RosterMoveResult {
  success: boolean;
  error?: string;
}

export interface ScoringRulesResult {
  success: boolean;
  error?: string;
}

export interface GameState {
  // Core data - subscribe to these individually for performance
  players: Player[];
  managers: Manager[];
  schedule: Match[];
  activities: Activity[];
  config: LeagueConfig;
  scoringRules: ScoringRules;
  leagueName: string;
  leagueOwnerId: string | null;
  tournamentId: number | null;
  currentWeek: number;
  currentManagerId: string;
  loading: boolean;
  currentLeagueId: string | null;
  isInitializing: boolean;
  initializedLeagueId: string | null;
  isDraftInitialized: boolean;
  isTradesInitialized: boolean;
  isLeaguesInitialized: boolean;

  // Setters (used internally and by real-time subscriptions)
  setPlayers: (players: Player[]) => void;
  setManagers: (managers: Manager[]) => void;
  setSchedule: (schedule: Match[]) => void;
  setActivities: (activities: Activity[]) => void;
  setConfig: (config: LeagueConfig) => void;
  setScoringRules: (rules: ScoringRules) => void;
  setLeagueName: (name: string) => void;
  setLeagueOwnerId: (id: string | null) => void;
  setTournamentId: (id: number | null) => void;
  setLoading: (loading: boolean) => void;
  setCurrentManagerId: (id: string) => void;
  setCurrentLeagueId: (id: string | null) => void;
  setIsInitializing: (isInitializing: boolean) => void;
  setInitializedLeagueId: (id: string | null) => void;
  setIsDraftInitialized: (isDraftInitialized: boolean) => void;
  setIsTradesInitialized: (isTradesInitialized: boolean) => void;
  setIsLeaguesInitialized: (isLeaguesInitialized: boolean) => void;

  // Real-time mutations (called by Supabase subscriptions)
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, player: Player) => void;
  removePlayer: (id: string) => void;
  addManager: (manager: Manager) => void;
  updateManager: (id: string, manager: Manager) => void;
  removeManager: (id: string) => void;
  addMatch: (match: Match) => void;
  updateMatch: (id: string, match: Match) => void;
  removeMatch: (id: string) => void;
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, activity: Activity) => void;
  removeActivity: (id: string) => void;

  // Computed values
  getFreeAgents: () => Player[];
  getManagerRosterCount: (managerId: string) => number;

  // Game actions
  addFreeAgent: (managerId: string, playerId: string, dropPlayerId?: string) => Promise<void>;
  dropPlayerOnly: (managerId: string, playerId: string) => Promise<void>;
  moveToActive: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
  moveToBench: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
  swapPlayers: (managerId: string, player1Id: string, player2Id: string) => Promise<RosterMoveResult>;
  updateMatchScore: (week: number, matchIndex: number, homeScore: number, awayScore: number) => Promise<void>;
  finalizeWeekScores: (week: number) => Promise<void>;
  addNewPlayer: (name: string, team: string, role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper', isInternational?: boolean) => Promise<void>;
  removePlayerFromLeague: (playerId: string) => Promise<void>;
  executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => Promise<void>;
  resetLeague: () => Promise<void>;
  updateScoringRules: (rules: ScoringRules) => Promise<ScoringRulesResult>;

  // Data fetching
  fetchAllData: (leagueId: string) => Promise<void>;

  // Real-time subscriptions
  subscribeToRealtime: (leagueId: string) => () => void;
}
