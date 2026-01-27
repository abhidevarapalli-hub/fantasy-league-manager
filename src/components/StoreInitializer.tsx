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
    const isInitializing = useGameStore(state => state.isInitializing);
    const initializedLeagueId = useGameStore(state => state.initializedLeagueId);
    const setIsInitializing = useGameStore(state => state.setIsInitializing);
    const setInitializedLeagueId = useGameStore(state => state.setInitializedLeagueId);
    const { seedDatabase } = useSeedDatabase();

    // Initialize game data when leagueId changes
    useEffect(() => {
        if (!leagueId) return;

        // Prevent duplicate initialization for the same league
        if (isInitializing) {
            console.log(`[StoreInitializer] ⏸️  Initialization already in progress, skipping...`);
            return;
        }

        // Skip if already initialized for this league
        if (initializedLeagueId === leagueId) {
            console.log(`[StoreInitializer] ✅ League ${leagueId} already initialized, skipping...`);
            return;
        }

        const initializeGame = async () => {
            setIsInitializing(true);
            const initStartTime = performance.now();
            console.log(`[StoreInitializer] 🚀 Starting initialization for league: ${leagueId}`);

            setLoading(true);
            try {
                // Seed database if needed
                const seedStartTime = performance.now();
                console.log(`[StoreInitializer] 📦 Starting database seeding...`);
                await seedDatabase(leagueId);
                const seedDuration = performance.now() - seedStartTime;
                console.log(`[StoreInitializer] ✅ Database seeding completed in ${seedDuration.toFixed(2)}ms`);

                // Fetch all game data
                const fetchStartTime = performance.now();
                console.log(`[StoreInitializer] 📥 Starting data fetch...`);
                await fetchAllData(leagueId);
                const fetchDuration = performance.now() - fetchStartTime;
                console.log(`[StoreInitializer] ✅ Data fetch completed in ${fetchDuration.toFixed(2)}ms`);

                // Set up real-time subscriptions
                const subscribeStartTime = performance.now();
                console.log(`[StoreInitializer] 🔔 Setting up real-time subscriptions...`);
                const unsubscribe = subscribeToRealtime(leagueId);
                const subscribeDuration = performance.now() - subscribeStartTime;
                console.log(`[StoreInitializer] ✅ Subscriptions setup completed in ${subscribeDuration.toFixed(2)}ms`);

                const totalDuration = performance.now() - initStartTime;
                console.log(`[StoreInitializer] 🎉 Total initialization completed in ${totalDuration.toFixed(2)}ms (Seed: ${seedDuration.toFixed(2)}ms, Fetch: ${fetchDuration.toFixed(2)}ms, Subscribe: ${subscribeDuration.toFixed(2)}ms)`);

                // Mark this league as initialized
                setInitializedLeagueId(leagueId);

                return unsubscribe;
            } catch (error) {
                console.error('[StoreInitializer] ❌ Error initializing game:', error);
                setInitializedLeagueId(null); // Reset on error
            } finally {
                setLoading(false);
                setIsInitializing(false);
            }
        };

        const cleanupPromise = initializeGame();

        // Cleanup subscriptions on unmount or league change
        return () => {
            // Only cleanup if actually changing leagues
            if (initializedLeagueId !== leagueId) {
                console.log(`[StoreInitializer] 🧹 Cleaning up for league: ${initializedLeagueId}`);
                cleanupPromise.then(cleanup => cleanup?.());
                setInitializedLeagueId(null);
            }
        };
    }, [leagueId]); // Only depend on leagueId

    return null; // This component doesn't render anything
}
