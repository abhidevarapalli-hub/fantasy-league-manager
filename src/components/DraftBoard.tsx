import { useState } from 'react';
import { Edit2, User } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useDraft } from '@/hooks/useDraft';
import { Manager, Player } from '@/lib/supabase-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DraftPickDialog } from '@/components/DraftPickDialog';
import { cn } from '@/lib/utils';

const ROUNDS = 14;
const POSITIONS = 8;

// Color scheme for positions/columns - different colors for visual distinction
const positionColors = [
  'bg-blue-500/20 border-blue-500/30 text-blue-300',
  'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  'bg-purple-500/20 border-purple-500/30 text-purple-300',
  'bg-amber-500/20 border-amber-500/30 text-amber-300',
  'bg-pink-500/20 border-pink-500/30 text-pink-300',
  'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  'bg-orange-500/20 border-orange-500/30 text-orange-300',
  'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
];

const teamBadgeColors: Record<string, string> = {
  CSK: 'bg-amber-500 text-amber-950',
  MI: 'bg-blue-500 text-blue-950',
  RCB: 'bg-red-500 text-red-950',
  KKR: 'bg-purple-500 text-purple-950',
  DC: 'bg-blue-600 text-blue-950',
  RR: 'bg-pink-500 text-pink-950',
  PBKS: 'bg-red-600 text-red-950',
  SRH: 'bg-orange-500 text-orange-950',
  GT: 'bg-cyan-500 text-cyan-950',
  LSG: 'bg-sky-500 text-sky-950',
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

      {/* Edit icon for finalized picks */}
      {isFinalized && player && (
        <div className="absolute top-1 left-1">
          <Edit2 className="w-3 h-3 opacity-60" />
        </div>
      )}

      {player ? (
        <div className="pt-3">
          <p className="font-semibold text-sm truncate leading-tight">
            {player.name.split(' ').slice(-1)[0]}
          </p>
          <Badge 
            className={cn(
              "text-[8px] px-1 py-0 mt-1 font-semibold",
              teamBadgeColors[player.team] || 'bg-muted text-muted-foreground'
            )}
          >
            {player.role.slice(0, 3).toUpperCase()} - {player.team}
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
            // Snake draft order: odd rounds L-R, even rounds R-L
            const positions = round % 2 === 1 
              ? Array.from({ length: POSITIONS }, (_, i) => i + 1)
              : Array.from({ length: POSITIONS }, (_, i) => POSITIONS - i);

            return positions.map((position, posIdx) => {
              const manager = getManagerAtPosition(position);
              const pick = getPick(round, position);
              const player = getPlayerForPick(pick);
              const overallPick = (round - 1) * POSITIONS + posIdx + 1;
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
                  colorClass={positionColors[position - 1]}
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
