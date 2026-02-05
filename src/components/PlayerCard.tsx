import { Plus, Minus, ArrowUp, ArrowDown, Plane, ArrowLeftRight, Repeat, Star } from 'lucide-react';
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
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
  recommendation?: {
    isRecommended: boolean;
    reason?: string;
  };
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
  variant = 'full',
  managerName,
  recommendation,
}: PlayerCardProps & { managerName?: string }) => {
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
        "group flex items-center gap-3 p-3 rounded-xl border transition-all relative overflow-hidden",
        teamColors.bg === 'bg-muted' && "bg-card border-border hover:border-primary/30",
        variant === 'compact' && "p-2 gap-2",
        onClick && "cursor-pointer hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg"
      )}
      style={teamColors.bg !== 'bg-muted' ? {
        backgroundColor: teamColors.raw,
        borderColor: `${teamColors.raw}80`,
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
      {/* Background grounding gradient for better text legibility */}
      {teamColors.bg !== 'bg-muted' && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10 pointer-events-none" />
      )}

      {/* Player Avatar - Lazy loaded with initials fallback */}
      <LazyPlayerAvatar
        name={player.name}
        imageId={player.imageId}
        className={cn(
          "w-10 h-10 border-2 shadow-sm shrink-0",
          teamColors.text === 'text-white' ? "border-white/20" : "border-black/10"
        )}
        fallbackClassName={cn("bg-black/20", teamColors.text)}
      />

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-1.5 leading-tight">
          {recommendation?.isRecommended && (
            <Star className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 fill-amber-400" />
          )}
          <p className={cn(
            "font-medium truncate",
            variant === 'compact' ? "text-xs" : "text-sm md:text-base",
            teamColors.text
          )}>
            {player.name}
          </p>
          {player.isInternational && (
            <Plane className={cn(
              "w-3 h-3 flex-shrink-0 opacity-70",
              teamColors.text
            )} />
          )}
        </div>
        {recommendation?.isRecommended && recommendation.reason && (
          <p className="text-[9px] font-medium text-amber-400 mt-0.5 truncate">
            {recommendation.reason}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={cn(
              "px-1.5 py-0.5 text-[9px] font-bold rounded border bg-black/40 backdrop-blur-sm shadow-sm",
              teamColors.text === 'text-white' ? "text-white border-white/10" : "text-white border-black/10"
            )}
          >
            {player.team}
          </span>
          <span className={cn(
            "text-[10px] opacity-70",
            teamColors.text
          )}>{player.role}</span>
        </div>
      </div>

      {/* Ownership / Action Area */}
      <div className="flex items-center gap-2 z-10">
        {managerName && (
          <div className={cn(
            "px-2 py-0.5 text-[9px] md:text-[10px] font-bold rounded-lg shadow-lg border backdrop-blur-md uppercase tracking-tight",
            "bg-indigo-600 border-indigo-400 text-white shrink-0"
          )}>
            {managerName}
          </div>
        )}

        {showActions && (
          <div className="flex items-center gap-1">
            {onTrade && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white bg-secondary/20 hover:bg-secondary/40 border border-white/10"
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
                className="h-8 w-8 text-white bg-black/20 hover:bg-black/40 border border-white/10"
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
                className="h-8 w-8 text-white bg-black/20 hover:bg-black/40 border border-white/10"
                onClick={onMoveUp}
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
            {onMoveDown && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white bg-black/20 hover:bg-black/40 border border-white/10"
                onClick={onMoveDown}
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
            )}
            {!isOwned && onAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white bg-emerald-500/40 hover:bg-emerald-500/60 border border-emerald-400/30"
                onClick={onAdd}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
            {isOwned && onDrop && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white bg-rose-500/40 hover:bg-rose-500/60 border border-rose-400/30"
                onClick={onDrop}
              >
                <Minus className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
