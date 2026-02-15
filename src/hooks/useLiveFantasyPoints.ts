/**
 * Hook for live fantasy points with real-time updates
 * Subscribes to player_match_stats changes and provides live standings
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { livePollingService, type LiveMatchUpdate } from '@/lib/live-polling-service';

export interface LiveFantasyStanding {
  managerId: string;
  managerName: string;
  teamName: string;
  totalPoints: number;
  livePoints: number;
  finalizedPoints: number;
  hasLiveStats: boolean;
  rank: number;
}

export interface LiveMatchInfo {
  matchId: string;
  cricbuzzMatchId: number;
  matchDescription: string;
  team1Name: string;
  team2Name: string;
  isLive: boolean;
  lastUpdatedAt: string | null;
}

/**
 * Hook for live fantasy standings with real-time updates
 */
export function useLiveFantasyStandings(leagueId: string | null) {
  const [standings, setStandings] = useState<LiveFantasyStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStandings = useCallback(async () => {
    if (!leagueId) {
      setStandings([]);
      setHasLiveData(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        'get_live_fantasy_standings',
        { p_league_id: leagueId }
      );

      if (fetchError) {
        console.error('Error fetching live standings:', fetchError);
        setError(fetchError.message);
        setStandings([]);
        return;
      }

      const mappedStandings: LiveFantasyStanding[] = (data || []).map(
        (row: {
          manager_id: string;
          manager_name: string;
          team_name: string;
          total_points: number;
          live_points: number;
          finalized_points: number;
          has_live_stats: boolean;
          rank: number;
        }) => ({
          managerId: row.manager_id,
          managerName: row.manager_name,
          teamName: row.team_name,
          totalPoints: Number(row.total_points) || 0,
          livePoints: Number(row.live_points) || 0,
          finalizedPoints: Number(row.finalized_points) || 0,
          hasLiveStats: row.has_live_stats,
          rank: Number(row.rank) || 0,
        })
      );

      setStandings(mappedStandings);
      setHasLiveData(mappedStandings.some(s => s.hasLiveStats));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Exception fetching live standings:', err);
      setError('Failed to fetch standings');
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  // Initial fetch
  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = livePollingService.subscribeToLiveStats(
      leagueId,
      (_update: LiveMatchUpdate) => {
        // Refetch standings when stats update
        fetchStandings();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [leagueId, fetchStandings]);

  return {
    standings,
    loading,
    error,
    hasLiveData,
    lastUpdated,
    refetch: fetchStandings,
  };
}

/**
 * Hook for getting live matches in a league
 */
export function useLiveMatches(leagueId: string | null) {
  const [liveMatches, setLiveMatches] = useState<LiveMatchInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLiveMatches = useCallback(async () => {
    if (!leagueId) {
      setLiveMatches([]);
      return;
    }

    setLoading(true);

    try {
      // Get matches via league_cricket_matches view (includes match_state from live_match_polling)
      const { data, error } = await supabase
        .from('league_cricket_matches')
        .select('*')
        .eq('league_id', leagueId);

      if (error) {
        console.error('Error fetching live matches:', error);
        setLiveMatches([]);
        return;
      }

      // Filter for live matches
      const liveData = (data || []).filter(m => m.match_state === 'Live');

      if (liveData.length === 0) {
        setLiveMatches([]);
        return;
      }

      // Get last update time for each match
      const matchIds = liveData.map(m => m.id!);
      const { data: statsData } = await supabase
        .from('player_match_stats_compat')
        .select('match_id, live_updated_at')
        .in('match_id', matchIds)
        .eq('is_live_stats', true)
        .order('live_updated_at', { ascending: false });

      // Create a map of match_id to latest update time
      const lastUpdateMap = new Map<string, string>();
      if (statsData) {
        for (const stat of statsData) {
          if (stat.match_id && !lastUpdateMap.has(stat.match_id) && stat.live_updated_at) {
            lastUpdateMap.set(stat.match_id, stat.live_updated_at);
          }
        }
      }

      const matches: LiveMatchInfo[] = liveData.map(m => ({
        matchId: m.id!,
        cricbuzzMatchId: m.cricbuzz_match_id!,
        matchDescription: m.match_description || '',
        team1Name: m.team1_name || '',
        team2Name: m.team2_name || '',
        isLive: m.match_state === 'Live',
        lastUpdatedAt: lastUpdateMap.get(m.id!) || null,
      }));

      setLiveMatches(matches);
    } catch (err) {
      console.error('Error fetching live matches:', err);
      setLiveMatches([]);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchLiveMatches();
  }, [fetchLiveMatches]);

  // Subscribe to match state changes on cricket_matches
  useEffect(() => {
    if (!leagueId) return;

    // Subscribe to live_match_polling changes (match_state lives here now)
    const channel = supabase
      .channel(`live_match_polling_${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_match_polling',
        },
        () => {
          // Refetch when any match updates - we'll filter for our league's matches
          fetchLiveMatches();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [leagueId, fetchLiveMatches]);

  return { liveMatches, loading, refetch: fetchLiveMatches };
}

/**
 * Hook for manager's live points
 */
export function useManagerLivePoints(
  leagueId: string | null,
  managerId: string | null
) {
  const [points, setPoints] = useState<{
    total: number;
    live: number;
    finalized: number;
  }>({ total: 0, live: 0, finalized: 0 });
  const [loading, setLoading] = useState(false);
  const [hasLiveStats, setHasLiveStats] = useState(false);

  const fetchPoints = useCallback(async () => {
    if (!leagueId || !managerId) {
      setPoints({ total: 0, live: 0, finalized: 0 });
      setHasLiveStats(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('player_match_stats_compat')
        .select('fantasy_points, is_live_stats')
        .eq('league_id', leagueId)
        .eq('manager_id', managerId)
        .eq('was_in_active_roster', true);

      if (error) {
        console.error('Error fetching manager points:', error);
        return;
      }

      let total = 0;
      let live = 0;
      let finalized = 0;
      let hasLive = false;

      for (const stat of data || []) {
        const pts = stat.fantasy_points || 0;
        total += pts;
        if (stat.is_live_stats) {
          live += pts;
          hasLive = true;
        } else {
          finalized += pts;
        }
      }

      setPoints({ total, live, finalized });
      setHasLiveStats(hasLive);
    } catch (err) {
      console.error('Error fetching manager points:', err);
    } finally {
      setLoading(false);
    }
  }, [leagueId, managerId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = livePollingService.subscribeToLiveStats(
      leagueId,
      (update: LiveMatchUpdate) => {
        // Only refetch if it's for this manager (or we don't know the manager)
        fetchPoints();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [leagueId, fetchPoints]);

  return { points, loading, hasLiveStats, refetch: fetchPoints };
}

/**
 * Hook for checking if league has any live stats
 */
export function useHasLiveStats(leagueId: string | null) {
  const [hasLive, setHasLive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leagueId) {
      setHasLive(false);
      return;
    }

    const checkLiveStats = async () => {
      setLoading(true);
      try {
        const { count, error } = await supabase
          .from('player_match_stats_compat')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', leagueId)
          .eq('is_live_stats', true);

        setHasLive(!error && (count ?? 0) > 0);
      } catch {
        setHasLive(false);
      } finally {
        setLoading(false);
      }
    };

    checkLiveStats();

    // Subscribe to changes
    const unsubscribe = livePollingService.subscribeToLiveStats(leagueId, () => {
      checkLiveStats();
    });

    return () => {
      unsubscribe();
    };
  }, [leagueId]);

  return { hasLive, loading };
}
