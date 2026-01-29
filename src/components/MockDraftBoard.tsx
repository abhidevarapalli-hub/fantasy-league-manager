import { useState, useEffect } from 'react';
import { User, Plane, Play, RotateCcw, Timer } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useMockDraft } from '@/hooks/useMockDraft';
import type { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { cn } from '@/lib/utils';
import { getTeamColors } from '@/lib/team-colors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Role to abbreviation mapping
const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
};

const getCellColor = (player: Player | null): string => {
  return '';
};

interface MockDraftCellProps {
  round: number;
  position: number;
  player: Player | null;
  pickNumber: string;
  isCurrentPick: boolean;
  isUserTeam: boolean;
  onCellClick?: () => void;
}

const MockDraftCell = ({
  round,
  position,
  player,
  pickNumber,
  isCurrentPick,
  isUserTeam,
  onCellClick
}: MockDraftCellProps) => {
  const colors = player ? getTeamColors(player.team) : null;
  return (
    <div
      onClick={onCellClick}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all",
        !player && "bg-muted/50 border-border text-muted-foreground",
        isCurrentPick && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isUserTeam && !player && "border-primary border-2",
        onCellClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        !player && "border-dashed"
      )}
      style={player && colors ? {
        backgroundColor: colors.raw,
        borderColor: colors.raw,
      } : {}}
    >
      {/* Pick number badge */}
      <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60">
        {pickNumber}
      </div>

      {/* International player icon */}
      {player?.isInternational && (
        <div className="absolute bottom-1 right-1">
          <Plane className="w-3 h-3 opacity-80" />
        </div>
      )}

      {/* Current pick indicator */}
      {isCurrentPick && !player && (
        <div className="absolute top-1 left-1">
          <Timer className="w-3 h-3 text-primary animate-pulse" />
        </div>
      )}

      {player ? (
        <div className="pt-3 flex flex-col items-center justify-center text-center">
          <p className={cn(
            "font-medium text-xs truncate leading-tight w-full",
            colors?.text
          )}>
            {player.name.split(' ')[0]}
          </p>
          <p className={cn(
            "font-bold text-sm truncate leading-tight w-full",
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
          <User className="w-6 h-6 opacity-30" />
        </div>
      )}
    </div>
  );
};

export const MockDraftBoard = () => {
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const {
    state,
    isUserTurn,
    startMockDraft,
    makeUserPick,
    continueAfterUserPick,
    resetMockDraft,
    runAutoPickLoop,
    getPlayerById,
    getDraftedPlayerIds,
    getPickByTeam,
    getPickDisplayNumber,
    getTeamForPick,
  } = useMockDraft(players, config);

  const [selectedPosition, setSelectedPosition] = useState<string>('1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; teamIndex: number } | null>(null);

  // Start auto-picking loop when mock draft starts
  useEffect(() => {
    if (state.isActive && !state.isComplete && !isUserTurn) {
      // Small delay before starting
      const timeout = setTimeout(() => {
        runAutoPickLoop();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [state.isActive, isUserTurn]);

  const handleStartDraft = () => {
    const position = parseInt(selectedPosition);
    startMockDraft(position);
  };

  const handleCellClick = (round: number, teamIndex: number) => {
    if (!isUserTurn) return;

    // Check if this is the current pick position for the user
    const currentTeamIndex = getTeamForPick(state.currentRound, state.currentPickIndex);
    const userTeamIndex = (state.userPosition || 1) - 1;

    if (currentTeamIndex !== userTeamIndex) return;
    if (round !== state.currentRound) return;
    if (teamIndex !== userTeamIndex) return;

    setSelectedCell({ round, teamIndex });
    setDialogOpen(true);
  };

  const handlePickConfirm = async (playerId: string) => {
    makeUserPick(playerId);
    setDialogOpen(false);

    // Continue auto-picking after user pick
    continueAfterUserPick();
  };

  const rounds = config.activeSize + config.benchSize;
  const positions = config.managerCount;

  // Pre-draft setup screen
  if (!state.isActive) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Mock Draft</h2>
          <p className="text-muted-foreground">
            Practice drafting against AI opponents
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Select your draft position:</span>
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: positions }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    #{i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleStartDraft} size="lg" className="gap-2">
            <Play className="w-4 h-4" />
            Start Mock Draft
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center max-w-md">
          <p>{positions} teams × {rounds} rounds snake draft</p>
          <p>AI will auto-draft for other teams based on roster requirements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-4">
          <Badge variant={isUserTurn ? 'default' : 'secondary'}>
            {state.isComplete ? 'Complete' : isUserTurn ? 'Your Pick!' : 'AI Drafting...'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Round {Math.min(state.currentRound, rounds)} | Pick {state.currentPickIndex + 1}/{positions}
          </span>
          <span className="text-sm text-muted-foreground">
            Your position: #{state.userPosition}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={resetMockDraft} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          New Draft
        </Button>
      </div>

      {/* User turn prompt */}
      {isUserTurn && !state.isComplete && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
          <p className="font-medium">It's your turn! Click on your column to make a pick.</p>
        </div>
      )}

      {/* Scrollable Draft Container */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[700px]">
          {/* Header Row - Team Positions */}
          <div
            className="grid gap-2 mb-2 sticky top-0 bg-background z-10 pb-2"
            style={{ gridTemplateColumns: `repeat(${positions}, minmax(80px, 1fr))` }}
          >
            {Array.from({ length: positions }, (_, i) => {
              const position = i + 1;
              const isUserTeam = position === state.userPosition;

              return (
                <div
                  key={position}
                  className={cn(
                    "flex flex-col items-center gap-1",
                    isUserTeam && "font-bold"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium",
                    isUserTeam ? "text-primary" : "text-muted-foreground"
                  )}>
                    #{position}
                  </div>
                  <div className={cn(
                    "h-8 text-xs rounded-md w-full flex items-center justify-center px-1 border",
                    isUserTeam
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  )}>
                    <span className="truncate text-[10px]">
                      {isUserTeam ? 'You' : `Team ${position}`}
                    </span>
                  </div>
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
                const teamIndex = colIdx;

                // Find the pick for this cell by team index
                const pick = getPickByTeam(round, teamIndex);
                const player = pick ? getPlayerById(pick.playerId) : null;

                // Get proper snake draft pick number
                const pickNumber = getPickDisplayNumber(round, teamIndex);

                // Check if this is the current pick
                const currentTeamIndex = getTeamForPick(state.currentRound, state.currentPickIndex);
                const isCurrentPick = !state.isComplete &&
                  round === state.currentRound &&
                  teamIndex === currentTeamIndex;

                const isUserTeam = (state.userPosition || 0) - 1 === teamIndex;
                const canClick = isUserTurn && isCurrentPick && isUserTeam;

                return (
                  <MockDraftCell
                    key={`${round}-${teamIndex}`}
                    round={round}
                    position={teamIndex + 1}
                    player={player}
                    pickNumber={pickNumber}
                    isCurrentPick={isCurrentPick}
                    isUserTeam={isUserTeam}
                    onCellClick={canClick ? () => handleCellClick(round, teamIndex) : undefined}
                  />
                );
              });
            })}
          </div>
        </div>
      </div>

      {/* Completion message */}
      {state.isComplete && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center space-y-2">
          <p className="font-medium text-lg">Mock Draft Complete!</p>
          <p className="text-sm text-muted-foreground">
            You drafted {state.teamRosters.get((state.userPosition || 1) - 1)?.length || 0} players.
          </p>
          <Button onClick={resetMockDraft} className="mt-2 gap-2">
            <RotateCcw className="w-4 h-4" />
            Start New Mock Draft
          </Button>
        </div>
      )}

      {/* Draft Pick Dialog */}
      <DraftPickDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        round={selectedCell?.round || 0}
        position={(selectedCell?.teamIndex || 0) + 1}
        draftedPlayerIds={getDraftedPlayerIds()}
        currentPlayerId={null}
        onConfirm={handlePickConfirm}
        isMockDraft={true}
      />

      {/* Available Players Drawer */}
      <AvailablePlayersDrawer draftedPlayerIds={getDraftedPlayerIds()} />
    </div>
  );
};
