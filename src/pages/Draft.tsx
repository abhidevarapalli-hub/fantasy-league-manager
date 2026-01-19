import { BottomNav } from '@/components/BottomNav';
import { UserMenu } from '@/components/UserMenu';
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Draft Board</h1>
              {!isLeagueManager && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">8 teams × 14 rounds snake draft</p>
          </div>
          <UserMenu />
        </div>
      </header>

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
      <main className="px-4 py-4">
        <DraftBoard readOnly={!isLeagueManager} />
      </main>

      <BottomNav />
    </div>
  );
};

export default Draft;
