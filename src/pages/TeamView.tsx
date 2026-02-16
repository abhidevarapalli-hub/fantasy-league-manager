import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserMinus, AlertCircle, Plane, ArrowLeftRight, Trophy, Lock } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { PlayerCard } from '@/components/PlayerCard';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import {
  getActiveRosterSlots,
  validateActiveRoster,
  sortPlayersByRole,
  canSwapInActive,
} from '@/lib/roster-validation';

import { Player } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const TeamView = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();

  // Zustand selectors
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const moveToActive = useGameStore(state => state.moveToActive);
  const moveToBench = useGameStore(state => state.moveToBench);
  const dropPlayerOnly = useGameStore(state => state.dropPlayerOnly);
  const swapPlayers = useGameStore(state => state.swapPlayers);
  const canEditTeam = useAuthStore(state => state.canEditTeam);

  // Swap states
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<{ player: Player; from: 'active' | 'bench' } | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  const manager = managers.find(m => m.id === teamId);

  // Check if current user can edit this team
  const canEdit = canEditTeam(teamId || '');

  // Calculate standings position
  const standingsPosition = useMemo(() => {
    if (!manager) return 0;
    const sortedManagers = [...managers].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.points - a.points;
    });
    return sortedManagers.findIndex(m => m.id === manager.id) + 1;
  }, [managers, manager]);

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

  // Calculate max bench size based on active roster
  const maxBenchSize = config.benchSize;
  const totalRosterCap = config.activeSize + config.benchSize;

  const validation = validateActiveRoster(activePlayers, config);
  const slots = getActiveRosterSlots(activePlayers, config);
  const internationalCount = activePlayers.filter(p => p.isInternational).length;
  const sortedBench = sortPlayersByRole(benchPlayers);


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

    // Validate the swap - determine which player is going TO active
    let swapValidation;
    if (playerToSwap.from === 'bench') {
      // Bench player going to active, target (active) player leaving
      swapValidation = canSwapInActive(activePlayers, playerToSwap.player, targetPlayer, config);
    } else {
      // Active player going to bench, target (bench) player coming to active
      swapValidation = canSwapInActive(activePlayers, targetPlayer, playerToSwap.player, config);
    }


    if (!swapValidation.isValid) {
      toast.error(swapValidation.errors[0] || 'Invalid swap');
      return;
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
    <AppLayout
      title={manager.teamName}
      subtitle={`${manager.name} • ${totalPlayers}/${totalRosterCap} players`}
      headerActions={
        <>
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            internationalCount > config.maxInternational
              ? "bg-destructive/20 text-destructive"
              : "bg-primary/20 text-primary"
          )}>
            <Plane className="w-3 h-3" />
            {internationalCount}/{config.maxInternational}
          </div>
          {!canEdit && <Lock className="w-4 h-4 text-muted-foreground" />}
        </>
      }
    >

      <div className="px-4 py-4 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {/* Read-only notice */}
        {!canEdit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You can view this team but cannot make changes
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              <p className="text-2xl font-bold text-amber-500">{standingsPosition}</p>
            </div>
            <p className="text-xs text-muted-foreground">Rank</p>
          </div>
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

        {/* Separator */}
        <div className="border-b border-border" />

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
              <p className="text-xs text-muted-foreground">Starting lineup ({activePlayers.length}/{config.activeSize})</p>
            </div>

          </div>

          <div className="space-y-2">
            {slots.map((slot, index) => (
              slot.filled && slot.player ? (
                <PlayerCard
                  key={slot.player.id}
                  player={slot.player}
                  isOwned
                  onSwap={canEdit && benchPlayers.length > 0 ? () => handleStartSwap(slot.player!, 'active') : undefined}
                  onMoveDown={canEdit && benchPlayers.length < maxBenchSize ? () => handleMoveToBench(slot.player!.id) : undefined}
                  onDrop={canEdit ? () => dropPlayerOnly(teamId!, slot.player!.id) : undefined}
                  onClick={() => setDetailPlayer(slot.player!)}
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
          <div className="flex items-center gap-2 mb-3 pt-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <UserMinus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Bench</h2>
              <p className="text-xs text-muted-foreground">Reserves ({benchPlayers.length}/{config.benchSize})</p>
            </div>
          </div>

          <div className="space-y-2">
            {sortedBench.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isOwned
                onSwap={canEdit && activePlayers.length > 0 ? () => handleStartSwap(player, 'bench') : undefined}
                onMoveUp={canEdit && activePlayers.length < config.activeSize ? () => handleMoveToActive(player.id) : undefined}

                onDrop={canEdit ? () => dropPlayerOnly(teamId!, player.id) : undefined}
                onClick={() => setDetailPlayer(player)}
              />
            ))}

            {/* Empty bench slots */}
            {Array.from({ length: Math.max(0, config.benchSize - benchPlayers.length) }).map((_, i) => (
              <div
                key={`bench-empty-${i}`}
                className="p-3 rounded-xl border border-dashed border-border bg-muted/10 flex items-center gap-3 opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                  👤
                </div>
                <p className="text-xs font-medium text-muted-foreground">Empty Bench Slot</p>
              </div>
            ))}
          </div>
        </section>
      </div>

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
                // When swapping from active to bench: check if bringing bench player TO active is valid
                // When swapping from bench to active: check if bringing bench player TO active is valid
                const isValidSwap = playerToSwap.from === 'bench'
                  ? canSwapInActive(activePlayers, playerToSwap.player, player, config).isValid
                  : canSwapInActive(activePlayers, player, playerToSwap.player, config).isValid;


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

      <PlayerDetailDialog
        player={detailPlayer!}
        open={!!detailPlayer}
        onOpenChange={(open) => !open && setDetailPlayer(null)}
      />
    </AppLayout>
  );
};

export default TeamView;
