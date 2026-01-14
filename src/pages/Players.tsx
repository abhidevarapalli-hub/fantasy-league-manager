import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { PlayerCard } from '@/components/PlayerCard';
import { BottomNav } from '@/components/BottomNav';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const IPL_TEAMS = ['All', 'CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'PBKS', 'SRH', 'GT', 'LSG'];

const teamFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  CSK: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  MI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RCB: 'bg-red-500/20 text-red-400 border-red-500/30',
  KKR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DC: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  RR: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  PBKS: 'bg-red-600/20 text-red-300 border-red-600/30',
  SRH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  GT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  LSG: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

const Players = () => {
  const { players, managers, currentManagerId, addPlayer } = useGameStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All');

  const currentManager = managers.find(m => m.id === currentManagerId);
  const ownedPlayerIds = new Set([
    ...(currentManager?.activeRoster || []),
    ...(currentManager?.bench || []),
  ]);

  // All rostered players across all teams
  const allRosteredIds = new Set(
    managers.flatMap(m => [...m.activeRoster, ...m.bench])
  );

  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           player.team.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = selectedTeam === 'All' || player.team === selectedTeam;
      const isAvailable = !allRosteredIds.has(player.id) || ownedPlayerIds.has(player.id);
      return matchesSearch && matchesTeam && isAvailable;
    });
  }, [players, searchQuery, selectedTeam, allRosteredIds, ownedPlayerIds]);

  const canAddMore = currentManager && 
    (currentManager.activeRoster.length + currentManager.bench.length) < 14;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Player Pool</h1>
          <p className="text-xs text-muted-foreground">{filteredPlayers.length} players available</p>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-muted border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        
        {/* Team Filter Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {IPL_TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                  selectedTeam === team 
                    ? teamFilterColors[team] 
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {team}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="space-y-2">
          {filteredPlayers.map(player => {
            const isOwned = ownedPlayerIds.has(player.id);
            
            return (
              <PlayerCard
                key={player.id}
                player={player}
                isOwned={isOwned}
                onAdd={!isOwned && canAddMore ? () => addPlayer(currentManagerId, player.id) : undefined}
                showActions={!isOwned && canAddMore}
              />
            );
          })}
          
          {filteredPlayers.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No players found</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Players;
