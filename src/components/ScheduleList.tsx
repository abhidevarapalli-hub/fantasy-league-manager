import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Match, Manager } from '@/lib/supabase-types';
import { Calendar, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { MatchupDetail } from './MatchupDetail';

interface HeadToHead {
  id: string;
  manager1_id: string;
  manager2_id: string;
  manager1_wins: number;
  manager2_wins: number;
}

interface ScheduleListProps {
  schedule: Match[];
  managers: Manager[];
  currentWeek: number;
}

export const ScheduleList = ({ schedule, managers, currentWeek }: ScheduleListProps) => {
  const [headToHead, setHeadToHead] = useState<HeadToHead[]>([]);
  const managerProfile = useAuthStore(state => state.managerProfile);

  // Find the logged-in user's manager
  const loggedInManager = managerProfile ? managers.find(m => m.id === managerProfile.id) : null;


  useEffect(() => {
    const fetchH2H = async () => {
      const { data } = await supabase.from('head_to_head').select('*');
      if (data) setHeadToHead(data);
    };
    fetchH2H();
  }, []);

  const getManager = (id: string) => managers.find(m => m.id === id);

  // Check if this match involves the logged-in user's team
  const isUserMatch = (match: Match): boolean => {
    if (!loggedInManager) return false;
    return match.home === loggedInManager.id || match.away === loggedInManager.id;
  };

  // Get historical H2H record between two managers (by ID)
  const getHistoricalH2H = (manager1Id: string, manager2Id: string): { wins: number; losses: number } => {
    const record = headToHead.find(
      h => (h.manager1_id === manager1Id && h.manager2_id === manager2Id) ||
        (h.manager1_id === manager2Id && h.manager2_id === manager1Id)
    );

    if (!record) return { wins: 0, losses: 0 };

    if (record.manager1_id === manager1Id) {
      return { wins: record.manager1_wins, losses: record.manager2_wins };
    } else {
      return { wins: record.manager2_wins, losses: record.manager1_wins };
    }
  };

  // Calculate current season H2H from completed matches (by ID)
  const getCurrentSeasonH2H = (manager1Id: string, manager2Id: string): { wins: number; losses: number } => {
    let wins = 0;
    let losses = 0;

    schedule.filter(match => match.completed).forEach(match => {
      if (match.homeScore === undefined || match.awayScore === undefined) return;

      // Check if this match involves both managers
      const isHome1 = match.home === manager1Id && match.away === manager2Id;
      const isAway1 = match.away === manager1Id && match.home === manager2Id;

      if (isHome1) {
        if (match.homeScore > match.awayScore) wins++;
        else losses++;
      } else if (isAway1) {
        if (match.awayScore > match.homeScore) wins++;
        else losses++;
      }
    });

    return { wins, losses };
  };

  // Combined H2H (historical + current season)
  const getCombinedH2H = (manager1Id: string, manager2Id: string): { wins: number; losses: number } => {
    const historical = getHistoricalH2H(manager1Id, manager2Id);
    const current = getCurrentSeasonH2H(manager1Id, manager2Id);
    return {
      wins: historical.wins + current.wins,
      losses: historical.losses + current.losses
    };
  };

  const groupedByWeek = schedule.reduce((acc, match) => {
    if (!acc[match.week]) acc[match.week] = [];
    acc[match.week].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  /* Add state for selected match */
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  /* ... existing code ... */

  return (
    <div className="space-y-4">
      {Object.entries(groupedByWeek).map(([week, matches]) => (
        <div key={week} className="bg-card rounded-xl border border-border overflow-hidden">
          {/* ... existing header ... */}
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
              const h2h = homeManager && awayManager
                ? getCombinedH2H(homeManager.id, awayManager.id)
                : { wins: 0, losses: 0 };
              const userPlaying = isUserMatch(match);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedMatch(match)}
                  className={cn(
                    "px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    userPlaying && "bg-secondary/10 border-l-2 border-l-secondary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        match.homeScore !== undefined && match.awayScore !== undefined && match.homeScore > match.awayScore && "text-success"
                      )}>
                        {homeManager?.teamName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 px-4">
                      {match.homeScore !== undefined && match.awayScore !== undefined ? (
                        <>
                          <span className={cn(
                            "font-bold min-w-[32px] text-center",
                            match.homeScore > match.awayScore ? "text-success" : "text-muted-foreground"
                          )}>
                            {match.homeScore}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className={cn(
                            "font-bold min-w-[32px] text-center",
                            match.awayScore > match.homeScore ? "text-success" : "text-muted-foreground"
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
                        match.homeScore !== undefined && match.awayScore !== undefined && match.awayScore > match.homeScore && "text-success"
                      )}>
                        {awayManager?.teamName}
                      </p>
                    </div>
                  </div>

                  {/* H2H Record - shows home team's record vs away team */}
                  {homeManager && awayManager && (h2h.wins > 0 || h2h.losses > 0) && (
                    <div className="mt-1 text-center">
                      <span className="text-[10px] text-muted-foreground">
                        All-time: <span className="font-medium text-foreground">{homeManager.name}</span>
                        {' '}
                        <span className={cn(
                          "font-medium",
                          h2h.wins > h2h.losses && "text-success",
                          h2h.wins < h2h.losses && "text-destructive"
                        )}>{h2h.wins}W-{h2h.losses}L</span>
                        {' '}vs {awayManager.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Matchup Detail Modal */}
      {selectedMatch && (
        <MatchupDetail
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          match={selectedMatch}
          homeManager={getManager(selectedMatch.home)}
          awayManager={getManager(selectedMatch.away)}
        />
      )}
    </div>
  );
};


