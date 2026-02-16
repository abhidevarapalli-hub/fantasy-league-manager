import { useState } from 'react';
import { UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const LeagueMembers = () => {
  const managers = useGameStore(state => state.managers);
  const leagueOwnerId = useGameStore(state => state.leagueOwnerId);
  const currentLeagueId = useGameStore(state => state.currentLeagueId);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleRemoveMember = async (managerId: string) => {
    if (!managerId || removingMember) return;

    setRemovingMember(managerId);
    try {
      const { data: allManagers, error: fetchError } = await supabase
        .from('managers')
        .select('id, created_at')
        .eq('league_id', currentLeagueId ?? '')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      const managerIndex = allManagers?.findIndex((m) => m.id === managerId) || 0;
      const placeholderIndex = managerIndex + 1;

      const { error: updateError } = await supabase
        .from('managers')
        .update({
          user_id: null,
          name: `Manager ${placeholderIndex}`,
          team_name: `Empty Team ${placeholderIndex}`,
        })
        .eq('id', managerId);

      if (updateError) throw updateError;

      toast.success('Member removed successfully');
    } catch (error: unknown) {
      toast.error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRemovingMember(null);
    }
  };

  const activeMembers = managers.filter(manager => {
    const hasUserId = manager.name && !manager.name.startsWith('Manager ');
    return hasUserId;
  });

  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">League Members</h2>
      </div>

      <div className="space-y-3">
        {activeMembers.map(manager => {
          const isOwner = manager.userId === leagueOwnerId;

          return (
            <div
              key={manager.id}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-foreground">{manager.name}</p>
                    <p className="text-sm text-muted-foreground">{manager.teamName}</p>
                  </div>
                  {isOwner && (
                    <Badge variant="default" className="text-xs">
                      League Manager
                    </Badge>
                  )}
                </div>
              </div>
              {!isOwner && (
                <Button
                  onClick={() => handleRemoveMember(manager.id)}
                  disabled={removingMember === manager.id}
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                >
                  {removingMember === manager.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
        {activeMembers.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No members have joined yet. Share the invite link to get started!
          </div>
        )}
      </div>
    </section>
  );
};
