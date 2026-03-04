import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

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
    is_platform_admin: boolean;
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
    isPlatformAdmin: () => boolean;
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
                        // No profile found. This likely means the DB was reset but the
                        // browser still has a stale session. Sign out to force re-auth.
                        console.warn('No profile found for user — signing out stale session.');
                        await supabase.auth.signOut();
                        set({ user: null, session: null, userProfile: null, managerProfile: null });
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

            isPlatformAdmin: () => {
                const { userProfile } = get();
                return userProfile?.is_platform_admin || false;
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
                const isNative = Capacitor.isNativePlatform();

                try {
                    if (isNative) {
                        // Handle deep links from OAuth redirect (iOS/Android)
                        // When Google OAuth completes and redirects to com.cricfantasy.app://callback#access_token=...,
                        // Capacitor's App listener captures it. We parse tokens from the hash
                        // and set the session directly in Supabase.
                        App.addListener('appUrlOpen', async (event: { url: string }) => {
                            const url = event.url;
                            console.log('[Auth] Deep link received:', url);

                            if (url.includes('callback')) {
                                // Extract the hash portion (access_token, refresh_token, expires_in, etc.)
                                const hashIndex = url.indexOf('#');
                                if (hashIndex > -1) {
                                    const hashContent = url.substring(hashIndex + 1); // Remove the # prefix
                                    const params = new URLSearchParams(hashContent);
                                    const accessToken = params.get('access_token');
                                    const refreshToken = params.get('refresh_token');

                                    if (accessToken && refreshToken) {
                                        console.log('[Auth] Processing OAuth callback, setting session directly');
                                        const { error } = await supabase.auth.setSession({
                                            access_token: accessToken,
                                            refresh_token: refreshToken,
                                        });

                                        if (error) {
                                            console.error('[Auth] Failed to set session from deep link:', error);
                                        }
                                    } else {
                                        console.error('[Auth] Missing access_token or refresh_token in callback URL');
                                    }
                                } else {
                                    console.error('[Auth] OAuth callback did not contain hash fragment');
                                }
                            }
                        });
                    }

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
                            if (isNative) {
                                Browser.close().catch(() => {
                                    // Ignore errors when browser is not open
                                });
                            }

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
