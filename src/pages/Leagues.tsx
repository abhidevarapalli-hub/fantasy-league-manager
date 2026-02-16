import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Loader2, ChevronRight, Trash2, UserCircle, LogOut, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

import { toast } from 'sonner';

type ManagerRow = Tables<"managers">;
type LeagueRow = Tables<"leagues">;

interface League {
    id: string;
    name: string;
    manager_count: number;
    league_manager_id: string;
    tournament_name?: string; // Optional since older leagues might not have it
    active_player_count?: number;
    lm_name?: string;
}

const Leagues = () => {
    const user = useAuthStore(state => state.user);
    const userProfile = useAuthStore(state => state.userProfile);
    const signOut = useAuthStore(state => state.signOut);
    const isLoading = useAuthStore(state => state.isLoading);
    const isLeaguesInitialized = useGameStore(state => state.isLeaguesInitialized);
    const setIsLeaguesInitialized = useGameStore(state => state.setIsLeaguesInitialized);

    const navigate = useNavigate();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeagues = useCallback(async () => {
        // const fetchStartTime = performance.now();
        // console.log('[Leagues] 🏟️  Starting leagues fetch...');

        if (!user || !user.id) {
            // console.log('[Leagues] ⚠️  No user found, skipping fetch');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Step 1: Fetch managers for this user to know which leagues they are in
            // const managersStartTime = performance.now();
            // console.log('[Leagues] 👥 Fetching managers for user...');

            const { data: managerData, error: managerError } = await supabase
                .from('managers')
                .select('league_id')
                .eq('user_id', user.id);

            // const managersDuration = performance.now() - managersStartTime;
            // console.log(`[Leagues] ✅ Managers fetch completed in ${managersDuration.toFixed(2)}ms (${managerData?.length || 0} managers)`);

            if (managerError) {
                console.error('[Leagues] ❌ Error fetching manager data:', managerError);
                throw managerError;
            }

            // Get unique league IDs and filter out nulls
            const leagueIds = (managerData?.map((m: Pick<ManagerRow, 'league_id'>) => m.league_id) || [])
                .filter((id: string | null) => id !== null);

            // console.log(`[Leagues] 🎯 Found ${leagueIds.length} unique league IDs`);

            if (leagueIds.length === 0) {
                // const totalDuration = performance.now() - fetchStartTime;
                // console.log(`[Leagues] ℹ️  No leagues found. Total time: ${totalDuration.toFixed(2)}ms`);
                setLeagues([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch the actual league details
            // const leaguesStartTime = performance.now();
            // console.log('[Leagues] 🏆 Fetching league details...');

            const { data: leaguesData, error: leaguesError } = await supabase
                .from('leagues')
                .select('*')
                .in('id', leagueIds);

            // const leaguesDuration = performance.now() - leaguesStartTime;
            // console.log(`[Leagues] ✅ Leagues fetch completed in ${leaguesDuration.toFixed(2)}ms (${leaguesData?.length || 0} leagues)`);

            if (leaguesError) {
                console.error('[Leagues] ❌ Error fetching leagues:', leaguesError);
                throw leaguesError;
            }

            // Step 3: Fetch all managers for these leagues to calculate stats
            // We need to know who the LM is and how many spots are filled
            // const statsStartTime = performance.now();
            // console.log('[Leagues] 📊 Fetching league stats...');

            const { data: allManagers, error: allManagersError } = await supabase
                .from('managers')
                .select('league_id, name, is_league_manager, user_id')
                .in('league_id', leagueIds);

            // const statsDuration = performance.now() - statsStartTime;

            if (allManagersError) {
                console.warn('[Leagues] ⚠️ Error fetching stats, displaying basic info:', allManagersError);
            }

            // Process stats
            const processedLeagues = (leaguesData || []).map((league: LeagueRow) => {
                const leagueManagers = allManagers?.filter((m) => m.league_id === league.id) || [];

                // Find LM
                const lm = leagueManagers.find((m) => m.is_league_manager);

                // Count active (non-placeholder) managers
                // A manager is active if they have a user_id associated
                const activeCount = leagueManagers.filter((m) => m.user_id !== null).length;

                return {
                    ...league,
                    lm_name: lm?.name || 'Unknown',
                    active_player_count: activeCount
                };
            });


            // const totalDuration = performance.now() - fetchStartTime;
            // console.log(`[Leagues] 🎉 Total leagues fetch completed in ${totalDuration.toFixed(2)}ms`);

            setLeagues(processedLeagues);

            // Mark as initialized
            setIsLeaguesInitialized(true);
        } catch (error: unknown) {
            // const duration = performance.now() - fetchStartTime;
            // console.error(`[Leagues] ❌ Error in fetchLeagues after ${duration.toFixed(2)}ms:`, error.message);
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[Leagues] ❌ Error in fetchLeagues:`, message);
            toast.error("Failed to load leagues. Please check your database connection.");
        } finally {
            setLoading(false);
        }
    }, [user, setIsLeaguesInitialized]);

    useEffect(() => {
        if (user && user.id) {
            fetchLeagues();
        } else if (!isLoading) {
            setLoading(false);
        }
    }, [user, isLoading, fetchLeagues]);


    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };


    const handleDeleteLeague = async (e: React.MouseEvent, leagueId: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this league? All associated data will be lost.')) return;

        try {
            const { error } = await supabase
                .from('leagues')
                .delete()
                .eq('id', leagueId);

            if (error) throw error;

            setLeagues(leagues.filter(l => l.id !== leagueId));
            toast.success('League deleted successfully');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`Error deleting league: ${message}`);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
            {/* User Profile Header */}
            <div className="w-full max-w-6xl px-6 py-4 flex justify-between items-center bg-background/40 backdrop-blur-md border-b border-primary/5 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20">
                        <UserCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Manager</p>
                        <p className="font-bold text-foreground">@{userProfile?.username || 'user'}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-2">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </Button>
            </div>

            <div className="max-w-4xl w-full space-y-12 p-6 py-12">
                <div className="text-center space-y-4">

                    <h1 className="text-6xl font-black tracking-tighter text-foreground italic uppercase">
                        IPL <span className="text-primary">Fantasy</span> Manager
                    </h1>
                    <p className="text-muted-foreground text-xl max-w-lg mx-auto leading-relaxed">
                        The ultimate battleground for cricket strategists. Create a new empire or continue your legacy.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create New League CTA */}
                    <Card className="border-2 border-primary/20 shadow-2xl glass-morphism hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between" onClick={() => navigate('/leagues/create')}>
                        <CardHeader className="space-y-4">
                            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-inner group-hover:scale-110 transition-transform">
                                <PlusCircle className="w-10 h-10 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-bold">New Strategy</CardTitle>
                                <CardDescription className="text-base">Start a fresh league with custom rules and manager limits.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-primary font-bold gap-2">
                                Start Building <ChevronRight className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* List existing leagues */}
                    <div className="flex flex-col space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-2xl font-bold tracking-tight">Your Competitions</h2>
                            <div className="h-0.5 flex-1 mx-4 bg-muted" />
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-12 bg-muted/30 rounded-3xl border-2 border-dashed border-muted">
                                <Loader2 className="w-12 h-12 animate-spin text-primary/50" />
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {leagues.map((league) => (

                                    <div
                                        key={league.id}
                                        className="relative group w-full p-4 border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all text-left shadow-lg rounded-xl bg-background cursor-pointer flex flex-col gap-3"
                                        onClick={() => navigate(`/${league.id}`)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">{league.name}</span>
                                                    {league.tournament_name && (
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                                                            {league.tournament_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                        <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                                            <Users className="w-3 h-3" />
                                                            {league.active_player_count ?? 1} / {league.manager_count} Joined
                                                        </span>
                                                        <span>•</span>
                                                        <span>LM: {league.lm_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {user?.id === league.league_manager_id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => handleDeleteLeague(e, league.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {leagues.length === 0 && (
                                    <div className="text-center p-12 bg-muted/20 rounded-3xl border-2 border-dashed border-muted flex flex-col items-center gap-4">
                                        <p className="text-muted-foreground font-medium">No active competition found.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Leagues;
