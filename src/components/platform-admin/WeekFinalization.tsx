import { useState, useEffect, useCallback } from 'react';
import { Calendar, Check, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface League {
  id: string;
  name: string;
}

interface WeekReadiness {
  total_matches: number;
  finalized_matches: number;
  is_ready: boolean;
  unfinalized_match_ids: string[] | null;
}

interface Matchup {
  id: string;
  manager1_id: string;
  manager2_id: string | null;
  manager1_score: number | null;
  manager2_score: number | null;
  winner_id: string | null;
  is_finalized: boolean;
}

interface Manager {
  id: string;
  name: string;
  team_name: string;
}

interface WeekStatus {
  week: number;
  readiness: WeekReadiness;
  matchups: Matchup[];
  isFinalized: boolean;
}

export const WeekFinalization = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekStatus | null>(null);

  // Fetch all leagues
  useEffect(() => {
    const fetchLeagues = async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching leagues:', error);
        toast.error('Failed to load leagues');
        return;
      }

      setLeagues(data || []);
    };

    fetchLeagues();
  }, []);

  const fetchWeekData = useCallback(async (leagueId: string) => {
    setIsLoading(true);
    try {
      // Get distinct weeks
      const { data: weekData, error: weekError } = await supabase
        .from('league_matches')
        .select('week')
        .eq('league_id', leagueId)
        .not('week', 'is', null)
        .order('week');

      if (weekError) throw weekError;

      const distinctWeeks = [...new Set(
        weekData?.map(w => w.week).filter((w): w is number => w !== null)
      )];

      // Fetch managers
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('id, name, team_name')
        .eq('league_id', leagueId);

      if (managersError) throw managersError;
      setManagers(managersData || []);

      // For each week, check readiness and matchups in parallel
      const weekStatusesResults = await Promise.all(
        distinctWeeks.map(async (week) => {
          const [readinessResult, matchupsResult] = await Promise.all([
            supabase.rpc('check_week_finalization_ready', {
              p_league_id: leagueId,
              p_week: week,
            }),
            supabase
              .from('league_matchups')
              .select('id, manager1_id, manager2_id, manager1_score, manager2_score, winner_id, is_finalized')
              .eq('league_id', leagueId)
              .eq('week', week),
          ]);

          if (readinessResult.error) {
            console.error(`Error checking readiness for week ${week}:`, readinessResult.error);
            return null;
          }

          const readiness = readinessResult.data?.[0] as WeekReadiness | undefined;
          if (!readiness) return null;

          const matchups = matchupsResult.data || [];
          const isFinalized = matchups.length > 0 && matchups.every(m => m.is_finalized);

          return { week, readiness, matchups, isFinalized };
        })
      );

      setWeekStatuses(
        weekStatusesResults.filter((ws): ws is WeekStatus => ws !== null)
      );
    } catch (error) {
      console.error('Error fetching week data:', error);
      toast.error('Failed to load week data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch week data when league is selected
  useEffect(() => {
    if (!selectedLeagueId) {
      setWeekStatuses([]);
      setManagers([]);
      return;
    }
    fetchWeekData(selectedLeagueId);
  }, [selectedLeagueId, fetchWeekData]);

  const handleFinalizeWeek = async () => {
    if (!selectedWeek || !selectedLeagueId) return;

    setIsFinalizing(true);
    try {
      const { error } = await supabase.rpc('finalize_week', {
        p_league_id: selectedLeagueId,
        p_week: selectedWeek.week,
      });

      if (error) {
        toast.error(`Failed to finalize week: ${error.message}`);
        return;
      }

      toast.success(`Week ${selectedWeek.week} finalized successfully`);
      setConfirmDialogOpen(false);
      setSelectedWeek(null);

      // Refresh data
      await fetchWeekData(selectedLeagueId);
    } catch (error) {
      console.error('Error finalizing week:', error);
      toast.error('Failed to finalize week');
    } finally {
      setIsFinalizing(false);
    }
  };

  const getManagerName = (managerId: string | null): string => {
    if (!managerId) return 'BYE';
    const manager = managers.find(m => m.id === managerId);
    return manager ? `${manager.name} (${manager.team_name})` : 'Unknown';
  };

  const getStatusBadge = (weekStatus: WeekStatus) => {
    if (weekStatus.isFinalized) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Finalized
        </Badge>
      );
    }

    if (weekStatus.readiness.is_ready) {
      return (
        <Badge className="bg-green-500 animate-pulse">
          <Clock className="w-3 h-3 mr-1" />
          Ready to Finalize
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        In Progress
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Week Finalization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Finalize weekly matchups to calculate scores, determine winners, and update standings.
        </p>

        {/* League Selector */}
        <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a league..." />
          </SelectTrigger>
          <SelectContent>
            {leagues.map(league => (
              <SelectItem key={league.id} value={league.id}>
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Week Status Table */}
        {selectedLeagueId && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : weekStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No weeks found for this league.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekStatuses.map(weekStatus => (
                      <TableRow key={weekStatus.week}>
                        <TableCell className="font-medium">Week {weekStatus.week}</TableCell>
                        <TableCell>
                          {weekStatus.readiness.finalized_matches} / {weekStatus.readiness.total_matches}
                        </TableCell>
                        <TableCell>{getStatusBadge(weekStatus)}</TableCell>
                        <TableCell className="text-right">
                          {weekStatus.readiness.is_ready && !weekStatus.isFinalized ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedWeek(weekStatus);
                                setConfirmDialogOpen(true);
                              }}
                              disabled={isFinalizing}
                              className="h-7 text-xs"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Finalize Week
                            </Button>
                          ) : weekStatus.isFinalized ? (
                            <span className="text-xs text-muted-foreground">Complete</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {weekStatus.readiness.total_matches - weekStatus.readiness.finalized_matches} match(es) pending
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalize Week {selectedWeek?.week}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will calculate final scores with C/VC multipliers, determine matchup winners, and update W/L standings.
              </p>
              <div className="space-y-2">
                {selectedWeek?.matchups.map(matchup => (
                  <div key={matchup.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getManagerName(matchup.manager1_id)}</p>
                        {matchup.manager2_id ? (
                          <p className="text-sm text-muted-foreground">vs {getManagerName(matchup.manager2_id)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Bye week</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-yellow-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={isFinalizing}>
                Cancel
              </Button>
              <Button onClick={handleFinalizeWeek} disabled={isFinalizing}>
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirm Finalize
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
