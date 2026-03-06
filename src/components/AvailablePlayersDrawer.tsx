import { useState, useMemo, useEffect } from 'react';
import { Search, X, PanelRightOpen, Filter, Zap, Bot, AlertCircle, Globe2, Plane, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/PlayerCard';
import { useGameStore } from '@/store/useGameStore';
import { sortPlayersByPriority } from '@/lib/player-order';
import { cn } from '@/lib/utils';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Player, Manager } from '@/lib/supabase-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RosterGrid } from '@/components/RosterGrid';
import { DraftTimer, DraftTimerProps } from '@/components/DraftTimer';
import { buildOptimalActive11, validateActiveRoster, LeagueConfig } from '@/lib/roster-validation';
import { usePlayerFilters, RoleFilter, NationalityFilter } from '@/hooks/usePlayerFilters';
import { getTeamPillStyles } from '@/lib/team-colors';
import { DraftPick, DraftState } from '@/lib/draft-types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

const ROLE_AND_NATIONALITY_COLORS = {
  Batsman: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Bowler: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'All Rounder': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Wicket Keeper': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Domestic: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  International: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  All: 'bg-primary/20 text-primary border-primary/30',
};
import { ROLE_ABBREVIATIONS } from '@/lib/draft-constants';

const roleAbbreviations: Record<string, string> = {
  ...ROLE_ABBREVIATIONS,
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
  // Optional overrides for Mock Draft or other contexts
  players?: Player[];
  managers?: Manager[];
  config?: LeagueConfig;
  draftPicks?: DraftPick[];
  draftState?: DraftState;
}

export const AvailablePlayersDrawer = ({
  draftedPlayerIds,
  onSelectPlayer,
  canPick = false,
  onDraftPlayer,
  open: externalOpen,
  onOpenChange: setExternalOpen,
  targetPick,
  draftTimerProps,
  players: propsPlayers,
  managers: propsManagers,
  config: propsConfig,
  draftPicks: propsDraftPicks,
  draftState: propsDraftState
}: AvailablePlayersDrawerProps) => {
  const storePlayers = useGameStore(state => state.players);
  const storeManagers = useGameStore(state => state.managers);
  const storeDraftPicks = useGameStore(state => state.draftPicks);
  const { draftState: storeDraftState, scoringRules, config: storeConfig } = useGameStore();
  const currentManagerId = useGameStore(state => state.currentManagerId);

  // Use props if provided, otherwise fallback to store
  const players = propsPlayers || storePlayers;
  const managers = propsManagers || storeManagers;
  const draftPicks = propsDraftPicks || storeDraftPicks;
  const config = propsConfig || storeConfig;

  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen || setInternalOpen;
  const draftState = propsDraftState || storeDraftState;

  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const isMobile = useIsMobile();
  const [snap, setSnap] = useState<number | string | null>(0.5);
  const [showSearch, setShowSearch] = useState(false);

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

  const triggerButton = isMobile ? (
    <div className="fixed bottom-0 left-0 right-0 z-[50] bg-muted border-t border-border p-3 flex flex-col items-center justify-center cursor-pointer rounded-t-xl hover:bg-muted/80 transition-colors shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
      <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Available Players</span>
    </div>
  ) : (
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
  );

  const drawerContent = (
    <>
      <div className="px-6 pt-6 pb-2 flex flex-row items-center justify-between z-[70] bg-background">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          Draft Board
        </h2>
        {draftTimerProps && (
          <div className="scale-90 origin-right -m-4">
            <DraftTimer {...draftTimerProps} />
          </div>
        )}
      </div>

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
            {/* Search Bar (Conditional) */}
            {showSearch && (
              <div className="flex items-center gap-2 mb-2 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players..."
                    className="pl-9 h-10 w-full bg-muted/50 border-transparent focus:bg-background transition-all rounded-full"
                    autoFocus
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3 text-xs"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearch(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Filters Row */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
              {/* Search Toggle (when collapsed) */}
              {!showSearch && (
                <button
                  onClick={() => setShowSearch(true)}
                  className="w-10 h-10 rounded-full bg-muted/30 flex flex-shrink-0 items-center justify-center hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
                >
                  <Search className="w-4 h-4 text-muted-foreground" />
                </button>
              )}

              {/* Role Filter (Circular Buttons) */}
              <div className="flex gap-2 min-w-max">
                {Object.keys(roleAbbreviations).map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role as RoleFilter)}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      selectedRole === role
                        ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {role === 'All' ? 'ALL' : roleAbbreviations[role]}
                  </button>
                ))}
              </div>

              {/* Right Side Filters */}
              <div className="flex items-center gap-2 min-w-max shrink-0">
                {/* Team Filter */}
                <Select value={selectedTeam || "all"} onValueChange={(val) => setSelectedTeam(val === "all" ? null : val)}>
                  <SelectTrigger className="h-9 w-[110px] text-xs font-semibold bg-muted/50 border-transparent focus:ring-1 focus:ring-primary rounded-full">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="all" className="text-xs font-bold text-muted-foreground">ALL TEAMS</SelectItem>
                    {availableTeams.map(team => (
                      <SelectItem key={team} value={team} className="text-xs font-bold">{team}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Domestic Toggle */}
                <button
                  onClick={() => setSelectedNationality(selectedNationality === 'Domestic' ? 'All' : 'Domestic')}
                  className={cn(
                    "h-9 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5",
                    selectedNationality === 'Domestic'
                      ? "bg-primary/10 text-primary border-primary/50"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  <Home className="w-3.5 h-3.5" />
                  DOM
                </button>
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
              <div className="flex flex-col gap-px bg-border/50 pb-4">
                {sortPlayersByPriority(filteredPlayers).map((player, index) => (
                  <div
                    key={player.id}
                    onClick={() => setDetailPlayer(player)}
                    className={cn(
                      "group bg-background p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-muted/50",
                      (onSelectPlayer || canPick) && "active:bg-muted"
                    )}
                  >
                    {/* Left: Draft Button & Rank */}
                    <div className="flex-shrink-0 flex items-center gap-3">
                      {(canPick && onDraftPlayer) ? (
                        <button
                          className="flex items-center justify-center px-4 py-1.5 bg-[#00e5a0] hover:bg-[#00c98b] text-black rounded-full active:scale-95 transition-all shadow-sm font-bold text-[11px] tracking-widest"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (targetPick) {
                              onDraftPlayer(player.id, targetPick.round, targetPick.position);
                            } else {
                              onDraftPlayer(player.id);
                            }
                          }}
                        >
                          DRAFT
                        </button>
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full border border-border">
                          {player.role === 'Batsman' && <span className="font-bold text-sm text-muted-foreground">🏏</span>}
                          {player.role === 'Bowler' && <span className="font-bold text-sm text-muted-foreground">⚾</span>}
                          {player.role === 'All Rounder' && <span className="font-bold text-sm text-muted-foreground">⚔️</span>}
                          {player.role === 'Wicket Keeper' && <span className="font-bold text-sm text-muted-foreground">🧤</span>}
                        </div>
                      )}

                      {/* Overall Rank Number */}
                      <span className="text-muted-foreground/60 font-bold text-[11px] w-4 text-center">
                        {index + 1}
                      </span>
                    </div>

                    {/* Center: Player Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-sm truncate">{player.name}</span>
                        {player.isInternational && (
                          <Plane className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-muted">
                          {player.role}
                        </span>
                        <span className="truncate">{player.team}</span>
                      </div>
                    </div>
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
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          open={open}
          onOpenChange={setOpen}
          snapPoints={[0.5, 0.9, 1]}
          activeSnapPoint={snap}
          setActiveSnapPoint={setSnap}
          modal={false}
        >
          <DrawerTrigger asChild>
            {triggerButton}
          </DrawerTrigger>
          <DrawerContent
            className="h-[90vh] flex flex-col focus:outline-none focus:ring-0 shadow-2xl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="flex-1 overflow-hidden flex flex-col pt-2">
              {drawerContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            {triggerButton}
          </SheetTrigger>
          <SheetContent side="right" className="p-0 sm:max-w-md md:max-w-xl flex flex-col h-full z-[60]">
            {drawerContent}
          </SheetContent>
        </Sheet>
      )}

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
          managers={managers}
          draftPicks={draftPicks}
          draftState={draftState}
          isMyTurn={canPick}
        />
      )}
    </>
  );
};
