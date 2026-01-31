import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';

/**
 * Initializes Zustand stores with data and real-time subscriptions.
 * This component should be rendered within the app to set up game state.
 * 
 * Usage: Place in App.tsx or in a route-specific layout component
 */
export function StoreInitializer() {
    const { leagueId } = useParams<{ leagueId: string }>();
    const setInitializedLeagueId = useGameStore(state => state.setInitializedLeagueId);
    const setCurrentManagerId = useGameStore(state => state.setCurrentManagerId);
    const { seedDatabase } = useSeedDatabase();

    // Auth store for manager profile
    const user = useAuthStore(state => state.user);
    const managerProfile = useAuthStore(state => state.managerProfile);
    const fetchManagerProfile = useAuthStore(state => state.fetchManagerProfile);

    // Fetch manager profile for this league when user or league changes
    useEffect(() => {
        if (!leagueId || !user) return;

        // Only fetch if we don't have a manager profile or it's for a different league
        if (!managerProfile || managerProfile.league_id !== leagueId) {
            console.log(`[StoreInitializer] 👤 Fetching manager profile for league: ${leagueId}`);
            fetchManagerProfile(undefined, leagueId);
        } else if (managerProfile && managerProfile.league_id === leagueId) {
            // Sync with game store
            setCurrentManagerId(managerProfile.id);
        }
    }, [leagueId, user, managerProfile, fetchManagerProfile, setCurrentManagerId]);

    // Fetch game data
    const fetchAllData = useGameStore(state => state.fetchAllData);
    const initializedLeagueId = useGameStore(state => state.initializedLeagueId);

    useEffect(() => {
        if (leagueId && leagueId !== initializedLeagueId) {
            console.log(`[StoreInitializer] 🎮 Fetching game data for league: ${leagueId}`);
            fetchAllData(leagueId);
        }
    }, [leagueId, initializedLeagueId, fetchAllData]);

    return null; // This component doesn't render anything
}
