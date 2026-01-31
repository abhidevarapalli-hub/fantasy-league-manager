import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick, DraftOrder, DraftState, mapDbDraftPick, mapDbDraftOrder, mapDbDraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';
import { useGameStore } from '@/store/useGameStore';
import { toast } from 'sonner';
import { Player } from '@/lib/supabase-types';
import { buildOptimalActive11 } from '@/lib/roster-validation';

export const useDraft = () => {
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const isDraftInitialized = useGameStore(state => state.isDraftInitialized);
  const setIsDraftInitialized = useGameStore(state => state.setIsDraftInitialized);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [draftOrder, setDraftOrder] = useState<DraftOrder[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    // Skip if draft data already initialized
    if (isDraftInitialized) {
      console.log('[useDraft] ✅ Draft data already initialized, skipping fetch...');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const fetchStartTime = performance.now();
      console.log('[useDraft] 🎯 Starting draft data fetch...');

      setLoading(true);

      try {
        const parallelFetchStart = performance.now();
        const [picksRes, orderRes, stateRes] = await Promise.all([
          supabase.from('draft_picks').select('*'),
          supabase.from('draft_order').select('*').order('position'),
          supabase.from('draft_state').select('*').maybeSingle(),
        ]);
        const parallelFetchDuration = performance.now() - parallelFetchStart;
        console.log(`[useDraft] ✅ Parallel fetch completed in ${parallelFetchDuration.toFixed(2)}ms`);

        // Check for errors
        if (picksRes.error) {
          console.error('[useDraft] ❌ Error fetching draft picks:', picksRes.error);
        }
        if (orderRes.error) {
          console.error('[useDraft] ❌ Error fetching draft order:', orderRes.error);
        }
        if (stateRes.error) {
          console.error('[useDraft] ❌ Error fetching draft state:', stateRes.error);
        }

        const mappingStart = performance.now();
        if (picksRes.data) {
          setDraftPicks((picksRes.data as unknown as DbDraftPick[]).map(mapDbDraftPick));
        }
        if (orderRes.data) {
          setDraftOrder((orderRes.data as unknown as DbDraftOrder[]).map(mapDbDraftOrder));
        }
        if (stateRes.data) {
          setDraftState(mapDbDraftState(stateRes.data as unknown as DbDraftState));
        }
        const mappingDuration = performance.now() - mappingStart;

        const totalDuration = performance.now() - fetchStartTime;
        console.log(`[useDraft] 🗂️  Data mapping completed in ${mappingDuration.toFixed(2)}ms`);
        console.log(`[useDraft] 🎯 Draft data: ${picksRes.data?.length || 0} picks, ${orderRes.data?.length || 0} positions, state: ${stateRes.data ? 'loaded' : 'none'}`);
        console.log(`[useDraft] 🎉 Total draft fetch completed in ${totalDuration.toFixed(2)}ms (Fetch: ${parallelFetchDuration.toFixed(2)}ms, Mapping: ${mappingDuration.toFixed(2)}ms)`);

        // Mark as initialized
        setIsDraftInitialized(true);
      } catch (error) {
        console.error('[useDraft] ❌ Fatal error fetching draft data:', error);
        toast.error('Failed to load draft data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isDraftInitialized, setIsDraftInitialized]);

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('draft-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_picks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newPick = mapDbDraftPick(payload.new as unknown as DbDraftPick);
          setDraftPicks(prev => [...prev.filter(p => !(p.round === newPick.round && p.pickPosition === newPick.pickPosition)), newPick]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedPick = mapDbDraftPick(payload.new as unknown as DbDraftPick);
          setDraftPicks(prev => prev.map(p => p.id === updatedPick.id ? updatedPick : p));
        } else if (payload.eventType === 'DELETE') {
          setDraftPicks(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_order' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = mapDbDraftOrder(payload.new as unknown as DbDraftOrder);
          setDraftOrder(prev => prev.map(o => o.id === updated.id ? updated : o));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_state' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setDraftState(mapDbDraftState(payload.new as unknown as DbDraftState));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    setDraftOrder(prev => prev.map(o =>
      o.position === position ? { ...o, managerId } : o
    ));

    const { error } = await supabase
      .from('draft_order')
      .update({ manager_id: managerId })
      .eq('id', orderItem.id);

    if (error) {
      // Revert on error
      setDraftOrder(prev => prev.map(o =>
        o.position === position ? { ...o, managerId: orderItem.managerId } : o
      ));
      toast.error('Failed to assign manager');
      console.error(error);
    }
  }, [draftOrder]);

  // Make a draft pick
  const makePick = useCallback(async (round: number, position: number, playerId: string) => {
    const orderItem = draftOrder.find(o => o.position === position);
    if (!orderItem?.managerId) {
      toast.error('No manager assigned to this position');
      return;
    }

    const existingPick = getPick(round, position);

    if (existingPick) {
      // Optimistic update for existing pick
      const oldPlayerId = existingPick.playerId;
      setDraftPicks(prev => prev.map(p =>
        p.id === existingPick.id ? { ...p, playerId, managerId: orderItem.managerId } : p
      ));

      const { error } = await supabase
        .from('draft_picks')
        .update({ player_id: playerId, manager_id: orderItem.managerId })
        .eq('id', existingPick.id);

      if (error) {
        // Revert on error
        setDraftPicks(prev => prev.map(p =>
          p.id === existingPick.id ? { ...p, playerId: oldPlayerId } : p
        ));
        toast.error('Failed to update pick');
        console.error(error);
      }
    } else {
      // Optimistic insert - create temporary ID
      const tempId = `temp-${round}-${position}`;
      const newPick = {
        id: tempId,
        round,
        pickPosition: position,
        managerId: orderItem.managerId,
        playerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setDraftPicks(prev => [...prev, newPick]);

      const { data, error } = await supabase
        .from('draft_picks')
        .insert({
          round,
          pick_position: position,
          manager_id: orderItem.managerId,
          player_id: playerId,
        })
        .select()
        .single();

      if (error) {
        // Revert on error
        setDraftPicks(prev => prev.filter(p => p.id !== tempId));
        toast.error('Failed to make pick');
        console.error(error);
      } else if (data) {
        // Replace temp pick with real one
        setDraftPicks(prev => prev.map(p =>
          p.id === tempId ? mapDbDraftPick(data as unknown as DbDraftPick) : p
        ));
      }
    }
  }, [draftOrder, getPick]);

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

  // Finalize draft - clear all rosters first, then update with drafted players using optimal Active 11
  const finalizeDraft = useCallback(async () => {
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

      // First, clear ALL manager rosters
      const { error: clearError } = await supabase
        .from('managers')
        .update({ roster: [], bench: [] })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all managers

      if (clearError) {
        console.error('Failed to clear rosters:', clearError);
        toast.error('Failed to clear existing rosters');
        return false;
      }

      // Update each manager's roster with drafted players using optimal Active 11 building
      for (const [managerId, playerIds] of picksByManager) {
        // Get the actual player objects
        const draftedPlayers: Player[] = playerIds
          .map(id => players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined);

        // Build optimal Active 11 based on positional requirements
        const { active, bench } = buildOptimalActive11(draftedPlayers);

        const activeRoster = active.map(p => p.id);
        const benchRoster = bench.map(p => p.id);

        const { error } = await supabase
          .from('managers')
          .update({ roster: activeRoster, bench: benchRoster })
          .eq('id', managerId);

        if (error) {
          console.error('Failed to update manager roster:', error);
          toast.error('Failed to update rosters');
          return false;
        }
      }

      // Log draft finalization transaction
      await supabase.from('transactions').insert({
        type: 'trade',
        description: `Draft finalized - All rosters cleared, ${picksByManager.size} team rosters updated with optimized Active 11`,
        manager_id: null,
        manager_team_name: null,
        week: null,
      });

      // Update draft state
      if (draftState) {
        await supabase
          .from('draft_state')
          .update({ is_finalized: true, finalized_at: new Date().toISOString() })
          .eq('id', draftState.id);
      }

      toast.success(`Draft finalized! All rosters cleared and ${picksByManager.size} teams updated with optimized Active 11.`);
      return true;
    } catch (error) {
      console.error('Failed to finalize draft:', error);
      toast.error('Failed to finalize draft');
      return false;
    }
  }, [draftPicks, draftState, players]);

  // Reset draft
  const resetDraft = useCallback(async () => {
    try {
      // Delete all picks
      await supabase.from('draft_picks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset draft order (remove manager assignments)
      for (const order of draftOrder) {
        await supabase.from('draft_order').update({ manager_id: null }).eq('id', order.id);
      }

      // Reset draft state
      if (draftState) {
        await supabase
          .from('draft_state')
          .update({ is_finalized: false, finalized_at: null })
          .eq('id', draftState.id);
      }

      setDraftPicks([]);
      toast.success('Draft has been reset');
    } catch (error) {
      console.error('Failed to reset draft:', error);
      toast.error('Failed to reset draft');
    }
  }, [draftOrder, draftState]);

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
  };
};
