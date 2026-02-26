import { useEffect, useState, useMemo } from 'react';
import { calculateFantasyPoints } from '@/lib/fantasy-points-calculator';
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-types';
import { TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { useGameStore } from '@/store/useGameStore';
import { ManagerRosterEntry } from '@/store/gameStore/types';
import { Player, CricketMatch, PlayerMatchStats, Manager } from '@/lib/supabase-types';
import { Tables } from '@/integrations/supabase/types';

export interface PlayerWithMatches {
    player: Player;
    cricketMatches: CricketMatch[];
    stats: PlayerMatchStats[];
    totalPoints: number;
    isActive: boolean;
    isCaptain: boolean;
    isViceCaptain: boolean;
}

export interface MatchupData {
    homeRoster: PlayerWithMatches[];
    awayRoster: PlayerWithMatches[];
    homeScore: number;
    awayScore: number;
}

export interface MatchupState {
    data: MatchupData | null;
    loading: boolean;
    error: string | null;
}

export function useMatchupData(
    week: number,
    homeManager: Manager | undefined,
    awayManager: Manager | undefined,
    players: Player[],
    leagueId: string | null
): MatchupState {
    const weeklyStats = useGameStore(state => state.weeklyStats);
    const weeklyMatches = useGameStore(state => state.weeklyMatches);
    const weeklyRosters = useGameStore(state => state.weeklyRosters);
    const fetchWeeklyData = useGameStore(state => state.fetchWeeklyData);
    const [fetching, setFetching] = useState(false);

    // Trigger fetch if data is missing for this week
    useEffect(() => {
        if (leagueId && (!weeklyStats[week] || !weeklyMatches[week] || !weeklyRosters[week])) {
            setFetching(true);
            fetchWeeklyData(leagueId, week).finally(() => setFetching(false));
        }
    }, [leagueId, week, weeklyStats, weeklyMatches, weeklyRosters, fetchWeeklyData]);

    const data = useMemo(() => {
        if (!leagueId || !homeManager || !awayManager || !players.length) return null;

        const statsData = weeklyStats[week];
        const matchesData = weeklyMatches[week];
        const rostersData = weeklyRosters[week];

        if (!statsData || !matchesData || !rostersData) return null;

        const homeEntries = rostersData.filter(e => e.manager_id === homeManager.id);
        const awayEntries = rostersData.filter(e => e.manager_id === awayManager.id);

        if (homeEntries.length === 0 && awayEntries.length === 0) {
            return {
                homeRoster: [],
                awayRoster: [],
                homeScore: 0,
                awayScore: 0,
            };
        }

        const getCountry = (t: string) => TEAM_SHORT_TO_COUNTRY[t] || t;

        const buildRoster = (managerEntries: ManagerRosterEntry[]) => {
            const rosterIds = managerEntries.map(e => e.player_id);
            const activeIds = managerEntries.filter(e => e.slot_type === 'active').map(e => e.player_id);
            const captainId = managerEntries.find(e => e.is_captain)?.player_id;
            const vcId = managerEntries.find(e => e.is_vice_captain)?.player_id;

            return rosterIds
                .map(playerId => {
                    const player = players.find(p => p.id === playerId);
                    if (!player) return null;

                    const playerStats = statsData.filter(s => s.playerId === playerId);

                    // Map stats with on-the-fly point calculation to match useWeeklyScores
                    const statsWithPoints = playerStats.map(stat => {
                        const ptsRaw = calculateFantasyPoints({
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
                        }, DEFAULT_SCORING_RULES).total;

                        return { ...stat, fantasyPoints: ptsRaw };
                    });

                    // Total points calculation (including Captain/VC multipliers)
                    const totalPointsRaw = statsWithPoints.reduce((sum, s) => sum + (s.fantasyPoints || 0), 0);
                    const isActive = activeIds.includes(playerId);
                    const isCaptain = playerId === captainId;
                    const isViceCaptain = playerId === vcId;
                    const totalPoints = isCaptain ? totalPointsRaw * 2 : isViceCaptain ? totalPointsRaw * 1.5 : totalPointsRaw;

                    const pCountry = getCountry(player.team);

                    const playerMatches = matchesData.filter(
                        m =>
                            getCountry(m.team1.name || '') === pCountry ||
                            getCountry(m.team1.shortName || '') === pCountry ||
                            getCountry(m.team2.name || '') === pCountry ||
                            getCountry(m.team2.shortName || '') === pCountry ||
                            statsWithPoints.some(s => s.matchId === m.id)
                    );

                    return {
                        player,
                        cricketMatches: playerMatches,
                        stats: statsWithPoints,
                        totalPoints,
                        isActive,
                        isCaptain,
                        isViceCaptain,
                    };
                })
                .filter((item): item is PlayerWithMatches => item !== null);
        };

        const homeRoster = buildRoster(homeEntries);
        const awayRoster = buildRoster(awayEntries);

        const homeScore = homeRoster.filter(r => r.isActive).reduce((sum, r) => sum + r.totalPoints, 0);
        const awayScore = awayRoster.filter(r => r.isActive).reduce((sum, r) => sum + r.totalPoints, 0);

        return {
            homeRoster,
            awayRoster,
            homeScore,
            awayScore,
        };
    }, [week, homeManager, awayManager, players, leagueId, weeklyStats, weeklyMatches, weeklyRosters]);

    const isLoading = fetching || !data;

    return { data, loading: isLoading, error: null };
}
