import { Player } from './supabase-types';

// Roster constraints
export const ACTIVE_ROSTER_SIZE = 11;
export const BENCH_SIZE = 14;
export const TOTAL_ROSTER_CAP = ACTIVE_ROSTER_SIZE + BENCH_SIZE; // 25 total (11 active + 14 bench)

// Active 11 constraints
export const MIN_WICKET_KEEPERS = 1;
export const MIN_BATSMEN_WK_COMBINED = 4;
export const MAX_BATSMEN_WK_COMBINED = 6;
export const MIN_ALL_ROUNDERS = 1;
export const MIN_BOWLERS = 3;
export const MIN_BOWLERS_ALLROUNDERS_COMBINED = 5;
export const MAX_INTERNATIONAL_PLAYERS = 4;

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
export function validateActiveRoster(players: Player[]): RosterValidationResult {
  const counts = countRosterPlayers(players);
  const errors: string[] = [];

  // Max 11 players
  if (counts.total > ACTIVE_ROSTER_SIZE) {
    errors.push(`Active roster cannot exceed ${ACTIVE_ROSTER_SIZE} players (currently ${counts.total})`);
  }

  // At least 1 WK
  if (counts.wicketKeepers < MIN_WICKET_KEEPERS) {
    errors.push(`Need at least ${MIN_WICKET_KEEPERS} Wicket Keeper (currently ${counts.wicketKeepers})`);
  }

  // 4-6 WK + Batsmen combined
  const batsmenWkTotal = counts.wicketKeepers + counts.batsmen;
  if (batsmenWkTotal < MIN_BATSMEN_WK_COMBINED) {
    errors.push(`Need at least ${MIN_BATSMEN_WK_COMBINED} Wicket Keepers + Batsmen combined (currently ${batsmenWkTotal})`);
  }
  if (batsmenWkTotal > MAX_BATSMEN_WK_COMBINED) {
    errors.push(`Cannot exceed ${MAX_BATSMEN_WK_COMBINED} Wicket Keepers + Batsmen combined (currently ${batsmenWkTotal})`);
  }

  // At least 1 All Rounder
  if (counts.allRounders < MIN_ALL_ROUNDERS) {
    errors.push(`Need at least ${MIN_ALL_ROUNDERS} All Rounder (currently ${counts.allRounders})`);
  }

  // At least 3 Bowlers
  if (counts.bowlers < MIN_BOWLERS) {
    errors.push(`Need at least ${MIN_BOWLERS} Bowlers (currently ${counts.bowlers})`);
  }

  // At least 5 Bowlers + All Rounders combined
  const bowlersArTotal = counts.bowlers + counts.allRounders;
  if (bowlersArTotal < MIN_BOWLERS_ALLROUNDERS_COMBINED) {
    errors.push(`Need at least ${MIN_BOWLERS_ALLROUNDERS_COMBINED} Bowlers + All Rounders combined (currently ${bowlersArTotal})`);
  }

  // Max 4 international players
  if (counts.international > MAX_INTERNATIONAL_PLAYERS) {
    errors.push(`Cannot exceed ${MAX_INTERNATIONAL_PLAYERS} international players (currently ${counts.international})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    counts,
  };
}

// Check if adding a player to active roster would be valid
export function canAddToActive(currentActive: Player[], playerToAdd: Player): RosterValidationResult {
  const newActive = [...currentActive, playerToAdd];
  return validateActiveRoster(newActive);
}

// Check if removing a player from active roster would still be valid
export function canRemoveFromActive(currentActive: Player[], playerToRemove: Player): RosterValidationResult {
  const newActive = currentActive.filter(p => p.id !== playerToRemove.id);
  return validateActiveRoster(newActive);
}

// Check if swapping a player (for roster transactions) would be valid
export function canSwapInActive(
  currentActive: Player[],
  playerToAdd: Player,
  playerToRemove: Player
): RosterValidationResult {
  const newActive = currentActive.filter(p => p.id !== playerToRemove.id);
  newActive.push(playerToAdd);
  return validateActiveRoster(newActive);
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
export function getActiveRosterSlots(players: Player[]): SlotRequirement[] {
  const sorted = sortPlayersByRole(players);
  const counts = countRosterPlayers(players);
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
  const totalSlots = ACTIVE_ROSTER_SIZE;
  const filledSlots = sorted.length;
  const emptySlots = totalSlots - filledSlots;

  if (emptySlots <= 0) return slots;

  // Determine minimum requirements not yet met
  const wkNeeded = Math.max(0, MIN_WICKET_KEEPERS - wkAdded);
  const batsmenWkNeeded = Math.max(0, MIN_BATSMEN_WK_COMBINED - wkAdded - batAdded);
  const arNeeded = Math.max(0, MIN_ALL_ROUNDERS - arAdded);
  const bowlersNeeded = Math.max(0, MIN_BOWLERS - bowlerAdded);
  const bowlersArNeeded = Math.max(0, MIN_BOWLERS_ALLROUNDERS_COMBINED - bowlerAdded - arAdded);

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
export function buildOptimalActive11(allPlayers: Player[]): { active: Player[]; bench: Player[] } {
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
    if (active.length >= ACTIVE_ROSTER_SIZE) return false;
    if (player.isInternational && internationalCount >= MAX_INTERNATIONAL_PLAYERS) return false;
    
    active.push(player);
    if (player.isInternational) internationalCount++;
    return true;
  };

  // First, ensure minimums are met (prefer domestic players first to save international slots)
  
  // 1. Add 1 WK (prefer domestic)
  const domesticWks = wks.filter(p => !p.isInternational);
  const intlWks = wks.filter(p => p.isInternational);
  if (domesticWks.length > 0) {
    tryAdd(domesticWks[0]);
  } else if (intlWks.length > 0) {
    tryAdd(intlWks[0]);
  }

  // 2. Add at least 1 AR (prefer domestic)
  const domesticArs = ars.filter(p => !p.isInternational);
  const intlArs = ars.filter(p => p.isInternational);
  const addedArs: Player[] = [];
  
  if (domesticArs.length > 0) {
    if (tryAdd(domesticArs[0])) addedArs.push(domesticArs[0]);
  } else if (intlArs.length > 0) {
    if (tryAdd(intlArs[0])) addedArs.push(intlArs[0]);
  }

  // 3. Add at least 3 Bowlers (prefer domestic)
  const domesticBowlers = bowlers.filter(p => !p.isInternational);
  const intlBowlers = bowlers.filter(p => p.isInternational);
  const addedBowlers: Player[] = [];
  
  for (const bowler of [...domesticBowlers, ...intlBowlers]) {
    if (addedBowlers.length >= 3) break;
    if (tryAdd(bowler)) addedBowlers.push(bowler);
  }

  // Now check if we have enough bowlers+ARs (need 5 combined)
  const currentBowlerAr = addedBowlers.length + addedArs.length;
  const neededBowlerAr = Math.max(0, MIN_BOWLERS_ALLROUNDERS_COMBINED - currentBowlerAr);
  
  // Add more ARs or Bowlers as needed
  const remainingArs = [...domesticArs, ...intlArs].filter(p => !addedArs.includes(p));
  const remainingBowlers = [...domesticBowlers, ...intlBowlers].filter(p => !addedBowlers.includes(p));
  
  let added = 0;
  for (const player of [...remainingArs, ...remainingBowlers]) {
    if (added >= neededBowlerAr) break;
    if (tryAdd(player)) {
      added++;
      if (player.role === 'All Rounder') addedArs.push(player);
      else addedBowlers.push(player);
    }
  }

  // 4. Add remaining WK/Batsmen to reach 4-6 combined
  const addedWkBat: Player[] = active.filter(p => p.role === 'Wicket Keeper' || p.role === 'Batsman');
  const neededWkBat = Math.max(0, MIN_BATSMEN_WK_COMBINED - addedWkBat.length);
  
  const remainingWks = [...domesticWks, ...intlWks].filter(p => !active.includes(p));
  const domesticBats = bats.filter(p => !p.isInternational);
  const intlBats = bats.filter(p => p.isInternational);
  
  let wkBatAdded = 0;
  for (const player of [...remainingWks, ...domesticBats, ...intlBats]) {
    if (wkBatAdded >= neededWkBat) break;
    if (tryAdd(player)) wkBatAdded++;
  }

  // 5. Fill remaining slots (up to 11) with any remaining players, respecting max 6 WK+BAT
  const allRemaining = allPlayers.filter(p => !active.includes(p));
  const currentWkBat = active.filter(p => p.role === 'Wicket Keeper' || p.role === 'Batsman').length;
  
  for (const player of allRemaining) {
    if (active.length >= ACTIVE_ROSTER_SIZE) break;
    
    // Check if adding would exceed WK+BAT limit
    if ((player.role === 'Wicket Keeper' || player.role === 'Batsman')) {
      const futureWkBat = active.filter(p => p.role === 'Wicket Keeper' || p.role === 'Batsman').length + 1;
      if (futureWkBat > MAX_BATSMEN_WK_COMBINED) continue;
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
