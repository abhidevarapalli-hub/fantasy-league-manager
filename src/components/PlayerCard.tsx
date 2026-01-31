import { Plus, Minus, ArrowUp, ArrowDown, Plane, ArrowLeftRight, Repeat } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPlayerAvatarUrl, getPlayerInitials } from "@/lib/player-utils";
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { getTeamColors } from '@/lib/team-colors';



interface PlayerCardProps {
  player: Player;
  onAdd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSwap?: () => void;
  onTrade?: () => void;
  onClick?: () => void;
  isOwned?: boolean;
  showActions?: boolean;
  variant?: 'compact' | 'full';
}

// Team colors are now centralized in src/lib/team-colors.ts

const roleStyles: Record<string, string> = {
  'Batsman': 'bg-blue-500/20 text-blue-400',
  'Bowler': 'bg-green-500/20 text-green-400',
  'All Rounder': 'bg-purple-500/20 text-purple-400',
  'Wicket Keeper': 'bg-orange-500/20 text-orange-400',
};



export const PlayerCard = ({
  player,
  onAdd,
  onDrop,
  onMoveUp,
  onMoveDown,
  onSwap,
  onTrade,
  onClick,
  isOwned = false,
  showActions = true,
  variant = 'full'
}: PlayerCardProps) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onClick?.();
  };

  const teamColors = getTeamColors(player.team);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all",
        teamColors.bg === 'bg-muted' && "bg-card border-border hover:border-primary/30",
        variant === 'compact' && "p-2",
        onClick && "cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
      )}
      style={teamColors.bg !== 'bg-muted' ? {
        backgroundColor: teamColors.raw, // Now solid for the card background
        borderColor: teamColors.raw,
      } : {}}
      onClick={handleCardClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* Role Icon */}
      {/* Player Avatar */}
      <Avatar className="w-10 h-10 border border-border">
        <AvatarImage
          src={getPlayerAvatarUrl(player.imageId)}
          alt={player.name}
          className="object-cover"
        />
        <AvatarFallback className={cn(
          "font-semibold text-xs",
          roleStyles[player.role] || 'bg-muted text-muted-foreground'
        )}>
          {getPlayerInitials(player.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn(
            "font-semibold truncate",
            variant === 'compact' && "text-sm",
            teamColors.text
          )}>
            {player.name}
          </p>
          {player.isInternational && (
            <Plane className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              teamColors.text === 'text-white' ? 'text-white/80' : 'text-black/80'
            )} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-md border",
              teamColors.text
            )}
            style={teamColors.bg !== 'bg-muted' ? {
              backgroundColor: `${teamColors.raw}33`, // Now translucent for the pill
              borderColor: `${teamColors.raw}4D`
            } : {}}
          >
            {player.team}
          </span>
          <span className={cn(
            "text-xs",
            teamColors.text === 'text-white' ? 'text-white/70' : 'text-black/70'
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
