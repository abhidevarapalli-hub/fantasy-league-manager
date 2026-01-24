import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Manager } from '@/lib/supabase-types';
import { ChevronRight } from 'lucide-react';

interface StandingsTableProps {
  managers: Manager[];
  currentManagerId: string;
  loggedInManagerId?: string;
}

export const StandingsTable = ({ managers, currentManagerId, loggedInManagerId }: StandingsTableProps) => {
  const navigate = useNavigate();
  const { leagueId } = useParams();
  const routePrefix = leagueId || 'legacy';

  // Sort by wins first, then by points as tiebreaker
  const sortedManagers = [...managers].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.points - a.points;
  });

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_40px_40px_50px] gap-2 px-4 py-3 bg-muted/30 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">W</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">L</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Pts</span>
      </div>

      {sortedManagers.map((manager, index) => (
        <button
          key={manager.id}
          onClick={() => navigate(`/${routePrefix}/team/${manager.id}`)}

          className={cn(
            "w-full grid grid-cols-[1fr_40px_40px_50px] gap-2 px-4 py-3 transition-colors hover:bg-muted/30 items-center",
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
            <span className="font-bold text-primary">{manager.points}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
};
