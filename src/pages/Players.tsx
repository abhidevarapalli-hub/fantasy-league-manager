import { useState, useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrades } from '@/hooks/useTrades';
import { PlayerCard } from '@/components/PlayerCard';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { RosterManagementDialog } from '@/components/RosterManagementDialog';
import { TradeDialog } from '@/components/TradeDialog';
import { Player, Manager } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { usePlayerFilters, RoleFilter, NationalityFilter } from '@/hooks/usePlayerFilters';
import { getTeamPillStyles } from '@/lib/team-colors';

const ROLE_AND_NATIONALITY_FILTERS = {
  All: 'bg-primary/20 text-primary border-primary/30',
  Batsman: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'All Rounder': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Wicket Keeper': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
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

  // Use centralized filtering hook
  const {
    searchQuery,
    setSearchQuery,
    selectedTeam,
    setSelectedTeam,
    selectedRole,
    setSelectedRole,
    selectedNationality,
    setSelectedNationality,
    filteredPlayers: baseFilteredPlayers,
    availableTeams,
  } = usePlayerFilters({ players });

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

  // Apply additional Free Agent filter on top of the centralized filtered players
  const filteredPlayers = useMemo(() => {
    return baseFilteredPlayers.filter(player => {
      const isRostered = playerToManagerMap[player.id];
      const matchesFreeAgentFilter = !showOnlyFreeAgents || !isRostered;
      return matchesFreeAgentFilter;
    });
  }, [baseFilteredPlayers, playerToManagerMap, showOnlyFreeAgents]);

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
            {availableTeams.map((team) => {
              const styles = getTeamPillStyles(team, selectedTeam === team);
              return (
                <button
                  key={team}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
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

        {/* Role and Nationality Filter Pills - Same Row */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-6">
            {/* Role Filter */}
            <div className="flex-shrink-0">
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Position</p>
              <div className="flex gap-2">
                {['All', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role as RoleFilter)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                      selectedRole === role
                        ? ROLE_AND_NATIONALITY_FILTERS[role as keyof typeof ROLE_AND_NATIONALITY_FILTERS]
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
                {['All', 'Domestic', 'International'].map((nationality) => (
                  <button
                    key={nationality}
                    onClick={() => setSelectedNationality(nationality as NationalityFilter)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                      selectedNationality === nationality
                        ? ROLE_AND_NATIONALITY_FILTERS[nationality as keyof typeof ROLE_AND_NATIONALITY_FILTERS]
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
              <PlayerCard
                key={player.id}
                player={player}
                isOwned={false}
                showActions={(!rosteredBy && (isLeagueManager || !!currentUserManagerId)) || canTrade}
                onAdd={!rosteredBy && (isLeagueManager || !!currentUserManagerId) ? () => handleAddPlayer(player.id) : undefined}
                onTrade={canTrade ? () => handleTradePlayer(player.id) : undefined}
                onClick={() => handlePlayerClick(player)}
                managerName={rosteredBy}
              />
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

      {detailPlayer && (
        <PlayerDetailDialog
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          player={detailPlayer}
          seriesId={tournamentId}
        />
      )}
    </AppLayout>
  );
};

export default Players;
