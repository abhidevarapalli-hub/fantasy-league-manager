import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/PlayerCard';
import { useGameStore } from '@/store/useGameStore';
import { sortPlayersByPriority } from '@/lib/player-order';
import { cn } from '@/lib/utils';

import { usePlayerFilters } from '@/hooks/usePlayerFilters';
import { getTeamFilterColors, getTeamPillStyles } from '@/lib/team-colors';

const ROLE_AND_NATIONALITY_COLORS = {
  Batsman: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'All Rounder': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Wicket Keeper': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Domestic: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  International: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  All: 'bg-primary/20 text-primary border-primary/30',
};

const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
  'All': 'All',
};

// Role and nationality filter colors are now defined in constants above

interface AvailablePlayersDrawerProps {
  draftedPlayerIds: string[];
  onSelectPlayer?: (playerId: string) => void;
}

export const AvailablePlayersDrawer = ({ draftedPlayerIds, onSelectPlayer }: AvailablePlayersDrawerProps) => {
  const players = useGameStore(state => state.players);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    selectedTeam,
    setSelectedTeam,
    selectedRole,
    setSelectedRole,
    selectedNationality,
    setSelectedNationality,
    filteredPlayers,
    availableTeams,
    activeFiltersCount,
    clearFilters
  } = usePlayerFilters({
    players: useMemo(() => players.filter(p => !draftedPlayerIds.includes(p.id)), [players, draftedPlayerIds])
  });

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[60] bg-background border-t border-border shadow-lg transition-all duration-300 pb-[env(safe-area-inset-bottom)]",
        isExpanded ? "h-[60vh]" : "h-[calc(3.5rem+env(safe-area-inset-bottom))]"
      )}
    >
      {/* Header / Toggle Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-14 flex items-center justify-between px-4 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">Available Players</span>
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
            {filteredPlayers.length} remaining
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="flex flex-col h-[calc(60vh-3.5rem)] overflow-hidden">
          {/* Filters Section */}
          <div className="px-4 py-3 border-b border-border space-y-3 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {(searchQuery || activeFiltersCount > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {/* Team Pills */}
              <div className="flex flex-wrap gap-1">
                {availableTeams.map(team => {
                  const styles = getTeamPillStyles(team, selectedTeam === team);
                  return (
                    <button
                      key={team}
                      onClick={() => setSelectedTeam(selectedTeam === team ? 'All' : team)}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                        styles.className
                      )}
                      style={styles.style}
                    >
                      {team}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role and Nationality Pills */}
            <div className="flex flex-wrap gap-2">
              {/* Role Pills */}
              <div className="flex flex-wrap gap-1">
                {['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'].map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(selectedRole === role ? 'All' : role as any)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                      selectedRole === role
                        ? ROLE_AND_NATIONALITY_COLORS[role as keyof typeof ROLE_AND_NATIONALITY_COLORS]
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {roleAbbreviations[role] || role}
                  </button>
                ))}
              </div>

              {/* Nationality Pills */}
              <div className="flex gap-1 ml-2">
                {['All', 'Domestic', 'International'].map(nat => (
                  <button
                    key={nat}
                    onClick={() => setSelectedNationality(nat as any)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                      selectedNationality === nat
                        ? ROLE_AND_NATIONALITY_COLORS[nat as keyof typeof ROLE_AND_NATIONALITY_COLORS]
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {nat === 'International' ? 'Intl' : nat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Players Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredPlayers.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No players match your filters
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    onClick={() => onSelectPlayer?.(player.id)}
                    className={cn(
                      "cursor-pointer transition-transform hover:scale-[1.02]",
                      onSelectPlayer && "hover:ring-2 hover:ring-primary rounded-lg"
                    )}
                  >
                    <PlayerCard
                      player={player}
                      variant="compact"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
