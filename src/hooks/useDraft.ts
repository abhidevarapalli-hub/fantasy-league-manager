import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick, DraftOrder, DraftState, mapDbDraftPick, mapDbDraftOrder, mapDbDraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';
import { useGameStore } from '@/store/useGameStore';
import { toast } from 'sonner';
import { Player } from '@/lib/supabase-types';
import { buildOptimalActive11 } from '@/lib/roster-validation';
import { sortPlayersByPriority } from '@/lib/player-order';

export const useDraft = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const initializedDraftLeagueId = useGameStore(state => state.initializedDraftLeagueId);
  const setInitializedDraftLeagueId = useGameStore(state => state.setInitializedDraftLeagueId);
  const draftPicks = useGameStore(state => state.draftPicks);
  const draftOrder = useGameStore(state => state.draftOrder);
  const draftState = useGameStore(state => state.draftState);
  const setDraftPicks = useGameStore(state => state.setDraftPicks);
  const setDraftOrder = useGameStore(state => state.setDraftOrder);
  const setDraftState = useGameStore(state => state.setDraftState);
  const [loading, setLoading] = useState(true);

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
  }, [leagueId]);

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
  }, [draftOrder]);

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
            .from('manager_roster' as 'managers')
            .insert(rosterEntries as any);

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
        manager_team_name: null,
        week: null,
        league_id: leagueId,
      });

      // --- Schedule Generation ---
      // Clear existing schedule for this league to avoid duplicates
      // Use 'league_schedules' as per migration
      const { error: clearScheduleError } = await supabase
        .from('league_schedules' as 'transactions') // Casting to avoid type errors if types aren't updated yet
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
          .from('league_schedules' as 'transactions')
          .insert(scheduleRows as any);

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
      // Use functional update or getState to ensure we have latest picks
      // But setDraftPicks in useGameStore unfortunately doesn't support functional update yet (it's a simple setter)
      // So we must use useGameStore.getState().draftPicks
      const currentPicks = useGameStore.getState().draftPicks;

      setDraftPicks(currentPicks.map(p =>
        p.id === existingPick.id ? { ...p, playerId, managerId, isAutoDraft } : p
      ));

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

      // Get latest state before setting
      const initialPicks = useGameStore.getState().draftPicks;
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
        toast.error('Failed to make pick');
        console.error(error);
      } else if (data) {
        // Replace temp pick with real one
        // CRITICAL: Get latest state again because Realtime might have fired
        const latestPicks = useGameStore.getState().draftPicks;

        // If Realtime already added the Real pick (by checking round/position match with a REAL id), 
        // we might have duplicates if we aren't careful.
        // But mapDbDraftPick(data) has the REAL ID.
        // If Realtime added it, there is already a pick with real ID.
        // And our Temp pick is also there.
        // We want to REMOVE the temp pick.
        // If the Real pick is already there, we just remove temp.
        // If Real pick is NOT there, we replace Temp with Real.

        const realPick = mapDbDraftPick(data as unknown as DbDraftPick);
        const alreadyHasReal = latestPicks.find(p => p.id === realPick.id);

        if (alreadyHasReal) {
          // Realtime beat us to it. Just remove the temp pick.
          setDraftPicks(latestPicks.filter(p => p.id !== tempId));
        } else {
          // Replace temp with real
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
      const currentTotalPicks = draftPicks.length + (existingPick ? 0 : 1);

      if (currentTotalPicks >= totalPicks) {
        // Draft finished!
        finalizeDraft();
      } else {
        // Update timer for next pick
        await supabase
          .from('draft_state')
          .update({ current_pick_start_at: new Date().toISOString() })
          .eq('id', draftState.id);
      }
    }
  }, [draftOrder, getPick, draftState, draftPicks, finalizeDraft]);

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
      toast.success('Draft has been reset');
    } catch (error) {
      console.error('Failed to reset draft:', error);
      toast.error('Failed to reset draft');
    }
  }, [leagueId]);

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
    const updates = Array.from({ length: slotsNeeded }).map((_, index) => {
      const position = index + 1;
      const existing = draftOrder.find(o => o.position === position);

      const update: any = {
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
      managerId: u.manager_id,
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
  }, [draftOrder, managers, leagueId]);

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
  }, [draftOrder]);

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

    console.log('[useDraft] 📝 Updating draft_state to active...', { id: draftState.id });
    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: true,
        current_pick_start_at: new Date().toISOString(),
        paused_at: null
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to start draft');
      console.error('[useDraft] ❌ Error starting draft:', error);
    } else {
      console.log('[useDraft] ✅ Draft state successfully updated to active');
      toast.success('Draft started!');
    }
  }, [draftState, draftOrder, managers]);

  // Pause draft
  const pauseDraft = useCallback(async () => {
    if (!draftState || !draftState.isActive) return;

    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: false,
        paused_at: new Date().toISOString()
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to pause draft');
      console.error(error);
    }
  }, [draftState]);

  // Resume draft
  const resumeDraft = useCallback(async () => {
    if (!draftState || draftState.isActive) return;

    // Calculate new start at by adding the duration of the pause
    let newStartAt = new Date();
    if (draftState.currentPickStartAt && draftState.pausedAt) {
      const pauseDuration = Date.now() - draftState.pausedAt.getTime();
      newStartAt = new Date(draftState.currentPickStartAt.getTime() + pauseDuration);
    }

    const { error } = await supabase
      .from('draft_state')
      .update({
        is_active: true,
        current_pick_start_at: newStartAt.toISOString(),
        paused_at: null
      })
      .eq('id', draftState.id);

    if (error) {
      toast.error('Failed to resume draft');
      console.error(error);
    }
  }, [draftState]);

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

  // Get remaining time for current pick (in ms)
  const getRemainingTime = useCallback(() => {
    const timerDuration = 30000; // 30 seconds as requested
    if (!draftState || !draftState.currentPickStartAt) return timerDuration;

    const now = draftState.pausedAt?.getTime() || Date.now();
    const elapsed = now - draftState.currentPickStartAt.getTime();
    return Math.max(0, timerDuration - elapsed);
  }, [draftState]);

  // Execute an auto-pick
  const executeAutoPick = useCallback(async (round: number, position: number) => {
    console.log(`[useDraft] 🤖 Executing auto-pick for ${round}.${position}`);
    const draftedIds = getDraftedPlayerIds();
    const available = players.filter(p => !draftedIds.includes(p.id));

    if (available.length === 0) {
      console.warn('[useDraft] 🤖 Auto-pick failed: No players available');
      return;
    }

    const sorted = sortPlayersByPriority(available);
    const bestPlayer = sorted[0];

    console.log(`[useDraft] 🤖 Auto-picking ${bestPlayer.name} for ${round}.${position}`);
    await makePick(round, position, bestPlayer.id, true);
  }, [getDraftedPlayerIds, players, makePick]);

  // Timer side-effect for auto-drafting and empty team handling
  useEffect(() => {
    if (!draftState?.isActive || draftState?.isFinalized) return;

    // If paused, we don't tick, but we also don't auto-pick
    if (draftState?.pausedAt) return;

    // Calculate current position details once
    const currentTotalPicks = draftPicks.length;
    const positionsCount = managers.length;

    if (positionsCount === 0) return;

    const round = Math.floor(currentTotalPicks / positionsCount) + 1;
    const pickIndexInRound = currentTotalPicks % positionsCount;
    const isEvenRound = round % 2 === 0;
    const position = isEvenRound
      ? (positionsCount - pickIndexInRound)
      : (pickIndexInRound + 1);

    // Check if the current position has a manager assigned
    const currentOrderNode = draftOrder.find(o => o.position === position);
    const hasManager = !!currentOrderNode?.managerId;

    // Check if manager is a bot (empty team with no user_id)
    const manager = hasManager ? managers.find(m => m.id === currentOrderNode!.managerId) : null;
    // Treat as bot if explicitly auto-draft enabled OR no attached user (Empty Team)
    const isBot = (manager && !manager.userId) || (currentOrderNode?.autoDraftEnabled);

    // Immediate auto-pick if no manager assigned OR if it's a bot
    // We only auto-pick for "Empty Teams" immediately. 
    // For human teams with auto-draft enabled, we might want to respect the timer? 
    // The user request specified "Empty teams". 
    // "Just use it in the pick order. in the screen shot the empty teams should be auto picking"
    // So assume immediate for no-user teams.
    const shouldImmediatePick = !hasManager || (manager && !manager.userId);

    if (shouldImmediatePick) {
      console.log(`[useDraft] 👻 No human manager for ${round}.${position}. Executing immediate auto-pick.`);
      // Add a small delay to avoid race conditions with state updates
      const timeout = setTimeout(() => {
        executeAutoPick(round, position);
      }, 1000);
      return () => clearTimeout(timeout);
    }

    // For human teams with auto-draft, we let the timer run out (standard behavior) or pick immediately?
    // Usually auto-draft means "Pick for me when it's my turn". Immediate is better UX.
    // I'll add them to immediate pick too if user explicitly enabled it?
    // User only asked for "Empty teams". I'll stick to that strictly to avoid surprises.
    // But wait, if human toggles auto-draft, they expect it to pick.
    // I'll stick to !manager.userId for now.

    const timer = setInterval(() => {
      const remaining = getRemainingTime();

      // If time is up, trigger auto-pick
      if (remaining <= 0) {
        console.log(`[useDraft] ⏰ Time up for ${round}.${position}. Triggering auto-pick.`);
        executeAutoPick(round, position);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [draftState, getRemainingTime, draftPicks, managers, executeAutoPick, draftOrder]);

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
