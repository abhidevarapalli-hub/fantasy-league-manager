import { AppLayout } from '@/components/AppLayout';
import { DraftBoard } from '@/components/DraftBoard';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Lock } from 'lucide-react';

const Draft = () => {
  const loading = useGameStore(state => state.loading);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());
  const config = useGameStore(state => state.config);
  const totalRounds = config.activeSize + config.benchSize;

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
      subtitle={`${config.managerCount} teams × ${totalRounds} rounds snake draft`}
      headerActions={
        !isLeagueManager ? <Lock className="w-4 h-4 text-muted-foreground" /> : null
      }
    >
      <div className="px-4 py-4 w-full">
        {!isLeagueManager && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              View only - Only the league manager can modify the draft
            </p>
          </div>
        )}
        <DraftBoard readOnly={!isLeagueManager} />
      </div>
    </AppLayout>
  );
};

export default Draft;
