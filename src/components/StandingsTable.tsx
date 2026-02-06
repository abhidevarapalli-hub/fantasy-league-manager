import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Manager } from '@/lib/supabase-types';
import { ChevronRight, Trophy, Loader2 } from 'lucide-react';
import { useFantasyStandings } from '@/hooks/useFantasyStandings';
import { Badge } from '@/components/ui/badge';

interface StandingsTableProps {
  managers: Manager[];
  currentManagerId: string;
  loggedInManagerId?: string;
}

export const StandingsTable = ({ managers, currentManagerId, loggedInManagerId }: StandingsTableProps) => {
  const navigate = useNavigate();
  const { leagueId } = useParams();
  const { standings, loading: loadingStandings } = useFantasyStandings(leagueId || null);

  // Create a map of manager fantasy points
  const fantasyPointsMap = new Map(
    standings.map(s => [s.managerId, s.totalPoints])
  );

  // Sort managers by fantasy points (from database) if available, else by W/L
  const sortedManagers = [...managers].sort((a, b) => {
    const aFantasy = fantasyPointsMap.get(a.id) ?? 0;
    const bFantasy = fantasyPointsMap.get(b.id) ?? 0;

    // Primary sort: fantasy points
    if (bFantasy !== aFantasy) return bFantasy - aFantasy;

    // Secondary sort: wins
    if (b.wins !== a.wins) return b.wins - a.wins;

    // Tertiary sort: legacy points
    return b.points - a.points;
  });

  const hasFantasyPoints = standings.some(s => s.totalPoints > 0);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className={cn(
        "grid gap-2 px-4 py-3 bg-muted/30 border-b border-border",
        hasFantasyPoints
          ? "grid-cols-[1fr_40px_40px_70px]"
          : "grid-cols-[1fr_40px_40px_50px]"
      )}>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">W</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">L</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center flex items-center justify-center gap-1">
          {hasFantasyPoints && <Trophy className="w-3 h-3" />}
          Pts
        </span>
      </div>

      {sortedManagers.map((manager, index) => {
        const fantasyPoints = fantasyPointsMap.get(manager.id) ?? 0;
        const displayPoints = hasFantasyPoints ? fantasyPoints : manager.points;

        return (
          <button
            key={manager.id}
            onClick={() => navigate(`/${leagueId}/team/${manager.id}`)}
            className={cn(
              "w-full grid gap-2 px-4 py-3 transition-colors hover:bg-muted/30 items-center",
              hasFantasyPoints
                ? "grid-cols-[1fr_40px_40px_70px]"
                : "grid-cols-[1fr_40px_40px_50px]",
              index !== sortedManagers.length - 1 && "border-b border-border",
              manager.id === currentManagerId && "bg-primary/5 hover:bg-primary/10",
              loggedInManagerId && manager.id === loggedInManagerId && "bg-secondary/10 hover:bg-secondary/15 border-l-2 border-l-secondary"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                index === 0 && "bg-amber-500/20 text-amber-400",
                index === 1 && "bg-slate-400/20 text-slate-300",
                index === 2 && "bg-orange-600/20 text-orange-400",
                index > 2 && "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </span>
              <div className="text-left min-w-0">
                <p className="font-semibold text-foreground truncate">{manager.teamName}</p>
                <p className="text-xs text-muted-foreground">{manager.name}</p>
              </div>
            </div>
            <span className="text-center font-medium text-success">{manager.wins}</span>
            <span className="text-center font-medium text-destructive">{manager.losses}</span>
            <div className="flex items-center justify-center gap-1">
              {loadingStandings ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className={cn(
                    "font-bold",
                    hasFantasyPoints ? "text-amber-500" : "text-primary"
                  )}>
                    {displayPoints.toLocaleString()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </>
              )}
            </div>
          </button>
        );
      })}

      {managers.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No teams in this league yet.
        </div>
      )}
    </div>
  );
};
