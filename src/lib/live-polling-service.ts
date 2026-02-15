/**
 * Live Polling Service
 * Frontend service for managing live match polling and real-time updates
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PollingStatus {
  id: string;
  cricbuzzMatchId: number;
  matchState: 'Upcoming' | 'Live' | 'Complete';
  pollingEnabled: boolean;
  autoEnabled: boolean;
  lastPolledAt: string | null;
  pollCount: number;
  errorCount: number;
  lastError: string | null;
}

export interface LiveMatchUpdate {
  matchId: string;
  leagueId: string;
  playerId: string;
  fantasyPoints: number;
  isLiveStats: boolean;
  liveUpdatedAt: string | null;
}

// Subscription callbacks
type PollingStatusCallback = (status: PollingStatus) => void;
type LiveStatsCallback = (update: LiveMatchUpdate) => void;

class LivePollingService {
  private pollingChannel: RealtimeChannel | null = null;
  private statsChannels: Map<string, RealtimeChannel> = new Map();
  private pollingStatusCallbacks: Map<number, Set<PollingStatusCallback>> = new Map();
  private liveStatsCallbacks: Map<string, Set<LiveStatsCallback>> = new Map();
  private autoPollingInterval: ReturnType<typeof setInterval> | null = null;
  private autoPollingLeagueId: string | null = null;

  /**
   * Get polling status for a Cricbuzz match
   */
  async getPollingStatus(cricbuzzMatchId: number): Promise<PollingStatus | null> {
    const { data, error } = await supabase
      .from('live_match_polling')
      .select('*')
      .eq('cricbuzz_match_id', cricbuzzMatchId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      cricbuzzMatchId: data.cricbuzz_match_id,
      matchState: data.match_state as PollingStatus['matchState'],
      pollingEnabled: data.polling_enabled,
      autoEnabled: data.auto_enabled,
      lastPolledAt: data.last_polled_at,
      pollCount: data.poll_count,
      errorCount: data.error_count,
      lastError: data.last_error,
    };
  }

  /**
   * Get all polling statuses for matches in a league
   */
  async getLeaguePollingStatuses(leagueId: string): Promise<PollingStatus[]> {
    // Get cricbuzz match IDs for this league via league_matches junction table
    const { data: leagueMatches } = await supabase
      .from('league_matches')
      .select(`
        match:cricket_matches (
          cricbuzz_match_id
        )
      `)
      .eq('league_id', leagueId);

    if (!leagueMatches || leagueMatches.length === 0) return [];

    const cricbuzzIds = leagueMatches
      .filter(lm => lm.match?.cricbuzz_match_id)
      .map(lm => lm.match!.cricbuzz_match_id);

    if (cricbuzzIds.length === 0) return [];

    const { data, error } = await supabase
      .from('live_match_polling')
      .select('*')
      .in('cricbuzz_match_id', cricbuzzIds);

    if (error || !data) return [];

    return data.map(d => ({
      id: d.id,
      cricbuzzMatchId: d.cricbuzz_match_id,
      matchState: d.match_state as PollingStatus['matchState'],
      pollingEnabled: d.polling_enabled,
      autoEnabled: d.auto_enabled,
      lastPolledAt: d.last_polled_at,
      pollCount: d.poll_count,
      errorCount: d.error_count,
      lastError: d.last_error,
    }));
  }

  /**
   * Enable polling for a match
   */
  async enablePolling(cricbuzzMatchId: number, initialState: 'Upcoming' | 'Live' = 'Live'): Promise<boolean> {
    const { data, error } = await supabase.rpc('enable_match_polling', {
      p_cricbuzz_match_id: cricbuzzMatchId,
      p_initial_state: initialState,
    });

    return !error && data !== null;
  }

  /**
   * Disable polling for a match
   */
  async disablePolling(cricbuzzMatchId: number): Promise<boolean> {
    const { error } = await supabase.rpc('disable_match_polling', {
      p_cricbuzz_match_id: cricbuzzMatchId,
    });

    return !error;
  }

  /**
   * Manually trigger a poll for a specific match
   */
  async triggerPoll(cricbuzzMatchId: number): Promise<{
    success: boolean;
    error?: string;
    data?: {
      matchState: string;
      statsUpserted: number;
      manOfMatch?: { id: number; name: string } | null;
    };
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('live-stats-poller', {
        body: { cricbuzz_match_id: cricbuzzMatchId },
      });

      if (error) {
        return { success: false, error: error.message || 'Poll failed' };
      }

      return {
        success: true,
        data: {
          matchState: data.matchState,
          statsUpserted: data.statsUpserted,
          manOfMatch: data.manOfMatch,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Finalize match stats (mark as non-live)
   */
  async finalizeMatch(
    leagueId: string,
    matchId: string,
    manOfMatchCricbuzzId?: string
  ): Promise<boolean> {
    const { error } = await supabase.rpc('finalize_match_stats', {
      p_league_id: leagueId,
      p_match_id: matchId,
      p_man_of_match_cricbuzz_id: manOfMatchCricbuzzId || null,
    });

    return !error;
  }

  /**
   * Subscribe to polling status changes for a match
   */
  subscribeToPollingStatus(
    cricbuzzMatchId: number,
    callback: PollingStatusCallback
  ): () => void {
    // Add callback to set
    if (!this.pollingStatusCallbacks.has(cricbuzzMatchId)) {
      this.pollingStatusCallbacks.set(cricbuzzMatchId, new Set());
    }
    this.pollingStatusCallbacks.get(cricbuzzMatchId)!.add(callback);

    // Set up realtime subscription if not already done
    if (!this.pollingChannel) {
      this.pollingChannel = supabase
        .channel('live_match_polling_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_match_polling',
          },
          (payload) => {
            const data = payload.new as Record<string, unknown>;
            if (!data) return;

            const status: PollingStatus = {
              id: data.id as string,
              cricbuzzMatchId: data.cricbuzz_match_id as number,
              matchState: data.match_state as PollingStatus['matchState'],
              pollingEnabled: data.polling_enabled as boolean,
              autoEnabled: data.auto_enabled as boolean,
              lastPolledAt: data.last_polled_at as string | null,
              pollCount: data.poll_count as number,
              errorCount: data.error_count as number,
              lastError: data.last_error as string | null,
            };

            // Notify all callbacks for this match
            const callbacks = this.pollingStatusCallbacks.get(status.cricbuzzMatchId);
            if (callbacks) {
              callbacks.forEach(cb => cb(status));
            }
          }
        )
        .subscribe();
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.pollingStatusCallbacks.get(cricbuzzMatchId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.pollingStatusCallbacks.delete(cricbuzzMatchId);
        }
      }

      // Clean up channel if no more subscribers
      if (this.pollingStatusCallbacks.size === 0 && this.pollingChannel) {
        this.pollingChannel.unsubscribe();
        this.pollingChannel = null;
      }
    };
  }

  /**
   * Subscribe to live stats updates for a league
   */
  subscribeToLiveStats(leagueId: string, callback: LiveStatsCallback): () => void {
    // Add callback to set
    if (!this.liveStatsCallbacks.has(leagueId)) {
      this.liveStatsCallbacks.set(leagueId, new Set());
    }
    this.liveStatsCallbacks.get(leagueId)!.add(callback);

    // Set up realtime subscription if not already done for this league
    if (!this.statsChannels.has(leagueId)) {
      const channel = supabase
        .channel(`league_player_match_scores_${leagueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'league_player_match_scores',
            filter: `league_id=eq.${leagueId}`,
          },
          (payload) => {
            const data = payload.new as Record<string, unknown>;
            if (!data) return;

            const update: LiveMatchUpdate = {
              matchId: data.match_id as string,
              leagueId: data.league_id as string,
              playerId: data.player_id as string,
              fantasyPoints: data.fantasy_points as number,
              isLiveStats: data.is_live as boolean,
              liveUpdatedAt: data.live_updated_at as string | null,
            };

            // Notify all callbacks for this league
            const callbacks = this.liveStatsCallbacks.get(leagueId);
            if (callbacks) {
              callbacks.forEach(cb => cb(update));
            }
          }
        )
        .subscribe();

      this.statsChannels.set(leagueId, channel);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.liveStatsCallbacks.get(leagueId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.liveStatsCallbacks.delete(leagueId);

          // Clean up channel
          const channel = this.statsChannels.get(leagueId);
          if (channel) {
            channel.unsubscribe();
            this.statsChannels.delete(leagueId);
          }
        }
      }
    };
  }

  /**
   * Get matches with live stats in a league
   */
  async getLiveMatches(leagueId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('league_player_match_scores')
      .select('match_id')
      .eq('league_id', leagueId)
      .eq('is_live', true);

    if (error || !data) return [];

    // Return unique match IDs
    return [...new Set(data.map(d => d.match_id))];
  }

  /**
   * Check if a match has live stats
   */
  async hasLiveStats(leagueId: string, matchId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('league_player_match_scores')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('match_id', matchId)
      .eq('is_live', true);

    return !error && (count ?? 0) > 0;
  }

  /**
   * Start auto-polling interval that calls live-stats-poller directly
   * for each match with polling enabled.
   * Interval: 60 seconds (matches typical cron frequency).
   */
  startAutoPolling(leagueId: string, intervalMs = 60_000): void {
    // Don't start duplicate intervals for the same league
    if (this.autoPollingInterval && this.autoPollingLeagueId === leagueId) return;

    // Stop any existing interval first
    this.stopAutoPolling();

    this.autoPollingLeagueId = leagueId;
    console.log(`[LivePolling] Starting auto-poll interval (${intervalMs / 1000}s) for league ${leagueId}`);

    this.autoPollingInterval = setInterval(async () => {
      try {
        // Check if there are any matches with polling enabled before calling
        const statuses = await this.getLeaguePollingStatuses(leagueId);
        const activePolling = statuses.filter(s => s.pollingEnabled);

        if (activePolling.length === 0) {
          console.log('[LivePolling] No matches with polling enabled, skipping');
          return;
        }

        console.log(`[LivePolling] Auto-triggering poll for ${activePolling.length} match(es)`);

        // Poll each match directly via live-stats-poller (avoids 401 from poll-trigger
        // which requires service role auth)
        for (const match of activePolling) {
          const result = await this.triggerPoll(match.cricbuzzMatchId);
          if (result.success) {
            console.log(`[LivePolling] Auto-poll match ${match.cricbuzzMatchId}:`, result.data);
          } else {
            console.error(`[LivePolling] Auto-poll match ${match.cricbuzzMatchId} error:`, result.error);
          }
        }
      } catch (err) {
        console.error('[LivePolling] Auto-poll interval error:', err);
      }
    }, intervalMs);
  }

  /**
   * Stop auto-polling interval
   */
  stopAutoPolling(): void {
    if (this.autoPollingInterval) {
      console.log('[LivePolling] Stopping auto-poll interval');
      clearInterval(this.autoPollingInterval);
      this.autoPollingInterval = null;
      this.autoPollingLeagueId = null;
    }
  }

  /**
   * Check if auto-polling is currently active
   */
  isAutoPollingActive(): boolean {
    return this.autoPollingInterval !== null;
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    this.stopAutoPolling();

    if (this.pollingChannel) {
      this.pollingChannel.unsubscribe();
      this.pollingChannel = null;
    }

    for (const channel of this.statsChannels.values()) {
      channel.unsubscribe();
    }
    this.statsChannels.clear();

    this.pollingStatusCallbacks.clear();
    this.liveStatsCallbacks.clear();
  }
}

// Export singleton instance
export const livePollingService = new LivePollingService();
