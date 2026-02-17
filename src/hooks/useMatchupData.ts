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
    isCaptain: boolean;
    isViceCaptain: boolean;
}

export interface MatchupData {
    homeRoster: PlayerWithMatches[];
    awayRoster: PlayerWithMatches[];
    homeScore: number;
    awayScore: number;
    loading: boolean;
    error: string | null;
}

import { calculateFantasyPoints } from '@/lib/scoring-utils';

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

                // Fetch per-week roster entries directly from DB for both managers
                const { data: rosterData, error: rosterError } = await supabase
                    .from('manager_roster')
                    .select('*')
                    .eq('league_id', leagueId)
                    .eq('week', week)
                    .in('manager_id', [homeManager.id, awayManager.id]);

                if (rosterError) throw rosterError;

                const rosterEntries = rosterData || [];
                const homeEntries = rosterEntries.filter(e => e.manager_id === homeManager.id);
                const awayEntries = rosterEntries.filter(e => e.manager_id === awayManager.id);

                const homeActiveIds = homeEntries.filter(e => e.slot_type === 'active').map(e => e.player_id);
                const homeBenchIds = homeEntries.filter(e => e.slot_type === 'bench').map(e => e.player_id);
                const awayActiveIds = awayEntries.filter(e => e.slot_type === 'active').map(e => e.player_id);
                const awayBenchIds = awayEntries.filter(e => e.slot_type === 'bench').map(e => e.player_id);

                // Captain/VC lookups
                const homeCaptainId = homeEntries.find(e => e.is_captain)?.player_id ?? null;
                const homeVcId = homeEntries.find(e => e.is_vice_captain)?.player_id ?? null;
                const awayCaptainId = awayEntries.find(e => e.is_captain)?.player_id ?? null;
                const awayVcId = awayEntries.find(e => e.is_vice_captain)?.player_id ?? null;

                const homePlayerIds = [...homeActiveIds, ...homeBenchIds];
                const awayPlayerIds = [...awayActiveIds, ...awayBenchIds];
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
                // Join with cricket_matches to filter by the match's official week
                const { data: statsData, error: statsError } = await supabase
                    .from('player_match_stats_compat')
                    .select(`
                        *,
                        match:cricket_matches!inner(match_week)
                    `)
                    .eq('league_id', leagueId)
                    .eq('match.match_week', week)
                    .in('player_id', allPlayerIds);

                if (statsError) throw statsError;

                const allStats = (statsData || []).map(mapDbPlayerMatchStats);

                // Helper to get points (DB or Calculated)
                const getPoints = (stat: PlayerMatchStats) => {
                    if (stat.fantasyPoints != null && stat.fantasyPoints !== 0) return stat.fantasyPoints;
                    // Fallback to calculation
                    return calculateFantasyPoints(stat);
                };

                // Build roster data for home manager
                const homeRoster: PlayerWithMatches[] = homePlayerIds
                    .map(playerId => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;

                        const playerStats = allStats.filter(s => s.playerId === playerId);
                        // Update stats with calculated points if needed
                        playerStats.forEach(s => {
                            if (!s.fantasyPoints) s.fantasyPoints = getPoints(s);
                        });

                        const totalPointsRaw = playerStats.reduce((sum, s) => sum + (s.fantasyPoints || 0), 0);
                        const isActive = homeActiveIds.includes(playerId);
                        const isCaptain = playerId === homeCaptainId;
                        const isViceCaptain = playerId === homeVcId;
                        // Apply multipliers: 2× for captain, 1.5× for VC
                        const totalPoints = isCaptain ? totalPointsRaw * 2 : isViceCaptain ? totalPointsRaw * 1.5 : totalPointsRaw;

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
                            isCaptain,
                            isViceCaptain,
                        };
                    })
                    .filter((item): item is PlayerWithMatches => item !== null);

                // Build roster data for away manager
                const awayRoster: PlayerWithMatches[] = awayPlayerIds
                    .map(playerId => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;

                        const playerStats = allStats.filter(s => s.playerId === playerId);
                        // Update stats with calculated points if needed
                        playerStats.forEach(s => {
                            if (!s.fantasyPoints) s.fantasyPoints = getPoints(s);
                        });

                        const totalPointsRaw = playerStats.reduce((sum, s) => sum + (s.fantasyPoints || 0), 0);
                        const isActive = awayActiveIds.includes(playerId);
                        const isCaptain = playerId === awayCaptainId;
                        const isViceCaptain = playerId === awayVcId;
                        const totalPoints = isCaptain ? totalPointsRaw * 2 : isViceCaptain ? totalPointsRaw * 1.5 : totalPointsRaw;

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
                            isCaptain,
                            isViceCaptain,
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
