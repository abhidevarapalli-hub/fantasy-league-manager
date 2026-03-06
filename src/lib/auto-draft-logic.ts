/**
 * Shared auto-draft player selection logic.
 * Used by both mock drafts (useMockDraft) and regular drafts (useDraft).
 *
 * The algorithm:
 * 1. Counts the team's current roster composition (role counts, international count)
 * 2. Determines which roles are needed based on league config constraints
 * 3. Filters available players by role needs and international limits
 * 4. Uses weighted random selection heavily favoring higher-ranked players
 */

import { Player } from '@/lib/supabase-types';
import { LeagueConfig } from '@/lib/roster-validation';
import { sortPlayersByPriority } from '@/lib/player-order';

export interface RosterCounts {
  wicketKeepers: number;
  batsmen: number;
  allRounders: number;
  bowlers: number;
  international: number;
  total: number;
}

/**
 * Count the roster composition for a set of player IDs.
 */
export function getTeamRosterCounts(playerIds: string[], allPlayers: Player[]): RosterCounts {
  const teamPlayers = playerIds
    .map(id => allPlayers.find(p => p.id === id))
    .filter(Boolean) as Player[];

  return {
    wicketKeepers: teamPlayers.filter(p => p.role === 'Wicket Keeper').length,
    batsmen: teamPlayers.filter(p => p.role === 'Batsman').length,
    allRounders: teamPlayers.filter(p => p.role === 'All Rounder').length,
    bowlers: teamPlayers.filter(p => p.role === 'Bowler').length,
    international: teamPlayers.filter(p => p.isInternational).length,
    total: teamPlayers.length,
  };
}

/**
 * Determine which roles are needed for a team given current counts and config constraints.
 * Returns a list of roles that the team should prioritize picking.
 */
export function getNeededRoles(counts: RosterCounts, config: LeagueConfig): string[] {
  const neededRoles: string[] = [];

  // Hard requirements first
  if (config.requireWk && counts.wicketKeepers < 1) {
    neededRoles.push('Wicket Keeper');
  }
  if (counts.allRounders < config.minAllRounders) neededRoles.push('All Rounder');
  if (counts.bowlers < config.minBowlers) neededRoles.push('Bowler');

  const batWkCount = counts.batsmen + counts.wicketKeepers;
  if (batWkCount < config.minBatWk) {
    neededRoles.push('Batsman');
    neededRoles.push('Wicket Keeper');
  }

  // If all minimums are met, allow picking up to maximums
  if (neededRoles.length === 0) {
    if (batWkCount < config.maxBatWk) {
      neededRoles.push('Batsman', 'Wicket Keeper');
    }
    if (counts.bowlers < config.maxBowlers) neededRoles.push('Bowler');
    if (counts.allRounders < config.maxAllRounders) neededRoles.push('All Rounder');
  }

  return [...new Set(neededRoles)];
}

/**
 * Get a tier number for a player based on their index in the priority-sorted list.
 * Lower tier = better player.
 */
function getPlayerTier(playerIndex: number): number {
  return Math.floor(playerIndex / 10) + 1;
}

/**
 * Select a player using weighted random selection that heavily favors higher-ranked players.
 * The weight is exponential: tier 1 players are vastly more likely to be picked than tier 25.
 */
export function selectPlayerWeighted(eligiblePlayers: Player[], sortedPlayers: Player[]): Player {
  const playerIndexMap = new Map<string, number>();
  sortedPlayers.forEach((p, idx) => playerIndexMap.set(p.id, idx));

  const weights = eligiblePlayers.map(player => {
    const index = playerIndexMap.get(player.id) ?? sortedPlayers.length;
    const tier = Math.min(25, getPlayerTier(index));
    return Math.pow(2, 25 - tier);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < eligiblePlayers.length; i++) {
    random -= weights[i];
    if (random <= 0) return eligiblePlayers[i];
  }
  return eligiblePlayers[eligiblePlayers.length - 1];
}

/**
 * Main entry point: Select the best available player for a team,
 * respecting roster composition constraints and using weighted random selection.
 *
 * @param teamPlayerIds - IDs of players already on this team's roster
 * @param availablePlayers - Players not yet drafted by any team
 * @param allPlayers - All players in the league (for looking up player details)
 * @param config - League configuration with roster constraints
 * @returns The selected player, or null if no valid pick exists
 */
export function selectBestPlayer(
  teamPlayerIds: string[],
  availablePlayers: Player[],
  allPlayers: Player[],
  config: LeagueConfig
): Player | null {
  const counts = getTeamRosterCounts(teamPlayerIds, allPlayers);
  const totalCap = config.activeSize + config.benchSize;
  if (counts.total >= totalCap) return null;

  const neededRoles = getNeededRoles(counts, config);
  const canAddInternational = counts.international < config.maxInternational;
  const batWkCount = counts.batsmen + counts.wicketKeepers;

  const sortedAvailable = sortPlayersByPriority(availablePlayers);

  // First try: players matching needed roles and international constraints
  let eligiblePlayers = sortedAvailable.filter(p => {
    if (!canAddInternational && p.isInternational) return false;
    return neededRoles.includes(p.role);
  });

  // Fallback: any player that doesn't violate max constraints
  if (eligiblePlayers.length === 0) {
    eligiblePlayers = sortedAvailable.filter(p => {
      if (!canAddInternational && p.isInternational) return false;
      if ((p.role === 'Batsman' || p.role === 'Wicket Keeper') && batWkCount >= config.maxBatWk) return false;
      if (p.role === 'Bowler' && counts.bowlers >= config.maxBowlers) return false;
      if (p.role === 'All Rounder' && counts.allRounders >= config.maxAllRounders) return false;
      return true;
    });
  }

  if (eligiblePlayers.length === 0) return null;

  return selectPlayerWeighted(eligiblePlayers, sortPlayersByPriority(allPlayers));
}
