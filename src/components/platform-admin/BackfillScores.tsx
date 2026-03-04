import { useState, useEffect, useCallback } from 'react';
import { DatabaseBackup, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { recomputeLeaguePoints } from '@/lib/scoring-recompute';
import { mergeScoringRules, type ScoringRules } from '@/lib/scoring-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface League {
  id: string;
  name: string;
}

interface DiagnosticInfo {
  totalLeagueMatches: number;
  completedMatches: number;
  scoreRows: number;
  missingScoreMatches: number;
}

export const BackfillScores = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  const fetchLeagues = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('leagues')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching leagues:', error);
      toast.error('Failed to load leagues');
    } else {
      setLeagues(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const fetchDiagnostic = useCallback(async (leagueId: string) => {
    setDiagnosticLoading(true);
    setDiagnostic(null);

    try {
      // Count total league matches
      const { count: totalMatches } = await supabase
        .from('league_matches')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId);

      // Count completed matches (cricket_matches.state = 'Complete')
      const { data: completedData } = await supabase
        .from('league_matches')
        .select('match_id, cricket_matches!inner(state)')
        .eq('league_id', leagueId)
        .eq('cricket_matches.state', 'Complete');

      // Count score rows
      const { count: scoreCount } = await supabase
        .from('league_player_match_scores')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId);

      // Count completed matches that have match_player_stats but NO league_player_match_scores
      const completedMatchIds = (completedData || []).map(d => d.match_id);
      let missingCount = 0;

      if (completedMatchIds.length > 0) {
        // For each completed match, check if it has stats but no scores
        const { data: matchesWithStats } = await supabase
          .from('match_player_stats')
          .select('match_id')
          .in('match_id', completedMatchIds);

        const matchIdsWithStats = new Set((matchesWithStats || []).map(s => s.match_id));

        const { data: matchesWithScores } = await supabase
          .from('league_player_match_scores')
          .select('match_id')
          .eq('league_id', leagueId)
          .in('match_id', completedMatchIds);

        const matchIdsWithScores = new Set((matchesWithScores || []).map(s => s.match_id));

        for (const matchId of matchIdsWithStats) {
          if (!matchIdsWithScores.has(matchId)) {
            missingCount++;
          }
        }
      }

      setDiagnostic({
        totalLeagueMatches: totalMatches || 0,
        completedMatches: completedData?.length || 0,
        scoreRows: scoreCount || 0,
        missingScoreMatches: missingCount,
      });
    } catch (error) {
      console.error('Error fetching diagnostic:', error);
    } finally {
      setDiagnosticLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      fetchDiagnostic(selectedLeagueId);
    } else {
      setDiagnostic(null);
    }
  }, [selectedLeagueId, fetchDiagnostic]);

  const handleBackfillAndRecompute = async () => {
    if (!selectedLeagueId) return;

    setIsBackfilling(true);
    try {
      // Step 1: Backfill missing skeleton rows
      toast.info('Backfilling missing score rows...');
      const { data: insertedCount, error: backfillError } = await supabase
        .rpc('backfill_league_scores', { p_league_id: selectedLeagueId });

      if (backfillError) throw backfillError;

      const rowsInserted = insertedCount as number;

      if (rowsInserted === 0) {
        toast.info('No missing rows found. Running recompute anyway...');
      } else {
        toast.success(`Backfilled ${rowsInserted} missing score rows`);
      }

      // Step 2: Recompute fantasy points
      toast.info('Recomputing fantasy points...');
      const { data: scoringRulesData, error: scoringError } = await supabase
        .from('scoring_rules')
        .select('rules')
        .eq('league_id', selectedLeagueId)
        .maybeSingle();

      if (scoringError) throw scoringError;

      const rules = mergeScoringRules(scoringRulesData?.rules as Partial<ScoringRules> | null);
      const updatedCount = await recomputeLeaguePoints(selectedLeagueId, rules);

      toast.success(`Backfill complete! ${rowsInserted} rows created, ${updatedCount} scores recomputed.`);

      // Refresh diagnostic
      fetchDiagnostic(selectedLeagueId);
    } catch (error) {
      console.error('Error during backfill:', error);
      toast.error(`Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4" />
            Backfill League Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading leagues...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4" />
          Backfill League Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Use this when the live-stats-poller missed a league. Backfill creates missing
          score skeleton rows, then recompute calculates actual fantasy points.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Select League
            </label>
            <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
              <SelectTrigger className="h-9 text-sm">
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
          </div>

          <Button
            onClick={handleBackfillAndRecompute}
            disabled={!selectedLeagueId || isBackfilling}
            size="sm"
            className="h-9"
          >
            {isBackfilling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DatabaseBackup className="w-3.5 h-3.5 mr-1.5" />
                Backfill & Recompute
              </>
            )}
          </Button>
        </div>

        {/* Diagnostic panel */}
        {selectedLeagueId && (
          <div className="border rounded-lg p-3 bg-muted/50">
            {diagnosticLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running diagnostics...
              </div>
            ) : diagnostic ? (
              <div className="space-y-2">
                <h4 className="text-xs font-medium">League Health Check</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total matches:</span>
                    <span className="font-medium">{diagnostic.totalLeagueMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="font-medium">{diagnostic.completedMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score rows:</span>
                    <span className="font-medium">{diagnostic.scoreRows}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Missing scores:</span>
                    {diagnostic.missingScoreMatches > 0 ? (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {diagnostic.missingScoreMatches} matches
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500 text-[10px] h-5 px-1.5">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        All good
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
