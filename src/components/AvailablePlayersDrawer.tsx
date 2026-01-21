import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/PlayerCard';
import { useGame } from '@/contexts/GameContext';
import { sortPlayersByPriority } from '@/lib/player-order';
import { cn } from '@/lib/utils';

// Filter options
const IPL_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'PBKS', 'SRH', 'GT', 'LSG'];
const PLAYER_ROLES = ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'];
const NATIONALITY_FILTERS = ['All', 'Domestic', 'International'];

// Filter colors
const teamFilterColors: Record<string, string> = {
  CSK: 'bg-[#FFCB05] text-black border-[#FFCB05]',
  MI: 'bg-[#004B91] text-white border-[#004B91]',
  RCB: 'bg-[#800000] text-white border-[#800000]',
  KKR: 'bg-[#3A225D] text-white border-[#3A225D]',
  DC: 'bg-[#000080] text-white border-[#000080]',
  RR: 'bg-[#EB71A6] text-white border-[#EB71A6]',
  PBKS: 'bg-[#B71E24] text-white border-[#B71E24]',
  SRH: 'bg-[#FF822A] text-white border-[#FF822A]',
  GT: 'bg-[#1B223D] text-white border-[#1B223D]',
  LSG: 'bg-[#2ABFCB] text-white border-[#2ABFCB]',
};

const roleFilterColors: Record<string, string> = {
  'Batsman': 'bg-primary text-primary-foreground border-primary',
  'Bowler': 'bg-destructive text-destructive-foreground border-destructive',
  'All Rounder': 'bg-accent text-accent-foreground border-accent',
  'Wicket Keeper': 'bg-secondary text-secondary-foreground border-secondary',
};

const nationalityFilterColors: Record<string, string> = {
  'All': 'bg-muted text-foreground border-border',
  'Domestic': 'bg-emerald-600 text-white border-emerald-600',
  'International': 'bg-blue-600 text-white border-blue-600',
};

interface AvailablePlayersDrawerProps {
  draftedPlayerIds: string[];
  onSelectPlayer?: (playerId: string) => void;
}

export const AvailablePlayersDrawer = ({ draftedPlayerIds, onSelectPlayer }: AvailablePlayersDrawerProps) => {
  const { players } = useGame();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedNationality, setSelectedNationality] = useState<string>('All');

  // Filter available players
  const availablePlayers = useMemo(() => {
    let filtered = players.filter(p => !draftedPlayerIds.includes(p.id));

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }

    // Team filter
    if (selectedTeam) {
      filtered = filtered.filter(p => p.team === selectedTeam);
    }

    // Role filter
    if (selectedRole) {
      filtered = filtered.filter(p => p.role === selectedRole);
    }

    // Nationality filter
    if (selectedNationality === 'Domestic') {
      filtered = filtered.filter(p => !p.isInternational);
    } else if (selectedNationality === 'International') {
      filtered = filtered.filter(p => p.isInternational);
    }

    return sortPlayersByPriority(filtered);
  }, [players, draftedPlayerIds, searchQuery, selectedTeam, selectedRole, selectedNationality]);

  const activeFiltersCount = [selectedTeam, selectedRole, selectedNationality !== 'All' ? selectedNationality : null].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTeam(null);
    setSelectedRole(null);
    setSelectedNationality('All');
  };

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border shadow-lg transition-all duration-300",
        isExpanded ? "h-[60vh]" : "h-14"
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
            {availablePlayers.length} remaining
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
                {IPL_TEAMS.map(team => (
                  <button
                    key={team}
                    onClick={() => setSelectedTeam(selectedTeam === team ? null : team)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                      selectedTeam === team
                        ? teamFilterColors[team]
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>

            {/* Role and Nationality Pills */}
            <div className="flex flex-wrap gap-2">
              {/* Role Pills */}
              <div className="flex flex-wrap gap-1">
                {PLAYER_ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                      selectedRole === role
                        ? roleFilterColors[role]
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {role === 'All Rounder' ? 'AR' : role === 'Wicket Keeper' ? 'WK' : role === 'Batsman' ? 'BAT' : 'BOWL'}
                  </button>
                ))}
              </div>

              {/* Nationality Pills */}
              <div className="flex gap-1 ml-2">
                {NATIONALITY_FILTERS.map(nat => (
                  <button
                    key={nat}
                    onClick={() => setSelectedNationality(nat)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all",
                      selectedNationality === nat
                        ? nationalityFilterColors[nat]
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
            {availablePlayers.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No players match your filters
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {availablePlayers.map(player => (
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
