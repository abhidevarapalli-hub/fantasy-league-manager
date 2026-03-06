import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, UserPlus, Copy, Check, ChevronDown, BookOpen, Settings, Monitor } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
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

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getCountdown(target: Date): CountdownTime {
  const now = new Date();
  const total = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

const Dashboard = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  // Zustand selectors - only subscribe to what we need
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const currentWeek = useGameStore(state => state.currentWeek);
  const currentManagerId = useGameStore(state => state.currentManagerId);
  const loading = useGameStore(state => state.loading);
  const draftState = useGameStore(state => state.draftState);
  const leagueName = useGameStore(state => state.leagueName);
  const draftScheduledAt = useGameStore(state => state.draftScheduledAt);
  const managerProfile = useAuthStore(state => state.managerProfile);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Draft countdown timer
  const draftTarget = useMemo(() => {
    if (!draftScheduledAt) return null;
    return new Date(draftScheduledAt);
  }, [draftScheduledAt]);

  const [countdown, setCountdown] = useState<CountdownTime | null>(
    draftTarget ? getCountdown(draftTarget) : null
  );

  useEffect(() => {
    if (!draftTarget) {
      setCountdown(null);
      return;
    }
    setCountdown(getCountdown(draftTarget));
    const interval = setInterval(() => {
      setCountdown(getCountdown(draftTarget));
    }, 1000);
    return () => clearInterval(interval);
  }, [draftTarget]);

  // Initialize selected week when currentWeek loads
  useEffect(() => {
    // Week 0 = pre-season, no matchups — default to showing Week 1
    const weekToSet = currentWeek === 0 ? 1 : currentWeek;
    setSelectedWeek(weekToSet);
  }, [currentWeek]);

  // Sync store with selected week roster and stats
  const fetchRosterForWeek = useGameStore(state => state.fetchRosterForWeek);
  useEffect(() => {
    if (leagueId && selectedWeek > 0) {
      fetchRosterForWeek(leagueId, selectedWeek);
    }
  }, [leagueId, selectedWeek, fetchRosterForWeek]);

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
  // For finalized matchups, trust stored scores (may have admin overrides)
  // For non-finalized matchups, use recalculated scores for live updates
  const displayMatches = useMemo(() => {
    return schedule.map(match => ({
      ...match,
      homeScore: match.completed && match.homeScore != null
        ? match.homeScore
        : (calculatedScores[match.home] ?? match.homeScore),
      awayScore: match.completed && match.awayScore != null
        ? match.awayScore
        : (calculatedScores[match.away] ?? match.awayScore),
    }));
  }, [schedule, calculatedScores]);

  // Format the draft date/time for display in user's local timezone
  const formattedDraftTime = useMemo(() => {
    if (!draftTarget) return '';
    const dayName = draftTarget.toLocaleDateString('en-US', { weekday: 'short' });
    const month = draftTarget.toLocaleDateString('en-US', { month: 'short' });
    const day = draftTarget.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st'
      : day === 2 || day === 22 ? 'nd'
        : day === 3 || day === 23 ? 'rd' : 'th';
    const time = draftTarget.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const tz = draftTarget.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    return `${dayName}, ${month} ${day}${suffix} @ ${time} ${tz}`;
  }, [draftTarget]);

  const showDraftCountdown = draftTarget && countdown && countdown.total > 0 && !draftState?.isFinalized;

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

        {/* Draft Countdown Card */}
        {showDraftCountdown && (
          <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-background overflow-hidden">
            <CardContent className="pt-6 pb-6">
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <Monitor className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Draftboard</h3>
                    <p className="text-sm text-muted-foreground">{formattedDraftTime}</p>
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-center gap-1 py-3">
                  {[
                    { value: countdown.days, label: 'DAYS' },
                    { value: countdown.hours, label: 'HRS' },
                    { value: countdown.minutes, label: 'MINS' },
                    { value: countdown.seconds, label: 'SECS' },
                  ].map((unit, i) => (
                    <div key={unit.label} className="flex items-center gap-1">
                      {i > 0 && (
                        <span className="text-2xl font-bold text-emerald-400 mx-1">:</span>
                      )}
                      <div className="flex flex-col items-center">
                        <span className="text-4xl md:text-5xl font-extrabold tabular-nums text-emerald-400 leading-none">
                          {String(unit.value).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground tracking-widest mt-1">
                          {unit.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/mock-draft/setup')}
                    className="rounded-full font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 px-6"
                  >
                    MOCK
                  </Button>
                  <Button
                    onClick={() => navigate(`/${leagueId}/draft`)}
                    className="flex-1 rounded-full font-bold bg-transparent border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 hover:text-emerald-300 text-base"
                  >
                    DRAFT ROOM
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invite Card if needed */}
        {isLeagueManager && hasAvailableSlots && (!draftState || draftState.status === 'pre_draft') && (
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

        {/* Scoring Rules CTA - shown before draft is finalized */}
        {!draftState?.isFinalized && (
          isLeagueManager ? (
            <Card className="border-2 border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-500" />
                  Review & Customize Scoring Rules
                </CardTitle>
                <CardDescription>
                  As League Manager, you can modify fantasy point values, strike rate bonuses, economy rate penalties, and more before the draft begins.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate(`/${leagueId}/rules`)}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Review & Edit Rules
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border/50 bg-muted/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                  Scoring Rules
                </CardTitle>
                <CardDescription>
                  Review the scoring rules before the draft to understand how fantasy points are calculated.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/${leagueId}/rules`)}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  View Rules
                </Button>
              </CardContent>
            </Card>
          )
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
