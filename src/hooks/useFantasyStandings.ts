/**
 * Hook to fetch fantasy standings from the database
 * Uses the get_fantasy_standings PostgreSQL function
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FantasyStanding {
  managerId: string;
  managerName: string;
  teamName: string;
  totalPoints: number;
  rank: number;
}

export interface WeeklyPoints {
  managerId: string;
  week: number;
  points: number;
}

export function useFantasyStandings(leagueId: string | null) {
  const [standings, setStandings] = useState<FantasyStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = useCallback(async () => {
    if (!leagueId) {
      setStandings([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_fantasy_standings', { p_league_id: leagueId });

      if (fetchError) {
        console.error('Error fetching fantasy standings:', fetchError);
        setError(fetchError.message);
        setStandings([]);
        return;
      }

      const mappedStandings: FantasyStanding[] = (data || []).map((row: {
        manager_id: string;
        manager_name: string;
        team_name: string;
        total_points: number;
        rank: number;
      }) => ({
        managerId: row.manager_id,
        managerName: row.manager_name,
        teamName: row.team_name,
        totalPoints: Number(row.total_points) || 0,
        rank: Number(row.rank) || 0,
      }));

      setStandings(mappedStandings);
    } catch (err) {
      console.error('Exception fetching fantasy standings:', err);
      setError('Failed to fetch standings');
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  return { standings, loading, error, refetch: fetchStandings };
}

/**
 * Hook to fetch weekly fantasy points for a manager
 */
export function useManagerWeeklyPoints(
  leagueId: string | null,
  managerId: string | null,
  week: number
) {
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchPoints = useCallback(async () => {
    if (!leagueId || !managerId) {
      setPoints(0);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_manager_weekly_points', {
          p_league_id: leagueId,
          p_manager_id: managerId,
          p_week: week,
        });

      if (!error && data !== null) {
        setPoints(Number(data) || 0);
      }
    } catch (err) {
      console.error('Error fetching weekly points:', err);
    } finally {
      setLoading(false);
    }
  }, [leagueId, managerId, week]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { points, loading, refetch: fetchPoints };
}

/**
 * Hook to fetch total fantasy points for a manager
 */
export function useManagerTotalPoints(
  leagueId: string | null,
  managerId: string | null
) {
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchPoints = useCallback(async () => {
    if (!leagueId || !managerId) {
      setPoints(0);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_manager_total_points', {
          p_league_id: leagueId,
          p_manager_id: managerId,
        });

      if (!error && data !== null) {
        setPoints(Number(data) || 0);
      }
    } catch (err) {
      console.error('Error fetching total points:', err);
    } finally {
      setLoading(false);
    }
  }, [leagueId, managerId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { points, loading, refetch: fetchPoints };
}
