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
import { toast } from 'sonner';

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
      setDetailSheetOpen(false); // Close detail dialog
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
      setDetailSheetOpen(false); // Close detail dialog
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
    setDetailSheetOpen(false); // Close detail dialog
  };

  return (
    <AppLayout title="Player Pool" subtitle={`${filteredPlayers.length} players`}>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
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

            {/* Placeholder for settings icon like in sleeper */}
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
                showActions={Boolean(draftState?.isFinalized && ((!rosteredBy && (isLeagueManager || !!currentUserManagerId)) || canTrade))}
                onAdd={draftState?.isFinalized && !rosteredBy && (isLeagueManager || !!currentUserManagerId) ? () => handleAddPlayer(player.id) : undefined}
                onTrade={draftState?.isFinalized && canTrade ? () => handleTradePlayer(player.id) : undefined}
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
