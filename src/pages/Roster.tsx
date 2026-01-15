import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Users, UserMinus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const Roster = () => {
  const { managers, players, getManagerRosterCount, moveToActive, moveToBench, dropPlayer } = useGameStore();
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  
  const selectedManager = managers.find(m => m.id === selectedManagerId);
  
  if (!selectedManagerId) {
    // Show team selection menu
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
          <div className="px-4 py-3">
            <h1 className="text-lg font-bold text-foreground">Team Rosters</h1>
            <p className="text-xs text-muted-foreground">Select a team to view roster</p>
          </div>
        </header>

        <main className="px-4 py-4">
          <div className="space-y-2">
            {managers.map(manager => {
              const rosterCount = getManagerRosterCount(manager.id);
              return (
                <button
                  key={manager.id}
                  onClick={() => setSelectedManagerId(manager.id)}
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
                        {rosterCount}/14 Players
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      rosterCount === 0 
                        ? "bg-muted text-muted-foreground"
                        : rosterCount < 14 
                          ? "bg-primary/20 text-primary"
                          : "bg-success/20 text-success"
                    )}>
                      {rosterCount === 0 ? 'Empty' : rosterCount === 14 ? 'Full' : `${rosterCount} players`}
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
  }

  if (!selectedManager) return null;

  const activePlayers = selectedManager.activeRoster.map(id => players.find(p => p.id === id)!).filter(Boolean);
  const benchPlayers = selectedManager.bench.map(id => players.find(p => p.id === id)!).filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <button 
            onClick={() => setSelectedManagerId(null)}
            className="text-xs text-primary mb-1 hover:underline"
          >
            ← Back to Teams
          </button>
          <h1 className="text-lg font-bold text-foreground">{selectedManager.teamName}</h1>
          <p className="text-xs text-muted-foreground">
            {activePlayers.length}/11 Active • {benchPlayers.length}/3 Bench
          </p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Active 11 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Active 11</h2>
              <p className="text-xs text-muted-foreground">Starting lineup</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {activePlayers.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-xl border border-dashed border-border">
                <p className="text-muted-foreground">No active players</p>
              </div>
            ) : (
              activePlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isOwned
                  onMoveDown={benchPlayers.length < 3 ? () => moveToBench(selectedManagerId, player.id) : undefined}
                  onDrop={() => dropPlayer(selectedManagerId, player.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Bench */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <UserMinus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Bench</h2>
              <p className="text-xs text-muted-foreground">Reserve players</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {benchPlayers.length === 0 ? (
              <div className="p-6 text-center bg-card rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No bench players</p>
              </div>
            ) : (
              benchPlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isOwned
                  onMoveUp={activePlayers.length < 11 ? () => moveToActive(selectedManagerId, player.id) : undefined}
                  onDrop={() => dropPlayer(selectedManagerId, player.id)}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Roster;
