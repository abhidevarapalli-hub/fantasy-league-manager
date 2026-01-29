import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { PlayerTransaction } from '@/lib/supabase-types';
import { DEFAULT_LEAGUE_CONFIG, canAddToActive } from '@/lib/roster-validation';
import { DEFAULT_SCORING_RULES, mergeScoringRules } from '@/lib/scoring-types';
import { toast } from 'sonner';
import { GameState } from './gameStore/types';
import { mapDbPlayer, mapDbManager, mapDbSchedule, mapDbTransaction } from './gameStore/mappers';

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      // Initial state
      players: [],
      managers: [],
      schedule: [],
      activities: [],
      config: DEFAULT_LEAGUE_CONFIG,
      scoringRules: DEFAULT_SCORING_RULES,
      leagueName: 'IPL Fantasy',
      leagueOwnerId: null,
      tournamentId: null,
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
      setScoringRules: (scoringRules) => set({ scoringRules }),
      setLeagueName: (leagueName) => set({ leagueName }),
      setLeagueOwnerId: (leagueOwnerId) => set({ leagueOwnerId }),
      setTournamentId: (tournamentId) => set({ tournamentId }),
      setLoading: (loading) => set({ loading }),
      setCurrentManagerId: (currentManagerId) => set({ currentManagerId }),
      setCurrentLeagueId: (currentLeagueId) => set({ currentLeagueId }),
      setIsInitializing: (isInitializing) => set({ isInitializing }),
      setInitializedLeagueId: (initializedLeagueId) => set({ initializedLeagueId }),
      setIsDraftInitialized: (isDraftInitialized) => set({ isDraftInitialized }),
      setIsTradesInitialized: (isTradesInitialized) => set({ isTradesInitialized }),
      setIsLeaguesInitialized: (isLeaguesInitialized) => set({ isLeaguesInitialized }),

      // Real-time mutations
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

      // Actions
      addFreeAgent: async (managerId, playerId, dropPlayerId) => {
        const { managers, players, config, currentLeagueId } = get();
        const manager = managers.find((m) => m.id === managerId);
        const player = players.find((p) => p.id === playerId);
        const dropPlayer = dropPlayerId ? players.find((p) => p.id === dropPlayerId) : null;

        if (!manager || !player) return;

        const ROSTER_CAP = config.activeSize + config.benchSize;
        const rosterCount = manager.activeRoster.length + manager.bench.length;
        if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

        let newRoster = [...manager.activeRoster];
        let newBench = [...manager.bench];

        if (dropPlayerId) {
          newRoster = newRoster.filter((id) => id !== dropPlayerId);
          newBench = newBench.filter((id) => id !== dropPlayerId);
        }

        const activeNotFull = newRoster.length < config.activeSize;
        const benchNotFull = newBench.length < config.benchSize;
        let playerAdded = false;

        if (activeNotFull) {
          newRoster = [...newRoster, playerId];
          playerAdded = true;
        } else if (benchNotFull) {
          newBench = [...newBench, playerId];
          playerAdded = true;
        }

        if (!playerAdded) {
          toast.error(`Cannot add ${player.name} - roster is full`);
          return;
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
          type: "add" as const,
          manager_id: managerId,
          manager_team_name: manager.teamName,
          description,
          players: playerTransactions as unknown as Record<string, unknown>[],
          league_id: currentLeagueId,
        });

        const addedTo = newRoster.includes(playerId) ? 'active roster' : 'bench';
        if (dropPlayer) {
          toast.success(`Dropped ${dropPlayer.name}, added ${player.name} to ${addedTo}`);
        } else {
          toast.success(`Added ${player.name} to ${addedTo}`);
        }
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
          type: "drop" as const,
          manager_id: managerId,
          manager_team_name: manager.teamName,
          description: `${manager.teamName} dropped ${player.name}`,
          players: [{ type: "drop", playerName: player.name, role: player.role, team: player.team }] as unknown as Record<string, unknown>[],
          league_id: currentLeagueId,
        });

        toast.success(`Dropped ${player.name}`);
      },

      moveToActive: async (managerId, playerId) => {
        const { managers, players, config } = get();
        const manager = managers.find((m) => m.id === managerId);
        const player = players.find((p) => p.id === playerId);
        if (!manager || !player) return { success: false, error: "Manager or player not found" };
        if (manager.activeRoster.length >= config.activeSize) {
          return { success: false, error: `Active roster is full (${config.activeSize} players max)` };
        }

        const currentActivePlayers = manager.activeRoster.map(id => players.find(p => p.id === id)).filter(Boolean) as typeof players;
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

        await (supabase.rpc as (name: string, params: Record<string, unknown>) => Promise<unknown>)('update_league_standings', { league_uuid: currentLeagueId });
        await supabase.from("transactions").insert({
          type: "score" as const,
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

      removePlayerFromLeague: async (playerId) => {
        const { players, managers, currentLeagueId } = get();
        if (!currentLeagueId) return;

        const player = players.find((p) => p.id === playerId);
        if (!player) {
          toast.error('Player not found');
          return;
        }

        const managersWithPlayer = managers.filter(
          (m) => m.activeRoster.includes(playerId) || m.bench.includes(playerId)
        );

        for (const manager of managersWithPlayer) {
          const newRoster = manager.activeRoster.filter((id) => id !== playerId);
          const newBench = manager.bench.filter((id) => id !== playerId);
          await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", manager.id);
        }

        const { error } = await supabase.from("players").delete().eq("id", playerId);
        if (error) {
          toast.error(`Failed to remove player: ${error.message}`);
          return;
        }

        await supabase.from("transactions").insert({
          type: "admin" as const,
          manager_id: null,
          manager_team_name: null,
          description: `${player.name} (${player.team} - ${player.role}) was removed from the league`,
          league_id: currentLeagueId,
        });

        toast.success(`${player.name} removed from league`);
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
          type: "trade" as const,
          manager_id: manager1Id,
          manager_team_name: manager1.teamName,
          description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
          league_id: currentLeagueId,
        });

        toast.success(`Trade completed: ${player1Names} ↔ ${player2Names}`);
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

      updateScoringRules: async (rules) => {
        const { currentLeagueId } = get();
        if (!currentLeagueId) {
          return { success: false, error: 'No league selected' };
        }

        try {
          const { error } = await supabase
            .from('leagues' as 'leagues')
            .update({ scoring_rules: rules } as Record<string, unknown>)
            .eq('id', currentLeagueId);

          if (error) {
            console.error('Error updating scoring rules:', error);
            return { success: false, error: error.message };
          }

          set({ scoringRules: rules });
          return { success: true };
        } catch (e) {
          console.error('Exception updating scoring rules:', e);
          return { success: false, error: 'Failed to update scoring rules' };
        }
      },

      updateLeagueConfig: async (configUpdate) => {
        const { currentLeagueId, config } = get();
        if (!currentLeagueId) {
          return { success: false, error: 'No league selected' };
        }

        try {
          // Build the database update object with snake_case keys
          const dbUpdate: Record<string, unknown> = {};
          const changes: string[] = [];

          if (configUpdate.activeSize !== undefined && configUpdate.activeSize !== config.activeSize) {
            dbUpdate.active_size = configUpdate.activeSize;
            changes.push(`Active roster size: ${config.activeSize} → ${configUpdate.activeSize}`);
          }
          if (configUpdate.benchSize !== undefined && configUpdate.benchSize !== config.benchSize) {
            dbUpdate.bench_size = configUpdate.benchSize;
            changes.push(`Bench size: ${config.benchSize} → ${configUpdate.benchSize}`);
          }
          if (configUpdate.minBatsmen !== undefined && configUpdate.minBatsmen !== config.minBatsmen) {
            dbUpdate.min_batsmen = configUpdate.minBatsmen;
            changes.push(`Min batsmen: ${config.minBatsmen} → ${configUpdate.minBatsmen}`);
          }
          if (configUpdate.maxBatsmen !== undefined && configUpdate.maxBatsmen !== config.maxBatsmen) {
            dbUpdate.max_batsmen = configUpdate.maxBatsmen;
            changes.push(`Max batsmen: ${config.maxBatsmen} → ${configUpdate.maxBatsmen}`);
          }
          if (configUpdate.minBowlers !== undefined && configUpdate.minBowlers !== config.minBowlers) {
            dbUpdate.min_bowlers = configUpdate.minBowlers;
            changes.push(`Min bowlers: ${config.minBowlers} → ${configUpdate.minBowlers}`);
          }
          if (configUpdate.minWks !== undefined && configUpdate.minWks !== config.minWks) {
            dbUpdate.min_wks = configUpdate.minWks;
            changes.push(`Min wicket keepers: ${config.minWks} → ${configUpdate.minWks}`);
          }
          if (configUpdate.minAllRounders !== undefined && configUpdate.minAllRounders !== config.minAllRounders) {
            dbUpdate.min_all_rounders = configUpdate.minAllRounders;
            changes.push(`Min all-rounders: ${config.minAllRounders} → ${configUpdate.minAllRounders}`);
          }
          if (configUpdate.maxInternational !== undefined && configUpdate.maxInternational !== config.maxInternational) {
            dbUpdate.max_international = configUpdate.maxInternational;
            changes.push(`Max international: ${config.maxInternational} → ${configUpdate.maxInternational}`);
          }

          // If no changes, return early
          if (Object.keys(dbUpdate).length === 0) {
            return { success: true };
          }

          // Update the database
          const { error } = await supabase
            .from('leagues' as 'leagues')
            .update(dbUpdate)
            .eq('id', currentLeagueId);

          if (error) {
            console.error('Error updating league config:', error);
            return { success: false, error: error.message };
          }

          // Log the change to activity
          await supabase.from("transactions").insert({
            type: "admin" as const,
            manager_id: null,
            manager_team_name: null,
            description: `Roster configuration updated:\n${changes.join('\n')}`,
            league_id: currentLeagueId,
          });

          // Update local state
          const newConfig = { ...config, ...configUpdate };
          set({ config: newConfig });

          toast.success('Roster configuration updated');
          return { success: true };
        } catch (e) {
          console.error('Exception updating league config:', e);
          return { success: false, error: 'Failed to update roster configuration' };
        }
      },

      // Data fetching
      fetchAllData: async (leagueId) => {
        const fetchStartTime = performance.now();
        console.log(`[useGameStore] 📊 fetchAllData started for league: ${leagueId}`);

        set({ loading: true, currentLeagueId: leagueId });

        try {
          const leagueConfigStart = performance.now();
          const { data: leagueDataRaw } = await supabase.from("leagues" as 'leagues').select("*").eq("id", leagueId).single();
          const leagueData = leagueDataRaw as Record<string, unknown> | null;
          const leagueConfigDuration = performance.now() - leagueConfigStart;
          console.log(`[useGameStore] ⚙️  League config fetched in ${leagueConfigDuration.toFixed(2)}ms`);

          if (leagueData) {
            set({
              leagueName: leagueData.name as string,
              leagueOwnerId: leagueData.league_manager_id as string,
              tournamentId: (leagueData.tournament_id as number) || null,
              config: {
                managerCount: leagueData.manager_count as number,
                activeSize: leagueData.active_size as number,
                benchSize: leagueData.bench_size as number,
                minBatsmen: leagueData.min_batsmen as number,
                maxBatsmen: leagueData.max_batsmen as number,
                minBowlers: leagueData.min_bowlers as number,
                minWks: leagueData.min_wks as number,
                minAllRounders: leagueData.min_all_rounders as number,
                maxInternational: leagueData.max_international as number,
              },
              scoringRules: mergeScoringRules(leagueData.scoring_rules as Record<string, unknown>),
            });
          }

          const parallelFetchStart = performance.now();
          console.log(`[useGameStore] 🔄 Starting parallel fetch of players, managers, schedule, transactions...`);

          const [playersRes, managersRes, scheduleRes, transactionsRes] = await Promise.all([
            supabase.from("players" as 'players').select("*").eq("league_id", leagueId).order("name"),
            supabase.from("managers" as 'managers').select("*").eq("league_id", leagueId).order("name"),
            supabase.from("schedule" as 'schedule').select("*").eq("league_id", leagueId).order("week").order("created_at"),
            supabase.from("transactions" as 'transactions').select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(50),
          ]);

          const parallelFetchDuration = performance.now() - parallelFetchStart;
          console.log(`[useGameStore] ✅ Parallel fetch completed in ${parallelFetchDuration.toFixed(2)}ms`);

          const mappingStart = performance.now();
          const players = (playersRes.data as Tables<"players">[] | null)?.map(mapDbPlayer) || [];
          const managers = (managersRes.data as Tables<"managers">[] | null)?.map(mapDbManager) || [];
          const schedule = (scheduleRes.data as Tables<"schedule">[] | null)?.map(mapDbSchedule) || [];
          const activities = (transactionsRes.data as Tables<"transactions">[] | null)?.map(mapDbTransaction) || [];
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
