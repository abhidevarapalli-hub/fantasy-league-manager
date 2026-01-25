import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';


interface ManagerProfile {

  id: string;
  name: string;
  teamName: string;
  is_league_manager: boolean;
  user_id: string | null;
  league_id: string;
}


interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  managerProfile: ManagerProfile | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signOut: () => Promise<{ error: any }>;
  selectManager: (managerName: string, leagueId?: string) => Promise<void>;
  isLeagueManager: boolean;
  canEditTeam: (teamId: string) => boolean;
  fetchManagerProfile: (name: string, leagueId?: string) => Promise<void>;
  updateUsername: (username: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async (u?: User) => {
    const currentUser = u || session?.user;
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    try {
      const { data, error } = await (supabase
        .from('profiles' as any)
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle() as any);

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        setUserProfile(data as UserProfile);
      } else {
        // If no profile exists yet, create one
        const { data: newProfile, error: insertError } = await (supabase
          .from('profiles' as any)
          .insert({ id: currentUser.id })
          .select()
          .maybeSingle() as any);

        if (!insertError && newProfile) {
          setUserProfile(newProfile as UserProfile);
        }
      }
    } catch (e) {
      console.error('Failed to refresh user profile:', e);
    }
  }, [session?.user]);

  const updateUsername = useCallback(async (username: string) => {
    if (!session?.user) return { error: new Error('Not authenticated') };

    const { error } = await (supabase
      .from('profiles' as any)
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', session.user.id) as any);

    if (!error) {
      await refreshProfile();
    }
    return { error };
  }, [session?.user, refreshProfile]);

  const fetchManagerProfile = useCallback(async (name?: string, leagueId?: string) => {
    if (!leagueId) return;

    const currentUser = session?.user;

    try {
      let query = supabase.from('managers').select('*');
      query = (query as any).eq('league_id', leagueId);

      // Map database row to ManagerProfile interface
      const mapResult = (data: any) => ({
        ...data,
        teamName: data.team_name
      });

      // Try by user_id first
      if (currentUser) {
        const { data: userLinkedData } = await (query.eq('user_id', currentUser.id) as any).maybeSingle();
        if (userLinkedData) {
          setManagerProfile(mapResult(userLinkedData));
          return;
        }
      }

      // Fallback to name-based
      if (name) {
        const { data, error } = await (query.eq('name', name) as any).maybeSingle();
        if (error) {
          console.error('Error fetching manager profile by name:', error);
        } else if (data) {
          setManagerProfile(mapResult(data));
          if (currentUser && !data.user_id) {
            await supabase.from('managers').update({ user_id: currentUser.id }).eq('id', data.id);
          }
        }
      }

    } catch (e) {
      console.error('Unexpected error fetching profile:', e);
    }
  }, [session?.user]);

  useEffect(() => {
    let mounted = true;

    // Fast resolution: set isLoading to false as soon as we have the session
    // and let the profiles fetch in the background.
    async function initialize() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(initialSession);
        // Fire and forget profile refresh to avoid blocking the UI
        if (initialSession) {
          refreshProfile(initialSession.user);
        }
      } catch (err) {
        console.error("Critical auth init error:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      if (currentSession) {
        refreshProfile(currentSession.user);
      } else {
        setManagerProfile(null);
        setUserProfile(null);
        localStorage.removeItem('selected_manager');
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Remove refreshProfile from here to break the loop


  const signOut = useCallback(async () => {
    localStorage.removeItem('selected_manager');
    setManagerProfile(null);
    setUserProfile(null);
    return await supabase.auth.signOut();
  }, []);

  const selectManager = useCallback(async (managerName: string, leagueId?: string) => {
    localStorage.setItem('selected_manager', managerName);
    if (leagueId) {
      await fetchManagerProfile(managerName, leagueId);
    }
  }, [fetchManagerProfile]);

  const canEditTeam = useCallback((teamId: string) => {
    if (!managerProfile) return false;
    // Admins can edit any team
    if (managerProfile.is_league_manager || managerProfile.name === 'Abhi') return true;
    return managerProfile.id === teamId;
  }, [managerProfile]);

  const isLeagueManager = (managerProfile?.is_league_manager ?? false) || managerProfile?.name === 'Abhi';

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    managerProfile,
    userProfile,
    isLoading,
    signOut,
    selectManager,
    isLeagueManager,
    canEditTeam,
    fetchManagerProfile,
    updateUsername,
    refreshProfile,
  }), [
    session,
    managerProfile,
    userProfile,
    isLoading,
    signOut,
    selectManager,
    isLeagueManager,
    canEditTeam,
    fetchManagerProfile,
    updateUsername,
    refreshProfile
  ]);


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
