import { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface WeekReadiness {
  total_matches: number;
  finalized_matches: number;
  is_ready: boolean;
}

interface WeekInfo {
  week: number;
  matchCount: number;
  readiness?: WeekReadiness;
  isFinalized: boolean;
}

interface WeekFinalizationProps {
  leagueId: string;
}

export const WeekFinalization = ({ leagueId }: WeekFinalizationProps) => {
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [confirmFinalizeWeek, setConfirmFinalizeWeek] = useState<number | null>(null);

  const fetchWeeks = useCallback(async () => {
    if (!leagueId) return;
    setIsLoading(true);

    try {
      // Get all assigned weeks with match counts
      const { data: matchesData, error: matchesError } = await supabase
        .from('league_matches')
        .select('week')
        .eq('league_id', leagueId)
        .not('week', 'is', null);

      if (matchesError) throw matchesError;

      // Count matches per week
      const weekCounts = new Map<number, number>();
      for (const row of matchesData || []) {
        if (row.week !== null) {
          weekCounts.set(row.week, (weekCounts.get(row.week) || 0) + 1);
        }
      }

      const weekNumbers = [...weekCounts.keys()].sort((a, b) => a - b);

      // Check readiness and finalization for each week
      const weekInfos = await Promise.all(
        weekNumbers.map(async (week) => {
          const [readinessResult, matchupsResult] = await Promise.all([
            supabase.rpc('check_week_finalization_ready', {
              p_league_id: leagueId,
              p_week: week,
            }),
            supabase
              .from('league_matchups')
              .select('is_finalized')
              .eq('league_id', leagueId)
              .eq('week', week),
          ]);

          const readiness = readinessResult.data?.[0] as WeekReadiness | undefined;
          const matchups = matchupsResult.data || [];
          const isFinalized = matchups.length > 0 && matchups.every((m) => m.is_finalized);

          return {
            week,
            matchCount: weekCounts.get(week) || 0,
            readiness,
            isFinalized,
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

  const handleFinalizeWeek = async () => {
    if (confirmFinalizeWeek === null) return;

    setIsFinalizing(true);
    try {
      const { error } = await supabase.rpc('finalize_week', {
        p_league_id: leagueId,
        p_week: confirmFinalizeWeek,
      });

      if (error) {
        toast.error(`Failed to finalize week: ${error.message}`);
        return;
      }

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
      {weeks.map((weekInfo) => (
        <div
          key={weekInfo.week}
          className={`flex items-center justify-between px-4 py-3 border rounded-lg ${
            weekInfo.isFinalized ? 'border-green-500/50 bg-green-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">Week {weekInfo.week}</span>
            <span className="text-xs text-muted-foreground">
              {weekInfo.matchCount} match{weekInfo.matchCount !== 1 ? 'es' : ''}
            </span>
            {weekInfo.isFinalized ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Finalized
              </Badge>
            ) : weekInfo.readiness?.is_ready ? (
              <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">
                <Clock className="w-3 h-3 mr-1" />
                Ready to Finalize
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="w-3 h-3 mr-1" />
                {weekInfo.readiness
                  ? `${weekInfo.readiness.finalized_matches}/${weekInfo.readiness.total_matches} matches ready`
                  : 'Not Ready'}
              </Badge>
            )}
          </div>

          {!weekInfo.isFinalized && weekInfo.readiness?.is_ready && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => setConfirmFinalizeWeek(weekInfo.week)}
            >
              <Check className="w-3 h-3 mr-1" />
              Finalize Week
            </Button>
          )}
        </div>
      ))}

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
              This will calculate final scores with C/VC multipliers, determine matchup winners,
              and update W/L standings.
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
