import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Search,
  Check,
  Loader2,
  Calendar,
  Users,
  RefreshCw,
  Trophy,
  Zap,
  Radio,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/integrations/supabase/client';
import {
  parseScorecard,
  matchStatsToLeaguePlayers,
  saveMatchStats,
  saveMatchStatsLive,
  finalizeMatchStats,
  extractManOfMatch,
  type PlayerStatsWithOwnership,
  type CricbuzzScorecard,
} from '@/lib/cricbuzz-stats-service';
import {
  getSeriesMatches,
  getRecentMatches,
  getMatchScorecard,
  type CricbuzzMatch,
} from '@/lib/cricbuzz-api';
import {
  livePollingService,
  type PollingStatus,
} from '@/lib/live-polling-service';
import { getTournamentById } from '@/lib/tournaments';

interface CricketMatch {
  id: string;
  leagueMatchId: string; // ID from league_matches junction table
  cricbuzzMatchId: number;
  matchDescription: string;
  team1Name: string;
  team2Name: string;
  result: string;
  matchDate: string;
  venue: string;
  statsImported: boolean;
  week: number | null;
  isLive?: boolean;
  matchState?: 'Upcoming' | 'Live' | 'Complete';
  pollingEnabled?: boolean;
}

export const StatsImport = () => {
  const currentLeagueId = useGameStore(state => state.currentLeagueId);
  const scoringRules = useGameStore(state => state.scoringRules);
  const schedule = useGameStore(state => state.schedule);
  const tournamentId = useGameStore(state => state.tournamentId);

  const tournament = tournamentId ? getTournamentById(tournamentId) : null;

  // State
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<CricketMatch | null>(null);
  const [parsedStats, setParsedStats] = useState<PlayerStatsWithOwnership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingScorecard, setIsFetchingScorecard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matchIdInput, setMatchIdInput] = useState('');
  const [isMatchLive, setIsMatchLive] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Series state
  const [seriesMatches, setSeriesMatches] = useState<CricbuzzMatch[]>([]);
  const [isLoadingSeriesMatches, setIsLoadingSeriesMatches] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Polling state
  const [pollingStatuses, setPollingStatuses] = useState<Map<number, PollingStatus>>(new Map());
  const [isTogglingPolling, setIsTogglingPolling] = useState<number | null>(null);
  const [isTriggeringPoll, setIsTriggeringPoll] = useState<number | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const maxWeek = Math.max(7, ...schedule.map(m => m.week));

  // Fetch polling statuses
  const fetchPollingStatuses = useCallback(async () => {
    if (!currentLeagueId) return;

    const statuses = await livePollingService.getLeaguePollingStatuses(currentLeagueId);
    const statusMap = new Map<number, PollingStatus>();
    for (const status of statuses) {
      statusMap.set(status.cricbuzzMatchId, status);
    }
    setPollingStatuses(statusMap);
  }, [currentLeagueId]);

  // Subscribe to polling status updates
  useEffect(() => {
    if (!currentLeagueId || matches.length === 0) return;

    const unsubscribes: Array<() => void> = [];

    for (const match of matches) {
      const unsubscribe = livePollingService.subscribeToPollingStatus(
        match.cricbuzzMatchId,
        (status) => {
          setPollingStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(status.cricbuzzMatchId, status);
            return newMap;
          });
        }
      );
      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentLeagueId, matches]);

  // Fetch polling statuses when matches change
  useEffect(() => {
    fetchPollingStatuses();
  }, [fetchPollingStatuses, matches]);

  // Start/stop auto-polling based on whether any matches have polling enabled
  useEffect(() => {
    if (!currentLeagueId) return;

    const hasActivePolling = Array.from(pollingStatuses.values()).some(s => s.pollingEnabled);

    if (hasActivePolling) {
      livePollingService.startAutoPolling(currentLeagueId);
    } else {
      livePollingService.stopAutoPolling();
    }

    return () => {
      livePollingService.stopAutoPolling();
    };
  }, [currentLeagueId, pollingStatuses]);

  // Fetch saved matches for the league via league_matches junction table
  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchMatches = async () => {
      // Query league_cricket_matches view which joins cricket_matches + league_matches + live_match_polling
      const { data, error } = await supabase
        .from('league_cricket_matches')
        .select('*')
        .eq('league_id', currentLeagueId);

      if (data && !error) {
        const mappedMatches = data
          .filter(lm => lm.id) // Filter out any with null id
          .map(lm => ({
            id: lm.id!,
            leagueMatchId: lm.league_match_id || '',
            cricbuzzMatchId: lm.cricbuzz_match_id || 0,
            matchDescription: lm.match_description || '',
            team1Name: lm.team1_name || '',
            team2Name: lm.team2_name || '',
            result: lm.result || '',
            matchDate: lm.match_date || '',
            venue: lm.venue || '',
            statsImported: lm.stats_imported || false,
            week: lm.week,
            matchState: lm.match_state as CricketMatch['matchState'],
            pollingEnabled: lm.polling_enabled,
          }));

        // Sort by match_date descending (most recent first)
        mappedMatches.sort((a, b) => {
          if (!a.matchDate && !b.matchDate) return 0;
          if (!a.matchDate) return 1;
          if (!b.matchDate) return -1;
          return new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();
        });

        setMatches(mappedMatches);
      }
    };

    fetchMatches();
  }, [currentLeagueId]);

  // Toggle polling for a match
  const handleTogglePolling = async (cricbuzzMatchId: number, enable: boolean) => {
    setIsTogglingPolling(cricbuzzMatchId);
    try {
      const success = enable
        ? await livePollingService.enablePolling(cricbuzzMatchId)
        : await livePollingService.disablePolling(cricbuzzMatchId);

      if (success) {
        toast.success(enable ? 'Polling enabled' : 'Polling disabled');
        fetchPollingStatuses();
      } else {
        toast.error('Failed to update polling status');
      }
    } catch (error) {
      toast.error('Failed to update polling status');
    } finally {
      setIsTogglingPolling(null);
    }
  };

  // Manually trigger a poll
  const handleTriggerPoll = async (cricbuzzMatchId: number) => {
    setIsTriggeringPoll(cricbuzzMatchId);
    try {
      const result = await livePollingService.triggerPoll(cricbuzzMatchId);

      if (result.success) {
        toast.success(`Poll complete: ${result.data?.statsUpserted || 0} stats updated`);
        if (result.data?.matchState === 'Complete') {
          toast.info('Match completed - stats finalized');
        }
        fetchPollingStatuses();

        // Refresh the selected match if it's the one we just polled
        if (selectedMatch?.cricbuzzMatchId === cricbuzzMatchId) {
          handleFetchScorecard(selectedMatch, true);
        }
      } else {
        toast.error(result.error || 'Poll failed');
      }
    } catch (error) {
      toast.error('Failed to trigger poll');
    } finally {
      setIsTriggeringPoll(null);
    }
  };

  // Finalize match stats
  const handleFinalizeMatch = async () => {
    if (!selectedMatch || !currentLeagueId) return;

    setIsFinalizing(true);
    try {
      // Find MoM from parsed stats
      const momPlayer = parsedStats.find(
        p => p.pointsBreakdown.common.manOfTheMatch > 0
      );

      const result = await finalizeMatchStats(
        currentLeagueId,
        selectedMatch.id,
        momPlayer?.cricbuzzPlayerId.toString()
      );

      if (result.success) {
        toast.success(`Stats finalized for ${result.updatedCount || 0} players`);

        // Update local state
        setMatches(prev =>
          prev.map(m =>
            m.id === selectedMatch.id
              ? { ...m, statsImported: true, matchState: 'Complete' as const, isLive: false }
              : m
          )
        );

        // Clear preview state
        setSelectedMatch(null);
        setParsedStats([]);
        setIsMatchLive(false);
      } else {
        toast.error(result.error || 'Failed to finalize stats');
      }
    } catch (error) {
      toast.error('Failed to finalize stats');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Load matches for the league's tournament
  // Returns the fetched matches array (or current state if tournamentId is missing)
  const loadTournamentMatchesCore = async (): Promise<CricbuzzMatch[]> => {
    if (!tournamentId) return seriesMatches;

    const fetched = await getSeriesMatches(tournamentId);
    setSeriesMatches(fetched);
    return fetched;
  };

  const handleLoadTournamentMatches = async () => {
    if (!tournamentId) return;

    setIsLoadingSeriesMatches(true);
    try {
      const fetched = await loadTournamentMatchesCore();
      toast.success(`Loaded ${fetched.length} matches for ${tournament?.shortName || 'tournament'}`);
    } catch (error) {
      console.error('Error loading tournament matches:', error);
      toast.error('Failed to load matches. Make sure the Cricbuzz proxy is configured.');
    } finally {
      setIsLoadingSeriesMatches(false);
    }
  };

  // Map Cricbuzz match state to our DB match state
  const mapMatchState = (cricbuzzState: string): 'Upcoming' | 'Live' | 'Complete' => {
    if (cricbuzzState === 'Complete') return 'Complete';
    if (cricbuzzState === 'In Progress') return 'Live';
    return 'Upcoming';
  };

  // Core sync logic — accepts a matches list so the combined handler can pass freshly loaded matches.
  // Returns { addedCount, updatedCount } on success.
  const syncMatchesCore = async (
    completedOnly: boolean,
    matchesList: CricbuzzMatch[] = seriesMatches,
  ): Promise<{ addedCount: number; updatedCount: number }> => {
    if (!currentLeagueId || matchesList.length === 0) {
      return { addedCount: 0, updatedCount: 0 };
    }

    let addedCount = 0;
    let updatedCount = 0;

    const matchesToSync = completedOnly
      ? matchesList.filter(m => m.state === 'Complete')
      : matchesList.filter(m => m.state === 'Complete' || m.state === 'In Progress');

    for (const match of matchesToSync) {
      const matchState = mapMatchState(match.state);

      // Check if already exists in this league via league_matches
      const { data: existingMatch } = await supabase
        .from('cricket_matches')
        .select('id')
        .eq('cricbuzz_match_id', match.matchId)
        .maybeSingle();

      if (existingMatch) {
        // Match exists, check if it's linked to this league
        const { data: existingLink } = await supabase
          .from('league_matches')
          .select('id')
          .eq('league_id', currentLeagueId)
          .eq('match_id', existingMatch.id)
          .maybeSingle();

        if (existingLink) {
          // Already linked — update result if changed
          await supabase
            .from('cricket_matches')
            .update({
              result: match.status || null,
            })
            .eq('id', existingMatch.id);
          // Update match_state in live_match_polling
          await supabase
            .from('live_match_polling')
            .upsert({
              cricbuzz_match_id: match.matchId,
              match_id: existingMatch.id,
              match_state: matchState,
            }, { onConflict: 'cricbuzz_match_id' });
          updatedCount++;
          continue;
        }
      }

      // Use the upsert_league_match function to handle both cricket_matches and league_matches
      const { data, error } = await supabase.rpc('upsert_league_match', {
        p_league_id: currentLeagueId,
        p_cricbuzz_match_id: match.matchId,
        p_series_id: match.seriesId,
        p_match_description: match.matchDesc,
        p_team1_name: match.team1.teamName,
        p_team2_name: match.team2.teamName,
        p_match_date: new Date(parseInt(match.startDate)).toISOString(),
        p_venue: `${match.venueInfo.ground}, ${match.venueInfo.city}`,
        p_result: match.status,
        p_week: null,
      });

      if (!error && data && data.length > 0) {
        // Update match_state in live_match_polling
        await supabase
          .from('live_match_polling')
          .upsert({
            cricbuzz_match_id: match.matchId,
            match_id: data[0].out_match_id,
            match_state: matchState,
          }, { onConflict: 'cricbuzz_match_id' });

        if (data[0].is_new_match) {
          addedCount++;
        }

        setMatches(prev => {
          // Check if match already in local state
          const exists = prev.some(m => m.cricbuzzMatchId === match.matchId);
          if (exists) return prev;
          return [
            {
              id: data[0].out_match_id,
              leagueMatchId: data[0].out_league_match_id,
              cricbuzzMatchId: match.matchId,
              matchDescription: match.matchDesc,
              team1Name: match.team1.teamName,
              team2Name: match.team2.teamName,
              result: match.status,
              matchDate: new Date(parseInt(match.startDate)).toISOString(),
              venue: `${match.venueInfo.ground}, ${match.venueInfo.city}`,
              statsImported: false,
              week: null,
              matchState,
            },
            ...prev,
          ];
        });
      }
    }

    return { addedCount, updatedCount };
  };

  // Sync matches from series (completed + live, or completed only)
  const handleSyncMatches = async (completedOnly = false) => {
    if (!currentLeagueId || seriesMatches.length === 0) return;

    setIsSyncing(true);
    try {
      const { addedCount, updatedCount } = await syncMatchesCore(completedOnly);
      const parts = [];
      if (addedCount > 0) parts.push(`${addedCount} new`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      toast.success(parts.length > 0 ? `Synced: ${parts.join(', ')}` : 'All matches already synced');
    } catch (error) {
      console.error('Error syncing matches:', error);
      toast.error('Failed to sync some matches');
    } finally {
      setIsSyncing(false);
    }
  };

  // Extract match ID from URL or raw input
  const extractMatchId = (input: string): number | null => {
    // Try to extract from URL like: cricbuzz.com/live-cricket-scores/121417/...
    const urlMatch = input.match(/\/live-cricket-scores\/(\d+)/);
    if (urlMatch) {
      return parseInt(urlMatch[1]);
    }
    // Try direct number
    const num = parseInt(input.trim());
    return isNaN(num) ? null : num;
  };

  // Add a match by Cricbuzz ID (manual)
  const handleAddMatch = async () => {
    if (!matchIdInput || !currentLeagueId) return;

    setIsLoading(true);
    try {
      const cricbuzzMatchId = extractMatchId(matchIdInput);
      if (!cricbuzzMatchId) {
        toast.error('Invalid match ID. Enter a number or paste a Cricbuzz URL.');
        return;
      }

      // Check if match already exists in this league
      const { data: existingMatch } = await supabase
        .from('cricket_matches')
        .select('id')
        .eq('cricbuzz_match_id', cricbuzzMatchId)
        .maybeSingle();

      if (existingMatch) {
        // Match exists in cricket_matches, check if linked to this league
        const { data: existingLink } = await supabase
          .from('league_matches')
          .select('id')
          .eq('league_id', currentLeagueId)
          .eq('match_id', existingMatch.id)
          .maybeSingle();

        if (existingLink) {
          toast.error('Match already added to this league');
          return;
        }
      }

      // Use the upsert_league_match function
      const { data, error } = await supabase.rpc('upsert_league_match', {
        p_league_id: currentLeagueId,
        p_cricbuzz_match_id: cricbuzzMatchId,
        p_series_id: 0,
        p_match_description: `Match #${cricbuzzMatchId}`,
        p_week: null,
      });

      if (error) {
        toast.error('Failed to add match');
        console.error(error);
        return;
      }

      if (data && data.length > 0) {
        setMatches(prev => [
          {
            id: data[0].out_match_id,
            leagueMatchId: data[0].out_league_match_id,
            cricbuzzMatchId: cricbuzzMatchId,
            matchDescription: `Match #${cricbuzzMatchId}`,
            team1Name: '',
            team2Name: '',
            result: '',
            matchDate: '',
            venue: '',
            statsImported: false,
            week: null,
          },
          ...prev,
        ]);

        setMatchIdInput('');
        toast.success('Match added');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch scorecard and parse stats
  const handleFetchScorecard = async (match: CricketMatch, isRefresh = false) => {
    if (!currentLeagueId) return;

    setSelectedMatch(match);
    setIsFetchingScorecard(true);
    if (!isRefresh) {
      setParsedStats([]);
    }

    try {
      const scorecard = await getMatchScorecard(match.cricbuzzMatchId);

      const isLive = !scorecard.ismatchcomplete;
      setIsMatchLive(isLive);
      setLastFetchedAt(new Date());

      if (isLive) {
        toast.info('Match is live - stats will update as you refresh');
      }

      // Determine winner from status
      const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
      const winnerTeamName = winnerMatch ? winnerMatch[1] : null;

      // Parse scorecard
      const parsed = parseScorecard(scorecard as CricbuzzScorecard, winnerTeamName);

      // Match to league players and calculate points
      const statsWithOwnership = await matchStatsToLeaguePlayers(
        parsed,
        currentLeagueId,
        scoringRules
      );

      setParsedStats(statsWithOwnership);

      // Update match result (shared cricket_matches data) and match_state (live_match_polling)
      if (scorecard.status) {
        await supabase
          .from('cricket_matches')
          .update({ result: scorecard.status })
          .eq('id', match.id);

        // Update match_state in live_match_polling
        await supabase
          .from('live_match_polling')
          .upsert({
            cricbuzz_match_id: match.cricbuzzMatchId,
            match_id: match.id,
            match_state: isLive ? 'Live' : 'Complete',
          }, { onConflict: 'cricbuzz_match_id' });

        // Update local match state with live status
        setMatches(prev =>
          prev.map(m =>
            m.id === match.id ? { ...m, result: scorecard.status, isLive } : m
          )
        );
      }

      toast.success(isRefresh ? 'Stats refreshed' : 'Scorecard loaded');
    } catch (error) {
      console.error('Error fetching scorecard:', error);
      toast.error('Failed to fetch scorecard. Check if the API proxy is configured.');
    } finally {
      setIsFetchingScorecard(false);
    }
  };

  // Core auto-import logic. Accepts an optional matches list for the combined handler
  // (where React state may not yet reflect newly synced matches).
  // Returns { successCount, errorCount, skippedLive }.
  const autoImportAllCore = async (
    matchesList?: CricketMatch[],
  ): Promise<{ successCount: number; errorCount: number; skippedLive: number }> => {
    const source = matchesList ?? matches;
    const pendingMatches = source.filter(m => !m.statsImported);
    if (pendingMatches.length === 0) {
      return { successCount: 0, errorCount: 0, skippedLive: 0 };
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedLive = 0;

    for (const match of pendingMatches) {
      try {
        // Fetch and parse scorecard inline (don't rely on React state)
        const scorecard = await getMatchScorecard(match.cricbuzzMatchId);
        const isLive = !scorecard.ismatchcomplete;

        if (isLive) {
          // Skip live matches — they should be polled, not auto-imported
          skippedLive++;
          continue;
        }

        const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
        const winnerTeamName = winnerMatch ? winnerMatch[1] : null;

        const parsed = parseScorecard(scorecard as CricbuzzScorecard, winnerTeamName);
        const statsWithOwnership = await matchStatsToLeaguePlayers(
          parsed,
          currentLeagueId!,
          scoringRules
        );

        if (statsWithOwnership.length === 0) {
          console.warn(`No stats parsed for match ${match.cricbuzzMatchId}, skipping`);
          errorCount++;
          continue;
        }

        // Update match result in DB and match_state in live_match_polling
        if (scorecard.status) {
          await supabase
            .from('cricket_matches')
            .update({ result: scorecard.status })
            .eq('id', match.id);

          await supabase
            .from('live_match_polling')
            .upsert({
              cricbuzz_match_id: match.cricbuzzMatchId,
              match_id: match.id,
              match_state: 'Complete',
            }, { onConflict: 'cricbuzz_match_id' });
        }

        const weekNum = parseInt(selectedWeek);
        const result = await saveMatchStats(
          currentLeagueId!,
          match.id,
          weekNum,
          statsWithOwnership
        );

        if (result.success) {
          successCount++;
          setMatches(prev =>
            prev.map(m =>
              m.id === match.id
                ? { ...m, statsImported: true, week: weekNum, matchState: 'Complete' as const }
                : m
            )
          );
        } else {
          console.error(`Failed to save stats for match ${match.cricbuzzMatchId}:`, result.error);
          errorCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error importing match ${match.cricbuzzMatchId}:`, error);
        errorCount++;
      }
    }

    setParsedStats([]);
    setSelectedMatch(null);

    return { successCount, errorCount, skippedLive };
  };

  // Auto-import all pending matches
  const handleAutoImportAll = async () => {
    const pendingMatches = matches.filter(m => !m.statsImported);
    if (pendingMatches.length === 0) {
      toast.info('No pending matches to import');
      return;
    }

    setIsSyncing(true);

    const { successCount, errorCount, skippedLive } = await autoImportAllCore();

    setIsSyncing(false);

    const parts = [];
    if (successCount > 0) parts.push(`${successCount} imported`);
    if (skippedLive > 0) parts.push(`${skippedLive} skipped (live)`);
    if (errorCount > 0) parts.push(`${errorCount} failed`);
    toast[errorCount > 0 && successCount === 0 ? 'error' : 'success'](parts.join(', '));
  };

  // Combined: load tournament matches, sync completed, then auto-import all
  const handleSyncAndImportAll = async () => {
    if (!currentLeagueId || !tournamentId) return;

    setIsSyncing(true);
    try {
      // Step 1: Load/refresh tournament matches from Cricbuzz
      const freshSeriesMatches = await loadTournamentMatchesCore();

      // Step 2: Sync completed matches into DB
      const { addedCount, updatedCount } = await syncMatchesCore(true, freshSeriesMatches);

      // Step 3: Re-read matches from DB so auto-import sees newly synced matches
      const { data } = await supabase
        .from('league_cricket_matches')
        .select('*')
        .eq('league_id', currentLeagueId);

      let freshMatches: CricketMatch[] = [];
      if (data) {
        freshMatches = data
          .filter(lm => lm.id)
          .map(lm => ({
            id: lm.id!,
            leagueMatchId: lm.league_match_id || '',
            cricbuzzMatchId: lm.cricbuzz_match_id || 0,
            matchDescription: lm.match_description || '',
            team1Name: lm.team1_name || '',
            team2Name: lm.team2_name || '',
            result: lm.result || '',
            matchDate: lm.match_date || '',
            venue: lm.venue || '',
            statsImported: lm.stats_imported || false,
            week: lm.week,
            matchState: lm.match_state as CricketMatch['matchState'],
            pollingEnabled: lm.polling_enabled,
          }));
        setMatches(freshMatches);
      }

      // Step 4: Auto-import all pending completed matches
      const { successCount, errorCount, skippedLive } = await autoImportAllCore(freshMatches);

      // Build combined summary
      const parts = [];
      if (addedCount > 0) parts.push(`${addedCount} synced`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      if (successCount > 0) parts.push(`${successCount} imported`);
      if (skippedLive > 0) parts.push(`${skippedLive} skipped (live)`);
      if (errorCount > 0) parts.push(`${errorCount} failed`);
      toast[errorCount > 0 && successCount === 0 ? 'error' : 'success'](
        parts.length > 0 ? parts.join(', ') : 'Everything up to date'
      );
    } catch (error) {
      console.error('Error in sync & import all:', error);
      toast.error('Sync & Import failed. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Save stats to database
  const handleSaveStats = async () => {
    if (!selectedMatch || !currentLeagueId || parsedStats.length === 0) return;

    setIsSaving(true);
    try {
      const weekNum = parseInt(selectedWeek);

      // Use live stats save if match is live
      const result = isMatchLive
        ? await saveMatchStatsLive(
            currentLeagueId,
            selectedMatch.id,
            weekNum,
            parsedStats,
            true // isLive = true
          )
        : await saveMatchStats(
            currentLeagueId,
            selectedMatch.id,
            weekNum,
            parsedStats
          );

      if (result.success) {
        if (isMatchLive) {
          toast.success(`Live stats imported for Week ${weekNum}`);
          // Update match state but don't mark as fully imported
          setMatches(prev =>
            prev.map(m =>
              m.id === selectedMatch.id
                ? { ...m, week: weekNum, isLive: true, matchState: 'Live' as const }
                : m
            )
          );
        } else {
          toast.success(`Stats imported for Week ${weekNum}`);
          // Update match in list to show imported status
          setMatches(prev =>
            prev.map(m =>
              m.id === selectedMatch.id
                ? { ...m, statsImported: true, week: weekNum, isLive: false, matchState: 'Complete' as const }
                : m
            )
          );
        }

        // Update league_matches with week number
        if (currentLeagueId && selectedMatch.leagueMatchId) {
          await supabase
            .from('league_matches')
            .update({ week: weekNum })
            .eq('id', selectedMatch.leagueMatchId);
        }

        // Clear all preview state
        setSelectedMatch(null);
        setParsedStats([]);
        setIsMatchLive(false);
        setLastFetchedAt(null);
      } else {
        toast.error(result.error || 'Failed to save stats');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Man of Match for a player
  const toggleManOfMatch = (playerId: number) => {
    setParsedStats(prev =>
      prev.map(p => ({
        ...p,
        pointsBreakdown:
          p.cricbuzzPlayerId === playerId
            ? {
                ...p.pointsBreakdown,
                common: {
                  ...p.pointsBreakdown.common,
                  manOfTheMatch:
                    p.pointsBreakdown.common.manOfTheMatch > 0 ? 0 : 50,
                  total:
                    p.pointsBreakdown.common.total +
                    (p.pointsBreakdown.common.manOfTheMatch > 0 ? -50 : 50),
                },
                total:
                  p.pointsBreakdown.total +
                  (p.pointsBreakdown.common.manOfTheMatch > 0 ? -50 : 50),
              }
            : p.pointsBreakdown,
        fantasyPoints:
          p.cricbuzzPlayerId === playerId
            ? p.fantasyPoints +
              (p.pointsBreakdown.common.manOfTheMatch > 0 ? -50 : 50)
            : p.fantasyPoints,
      }))
    );
  };

  const ownedPlayers = parsedStats.filter(p => p.managerId);
  const unownedPlayers = parsedStats.filter(p => !p.managerId && p.leaguePlayerId);
  const unmatchedPlayers = parsedStats.filter(p => !p.leaguePlayerId);
  const pendingMatchesCount = matches.filter(m => !m.statsImported).length;

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground italic">Stats Import</h2>
        </div>
        {pendingMatchesCount > 0 && (
          <Badge variant="secondary">{pendingMatchesCount} pending</Badge>
        )}
      </div>

      {/* Week Selection */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Fantasy Week:</span>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxWeek }).map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Week {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs
        defaultValue="series"
        className="w-full"
        onValueChange={() => {
          // Clear preview state when switching tabs
          setSelectedMatch(null);
          setParsedStats([]);
          setIsMatchLive(false);
          setLastFetchedAt(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="series">
            <Trophy className="w-4 h-4 mr-2" />
            {tournament?.shortName || 'Tournament'}
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Search className="w-4 h-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>

        {/* Tournament-based import */}
        <TabsContent value="series" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Sync from {tournament?.shortName || 'Tournament'}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              {!tournamentId ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No tournament configured for this league. Set one during league creation.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{tournament?.name}</span>
                      <Badge variant="outline" className="text-xs">{tournament?.type}</Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleLoadTournamentMatches}
                      disabled={isLoadingSeriesMatches}
                    >
                      {isLoadingSeriesMatches ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      {seriesMatches.length > 0 ? 'Refresh' : 'Load Matches'}
                    </Button>
                  </div>

                  {seriesMatches.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {seriesMatches.length} matches found ({seriesMatches.filter(m => m.state === 'Complete').length} completed, {seriesMatches.filter(m => m.state === 'In Progress').length} live)
                      </div>
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncMatches(true)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Sync Completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncMatches(false)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Sync Completed + Live
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSyncAndImportAll}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Zap className="w-4 h-4 mr-2" />
                          )}
                          Sync & Import All
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual match add */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Add Match by ID</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Paste Cricbuzz URL or Match ID"
                  value={matchIdInput}
                  onChange={e => setMatchIdInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddMatch}
                  disabled={isLoading || !matchIdInput}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Paste the full Cricbuzz URL or just the match ID (e.g., 121417)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Matches List */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Saved Matches</CardTitle>
            {pendingMatchesCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoImportAll}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Auto-Import All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-2">
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matches added yet. Use series sync or add manually.
                </p>
              ) : (
                matches.map(match => {
                  const pollingStatus = pollingStatuses.get(match.cricbuzzMatchId);
                  const isPollingEnabled = pollingStatus?.pollingEnabled ?? false;
                  const matchIsLive = match.matchState === 'Live' || match.isLive;

                  return (
                    <div
                      key={match.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedMatch?.id === match.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${match.statsImported && !matchIsLive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleFetchScorecard(match)}
                        >
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {match.team1Name && match.team2Name
                                ? `${match.team1Name} vs ${match.team2Name}`
                                : match.matchDescription}
                            </p>
                            {matchIsLive && (
                              <Badge className="bg-red-500 animate-pulse text-xs">
                                <Radio className="w-3 h-3 mr-1" />
                                LIVE
                              </Badge>
                            )}
                            {isPollingEnabled && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Polling
                              </Badge>
                            )}
                          </div>
                          {match.result && (
                            <p className="text-xs text-muted-foreground">
                              {match.result}
                            </p>
                          )}
                          {pollingStatus && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {pollingStatus.lastPolledAt && (
                                <span>
                                  Last poll: {new Date(pollingStatus.lastPolledAt).toLocaleTimeString()}
                                </span>
                              )}
                              {pollingStatus.pollCount > 0 && (
                                <span>({pollingStatus.pollCount} polls)</span>
                              )}
                              {pollingStatus.errorCount > 0 && (
                                <span className="text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {pollingStatus.errorCount} errors
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Polling controls */}
                          {!match.statsImported && (
                            <div
                              className="flex items-center gap-3 mr-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTriggerPoll(match.cricbuzzMatchId)}
                                disabled={isTriggeringPoll === match.cricbuzzMatchId}
                                className="h-7 px-2 text-xs"
                              >
                                {isTriggeringPoll === match.cricbuzzMatchId ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Poll Now
                              </Button>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  id={`polling-${match.cricbuzzMatchId}`}
                                  checked={isPollingEnabled}
                                  disabled={isTogglingPolling === match.cricbuzzMatchId}
                                  onCheckedChange={(checked) =>
                                    handleTogglePolling(match.cricbuzzMatchId, checked)
                                  }
                                />
                                <Label
                                  htmlFor={`polling-${match.cricbuzzMatchId}`}
                                  className="text-xs cursor-pointer text-muted-foreground"
                                >
                                  Auto
                                </Label>
                              </div>
                            </div>
                          )}
                          {match.week && (
                            <Badge variant="outline">Week {match.week}</Badge>
                          )}
                          {match.statsImported ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Imported
                            </Badge>
                          ) : matchIsLive ? (
                            <Badge className="bg-amber-500">In Progress</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Stats Preview */}
      {isFetchingScorecard && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Fetching scorecard...</span>
        </div>
      )}

      {parsedStats.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Stats Preview</CardTitle>
                {isMatchLive && (
                  <Badge className="bg-red-500 animate-pulse text-xs">
                    LIVE
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastFetchedAt && (
                  <span className="text-xs text-muted-foreground">
                    Updated {lastFetchedAt.toLocaleTimeString()}
                  </span>
                )}
                {isMatchLive && selectedMatch && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFetchScorecard(selectedMatch, true)}
                    disabled={isFetchingScorecard}
                  >
                    {isFetchingScorecard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Refresh
                  </Button>
                )}
                <Badge variant="outline">
                  <Users className="w-3 h-3 mr-1" />
                  {ownedPlayers.length} Owned
                </Badge>
                <Badge variant="secondary">
                  {unmatchedPlayers.length} Not in League
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {/* Owned Players */}
                {ownedPlayers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-green-500">
                      Owned Players (Points Count)
                    </h4>
                    <div className="space-y-2">
                      {ownedPlayers.map(player => (
                        <PlayerStatsRow
                          key={player.cricbuzzPlayerId}
                          player={player}
                          onToggleMoM={() =>
                            toggleManOfMatch(player.cricbuzzPlayerId)
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Unowned League Players */}
                {unownedPlayers.length > 0 && (
                  <div>
                    <Separator className="my-3" />
                    <h4 className="text-sm font-semibold mb-2 text-yellow-500">
                      League Players (Not Owned)
                    </h4>
                    <div className="space-y-2">
                      {unownedPlayers.map(player => (
                        <PlayerStatsRow
                          key={player.cricbuzzPlayerId}
                          player={player}
                          onToggleMoM={() =>
                            toggleManOfMatch(player.cricbuzzPlayerId)
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched Players */}
                {unmatchedPlayers.length > 0 && (
                  <div>
                    <Separator className="my-3" />
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                      Not in League ({unmatchedPlayers.length})
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      These players are not mapped to your league. Map them in
                      Player Mapping.
                    </p>
                    <div className="space-y-1 opacity-60">
                      {unmatchedPlayers.slice(0, 5).map(player => (
                        <div key={player.cricbuzzPlayerId} className="text-xs">
                          {player.playerName} (ID: {player.cricbuzzPlayerId})
                        </div>
                      ))}
                      {unmatchedPlayers.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          ...and {unmatchedPlayers.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Save Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isMatchLive ? (
                  <span className="text-yellow-500 flex items-center gap-1">
                    <Radio className="w-4 h-4 animate-pulse" />
                    Match is live - stats will update automatically if polling is enabled
                  </span>
                ) : (
                  <span>
                    {ownedPlayers.filter(p => p.isInActiveRoster).length} active
                    roster players will earn points
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isMatchLive && (
                  <Button
                    onClick={handleFinalizeMatch}
                    disabled={isFinalizing || ownedPlayers.length === 0}
                    variant="outline"
                  >
                    {isFinalizing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Finalize Now
                  </Button>
                )}
                <Button
                  onClick={handleSaveStats}
                  disabled={isSaving || ownedPlayers.length === 0}
                  variant={isMatchLive ? 'secondary' : 'default'}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {isMatchLive ? 'Import as Live Stats' : `Import to Week ${selectedWeek}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
};

// Player Stats Row Component
function PlayerStatsRow({
  player,
  onToggleMoM,
}: {
  player: PlayerStatsWithOwnership;
  onToggleMoM: () => void;
}) {
  const isMoM = player.pointsBreakdown.common.manOfTheMatch > 0;

  return (
    <div
      className={`p-3 rounded-lg border ${
        player.isInActiveRoster
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {player.leaguePlayerName || player.playerName}
            </span>
            {player.managerId && (
              <Badge
                variant={player.isInActiveRoster ? 'default' : 'secondary'}
                className="text-xs"
              >
                {player.managerName}{' '}
                {player.isInActiveRoster ? '(Active)' : '(Bench)'}
              </Badge>
            )}
            {player.teamWon && (
              <Badge className="bg-green-500 text-xs">Won</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 space-x-3">
            {player.runs > 0 || player.ballsFaced > 0 ? (
              <span>
                Bat: {player.runs}({player.ballsFaced}) | {player.fours}x4{' '}
                {player.sixes}x6
              </span>
            ) : null}
            {player.overs > 0 ? (
              <span>
                Bowl: {player.wickets}/{player.runsConceded} ({player.overs}ov)
              </span>
            ) : null}
            {player.catches > 0 ||
            player.stumpings > 0 ||
            player.runOuts > 0 ? (
              <span>
                Field: {player.catches}c {player.stumpings}st {player.runOuts}ro
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={`mom-${player.cricbuzzPlayerId}`}
              checked={isMoM}
              onCheckedChange={onToggleMoM}
            />
            <Label
              htmlFor={`mom-${player.cricbuzzPlayerId}`}
              className="text-xs"
            >
              MoM
            </Label>
          </div>
          <div
            className={`text-lg font-bold ${
              player.fantasyPoints >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {player.fantasyPoints}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsImport;
