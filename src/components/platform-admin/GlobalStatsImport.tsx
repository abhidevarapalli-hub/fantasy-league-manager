import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Search,
  Check,
  Loader2,
  RefreshCw,
  Trophy,
  Zap,
  Radio,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Link2,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  parseScorecard,
  saveGlobalMatchStats,
  autoCalculateForAllLeagues,
  type ParsedPlayerStats,
  type CricbuzzScorecard,
} from '@/lib/cricbuzz-stats-service';
import {
  getSeriesMatches,
  getMatchScorecard,
  type CricbuzzMatch,
} from '@/lib/cricbuzz-api';
import {
  livePollingService,
  type PollingStatus,
} from '@/lib/live-polling-service';
import { SUPPORTED_TOURNAMENTS, type Tournament } from '@/lib/tournaments';

interface GlobalMatch {
  id: string;
  cricbuzzMatchId: number;
  matchDescription: string;
  team1Name: string;
  team2Name: string;
  result: string;
  matchDate: string;
  venue: string;
  matchState?: 'Upcoming' | 'Live' | 'Complete';
  pollingEnabled?: boolean;
  linkedLeagueCount: number;
  hasRawStats: boolean;
}

export const GlobalStatsImport = () => {
  // State
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [matches, setMatches] = useState<GlobalMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<GlobalMatch | null>(null);
  const [parsedStats, setParsedStats] = useState<ParsedPlayerStats[]>([]);
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

  const selectedTournament = selectedTournamentId
    ? SUPPORTED_TOURNAMENTS.find(t => t.id.toString() === selectedTournamentId) || null
    : null;

  // Fetch all global matches from cricket_matches
  const fetchGlobalMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('cricket_matches')
      .select('*');

    if (data && !error) {
      // Check which matches already have raw stats
      const { data: statsData } = await supabase
        .from('match_player_stats')
        .select('match_id');
      const matchIdsWithStats = new Set(statsData?.map(s => s.match_id) ?? []);

      // Count linked leagues per match
      const { data: leagueMatchData } = await supabase
        .from('league_matches')
        .select('match_id');
      const leagueCountMap = new Map<string, number>();
      if (leagueMatchData) {
        for (const lm of leagueMatchData) {
          leagueCountMap.set(lm.match_id, (leagueCountMap.get(lm.match_id) || 0) + 1);
        }
      }

      const mappedMatches: GlobalMatch[] = data.map(m => ({
        id: m.id,
        cricbuzzMatchId: m.cricbuzz_match_id,
        matchDescription: m.match_description || '',
        team1Name: m.team1_name || '',
        team2Name: m.team2_name || '',
        result: m.result || '',
        matchDate: m.match_date || '',
        venue: m.venue || '',
        matchState: (m.state as GlobalMatch['matchState']) ?? 'Upcoming',
        pollingEnabled: undefined, // populated from pollingStatuses
        linkedLeagueCount: leagueCountMap.get(m.id) || 0,
        hasRawStats: matchIdsWithStats.has(m.id),
      }));

      mappedMatches.sort((a, b) => {
        if (!a.matchDate && !b.matchDate) return 0;
        if (!a.matchDate) return 1;
        if (!b.matchDate) return -1;
        return new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();
      });

      setMatches(mappedMatches);
    }
  }, []);

  useEffect(() => {
    fetchGlobalMatches();
  }, [fetchGlobalMatches]);

  // Fetch polling statuses for all matches
  const fetchPollingStatuses = useCallback(async () => {
    if (matches.length === 0) return;

    const cricbuzzIds = matches.map(m => m.cricbuzzMatchId);
    const { data } = await supabase
      .from('live_match_polling')
      .select('*')
      .in('cricbuzz_match_id', cricbuzzIds);

    if (data) {
      const statusMap = new Map<number, PollingStatus>();
      for (const d of data) {
        statusMap.set(d.cricbuzz_match_id, {
          id: d.id,
          cricbuzzMatchId: d.cricbuzz_match_id,
          matchState: d.match_state as PollingStatus['matchState'],
          pollingEnabled: d.polling_enabled,
          autoEnabled: d.auto_enabled,
          lastPolledAt: d.last_polled_at,
          pollCount: d.poll_count,
          errorCount: d.error_count,
          lastError: d.last_error,
        });
      }
      setPollingStatuses(statusMap);
    }
  }, [matches]);

  useEffect(() => {
    fetchPollingStatuses();
  }, [fetchPollingStatuses]);

  // Subscribe to polling status updates
  useEffect(() => {
    if (matches.length === 0) return;

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
  }, [matches]);

  // Toggle polling
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
    } catch {
      toast.error('Failed to update polling status');
    } finally {
      setIsTogglingPolling(null);
    }
  };

  // Re-enable auto-polling
  const handleReEnableAuto = async (cricbuzzMatchId: number) => {
    try {
      const success = await livePollingService.reEnableAuto(cricbuzzMatchId);
      if (success) {
        toast.success('Auto-polling re-enabled');
        fetchPollingStatuses();
      } else {
        toast.error('Failed to re-enable auto-polling');
      }
    } catch {
      toast.error('Failed to re-enable auto-polling');
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
        fetchGlobalMatches();
      } else {
        toast.error(result.error || 'Poll failed');
      }
    } catch {
      toast.error('Failed to trigger poll');
    } finally {
      setIsTriggeringPoll(null);
    }
  };

  // Map Cricbuzz match state to our DB match state
  const mapMatchState = (cricbuzzState: string): 'Upcoming' | 'Live' | 'Complete' => {
    if (cricbuzzState === 'Complete') return 'Complete';
    if (cricbuzzState === 'In Progress') return 'Live';
    return 'Upcoming';
  };

  // Load tournament matches from Cricbuzz API
  const loadTournamentMatchesCore = async (): Promise<CricbuzzMatch[]> => {
    if (!selectedTournament) return seriesMatches;
    const fetched = await getSeriesMatches(selectedTournament.id);
    setSeriesMatches(fetched);
    return fetched;
  };

  const handleLoadTournamentMatches = async () => {
    if (!selectedTournament) return;

    setIsLoadingSeriesMatches(true);
    try {
      const fetched = await loadTournamentMatchesCore();
      toast.success(`Loaded ${fetched.length} matches for ${selectedTournament.shortName}`);
    } catch (error) {
      console.error('Error loading tournament matches:', error);
      toast.error('Failed to load matches. Check API proxy configuration.');
    } finally {
      setIsLoadingSeriesMatches(false);
    }
  };

  // Sync matches from series to cricket_matches (global, no league link)
  const syncMatchesCore = async (
    completedOnly: boolean,
    matchesList: CricbuzzMatch[] = seriesMatches
  ): Promise<{ addedCount: number; updatedCount: number }> => {
    if (matchesList.length === 0) return { addedCount: 0, updatedCount: 0 };

    let addedCount = 0;
    let updatedCount = 0;

    const matchesToSync = completedOnly
      ? matchesList.filter(m => m.state === 'Complete')
      : matchesList.filter(m => m.state === 'Complete' || m.state === 'In Progress');

    for (const match of matchesToSync) {
      const matchState = mapMatchState(match.state);

      // Check if already exists in cricket_matches
      const { data: existingMatch } = await supabase
        .from('cricket_matches')
        .select('id')
        .eq('cricbuzz_match_id', match.matchId)
        .maybeSingle();

      if (existingMatch) {
        // Update result and state
        await supabase
          .from('cricket_matches')
          .update({
            result: match.status || null,
            state: matchState,
          })
          .eq('id', existingMatch.id);

        await supabase.rpc('upsert_match_polling_state', {
          p_cricbuzz_match_id: match.matchId,
          p_match_id: existingMatch.id,
          p_match_state: matchState,
        });
        updatedCount++;
        continue;
      }

      // Insert new cricket_match (global, no league link)
      const { data: newMatch, error: insertError } = await supabase
        .from('cricket_matches')
        .insert({
          cricbuzz_match_id: match.matchId,
          series_id: match.seriesId,
          match_description: match.matchDesc,
          team1_name: match.team1.teamName,
          team2_name: match.team2.teamName,
          match_date: new Date(parseInt(match.startDate)).toISOString(),
          venue: `${match.venueInfo.ground}, ${match.venueInfo.city}`,
          result: match.status || null,
          state: matchState,
        })
        .select('id')
        .single();

      if (!insertError && newMatch) {
        await supabase.rpc('upsert_match_polling_state', {
          p_cricbuzz_match_id: match.matchId,
          p_match_id: newMatch.id,
          p_match_state: matchState,
        });
        addedCount++;
      }
    }

    return { addedCount, updatedCount };
  };

  const handleSyncMatches = async (completedOnly = false) => {
    if (seriesMatches.length === 0) return;

    setIsSyncing(true);
    try {
      const { addedCount, updatedCount } = await syncMatchesCore(completedOnly);
      await fetchGlobalMatches();
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
    const urlMatch = input.match(/\/live-cricket-scores\/(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1]);
    const num = parseInt(input.trim());
    return isNaN(num) ? null : num;
  };

  // Add a match by Cricbuzz ID (global, no league link)
  const handleAddMatch = async () => {
    if (!matchIdInput) return;

    setIsLoading(true);
    try {
      const cricbuzzMatchId = extractMatchId(matchIdInput);
      if (!cricbuzzMatchId) {
        toast.error('Invalid match ID. Enter a number or paste a Cricbuzz URL.');
        return;
      }

      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from('cricket_matches')
        .select('id')
        .eq('cricbuzz_match_id', cricbuzzMatchId)
        .maybeSingle();

      if (existingMatch) {
        toast.error('Match already exists');
        return;
      }

      // Insert new cricket_match
      const { error } = await supabase
        .from('cricket_matches')
        .insert({
          cricbuzz_match_id: cricbuzzMatchId,
          series_id: 0,
          match_description: `Match #${cricbuzzMatchId}`,
        });

      if (error) {
        toast.error('Failed to add match');
        console.error(error);
        return;
      }

      setMatchIdInput('');
      await fetchGlobalMatches();
      toast.success('Match added');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch scorecard and parse raw stats (no league context)
  const handleFetchScorecard = async (match: GlobalMatch, isRefresh = false) => {
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

      const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
      const winnerTeamName = winnerMatch ? winnerMatch[1] : null;

      const parsed = parseScorecard(scorecard as CricbuzzScorecard, winnerTeamName);
      setParsedStats(parsed);

      // Update match result in cricket_matches
      if (scorecard.status) {
        await supabase
          .from('cricket_matches')
          .update({ result: scorecard.status, state: isLive ? 'In Progress' : 'Complete' })
          .eq('id', match.id);

        await supabase.rpc('upsert_match_polling_state', {
          p_cricbuzz_match_id: match.cricbuzzMatchId,
          p_match_id: match.id,
          p_match_state: isLive ? 'Live' : 'Complete',
        });

        setMatches(prev =>
          prev.map(m =>
            m.id === match.id
              ? { ...m, result: scorecard.status, matchState: isLive ? 'Live' as const : 'Complete' as const }
              : m
          )
        );
      }

      toast.success(isRefresh ? 'Stats refreshed' : 'Scorecard loaded');
    } catch (error) {
      console.error('Error fetching scorecard:', error);
      toast.error('Failed to fetch scorecard. Check API proxy configuration.');
    } finally {
      setIsFetchingScorecard(false);
    }
  };

  // Save raw stats globally + auto-calculate for linked leagues
  const handleSaveStats = async () => {
    if (!selectedMatch || parsedStats.length === 0) return;

    setIsSaving(true);
    try {
      const result = await saveGlobalMatchStats(selectedMatch.id, parsedStats, isMatchLive);

      if (result.success) {
        // Auto-calculate for all linked leagues
        const calcResult = await autoCalculateForAllLeagues(selectedMatch.id);

        const parts = ['Raw stats saved'];
        if (calcResult.leaguesProcessed > 0) {
          parts.push(`${calcResult.leaguesProcessed} league(s) scored`);
        }
        if (calcResult.errors.length > 0) {
          parts.push(`${calcResult.errors.length} league error(s)`);
        }
        toast.success(parts.join(', '));

        // Update local state
        setMatches(prev =>
          prev.map(m =>
            m.id === selectedMatch.id
              ? { ...m, hasRawStats: true, matchState: isMatchLive ? 'Live' as const : 'Complete' as const }
              : m
          )
        );

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

  // Auto-import all: sync + fetch scorecards + save global + calculate for leagues
  const handleSyncAndImportAll = async () => {
    if (!selectedTournament) return;

    setIsSyncing(true);
    try {
      // Step 1: Load/refresh tournament matches
      const freshSeriesMatches = await loadTournamentMatchesCore();

      // Step 2: Sync completed matches into DB
      const { addedCount, updatedCount } = await syncMatchesCore(true, freshSeriesMatches);

      // Step 3: Re-read matches from DB
      await fetchGlobalMatches();

      // Step 4: Get latest matches from state-independent source
      const { data: allDbMatches } = await supabase
        .from('cricket_matches')
        .select('*');

      let successCount = 0;
      let errorCount = 0;
      let skippedLive = 0;

      if (allDbMatches) {
        // Filter to matches that don't have raw stats yet
        const matchIdsWithStats = new Set<string>();
        const { data: statsMatches } = await supabase
          .from('match_player_stats')
          .select('match_id');
        if (statsMatches) {
          for (const s of statsMatches) matchIdsWithStats.add(s.match_id);
        }

        const pendingMatches = allDbMatches.filter(
          m => !matchIdsWithStats.has(m.id)
        );

        for (const match of pendingMatches) {
          try {
            const scorecard = await getMatchScorecard(match.cricbuzz_match_id);
            const isLive = !scorecard.ismatchcomplete;

            if (isLive) {
              skippedLive++;
              continue;
            }

            const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
            const winnerTeamName = winnerMatch ? winnerMatch[1] : null;

            const parsed = parseScorecard(scorecard as CricbuzzScorecard, winnerTeamName);

            // Update match result
            if (scorecard.status) {
              await supabase
                .from('cricket_matches')
                .update({ result: scorecard.status, state: 'Complete' })
                .eq('id', match.id);

              await supabase.rpc('upsert_match_polling_state', {
                p_cricbuzz_match_id: match.cricbuzz_match_id,
                p_match_id: match.id,
                p_match_state: 'Complete',
              });
            }

            const saveResult = await saveGlobalMatchStats(match.id, parsed, false);
            if (saveResult.success) {
              await autoCalculateForAllLeagues(match.id);
              successCount++;
            } else {
              errorCount++;
            }

            // Rate limit - Cricbuzz API via RapidAPI has strict rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (error) {
            console.error(`Error importing match ${match.cricbuzz_match_id}:`, error);
            errorCount++;
          }
        }
      }

      await fetchGlobalMatches();

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

  const pendingMatchesCount = matches.filter(m => !m.hasRawStats).length;

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground italic">Global Stats Import</h2>
        </div>
        {pendingMatchesCount > 0 && (
          <Badge variant="secondary">{pendingMatchesCount} pending</Badge>
        )}
      </div>

      <Tabs
        defaultValue="series"
        className="w-full"
        onValueChange={() => {
          setSelectedMatch(null);
          setParsedStats([]);
          setIsMatchLive(false);
          setLastFetchedAt(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="series">
            <Trophy className="w-4 h-4 mr-2" />
            Tournament
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
                Sync from Tournament
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              {/* Tournament selector */}
              <div className="flex items-center gap-2">
                <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a tournament..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOURNAMENTS.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleLoadTournamentMatches}
                  disabled={isLoadingSeriesMatches || !selectedTournament}
                >
                  {isLoadingSeriesMatches ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {seriesMatches.length > 0 ? 'Refresh' : 'Load'}
                </Button>
              </div>

              {selectedTournament && seriesMatches.length > 0 && (
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

      {/* Global Matches List */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">All Matches</CardTitle>
            <Button size="sm" variant="outline" onClick={fetchGlobalMatches}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2">
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matches yet. Use tournament sync or add manually.
                </p>
              ) : (
                matches.map(match => {
                  const pollingStatus = pollingStatuses.get(match.cricbuzzMatchId);
                  const isPollingEnabled = pollingStatus?.pollingEnabled ?? match.pollingEnabled ?? false;
                  const matchAutoEnabled = pollingStatus?.autoEnabled ?? true;
                  const matchIsLive = match.matchState === 'Live';

                  return (
                    <div
                      key={match.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedMatch?.id === match.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${match.hasRawStats && !matchIsLive ? 'opacity-60' : ''}`}
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
                            {isPollingEnabled && matchAutoEnabled && (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                                <Clock className="w-3 h-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                            {isPollingEnabled && !matchAutoEnabled && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Manual
                              </Badge>
                            )}
                            {match.linkedLeagueCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Link2 className="w-3 h-3 mr-1" />
                                {match.linkedLeagueCount} league{match.linkedLeagueCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          {match.result && (
                            <p className="text-xs text-muted-foreground">{match.result}</p>
                          )}
                          {pollingStatus && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {pollingStatus.lastPolledAt && (
                                <span>
                                  Last poll: {new Date(pollingStatus.lastPolledAt).toLocaleTimeString()}
                                </span>
                              )}
                              {(pollingStatus.pollCount ?? 0) > 0 && (
                                <span>({pollingStatus.pollCount} polls)</span>
                              )}
                              {(pollingStatus.errorCount ?? 0) > 0 && (
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
                          {!match.hasRawStats && (
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
                              {!matchAutoEnabled && !isPollingEnabled && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReEnableAuto(match.cricbuzzMatchId)}
                                  className="h-7 px-2 text-xs text-muted-foreground"
                                  title="Re-enable automatic lifecycle polling"
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  Re-enable Auto
                                </Button>
                              )}
                            </div>
                          )}
                          {match.hasRawStats ? (
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

      {/* Raw Stats Preview */}
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
                <CardTitle className="text-sm">Raw Stats Preview</CardTitle>
                {isMatchLive && (
                  <Badge className="bg-red-500 animate-pulse text-xs">LIVE</Badge>
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
                  {parsedStats.length} players
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <ScrollArea className="h-72">
              <div className="space-y-1">
                {parsedStats.map(player => (
                  <div
                    key={player.cricbuzzPlayerId}
                    className="p-2 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-sm">{player.playerName}</span>
                        <span className="text-xs text-muted-foreground ml-2">({player.teamName})</span>
                        <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                          {(player.runs > 0 || player.ballsFaced > 0) && (
                            <span>Bat: {player.runs}({player.ballsFaced}) | {player.fours}x4 {player.sixes}x6</span>
                          )}
                          {player.overs > 0 && (
                            <span>Bowl: {player.wickets}/{player.runsConceded} ({player.overs}ov)</span>
                          )}
                          {(player.catches > 0 || player.stumpings > 0 || player.runOuts > 0) && (
                            <span>Field: {player.catches}c {player.stumpings}st {player.runOuts}ro</span>
                          )}
                        </div>
                      </div>
                      {player.teamWon && (
                        <Badge className="bg-green-500 text-xs">Won</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Save Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isMatchLive ? (
                  <span className="text-yellow-500 flex items-center gap-1">
                    <Radio className="w-4 h-4 animate-pulse" />
                    Match is live - raw stats only (no fantasy points)
                  </span>
                ) : (
                  <span>
                    {parsedStats.length} player stats ready to save globally
                  </span>
                )}
              </div>
              <Button
                onClick={handleSaveStats}
                disabled={isSaving || parsedStats.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {isMatchLive ? 'Save Live Stats' : 'Save & Calculate League Points'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
};
