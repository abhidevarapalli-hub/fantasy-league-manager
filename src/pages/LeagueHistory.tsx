import { AppLayout } from '@/components/AppLayout';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, TrendingUp, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CombinedRecord {
  id: string;
  name: string;
  totalWins: number;
  totalLosses: number;
  winPct: number;
}

const LeagueHistory = () => {
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const userProfile = useAuthStore(state => state.userProfile);

  // Calculate current season wins from finalized matches
  const getCurrentSeasonRecord = (managerId: string): { wins: number; losses: number } => {
    const manager = managers.find(m => m.id === managerId);
    if (!manager) return { wins: 0, losses: 0 };
    return { wins: manager.wins, losses: manager.losses };
  };

  // Calculate current season H2H from finalized matches (by ID)
  const getCurrentSeasonH2H = (): Map<string, Map<string, { wins: number; losses: number }>> => {
    const h2hMap = new Map<string, Map<string, { wins: number; losses: number }>>();

    // Initialize map for all managers
    managers.forEach(m => {
      h2hMap.set(m.id, new Map());
    });

    // Process finalized matches
    schedule.filter(match => match.completed).forEach(match => {
      if (match.homeScore === undefined || match.awayScore === undefined) return;

      const homeId = match.home;
      const awayId = match.away;
      if (!h2hMap.has(homeId) || !h2hMap.has(awayId)) return;

      const homeWins = match.homeScore > match.awayScore;

      // Update home manager's record vs away
      const homeVsAway = h2hMap.get(homeId)?.get(awayId) || { wins: 0, losses: 0 };
      homeVsAway.wins += homeWins ? 1 : 0;
      homeVsAway.losses += homeWins ? 0 : 1;
      h2hMap.get(homeId)?.set(awayId, homeVsAway);

      // Update away manager's record vs home
      const awayVsHome = h2hMap.get(awayId)?.get(homeId) || { wins: 0, losses: 0 };
      awayVsHome.wins += homeWins ? 0 : 1;
      awayVsHome.losses += homeWins ? 1 : 0;
      h2hMap.get(awayId)?.set(homeId, awayVsHome);
    });

    return h2hMap;
  };

  const getRecords = (): CombinedRecord[] => {
    return managers.map(m => {
      const current = getCurrentSeasonRecord(m.id);
      const totalGames = current.wins + current.losses;

      return {
        id: m.id,
        name: m.name,
        totalWins: current.wins,
        totalLosses: current.losses,
        winPct: totalGames > 0 ? Math.round((current.wins / totalGames) * 100) : 0,
      };
    }).sort((a, b) => {
      return b.winPct - a.winPct;
    });
  };

  const getH2H = (manager1Id: string, manager2Id: string): { wins: number; losses: number } => {
    if (manager1Id === manager2Id) return { wins: 0, losses: 0 };
    const currentH2H = getCurrentSeasonH2H();
    return currentH2H.get(manager1Id)?.get(manager2Id) || { wins: 0, losses: 0 };
  };

  const records = getRecords();

  return (
    <AppLayout title="League History" subtitle="Season records">
      <div className="px-4 py-4">
        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overall">Overall Rankings</TabsTrigger>
            <TabsTrigger value="h2h">Head to Head</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px]">
                      <User className="w-4 h-4" />
                    </TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-[10px]">Win %</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <Calendar className="w-4 h-4" />
                        <span className="text-[10px]">Record</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow
                      key={record.id}
                      className={cn(
                        record.name === userProfile?.username && "bg-secondary/10 border-l-2 border-l-secondary"
                      )}
                    >
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.name}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {record.winPct}%
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {record.totalWins}-{record.totalLosses}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="h2h" className="mt-4">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[80px]"></TableHead>
                    {managers.map(m => (
                      <TableHead
                        key={m.id}
                        className="text-center text-xs font-semibold min-w-[60px] px-1"
                      >
                        {m.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map(rowManager => (
                    <TableRow
                      key={rowManager.id}
                      className={cn(rowManager.name === userProfile?.username && "bg-secondary/10")}
                    >
                      <TableCell className={cn(
                        "sticky left-0 z-10 font-semibold text-xs",
                        rowManager.name === userProfile?.username ? "bg-secondary/10 border-l-2 border-l-secondary" : "bg-card"
                      )}>
                        {rowManager.name}
                      </TableCell>
                      {managers.map(colManager => {
                        if (rowManager.id === colManager.id) {
                          return (
                            <TableCell key={colManager.id} className="text-center text-muted-foreground">
                              —
                            </TableCell>
                          );
                        }
                        const record = getH2H(rowManager.id, colManager.id);
                        return (
                          <TableCell
                            key={colManager.id}
                            className={cn(
                              "text-center text-xs font-medium whitespace-nowrap",
                              record.wins > record.losses && "text-green-600",
                              record.wins < record.losses && "text-red-500"
                            )}
                          >
                            {record.wins} - {record.losses}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Row manager's record vs column manager
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default LeagueHistory;
