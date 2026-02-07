import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Search, X, GripHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/PlayerCard';
import { useGameStore } from '@/store/useGameStore';
import { sortPlayersByPriority } from '@/lib/player-order';
import { cn } from '@/lib/utils';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Player } from '@/lib/supabase-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterGrid } from '@/components/RosterGrid';
import { buildOptimalActive11 } from '@/lib/roster-validation';
import { usePlayerFilters, RoleFilter, NationalityFilter } from '@/hooks/usePlayerFilters';
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

interface AvailablePlayersDrawerProps {
  draftedPlayerIds: string[];
  onSelectPlayer?: (playerId: string) => void;
}

export const AvailablePlayersDrawer = ({ draftedPlayerIds, onSelectPlayer }: AvailablePlayersDrawerProps) => {
  const players = useGameStore(state => state.players);
  const managers = useGameStore(state => state.managers);
  const draftPicks = useGameStore(state => state.draftPicks);
  const config = useGameStore(state => state.config);

  const [isExpanded, setIsExpanded] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(60); // percentage of vh
  const [isDragging, setIsDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const windowHeight = window.innerHeight;
      const newHeight = ((windowHeight - e.clientY) / windowHeight) * 100;

      // Clamp between 30vh and 90vh
      if (newHeight >= 30 && newHeight <= 90) {
        setDrawerHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const windowHeight = window.innerHeight;
      const touchY = e.touches[0].clientY;
      const newHeight = ((windowHeight - touchY) / windowHeight) * 100;

      if (newHeight >= 30 && newHeight <= 90) {
        setDrawerHeight(newHeight);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

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

  // Compute live rosters based on draft picks
  const displayManagers = useMemo(() => {
    // If no draft picks yet, just return original managers (or empty rosters if new draft)
    if (draftPicks.length === 0) return managers;

    return managers.map(manager => {
      const managerPicks = draftPicks.filter(p => p.managerId === manager.id);

      // Map picks to player objects
      const pickedPlayers = managerPicks
        .map(p => players.find(player => player.id === p.playerId))
        .filter((p): p is Player => p !== undefined);

      // Distribute into Active and Bench using the validation logic
      let { active, bench } = buildOptimalActive11(pickedPlayers, config);

      if (manager.teamName === 'Run') {
        console.log(`[Drawer Debug] Picks=${managerPicks.length}, Resolved=${pickedPlayers.length}`);
        console.log(`[Drawer] Run Team: All=${pickedPlayers.length}, Active=${active.length}, Bench=${bench.length}`);
        console.log(`[Drawer] Config: ActiveSize=${config.activeSize}, BenchSize=${config.benchSize}`);

        // Debug attachment
        (manager as any)._debugInfo = {
          picks: managerPicks.length,
          resolved: pickedPlayers.length,
          active: active.length,
          bench: bench.length,
          cfgActive: config.activeSize,
          cfgBench: config.benchSize
        };
      }

      // SAFEGUARD: Ensure no players are lost
      const processedIds = new Set([...active, ...bench].map(p => p.id));
      const missingPlayers = pickedPlayers.filter(p => !processedIds.has(p.id));

      if (missingPlayers.length > 0) {
        console.warn(`[Drawer] Found ${missingPlayers.length} missing players for ${manager.teamName}, forcing to bench`, missingPlayers);
        bench = [...bench, ...missingPlayers];
      }

      return {
        ...manager,
        activeRoster: active.map(p => p.id),
        bench: bench.map(p => p.id)
      };
    });
  }, [managers, draftPicks, players, config]);

  return (
    <>
      <div
        ref={drawerRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[60] bg-background border-t border-border shadow-lg pb-[env(safe-area-inset-bottom)]",
          !isDragging && "transition-all duration-300",
          isExpanded ? "flex flex-col" : "h-[calc(3.5rem+env(safe-area-inset-bottom))]"
        )}
        style={isExpanded ? { height: `${drawerHeight}vh` } : {}}
      >
        {/* Drag Handle Area */}
        {isExpanded && (
          <div
            className="w-full h-4 absolute top-0 left-0 -mt-2 z-50 cursor-ns-resize flex items-end justify-center group"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onTouchStart={(e) => {
              setIsDragging(true);
            }}
          >
            {/* Invisible hit area extends up, visible handle is inside the drawer header effectively */}
          </div>
        )}

        {/* Header / Toggle Bar */}
        <button
          onClick={() => !isDragging && setIsExpanded(!isExpanded)}
          className="w-full h-12 flex items-center justify-between px-4 bg-muted/50 hover:bg-muted transition-colors flex-shrink-0 relative border-b border-border/50"
        >
          {isExpanded && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2">
              <div className="w-12 h-1 bg-muted-foreground/20 rounded-full" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Draft Board</span>
            {!isExpanded && (
              <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                {filteredPlayers.length} Available
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
          <Tabs defaultValue="available" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-[calc(100%-2rem)] mx-4 grid grid-cols-2 h-9 p-0.5 mt-2">
              <TabsTrigger value="available" className="text-xs h-full">Available Players <span className="ml-2 text-[10px] opacity-70">({filteredPlayers.length})</span></TabsTrigger>
              <TabsTrigger value="rosters" className="text-xs h-full">Team Rosters</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="flex-1 flex flex-col overflow-hidden data-[state=active]:flex mt-2">
              {/* Filters Section */}
              <div className="px-4 py-2 border-b border-border space-y-2 flex-shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players..."
                    className="pl-9 h-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                {/* Filters Sections */}
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
                  {/* Team Filter */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Team</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTeam(null)}
                        className={cn(
                          "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-all",
                          !selectedTeam
                            ? "bg-primary/20 text-primary border-primary/20"
                            : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                        )}
                      >
                        All
                      </button>
                      {availableTeams.map((team) => {
                        const styles = getTeamPillStyles(team, selectedTeam === team);
                        return (
                          <button
                            key={team}
                            onClick={() => setSelectedTeam(selectedTeam === team ? null : team)}
                            className={cn(
                              "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-all",
                              styles.className,
                              !selectedTeam && "opacity-80 hover:opacity-100"
                            )}
                            style={styles.style}
                          >
                            {team}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Position & Nationality Row */}
                  <div className="flex flex-row gap-8 overflow-x-auto pb-1">
                    {/* Position Filter */}
                    <div className="space-y-2 flex-shrink-0">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Position</h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedRole('All')}
                          className={cn(
                            "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-all",
                            selectedRole === 'All'
                              ? "bg-primary/20 text-primary border-primary/20"
                              : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                          )}
                        >
                          All
                        </button>
                        {Object.keys(roleAbbreviations).map((role) => (
                          role !== 'All' && (
                            <button
                              key={role}
                              onClick={() => setSelectedRole(role as RoleFilter)}
                              className={cn(
                                "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                                selectedRole === role
                                  ? ROLE_AND_NATIONALITY_COLORS[role as keyof typeof ROLE_AND_NATIONALITY_COLORS]
                                  : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                              )}
                            >
                              {role}
                            </button>
                          )
                        ))}
                      </div>
                    </div>

                    {/* Nationality Filter */}
                    <div className="space-y-2 flex-shrink-0">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nationality</h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedNationality('All')}
                          className={cn(
                            "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-all",
                            selectedNationality === 'All'
                              ? "bg-primary/20 text-primary border-primary/20"
                              : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                          )}
                        >
                          All
                        </button>
                        {['International', 'Domestic'].map((nat) => (
                          <button
                            key={nat}
                            onClick={() => setSelectedNationality(nat as NationalityFilter)}
                            className={cn(
                              "flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                              selectedNationality === nat
                                ? ROLE_AND_NATIONALITY_COLORS[nat as keyof typeof ROLE_AND_NATIONALITY_COLORS]
                                : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                            )}
                          >
                            {nat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player List */}
              <div className="flex-1 overflow-y-auto p-4 pb-20">
                {filteredPlayers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                    <p>No players match your filters</p>
                    {activeFiltersCount > 0 && (
                      <Button variant="link" onClick={clearFilters} className="mt-2 h-auto p-0">
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {sortPlayersByPriority(filteredPlayers).map((player) => (
                      <div
                        key={player.id}
                        onClick={() => onSelectPlayer ? onSelectPlayer(player.id) : setDetailPlayer(player)}
                        className={cn(
                          "cursor-pointer transition-transform hover:scale-[1.02]",
                          onSelectPlayer && "hover:ring-2 hover:ring-primary rounded-lg"
                        )}
                      >
                        <PlayerCard
                          player={player}
                          isOwned={false}
                          showActions={false}
                          variant="compact"
                          managerName={playerToManagerMap[player.id]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="rosters" className="flex-1 overflow-y-auto w-full data-[state=active]:block mt-0 pb-[env(safe-area-inset-bottom)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {displayManagers.map(manager => (
                  <div key={manager.id} className="min-h-[400px] space-y-2 flex flex-col bg-card/30 rounded-xl border border-border/50 p-2">
                    <div className="flex justify-between items-center py-1 border-b px-1">
                      <h3 className="font-bold text-sm truncate max-w-[70%]">
                        {manager.teamName}
                        {(manager as any)._debugInfo && (
                          <span className="text-[10px] ml-2 text-yellow-500 font-mono">
                            P:{(manager as any)._debugInfo.picks}/
                            R:{(manager as any)._debugInfo.resolved}
                            Activ:{(manager as any)._debugInfo.active}/
                            ActCfg:{(manager as any)._debugInfo.cfgActive}
                            Bnch:{(manager as any)._debugInfo.bench}/
                            BnchCfg:{(manager as any)._debugInfo.cfgBench}
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full whitespace-nowrap">
                        {(manager.activeRoster?.length || 0) + (manager.bench?.length || 0)} / {config.activeSize + config.benchSize}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <RosterGrid
                        manager={manager}
                        config={config}
                        players={players}
                        compact={false}
                        onPlayerClick={setDetailPlayer}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div >

      {detailPlayer && (
        <PlayerDetailDialog
          player={detailPlayer}
          open={!!detailPlayer}
          onOpenChange={(open) => !open && setDetailPlayer(null)}
        />
      )
      }
    </>
  );
};
