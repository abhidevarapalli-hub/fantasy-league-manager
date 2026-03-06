import { ReactNode } from 'react';
import { User, Plane, Timer, Zap } from 'lucide-react';
import type { Player } from '@/lib/supabase-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getTeamColors } from '@/lib/team-colors';
import { ROLE_ABBREVIATIONS } from '@/lib/draft-constants';

export interface SharedDraftCellProps {
  player: Player | null;
  pickNumber: string;
  isCurrentPick: boolean;
  isUserTeam: boolean;
  isUserTurn: boolean;
  onCellClick?: () => void;
  // Optional extensions for real draft
  avatar?: ReactNode;
  clearButton?: ReactNode;
  gradientOverlay?: boolean;
  // Extra styling hooks
  extraEmptyClassName?: string;
}

export const SharedDraftCell = ({
  player,
  pickNumber,
  isCurrentPick,
  isUserTeam,
  isUserTurn,
  onCellClick,
  avatar,
  clearButton,
  gradientOverlay = false,
  extraEmptyClassName,
}: SharedDraftCellProps) => {
  const colors = player ? getTeamColors(player.team) : null;

  return (
    <div
      onClick={onCellClick}
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg transition-all overflow-hidden",
        !player && "bg-muted/50 border-border text-muted-foreground",
        !player && isCurrentPick && "border-primary ring-2 ring-primary ring-inset animate-pulse",
        !player && isUserTeam && !isCurrentPick && "bg-primary/5 border-primary/20",
        !player && !isCurrentPick && "border-dashed",
        onCellClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        extraEmptyClassName
      )}
      style={player && colors ? {
        backgroundColor: colors.raw,
        borderColor: colors.raw,
      } : {}}
    >
      {/* Optional gradient overlay for depth (real draft) */}
      {player && gradientOverlay && colors && (
        <div className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/20 pointer-events-none" />
      )}

      {/* Pick number badge */}
      <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60 z-10">
        {pickNumber}
      </div>

      {/* International player icon */}
      {player?.isInternational && (
        <div className="absolute bottom-1 right-1 z-10">
          <Plane className="w-3 h-3 opacity-80" />
        </div>
      )}

      {/* Optional clear button (real draft) */}
      {clearButton}

      {player ? (
        <div className="pt-1 flex flex-col items-center justify-center text-center relative z-0">
          {/* Optional avatar slot (real draft) */}
          {avatar}

          {/* First name */}
          <p className={cn(
            "font-medium text-[10px] truncate leading-tight w-full opacity-90",
            colors?.text
          )}>
            {player.name.split(' ')[0]}
          </p>
          {/* Last name */}
          <p className={cn(
            "font-bold text-xs truncate leading-tight w-full",
            colors?.text
          )}>
            {player.name.split(' ').slice(1).join(' ')}
          </p>
          <Badge
            variant="outline"
            className="text-[8px] px-1 py-0 mt-1 font-semibold border"
            style={{
              backgroundColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              borderColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              color: colors?.text === 'text-white' ? 'white' : 'black'
            }}
          >
            {ROLE_ABBREVIATIONS[player.role] || player.role}
          </Badge>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full pt-2">
          {isCurrentPick && isUserTurn ? (
            <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-8 h-8 text-primary animate-pulse fill-primary/20" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Click to</span>
                <span className="text-[12px] font-black text-primary uppercase tracking-tighter leading-none">Pick Player</span>
              </div>
            </div>
          ) : isCurrentPick ? (
            <div className="flex flex-col items-center gap-1 opacity-50">
              <Timer className="w-6 h-6 text-primary" />
              <span className="text-[8px] font-bold text-primary uppercase">On Clock</span>
            </div>
          ) : (
            <User className="w-6 h-6 opacity-30" />
          )}
        </div>
      )}
    </div>
  );
};
