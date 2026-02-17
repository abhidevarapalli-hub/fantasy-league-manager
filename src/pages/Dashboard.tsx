import { useState, useCallback, useMemo, useEffect } from 'react';
import { RefreshCw, UserPlus, Copy, Check, ChevronDown } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useParams } from 'react-router-dom';
import { StandingsTable } from '@/components/StandingsTable';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWeeklyScores } from '@/hooks/useWeeklyScores';

const Dashboard = () => {
  const { leagueId } = useParams<{ leagueId: string }>();

  // Zustand selectors - only subscribe to what we need
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const currentWeek = useGameStore(state => state.currentWeek);
  const currentManagerId = useGameStore(state => state.currentManagerId);
  const loading = useGameStore(state => state.loading);
  const draftState = useGameStore(state => state.draftState);
  const leagueName = useGameStore(state => state.leagueName);
  const managerProfile = useAuthStore(state => state.managerProfile);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Initialize selected week when currentWeek loads
  useEffect(() => {
    // Week 0 = pre-season, no matchups — default to showing Week 1
    setSelectedWeek(currentWeek === 0 ? 1 : currentWeek);
  }, [currentWeek]);

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

  // Fetch calculated scores for the selected week
  const { scores: calculatedScores } = useWeeklyScores(leagueId || null, selectedWeek, managers);

  // Merge calculated scores into the schedule
  const displayMatches = useMemo(() => {
    return schedule.map(match => ({
      ...match,
      homeScore: calculatedScores[match.home] ?? match.homeScore,
      awayScore: calculatedScores[match.away] ?? match.awayScore
    }));
  }, [schedule, calculatedScores]);

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
      subtitle={currentWeek === 0 ? 'Pre-Season' : `Week ${currentWeek} of ${totalWeeks}`}
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
      <div className="px-4 py-6 space-y-8">

        {/* Invite Card if needed */}
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

        {/* Schedule Section */}
        {draftState?.isFinalized && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Matchups</h2>
              <Select
                value={selectedWeek.toString()}
                onValueChange={(val) => setSelectedWeek(parseInt(val))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder={`Week ${selectedWeek}`} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                      {week === currentWeek && " (Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScheduleGrid
              matches={displayMatches}
              managers={managers}
              selectedWeek={selectedWeek}
            />
          </section>
        )}

        {/* Standings Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Standings</h2>
          <StandingsTable
            managers={managers}
            currentManagerId={currentManagerId}
            loggedInManagerId={loggedInManagerId}
          />
        </section>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
