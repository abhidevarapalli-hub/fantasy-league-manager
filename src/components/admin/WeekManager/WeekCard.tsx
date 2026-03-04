import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Plus, Loader2 } from 'lucide-react';
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

export interface WeekCardProps {
  leagueId: string;
  week: number | null; // null = Unassigned bucket
  matches: MatchInfo[];
  onMatchRemoved: () => void;
  onAddMatchesClick: (week: number) => void;
}

export const WeekCard = ({
  leagueId,
  week,
  matches,
  onMatchRemoved,
  onAddMatchesClick,
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
    return 'border-border';
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
                {!match.stats_imported && !isUnassigned && (
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
          {!isUnassigned && (
            <div className="flex items-center pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAddMatchesClick(week!)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Matches
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
