import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, TrendingUp, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoricalRecord {
  id: string;
  manager_id: string;
  championships: number;
  top_3_finishes: number;
  historical_wins: number;
  historical_losses: number;
}

interface HeadToHead {
  id: string;
  manager1_id: string;
  manager2_id: string;
  manager1_wins: number;
  manager2_wins: number;
}

interface CombinedRecord {
  id: string;
  name: string;
  championships: number;
  top3Finishes: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
  isActive: boolean;
}

const LeagueHistory = () => {
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const userProfile = useAuthStore(state => state.userProfile);
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalRecord[]>([]);
  const [headToHead, setHeadToHead] = useState<HeadToHead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [recordsRes, h2hRes] = await Promise.all([
        supabase.from('historical_records').select('*'),
        supabase.from('head_to_head').select('*')
      ]);

      if (recordsRes.data) setHistoricalRecords(recordsRes.data);
      if (h2hRes.data) setHeadToHead(h2hRes.data);
      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime updates
    const recordsChannel = supabase
      .channel('historical_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historical_records' }, () => {
        fetchData();
      })
      .subscribe();

    const h2hChannel = supabase
      .channel('head_to_head_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'head_to_head' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(recordsChannel);
      supabase.removeChannel(h2hChannel);
    };
  }, []);

  // Build a combined list of all manager IDs/names from active managers + historical records
  const allManagerEntries = (() => {
    const map = new Map<string, string>(); // id -> name
    managers.forEach(m => map.set(m.id, m.name));
    // Historical records reference manager_id, resolve name via managers
    historicalRecords.forEach(r => {
      if (r.manager_id && !map.has(r.manager_id)) {
        const m = managers.find(mgr => mgr.id === r.manager_id);
        map.set(r.manager_id, m?.name || r.manager_id);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

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

  // Combine historical + current season records
  const getCombinedRecords = (): CombinedRecord[] => {
    const activeManagerIds = new Set(managers.map(m => m.id));

    return allManagerEntries.map(({ id, name }) => {
      const historical = historicalRecords.find(r => r.manager_id === id);
      const current = getCurrentSeasonRecord(id);
      const isActive = activeManagerIds.has(id);

      const totalWins = (historical?.historical_wins || 0) + current.wins;
      const totalLosses = (historical?.historical_losses || 0) + current.losses;
      const totalGames = totalWins + totalLosses;

      return {
        id,
        name,
        championships: historical?.championships || 0,
        top3Finishes: historical?.top_3_finishes || 0,
        totalWins,
        totalLosses,
        winPct: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
        isActive
      };
    }).sort((a, b) => {
      // Sort by championships desc, then top 3 desc, then win % desc
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.top3Finishes !== a.top3Finishes) return b.top3Finishes - a.top3Finishes;
      return b.winPct - a.winPct;
    });
  };

  // Get combined H2H record (historical + current) by manager ID
  const getCombinedH2H = (manager1Id: string, manager2Id: string): { wins: number; losses: number } => {
    if (manager1Id === manager2Id) return { wins: 0, losses: 0 };

    // Find historical record
    let historicalWins = 0;
    let historicalLosses = 0;

    const record = headToHead.find(
      h => (h.manager1_id === manager1Id && h.manager2_id === manager2Id) ||
        (h.manager1_id === manager2Id && h.manager2_id === manager1Id)
    );

    if (record) {
      if (record.manager1_id === manager1Id) {
        historicalWins = record.manager1_wins;
        historicalLosses = record.manager2_wins;
      } else {
        historicalWins = record.manager2_wins;
        historicalLosses = record.manager1_wins;
      }
    }

    // Add current season
    const currentH2H = getCurrentSeasonH2H();
    const currentRecord = currentH2H.get(manager1Id)?.get(manager2Id) || { wins: 0, losses: 0 };

    return {
      wins: historicalWins + currentRecord.wins,
      losses: historicalLosses + currentRecord.losses
    };
  };

  const combinedRecords = getCombinedRecords();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout title="League History" subtitle="All-time records across seasons">
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
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-[10px]">Champs</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <Medal className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px]">Top 3</span>
                      </div>
                    </TableHead>
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
                  {combinedRecords.map((record, index) => (
                    <TableRow
                      key={record.name}
                      className={cn(
                        !record.isActive && "opacity-60",
                        record.name === userProfile?.username && "bg-secondary/10 border-l-2 border-l-secondary"
                      )}
                    >
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.name}
                        {!record.isActive && (
                          <span className="text-[10px] text-muted-foreground ml-1">(inactive)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-semibold",
                          record.championships > 0 && "text-yellow-500"
                        )}>
                          {record.championships}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-semibold",
                          record.top3Finishes > 0 && "text-amber-600"
                        )}>
                          {record.top3Finishes}
                        </span>
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
                    {allManagerEntries.map(entry => (
                      <TableHead
                        key={entry.id}
                        className="text-center text-xs font-semibold min-w-[60px] px-1"
                      >
                        {entry.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allManagerEntries.map(rowEntry => (
                    <TableRow
                      key={rowEntry.id}
                      className={cn(rowEntry.name === userProfile?.username && "bg-secondary/10")}
                    >
                      <TableCell className={cn(
                        "sticky left-0 z-10 font-semibold text-xs",
                        rowEntry.name === userProfile?.username ? "bg-secondary/10 border-l-2 border-l-secondary" : "bg-card"
                      )}>
                        {rowEntry.name}
                      </TableCell>
                      {allManagerEntries.map(colEntry => {
                        if (rowEntry.id === colEntry.id) {
                          return (
                            <TableCell key={colEntry.id} className="text-center text-muted-foreground">
                              —
                            </TableCell>
                          );
                        }
                        const record = getCombinedH2H(rowEntry.id, colEntry.id);
                        return (
                          <TableCell
                            key={colEntry.id}
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
