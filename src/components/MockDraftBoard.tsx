import { useState, useEffect, useMemo } from 'react';
import { User, Plane, Play, RotateCcw, Timer, Trash2, Zap, Pause, RefreshCw } from 'lucide-react';
import { useMockDraft } from '@/hooks/useMockDraft';
import type { Player, Manager } from '@/lib/supabase-types';
import type { DraftPick } from '@/lib/draft-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { DraftTimer } from '@/components/DraftTimer';
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
  isUserTurn: boolean;
  onCellClick?: () => void;
}

const MockDraftCell = ({
  round,
  position,
  player,
  pickNumber,
  isCurrentPick,
  isUserTeam,
  isUserTurn,
  onCellClick
}: MockDraftCellProps) => {
  const colors = player ? getTeamColors(player.team) : null;
  return (
    <div
      onClick={onCellClick}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all overflow-hidden",
        !player && "bg-muted/50 border-border text-muted-foreground",
        !player && isCurrentPick && "border-primary ring-2 ring-primary ring-inset animate-pulse",
        !player && isUserTeam && !isCurrentPick && "bg-primary/5 border-primary/20",
        onCellClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        !player && !isCurrentPick && "border-dashed"
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


      {player ? (
        <div className="pt-3 flex flex-col items-center justify-center text-center relative z-10">
          <p className={cn(
            "font-medium text-[10px] truncate leading-tight w-full opacity-90",
            colors?.text
          )}>
            {player.name.split(' ')[0]}
          </p>
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
          {isCurrentPick && isUserTurn ? (
            <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-8 h-8 text-primary animate-pulse fill-primary/20" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Click to</span>
                <span className="text-[12px] font-black text-primary uppercase tracking-tighter leading-none">Pick Player</span>
              </div>
            </div>
          ) : isCurrentPick ? (
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
    pauseDraft,
    resumeDraft,
    resetClock,
    getRemainingTime,
  } = useMockDraft(draftId, masterPlayers);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [targetPick, setTargetPick] = useState<{ round: number; position: number } | null>(null);

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

    setTargetPick({ round, position: teamIndex + 1 });
    setDrawerOpen(true);
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
      <div className="flex flex-col gap-4 p-4 bg-muted/30 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant={isUserTurn ? 'default' : 'secondary'} className={cn(isUserTurn && "bg-emerald-500 hover:bg-emerald-600 animate-pulse")}>
              {isComplete ? 'Complete' : isUserTurn ? 'Your Pick!' : 'AI Drafting...'}
            </Badge>
            <div className="flex flex-col">
              <span className="text-sm font-bold">
                Round {Math.min(draft.currentRound, rounds)} | Pick {Math.min(draft.currentPickIndex + 1, positions)}/{positions}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Your position: #{draft.userPosition}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="h-9">
              Back Home
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteDraft} className="h-9 px-3">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>


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
                    isUserTurn={isUserTurn}
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

          <AvailablePlayersDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            targetPick={targetPick}
            draftState={{
              leagueId: draftId,
              status: 'active',
              currentRound: draft.currentRound,
              currentPosition: draft.currentPickIndex + 1,
              clockDurationSeconds: 60,
              lastPickAt: new Date(),
              pausedAt: null,
              totalPausedDurationMs: 0,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              isActive: true,
              isFinalized: false
            }}
            draftedPlayerIds={getDraftedPlayerIds()}
            players={masterPlayers}
            canPick={isUserTurn}
            onDraftPlayer={(playerId) => {
              makeUserPick(playerId);
              continueAfterUserPick();
              setDrawerOpen(false);
            }}
            managers={Object.entries(draft.teamRosters).map(([idx, roster]) => ({
              id: idx,
              name: `Team ${Number(idx) + 1}`,
              teamName: `Team ${Number(idx) + 1}`,
              wins: 0,
              losses: 0,
              points: 0,
              activeRoster: roster,
              bench: [],
            }))}
            config={draft.config}
            draftPicks={draft.picks.map((p, i) => ({
              id: `pick-${i}`,
              leagueId: draftId,
              round: p.round,
              pickNumber: p.position + ((p.round - 1) * draft.config.managerCount),
              managerId: String(p.teamIndex),
              playerId: p.playerId,
              isAutoDraft: p.teamIndex !== draft.userPosition - 1,
              createdAt: new Date(),
            }))}
          />
        </>
      )}
      {!isComplete && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-4 pointer-events-none">
          {/* Floating Action Bar */}
          <div className="bg-[#0f111a]/95 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-1">
              {draft.pausedAt ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resumeDraft}
                  className="h-10 w-10 text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={pauseDraft}
                  className="h-10 w-10 text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                >
                  <Pause className="w-5 h-5 fill-current" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={resetClock}
                className="h-10 w-10 text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                title="Reset Clock"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>

            <div className="h-6 w-[1px] bg-white/10" />

            <div className="bg-[#1e1b2e] border border-[#3b2b85]/30 px-4 py-2 rounded-xl flex items-center gap-2.5 min-w-[100px] group transition-all hover:border-[#5b46cc]/50">
              <Timer className="w-5 h-5 text-[#8b6dfc] group-hover:animate-pulse" />
              <span className="text-[#8b6dfc] font-black font-mono text-xl tracking-tight leading-none">
                {Math.ceil(getRemainingTime() / 1000)}s
              </span>
            </div>
          </div>

          {/* Turn Indicator */}
          {isUserTurn && !draft.pausedAt && (
            <div className="bg-primary px-6 py-1.5 rounded-full shadow-lg border-2 border-primary-foreground/20 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
              <span className="text-primary-foreground font-black text-xs md:text-sm tracking-tighter uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 fill-current" />
                It's Your Turn! Pick Now
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
