import { BottomNav } from '@/components/BottomNav';
import { DraftBoard } from '@/components/DraftBoard';
import { useGame } from '@/contexts/GameContext';

const Draft = () => {
  const { loading } = useGame();

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
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Draft Board</h1>
          <p className="text-sm text-muted-foreground">8 teams × 14 rounds snake draft</p>
        </div>
      </header>

      {/* Draft Content */}
      <main className="px-4 py-4">
        <DraftBoard />
      </main>

      <BottomNav />
    </div>
  );
};

export default Draft;
