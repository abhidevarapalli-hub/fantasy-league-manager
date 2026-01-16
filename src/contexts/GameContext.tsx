import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';
import { Player, Manager, Match, Activity, PlayerTransaction } from '@/lib/supabase-types';

interface GameContextType {
  players: Player[];
  managers: Manager[];
  schedule: Match[];
  activities: Activity[];
  loading: boolean;
  currentWeek: number;
  currentManagerId: string;
  setCurrentManagerId: (id: string) => void;
  getFreeAgents: () => Player[];
  getManagerRosterCount: (managerId: string) => number;
  addFreeAgent: (managerId: string, playerId: string, dropPlayerId?: string) => Promise<void>;
  dropPlayerOnly: (managerId: string, playerId: string) => Promise<void>;
  moveToActive: (managerId: string, playerId: string) => Promise<void>;
  moveToBench: (managerId: string, playerId: string) => Promise<void>;
  updateMatchScore: (week: number, matchIndex: number, homeScore: number, awayScore: number) => Promise<void>;
  finalizeWeekScores: (week: number) => Promise<void>;
  addNewPlayer: (name: string, team: string, role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper') => Promise<void>;
  executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => Promise<void>;
  resetLeague: () => Promise<void>;
  isWeekLocked: (week: number) => boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const game = useRealtimeGame();
  const { seedDatabase, seeding } = useSeedDatabase();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await seedDatabase();
      setInitialized(true);
    };
    init();
  }, [seedDatabase]);

  const isLoading = game.loading || seeding || !initialized;

  return (
    <GameContext.Provider value={{ ...game, loading: isLoading }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
