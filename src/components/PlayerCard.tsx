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
  SRH: 'bg-[#FF822A]/75 border-[#FF822A] hover:border-[#FF822A]',
  CSK: 'bg-[#FFCB05]/75 border-[#FFCB05] hover:border-[#FFCB05]',
  KKR: 'bg-[#3A225D]/75 border-[#3A225D] hover:border-[#3A225D]',
  RR: 'bg-[#EB71A6]/75 border-[#EB71A6] hover:border-[#EB71A6]',
  RCB: 'bg-[#800000]/75 border-[#800000] hover:border-[#800000]',
  MI: 'bg-[#004B91]/75 border-[#004B91] hover:border-[#004B91]',
  GT: 'bg-[#1B223D]/75 border-[#1B223D] hover:border-[#1B223D]',
  LSG: 'bg-[#2ABFCB]/75 border-[#2ABFCB] hover:border-[#2ABFCB]',
  PBKS: 'bg-[#B71E24]/75 border-[#B71E24] hover:border-[#B71E24]',
  DC: 'bg-[#000080]/75 border-[#000080] hover:border-[#000080]',
};

const teamBadgeColors: Record<string, string> = {
  SRH: 'bg-[#FF822A] text-black border-[#FF822A]',
  CSK: 'bg-[#FFCB05] text-black border-[#FFCB05]',
  KKR: 'bg-[#3A225D] text-white border-[#3A225D]',
  RR: 'bg-[#EB71A6] text-black border-[#EB71A6]',
  RCB: 'bg-[#800000] text-white border-[#800000]',
  MI: 'bg-[#004B91] text-white border-[#004B91]',
  GT: 'bg-[#1B223D] text-white border-[#1B223D]',
  LSG: 'bg-[#2ABFCB] text-black border-[#2ABFCB]',
  PBKS: 'bg-[#B71E24] text-white border-[#B71E24]',
  DC: 'bg-[#000080] text-white border-[#000080]',
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
          "font-semibold truncate",
          variant === 'compact' && "text-sm",
          // Use white text for dark backgrounds, black for light
          ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team) ? 'text-white' : 'text-black'
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
          <span className={cn(
            "text-xs",
            ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team) ? 'text-white/70' : 'text-black/70'
          )}>{player.role}</span>
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
