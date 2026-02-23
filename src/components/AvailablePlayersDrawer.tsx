import { useState, useMemo, useEffect } from 'react';
import { Search, X, PanelRightOpen, Filter, Zap, Bot, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/PlayerCard';
import { useGameStore } from '@/store/useGameStore';
import { sortPlayersByPriority } from '@/lib/player-order';
import { cn } from '@/lib/utils';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Player } from '@/lib/supabase-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RosterGrid } from '@/components/RosterGrid';
import { DraftTimer, DraftTimerProps } from '@/components/DraftTimer';
import { buildOptimalActive11, validateActiveRoster } from '@/lib/roster-validation';
import { usePlayerFilters, RoleFilter, NationalityFilter } from '@/hooks/usePlayerFilters';
import { getTeamPillStyles } from '@/lib/team-colors';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

interface DebugInfo {
  picks: number;
  resolved: number;
  active: number;
  bench: number;
  cfgActive: number;
  cfgBench: number;
}

interface ManagerWithDebug {
  _debugInfo?: DebugInfo;
}

interface AvailablePlayersDrawerProps {
  draftedPlayerIds: string[];
  onSelectPlayer?: (playerId: string) => void;
  canPick?: boolean;
  onDraftPlayer?: (playerId: string, round?: number, position?: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  targetPick?: { round: number; position: number } | null;
  draftTimerProps?: DraftTimerProps;
}

export const AvailablePlayersDrawer = ({
  draftedPlayerIds,
  onSelectPlayer,
  canPick = false,
  onDraftPlayer,
  open: externalOpen,
  onOpenChange: setExternalOpen,
  targetPick,
  draftTimerProps
}: AvailablePlayersDrawerProps) => {
  const players = useGameStore(state => state.players);
  const managers = useGameStore(state => state.managers);
  const draftPicks = useGameStore(state => state.draftPicks);
  const config = useGameStore(state => state.config);
  const currentManagerId = useGameStore(state => state.currentManagerId);

  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen || setInternalOpen;

  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Initialize selectedManagerId to currentManagerId
  useEffect(() => {
    if (open && !selectedManagerId && managers.length > 0) {
      setSelectedManagerId(currentManagerId || managers[0].id);
    }
  }, [open, managers, currentManagerId, selectedManagerId]);

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
    if (draftPicks.length === 0) return managers;

    return managers.map(manager => {
      const managerPicks = draftPicks.filter(p => p.managerId === manager.id);
      const pickedPlayers = managerPicks
        .map(p => players.find(player => player.id === p.playerId))
        .filter((p): p is Player => p !== undefined);

      const { active, bench } = buildOptimalActive11(pickedPlayers, config);

      return {
        ...manager,
        activeRoster: active.map(p => p.id),
        bench: bench.map(p => p.id)
      };
    });
  }, [managers, draftPicks, players, config]);

  const selectedManager = useMemo(() =>
    displayManagers.find(m => m.id === selectedManagerId) ||
    (displayManagers.length > 0 ? displayManagers[0] : null),
    [displayManagers, selectedManagerId]
  );

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="fixed bottom-4 right-4 z-[50] shadow-2xl rounded-full h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-none"
          >
            <PanelRightOpen className="w-5 h-5" />
            <span className="font-semibold">Draft Board</span>
            {draftedPlayerIds.length > 0 && (
              <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {draftedPlayerIds.length} Picked
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="p-0 sm:max-w-md md:max-w-xl flex flex-col h-full z-[60]">
          <SheetHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              Draft Board
            </SheetTitle>
            {draftTimerProps && (
              <div className="scale-90 origin-right -m-4">
                <DraftTimer {...draftTimerProps} />
              </div>
            )}
          </SheetHeader>

          <Tabs defaultValue="available" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-[calc(100%-3rem)] mx-6 grid grid-cols-2 h-10 p-1 bg-muted">
              <TabsTrigger value="available" className="text-xs h-full uppercase tracking-wider font-semibold">
                Available <span className="ml-2 opacity-70">({filteredPlayers.length})</span>
              </TabsTrigger>
              <TabsTrigger value="rosters" className="text-xs h-full uppercase tracking-wider font-semibold">
                Rosters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="flex-1 flex-col overflow-hidden data-[state=active]:flex h-full mt-0">
              {/* Filters Section */}
              <div className="px-6 py-2 space-y-4 flex-shrink-0 mt-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players..."
                    className="pl-9 h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
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

                {/* Filters Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Team Filter */}
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Team</h3>
                    <Select value={selectedTeam || "all"} onValueChange={(val) => setSelectedTeam(val === "all" ? null : val)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/50 border-transparent focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="All Teams" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="all" className="text-xs font-bold text-muted-foreground">ALL TEAMS</SelectItem>
                        {availableTeams.map(team => (
                          <SelectItem key={team} value={team} className="text-xs font-bold">{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Filter */}
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Role</h3>
                    <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as RoleFilter)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/50 border-transparent focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="All" className="text-xs font-bold text-muted-foreground">ALL ROLES</SelectItem>
                        {Object.keys(roleAbbreviations).filter(r => r !== 'All').map(role => (
                          <SelectItem key={role} value={role} className="text-xs font-bold">{roleAbbreviations[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nationality Filter */}
                  <div className="space-y-1.5 col-span-2 md:col-span-1">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Nationality</h3>
                    <Select value={selectedNationality} onValueChange={(val) => setSelectedNationality(val as NationalityFilter)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/50 border-transparent focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="All Nationalities" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="All" className="text-xs font-bold text-muted-foreground">ALL</SelectItem>
                        <SelectItem value="International" className="text-xs font-bold">INTERNATIONAL</SelectItem>
                        <SelectItem value="Domestic" className="text-xs font-bold">DOMESTIC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Player List */}
              <div className="flex-1 overflow-y-auto mt-4 px-6 pb-32 custom-scrollbar">
                {filteredPlayers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm">
                    <p className="font-medium">No players found</p>
                    {activeFiltersCount > 0 && (
                      <Button variant="link" onClick={clearFilters} className="mt-2 h-auto p-0 font-bold text-primary">
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    {sortPlayersByPriority(filteredPlayers).map((player) => (
                      <div
                        key={player.id}
                        className={cn(
                          "group relative rounded-xl transition-all duration-300",
                          (onSelectPlayer || canPick) && "hover:ring-2 hover:ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div
                          onClick={() => setDetailPlayer(player)}
                          className="cursor-pointer"
                        >
                          <PlayerCard
                            player={player}
                            isOwned={false}
                            showActions={false}
                            variant="compact"
                          />
                        </div>

                        {canPick && onDraftPlayer && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[10px] font-bold bg-primary hover:bg-primary/90 shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailPlayer(player);
                              }}
                            >
                              <Zap className="w-3 h-3 mr-1 fill-current" />
                              DRAFT
                            </Button>
                          </div>
                        )}

                        {(onSelectPlayer || canPick) && (
                          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none rounded-xl" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="rosters" className="flex-1 overflow-hidden w-full data-[state=active]:flex flex-col h-full mt-0">
              {/* Team Selector Row */}
              <div className="px-6 py-3 border-b border-border bg-muted/20 flex flex-col gap-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Team</span>
                  <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 tracking-widest">
                    {(selectedManager?.activeRoster?.length || 0) + (selectedManager?.bench?.length || 0)} / {config.activeSize + config.benchSize}
                  </span>
                </div>
                <Select
                  value={selectedManagerId || undefined}
                  onValueChange={setSelectedManagerId}
                >
                  <SelectTrigger className="w-full h-10 font-semibold bg-background border-border hover:bg-muted/50 transition-all">
                    <SelectValue placeholder="Select Team" />
                  </SelectTrigger>
                  <SelectContent className="z-[80]">
                    {displayManagers.map(m => (
                      <SelectItem key={m.id} value={m.id} className="font-semibold">
                        {m.teamName} {m.id === currentManagerId ? '(You)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Single Team Roster View */}
              <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar pb-20">
                {selectedManager ? (() => {
                  const activePlayers = selectedManager.activeRoster
                    .map(id => players.find(p => p.id === id))
                    .filter((p): p is Player => p !== undefined);
                  const validation = validateActiveRoster(activePlayers, config);

                  return (
                    <div className="space-y-6">
                      {/* Validation Errors */}
                      {!validation.isValid && validation.errors.length > 0 && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-destructive mb-1">Roster Requirements Not Met</p>
                              <ul className="text-xs text-destructive/80 space-y-0.5">
                                {validation.errors.map((error, i) => (
                                  <li key={i}>• {error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      <RosterGrid
                        manager={selectedManager}
                        config={config}
                        players={players}
                        compact={false}
                        onPlayerClick={setDetailPlayer}
                      />
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center py-20 text-muted-foreground text-sm italic">
                    <p>Select a team to view their roster</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {detailPlayer && (
        <PlayerDetailDialog
          player={detailPlayer}
          open={!!detailPlayer}
          onOpenChange={(open) => !open && setDetailPlayer(null)}
          onDraft={onDraftPlayer ? () => {
            if (targetPick) {
              onDraftPlayer(detailPlayer.id, targetPick.round, targetPick.position);
            } else {
              onDraftPlayer(detailPlayer.id);
            }
            setDetailPlayer(null); // Close dialog after draft
          } : undefined}
        />
      )}
    </>
  );
};
