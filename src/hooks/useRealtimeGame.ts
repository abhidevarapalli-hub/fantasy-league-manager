import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Player, Manager, Match, Activity, PlayerTransaction } from "@/lib/supabase-types";

const ROSTER_CAP = 14;

// Helper to map DB rows to frontend types
const mapDbPlayer = (db: Tables<"players">): Player => ({
  id: db.id,
  name: db.name,
  team: db.team,
  role: db.role as Player["role"],
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

export const useRealtimeGame = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [schedule, setSchedule] = useState<Match[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentManagerId, setCurrentManagerId] = useState("");

  // Initial data fetch
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [playersRes, managersRes, scheduleRes, transactionsRes] = await Promise.all([
          supabase.from("players").select("*").order("name"),
          supabase.from("managers").select("*").order("name"),
          supabase.from("schedule").select("*").order("week").order("created_at"),
          supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
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
    };

    fetchAllData();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("game-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        // console.log('Players change:', payload);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "managers" }, (payload) => {
        console.log("Managers change:", payload);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule" }, (payload) => {
        console.log("Schedule change:", payload);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (payload) => {
        console.log("Transactions change:", payload);
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
  }, []);

  // Helper functions
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

  // Actions
  const addFreeAgent = async (managerId: string, playerId: string, dropPlayerId?: string) => {
    const manager = managers.find((m) => m.id === managerId);
    const player = players.find((p) => p.id === playerId);
    const dropPlayer = dropPlayerId ? players.find((p) => p.id === dropPlayerId) : null;

    if (!manager || !player) return;

    const rosterCount = manager.activeRoster.length + manager.bench.length;
    if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

    // Update manager roster
    let newRoster = [...manager.activeRoster];
    let newBench = [...manager.bench];

    if (dropPlayerId) {
      newRoster = newRoster.filter((id) => id !== dropPlayerId);
      newBench = newBench.filter((id) => id !== dropPlayerId);
    }
    newBench = [...newBench, playerId];

    // Update manager in database
    const { error: updateError } = await supabase
      .from("managers")
      .update({ roster: newRoster, bench: newBench })
      .eq("id", managerId);

    if (updateError) {
      console.error("Error updating manager:", updateError);
      return;
    }

    // Create transaction record
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
      type: "add" as const,
      manager_id: managerId,
      manager_team_name: manager.teamName,
      description,
      players: playerTransactions as unknown as undefined,
    });
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

    await supabase.from("transactions").insert({
      type: "drop" as const,
      manager_id: managerId,
      manager_team_name: manager.teamName,
      description: `${manager.teamName} dropped ${player.name}`,
      players: [playerTx] as unknown as undefined,
    });
  };

  const moveToActive = async (managerId: string, playerId: string) => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager || manager.activeRoster.length >= 11) return;

    const newRoster = [...manager.activeRoster, playerId];
    const newBench = manager.bench.filter((id) => id !== playerId);

    await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
  };

  const moveToBench = async (managerId: string, playerId: string) => {
    const manager = managers.find((m) => m.id === managerId);
    if (!manager || manager.bench.length >= 3) return;

    const newBench = [...manager.bench, playerId];
    const newRoster = manager.activeRoster.filter((id) => id !== playerId);

    await supabase.from("managers").update({ roster: newRoster, bench: newBench }).eq("id", managerId);
  };

  const updateMatchScore = async (week: number, matchIndex: number, homeScore: number, awayScore: number) => {
    const weekMatches = schedule.filter((m) => m.week === week);
    if (matchIndex >= weekMatches.length) return;

    const match = weekMatches[matchIndex];

    await supabase.from("schedule").update({ home_score: homeScore, away_score: awayScore }).eq("id", match.id);
  };

  const finalizeWeekScores = async (week: number) => {
    // Fetch fresh schedule data from database to avoid stale state issues
    const { data: freshSchedule, error: scheduleError } = await supabase
      .from("schedule")
      .select("*")
      .eq("week", week);

    if (scheduleError || !freshSchedule) {
      console.error("Error fetching schedule:", scheduleError);
      return;
    }

    const weekMatches = freshSchedule.map(mapDbSchedule);
    const allHaveScores = weekMatches.every((m) => m.homeScore !== undefined && m.awayScore !== undefined);

    if (!allHaveScores) {
      console.log("Not all matches have scores yet");
      return;
    }

    const wasFinalized = weekMatches.some((m) => m.completed);
    const scoreSummary: string[] = [];

    // Mark all matches as finalized
    for (const match of weekMatches) {
      await supabase.from("schedule").update({ is_finalized: true }).eq("id", match.id);

      const homeManager = managers.find((m) => m.id === match.home);
      const awayManager = managers.find((m) => m.id === match.away);

      if (homeManager && awayManager) {
        scoreSummary.push(`${homeManager.teamName} ${match.homeScore} - ${match.awayScore} ${awayManager.teamName}`);

        if (!wasFinalized) {
          const homeWins = match.homeScore! > match.awayScore!;
          const awayWins = match.awayScore! > match.homeScore!;

          await supabase
            .from("managers")
            .update({
              wins: homeManager.wins + (homeWins ? 1 : 0),
              losses: homeManager.losses + (awayWins ? 1 : 0),
              points: homeManager.points + match.homeScore!,
            })
            .eq("id", match.home);

          await supabase
            .from("managers")
            .update({
              wins: awayManager.wins + (awayWins ? 1 : 0),
              losses: awayManager.losses + (homeWins ? 1 : 0),
              points: awayManager.points + match.awayScore!,
            })
            .eq("id", match.away);
        }
      }
    }

    await supabase.from("transactions").insert({
      type: "score" as const,
      manager_id: null,
      manager_team_name: null,
      description: `Week ${week} scores ${wasFinalized ? "updated" : "finalized"}:\n${scoreSummary.join("\n")}`,
      week,
    });
  };

  const addNewPlayer = async (
    name: string,
    team: string,
    role: "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper",
  ) => {
    await supabase.from("players").insert({ name, team, role });
  };

  const executeTrade = async (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => {
    const manager1 = managers.find((m) => m.id === manager1Id);
    const manager2 = managers.find((m) => m.id === manager2Id);

    if (!manager1 || !manager2) return;

    // Update manager 1
    const new1Roster = [
      ...manager1.activeRoster.filter((id) => !players1.includes(id)),
      ...players2.filter((id) => manager2.activeRoster.includes(id)),
    ];
    const new1Bench = [
      ...manager1.bench.filter((id) => !players1.includes(id)),
      ...players2.filter((id) => manager2.bench.includes(id)),
    ];

    // Update manager 2
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

    await supabase.from("transactions").insert({
      type: "trade" as const,
      manager_id: manager1Id,
      manager_team_name: manager1.teamName,
      description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
    });
  };

  const resetLeague = async () => {
    // Reset all managers
    for (const manager of managers) {
      await supabase
        .from("managers")
        .update({ wins: 0, losses: 0, points: 0, roster: [], bench: [] })
        .eq("id", manager.id);
    }

    // Reset all schedule
    for (const match of schedule) {
      await supabase
        .from("schedule")
        .update({ home_score: null, away_score: null, is_finalized: false })
        .eq("id", match.id);
    }

    // Clear transactions
    await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
    getFreeAgents,
    getManagerRosterCount,
    addFreeAgent,
    dropPlayerOnly,
    moveToActive,
    moveToBench,
    updateMatchScore,
    finalizeWeekScores,
    addNewPlayer,
    executeTrade,
    resetLeague,
    isWeekLocked: () => false,
  };
};
