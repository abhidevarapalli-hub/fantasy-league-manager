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
  draftTimerSeconds?: number;
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
  maxInternational: 11,
  requireWk: true,
  maxFromTeam: 11,
  draftTimerSeconds: 60
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

/**
 * Role Compatibility Matrix
 * Defines which roles can be placed into which slots.
 */
export const ROLE_COMPATIBILITY: Record<PlayerRole, (PlayerRole | 'Any Position' | 'BENCH')[]> = {
  'Wicket Keeper': ['Wicket Keeper', 'Batsman', 'Any Position', 'BENCH'],
  'Batsman': ['Batsman', 'Any Position', 'BENCH'],
  'All Rounder': ['All Rounder', 'Any Position', 'BENCH'],
  'Bowler': ['Bowler', 'Any Position', 'BENCH']
};

export function isRoleCompatible(playerRole: PlayerRole, targetSlotRole: PlayerRole | 'Any Position' | 'BENCH'): boolean {
  return ROLE_COMPATIBILITY[playerRole].includes(targetSlotRole);
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

  // Max International - Enforce according to config
  if (counts.international > config.maxInternational) {
    errors.push(`Cannot exceed ${config.maxInternational} international players (currently ${counts.international})`);
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

  // Max international players - Enforce according to config
  if (counts.international > config.maxInternational) {
    errors.push(`Cannot exceed ${config.maxInternational} international players (currently ${counts.international})`);
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

export function canSwapInActive(
  currentActive: Player[],
  playerToAdd: Player,
  playerToRemove: Player,
  targetSlotRole: PlayerRole | 'Any Position' | 'BENCH' = 'Any Position',
  config: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): RosterValidationResult {
  // 1. Role Compatibility Check (Source of Truth)
  if (!isRoleCompatible(playerToAdd.role, targetSlotRole)) {
    return {
      isValid: false,
      errors: [`Position constraint: ${playerToAdd.role} cannot move to ${targetSlotRole} slot`],
      counts: countRosterPlayers([...currentActive.filter(p => p.id !== playerToRemove.id), playerToAdd])
    };
  }

  // 2. Full Simulated Validation
  const newActive = [...currentActive.filter(p => p.id !== playerToRemove.id), playerToAdd];

  // If we are at full strength (11 players), we must strictly validate the resulting squad
  if (newActive.length === config.activeSize) {
    const validationResult = validateActiveRoster(newActive, config);
    if (!validationResult.isValid) {
      return {
        ...validationResult,
        errors: validationResult.errors.map(err => `Roster constraint: ${err}`)
      };
    }
  }

  // 3. Forward-looking validation (Ensuring future holes CAN be filled)
  const activeAfterRemoval = currentActive.filter(p => p.id !== playerToRemove.id);
  return canAddToActive(activeAfterRemoval, playerToAdd, config);
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
  const unassigned = [...players];
  const slots: SlotRequirement[] = [];

  const pullPlayer = (roles: PlayerRole[]) => {
    const idx = unassigned.findIndex(p => roles.includes(p.role));
    if (idx !== -1) return unassigned.splice(idx, 1)[0] || null;
    return null;
  };

  // 1. Mandatory WK
  if (config.requireWk) {
    const p = pullPlayer(['Wicket Keeper']);
    slots.push({
      role: 'Wicket Keeper',
      label: 'WK Required',
      filled: !!p,
      player: p || undefined
    });
  }

  // 2. Mandatory BAT / WK (remaining after 1 WK if required)
  const currentBatWk = slots.filter(s => s.role === 'Wicket Keeper' || s.role === 'Batsman').length;
  const batWkNeeded = Math.max(0, config.minBatWk - currentBatWk);
  for (let i = 0; i < batWkNeeded; i++) {
    const p = pullPlayer(['Batsman', 'Wicket Keeper']);
    slots.push({
      role: 'Batsman',
      label: 'BAT / WK',
      filled: !!p,
      player: p || undefined
    });
  }

  // 3. Mandatory All Rounders
  const currentAR = slots.filter(s => s.role === 'All Rounder').length;
  const arNeeded = Math.max(0, config.minAllRounders - currentAR);
  for (let i = 0; i < arNeeded; i++) {
    const p = pullPlayer(['All Rounder']);
    slots.push({
      role: 'All Rounder',
      label: 'All Rounder',
      filled: !!p,
      player: p || undefined
    });
  }

  // 4. Mandatory Bowlers
  const currentBowlers = slots.filter(s => s.role === 'Bowler').length;
  const bowlersNeeded = Math.max(0, config.minBowlers - currentBowlers);
  for (let i = 0; i < bowlersNeeded; i++) {
    const p = pullPlayer(['Bowler']);
    slots.push({
      role: 'Bowler',
      label: 'Bowler',
      filled: !!p,
      player: p || undefined
    });
  }

  // 5. Flex Slots
  const totalMandatoryAdded = slots.length;
  const flexNeeded = Math.max(0, config.activeSize - totalMandatoryAdded);
  for (let i = 0; i < flexNeeded; i++) {
    const p = unassigned.shift();
    slots.push({
      role: 'Any Position',
      label: 'Flex Slot',
      filled: !!p,
      player: p || undefined
    });
  }

  return slots;
}

// Build an optimal Active roster from a list of players
export function buildOptimalActive11(allPlayers: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): { active: Player[]; bench: Player[] } {
  const active: Player[] = [];
  const bench: Player[] = [];
  let internationalCount = 0;

  // Track players already assigned to active
  const assignedIds = new Set<string>();

  // Use the provided order (e.g. Draft Order) as the priority
  // We no longer sort by ID here to allow the caller to define the tie-breaking priority.

  // Slot counters to track filled mandatory positions
  let wkCount = 0;
  let bowlerCount = 0;
  let arCount = 0;
  let batWkCount = 0; // Combined Batsmen + Wicket Keepers for the generic BAT slots
  let flexCount = 0;

  const flexCapacity = Math.max(0, config.activeSize - (config.minBatWk + config.minBowlers + config.minAllRounders));

  for (const player of allPlayers) {
    if (assignedIds.has(player.id)) continue;

    // Hard limit on total active size
    if (active.length >= config.activeSize) {
      bench.push(player);
      continue;
    }

    // International player limit (hard constraint)
    if (player.isInternational && internationalCount >= config.maxInternational) {
      bench.push(player);
      continue;
    }

    let assigned = false;

    // 1. Mandatory Role Slots (Higher priority than Flex)
    if (player.role === 'Wicket Keeper' && wkCount < 1 && config.requireWk) {
      // Primary WK slot
      wkCount++;
      batWkCount++; // WK also counts towards one of the BAT/WK mandatory minimums
      assigned = true;
    } else if (player.role === 'Bowler' && bowlerCount < config.minBowlers) {
      bowlerCount++;
      assigned = true;
    } else if (player.role === 'All Rounder' && arCount < config.minAllRounders) {
      arCount++;
      assigned = true;
    } else if ((player.role === 'Batsman' || (player.role === 'Wicket Keeper' && wkCount >= 1)) && batWkCount < config.minBatWk) {
      // Note: If mandatory WK is already met, a second WK can fill a standard "Batsman" slot
      batWkCount++;
      assigned = true;
    }

    // 2. Flex Slots (Lower priority - can be filled by any role if mandatory slots are full)
    if (!assigned && flexCount < flexCapacity) {
      flexCount++;
      assigned = true;
    }

    if (assigned) {
      active.push(player);
      assignedIds.add(player.id);
      if (player.isInternational) internationalCount++;
    } else {
      bench.push(player);
    }
  }

  // Post-loop: account for unfilled mandatory slots.
  // Each unfilled mandatory slot takes up a display position in activeSize,
  // reducing the effective player capacity. Move excess players to bench.
  // This allows bench to exceed benchSize to keep total roster intact.
  let unfilledMandatory = 0;
  if (config.requireWk && wkCount < 1) unfilledMandatory++;
  // BAT/WK display slots = max(0, minBatWk - (requireWk ? 1 : 0))
  // BAT players filled = batWkCount - wkCount (exclude WK contribution)
  const batSlotsInDisplay = Math.max(0, config.minBatWk - (config.requireWk ? 1 : 0));
  const batPlayersFilled = batWkCount - wkCount;
  unfilledMandatory += Math.max(0, batSlotsInDisplay - batPlayersFilled);
  unfilledMandatory += Math.max(0, config.minAllRounders - arCount);
  unfilledMandatory += Math.max(0, config.minBowlers - bowlerCount);

  // Only displace players that EXCEED the effective capacity.
  // Unfilled mandatory slots reduce capacity but don't displace 1:1 —
  // players in valid AR/flex slots should remain active.
  const effectiveCapacity = Math.max(0, config.activeSize - unfilledMandatory);
  const toDisplace = Math.max(0, active.length - effectiveCapacity);
  for (let i = 0; i < toDisplace; i++) {
    const displaced = active.pop()!;
    bench.unshift(displaced);
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
      status: getStatus(counts.international, undefined, config.maxInternational),
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

  if (isInternational && progress.international.current >= config.maxInternational) {
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

