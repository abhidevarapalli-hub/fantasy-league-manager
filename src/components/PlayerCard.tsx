import { Plus, Minus, ArrowUp, ArrowDown, Plane, ArrowUpDown, Repeat, Crown, Shield } from 'lucide-react';
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
import { cn } from '@/lib/utils';
import { Player, CricketMatch } from '@/lib/supabase-types';
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
  onSetCaptain?: () => void;
  onSetViceCaptain?: () => void;
  isOwned?: boolean;
  showActions?: boolean;
  variant?: 'compact' | 'full';
  captainBadge?: 'C' | 'VC' | null;
  points?: number;
  hasStats?: boolean;
  matches?: CricketMatch[];
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
  onSetCaptain,
  onSetViceCaptain,
  isOwned = false,
  showActions = true,
  variant = 'full',
  captainBadge,
  points,
  hasStats,
  matches,
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

      {/* Left-side action button (Add / Trade / Drop / Move to Bench) */}
      {showActions && (onAdd || onTrade || onDrop || onMoveDown) && (
        <div className="shrink-0 z-10 flex flex-col gap-1">
          {!isOwned && onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white bg-emerald-500/40 hover:bg-emerald-500/60 border border-emerald-400/30 rounded-lg"
              onClick={onAdd}
              title="Add player"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {onTrade && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white bg-secondary/20 hover:bg-secondary/40 border border-white/10 rounded-lg"
              onClick={onTrade}
              title="Propose trade"
            >
              <Repeat className="w-4 h-4" />
            </Button>
          )}
          {onDrop && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white bg-red-500/40 hover:bg-red-500/60 border border-red-400/30 rounded-lg"
              onClick={onDrop}
              title="Drop player"
            >
              <Minus className="w-4 h-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white bg-sky-500/40 hover:bg-sky-500/60 border border-sky-400/30 rounded-lg"
              onClick={onMoveDown}
              title="Move to bench"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
      {/* Player Avatar + Team Badge */}
      <div className="flex flex-col items-center shrink-0 gap-0.5">
        <LazyPlayerAvatar
          name={player.name}
          imageId={player.imageId}
          cachedUrl={player.cachedUrl}
          className={cn(
            "w-10 h-10 border-2 shadow-sm",
            teamColors.text === 'text-white' ? "border-white/20" : "border-black/10"
          )}
          fallbackClassName={cn("bg-black/20", teamColors.text)}
        />
        <span
          className={cn(
            "px-1.5 py-0 text-[8px] font-bold rounded border bg-black/40 backdrop-blur-sm shadow-sm leading-relaxed",
            teamColors.text === 'text-white' ? "text-white border-white/10" : "text-white border-black/10"
          )}
        >
          {player.team}
        </span>
      </div>

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-1.5 leading-tight">
          <p className={cn(
            "font-medium truncate",
            variant === 'compact' ? "text-xs" : "text-sm",
            teamColors.text
          )}>
            <span className="md:hidden">
              {player.name.split(' ').length > 1
                ? `${player.name.charAt(0)}. ${player.name.split(' ').slice(1).join(' ')}`
                : player.name}
            </span>
            <span className="hidden md:inline">{player.name}</span>
          </p>
          {captainBadge && (
            <span className={cn(
              "px-2 py-0.5 text-[11px] font-black rounded-md border-2 shadow-md leading-none tracking-wide",
              captainBadge === 'C'
                ? "bg-amber-500/50 text-amber-200 border-amber-400/70"
                : "bg-slate-500/50 text-slate-200 border-slate-400/60"
            )}>
              {captainBadge === 'C' ? 'C' : 'VC'}
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
          {managerName && (
            <div className={cn(
              "px-1.5 py-0.5 text-[9px] font-bold rounded-md border backdrop-blur-sm shadow-sm uppercase tracking-tight",
              "bg-indigo-600/80 border-indigo-400/50 text-white"
            )}>
              {managerName}
            </div>
          )}
          <span className={cn(
            "text-[10px] opacity-70 hidden sm:inline",
            teamColors.text
          )}>{player.role}</span>
        </div>

        {/* Match Scores / Schedule */}
        {matches && matches.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/10">
            {matches.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter transition-all",
                  "bg-black/30 border border-white/5",
                  teamColors.text
                )}
                title={m.matchState}
              >
                vs {m.team1.shortName === player.team ? m.team2.shortName : m.team1.shortName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Points Display */}
      {(points !== undefined || hasStats) && (
        <div className="flex flex-col items-end shrink-0 z-10 px-1">
          <p className={cn(
            "text-base font-black leading-none",
            teamColors.text
          )}>
            {(points || 0).toFixed(1)}
          </p>
          <p className={cn(
            "text-[8px] font-bold tracking-widest opacity-60 uppercase",
            teamColors.text
          )}>pts</p>
        </div>
      )}


    </div>
  );
};
