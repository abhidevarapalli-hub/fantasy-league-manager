import { useState, useEffect, useRef } from 'react';
import { X, User, Plane, Timer, Pause, Play, RefreshCw, Shuffle, Bot, CheckCircle, AlertCircle, Flag, Zap } from 'lucide-react';
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
import { useGameStore } from '@/store/useGameStore';
import { useDraft } from '@/hooks/useDraft';
import type { Manager, Player } from '@/lib/supabase-types';
import type { DraftState } from '@/lib/draft-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
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
}

const DraftCell = ({ round, position, manager, player, pickNumber, onCellClick, onClearPick, readOnly, isActive }: DraftCellProps) => {
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
      onClick={manager && !readOnly ? onCellClick : undefined}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all overflow-hidden",
        !player && "bg-muted/50 border-border text-muted-foreground",
        manager && !readOnly ? "cursor-pointer hover:opacity-80" : "cursor-default",
        !manager && "opacity-50",
        isEmpty && manager && !readOnly && "border-dashed",
        isActive && !player && "border-primary ring-2 ring-primary ring-inset animate-pulse"
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
          {isActive ? (
            <div className="flex flex-col items-center gap-1">
              <Timer className="w-6 h-6 text-primary animate-bounce" />
              <span className="text-[8px] font-bold text-primary uppercase">Active</span>
            </div>
          ) : (
            <User className="w-6 h-6 opacity-30" />
          )}
        </div>
      )}
    </div>
  );
};

const DraftTimer = ({ getRemainingTime, isActive, isPaused }: { getRemainingTime: () => number, isActive: boolean, isPaused: boolean }) => {
  const [timeLeft, setTimeLeft] = useState(getRemainingTime());
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(getRemainingTime());
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(getRemainingTime());
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused, getRemainingTime]);

  // Update immediately when state changes
  useEffect(() => {
    setTimeLeft(getRemainingTime());
  }, [getRemainingTime]);

  const seconds = Math.ceil(timeLeft / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const isCritical = seconds < 15;

  if (!isActive) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg transition-all duration-500",
      isPaused ? "bg-muted border-border text-muted-foreground" :
        isCritical ? "bg-red-500 border-red-600 text-white animate-pulse" :
          "bg-primary border-primary-foreground/20 text-primary-foreground"
    )}>
      <Timer className={cn("w-5 h-5", !isPaused && "animate-spin-slow")} />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-bold leading-none opacity-80">
          {isPaused ? "Paused" : "Pick Clock"}
        </span>
        <span className="text-xl font-mono font-black leading-none">
          {minutes}:{remainingSeconds.toString().padStart(2, '0')}
        </span>
      </div>
      {isCritical && !isPaused && (
        <AlertCircle className="w-5 h-5 animate-bounce" />
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
  hasRemainingPicks
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
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700"
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; position: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft is read-only if explicitly set OR if draft is finalized
  const isEffectivelyReadOnly = readOnly || draftState?.isFinalized;

  const handleCellClick = (round: number, position: number) => {
    if (isEffectivelyReadOnly) return;
    setSelectedCell({ round, position });
    setDialogOpen(true);
  };

  const handlePickConfirm = async (playerId: string) => {
    if (!selectedCell || isEffectivelyReadOnly) return;
    await makePick(selectedCell.round, selectedCell.position, playerId);
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
  const currentRound = Math.floor(currentTotalPicks / (positionsCount || 1)) + 1;
  const pickIndexInRound = currentTotalPicks % (positionsCount || 1);

  // Snake draft logic for current position
  const isEvenRound = currentRound % 2 === 0;
  const currentPosition = isEvenRound
    ? (positionsCount - pickIndexInRound)
    : (pickIndexInRound + 1);

  // Get manager for currently selected cell
  const selectedManager = selectedCell ? getManagerAtPosition(selectedCell.position) : null;
  const selectedPick = selectedCell ? getPick(selectedCell.round, selectedCell.position) : null;

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

  return (
    <div className="space-y-4 pb-28">
      {/* Top Floating Bar for Timer */}
      {draftState?.isActive && !draftState?.isFinalized && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <DraftTimer
            getRemainingTime={getRemainingTime}
            isActive={draftState.isActive}
            isPaused={!!draftState.pausedAt}
          />
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

              return (
                <div key={position} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">#{position}</span>
                    {manager && !isEffectivelyReadOnly && (
                      <button
                        onClick={() => manager && toggleAutoDraft(manager.id, !orderItem?.autoDraftEnabled)}
                        className={cn(
                          "transition-colors",
                          orderItem?.autoDraftEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        title={orderItem?.autoDraftEnabled ? "Auto-draft active" : "Enable auto-draft"}
                      >
                        <Bot className={cn("w-3 h-3", orderItem?.autoDraftEnabled && "animate-pulse")} />
                      </button>
                    )}
                  </div>
                  {isEffectivelyReadOnly ? (
                    <div className="h-8 text-xs bg-muted border border-border rounded-md w-full flex items-center justify-center px-1">
                      <span className="truncate text-[10px]">{manager?.teamName || 'Empty'}</span>
                    </div>
                  ) : (
                    <Select
                      value={manager?.id || ''}
                      onValueChange={(value) => assignManagerToPosition(position, value)}
                      disabled={draftState?.isActive}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted border-border w-full">
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
                const pick = getPick(round, position);
                const player = getPlayerForPick(pick);
                const pickNumber = `${round}.${position}`;

                const isActivePick = draftState?.isActive &&
                  !draftState.isFinalized &&
                  round === currentRound &&
                  position === currentPosition;

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

      {/* Draft Pick Dialog - only if not read-only */}
      {!isEffectivelyReadOnly && (
        <DraftPickDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          round={selectedCell?.round || 0}
          position={selectedCell?.position || 0}
          manager={selectedManager}
          draftedPlayerIds={getDraftedPlayerIds().filter(id => id !== selectedPick?.playerId)}
          currentPlayerId={selectedPick?.playerId || null}
          onConfirm={handlePickConfirm}
        />
      )}

      {/* Available Players Drawer - always visible */}
      <AvailablePlayersDrawer draftedPlayerIds={getDraftedPlayerIds()} />
    </div>
  );
};
