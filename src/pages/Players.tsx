import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, X, Filter } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrades } from '@/hooks/useTrades';
import { PlayerCard } from '@/components/PlayerCard';
import { PlayerDetailSheet } from '@/components/PlayerDetailSheet';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RosterManagementDialog } from '@/components/RosterManagementDialog';
import { TradeDialog } from '@/components/TradeDialog';
import { Player, Manager } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { sortPlayersByPriority } from '@/lib/player-order';

const IPL_TEAMS = ['All', 'CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'PBKS', 'SRH', 'GT', 'LSG'];
const PLAYER_ROLES = ['All', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'];
const NATIONALITY_FILTERS = ['All', 'Domestic', 'International'];

const teamFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  SRH: 'bg-[#FF822A]/20 text-[#FF822A] border-[#FF822A]/30',
  CSK: 'bg-[#FFCB05]/20 text-[#FFCB05] border-[#FFCB05]/30',
  KKR: 'bg-[#3A225D]/20 text-[#3A225D] border-[#3A225D]/30',
  RR: 'bg-[#EB71A6]/20 text-[#EB71A6] border-[#EB71A6]/30',
  RCB: 'bg-[#800000]/20 text-[#800000] border-[#800000]/30',
  MI: 'bg-[#004B91]/20 text-[#004B91] border-[#004B91]/30',
  GT: 'bg-[#1B223D]/20 text-[#1B223D] border-[#1B223D]/30',
  LSG: 'bg-[#2ABFCB]/20 text-[#2ABFCB] border-[#2ABFCB]/30',
  PBKS: 'bg-[#B71E24]/20 text-[#B71E24] border-[#B71E24]/30',
  DC: 'bg-[#000080]/20 text-[#000080] border-[#000080]/30',
};

const roleFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  Batsman: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'All Rounder': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Wicket Keeper': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const nationalityFilterColors: Record<string, string> = {
  All: 'bg-primary/20 text-primary border-primary/30',
  Domestic: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  International: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

const Players = () => {
  // Zustand selectors - ONLY re-render when these specific pieces change
  const players = useGameStore(state => state.players);
  const managers = useGameStore(state => state.managers);
  const tournamentId = useGameStore(state => state.tournamentId);
  const managerProfile = useAuthStore(state => state.managerProfile);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());

  const { proposeTrade } = useTrades();
  const [searchQuery, setSearchQuery] = useState('');
  // Debounce search query to prevent re-filtering on every keystroke
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedNationality, setSelectedNationality] = useState('All');
  const [showOnlyFreeAgents, setShowOnlyFreeAgents] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeTargetPlayer, setTradeTargetPlayer] = useState<Player | null>(null);
  const [tradeTargetManager, setTradeTargetManager] = useState<Manager | null>(null);
  // Player detail sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Find the current user's manager ID
  const currentUserManagerId = managerProfile?.id;

  // Get the current user's manager object
  const currentManager = useMemo(() => {
    if (!currentUserManagerId) return null;
    return managers.find(m => m.id === currentUserManagerId) || null;
  }, [currentUserManagerId, managers]);

  // Build a map of player ID -> manager ID
  const playerToManagerIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    managers.forEach(manager => {
      [...manager.activeRoster, ...manager.bench].forEach(playerId => {
        map[playerId] = manager.id;
      });
    });
    return map;
  }, [managers]);

  // Build a map of player ID -> manager team name
  const playerToManagerMap = useMemo(() => {
    const map: Record<string, string> = {};
    managers.forEach(manager => {
      [...manager.activeRoster, ...manager.bench].forEach(playerId => {
        map[playerId] = manager.teamName;
      });
    });
    return map;
  }, [managers]);

  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        player.team.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesTeam = selectedTeam === 'All' || player.team === selectedTeam;
      const matchesRole = selectedRole === 'All' || player.role === selectedRole;
      const matchesNationality = selectedNationality === 'All' ||
        (selectedNationality === 'International' && player.isInternational) ||
        (selectedNationality === 'Domestic' && !player.isInternational);
      const isRostered = playerToManagerMap[player.id];
      const matchesFreeAgentFilter = !showOnlyFreeAgents || !isRostered;
      return matchesSearch && matchesTeam && matchesRole && matchesNationality && matchesFreeAgentFilter;
    });

    return sortPlayersByPriority(filtered);
  }, [players, debouncedSearchQuery, selectedTeam, selectedRole, selectedNationality, playerToManagerMap, showOnlyFreeAgents]);

  const handleAddPlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      setSelectedPlayer(player);
      setDialogOpen(true);
    }
  };

  const handleTradePlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const targetManagerId = playerToManagerIdMap[playerId];
    const targetMgr = managers.find(m => m.id === targetManagerId);

    if (player && targetMgr && currentManager) {
      setTradeTargetPlayer(player);
      setTradeTargetManager(targetMgr);
      setTradeDialogOpen(true);
    }
  };

  const handleTradeSubmit = async (proposerPlayers: string[], targetPlayers: string[]) => {
    if (!currentManager || !tradeTargetManager) return;
    await proposeTrade(currentManager.id, tradeTargetManager.id, proposerPlayers, targetPlayers);
  };

  const handlePlayerClick = (player: Player) => {
    setDetailPlayer(player);
    setDetailSheetOpen(true);
  };

  return (
    <AppLayout title="Player Pool" subtitle={`${filteredPlayers.length} players`}>
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        {/* Search */}
        <div className="px-4 pt-3 pb-2">
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

        {/* Free Agent Filter */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowOnlyFreeAgents(!showOnlyFreeAgents)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              showOnlyFreeAgents
                ? "bg-secondary/20 text-secondary border-secondary/30"
                : "bg-muted/50 text-muted-foreground border-border hover:border-secondary/30"
            )}
          >
            <Filter className="w-3 h-3" />
            {showOnlyFreeAgents ? 'Showing Free Agents Only' : 'Show Free Agents Only'}
          </button>
        </div>

        {/* Team Filter Pills */}
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Team</p>
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

        {/* Role and Nationality Filter Pills - Same Row */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-6">
            {/* Role Filter */}
            <div className="flex-shrink-0">
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Position</p>
              <div className="flex gap-2">
                {PLAYER_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                      selectedRole === role
                        ? roleFilterColors[role]
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Nationality Filter */}
            <div className="flex-shrink-0">
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Nationality</p>
              <div className="flex gap-2">
                {NATIONALITY_FILTERS.map((nationality) => (
                  <button
                    key={nationality}
                    onClick={() => setSelectedNationality(nationality)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                      selectedNationality === nationality
                        ? nationalityFilterColors[nationality]
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {nationality}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-2">
          {filteredPlayers.map(player => {
            const rosteredBy = playerToManagerMap[player.id];
            const rosteredByManagerId = playerToManagerIdMap[player.id];
            const isOwnPlayer = rosteredByManagerId === currentUserManagerId;
            const canTrade = rosteredBy && !isOwnPlayer && !!currentUserManagerId;

            return (
              <div key={player.id}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <PlayerCard
                      player={player}
                      isOwned={false}
                      showActions={(!rosteredBy && (isLeagueManager || !!currentUserManagerId)) || canTrade}
                      onAdd={!rosteredBy && (isLeagueManager || !!currentUserManagerId) ? () => handleAddPlayer(player.id) : undefined}
                      onTrade={canTrade ? () => handleTradePlayer(player.id) : undefined}
                      onClick={() => handlePlayerClick(player)}
                    />
                  </div>
                  {rosteredBy && (
                    <Badge
                      variant="outline"
                      className="bg-muted/80 text-muted-foreground border-border text-[10px] flex-shrink-0"
                    >
                      {rosteredBy}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No players found</p>
            </div>
          )}
        </div>
      </div>

      <RosterManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        player={selectedPlayer}
        preselectedManagerId={isLeagueManager ? undefined : currentUserManagerId}
      />

      <TradeDialog
        open={tradeDialogOpen}
        onOpenChange={setTradeDialogOpen}
        proposerManager={currentManager}
        targetManager={tradeTargetManager}
        initialTargetPlayer={tradeTargetPlayer || undefined}
        onSubmit={handleTradeSubmit}
        mode="propose"
      />

      <PlayerDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        player={detailPlayer}
        seriesId={tournamentId}
      />
    </AppLayout>
  );
};

export default Players;
