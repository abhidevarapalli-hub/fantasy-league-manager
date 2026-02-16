import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { Player, Manager, Match, Activity, PlayerTransaction } from "@/lib/supabase-types";
import {
  DEFAULT_LEAGUE_CONFIG,
  LeagueConfig,
  validateActiveRoster,
  canAddToActive,
} from "@/lib/roster-validation";
import { ScoringRules, DEFAULT_SCORING_RULES, mergeScoringRules } from "@/lib/scoring-types";
import { recomputeLeaguePoints } from "@/lib/scoring-recompute";
import { ManagerRosterEntry, mapDbManagerWithRoster } from "@/store/gameStore/mappers";

// Helper to map DB rows to frontend types
// Uses league_players view which joins master_players + league_player_pool
const mapDbPlayer = (db: Tables<"league_players">): Player => ({
  id: db.id!,
  name: db.name!,
  team: db.team!,
  role: db.role as Player["role"],
  isInternational: db.is_international ?? false,
  imageId: db.image_id ?? undefined,
});

// Rosters are now stored in manager_roster junction table
const mapDbManager = (db: Tables<"managers">): Manager => ({
  id: db.id,
  name: db.name,
  teamName: db.team_name,
  wins: db.wins,
  losses: db.losses,
  points: db.points,
  activeRoster: [],
  bench: [],
});

const mapDbSchedule = (db: Tables<"league_schedules">): Match => ({
  id: db.id,
  week: db.week,
  home: db.manager1_id || "",
  away: db.manager2_id || "",
  homeScore: db.manager1_score ?? undefined,
  awayScore: db.manager2_score ?? undefined,
  completed: db.is_finalized,
});

const mapDbTransaction = (db: Tables<"transactions">): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type as Activity["type"],
  managerId: db.manager_id || "system",
  description: db.description,
  players: (db.players as unknown as PlayerTransaction[] | null) || undefined,
});

export const useRealtimeGame = (leagueId?: string) => {
  const [config, setConfig] = useState<LeagueConfig>(DEFAULT_LEAGUE_CONFIG);
  const [players, setPlayers] = useState<Player[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [schedule, setSchedule] = useState<Match[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentManagerId, setCurrentManagerId] = useState("");
  const [leagueName, setLeagueName] = useState("IPL Fantasy");
  const [leagueOwnerId, setLeagueOwnerId] = useState<string | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES);

  const ROSTER_CAP = config.activeSize + config.benchSize;

  // Data fetching logic
  const fetchAllData = useCallback(async () => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch League Config first
      const { data: leagueData } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", leagueId)
        .single();

      if (leagueData) {
        setLeagueName(leagueData.name);
        setLeagueOwnerId(leagueData.league_manager_id);
        setConfig({
          managerCount: leagueData.manager_count,
          activeSize: leagueData.active_size,
          benchSize: leagueData.bench_size,
          minBatsmen: leagueData.min_batsmen,
          maxBatsmen: leagueData.max_batsmen,
          minBowlers: leagueData.min_bowlers,
          minWks: leagueData.min_wks,
          minAllRounders: leagueData.min_all_rounders,
          maxInternational: leagueData.max_international,
        });
      }

      // Fetch scoring rules from scoring_rules table
      const { data: scoringRulesData } = await supabase
        .from('scoring_rules')
        .select('rules')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (scoringRulesData?.rules) {
        setScoringRules(mergeScoringRules(scoringRulesData.rules as Record<string, unknown>));
      }

      const [playersRes, managersRes, rosterRes, scheduleRes, transactionsRes] = await Promise.all([
        supabase.from("league_players").select("*").eq("league_id", leagueId).order("name"),
        supabase.from("managers").select("*").eq("league_id", leagueId).order("name"),
        // Fetch roster entries from junction table
        supabase.from("manager_roster").select("*").eq("league_id", leagueId),
        supabase.from("league_schedules").select("*").eq("league_id", leagueId).order("week").order("created_at"),
        supabase.from("transactions").select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(50),
      ]);

      const rosterEntries: ManagerRosterEntry[] = (rosterRes.data || []).map(r => ({
        id: r.id,
        manager_id: r.manager_id,
        player_id: r.player_id,
        league_id: r.league_id,
        slot_type: r.slot_type as 'active' | 'bench',
        position: r.position,
      }));

      if (playersRes.data) {
        setPlayers((playersRes.data as Tables<"league_players">[]).map(mapDbPlayer));
      }
      if (managersRes.data) {
        const mappedManagers = managersRes.data.map(m => mapDbManagerWithRoster(m, rosterEntries));
        setManagers(mappedManagers);
        if (mappedManagers.length > 0 && !currentManagerId) {
          setCurrentManagerId(mappedManagers[0].id);
        }
      }
      if (scheduleRes.data) {
        setSchedule(scheduleRes.data.map(mapDbSchedule));
      }
      if (transactionsRes.data) {
        setActivities(transactionsRes.data.map(mapDbTransaction));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [leagueId, currentManagerId]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);


  // Real-time subscriptions
  useEffect(() => {
    if (!leagueId) return;

    const isLegacy = leagueId === 'legacy';
    const filter = isLegacy ? `league_id=is.null` : `league_id=eq.${leagueId}`;

    const channel = supabase
      .channel(`game-changes-${leagueId}`)
      // Subscribe to league_player_pool changes (can't subscribe to views directly)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_player_pool", filter }, async (payload) => {
        // When league_player_pool changes, refetch the players from the view
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE" || payload.eventType === "DELETE") {
          const { data } = await supabase
            .from("league_players")
            .select("*")
            .eq("league_id", leagueId);
          if (data) {
            setPlayers(data.map((p) => mapDbPlayer(p as Tables<"league_players">)));
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "managers", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          // Prevent duplicates: only add if manager doesn't already exist
          setManagers((prev) => {
            const existingManager = prev.find(m => m.id === payload.new.id);
            if (existingManager) return prev;
            return [...prev, mapDbManager(payload.new as Tables<"managers">)];
          });
        } else if (payload.eventType === "UPDATE") {
          setManagers((prev) =>
            prev.map((m) => (m.id === payload.new.id ? mapDbManager(payload.new as Tables<"managers">) : m)),
          );
        } else if (payload.eventType === "DELETE") {
          setManagers((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      })
      // Subscribe to manager_roster changes - refetch managers when rosters change
      .on("postgres_changes", { event: "*", schema: "public", table: "manager_roster", filter }, async () => {
        // Refetch managers with their rosters when junction table changes
        const [managersRes, rosterRes] = await Promise.all([
          supabase.from("managers").select("*").eq("league_id", leagueId).order("name"),
          supabase.from("manager_roster").select("*").eq("league_id", leagueId),
        ]);
        if (managersRes.data && rosterRes.data) {
          const rosterEntries: ManagerRosterEntry[] = rosterRes.data.map(r => ({
            id: r.id,
            manager_id: r.manager_id,
            player_id: r.player_id,
            league_id: r.league_id,
            slot_type: r.slot_type as 'active' | 'bench',
            position: r.position,
          }));
          const mappedManagers = managersRes.data.map(m => mapDbManagerWithRoster(m, rosterEntries));
          setManagers(mappedManagers);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "league_schedules", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          // Prevent duplicates: only add if match doesn't already exist
          setSchedule((prev) => {
            const existingMatch = prev.find(s => s.id === payload.new.id);
            if (existingMatch) return prev;
            return [...prev, mapDbSchedule(payload.new as Tables<"league_schedules">)];
          });
        } else if (payload.eventType === "UPDATE") {
          setSchedule((prev) =>
            prev.map((s) => (s.id === payload.new.id ? mapDbSchedule(payload.new as Tables<"league_schedules">) : s)),
          );
        } else if (payload.eventType === "DELETE") {
          setSchedule((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          // Prevent duplicates: only add if activity doesn't already exist
          setActivities((prev) => {
            const existingActivity = prev.find(a => a.id === payload.new.id);
            if (existingActivity) return prev;
            return [mapDbTransaction(payload.new as Tables<"transactions">), ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          setActivities((prev) =>
            prev.map((a) => (a.id === payload.new.id ? mapDbTransaction(payload.new as Tables<"transactions">) : a)),
          );
        } else if (payload.eventType === "DELETE") {
          setActivities((prev) => prev.filter((a) => a.id !== payload.old.id));
        }
      })
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  const getFreeAgents = useCallback(() => {
    const rosteredIds = new Set(managers.flatMap((m) => [...m.activeRoster, ...m.bench]));
    return players.filter((p) => !rosteredIds.has(p.id));
  }, [managers, players]);

  const getManagerRosterCount = useCallback(
    (managerId: string) => {
      const manager = managers.find((m) => m.id === managerId);
      if (!manager) return 0;
      return manager.activeRoster.length + manager.bench.length;
    },
    [managers],
  );

  const addFreeAgent = async (managerId: string, playerId: string, dropPlayerId?: string) => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);
    const dropPlayer = dropPlayerId ? players.find((p) => p.id === dropPlayerId) : null;

    if (!manager || !player || !leagueId) return;

    const rosterCount = manager.activeRoster.length + manager.bench.length;
    if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

    // Calculate new roster state to determine slot_type
    let newActiveCount = manager.activeRoster.length;
    let newBenchCount = manager.bench.length;

    if (dropPlayerId) {
      if (manager.activeRoster.includes(dropPlayerId)) newActiveCount--;
      if (manager.bench.includes(dropPlayerId)) newBenchCount--;
      // Delete from junction table
      await supabase.from("manager_roster").delete().eq("player_id", dropPlayerId).eq("league_id", leagueId);
    }

    const activeNotFull = newActiveCount < config.activeSize;
    const benchNotFull = newBenchCount < config.benchSize;
    let slotType: 'active' | 'bench';

    if (activeNotFull) {
      slotType = 'active';
    } else if (benchNotFull) {
      slotType = 'bench';
    } else {
      console.error("Roster is full");
      return;
    }

    // Insert into junction table
    const rosterInsert: TablesInsert<"manager_roster"> = {
      manager_id: managerId,
      player_id: playerId,
      league_id: leagueId,
      slot_type: slotType,
      position: slotType === 'active' ? newActiveCount : newBenchCount,
    };
    const { error: updateError } = await supabase.from("manager_roster").insert(rosterInsert);

    if (updateError) {
      console.error("Error updating manager:", updateError);
      return;
    }

    const playerTransactions: PlayerTransaction[] = [];
    if (dropPlayer) {
      playerTransactions.push({
        type: "drop",
        playerName: dropPlayer.name,
        role: dropPlayer.role,
        team: dropPlayer.team,
      });
    }
    playerTransactions.push({
      type: "add",
      playerName: player.name,
      role: player.role,
      team: player.team,
    });

    let description = `${manager.teamName} added ${player.name}`;
    if (dropPlayer) {
      description = `${manager.teamName} dropped ${dropPlayer.name}, added ${player.name}`;
    }

    await supabase.from("transactions").insert({
      type: "add",
      manager_id: managerId,
      description,
      players: playerTransactions as unknown as Json,
      league_id: leagueId,
    });
  };

  const dropPlayerOnly = async (managerId: string, playerId: string) => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);

    if (!manager || !player || !leagueId) return;

    // Delete from junction table
    const { error: updateError } = await supabase
      .from("manager_roster")
      .delete()
      .eq("player_id", playerId)
      .eq("league_id", leagueId);

    if (updateError) {
      console.error("Error updating manager:", updateError);
      return;
    }

    const playerTx: PlayerTransaction = {
      type: "drop",
      playerName: player.name,
      role: player.role,
      team: player.team,
    };

    await supabase.from("transactions").insert({
      type: "drop",
      manager_id: managerId,
      description: `${manager.teamName} dropped ${player.name}`,
      players: [playerTx] as unknown as Json,
      league_id: leagueId,
    });
  };

  const moveToActive = async (managerId: string, playerId: string): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);

    if (!manager || !player || !leagueId) return { success: false, error: "Manager or player not found" };
    if (manager.activeRoster.length >= config.activeSize) {
      return { success: false, error: `Active roster is full (${config.activeSize} players max)` };
    }

    const currentActivePlayers = manager.activeRoster
      .map(id => players.find(p => p.id === id))
      .filter(Boolean) as Player[];

    const validation = canAddToActive(currentActivePlayers, player, config);

    if (!validation.isValid) {
      return { success: false, error: validation.errors[0] };
    }

    // Update slot_type in junction table
    const { error } = await supabase
      .from("manager_roster")
      .update({ slot_type: 'active', position: manager.activeRoster.length })
      .eq("player_id", playerId)
      .eq("league_id", leagueId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const moveToBench = async (managerId: string, playerId: string): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager || !leagueId) return { success: false, error: "Manager not found" };
    if (manager.bench.length >= config.benchSize) {
      return { success: false, error: `Bench is full (${config.benchSize} players max)` };
    }

    // Update slot_type in junction table
    const { error } = await supabase
      .from("manager_roster")
      .update({ slot_type: 'bench', position: manager.bench.length })
      .eq("player_id", playerId)
      .eq("league_id", leagueId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const swapPlayers = async (
    managerId: string,
    player1Id: string,
    player2Id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager || !leagueId) return { success: false, error: "Manager not found" };

    const player1InActive = manager.activeRoster.includes(player1Id);
    const player2InActive = manager.activeRoster.includes(player2Id);

    if ((player1InActive && player2InActive) || (!player1InActive && !player2InActive)) {
      return { success: false, error: "Players must be in different sections to swap" };
    }

    // Swap slot_types in junction table
    const [update1, update2] = await Promise.all([
      supabase
        .from("manager_roster")
        .update({ slot_type: player1InActive ? 'bench' : 'active' })
        .eq("player_id", player1Id)
        .eq("league_id", leagueId),
      supabase
        .from("manager_roster")
        .update({ slot_type: player2InActive ? 'bench' : 'active' })
        .eq("player_id", player2Id)
        .eq("league_id", leagueId),
    ]);

    if (update1.error || update2.error) {
      return { success: false, error: update1.error?.message || update2.error?.message || "Swap failed" };
    }
    return { success: true };
  };

  const updateMatchScore = async (week: number, matchIndex: number, homeScore: number, awayScore: number) => {
    const weekMatches = schedule.filter((m) => m.week === week);
    if (matchIndex >= weekMatches.length) return;
    const match = weekMatches[matchIndex];
    await supabase.from("league_schedules").update({ manager1_score: homeScore, manager2_score: awayScore }).eq("id", match.id);
  };

  const finalizeWeekScores = async (week: number) => {
    if (!leagueId) return;
    const { data: freshSchedule, error: scheduleError } = await supabase
      .from("league_schedules")
      .select("*")
      .eq("league_id", leagueId)
      .eq("week", week);

    if (scheduleError || !freshSchedule) {
      console.error("Error fetching schedule:", scheduleError);
      return;
    }

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

    await recalculateAllStandings();

    await supabase.from("transactions").insert({
      type: "score",
      manager_id: null,
      description: `Week ${week} scores ${wasFinalized ? "updated" : "finalized"}:\n${scoreSummary.join("\n")}`,
      week,
      league_id: leagueId,
    });
  };

  const recalculateAllStandings = async () => {
    if (!leagueId) return;

    // Call Postgres function to recalculate standings in a single transaction
    const { error } = await supabase.rpc('update_league_standings', {
      league_uuid: leagueId
    });

    if (error) {
      console.error('Error updating standings:', error);
    }
  };

  const addNewPlayer = async (
    name: string,
    team: string,
    role: "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper",
    isInternational: boolean = false,
  ) => {
    if (!leagueId) return;

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
        console.error("Failed to add player:", masterError);
        return;
      }
      masterId = newMaster.id;
    }

    // Add to league player pool
    await supabase
      .from("league_player_pool")
      .upsert({
        league_id: leagueId,
        player_id: masterId,
        team_override: team,
      }, { onConflict: 'league_id,player_id' });
  };

  const executeTrade = async (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => {
    const manager1 = managers.find((m) => m.id === manager1Id);
    const manager2 = managers.find((m) => m.id === manager2Id);

    if (!manager1 || !manager2 || !leagueId) return;

    // For trades, we need to swap manager_id while preserving slot_type
    // Update players going from manager1 to manager2
    const trade1to2 = players1.map(playerId => {
      const wasActive = manager1.activeRoster.includes(playerId);
      return supabase
        .from("manager_roster")
        .update({ manager_id: manager2Id, slot_type: wasActive ? 'active' : 'bench' })
        .eq("player_id", playerId)
        .eq("league_id", leagueId);
    });

    // Update players going from manager2 to manager1
    const trade2to1 = players2.map(playerId => {
      const wasActive = manager2.activeRoster.includes(playerId);
      return supabase
        .from("manager_roster")
        .update({ manager_id: manager1Id, slot_type: wasActive ? 'active' : 'bench' })
        .eq("player_id", playerId)
        .eq("league_id", leagueId);
    });

    await Promise.all([...trade1to2, ...trade2to1]);

    const player1Names = players1.map((id) => players.find((p) => p.id === id)?.name).join(", ");
    const player2Names = players2.map((id) => players.find((p) => p.id === id)?.name).join(", ");

    await supabase.from("transactions").insert({
      type: "trade",
      manager_id: manager1Id,
      description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
      league_id: leagueId,
    });
  };

  const resetLeague = async () => {
    if (!leagueId) return;

    // Delete all roster entries for this league from junction table
    await supabase
      .from("manager_roster")
      .delete()
      .eq("league_id", leagueId);

    for (const manager of managers) {
      await supabase
        .from("managers")
        .update({ wins: 0, losses: 0, points: 0 })
        .eq("id", manager.id);
    }
    for (const match of schedule) {
      await supabase
        .from("league_schedules")
        .update({ manager1_score: null, manager2_score: null, is_finalized: false })
        .eq("id", match.id);
    }
    await supabase.from("transactions").delete().eq("league_id", leagueId);
  };

  const updateScoringRules = async (newRules: ScoringRules): Promise<{ success: boolean; error?: string }> => {
    if (!leagueId) return { success: false, error: "No league selected" };

    const { error } = await supabase
      .from('scoring_rules')
      .upsert(
        { league_id: leagueId, rules: newRules as unknown as Json },
        { onConflict: 'league_id' }
      );

    if (error) {
      console.error("Error updating scoring rules:", error);
      return { success: false, error: error.message };
    }

    setScoringRules(newRules);

    // Recompute all historical scores with the new rules
    try {
      await recomputeLeaguePoints(leagueId, newRules);
    } catch (recomputeError) {
      console.error("Error recomputing league points:", recomputeError);
      return { success: true, error: "Rules saved but recompute failed" };
    }

    return { success: true };
  };

  return {
    players,
    managers,
    schedule,
    activities,
    loading,
    currentWeek,
    currentManagerId,
    setCurrentManagerId,
    config,
    leagueName,
    leagueOwnerId,
    scoringRules,
    getFreeAgents,

    getManagerRosterCount,

    addFreeAgent,
    dropPlayerOnly,
    moveToActive,
    moveToBench,
    swapPlayers,
    updateMatchScore,
    finalizeWeekScores,
    addNewPlayer,
    executeTrade,
    resetLeague,
    updateScoringRules,
    refetch: fetchAllData,
    isWeekLocked: () => false,
  };
};

