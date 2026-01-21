import { useState, useCallback, useRef } from 'react';
import { Player } from '@/lib/supabase-types';
import { sortPlayersByPriority } from '@/lib/player-order';
import { 
  MIN_WICKET_KEEPERS,
  MIN_BATSMEN_WK_COMBINED,
  MAX_BATSMEN_WK_COMBINED,
  MIN_ALL_ROUNDERS,
  MIN_BOWLERS,
  MIN_BOWLERS_ALLROUNDERS_COMBINED,
  MAX_INTERNATIONAL_PLAYERS,
  TOTAL_ROSTER_SIZE,
} from '@/lib/roster-validation';

const TEAMS = 8;
const ROUNDS = 14;
const AUTO_PICK_DELAY = 3000; // 3 seconds

export interface MockDraftPick {
  round: number;
  position: number;
  playerId: string;
  teamIndex: number;
}

export interface MockDraftState {
  isActive: boolean;
  isComplete: boolean;
  userPosition: number | null; // 1-8, user's draft position
  picks: MockDraftPick[];
  currentRound: number;
  currentPickIndex: number; // 0-7 within round (for snake order)
  teamRosters: Map<number, string[]>; // teamIndex -> player IDs
}

interface RosterCounts {
  wicketKeepers: number;
  batsmen: number;
  allRounders: number;
  bowlers: number;
  international: number;
  total: number;
}

export const useMockDraft = (allPlayers: Player[]) => {
  const [state, setState] = useState<MockDraftState>({
    isActive: false,
    isComplete: false,
    userPosition: null,
    picks: [],
    currentRound: 1,
    currentPickIndex: 0,
    teamRosters: new Map(),
  });

  const abortRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sort players by priority for "top players" ordering
  const sortedPlayers = sortPlayersByPriority(allPlayers);

  const getTeamRosterCounts = useCallback((teamIndex: number, rosters: Map<number, string[]>): RosterCounts => {
    const playerIds = rosters.get(teamIndex) || [];
    const teamPlayers = playerIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    
    return {
      wicketKeepers: teamPlayers.filter(p => p.role === 'Wicket Keeper').length,
      batsmen: teamPlayers.filter(p => p.role === 'Batsman').length,
      allRounders: teamPlayers.filter(p => p.role === 'All Rounder').length,
      bowlers: teamPlayers.filter(p => p.role === 'Bowler').length,
      international: teamPlayers.filter(p => p.isInternational).length,
      total: teamPlayers.length,
    };
  }, [allPlayers]);

  const getNeededRoles = useCallback((counts: RosterCounts, remainingPicks: number): string[] => {
    const neededRoles: string[] = [];
    
    // Calculate deficits for minimum requirements
    const wkDeficit = Math.max(0, MIN_WICKET_KEEPERS - counts.wicketKeepers);
    const arDeficit = Math.max(0, MIN_ALL_ROUNDERS - counts.allRounders);
    const bowlerDeficit = Math.max(0, MIN_BOWLERS - counts.bowlers);
    
    // WK+BAT combined deficit
    const currentWkBat = counts.wicketKeepers + counts.batsmen;
    const wkBatDeficit = Math.max(0, MIN_BATSMEN_WK_COMBINED - currentWkBat);
    
    // BWL+AR combined deficit  
    const currentBwlAr = counts.bowlers + counts.allRounders;
    const bwlArDeficit = Math.max(0, MIN_BOWLERS_ALLROUNDERS_COMBINED - currentBwlAr);

    // Priority order: first fill strict minimums
    if (wkDeficit > 0) neededRoles.push('Wicket Keeper');
    if (arDeficit > 0) neededRoles.push('All Rounder');
    if (bowlerDeficit > 0) neededRoles.push('Bowler');
    
    // Then flexible slots
    if (wkBatDeficit > wkDeficit) {
      neededRoles.push('Batsman');
      neededRoles.push('Wicket Keeper');
    }
    if (bwlArDeficit > bowlerDeficit + arDeficit) {
      neededRoles.push('Bowler');
      neededRoles.push('All Rounder');
    }

    // If no specific needs, all roles are fine but check max constraints
    if (neededRoles.length === 0) {
      // Check if we can add more WK/BAT
      if (currentWkBat < MAX_BATSMEN_WK_COMBINED) {
        neededRoles.push('Wicket Keeper', 'Batsman');
      }
      // Always can add more AR/BWL
      neededRoles.push('All Rounder', 'Bowler');
    }

    return [...new Set(neededRoles)]; // Remove duplicates
  }, []);

  const selectPlayerForTeam = useCallback((
    teamIndex: number,
    availablePlayers: Player[],
    rosters: Map<number, string[]>
  ): Player | null => {
    const counts = getTeamRosterCounts(teamIndex, rosters);
    const remainingPicks = TOTAL_ROSTER_SIZE - counts.total;
    
    if (remainingPicks <= 0) return null;

    const neededRoles = getNeededRoles(counts, remainingPicks);
    
    // Filter available players by needed roles and international limit
    const canAddInternational = counts.international < MAX_INTERNATIONAL_PLAYERS;
    
    let eligiblePlayers = availablePlayers.filter(p => {
      if (!canAddInternational && p.isInternational) return false;
      return neededRoles.includes(p.role);
    });

    // If no eligible players with needed roles, fall back to any available
    if (eligiblePlayers.length === 0) {
      eligiblePlayers = availablePlayers.filter(p => {
        if (!canAddInternational && p.isInternational) return false;
        // Check WK/BAT max
        const currentWkBat = counts.wicketKeepers + counts.batsmen;
        if ((p.role === 'Wicket Keeper' || p.role === 'Batsman') && currentWkBat >= MAX_BATSMEN_WK_COMBINED) {
          return false;
        }
        return true;
      });
    }

    if (eligiblePlayers.length === 0) return null;

    // Take top 15 (sorted by priority) and randomly select one
    const top15 = eligiblePlayers.slice(0, 15);
    const randomIndex = Math.floor(Math.random() * top15.length);
    return top15[randomIndex];
  }, [getTeamRosterCounts, getNeededRoles]);

  // Get the team index that picks at a given round and pick position
  const getTeamForPick = useCallback((round: number, pickIndex: number): number => {
    // Snake draft: odd rounds go 0->7, even rounds go 7->0
    if (round % 2 === 1) {
      return pickIndex; // 0, 1, 2, ..., 7
    } else {
      return TEAMS - 1 - pickIndex; // 7, 6, 5, ..., 0
    }
  }, []);

  const startMockDraft = useCallback((userPosition: number) => {
    abortRef.current = false;
    setState({
      isActive: true,
      isComplete: false,
      userPosition,
      picks: [],
      currentRound: 1,
      currentPickIndex: 0,
      teamRosters: new Map(),
    });
  }, []);

  const makeUserPick = useCallback((playerId: string) => {
    setState(prev => {
      if (!prev.isActive || prev.isComplete) return prev;

      const teamIndex = prev.userPosition! - 1; // Convert 1-8 to 0-7
      const newPick: MockDraftPick = {
        round: prev.currentRound,
        position: prev.currentPickIndex + 1,
        playerId,
        teamIndex,
      };

      const newRosters = new Map(prev.teamRosters);
      const existing = newRosters.get(teamIndex) || [];
      newRosters.set(teamIndex, [...existing, playerId]);

      // Move to next pick
      let nextRound = prev.currentRound;
      let nextPickIndex = prev.currentPickIndex + 1;
      
      if (nextPickIndex >= TEAMS) {
        nextPickIndex = 0;
        nextRound++;
      }

      const isComplete = nextRound > ROUNDS;

      return {
        ...prev,
        picks: [...prev.picks, newPick],
        currentRound: nextRound,
        currentPickIndex: nextPickIndex,
        teamRosters: newRosters,
        isComplete,
      };
    });
  }, []);

  const processAutoPick = useCallback((
    currentState: MockDraftState,
    sortedPlayersList: Player[]
  ): MockDraftState | null => {
    if (!currentState.isActive || currentState.isComplete) return null;

    const teamIndex = getTeamForPick(currentState.currentRound, currentState.currentPickIndex);
    
    // Get all drafted player IDs
    const draftedIds = new Set(currentState.picks.map(p => p.playerId));
    const availablePlayers = sortedPlayersList.filter(p => !draftedIds.has(p.id));
    
    const selectedPlayer = selectPlayerForTeam(teamIndex, availablePlayers, currentState.teamRosters);
    
    if (!selectedPlayer) {
      // No valid player found, skip this pick (shouldn't happen normally)
      console.warn('No valid player found for auto-pick');
      return null;
    }

    const newPick: MockDraftPick = {
      round: currentState.currentRound,
      position: currentState.currentPickIndex + 1,
      playerId: selectedPlayer.id,
      teamIndex,
    };

    const newRosters = new Map(currentState.teamRosters);
    const existing = newRosters.get(teamIndex) || [];
    newRosters.set(teamIndex, [...existing, selectedPlayer.id]);

    // Move to next pick
    let nextRound = currentState.currentRound;
    let nextPickIndex = currentState.currentPickIndex + 1;
    
    if (nextPickIndex >= TEAMS) {
      nextPickIndex = 0;
      nextRound++;
    }

    const isComplete = nextRound > ROUNDS;

    return {
      ...currentState,
      picks: [...currentState.picks, newPick],
      currentRound: nextRound,
      currentPickIndex: nextPickIndex,
      teamRosters: newRosters,
      isComplete,
    };
  }, [getTeamForPick, selectPlayerForTeam]);

  const runAutoPickLoop = useCallback(() => {
    if (abortRef.current) return;

    setState(currentState => {
      if (!currentState.isActive || currentState.isComplete) return currentState;

      const currentTeamIndex = getTeamForPick(currentState.currentRound, currentState.currentPickIndex);
      const userTeamIndex = (currentState.userPosition || 1) - 1;

      // If it's the user's turn, don't auto-pick
      if (currentTeamIndex === userTeamIndex) {
        return currentState;
      }

      // Process auto-pick
      const newState = processAutoPick(currentState, sortedPlayers);
      
      if (newState) {
        // Schedule next auto-pick if not complete and not user's turn
        if (!newState.isComplete) {
          const nextTeamIndex = getTeamForPick(newState.currentRound, newState.currentPickIndex);
          const isUserTurn = nextTeamIndex === userTeamIndex;
          
          if (!isUserTurn) {
            timeoutRef.current = setTimeout(() => {
              if (!abortRef.current) {
                runAutoPickLoop();
              }
            }, AUTO_PICK_DELAY);
          }
        }
        return newState;
      }

      return currentState;
    });
  }, [getTeamForPick, processAutoPick, sortedPlayers]);

  const continueAfterUserPick = useCallback(() => {
    // After user makes a pick, check if we need to continue auto-picking
    timeoutRef.current = setTimeout(() => {
      if (!abortRef.current) {
        runAutoPickLoop();
      }
    }, AUTO_PICK_DELAY);
  }, [runAutoPickLoop]);

  const resetMockDraft = useCallback(() => {
    abortRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState({
      isActive: false,
      isComplete: false,
      userPosition: null,
      picks: [],
      currentRound: 1,
      currentPickIndex: 0,
      teamRosters: new Map(),
    });
  }, []);

  // Get player by ID
  const getPlayerById = useCallback((id: string): Player | null => {
    return allPlayers.find(p => p.id === id) || null;
  }, [allPlayers]);

  // Check if it's user's turn
  const isUserTurn = state.isActive && !state.isComplete && state.userPosition !== null &&
    getTeamForPick(state.currentRound, state.currentPickIndex) === (state.userPosition - 1);

  // Get drafted player IDs
  const getDraftedPlayerIds = useCallback((): string[] => {
    return state.picks.map(p => p.playerId);
  }, [state.picks]);

  // Get available players (not drafted)
  const getAvailablePlayers = useCallback((): Player[] => {
    const draftedIds = new Set(getDraftedPlayerIds());
    return sortedPlayers.filter(p => !draftedIds.has(p.id));
  }, [sortedPlayers, getDraftedPlayerIds]);

  // Get pick for a specific round and team index (column)
  const getPickByTeam = useCallback((round: number, teamIndex: number): MockDraftPick | null => {
    return state.picks.find(p => p.round === round && p.teamIndex === teamIndex) || null;
  }, [state.picks]);

  // Calculate the display pick number for a cell (e.g., "2.1" for first pick of round 2)
  const getPickDisplayNumber = useCallback((round: number, teamIndex: number): string => {
    // In snake draft:
    // Odd rounds: team 0 picks 1st, team 7 picks 8th
    // Even rounds: team 7 picks 1st, team 0 picks 8th
    let pickOrderInRound: number;
    if (round % 2 === 1) {
      // Odd round: team 0 = pick 1, team 7 = pick 8
      pickOrderInRound = teamIndex + 1;
    } else {
      // Even round (snake): team 7 = pick 1, team 0 = pick 8
      pickOrderInRound = TEAMS - teamIndex;
    }
    return `${round}.${pickOrderInRound}`;
  }, []);

  // Get user's roster
  const getUserRoster = useCallback((): Player[] => {
    if (state.userPosition === null) return [];
    const userTeamIndex = state.userPosition - 1;
    const playerIds = state.teamRosters.get(userTeamIndex) || [];
    return playerIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
  }, [state.userPosition, state.teamRosters, allPlayers]);

  return {
    state,
    isUserTurn,
    startMockDraft,
    makeUserPick,
    continueAfterUserPick,
    resetMockDraft,
    runAutoPickLoop,
    getPlayerById,
    getDraftedPlayerIds,
    getAvailablePlayers,
    getPickByTeam,
    getPickDisplayNumber,
    getTeamForPick,
    getUserRoster,
  };
};
