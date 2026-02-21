import { Player } from './supabase-types';

// Roster constraints
// Roster configuration type
export interface LeagueConfig {
  managerCount: number;
  activeSize: number;
  benchSize: number;
  minBatWk: number;
  maxBatWk: number;
  minBowlers: number;
  maxBowlers: number;
  minAllRounders: number;
  maxAllRounders: number;
  maxInternational: number;
  requireWk: boolean;
  maxFromTeam?: number;
}

// Default configuration for backwards compatibility and fallback
export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  managerCount: 8,
  activeSize: 11,
  benchSize: 3,
  minBatWk: 4,
  maxBatWk: 7,
  minBowlers: 3,
  maxBowlers: 6,
  minAllRounders: 2,
  maxAllRounders: 4,
  maxInternational: 4,
  requireWk: true,
  maxFromTeam: 11
};

/**
 * Gets default minimum requirements based on roster size.
 * Mapping: size -> [BatWk, AllRounder, Bowler]
 */
export function getDefaultMinimums(rosterSize: number): { minBatWk: number; minAllRounders: number; minBowlers: number } {
  switch (rosterSize) {
    case 11: return { minBatWk: 4, minAllRounders: 2, minBowlers: 3 };
    case 10: return { minBatWk: 3, minAllRounders: 1, minBowlers: 3 };
    case 9: return { minBatWk: 3, minAllRounders: 1, minBowlers: 3 };
    case 8: return { minBatWk: 2, minAllRounders: 1, minBowlers: 2 };
    case 7: return { minBatWk: 2, minAllRounders: 1, minBowlers: 2 };
    case 6: return { minBatWk: 2, minAllRounders: 1, minBowlers: 1 };
    default:
      // Fallback for other sizes
      if (rosterSize > 11) return { minBatWk: 4, minAllRounders: 2, minBowlers: 3 };
      if (rosterSize < 6) return { minBatWk: 1, minAllRounders: 1, minBowlers: 1 };
      return { minBatWk: 2, minAllRounders: 1, minBowlers: 1 };
  }
}

export type PlayerRole = 'Wicket Keeper' | 'Batsman' | 'All Rounder' | 'Bowler';

export interface RosterCounts {
  wicketKeepers: number;
  batsmen: number;
  allRounders: number;
  bowlers: number;
  international: number;
  total: number;
}

export interface RosterValidationResult {
  isValid: boolean;
  errors: string[];
  counts: RosterCounts;
}

export interface SlotRequirement {
  role: PlayerRole | 'Any Position';
  label: string;
  filled: boolean;
  player?: Player;
}

/**
 * Validates that the league configuration itself is logical.
 * Specifically, the sum of position minimums must not exceed the active roster size.
 */
export function validateLeagueMinimums(config: LeagueConfig): { isValid: boolean; message?: string } {
  const totalMin = config.minBatWk + config.minBowlers + config.minAllRounders;
  if (totalMin > config.activeSize) {
    return {
      isValid: false,
      message: `Total minimum requirements (${totalMin}) cannot exceed active roster size (${config.activeSize})`
    };
  }
  return { isValid: true };
}

// Count players by role and international status
export function countRosterPlayers(players: Player[]): RosterCounts {
  return {
    wicketKeepers: players.filter(p => p.role === 'Wicket Keeper').length,
    batsmen: players.filter(p => p.role === 'Batsman').length,
    allRounders: players.filter(p => p.role === 'All Rounder').length,
    bowlers: players.filter(p => p.role === 'Bowler').length,
    international: players.filter(p => p.isInternational).length,
    total: players.length,
  };
}

// Validate if a roster meets Active requirements
export function validateActiveRoster(players: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): RosterValidationResult {
  const counts = countRosterPlayers(players);
  const errors: string[] = [];

  // Max players
  if (counts.total > config.activeSize) {
    errors.push(`Active roster cannot exceed ${config.activeSize} players (currently ${counts.total})`);
  }

  // Wicket Keeper requirement
  if (config.requireWk && counts.wicketKeepers < 1) {
    errors.push("Need at least 1 Wicket Keeper");
  }

  // Bat + WK Group
  const batWkCount = counts.batsmen + counts.wicketKeepers;
  if (batWkCount < config.minBatWk) {
    errors.push(`Need at least ${config.minBatWk} Batsmen/WKs (currently ${batWkCount})`);
  }

  // All Rounders
  if (counts.allRounders < config.minAllRounders) {
    errors.push(`Need at least ${config.minAllRounders} All Rounder(s) (currently ${counts.allRounders})`);
  }

  // Bowlers
  if (counts.bowlers < config.minBowlers) {
    errors.push(`Need at least ${config.minBowlers} Bowler(s) (currently ${counts.bowlers})`);
  }

  // Max International - Strictly enforce 4
  const STRICT_MAX_INTL = 4;
  if (counts.international > STRICT_MAX_INTL) {
    errors.push(`Cannot exceed ${STRICT_MAX_INTL} international players (currently ${counts.international})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    counts,
  };
}

/**
 * Forward-looking validation: Only block moves that make requirements IMPOSSIBLE to meet.
 * This checks if adding a player would leave insufficient slots for required minimums.
 */
export function canAddToActive(currentActive: Player[], playerToAdd: Player, config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): RosterValidationResult {
  const newActive = [...currentActive, playerToAdd];
  const counts = countRosterPlayers(newActive);
  const errors: string[] = [];

  // Max players
  if (counts.total > config.activeSize) {
    errors.push(`Active roster cannot exceed ${config.activeSize} players (currently ${counts.total})`);
    return { isValid: false, errors, counts };
  }

  // Max international players - Strictly enforce 4
  const STRICT_MAX_INTL = 4;
  if (counts.international > STRICT_MAX_INTL) {
    errors.push(`Cannot exceed ${STRICT_MAX_INTL} international players (currently ${counts.international})`);
    return { isValid: false, errors, counts };
  }

  // Forward-looking validation: Check if requirements CAN still be met
  const remainingSlots = config.activeSize - counts.total;

  // Calculate strict deficits
  const wkDeficit = (config.requireWk && counts.wicketKeepers < 1) ? 1 : 0;
  const batWkDeficit = Math.max(0, config.minBatWk - (counts.batsmen + counts.wicketKeepers));
  const arDeficit = Math.max(0, config.minAllRounders - counts.allRounders);
  const bowlerDeficit = Math.max(0, config.minBowlers - counts.bowlers);

  // Total minimum slots needed exclusively for specific roles
  const batWkSlotsNeeded = Math.max(wkDeficit, batWkDeficit);
  const totalMinSlotsNeeded = batWkSlotsNeeded + arDeficit + bowlerDeficit;

  if (totalMinSlotsNeeded > remainingSlots) {
    if (wkDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required Wicket Keeper`);
    } else if (batWkDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to satisfy the ${config.minBatWk} Batsmen/WK requirement`);
    } else if (arDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required All Rounder(s)`);
    } else if (bowlerDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required Bowlers`);
    } else {
      errors.push(`Cannot add this player: not enough slots remaining to meet all position requirements`);
    }
    return { isValid: false, errors, counts };
  }

  return { isValid: true, errors: [], counts };
}


// Check if removing a player from active roster would still be valid
export function canRemoveFromActive(currentActive: Player[], playerToRemove: Player): RosterValidationResult {
  const newActive = currentActive.filter(p => p.id !== playerToRemove.id);
  const counts = countRosterPlayers(newActive);
  return { isValid: true, errors: [], counts };
}

// Check if swapping a player (for roster transactions) would be valid
export function canSwapInActive(
  currentActive: Player[],
  playerToAdd: Player,
  playerToRemove: Player,
  config: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): RosterValidationResult {
  const newActive = currentActive.filter(p => p.id !== playerToRemove.id);
  return canAddToActive(newActive, playerToAdd, config);
}


// Sort players by role priority for Active display
export function sortPlayersByRole(players: Player[]): Player[] {
  const roleOrder: Record<PlayerRole, number> = {
    'Wicket Keeper': 0,
    'Batsman': 1,
    'All Rounder': 2,
    'Bowler': 3,
  };

  return [...players].sort((a, b) => {
    const aOrder = roleOrder[a.role];
    const bOrder = roleOrder[b.role];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

// Get the display slots for Active roster with empty placeholders
export function getActiveRosterSlots(players: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): SlotRequirement[] {
  const sorted = sortPlayersByRole(players);
  const slots: SlotRequirement[] = [];

  // Track what we've added
  let wkAdded = 0;
  let batAdded = 0;
  let arAdded = 0;
  let bowlerAdded = 0;

  // Add all actual players first, sorted by role
  for (const player of sorted) {
    slots.push({
      role: player.role,
      label: player.role,
      filled: true,
      player,
    });

    switch (player.role) {
      case 'Wicket Keeper': wkAdded++; break;
      case 'Batsman': batAdded++; break;
      case 'All Rounder': arAdded++; break;
      case 'Bowler': bowlerAdded++; break;
    }
  }

  // Calculate remaining slots needed
  const totalSlots = config.activeSize;
  const filledSlots = sorted.length;
  const emptySlots = totalSlots - filledSlots;

  if (emptySlots <= 0) return slots;

  // Determine minimum requirements not yet met
  const batWkAdded = batAdded + wkAdded;
  const batWkNeeded = Math.max(0, config.minBatWk - batWkAdded);
  const arNeeded = Math.max(0, config.minAllRounders - arAdded);
  const bowlersNeeded = Math.max(0, config.minBowlers - bowlerAdded);

  // Specialist WK requirement check
  const wkDeficit = (config.requireWk && wkAdded < 1) ? 1 : 0;

  // Track slots we are adding
  let slotsToFill = emptySlots;

  // 1. Mandatory Wicket Keeper (if required and not present)
  // This counts towards both the WK requirement AND the BAT/WK group minimum.
  if (wkDeficit > 0 && slotsToFill > 0) {
    slots.push({ role: 'Wicket Keeper', label: 'WK Required', filled: false });
    slotsToFill--;
  }

  // 2. Remaining BAT / WK requirements
  // We subtract the WK we just added (if any) from the batWkNeeded
  const remainingBatWkToFill = Math.max(0, batWkNeeded - (wkDeficit > 0 ? 1 : 0));
  for (let i = 0; i < remainingBatWkToFill && slotsToFill > 0; i++) {
    slots.push({ role: 'Batsman', label: 'BAT / WK', filled: false });
    slotsToFill--;
  }

  // 3. All Rounder requirements
  for (let i = 0; i < arNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'All Rounder', label: 'All Rounder', filled: false });
    slotsToFill--;
  }

  // 4. Bowler requirements
  for (let i = 0; i < bowlersNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Bowler', label: 'Bowler', filled: false });
    slotsToFill--;
  }

  // 5. Fill remaining with generic Flex slots
  for (let i = 0; i < slotsToFill; i++) {
    slots.push({ role: 'Any Position', label: 'Flex Slot', filled: false });
  }

  return slots.sort((a, b) => {
    if (a.filled && !b.filled) return -1;
    if (!a.filled && b.filled) return 1;

    const roleOrder: Record<string, number> = {
      'Wicket Keeper': 0,
      'Batsman': 1,
      'All Rounder': 2,
      'Bowler': 3,
      'Any Position': 4
    };

    const aRole = a.player ? a.player.role : a.role;
    const bRole = b.player ? b.player.role : b.role;

    return (roleOrder[aRole] ?? 99) - (roleOrder[bRole] ?? 99);
  });
}

// Build an optimal Active roster from a list of players
export function buildOptimalActive11(allPlayers: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): { active: Player[]; bench: Player[] } {
  const active: Player[] = [];
  const bench: Player[] = [];
  const STRICT_MAX_INTL = 4;
  let internationalCount = 0;

  // Sort all players by a priority (e.g. name or ID) to ensure deterministic results
  const sortedAllPlayers = [...allPlayers].sort((a, b) => a.id.localeCompare(b.id));

  // Track players already assigned to active
  const assignedIds = new Set<string>();

  const canAddIntl = (player: Player) => {
    return !player.isInternational || internationalCount < STRICT_MAX_INTL;
  };

  const tryAdd = (player: Player): boolean => {
    if (assignedIds.has(player.id)) return false;
    if (active.length >= config.activeSize) return false;
    if (!canAddIntl(player)) return false;

    active.push(player);
    assignedIds.add(player.id);
    if (player.isInternational) internationalCount++;
    return true;
  };

  // 1. Fill Mandatory WK (if required)
  if (config.requireWk) {
    const wks = sortedAllPlayers.filter(p => p.role === 'Wicket Keeper' && !assignedIds.has(p.id));
    for (const wk of wks) {
      if (tryAdd(wk)) break; // Just need one for mandatory check
    }
  }

  // 2. Fill Mandatory Bowlers
  const bowlers = sortedAllPlayers.filter(p => p.role === 'Bowler' && !assignedIds.has(p.id));
  let bowlersAdded = active.filter(p => p.role === 'Bowler').length;
  for (const b of bowlers) {
    if (bowlersAdded >= config.minBowlers) break;
    if (tryAdd(b)) bowlersAdded++;
  }

  // 3. Fill Mandatory All Rounders
  const allRounders = sortedAllPlayers.filter(p => p.role === 'All Rounder' && !assignedIds.has(p.id));
  let arAdded = active.filter(p => p.role === 'All Rounder').length;
  for (const ar of allRounders) {
    if (arAdded >= config.minAllRounders) break;
    if (tryAdd(ar)) arAdded++;
  }

  // 4. Fill Mandatory Batsmen/WKs
  const batWks = sortedAllPlayers.filter(p => (p.role === 'Batsman' || p.role === 'Wicket Keeper') && !assignedIds.has(p.id));
  let batWkCount = active.filter(p => p.role === 'Batsman' || p.role === 'Wicket Keeper').length;
  for (const bw of batWks) {
    if (batWkCount >= config.minBatWk) break;
    if (tryAdd(bw)) batWkCount++;
  }

  // 5. Fill ANY REMAINING ACTIVE SLOTS with remaining players (regardless of role)
  // until active roster is full OR we run out of valid players (intl cap check still applies)
  const remainingPotentialActive = sortedAllPlayers.filter(p => !assignedIds.has(p.id));
  for (const p of remainingPotentialActive) {
    if (active.length >= config.activeSize) break;
    tryAdd(p);
  }

  // 6. Everything else goes to bench
  for (const p of sortedAllPlayers) {
    if (!assignedIds.has(p.id)) {
      bench.push(p);
    }
  }

  return { active, bench };
}


// ============================================
// Draft Roster Progress Types and Functions
// ============================================

export type ConstraintStatus = 'met' | 'warning' | 'ok' | 'exceeded';

export interface ConstraintProgress {
  current: number;
  min?: number;
  status: ConstraintStatus;
  needed?: number; // How many more needed to meet minimum
}

export interface RosterProgress {
  wicketKeepers: ConstraintProgress;
  allRounders: ConstraintProgress;
  bowlers: ConstraintProgress;
  international: ConstraintProgress;
  batWkCombined: ConstraintProgress;
  bwlArCombined: ConstraintProgress;
  total: { current: number; target: number };
}

// Helper functions for combined limits
export function getMinBatWk(config: LeagueConfig): number {
  return config.minBatWk;
}

export function getMinBwlAr(config: LeagueConfig): number {
  return config.minBowlers + config.minAllRounders;
}

/**
 * Calculate roster progress for draft UI
 */
export function getRosterProgress(players: Player[], config: LeagueConfig): RosterProgress {
  const counts = countRosterPlayers(players);
  const totalTarget = config.activeSize + config.benchSize;

  const wkBatCurrent = counts.wicketKeepers + counts.batsmen;
  const bwlArCurrent = counts.bowlers + counts.allRounders;

  const getStatus = (current: number, min?: number, max?: number): ConstraintStatus => {
    if (max !== undefined && current > max) return 'exceeded';
    if (min !== undefined && current < min) return 'warning';
    if (min !== undefined && current >= min) return 'met';
    return 'ok';
  };

  return {
    wicketKeepers: {
      current: counts.wicketKeepers,
      status: getStatus(counts.wicketKeepers, config.requireWk ? 1 : 0),
      needed: Math.max(0, (config.requireWk ? 1 : 0) - counts.wicketKeepers),
    },
    allRounders: {
      current: counts.allRounders,
      min: config.minAllRounders,
      status: getStatus(counts.allRounders, config.minAllRounders),
      needed: Math.max(0, config.minAllRounders - counts.allRounders),
    },
    bowlers: {
      current: counts.bowlers,
      min: config.minBowlers,
      status: getStatus(counts.bowlers, config.minBowlers),
      needed: Math.max(0, config.minBowlers - counts.bowlers),
    },
    international: {
      current: counts.international,
      status: getStatus(counts.international, undefined, 4),
    },
    batWkCombined: {
      current: wkBatCurrent,
      min: config.minBatWk,
      status: getStatus(wkBatCurrent, config.minBatWk),
      needed: Math.max(0, config.minBatWk - wkBatCurrent),
    },
    bwlArCombined: {
      current: bwlArCurrent,
      min: getMinBwlAr(config),
      status: getStatus(bwlArCurrent, getMinBwlAr(config)),
      needed: Math.max(0, getMinBwlAr(config) - bwlArCurrent),
    },
    total: {
      current: counts.total,
      target: totalTarget,
    },
  };
}

export interface PlayerRecommendation {
  isRecommended: boolean;
  reason?: string;
  priority: number; // Higher = more urgent need
}

/**
 * Determine if a player should be recommended during draft
 */
export function getPlayerRecommendation(
  currentPicks: Player[],
  playerToEvaluate: Player,
  config: LeagueConfig
): PlayerRecommendation {
  const progress = getRosterProgress(currentPicks, config);
  const role = playerToEvaluate.role;
  const isInternational = playerToEvaluate.isInternational;

  const STRICT_MAX_INTL = 4;
  if (isInternational && progress.international.current >= STRICT_MAX_INTL) {
    return { isRecommended: false, priority: -1 };
  }

  let priority = 0;
  let reason: string | undefined;

  switch (role) {
    case 'Wicket Keeper':
      if (progress.wicketKeepers.needed && progress.wicketKeepers.needed > 0) {
        priority = 100 + progress.wicketKeepers.needed * 10;
        reason = `Need 1 Wicket Keeper`;
      } else if (progress.batWkCombined.needed && progress.batWkCombined.needed > 0) {
        priority = 50 + progress.batWkCombined.needed * 5;
        reason = `Need ${progress.batWkCombined.needed} more BAT / WK`;
      }
      break;

    case 'Batsman':
      if (progress.batWkCombined.needed && progress.batWkCombined.needed > 0) {
        priority = 80 + progress.batWkCombined.needed * 10;
        reason = `Need ${progress.batWkCombined.needed} more BAT / WK`;
      }
      break;

    case 'All Rounder':
      if (progress.allRounders.needed && progress.allRounders.needed > 0) {
        priority = 90 + progress.allRounders.needed * 10;
        reason = `Need ${progress.allRounders.needed} more AR`;
      }
      break;

    case 'Bowler':
      if (progress.bowlers.needed && progress.bowlers.needed > 0) {
        priority = 85 + progress.bowlers.needed * 10;
        reason = `Need ${progress.bowlers.needed} more BOWL`;
      }
      break;
  }

  if (priority > 0 && reason) {
    return { isRecommended: true, reason, priority };
  }

  return { isRecommended: false, priority: 0 };
}

