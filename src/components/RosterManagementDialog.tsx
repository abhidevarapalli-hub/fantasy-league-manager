import { useState, useMemo, useEffect } from 'react';
import { UserPlus, UserMinus, ArrowRight, AlertTriangle } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { Player } from '@/lib/supabase-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface RosterManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  preselectedManagerId?: string;
}

const teamBadgeColors: Record<string, string> = {
  CSK: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  MI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RCB: 'bg-red-500/20 text-red-400 border-red-500/30',
  KKR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DC: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  RR: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  PBKS: 'bg-red-600/20 text-red-300 border-red-600/30',
  SRH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  GT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  LSG: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export const RosterManagementDialog = ({ open, onOpenChange, player, preselectedManagerId }: RosterManagementDialogProps) => {
  const { managers, players, addFreeAgent, getManagerRosterCount } = useGame();
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [dropPlayerId, setDropPlayerId] = useState<string>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog opens/closes or player changes
  useEffect(() => {
    if (open) {
      setSelectedManagerId(preselectedManagerId || '');
      setDropPlayerId('none');
    }
  }, [open, player?.id, preselectedManagerId]);

  const selectedManager = useMemo(() => {
    return managers.find(m => m.id === selectedManagerId);
  }, [managers, selectedManagerId]);

  const rosterCount = useMemo(() => {
    if (!selectedManager) return 0;
    return getManagerRosterCount(selectedManager.id);
  }, [selectedManager, getManagerRosterCount]);

  const isAtCap = rosterCount >= 14;
  const mustDrop = isAtCap;

  // Get players on selected manager's roster for drop options
  const managerPlayers = useMemo(() => {
    if (!selectedManager) return [];
    const allPlayerIds = [...selectedManager.activeRoster, ...selectedManager.bench];
    return players.filter(p => allPlayerIds.includes(p.id));
  }, [selectedManager, players]);

  const canSubmit = useMemo(() => {
    if (!selectedManagerId || !player) return false;
    if (mustDrop && dropPlayerId === 'none') return false;
    return true;
  }, [selectedManagerId, player, mustDrop, dropPlayerId]);

  const handleSubmit = async () => {
    if (!player || !selectedManagerId) return;
    
    setIsSubmitting(true);
    try {
      const dropPlayer = dropPlayerId !== 'none' ? dropPlayerId : undefined;
      await addFreeAgent(selectedManagerId, player.id, dropPlayer);
      
      const manager = managers.find(m => m.id === selectedManagerId);
      const droppedPlayer = dropPlayer ? players.find(p => p.id === dropPlayer) : null;
      
      if (droppedPlayer) {
        toast.success(`Added ${player.name} and dropped ${droppedPlayer.name} for ${manager?.teamName}`);
      } else {
        toast.success(`Added ${player.name} to ${manager?.teamName}`);
      }
      
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to complete transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Player to Roster
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Selected Player (read-only) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Player to Add
            </label>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex-1">
                <p className="font-medium text-foreground">{player.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] ${teamBadgeColors[player.team] || 'bg-muted text-muted-foreground'}`}
                  >
                    {player.team}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{player.role}</span>
                </div>
              </div>
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
          </div>

          {/* Manager Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Select Manager
            </label>
            {preselectedManagerId ? (
              // Locked manager display for non-league managers
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {managers.find(m => m.id === preselectedManagerId)?.teamName}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    ({rosterCount}/14 players)
                  </span>
                </div>
              </div>
            ) : (
              // Dropdown for league managers
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Choose a manager..." />
                </SelectTrigger>
                <SelectContent>
                  {managers.map(manager => {
                    const count = getManagerRosterCount(manager.id);
                    return (
                      <SelectItem key={manager.id} value={manager.id}>
                        <span className="flex items-center gap-2">
                          {manager.teamName}
                          <span className="text-muted-foreground text-xs">
                            ({count}/14)
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Drop Player Section - Only shows after manager is selected */}
          {selectedManager && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {mustDrop ? 'Drop Player (Required)' : 'Drop Player (Optional)'}
                </label>
                <span className="text-xs text-muted-foreground">
                  {rosterCount}/14 players
                </span>
              </div>
              
              {mustDrop && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-xs text-destructive">
                    Roster is full. You must drop a player.
                  </p>
                </div>
              )}

              <Select value={dropPlayerId} onValueChange={setDropPlayerId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder={mustDrop ? "Select player to drop..." : "None (Add only)"} />
                </SelectTrigger>
                <SelectContent>
                  {!mustDrop && (
                    <SelectItem value="none">None (Add only)</SelectItem>
                  )}
                  {managerPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.name}
                        <span className="text-muted-foreground text-xs">
                          {p.team} • {p.role}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transaction Summary */}
          {selectedManager && canSubmit && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs font-medium text-primary mb-2">Transaction Summary</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground">{player.name}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{selectedManager.teamName}</span>
              </div>
              {dropPlayerId !== 'none' && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <UserMinus className="w-3 h-3 text-destructive" />
                  <span className="text-muted-foreground">
                    Dropping: {players.find(p => p.id === dropPlayerId)?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              disabled={!canSubmit || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
