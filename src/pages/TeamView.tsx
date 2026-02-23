import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserMinus, AlertCircle, Plane, ArrowUpDown, Trophy, Lock, Info, Plus, Shield } from 'lucide-react';
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
  canRemoveFromActive,
  PlayerRole,
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

    // Validate the swap
    let swapValidation;
    if (playerToSwap.from === 'bench') {
      if (targetPlayer.id === playerToSwap.player.id) {
        // Filling an empty slot
        swapValidation = canAddToActive(activePlayers, playerToSwap.player, config);
      } else {
        // Replacing an active player
        swapValidation = canSwapInActive(activePlayers, playerToSwap.player, targetPlayer, targetPlayer.role, config);
      }
    } else if (targetPlayer.id === 'bench-target') {
      // Moving active player to bench
      swapValidation = canRemoveFromActive(activePlayers, playerToSwap.player);
    } else {
      // Intra-active swap
      swapValidation = canSwapInActive(activePlayers, targetPlayer, playerToSwap.player, playerToSwap.player.role, config);
    }

    if (!swapValidation.isValid) {
      toast.error(swapValidation.errors?.[0] || 'Invalid swap');
      return;
    }

    try {
      if (playerToSwap.from === 'bench') {
        if (targetPlayer.id === playerToSwap.player.id) {
          // Fill empty slot
          await moveToActive(teamId, playerToSwap.player.id);
          toast.success(`${playerToSwap.player.name} moved to active roster`);
        } else {
          // Swap bench with active
          await swapPlayers(teamId, playerToSwap.player.id, targetPlayer.id);
          toast.success(`Swapped ${playerToSwap.player.name} with ${targetPlayer.name}`);
        }
      } else if (targetPlayer.id === 'bench-target') {
        // Active to bench
        await moveToBench(teamId, playerToSwap.player.id);
        toast.success(`${playerToSwap.player.name} moved to bench`);
      } else {
        // Intra-active swap
        await swapPlayers(teamId, playerToSwap.player.id, targetPlayer.id);
        toast.success(`Swapped ${playerToSwap.player.name} with ${targetPlayer.name}`);
      }
    } catch (error) {
      toast.error('Failed to perform swap');
    }

    setSwapDialogOpen(false);
    setPlayerToSwap(null);
  };

  return (
    <AppLayout
      title={
        <div className="flex items-baseline gap-2 sm:gap-3 truncate">
          <span className="truncate">{manager.teamName}</span>
          <span className="text-sm text-muted-foreground font-medium flex-shrink-0">{manager.name}</span>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 mt-0.5 overflow-x-auto hide-scrollbar pb-1 -mb-1">
          <div className="flex items-center gap-2 bg-muted/50 px-2 py-1.5 rounded-md border border-border/50 shadow-sm whitespace-nowrap flex-shrink-0">
            <span className="text-sm font-bold text-foreground tabular-nums">{manager.wins}W - {manager.losses}L</span>
            <span className="text-[10px] text-muted-foreground font-bold tracking-tighter uppercase">Record</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/20 shadow-sm whitespace-nowrap flex-shrink-0">
            <span className="text-sm font-bold text-primary tabular-nums">{manager.points.toFixed(1)}</span>
            <span className="text-[10px] text-primary/70 font-bold tracking-tighter uppercase">Points</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-amber-500/5 px-2 py-1.5 rounded-md border border-amber-500/20 shadow-sm whitespace-nowrap flex-shrink-0">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-bold text-amber-500 tabular-nums">#{standingsPosition}</span>
            <span className="text-[10px] text-amber-500/70 font-bold tracking-tighter uppercase">Rank</span>
          </div>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
          {!canEdit && <Lock className="w-3.5 h-3.5 text-muted-foreground opacity-50" />}
        </div>
      }
    >

      <div className="px-4 py-4 space-y-6">

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

        {/* Separator */}
        <div className="border-b border-border/50" />

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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-foreground">Starting Roster</h2>
                  <div className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border shadow-sm",
                    internationalCount > config.maxInternational
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : "bg-primary/5 text-primary/70 border-primary/10"
                  )}>
                    <Plane className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{internationalCount}/{config.maxInternational} INT</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Starting lineup ({activePlayers.length}/{config.activeSize})</p>
              </div>
            </div>

            <Badge variant="outline" className="bg-background text-[10px] uppercase border-border/50 shadow-sm text-muted-foreground tracking-widest">
              Starters
            </Badge>
          </div>

          <div className="space-y-2">
            {/* We want to render exactly 11 slots in a specific order: WK, 3 BAT, 2 AR, 3 BWL, 2 FLEX */}
            {(() => {
              // Create a copy of active players to map to slots
              const unassigned = [...activePlayers];

              const pullPlayer = (roles: string[]) => {
                const idx = unassigned.findIndex(p => roles.includes(p.role));
                if (idx !== -1) return unassigned.splice(idx, 1)[0] || null;
                return null;
              };

              const assignedSlots: { roleLabel: string, player: Player | null, originalSlotData?: SlotRequirement }[] = [];
              assignedSlots.push({ roleLabel: 'WK', player: pullPlayer(['Wicket Keeper']) });
              for (let i = 0; i < 3; i++) assignedSlots.push({ roleLabel: 'BAT', player: pullPlayer(['Batsman', 'Wicket Keeper']) });
              for (let i = 0; i < 2; i++) assignedSlots.push({ roleLabel: 'AR', player: pullPlayer(['All Rounder']) });
              for (let i = 0; i < 3; i++) assignedSlots.push({ roleLabel: 'BWL', player: pullPlayer(['Bowler']) });

              const remainingFlexCount = 11 - assignedSlots.length;
              for (let i = 0; i < remainingFlexCount; i++) {
                assignedSlots.push({ roleLabel: 'FLEX', player: unassigned.length > 0 ? unassigned.shift()! : null });
              }

              // We also need to map these visual slots back to the validation 'slots' 
              // so the 'setSlotToFill' dialg works correctly with `SlotRequirement` data
              const mappedSlots = assignedSlots.map(visualSlot => {
                // Find a matching requirement from the `roster-validation.ts` slots
                let correspondingReq = slots.find(s => !s.filled && (
                  (visualSlot.roleLabel === 'WK' && s.role === 'Wicket Keeper') ||
                  (visualSlot.roleLabel === 'BAT' && ['Batsman', 'WK/BAT'].includes(s.role)) ||
                  (visualSlot.roleLabel === 'AR' && ['All Rounder', 'AR/BWL'].includes(s.role)) ||
                  (visualSlot.roleLabel === 'BWL' && s.role === 'Bowler') ||
                  (visualSlot.roleLabel === 'FLEX' && s.role === 'Any Position')
                ));

                // fallback to Flex if specific role requirement is not found.
                if (!correspondingReq && !visualSlot.player) {
                  correspondingReq = slots.find(s => !s.filled && s.role === 'Any Position');
                }

                return { ...visualSlot, originalSlotData: correspondingReq };
              });

              return mappedSlots.map((slot, index) => (
                slot.player ? (
                  <div key={slot.player.id} className="relative flex items-center">
                    <div className="w-12 shrink-0 flex justify-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tight",
                        slot.roleLabel === 'BAT' ? "text-blue-500" :
                          slot.roleLabel === 'BWL' ? "text-red-500" :
                            slot.roleLabel === 'AR' ? "text-purple-500" :
                              slot.roleLabel === 'WK' ? "text-green-500" :
                                "text-amber-500"
                      )}>
                        {slot.roleLabel}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <PlayerCard
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
                    </div>
                  </div>
                ) : (
                  <div key={`empty-${index}`} className="relative flex items-center">
                    <div className="w-12 shrink-0 flex justify-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tight opacity-50",
                        slot.roleLabel === 'BAT' ? "text-blue-500" :
                          slot.roleLabel === 'BWL' ? "text-red-500" :
                            slot.roleLabel === 'AR' ? "text-purple-500" :
                              slot.roleLabel === 'WK' ? "text-green-500" :
                                "text-amber-500"
                      )}>
                        {slot.roleLabel}
                      </span>
                    </div>

                    <button
                      onClick={canEdit && slot.originalSlotData ? () => setSlotToFill(slot.originalSlotData!) : undefined}
                      className={cn(
                        "flex-1 p-[14px] rounded-xl border border-dashed border-border bg-muted/10 flex items-center gap-3 transition-all text-left group",
                        canEdit && slot.originalSlotData && "hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full bg-background border flex items-center justify-center text-lg transition-colors group-hover:border-primary/30",
                        slot.roleLabel === 'BAT' ? "border-blue-500/20 text-blue-500/50" :
                          slot.roleLabel === 'BWL' ? "border-red-500/20 text-red-500/50" :
                            slot.roleLabel === 'AR' ? "border-purple-500/20 text-purple-500/50" :
                              slot.roleLabel === 'WK' ? "border-green-500/20 text-green-500/50" :
                                "border-amber-500/20 text-amber-500/50"
                      )}>
                        {canEdit ? <Plus className="w-4 h-4 opacity-50" /> : '👤'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-foreground transition-colors">Empty</p>
                      </div>
                    </button>
                  </div>
                )
              ));
            })()}
          </div>
        </section>

        {/* Bench */}
        <section>
          <div className="flex items-center justify-between mb-3 pt-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Bench</h2>
              <p className="text-xs text-muted-foreground">Reserves ({benchPlayers.length}/{config.benchSize})</p>
            </div>
          </div>

          <div className="space-y-2">
            {sortedBench.map((player) => (
              <div key={player.id} className="relative flex items-center">
                <div className="w-12 shrink-0 flex justify-center">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-tight",
                    player.role === 'Batsman' ? "text-blue-500" :
                      player.role === 'Bowler' ? "text-red-500" :
                        player.role === 'All Rounder' ? "text-purple-500" :
                          player.role === 'Wicket Keeper' ? "text-green-500" :
                            "text-amber-500"
                  )}>
                    BN
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <PlayerCard
                    player={player}
                    isOwned
                    onSwap={canEdit && activePlayers.length > 0 ? () => handleStartSwap(player, 'bench') : undefined}
                    onClick={() => setDetailPlayer(player)}
                  />
                </div>
              </div>
            ))}

            {/* Empty bench slots */}
            {Array.from({ length: Math.max(0, config.benchSize - benchPlayers.length) }).map((_, i) => (
              <div key={`bench-empty-${i}`} className="relative flex items-center">
                <div className="w-12 shrink-0 flex justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground opacity-50">
                    BN
                  </span>
                </div>
                <div className="flex-1 p-[14px] rounded-xl border border-dashed border-border bg-muted/10 flex items-center gap-3 opacity-60">
                  <div className="w-10 h-10 rounded-full bg-background border border-muted-foreground/20 flex items-center justify-center text-lg text-muted-foreground/50">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Empty Bench Slot</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* League Roster Key */}
        <section className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">League Roster Key</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Configuration & Constraints</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* BAT / WK Group */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">BAT / WK Group</span>
                <span className="text-xs font-mono">{roleIcons['Batsman']} + {roleIcons['Wicket Keeper']}</span>
              </div>
              <p className="text-sm font-semibold">Min {config.minBatWk} Players</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant={config.requireWk ? "default" : "outline"} className="text-[8px] h-3.5 px-1 uppercase">
                  {config.requireWk ? "WK Required" : "WK Optional"}
                </Badge>
                <p className="text-[9px] text-muted-foreground italic truncate">WKs count for batting min</p>
              </div>
            </div>

            {/* All Rounders */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">All Rounders</span>
                <span className="text-xs font-mono">{roleIcons['All Rounder']}</span>
              </div>
              <p className="text-sm font-semibold">Min {config.minAllRounders} Player{config.minAllRounders !== 1 ? 's' : ''}</p>
            </div>

            {/* Bowlers */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Bowlers</span>
                <span className="text-xs font-mono">{roleIcons['Bowler']}</span>
              </div>
              <p className="text-sm font-semibold">Min {config.minBowlers} Players</p>
            </div>

            {/* Flex Slots */}
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-primary uppercase">Flex Slots</span>
                <span className="text-xs font-mono">Any</span>
              </div>
              <p className="text-sm font-semibold">
                {config.activeSize - (config.minBatWk + config.minAllRounders + config.minBowlers)} Slots
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">Extra players of any role</p>
            </div>

            {/* International */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">International</span>
                <Plane className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Max {config.maxInternational}</p>
            </div>

            {/* Max From Team */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">From Team</span>
                <Users className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Max {config.maxFromTeam || 11}</p>
            </div>
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
              Select a player or slot to swap {playerToSwap?.player.name} with:
            </p>
            {playerToSwap && (
              <div className="space-y-3">
                {/* 1. All other Active Players (Intra-roster swap) */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Roster</p>
                  {activePlayers
                    .filter(p => {
                      if (!playerToSwap) return false;
                      return p.id !== playerToSwap.player.id;
                    })
                    .map(player => {
                      if (!playerToSwap) return null;
                      // If swapping from bench, playerToSwap is moving INTO active, 'player' is moving OUT
                      // targetSlotRole is the role of the slot we are clicking on ('player.role')
                      const isValidSwap = playerToSwap.from === 'bench'
                        ? canSwapInActive(activePlayers, playerToSwap.player, player, player.role, config).isValid
                        : canSwapInActive(activePlayers, player, playerToSwap.player, playerToSwap.player.role, config).isValid;

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
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                              {roleIcons[player.role] || '👤'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{player.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {player.role} •
                                {isValidSwap ? " Swap to this slot" : " Position constraint"}
                              </p>
                            </div>
                            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                            {!isValidSwap && <Lock className="w-3 h-3 text-destructive" />}
                          </div>
                        </button>
                      );
                    })}
                </div>

                {/* 1.5. Empty Active Slots (If swapping from bench) */}
                {playerToSwap.from === 'bench' && activePlayers.length < config.activeSize && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Empty Active Slots</p>
                    {getActiveRosterSlots(activePlayers, config)
                      .filter(slot => !slot.filled)
                      .map((slot, idx) => {
                        if (!playerToSwap) return null;
                        // player is moving into an empty slot - use slot.role as target
                        const validation = canSwapInActive(activePlayers, playerToSwap.player, { id: 'hole' } as Player, slot.role as PlayerRole | 'Any Position' | 'BENCH', config);
                        const isClickable = validation.isValid;

                        return (
                          <button
                            key={`empty-${idx}`}
                            onClick={() => isClickable && handleSwap(playerToSwap.player)}
                            disabled={!isClickable}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border border-dashed transition-colors",
                              isClickable
                                ? "border-primary/50 hover:border-primary bg-primary/5"
                                : "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full border border-dashed border-primary/50 flex items-center justify-center text-xs text-primary/50">
                                {roleIcons[slot.role] || '+'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">{slot.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isClickable ? "Fill this slot" : (validation.errors[0] || "Constraint violation")}
                                </p>
                              </div>
                              <Plus className="w-4 h-4 text-primary/50" />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* 2. Bench Players */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bench</p>
                  {sortedBench.map(player => {
                    const isValidSwap = playerToSwap.from === 'bench'
                      ? canSwapInActive(activePlayers, playerToSwap.player, player, 'BENCH', config).isValid
                      : true; // Swapping active to bench is always fine role-wise

                    return (
                      <button
                        key={player.id}
                        onClick={() => isValidSwap && handleSwap({ ...player, id: 'bench-target' } as Player)}
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
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{player.name}</p>
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1">BN</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{player.role} • {playerToSwap.from === 'active' ? 'Swap to Active' : 'Swap on Bench'}</p>
                          </div>
                          {player.isInternational && <Plane className="w-4 h-4 text-muted-foreground" />}
                          {!isValidSwap && <Lock className="w-3 h-3 text-destructive" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 3. Special Actions (Move to Bench) */}
                {playerToSwap.from === 'active' && benchPlayers.length < config.benchSize && (
                  <div className="pt-2 border-t border-border/50">
                    <button
                      onClick={() => {
                        handleMoveToBench(playerToSwap.player.id);
                        setSwapDialogOpen(false);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-dashed border-border hover:border-primary bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm opacity-60">
                          <ArrowUpDown className="w-4 h-4 rotate-90" />
                        </div>
                        <div className="flex-1 text-muted-foreground">
                          <p className="font-medium">Move to Empty Bench Slot</p>
                          <p className="text-[10px]">Bench space: {benchPlayers.length}/{config.benchSize}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* 4. Filling Empty Active Slots */}
                {playerToSwap.from === 'bench' && slots.filter(s => !s.filled).length > 0 && (
                  <div className="pt-2 border-t border-border/50">
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
                )}
              </div>
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
    </AppLayout >
  );
};

export default TeamView;
