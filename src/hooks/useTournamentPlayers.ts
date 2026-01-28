/**
 * Hook for fetching tournament players from Cricbuzz API
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchSeriesSquads,
  fetchSquadPlayers,
  fetchAllTournamentPlayers,
  isApiConfigured,
} from '@/integrations/cricbuzz/client';
import { TournamentSquad, TournamentPlayer } from '@/lib/cricket-types';

export interface TeamWithPlayers {
  team: TournamentSquad;
  players: TournamentPlayer[];
}

/**
 * Fetch all squads for a tournament
 */
export function useTournamentSquads(seriesId: number | null) {
  return useQuery({
    queryKey: ['tournament', 'squads', seriesId],
    queryFn: () => fetchSeriesSquads(seriesId!),
    enabled: !!seriesId && isApiConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Fetch players for a specific squad
 */
export function useSquadPlayers(seriesId: number | null, squadId: number | null) {
  return useQuery({
    queryKey: ['tournament', 'squad', seriesId, squadId],
    queryFn: () => fetchSquadPlayers(seriesId!, squadId!),
    enabled: !!seriesId && !!squadId && isApiConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Fetch all players for all teams in a tournament
 * This is the main hook used for seeding player data
 */
export function useTournamentPlayers(seriesId: number | null) {
  return useQuery({
    queryKey: ['tournament', 'all-players', seriesId],
    queryFn: () => fetchAllTournamentPlayers(seriesId!),
    enabled: !!seriesId && isApiConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Check if the API is configured
 */
export function useApiConfigured() {
  return isApiConfigured();
}
