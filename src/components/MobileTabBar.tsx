import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();
  const draftState = useGameStore(state => state.draftState);
  const currentManagerId = useGameStore(state => state.currentManagerId);

  // Only show within a league context
  if (!leagueId) return null;

  const isDraftFinalized = draftState?.isFinalized ?? false;

  const preDraftTabs = [
    { label: 'LEAGUE', path: `/${leagueId}` },
    { label: 'PLAYERS', path: `/${leagueId}/players` },
    { label: 'DRAFT', path: `/${leagueId}/draft` },
    { label: 'RULES', path: `/${leagueId}/rules` },
  ];

  const postDraftTabs = [
    { label: 'MATCHUP', path: `/${leagueId}/matchup` },
    { label: 'LEAGUE', path: `/${leagueId}` },
    { label: 'MY TEAM', path: currentManagerId ? `/${leagueId}/team/${currentManagerId}` : `/${leagueId}` },
    { label: 'PLAYERS', path: `/${leagueId}/players` },
  ];

  const tabs = isDraftFinalized ? postDraftTabs : preDraftTabs;

  const isActive = (tabPath: string) => {
    const currentPath = location.pathname;
    // Exact match
    if (currentPath === tabPath) return true;
    // For league home tab, also match team view paths (when not on My Team specifically)
    if (tabPath === `/${leagueId}` && currentPath.startsWith(`/${leagueId}/team/`) && !isDraftFinalized) return true;
    return false;
  };

  return (
    <nav className="md:hidden bg-background border-b border-border">
      <div className="flex">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 relative py-3 text-xs font-semibold tracking-wider transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {tab.label}
              {/* Active underline indicator */}
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
