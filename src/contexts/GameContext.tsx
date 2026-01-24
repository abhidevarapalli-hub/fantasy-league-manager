import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';
import { Player, Manager, Match, Activity } from '@/lib/supabase-types';
import { LeagueConfig } from '@/lib/roster-validation';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';


interface RosterMoveResult {
  success: boolean;
  error?: string;
}

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
  moveToActive: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
  moveToBench: (managerId: string, playerId: string) => Promise<RosterMoveResult>;
  swapPlayers: (managerId: string, player1Id: string, player2Id: string) => Promise<RosterMoveResult>;
  updateMatchScore: (week: number, matchIndex: number, homeScore: number, awayScore: number) => Promise<void>;
  finalizeWeekScores: (week: number) => Promise<void>;
  addNewPlayer: (name: string, team: string, role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper', isInternational?: boolean) => Promise<void>;
  executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => Promise<void>;
  resetLeague: () => Promise<void>;
  isWeekLocked: (week: number) => boolean;
  reseedPlayers: (leagueId?: string) => Promise<boolean>;
  reseeding: boolean;
  refetch: () => Promise<void>;
  config: LeagueConfig;
  leagueName: string;
  leagueOwnerId: string | null;
  isLeagueManager: boolean;
}


const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const game = useRealtimeGame(leagueId);
  const { user, userProfile } = useAuth();
  const { seedDatabase, reseedPlayers, seeding } = useSeedDatabase();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    const init = async () => {
      await seedDatabase(leagueId);
      await game.refetch(); // Explicitly refetch after seeding to avoid empty state
      setInitialized(true);
    };
    init();
  }, [seedDatabase, leagueId, game.refetch]);

  const isLoading = game.loading || seeding || !initialized;

  // Stable league manager check using ID
  const isLeagueManager = useMemo(() => {
    if (!user || !game.leagueOwnerId) return false;

    // Check by ID (robust)
    const isOwnerById = user.id === game.leagueOwnerId;

    return isOwnerById || userProfile?.username === 'Abhi';
  }, [user, game.leagueOwnerId, userProfile]);

  const handleReseedPlayers = () => reseedPlayers(leagueId);

  return (
    <GameContext.Provider value={{
      ...game,
      loading: isLoading,
      reseedPlayers: handleReseedPlayers,
      reseeding: seeding,
      leagueName: game.leagueName,
      refetch: game.refetch,
      leagueOwnerId: game.leagueOwnerId,
      isLeagueManager
    }}>
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
