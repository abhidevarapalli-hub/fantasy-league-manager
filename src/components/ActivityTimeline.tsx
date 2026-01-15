import { cn } from '@/lib/utils';
import { Activity } from '@/store/gameStore';
import { Plus, Minus, ArrowLeftRight, Calculator, Swords, Target, User, Shield } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface ActivityTimelineProps {
  activities: Activity[];
}

const activityIcons = {
  add: { icon: Plus, className: 'bg-success/20 text-success' },
  drop: { icon: Minus, className: 'bg-destructive/20 text-destructive' },
  trade: { icon: ArrowLeftRight, className: 'bg-secondary/20 text-secondary' },
  score: { icon: Calculator, className: 'bg-primary/20 text-primary' },
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'Batsman':
      return <Swords className="w-5 h-5" />;
    case 'Bowler':
      return <Target className="w-5 h-5" />;
    case 'All Rounder':
      return <User className="w-5 h-5" />;
    case 'Wicket Keeper':
      return <Shield className="w-5 h-5" />;
    default:
      return <User className="w-5 h-5" />;
  }
};

const formatTimestamp = (timestamp: Date) => {
  const date = new Date(timestamp);
  const estDate = toZonedTime(date, 'America/New_York');
  const timeStr = format(estDate, 'h:mm a');
  const dateStr = format(estDate, 'MMM d, yyyy');
  const relativeStr = formatDistanceToNow(date, { addSuffix: true });
  return { timeStr, dateStr, relativeStr };
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
        const { timeStr, dateStr, relativeStr } = formatTimestamp(activity.timestamp);
        
        // Check if this is an add/drop transaction with player details
        const hasPlayerDetails = activity.players && activity.players.length > 0;
        
        return (
          <div
            key={activity.id}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            {/* Header with timestamp */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", className)}>
                  <Icon className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{relativeStr}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{timeStr} EST</p>
                <p className="text-[10px] text-muted-foreground/70">{dateStr}</p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4">
              {hasPlayerDetails ? (
                <div className="space-y-3">
                  {activity.players!.map((playerTx, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-semibold uppercase tracking-wider",
                        playerTx.type === 'add' ? 'text-success' : 'text-destructive'
                      )}>
                        {playerTx.type === 'add' ? (
                          <Plus className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {playerTx.type === 'add' ? 'ADD' : 'DROP'}
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        playerTx.role === 'Batsman' && 'bg-blue-500/20 text-blue-400',
                        playerTx.role === 'Bowler' && 'bg-green-500/20 text-green-400',
                        playerTx.role === 'All Rounder' && 'bg-purple-500/20 text-purple-400',
                        playerTx.role === 'Wicket Keeper' && 'bg-orange-500/20 text-orange-400'
                      )}>
                        {getRoleIcon(playerTx.role)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{playerTx.playerName}</p>
                        <p className="text-xs text-muted-foreground">{playerTx.role} • {playerTx.team}</p>
                      </div>
                    </div>
                  ))}
                  {activity.managerTeamName && (
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      {activity.managerTeamName}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {activity.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
