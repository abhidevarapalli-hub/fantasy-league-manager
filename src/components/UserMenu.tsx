import { useState, useEffect } from 'react';
import { LogOut, RefreshCw, Shield, LayoutGrid, ChevronDown, Check } from 'lucide-react';

import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';

import { useNavigate, useParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface UserTeam {
  leagueId: string;
  leagueName: string;
  teamId: string;
  teamName: string;
  isLeagueManager: boolean;
}

export const UserMenu = () => {
  const managerProfile = useAuthStore(state => state.managerProfile);
  const userProfile = useAuthStore(state => state.userProfile);
  const signOut = useAuthStore(state => state.signOut);
  const authLoading = useAuthStore(state => state.isLoading);
  const gameLoading = useGameStore(state => state.loading);
  const navigate = useNavigate();
  const { leagueId } = useParams();

  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    const fetchUserTeams = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      setLoadingTeams(true);
      try {
        const { data, error } = await supabase
          .from('managers')
          .select(`
            id,
            team_name,
            is_league_manager,
            league_id,
            leagues (
              name
            )
          `)
          .eq('user_id', user.id);

        if (!error && data) {
          const mapped: UserTeam[] = data.map((m: any) => ({
            teamId: m.id,
            teamName: m.team_name,
            isLeagueManager: m.is_league_manager,
            leagueId: m.league_id,
            leagueName: m.leagues?.name || 'Unknown League'
          }));
          setUserTeams(mapped);
        }
      } catch (err) {
        console.error('Error fetching user teams:', err);
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchUserTeams();
  }, []);

  // If we're loading either auth or game data, show a subtle loading state
  if (authLoading || (leagueId && gameLoading && !managerProfile)) {
    return (
      <div className="h-9 px-3 flex items-center justify-center rounded-full border border-border/50 opacity-50">
        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!managerProfile && !userProfile) return null;

  const currentTeam = userTeams.find(t => t.leagueId === leagueId);
  const displayName = userProfile?.username || managerProfile?.name || 'User';
  const displayLabel = leagueId && currentTeam ? currentTeam.teamName : displayName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-3 hover:bg-muted/50 rounded-full border border-border/50 transition-all active:scale-95">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {displayLabel.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{displayLabel}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
          {currentTeam?.isLeagueManager && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-primary/10 text-primary border-primary/30 shrink-0">
              LM
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 mt-2 shadow-xl border-border p-1">
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Your Teams</p>
            {loadingTeams ? (
              <div className="flex items-center gap-2 py-2 px-1">
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground italic">Loading teams...</span>
              </div>
            ) : userTeams.length > 0 ? (
              <div className="space-y-1 py-1">
                {userTeams.map(team => (
                  <button
                    key={team.teamId}
                    onClick={() => navigate(`/${team.leagueId}`)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between group",
                      team.leagueId === leagueId
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{team.teamName}</span>
                      <span className="text-[10px] text-muted-foreground truncate group-hover:text-foreground/70">
                        {team.leagueName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {team.isLeagueManager && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-transparent border-primary/30 text-primary opacity-70">
                          LM
                        </Badge>
                      )}
                      {team.leagueId === leagueId && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-1 py-1 italic">No teams joined yet</p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate('/leagues')} className="gap-2 text-xs">
          <LayoutGrid className="w-4 h-4" />
          All Leagues
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive gap-2 text-xs">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

