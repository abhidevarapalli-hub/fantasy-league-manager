import { useGameStore } from '@/store/gameStore';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { BottomNav } from '@/components/BottomNav';
import { Activity as ActivityIcon } from 'lucide-react';

const Activity = () => {
  const { activities } = useGameStore();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <ActivityIcon className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Activity Log</h1>
            <p className="text-xs text-muted-foreground">Recent transactions & updates</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <ActivityTimeline activities={activities} />
      </main>

      <BottomNav />
    </div>
  );
};

export default Activity;
