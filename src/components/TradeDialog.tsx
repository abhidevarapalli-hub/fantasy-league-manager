import { useState, useMemo } from 'react';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useGame } from '@/contexts/GameContext';
import { Player, Manager } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposerManager: Manager | null;
  targetManager: Manager | null;
  initialTargetPlayer?: Player;
  onSubmit: (proposerPlayers: string[], targetPlayers: string[]) => Promise<void>;
  mode?: 'propose' | 'counter';
}

const teamCardColors: Record<string, string> = {
  SRH: 'bg-[#FF822A]/60 border-[#FF822A]',
  CSK: 'bg-[#FFCB05]/60 border-[#FFCB05]',
  KKR: 'bg-[#3A225D]/60 border-[#3A225D]',
  RR: 'bg-[#EB71A6]/60 border-[#EB71A6]',
  RCB: 'bg-[#800000]/60 border-[#800000]',
  MI: 'bg-[#004B91]/60 border-[#004B91]',
  GT: 'bg-[#1B223D]/60 border-[#1B223D]',
  LSG: 'bg-[#2ABFCB]/60 border-[#2ABFCB]',
  PBKS: 'bg-[#B71E24]/60 border-[#B71E24]',
  DC: 'bg-[#000080]/60 border-[#000080]',
};

export const TradeDialog = ({
  open,
  onOpenChange,
  proposerManager,
  targetManager,
  initialTargetPlayer,
  onSubmit,
  mode = 'propose',
}: TradeDialogProps) => {
  const { players } = useGame();
  const [selectedProposerPlayers, setSelectedProposerPlayers] = useState<Set<string>>(new Set());
  const [selectedTargetPlayers, setSelectedTargetPlayers] = useState<Set<string>>(
    initialTargetPlayer ? new Set([initialTargetPlayer.id]) : new Set()
  );
  const [submitting, setSubmitting] = useState(false);

  // Get players for each manager
  const proposerPlayers = useMemo(() => {
    if (!proposerManager) return [];
    const allPlayerIds = [...proposerManager.activeRoster, ...proposerManager.bench];
    return allPlayerIds.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  }, [proposerManager, players]);

  const targetPlayers = useMemo(() => {
    if (!targetManager) return [];
    const allPlayerIds = [...targetManager.activeRoster, ...targetManager.bench];
    return allPlayerIds.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  }, [targetManager, players]);

  const toggleProposerPlayer = (playerId: string) => {
    setSelectedProposerPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const toggleTargetPlayer = (playerId: string) => {
    setSelectedTargetPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedProposerPlayers.size === 0 || selectedTargetPlayers.size === 0) return;
    setSubmitting(true);
    await onSubmit(Array.from(selectedProposerPlayers), Array.from(selectedTargetPlayers));
    setSubmitting(false);
    setSelectedProposerPlayers(new Set());
    setSelectedTargetPlayers(new Set());
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedProposerPlayers(new Set());
    setSelectedTargetPlayers(initialTargetPlayer ? new Set([initialTargetPlayer.id]) : new Set());
    onOpenChange(false);
  };

  if (!proposerManager || !targetManager) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowLeftRight className="w-5 h-5 text-secondary" />
            {mode === 'propose' ? 'Propose Trade' : 'Counter Trade'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Two-column layout for the rosters */}
          <div className="grid grid-cols-2 gap-0 h-full">
            {/* Proposer's roster */}
            <div className="border-r border-border">
              <div className="p-3 bg-muted/50 border-b border-border">
                <p className="font-semibold text-sm text-center">{proposerManager.teamName}</p>
                <p className="text-xs text-muted-foreground text-center">Your players</p>
              </div>
              <ScrollArea className="h-[45vh]">
                <div className="p-2 space-y-1">
                  {proposerPlayers.map((player) => (
                    <TradePlayerCard
                      key={player.id}
                      player={player}
                      selected={selectedProposerPlayers.has(player.id)}
                      onToggle={() => toggleProposerPlayer(player.id)}
                      direction="out"
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Target's roster */}
            <div>
              <div className="p-3 bg-muted/50 border-b border-border">
                <p className="font-semibold text-sm text-center">{targetManager.teamName}</p>
                <p className="text-xs text-muted-foreground text-center">Their players</p>
              </div>
              <ScrollArea className="h-[45vh]">
                <div className="p-2 space-y-1">
                  {targetPlayers.map((player) => (
                    <TradePlayerCard
                      key={player.id}
                      player={player}
                      selected={selectedTargetPlayers.has(player.id)}
                      onToggle={() => toggleTargetPlayer(player.id)}
                      direction="in"
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Footer with summary and submit */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground">
              <span className="text-secondary font-medium">{selectedProposerPlayers.size}</span> player(s) out
            </div>
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">{selectedTargetPlayers.size}</span> player(s) in
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={selectedProposerPlayers.size === 0 || selectedTargetPlayers.size === 0 || submitting}
            >
              <Check className="w-4 h-4 mr-2" />
              {mode === 'propose' ? 'Send Trade' : 'Send Counter'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TradePlayerCardProps {
  player: Player;
  selected: boolean;
  onToggle: () => void;
  direction: 'in' | 'out';
}

const TradePlayerCard = ({ player, selected, onToggle, direction }: TradePlayerCardProps) => {
  const isDarkTeam = ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team);

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
        teamCardColors[player.team] || 'bg-card border-border',
        selected && direction === 'out' && 'ring-2 ring-secondary',
        selected && direction === 'in' && 'ring-2 ring-primary'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isDarkTeam ? 'text-white' : 'text-black')}>
          {player.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {player.team}
          </Badge>
          <span className={cn('text-[10px]', isDarkTeam ? 'text-white/70' : 'text-black/70')}>
            {player.role}
          </span>
        </div>
      </div>
      <div
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selected
            ? direction === 'out'
              ? 'bg-secondary border-secondary'
              : 'bg-primary border-primary'
            : 'border-muted-foreground/50'
        )}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>
    </button>
  );
};
