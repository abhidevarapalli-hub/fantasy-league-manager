import { useState, useCallback, useRef } from 'react';
import { Player } from '@/lib/supabase-types';
import { sortPlayersByPriority } from '@/lib/player-order';
import { LeagueConfig } from '@/lib/roster-validation';

const AUTO_PICK_DELAY = 1000; // 1 second for better UX

export interface MockDraftPick {
  round: number;
  position: number;
  playerId: string;
  teamIndex: number;
}

export interface MockDraftState {
  isActive: boolean;
  isComplete: boolean;
  userPosition: number | null; // 1-X, user's draft position
  picks: MockDraftPick[];
  currentRound: number;
  currentPickIndex: number; // 0-(X-1) within round (for snake order)
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

export const useMockDraft = (allPlayers: Player[], config: LeagueConfig) => {
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

  const TEAMS = config.managerCount;
  const ROUNDS = config.activeSize + config.benchSize;

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

  const getNeededRoles = useCallback((counts: RosterCounts): string[] => {
    const neededRoles: string[] = [];

    if (counts.wicketKeepers < config.minWks) neededRoles.push('Wicket Keeper');
    if (counts.allRounders < config.minAllRounders) neededRoles.push('All Rounder');

    if (counts.bowlers < config.minBowlers) neededRoles.push('Bowler');
    if (counts.batsmen < config.minBatsmen) neededRoles.push('Batsman');

    if (neededRoles.length === 0) {
      if (counts.batsmen < config.maxBatsmen) neededRoles.push('Batsman');
      neededRoles.push('Wicket Keeper', 'All Rounder', 'Bowler');
    }

    return [...new Set(neededRoles)];
  }, [config]);

  const getPlayerTier = useCallback((playerIndex: number): number => {
    return Math.floor(playerIndex / 10) + 1;
  }, []);

  const selectPlayerWeighted = useCallback((eligiblePlayers: Player[]): Player => {
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
  }, [sortedPlayers, getPlayerTier]);

  const selectPlayerForTeam = useCallback((
    teamIndex: number,
    availablePlayers: Player[],
    rosters: Map<number, string[]>
  ): Player | null => {
    const counts = getTeamRosterCounts(teamIndex, rosters);
    const totalCap = config.activeSize + config.benchSize;
    if (counts.total >= totalCap) return null;

    const neededRoles = getNeededRoles(counts);
    const canAddInternational = counts.international < config.maxInternational;

    let eligiblePlayers = availablePlayers.filter(p => {
      if (!canAddInternational && p.isInternational) return false;
      return neededRoles.includes(p.role);
    });

    if (eligiblePlayers.length === 0) {
      eligiblePlayers = availablePlayers.filter(p => {
        if (!canAddInternational && p.isInternational) return false;
        if (p.role === 'Batsman' && counts.batsmen >= config.maxBatsmen) return false;
        return true;
      });
    }

    if (eligiblePlayers.length === 0) return null;
    return selectPlayerWeighted(eligiblePlayers);
  }, [getTeamRosterCounts, getNeededRoles, selectPlayerWeighted, config]);

  const getTeamForPick = useCallback((round: number, pickIndex: number): number => {
    if (round % 2 === 1) return pickIndex;
    return TEAMS - 1 - pickIndex;
  }, [TEAMS]);

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
      const teamIndex = prev.userPosition! - 1;
      const newPick: MockDraftPick = {
        round: prev.currentRound,
        position: prev.currentPickIndex + 1,
        playerId,
        teamIndex,
      };
      const newRosters = new Map(prev.teamRosters);
      const existing = newRosters.get(teamIndex) || [];
      newRosters.set(teamIndex, [...existing, playerId]);
      let nextRound = prev.currentRound;
      let nextPickIndex = prev.currentPickIndex + 1;
      if (nextPickIndex >= TEAMS) {
        nextPickIndex = 0;
        nextRound++;
      }
      return {
        ...prev,
        picks: [...prev.picks, newPick],
        currentRound: nextRound,
        currentPickIndex: nextPickIndex,
        teamRosters: newRosters,
        isComplete: nextRound > ROUNDS,
      };
    });
  }, [TEAMS, ROUNDS]);

  const processAutoPick = useCallback((
    currentState: MockDraftState,
    sortedPlayersList: Player[]
  ): MockDraftState | null => {
    if (!currentState.isActive || currentState.isComplete) return null;
    const teamIndex = getTeamForPick(currentState.currentRound, currentState.currentPickIndex);
    const draftedIds = new Set(currentState.picks.map(p => p.playerId));
    const availablePlayers = sortedPlayersList.filter(p => !draftedIds.has(p.id));
    const selectedPlayer = selectPlayerForTeam(teamIndex, availablePlayers, currentState.teamRosters);
    if (!selectedPlayer) return null;
    const newPick: MockDraftPick = {
      round: currentState.currentRound,
      position: currentState.currentPickIndex + 1,
      playerId: selectedPlayer.id,
      teamIndex,
    };
    const newRosters = new Map(currentState.teamRosters);
    const existing = newRosters.get(teamIndex) || [];
    newRosters.set(teamIndex, [...existing, selectedPlayer.id]);
    let nextRound = currentState.currentRound;
    let nextPickIndex = currentState.currentPickIndex + 1;
    if (nextPickIndex >= TEAMS) {
      nextPickIndex = 0;
      nextRound++;
    }
    return {
      ...currentState,
      picks: [...currentState.picks, newPick],
      currentRound: nextRound,
      currentPickIndex: nextPickIndex,
      teamRosters: newRosters,
      isComplete: nextRound > ROUNDS,
    };
  }, [getTeamForPick, selectPlayerForTeam, TEAMS, ROUNDS]);

  const runAutoPickLoop = useCallback(() => {
    if (abortRef.current) return;
    setState(currentState => {
      if (!currentState.isActive || currentState.isComplete) return currentState;
      const currentTeamIndex = getTeamForPick(currentState.currentRound, currentState.currentPickIndex);
      const userTeamIndex = (currentState.userPosition || 1) - 1;
      if (currentTeamIndex === userTeamIndex) return currentState;
      const newState = processAutoPick(currentState, sortedPlayers);
      if (newState) {
        if (!newState.isComplete) {
          const nextTeamIndex = getTeamForPick(newState.currentRound, newState.currentPickIndex);
          if (nextTeamIndex !== userTeamIndex) {
            timeoutRef.current = setTimeout(() => {
              if (!abortRef.current) runAutoPickLoop();
            }, AUTO_PICK_DELAY);
          }
        }
        return newState;
      }
      return currentState;
    });
  }, [getTeamForPick, processAutoPick, sortedPlayers]);

  const continueAfterUserPick = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      if (!abortRef.current) runAutoPickLoop();
    }, AUTO_PICK_DELAY);
  }, [runAutoPickLoop]);

  const resetMockDraft = useCallback(() => {
    abortRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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

  const getPlayerById = useCallback((id: string): Player | null => {
    return allPlayers.find(p => p.id === id) || null;
  }, [allPlayers]);

  const isUserTurnState = state.isActive && !state.isComplete && state.userPosition !== null &&
    getTeamForPick(state.currentRound, state.currentPickIndex) === (state.userPosition - 1);

  const getDraftedPlayerIds = useCallback((): string[] => {
    return state.picks.map(p => p.playerId);
  }, [state.picks]);

  const getAvailablePlayers = useCallback((): Player[] => {
    const draftedIds = new Set(getDraftedPlayerIds());
    return sortedPlayers.filter(p => !draftedIds.has(p.id));
  }, [sortedPlayers, getDraftedPlayerIds]);

  const getPickByTeam = useCallback((round: number, teamIndex: number): MockDraftPick | null => {
    return state.picks.find(p => p.round === round && p.teamIndex === teamIndex) || null;
  }, [state.picks]);

  const getPickDisplayNumber = useCallback((round: number, teamIndex: number): string => {
    let pickOrderInRound: number;
    if (round % 2 === 1) {
      pickOrderInRound = teamIndex + 1;
    } else {
      pickOrderInRound = TEAMS - teamIndex;
    }
    return `${round}.${pickOrderInRound}`;
  }, [TEAMS]);

  const getUserRoster = useCallback((): Player[] => {
    if (state.userPosition === null) return [];
    const userTeamIndex = state.userPosition - 1;
    const playerIds = state.teamRosters.get(userTeamIndex) || [];
    return playerIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
  }, [state.userPosition, state.teamRosters, allPlayers]);

  return {
    state,
    isUserTurn: isUserTurnState,
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
