import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { useMockStore } from '@/store/useMockStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Loader2, ChevronRight, Trash2, UserCircle, LogOut, Users, Shield, Bot, Play, RotateCcw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';

import { toast } from 'sonner';

type ManagerRow = Tables<"managers">;
type LeagueRow = Tables<"leagues">;

interface League {
    id: string;
    name: string;
    manager_count: number;
    league_manager_id: string;
    tournament_name?: string;
    active_player_count?: number;
    lm_name?: string;
}

const Leagues = () => {
    const user = useAuthStore(state => state.user);
    const userProfile = useAuthStore(state => state.userProfile);
    const signOut = useAuthStore(state => state.signOut);
    const isLoading = useAuthStore(state => state.isLoading);
    const isPlatformAdmin = useAuthStore(state => state.userProfile?.is_platform_admin || false);
    const isLeaguesInitialized = useGameStore(state => state.isLeaguesInitialized);
    const setIsLeaguesInitialized = useGameStore(state => state.setIsLeaguesInitialized);

    const draftsObj = useMockStore(state => state.drafts);
    const mockDrafts = Object.values(draftsObj).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const deleteMockDraft = useMockStore(state => state.deleteDraft);

    const navigate = useNavigate();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeagues = useCallback(async () => {
        if (!user || !user.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: managerData, error: managerError } = await supabase
                .from('managers')
                .select('league_id')
                .eq('user_id', user.id);

            if (managerError) throw managerError;

            const leagueIds = (managerData?.map((m: Pick<ManagerRow, 'league_id'>) => m.league_id) || [])
                .filter((id: string | null) => id !== null);

            if (leagueIds.length === 0) {
                setLeagues([]);
                setLoading(false);
                return;
            }

            const { data: leaguesData, error: leaguesError } = await supabase
                .from('leagues')
                .select('*')
                .in('id', leagueIds);

            if (leaguesError) throw leaguesError;

            const { data: allManagers, error: allManagersError } = await supabase
                .from('managers')
                .select('league_id, name, is_league_manager, user_id')
                .in('league_id', leagueIds);

            if (allManagersError) {
                console.warn('[Leagues] ⚠️ Error fetching stats, displaying basic info:', allManagersError);
            }

            const processedLeagues = (leaguesData || []).map((league: LeagueRow) => {
                const leagueManagers = allManagers?.filter((m) => m.league_id === league.id) || [];
                const lm = leagueManagers.find((m) => m.is_league_manager);
                const activeCount = leagueManagers.filter((m) => m.user_id !== null).length;

                return {
                    ...league,
                    lm_name: lm?.name || 'Unknown',
                    active_player_count: activeCount
                };
            });

            setLeagues(processedLeagues);
            setIsLeaguesInitialized(true);
        } catch (error: unknown) {
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
        <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center relative overflow-hidden font-sans">
            {/* Background Floodlights / Effects */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] translate-x-1/3 pointer-events-none"></div>

            {/* Top Bar Navigation */}
            <div className="w-full max-w-6xl px-6 py-5 flex justify-between items-center z-50">
                <div className="flex items-center">
                    <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">
                        CRIC<span className="text-primary">FANTASY</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 cursor-pointer group px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                            <UserCircle className="w-5 h-5" />
                        </div>
                        <div className="hidden sm:block text-sm font-bold tracking-tight text-white/90">
                            @{userProfile?.username || 'user'}
                        </div>
                    </div>
                    {isPlatformAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-muted-foreground hover:text-white hover:bg-white/10 rounded-full px-3 h-10 gap-2">
                            <Shield className="w-4 h-4" />
                            <span className="hidden sm:inline">Admin</span>
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-white hover:bg-white/10 rounded-full h-10 w-10">
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="max-w-6xl w-full px-4 sm:px-6 pb-20 space-y-10 z-10">

                {/* Section 1: The Ultimate Draft Hero */}
                <section className="relative w-full rounded-[2rem] p-[1px] bg-gradient-to-b from-primary/50 via-primary/10 to-transparent overflow-visible sm:mt-2">
                    <div className="relative bg-[#051A25]/90 backdrop-blur-3xl w-full rounded-[1.8rem] sm:rounded-[2rem] py-8 px-5 sm:py-12 sm:px-10 flex flex-col md:flex-row items-center md:items-start justify-between overflow-hidden shadow-2xl gap-8 md:gap-6">
                        {/* Abstract Background Elements */}
                        <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-gradient-to-bl from-primary/30 to-transparent blur-3xl rounded-full opacity-60 pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
                        <div className="absolute bottom-0 left-0 w-[20rem] h-[20rem] bg-gradient-to-tr from-secondary/20 to-transparent blur-2xl rounded-full opacity-40 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>

                        {/* Left Content */}
                        <div className="relative z-20 flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-6 max-w-xl w-full">
                            <h2 className="text-3xl sm:text-5xl lg:text-5xl font-black tracking-tighter text-white uppercase italic leading-[1.1] drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                                THE ULTIMATE <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-foreground to-secondary drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] pr-2">DRAFT IS HERE</span>
                            </h2>

                            {/* "Friend League Lobby" Floating Card */}
                            <div className="relative bg-white/5 border border-white/20 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-3 w-full sm:w-72 transform md:-rotate-2 md:hover:rotate-0 transition-transform duration-500">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white text-sm font-bold tracking-wide">Friend League Lobby</h4>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,1)]"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex -space-x-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-[#051A25] bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">JD</div>
                                        <div className="w-8 h-8 rounded-full border-2 border-[#051A25] bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">SP</div>
                                        <div className="w-8 h-8 rounded-full border-2 border-[#051A25] bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">RK</div>
                                        <div className="w-8 h-8 rounded-full border-2 border-[#051A25] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">ML</div>
                                        <div className="w-8 h-8 rounded-full border-2 border-[#051A25] bg-white/10 flex items-center justify-center text-white/50 backdrop-blur-md hover:bg-white/20 transition-colors shadow-lg cursor-pointer">
                                            <UserCircle className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl sm:text-2xl font-black text-secondary drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">4<span className="text-white/40 text-sm sm:text-lg">/10</span></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5 mt-1">
                                    <div className="flex justify-end text-[9px] uppercase font-bold text-white/50 tracking-widest">
                                        Slots Filled
                                    </div>
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full w-[40%] bg-gradient-to-r from-primary to-secondary shadow-[0_0_10px_rgba(139,92,246,0.8)] rounded-full"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-1 w-full flex flex-col items-center md:items-start">
                                <Button
                                    onClick={() => navigate('/leagues/create')}
                                    className="relative group bg-gradient-to-r from-primary to-[#a855f7] hover:from-primary hover:to-[#9333ea] text-white font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] rounded-full px-6 py-6 sm:px-8 sm:py-6 text-xs sm:text-sm border border-white/20 shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:shadow-[0_0_40px_rgba(139,92,246,0.8)] transition-all active:scale-95 overflow-hidden w-full sm:w-auto hover:animate-pulse"
                                >
                                    <span className="relative z-10 drop-shadow-md">Create Private League</span>
                                </Button>
                                <p className="text-xs sm:text-sm lg:text-base text-white/70 font-semibold tracking-wide max-w-sm text-center md:text-left">
                                    NFL-style draft. <span className="text-white/90">No duplicate players.</span> Beat your friends.
                                </p>
                            </div>
                        </div>

                        {/* Right Visual element - 3D Cricket Ball with trail */}
                        <div className="relative w-48 h-48 sm:w-[250px] sm:h-[250px] shrink-0 z-30 flex items-center justify-center md:-translate-y-4">
                            {/* Neon glow behind ball */}
                            <div className="absolute inset-0 bg-primary/30 blur-[50px] rounded-full mix-blend-screen animate-pulse pointer-events-none"></div>

                            {/* Light/Neon Trail Path Component */}
                            <svg className="absolute w-[150%] h-[150%] -left-1/4 -top-1/4 -z-10 pointer-events-none" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="trailPulse" x1="0" y1="1" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                                        <stop offset="50%" stopColor="#d946ef" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.8" />
                                    </linearGradient>
                                    <filter id="glowStrong" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="3" result="blur" />
                                    </filter>
                                </defs>
                                <path d="M40 160 Q 90 130 140 80" stroke="url(#trailPulse)" strokeWidth="5" strokeLinecap="round" filter="url(#glowStrong)" opacity="0.8" />
                                <path d="M50 170 Q 100 140 150 90" stroke="url(#trailPulse)" strokeWidth="3" strokeLinecap="round" filter="url(#glowStrong)" opacity="0.6" />
                                <path d="M30 150 Q 80 110 130 70" stroke="url(#trailPulse)" strokeWidth="6" strokeLinecap="round" filter="url(#glowStrong)" opacity="0.4" />
                            </svg>

                            {/* Ball itself */}
                            <div className="relative w-24 h-24 sm:w-36 sm:h-36 z-20 hover:scale-105 transition-transform duration-500 cursor-pointer animate-[bounce_4s_ease-in-out_infinite]">
                                <div className="absolute inset-0 rounded-full shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.6),inset_8px_8px_15px_rgba(255,255,255,0.4),0_0_30px_rgba(220,38,38,0.5)] bg-gradient-to-tr from-[#991b1b] via-[#dc2626] to-[#f87171] rotate-12">
                                    {/* CSS Seam details */}
                                    <div className="absolute top-1/2 left-0 w-full h-1 border-t-2 border-b-2 border-white/40 border-dashed transform -translate-y-1/2 rounded-[50%] skew-y-12 shadow-[0_0_4px_rgba(255,255,255,0.5)]"></div>
                                    <div className="absolute top-1/2 left-0 w-full h-px bg-white/30 transform -translate-y-1/2 rounded-[50%] skew-y-12"></div>
                                </div>
                                {/* Additional highlight */}
                                <div className="absolute top-2 left-4 w-8 h-4 sm:w-16 sm:h-8 bg-white/40 rounded-full blur-md transform -rotate-45"></div>
                            </div>
                        </div>
                    </div>
                </section>



                {/* Section 2: Your Leagues (Horizontal Scroll) */}
                <section className="space-y-5">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase italic">Your Leagues</h3>
                        {/* Pagination dots indicator could go here */}
                        <div className="flex gap-1">
                            <div className="w-4 h-1 bg-primary rounded-full"></div>
                            <div className="w-2 h-1 bg-white/20 rounded-full"></div>
                            <div className="w-2 h-1 bg-white/20 rounded-full"></div>
                        </div>
                    </div>

                    <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-6 pt-2 snap-x px-2 scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
                        {/* Create New League Card */}
                        <div
                            onClick={() => navigate('/leagues/create')}
                            className="snap-start shrink-0 w-64 h-72 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 backdrop-blur-md flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group"
                        >
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                                <PlusCircle className="w-8 h-8 text-primary group-hover:text-primary-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-lg text-white tracking-wide uppercase">New League</p>
                                <p className="text-sm text-white/50">Create & invite</p>
                            </div>
                        </div>

                        {/* Existing Leagues List */}
                        {loading ? (
                            <div className="shrink-0 w-64 h-72 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                            </div>
                        ) : (
                            leagues.map((league) => {
                                const fillPercentage = Math.min(((league.active_player_count ?? 1) / league.manager_count) * 100, 100);
                                return (
                                    <div
                                        key={league.id}
                                        onClick={() => navigate(`/${league.id}`)}
                                        className="snap-start shrink-0 w-64 h-72 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-md hover:border-primary/60 hover:-translate-y-2 transition-all cursor-pointer flex flex-col p-6 group relative overflow-hidden"
                                    >
                                        {/* Colored glow effect on hover */}
                                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none"></div>

                                        <div className="flex justify-between items-start mb-6 z-10">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-900 border border-white/20 flex items-center justify-center shadow-lg pt-1">
                                                {/* Placeholder for vibrant icon */}
                                                <span className="text-2xl font-black italic">{league.name.charAt(0)}</span>
                                            </div>
                                            {user?.id === league.league_manager_id && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-full"
                                                    onClick={(e) => handleDeleteLeague(e, league.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-auto space-y-4 z-10">
                                            <div>
                                                <h4 className="font-bold text-xl text-white tracking-tight line-clamp-1">{league.name}</h4>
                                                {league.tournament_name && (
                                                    <p className="text-xs text-primary font-semibold uppercase tracking-wider mt-1">{league.tournament_name}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-white/80">
                                                    <span>{league.active_player_count ?? 1}/{league.manager_count} JOINED</span>
                                                    <span className="text-white/50">{Math.round(fillPercentage)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-[#b182ff] rounded-full"
                                                        style={{ width: `${fillPercentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Section 2: Draft Academy Hero Banner */}
                <section className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-r from-primary/50 to-secondary/50 shadow-[0_10px_40px_-10px_rgba(139,92,246,0.3)]">
                    <div className="relative bg-card/80 backdrop-blur-xl h-full w-full rounded-[23px] p-6 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
                        {/* Decorative inner glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>

                        <div className="space-y-4 max-w-lg relative z-10 text-center sm:text-left">
                            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-white uppercase italic drop-shadow-md">
                                DRAFT <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary pr-2">ACADEMY</span>
                            </h2>
                            <p className="text-base sm:text-lg text-white/70 font-medium">
                                Level up your strategy. Learn the insider tips and tricks to dominate your fantasy cricket league this season.
                            </p>
                            <Button className="mt-2 bg-primary hover:bg-primary/80 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] border border-primary/50 font-bold uppercase tracking-widest rounded-full px-8 py-6 text-sm transition-all hover:scale-105 active:scale-95">
                                Start Learning
                            </Button>
                        </div>

                        {/* Visual element for Cricket Bat & Ball */}
                        <div className="relative w-40 h-40 sm:w-56 sm:h-56 shrink-0 z-10 flex items-center justify-center group cursor-default">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/30 transition-colors duration-500"></div>
                            {/* SVG Cricket Bat and Ball */}
                            <svg viewBox="0 0 100 100" className="w-32 h-32 sm:w-48 sm:h-48 drop-shadow-[0_0_15px_rgba(139,92,246,0.4)] group-hover:drop-shadow-[0_0_25px_rgba(34,211,238,0.6)] group-hover:scale-105 group-hover:-rotate-3 transition-all duration-500 will-change-transform">
                                <defs>
                                    <linearGradient id="batGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#e2e8f0" />
                                        <stop offset="30%" stopColor="#ffffff" />
                                        <stop offset="100%" stopColor="#94a3b8" />
                                    </linearGradient>
                                    <linearGradient id="handleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#475569" />
                                        <stop offset="50%" stopColor="#e2e8f0" />
                                        <stop offset="100%" stopColor="#334155" />
                                    </linearGradient>
                                    <radialGradient id="ballGradient" cx="30%" cy="30%" r="70%">
                                        <stop offset="0%" stopColor="#ff8787" />
                                        <stop offset="100%" stopColor="#b91c1c" />
                                    </radialGradient>
                                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3" />
                                    </filter>
                                </defs>

                                <g transform="rotate(25, 50, 50) translate(0, -5)" filter="url(#shadow)">
                                    {/* Bat Handle */}
                                    <rect x="42" y="5" width="16" height="35" rx="2" fill="url(#handleGradient)" />
                                    {/* Handle Grips */}
                                    <path d="M42 12 Q50 14 58 12 M42 20 Q50 22 58 20 M42 28 Q50 30 58 28 M42 36 Q50 38 58 36" stroke="#1e293b" strokeWidth="1.5" fill="none" opacity="0.6" />
                                    {/* Handle Rubber Top */}
                                    <rect x="41" y="5" width="18" height="4" rx="1" fill="#1e293b" />

                                    {/* Bat Blade */}
                                    <path d="M38 40 L62 40 L64 90 Q64 98 50 98 Q36 98 36 90 Z" fill="url(#batGradient)" />
                                    {/* Spine / V-shape */}
                                    <path d="M46 40 L54 40 L54 94 Q50 96 46 94 Z" fill="#ffffff" opacity="0.6" />
                                </g>

                                {/* Ball */}
                                <g transform="translate(-5, 20)">
                                    <circle cx="25" cy="45" r="14" fill="url(#ballGradient)" filter="url(#shadow)" />
                                    {/* Seam */}
                                    <path d="M17 35 Q35 45 17 55" stroke="#fecaca" strokeWidth="1.5" strokeDasharray="3,2" fill="none" opacity="0.9" />
                                    <path d="M33 35 Q15 45 33 55" stroke="#fecaca" strokeWidth="1.5" strokeDasharray="3,2" fill="none" opacity="0.9" />
                                </g>
                            </svg>
                        </div>
                    </div>
                </section>

                {/* Section 3: Mock Draft Arena */}
                <section className="space-y-5">
                    {/* Futuristic Banner */}
                    <div className="relative rounded-[2rem] border-2 border-[#22D3EE] p-8 sm:p-12 bg-[#051A25] shadow-[0_0_20px_rgba(34,211,238,0.15),inset_0_0_20px_rgba(34,211,238,0.1)] overflow-hidden group">
                        {/* Background tech pattern overlay */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #22D3EE 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#22D3EE]/10 blur-[80px] pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                            <div className="flex items-center gap-6">
                                <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-[#22D3EE]/10 border border-[#22D3EE]/30 items-center justify-center shrink-0">
                                    <Bot className="w-10 h-10 text-[#22D3EE]" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-3xl sm:text-4xl font-black tracking-tighter text-white uppercase italic">Mock Draft <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#22D3EE] pr-2">Arena</span></h3>
                                    <p className="text-[#22D3EE]/60 font-medium">Test your drafting strategy against advanced AI managers.</p>
                                </div>
                            </div>
                            <Button
                                onClick={() => navigate('/mock-draft/setup')}
                                className="bg-[#22D3EE] hover:bg-[#15b8d3] text-[#051A25] font-black uppercase tracking-widest rounded-full px-8 py-6 text-sm sm:text-base border-none shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]"
                            >
                                Practice Now
                            </Button>
                        </div>
                    </div>

                    {/* Minimal list of history below */}
                    {mockDrafts.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-sm font-bold text-white/50 uppercase tracking-widest pl-2 mb-4">Previous Sessions</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {mockDrafts.map((draft) => {
                                    const isComplete = draft.status === 'completed';
                                    const rounds = draft.config.activeSize + draft.config.benchSize;

                                    return (
                                        <div
                                            key={draft.id}
                                            onClick={() => navigate(`/mock-draft/${draft.id}`)}
                                            className="bg-white/5 border border-white/10 hover:border-[#22D3EE]/50 hover:bg-white/10 rounded-2xl p-4 flex justify-between items-center transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-8 rounded-full ${isComplete ? 'bg-green-500' : 'bg-[#22D3EE]'}`}></div>
                                                <div>
                                                    <p className="font-bold text-white tracking-tight">{draft.config.managerCount} Teams Format</p>
                                                    <p className="text-xs text-white/50 mt-0.5">{formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })} • Pos #{draft.userPosition}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 rounded-full text-white/50 hover:text-red-400 hover:bg-red-400/10"
                                                    onClick={(e) => { e.stopPropagation(); deleteMockDraft(draft.id); }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#22D3EE]">
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Leagues;
