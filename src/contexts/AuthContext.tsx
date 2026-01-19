import React, { createContext, useContext, useState, useEffect } from 'react';

// Manager credentials mapping
const MANAGER_CREDENTIALS: Record<string, { password: string; isLeagueManager: boolean }> = {
  'Akash': { password: 'MorneMorkel', isLeagueManager: false },
  'Krithik': { password: 'SaeedAjmal', isLeagueManager: false },
  'Vamsi': { password: 'TamimIqbal', isLeagueManager: false },
  'Krishna': { password: 'RaviBopara', isLeagueManager: false },
  'Jasthi': { password: 'BradHaddin', isLeagueManager: false },
  'Santosh': { password: 'RossTaylor', isLeagueManager: false },
  'Abhi': { password: 'Dilshan', isLeagueManager: true },
};

interface User {
  name: string;
  isLeagueManager: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (managerName: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  canEditTeam: (managerId: string, managers: { id: string; name: string }[]) => boolean;
  isLeagueManager: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_STORAGE_KEY = 'ipl_fantasy_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore session from localStorage
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to restore auth session:', e);
    }
    return null;
  });

  // Persist user state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = (managerName: string, password: string): { success: boolean; error?: string } => {
    const credentials = MANAGER_CREDENTIALS[managerName];
    
    if (!credentials) {
      return { success: false, error: 'Invalid manager selected' };
    }

    if (credentials.password !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    setUser({
      name: managerName,
      isLeagueManager: credentials.isLeagueManager,
    });

    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  const canEditTeam = (managerId: string, managers: { id: string; name: string }[]): boolean => {
    if (!user) return false;
    if (user.isLeagueManager) return true;
    
    // Find the manager by ID and check if it matches the logged-in user
    const manager = managers.find(m => m.id === managerId);
    return manager?.name === user.name;
  };

  const isLeagueManager = user?.isLeagueManager ?? false;

  return (
    <AuthContext.Provider value={{ user, login, logout, canEditTeam, isLeagueManager }}>
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

// Export manager names for the login dropdown
export const MANAGER_NAMES = Object.keys(MANAGER_CREDENTIALS);
