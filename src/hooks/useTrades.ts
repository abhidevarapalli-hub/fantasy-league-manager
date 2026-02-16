import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade, DbTrade, DbTradePlayer, mapDbTrade } from '@/lib/trade-types';
import { useGameStore } from '@/store/useGameStore';

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const executeTrade = useGameStore(state => state.executeTrade);
  const currentLeagueId = useGameStore(state => state.currentLeagueId);
  const isTradesInitialized = useGameStore(state => state.isTradesInitialized);
  const setIsTradesInitialized = useGameStore(state => state.setIsTradesInitialized);

  // Fetch trades
  useEffect(() => {
    // Skip if trades data already initialized
    if (isTradesInitialized) {
      // console.log('[useTrades] ✅ Trades data already initialized, skipping fetch...');
      setLoading(false);
      return;
    }

    const fetchTrades = async () => {
      const fetchStartTime = performance.now();
      // console.log('[useTrades] 🔄 Starting trades data fetch...');

      setLoading(true);

      try {
        // Add timeout protection - if query takes > 5s, assume table doesn't exist
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout - trades table may not exist')), 5000)
        );

        const queryPromise = Promise.all([
          supabase
            .from('trades')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('trade_players')
            .select('*'),
        ]);

        const [tradesResult, tradePlayersResult] = await Promise.race([queryPromise, timeoutPromise]) as [
          { data: DbTrade[] | null; error: { message: string } | null },
          { data: DbTradePlayer[] | null; error: { message: string } | null }
        ];

        const fetchDuration = performance.now() - fetchStartTime;

        if (tradesResult.error) {
          setTrades([]);
          setIsTradesInitialized(true); // Mark as initialized even on error to prevent retries
        } else if (tradesResult.data) {
          const mappingStart = performance.now();
          const allTradePlayers = (tradePlayersResult?.data || []) as DbTradePlayer[];
          setTrades(tradesResult.data.map((t: DbTrade) => mapDbTrade(t, allTradePlayers)));
          const mappingDuration = performance.now() - mappingStart;

          const totalDuration = performance.now() - fetchStartTime;
          void fetchDuration; void mappingDuration; void totalDuration;

          // Mark as initialized
          setIsTradesInitialized(true);
        }
      } catch (error: unknown) {
        const duration = performance.now() - fetchStartTime;
        // console.error(`[useTrades] ❌ Fatal error fetching trades (${duration.toFixed(2)}ms):`, error.message || error);
        // console.warn('[useTrades] ⚠️  Using empty trades array - trades table may not exist in database');
        setTrades([]);
        setIsTradesInitialized(true); // Mark as initialized to prevent infinite retries
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [isTradesInitialized, setIsTradesInitialized]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('trades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const tradeId = (payload.new as DbTrade).id;
          const { data: tp } = await supabase.from('trade_players').select('*').eq('trade_id', tradeId);
          setTrades((prev) => [mapDbTrade(payload.new as unknown as DbTrade, (tp || []) as DbTradePlayer[]), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTrades((prev) =>
            prev.map((t) =>
              t.id === payload.new.id
                ? { ...t, status: (payload.new as DbTrade).status as Trade['status'] }
                : t
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
      if (!currentLeagueId) {
        console.error('Error proposing trade: no league selected');
        return false;
      }
      const { data, error } = await supabase.from('trades').insert({
        proposer_id: proposerId,
        target_id: targetId,
        league_id: currentLeagueId,
        status: 'pending',
      }).select('id').single();

      if (error || !data) {
        console.error('Error proposing trade:', error);
        return false;
      }

      // Insert trade players into junction table
      const tradePlayerRecords = [
        ...proposerPlayers.map(pid => ({ trade_id: data.id, player_id: pid, side: 'proposer' })),
        ...targetPlayers.map(pid => ({ trade_id: data.id, player_id: pid, side: 'target' })),
      ];

      if (tradePlayerRecords.length > 0) {
        const { error: tpError } = await supabase.from('trade_players').insert(tradePlayerRecords);
        if (tpError) {
          console.error('Error inserting trade players:', tpError);
        }
      }

      // Don't log proposed trades - only log accepted trades in Activity
      return true;
    },
    [currentLeagueId]
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
      description: `${target?.teamName} rejected trade proposal from ${proposer?.teamName}`,
    });

    return true;
  }, [trades, managers]);

  const counterTrade = useCallback(
    async (originalTradeId: string, proposerId: string, targetId: string, proposerPlayers: string[], targetPlayers: string[]) => {
      if (!currentLeagueId) {
        console.error('Error creating counter trade: no league selected');
        return false;
      }

      // Mark original trade as countered
      await supabase.from('trades').update({ status: 'countered' }).eq('id', originalTradeId);

      // Create new counter trade
      const { data, error } = await supabase.from('trades').insert({
        proposer_id: proposerId,
        target_id: targetId,
        league_id: currentLeagueId,
        status: 'pending',
        parent_trade_id: originalTradeId,
      }).select('id').single();

      if (error || !data) {
        console.error('Error creating counter trade:', error);
        return false;
      }

      // Insert trade players into junction table
      const tradePlayerRecords = [
        ...proposerPlayers.map(pid => ({ trade_id: data.id, player_id: pid, side: 'proposer' })),
        ...targetPlayers.map(pid => ({ trade_id: data.id, player_id: pid, side: 'target' })),
      ];

      if (tradePlayerRecords.length > 0) {
        await supabase.from('trade_players').insert(tradePlayerRecords);
      }

      // Log the counter
      const proposer = managers.find((m) => m.id === proposerId);
      const target = managers.find((m) => m.id === targetId);
      const proposerPlayerNames = proposerPlayers.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
      const targetPlayerNames = targetPlayers.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(', ');

      await supabase.from('transactions').insert({
        type: 'trade',
        manager_id: proposerId,
        description: `${proposer?.teamName} countered trade to ${target?.teamName}: ${proposerPlayerNames} for ${targetPlayerNames}`,
      });

      return true;
    },
    [currentLeagueId, managers, players]
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
