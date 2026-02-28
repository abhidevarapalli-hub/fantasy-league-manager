import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Trophy, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { recomputeLeaguePoints } from '@/lib/scoring-recompute';
import { mergeScoringRules } from '@/lib/scoring-types';
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

interface LeagueMatch {
  match_id: string;
  league_id: string;
  week: number | null;
  stats_imported: boolean | null;
}

interface MatchPlayer {
  cricbuzz_player_id: string;
  player_name: string;
}

interface WeekGroup {
  week: number | null;
  matches: CricketMatch[];
}

export const MatchFinalization = () => {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [leagueMatches, setLeagueMatches] = useState<LeagueMatch[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<Map<string, MatchPlayer[]>>(new Map());
  const [selectedMoM, setSelectedMoM] = useState<Map<string, string>>(new Map());
  const [selectedWinner, setSelectedWinner] = useState<Map<string, number>>(new Map());
  const [finalizingMatchId, setFinalizingMatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('cricket_matches')
        .select('*')
        .order('match_date', { ascending: true });

      if (matchesError) throw matchesError;

      const { data: leagueMatchesData, error: leagueMatchesError } = await supabase
        .from('league_matches')
        .select('match_id, league_id, week, stats_imported');

      if (leagueMatchesError) throw leagueMatchesError;

      setMatches(matchesData || []);
      setLeagueMatches(leagueMatchesData || []);

      // Pre-select existing MoM and winner values
      const momMap = new Map<string, string>();
      const winnerMap = new Map<string, number>();
      for (const m of matchesData || []) {
        if (m.man_of_match_id) momMap.set(m.id, m.man_of_match_id);
        if (m.winner_team_id) winnerMap.set(m.id, m.winner_team_id);
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
    if (matchPlayers.has(matchId)) return;

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
  }, [matchPlayers]);

  const handleFinalizeMatch = async (match: CricketMatch) => {
    const momId = selectedMoM.get(match.id);
    const winnerId = selectedWinner.get(match.id);

    if (!momId || !winnerId) {
      toast.error('Please select both Man of the Match and Winner');
      return;
    }

    setFinalizingMatchId(match.id);

    try {
      const { error: rpcError } = await supabase.rpc('admin_finalize_match', {
        p_match_id: match.id,
        p_man_of_match_cricbuzz_id: momId,
        p_winner_team_id: winnerId,
      });

      if (rpcError) throw rpcError;

      const leaguesWithMatch = leagueMatches.filter(lm => lm.match_id === match.id);

      if (leaguesWithMatch.length === 0) {
        toast.success('Match finalized (no leagues affected)');
        fetchMatches();
        return;
      }

      toast.info('Recomputing league scores...');
      let successCount = 0;
      let errorCount = 0;

      for (const lm of leaguesWithMatch) {
        try {
          const { data: scoringRulesData, error: scoringError } = await supabase
            .from('scoring_rules')
            .select('rules')
            .eq('league_id', lm.league_id)
            .maybeSingle();

          if (scoringError) throw scoringError;

          const rules = mergeScoringRules(scoringRulesData?.rules as never);
          await recomputeLeaguePoints(lm.league_id, rules);
          successCount++;
        } catch (error) {
          console.error(`Error recomputing league ${lm.league_id}:`, error);
          errorCount++;
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

  const groupMatchesByWeek = (): WeekGroup[] => {
    const weekMap = new Map<number | null, CricketMatch[]>();

    for (const match of matches) {
      const lm = leagueMatches.find(l => l.match_id === match.id);
      const week = lm?.week ?? null;

      if (!weekMap.has(week)) weekMap.set(week, []);
      weekMap.get(week)!.push(match);
    }

    const groups: WeekGroup[] = Array.from(weekMap.entries()).map(([week, matches]) => ({
      week,
      matches,
    }));

    groups.sort((a, b) => {
      if (a.week === null) return 1;
      if (b.week === null) return -1;
      return a.week - b.week;
    });

    return groups;
  };

  const getStatusBadge = (match: CricketMatch) => {
    const lm = leagueMatches.find(l => l.match_id === match.id);
    const isFinalized = lm?.stats_imported === true;

    if (isFinalized) {
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

  const isMatchFinalized = (matchId: string): boolean => {
    const lm = leagueMatches.find(l => l.match_id === matchId);
    return lm?.stats_imported === true;
  };

  const weekGroups = groupMatchesByWeek();

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
            {weekGroups.map(group => (
              <div key={group.week ?? 'no-week'} className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  {group.week !== null ? `Week ${group.week}` : 'Unassigned'}
                </h3>

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
                      {group.matches.map(match => {
                        const isComplete = match.state === 'Complete';
                        const isFinalized = isMatchFinalized(match.id);
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
                              {isComplete && !isFinalized ? (
                                <Select
                                  value={selectedMoM.get(match.id) || ''}
                                  onValueChange={(value) => {
                                    setSelectedMoM(prev => new Map(prev).set(match.id, value));
                                  }}
                                  onOpenChange={(open) => {
                                    if (open && players.length === 0) {
                                      fetchMatchPlayers(match.id);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Select player..." />
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
                              {isComplete && !isFinalized ? (
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
                                    : '-'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isComplete && !isFinalized ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleFinalizeMatch(match)}
                                  disabled={isFinalizing}
                                  className="h-7 text-xs"
                                >
                                  {isFinalizing ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Finalizing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Finalize
                                    </>
                                  )}
                                </Button>
                              ) : isFinalized ? (
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
              </div>
            ))}
          </div>
        )}

        {matches.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Finalizing a match sets Man of the Match, marks stats as imported, and
                recomputes fantasy points for all affected leagues.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
