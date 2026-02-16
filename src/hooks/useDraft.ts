import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick, DraftOrder, DraftState, mapDbDraftPick, mapDbDraftOrder, mapDbDraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';
import { useGameStore } from '@/store/useGameStore';
import { toast } from 'sonner';
import { Player } from '@/lib/supabase-types';
import { buildOptimalActive11 } from '@/lib/roster-validation';
import { sortPlayersByPriority } from '@/lib/player-order';
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
              is_finalized: false,
              is_active: false
            })
            .select('*')
            .single();

          if (!createError && newState) {
            setDraftState(mapDbDraftState({ ...newState, league_id: leagueId }));
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
    return draftPicks.find(p => p.round === round && p.pickPosition === position) || null;
  }, [draftPicks]);

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

  // Finalize draft - clear all rosters first, then insert into junction table with optimal Active 11
  const finalizeDraft = useCallback(async () => {
    if (!leagueId) {
      toast.error('No league selected');
      return false;
    }

    try {
      // Group picks by manager
      const picksByManager = new Map<string, string[]>();

      for (const pick of draftPicks) {
        if (pick.managerId && pick.playerId) {
          const existing = picksByManager.get(pick.managerId) || [];
          existing.push(pick.playerId);
          picksByManager.set(pick.managerId, existing);
        }
      }

      if (picksByManager.size === 0) {
        toast.error('No picks have been made yet');
        return false;
      }

      // First, clear ALL roster entries for this league from junction table
      const { error: clearError } = await supabase
        .from('manager_roster' as 'managers')
        .delete()
        .eq('league_id', leagueId);

      if (clearError) {
        console.error('Failed to clear rosters:', clearError);
        toast.error('Failed to clear existing rosters');
        return false;
      }

      // Insert roster entries for each manager using optimal Active 11 building
      for (const [managerId, playerIds] of picksByManager) {
        // Get the actual player objects
        const draftedPlayers: Player[] = playerIds
          .map(id => players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined);

        // Build optimal Active 11 based on positional requirements
        const { active, bench } = buildOptimalActive11(draftedPlayers);

        // Prepare roster entries for insertion
        const rosterEntries = [
          ...active.map((p, idx) => ({
            manager_id: managerId,
            player_id: p.id,
            league_id: leagueId,
            slot_type: 'active' as const,
            position: idx,
          })),
          ...bench.map((p, idx) => ({
            manager_id: managerId,
            player_id: p.id,
            league_id: leagueId,
            slot_type: 'bench' as const,
            position: idx,
          })),
        ];

        if (rosterEntries.length > 0) {
          const { error } = await supabase
            .from('manager_roster')
            .insert(rosterEntries);

          if (error) {
            console.error('Failed to insert manager roster:', error);
            toast.error('Failed to update rosters');
            return false;
          }
        }
      }

      // Log draft finalization transaction
      await supabase.from('transactions').insert({
        type: 'trade',
        description: `Draft finalized - All rosters cleared, ${picksByManager.size} team rosters updated with optimized Active 11`,
        manager_id: null,
        week: null,
        league_id: leagueId,
      });

      // --- Schedule Generation ---
      // Clear existing schedule for this league to avoid duplicates
      const { error: clearScheduleError } = await supabase
        .from('league_schedules' as 'transactions') // Using actual DB table name
        .delete()
        .eq('league_id', leagueId);

      if (clearScheduleError) {
        console.error('Failed to clear existing schedule:', clearScheduleError);
      }

      // Generate new schedule
      const managerIds = Array.from(picksByManager.keys());

      // Dynamic import to avoid circular dependencies if any, or just for code splitting
      const { generateSchedule } = await import('@/lib/scheduler');
      const matchups = generateSchedule(managerIds);

      if (matchups.length > 0) {
        const scheduleRows = matchups.map(m => ({
          league_id: leagueId,
          week: m.round,
          manager1_id: m.home,
          manager2_id: m.away, // Can be null for bye
        }));

        const { error: scheduleError } = await supabase
          .from('league_schedules')
          .insert(scheduleRows);

        if (scheduleError) {
          console.error('Failed to save schedule:', scheduleError);
          toast.error('Draft finalized, but failed to generate schedule.');
        } else {
          console.log(`[useDraft] ✅ Generated ${matchups.length} matchups for 5 weeks.`);
        }
      }

      // Update draft state
      if (draftState) {
        await supabase
          .from('draft_state')
          .update({ is_finalized: true, finalized_at: new Date().toISOString() })
          .eq('league_id', leagueId);
      }

      toast.success(`Draft finalized! All rosters cleared and ${picksByManager.size} teams updated with optimized Active 11.`);
      return true;
    } catch (error) {
      console.error('Failed to finalize draft:', error);
      toast.error('Failed to finalize draft');
      return false;
    }
  }, [draftPicks, draftState, players, leagueId]);

  // Make a draft pick
  const makePick = useCallback(async (round: number, position: number, playerId: string, isAutoDraft = false) => {
    const orderItem = draftOrder.find(o => o.position === position);

    // Allow empty manager (null) for empty slots
    const managerId = orderItem?.managerId || null;

    if (!managerId && !isAutoDraft) {
      console.log('[useDraft] ⚠️ Picking for empty slot (no manager) - allowed as it might be admin override');
    }

    const existingPick = getPick(round, position);

    if (existingPick) {
      // Optimistic update for existing pick
      const oldPlayerId = existingPick.playerId;
      // Get FRESH state for optimistic update to avoid race conditions
      const currentPicks = useGameStore.getState().draftPicks;

      const optimisticPicks = currentPicks.map(p =>
        p.id === existingPick.id ? { ...p, playerId, managerId, isAutoDraft } : p
      );

      console.log(`[useDraft] ⚡️ Optimistically updating existing pick ${existingPick.id}`);
      setDraftPicks(optimisticPicks);

      const { error } = await supabase
        .from('draft_picks')
        .update({ player_id: playerId, manager_id: managerId, is_auto_draft: isAutoDraft })
        .eq('id', existingPick.id);

      if (error) {
        // Revert on error - get fresh state again
        const freshPicks = useGameStore.getState().draftPicks;
        setDraftPicks(freshPicks.map(p =>
          p.id === existingPick.id ? { ...p, playerId: oldPlayerId } : p
        ));
        toast.error('Failed to update pick');
        console.error(error);
      }
    } else {
      // Optimistic insert - create temporary ID
      const tempId = `temp-${round}-${position}`;
      const newPick: DraftPick = {
        id: tempId,
        leagueId: leagueId!,
        round,
        pickPosition: position,
        managerId,
        playerId,
        isAutoDraft,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Get latest state
      const initialPicks = useGameStore.getState().draftPicks;
      console.log(`[useDraft] ⚡️ Optimistically adding new pick ${tempId}`);
      setDraftPicks([...initialPicks, newPick]);

      const { data, error } = await supabase
        .from('draft_picks')
        .insert({
          league_id: leagueId!,
          round,
          pick_position: position,
          manager_id: managerId,
          player_id: playerId,
          is_auto_draft: isAutoDraft,
        })
        .select()
        .single();

      if (error) {
        // Revert on error
        const picksAfterError = useGameStore.getState().draftPicks;
        setDraftPicks(picksAfterError.filter(p => p.id !== tempId));

        if (error.code === '23505') {
          console.warn(`[useDraft] ⚠️ Pick already exists in DB for ${round}.${position}. Realtime should fix it.`);
        } else {
          toast.error('Failed to make pick');
          console.error(error);
        }
      } else if (data) {
        // Replace temp pick with real one
        // CRITICAL: Get latest state again because Realtime might have fired
        const latestPicks = useGameStore.getState().draftPicks;

        const realPick = mapDbDraftPick(data as unknown as DbDraftPick);
        const alreadyHasReal = latestPicks.find(p => p.id === realPick.id);

        if (alreadyHasReal) {
          // Realtime beat us to it. Just remove the temp pick.
          console.log(`[useDraft] 🔄 Realtime arrived first. Removing temp pick ${tempId}`);
          setDraftPicks(latestPicks.filter(p => p.id !== tempId));
        } else {
          // Replace temp with real
          console.log(`[useDraft] ✅ Converting temp pick ${tempId} to real pick ${realPick.id}`);
          setDraftPicks(latestPicks.map(p =>
            p.id === tempId ? realPick : p
          ));
        }
      }
    }

    // After a successful pick (optimistic or real), update the timer for the next pick
    if (draftState?.isActive) {
      const config = useGameStore.getState().config;
      const totalPicks = config.managerCount * (config.activeSize + config.benchSize);
      // We use the store's draftPicks length + 1 (if new) to check if finished
      const currentPicks = useGameStore.getState().draftPicks;
      // Note: currentPicks already has the new pick included via opportunistic update

      if (currentPicks.length >= totalPicks) {
        // Draft finished!
        finalizeDraft();
      } else {
        // Update timer for next pick
        const newStartAt = new Date().toISOString();

        // Optimistic update for UI responsiveness
        setDraftState({
          ...draftState,
          currentPickStartAt: new Date(newStartAt)
        });

        await supabase
          .from('draft_state')
          .update({ current_pick_start_at: newStartAt })
          .eq('id', draftState.id);
      }
    }
  }, [draftOrder, getPick, draftState, finalizeDraft, leagueId, setDraftPicks, setDraftState]);

  // Clear a pick
  const clearPick = useCallback(async (round: number, position: number) => {
    const existingPick = getPick(round, position);
    if (!existingPick) return;

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
      // Delete all picks for this league
      await supabase.from('draft_picks').delete().eq('league_id', leagueId);

      // Reset draft order for this league
      await supabase
        .from('draft_order')
        .update({ manager_id: null, auto_draft_enabled: false })
        .eq('league_id', leagueId);

      // Reset draft state
      await supabase
        .from('draft_state')
        .update({
          is_finalized: false,
          finalized_at: null,
          is_active: false,
          current_pick_start_at: null,
          paused_at: null
        })
        .eq('league_id', leagueId);

      setDraftPicks([]);

      // Update local state if we have it
      if (draftState) {
        setDraftState({
          ...draftState,
          isFinalized: false,
          finalizedAt: null,
          isActive: false,
          currentPickStartAt: null,
          pausedAt: null
        });
      }

      toast.success('Draft has been reset');
    } catch (error) {
      console.error('Failed to reset draft:', error);
      toast.error('Failed to reset draft');
    }
  }, [leagueId, draftState, setDraftPicks, setDraftState]);

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
    console.log('[useDraft] 📝 Updating draft_state to active...', { id: draftState.id });

    // Optimistic update
    setDraftState({
      ...draftState,
      isActive: true,
      currentPickStartAt: new Date(startAt),
      pausedAt: null
    });

    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: true,
        current_pick_start_at: startAt,
        paused_at: null
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to start draft');
      console.error('[useDraft] ❌ Error starting draft:', error);
      // Revert
      setDraftState({
        ...draftState,
        isActive: false,
        currentPickStartAt: draftState.currentPickStartAt // restore
      });
    } else {
      console.log('[useDraft] ✅ Draft state successfully updated to active');
      toast.success('Draft started!');
    }
  }, [draftState, draftOrder, managers, setDraftState]);

  // Pause draft
  const pauseDraft = useCallback(async () => {
    if (!draftState || !draftState.isActive) return;

    const pausedAt = new Date().toISOString();

    // Optimistic update
    setDraftState({
      ...draftState,
      isActive: false,
      pausedAt: new Date(pausedAt)
    });

    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: false,
        paused_at: pausedAt
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to pause draft');
      console.error(error);
      // Revert
      setDraftState({
        ...draftState,
        isActive: true,
        pausedAt: null
      });
    }
  }, [draftState, setDraftState]);

  // Resume draft
  const resumeDraft = useCallback(async () => {
    if (!draftState || draftState.isActive) return;

    // Calculate new start at by adding the duration of the pause
    let newStartAt = new Date();
    if (draftState.currentPickStartAt && draftState.pausedAt) {
      const pauseDuration = Date.now() - draftState.pausedAt.getTime();
      newStartAt = new Date(draftState.currentPickStartAt.getTime() + pauseDuration);
    }

    const startAtIso = newStartAt.toISOString();

    // Optimistic update
    setDraftState({
      ...draftState,
      isActive: true,
      currentPickStartAt: newStartAt,
      pausedAt: null
    });

    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: true,
        current_pick_start_at: startAtIso,
        paused_at: null
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to resume draft');
      console.error(error);
      // Revert
      setDraftState({
        ...draftState,
        isActive: false,
        pausedAt: draftState.pausedAt
      });
    }
  }, [draftState, setDraftState]);

  // Reset clock for current pick
  const resetClock = useCallback(async () => {
    if (!draftState) return;

    const { error } = await supabase
      .from('draft_state')
      .update({
        current_pick_start_at: new Date().toISOString()
      })
      .eq('id', draftState.id);

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

    const round = Math.floor(currentTotalPicks / positionsCount) + 1;
    const pickIndexInRound = currentTotalPicks % positionsCount;
    const isEvenRound = round % 2 === 0;
    const position = isEvenRound
      ? (positionsCount - pickIndexInRound)
      : (pickIndexInRound + 1);

    const orderNode = draftOrder.find(o => o.position === position);
    const isAutoDraftEnabled = orderNode?.autoDraftEnabled || false;

    return { round, position, orderNode, isAutoDraftEnabled };
  }, [draftPicks.length, managers.length, draftOrder]);

  // Get remaining time for current pick (in ms)
  const getRemainingTime = useCallback(() => {
    const pickData = getCurrentPickData();
    let timerDuration = 30000; // default 30s

    if (pickData?.isAutoDraftEnabled) {
      timerDuration = 10000;
    }

    if (!draftState || !draftState.currentPickStartAt) return timerDuration;

    const now = draftState.pausedAt?.getTime() || Date.now();
    const elapsed = now - draftState.currentPickStartAt.getTime();
    return Math.max(0, timerDuration - elapsed);
  }, [draftState, getCurrentPickData]);

  // Execute an auto-pick
  const executeAutoPick = useCallback(async (round: number, position: number) => {
    const slotKey = `${round}-${position}`;

    // Concurrency Lock: Prevent multiple calls for the same slot
    if (processingPicksRef.current.has(slotKey)) {
      console.warn(`[useDraft] 🛡️ Pick for ${slotKey} is already in flight. Skipping.`);
      return;
    }

    // Secondary check: pick already exists in state
    const currentPicks = useGameStore.getState().draftPicks;
    if (currentPicks.some(p => p.round === round && p.pickPosition === position)) {
      console.warn(`[useDraft] ⚠️ Pick for ${slotKey} already exists in store. Skipping.`);
      return;
    }

    console.log(`[useDraft] 🤖 Executing auto-pick for ${slotKey}`);
    processingPicksRef.current.add(slotKey);

    try {
      const draftedIds = getDraftedPlayerIds();
      const available = players.filter(p => !draftedIds.includes(p.id));

      if (available.length === 0) {
        console.warn('[useDraft] 🤖 Auto-pick failed: No players available');
        return;
      }

      const sorted = sortPlayersByPriority(available);
      const bestPlayer = sorted[0];

      console.log(`[useDraft] 🤖 Auto-picking ${bestPlayer.name} for ${slotKey}`);
      await makePick(round, position, bestPlayer.id, true);
    } catch (e) {
      console.error(`[useDraft] ❌ Auto-pick error for ${slotKey}:`, e);
    } finally {
      // Only clear after a small delay to ensure Realtime/State catch up
      setTimeout(() => {
        processingPicksRef.current.delete(slotKey);
      }, 1000);
    }
  }, [getDraftedPlayerIds, players, makePick]);

  // Timer side-effect for auto-drafting and empty team handling
  useEffect(() => {
    if (!draftState?.isActive || draftState?.isFinalized) return;
    if (draftState?.pausedAt) return;

    // Calculate current position details once
    const pickData = getCurrentPickData();
    if (!pickData) return;

    const { round, position, orderNode, isAutoDraftEnabled } = pickData;

    // Check if the current position has a manager assigned
    const hasManager = !!orderNode?.managerId;

    // Check if manager is a bot (empty team with no user_id)
    const manager = hasManager ? managers.find(m => m.id === orderNode!.managerId) : null;

    const isAssignedToUser = !!manager?.userId;

    const shouldImmediatePick = !hasManager || (manager && !manager.userId);

    console.log(`[useDraft] ⏱️ Tick: ${round}.${position} | Manager: ${manager?.teamName || 'None'} | User: ${isAssignedToUser ? 'Yes' : 'No'} | AutoDraft: ${isAutoDraftEnabled} | Immediate: ${shouldImmediatePick}`);

    if (shouldImmediatePick) {
      console.log(`[useDraft] 👻 No human manager for ${round}.${position}. Executing immediate auto-pick.`);
      const timeout = setTimeout(() => {
        executeAutoPick(round, position);
      }, 2000);
      return () => clearTimeout(timeout);
    }

    const timer = setInterval(() => {
      const remaining = getRemainingTime();

      if (remaining <= 0) {
        console.log(`[useDraft] ⏰ Time up for ${round}.${position}. Triggering auto-pick.`);
        executeAutoPick(round, position);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [draftState, getRemainingTime, managers, executeAutoPick, getCurrentPickData]);

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
    finalizeDraft,
    resetDraft,
    randomizeDraftOrder,
    toggleAutoDraft,
    startDraft,
    pauseDraft,
    resumeDraft,
    resetClock,
    getRemainingTime,
    executeAutoPick,
  };
};
