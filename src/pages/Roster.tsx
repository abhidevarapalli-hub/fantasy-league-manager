import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Users, UserMinus, ChevronRight, AlertCircle, Plane, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  getActiveRosterSlots, 
  validateActiveRoster, 
  ACTIVE_ROSTER_SIZE,
  BENCH_SIZE,
  MAX_INTERNATIONAL_PLAYERS,
  sortPlayersByRole,
  canSwapInActive,
} from '@/lib/roster-validation';
import { Player } from '@/lib/supabase-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const roleIcons: Record<string, string> = {
  'Wicket Keeper': '🧤',
  'Batsman': '🏏',
  'All Rounder': '⚡',
  'Bowler': '🎯',
  'WK/BAT': '🏏',
  'AR/BWL': '⚡',
};

const Roster = () => {
  const { managers, players, getManagerRosterCount, moveToActive, moveToBench, dropPlayerOnly, swapPlayers } = useGame();
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<{ player: Player; from: 'active' | 'bench' } | null>(null);
  
  const selectedManager = managers.find(m => m.id === selectedManagerId);
  
  if (!selectedManagerId) {
    // Show team selection menu
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
          <div className="px-4 py-3">
            <h1 className="text-lg font-bold text-foreground">Team Rosters</h1>
            <p className="text-xs text-muted-foreground">Select a team to view roster</p>
          </div>
        </header>

        <main className="px-4 py-4">
          <div className="space-y-2">
            {managers.map(manager => {
              const rosterCount = getManagerRosterCount(manager.id);
              return (
                <button
                  key={manager.id}
                  onClick={() => setSelectedManagerId(manager.id)}
                  className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">
                        {manager.teamName.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">{manager.teamName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {rosterCount}/{ACTIVE_ROSTER_SIZE + BENCH_SIZE} Players
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      rosterCount === 0 
                        ? "bg-muted text-muted-foreground"
                        : rosterCount < ACTIVE_ROSTER_SIZE + BENCH_SIZE 
                          ? "bg-primary/20 text-primary"
                          : "bg-success/20 text-success"
                    )}>
                      {rosterCount === 0 ? 'Empty' : rosterCount === ACTIVE_ROSTER_SIZE + BENCH_SIZE ? 'Full' : `${rosterCount} players`}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        <BottomNav />
      </div>
    );
  }

  if (!selectedManager) return null;

  const activePlayers = selectedManager.activeRoster
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);
  const benchPlayers = selectedManager.bench
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);

  const validation = validateActiveRoster(activePlayers);
  const slots = getActiveRosterSlots(activePlayers);
  const internationalCount = activePlayers.filter(p => p.isInternational).length;
  const sortedBench = sortPlayersByRole(benchPlayers);

  const handleMoveToActive = async (playerId: string) => {
    const result = await moveToActive(selectedManagerId, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Player moved to active roster');
    }
  };

  const handleStartSwap = (player: Player, from: 'active' | 'bench') => {
    setPlayerToSwap({ player, from });
    setSwapDialogOpen(true);
  };

  const handleSwap = async (targetPlayer: Player) => {
    if (!playerToSwap || !selectedManagerId) return;
    
    // Validate the swap if moving to active
    if (playerToSwap.from === 'bench') {
      // Swapping bench player into active - validate
      const validation = canSwapInActive(activePlayers, playerToSwap.player, targetPlayer);
      if (!validation.isValid) {
        toast.error(validation.errors[0] || 'Invalid swap');
        return;
      }
    }
    
    const result = await swapPlayers(selectedManagerId, playerToSwap.player.id, targetPlayer.id);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Players swapped successfully');
    }
    
    setSwapDialogOpen(false);
    setPlayerToSwap(null);
  };

  const handleMoveToBench = async (playerId: string) => {
    const result = await moveToBench(selectedManagerId, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Player moved to bench');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <button 
            onClick={() => setSelectedManagerId(null)}
            className="text-xs text-primary mb-1 hover:underline"
          >
            ← Back to Teams
          </button>
          <h1 className="text-lg font-bold text-foreground">{selectedManager.teamName}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{activePlayers.length}/{ACTIVE_ROSTER_SIZE} Active</span>
            <span>•</span>
            <span>{benchPlayers.length}/{BENCH_SIZE} Bench</span>
            <span>•</span>
            <span className={cn(
              "flex items-center gap-1",
              internationalCount > MAX_INTERNATIONAL_PLAYERS && "text-destructive"
            )}>
              <Plane className="w-3 h-3" />
              {internationalCount}/{MAX_INTERNATIONAL_PLAYERS} Intl
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
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
              <p className="text-xs text-muted-foreground">Starting lineup with positional requirements</p>
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
                  onDrop={() => dropPlayerOnly(selectedManagerId, slot.player!.id)}
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
            {/* Show bench players */}
            {sortedBench.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                isOwned
                onSwap={activePlayers.length > 0 ? () => handleStartSwap(player, 'bench') : undefined}
                onMoveUp={activePlayers.length < ACTIVE_ROSTER_SIZE ? () => handleMoveToActive(player.id) : undefined}
                onDrop={() => dropPlayerOnly(selectedManagerId, player.id)}
              />
            ))}
            
            {/* Show empty bench slots */}
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
                // If swapping from bench to active, check if valid
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
    </div>
  );
};

export default Roster;
