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
    const fetchAllData = useGameStore(state => state.fetchAllData);
    const subscribeToRealtime = useGameStore(state => state.subscribeToRealtime);
    const setLoading = useGameStore(state => state.setLoading);
    const initializeAuth = useAuthStore(state => state.initialize);
    const { seedDatabase } = useSeedDatabase();

    // Initialize auth on mount
    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    // Initialize game data when leagueId changes
    useEffect(() => {
        if (!leagueId) return;

        const initializeGame = async () => {
            setLoading(true);
            try {
                // Seed database if needed
                await seedDatabase(leagueId);

                // Fetch all game data
                await fetchAllData(leagueId);

                // Set up real-time subscriptions
                const unsubscribe = subscribeToRealtime(leagueId);

                return unsubscribe;
            } catch (error) {
                console.error('Error initializing game:', error);
            } finally {
                setLoading(false);
            }
        };

        const cleanupPromise = initializeGame();

        // Cleanup subscriptions on unmount or league change
        return () => {
            cleanupPromise.then(cleanup => cleanup?.());
        };
    }, [leagueId, fetchAllData, subscribeToRealtime, seedDatabase, setLoading]);

    return null; // This component doesn't render anything
}
