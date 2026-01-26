import { LogOut, RefreshCw, Shield, LayoutGrid } from 'lucide-react';

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

export const UserMenu = () => {
  const managerProfile = useAuthStore(state => state.managerProfile);
  const userProfile = useAuthStore(state => state.userProfile);
  const signOut = useAuthStore(state => state.signOut);
  const authLoading = useAuthStore(state => state.isLoading);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());
  const gameLoading = useGameStore(state => state.loading);
  const navigate = useNavigate();
  const { leagueId } = useParams();

  // If we're loading either auth or game data, show a subtle loading state
  if (authLoading || (leagueId && gameLoading && !managerProfile)) {
    return (
      <div className="h-9 px-3 flex items-center justify-center rounded-full border border-border/50 opacity-50">
        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!managerProfile && !userProfile) return null;

  const displayName = managerProfile?.name || userProfile?.username || 'User';
  const displayTeam = managerProfile?.teamName || '';


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-3 hover:bg-muted/50 rounded-full border border-border/50">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs font-bold text-foreground">{displayName}</span>
            {displayTeam && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{displayTeam}</span>
            )}
          </div>
          {isLeagueManager && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-primary/10 text-primary border-primary/30">
              LM
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-2 shadow-xl border-border">
        <DropdownMenuLabel className="font-normal italic">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold leading-none">{displayTeam || displayName}</p>
            <p className="text-[10px] leading-none text-muted-foreground uppercase tracking-tighter">
              {isLeagueManager ? 'League Manager' : 'Team Manager'}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {leagueId && (
          <>
            <DropdownMenuItem onClick={() => navigate('/leagues')} className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Switch League
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

