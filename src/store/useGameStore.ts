import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Player, Manager, Match, Activity, PlayerTransaction } from '@/lib/supabase-types';
import { DEFAULT_LEAGUE_CONFIG, LeagueConfig, canAddToActive } from '@/lib/roster-validation';

// Helper mappers from DB types to frontend types
const mapDbPlayer = (db: Tables<"players">): Player => ({
    id: db.id,
    name: db.name,
    team: db.team,
    role: db.role as Player["role"],
    isInternational: db.is_international ?? false,
});

const mapDbManager = (db: Tables<"managers">): Manager => ({
    id: db.id,
    name: db.name,
    teamName: db.team_name,
    wins: db.wins,
    losses: db.losses,
    points: db.points,
    activeRoster: db.roster || [],
    bench: db.bench || [],
});

const mapDbSchedule = (db: Tables<"schedule">): Match => ({
    id: db.id,
    week: db.week,
    home: db.home_manager_id || "",
    away: db.away_manager_id || "",
    homeScore: db.home_score ?? undefined,
    awayScore: db.away_score ?? undefined,
    completed: db.is_finalized,
});

const mapDbTransaction = (db: Tables<"transactions">): Activity => ({
    id: db.id,
    timestamp: new Date(db.created_at),
    type: db.type as Activity["type"],
    managerId: db.manager_id || "system",
    description: db.description,
    players: (db.players as unknown as PlayerTransaction[] | null) || undefined,
    managerTeamName: db.manager_team_name || undefined,
});

interface RosterMoveResult {
    success: boolean;
    error?: string;
}

interface GameState {
    // Core data - subscribe to these individually for performance
    players: Player[];
    managers: Manager[];
    schedule: Match[];
    activities: Activity[];
    config: LeagueConfig;
    leagueName: string;
    leagueOwnerId: string | null;
    currentWeek: number;
    currentManagerId: string;
    loading: boolean;
    currentLeagueId: string | null;
    isInitializing: boolean; // Track if initialization is in progress
    initializedLeagueId: string | null; // Track which league is initialized
    isDraftInitialized: boolean; // Track if draft data has been loaded
    isTradesInitialized: boolean; // Track if trades data has been loaded
    isLeaguesInitialized: boolean; // Track if leagues data has been loaded

    // Setters (used internally and by real-time subscriptions)
    setPlayers: (players: Player[]) => void;
    setManagers: (managers: Manager[]) => void;
    setSchedule: (schedule: Match[]) => void;
    setActivities: (activities: Activity[]) => void;
    setConfig: (config: LeagueConfig) => void;
    setLeagueName: (name: string) => void;
    setLeagueOwnerId: (id: string | null) => void;
    setLoading: (loading: boolean) => void;
    setCurrentManagerId: (id: string) => void;
    setCurrentLeagueId: (id: string | null) => void;
    setIsInitializing: (isInitializing: boolean) => void;
    setInitializedLeagueId: (id: string | null) => void;
    setIsDraftInitialized: (isDraftInitialized: boolean) => void;
    setIsTradesInitialized: (isTradesInitialized: boolean) => void;
    setIsLeaguesInitialized: (isLeaguesInitialized: boolean) => void;

    // Real-time mutations (called by Supabase subscriptions)
    addPlayer: (player: Player) => void;
    updatePlayer: (id: string, player: Player) => void;
    removePlayer: (id: string) => void;
    addManager: (manager: Manager) => void;
    updateManager: (id: string, manager: Manager) => void;
    removeManager: (id: string) => void;
    addMatch: (match: Match) => void;
    updateMatch: (id: string, match: Match) => void;
    removeMatch: (id: string) => void;
    addActivity: (activity: Activity) => void;
    updateActivity: (id: string, activity: Activity) => void;
    removeActivity: (id: string) => void;

    // Computed values
    getFreeAgents: () => Player[];
    getManagerRosterCount: (managerId: string) => number;

    // Game actions
    addFreeAgent: (managerId: string, playerId: string, dropPlayerId?: string) => Promise<void>;
    dropPlayerOnly: (managerId: string, playerId: string) => Promise<void>;
    moveToActive: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
    moveToBench: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
    swapPlayers: (managerId: string, player1Id: string, player2Id: string) => Promise<RosterMoveResult>;
    updateMatchScore: (week: number, matchIndex: number, homeScore: number, awayScore: number) => Promise<void>;
    finalizeWeekScores: (week: number) => Promise<void>;
    addNewPlayer: (name: string, team: string, role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper', isInternational?: boolean) => Promise<void>;
    executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => Promise<void>;
    resetLeague: () => Promise<void>;

    // Data fetching
    fetchAllData: (leagueId: string) => Promise<void>;

    // Real-time subscriptions
    subscribeToRealtime: (leagueId: string) => () => void;
}

export const useGameStore = create<GameState>()(
    devtools(
        (set, get) => ({
            // Initial state
            players: [],
            managers: [],
            schedule: [],
            activities: [],
            config: DEFAULT_LEAGUE_CONFIG,
            leagueName: 'IPL Fantasy',
            leagueOwnerId: null,
            currentWeek: 1,
            currentManagerId: '',
            loading: true,
            currentLeagueId: null,
            isInitializing: false,
            initializedLeagueId: null,
            isDraftInitialized: false,
            isTradesInitialized: false,
            isLeaguesInitialized: false,

            // Setters
            setPlayers: (players) => set({ players }),
            setManagers: (managers) => set({ managers }),
            setSchedule: (schedule) => set({ schedule }),
            setActivities: (activities) => set({ activities }),
            setConfig: (config) => set({ config }),
            setLeagueName: (leagueName) => set({ leagueName }),
            setLeagueOwnerId: (leagueOwnerId) => set({ leagueOwnerId }),
            setLoading: (loading) => set({ loading }),
            setCurrentManagerId: (currentManagerId) => set({ currentManagerId }),
            setCurrentLeagueId: (currentLeagueId) => set({ currentLeagueId }),
            setIsInitializing: (isInitializing) => set({ isInitializing }),
            setInitializedLeagueId: (initializedLeagueId) => set({ initializedLeagueId }),
            setIsDraftInitialized: (isDraftInitialized) => set({ isDraftInitialized }),
            setIsTradesInitialized: (isTradesInitialized) => set({ isTradesInitialized }),
            setIsLeaguesInitialized: (isLeaguesInitialized) => set({ isLeaguesInitialized }),

            // Real-time mutations - these trigger granular re-renders
            addPlayer: (player) => set((state) => ({ players: [...state.players, player] })),
            updatePlayer: (id, player) => set((state) => ({
                players: state.players.map(p => p.id === id ? player : p)
            })),
            removePlayer: (id) => set((state) => ({
                players: state.players.filter(p => p.id !== id)
            })),

            addManager: (manager) => set((state) => ({ managers: [...state.managers, manager] })),
            updateManager: (id, manager) => set((state) => ({
                managers: state.managers.map(m => m.id === id ? manager : m)
            })),
            removeManager: (id) => set((state) => ({
                managers: state.managers.filter(m => m.id !== id)
            })),

            addMatch: (match) => set((state) => ({ schedule: [...state.schedule, match] })),
            updateMatch: (id, match) => set((state) => ({
                schedule: state.schedule.map(s => s.id === id ? match : s)
            })),
            removeMatch: (id) => set((state) => ({
                schedule: state.schedule.filter(s => s.id !== id)
            })),

            addActivity: (activity) => set((state) => ({
                activities: [activity, ...state.activities]
            })),
            updateActivity: (id, activity) => set((state) => ({
                activities: state.activities.map(a => a.id === id ? activity : a)
            })),
            removeActivity: (id) => set((state) => ({
                activities: state.activities.filter(a => a.id !== id)
            })),

            // Computed values
            getFreeAgents: () => {
                const { players, managers } = get();
                const rosteredIds = new Set(managers.flatMap((m) => [...m.activeRoster, ...m.bench]));
                return players.filter((p) => !rosteredIds.has(p.id));
            },

            getManagerRosterCount: (managerId: string) => {
                const { managers } = get();
                const manager = managers.find((m) => m.id === managerId);
                if (!manager) return 0;
                return manager.activeRoster.length + manager.bench.length;
            },

            // Actions - implement all game logic
            addFreeAgent: async (managerId, playerId, dropPlayerId) => {
                const { managers, players, config, currentLeagueId } = get();
                const manager = managers.find((m) => m.id === managerId);
                const player = players.find((p) => p.id === playerId);
                const dropPlayer = dropPlayerId ? players.find((p) => p.id === dropPlayerId) : null;

                if (!manager || !player) return;

                const ROSTER_CAP = config.activeSize + config.benchSize;
                const rosterCount = manager.activeRoster.length + manager.bench.length;
                if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

                const droppedFromActive = dropPlayerId && manager.activeRoster.includes(dropPlayerId);

                let newRoster = [...manager.activeRoster];
                let newBench = [...manager.bench];

                if (dropPlayerId) {
                    newRoster = newRoster.filter((id) => id !== dropPlayerId);
                    newBench = newBench.filter((id) => id !== dropPlayerId);
                }

                if (droppedFromActive) {
                    const currentActivePlayers = newRoster.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
                    const validation = canAddToActive(currentActivePlayers, player, config);

                    if (validation.isValid) {
                        newRoster = [...newRoster, playerId];
                    } else {
                        newBench = [...newBench, playerId];
                    }
                } else {
                    newBench = [...newBench, playerId];
                }

                await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);

                const playerTransactions: PlayerTransaction[] = [];
                if (dropPlayer) {
                    playerTransactions.push({ type: "drop", playerName: dropPlayer.name, role: dropPlayer.role, team: dropPlayer.team });
                }
                playerTransactions.push({ type: "add", playerName: player.name, role: player.role, team: player.team });

                const description = dropPlayer
                    ? `${manager.teamName} dropped ${dropPlayer.name}, added ${player.name}`
                    : `${manager.teamName} added ${player.name}`;

                await supabase.from("transactions").insert({
                    type: "add" as any,
                    manager_id: managerId,
                    manager_team_name: manager.teamName,
                    description,
                    players: playerTransactions as any,
                    league_id: currentLeagueId,
                });
            },

            dropPlayerOnly: async (managerId, playerId) => {
                const { managers, players, currentLeagueId } = get();
                const manager = managers.find((m) => m.id === managerId);
                const player = players.find((p) => p.id === playerId);
                if (!manager || !player) return;

                const newRoster = manager.activeRoster.filter((id) => id !== playerId);
                const newBench = manager.bench.filter((id) => id !== playerId);

                await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
                await supabase.from("transactions").insert({
                    type: "drop" as any,
                    manager_id: managerId,
                    manager_team_name: manager.teamName,
                    description: `${manager.teamName} dropped ${player.name}`,
                    players: [{ type: "drop", playerName: player.name, role: player.role, team: player.team }] as any,
                    league_id: currentLeagueId,
                });
            },

            moveToActive: async (managerId, playerId) => {
                const { managers, players, config } = get();
                const manager = managers.find((m) => m.id === managerId);
                const player = players.find((p) => p.id === playerId);
                if (!manager || !player) return { success: false, error: "Manager or player not found" };
                if (manager.activeRoster.length >= config.activeSize) {
                    return { success: false, error: `Active roster is full (${config.activeSize} players max)` };
                }

                const currentActivePlayers = manager.activeRoster.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
                const validation = canAddToActive(currentActivePlayers, player, config);
                if (!validation.isValid) return { success: false, error: validation.errors[0] };

                const newRoster = [...manager.activeRoster, playerId];
                const newBench = manager.bench.filter((id) => id !== playerId);
                await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
                return { success: true };
            },

            moveToBench: async (managerId, playerId) => {
                const { managers, config } = get();
                const manager = managers.find((m) => m.id === managerId);
                if (!manager) return { success: false, error: "Manager not found" };
                if (manager.bench.length >= config.benchSize) {
                    return { success: false, error: `Bench is full (${config.benchSize} players max)` };
                }

                const newBench = [...manager.bench, playerId];
                const newRoster = manager.activeRoster.filter((id) => id !== playerId);
                await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
                return { success: true };
            },

            swapPlayers: async (managerId, player1Id, player2Id) => {
                const { managers } = get();
                const manager = managers.find((m) => m.id === managerId);
                if (!manager) return { success: false, error: "Manager not found" };

                const player1InActive = manager.activeRoster.includes(player1Id);
                const player2InActive = manager.activeRoster.includes(player2Id);

                let newRoster = [...manager.activeRoster];
                let newBench = [...manager.bench];

                if (player1InActive && !player2InActive) {
                    newRoster = newRoster.filter(id => id !== player1Id).concat(player2Id);
                    newBench = newBench.filter(id => id !== player2Id).concat(player1Id);
                } else if (!player1InActive && player2InActive) {
                    newRoster = newRoster.filter(id => id !== player2Id).concat(player1Id);
                    newBench = newBench.filter(id => id !== player1Id).concat(player2Id);
                } else {
                    return { success: false, error: "Players must be in different sections to swap" };
                }

                await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
                return { success: true };
            },

            updateMatchScore: async (week, matchIndex, homeScore, awayScore) => {
                const { schedule } = get();
                const weekMatches = schedule.filter((m) => m.week === week);
                if (matchIndex >= weekMatches.length) return;
                const match = weekMatches[matchIndex];
                await supabase.from("schedule").update({ home_score: homeScore, away_score: awayScore }).eq("id", match.id);
            },

            finalizeWeekScores: async (week) => {
                const { managers, currentLeagueId } = get();
                if (!currentLeagueId) return;

                const { data: freshSchedule } = await supabase.from("schedule").select("*").eq("league_id", currentLeagueId).eq("week", week);
                if (!freshSchedule) return;

                const weekMatches = freshSchedule.map(mapDbSchedule);
                const allHaveScores = weekMatches.every((m) => m.homeScore !== undefined && m.awayScore !== undefined);
                if (!allHaveScores) return;

                const wasFinalized = weekMatches.some((m) => m.completed);
                const scoreSummary: string[] = [];

                for (const match of weekMatches) {
                    await supabase.from("schedule").update({ is_finalized: true }).eq("id", match.id);
                    const homeManager = managers.find((m) => m.id === match.home);
                    const awayManager = managers.find((m) => m.id === match.away);
                    if (homeManager && awayManager) {
                        scoreSummary.push(`${homeManager.teamName} ${match.homeScore} - ${match.awayScore} ${awayManager.teamName}`);
                    }
                }

                await (supabase.rpc as any)('update_league_standings', { league_uuid: currentLeagueId });
                await supabase.from("transactions").insert({
                    type: "score" as any,
                    manager_id: null,
                    manager_team_name: null,
                    description: `Week ${week} scores ${wasFinalized ? "updated" : "finalized"}:\n${scoreSummary.join("\n")}`,
                    week,
                    league_id: currentLeagueId,
                });
            },

            addNewPlayer: async (name, team, role, isInternational = false) => {
                const { currentLeagueId } = get();
                if (!currentLeagueId) return;
                await supabase.from("players").insert({ name, team, role, is_international: isInternational, league_id: currentLeagueId });
            },

            executeTrade: async (manager1Id, manager2Id, players1, players2) => {
                const { managers, players, currentLeagueId } = get();
                const manager1 = managers.find((m) => m.id === manager1Id);
                const manager2 = managers.find((m) => m.id === manager2Id);
                if (!manager1 || !manager2) return;

                const new1Roster = [...manager1.activeRoster.filter((id) => !players1.includes(id)), ...players2.filter((id) => manager2.activeRoster.includes(id))];
                const new1Bench = [...manager1.bench.filter((id) => !players1.includes(id)), ...players2.filter((id) => manager2.bench.includes(id))];
                const new2Roster = [...manager2.activeRoster.filter((id) => !players2.includes(id)), ...players1.filter((id) => manager1.activeRoster.includes(id))];
                const new2Bench = [...manager2.bench.filter((id) => !players2.includes(id)), ...players1.filter((id) => manager1.bench.includes(id))];

                await Promise.all([
                    supabase.from("managers").update({ roster: new1Roster, bench: new1Bench }).eq("id", manager1Id),
                    supabase.from("managers").update({ roster: new2Roster, bench: new2Bench }).eq("id", manager2Id),
                ]);

                const player1Names = players1.map((id) => players.find((p) => p.id === id)?.name).join(", ");
                const player2Names = players2.map((id) => players.find((p) => p.id === id)?.name).join(", ");

                await supabase.from("transactions").insert({
                    type: "trade" as any,
                    manager_id: manager1Id,
                    manager_team_name: manager1.teamName,
                    description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
                    league_id: currentLeagueId,
                });
            },

            resetLeague: async () => {
                const { managers, schedule, currentLeagueId } = get();
                if (!currentLeagueId) return;

                for (const manager of managers) {
                    await supabase.from("managers").update({ wins: 0, losses: 0, points: 0, roster: [], bench: [] }).eq("id", manager.id);
                }
                for (const match of schedule) {
                    await supabase.from("schedule").update({ home_score: null, away_score: null, is_finalized: false }).eq("id", match.id);
                }
                await supabase.from("transactions").delete().eq("league_id", currentLeagueId);
            },

            // Data fetching
            fetchAllData: async (leagueId) => {
                const fetchStartTime = performance.now();
                console.log(`[useGameStore] 📊 fetchAllData started for league: ${leagueId}`);

                set({ loading: true, currentLeagueId: leagueId });

                try {
                    // Fetch league config
                    const leagueConfigStart = performance.now();
                    const { data: leagueDataRaw } = await supabase.from("leagues" as any).select("*").eq("id", leagueId).single();
                    const leagueData = leagueDataRaw as any;
                    const leagueConfigDuration = performance.now() - leagueConfigStart;
                    console.log(`[useGameStore] ⚙️  League config fetched in ${leagueConfigDuration.toFixed(2)}ms`);

                    if (leagueData) {
                        set({
                            leagueName: leagueData.name,
                            leagueOwnerId: leagueData.league_manager_id,
                            config: {
                                managerCount: leagueData.manager_count,
                                activeSize: leagueData.active_size,
                                benchSize: leagueData.bench_size,
                                minBatsmen: leagueData.min_batsmen,
                                maxBatsmen: leagueData.max_batsmen,
                                minBowlers: leagueData.min_bowlers,
                                minWks: leagueData.min_wks,
                                minAllRounders: leagueData.min_all_rounders,
                                maxInternational: leagueData.max_international,
                            }
                        });
                    }

                    // Fetch all game data in parallel
                    const parallelFetchStart = performance.now();
                    console.log(`[useGameStore] 🔄 Starting parallel fetch of players, managers, schedule, transactions...`);

                    const [playersRes, managersRes, scheduleRes, transactionsRes] = await Promise.all([
                        supabase.from("players" as any).select("*").eq("league_id", leagueId).order("name"),
                        supabase.from("managers" as any).select("*").eq("league_id", leagueId).order("name"),
                        supabase.from("schedule" as any).select("*").eq("league_id", leagueId).order("week").order("created_at"),
                        supabase.from("transactions" as any).select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(50),
                    ]);

                    const parallelFetchDuration = performance.now() - parallelFetchStart;
                    console.log(`[useGameStore] ✅ Parallel fetch completed in ${parallelFetchDuration.toFixed(2)}ms`);

                    // Map data to frontend types
                    const mappingStart = performance.now();
                    const players = (playersRes.data as any)?.map(mapDbPlayer) || [];
                    const managers = (managersRes.data as any)?.map(mapDbManager) || [];
                    const schedule = (scheduleRes.data as any)?.map(mapDbSchedule) || [];
                    const activities = (transactionsRes.data as any)?.map(mapDbTransaction) || [];
                    const mappingDuration = performance.now() - mappingStart;

                    console.log(`[useGameStore] 🗂️  Data mapping completed in ${mappingDuration.toFixed(2)}ms`);
                    console.log(`[useGameStore] 📊 Fetched ${players.length} players, ${managers.length} managers, ${schedule.length} matches, ${activities.length} activities`);

                    set({
                        players,
                        managers,
                        schedule,
                        activities,
                    });

                    const totalFetchDuration = performance.now() - fetchStartTime;
                    console.log(`[useGameStore] 🎉 fetchAllData completed in ${totalFetchDuration.toFixed(2)}ms (Config: ${leagueConfigDuration.toFixed(2)}ms, Fetch: ${parallelFetchDuration.toFixed(2)}ms, Mapping: ${mappingDuration.toFixed(2)}ms)`);
                } catch (error) {
                    console.error('[useGameStore] ❌ Error in fetchAllData:', error);
                    throw error;
                } finally {
                    set({ loading: false });
                }
            },

            // Real-time subscriptions
            subscribeToRealtime: (leagueId) => {
                const filter = leagueId === 'legacy' ? `league_id=is.null` : `league_id=eq.${leagueId}`;

                const channel = supabase
                    .channel(`game-changes-${leagueId}`)
                    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, (payload) => {
                        if (payload.eventType === "INSERT") {
                            // Prevent duplicates: only add if player doesn't already exist
                            const existingPlayer = get().players.find(p => p.id === payload.new.id);
                            if (!existingPlayer) {
                                get().addPlayer(mapDbPlayer(payload.new as Tables<"players">));
                            }
                        }
                        else if (payload.eventType === "UPDATE") get().updatePlayer(payload.new.id, mapDbPlayer(payload.new as Tables<"players">));
                        else if (payload.eventType === "DELETE") get().removePlayer(payload.old.id);
                    })
                    .on("postgres_changes", { event: "*", schema: "public", table: "managers", filter }, (payload) => {
                        if (payload.eventType === "INSERT") {
                            // Prevent duplicates: only add if manager doesn't already exist
                            const existingManager = get().managers.find(m => m.id === payload.new.id);
                            if (!existingManager) {
                                get().addManager(mapDbManager(payload.new as Tables<"managers">));
                            }
                        }
                        else if (payload.eventType === "UPDATE") get().updateManager(payload.new.id, mapDbManager(payload.new as Tables<"managers">));
                        else if (payload.eventType === "DELETE") get().removeManager(payload.old.id);
                    })
                    .on("postgres_changes", { event: "*", schema: "public", table: "schedule", filter }, (payload) => {
                        if (payload.eventType === "INSERT") {
                            // Prevent duplicates: only add if match doesn't already exist
                            const existingMatch = get().schedule.find(s => s.id === payload.new.id);
                            if (!existingMatch) {
                                get().addMatch(mapDbSchedule(payload.new as Tables<"schedule">));
                            }
                        }
                        else if (payload.eventType === "UPDATE") get().updateMatch(payload.new.id, mapDbSchedule(payload.new as Tables<"schedule">));
                        else if (payload.eventType === "DELETE") get().removeMatch(payload.old.id);
                    })
                    .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter }, (payload) => {
                        if (payload.eventType === "INSERT") {
                            // Prevent duplicates: only add if activity doesn't already exist
                            const existingActivity = get().activities.find(a => a.id === payload.new.id);
                            if (!existingActivity) {
                                get().addActivity(mapDbTransaction(payload.new as Tables<"transactions">));
                            }
                        }
                        else if (payload.eventType === "UPDATE") get().updateActivity(payload.new.id, mapDbTransaction(payload.new as Tables<"transactions">));
                        else if (payload.eventType === "DELETE") get().removeActivity(payload.old.id);
                    })
                    .subscribe();

                return () => supabase.removeChannel(channel);
            },
        }),
        { name: 'GameStore' }
    )
);
