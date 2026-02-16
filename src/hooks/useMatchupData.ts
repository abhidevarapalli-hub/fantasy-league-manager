import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, Manager, CricketMatch, PlayerMatchStats, mapDbCricketMatch, mapDbPlayerMatchStats } from '@/lib/supabase-types';
import { Tables } from '@/integrations/supabase/types';

export interface PlayerWithMatches {
    player: Player;
    cricketMatches: CricketMatch[];
    stats: PlayerMatchStats[];
    totalPoints: number;
    isActive: boolean;
}

export interface MatchupData {
    homeRoster: PlayerWithMatches[];
    awayRoster: PlayerWithMatches[];
    homeScore: number;
    awayScore: number;
    loading: boolean;
    error: string | null;
}

export function useMatchupData(
    week: number,
    homeManager: Manager | undefined,
    awayManager: Manager | undefined,
    players: Player[],
    leagueId: string | null
): MatchupData {
    const [data, setData] = useState<MatchupData>({
        homeRoster: [],
        awayRoster: [],
        homeScore: 0,
        awayScore: 0,
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!homeManager || !awayManager || !leagueId) {
            setData(prev => ({ ...prev, loading: false }));
            return;
        }

        const fetchMatchupData = async () => {
            try {
                setData(prev => ({ ...prev, loading: true, error: null }));

                // Get all player IDs for both managers
                const homePlayerIds = [...homeManager.activeRoster, ...homeManager.bench];
                const awayPlayerIds = [...awayManager.activeRoster, ...awayManager.bench];
                const allPlayerIds = [...homePlayerIds, ...awayPlayerIds];

                if (allPlayerIds.length === 0) {
                    setData({
                        homeRoster: [],
                        awayRoster: [],
                        homeScore: 0,
                        awayScore: 0,
                        loading: false,
                        error: null,
                    });
                    return;
                }

                // 1. Get league details to find tournament_id
                const { data: leagueData, error: leagueError } = await supabase
                    .from('leagues')
                    .select('tournament_id')
                    .eq('id', leagueId)
                    .single();

                if (leagueError) throw leagueError;
                const tournamentId = leagueData.tournament_id;

                // 2. Fetch cricket matches for this week and tournament
                const { data: matchesData, error: matchesError } = await supabase
                    .from('cricket_matches')
                    .select('*')
                    .eq('series_id', tournamentId)
                    .eq('match_week', week);

                if (matchesError) throw matchesError;

                const cricketMatches = (matchesData || []).map(mapDbCricketMatch);

                // Fetch player stats for this week
                const { data: statsData, error: statsError } = await supabase
                    .from('player_match_stats_compat')
                    .select('*')
                    .eq('league_id', leagueId)
                    .eq('week', week)
                    .in('player_id', allPlayerIds);

                if (statsError) throw statsError;

                const allStats = (statsData || []).map(mapDbPlayerMatchStats);

                // Build roster data for home manager
                const homeRoster: PlayerWithMatches[] = homePlayerIds
                    .map(playerId => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;

                        const playerStats = allStats.filter(s => s.playerId === playerId);
                        const totalPoints = playerStats.reduce((sum, s) => sum + (s.fantasyPoints || 0), 0);
                        const isActive = homeManager.activeRoster.includes(playerId);

                        // Get cricket matches for this player's team
                        const playerMatches = cricketMatches.filter(
                            m =>
                                m.team1.name === player.team ||
                                m.team1.shortName === player.team ||
                                m.team2.name === player.team ||
                                m.team2.shortName === player.team
                        );

                        return {
                            player,
                            cricketMatches: playerMatches,
                            stats: playerStats,
                            totalPoints,
                            isActive,
                        };
                    })
                    .filter((item): item is PlayerWithMatches => item !== null);

                // Build roster data for away manager
                const awayRoster: PlayerWithMatches[] = awayPlayerIds
                    .map(playerId => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;

                        const playerStats = allStats.filter(s => s.playerId === playerId);
                        const totalPoints = playerStats.reduce((sum, s) => sum + (s.fantasyPoints || 0), 0);
                        const isActive = awayManager.activeRoster.includes(playerId);

                        // Get cricket matches for this player's team
                        const playerMatches = cricketMatches.filter(
                            m =>
                                m.team1.name === player.team ||
                                m.team1.shortName === player.team ||
                                m.team2.name === player.team ||
                                m.team2.shortName === player.team
                        );

                        return {
                            player,
                            cricketMatches: playerMatches,
                            stats: playerStats,
                            totalPoints,
                            isActive,
                        };
                    })
                    .filter((item): item is PlayerWithMatches => item !== null);

                // Calculate total scores (only active roster counts)
                const homeScore = homeRoster
                    .filter(r => r.isActive)
                    .reduce((sum, r) => sum + r.totalPoints, 0);

                const awayScore = awayRoster
                    .filter(r => r.isActive)
                    .reduce((sum, r) => sum + r.totalPoints, 0);

                setData({
                    homeRoster,
                    awayRoster,
                    homeScore,
                    awayScore,
                    loading: false,
                    error: null,
                });
            } catch (error) {
                console.error('Error fetching matchup data:', error);
                setData(prev => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load matchup data',
                }));
            }
        };

        fetchMatchupData();
    }, [week, homeManager, awayManager, players, leagueId]);

    return data;
}
