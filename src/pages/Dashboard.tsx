import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, Calendar, Trophy } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { StandingsTable } from '@/components/StandingsTable';
import { ScheduleList } from '@/components/ScheduleList';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { managers, schedule, currentWeek, currentManagerId, loading } = useGame();
  const { managerProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find the logged-in user's manager ID
  const loggedInManagerId = managerProfile?.id;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout
      title="Premier League Manager"
      subtitle={`Week ${currentWeek} of 7`}
      headerActions={
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isRefreshing && "animate-spin text-primary"
          )} />
        </button>
      }
    >
      <div className="px-4 py-4">
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
            <StandingsTable managers={managers} currentManagerId={currentManagerId} loggedInManagerId={loggedInManagerId} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <ScheduleList schedule={schedule} managers={managers} currentWeek={currentWeek} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
