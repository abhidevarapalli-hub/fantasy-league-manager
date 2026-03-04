import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Plus, Check, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MatchInfo {
  match_id: string;
  match_title: string;
  match_date: string;
  state: string;
  stats_imported: boolean;
}

interface WeekReadiness {
  total_matches: number;
  finalized_matches: number;
  is_ready: boolean;
}

export interface WeekCardProps {
  leagueId: string;
  week: number | null; // null = Unassigned bucket
  matches: MatchInfo[];
  readiness?: WeekReadiness;
  isFinalized: boolean;
  onMatchRemoved: () => void;
  onAddMatchesClick: (week: number) => void;
  onFinalizeClick: (week: number) => void;
}

export const WeekCard = ({
  leagueId,
  week,
  matches,
  readiness,
  isFinalized,
  onMatchRemoved,
  onAddMatchesClick,
  onFinalizeClick,
}: WeekCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [removingMatchId, setRemovingMatchId] = useState<string | null>(null);

  const isUnassigned = week === null;
  const matchCount = matches.length;

  const handleRemoveMatch = async (matchId: string) => {
    setRemovingMatchId(matchId);
    try {
      const { error } = await supabase.rpc('update_match_week', {
        p_league_id: leagueId,
        p_match_id: matchId,
        p_new_week: null,
      });

      if (error) {
        toast.error(`Failed to remove match: ${error.message}`);
        return;
      }

      toast.success('Match unassigned');
      onMatchRemoved();
    } catch {
      toast.error('Failed to remove match');
    } finally {
      setRemovingMatchId(null);
    }
  };

  const getBorderClass = () => {
    if (isUnassigned) return 'border-dashed border-muted-foreground/30';
    if (isFinalized) return 'border-green-500/50';
    if (readiness?.is_ready) return 'border-primary/50';
    return 'border-border';
  };

  const getStatusBadge = () => {
    if (isUnassigned) return null;
    if (isFinalized) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Finalized
        </Badge>
      );
    }
    if (readiness?.is_ready) {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">
          <Clock className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        {readiness ? `${readiness.finalized_matches}/${readiness.total_matches}` : 'In Progress'}
      </Badge>
    );
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${getBorderClass()}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">
            {isUnassigned ? 'Unassigned' : `Week ${week}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </span>
          {getStatusBadge()}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-2">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No matches</p>
          ) : (
            matches.map((match) => (
              <div
                key={match.match_id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="truncate font-medium">{match.match_title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(match.match_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {match.state}
                  </Badge>
                </div>
                {!isFinalized && !match.stats_imported && !isUnassigned && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMatch(match.match_id);
                    }}
                    disabled={removingMatchId === match.match_id}
                  >
                    {removingMatchId === match.match_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}

          {/* Action buttons */}
          {!isFinalized && !isUnassigned && (
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAddMatchesClick(week!)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Matches
              </Button>
              {readiness?.is_ready && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onFinalizeClick(week!)}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Finalize Week
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
