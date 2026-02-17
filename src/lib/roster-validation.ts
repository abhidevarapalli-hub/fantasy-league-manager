import { Player } from './supabase-types';

// Roster constraints
// Roster configuration type
export interface LeagueConfig {
  managerCount: number;
  activeSize: number;
  benchSize: number;
  minBatsmen: number;
  maxBatsmen: number;
  minBowlers: number;
  minWks: number;
  minAllRounders: number;
  maxInternational: number;
}

// Default configuration for backwards compatibility and fallback
export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  managerCount: 8,
  activeSize: 11,
  benchSize: 3,
  minBatsmen: 1,
  maxBatsmen: 6,
  minBowlers: 3,
  minWks: 1,
  minAllRounders: 1,
  maxInternational: 4
};

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
  const totalMin = config.minWks + config.minBatsmen + config.minBowlers + config.minAllRounders;
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

  // Check strict minimums
  if (counts.wicketKeepers < config.minWks) {
    errors.push(`Need at least ${config.minWks} Wicket Keeper(s) (currently ${counts.wicketKeepers})`);
  }

  const batsmenPlusWk = counts.batsmen + counts.wicketKeepers;
  if (batsmenPlusWk < config.minBatsmen) {
    errors.push(`Need at least ${config.minBatsmen} Batsmen + WK (currently ${batsmenPlusWk})`);
  }

  if (counts.allRounders < config.minAllRounders) {
    errors.push(`Need at least ${config.minAllRounders} All Rounder(s) (currently ${counts.allRounders})`);
  }

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
 * This checks if adding a player would violate maximums or leave insufficient slots
 * for required minimums to be filled.
 */
export function canAddToActive(currentActive: Player[], playerToAdd: Player, config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): RosterValidationResult {
  const newActive = [...currentActive, playerToAdd];
  const counts = countRosterPlayers(newActive);
  const errors: string[] = [];

  // Immediate violations - these are always errors

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
  const wkDeficit = Math.max(0, config.minWks - counts.wicketKeepers);
  const batPlusWkDeficit = Math.max(0, config.minBatsmen - (counts.batsmen + counts.wicketKeepers));
  const arDeficit = Math.max(0, config.minAllRounders - counts.allRounders);
  const bowlerDeficit = Math.max(0, config.minBowlers - counts.bowlers);

  // Total minimum slots needed exclusively for specific roles
  // We need to satisfy the WK minimum AND the combined Bat+WK minimum.
  // The number of slots reserved for the batting group is max(wkDeficit, batPlusWkDeficit).
  const batWkSlotsNeeded = Math.max(wkDeficit, batPlusWkDeficit);
  const totalMinSlotsNeeded = batWkSlotsNeeded + arDeficit + bowlerDeficit;

  if (totalMinSlotsNeeded > remainingSlots) {
    // Determine which requirement is impossible to meet
    if (wkDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required Wicket Keeper(s)`);
    } else if (batPlusWkDeficit > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to satisfy the ${config.minBatsmen} Batsmen + WK requirement`);
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
// (Note: Removal is always allowed since the roster is incomplete)
export function canRemoveFromActive(currentActive: Player[], playerToRemove: Player): RosterValidationResult {
  const newActive = currentActive.filter(p => p.id !== playerToRemove.id);
  const counts = countRosterPlayers(newActive);
  // Removal is always valid - we're just making the roster smaller
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
  // Use canAddToActive for forward-looking validation
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
  const wkNeeded = Math.max(0, config.minWks - wkAdded);
  const batNeeded = Math.max(0, config.minBatsmen - (batAdded + wkAdded));
  const arNeeded = Math.max(0, config.minAllRounders - arAdded);
  const bowlersNeeded = Math.max(0, config.minBowlers - bowlerAdded);

  let slotsToFill = emptySlots;

  // Add specific needed slots
  for (let i = 0; i < wkNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Wicket Keeper', label: 'Wicket Keeper', filled: false });
    slotsToFill--;
  }

  for (let i = 0; i < batNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Batsman', label: 'Batsman', filled: false });
    slotsToFill--;
  }

  for (let i = 0; i < arNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'All Rounder', label: 'All Rounder', filled: false });
    slotsToFill--;
  }

  for (let i = 0; i < bowlersNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Bowler', label: 'Bowler', filled: false });
    slotsToFill--;
  }

  // Fill remaining with generic Any Position slots
  for (let i = 0; i < slotsToFill; i++) {
    slots.push({ role: 'Any Position', label: 'Any Position', filled: false });
  }

  // Re-sort slots for cleaner display
  // Order: Filled Players -> Required Empty Slots -> Flexible Empty Slots
  return slots.sort((a, b) => {
    // 1. Filled vs Empty
    if (a.filled && !b.filled) return -1;
    if (!a.filled && b.filled) return 1;

    // 2. Role Order
    const roleOrder: Record<string, number> = {
      'Wicket Keeper': 0,
      'Batsman': 1,
      'All Rounder': 2,
      'Bowler': 3,
      'Any Position': 4
    };

    // Safety check for role existing in map, though typed
    const aRole = a.player ? a.player.role : a.role;
    const bRole = b.player ? b.player.role : b.role;

    return (roleOrder[aRole] ?? 99) - (roleOrder[bRole] ?? 99);
  });
}

// Build an optimal Active roster from a list of players
export function buildOptimalActive11(allPlayers: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): { active: Player[]; bench: Player[] } {
  const active: Player[] = [];
  const bench: Player[] = [];

  // Sort by role priority for selection
  const wks = allPlayers.filter(p => p.role === 'Wicket Keeper');
  const bats = allPlayers.filter(p => p.role === 'Batsman');
  const ars = allPlayers.filter(p => p.role === 'All Rounder');
  const bowlers = allPlayers.filter(p => p.role === 'Bowler');

  // Track international count active
  let internationalCount = 0;
  const STRICT_MAX_INTL = 4;

  const tryAdd = (player: Player): boolean => {
    // Basic Active Cap Check (should strictly shouldn't be hit if logic is right, but good safety)
    if (active.length >= config.activeSize) return false;

    // International Limit Check
    if (player.isInternational && internationalCount >= STRICT_MAX_INTL) return false;

    // Duplicate Check
    if (active.some(p => p.id === player.id)) return false;

    active.push(player);
    if (player.isInternational) internationalCount++;
    return true;
  };

  // Helper: Try to add countNeeded from a specific list
  const addMandatory = (list: Player[], countNeeded: number) => {
    // Prioritize domestic to save international slots for flex/impact
    const domestic = list.filter(p => !p.isInternational);
    const international = list.filter(p => p.isInternational);

    let addedForCategory = 0;

    // 1. Domestic
    for (const p of domestic) {
      if (addedForCategory >= countNeeded) break;
      if (tryAdd(p)) addedForCategory++;
    }

    // 2. International
    for (const p of international) {
      if (addedForCategory >= countNeeded) break;
      if (tryAdd(p)) addedForCategory++;
    }
  };

  // 1. Fill Mandatory Slots
  // We strictly try to fill only the minimums here.
  addMandatory(wks, config.minWks);
  addMandatory(bats, config.minBatsmen);
  addMandatory(ars, config.minAllRounders);
  addMandatory(bowlers, config.minBowlers);

  // 2. Fill Flex Slots
  // "Flex" slots are the difference between Active Size and Total Minimums.
  // We CANNOT use a "Mandatory Slot" (e.g. a missing Wicket Keeper slot) for a flex player.
  // So we strictly limit how many *more* players we add based on the flex count.
  const totalMinReq = config.minWks + config.minBatsmen + config.minAllRounders + config.minBowlers;
  const maxFlexSlots = Math.max(0, config.activeSize - totalMinReq);

  // Players not yet active
  const remainingPlayers = allPlayers.filter(p => !active.some(a => a.id === p.id));

  // Sort remaining by some priority? 
  // Maybe International first since we might have saved slots? Or just best available?
  // Let's stick to initial order (usually name or previously sorted) or simple diversity.
  // For now, simple iteration.

  let flexAdded = 0;
  for (const p of remainingPlayers) {
    if (flexAdded >= maxFlexSlots) break;
    // tryAdd handles intl limits and duplicates
    if (tryAdd(p)) {
      flexAdded++;
    }
  }

  // 3. Everyone else to Bench
  for (const p of allPlayers) {
    if (!active.some(a => a.id === p.id)) {
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
  max?: number;
  status: ConstraintStatus;
  needed?: number; // How many more needed to meet minimum
}

export interface RosterProgress {
  wicketKeepers: ConstraintProgress;
  batsmen: ConstraintProgress;
  allRounders: ConstraintProgress;
  bowlers: ConstraintProgress;
  international: ConstraintProgress;
  wkBatCombined: ConstraintProgress;
  bwlArCombined: ConstraintProgress;
  total: { current: number; target: number };
}

// Helper functions for combined limits
export function getMinWkBat(config: LeagueConfig): number {
  return config.minWks + config.minBatsmen;
}

export function getMaxWkBat(config: LeagueConfig): number {
  return config.activeSize - config.minBowlers - config.minAllRounders;
}

// Additional helper for BWL+AR if needed (it was used in the file but I don't see it defined either)
export function getMinBwlAr(config: LeagueConfig): number {
  return config.minBowlers + config.minAllRounders;
}

/**
 * Calculate roster progress for draft UI
 * Shows current counts vs required minimums/maximums with status indicators
 */
export function getRosterProgress(players: Player[], config: LeagueConfig): RosterProgress {
  const counts = countRosterPlayers(players);
  const totalTarget = config.activeSize + config.benchSize;

  const wkBatCurrent = counts.wicketKeepers + counts.batsmen;
  const bwlArCurrent = counts.bowlers + counts.allRounders;

  // Helper to determine status
  const getStatus = (current: number, min?: number, max?: number): ConstraintStatus => {
    if (max !== undefined && current > max) return 'exceeded';
    if (min !== undefined && current < min) return 'warning';
    if (min !== undefined && current >= min) return 'met';
    return 'ok';
  };

  return {
    wicketKeepers: {
      current: counts.wicketKeepers,
      min: config.minWks,
      status: getStatus(counts.wicketKeepers, config.minWks),
      needed: Math.max(0, config.minWks - counts.wicketKeepers),
    },
    batsmen: {
      current: counts.batsmen,
      min: config.minBatsmen,
      max: config.maxBatsmen,
      status: getStatus(counts.batsmen, config.minBatsmen, config.maxBatsmen),
      needed: Math.max(0, config.minBatsmen - counts.batsmen),
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
      max: config.maxInternational,
      status: getStatus(counts.international, undefined, config.maxInternational),
    },
    wkBatCombined: {
      current: wkBatCurrent,
      min: getMinWkBat(config),
      max: getMaxWkBat(config),
      status: getStatus(wkBatCurrent, getMinWkBat(config), getMaxWkBat(config)),
      needed: Math.max(0, getMinWkBat(config) - wkBatCurrent),
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
 * Returns recommendation status with reason and priority
 */
export function getPlayerRecommendation(
  currentPicks: Player[],
  playerToEvaluate: Player,
  config: LeagueConfig
): PlayerRecommendation {
  const progress = getRosterProgress(currentPicks, config);
  const role = playerToEvaluate.role;
  const isInternational = playerToEvaluate.isInternational;

  // Check if adding this player would exceed limits
  if (isInternational && progress.international.current >= config.maxInternational) {
    return { isRecommended: false, priority: -1 }; // Would exceed international limit
  }

  // Priority scoring - higher priority for more urgent needs
  let priority = 0;
  let reason: string | undefined;

  // Check role-specific needs
  switch (role) {
    case 'Wicket Keeper':
      if (progress.wicketKeepers.needed && progress.wicketKeepers.needed > 0) {
        priority = 100 + progress.wicketKeepers.needed * 10;
        reason = `Need ${progress.wicketKeepers.needed} more WK`;
      } else if (progress.wkBatCombined.needed && progress.wkBatCombined.needed > 0) {
        priority = 50 + progress.wkBatCombined.needed * 5;
        reason = `Need ${progress.wkBatCombined.needed} more WK/BAT`;
      } else if (progress.wkBatCombined.current >= (progress.wkBatCombined.max || 6)) {
        return { isRecommended: false, priority: -1 }; // Would exceed WK+BAT max
      }
      break;

    case 'Batsman':
      if (progress.batsmen.current >= (progress.batsmen.max || config.maxBatsmen)) {
        return { isRecommended: false, priority: -1 }; // Would exceed batsmen max
      }
      if (progress.wkBatCombined.current >= (progress.wkBatCombined.max || 6)) {
        return { isRecommended: false, priority: -1 }; // Would exceed WK+BAT max
      }
      if (progress.batsmen.needed && progress.batsmen.needed > 0) {
        priority = 80 + progress.batsmen.needed * 10;
        reason = `Need ${progress.batsmen.needed} more BAT`;
      } else if (progress.wkBatCombined.needed && progress.wkBatCombined.needed > 0) {
        priority = 40 + progress.wkBatCombined.needed * 5;
        reason = `Need ${progress.wkBatCombined.needed} more WK/BAT`;
      }
      break;

    case 'All Rounder':
      if (progress.allRounders.needed && progress.allRounders.needed > 0) {
        priority = 90 + progress.allRounders.needed * 10;
        reason = `Need ${progress.allRounders.needed} more AR`;
      } else if (progress.bwlArCombined.needed && progress.bwlArCombined.needed > 0) {
        priority = 45 + progress.bwlArCombined.needed * 5;
        reason = `Need ${progress.bwlArCombined.needed} more BWL/AR`;
      }
      break;

    case 'Bowler':
      if (progress.bowlers.needed && progress.bowlers.needed > 0) {
        priority = 85 + progress.bowlers.needed * 10;
        reason = `Need ${progress.bowlers.needed} more BOWL`;
      } else if (progress.bwlArCombined.needed && progress.bwlArCombined.needed > 0) {
        priority = 45 + progress.bwlArCombined.needed * 5;
        reason = `Need ${progress.bwlArCombined.needed} more BWL/AR`;
      }
      break;
  }

  // Only recommend if there's a reason (unfilled requirement)
  if (priority > 0 && reason) {
    return { isRecommended: true, reason, priority };
  }

  return { isRecommended: false, priority: 0 };
}

