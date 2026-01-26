import { useQuery } from '@tanstack/react-query';
import {
  fetchLiveMatches,
  fetchMatchesByType,
  fetchMatchInfo,
  isApiConfigured,
  CricbuzzApiError,
} from '@/integrations/cricbuzz/client';
import { CricketMatch, MatchDetailResponse } from '@/lib/cricket-types';

// Query keys for cache management
export const cricketQueryKeys = {
  all: ['cricket'] as const,
  matches: () => [...cricketQueryKeys.all, 'matches'] as const,
  matchesByType: (type: 'live' | 'recent' | 'upcoming') =>
    [...cricketQueryKeys.matches(), type] as const,
  liveMatches: () => [...cricketQueryKeys.matches(), 'live'] as const,
  matchDetail: (matchId: number) =>
    [...cricketQueryKeys.all, 'match', matchId] as const,
};

/**
 * Hook to fetch live cricket matches
 * Auto-refreshes every 30 seconds when there are live matches
 */
export function useLiveMatches() {
  return useQuery<CricketMatch[], CricbuzzApiError>({
    queryKey: cricketQueryKeys.liveMatches(),
    queryFn: fetchLiveMatches,
    // Refresh every 30 seconds for live scores
    refetchInterval: 30000,
    // Keep data fresh
    staleTime: 15000,
    // Don't retry too aggressively
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    // Only run if API is configured
    enabled: isApiConfigured(),
  });
}

/**
 * Hook to fetch matches by type (live, recent, upcoming)
 */
export function useMatchesByType(type: 'live' | 'recent' | 'upcoming') {
  return useQuery<CricketMatch[], CricbuzzApiError>({
    queryKey: cricketQueryKeys.matchesByType(type),
    queryFn: () => fetchMatchesByType(type),
    // Different refresh rates based on type
    refetchInterval: type === 'live' ? 30000 : type === 'recent' ? 60000 : 300000,
    staleTime: type === 'live' ? 15000 : 30000,
    retry: 2,
    enabled: isApiConfigured(),
  });
}

/**
 * Hook to fetch detailed match information
 */
export function useMatchInfo(matchId: number | null) {
  return useQuery<MatchDetailResponse, CricbuzzApiError>({
    queryKey: cricketQueryKeys.matchDetail(matchId ?? 0),
    queryFn: () => fetchMatchInfo(matchId!),
    enabled: Boolean(matchId) && isApiConfigured(),
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Check if the API is properly configured
 */
export function useApiConfigured() {
  return isApiConfigured();
}
