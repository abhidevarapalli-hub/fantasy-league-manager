import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Trophy, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { recomputeLeaguePoints } from '@/lib/scoring-recompute';
import { mergeScoringRules, type ScoringRules } from '@/lib/scoring-types';
import { fetchScorecardDetails, fetchLeanbackDetails } from '@/integrations/cricbuzz/client';
import { resolveWinnerFromResult } from '@/lib/match-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CricketMatch {
  id: string;
  cricbuzz_match_id: number;
  match_description: string | null;
  match_date: string | null;
  team1_name: string | null;
  team1_id: number | null;
  team2_name: string | null;
  team2_id: number | null;
  state: string | null;
  result: string | null;
  man_of_match_id: string | null;
  man_of_match_name: string | null;
  winner_team_id: number | null;
}

interface MatchPlayer {
  cricbuzz_player_id: string;
  player_name: string;
}

export const MatchFinalization = () => {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<Map<string, MatchPlayer[]>>(new Map());
  const [selectedMoM, setSelectedMoM] = useState<Map<string, string>>(new Map());
  const [selectedWinner, setSelectedWinner] = useState<Map<string, number>>(new Map());
  const [finalizingMatchId, setFinalizingMatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedMatchIdsRef = useRef<Set<string>>(new Set());
  const [autoMoM, setAutoMoM] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [fetchingMoM, setFetchingMoM] = useState<Set<string>>(new Set());
  const fetchingMoMRef = useRef<Set<string>>(new Set());
  const [batchFinalizing, setBatchFinalizing] = useState(false);

  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('cricket_matches')
        .select('*')
        .order('match_date', { ascending: true });

      if (matchesError) throw matchesError;

      setMatches(matchesData || []);

      const momMap = new Map<string, string>();
      const winnerMap = new Map<string, number>();
      for (const m of matchesData || []) {
        if (m.man_of_match_id) momMap.set(m.id, m.man_of_match_id);
        if (m.winner_team_id) winnerMap.set(m.id, m.winner_team_id);
      }
      for (const m of matchesData || []) {
        if (!m.winner_team_id && m.result) {
          const autoWinner = resolveWinnerFromResult(m.result, m.team1_name, m.team2_name, m.team1_id, m.team2_id);
          if (autoWinner) winnerMap.set(m.id, autoWinner);
        }
      }

      setSelectedMoM(momMap);
      setSelectedWinner(winnerMap);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const fetchMatchPlayers = useCallback(async (matchId: string) => {
    if (fetchedMatchIdsRef.current.has(matchId)) return;
    fetchedMatchIdsRef.current.add(matchId);

    try {
      const { data: statsData, error: statsError } = await supabase
        .from('match_player_stats')
        .select('cricbuzz_player_id')
        .eq('match_id', matchId);

      if (statsError) throw statsError;
      if (!statsData || statsData.length === 0) {
        setMatchPlayers(prev => new Map(prev).set(matchId, []));
        return;
      }

      const cricbuzzIds = Array.from(new Set(statsData.map(s => s.cricbuzz_player_id)));

      const { data: playersData, error: playersError } = await supabase
        .from('master_players')
        .select('name, cricbuzz_id')
        .in('cricbuzz_id', cricbuzzIds);

      if (playersError) throw playersError;

      const playerNameMap = new Map(
        (playersData || []).map(p => [p.cricbuzz_id, p.name])
      );

      const players: MatchPlayer[] = cricbuzzIds.map(id => ({
        cricbuzz_player_id: id,
        player_name: playerNameMap.get(id) || id,
      }));

      setMatchPlayers(prev => new Map(prev).set(matchId, players));
    } catch (error) {
      console.error('Error fetching match players:', error);
    }
  }, []);

  const fetchMoMFromApi = useCallback(async (match: CricketMatch): Promise<boolean> => {
    if (!match.cricbuzz_match_id || fetchingMoMRef.current.has(match.id)) return false;
    fetchingMoMRef.current.add(match.id);
    setFetchingMoM(prev => new Set(prev).add(match.id));
    try {
      let momId: string | undefined;
      let momName: string | undefined;
      try {
        const leanback = await fetchLeanbackDetails(match.cricbuzz_match_id);
        const momPlayer = leanback.matchheaders?.momplayers?.player?.[0];
        if (momPlayer) {
          momId = momPlayer.id;
          momName = momPlayer.name;
        }
      } catch {
        // Leanback failed
      }

      if (!momId) {
        try {
          const scorecard = await fetchScorecardDetails(match.cricbuzz_match_id);
          const potm = scorecard.matchHeader?.playersOfTheMatch?.[0];
          if (potm) {
            momId = potm.id.toString();
            momName = potm.fullName || potm.name;
          }
        } catch {
          // Scorecard also failed
        }
      }

      if (momId && momName) {
        setAutoMoM(prev => new Map(prev).set(match.id, { id: momId, name: momName }));
        setSelectedMoM(prev => {
          if (!prev.has(match.id)) {
            return new Map(prev).set(match.id, momId);
          }
          return prev;
        });

        await supabase
          .from('cricket_matches')
          .update({ man_of_match_id: momId, man_of_match_name: momName })
          .eq('id', match.id);

        await supabase
          .from('match_player_stats')
          .update({ is_man_of_match: false })
          .eq('match_id', match.id);
        await supabase
          .from('match_player_stats')
          .update({ is_man_of_match: true })
          .eq('match_id', match.id)
          .eq('cricbuzz_player_id', momId);

        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to fetch MoM for match ${match.cricbuzz_match_id}:`, error);
      return false;
    } finally {
      fetchingMoMRef.current.delete(match.id);
      setFetchingMoM(prev => {
        const next = new Set(prev);
        next.delete(match.id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (isLoading || matches.length === 0) return;
    let cancelled = false;

    const matchesMissingMoM = matches.filter(m =>
      m.state === 'Complete' &&
      !m.man_of_match_id &&
      m.cricbuzz_match_id
    );

    if (matchesMissingMoM.length === 0) return;

    const fetchAll = async () => {
      let populated = 0;
      for (const match of matchesMissingMoM) {
        if (cancelled) break;
        const success = await fetchMoMFromApi(match);
        if (success) populated++;
        if (!cancelled) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (cancelled) return;

      if (populated > 0) {
        toast.success(`Auto-populated MoM for ${populated} match(es) from API`);
        fetchMatches();
      }
    };

    fetchAll();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, matches.length]);

  const resultImpliesWinner = (match: CricketMatch): boolean =>
    !!match.result && /\bwon\b/i.test(match.result);

  const isMatchFinalized = (match: CricketMatch): boolean =>
    match.man_of_match_id !== null && match.winner_team_id !== null;

  const isMatchIncomplete = (match: CricketMatch): boolean => {
    if (match.state !== 'Complete') return false;
    if (!resultImpliesWinner(match)) return false;
    return !match.winner_team_id || !match.man_of_match_id;
  };

  const handleFinalizeMatch = async (match: CricketMatch) => {
    const momId = selectedMoM.get(match.id) || null;
    const winnerId = selectedWinner.get(match.id) ?? null;

    setFinalizingMatchId(match.id);

    try {
      const { error: rpcError } = await supabase.rpc('admin_finalize_match', {
        p_match_id: match.id,
        p_man_of_match_cricbuzz_id: momId,
        p_winner_team_id: winnerId,
      });

      if (rpcError) throw rpcError;

      const { data: leaguesWithMatch, error: leagueError } = await supabase
        .from('league_matches')
        .select('league_id')
        .eq('match_id', match.id);

      if (leagueError) throw leagueError;

      if (!leaguesWithMatch || leaguesWithMatch.length === 0) {
        toast.success('Match finalized (no leagues affected)');
        fetchMatches();
        return;
      }

      toast.info('Recomputing league scores...');

      const results = await Promise.allSettled(
        leaguesWithMatch.map(async (lm) => {
          const { data: scoringRulesData, error: scoringError } = await supabase
            .from('scoring_rules')
            .select('rules')
            .eq('league_id', lm.league_id)
            .maybeSingle();

          if (scoringError) throw scoringError;

          const rules = mergeScoringRules(scoringRulesData?.rules as Partial<ScoringRules> | null);
          await recomputeLeaguePoints(lm.league_id, rules);
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const errorCount = results.filter(r => r.status === 'rejected').length;
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('Error recomputing league:', r.reason);
        }
      }

      if (errorCount > 0) {
        toast.warning(`Match finalized. ${successCount} league(s) updated, ${errorCount} failed.`);
      } else {
        toast.success(`Match finalized! ${successCount} league(s) updated.`);
      }

      fetchMatches();
    } catch (error) {
      console.error('Error finalizing match:', error);
      toast.error('Failed to finalize match');
    } finally {
      setFinalizingMatchId(null);
    }
  };

  const getStatusBadge = (match: CricketMatch) => {
    if (isMatchFinalized(match) && isMatchIncomplete(match)) {
      return (
        <Badge className="bg-orange-500">
          <AlertCircle className="w-3 h-3 mr-1" />
          Incomplete
        </Badge>
      );
    }

    if (isMatchFinalized(match)) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Finalized
        </Badge>
      );
    }

    if (match.state === 'Complete') {
      return (
        <Badge className="bg-yellow-500">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        {match.state === 'Live' || match.state === 'In Progress' ? 'Live' : 'Upcoming'}
      </Badge>
    );
  };

  const needsFinalization = (match: CricketMatch): boolean =>
    match.state === 'Complete' && (!isMatchFinalized(match) || isMatchIncomplete(match));

  const getAutoFinalizableMatches = (matchList: CricketMatch[]): CricketMatch[] =>
    matchList.filter(m =>
      needsFinalization(m) && selectedWinner.has(m.id) && selectedMoM.has(m.id)
    );

  const handleBatchFinalize = async (matchList: CricketMatch[]) => {
    const finalizeable = getAutoFinalizableMatches(matchList);
    if (finalizeable.length === 0) return;
    setBatchFinalizing(true);
    for (const match of finalizeable) {
      await handleFinalizeMatch(match);
    }
    setBatchFinalizing(false);
  };

  // Group matches by status instead of by week
  const pendingMatches = matches.filter(m => needsFinalization(m));
  const finalizedMatches = matches.filter(m => isMatchFinalized(m) && !isMatchIncomplete(m));
  const otherMatches = matches.filter(m => !needsFinalization(m) && !(isMatchFinalized(m) && !isMatchIncomplete(m)));

  const renderMatchTable = (matchList: CricketMatch[]) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Match</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Man of the Match</TableHead>
            <TableHead>Winner</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matchList.map(match => {
            const canFinalize = needsFinalization(match);
            const isIncomplete = isMatchIncomplete(match);
            const finalized = isMatchFinalized(match);
            const players = matchPlayers.get(match.id) || [];
            const isFinalizing = finalizingMatchId === match.id;

            return (
              <TableRow key={match.id}>
                <TableCell className="font-medium">
                  <span className="text-sm">
                    {match.team1_name && match.team2_name
                      ? `${match.team1_name} vs ${match.team2_name}`
                      : match.match_description || `Match #${match.cricbuzz_match_id}`}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {match.match_date
                      ? format(new Date(match.match_date), 'MMM d, yyyy')
                      : 'TBD'}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(match)}</TableCell>
                <TableCell>
                  {canFinalize ? (
                    <Select
                      value={selectedMoM.get(match.id) || ''}
                      onValueChange={(value) => {
                        setSelectedMoM(prev => new Map(prev).set(match.id, value));
                      }}
                      onOpenChange={(open) => {
                        if (open) {
                          if (players.length === 0) fetchMatchPlayers(match.id);
                          if (!selectedMoM.has(match.id) && !autoMoM.has(match.id)) {
                            fetchMoMFromApi(match);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder={
                          fetchingMoM.has(match.id)
                            ? "Fetching from API..."
                            : "Select player..."
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {players.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">
                            Loading players...
                          </div>
                        ) : (
                          players.map(player => (
                            <SelectItem
                              key={player.cricbuzz_player_id}
                              value={player.cricbuzz_player_id}
                            >
                              {player.player_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs">{match.man_of_match_name || '-'}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canFinalize ? (
                    <Select
                      value={selectedWinner.get(match.id)?.toString() || ''}
                      onValueChange={(value) => {
                        setSelectedWinner(prev => new Map(prev).set(match.id, parseInt(value)));
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select winner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No Winner / Tie</SelectItem>
                        {match.team1_id && match.team1_name && (
                          <SelectItem value={match.team1_id.toString()}>
                            {match.team1_name}
                          </SelectItem>
                        )}
                        {match.team2_id && match.team2_name && (
                          <SelectItem value={match.team2_id.toString()}>
                            {match.team2_name}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs">
                      {match.winner_team_id === match.team1_id
                        ? match.team1_name
                        : match.winner_team_id === match.team2_id
                        ? match.team2_name
                        : finalized
                        ? 'No Winner / Tie'
                        : '-'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {canFinalize ? (
                    <Button
                      size="sm"
                      onClick={() => handleFinalizeMatch(match)}
                      disabled={isFinalizing || (resultImpliesWinner(match) && !selectedMoM.has(match.id))}
                      className="h-7 text-xs"
                    >
                      {isFinalizing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {isIncomplete ? 'Updating...' : 'Finalizing...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {isIncomplete ? 'Update' : 'Finalize'}
                        </>
                      )}
                    </Button>
                  ) : finalized ? (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Done
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Match Finalization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading matches...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Match Finalization
        </CardTitle>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No matches found. Import matches first.
          </div>
        ) : (
          <div className="space-y-6">
            {pendingMatches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Pending Finalization ({pendingMatches.length})
                  </h3>
                  {getAutoFinalizableMatches(pendingMatches).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBatchFinalize(pendingMatches)}
                      disabled={batchFinalizing}
                      className="h-7 text-xs"
                    >
                      {batchFinalizing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        `Finalize All (${getAutoFinalizableMatches(pendingMatches).length})`
                      )}
                    </Button>
                  )}
                </div>
                {renderMatchTable(pendingMatches)}
              </div>
            )}

            {finalizedMatches.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Finalized ({finalizedMatches.length})
                </h3>
                {renderMatchTable(finalizedMatches)}
              </div>
            )}

            {otherMatches.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Upcoming / Live ({otherMatches.length})
                </h3>
                {renderMatchTable(otherMatches)}
              </div>
            )}
          </div>
        )}

        {matches.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Finalizing a match sets Man of the Match and Winner, then
                recomputes fantasy points for all affected leagues.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
