import { Plus, Minus, ArrowUp, ArrowDown, Plane, ArrowLeftRight, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';

// Cricket Bat Icon
const CricketBatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20L8 16" />
    <rect x="7" y="4" width="5" height="14" rx="1" transform="rotate(45 9.5 11)" />
  </svg>
);

// Cricket Ball Icon
const CricketBallIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3C9 6 9 18 12 21" />
    <path d="M12 3C15 6 15 18 12 21" />
  </svg>
);

// Wicket Keeper Gloves Icon
const GlovesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
    <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    <path d="M14 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v6" />
    <path d="M6 10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V8" />
    <path d="M6 10V8a2 2 0 0 1 2-2" />
    <path d="M10 14v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4" />
  </svg>
);

// All Rounder Icon (bat + ball combined)
const AllRounderIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="8" r="5" />
    <path d="M16 5v6" />
    <path d="M4 20l4-4" />
    <rect x="6" y="10" width="3" height="8" rx="0.5" transform="rotate(45 7.5 14)" />
  </svg>
);

interface PlayerCardProps {
  player: Player;
  onAdd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSwap?: () => void;
  onTrade?: () => void;
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
      return <CricketBatIcon className="w-5 h-5" />;
    case 'Bowler':
      return <CricketBallIcon className="w-5 h-5" />;
    case 'All Rounder':
      return <AllRounderIcon className="w-5 h-5" />;
    case 'Wicket Keeper':
      return <GlovesIcon className="w-5 h-5" />;
    default:
      return <CricketBatIcon className="w-5 h-5" />;
  }
};

export const PlayerCard = ({ 
  player, 
  onAdd, 
  onDrop, 
  onMoveUp,
  onMoveDown,
  onSwap,
  onTrade,
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
        <div className="flex items-center gap-1.5">
          <p className={cn(
            "font-semibold truncate",
            variant === 'compact' && "text-sm",
            // Use white text for dark backgrounds, black for light
            ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team) ? 'text-white' : 'text-black'
          )}>
            {player.name}
          </p>
          {player.isInternational && (
            <Plane className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team) ? 'text-white/80' : 'text-black/80'
            )} />
          )}
        </div>
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
          {onTrade && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-secondary hover:text-secondary hover:bg-secondary/10"
              onClick={onTrade}
              title="Propose trade"
            >
              <Repeat className="w-4 h-4" />
            </Button>
          )}
          {onSwap && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-secondary hover:bg-secondary/10"
              onClick={onSwap}
              title="Swap player"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </Button>
          )}
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
