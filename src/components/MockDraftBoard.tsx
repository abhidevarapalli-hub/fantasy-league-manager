import { useState, useEffect } from 'react';
import { User, Plane, Play, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { useMockDraft } from '@/hooks/useMockDraft';
import type { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { cn } from '@/lib/utils';
import { getTeamColors } from '@/lib/team-colors';
import { useNavigate } from 'react-router-dom';
import { useMockStore } from '@/store/useMockStore';

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

export const MockDraftBoard = ({ draftId, masterPlayers }: { draftId: string, masterPlayers: Player[] }) => {
  const navigate = useNavigate();
  const deleteDraft = useMockStore(state => state.deleteDraft);

  const {
    draft,
    isUserTurn,
    makeUserPick,
    continueAfterUserPick,
    runAutoPickLoop,
    getPlayerById,
    getDraftedPlayerIds,
    getPickByTeam,
    getPickDisplayNumber,
    getTeamForPick,
  } = useMockDraft(draftId, masterPlayers);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; teamIndex: number } | null>(null);

  // Start auto-picking loop when mock draft starts
  useEffect(() => {
    if (draft?.status === 'in_progress' && !isUserTurn) {
      // Small delay before starting
      const timeout = setTimeout(() => {
        runAutoPickLoop();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [draft?.status, isUserTurn, runAutoPickLoop]);

  if (!draft) return <div className="p-8 text-center text-muted-foreground">Draft not found</div>;

  const handleCellClick = (round: number, teamIndex: number) => {
    if (!isUserTurn) return;

    // Check if this is the current pick position for the user
    const currentTeamIndex = getTeamForPick(draft.currentRound, draft.currentPickIndex);
    const userTeamIndex = draft.userPosition - 1;

    if (currentTeamIndex !== userTeamIndex) return;
    if (round !== draft.currentRound) return;
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

  const handleDeleteDraft = () => {
    deleteDraft(draftId);
    navigate('/');
  };

  const rounds = draft.config.activeSize + draft.config.benchSize;
  const positions = draft.config.managerCount;
  const isComplete = draft.status === 'completed';

  return (
    <div className="space-y-4 pb-28">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-4">
          <Badge variant={isUserTurn ? 'default' : 'secondary'}>
            {isComplete ? 'Complete' : isUserTurn ? 'Your Pick!' : 'AI Drafting...'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Round {Math.min(draft.currentRound, rounds)} | Pick {Math.min(draft.currentPickIndex + 1, positions)}/{positions}
          </span>
          <span className="text-sm text-muted-foreground">
            Your position: #{draft.userPosition}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
            Back to Leagues
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteDraft} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* User turn prompt */}
      {isUserTurn && !isComplete && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center animate-in fade-in slide-in-from-top-2">
          <p className="font-medium text-primary">It's your turn! Click on your column to make a pick.</p>
        </div>
      )}

      {/* Scrollable Draft Container */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[700px]">
          {/* Header Row - Team Positions */}
          <div
            className="grid gap-2 mb-2 sticky top-0 bg-background z-10 pb-2 border-b"
            style={{ gridTemplateColumns: `repeat(${positions}, minmax(80px, 1fr))` }}
          >
            {Array.from({ length: positions }, (_, i) => {
              const position = i + 1;
              const isUserTeam = position === draft.userPosition;

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
                    isUserTeam ? "text-primary bg-primary/10 px-2 py-0.5 rounded-full" : "text-muted-foreground"
                  )}>
                    #{position}
                  </div>
                  <div className={cn(
                    "h-8 text-xs rounded-md w-full flex items-center justify-center px-1 border",
                    isUserTeam
                      ? "bg-primary/5 border-primary text-primary"
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
            className="grid gap-2 pt-2"
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
                const currentTeamIndex = getTeamForPick(draft.currentRound, draft.currentPickIndex);
                const isCurrentPick = !isComplete &&
                  round === draft.currentRound &&
                  teamIndex === currentTeamIndex;

                const isUserTeam = draft.userPosition - 1 === teamIndex;
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
      {isComplete && (
        <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl text-center space-y-4 mt-6">
          <h2 className="text-2xl font-bold text-primary">Mock Draft Complete!</h2>
          <p className="text-muted-foreground">
            You drafted {draft.teamRosters[draft.userPosition - 1]?.length || 0} players.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate('/')} variant="outline" className="min-w-[120px]">
              Back Home
            </Button>
            <Button onClick={() => navigate('/mock-draft/setup')} className="min-w-[120px]">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Draft Pick Dialog - only render if not completely finished */}
      {!isComplete && (
        <>
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

          <AvailablePlayersDrawer draftedPlayerIds={getDraftedPlayerIds()} />
        </>
      )}
    </div>
  );
};
