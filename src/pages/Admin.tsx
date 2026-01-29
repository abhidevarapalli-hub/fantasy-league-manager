import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import {
  ScoreInput,
  AddNewPlayer,
  RemovePlayer,
  RosterManagement,
  TradeHub,
  LeagueMembers,
  DangerZone,
  RosterConfig,
} from '@/components/admin';

const Admin = () => {
  const navigate = useNavigate();
  const loading = useGameStore(state => state.loading);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());

  // If not league manager, redirect home
  useEffect(() => {
    if (!loading && !isLeagueManager) {
      navigate('/');
    }
  }, [isLeagueManager, loading, navigate]);

  if (loading) {
    return (
      <AppLayout title="League Manager Settings" subtitle="Checking credentials...">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-50" />
            <p className="text-muted-foreground font-medium animate-pulse">Verifying League Ownership...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="League Manager Settings" subtitle="League management tools">
      <div className="px-4 py-4 space-y-6">
        <ScoreInput />
        <RosterConfig />
        <AddNewPlayer />
        <RemovePlayer />
        <RosterManagement />
        <TradeHub />
        <LeagueMembers />
        <DangerZone />
      </div>
    </AppLayout>
  );
};

export default Admin;
