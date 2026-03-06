import { useState, useEffect, useRef, useMemo } from 'react';
import { X, User, Plane, Timer, Pause, Play, RefreshCw, Shuffle, Bot, CheckCircle, AlertCircle, Flag, Zap } from 'lucide-react';
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/integrations/supabase/client';
import { useDraft } from '@/hooks/useDraft';
import type { Manager, Player } from '@/lib/supabase-types';
import type { DraftState } from '@/lib/draft-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { DraftTimer } from '@/components/DraftTimer';
import { cn } from '@/lib/utils';
import { getTeamColors } from '@/lib/team-colors';
import { toast } from 'sonner';

// Default color for empty cells
const defaultCellColor = 'bg-muted/50 border-border text-muted-foreground';

// Role to abbreviation mapping
const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
};

interface DraftCellProps {
  round: number;
  position: number;
  manager: Manager | null;
  player: Player | null;
  pickNumber: string;
  onCellClick: () => void;
  onClearPick: () => void;
  readOnly?: boolean;
  isActive?: boolean;
  isMyCol?: boolean;
  isMyTurn?: boolean;
}

const DraftCell = ({ round, position, manager, player, pickNumber, onCellClick, onClearPick, readOnly, isActive, isMyCol, isMyTurn }: DraftCellProps) => {
  const isEmpty = !player;

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readOnly) {
      onClearPick();
    }
  };

  const colors = player ? getTeamColors(player.team) : null;

  return (
    <div
      onClick={onCellClick}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all overflow-hidden",
        !player && "bg-muted/50 border-border text-muted-foreground",
        "cursor-pointer hover:opacity-80",
        !manager && !player && "opacity-50",
        isEmpty && manager && !readOnly && "border-dashed",
        isActive && !player && "border-primary ring-2 ring-primary ring-inset animate-pulse",
        isMyCol && !player && !isActive && "bg-primary/5 border-primary/20"
      )}
      style={player && colors ? {
        backgroundColor: colors.raw,
        borderColor: colors.raw, // Same as bg for solid look
      } : {}}
    >
      {/* Background Gradient for depth */}
      {player && colors && (
        <div className={cn("absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/20 pointer-events-none")} />
      )}

      {/* Pick number badge */}
      <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60 z-10">
        {pickNumber}
      </div>

      {/* International player icon */}
      {player?.isInternational && (
        <div className="absolute bottom-1 right-1 z-10">
          <Plane className="w-3 h-3 opacity-80" />
        </div>
      )}

      {/* X icon to clear pick - only show if not read-only */}
      {player && !readOnly && (
        <button
          onClick={handleClearClick}
          className="absolute top-1 left-1 p-0.5 rounded hover:bg-black/20 transition-colors z-20"
        >
          <X className="w-3 h-3 opacity-60 hover:opacity-100" />
        </button>
      )}

      {player ? (
        <div className="pt-1 flex flex-col items-center justify-center text-center relative z-0">
          {/* Avatar - Lazy loaded */}
          <LazyPlayerAvatar
            name={player.name}
            imageId={player.imageId}
            cachedUrl={player.cachedUrl}
            className="h-10 w-10 mb-1 border-2 border-white/20 shadow-sm"
            fallbackClassName="text-[10px] font-bold bg-black/20 text-white/80"
          />

          {/* First name */}
          <p className={cn(
            "font-medium text-[10px] truncate leading-tight w-full opacity-90",
            colors?.text
          )}>
            {player.name.split(' ')[0]}
          </p>
          {/* Last name */}
          <p className={cn(
            "font-bold text-xs truncate leading-tight w-full",
            colors?.text
          )}>
            {player.name.split(' ').slice(1).join(' ')}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "text-[8px] px-1 py-0 mt-1 font-semibold border"
            )}
            style={{
              backgroundColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              borderColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              color: colors?.text === 'text-white' ? 'white' : 'black'
            }}
          >
            {roleAbbreviations[player.role] || player.role}
          </Badge>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full pt-2">
          {isActive && isMyTurn ? (
            <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-8 h-8 text-primary animate-pulse fill-primary/20" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Click to</span>
                <span className="text-[12px] font-black text-primary uppercase tracking-tighter leading-none">Pick Player</span>
              </div>
            </div>
          ) : isActive ? (
            <div className="flex flex-col items-center gap-1 opacity-50">
              <Timer className="w-6 h-6 text-primary" />
              <span className="text-[8px] font-bold text-primary uppercase">On Clock</span>
            </div>
          ) : (
            <User className="w-6 h-6 opacity-30" />
          )}
        </div>
      )}
    </div>
  );
};

interface DraftLMControlsProps {
  draftState: DraftState | null;
  onRandomize: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onResetClock: () => void;
  onAutoDraftAll: () => void;
  allPositionsFilled: boolean;
  hasRemainingPicks: boolean;
  isOrderRandomized: boolean;
}

const DraftLMControls = ({
  draftState,
  onRandomize,
  onStart,
  onPause,
  onResume,
  onResetClock,
  onAutoDraftAll,
  allPositionsFilled,
  hasRemainingPicks,
  isOrderRandomized
}: DraftLMControlsProps) => {
  if (draftState?.isFinalized) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-card border border-border p-2 rounded-lg shadow-sm">
      {!draftState?.isActive ? (
        <>
          {draftState?.pausedAt ? (
            <Button
              variant="default"
              size="sm"
              onClick={onResume}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-3.5 h-3.5" />
              Resume Draft
            </Button>
          ) : (
            <>
              {/* Only show Randomize if no picks have been made yet */}
              {!draftState?.pausedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRandomize}
                  className="gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Randomize Order
                </Button>
              )}
              {hasRemainingPicks && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onAutoDraftAll}
                  disabled={!isOrderRandomized}
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Auto-Draft All
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={onStart}
                disabled={!allPositionsFilled}
                className="gap-1.5 bg-green-600 hover:bg-green-700"
              >
                <Play className="w-3.5 h-3.5" />
                Start Draft
              </Button>
            </>
          )}

          {!allPositionsFilled && !draftState?.pausedAt && (
            <span className="text-[10px] text-yellow-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Assign all managers to start
            </span>
          )}
        </>
      ) : (
        <>
          {draftState.pausedAt ? (
            <Button
              variant="default"
              size="sm"
              onClick={onResume}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-3.5 h-3.5" />
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onPause}
              className="gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetClock}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Clock
          </Button>
        </>
      )}
    </div>
  );
};

interface DraftBoardProps {
  readOnly?: boolean;
}

export const DraftBoard = ({ readOnly = false }: DraftBoardProps) => {
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const leagueOwnerId = useGameStore(state => state.leagueOwnerId);
  const currentManagerId = useGameStore(state => state.currentManagerId);

  // Determine if current user is the League Manager
  const isLeagueManager = useMemo(() => {
    // Check if the current manager is the league owner
    const myManager = managers.find(m => m.id === currentManagerId);
    return myManager?.userId === leagueOwnerId;
  }, [leagueOwnerId, currentManagerId, managers]);

  const {
    draftPicks,
    draftOrder,
    draftState,
    loading,
    getManagerAtPosition,
    getPick,
    getPlayerForPick,
    getDraftedPlayerIds,
    assignManagerToPosition,
    makePick,
    clearPick,
    resetDraft,
    randomizeDraftOrder,
    toggleAutoDraft,
    startDraft,
    pauseDraft,
    resumeDraft,
    resetClock,
    getRemainingTime,
    autoCompleteAllPicks,
  } = useDraft();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; position: number } | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft is read-only if explicitly set OR if draft is finalized
  const isEffectivelyReadOnly = readOnly || draftState?.isFinalized;

  const handleCellClick = (round: number, position: number) => {
    const pick = getPick(round, position);
    const player = getPlayerForPick(pick);

    if (player) {
      setDetailPlayer(player);
      return;
    }

    // Permission check: only LM can click any cell. Non-LM can ONLY click the active cell that belongs to them.
    const isActiveCell = round === currentRound && position === currentPosition;
    const isMyTurn = getManagerAtPosition(position)?.id === currentManagerId;
    const canInteract = isLeagueManager && !isEffectivelyReadOnly;
    const canPickThisCell = draftState?.isActive && !draftState?.isFinalized && isActiveCell && isMyTurn;

    if (!canInteract && !canPickThisCell) {
      return;
    }

    setSelectedCell({ round, position });
    setDrawerOpen(true);
  };

  const handlePickConfirm = async (playerId: string, round?: number, position?: number) => {
    const targetRound = round ?? selectedCell?.round;
    const targetPosition = position ?? selectedCell?.position;

    if (!targetRound || !targetPosition || draftState?.isFinalized) return;

    setIsSubmitting(true);
    try {
      await makePick(targetRound, targetPosition, playerId);
      // We don't necessarily want to close the drawer here if it was opened via the button
      // But if it was opened via a cell click, maybe we should close it or clear selection
      if (selectedCell) {
        setSelectedCell(null);
        // Only close if it's the LM specifically clicking cells to fill them
        // If it's the active picking turn, maybe keep it open?
        // User said "Instead we always want to open the draft board"
      }
    } catch (error) {
      console.error('[DraftBoard] Pick confirmation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleReset = async () => {
    if (isEffectivelyReadOnly) return;
    if (window.confirm('Are you sure you want to reset the draft? All picks will be cleared.')) {
      await resetDraft();
    }
  };


  const handleAutoDraftAll = async () => {
    if (isEffectivelyReadOnly || isSubmitting) return;
    if (window.confirm('Auto-draft all remaining picks? This will fill all empty slots with the best available players.')) {
      setIsSubmitting(true);
      try {
        await autoCompleteAllPicks();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const allPositionsFilled = Array.from({ length: config.managerCount }, (_, i) =>
    getManagerAtPosition(i + 1)
  ).every(Boolean);

  // Derive current round and position for timer/active highlighting
  const currentTotalPicks = (draftPicks || []).length;
  const positionsCount = config.managerCount;

  // These are for UI/Timer display only - they represent what the NEXT pick will be
  const nextPickIndex = currentTotalPicks;
  const currentRound = Math.floor(nextPickIndex / (positionsCount || 1)) + 1;
  const pickIndexInRound = nextPickIndex % (positionsCount || 1);

  // Snake draft logic for current position
  const isEvenRound = currentRound % 2 === 0;
  const currentPosition = isEvenRound
    ? (positionsCount - pickIndexInRound)
    : (pickIndexInRound + 1);

  // Get manager for currently selected cell
  const selectedManager = selectedCell ? getManagerAtPosition(selectedCell.position) : null;

  // Logic fix: We need to match picks by their absolute pick number
  // Database stores pick_number as ((round-1) * managerCount) + position_in_round
  // But wait! In snake rounds, position_in_round is NOT just the column index.
  // Let's use a helper in useDraft or define it here.
  const getAbsolutePickNumber = (r: number, p: number) => {
    const isRRoundEven = r % 2 === 0;
    const posInRound = isRRoundEven
      ? (positionsCount - p + 1)
      : p;
    return ((r - 1) * positionsCount) + posInRound;
  };

  // Get all assigned manager IDs to filter available managers
  const assignedManagerIds = Array.from({ length: config.managerCount }, (_, i) => {
    const manager = getManagerAtPosition(i + 1);
    return manager?.id;
  }).filter(Boolean) as string[];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading draft...</div>
      </div>
    );
  }

  const rounds = config.activeSize + config.benchSize;
  const positions = config.managerCount;

  const currentTurnManager = getManagerAtPosition(currentPosition);
  const isMyTurn = currentTurnManager?.id === useGameStore.getState().currentManagerId;

  const currentTimerProps = draftState?.isActive && !draftState?.isFinalized ? {
    getRemainingTime,
    isActive: draftState.isActive,
    isPaused: !!draftState.pausedAt,
    isMyTurn,
    currentTeamName: currentTurnManager?.teamName
  } : undefined;

  return (
    <div className="space-y-4 pb-28">
      {/* Floating Timer Widget */}
      {draftState?.isActive && !draftState?.isFinalized && !detailPlayer && !drawerOpen && (
        <div className="fixed bottom-safe left-1/2 -translate-x-1/2 mb-6 md:mb-8 z-[200] flex flex-col items-center gap-2 pointer-events-none">
          {draftState.isActive && !draftState.pausedAt && isMyTurn && (
            <div className="bg-primary px-6 py-1.5 rounded-full shadow-lg border-2 border-primary-foreground/20 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
              <span className="text-primary-foreground font-black text-xs md:text-sm tracking-tighter uppercase flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                It's Your Turn! Pick Now
              </span>
            </div>
          )}
          <div className="pointer-events-auto shadow-2xl rounded-full">
            <DraftTimer {...currentTimerProps!} />
          </div>
        </div>
      )}

      {/* LM Controls */}
      {!isEffectivelyReadOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Draft Management
            </h3>
            {draftState?.isActive && (
              <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live Draft
              </Badge>
            )}
          </div>
          <DraftLMControls
            draftState={draftState}
            onRandomize={randomizeDraftOrder}
            onStart={startDraft}
            onPause={pauseDraft}
            onResume={resumeDraft}
            onResetClock={resetClock}
            onAutoDraftAll={handleAutoDraftAll}
            allPositionsFilled={allPositionsFilled}
            hasRemainingPicks={getDraftedPlayerIds().length < (config.activeSize + config.benchSize) * config.managerCount}
            isOrderRandomized={draftOrder.some(o => o.managerId !== null)}
          />
        </div>
      )}

      {/* Scrollable Draft Container */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[700px]">
          {/* Header Row - Manager Selection */}
          <div
            className="grid gap-2 mb-2 sticky top-0 bg-background z-10 pb-2"
            style={{ gridTemplateColumns: `repeat(${positions}, minmax(80px, 1fr))` }}
          >
            {Array.from({ length: positions }, (_, i) => {
              const position = i + 1;
              const orderItem = draftOrder.find(o => o.position === position);
              const manager = getManagerAtPosition(position);
              const availableManagers = managers.filter(
                m => !assignedManagerIds.includes(m.id) || m.id === manager?.id
              );

              const isCurrentTurn = draftState?.isActive && !draftState.isFinalized && position === currentPosition;

              return (
                <div key={position} className="flex flex-col items-center gap-1 relative">
                  {isCurrentTurn && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge variant="default" className="bg-primary text-[10px] h-4 px-1 py-0 animate-bounce">
                        ON CLOCK
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "text-xs font-medium transition-colors",
                      isCurrentTurn ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      #{position}
                    </span>
                    {manager && (() => {
                      const isCpu = !manager.userId;
                      const isAuto = orderItem?.autoDraftEnabled || isCpu;

                      return (
                        <div className="flex items-center gap-1 min-h-[12px]">
                          {isLeagueManager && !isEffectivelyReadOnly && !isCpu ? (
                            <button
                              onClick={() => toggleAutoDraft(manager.id, !orderItem?.autoDraftEnabled)}
                              className={cn(
                                "flex items-center gap-1 h-5 px-1.5 rounded-full transition-all duration-200 border",
                                isAuto
                                  ? "bg-primary/10 border-primary/30 text-primary scale-105 shadow-sm"
                                  : "bg-muted/50 border-transparent text-muted-foreground/30 hover:text-muted-foreground/80 hover:bg-muted"
                              )}
                              title={isAuto ? "Auto-drafting enabled" : "Enable auto-drafting"}
                            >
                              <Bot className={cn("w-3.5 h-3.5", isAuto && "animate-pulse")} />
                              {isAuto && (
                                <span className="text-[9px] font-bold tracking-tighter">AUTO</span>
                              )}
                            </button>
                          ) : (
                            isAuto && (
                              <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-1.5 h-5 text-primary">
                                <Bot className="w-3.5 h-3.5 animate-pulse" />
                                <span className="text-[9px] font-bold tracking-tighter">AUTO</span>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {isEffectivelyReadOnly ? (
                    <div className={cn(
                      "h-8 text-xs border rounded-md w-full flex items-center justify-center px-1 transition-all",
                      isCurrentTurn ? "bg-primary/10 border-primary ring-1 ring-primary" : "bg-muted border-border"
                    )}>
                      <span className={cn(
                        "truncate text-[10px]",
                        isCurrentTurn && "font-bold text-primary"
                      )}>
                        {manager?.teamName || 'Empty'}
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={manager?.id || ''}
                      onValueChange={(value) => assignManagerToPosition(position, value)}
                      disabled={draftState?.isActive}
                    >
                      <SelectTrigger className={cn(
                        "h-8 text-xs w-full transition-all",
                        isCurrentTurn ? "bg-primary/10 border-primary ring-1 ring-primary text-primary font-bold" : "bg-muted border-border"
                      )}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableManagers.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.teamName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>

          {/* Draft Grid */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${positions}, minmax(80px, 1fr))` }}
          >
            {Array.from({ length: rounds }, (_, roundIdx) => {
              const round = roundIdx + 1;

              return Array.from({ length: positions }, (_, colIdx) => {
                const position = colIdx + 1;

                const manager = getManagerAtPosition(position);
                const absolutePickNumber = getAbsolutePickNumber(round, position);
                const pick = draftPicks.find(p => p.pickNumber === absolutePickNumber);
                const player = getPlayerForPick(pick || null);
                const pickNumber = `${round}.${position}`;

                const isActivePick = draftState?.isActive &&
                  !draftState.isFinalized &&
                  round === currentRound &&
                  position === currentPosition;

                const isMyCol = manager?.id === currentManagerId;
                const isMyTurn = isActivePick && isMyCol;

                return (
                  <DraftCell
                    key={`${round}-${position}`}
                    round={round}
                    position={position}
                    manager={manager}
                    player={player}
                    pickNumber={pickNumber}
                    onCellClick={() => handleCellClick(round, position)}
                    onClearPick={() => !isEffectivelyReadOnly && clearPick(round, position)}
                    readOnly={isEffectivelyReadOnly}
                    isActive={isActivePick}
                    isMyCol={isMyCol}
                    isMyTurn={isMyTurn}
                  />
                );
              });
            })}
          </div>
        </div>
      </div>

      {/* Actions - only show if not read-only */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {draftState?.isFinalized ? (
            <span className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-200">
              Draft Completed
            </span>
          ) : (
            <span>
              {getDraftedPlayerIds().length} / {rounds * positions} picks made
            </span>
          )}
        </div>
        {!isEffectivelyReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset Draft
            </Button>
          </div>
        )}
      </div>

      {/* Draft Pick Dialog removed in favor of AvailablePlayersDrawer opening directly */}


      <AvailablePlayersDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        targetPick={selectedCell || (draftState?.isActive && !draftState.isFinalized ? { round: currentRound, position: currentPosition } : null)}
        draftedPlayerIds={getDraftedPlayerIds()}
        canPick={!draftState?.isFinalized && (isLeagueManager || isMyTurn)}
        onDraftPlayer={handlePickConfirm}
        draftTimerProps={currentTimerProps}
      />

      {detailPlayer && (
        <PlayerDetailDialog
          player={detailPlayer}
          open={!!detailPlayer}
          onOpenChange={(open) => !open && setDetailPlayer(null)}
          onDraft={(draftState?.isActive && !draftState?.isFinalized && getManagerAtPosition(currentPosition)?.id === useGameStore.getState().currentManagerId && !getDraftedPlayerIds().includes(detailPlayer.id)) ? () => {
            handlePickConfirm(detailPlayer.id);
            setDetailPlayer(null);
          } : undefined}
          draftTimerProps={currentTimerProps}
        />
      )}
    </div>
  );
};
