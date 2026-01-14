import { useGameStore } from '@/store/gameStore';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Users, UserMinus } from 'lucide-react';

const Roster = () => {
  const { managers, players, currentManagerId, moveToActive, moveToBench, dropPlayer } = useGameStore();
  
  const currentManager = managers.find(m => m.id === currentManagerId);
  
  if (!currentManager) return null;

  const activePlayers = currentManager.activeRoster.map(id => players.find(p => p.id === id)!).filter(Boolean);
  const benchPlayers = currentManager.bench.map(id => players.find(p => p.id === id)!).filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">{currentManager.teamName}</h1>
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
              <p className="text-xs text-muted-foreground">Your starting lineup</p>
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
                  onMoveDown={benchPlayers.length < 3 ? () => moveToBench(currentManagerId, player.id) : undefined}
                  onDrop={() => dropPlayer(currentManagerId, player.id)}
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
                  onMoveUp={activePlayers.length < 11 ? () => moveToActive(currentManagerId, player.id) : undefined}
                  onDrop={() => dropPlayer(currentManagerId, player.id)}
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
