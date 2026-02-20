import { Plus, Minus, ArrowUp, ArrowDown, Plane, ArrowUpDown, Repeat, Crown, Shield } from 'lucide-react';
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { Button } from '@/components/ui/button';
import { getTeamColors } from '@/lib/team-colors';



interface PlayerCardProps {
  player: Player;
  onAdd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSwap?: () => void;
  onTrade?: () => void;
  onClick?: () => void;
  onSetCaptain?: () => void;
  onSetViceCaptain?: () => void;
  isOwned?: boolean;
  showActions?: boolean;
  variant?: 'compact' | 'full';
  captainBadge?: 'C' | 'VC' | null;
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
  onMoveUp,
  onMoveDown,
  onSwap,
  onTrade,
  onClick,
  onSetCaptain,
  onSetViceCaptain,
  isOwned = false,
  showActions = true,
  variant = 'full',
  captainBadge,
  managerName
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
        teamColors.bg === 'bg-muted' && "bg-card border-border",
        variant === 'compact' && "p-2 gap-2",
        // Only apply card-level hover effects when NOT hovering over buttons/actions
        onClick && "cursor-pointer hover:shadow-lg active:scale-[0.99]",
        onClick && teamColors.bg === 'bg-muted' && "hover:border-primary/30",
        // Use group-hover with a backdrop highlight that is less intrusive than scaling
        onClick && "after:absolute after:inset-0 after:bg-primary/0 after:transition-colors hover:after:bg-primary/5 clickable-card"
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
        cachedUrl={player.cachedUrl}
        className={cn(
          "w-10 h-10 border-2 shadow-sm shrink-0",
          teamColors.text === 'text-white' ? "border-white/20" : "border-black/10"
        )}
        fallbackClassName={cn("bg-black/20", teamColors.text)}
      />

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-1.5 leading-tight">
          <p className={cn(
            "font-medium truncate",
            variant === 'compact' ? "text-xs" : "text-sm md:text-base",
            teamColors.text
          )}>
            {player.name}
          </p>
          {captainBadge && (
            <span className={cn(
              "px-1.5 py-0.5 text-[9px] font-black rounded-full border shadow-sm leading-none",
              captainBadge === 'C'
                ? "bg-amber-500/30 text-amber-300 border-amber-400/50"
                : "bg-slate-400/30 text-slate-300 border-slate-400/50"
            )}>
              {captainBadge}
            </span>
          )}
          {player.isInternational && (
            <Plane className={cn(
              "w-3 h-3 flex-shrink-0 opacity-70",
              teamColors.text
            )} />
          )}
        </div>
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
            {onSetCaptain && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-amber-300 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/30 font-black text-sm shadow-sm"
                onClick={onSetCaptain}
                title="Set as Captain (2× points)"
              >
                C
              </Button>
            )}
            {onSetViceCaptain && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-slate-300 bg-slate-500/20 hover:bg-slate-500/40 border border-slate-400/30 font-black text-sm shadow-sm"
                onClick={onSetViceCaptain}
                title="Set as Vice-Captain (1.5× points)"
              >
                VC
              </Button>
            )}
            {onTrade && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white bg-secondary/20 hover:bg-secondary/40 border border-white/10"
                onClick={onTrade}
                title="Propose trade"
              >
                <Repeat className="w-5 h-5" />
              </Button>
            )}
            {onSwap && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white bg-black/20 hover:bg-black/40 border border-white/10"
                onClick={onSwap}
                title="Swap player"
              >
                <ArrowUpDown className="w-5 h-5" />
              </Button>
            )}
            {onMoveUp && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white bg-black/20 hover:bg-black/40 border border-white/10"
                onClick={onMoveUp}
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
            )}
            {onMoveDown && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white bg-black/20 hover:bg-black/40 border border-white/10"
                onClick={onMoveDown}
              >
                <ArrowDown className="w-5 h-5" />
              </Button>
            )}
            {!isOwned && onAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white bg-emerald-500/40 hover:bg-emerald-500/60 border border-emerald-400/30"
                onClick={onAdd}
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
