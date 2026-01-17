import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';

const TeamView = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { managers, players } = useGame();
  
  const manager = managers.find(m => m.id === teamId);
  
  if (!manager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Team not found</p>
      </div>
    );
  }

  const activePlayers = manager.activeRoster.map(id => players.find(p => p.id === id)!).filter(Boolean);
  const benchPlayers = manager.bench.map(id => players.find(p => p.id === id)!).filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{manager.teamName}</h1>
            <p className="text-xs text-muted-foreground">
              Managed by {manager.name} • {manager.wins}W - {manager.losses}L
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-success">{manager.wins}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{manager.losses}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{manager.points}</p>
            <p className="text-xs text-muted-foreground">Points</p>
          </div>
        </div>

        {/* Active Roster */}
        <section>
          <h2 className="font-semibold text-foreground mb-3">Active 11</h2>
          <div className="space-y-2">
            {activePlayers.length === 0 ? (
              <div className="p-6 text-center bg-card rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No active players</p>
              </div>
            ) : (
              activePlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  showActions={false}
                  variant="compact"
                />
              ))
            )}
          </div>
        </section>

        {/* Bench */}
        {benchPlayers.length > 0 && (
          <section>
            <h2 className="font-semibold text-foreground mb-3">Bench</h2>
            <div className="space-y-2">
              {benchPlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  showActions={false}
                  variant="compact"
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default TeamView;
