import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

// Legacy password verification for manager claiming
// This is used only once to verify identity when linking a user to a manager
const LEGACY_MANAGER_CREDENTIALS: Record<string, string> = {
  'Akash': 'MorneMorkel',
  'Krithik': 'SaeedAjmal',
  'Vamsi': 'TamimIqbal',
  'Krishna': 'RaviBopara',
  'Jasthi': 'BradHaddin',
  'Santosh': 'RossTaylor',
  'Sahith': 'MarlonSamuels',
  'Abhi': 'Dilshan',
};

interface ManagerProfile {
  id: string;
  name: string;
  is_league_manager: boolean;
  user_id: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  managerProfile: ManagerProfile | null;
  isLoading: boolean;
  signOut: () => Promise<{ error: any }>;
  verifyLegacyPassword: (managerName: string, password: string) => boolean;
  selectManager: (managerName: string) => Promise<void>;
  isLeagueManager: boolean;
  canEditTeam: (teamId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchManagerProfileByName = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('name', name)
        .maybeSingle();

      if (error) {
        console.error('Error fetching manager profile:', error);
      }

      setManagerProfile(data);
    } catch (e) {
      console.error('Unexpected error fetching profile:', e);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      const savedManager = localStorage.getItem('selected_manager');
      if (session?.user && savedManager) {
        fetchManagerProfileByName(savedManager);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const savedManager = localStorage.getItem('selected_manager');
        if (savedManager) {
          fetchManagerProfileByName(savedManager);
        }
      } else {
        setManagerProfile(null);
        localStorage.removeItem('selected_manager');
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem('selected_manager');
    setManagerProfile(null);
    return await supabase.auth.signOut();
  };

  const verifyLegacyPassword = (managerName: string, password: string): boolean => {
    const correctPassword = LEGACY_MANAGER_CREDENTIALS[managerName];
    return correctPassword === password;
  };

  const selectManager = async (managerName: string) => {
    localStorage.setItem('selected_manager', managerName);
    await fetchManagerProfileByName(managerName);
  };

  const canEditTeam = (teamId: string) => {
    if (!managerProfile) return false;
    if (managerProfile.is_league_manager || managerProfile.name === 'Abhi') return true;
    return managerProfile.id === teamId;
  };

  const isLeagueManager = (managerProfile?.is_league_manager ?? false) || managerProfile?.name === 'Abhi';

  const value = {
    session,
    user: session?.user ?? null,
    managerProfile,
    isLoading,
    signOut,
    verifyLegacyPassword,
    selectManager,
    isLeagueManager,
    canEditTeam,
  };

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

// Export manager names for the claiming dropdown
export const MANAGER_NAMES = Object.keys(LEGACY_MANAGER_CREDENTIALS);
