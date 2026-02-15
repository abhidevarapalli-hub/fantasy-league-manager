import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { PlayerTransaction } from '@/lib/supabase-types';
import { DEFAULT_LEAGUE_CONFIG, canAddToActive } from '@/lib/roster-validation';
import { DEFAULT_SCORING_RULES, mergeScoringRules } from '@/lib/scoring-types';
import { toast } from 'sonner';
import { GameState } from './gameStore/types';
import {
  mapDbPlayer,
  mapDbManager,
  mapDbManagerWithRoster,
  mapDbSchedule,
  mapDbTransaction,
  mapDbDraftPick,
  mapDbDraftOrder,
  mapDbDraftState,
  ManagerRosterEntry
} from './gameStore/mappers';

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
      draftPicks: [],
      draftOrder: [],
      draftState: null,
      loading: true,
      currentLeagueId: null,
      isInitializing: false,
      initializedLeagueId: null,
      isDraftInitialized: false,
      initializedDraftLeagueId: null,
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
      setDraftPicks: (draftPicks) => set({ draftPicks }),
      setDraftOrder: (draftOrder) => set({ draftOrder }),
      setDraftState: (draftState) => set({ draftState }),
      setCurrentLeagueId: (currentLeagueId) => set({ currentLeagueId }),
      setIsInitializing: (isInitializing) => set({ isInitializing }),
      setInitializedLeagueId: (initializedLeagueId) => set({ initializedLeagueId }),
      setIsDraftInitialized: (isDraftInitialized) => set({ isDraftInitialized }),
      setInitializedDraftLeagueId: (id) => set({ initializedDraftLeagueId: id }),
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

        if (!manager || !player || !currentLeagueId) return;

        const ROSTER_CAP = config.activeSize + config.benchSize;
        const rosterCount = manager.activeRoster.length + manager.bench.length;
        if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

        // Calculate new roster state to determine slot_type
        let newActiveCount = manager.activeRoster.length;
        let newBenchCount = manager.bench.length;

        if (dropPlayerId) {
          if (manager.activeRoster.includes(dropPlayerId)) newActiveCount--;
          if (manager.bench.includes(dropPlayerId)) newBenchCount--;
          // Delete from junction table
          await supabase.from("manager_roster" as "managers").delete().eq("player_id", dropPlayerId).eq("league_id", currentLeagueId);
        }

        const activeNotFull = newActiveCount < config.activeSize;
        const benchNotFull = newBenchCount < config.benchSize;
        let slotType: 'active' | 'bench';

        if (activeNotFull) {
          slotType = 'active';
        } else if (benchNotFull) {
          slotType = 'bench';
        } else {
          toast.error(`Cannot add ${player.name} - roster is full`);
          return;
        }

        // Insert into junction table
        const { error } = await supabase.from("manager_roster" as "managers").insert({
          manager_id: managerId,
          player_id: playerId,
          league_id: currentLeagueId,
          slot_type: slotType,
          position: slotType === 'active' ? newActiveCount : newBenchCount,
        } as any);

        if (error) {
          toast.error(`Failed to add player: ${error.message}`);
          return;
        }

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
          description,
          players: playerTransactions as any,
          league_id: currentLeagueId,
        });

        const addedTo = slotType === 'active' ? 'active roster' : 'bench';
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
        if (!manager || !player || !currentLeagueId) return;

        // Delete from junction table
        const { error } = await supabase
          .from("manager_roster" as "managers")
          .delete()
          .eq("player_id", playerId)
          .eq("league_id", currentLeagueId);

        if (error) {
          toast.error(`Failed to drop player: ${error.message}`);
          return;
        }

        await supabase.from("transactions").insert({
          type: "drop" as const,
          manager_id: managerId,
          description: `${manager.teamName} dropped ${player.name}`,
          players: [{ type: "drop", playerName: player.name, role: player.role, team: player.team }] as any,
          league_id: currentLeagueId,
        });

        toast.success(`Dropped ${player.name}`);
      },

      moveToActive: async (managerId, playerId) => {
        const { managers, players, config, currentLeagueId } = get();
        const manager = managers.find((m) => m.id === managerId);
        const player = players.find((p) => p.id === playerId);
        if (!manager || !player || !currentLeagueId) return { success: false, error: "Manager or player not found" };
        if (manager.activeRoster.length >= config.activeSize) {
          return { success: false, error: `Active roster is full (${config.activeSize} players max)` };
        }

        const currentActivePlayers = manager.activeRoster.map(id => players.find(p => p.id === id)).filter(Boolean) as typeof players;
        const validation = canAddToActive(currentActivePlayers, player, config);
        if (!validation.isValid) return { success: false, error: validation.errors[0] };

        // Update slot_type in junction table
        const { error } = await supabase
          .from("manager_roster" as "managers")
          .update({ slot_type: 'active', position: manager.activeRoster.length } as any)
          .eq("player_id", playerId)
          .eq("league_id", currentLeagueId);

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      },

      moveToBench: async (managerId, playerId) => {
        const { managers, config, currentLeagueId } = get();
        const manager = managers.find((m) => m.id === managerId);
        if (!manager || !currentLeagueId) return { success: false, error: "Manager not found" };
        if (manager.bench.length >= config.benchSize) {
          return { success: false, error: `Bench is full (${config.benchSize} players max)` };
        }

        // Update slot_type in junction table
        const { error } = await supabase
          .from("manager_roster" as "managers")
          .update({ slot_type: 'bench', position: manager.bench.length } as any)
          .eq("player_id", playerId)
          .eq("league_id", currentLeagueId);

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      },

      swapPlayers: async (managerId, player1Id, player2Id) => {
        const { managers, currentLeagueId } = get();
        const manager = managers.find((m) => m.id === managerId);
        if (!manager || !currentLeagueId) return { success: false, error: "Manager not found" };

        const player1InActive = manager.activeRoster.includes(player1Id);
        const player2InActive = manager.activeRoster.includes(player2Id);

        if ((player1InActive && player2InActive) || (!player1InActive && !player2InActive)) {
          return { success: false, error: "Players must be in different sections to swap" };
        }

        // Swap slot_types in junction table
        const [update1, update2] = await Promise.all([
          supabase
            .from("manager_roster" as "managers")
            .update({ slot_type: player1InActive ? 'bench' : 'active' } as any)
            .eq("player_id", player1Id)
            .eq("league_id", currentLeagueId),
          supabase
            .from("manager_roster" as "managers")
            .update({ slot_type: player2InActive ? 'bench' : 'active' } as any)
            .eq("player_id", player2Id)
            .eq("league_id", currentLeagueId),
        ]);

        if (update1.error || update2.error) {
          return { success: false, error: update1.error?.message || update2.error?.message || "Swap failed" };
        }
        return { success: true };
      },

      updateMatchScore: async (week, matchIndex, homeScore, awayScore) => {
        const { schedule } = get();
        const weekMatches = schedule.filter((m) => m.week === week);
        if (matchIndex >= weekMatches.length) return;
        const match = weekMatches[matchIndex];
        await supabase.from("league_schedules").update({ manager1_score: homeScore, manager2_score: awayScore }).eq("id", match.id);
      },

      finalizeWeekScores: async (week) => {
        const { managers, currentLeagueId } = get();
        if (!currentLeagueId) return;

        const { data: freshSchedule } = await supabase.from("league_schedules").select("*").eq("league_id", currentLeagueId).eq("week", week);
        if (!freshSchedule) return;

        const weekMatches = freshSchedule.map(mapDbSchedule);
        const allHaveScores = weekMatches.every((m) => m.homeScore !== undefined && m.awayScore !== undefined);
        if (!allHaveScores) return;

        const wasFinalized = weekMatches.some((m) => m.completed);
        const scoreSummary: string[] = [];

        for (const match of weekMatches) {
          await supabase.from("league_schedules").update({ is_finalized: true }).eq("id", match.id);
          const homeManager = managers.find((m) => m.id === match.home);
          const awayManager = managers.find((m) => m.id === match.away);
          if (homeManager && awayManager) {
            scoreSummary.push(`${homeManager.teamName} ${match.homeScore} - ${match.awayScore} ${awayManager.teamName}`);
          }
        }

        await supabase.rpc('update_league_standings', { league_uuid: currentLeagueId });
        await supabase.from("transactions").insert({
          type: "score" as const,
          manager_id: null,
          description: `Week ${week} scores ${wasFinalized ? "updated" : "finalized"}:\n${scoreSummary.join("\n")}`,
          week,
          league_id: currentLeagueId,
        });
      },

      addNewPlayer: async (name, team, role, isInternational = false) => {
        const { currentLeagueId } = get();
        if (!currentLeagueId) return;

        // Check if player already exists in master_players
        const { data: existingMaster } = await supabase
          .from("master_players")
          .select("id")
          .eq("name", name)
          .eq("primary_role", role)
          .maybeSingle();

        let masterId: string;
        if (existingMaster) {
          masterId = existingMaster.id;
        } else {
          // Insert new master player
          const { data: newMaster, error: masterError } = await supabase
            .from("master_players")
            .insert({
              name,
              primary_role: role,
              is_international: isInternational,
              teams: [team],
            })
            .select("id")
            .single();

          if (masterError || !newMaster) {
            toast.error(`Failed to add player: ${masterError?.message}`);
            return;
          }
          masterId = newMaster.id;
        }

        // Add to league player pool
        const { error: poolError } = await supabase
          .from("league_player_pool")
          .upsert({
            league_id: currentLeagueId,
            player_id: masterId,
            team_override: team,
          }, { onConflict: 'league_id,player_id' });

        if (poolError) {
          toast.error(`Failed to add player to league: ${poolError.message}`);
        }
      },

      removePlayerFromLeague: async (playerId) => {
        const { players, currentLeagueId } = get();
        if (!currentLeagueId) return;

        const player = players.find((p) => p.id === playerId);
        if (!player) {
          toast.error('Player not found');
          return;
        }

        // Remove from manager_roster junction table (cascade handles this for us, but we do it explicitly)
        await supabase
          .from("manager_roster" as "managers")
          .delete()
          .eq("player_id", playerId)
          .eq("league_id", currentLeagueId);

        // Remove from league_player_pool (not master_players - player may be used in other leagues)
        const { error } = await supabase
          .from("league_player_pool")
          .delete()
          .eq("player_id", playerId)
          .eq("league_id", currentLeagueId);

        if (error) {
          toast.error(`Failed to remove player: ${error.message}`);
          return;
        }

        await supabase.from("transactions").insert({
          type: "admin" as const,
          manager_id: null,
          description: `${player.name} (${player.team} - ${player.role}) was removed from the league`,
          league_id: currentLeagueId,
        });

        toast.success(`${player.name} removed from league`);
      },

      executeTrade: async (manager1Id, manager2Id, players1, players2) => {
        const { managers, players, currentLeagueId } = get();
        const manager1 = managers.find((m) => m.id === manager1Id);
        const manager2 = managers.find((m) => m.id === manager2Id);
        if (!manager1 || !manager2 || !currentLeagueId) return;

        // For trades, we need to swap manager_id while preserving slot_type
        // Update players going from manager1 to manager2
        const trade1to2 = players1.map(playerId => {
          const wasActive = manager1.activeRoster.includes(playerId);
          return supabase
            .from("manager_roster" as "managers")
            .update({ manager_id: manager2Id, slot_type: wasActive ? 'active' : 'bench' } as any)
            .eq("player_id", playerId)
            .eq("league_id", currentLeagueId);
        });

        // Update players going from manager2 to manager1
        const trade2to1 = players2.map(playerId => {
          const wasActive = manager2.activeRoster.includes(playerId);
          return supabase
            .from("manager_roster" as "managers")
            .update({ manager_id: manager1Id, slot_type: wasActive ? 'active' : 'bench' } as any)
            .eq("player_id", playerId)
            .eq("league_id", currentLeagueId);
        });

        await Promise.all([...trade1to2, ...trade2to1]);

        const player1Names = players1.map((id) => players.find((p) => p.id === id)?.name).join(", ");
        const player2Names = players2.map((id) => players.find((p) => p.id === id)?.name).join(", ");

        await supabase.from("transactions").insert({
          type: "trade" as const,
          manager_id: manager1Id,
          description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
          league_id: currentLeagueId,
        });

        toast.success(`Trade completed: ${player1Names} ↔ ${player2Names}`);
      },

      resetLeague: async () => {
        const { managers, schedule, currentLeagueId } = get();
        if (!currentLeagueId) return;

        // Delete all roster entries for this league from junction table
        await supabase
          .from("manager_roster" as "managers")
          .delete()
          .eq("league_id", currentLeagueId);

        for (const manager of managers) {
          await supabase.from("managers").update({ wins: 0, losses: 0, points: 0 }).eq("id", manager.id);
        }
        for (const match of schedule) {
          await supabase.from("league_schedules").update({ manager1_score: null, manager2_score: null, is_finalized: false }).eq("id", match.id);
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
            .from('leagues' as any)
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
        // console.log(`[useGameStore] 📊 fetchAllData started for league: ${leagueId}`);

        set({ loading: true, currentLeagueId: leagueId });

        try {
          const leagueConfigStart = performance.now();
          const { data: leagueDataRaw } = await supabase.from("leagues" as 'leagues').select("*").eq("id", leagueId).single();
          const leagueData = leagueDataRaw as Record<string, unknown> | null;
          const leagueConfigDuration = performance.now() - leagueConfigStart;
          // console.log(`[useGameStore] ⚙️  League config fetched in ${leagueConfigDuration.toFixed(2)}ms`);

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
          // console.log(`[useGameStore] 🔄 Starting parallel fetch of players, managers, schedule, transactions...`);

          const [playersRes, managersRes, rosterRes, scheduleRes, transactionsRes, draftPicksRes, draftOrderRes, draftStateRes] = await Promise.all([
            // Query the league_players view which joins master_players + league_player_pool
            supabase.from("league_players").select("*").eq("league_id", leagueId).order("name"),
            supabase.from("managers" as 'managers').select("*").eq("league_id", leagueId).order("name"),
            // Fetch roster entries from junction table
            supabase.from("manager_roster" as "managers").select("*").eq("league_id", leagueId),
            supabase.from("league_schedules").select("*").eq("league_id", leagueId).order("week").order("created_at"),
            supabase.from("transactions" as 'transactions').select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(50),
            supabase.from("draft_picks").select("*").eq("league_id", leagueId).order("round").order("pick_position"),
            supabase.from("draft_order").select("*").eq("league_id", leagueId).order("position"),
            supabase.from("draft_state").select("*").eq("league_id", leagueId).maybeSingle(),
          ]);

          const parallelFetchDuration = performance.now() - parallelFetchStart;
          // console.log(`[useGameStore] ✅ Parallel fetch completed in ${parallelFetchDuration.toFixed(2)}ms`);

          const mappingStart = performance.now();
          const players = (playersRes.data as Tables<"league_players">[] | null)?.map(mapDbPlayer) || [];
          // Map roster entries for use with mapDbManagerWithRoster
          // Cast as unknown first since types aren't regenerated yet
          const rosterEntries = (rosterRes.data as unknown as ManagerRosterEntry[] | null) || [];
          // Use mapDbManagerWithRoster to reconstruct rosters from junction table
          const managers = (managersRes.data as Tables<"managers">[] | null)?.map(m => mapDbManagerWithRoster(m, rosterEntries)) || [];
          const schedule = (scheduleRes.data as Tables<"league_schedules">[] | null)?.map(mapDbSchedule) || [];
          const activities = (transactionsRes.data as Tables<"transactions">[] | null)?.map(mapDbTransaction) || [];

          const draftPicks = (draftPicksRes.data || []).map(mapDbDraftPick);
          const draftOrder = (draftOrderRes.data || []).map(mapDbDraftOrder);
          const draftState = draftStateRes.data ? mapDbDraftState(draftStateRes.data) : null;

          const mappingDuration = performance.now() - mappingStart;

          // console.log(`[useGameStore] 🗂️  Data mapping completed in ${mappingDuration.toFixed(2)}ms`);
          // console.log(`[useGameStore] 📊 Fetched ${players.length} players, ${managers.length} managers, ${schedule.length} matches, ${activities.length} activities`);

          set({
            players,
            managers,
            schedule,
            activities,
            draftPicks,
            draftOrder,
            draftState,
          });

          const totalFetchDuration = performance.now() - fetchStartTime;
          // console.log(`[useGameStore] 🎉 fetchAllData completed in ${totalFetchDuration.toFixed(2)}ms (Config: ${leagueConfigDuration.toFixed(2)}ms, Fetch: ${parallelFetchDuration.toFixed(2)}ms, Mapping: ${mappingDuration.toFixed(2)}ms)`);
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
          // Subscribe to league_player_pool changes (can't subscribe to views)
          // When a player is added/removed from the league pool, refetch all players
          .on("postgres_changes", { event: "*", schema: "public", table: "league_player_pool", filter }, async (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "DELETE") {
              // Refetch all players when pool changes
              const { data } = await supabase.from("league_players").select("*").eq("league_id", leagueId).order("name");
              if (data) {
                set({ players: (data as Tables<"league_players">[]).map(mapDbPlayer) });
              }
            }
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
          // Subscribe to manager_roster changes - refetch managers when rosters change
          .on("postgres_changes", { event: "*", schema: "public", table: "manager_roster", filter }, async () => {
            // Refetch managers with their rosters when junction table changes
            const [managersRes, rosterRes] = await Promise.all([
              supabase.from("managers" as 'managers').select("*").eq("league_id", leagueId).order("name"),
              supabase.from("manager_roster" as "managers").select("*").eq("league_id", leagueId),
            ]);
            if (managersRes.data && rosterRes.data) {
              const rosterEntries = rosterRes.data as unknown as ManagerRosterEntry[];
              const managers = (managersRes.data as Tables<"managers">[]).map(m => mapDbManagerWithRoster(m, rosterEntries));
              set({ managers });
            }
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "league_schedules", filter }, (payload) => {
            if (payload.eventType === "INSERT") {
              const existingMatch = get().schedule.find(s => s.id === payload.new.id);
              if (!existingMatch) {
                get().addMatch(mapDbSchedule(payload.new as Tables<"league_schedules">));
              }
            }
            else if (payload.eventType === "UPDATE") get().updateMatch(payload.new.id, mapDbSchedule(payload.new as Tables<"league_schedules">));
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
          .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks", filter }, (payload) => {
            if (payload.eventType === "INSERT") {
              const existing = get().draftPicks.find(p => p.id === payload.new.id);
              if (!existing) set({ draftPicks: [...get().draftPicks, mapDbDraftPick(payload.new)] });
            }
            else if (payload.eventType === "UPDATE") {
              set({ draftPicks: get().draftPicks.map(p => p.id === payload.new.id ? mapDbDraftPick(payload.new) : p) });
            }
            else if (payload.eventType === "DELETE") {
              set({ draftPicks: get().draftPicks.filter(p => p.id !== payload.old.id) });
            }
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "draft_order", filter }, (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const mapped = mapDbDraftOrder(payload.new);
              const exists = get().draftOrder.find(o => o.id === payload.new.id);
              if (exists) {
                set({ draftOrder: get().draftOrder.map(o => o.id === payload.new.id ? mapped : o) });
              } else {
                set({ draftOrder: [...get().draftOrder, mapped].sort((a, b) => a.position - b.position) });
              }
            }
            else if (payload.eventType === "DELETE") {
              set({ draftOrder: get().draftOrder.filter(o => o.id !== payload.old.id) });
            }
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "draft_state", filter }, (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              set({ draftState: mapDbDraftState(payload.new) });
            }
          })
          .subscribe();

        return () => supabase.removeChannel(channel);
      },
    }),
    { name: 'GameStore' }
  )
);
