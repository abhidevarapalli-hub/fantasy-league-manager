import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { Player, Manager } from '@/lib/supabase-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DraftPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: number;
  position: number;
  manager: Manager | null;
  draftedPlayerIds: string[];
  currentPlayerId: string | null;
  onConfirm: (playerId: string) => void;
}

const teamColors: Record<string, string> = {
  SRH: 'bg-[#FF822A]/20 border-[#FF822A] text-[#FF822A]',
  CSK: 'bg-[#FFCB05]/20 border-[#FFCB05] text-[#FFCB05]',
  KKR: 'bg-[#3A225D]/20 border-[#3A225D] text-[#a855f7]',
  RR: 'bg-[#EB71A6]/20 border-[#EB71A6] text-[#EB71A6]',
  RCB: 'bg-[#800000]/20 border-[#800000] text-[#dc2626]',
  MI: 'bg-[#004B91]/20 border-[#004B91] text-[#3b82f6]',
  GT: 'bg-[#1B223D]/20 border-[#1B223D] text-[#06b6d4]',
  LSG: 'bg-[#2ABFCB]/20 border-[#2ABFCB] text-[#2ABFCB]',
  PBKS: 'bg-[#B71E24]/20 border-[#B71E24] text-[#ef4444]',
  DC: 'bg-[#000080]/20 border-[#000080] text-[#6366f1]',
};

const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
};

export const DraftPickDialog = ({
  open,
  onOpenChange,
  round,
  position,
  manager,
  draftedPlayerIds,
  currentPlayerId,
  onConfirm,
}: DraftPickDialogProps) => {
  const { players } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlayerId(currentPlayerId || '');
    }
  }, [open, currentPlayerId]);

  // Get available players (not drafted)
  const availablePlayers = useMemo(() => {
    return players.filter(p => {
      // Include current player if editing
      if (p.id === currentPlayerId) return true;
      // Exclude already drafted players
      return !draftedPlayerIds.includes(p.id);
    });
  }, [players, draftedPlayerIds, currentPlayerId]);

  // Group players by team
  const playersByTeam = useMemo(() => {
    const grouped = new Map<string, Player[]>();
    for (const player of availablePlayers) {
      const existing = grouped.get(player.team) || [];
      grouped.set(player.team, [...existing, player]);
    }
    // Sort teams alphabetically
    return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [availablePlayers]);

  const selectedPlayer = useMemo(() => {
    return players.find(p => p.id === selectedPlayerId) || null;
  }, [players, selectedPlayerId]);

  const handleConfirm = () => {
    if (selectedPlayerId) {
      onConfirm(selectedPlayerId);
      onOpenChange(false);
    }
  };

  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Draft Pick - Round {round}, Pick {position}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 flex-1 overflow-hidden flex flex-col">
          {/* Manager (read-only) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Manager
            </label>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex-1">
                <p className="font-medium text-foreground">{manager.teamName}</p>
                <p className="text-xs text-muted-foreground">{manager.name}</p>
              </div>
            </div>
          </div>

          {/* Player Selection - Scrollable List */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Select Player ({availablePlayers.length} available)
            </label>
            
            <ScrollArea className="flex-1 border border-border rounded-lg">
              <div className="p-2 space-y-3">
                {[...playersByTeam.entries()].map(([team, teamPlayers]) => (
                  <div key={team} className="space-y-1">
                    <div className="sticky top-0 bg-card/95 backdrop-blur px-2 py-1 z-10">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold border",
                          teamColors[team] || 'bg-muted text-muted-foreground'
                        )}
                      >
                        {team} ({teamPlayers.length})
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {teamPlayers.map(player => (
                        <button
                          key={player.id}
                          onClick={() => setSelectedPlayerId(player.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-md border transition-all text-left",
                            selectedPlayerId === player.id
                              ? "bg-primary/10 border-primary"
                              : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {player.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {roleAbbreviations[player.role] || player.role}
                            </p>
                          </div>
                          {selectedPlayerId === player.id && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Selected Player Preview */}
          {selectedPlayer && (
            <div className="space-y-2 flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Selected Player
              </label>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{selectedPlayer.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] border",
                        teamColors[selectedPlayer.team] || 'bg-muted text-muted-foreground'
                      )}
                    >
                      {selectedPlayer.team}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {roleAbbreviations[selectedPlayer.role] || selectedPlayer.role}
                    </span>
                  </div>
                </div>
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 flex-shrink-0">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              disabled={!selectedPlayerId}
              onClick={handleConfirm}
            >
              Confirm Pick
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};