import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserMinus, AlertCircle, Plane, ArrowUpDown, Trophy, Lock, Info, Plus } from 'lucide-react';
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
  canAddToActive,
  SlotRequirement,
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
  const selectedRosterWeek = useGameStore(state => state.selectedRosterWeek);
  const currentWeek = useGameStore(state => state.currentWeek);
  const schedule = useGameStore(state => state.schedule);
  const setCaptain = useGameStore(state => state.setCaptain);
  const setViceCaptain = useGameStore(state => state.setViceCaptain);
  const canEditTeam = useAuthStore(state => state.canEditTeam);

  // Swap states
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<{ player: Player; from: 'active' | 'bench' } | null>(null);
  const [slotToFill, setSlotToFill] = useState<SlotRequirement | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Compute if team is locked (current week is the last week)
  const lastWeek = useMemo(() => {
    const weeks = schedule.map(m => m.week);
    return weeks.length > 0 ? Math.max(...weeks) : 7;
  }, [schedule]);

  const editingWeek = currentWeek + 1;
  const isTeamLocked = currentWeek >= lastWeek;

  const manager = managers.find(m => m.id === teamId);

  // Check if current user can edit this team (also respects team lock)
  const canEditBase = canEditTeam(teamId || '');
  const canEdit = canEditBase && !isTeamLocked;

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

  const handleSetCaptain = async (playerId: string) => {
    if (!teamId) return;
    const result = await setCaptain(teamId, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Captain set successfully');
    }
  };

  const handleSetViceCaptain = async (playerId: string) => {
    if (!teamId) return;
    const result = await setViceCaptain(teamId, playerId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Vice-Captain set successfully');
    }
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

        {/* Week & Lock Indicator */}
        {isTeamLocked ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <Lock className="w-4 h-4 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Team is locked — the season is in its final week (Week {currentWeek})
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="w-4 h-4 text-primary" />
            <p className="text-sm text-primary">
              {currentWeek === 0 ? (
                <>Pre-Season — editing roster for <strong>Week {editingWeek}</strong></>
              ) : (
                <>Editing roster for <strong>Week {editingWeek} onwards</strong> — current week is {currentWeek}</>
              )}
            </p>
          </div>
        )}

        {/* Read-only notice */}
        {!canEdit && !isTeamLocked && (
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
            {[...slots].sort((a, b) => {
              const aC = a.player && manager.captainId === a.player.id ? -2 : a.player && manager.viceCaptainId === a.player.id ? -1 : 0;
              const bC = b.player && manager.captainId === b.player.id ? -2 : b.player && manager.viceCaptainId === b.player.id ? -1 : 0;
              return aC - bC;
            }).map((slot, index) => (
              slot.filled && slot.player ? (
                <PlayerCard
                  key={slot.player.id}
                  player={slot.player}
                  isOwned
                  captainBadge={
                    manager.captainId === slot.player.id ? 'C'
                      : manager.viceCaptainId === slot.player.id ? 'VC'
                        : null
                  }
                  onSetCaptain={canEdit && manager.captainId !== slot.player.id ? () => handleSetCaptain(slot.player!.id) : undefined}
                  onSetViceCaptain={canEdit && manager.viceCaptainId !== slot.player.id ? () => handleSetViceCaptain(slot.player!.id) : undefined}
                  onSwap={canEdit && benchPlayers.length > 0 ? () => handleStartSwap(slot.player!, 'active') : undefined}
                  onClick={() => setDetailPlayer(slot.player!)}
                />
              ) : (
                <button
                  key={`empty-${index}`}
                  onClick={canEdit ? () => setSlotToFill(slot) : undefined}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center gap-3 transition-all text-left",
                    canEdit && "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  )}
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
                </button>
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
              <ArrowUpDown className="w-5 h-5" />
              Swap {playerToSwap?.player.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Select a player from {playerToSwap?.from === 'active' ? 'bench' : 'active roster'} to swap with:
            </p>
            {playerToSwap && (
              <>
                {/* Regular Players */}
                {(playerToSwap.from === 'active' ? sortedBench : sortPlayersByRole(activePlayers)).map(player => {
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
                })}

                {/* Empty Slot Option */}
                {playerToSwap.from === 'active' ? (
                  // Moving to Bench (if bench has space)
                  benchPlayers.length < config.benchSize && (
                    <button
                      onClick={() => {
                        handleMoveToBench(playerToSwap.player.id);
                        setSwapDialogOpen(false);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-dashed border-border hover:border-primary bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm opacity-60">
                          <Plus className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-muted-foreground">
                          <p className="font-medium">Move to Empty Bench Slot</p>
                          <p className="text-[10px]">Bench space: {benchPlayers.length}/{config.benchSize}</p>
                        </div>
                      </div>
                    </button>
                  )
                ) : (
                  // Moving to Active (if active has any empty slots)
                  slots.filter(s => !s.filled).length > 0 && (
                    <div className="pt-2 border-t border-border mt-2">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2 px-1">Move to Empty Active Slot</p>
                      {slots.filter(s => !s.filled).map((slot, i) => {
                        const validation = canAddToActive(activePlayers, playerToSwap.player, config);
                        const isValid = validation.isValid;

                        return (
                          <button
                            key={`empty-active-${i}`}
                            onClick={() => {
                              if (isValid) {
                                handleMoveToActive(playerToSwap.player.id);
                                setSwapDialogOpen(false);
                              }
                            }}
                            disabled={!isValid}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors mb-2",
                              isValid
                                ? "border-border hover:border-primary bg-card"
                                : "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                                {roleIcons[slot.role] || '👤'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">{slot.label}</p>
                                <p className="text-[10px] text-muted-foreground">Fill empty {slot.role} slot</p>
                              </div>
                              {!isValid && (
                                <span className="text-[10px] text-destructive">{validation.errors[0]}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fill Slot Dialog */}
      <Dialog open={!!slotToFill} onOpenChange={(open) => !open && setSlotToFill(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Fill {slotToFill?.label} Slot
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Select a player from your bench to move to the active roster:
            </p>
            {slotToFill && (
              (() => {
                // Filter bench players by role if it's a specific requirement
                const availableBench = sortedBench.filter(p => {
                  if (slotToFill.role === 'Any Position') return true;
                  if (slotToFill.role === 'Batsman' && p.role === 'Wicket Keeper') return true; // User's rule
                  return p.role === slotToFill.role;
                });

                if (availableBench.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No bench players available for this role.</p>
                    </div>
                  );
                }

                return availableBench.map(player => {
                  const validation = canAddToActive(activePlayers, player, config);
                  const isValid = validation.isValid;

                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (isValid) {
                          handleMoveToActive(player.id);
                          setSlotToFill(null);
                        }
                      }}
                      disabled={!isValid}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        isValid
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
                        {!isValid && validation.errors.length > 0 && (
                          <div className="text-[10px] text-destructive font-medium max-w-[100px] text-right">
                            {validation.errors[0]}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                });
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PlayerDetailDialog
        player={detailPlayer!}
        open={!!detailPlayer}
        onOpenChange={(open) => !open && setDetailPlayer(null)}
        onDrop={canEdit && detailPlayer ? () => dropPlayerOnly(teamId!, detailPlayer.id) : undefined}
      />
    </AppLayout>
  );
};

export default TeamView;
