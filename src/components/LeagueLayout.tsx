import { Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';

export const LeagueLayout = () => {
    const { leagueId } = useParams<{ leagueId: string }>();
    const setInitializedLeagueId = useGameStore(state => state.setInitializedLeagueId);
    const setCurrentManagerId = useGameStore(state => state.setCurrentManagerId);
    const { seedDatabase } = useSeedDatabase();

    // Auth store for manager profile
    const user = useAuthStore(state => state.user);
    const managerProfile = useAuthStore(state => state.managerProfile);
    const fetchManagerProfile = useAuthStore(state => state.fetchManagerProfile);

    // Game store actions
    const fetchAllData = useGameStore(state => state.fetchAllData);
    const subscribeToRealtime = useGameStore(state => state.subscribeToRealtime);
    const initializedLeagueId = useGameStore(state => state.initializedLeagueId);

    // Fetch manager profile for this league when user or league changes
    useEffect(() => {
        if (!leagueId || !user) return;

        // Only fetch if we don't have a manager profile or it's for a different league
        if (!managerProfile || managerProfile.league_id !== leagueId) {
            console.log(`[LeagueLayout] 👤 Fetching manager profile for league: ${leagueId}`);
            fetchManagerProfile(undefined, leagueId);
        } else if (managerProfile && managerProfile.league_id === leagueId) {
            // Sync with game store
            setCurrentManagerId(managerProfile.id);
        }
    }, [leagueId, user, managerProfile, fetchManagerProfile, setCurrentManagerId]);

    // Fetch game data
    useEffect(() => {
        if (leagueId && leagueId !== initializedLeagueId) {
            console.log(`[LeagueLayout] 🎮 Fetching game data for league: ${leagueId}`);
            fetchAllData(leagueId);
        }
    }, [leagueId, initializedLeagueId, fetchAllData]);

    // Set up real-time subscription
    useEffect(() => {
        if (!leagueId) return;

        console.log(`[LeagueLayout] 🔌 Setting up real-time subscription for league: ${leagueId}`);
        const unsubscribe = subscribeToRealtime(leagueId);

        return () => {
            console.log(`[LeagueLayout] 🔌 Cleaning up real-time subscription for league: ${leagueId}`);
            unsubscribe();
        };
    }, [leagueId, subscribeToRealtime]);

    return <Outlet />;
};
