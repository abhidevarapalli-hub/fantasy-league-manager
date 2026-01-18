import { useState } from 'react';
import { Edit2, User, Plane } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useDraft } from '@/hooks/useDraft';
import type { Manager, Player } from '@/lib/supabase-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { cn } from '@/lib/utils';

const ROUNDS = 14;
const POSITIONS = 8;

// Default color for empty cells
const defaultCellColor = 'bg-muted/50 border-border text-muted-foreground';

// Team colors based on IPL teams (using exact colors from reference)
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

// Role to abbreviation mapping
const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
};

// Helper to get cell color based on player's team
const getCellColor = (player: Player | null): string => {
  if (!player) return defaultCellColor;
  return teamColors[player.team] || defaultCellColor;
};

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

interface DraftCellProps {
  round: number;
  position: number;
  manager: Manager | null;
  player: Player | null;
  pickNumber: string;
  isFinalized: boolean;
  onCellClick: () => void;
  colorClass: string;
}

const DraftCell = ({ round, position, manager, player, pickNumber, isFinalized, onCellClick, colorClass }: DraftCellProps) => {
  const isEmpty = !player;
  
  return (
    <div
      onClick={manager ? onCellClick : undefined}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all",
        colorClass,
        manager ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-50",
        isEmpty && manager && "border-dashed"
      )}
    >
      {/* Pick number badge */}
      <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60">
        {pickNumber}
      </div>

      {/* International player icon */}
      {player?.isInternational && (
        <div className="absolute top-1 left-1">
          <Plane className="w-3 h-3 opacity-80" />
        </div>
      )}

      {/* Edit icon for finalized picks - only show if not international */}
      {isFinalized && player && !player.isInternational && (
        <div className="absolute top-1 left-1">
          <Edit2 className="w-3 h-3 opacity-60" />
        </div>
      )}

      {player ? (
        <div className="pt-3 flex flex-col items-center justify-center text-center">
          {/* First name */}
          <p className="font-medium text-xs truncate leading-tight w-full">
            {player.name.split(' ')[0]}
          </p>
          {/* Last name */}
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

export const DraftBoard = () => {
  const { managers, players } = useGame();
  const {
    draftState,
    loading,
    getManagerAtPosition,
    getPick,
    getPlayerForPick,
    getDraftedPlayerIds,
    assignManagerToPosition,
    makePick,
    finalizeDraft,
    resetDraft,
  } = useDraft();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ round: number; position: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCellClick = (round: number, position: number) => {
    setSelectedCell({ round, position });
    setDialogOpen(true);
  };

  const handlePickConfirm = async (playerId: string) => {
    if (!selectedCell) return;
    await makePick(selectedCell.round, selectedCell.position, playerId);
  };

  const handleFinalize = async () => {
    setIsSubmitting(true);
    await finalizeDraft();
    setIsSubmitting(false);
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset the draft? All picks will be cleared.')) {
      await resetDraft();
    }
  };

  // Get manager for currently selected cell
  const selectedManager = selectedCell ? getManagerAtPosition(selectedCell.position) : null;
  const selectedPick = selectedCell ? getPick(selectedCell.round, selectedCell.position) : null;

  // Get all assigned manager IDs to filter available managers
  const assignedManagerIds = Array.from({ length: POSITIONS }, (_, i) => {
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

  return (
    <div className="space-y-4">
      {/* Header Row - Manager Selection */}
      <div className="grid grid-cols-8 gap-2">
        {Array.from({ length: POSITIONS }, (_, i) => {
          const position = i + 1;
          const manager = getManagerAtPosition(position);
          const availableManagers = managers.filter(
            m => !assignedManagerIds.includes(m.id) || m.id === manager?.id
          );

          return (
            <div key={position} className="flex flex-col items-center gap-1">
              <div className="text-xs text-muted-foreground font-medium">#{position}</div>
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
            </div>
          );
        })}
      </div>

      {/* Draft Grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 gap-2 min-w-[640px]">
          {Array.from({ length: ROUNDS }, (_, roundIdx) => {
            const round = roundIdx + 1;

            // Each column represents a fixed manager position (1-8)
            // Snake draft affects the ORDER picks are made, not the display layout
            return Array.from({ length: POSITIONS }, (_, colIdx) => {
              const position = colIdx + 1; // Column 1 = position 1, Column 4 = position 4, etc.
              
              const manager = getManagerAtPosition(position);
              const pick = getPick(round, position);
              const player = getPlayerForPick(pick);
              
              // Pick number shows round.position (matches the column/manager position)
              const pickNumber = `${round}.${position}`;

              return (
                <DraftCell
                  key={`${round}-${position}`}
                  round={round}
                  position={position}
                  manager={manager}
                  player={player}
                  pickNumber={pickNumber}
                  isFinalized={draftState?.isFinalized || false}
                  onCellClick={() => handleCellClick(round, position)}
                  colorClass={getCellColor(player)}
                />
              );
            });
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {draftState?.isFinalized ? (
            <span className="text-primary font-medium">
              Draft finalized on {draftState.finalizedAt?.toLocaleDateString()}
            </span>
          ) : (
            <span>
              {getDraftedPlayerIds().length} / {ROUNDS * POSITIONS} picks made
            </span>
          )}
        </div>
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
      </div>

      {/* Draft Pick Dialog */}
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
    </div>
  );
};
