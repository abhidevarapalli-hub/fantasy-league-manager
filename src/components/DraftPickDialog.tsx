import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Search, X } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { Player, Manager } from '@/lib/supabase-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { PlayerCard } from '@/components/PlayerCard';
import { cn } from '@/lib/utils';
import { sortPlayersByPriority } from '@/lib/player-order';

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

const IPL_TEAMS = ['All', 'CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'PBKS', 'SRH', 'GT', 'LSG'];
const PLAYER_ROLES = ['All', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'];
const NATIONALITY_FILTERS = ['All', 'Domestic', 'International'];

const teamFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  SRH: 'bg-[#FF822A]/20 text-[#FF822A] border-[#FF822A]/30',
  CSK: 'bg-[#FFCB05]/20 text-[#FFCB05] border-[#FFCB05]/30',
  KKR: 'bg-[#3A225D]/20 text-[#3A225D] border-[#3A225D]/30',
  RR: 'bg-[#EB71A6]/20 text-[#EB71A6] border-[#EB71A6]/30',
  RCB: 'bg-[#800000]/20 text-[#800000] border-[#800000]/30',
  MI: 'bg-[#004B91]/20 text-[#004B91] border-[#004B91]/30',
  GT: 'bg-[#1B223D]/20 text-[#1B223D] border-[#1B223D]/30',
  LSG: 'bg-[#2ABFCB]/20 text-[#2ABFCB] border-[#2ABFCB]/30',
  PBKS: 'bg-[#B71E24]/20 text-[#B71E24] border-[#B71E24]/30',
  DC: 'bg-[#000080]/20 text-[#000080] border-[#000080]/30',
};

const roleFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  Batsman: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'All Rounder': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Wicket Keeper': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const nationalityFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  Domestic: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  International: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedNationality, setSelectedNationality] = useState('All');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlayerId(currentPlayerId || '');
      setSearchQuery('');
      setSelectedTeam('All');
      setSelectedRole('All');
      setSelectedNationality('All');
    }
  }, [open, currentPlayerId]);

  // Get available players (not drafted) with filters applied, sorted by priority
  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(p => {
      // Include current player if editing
      const isCurrentPlayer = p.id === currentPlayerId;
      // Exclude already drafted players (unless it's the current player being edited)
      const isAvailable = isCurrentPlayer || !draftedPlayerIds.includes(p.id);
      
      if (!isAvailable) return false;
      
      // Apply search filter
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.team.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Apply team filter
      const matchesTeam = selectedTeam === 'All' || p.team === selectedTeam;
      
      // Apply role filter
      const matchesRole = selectedRole === 'All' || p.role === selectedRole;
      
      // Apply nationality filter
      const matchesNationality = selectedNationality === 'All' || 
                                 (selectedNationality === 'International' && p.isInternational) ||
                                 (selectedNationality === 'Domestic' && !p.isInternational);
      
      return matchesSearch && matchesTeam && matchesRole && matchesNationality;
    });
    
    return sortPlayersByPriority(filtered);
  }, [players, draftedPlayerIds, currentPlayerId, searchQuery, selectedTeam, selectedRole, selectedNationality]);

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

        <div className="space-y-3 pt-2 flex-1 overflow-hidden flex flex-col">
          {/* Manager (read-only) */}
          <div className="space-y-1.5 flex-shrink-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Manager
            </label>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border">
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{manager.teamName}</p>
                <p className="text-xs text-muted-foreground">{manager.name}</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-muted border-border h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Team Filter Pills */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-hide">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Team</p>
            <div className="flex gap-1.5">
              {IPL_TEAMS.map((team) => (
                <button
                  key={team}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded-full border transition-all whitespace-nowrap",
                    selectedTeam === team 
                      ? teamFilterColors[team] 
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {team}
                </button>
              ))}
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-hide">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Position</p>
            <div className="flex gap-1.5">
              {PLAYER_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded-full border transition-all whitespace-nowrap",
                    selectedRole === role 
                      ? roleFilterColors[role] 
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {role === 'All' ? 'All' : roleAbbreviations[role] || role}
                </button>
              ))}
            </div>
          </div>

          {/* Nationality Filter Pills */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-hide">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Nationality</p>
            <div className="flex gap-1.5">
              {NATIONALITY_FILTERS.map((nationality) => (
                <button
                  key={nationality}
                  onClick={() => setSelectedNationality(nationality)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded-full border transition-all whitespace-nowrap",
                    selectedNationality === nationality 
                      ? nationalityFilterColors[nationality] 
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {nationality}
                </button>
              ))}
            </div>
          </div>
          {/* Player Selection - Scrollable List with PlayerCards */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-0 overflow-hidden">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
              Select Player ({filteredPlayers.length} available)
            </label>
            
            <div className="flex-1 overflow-y-auto border border-border rounded-lg p-2 space-y-2 min-h-[200px] max-h-[300px]">
              {filteredPlayers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No players found</p>
                </div>
              ) : (
                filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={cn(
                      "cursor-pointer rounded-xl transition-all",
                      selectedPlayerId === player.id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:opacity-80"
                    )}
                  >
                    <PlayerCard
                      player={player}
                      showActions={false}
                      variant="compact"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Player Preview */}
          {selectedPlayer && (
            <div className="space-y-1.5 flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Selected Player
              </label>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{selectedPlayer.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] border",
                        teamFilterColors[selectedPlayer.team] || 'bg-muted text-muted-foreground'
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
          <div className="flex gap-2 pt-1 flex-shrink-0">
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
