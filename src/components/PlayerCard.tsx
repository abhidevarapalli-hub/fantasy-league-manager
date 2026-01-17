import { Plus, Minus, ArrowUp, ArrowDown, Swords, Target, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
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

const teamCardColors: Record<string, string> = {
  CSK: 'bg-amber-500/15 border-amber-500/30 hover:border-amber-500/50',
  MI: 'bg-blue-500/15 border-blue-500/30 hover:border-blue-500/50',
  RCB: 'bg-red-500/15 border-red-500/30 hover:border-red-500/50',
  KKR: 'bg-purple-500/15 border-purple-500/30 hover:border-purple-500/50',
  DC: 'bg-blue-600/15 border-blue-600/30 hover:border-blue-600/50',
  RR: 'bg-pink-500/15 border-pink-500/30 hover:border-pink-500/50',
  PBKS: 'bg-red-600/15 border-red-600/30 hover:border-red-600/50',
  SRH: 'bg-orange-500/15 border-orange-500/30 hover:border-orange-500/50',
  GT: 'bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-500/50',
  LSG: 'bg-sky-500/15 border-sky-500/30 hover:border-sky-500/50',
};

const teamBadgeColors: Record<string, string> = {
  CSK: 'bg-amber-500/30 text-amber-400 border-amber-500/40',
  MI: 'bg-blue-500/30 text-blue-400 border-blue-500/40',
  RCB: 'bg-red-500/30 text-red-400 border-red-500/40',
  KKR: 'bg-purple-500/30 text-purple-400 border-purple-500/40',
  DC: 'bg-blue-600/30 text-blue-300 border-blue-600/40',
  RR: 'bg-pink-500/30 text-pink-400 border-pink-500/40',
  PBKS: 'bg-red-600/30 text-red-300 border-red-600/40',
  SRH: 'bg-orange-500/30 text-orange-400 border-orange-500/40',
  GT: 'bg-cyan-500/30 text-cyan-400 border-cyan-500/40',
  LSG: 'bg-sky-500/30 text-sky-400 border-sky-500/40',
};

const roleStyles: Record<string, string> = {
  'Batsman': 'bg-blue-500/20 text-blue-400',
  'Bowler': 'bg-green-500/20 text-green-400',
  'All Rounder': 'bg-purple-500/20 text-purple-400',
  'Wicket Keeper': 'bg-orange-500/20 text-orange-400',
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'Batsman':
      return <Swords className="w-5 h-5" />;
    case 'Bowler':
      return <Target className="w-5 h-5" />;
    case 'All Rounder':
      return <User className="w-5 h-5" />;
    case 'Wicket Keeper':
      return <Shield className="w-5 h-5" />;
    default:
      return <User className="w-5 h-5" />;
  }
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
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      teamCardColors[player.team] || "bg-card border-border hover:border-primary/30",
      variant === 'compact' && "p-2"
    )}>
      {/* Role Icon */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        roleStyles[player.role] || 'bg-muted text-muted-foreground'
      )}>
        {getRoleIcon(player.role)}
      </div>
      
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
            teamBadgeColors[player.team] || 'bg-muted text-muted-foreground'
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
