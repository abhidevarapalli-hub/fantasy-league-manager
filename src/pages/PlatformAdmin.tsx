import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import { GlobalStatsImport } from '@/components/platform-admin/GlobalStatsImport';
import { GlobalPlayerMapping } from '@/components/platform-admin/GlobalPlayerMapping';

const PlatformAdmin = () => {
  const navigate = useNavigate();
  const isLoading = useAuthStore(state => state.isLoading);
  const isPlatformAdmin = useAuthStore(state => state.isPlatformAdmin());

  useEffect(() => {
    if (!isLoading && !isPlatformAdmin) {
      navigate('/leagues', { replace: true });
    }
  }, [isPlatformAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <AppLayout title="Platform Admin" subtitle="Checking credentials...">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-50" />
            <p className="text-muted-foreground font-medium animate-pulse">Verifying Admin Access...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isPlatformAdmin) return null;

  return (
    <AppLayout title="Platform Admin" subtitle="Global match stats management">
      <div className="px-4 py-4 space-y-6">
        <GlobalStatsImport />
        <GlobalPlayerMapping />
      </div>
    </AppLayout>
  );
};

export default PlatformAdmin;
