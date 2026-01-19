import { useGame } from '@/contexts/GameContext';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { AppLayout } from '@/components/AppLayout';

const Activity = () => {
  const { activities } = useGame();

  return (
    <AppLayout title="Activity Log" subtitle="Recent transactions & updates">
      <div className="px-4 py-4">
        <ActivityTimeline activities={activities} />
      </div>
    </AppLayout>
  );
};

export default Activity;
