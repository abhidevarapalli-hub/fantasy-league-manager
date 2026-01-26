import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, Calendar, Trophy, UserPlus, Copy, Check } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useParams } from 'react-router-dom';
import { StandingsTable } from '@/components/StandingsTable';
import { ScheduleList } from '@/components/ScheduleList';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Dashboard = () => {
  const { leagueId } = useParams<{ leagueId: string }>();

  // Zustand selectors - only subscribe to what we need
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const currentWeek = useGameStore(state => state.currentWeek);
  const currentManagerId = useGameStore(state => state.currentManagerId);
  const loading = useGameStore(state => state.loading);
  const leagueName = useGameStore(state => state.leagueName);
  const managerProfile = useAuthStore(state => state.managerProfile);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Find the logged-in user's manager ID
  const loggedInManagerId = managerProfile?.id;

  // Check if there are available slots
  const hasAvailableSlots = useMemo(() => {
    return managers.some(manager => !manager.name || manager.name.startsWith('Manager '));
  }, [managers]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const handleCopyInviteLink = useCallback(() => {
    const inviteUrl = `${window.location.origin}/join/${leagueId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy invite link');
    });
  }, [leagueId]);

  const totalWeeks = useMemo(() => {
    if (!schedule.length) return 7;
    return Math.max(...schedule.map(m => m.week));
  }, [schedule]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout
      title={leagueName}
      subtitle={`Week ${currentWeek} of ${totalWeeks}`}

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

          <TabsContent value="standings" className="mt-0 space-y-4">
            {isLeagueManager && hasAvailableSlots && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    Invite Members
                  </CardTitle>
                  <CardDescription>
                    Share this link to invite users to join your league
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-background/50 border border-primary/20 rounded-lg font-mono text-sm text-muted-foreground overflow-x-auto">
                      {window.location.origin}/join/{leagueId}
                    </div>
                    <Button
                      onClick={handleCopyInviteLink}
                      variant="default"
                      size="sm"
                      className="shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
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
