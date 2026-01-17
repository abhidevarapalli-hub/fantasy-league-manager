import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick, DraftOrder, DraftState, mapDbDraftPick, mapDbDraftOrder, mapDbDraftState, DbDraftPick, DbDraftOrder, DbDraftState } from '@/lib/draft-types';
import { useGame } from '@/contexts/GameContext';
import { toast } from 'sonner';

export const useDraft = () => {
  const { managers, players } = useGame();
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [draftOrder, setDraftOrder] = useState<DraftOrder[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [picksRes, orderRes, stateRes] = await Promise.all([
        supabase.from('draft_picks').select('*'),
        supabase.from('draft_order').select('*').order('position'),
        supabase.from('draft_state').select('*').maybeSingle(),
      ]);

      if (picksRes.data) {
        setDraftPicks((picksRes.data as unknown as DbDraftPick[]).map(mapDbDraftPick));
      }
      if (orderRes.data) {
        setDraftOrder((orderRes.data as unknown as DbDraftOrder[]).map(mapDbDraftOrder));
      }
      if (stateRes.data) {
        setDraftState(mapDbDraftState(stateRes.data as unknown as DbDraftState));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

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

    const { error } = await supabase
      .from('draft_order')
      .update({ manager_id: managerId })
      .eq('id', orderItem.id);

    if (error) {
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
      // Update existing pick
      const { error } = await supabase
        .from('draft_picks')
        .update({ player_id: playerId, manager_id: orderItem.managerId })
        .eq('id', existingPick.id);

      if (error) {
        toast.error('Failed to update pick');
        console.error(error);
      }
    } else {
      // Insert new pick
      const { error } = await supabase
        .from('draft_picks')
        .insert({
          round,
          pick_position: position,
          manager_id: orderItem.managerId,
          player_id: playerId,
        });

      if (error) {
        toast.error('Failed to make pick');
        console.error(error);
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

  // Finalize draft - clear all rosters and assign drafted players
  const finalizeDraft = useCallback(async () => {
    // Validate all positions have managers
    const unassignedPositions = draftOrder.filter(o => !o.managerId);
    if (unassignedPositions.length > 0) {
      toast.error('All draft positions must have a manager assigned');
      return false;
    }

    // Check if all 112 picks (8 teams x 14 rounds) are made
    const totalExpectedPicks = 8 * 14;
    const actualPicks = draftPicks.filter(p => p.playerId);
    if (actualPicks.length < totalExpectedPicks) {
      toast.error(`Only ${actualPicks.length}/${totalExpectedPicks} picks made. Complete the draft first.`);
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

      // Update each manager's roster (first 11 active, rest on bench)
      for (const [managerId, playerIds] of picksByManager) {
        const activeRoster = playerIds.slice(0, 11);
        const bench = playerIds.slice(11);

        const { error } = await supabase
          .from('managers')
          .update({ roster: activeRoster, bench: bench })
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
        description: 'Draft finalized - all rosters updated',
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

      toast.success('Draft finalized! All rosters have been updated.');
      return true;
    } catch (error) {
      console.error('Failed to finalize draft:', error);
      toast.error('Failed to finalize draft');
      return false;
    }
  }, [draftOrder, draftPicks, draftState]);

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
