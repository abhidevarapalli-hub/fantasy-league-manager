import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Player, Manager, Match, Activity, PlayerTransaction } from "@/lib/supabase-types";
import {
  DEFAULT_LEAGUE_CONFIG,
  LeagueConfig,
  validateActiveRoster,
  canAddToActive,
} from "@/lib/roster-validation";

interface DbLeague {
  id: string;
  name: string;
  league_manager_id: string;
  manager_count: number;
  active_size: number;
  bench_size: number;
  min_batsmen: number;
  max_batsmen: number;
  min_bowlers: number;
  min_wks: number;
  min_all_rounders: number;
  max_international: number;
}

// Helper to map DB rows to frontend types
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

  const ROSTER_CAP = config.activeSize + config.benchSize;

  // Data fetching logic
  const fetchAllData = useCallback(async () => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const isLegacy = leagueId === 'legacy';

      if (!isLegacy) {
        // Fetch League Config first
        const { data: leagueData } = await (supabase
          .from("leagues" as any)
          .select("*")
          .eq("id", leagueId)
          .single() as any);

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
      } else {
        setLeagueName("Legacy League");
        setConfig(DEFAULT_LEAGUE_CONFIG);
      }

      const buildQuery = (table: string) => {
        let query = supabase.from(table as any).select("*");
        if (isLegacy) {
          return query.is("league_id", null);
        }
        return query.eq("league_id", leagueId);
      };

      const [playersRes, managersRes, scheduleRes, transactionsRes] = await Promise.all([
        (buildQuery("players") as any).order("name"),
        (buildQuery("managers") as any).order("name"),
        (buildQuery("schedule") as any).order("week").order("created_at"),
        (buildQuery("transactions") as any).order("created_at", { ascending: false }).limit(50),
      ]);


      if (playersRes.data) {
        setPlayers(playersRes.data.map(mapDbPlayer));
      }
      if (managersRes.data) {
        const mappedManagers = managersRes.data.map(mapDbManager);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPlayers((prev) => [...prev, mapDbPlayer(payload.new as Tables<"players">)]);
        } else if (payload.eventType === "UPDATE") {
          setPlayers((prev) =>
            prev.map((p) => (p.id === payload.new.id ? mapDbPlayer(payload.new as Tables<"players">) : p)),
          );
        } else if (payload.eventType === "DELETE") {
          setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "managers", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          setManagers((prev) => [...prev, mapDbManager(payload.new as Tables<"managers">)]);
        } else if (payload.eventType === "UPDATE") {
          setManagers((prev) =>
            prev.map((m) => (m.id === payload.new.id ? mapDbManager(payload.new as Tables<"managers">) : m)),
          );
        } else if (payload.eventType === "DELETE") {
          setManagers((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          setSchedule((prev) => [...prev, mapDbSchedule(payload.new as Tables<"schedule">)]);
        } else if (payload.eventType === "UPDATE") {
          setSchedule((prev) =>
            prev.map((s) => (s.id === payload.new.id ? mapDbSchedule(payload.new as Tables<"schedule">) : s)),
          );
        } else if (payload.eventType === "DELETE") {
          setSchedule((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter }, (payload) => {
        if (payload.eventType === "INSERT") {
          setActivities((prev) => [mapDbTransaction(payload.new as Tables<"transactions">), ...prev]);
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

    if (!manager || !player) return;

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

    const { error: updateError } = await supabase
      .from("managers")
      .update({ roster: newRoster, bench: newBench })
      .eq("id", managerId);

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

    await (supabase.from("transactions").insert({
      type: "add" as any,
      manager_id: managerId,
      manager_team_name: manager.teamName,
      description,
      players: playerTransactions as any,
      league_id: leagueId,
    }) as any);
  };

  const dropPlayerOnly = async (managerId: string, playerId: string) => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);

    if (!manager || !player) return;

    const newRoster = manager.activeRoster.filter((id) => id !== playerId);
    const newBench = manager.bench.filter((id) => id !== playerId);

    const { error: updateError } = await supabase
      .from("managers")
      .update({ roster: newRoster, bench: newBench })
      .eq("id", managerId);

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

    await (supabase.from("transactions").insert({
      type: "drop" as any,
      manager_id: managerId,
      manager_team_name: manager.teamName,
      description: `${manager.teamName} dropped ${player.name}`,
      players: [playerTx] as any,
      league_id: leagueId,
    }) as any);
  };

  const moveToActive = async (managerId: string, playerId: string): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);

    if (!manager || !player) return { success: false, error: "Manager or player not found" };
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

    const newRoster = [...manager.activeRoster, playerId];
    const newBench = manager.bench.filter((id) => id !== playerId);

    await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
    return { success: true };
  };

  const moveToBench = async (managerId: string, playerId: string): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager) return { success: false, error: "Manager not found" };
    if (manager.bench.length >= config.benchSize) {
      return { success: false, error: `Bench is full (${config.benchSize} players max)` };
    }

    const newBench = [...manager.bench, playerId];
    const newRoster = manager.activeRoster.filter((id) => id !== playerId);

    await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
    return { success: true };
  };

  const swapPlayers = async (
    managerId: string,
    player1Id: string,
    player2Id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager) return { success: false, error: "Manager not found" };

    const player1InActive = manager.activeRoster.includes(player1Id);
    const player2InActive = manager.activeRoster.includes(player2Id);

    let newRoster = [...manager.activeRoster];
    let newBench = [...manager.bench];

    if (player1InActive && !player2InActive) {
      newRoster = newRoster.filter(id => id !== player1Id);
      newRoster.push(player2Id);
      newBench = newBench.filter(id => id !== player2Id);
      newBench.push(player1Id);
    } else if (!player1InActive && player2InActive) {
      newRoster = newRoster.filter(id => id !== player2Id);
      newRoster.push(player1Id);
      newBench = newBench.filter(id => id !== player1Id);
      newBench.push(player2Id);
    } else {
      return { success: false, error: "Players must be in different sections to swap" };
    }

    await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
    return { success: true };
  };

  const updateMatchScore = async (week: number, matchIndex: number, homeScore: number, awayScore: number) => {
    const weekMatches = schedule.filter((m) => m.week === week);
    if (matchIndex >= weekMatches.length) return;
    const match = weekMatches[matchIndex];
    await supabase.from("schedule").update({ home_score: homeScore, away_score: awayScore }).eq("id", match.id);
  };

  const finalizeWeekScores = async (week: number) => {
    if (!leagueId) return;
    const { data: freshSchedule, error: scheduleError } = await supabase
      .from("schedule")
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
      await supabase.from("schedule").update({ is_finalized: true }).eq("id", match.id);
      const homeManager = managers.find((m) => m.id === match.home);
      const awayManager = managers.find((m) => m.id === match.away);
      if (homeManager && awayManager) {
        scoreSummary.push(`${homeManager.teamName} ${match.homeScore} - ${match.awayScore} ${awayManager.teamName}`);
      }
    }

    await recalculateAllStandings();

    await (supabase.from("transactions").insert({
      type: "score" as any,
      manager_id: null,
      manager_team_name: null,
      description: `Week ${week} scores ${wasFinalized ? "updated" : "finalized"}:\n${scoreSummary.join("\n")}`,
      week,
      league_id: leagueId,
    }) as any);
  };

  const recalculateAllStandings = async () => {
    if (!leagueId) return;
    const { data: allMatches, error } = await supabase
      .from("schedule")
      .select("*")
      .eq("league_id", leagueId)
      .eq("is_finalized", true);

    if (error || !allMatches) return;

    const standings: Record<string, { wins: number; losses: number; points: number }> = {};
    for (const manager of managers) {
      standings[manager.id] = { wins: 0, losses: 0, points: 0 };
    }

    for (const match of allMatches) {
      const homeId = match.home_manager_id;
      const awayId = match.away_manager_id;
      const homeScore = match.home_score ?? 0;
      const awayScore = match.away_score ?? 0;

      if (homeId && standings[homeId]) {
        standings[homeId].points += homeScore;
        if (homeScore > awayScore) standings[homeId].wins += 1;
        else if (homeScore < awayScore) standings[homeId].losses += 1;
      }
      if (awayId && standings[awayId]) {
        standings[awayId].points += awayScore;
        if (awayScore > homeScore) standings[awayId].wins += 1;
        else if (awayScore < homeScore) standings[awayId].losses += 1;
      }
    }

    for (const [managerId, stats] of Object.entries(standings)) {
      await supabase
        .from("managers")
        .update({
          wins: stats.wins,
          losses: stats.losses,
          points: stats.points,
        })
        .eq("id", managerId);
    }
  };

  const addNewPlayer = async (
    name: string,
    team: string,
    role: "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper",
    isInternational: boolean = false,
  ) => {
    if (!leagueId) return;
    await supabase.from("players").insert({ name, team, role, is_international: isInternational, league_id: leagueId });
  };

  const executeTrade = async (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => {
    const manager1 = managers.find((m) => m.id === manager1Id);
    const manager2 = managers.find((m) => m.id === manager2Id);

    if (!manager1 || !manager2) return;

    const new1Roster = [
      ...manager1.activeRoster.filter((id) => !players1.includes(id)),
      ...players2.filter((id) => manager2.activeRoster.includes(id)),
    ];
    const new1Bench = [
      ...manager1.bench.filter((id) => !players1.includes(id)),
      ...players2.filter((id) => manager2.bench.includes(id)),
    ];
    const new2Roster = [
      ...manager2.activeRoster.filter((id) => !players2.includes(id)),
      ...players1.filter((id) => manager1.activeRoster.includes(id)),
    ];
    const new2Bench = [
      ...manager2.bench.filter((id) => !players2.includes(id)),
      ...players1.filter((id) => manager1.bench.includes(id)),
    ];

    await Promise.all([
      supabase.from("managers").update({ roster: new1Roster, bench: new1Bench }).eq("id", manager1Id),
      supabase.from("managers").update({ roster: new2Roster, bench: new2Bench }).eq("id", manager2Id),
    ]);

    const player1Names = players1.map((id) => players.find((p) => p.id === id)?.name).join(", ");
    const player2Names = players2.map((id) => players.find((p) => p.id === id)?.name).join(", ");

    await (supabase.from("transactions").insert({
      type: "trade" as any,
      manager_id: manager1Id,
      manager_team_name: manager1.teamName,
      description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
      league_id: leagueId,
    }) as any);
  };

  const resetLeague = async () => {
    if (!leagueId) return;
    for (const manager of managers) {
      await supabase
        .from("managers")
        .update({ wins: 0, losses: 0, points: 0, roster: [], bench: [] })
        .eq("id", manager.id);
    }
    for (const match of schedule) {
      await supabase
        .from("schedule")
        .update({ home_score: null, away_score: null, is_finalized: false })
        .eq("id", match.id);
    }
    await supabase.from("transactions").delete().eq("league_id", leagueId);
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
    refetch: fetchAllData,
    isWeekLocked: () => false,
  };
};

