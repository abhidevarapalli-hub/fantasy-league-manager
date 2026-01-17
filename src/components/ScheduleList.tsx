import { cn } from '@/lib/utils';
import { Match, Manager } from '@/lib/supabase-types';
import { Calendar, Trophy } from 'lucide-react';

interface ScheduleListProps {
  schedule: Match[];
  managers: Manager[];
  currentWeek: number;
}

export const ScheduleList = ({ schedule, managers, currentWeek }: ScheduleListProps) => {
  const getManager = (id: string) => managers.find(m => m.id === id);
  
  const groupedByWeek = schedule.reduce((acc, match) => {
    if (!acc[match.week]) acc[match.week] = [];
    acc[match.week].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  return (
    <div className="space-y-4">
      {Object.entries(groupedByWeek).map(([week, matches]) => (
        <div key={week} className="bg-card rounded-xl border border-border overflow-hidden">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2.5 border-b border-border",
            Number(week) === currentWeek ? "bg-primary/10" : "bg-muted/30"
          )}>
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Week {week}</span>
            {Number(week) === currentWeek && (
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                Current
              </span>
            )}
            {Number(week) < currentWeek && (
              <Trophy className="ml-auto w-4 h-4 text-amber-400" />
            )}
          </div>
          
          <div className="divide-y divide-border">
            {matches.map((match, idx) => {
              const homeManager = getManager(match.home);
              const awayManager = getManager(match.away);
              
              return (
                <div key={idx} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        match.completed && match.homeScore! > match.awayScore! && "text-success"
                      )}>
                        {homeManager?.teamName}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 px-4">
                      {match.completed ? (
                        <>
                          <span className={cn(
                            "font-bold min-w-[32px] text-center",
                            match.homeScore! > match.awayScore! ? "text-success" : "text-muted-foreground"
                          )}>
                            {match.homeScore}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className={cn(
                            "font-bold min-w-[32px] text-center",
                            match.awayScore! > match.homeScore! ? "text-success" : "text-muted-foreground"
                          )}>
                            {match.awayScore}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">vs</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-right">
                      <p className={cn(
                        "font-medium truncate",
                        match.completed && match.awayScore! > match.homeScore! && "text-success"
                      )}>
                        {awayManager?.teamName}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
