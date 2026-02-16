import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFantasyPoints } from '@/lib/scoring-utils';
import { Manager } from '@/lib/supabase-types';

interface PlayerStatRow {
    fantasy_points: number | null;
    player_id: string;
    manager_id: string;
    runs: number;
    fours: number;
    sixes: number;
    is_out: boolean;
    wickets: number;
    overs: number;
    economy: number | null;
    maidens: number;
    catches: number;
    stumpings: number;
    run_outs: number;
    dismissal_type: string | null;
}

export function useWeeklyScores(leagueId: string | null, week: number, managers: Manager[]) {
    const [scores, setScores] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!leagueId || managers.length === 0) return;

        const fetchScores = async () => {
            setLoading(true);
            try {
                // 1. Fetch all player stats for this week and league
                // We need to join with cricket_matches to filter by match_week
                const { data: statsData, error: statsError } = await supabase
                    .from('player_match_stats_compat')
                    .select(`
                        fantasy_points,
                        player_id,
                        manager_id,
                        runs, fours, sixes, is_out, wickets, overs, economy, maidens, catches, stumpings, run_outs, dismissal_type,
                        match:cricket_matches!inner(match_week)
                    `)
                    .eq('league_id', leagueId)
                    .eq('match.match_week', week);

                if (statsError) throw statsError;

                const managerScores: Record<string, number> = {};

                console.log(`[useWeeklyScores] Managers: ${managers.length}, Stats Found: ${statsData?.length}`);

                // Iterate over managers to calculate their scores based on their CURRENT active roster
                managers.forEach(manager => {
                    let managerTotal = 0;

                    manager.activeRoster.forEach(playerId => {
                        // Find all stats for this player (could be multiple if multiple matches in a week?)
                        // Typically one per match.
                        const playerStats = statsData?.filter((s: PlayerStatRow) => s.player_id === playerId);

                        if (playerStats && playerStats.length > 0) {
                            playerStats.forEach((stat: PlayerStatRow) => {
                                // Always calculate points on client to ensure consistency with current rules
                                // and avoid stale DB values (e.g. old rules where Wicket=25 instead of 30)
                                const points = calculateFantasyPoints({
                                    runs: stat.runs,
                                    fours: stat.fours,
                                    sixes: stat.sixes,
                                    isNotOut: !stat.is_out,
                                    wickets: stat.wickets,
                                    overs: stat.overs,
                                    economy: stat.economy,
                                    maidens: stat.maidens,
                                    catches: stat.catches,
                                    stumpings: stat.stumpings,
                                    runOuts: stat.run_outs,
                                    dismissalType: stat.dismissal_type
                                });
                                // console.log(`[useWeeklyScores] Calculated points for ${playerId}: ${points}`);
                                managerTotal += points;
                            });
                        }
                    });

                    managerScores[manager.id] = managerTotal;
                });

                console.log("[useWeeklyScores] Calculated Scores:", managerScores);
                setScores(managerScores);
            } catch (error) {
                console.error("Error fetching weekly scores:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, [leagueId, week, managers]); // Added managers to dependency array

    return { scores, loading };
}
