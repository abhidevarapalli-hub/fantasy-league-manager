import { useState, useMemo } from 'react';
import { ArrowLeftRight, Inbox, Send, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTrades } from '@/hooks/useTrades';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradeDialog } from '@/components/TradeDialog';
import { Trade } from '@/lib/trade-types';
import { cn } from '@/lib/utils';

const Trades = () => {
  const { managers, players, isLeagueManager, loading: gameLoading } = useGame();
  const { managerProfile } = useAuth();

  const {
    trades,
    loading,
    acceptTrade,
    rejectTrade,
    counterTrade,
    cancelTrade,
    getIncomingTrades,
    getOutgoingTrades,
  } = useTrades();

  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [processingTradeId, setProcessingTradeId] = useState<string | null>(null);

  // Current user's manager
  const currentManager = useMemo(() => {
    if (!managerProfile) return null;
    return managers.find((m) => m.id === managerProfile.id) || null;
  }, [managerProfile, managers]);

  const incomingTrades = useMemo(() => {
    if (!currentManager) return [];
    return getIncomingTrades(currentManager.id);
  }, [currentManager, getIncomingTrades]);

  const outgoingTrades = useMemo(() => {
    if (!currentManager) return [];
    return getOutgoingTrades(currentManager.id);
  }, [currentManager, getOutgoingTrades]);

  const completedTrades = useMemo(() => {
    return trades.filter((t) => t.status !== 'pending');
  }, [trades]);

  const handleAccept = async (tradeId: string) => {
    setProcessingTradeId(tradeId);
    await acceptTrade(tradeId);
    setProcessingTradeId(null);
  };

  const handleReject = async (tradeId: string) => {
    setProcessingTradeId(tradeId);
    await rejectTrade(tradeId);
    setProcessingTradeId(null);
  };

  const handleCounter = (trade: Trade) => {
    setSelectedTrade(trade);
    setCounterDialogOpen(true);
  };

  const handleCounterSubmit = async (proposerPlayers: string[], targetPlayers: string[]) => {
    if (!selectedTrade || !currentManager) return;
    await counterTrade(
      selectedTrade.id,
      currentManager.id,
      selectedTrade.proposerId,
      proposerPlayers,
      targetPlayers
    );
    setSelectedTrade(null);
  };

  const handleCancel = async (tradeId: string) => {
    setProcessingTradeId(tradeId);
    await cancelTrade(tradeId);
    setProcessingTradeId(null);
  };

  const getManagerName = (managerId: string) => {
    return managers.find((m) => m.id === managerId)?.teamName || 'Unknown';
  };

  const getPlayerNames = (playerIds: string[]) => {
    return playerIds
      .map((id) => players.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout title="Trades">
      <div className="px-4 py-4">
        {!currentManager ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Please log in to view trades</p>
          </div>
        ) : (
          <Tabs defaultValue="incoming" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="incoming" className="flex items-center gap-1.5">
                <Inbox className="w-4 h-4" />
                <span className="hidden sm:inline">Inbox</span>
                {incomingTrades.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {incomingTrades.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Sent</span>
                {outgoingTrades.length > 0 && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5">
                    {outgoingTrades.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="incoming" className="space-y-3">
              {incomingTrades.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No incoming trade requests</p>
                </div>
              ) : (
                incomingTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    currentManagerId={currentManager.id}
                    getManagerName={getManagerName}
                    getPlayerNames={getPlayerNames}
                    type="incoming"
                    onAccept={() => handleAccept(trade.id)}
                    onReject={() => handleReject(trade.id)}
                    onCounter={() => handleCounter(trade)}
                    processing={processingTradeId === trade.id}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="outgoing" className="space-y-3">
              {outgoingTrades.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No outgoing trade requests</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the trade icon on a player in the Players tab
                  </p>
                </div>
              ) : (
                outgoingTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    currentManagerId={currentManager.id}
                    getManagerName={getManagerName}
                    getPlayerNames={getPlayerNames}
                    type="outgoing"
                    onCancel={() => handleCancel(trade.id)}
                    processing={processingTradeId === trade.id}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {completedTrades.length === 0 ? (
                <div className="text-center py-12">
                  <RotateCcw className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No trade history yet</p>
                </div>
              ) : (
                completedTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    currentManagerId={currentManager.id}
                    getManagerName={getManagerName}
                    getPlayerNames={getPlayerNames}
                    type="history"
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {selectedTrade && currentManager && (
        <TradeDialog
          open={counterDialogOpen}
          onOpenChange={setCounterDialogOpen}
          proposerManager={currentManager}
          targetManager={managers.find((m) => m.id === selectedTrade.proposerId) || null}
          onSubmit={handleCounterSubmit}
          mode="counter"
        />
      )}
    </AppLayout>
  );
};

interface TradeCardProps {
  trade: Trade;
  currentManagerId: string;
  getManagerName: (id: string) => string;
  getPlayerNames: (ids: string[]) => string;
  type: 'incoming' | 'outgoing' | 'history';
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  onCancel?: () => void;
  processing?: boolean;
}

const TradeCard = ({
  trade,
  currentManagerId,
  getManagerName,
  getPlayerNames,
  type,
  onAccept,
  onReject,
  onCounter,
  onCancel,
  processing,
}: TradeCardProps) => {
  const isIncoming = type === 'incoming';
  const isOutgoing = type === 'outgoing';

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accepted: 'bg-success/20 text-success border-success/30',
    rejected: 'bg-destructive/20 text-destructive border-destructive/30',
    countered: 'bg-secondary/20 text-secondary border-secondary/30',
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {isIncoming ? getManagerName(trade.proposerId) : 'You'}
            </span>
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">
              {isIncoming ? 'You' : getManagerName(trade.targetId)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(trade.createdAt).toLocaleDateString()} at{' '}
            {new Date(trade.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Badge variant="outline" className={cn('text-xs', statusColors[trade.status])}>
          {trade.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
            {isIncoming ? 'You receive' : 'You send'}
          </p>
          <p className="text-xs font-medium">
            {isIncoming ? getPlayerNames(trade.proposerPlayers) : getPlayerNames(trade.proposerPlayers)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
            {isIncoming ? 'You send' : 'You receive'}
          </p>
          <p className="text-xs font-medium">
            {isIncoming ? getPlayerNames(trade.targetPlayers) : getPlayerNames(trade.targetPlayers)}
          </p>
        </div>
      </div>

      {type === 'incoming' && trade.status === 'pending' && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onReject}
            disabled={processing}
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onCounter}
            disabled={processing}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Counter
          </Button>
          <Button size="sm" className="flex-1" onClick={onAccept} disabled={processing}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Accept
          </Button>
        </div>
      )}

      {type === 'outgoing' && trade.status === 'pending' && (
        <Button variant="outline" size="sm" className="w-full" onClick={onCancel} disabled={processing}>
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
          Cancel Trade
        </Button>
      )}
    </Card>
  );
};

export default Trades;
