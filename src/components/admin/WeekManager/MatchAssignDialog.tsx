import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UnassignedMatch {
  match_id: string;
  match_title: string;
  match_date: string;
}

interface MatchAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  targetWeek: number;
  unassignedMatches: UnassignedMatch[];
  onAssigned: () => void;
}

export const MatchAssignDialog = ({
  open,
  onOpenChange,
  leagueId,
  targetWeek,
  unassignedMatches,
  onAssigned,
}: MatchAssignDialogProps) => {
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  const toggleMatch = (matchId: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedMatchIds.size === 0) return;

    setIsAssigning(true);
    try {
      const assignments = Array.from(selectedMatchIds).map((match_id) => ({
        match_id,
        week: targetWeek,
      }));

      const { error } = await supabase.rpc('bulk_update_match_weeks', {
        p_league_id: leagueId,
        p_assignments: assignments,
      });

      if (error) {
        toast.error(`Failed to assign matches: ${error.message}`);
        return;
      }

      toast.success(`${selectedMatchIds.size} match(es) assigned to Week ${targetWeek}`);
      setSelectedMatchIds(new Set());
      onOpenChange(false);
      onAssigned();
    } catch {
      toast.error('Failed to assign matches');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedMatchIds(new Set());
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Matches to Week {targetWeek}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {unassignedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No unassigned matches available
            </p>
          ) : (
            unassignedMatches.map((match) => (
              <label
                key={match.match_id}
                className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedMatchIds.has(match.match_id)}
                  onCheckedChange={() => toggleMatch(match.match_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{match.match_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(match.match_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || selectedMatchIds.size === 0}>
            {isAssigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add {selectedMatchIds.size || ''} Match{selectedMatchIds.size !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
