import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Player } from '@/lib/supabase-types';
import { useState } from 'react';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { RosterGrid } from '@/components/RosterGrid';

const Roster = () => {
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Zustand selectors
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const currentManagerId = useGameStore(state => state.currentManagerId);

  const activeManager = managers.find(m => m.id === currentManagerId) || managers[0];

  return (
    <AppLayout title="Team Rosters" subtitle="Click on a team name to manage roster">
      <div className="flex-1 overflow-x-auto w-full">
        {/* Horizontal scrollable row for all teams */}
        <div className="flex flex-row gap-0 min-w-max pb-20">
          {managers.map(manager => (
            <div key={manager.id} className="w-[320px] md:w-[380px] flex-shrink-0 space-y-4 bg-card/20 border-r border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <button
                  onClick={() => navigate(`/${leagueId}/team/${manager.id}`)}
                  className="group text-left"
                >
                  <h2 className="text-lg font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
                    {manager.teamName}
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      {(manager.activeRoster?.length || 0) + (manager.bench?.length || 0)} / {config.activeSize + config.benchSize}
                    </Badge>
                  </h2>
                </button>
              </div>

              <RosterGrid
                manager={manager}
                config={config}
                players={players}
                onPlayerClick={setDetailPlayer}
              />
            </div>
          ))}
        </div>

        {managers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card/20 rounded-xl border border-dashed">
            No teams found in this league.
          </div>
        )}
      </div>

      <PlayerDetailDialog
        player={detailPlayer}
        open={!!detailPlayer}
        onOpenChange={(open) => !open && setDetailPlayer(null)}
      />
    </AppLayout>
  );
};

export default Roster;
