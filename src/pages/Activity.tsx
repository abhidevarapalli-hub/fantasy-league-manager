import { useGameStore } from '@/store/useGameStore';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { AppLayout } from '@/components/AppLayout';

const Activity = () => {
  // Zustand selector - ONLY subscribe to activities  
  const activities = useGameStore(state => state.activities);

  return (
    <AppLayout title="Activity Log" subtitle="Recent transactions & updates">
      <div className="px-4 py-4">
        <ActivityTimeline activities={activities} />
      </div>
    </AppLayout>
  );
};

export default Activity;
