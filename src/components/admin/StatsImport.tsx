import { useState, useEffect } from 'react';
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
  type PlayerStatsWithOwnership,
  type CricbuzzScorecard,
} from '@/lib/cricbuzz-stats-service';
import {
  getSeriesList,
  getSeriesMatches,
  getRecentMatches,
  getMatchScorecard,
  type CricbuzzSeries,
  type CricbuzzMatch,
} from '@/lib/cricbuzz-api';

interface CricketMatch {
  id: string;
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
}

export const StatsImport = () => {
  const currentLeagueId = useGameStore(state => state.currentLeagueId);
  const scoringRules = useGameStore(state => state.scoringRules);
  const schedule = useGameStore(state => state.schedule);

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
  const [seriesList, setSeriesList] = useState<CricbuzzSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [seriesMatches, setSeriesMatches] = useState<CricbuzzMatch[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [isLoadingSeriesMatches, setIsLoadingSeriesMatches] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const maxWeek = Math.max(7, ...schedule.map(m => m.week));

  // Fetch saved matches for the league
  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('cricket_matches')
        .select('*')
        .eq('league_id', currentLeagueId)
        .order('match_date', { ascending: false });

      if (data && !error) {
        setMatches(
          data.map(m => ({
            id: m.id,
            cricbuzzMatchId: m.cricbuzz_match_id,
            matchDescription: m.match_description || '',
            team1Name: m.team1_name || '',
            team2Name: m.team2_name || '',
            result: m.result || '',
            matchDate: m.match_date || '',
            venue: m.venue || '',
            statsImported: m.stats_imported || false,
            week: m.week,
          }))
        );
      }
    };

    fetchMatches();
  }, [currentLeagueId]);

  // Load series list
  const handleLoadSeries = async () => {
    setIsLoadingSeries(true);
    try {
      const series = await getSeriesList('international');
      setSeriesList(series);
      toast.success(`Loaded ${series.length} series`);
    } catch (error) {
      console.error('Error loading series:', error);
      toast.error('Failed to load series. Make sure the Cricbuzz proxy is configured.');
    } finally {
      setIsLoadingSeries(false);
    }
  };

  // Load matches for selected series
  const handleLoadSeriesMatches = async () => {
    if (!selectedSeriesId) return;

    setIsLoadingSeriesMatches(true);
    try {
      const matches = await getSeriesMatches(parseInt(selectedSeriesId));
      setSeriesMatches(matches);
      toast.success(`Loaded ${matches.length} matches`);
    } catch (error) {
      console.error('Error loading series matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setIsLoadingSeriesMatches(false);
    }
  };

  // Sync all completed matches from series
  const handleSyncCompletedMatches = async () => {
    if (!currentLeagueId || seriesMatches.length === 0) return;

    setIsSyncing(true);
    let addedCount = 0;

    try {
      const completedMatches = seriesMatches.filter(m => m.state === 'Complete');

      for (const match of completedMatches) {
        // Check if already exists
        const { data: existing } = await supabase
          .from('cricket_matches')
          .select('id')
          .eq('cricbuzz_match_id', match.matchId)
          .eq('league_id', currentLeagueId)
          .single();

        if (!existing) {
          const { data, error } = await supabase
            .from('cricket_matches')
            .insert({
              cricbuzz_match_id: match.matchId,
              league_id: currentLeagueId,
              series_id: match.seriesId,
              match_description: match.matchDesc,
              team1_name: match.team1.teamName,
              team2_name: match.team2.teamName,
              match_date: new Date(parseInt(match.startDate)).toISOString(),
              venue: `${match.venueInfo.ground}, ${match.venueInfo.city}`,
              result: match.status,
              stats_imported: false,
            })
            .select()
            .single();

          if (!error && data) {
            addedCount++;
            setMatches(prev => [
              {
                id: data.id,
                cricbuzzMatchId: match.matchId,
                matchDescription: match.matchDesc,
                team1Name: match.team1.teamName,
                team2Name: match.team2.teamName,
                result: match.status,
                matchDate: new Date(parseInt(match.startDate)).toISOString(),
                venue: `${match.venueInfo.ground}, ${match.venueInfo.city}`,
                statsImported: false,
                week: null,
              },
              ...prev,
            ]);
          }
        }
      }

      toast.success(`Synced ${addedCount} new completed matches`);
    } catch (error) {
      console.error('Error syncing matches:', error);
      toast.error('Failed to sync some matches');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a match by Cricbuzz ID (manual)
  const handleAddMatch = async () => {
    if (!matchIdInput || !currentLeagueId) return;

    setIsLoading(true);
    try {
      const matchId = parseInt(matchIdInput);
      if (isNaN(matchId)) {
        toast.error('Invalid match ID');
        return;
      }

      const { data: existing } = await supabase
        .from('cricket_matches')
        .select('id')
        .eq('cricbuzz_match_id', matchId)
        .eq('league_id', currentLeagueId)
        .single();

      if (existing) {
        toast.error('Match already added');
        return;
      }

      const { data, error } = await supabase
        .from('cricket_matches')
        .insert({
          cricbuzz_match_id: matchId,
          league_id: currentLeagueId,
          series_id: 0,
          match_description: `Match #${matchId}`,
          stats_imported: false,
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to add match');
        console.error(error);
        return;
      }

      setMatches(prev => [
        {
          id: data.id,
          cricbuzzMatchId: matchId,
          matchDescription: `Match #${matchId}`,
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

      // Update match info and live status
      if (scorecard.status) {
        await supabase
          .from('cricket_matches')
          .update({ result: scorecard.status })
          .eq('id', match.id);

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

  // Auto-import all pending matches
  const handleAutoImportAll = async () => {
    const pendingMatches = matches.filter(m => !m.statsImported);
    if (pendingMatches.length === 0) {
      toast.info('No pending matches to import');
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const match of pendingMatches) {
      try {
        await handleFetchScorecard(match);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        if (parsedStats.length > 0) {
          const weekNum = parseInt(selectedWeek);
          const result = await saveMatchStats(
            currentLeagueId!,
            match.id,
            weekNum,
            parsedStats
          );

          if (result.success) {
            successCount++;
            setMatches(prev =>
              prev.map(m =>
                m.id === match.id ? { ...m, statsImported: true, week: weekNum } : m
              )
            );
          } else {
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`Error importing match ${match.cricbuzzMatchId}:`, error);
        errorCount++;
      }
    }

    setIsSyncing(false);
    setParsedStats([]);
    setSelectedMatch(null);

    if (successCount > 0) {
      toast.success(`Imported ${successCount} matches`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to import ${errorCount} matches`);
    }
  };

  // Save stats to database
  const handleSaveStats = async () => {
    if (!selectedMatch || !currentLeagueId || parsedStats.length === 0) return;

    setIsSaving(true);
    try {
      const weekNum = parseInt(selectedWeek);
      const result = await saveMatchStats(
        currentLeagueId,
        selectedMatch.id,
        weekNum,
        parsedStats
      );

      if (result.success) {
        toast.success(`Stats imported for Week ${weekNum}`);

        setMatches(prev =>
          prev.map(m =>
            m.id === selectedMatch.id ? { ...m, statsImported: true, week: weekNum } : m
          )
        );
        setSelectedMatch(null);
        setParsedStats([]);
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

      <Tabs defaultValue="series" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="series">
            <Trophy className="w-4 h-4 mr-2" />
            By Series
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Search className="w-4 h-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>

        {/* Series-based import */}
        <TabsContent value="series" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quick Sync from Series
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              {/* Load series button */}
              {seriesList.length === 0 ? (
                <Button
                  onClick={handleLoadSeries}
                  disabled={isLoadingSeries}
                  className="w-full"
                >
                  {isLoadingSeries ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Load International Series
                </Button>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSeriesId}
                      onValueChange={setSelectedSeriesId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a series..." />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesList.map(series => (
                          <SelectItem key={series.id} value={series.id.toString()}>
                            {series.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleLoadSeriesMatches}
                      disabled={!selectedSeriesId || isLoadingSeriesMatches}
                    >
                      {isLoadingSeriesMatches ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {seriesMatches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {seriesMatches.filter(m => m.state === 'Complete').length}{' '}
                          completed matches found
                        </span>
                        <Button
                          size="sm"
                          onClick={handleSyncCompletedMatches}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Sync All Completed
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
                  placeholder="Enter Cricbuzz Match ID"
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
                Find match IDs from Cricbuzz URLs (e.g.,
                cricbuzz.com/live-cricket-scores/138974/...)
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
                matches.map(match => (
                  <div
                    key={match.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMatch?.id === match.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    } ${match.statsImported ? 'opacity-60' : ''}`}
                    onClick={() =>
                      !match.statsImported && handleFetchScorecard(match)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {match.team1Name && match.team2Name
                              ? `${match.team1Name} vs ${match.team2Name}`
                              : match.matchDescription}
                          </p>
                          {match.isLive && (
                            <Badge className="bg-red-500 animate-pulse text-xs">
                              LIVE
                            </Badge>
                          )}
                        </div>
                        {match.result && (
                          <p className="text-xs text-muted-foreground">
                            {match.result}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {match.week && (
                          <Badge variant="outline">Week {match.week}</Badge>
                        )}
                        {match.statsImported ? (
                          <Badge className="bg-green-500">
                            <Check className="w-3 h-3 mr-1" />
                            Imported
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
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
                  <span className="text-yellow-500">
                    Match is live - wait for completion to import final stats
                  </span>
                ) : (
                  <span>
                    {ownedPlayers.filter(p => p.isInActiveRoster).length} active
                    roster players will earn points
                  </span>
                )}
              </div>
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
                {isMatchLive ? 'Import Current Stats' : `Import to Week ${selectedWeek}`}
              </Button>
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
