import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { fetchRulesAndRecompute } from '@/lib/scoring-recompute';
import { useGameStore } from '@/store/useGameStore';

interface WeekReadiness {
  total_matches: number;
  finalized_matches: number;
  is_ready: boolean;
}

interface MatchupRow {
  id: string;
  manager1_id: string;
  manager2_id: string | null;
  manager1_score: number | null;
  manager2_score: number | null;
  winner_id: string | null;
  is_finalized: boolean;
}

interface WeekInfo {
  week: number;
  matchCount: number;
  readiness?: WeekReadiness;
  isFinalized: boolean;
  matchups: MatchupRow[];
}

interface WeekScoresFinalizationProps {
  leagueId: string;
}

export const WeekScoresFinalization = ({ leagueId }: WeekScoresFinalizationProps) => {
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [confirmFinalizeWeek, setConfirmFinalizeWeek] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [editedScores, setEditedScores] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [isSavingScores, setIsSavingScores] = useState(false);

  const managers = useGameStore((state) => state.managers);
  const addActivity = useGameStore((state) => state.addActivity);

  const getManagerName = useCallback(
    (managerId: string | null) => {
      if (!managerId) return 'BYE';
      const manager = managers.find((m) => m.id === managerId);
      return manager?.teamName || 'Unknown';
    },
    [managers]
  );

  const fetchWeeks = useCallback(async () => {
    if (!leagueId) return;
    setIsLoading(true);

    try {
      // Get all assigned weeks from league_matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('league_matches')
        .select('week')
        .eq('league_id', leagueId)
        .not('week', 'is', null);

      if (matchesError) throw matchesError;

      // Count cricket matches per week
      const weekCounts = new Map<number, number>();
      for (const row of matchesData || []) {
        if (row.week !== null) {
          weekCounts.set(row.week, (weekCounts.get(row.week) || 0) + 1);
        }
      }

      const weekNumbers = [...weekCounts.keys()].sort((a, b) => a - b);

      // Fetch readiness, finalization status, and matchup scores for each week
      const weekInfos = await Promise.all(
        weekNumbers.map(async (week) => {
          const [readinessResult, matchupsResult] = await Promise.all([
            supabase.rpc('check_week_finalization_ready', {
              p_league_id: leagueId,
              p_week: week,
            }),
            supabase
              .from('league_matchups')
              .select(
                'id, manager1_id, manager2_id, manager1_score, manager2_score, winner_id, is_finalized'
              )
              .eq('league_id', leagueId)
              .eq('week', week),
          ]);

          const readiness = readinessResult.data?.[0] as WeekReadiness | undefined;
          const matchups = (matchupsResult.data || []) as MatchupRow[];
          const isFinalized =
            matchups.length > 0 && matchups.every((m) => m.is_finalized);

          return {
            week,
            matchCount: weekCounts.get(week) || 0,
            readiness,
            isFinalized,
            matchups,
          };
        })
      );

      setWeeks(weekInfos);
    } catch (error) {
      console.error('Error fetching week finalization data:', error);
      toast.error('Failed to load week data');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) {
        next.delete(week);
        // Cancel editing if collapsing
        if (editingWeek === week) {
          setEditingWeek(null);
          setEditedScores({});
        }
      } else {
        next.add(week);
      }
      return next;
    });
  };

  const startEditing = (weekInfo: WeekInfo) => {
    setEditingWeek(weekInfo.week);
    const scores: Record<string, { home: string; away: string }> = {};
    for (const matchup of weekInfo.matchups) {
      scores[matchup.id] = {
        home: matchup.manager1_score?.toString() || '',
        away: matchup.manager2_score?.toString() || '',
      };
    }
    setEditedScores(scores);
  };

  const cancelEditing = () => {
    setEditingWeek(null);
    setEditedScores({});
  };

  const logTransaction = async (week: number, description: string) => {
    const transactionId = crypto.randomUUID();
    const { error } = await supabase.from('transactions').insert({
      id: transactionId,
      type: 'score' as const,
      manager_id: null,
      description,
      week,
      league_id: leagueId,
    });
    if (error) {
      console.error('Failed to log transaction:', error);
    }
    addActivity({
      id: transactionId,
      timestamp: new Date(),
      type: 'score',
      managerId: 'system',
      description,
    });
  };

  const handleSaveScores = async (weekInfo: WeekInfo) => {
    setIsSavingScores(true);
    try {
      // Build updates first, then execute in parallel
      const updates: { matchup: MatchupRow; newHome: number; newAway: number | null; winnerId: string | null }[] = [];

      for (const matchup of weekInfo.matchups) {
        const edited = editedScores[matchup.id];
        if (!edited) continue;

        const newHome = parseFloat(edited.home);
        const newAway = matchup.manager2_id ? parseFloat(edited.away) : null;

        if (isNaN(newHome) || (matchup.manager2_id && isNaN(newAway!))) continue;

        // Skip if no actual change
        if (newHome === matchup.manager1_score && newAway === matchup.manager2_score) continue;

        // Determine new winner
        let winnerId: string | null = null;
        if (matchup.manager2_id && newAway !== null) {
          if (newHome > newAway) winnerId = matchup.manager1_id;
          else if (newAway > newHome) winnerId = matchup.manager2_id;
        }

        updates.push({ matchup, newHome, newAway, winnerId });
      }

      if (updates.length === 0) {
        toast.info('No score changes detected');
        setEditingWeek(null);
        setEditedScores({});
        return;
      }

      // Execute all updates in parallel
      const results = await Promise.all(
        updates.map(({ matchup, newHome, newAway, winnerId }) =>
          supabase
            .from('league_matchups')
            .update({
              manager1_score: newHome,
              manager2_score: newAway,
              winner_id: winnerId,
            })
            .eq('id', matchup.id)
            .then(({ error }) => ({ matchup, newHome, newAway, error }))
        )
      );

      const changes: string[] = [];
      for (const { matchup, newHome, newAway, error } of results) {
        if (error) {
          toast.error(`Failed to update matchup: ${error.message}`);
          continue;
        }
        const homeName = getManagerName(matchup.manager1_id);
        const awayName = getManagerName(matchup.manager2_id);
        changes.push(
          `${homeName} ${matchup.manager1_score ?? '—'} → ${newHome} vs ${awayName} ${matchup.manager2_score ?? '—'} → ${newAway ?? '—'}`
        );
      }

      if (changes.length > 0) {
        const description = `Week ${weekInfo.week} scores manually adjusted:\n${changes.join('\n')}`;
        await logTransaction(weekInfo.week, description);
        toast.success(`Updated ${changes.length} matchup score(s) for Week ${weekInfo.week}`);
      }

      setEditingWeek(null);
      setEditedScores({});
      await fetchWeeks();
    } catch {
      toast.error('Failed to save scores');
    } finally {
      setIsSavingScores(false);
    }
  };

  const handleFinalizeWeek = async () => {
    if (confirmFinalizeWeek === null) return;

    setIsFinalizing(true);
    try {
      toast.info('Recomputing league scores...');
      await fetchRulesAndRecompute(leagueId);

      const { error } = await supabase.rpc('finalize_week', {
        p_league_id: leagueId,
        p_week: confirmFinalizeWeek,
      });

      if (error) {
        toast.error(`Failed to finalize week: ${error.message}`);
        return;
      }

      // Fetch updated matchups to build the activity description
      const { data: finalizedMatchups } = await supabase
        .from('league_matchups')
        .select(
          'manager1_id, manager2_id, manager1_score, manager2_score, winner_id'
        )
        .eq('league_id', leagueId)
        .eq('week', confirmFinalizeWeek);

      const scoreSummary: string[] = [];
      for (const m of finalizedMatchups || []) {
        const homeName = getManagerName(m.manager1_id);
        const awayName = getManagerName(m.manager2_id);
        const winner = m.winner_id
          ? getManagerName(m.winner_id)
          : 'Tie';
        scoreSummary.push(
          `${homeName} ${m.manager1_score ?? 0} - ${m.manager2_score ?? 0} ${awayName} (${winner === 'Tie' ? 'Tie' : `W: ${winner}`})`
        );
      }

      const description = `Week ${confirmFinalizeWeek} finalized:\n${scoreSummary.join('\n')}`;
      await logTransaction(confirmFinalizeWeek, description);

      toast.success(`Week ${confirmFinalizeWeek} finalized successfully`);
      setConfirmFinalizeWeek(null);
      await fetchWeeks();
    } catch {
      toast.error('Failed to finalize week');
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No weeks assigned yet. Use Week Manager to assign matches to weeks first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {weeks.map((weekInfo) => {
        const isExpanded = expandedWeeks.has(weekInfo.week);
        const isEditing = editingWeek === weekInfo.week;

        return (
          <Collapsible
            key={weekInfo.week}
            open={isExpanded}
            onOpenChange={() => toggleWeek(weekInfo.week)}
          >
            <div
              className={`border rounded-lg overflow-hidden transition-colors ${
                weekInfo.isFinalized
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-border'
              }`}
            >
              {/* Week header row */}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                      Week {weekInfo.week}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {weekInfo.matchCount} match
                      {weekInfo.matchCount !== 1 ? 'es' : ''}
                    </span>
                    {weekInfo.isFinalized ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Finalized
                      </Badge>
                    ) : weekInfo.readiness?.is_ready ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">
                        <Clock className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {weekInfo.readiness
                          ? `${weekInfo.readiness.finalized_matches}/${weekInfo.readiness.total_matches} ready`
                          : 'Not Ready'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!weekInfo.isFinalized &&
                      weekInfo.readiness?.is_ready && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmFinalizeWeek(weekInfo.week);
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Finalize
                        </Button>
                      )}
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>

              {/* Expanded matchup scores */}
              <CollapsibleContent>
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {weekInfo.matchups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No matchups scheduled for this week.
                    </p>
                  ) : (
                    <>
                      {weekInfo.matchups.map((matchup) => {
                        const isBye = !matchup.manager2_id;
                        const edited = editedScores[matchup.id];

                        return (
                          <div
                            key={matchup.id}
                            className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2"
                          >
                            {/* Home manager */}
                            <span className="text-sm font-medium text-foreground flex-1 text-right truncate">
                              {getManagerName(matchup.manager1_id)}
                            </span>

                            {/* Scores */}
                            {isEditing ? (
                              <>
                                <Input
                                  type="number"
                                  value={edited?.home ?? ''}
                                  onChange={(e) =>
                                    setEditedScores((prev) => ({
                                      ...prev,
                                      [matchup.id]: {
                                        ...prev[matchup.id],
                                        home: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-20 text-center text-sm font-bold bg-background border-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-xs text-muted-foreground">
                                  vs
                                </span>
                                {isBye ? (
                                  <span className="w-20 text-center text-xs text-muted-foreground italic">
                                    BYE
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    value={edited?.away ?? ''}
                                    onChange={(e) =>
                                      setEditedScores((prev) => ({
                                        ...prev,
                                        [matchup.id]: {
                                          ...prev[matchup.id],
                                          away: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-20 text-center text-sm font-bold bg-background border-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                )}
                              </>
                            ) : (
                              <>
                                <span
                                  className={`w-20 text-center text-sm font-bold tabular-nums ${
                                    matchup.winner_id === matchup.manager1_id
                                      ? 'text-green-400'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {matchup.manager1_score ?? '—'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  vs
                                </span>
                                {isBye ? (
                                  <span className="w-20 text-center text-xs text-muted-foreground italic">
                                    BYE
                                  </span>
                                ) : (
                                  <span
                                    className={`w-20 text-center text-sm font-bold tabular-nums ${
                                      matchup.winner_id === matchup.manager2_id
                                        ? 'text-green-400'
                                        : 'text-foreground'
                                    }`}
                                  >
                                    {matchup.manager2_score ?? '—'}
                                  </span>
                                )}
                              </>
                            )}

                            {/* Away manager */}
                            <span className="text-sm font-medium text-foreground flex-1 truncate">
                              {getManagerName(matchup.manager2_id)}
                            </span>
                          </div>
                        );
                      })}

                      {/* Edit/Save controls for finalized weeks */}
                      {weekInfo.isFinalized && (
                        <div className="flex justify-end gap-2 pt-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={cancelEditing}
                                disabled={isSavingScores}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSaveScores(weekInfo)}
                                disabled={isSavingScores}
                              >
                                {isSavingScores ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3 mr-1" />
                                )}
                                Save Scores
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(weekInfo);
                              }}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit Scores
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Finalize Confirmation Dialog */}
      <Dialog
        open={confirmFinalizeWeek !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmFinalizeWeek(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Week {confirmFinalizeWeek}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will calculate final scores with C/VC multipliers, determine
              matchup winners, and update W/L standings.
            </p>
            <p className="text-sm text-yellow-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmFinalizeWeek(null)}
              disabled={isFinalizing}
            >
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
    </div>
  );
};
