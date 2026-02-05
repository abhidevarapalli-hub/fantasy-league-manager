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

// Internal helpers for combined rules based on current standard fantasy logic
// These may need to be made configurable too, but for now we derive them from the base rules
const getMinWkBat = (config: LeagueConfig) => 4; // Standard for 11 players
const getMaxWkBat = (config: LeagueConfig) => 6; // Standard for 11 players
const getMinBwlAr = (config: LeagueConfig) => 5; // Standard for 11 players


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
  role: PlayerRole | 'WK/BAT' | 'AR/BWL';
  label: string;
  filled: boolean;
  player?: Player;
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

// Validate if a roster meets Active 11 requirements
export function validateActiveRoster(players: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): RosterValidationResult {
  const counts = countRosterPlayers(players);
  const errors: string[] = [];

  // Max players
  if (counts.total > config.activeSize) {
    errors.push(`Active roster cannot exceed ${config.activeSize} players (currently ${counts.total})`);
  }

  // At least MIN WKs
  if (counts.wicketKeepers < config.minWks) {
    errors.push(`Need at least ${config.minWks} Wicket Keeper (currently ${counts.wicketKeepers})`);
  }

  // WK + Batsmen combined
  const batsmenWkTotal = counts.wicketKeepers + counts.batsmen;
  if (batsmenWkTotal < getMinWkBat(config)) {
    errors.push(`Need at least ${getMinWkBat(config)} Wicket Keepers + Batsmen combined (currently ${batsmenWkTotal})`);
  }
  if (batsmenWkTotal > getMaxWkBat(config)) {
    errors.push(`Cannot exceed ${getMaxWkBat(config)} Wicket Keepers + Batsmen combined (currently ${batsmenWkTotal})`);
  }

  // At least MIN All Rounder
  if (counts.allRounders < config.minAllRounders) {
    errors.push(`Need at least ${config.minAllRounders} All Rounder (currently ${counts.allRounders})`);
  }

  // At least MIN Bowlers
  if (counts.bowlers < config.minBowlers) {
    errors.push(`Need at least ${config.minBowlers} Bowlers (currently ${counts.bowlers})`);
  }

  // Bowlers + All Rounders combined
  const bowlersArTotal = counts.bowlers + counts.allRounders;
  if (bowlersArTotal < getMinBwlAr(config)) {
    errors.push(`Need at least ${getMinBwlAr(config)} Bowlers + All Rounders combined (currently ${bowlersArTotal})`);
  }

  // Max international players
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

  // Max international players
  if (counts.international > config.maxInternational) {
    errors.push(`Cannot exceed ${config.maxInternational} international players (currently ${counts.international})`);
    return { isValid: false, errors, counts };
  }

  // Max WK + Batsmen combined
  const batsmenWkTotal = counts.wicketKeepers + counts.batsmen;
  if (batsmenWkTotal > getMaxWkBat(config)) {
    errors.push(`Cannot exceed ${getMaxWkBat(config)} Wicket Keepers + Batsmen combined (currently ${batsmenWkTotal})`);
    return { isValid: false, errors, counts };
  }

  // Forward-looking validation: Check if requirements CAN still be met
  const remainingSlots = config.activeSize - counts.total;

  // Calculate deficits - how many more of each type we need
  const wkDeficit = Math.max(0, config.minWks - counts.wicketKeepers);
  const arDeficit = Math.max(0, config.minAllRounders - counts.allRounders);
  const bowlerDeficit = Math.max(0, config.minBowlers - counts.bowlers);

  // WK+BAT combined deficit (WK can satisfy both WK requirement AND WK+BAT requirement)
  const currentWkBat = counts.wicketKeepers + counts.batsmen;
  const wkBatDeficit = Math.max(0, getMinWkBat(config) - currentWkBat);
  // But if we still need WK, those WK will also count toward WK+BAT
  const additionalWkBatNeeded = Math.max(0, wkBatDeficit - wkDeficit);

  // BWL+AR combined deficit
  const currentBwlAr = counts.bowlers + counts.allRounders;
  const bwlArDeficit = Math.max(0, getMinBwlAr(config) - currentBwlAr);
  // Bowlers and ARs we still need will also count toward BWL+AR
  const additionalBwlArNeeded = Math.max(0, bwlArDeficit - bowlerDeficit - arDeficit);

  // Total minimum slots we need to fill with specific roles
  // WK requirement can be filled by WK (who also count toward WK+BAT)
  // Additional WK+BAT can be filled by WK or BAT
  // AR requirement must be filled by AR (who also count toward BWL+AR)
  // Bowler requirement must be filled by BWL (who also count toward BWL+AR)
  // Additional BWL+AR can be filled by BWL or AR

  // The key insight: some positions are "flexible" and some are "strict"
  // We need to check if the remaining slots can accommodate all strict requirements

  // Minimum slots needed for strict requirements (can't be substituted)
  const strictWkNeeded = wkDeficit; // Must have at least X WK
  const strictArNeeded = arDeficit; // Must have at least X AR  
  const strictBowlerNeeded = bowlerDeficit; // Must have at least X BWL

  // These can be filled flexibly
  const flexWkBatNeeded = additionalWkBatNeeded; // Can be WK or BAT
  const flexBwlArNeeded = additionalBwlArNeeded; // Can be BWL or AR

  // Total minimum role-specific slots needed
  const totalMinSlotsNeeded = strictWkNeeded + strictArNeeded + strictBowlerNeeded + flexWkBatNeeded + flexBwlArNeeded;

  if (totalMinSlotsNeeded > remainingSlots) {
    // Determine which requirement is impossible to meet
    if (strictWkNeeded > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required Wicket Keeper(s)`);
    } else if (strictWkNeeded + strictBowlerNeeded > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required Bowlers`);
    } else if (strictWkNeeded + strictBowlerNeeded + strictArNeeded > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining to add required All Rounder(s)`);
    } else if (strictWkNeeded + strictBowlerNeeded + strictArNeeded + flexWkBatNeeded > remainingSlots) {
      errors.push(`Cannot add this player: not enough slots remaining for minimum ${getMinWkBat(config)} WK+Batsmen`);
    } else {
      errors.push(`Cannot add this player: not enough slots remaining for minimum ${getMinBwlAr(config)} Bowlers+All Rounders`);
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


// Sort players by role priority for Active 11 display
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

// Get the display slots for Active 11 with empty placeholders
export function getActiveRosterSlots(players: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): SlotRequirement[] {
  const sorted = sortPlayersByRole(players);
  // const counts = countRosterPlayers(players);
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
  const batsmenWkNeeded = Math.max(0, getMinWkBat(config) - wkAdded - batAdded);
  const arNeeded = Math.max(0, config.minAllRounders - arAdded);
  const bowlersNeeded = Math.max(0, config.minBowlers - bowlerAdded);
  const bowlersArNeeded = Math.max(0, getMinBwlAr(config) - bowlerAdded - arAdded);


  let slotsToFill = emptySlots;

  // Add WK slots first
  for (let i = 0; i < wkNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Wicket Keeper', label: 'Wicket Keeper', filled: false });
    slotsToFill--;
  }

  // Add remaining BAT/WK slots
  for (let i = 0; i < batsmenWkNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'WK/BAT', label: 'WK or Batsman', filled: false });
    slotsToFill--;
  }

  // Add AR slots
  for (let i = 0; i < arNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'All Rounder', label: 'All Rounder', filled: false });
    slotsToFill--;
  }

  // Add Bowler slots
  for (let i = 0; i < bowlersNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'Bowler', label: 'Bowler', filled: false });
    slotsToFill--;
  }

  // Add remaining Bowler/AR slots
  const remainingBowlerArNeeded = Math.max(0, bowlersArNeeded - bowlersNeeded - arNeeded);
  for (let i = 0; i < remainingBowlerArNeeded && slotsToFill > 0; i++) {
    slots.push({ role: 'AR/BWL', label: 'AR or Bowler', filled: false });
    slotsToFill--;
  }

  // Fill remaining with flexible slots
  for (let i = 0; i < slotsToFill; i++) {
    slots.push({ role: 'WK/BAT', label: 'Any Position', filled: false });
  }

  // Re-sort slots: filled by role order first, then empty by role requirement
  return slots.sort((a, b) => {
    // Filled slots come first within their role groups
    if (a.filled && !b.filled) {
      // Compare a's player role to b's slot role
      const aRole = a.player!.role;
      const roleOrder: Record<string, number> = {
        'Wicket Keeper': 0,
        'Batsman': 1,
        'WK/BAT': 1.5,
        'All Rounder': 2,
        'AR/BWL': 2.5,
        'Bowler': 3,
      };
      const aOrder = roleOrder[aRole];
      const bOrder = roleOrder[b.role];
      return aOrder - bOrder;
    }
    if (!a.filled && b.filled) {
      const bRole = b.player!.role;
      const roleOrder: Record<string, number> = {
        'Wicket Keeper': 0,
        'Batsman': 1,
        'WK/BAT': 1.5,
        'All Rounder': 2,
        'AR/BWL': 2.5,
        'Bowler': 3,
      };
      const aOrder = roleOrder[a.role];
      const bOrder = roleOrder[bRole];
      return aOrder - bOrder;
    }
    if (a.filled && b.filled) {
      const roleOrder: Record<PlayerRole, number> = {
        'Wicket Keeper': 0,
        'Batsman': 1,
        'All Rounder': 2,
        'Bowler': 3,
      };
      return roleOrder[a.player!.role] - roleOrder[b.player!.role];
    }
    // Both empty - sort by role requirement
    const roleOrder: Record<string, number> = {
      'Wicket Keeper': 0,
      'WK/BAT': 1,
      'Batsman': 1.5,
      'All Rounder': 2,
      'AR/BWL': 2.5,
      'Bowler': 3,
    };
    return roleOrder[a.role] - roleOrder[b.role];
  });
}

// Build an optimal Active 11 from a list of players
export function buildOptimalActive11(allPlayers: Player[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): { active: Player[]; bench: Player[] } {
  const active: Player[] = [];
  const bench: Player[] = [];

  // Sort by role priority for selection
  const wks = allPlayers.filter(p => p.role === 'Wicket Keeper');
  const bats = allPlayers.filter(p => p.role === 'Batsman');
  const ars = allPlayers.filter(p => p.role === 'All Rounder');
  const bowlers = allPlayers.filter(p => p.role === 'Bowler');

  // Track international count
  let internationalCount = 0;

  const tryAdd = (player: Player): boolean => {
    if (active.length >= config.activeSize) return false;
    if (player.isInternational && internationalCount >= config.maxInternational) return false;

    active.push(player);
    if (player.isInternational) internationalCount++;
    return true;
  };

  // First, ensure minimums are met (prefer domestic players first to save international slots)

  // 1. Add MIN Wks (prefer domestic)
  const domesticWks = wks.filter(p => !p.isInternational);
  const intlWks = wks.filter(p => p.isInternational);
  const addedWks: Player[] = [];
  for (const wk of [...domesticWks, ...intlWks]) {
    if (addedWks.length >= config.minWks) break;
    if (tryAdd(wk)) addedWks.push(wk);
  }

  // 2. Add at least MIN AR (prefer domestic)
  const domesticArs = ars.filter(p => !p.isInternational);
  const intlArs = ars.filter(p => p.isInternational);
  const addedArs: Player[] = [];
  for (const ar of [...domesticArs, ...intlArs]) {
    if (addedArs.length >= config.minAllRounders) break;
    if (tryAdd(ar)) addedArs.push(ar);
  }

  // 3. Add at least MIN Bowlers (prefer domestic)
  const domesticBowlers = bowlers.filter(p => !p.isInternational);
  const intlBowlers = bowlers.filter(p => p.isInternational);
  const addedBowlers: Player[] = [];

  for (const bowler of [...domesticBowlers, ...intlBowlers]) {
    if (addedBowlers.length >= config.minBowlers) break;
    if (tryAdd(bowler)) addedBowlers.push(bowler);
  }

  // Now check if we have enough bowlers+ARs (need getMinBwlArCombined)
  const currentBowlerAr = addedBowlers.length + addedArs.length;
  const neededBowlerAr = Math.max(0, getMinBwlAr(config) - currentBowlerAr);

  // Add more ARs or Bowlers as needed
  const remainingArs = [...domesticArs, ...intlArs].filter(p => !addedArs.includes(p));
  const remainingBowlers = [...domesticBowlers, ...intlBowlers].filter(p => !addedBowlers.includes(p));

  let bwlArAdded = 0;
  for (const player of [...remainingArs, ...remainingBowlers]) {
    if (bwlArAdded >= neededBowlerAr) break;
    if (tryAdd(player)) {
      bwlArAdded++;
      if (player.role === 'All Rounder') addedArs.push(player);
      else addedBowlers.push(player);
    }
  }

  // 4. Add remaining WK/Batsmen to reach getMinWkBat combined
  const addedWkBat: Player[] = active.filter(p => p.role === 'Wicket Keeper' || p.role === 'Batsman');
  const neededWkBat = Math.max(0, getMinWkBat(config) - addedWkBat.length);

  const remainingWks = [...domesticWks, ...intlWks].filter(p => !active.includes(p));
  const domesticBats = bats.filter(p => !p.isInternational);
  const intlBats = bats.filter(p => p.isInternational);

  let wkBatAddedCount = 0;
  for (const player of [...remainingWks, ...domesticBats, ...intlBats]) {
    if (wkBatAddedCount >= neededWkBat) break;
    if (tryAdd(player)) wkBatAddedCount++;
  }

  // 5. Fill remaining slots (up to activeSize) with any remaining players, respecting getMaxWkBat combined
  const allRemaining = allPlayers.filter(p => !active.includes(p));

  for (const player of allRemaining) {
    if (active.length >= config.activeSize) break;

    // Check if adding would exceed WK+BAT limit
    if ((player.role === 'Wicket Keeper' || player.role === 'Batsman')) {
      const futureWkBat = active.filter(p => p.role === 'Wicket Keeper' || p.role === 'Batsman').length + 1;
      if (futureWkBat > getMaxWkBat(config)) continue;
    }

    tryAdd(player);
  }


  // All remaining players go to bench
  for (const player of allPlayers) {
    if (!active.includes(player)) {
      bench.push(player);
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
