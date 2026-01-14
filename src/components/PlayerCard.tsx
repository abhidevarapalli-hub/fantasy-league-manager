import { Plus, Minus, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player } from '@/store/gameStore';
import { Button } from '@/components/ui/button';

interface PlayerCardProps {
  player: Player;
  onAdd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isOwned?: boolean;
  showActions?: boolean;
  variant?: 'compact' | 'full';
}

const teamColors: Record<string, string> = {
  CSK: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  MI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RCB: 'bg-red-500/20 text-red-400 border-red-500/30',
  KKR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DC: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  RR: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  PBKS: 'bg-red-600/20 text-red-300 border-red-600/30',
  SRH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  GT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  LSG: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export const PlayerCard = ({ 
  player, 
  onAdd, 
  onDrop, 
  onMoveUp,
  onMoveDown,
  isOwned = false,
  showActions = true,
  variant = 'full'
}: PlayerCardProps) => {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-card rounded-xl border border-border transition-all hover:border-primary/30",
      variant === 'compact' && "p-2"
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold text-foreground truncate",
          variant === 'compact' && "text-sm"
        )}>
          {player.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "px-2 py-0.5 text-xs font-medium rounded-md border",
            teamColors[player.team] || 'bg-muted text-muted-foreground'
          )}>
            {player.team}
          </span>
          <span className="text-xs text-muted-foreground">{player.role}</span>
        </div>
      </div>
      
      {showActions && (
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={onMoveUp}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={onMoveDown}
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          )}
          {!isOwned && onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
              onClick={onAdd}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {isOwned && onDrop && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDrop}
            >
              <Minus className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
