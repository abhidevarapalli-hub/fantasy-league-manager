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
  SRH: 'bg-[#FF822A]/15 border-[#FF822A]/30 hover:border-[#FF822A]/50',
  CSK: 'bg-[#FFCB05]/15 border-[#FFCB05]/30 hover:border-[#FFCB05]/50',
  KKR: 'bg-[#3A225D]/15 border-[#3A225D]/30 hover:border-[#3A225D]/50',
  RR: 'bg-[#EB71A6]/15 border-[#EB71A6]/30 hover:border-[#EB71A6]/50',
  RCB: 'bg-[#800000]/15 border-[#800000]/30 hover:border-[#800000]/50',
  MI: 'bg-[#004B91]/15 border-[#004B91]/30 hover:border-[#004B91]/50',
  GT: 'bg-[#1B223D]/15 border-[#1B223D]/30 hover:border-[#1B223D]/50',
  LSG: 'bg-[#2ABFCB]/15 border-[#2ABFCB]/30 hover:border-[#2ABFCB]/50',
  PBKS: 'bg-[#B71E24]/15 border-[#B71E24]/30 hover:border-[#B71E24]/50',
  DC: 'bg-[#000080]/15 border-[#000080]/30 hover:border-[#000080]/50',
};

const teamBadgeColors: Record<string, string> = {
  SRH: 'bg-[#FF822A]/30 text-[#FF822A] border-[#FF822A]/40',
  CSK: 'bg-[#FFCB05]/30 text-[#FFCB05] border-[#FFCB05]/40',
  KKR: 'bg-[#3A225D]/30 text-[#3A225D] border-[#3A225D]/40',
  RR: 'bg-[#EB71A6]/30 text-[#EB71A6] border-[#EB71A6]/40',
  RCB: 'bg-[#800000]/30 text-[#800000] border-[#800000]/40',
  MI: 'bg-[#004B91]/30 text-[#004B91] border-[#004B91]/40',
  GT: 'bg-[#1B223D]/30 text-[#1B223D] border-[#1B223D]/40',
  LSG: 'bg-[#2ABFCB]/30 text-[#2ABFCB] border-[#2ABFCB]/40',
  PBKS: 'bg-[#B71E24]/30 text-[#B71E24] border-[#B71E24]/40',
  DC: 'bg-[#000080]/30 text-[#000080] border-[#000080]/40',
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
