import { useState, useCallback } from 'react';
import { RefreshCw, Calendar, Trophy } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { StandingsTable } from '@/components/StandingsTable';
import { ScheduleList } from '@/components/ScheduleList';
import { BottomNav } from '@/components/BottomNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { managers, schedule, currentWeek, currentManagerId } = useGameStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div>
            <h1 className="text-lg font-bold text-foreground">Premier League Manager</h1>
            <p className="text-xs text-muted-foreground">Week {currentWeek} of 7</p>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              isRefreshing && "animate-spin text-primary"
            )} />
          </button>
        </div>
      </header>

      <main className="px-4 py-4">
        <Tabs defaultValue="standings" className="w-full">
          <TabsList className="w-full bg-muted/50 p-1 rounded-xl mb-4">
            <TabsTrigger 
              value="standings" 
              className="flex-1 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground rounded-lg"
            >
              <Trophy className="w-4 h-4" />
              Standings
            </TabsTrigger>
            <TabsTrigger 
              value="schedule"
              className="flex-1 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground rounded-lg"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standings" className="mt-0">
            <StandingsTable managers={managers} currentManagerId={currentManagerId} />
          </TabsContent>
          
          <TabsContent value="schedule" className="mt-0">
            <ScheduleList schedule={schedule} managers={managers} currentWeek={currentWeek} />
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
