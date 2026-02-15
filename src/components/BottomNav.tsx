import { LayoutDashboard, Users, UsersRound, Activity, Settings, ClipboardList, History, ArrowLeftRight } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());

  // Only show bottom nav if we're in a league
  if (!leagueId) return null;

  const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: `/${leagueId}` },
    { icon: UsersRound, label: 'Players', path: `/${leagueId}/players` },
    { icon: ArrowLeftRight, label: 'Trades', path: `/${leagueId}/trades` },
    { icon: Activity, label: 'Activity', path: `/${leagueId}/activity` },
    { icon: ClipboardList, label: 'Draft', path: `/${leagueId}/draft` },
    // Only show Admin tab for league managers
    ...(isLeagueManager ? [{ icon: Settings, label: 'Admin', path: `/${leagueId}/admin` }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === `/${leagueId}` && location.pathname.startsWith(`/${leagueId}/team/`));

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-all",
                isActive && "scale-110"
              )} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
};
