import { useEffect, useState, useMemo } from 'react';
import { calculateFantasyPoints } from '@/lib/fantasy-points-calculator';
import { Manager } from '@/lib/supabase-types';
import { useGameStore } from '@/store/useGameStore';

export function useWeeklyScores(leagueId: string | null, week: number, managers: Manager[]) {
    const weeklyStats = useGameStore(state => state.weeklyStats);
    const weeklyRosters = useGameStore(state => state.weeklyRosters);
    const fetchWeeklyData = useGameStore(state => state.fetchWeeklyData);
    const scoringRules = useGameStore(state => state.scoringRules);
    const [loading, setLoading] = useState(false);

    // Fetch data if not present
    useEffect(() => {
        if (leagueId && (!weeklyStats[week] || !weeklyRosters[week])) {
            setLoading(true);
            fetchWeeklyData(leagueId, week).finally(() => setLoading(false));
        }
    }, [leagueId, week, weeklyStats, weeklyRosters, fetchWeeklyData]);

    const scores = useMemo(() => {
        if (!leagueId || managers.length === 0) return {};

        const statsData = weeklyStats[week];
        const rostersData = weeklyRosters[week];
        if (!statsData || !rostersData) return {};

        const managerScores: Record<string, number> = {};

        // Iterate over managers to calculate their scores based on their active roster for this week
        managers.forEach(manager => {
            let managerTotal = 0;
            const managerActiveRoster = rostersData.filter(e => e.manager_id === manager.id && e.slot_type === 'active');

            managerActiveRoster.forEach(entry => {
                const playerId = entry.player_id;
                const isCaptain = entry.is_captain;
                const isViceCaptain = entry.is_vice_captain;

                const playerStats = statsData.filter((s) => s.playerId === playerId);

                if (playerStats && playerStats.length > 0) {
                    playerStats.forEach((stat) => {
                        const pointsRaw = calculateFantasyPoints({
                            runs: stat.runs || 0,
                            ballsFaced: stat.ballsFaced || 0,
                            fours: stat.fours || 0,
                            sixes: stat.sixes || 0,
                            isOut: stat.isOut,
                            isInPlaying11: stat.isInPlaying11,
                            isImpactPlayer: stat.isImpactPlayer,
                            isManOfMatch: stat.isManOfMatch,
                            teamWon: stat.teamWon,
                            wickets: stat.wickets || 0,
                            overs: stat.overs || 0,
                            maidens: stat.maidens || 0,
                            runsConceded: stat.runsConceded || 0,
                            dots: stat.dots || 0,
                            wides: stat.wides || 0,
                            noBalls: stat.noBalls || 0,
                            lbwBowledCount: stat.lbwBowledCount || 0,
                            catches: stat.catches || 0,
                            stumpings: stat.stumpings || 0,
                            runOuts: stat.runOuts || 0,
                        }, scoringRules).total;

                        const points = isCaptain ? pointsRaw * 2 : isViceCaptain ? pointsRaw * 1.5 : pointsRaw;
                        managerTotal += points;
                    });
                }
            });

            managerScores[manager.id] = managerTotal;
        });

        return managerScores;
    }, [leagueId, week, managers, weeklyStats, weeklyRosters, scoringRules]);

    return { scores, loading: loading || !weeklyStats[week] };
}

