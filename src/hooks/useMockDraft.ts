import { useCallback, useRef, useEffect } from 'react';
import { Player } from '@/lib/supabase-types';
import { sortPlayersByPriority } from '@/lib/player-order';
import { LeagueConfig } from '@/lib/roster-validation';
import { useMockStore, MockDraft, MockDraftPick } from '@/store/useMockStore';

const AUTO_PICK_DELAY = 1000;

interface RosterCounts {
  wicketKeepers: number;
  batsmen: number;
  allRounders: number;
  bowlers: number;
  international: number;
  total: number;
}

export const useMockDraft = (draftId: string, allPlayers: Player[]) => {
  const draft = useMockStore(state => state.drafts[draftId]);
  const updateDraft = useMockStore(state => state.updateDraft);

  const abortRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // If no draft found, provide a fallback to avoid crashes, though UI should handle it
  const TEAMS = draft?.config.managerCount || 10;
  const ROUNDS = draft ? draft.config.activeSize + draft.config.benchSize : 15;
  const config = draft?.config;

  const sortedPlayers = sortPlayersByPriority(allPlayers);

  // Stop auto picks on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draftId]);

  const getTeamRosterCounts = useCallback((teamIndex: number, rosters: Record<number, string[]>): RosterCounts => {
    const playerIds = rosters[teamIndex] || [];
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

  const getNeededRoles = useCallback((counts: RosterCounts, cfg: LeagueConfig): string[] => {
    const neededRoles: string[] = [];

    if (cfg.requireWk && counts.wicketKeepers < 1) {
      neededRoles.push('Wicket Keeper');
    }
    if (counts.allRounders < cfg.minAllRounders) neededRoles.push('All Rounder');
    if (counts.bowlers < cfg.minBowlers) neededRoles.push('Bowler');

    const batWkCount = counts.batsmen + counts.wicketKeepers;
    if (batWkCount < cfg.minBatWk) {
      neededRoles.push('Batsman');
      neededRoles.push('Wicket Keeper');
    }

    if (neededRoles.length === 0) {
      if (batWkCount < cfg.maxBatWk) {
        neededRoles.push('Batsman', 'Wicket Keeper');
      }
      if (counts.bowlers < cfg.maxBowlers) neededRoles.push('Bowler');
      if (counts.allRounders < cfg.maxAllRounders) neededRoles.push('All Rounder');
    }

    return [...new Set(neededRoles)];
  }, []);

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
    rosters: Record<number, string[]>,
    cfg: LeagueConfig
  ): Player | null => {
    const counts = getTeamRosterCounts(teamIndex, rosters);
    const totalCap = cfg.activeSize + cfg.benchSize;
    if (counts.total >= totalCap) return null;

    const neededRoles = getNeededRoles(counts, cfg);
    const canAddInternational = counts.international < cfg.maxInternational;
    const batWkCount = counts.batsmen + counts.wicketKeepers;

    let eligiblePlayers = availablePlayers.filter(p => {
      if (!canAddInternational && p.isInternational) return false;
      return neededRoles.includes(p.role);
    });

    if (eligiblePlayers.length === 0) {
      eligiblePlayers = availablePlayers.filter(p => {
        if (!canAddInternational && p.isInternational) return false;
        if ((p.role === 'Batsman' || p.role === 'Wicket Keeper') && batWkCount >= cfg.maxBatWk) return false;
        if (p.role === 'Bowler' && counts.bowlers >= cfg.maxBowlers) return false;
        if (p.role === 'All Rounder' && counts.allRounders >= cfg.maxAllRounders) return false;
        return true;
      });
    }

    if (eligiblePlayers.length === 0) return null;
    return selectPlayerWeighted(eligiblePlayers);
  }, [getTeamRosterCounts, getNeededRoles, selectPlayerWeighted]);

  const getTeamForPick = useCallback((round: number, pickIndex: number): number => {
    if (round % 2 === 1) return pickIndex;
    return TEAMS - 1 - pickIndex;
  }, [TEAMS]);

  const makeUserPick = useCallback((playerId: string) => {
    if (!draft || draft.status !== 'in_progress') return;

    const teamIndex = draft.userPosition - 1;
    const newPick: MockDraftPick = {
      round: draft.currentRound,
      position: draft.currentPickIndex + 1,
      playerId,
      teamIndex,
    };

    const currentRoster = draft.teamRosters[teamIndex] || [];
    const newRosters = {
      ...draft.teamRosters,
      [teamIndex]: [...currentRoster, playerId]
    };

    let nextRound = draft.currentRound;
    let nextPickIndex = draft.currentPickIndex + 1;
    if (nextPickIndex >= TEAMS) {
      nextPickIndex = 0;
      nextRound++;
    }

    updateDraft(draftId, {
      picks: [...draft.picks, newPick],
      currentRound: nextRound,
      currentPickIndex: nextPickIndex,
      teamRosters: newRosters,
      status: nextRound > ROUNDS ? 'completed' : 'in_progress',
    });
  }, [draftId, draft, TEAMS, ROUNDS, updateDraft]);

  const processAutoPick = useCallback((
    currentDraft: MockDraft,
    sortedPlayersList: Player[]
  ): Partial<MockDraft> | null => {
    if (currentDraft.status !== 'in_progress') return null;

    const teamIndex = getTeamForPick(currentDraft.currentRound, currentDraft.currentPickIndex);
    const draftedIds = new Set(currentDraft.picks.map(p => p.playerId));
    const availablePlayers = sortedPlayersList.filter(p => !draftedIds.has(p.id));

    const selectedPlayer = selectPlayerForTeam(teamIndex, availablePlayers, currentDraft.teamRosters, currentDraft.config);
    if (!selectedPlayer) return null;

    const newPick: MockDraftPick = {
      round: currentDraft.currentRound,
      position: currentDraft.currentPickIndex + 1,
      playerId: selectedPlayer.id,
      teamIndex,
    };

    const currentRoster = currentDraft.teamRosters[teamIndex] || [];
    const newRosters = {
      ...currentDraft.teamRosters,
      [teamIndex]: [...currentRoster, selectedPlayer.id]
    };

    let nextRound = currentDraft.currentRound;
    let nextPickIndex = currentDraft.currentPickIndex + 1;
    if (nextPickIndex >= TEAMS) {
      nextPickIndex = 0;
      nextRound++;
    }

    return {
      picks: [...currentDraft.picks, newPick],
      currentRound: nextRound,
      currentPickIndex: nextPickIndex,
      teamRosters: newRosters,
      status: nextRound > ROUNDS ? 'completed' : 'in_progress',
    };
  }, [getTeamForPick, selectPlayerForTeam, TEAMS, ROUNDS]);

  const runAutoPickLoop = useCallback(() => {
    if (abortRef.current) return;

    const currentDraft = useMockStore.getState().drafts[draftId];
    if (!currentDraft || currentDraft.status !== 'in_progress') return;

    const currentTeamIndex = getTeamForPick(currentDraft.currentRound, currentDraft.currentPickIndex);
    const userTeamIndex = currentDraft.userPosition - 1;

    if (currentTeamIndex === userTeamIndex) return; // User's turn

    const updates = processAutoPick(currentDraft, sortedPlayers);
    if (updates) {
      useMockStore.getState().updateDraft(draftId, updates);

      if (updates.status !== 'completed') {
        const nextTeamIndex = getTeamForPick(updates.currentRound!, updates.currentPickIndex!);
        if (nextTeamIndex !== userTeamIndex) {
          timeoutRef.current = setTimeout(() => {
            if (!abortRef.current) runAutoPickLoop();
          }, AUTO_PICK_DELAY);
        }
      }
    }
  }, [draftId, getTeamForPick, processAutoPick, sortedPlayers]);

  const continueAfterUserPick = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      if (!abortRef.current) runAutoPickLoop();
    }, AUTO_PICK_DELAY);
  }, [runAutoPickLoop]);

  const getPlayerById = useCallback((id: string): Player | null => {
    return allPlayers.find(p => p.id === id) || null;
  }, [allPlayers]);

  const isUserTurnState = draft?.status === 'in_progress' && draft?.userPosition !== undefined &&
    getTeamForPick(draft.currentRound, draft.currentPickIndex) === (draft.userPosition - 1);

  const getDraftedPlayerIds = useCallback((): string[] => {
    return draft?.picks.map(p => p.playerId) || [];
  }, [draft?.picks]);

  const getAvailablePlayers = useCallback((): Player[] => {
    const draftedIds = new Set(getDraftedPlayerIds());
    return sortedPlayers.filter(p => !draftedIds.has(p.id));
  }, [sortedPlayers, getDraftedPlayerIds]);

  const getPickByTeam = useCallback((round: number, teamIndex: number): MockDraftPick | null => {
    return draft?.picks.find(p => p.round === round && p.teamIndex === teamIndex) || null;
  }, [draft?.picks]);

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
    if (!draft || draft.userPosition === undefined) return [];
    const userTeamIndex = draft.userPosition - 1;
    const playerIds = draft.teamRosters[userTeamIndex] || [];
    return playerIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
  }, [allPlayers, draft]);

  return {
    draft,
    isUserTurn: isUserTurnState,
    makeUserPick,
    continueAfterUserPick,
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
