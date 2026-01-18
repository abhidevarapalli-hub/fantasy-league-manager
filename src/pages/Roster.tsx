import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BottomNav } from '@/components/BottomNav';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTIVE_ROSTER_SIZE, BENCH_SIZE } from '@/lib/roster-validation';

const Roster = () => {
  const navigate = useNavigate();
  const { managers, getManagerRosterCount } = useGame();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Team Rosters</h1>
          <p className="text-xs text-muted-foreground">Select a team to view and manage roster</p>
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="space-y-2">
          {managers.map(manager => {
            const rosterCount = getManagerRosterCount(manager.id);
            return (
              <button
                key={manager.id}
                onClick={() => navigate(`/team/${manager.id}`)}
                className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">
                      {manager.teamName.charAt(0)}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground">{manager.teamName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {rosterCount}/{ACTIVE_ROSTER_SIZE + BENCH_SIZE} Players • {manager.wins}W - {manager.losses}L
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    rosterCount === 0 
                      ? "bg-muted text-muted-foreground"
                      : rosterCount < ACTIVE_ROSTER_SIZE + BENCH_SIZE 
                        ? "bg-primary/20 text-primary"
                        : "bg-success/20 text-success"
                  )}>
                    {rosterCount === 0 ? 'Empty' : rosterCount === ACTIVE_ROSTER_SIZE + BENCH_SIZE ? 'Full' : `${rosterCount} players`}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Roster;
