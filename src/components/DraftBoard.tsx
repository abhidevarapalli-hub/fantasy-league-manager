import { useState } from 'react';
import { X, User, Plane } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPlayerAvatarUrl, getPlayerInitials } from "@/lib/player-utils";
import { useGameStore } from '@/store/useGameStore';
import { useDraft } from '@/hooks/useDraft';
import type { Manager, Player } from '@/lib/supabase-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { AvailablePlayersDrawer } from '@/components/AvailablePlayersDrawer';
import { cn } from '@/lib/utils';
import { getTeamColors } from '@/lib/team-colors';

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
}

const DraftCell = ({ round, position, manager, player, pickNumber, onCellClick, onClearPick, readOnly }: DraftCellProps) => {
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
        isEmpty && manager && !readOnly && "border-dashed"
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
          {/* Avatar */}
          <Avatar className="h-10 w-10 mb-1 border-2 border-white/20 shadow-sm">
            <AvatarImage
              src={getPlayerAvatarUrl(player.imageId, 'thumb')}
              alt={player.name}
              className="object-cover"
            />
            <AvatarFallback className="text-[10px] font-bold bg-black/20 text-white/80">
              {getPlayerInitials(player.name)}
            </AvatarFallback>
          </Avatar>

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
          <User className="w-6 h-6 opacity-30" />
        </div>
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
    draftState,
    loading,
    getManagerAtPosition,
    getPick,
    getPlayerForPick,
    getDraftedPlayerIds,
    assignManagerToPosition,
    makePick,
    clearPick,
    finalizeDraft,
    resetDraft,
  } = useDraft();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; position: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCellClick = (round: number, position: number) => {
    if (readOnly) return;
    setSelectedCell({ round, position });
    setDialogOpen(true);
  };

  const handlePickConfirm = async (playerId: string) => {
    if (!selectedCell || readOnly) return;
    await makePick(selectedCell.round, selectedCell.position, playerId);
  };

  const handleFinalize = async () => {
    if (readOnly) return;
    setIsSubmitting(true);
    await finalizeDraft();
    setIsSubmitting(false);
  };

  const handleReset = async () => {
    if (readOnly) return;
    if (window.confirm('Are you sure you want to reset the draft? All picks will be cleared.')) {
      await resetDraft();
    }
  };

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
              const manager = getManagerAtPosition(position);
              const availableManagers = managers.filter(
                m => !assignedManagerIds.includes(m.id) || m.id === manager?.id
              );

              return (
                <div key={position} className="flex flex-col items-center gap-1">
                  <div className="text-xs text-muted-foreground font-medium">#{position}</div>
                  {readOnly ? (
                    <div className="h-8 text-xs bg-muted border border-border rounded-md w-full flex items-center justify-center px-1">
                      <span className="truncate text-[10px]">{manager?.teamName || 'Empty'}</span>
                    </div>
                  ) : (
                    <Select
                      value={manager?.id || ''}
                      onValueChange={(value) => assignManagerToPosition(position, value)}
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

                return (
                  <DraftCell
                    key={`${round}-${position}`}
                    round={round}
                    position={position}
                    manager={manager}
                    player={player}
                    pickNumber={pickNumber}
                    onCellClick={() => handleCellClick(round, position)}
                    onClearPick={() => !readOnly && clearPick(round, position)}
                    readOnly={readOnly}
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
            <span className="text-primary font-medium">
              Draft finalized on {draftState.finalizedAt?.toLocaleDateString()}
            </span>
          ) : (
            <span>
              {getDraftedPlayerIds().length} / {rounds * positions} picks made
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset Draft
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Finalizing...' : draftState?.isFinalized ? 'Re-finalize Draft' : 'Finalize Draft'}
            </Button>
          </div>
        )}
      </div>

      {/* Draft Pick Dialog - only if not read-only */}
      {!readOnly && (
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
