import { cn } from '@/lib/utils';
import { Activity } from '@/store/gameStore';
import { Plus, Minus, ArrowLeftRight, Calculator } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityTimelineProps {
  activities: Activity[];
}

const activityIcons = {
  add: { icon: Plus, className: 'bg-success/20 text-success' },
  drop: { icon: Minus, className: 'bg-destructive/20 text-destructive' },
  trade: { icon: ArrowLeftRight, className: 'bg-secondary/20 text-secondary' },
  score: { icon: Calculator, className: 'bg-primary/20 text-primary' },
};

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <ArrowLeftRight className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const { icon: Icon, className } = activityIcons[activity.type];
        
        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border"
          >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", className)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">
                {activity.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
