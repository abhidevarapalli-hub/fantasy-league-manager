import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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

interface AuthState {
    // Core auth state
    session: Session | null;
    user: User | null;
    userProfile: UserProfile | null;
    managerProfile: ManagerProfile | null;
    isLoading: boolean;
    isInitialized: boolean;

    // Setters
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setUserProfile: (profile: UserProfile | null) => void;
    setManagerProfile: (profile: ManagerProfile | null) => void;
    setIsLoading: (loading: boolean) => void;

    // Actions
    signOut: () => Promise<{ error: Error | null }>;
    selectManager: (managerName: string, leagueId?: string) => Promise<void>;
    fetchManagerProfile: (name?: string, leagueId?: string) => Promise<void>;
    updateUsername: (username: string) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;

    // Computed
    isLeagueManager: () => boolean;
    canEditTeam: (teamId: string) => boolean;

    // Initialization
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    devtools(
        (set, get) => ({
            // Initial state
            session: null,
            user: null,
            userProfile: null,
            managerProfile: null,
            isLoading: true,
            isInitialized: false,

            // Setters
            setSession: (session) => set({ session, user: session?.user || null }),
            setUser: (user) => set({ user }),
            setUserProfile: (userProfile) => set({ userProfile }),
            setManagerProfile: (managerProfile) => set({ managerProfile }),
            setIsLoading: (isLoading) => set({ isLoading }),

            // Actions
            signOut: async () => {
                const { error } = await supabase.auth.signOut();
                if (!error) {
                    set({ session: null, user: null, userProfile: null, managerProfile: null });
                }
                return { error };
            },

            selectManager: async (managerName, leagueId) => {
                const { user } = get();
                if (!user) return;

                try {
                    const query = supabase.from('managers').select('*').eq('name', managerName);
                    if (leagueId) query.eq('league_id', leagueId);

                    const { data, error } = await query.maybeSingle();
                    if (!error && data) {
                        set({ managerProfile: data as unknown as ManagerProfile });
                    }
                } catch (e) {
                    console.error('Error selecting manager:', e);
                }
            },

            fetchManagerProfile: async (name, leagueId) => {
                const { user } = get();
                if (!user) {
                    set({ managerProfile: null });
                    return;
                }

                try {
                    let query = supabase.from('managers').select('*');

                    if (name) {
                        query = query.eq('name', name);
                    } else {
                        query = query.eq('user_id', user.id);
                    }

                    if (leagueId) {
                        query = query.eq('league_id', leagueId);
                    }

                    const { data, error } = await query.maybeSingle();

                    if (!error && data) {
                        set({ managerProfile: data as unknown as ManagerProfile });
                    } else {
                        set({ managerProfile: null });
                    }
                } catch (e) {
                    console.error('Error fetching manager profile:', e);
                    set({ managerProfile: null });
                }
            },

            updateUsername: async (username) => {
                const { user } = get();
                if (!user) return { error: new Error('No user logged in') };

                const { error } = await supabase
                    .from('profiles')
                    .update({ username })
                    .eq('id', user.id);

                if (!error) {
                    await get().refreshProfile();
                }

                return { error };
            },

            refreshProfile: async () => {
                const { user, session } = get();
                const currentUser = user || session?.user;

                if (!currentUser) {
                    set({ userProfile: null });
                    return;
                }

                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', currentUser.id)
                        .maybeSingle();

                    if (error) {
                        console.error('Error fetching user profile:', error);
                    } else if (data) {
                        set({ userProfile: data as unknown as UserProfile });
                    } else {
                        // Create profile if it doesn't exist
                        const { data: newProfile } = await supabase
                            .from('profiles')
                            .insert({ id: currentUser.id })
                            .select()
                            .maybeSingle();

                        if (newProfile) {
                            set({ userProfile: newProfile as unknown as UserProfile });
                        }
                    }
                } catch (e) {
                    console.error('Failed to refresh user profile:', e);
                }
            },

            // Computed values
            isLeagueManager: () => {
                const { managerProfile } = get();
                return managerProfile?.is_league_manager || false;
            },

            canEditTeam: (teamId) => {
                const { user, managerProfile } = get();
                if (!user || !managerProfile) return false;
                return managerProfile.id === teamId || managerProfile.is_league_manager;
            },

            // Initialize auth state and listeners
            initialize: async () => {
                if (get().isInitialized) return;

                set({ isLoading: true });

                try {
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                    if (sessionError) {
                        // Check for AbortError specifically
                        if (sessionError.name === 'AbortError' || sessionError.message?.includes('aborted')) {
                            console.warn('Auth session fetch aborted - this is usually expected during rapid navigation');
                        } else {
                            throw sessionError;
                        }
                    }

                    set({ session, user: session?.user || null, isInitialized: true });

                    if (session?.user) {
                        await get().refreshProfile();
                    }

                    supabase.auth.onAuthStateChange(async (_event, session) => {
                        set({ session, user: session?.user || null });
                        if (session?.user) {
                            // Use setTimeout to avoid blocking the auth event loop (deadlock fix)
                            setTimeout(() => {
                                get().refreshProfile().catch(e =>
                                    console.error('Error refreshing profile in background:', e)
                                );
                            }, 0);
                        } else {
                            set({ userProfile: null, managerProfile: null });
                        }
                    });
                } catch (error: unknown) {
                    console.error('Error initializing auth:', error);
                } finally {
                    set({ isLoading: false });
                }
            },
        }),
        { name: 'AuthStore' }
    )
);
