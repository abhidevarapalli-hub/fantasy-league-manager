import { AppLayout } from '@/components/AppLayout';
import { DraftBoard } from '@/components/DraftBoard';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';

const Draft = () => {
  const { loading } = useGame();
  const { isLeagueManager } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AppLayout 
      title="Draft Board" 
      subtitle="8 teams × 14 rounds snake draft"
      headerActions={
        !isLeagueManager ? <Lock className="w-4 h-4 text-muted-foreground" /> : null
      }
    >
      {/* Read-only notice for non-league managers */}
      {!isLeagueManager && (
        <div className="mx-4 mt-4 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            View only - Only the league manager can modify the draft
          </p>
        </div>
      )}

      {/* Draft Content */}
      <div className="px-4 py-4">
        <DraftBoard readOnly={!isLeagueManager} />
      </div>
    </AppLayout>
  );
};

export default Draft;
