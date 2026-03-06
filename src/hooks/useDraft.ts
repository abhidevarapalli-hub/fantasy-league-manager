import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick, DraftOrder, DraftState, mapDbDraftPick, mapDbDraftOrder, mapDbDraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';
import { useGameStore } from '@/store/useGameStore';
import { toast } from 'sonner';
import { Player } from '@/lib/supabase-types';
import { buildOptimalActive11 } from '@/lib/roster-validation';
import { selectBestPlayer } from '@/lib/auto-draft-logic';
import type { TablesInsert } from '@/integrations/supabase/types';

export const useDraft = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  // Select state slices individually to ensure proper subscriptions
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const draftPicks = useGameStore(state => state.draftPicks);
  const draftOrder = useGameStore(state => state.draftOrder);
  const draftState = useGameStore(state => state.draftState);

  const setDraftPicks = useGameStore(state => state.setDraftPicks);
  const setDraftOrder = useGameStore(state => state.setDraftOrder);
  const setDraftState = useGameStore(state => state.setDraftState);
  const finalizeRosters = useGameStore(state => state.finalizeRosters);

  const [loading, setLoading] = useState(true);

  // Track in-flight picks to prevent concurrency issues (like 409 Conflict)
  const processingPicksRef = useRef<Set<string>>(new Set());

  // Fetch initial data
  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    // Use the global fetchAllData which now includes draft info
    const init = async () => {
      const store = useGameStore.getState();

      // If already initialized for this league, just check draft state
      if (store.initializedLeagueId !== leagueId) {
        setLoading(true);
        try {
          await store.fetchAllData(leagueId);
          store.setInitializedLeagueId(leagueId);
        } catch (error) {
          console.error('[useDraft] ❌ Error initializing draft:', error);
          setLoading(false);
          return;
        }
      }

      // If draft state still missing, create it
      // Re-check state after fetch
      const currentDraftState = useGameStore.getState().draftState;

      if (!currentDraftState) {
        console.log(`[useDraft] 🆕 Creating initial draft state for league: ${leagueId}`);
        try {
          const { data: newState, error: createError } = await supabase
            .from('draft_state')
            .insert({
              league_id: leagueId,
              status: 'pre_draft' as "pre_draft" | "active" | "paused" | "completed",
              clock_duration_seconds: store.config.draftTimerSeconds || 60
            })
            .select('*')
            .single();

          if (!createError && newState) {
            setDraftState(mapDbDraftState({ ...newState, league_id: leagueId } as DbDraftState));
          } else if (createError) {
            console.error('[useDraft] ❌ Error creating draft state:', createError);
          }
        } catch (e) {
          console.error('[useDraft] ❌ Exception creating draft state:', e);
        }
      }

      setLoading(false);
    };

    init();
  }, [leagueId, setDraftState]);

  // Real-time updates are handled globally by useGameStore via LeagueLayout

  // Get manager for a draft position
  const getManagerAtPosition = useCallback((position: number) => {
    const order = draftOrder.find(o => o.position === position);
    if (!order?.managerId) return null;
    return managers.find(m => m.id === order.managerId) || null;
  }, [draftOrder, managers]);

  // Get pick for a specific round and position
  const getPick = useCallback((round: number, position: number) => {
    const managerCount = managers.length;
    if (managerCount === 0) return null;

    // Logic fix: Match by absolute pick number
    const isRRoundEven = round % 2 === 0;
    const posInRound = isRRoundEven
      ? (managerCount - position + 1)
      : position;
    const absolutePickNumber = ((round - 1) * managerCount) + posInRound;

    return draftPicks.find(p => p.pickNumber === absolutePickNumber) || null;
  }, [draftPicks, managers.length]);

  // Get player for a pick
  const getPlayerForPick = useCallback((pick: DraftPick | null) => {
    if (!pick?.playerId) return null;
    return players.find(p => p.id === pick.playerId) || null;
  }, [players]);

  // Get all drafted player IDs
  const getDraftedPlayerIds = useCallback(() => {
    return draftPicks.filter(p => p.playerId).map(p => p.playerId as string);
  }, [draftPicks]);

  // Assign manager to draft position
  const assignManagerToPosition = useCallback(async (position: number, managerId: string) => {
    const orderItem = draftOrder.find(o => o.position === position);
    if (!orderItem) return;

    // Optimistic update
    setDraftOrder(draftOrder.map(o =>
      o.position === position ? { ...o, managerId } : o
    ));

    const { error } = await supabase
      .from('draft_order')
      .update({ manager_id: managerId })
      .eq('id', orderItem.id);

    if (error) {
      // Revert on error
      setDraftOrder(draftOrder.map(o =>
        o.position === position ? { ...o, managerId: orderItem.managerId } : o
      ));
      toast.error('Failed to assign manager');
      console.error(error);
    }
  }, [draftOrder, setDraftOrder]);


  // Make a draft pick
  const makePick = useCallback(async (round: number, position: number, playerId: string, isAutoDraft = false) => {
    if (!leagueId || !draftState || draftState.status !== 'active') return;

    const orderItem = draftOrder.find(o => o.position === position);
    const expectedManagerId = orderItem?.managerId || null;

    // Use the RPC for make pick
    const currentManagerId = useGameStore.getState().currentManagerId;

    // Only allow picks for the current manager, unless it's an auto-draft triggered by the system
    if (!isAutoDraft && currentManagerId !== expectedManagerId && expectedManagerId !== null) {
      toast.error('It is not your turn to pick!');
      return;
    }

    const actuallyUsedManagerId = expectedManagerId || currentManagerId;

    console.log(`[useDraft] 🎯 Calling execute_draft_pick for ${playerId}${isAutoDraft ? ' (auto)' : ''}`);
    const { data, error } = await supabase.rpc('execute_draft_pick', {
      p_league_id: leagueId,
      p_manager_id: actuallyUsedManagerId,
      p_player_id: playerId,
      p_is_auto_draft: isAutoDraft
    });

    if (error) {
      // For auto-draft picks, silently log — multiple clients may race and only one wins
      if (isAutoDraft) {
        console.log('[useDraft] Auto-draft pick conflict (expected with multiple clients):', error.message);
      } else {
        toast.error('Failed to make pick: ' + error.message);
        console.error(error);
      }
      return;
    }

    // Check the RPC return value for soft failures (not exceptions)
    const result = data as { success?: boolean; reason?: string } | null;
    if (result && result.success === false) {
      if (!isAutoDraft) {
        if (result.reason === 'player already drafted') {
          toast.error('This player was just drafted by another team. Please pick a different player.');
        } else if (result.reason === 'draft not active') {
          toast.error('The draft is no longer active.');
        } else {
          toast.error('Pick failed: ' + (result.reason || 'Unknown error'));
        }
      } else {
        console.log('[useDraft] Auto-draft soft failure:', result.reason);
      }
    }
  }, [leagueId, draftState, draftOrder]);

  // Clear a pick
  const clearPick = useCallback(async (round: number, position: number) => {
    const existingPick = getPick(round, position);
    if (!existingPick) return;

    console.log(`[useDraft] 🗑️ Clearing pick: Round ${round}, Pos ${position}`);

    const { error } = await supabase
      .from('draft_picks')
      .delete()
      .eq('id', existingPick.id);

    if (error) {
      toast.error('Failed to clear pick');
      console.error(error);
    }
  }, [getPick]);

  // Reset draft
  const resetDraft = useCallback(async () => {
    if (!leagueId) return;
    try {
      // 1. Delete all draft picks
      await supabase.from('draft_picks').delete().eq('league_id', leagueId);

      // 2. Delete all roster entries created from the draft
      await supabase.from('manager_roster').delete().eq('league_id', leagueId);

      // 3. Reset draft order (unassign managers, disable auto-draft)
      await supabase
        .from('draft_order')
        .update({ manager_id: null, auto_draft_enabled: false })
        .eq('league_id', leagueId);

      // 4. Reset draft state to pre-draft
      const nowIso = new Date().toISOString();
      await supabase
        .from('draft_state')
        .update({
          status: 'pre_draft',
          current_round: 1,
          current_position: 1,
          last_pick_at: nowIso,
          paused_at: null,
          total_paused_duration_ms: 0
        })
        .eq('league_id', leagueId);

      // 5. Reset manager stats (wins/losses/points)
      await supabase
        .from('managers')
        .update({ wins: 0, losses: 0, points: 0 })
        .eq('league_id', leagueId);

      // --- Reset all local state ---

      // Clear draft picks
      setDraftPicks([]);

      // Clear draft order manager assignments
      setDraftOrder(draftOrder.map(o => ({
        ...o,
        managerId: '',
        autoDraftEnabled: false
      })));

      // Reset draft state
      if (draftState) {
        setDraftState({
          ...draftState,
          status: 'pre_draft',
          currentRound: 1,
          currentPosition: 1,
          lastPickAt: new Date(nowIso),
          pausedAt: null,
          totalPausedDurationMs: 0
        });
      }

      // Clear manager rosters and stats locally
      const store = useGameStore.getState();
      const clearedManagers = store.managers.map(m => ({
        ...m,
        activeRoster: [] as string[],
        bench: [] as string[],
        wins: 0,
        losses: 0,
        points: 0,
      }));
      useGameStore.setState({
        managers: clearedManagers,
        weeklyRosters: {},  // Clear cached weekly roster data
      });

      toast.success('Draft has been reset');
    } catch (error) {
      console.error('Failed to reset draft:', error);
      toast.error('Failed to reset draft');
    }
  }, [leagueId, draftState, draftOrder, setDraftPicks, setDraftOrder, setDraftState]);

  // Randomize draft order and auto-assign all managers
  const randomizeDraftOrder = useCallback(async () => {
    if (!managers?.length || !leagueId) return;

    // We need as many slots as managers
    const slotsNeeded = managers.length;

    // Take all manager IDs and shuffle
    const allManagerIds = managers.map(m => m.id);
    const shuffledIds = [...allManagerIds].sort(() => Math.random() - 0.5);

    // Prepare updates/inserts
    // We use upsert on (league_id, position)
    const updates: TablesInsert<'draft_order'>[] = Array.from({ length: slotsNeeded }).map((_, index) => {
      const position = index + 1;
      const existing = draftOrder.find(o => o.position === position);

      const update: TablesInsert<'draft_order'> = {
        league_id: leagueId,
        position,
        manager_id: shuffledIds[index]
      };

      // Only include ID if it's a real database ID (not a temp one)
      if (existing?.id && !existing.id.startsWith('temp-')) {
        update.id = existing.id;
      }

      return update;
    });

    console.log('[useDraft] 🎲 Randomization updates prepared:', updates);

    // Optimistic update for UI
    setDraftOrder(updates.map(u => ({
      id: u.id || `temp-${u.position}`,
      leagueId: u.league_id,
      position: u.position,
      managerId: u.manager_id || '',
      autoDraftEnabled: draftOrder.find(o => o.position === u.position)?.autoDraftEnabled || false
    })));

    try {
      const { error } = await supabase
        .from('draft_order')
        .upsert(updates, { onConflict: 'league_id, position' });

      if (error) throw error;
      toast.success('Managers randomly assigned!');
    } catch (error) {
      console.error('Failed to randomize order:', error);
      toast.error('Failed to randomize order. Please try again.');
    }
  }, [draftOrder, managers, leagueId, setDraftOrder]);

  // Toggle auto-draft for a manager
  const toggleAutoDraft = useCallback(async (managerId: string, enabled: boolean) => {
    const orderItem = draftOrder.find(o => o.managerId === managerId);
    if (!orderItem) return;

    // Optimistic update
    setDraftOrder(draftOrder.map(o =>
      o.managerId === managerId ? { ...o, autoDraftEnabled: enabled } : o
    ));

    const { error } = await supabase
      .from('draft_order')
      .update({ auto_draft_enabled: enabled })
      .eq('id', orderItem.id);

    if (error) {
      // Revert on error
      setDraftOrder(draftOrder.map(o =>
        o.managerId === managerId ? { ...o, autoDraftEnabled: !enabled } : o
      ));
      toast.error('Failed to toggle auto-draft');
      console.error(error);
    }
  }, [draftOrder, setDraftOrder]);

  // Start draft
  const startDraft = useCallback(async () => {
    console.log('[useDraft] 🚀 startDraft called');
    if (!draftState) {
      console.error('[useDraft] ❌ Cannot start: draftState is null', { draftState });
      toast.error('Draft state not loaded yet');
      return;
    }

    // Check if all positions have managers
    const missingManager = draftOrder.some(o => !o.managerId);
    console.log('[useDraft] 📋 Checking managers:', {
      managerCount: managers?.length,
      orderCount: draftOrder.length,
      missingManager
    });

    if (missingManager) {
      toast.error('Cannot start: Some positions are missing managers');
      return;
    }

    const startAt = new Date().toISOString();
    console.log('[useDraft] 📝 Updating draft_state to active...', { leagueId: draftState.leagueId });

    // Optimistic update
    setDraftState({
      ...draftState,
      status: 'active',
      lastPickAt: new Date(startAt),
      pausedAt: null
    });

    const { error } = await supabase
      .from('draft_state')
      .update({
        status: 'active',
        last_pick_at: startAt,
        paused_at: null
      })
      .eq('league_id', leagueId);

    if (error) {
      toast.error('Failed to start draft');
      console.error('[useDraft] ❌ Error starting draft:', error);
      // Revert
      setDraftState({
        ...draftState,
        status: draftState.status,
        lastPickAt: draftState.lastPickAt
      });
    } else {
      console.log('[useDraft] ✅ Draft state successfully updated to active');
      toast.success('Draft started!');
    }
  }, [draftState, draftOrder, managers, setDraftState, leagueId]);

  // Pause draft (server-side timestamp)
  const pauseDraft = useCallback(async () => {
    if (!draftState || draftState.status !== 'active') return;

    // Optimistic update
    setDraftState({
      ...draftState,
      status: 'paused',
      pausedAt: new Date()
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('pause_draft', {
      p_league_id: leagueId!
    });

    if (error) {
      toast.error('Failed to pause draft');
      console.error(error);
      // Revert
      setDraftState({
        ...draftState,
        status: 'active',
        pausedAt: null
      });
      return;
    }

    const result = data as { success?: boolean; reason?: string; paused_at?: string } | null;
    if (result && !result.success) {
      toast.error('Failed to pause: ' + (result.reason || 'Unknown'));
      setDraftState({ ...draftState, status: 'active', pausedAt: null });
    }
  }, [draftState, setDraftState, leagueId]);

  // Resume draft (server-side pause duration calculation)
  const resumeDraft = useCallback(async () => {
    if (!draftState || draftState.status !== 'paused') return;

    // Optimistic update
    setDraftState({
      ...draftState,
      status: 'active',
      pausedAt: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('resume_draft', {
      p_league_id: leagueId!
    });

    if (error) {
      toast.error('Failed to resume draft');
      console.error(error);
      // Revert
      setDraftState({
        ...draftState,
        status: 'paused',
        pausedAt: draftState.pausedAt,
      });
      return;
    }

    const result = data as { success?: boolean; reason?: string; total_paused_ms?: number } | null;
    if (result && !result.success) {
      toast.error('Failed to resume: ' + (result.reason || 'Unknown'));
      setDraftState({ ...draftState, status: 'paused', pausedAt: draftState.pausedAt });
    } else if (result?.total_paused_ms !== undefined) {
      // Update local state with the server-computed total
      const currentState = useGameStore.getState().draftState;
      if (currentState) {
        setDraftState({ ...currentState, totalPausedDurationMs: result.total_paused_ms! });
      }
    }
  }, [draftState, setDraftState, leagueId]);

  // Reset clock for current pick
  const resetClock = useCallback(async () => {
    if (!draftState) return;

    const { error } = await supabase
      .from('draft_state')
      .update({
        last_pick_at: new Date().toISOString()
      })
      .eq('league_id', draftState.leagueId);

    if (error) {
      toast.error('Failed to reset clock');
      console.error(error);
    }
  }, [draftState]);

  // Calculate current pick position details
  const getCurrentPickData = useCallback(() => {
    const currentTotalPicks = draftPicks.length;
    const positionsCount = managers.length;

    if (positionsCount === 0) return null;

    // This represents the NEXT pick to be made
    const nextPickIndex = currentTotalPicks;
    const round = Math.floor(nextPickIndex / positionsCount) + 1;
    const pickIndexInRound = nextPickIndex % positionsCount;
    const isEvenRound = round % 2 === 0;

    // In snake draft, the position (column) is determined by how many picks are left in the round
    const position = isEvenRound
      ? (positionsCount - pickIndexInRound)
      : (pickIndexInRound + 1);

    const orderNode = draftOrder.find(o => o.position === position);
    const isAutoDraftEnabled = orderNode?.autoDraftEnabled || false;

    return { round, position, orderNode, isAutoDraftEnabled };
  }, [draftPicks.length, managers.length, draftOrder]);

  // Get remaining time for current pick (in ms)
  const getRemainingTime = useCallback(() => {
    if (!draftState || !draftState.lastPickAt) return 0;

    const timerDurationMs = (draftState.clockDurationSeconds || 60) * 1000;

    const now = draftState.pausedAt?.getTime() || Date.now();
    const elapsed = (now - draftState.lastPickAt.getTime()) - (draftState.totalPausedDurationMs || 0);
    return Math.max(0, timerDurationMs - elapsed);
  }, [draftState]);

  // Timer side-effect for auto-drafting and empty team handling
  useEffect(() => {
    if (draftState?.status !== 'active') return;

    const tick = async () => {
      const pickData = getCurrentPickData();
      if (!pickData) return;

      const { round, position, orderNode } = pickData;
      const hasManager = !!orderNode?.managerId;
      const manager = hasManager ? managers.find(m => m.id === orderNode!.managerId) : null;

      // Check for auto-draft enabled or no user (CPU)
      const orderItem = draftOrder.find(o => o.managerId === orderNode?.managerId);
      const isAutoDraftEnabled = orderItem?.autoDraftEnabled || !manager?.userId;

      // If immediate (CPU/Auto) or time is up, make a smart auto-pick
      if (isAutoDraftEnabled || getRemainingTime() <= 0) {
        if (!processingPicksRef.current.has('checking')) {
          processingPicksRef.current.add('checking');

          // Add a small random jitter to prevent multiple clients hitting at the same time
          const jitter = Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, jitter));

          try {
            // Build the team's current roster from draft picks
            const managerId = orderNode?.managerId;
            const teamPlayerIds = managerId
              ? draftPicks.filter(p => p.managerId === managerId).map(p => p.playerId).filter(Boolean) as string[]
              : [];

            // Get available players (not yet drafted)
            const draftedIds = getDraftedPlayerIds();
            const availablePlayers = players.filter(p => !draftedIds.includes(p.id));

            const config = useGameStore.getState().config;
            const selectedPlayer = selectBestPlayer(teamPlayerIds, availablePlayers, players, config);

            if (selectedPlayer) {
              await makePick(round, position, selectedPlayer.id, true);
            }
          } catch (e) {
            console.error('[useDraft] Auto-draft pick failed:', e);
          } finally {
            // Wait at least 3 seconds before another check for this client
            setTimeout(() => processingPicksRef.current.delete('checking'), 3000);
          }
        }
      }
    };

    tick();

    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [draftState, getRemainingTime, managers, draftOrder, getCurrentPickData, leagueId, draftPicks, players, getDraftedPlayerIds, makePick]);

  // Auto-complete all remaining picks
  const autoCompleteAllPicks = useCallback(async () => {
    if (!leagueId) {
      toast.error('No league selected');
      return false;
    }

    try {
      const config = useGameStore.getState().config;
      const totalRounds = config.activeSize + config.benchSize;
      const totalPositions = config.managerCount;

      // Get all empty picks in snake draft order
      const emptyPicks: { round: number; position: number; pickIndex: number }[] = [];
      let pickIndex = 0;

      for (let round = 1; round <= totalRounds; round++) {
        const isEvenRound = round % 2 === 0;

        // Snake draft order
        if (isEvenRound) {
          // Reverse order for even rounds
          for (let pos = totalPositions; pos >= 1; pos--) {
            const pick = getPick(round, pos);
            if (!pick?.playerId) {
              emptyPicks.push({ round, position: pos, pickIndex });
            }
            pickIndex++;
          }
        } else {
          // Normal order for odd rounds
          for (let pos = 1; pos <= totalPositions; pos++) {
            const pick = getPick(round, pos);
            if (!pick?.playerId) {
              emptyPicks.push({ round, position: pos, pickIndex });
            }
            pickIndex++;
          }
        }
      }

      if (emptyPicks.length === 0) {
        toast.info('Draft is already complete');
        return true;
      }

      toast.loading(`Auto-drafting ${emptyPicks.length} picks...`, { id: 'auto-draft-all' });

      // 1. Check if we need to randomize order (if any positions lack managers)
      const missingManagers = draftOrder.some(o => !o.managerId);
      let effectiveDraftOrder = [...draftOrder];

      if (missingManagers) {
        console.log('[useDraft] 🎲 Some positions missing managers, randomizing first...');
        const allManagerIds = managers.map(m => m.id);
        const shuffledIds = [...allManagerIds].sort(() => Math.random() - 0.5);

        const randomizationUpdates = Array.from({ length: managers.length }).map((_, index) => {
          const position = index + 1;
          return {
            league_id: leagueId,
            position,
            manager_id: shuffledIds[index]
          };
        });

        const { error: randError } = await supabase
          .from('draft_order')
          .upsert(randomizationUpdates, { onConflict: 'league_id, position' });

        if (randError) {
          console.error('[useDraft] ❌ Randomization failed during auto-complete:', randError);
          toast.error('Failed to randomize order', { id: 'auto-draft-all' });
          return false;
        }

        // Update effective order for local pick generation
        effectiveDraftOrder = randomizationUpdates.map(u => ({
          id: `temp-${u.position}`,
          leagueId: u.league_id,
          position: u.position,
          managerId: u.manager_id,
          autoDraftEnabled: false
        }));
      }

      // 2. Prepare picks using roster-aware selection per manager
      const draftedIds = new Set(getDraftedPlayerIds());
      // Track per-manager rosters as we simulate picks
      const managerRosters: Record<string, string[]> = {};
      for (const order of effectiveDraftOrder) {
        if (order.managerId) {
          // Initialize with already-drafted players for this manager
          managerRosters[order.managerId] = draftPicks
            .filter(p => p.managerId === order.managerId && p.playerId)
            .map(p => p.playerId as string);
        }
      }

      const picksToInsert: Array<{
        league_id: string;
        round: number;
        pick_number: number;
        manager_id: string | null;
        player_id: string;
        is_auto_draft: boolean;
      }> = [];

      for (const emptyPick of emptyPicks) {
        const managerId = effectiveDraftOrder.find(o => o.position === emptyPick.position)?.managerId || null;
        const teamPlayerIds = managerId ? (managerRosters[managerId] || []) : [];

        const availablePlayers = players.filter(p => !draftedIds.has(p.id));
        const selectedPlayer = selectBestPlayer(teamPlayerIds, availablePlayers, players, config);

        if (!selectedPlayer) {
          toast.error(`Not enough eligible players for position ${emptyPick.position}, round ${emptyPick.round}`, { id: 'auto-draft-all' });
          return false;
        }

        // Calculate absolute pick number
        const isRRoundEven = emptyPick.round % 2 === 0;
        const posInRound = isRRoundEven
          ? (totalPositions - emptyPick.position + 1)
          : emptyPick.position;
        const absolutePickNumber = ((emptyPick.round - 1) * totalPositions) + posInRound;

        picksToInsert.push({
          league_id: leagueId,
          round: emptyPick.round,
          pick_number: absolutePickNumber,
          manager_id: managerId,
          player_id: selectedPlayer.id,
          is_auto_draft: true,
        });

        // Track this pick so subsequent picks for same manager respect roster composition
        draftedIds.add(selectedPlayer.id);
        if (managerId) {
          if (!managerRosters[managerId]) managerRosters[managerId] = [];
          managerRosters[managerId].push(selectedPlayer.id);
        }
      }

      // Batch insert all picks at once
      const { data, error } = await supabase
        .from('draft_picks')
        .insert(picksToInsert)
        .select();

      if (error) {
        console.error('[useDraft] Batch insert error:', error);
        toast.error('Failed to auto-complete draft', { id: 'auto-draft-all' });
        return false;
      }

      // Manually refresh draft picks locally to update UI immediately
      if (data) {
        console.log(`[useDraft] 🔄 Refreshing local picks after batch insert...`);
        const freshPicks = useGameStore.getState().draftPicks;
        const newPicks = [...freshPicks, ...data.map(pick => ({
          id: pick.id,
          leagueId: pick.league_id,
          round: pick.round,
          pickNumber: pick.pick_number,
          managerId: pick.manager_id,
          playerId: pick.player_id,
          isAutoDraft: pick.is_auto_draft,
          createdAt: new Date(pick.created_at),
        }))];
        setDraftPicks(newPicks);
      }

      // 3. Sync database rosters and state using RPC
      console.log(`[useDraft] 🔗 Syncing league rosters and state via RPC...`);
      const { error: syncError } = await supabase.rpc('sync_league_rosters', {
        p_league_id: leagueId
      });

      if (syncError) {
        console.error('[useDraft] ❌ Error syncing league rosters:', syncError);
        toast.error('Failed to sync rosters. Please refresh.', { id: 'auto-draft-all' });
        return false;
      }

      // IMPORTANT: After database is synced, trigger client-side roster optimization
      console.log(`[useDraft] 🏁 Sync complete, optimizing rosters for ${leagueId}`);
      const { success, error: finalizeError } = await finalizeRosters(leagueId);

      if (!success) {
        console.error('[useDraft] Roster optimization error:', finalizeError);
        toast.error('Draft complete, but roster optimization failed. Please refresh.', { id: 'auto-draft-all' });
        return false;
      }

      toast.success(`Successfully finalized draft for all teams!`, { id: 'auto-draft-all' });
      return true;
    } catch (error) {
      console.error('[useDraft] Auto-complete error:', error);
      toast.error('Failed to auto-complete draft', { id: 'auto-draft-all' });
      return false;
    }
  }, [leagueId, getPick, getDraftedPlayerIds, players, draftOrder, setDraftPicks, finalizeRosters, managers]);


  return {
    draftPicks,
    draftOrder,
    draftState,
    loading,
    getManagerAtPosition,
    getPick,
    getPlayerForPick,
    getDraftedPlayerIds,
    assignManagerToPosition,
    makePick,
    clearPick,
    resetDraft,
    randomizeDraftOrder,
    toggleAutoDraft,
    startDraft,
    pauseDraft,
    resumeDraft,
    resetClock,
    getRemainingTime,
    autoCompleteAllPicks,
  };
};
