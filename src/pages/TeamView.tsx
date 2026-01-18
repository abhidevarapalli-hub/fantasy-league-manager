import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X, Filter, Users, UserMinus, AlertCircle, Plane, ArrowLeftRight } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RosterManagementDialog } from '@/components/RosterManagementDialog';
import { 
  ACTIVE_ROSTER_SIZE, 
  BENCH_SIZE,
  MAX_INTERNATIONAL_PLAYERS,
  getActiveRosterSlots,
  validateActiveRoster,
  sortPlayersByRole,
  canSwapInActive,
} from '@/lib/roster-validation';
import { Player } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { sortPlayersByPriority } from '@/lib/player-order';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const roleIcons: Record<string, string> = {
  'Wicket Keeper': '🧤',
  'Batsman': '🏏',
  'All Rounder': '⚡',
  'Bowler': '🎯',
  'WK/BAT': '🏏',
  'AR/BWL': '⚡',
};

const TeamView = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { managers, players, moveToActive, moveToBench, dropPlayerOnly, swapPlayers } = useGame();
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedNationality, setSelectedNationality] = useState('All');
  const [showOnlyFreeAgents, setShowOnlyFreeAgents] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  
  // Swap states
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<{ player: Player; from: 'active' | 'bench' } | null>(null);
  
  const manager = managers.find(m => m.id === teamId);
  
  if (!manager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Team not found</p>
      </div>
    );
  }

  const activePlayers = manager.activeRoster
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);
  const benchPlayers = manager.bench
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);
  const totalPlayers = activePlayers.length + benchPlayers.length;

  // Build a map of player ID -> manager team name
  const playerToManagerMap = useMemo(() => {
    const map: Record<string, string> = {};
    managers.forEach(m => {
      [...m.activeRoster, ...m.bench].forEach(playerId => {
        map[playerId] = m.teamName;
      });
    });
    return map;
  }, [managers]);

  // Filter players for the pool section
  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           player.team.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = selectedTeam === 'All' || player.team === selectedTeam;
      const matchesRole = selectedRole === 'All' || player.role === selectedRole;
      const matchesNationality = selectedNationality === 'All' || 
                                 (selectedNationality === 'International' && player.isInternational) ||
                                 (selectedNationality === 'Domestic' && !player.isInternational);
      const isRostered = playerToManagerMap[player.id];
      const matchesFreeAgentFilter = !showOnlyFreeAgents || !isRostered;
      return matchesSearch && matchesTeam && matchesRole && matchesNationality && matchesFreeAgentFilter;
    });
    
    return sortPlayersByPriority(filtered);
  }, [players, searchQuery, selectedTeam, selectedRole, selectedNationality, playerToManagerMap, showOnlyFreeAgents]);

  const validation = validateActiveRoster(activePlayers);
  const slots = getActiveRosterSlots(activePlayers);
  const internationalCount = activePlayers.filter(p => p.isInternational).length;
  const sortedBench = sortPlayersByRole(benchPlayers);

  const handleAddPlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      setSelectedPlayer(player);
      setDialogOpen(true);
    }
  };

  const handleMoveToActive = async (playerId: string) => {
    const result = await moveToActive(teamId!, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Player moved to active roster');
    }
  };

  const handleMoveToBench = async (playerId: string) => {
    const result = await moveToBench(teamId!, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Player moved to bench');
    }
  };

  const handleStartSwap = (player: Player, from: 'active' | 'bench') => {
    setPlayerToSwap({ player, from });
    setSwapDialogOpen(true);
  };

  const handleSwap = async (targetPlayer: Player) => {
    if (!playerToSwap || !teamId) return;
    
    if (playerToSwap.from === 'bench') {
      const swapValidation = canSwapInActive(activePlayers, playerToSwap.player, targetPlayer);
      if (!swapValidation.isValid) {
        toast.error(swapValidation.errors[0] || 'Invalid swap');
        return;
      }
    }
    
    const result = await swapPlayers(teamId, playerToSwap.player.id, targetPlayer.id);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Players swapped successfully');
    }
    
    setSwapDialogOpen(false);
    setPlayerToSwap(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{manager.teamName}</h1>
            <p className="text-xs text-muted-foreground">
              {manager.name} • {manager.wins}W - {manager.losses}L • {totalPlayers}/{ACTIVE_ROSTER_SIZE + BENCH_SIZE} players
            </p>
          </div>
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            internationalCount > MAX_INTERNATIONAL_PLAYERS 
              ? "bg-destructive/20 text-destructive" 
              : "bg-primary/20 text-primary"
          )}>
            <Plane className="w-3 h-3" />
            {internationalCount}/{MAX_INTERNATIONAL_PLAYERS}
          </div>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-muted border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Free Agent Filter */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowOnlyFreeAgents(!showOnlyFreeAgents)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              showOnlyFreeAgents
                ? "bg-secondary/20 text-secondary border-secondary/30"
                : "bg-muted/50 text-muted-foreground border-border hover:border-secondary/30"
            )}
          >
            <Filter className="w-3 h-3" />
            {showOnlyFreeAgents ? 'Showing Free Agents Only' : 'Show Free Agents Only'}
          </button>
        </div>
        
        {/* Team Filter Pills */}
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Team</p>
          <div className="flex gap-2">
            {IPL_TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
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
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Position</p>
          <div className="flex gap-2">
            {PLAYER_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                  selectedRole === role 
                    ? roleFilterColors[role] 
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Nationality Filter Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Nationality</p>
          <div className="flex gap-2">
            {NATIONALITY_FILTERS.map((nationality) => (
              <button
                key={nationality}
                onClick={() => setSelectedNationality(nationality)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
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
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-success">{manager.wins}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{manager.losses}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{manager.points}</p>
            <p className="text-xs text-muted-foreground">Points</p>
          </div>
        </div>

        {/* Validation Errors */}
        {!validation.isValid && validation.errors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Roster Requirements Not Met</p>
                <ul className="text-xs text-destructive/80 space-y-0.5">
                  {validation.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Active 11 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Active 11</h2>
              <p className="text-xs text-muted-foreground">Starting lineup ({activePlayers.length}/{ACTIVE_ROSTER_SIZE})</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {slots.map((slot, index) => (
              slot.filled && slot.player ? (
                <PlayerCard
                  key={slot.player.id}
                  player={slot.player}
                  isOwned
                  onSwap={benchPlayers.length > 0 ? () => handleStartSwap(slot.player!, 'active') : undefined}
                  onMoveDown={benchPlayers.length < BENCH_SIZE ? () => handleMoveToBench(slot.player!.id) : undefined}
                  onDrop={() => dropPlayerOnly(teamId!, slot.player!.id)}
                />
              ) : (
                <div 
                  key={`empty-${index}`}
                  className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                    {roleIcons[slot.role] || '👤'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Empty Slot</p>
                    <p className="text-xs text-muted-foreground/70">{slot.label} required</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {slot.label}
                  </Badge>
                </div>
              )
            ))}
          </div>
        </section>

        {/* Bench */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <UserMinus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Bench</h2>
              <p className="text-xs text-muted-foreground">Reserve players ({benchPlayers.length}/{BENCH_SIZE})</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {sortedBench.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                isOwned
                onSwap={activePlayers.length > 0 ? () => handleStartSwap(player, 'bench') : undefined}
                onMoveUp={activePlayers.length < ACTIVE_ROSTER_SIZE ? () => handleMoveToActive(player.id) : undefined}
                onDrop={() => dropPlayerOnly(teamId!, player.id)}
              />
            ))}
            
            {/* Empty bench slots */}
            {Array.from({ length: BENCH_SIZE - benchPlayers.length }).map((_, index) => (
              <div 
                key={`empty-bench-${index}`}
                className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                  👤
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Empty Bench Slot</p>
                  <p className="text-xs text-muted-foreground/70">Any position</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Reserve
                </Badge>
              </div>
            ))}
          </div>
        </section>

        {/* Player Pool */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Player Pool</h2>
            <span className="text-xs text-muted-foreground">{filteredPlayers.length} players</span>
          </div>
          
          <div className="space-y-2">
            {filteredPlayers.map(player => {
              const rosteredBy = playerToManagerMap[player.id];
              const isOnThisTeam = rosteredBy === manager.teamName;
              
              return (
                <div key={player.id} className="relative">
                  <PlayerCard
                    player={player}
                    isOwned={false}
                    showActions={!rosteredBy}
                    onAdd={!rosteredBy ? () => handleAddPlayer(player.id) : undefined}
                  />
                  {rosteredBy && (
                    <div className="absolute top-2 right-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]",
                          isOnThisTeam 
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-muted/80 text-muted-foreground border-border"
                        )}
                      >
                        {isOnThisTeam ? 'On Roster' : rosteredBy}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredPlayers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No players found</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={(open) => {
        setSwapDialogOpen(open);
        if (!open) setPlayerToSwap(null);
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" />
              Swap {playerToSwap?.player.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Select a player from {playerToSwap?.from === 'active' ? 'bench' : 'active roster'} to swap with:
            </p>
            {playerToSwap && (
              (playerToSwap.from === 'active' ? sortedBench : sortPlayersByRole(activePlayers)).map(player => {
                const isValidSwap = playerToSwap.from === 'bench' 
                  ? canSwapInActive(activePlayers, playerToSwap.player, player).isValid
                  : true;
                
                return (
                  <button
                    key={player.id}
                    onClick={() => isValidSwap && handleSwap(player)}
                    disabled={!isValidSwap}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      isValidSwap 
                        ? "border-border hover:border-primary bg-card" 
                        : "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                        {roleIcons[player.role] || '👤'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.team} • {player.role}</p>
                      </div>
                      {player.isInternational && (
                        <Plane className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
      
      <RosterManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        player={selectedPlayer}
        preselectedManagerId={teamId}
      />
    </div>
  );
};

export default TeamView;
