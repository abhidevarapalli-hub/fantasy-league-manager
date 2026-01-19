import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade, DbTrade, mapDbTrade } from '@/lib/trade-types';
import { useGame } from '@/contexts/GameContext';

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const { managers, players, executeTrade } = useGame();

  // Fetch trades
  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
      } else if (data) {
        setTrades(data.map((t) => mapDbTrade(t as unknown as DbTrade)));
      }
      setLoading(false);
    };

    fetchTrades();
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('trades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTrades((prev) => [mapDbTrade(payload.new as unknown as DbTrade), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTrades((prev) =>
            prev.map((t) =>
              t.id === payload.new.id ? mapDbTrade(payload.new as unknown as DbTrade) : t
            )
          );
        } else if (payload.eventType === 'DELETE') {
          setTrades((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const proposeTrade = useCallback(
    async (proposerId: string, targetId: string, proposerPlayers: string[], targetPlayers: string[]) => {
      const { error } = await supabase.from('trades').insert({
        proposer_id: proposerId,
        target_id: targetId,
        proposer_players: proposerPlayers,
        target_players: targetPlayers,
        status: 'pending',
      });

      if (error) {
        console.error('Error proposing trade:', error);
        return false;
      }

      // Don't log proposed trades - only log accepted trades in Activity
      return true;
    },
    [managers, players]
  );

  const acceptTrade = useCallback(
    async (tradeId: string) => {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) return false;

      // Execute the trade
      await executeTrade(trade.proposerId, trade.targetId, trade.proposerPlayers, trade.targetPlayers);

      // Update trade status
      const { error } = await supabase.from('trades').update({ status: 'accepted' }).eq('id', tradeId);

      if (error) {
        console.error('Error accepting trade:', error);
        return false;
      }

      return true;
    },
    [trades, executeTrade]
  );

  const rejectTrade = useCallback(async (tradeId: string) => {
    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return false;

    const { error } = await supabase.from('trades').update({ status: 'rejected' }).eq('id', tradeId);

    if (error) {
      console.error('Error rejecting trade:', error);
      return false;
    }

    // Log rejection
    const proposer = managers.find((m) => m.id === trade.proposerId);
    const target = managers.find((m) => m.id === trade.targetId);

    await supabase.from('transactions').insert({
      type: 'trade',
      manager_id: trade.targetId,
      manager_team_name: target?.teamName,
      description: `${target?.teamName} rejected trade proposal from ${proposer?.teamName}`,
    });

    return true;
  }, [trades, managers]);

  const counterTrade = useCallback(
    async (originalTradeId: string, proposerId: string, targetId: string, proposerPlayers: string[], targetPlayers: string[]) => {
      // Mark original trade as countered
      await supabase.from('trades').update({ status: 'countered' }).eq('id', originalTradeId);

      // Create new counter trade
      const { error } = await supabase.from('trades').insert({
        proposer_id: proposerId,
        target_id: targetId,
        proposer_players: proposerPlayers,
        target_players: targetPlayers,
        status: 'pending',
        parent_trade_id: originalTradeId,
      });

      if (error) {
        console.error('Error creating counter trade:', error);
        return false;
      }

      // Log the counter
      const proposer = managers.find((m) => m.id === proposerId);
      const target = managers.find((m) => m.id === targetId);
      const proposerPlayerNames = proposerPlayers.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
      const targetPlayerNames = targetPlayers.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(', ');

      await supabase.from('transactions').insert({
        type: 'trade',
        manager_id: proposerId,
        manager_team_name: proposer?.teamName,
        description: `${proposer?.teamName} countered trade to ${target?.teamName}: ${proposerPlayerNames} for ${targetPlayerNames}`,
      });

      return true;
    },
    [managers, players]
  );

  const getPendingTradesForManager = useCallback(
    (managerId: string) => {
      return trades.filter(
        (t) => t.status === 'pending' && (t.proposerId === managerId || t.targetId === managerId)
      );
    },
    [trades]
  );

  const getIncomingTrades = useCallback(
    (managerId: string) => {
      return trades.filter((t) => t.status === 'pending' && t.targetId === managerId);
    },
    [trades]
  );

  const getOutgoingTrades = useCallback(
    (managerId: string) => {
      return trades.filter((t) => t.status === 'pending' && t.proposerId === managerId);
    },
    [trades]
  );

  const cancelTrade = useCallback(async (tradeId: string) => {
    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) {
      console.error('Error canceling trade:', error);
      return false;
    }
    return true;
  }, []);

  return {
    trades,
    loading,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    counterTrade,
    cancelTrade,
    getPendingTradesForManager,
    getIncomingTrades,
    getOutgoingTrades,
  };
};
