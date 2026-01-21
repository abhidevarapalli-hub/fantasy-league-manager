import { useState, useEffect } from 'react';
import { User, Plane, Play, RotateCcw, Timer } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useMockDraft } from '@/hooks/useMockDraft';
import type { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROUNDS = 14;
const POSITIONS = 8;

// Team colors based on IPL teams
const teamColors: Record<string, string> = {
  SRH: 'bg-[#FF822A] border-[#FF822A] text-white',
  CSK: 'bg-[#FFCB05] border-[#FFCB05] text-black',
  KKR: 'bg-[#3A225D] border-[#3A225D] text-white',
  RR: 'bg-[#EB71A6] border-[#EB71A6] text-white',
  RCB: 'bg-[#800000] border-[#800000] text-white',
  MI: 'bg-[#004B91] border-[#004B91] text-white',
  GT: 'bg-[#1B223D] border-[#1B223D] text-white',
  LSG: 'bg-[#2ABFCB] border-[#2ABFCB] text-white',
  PBKS: 'bg-[#B71E24] border-[#B71E24] text-white',
  DC: 'bg-[#000080] border-[#000080] text-white',
};

const defaultCellColor = 'bg-muted/50 border-border text-muted-foreground';

const teamBadgeColors: Record<string, string> = {
  CSK: 'bg-black/20 text-black',
  MI: 'bg-white/20 text-white',
  RCB: 'bg-white/20 text-white',
  KKR: 'bg-white/20 text-white',
  DC: 'bg-white/20 text-white',
  RR: 'bg-white/20 text-white',
  PBKS: 'bg-white/20 text-white',
  SRH: 'bg-white/20 text-white',
  GT: 'bg-white/20 text-white',
  LSG: 'bg-white/20 text-white',
};

const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
};

const getCellColor = (player: Player | null): string => {
  if (!player) return defaultCellColor;
  return teamColors[player.team] || defaultCellColor;
};

interface MockDraftCellProps {
  round: number;
  position: number;
  player: Player | null;
  pickNumber: string;
  isCurrentPick: boolean;
  isUserTeam: boolean;
  onCellClick?: () => void;
  colorClass: string;
}

const MockDraftCell = ({ 
  player, 
  pickNumber, 
  isCurrentPick, 
  isUserTeam,
  onCellClick, 
  colorClass 
}: MockDraftCellProps) => {
  return (
    <div
      onClick={onCellClick}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all",
        colorClass,
        isCurrentPick && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isUserTeam && !player && "border-primary border-2",
        onCellClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        !player && "border-dashed"
      )}
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
          <p className="font-medium text-xs truncate leading-tight w-full">
            {player.name.split(' ')[0]}
          </p>
          <p className="font-bold text-sm truncate leading-tight w-full">
            {player.name.split(' ').slice(1).join(' ')}
          </p>
          <Badge 
            className={cn(
              "text-[8px] px-1 py-0 mt-1 font-semibold",
              teamBadgeColors[player.team] || 'bg-muted text-muted-foreground'
            )}
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
  const { players } = useGame();
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
    getPick,
    getTeamForPick,
  } = useMockDraft(players);

  const [selectedPosition, setSelectedPosition] = useState<string>('1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; position: number } | null>(null);

  // Start auto-picking loop when mock draft starts
  useEffect(() => {
    if (state.isActive && !state.isComplete && !isUserTurn) {
      // Small delay before starting
      const timeout = setTimeout(() => {
        runAutoPickLoop();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [state.isActive]);

  const handleStartDraft = () => {
    const position = parseInt(selectedPosition);
    startMockDraft(position);
  };

  const handleCellClick = (round: number, position: number) => {
    if (!isUserTurn) return;
    
    // Check if this is the current pick position for the user
    const currentTeamIndex = getTeamForPick(state.currentRound, state.currentPickIndex);
    const userTeamIndex = (state.userPosition || 1) - 1;
    
    if (currentTeamIndex !== userTeamIndex) return;
    if (round !== state.currentRound) return;
    
    setSelectedCell({ round, position });
    setDialogOpen(true);
  };

  const handlePickConfirm = async (playerId: string) => {
    makeUserPick(playerId);
    setDialogOpen(false);
    
    // Continue auto-picking after user pick
    continueAfterUserPick();
  };

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
                {Array.from({ length: 8 }, (_, i) => (
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
          <p>8 teams × 14 rounds snake draft</p>
          <p>AI will auto-draft for other teams based on roster requirements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-4">
          <Badge variant={isUserTurn ? 'default' : 'secondary'}>
            {state.isComplete ? 'Complete' : isUserTurn ? 'Your Pick!' : 'AI Drafting...'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Round {Math.min(state.currentRound, ROUNDS)} | Pick {state.currentPickIndex + 1}/8
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
          <div className="grid grid-cols-8 gap-2 mb-2 sticky top-0 bg-background z-10 pb-2">
            {Array.from({ length: POSITIONS }, (_, i) => {
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
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: ROUNDS }, (_, roundIdx) => {
              const round = roundIdx + 1;

              return Array.from({ length: POSITIONS }, (_, colIdx) => {
                const position = colIdx + 1;
                const teamIndex = colIdx; // Column index = team index (0-7)
                
                // Find the pick for this cell
                const pick = getPick(round, position);
                const player = pick ? getPlayerById(pick.playerId) : null;
                
                const pickNumber = `${round}.${position}`;
                
                // Check if this is the current pick
                const currentTeamIndex = getTeamForPick(state.currentRound, state.currentPickIndex);
                const isCurrentPick = !state.isComplete && 
                  round === state.currentRound && 
                  teamIndex === currentTeamIndex;
                
                const isUserTeam = (state.userPosition || 0) - 1 === teamIndex;
                const canClick = isUserTurn && isCurrentPick && isUserTeam;

                return (
                  <MockDraftCell
                    key={`${round}-${position}`}
                    round={round}
                    position={position}
                    player={player}
                    pickNumber={pickNumber}
                    isCurrentPick={isCurrentPick}
                    isUserTeam={isUserTeam}
                    onCellClick={canClick ? () => handleCellClick(round, position) : undefined}
                    colorClass={getCellColor(player)}
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
        position={selectedCell?.position || 0}
        manager={null}
        draftedPlayerIds={getDraftedPlayerIds()}
        currentPlayerId={null}
        onConfirm={handlePickConfirm}
      />

      {/* Available Players Drawer */}
      <AvailablePlayersDrawer draftedPlayerIds={getDraftedPlayerIds()} />
    </div>
  );
};
