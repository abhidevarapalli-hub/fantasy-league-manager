import { useState, useMemo } from 'react';
import { Search, X, Filter, SlidersHorizontal, Trophy, Users, ChevronDown, Plane } from 'lucide-react';
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
import { toast } from 'sonner';
import { usePlayerFantasyTotals } from '@/hooks/usePlayerFantasyTotals';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type PlayerTab = 'search' | 'available' | 'leaders';

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
  const draftState = useGameStore(state => state.draftState);
  const currentLeagueId = useGameStore(state => state.currentLeagueId);

  const { proposeTrade } = useTrades();
  const { totals: fantasyTotals } = usePlayerFantasyTotals(currentLeagueId);

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
  const [activeTab, setActiveTab] = useState<PlayerTab>('available');
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
  // Available tab = free agents only; Leaders tab = all players; Search tab = all players
  // Sort by cumulative fantasy points (highest first) for Available and Leaders tabs
  const filteredPlayers = useMemo(() => {
    const showFreeAgentsOnly = activeTab === 'available';
    const filtered = baseFilteredPlayers.filter(player => {
      const isRostered = playerToManagerMap[player.id];
      const matchesFreeAgentFilter = !showFreeAgentsOnly || !isRostered;
      return matchesFreeAgentFilter;
    });

    // Sort by fantasy points (highest first) when viewing Available or Leaders
    if (activeTab !== 'search') {
      filtered.sort((a, b) => (fantasyTotals[b.id] ?? 0) - (fantasyTotals[a.id] ?? 0));
    }

    return filtered;
  }, [baseFilteredPlayers, playerToManagerMap, activeTab, fantasyTotals]);

  const handleTabChange = (tab: PlayerTab) => {
    setActiveTab(tab);
    if (tab === 'search') {
      // Focus will be on search input
    } else {
      setSearchQuery('');
    }
  };

  const handleAddPlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      setSelectedPlayer(player);
      setDialogOpen(true);
      setDetailSheetOpen(false);
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
      setDetailSheetOpen(false);
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

  const handleDropPlayer = async (playerId: string) => {
    if (!currentUserManagerId) return;
    await useGameStore.getState().dropPlayerOnly(currentUserManagerId, playerId);
    setDetailSheetOpen(false);
  };

  return (
    <AppLayout title="Player Pool" subtitle={`${filteredPlayers.length} players`}>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">

        {/* ===== MOBILE LAYOUT (sm:hidden) ===== */}
        <div className="sm:hidden">
          {/* Row 1: Sleeper-style tabs */}
          <div className="flex items-center border-b border-border/30">
            {([
              { id: 'search' as PlayerTab, label: 'Search', icon: Search },
              { id: 'available' as PlayerTab, label: 'Available', icon: Users },
              { id: 'leaders' as PlayerTab, label: 'Leaders', icon: Trophy },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2.5 transition-all border-b-2 text-[11px] font-semibold",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Row 2: Search input (only for search tab) OR Position filters */}
          {activeTab === 'search' ? (
            <div className="px-3 py-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-muted/40 border border-border/40 rounded-lg py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {/* Team filter popover button */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all shrink-0",
                    selectedTeam !== 'All'
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
                  )}>
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {selectedTeam !== 'All' ? selectedTeam : 'Team'}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start" side="bottom">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Filter by Team</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTeams.map((team) => {
                      const styles = getTeamPillStyles(team, selectedTeam === team);
                      return (
                        <button
                          key={team}
                          onClick={() => setSelectedTeam(team)}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all border uppercase tracking-tighter",
                            styles.className
                          )}
                          style={styles.style}
                        >
                          {team}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Intl / Domestic toggle */}
              <button
                onClick={() => setSelectedNationality(selectedNationality === 'All' ? 'Domestic' : selectedNationality === 'Domestic' ? 'International' as NationalityFilter : 'All')}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all shrink-0",
                  selectedNationality !== 'All'
                    ? "bg-secondary/20 text-secondary border-secondary/30"
                    : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
                )}
              >
                <Plane className="w-3.5 h-3.5" />
                {selectedNationality === 'All' ? 'All' : selectedNationality === 'Domestic' ? 'DOM' : 'INTL'}
              </button>

              {/* Position filter buttons */}
              {['All', 'Wicket Keeper', 'Batsman', 'All Rounder', 'Bowler'].map((role) => {
                const shortRole = role === 'All Rounder' ? 'AR' : role === 'Wicket Keeper' ? 'WK' : role === 'Batsman' ? 'BAT' : role === 'Bowler' ? 'BWL' : 'ALL';
                const isActive = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role as RoleFilter)}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {shortRole}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== DESKTOP LAYOUT (hidden sm:block) ===== */}
        <div className="hidden sm:block">
          {/* Row 1: Position Filters + Search */}
          <div className="px-4 py-2 flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 min-w-fit">
              {['All', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'].map((role) => {
                const shortRole = role === 'All Rounder' ? 'AR' : role === 'Wicket Keeper' ? 'WK' : role === 'Batsman' ? 'BAT' : role === 'Bowler' ? 'BOWL' : role;
                const isActive = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role as RoleFilter)}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-bold rounded-md transition-all uppercase tracking-wider",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {shortRole}
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 max-w-xs min-w-[120px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Find player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted/40 border border-border/40 rounded-md py-1.5 pl-8 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted-foreground/20 transition-colors"
                >
                  <X className="w-3 h-3 text-muted-foreground/60" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Nationality + Status Toggles */}
          <div className="px-4 py-1.5 flex items-center justify-between gap-4 border-t border-border/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {['All', 'Domestic', 'International'].map((nationality) => {
                  const shortLabel = nationality === 'Domestic' ? 'DOM' : nationality === 'International' ? 'INTL' : nationality;
                  const isActive = selectedNationality === nationality;
                  return (
                    <button
                      key={nationality}
                      onClick={() => setSelectedNationality(nationality as NationalityFilter)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-medium rounded transition-all uppercase tracking-tight",
                        isActive
                          ? "bg-secondary/20 text-secondary border border-secondary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowOnlyFreeAgents(!showOnlyFreeAgents)}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-sm border transition-all flex items-center justify-center",
                  showOnlyFreeAgents
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40 group-hover:border-primary/50"
                )}>
                  {showOnlyFreeAgents && <Filter className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  showOnlyFreeAgents ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  Free Agents
                </span>
              </button>

              {/* Placeholder for settings icon */}
              <button className="p-1 rounded hover:bg-muted transition-colors">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* Row 3: Team Filter Pills */}
          <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto scrollbar-hide border-t border-border/10">
            {availableTeams.map((team) => {
              const styles = getTeamPillStyles(team, selectedTeam === team);
              return (
                <button
                  key={team}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-semibold rounded transition-all whitespace-nowrap border uppercase tracking-tighter",
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
                isOwned={isOwnPlayer}
                showActions={Boolean(draftState?.isFinalized && ((!rosteredBy && (isLeagueManager || !!currentUserManagerId)) || canTrade || isOwnPlayer))}
                onAdd={draftState?.isFinalized && !rosteredBy && (isLeagueManager || !!currentUserManagerId) ? () => handleAddPlayer(player.id) : undefined}
                onTrade={draftState?.isFinalized && canTrade ? () => handleTradePlayer(player.id) : undefined}
                onDrop={draftState?.isFinalized && isOwnPlayer ? () => handleDropPlayer(player.id) : undefined}
                onClick={() => handlePlayerClick(player)}
                managerName={!isOwnPlayer ? rosteredBy : undefined}
                points={fantasyTotals[player.id] ?? undefined}
                hasStats={fantasyTotals[player.id] != null}
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
          onAdd={!playerToManagerMap[detailPlayer.id] && (isLeagueManager || !!currentUserManagerId) ? () => handleAddPlayer(detailPlayer.id) : undefined}
          onTrade={playerToManagerIdMap[detailPlayer.id] && playerToManagerIdMap[detailPlayer.id] !== currentUserManagerId && !!currentUserManagerId ? () => handleTradePlayer(detailPlayer.id) : undefined}
          onDrop={playerToManagerIdMap[detailPlayer.id] === currentUserManagerId ? () => handleDropPlayer(detailPlayer.id) : undefined}
        />
      )}
    </AppLayout>
  );
};

export default Players;
