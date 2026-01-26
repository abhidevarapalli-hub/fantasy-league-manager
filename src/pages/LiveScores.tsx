import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Radio, AlertCircle, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLiveMatches, useMatchesByType, useApiConfigured } from '@/hooks/useLiveCricket';
import { CricketMatch } from '@/lib/cricket-types';
import { cn } from '@/lib/utils';

// Match Card Component
function MatchCard({ match }: { match: CricketMatch }) {
  const isLive = match.state === 'Live' || match.state === 'In Progress';
  const isComplete = match.state === 'Complete';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-medium">
            {match.matchFormat}
          </Badge>
          <Badge
            variant={isLive ? 'destructive' : isComplete ? 'secondary' : 'outline'}
            className={cn(
              'text-xs',
              isLive && 'animate-pulse bg-red-500 text-white'
            )}
          >
            {isLive && <Radio className="w-3 h-3 mr-1" />}
            {match.state}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-1">
          {match.seriesName}
        </p>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Team 1 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">
                {match.team1.teamSName.substring(0, 2)}
              </span>
            </div>
            <span className={cn(
              'font-medium truncate',
              match.currentBatTeamId === match.team1.teamId && 'text-primary'
            )}>
              {match.team1.teamName}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            {match.team1.score ? (
              <div>
                <span className="font-bold text-lg">{match.team1.score}</span>
                {match.team1.overs && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({match.team1.overs} ov)
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">
                {match.team2.teamSName.substring(0, 2)}
              </span>
            </div>
            <span className={cn(
              'font-medium truncate',
              match.currentBatTeamId === match.team2.teamId && 'text-primary'
            )}>
              {match.team2.teamName}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            {match.team2.score ? (
              <div>
                <span className="font-bold text-lg">{match.team2.score}</span>
                {match.team2.overs && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({match.team2.overs} ov)
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Match Status */}
        {match.status && (
          <p className="text-sm text-muted-foreground border-t pt-3 mt-3">
            {match.status}
          </p>
        )}

        {/* Venue */}
        <p className="text-xs text-muted-foreground">
          {match.venueInfo.ground}, {match.venueInfo.city}
        </p>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function MatchCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-3 w-40 mt-2" />
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

// Empty State Component
function EmptyState({ type }: { type: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          {type === 'live' ? (
            <Radio className="w-8 h-8 text-muted-foreground" />
          ) : type === 'upcoming' ? (
            <Clock className="w-8 h-8 text-muted-foreground" />
          ) : (
            <Trophy className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="font-semibold text-lg mb-1">
          No {type} matches
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          {type === 'live'
            ? 'There are no live cricket matches at the moment. Check back later!'
            : type === 'upcoming'
            ? 'No upcoming matches scheduled.'
            : 'No recent matches to display.'}
        </p>
      </CardContent>
    </Card>
  );
}

// API Not Configured Warning
function ApiNotConfigured() {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex items-start gap-4 py-6">
        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-destructive mb-1">API Not Configured</h3>
          <p className="text-sm text-muted-foreground mb-3">
            To view live cricket scores, you need to configure your RapidAPI credentials.
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Get a free API key from <a href="https://rapidapi.com/cricketapilive/api/cricbuzz-cricket" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">RapidAPI Cricbuzz Cricket</a></li>
            <li>Add <code className="bg-muted px-1 rounded">VITE_RAPIDAPI_KEY=your_key</code> to your <code className="bg-muted px-1 rounded">.env</code> file</li>
            <li>Restart the development server</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// Matches Grid Component
function MatchesGrid({
  matches,
  isLoading,
  error,
  type,
}: {
  matches: CricketMatch[] | undefined;
  isLoading: boolean;
  error: Error | null;
  type: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-4 py-6">
          <AlertCircle className="w-8 h-8 text-destructive flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive">Error loading matches</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!matches || matches.length === 0) {
    return <EmptyState type={type} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {matches.map((match) => (
        <MatchCard key={match.matchId} match={match} />
      ))}
    </div>
  );
}

// Main Page Component
const LiveScores = () => {
  const navigate = useNavigate();
  const isConfigured = useApiConfigured();
  const [activeTab, setActiveTab] = useState('live');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data for each tab
  const liveQuery = useLiveMatches();
  const recentQuery = useMatchesByType('recent');
  const upcomingQuery = useMatchesByType('upcoming');

  // Get current query based on active tab
  const getCurrentQuery = () => {
    switch (activeTab) {
      case 'live':
        return liveQuery;
      case 'recent':
        return recentQuery;
      case 'upcoming':
        return upcomingQuery;
      default:
        return liveQuery;
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await getCurrentQuery().refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/leagues')}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Live Cricket Scores</h1>
              <p className="text-xs text-muted-foreground">
                Powered by Cricbuzz
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={!isConfigured || isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!isConfigured ? (
          <ApiNotConfigured />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full max-w-md mb-6">
              <TabsTrigger value="live" className="flex-1 gap-2">
                <Radio className="w-4 h-4" />
                Live
                {liveQuery.data && liveQuery.data.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {liveQuery.data.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recent" className="flex-1 gap-2">
                <Trophy className="w-4 h-4" />
                Recent
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 gap-2">
                <Clock className="w-4 h-4" />
                Upcoming
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="mt-0">
              <MatchesGrid
                matches={liveQuery.data}
                isLoading={liveQuery.isLoading}
                error={liveQuery.error}
                type="live"
              />
            </TabsContent>

            <TabsContent value="recent" className="mt-0">
              <MatchesGrid
                matches={recentQuery.data}
                isLoading={recentQuery.isLoading}
                error={recentQuery.error}
                type="recent"
              />
            </TabsContent>

            <TabsContent value="upcoming" className="mt-0">
              <MatchesGrid
                matches={upcomingQuery.data}
                isLoading={upcomingQuery.isLoading}
                error={upcomingQuery.error}
                type="upcoming"
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default LiveScores;
