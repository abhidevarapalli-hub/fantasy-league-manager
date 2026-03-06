import { useCallback, useRef, useEffect } from 'react';
import { Player } from '@/lib/supabase-types';
import { sortPlayersByPriority } from '@/lib/player-order';
import { selectBestPlayer } from '@/lib/auto-draft-logic';
import { useMockStore, MockDraft, MockDraftPick } from '@/store/useMockStore';

const AUTO_PICK_DELAY = 1000;

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
      lastPickAt: new Date().toISOString(),
      pausedAt: null,
    });
  }, [draftId, draft, TEAMS, ROUNDS, updateDraft]);

  // Stop auto picks on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draftId]);

  const processAutoPick = useCallback((
    currentDraft: MockDraft,
    sortedPlayersList: Player[]
  ): Partial<MockDraft> | null => {
    if (currentDraft.status !== 'in_progress') return null;

    const teamIndex = getTeamForPick(currentDraft.currentRound, currentDraft.currentPickIndex);
    const draftedIds = new Set(currentDraft.picks.map(p => p.playerId));
    const availablePlayers = sortedPlayersList.filter(p => !draftedIds.has(p.id));

    const teamPlayerIds = currentDraft.teamRosters[teamIndex] || [];
    const selectedPlayer = selectBestPlayer(teamPlayerIds, availablePlayers, allPlayers, currentDraft.config);
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
      lastPickAt: new Date().toISOString(),
      pausedAt: null,
    };
  }, [getTeamForPick, allPlayers, TEAMS, ROUNDS]);

  const pauseDraft = useCallback(() => {
    if (!draft || draft.status !== 'in_progress') return;
    updateDraft(draftId, { pausedAt: new Date().toISOString() });
  }, [draftId, draft, updateDraft]);

  const resumeDraft = useCallback(() => {
    if (!draft || draft.status !== 'in_progress' || !draft.pausedAt) return;
    updateDraft(draftId, { pausedAt: null });
  }, [draftId, draft, updateDraft]);

  const resetClock = useCallback(() => {
    updateDraft(draftId, { lastPickAt: new Date().toISOString() });
  }, [draftId, updateDraft]);

  const getRemainingTime = useCallback(() => {
    if (!draft || draft.status !== 'in_progress' || !draft.lastPickAt) return 0;
    const duration = (draft.config.draftTimerSeconds || 60) * 1000;
    const lastPickTime = new Date(draft.lastPickAt).getTime();
    const now = draft.pausedAt ? new Date(draft.pausedAt).getTime() : Date.now();
    const elapsed = now - lastPickTime;
    return Math.max(0, duration - elapsed);
  }, [draft]);

  const runAutoPickLoop = useCallback(() => {
    if (abortRef.current) return;

    const currentDraft = useMockStore.getState().drafts[draftId];
    if (!currentDraft || currentDraft.status !== 'in_progress' || currentDraft.pausedAt) return;

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

  // Handle auto-pick on timeout
  useEffect(() => {
    if (!draft || draft.status !== 'in_progress' || draft.pausedAt) return;

    const interval = setInterval(() => {
      const remaining = getRemainingTime();
      if (remaining <= 0) {
        const currentTeamIndex = getTeamForPick(draft.currentRound, draft.currentPickIndex);
        const userTeamIndex = draft.userPosition - 1;

        if (currentTeamIndex === userTeamIndex) {
          // User timeout - auto pick best available
          const available = getAvailablePlayers();
          if (available.length > 0) {
            const userTeamPlayerIds = draft.teamRosters[userTeamIndex] || [];
            const timeoutPick = selectBestPlayer(userTeamPlayerIds, available, allPlayers, draft.config);
            if (timeoutPick) {
              makeUserPick(timeoutPick.id);
              continueAfterUserPick();
            }
          }
        } else {
          // AI timeout - should be handled by loop but safety first
          runAutoPickLoop();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [draft, getRemainingTime, getTeamForPick, getAvailablePlayers, makeUserPick, continueAfterUserPick, runAutoPickLoop]);

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
    pauseDraft,
    resumeDraft,
    resetClock,
    getRemainingTime,
  };
};
