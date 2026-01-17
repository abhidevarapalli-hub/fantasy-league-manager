import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { Player, Manager } from '@/lib/supabase-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlayerId(currentPlayerId || '');
      setSearchQuery('');
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

  // Filter by search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return availablePlayers;
    const query = searchQuery.toLowerCase();
    return availablePlayers.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.team.toLowerCase().includes(query) ||
      p.role.toLowerCase().includes(query)
    );
  }, [availablePlayers, searchQuery]);

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
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Draft Pick - Round {round}, Pick {position}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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

          {/* Player Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Select Player
            </label>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted border-border"
              />
            </div>

            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Choose a player..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredPlayers.map(player => (
                  <SelectItem key={player.id} value={player.id}>
                    <span className="flex items-center gap-2">
                      {player.name}
                      <span className="text-muted-foreground text-xs">
                        {player.team} • {player.role}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Player Preview */}
          {selectedPlayer && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Selected Player
              </label>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{selectedPlayer.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${teamBadgeColors[selectedPlayer.team] || 'bg-muted text-muted-foreground'}`}
                    >
                      {selectedPlayer.team}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{selectedPlayer.role}</span>
                  </div>
                </div>
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
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
