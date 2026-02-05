import { useMemo } from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';
import { getRosterProgress, ConstraintStatus, ConstraintProgress } from '@/lib/roster-validation';
import type { Manager, Player } from '@/lib/supabase-types';

interface DraftRosterProgressProps {
  managerId: string;
  managerName?: string;
  draftPicks: { managerId: string | null; playerId: string | null }[];
  className?: string;
  variant?: 'full' | 'compact';
}

const StatusIcon = ({ status }: { status: ConstraintStatus }) => {
  switch (status) {
    case 'met':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case 'warning':
      return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
    case 'exceeded':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return null;
  }
};

const ProgressDots = ({ current, target, status }: { current: number; target: number; status: ConstraintStatus }) => {
  const dots = [];
  for (let i = 0; i < target; i++) {
    const isFilled = i < current;
    dots.push(
      <div
        key={i}
        className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isFilled
            ? status === 'exceeded'
              ? "bg-red-500"
              : status === 'met'
              ? "bg-green-500"
              : "bg-primary"
            : "bg-muted-foreground/30"
        )}
      />
    );
  }
  return <div className="flex gap-0.5">{dots}</div>;
};

const ConstraintRow = ({
  label,
  shortLabel,
  progress,
  showMax = false,
  compact = false,
}: {
  label: string;
  shortLabel: string;
  progress: ConstraintProgress;
  showMax?: boolean;
  compact?: boolean;
}) => {
  const target = showMax ? (progress.max || 0) : (progress.min || 0);
  const displayCount = showMax
    ? `${progress.current}/${progress.max}`
    : `${progress.current}/${progress.min}${progress.max ? ` max ${progress.max}` : ''}`;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase w-8">{shortLabel}</span>
        <span className={cn(
          "text-[10px] font-medium",
          progress.status === 'met' && "text-green-500",
          progress.status === 'warning' && "text-amber-500",
          progress.status === 'exceeded' && "text-red-500"
        )}>
          {progress.current}/{progress.min || progress.max}
        </span>
        <StatusIcon status={progress.status} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground w-16">{label}</span>
        <ProgressDots current={progress.current} target={target} status={progress.status} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-[10px] font-medium",
          progress.status === 'met' && "text-green-500",
          progress.status === 'warning' && "text-amber-500",
          progress.status === 'exceeded' && "text-red-500"
        )}>
          {displayCount} {showMax ? 'max' : 'min'}
        </span>
        <StatusIcon status={progress.status} />
        {progress.needed && progress.needed > 0 && (
          <span className="text-[9px] text-amber-500 font-medium">
            Need {progress.needed}
          </span>
        )}
      </div>
    </div>
  );
};

export const DraftRosterProgress = ({
  managerId,
  managerName,
  draftPicks,
  className,
  variant = 'full',
}: DraftRosterProgressProps) => {
  const players = useGameStore((state) => state.players);
  const config = useGameStore((state) => state.config);
  const managers = useGameStore((state) => state.managers);

  // Get manager name if not provided
  const displayName = managerName || managers.find((m) => m.id === managerId)?.teamName || 'Manager';

  // Get the players this manager has drafted
  const managerPlayers = useMemo(() => {
    const pickedPlayerIds = draftPicks
      .filter((pick) => pick.managerId === managerId && pick.playerId)
      .map((pick) => pick.playerId as string);

    return players.filter((p) => pickedPlayerIds.includes(p.id));
  }, [draftPicks, managerId, players]);

  const progress = useMemo(
    () => getRosterProgress(managerPlayers, config),
    [managerPlayers, config]
  );

  if (variant === 'compact') {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border", className)}>
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Roster:</span>
        <ConstraintRow label="WK" shortLabel="WK" progress={progress.wicketKeepers} compact />
        <ConstraintRow label="BAT" shortLabel="BAT" progress={progress.batsmen} compact />
        <ConstraintRow label="AR" shortLabel="AR" progress={progress.allRounders} compact />
        <ConstraintRow label="BWL" shortLabel="BWL" progress={progress.bowlers} compact />
        <ConstraintRow label="INTL" shortLabel="INTL" progress={progress.international} showMax compact />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Roster Progress</span>
          <span className="text-xs text-muted-foreground">({displayName})</span>
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full",
          progress.total.current === progress.total.target
            ? "bg-green-500/20 text-green-500"
            : "bg-primary/20 text-primary"
        )}>
          {progress.total.current}/{progress.total.target}
        </span>
      </div>

      {/* Individual constraints */}
      <div className="space-y-0.5">
        <ConstraintRow label="WK" shortLabel="WK" progress={progress.wicketKeepers} />
        <ConstraintRow label="Batsmen" shortLabel="BAT" progress={progress.batsmen} />
        <ConstraintRow label="All-Rounders" shortLabel="AR" progress={progress.allRounders} />
        <ConstraintRow label="Bowlers" shortLabel="BWL" progress={progress.bowlers} />
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-border" />

      {/* Combined constraints */}
      <div className="space-y-0.5">
        <ConstraintRow label="WK+BAT" shortLabel="WK+BAT" progress={progress.wkBatCombined} />
        <ConstraintRow label="BWL+AR" shortLabel="BWL+AR" progress={progress.bwlArCombined} />
        <ConstraintRow label="Int'l" shortLabel="INTL" progress={progress.international} showMax />
      </div>
    </div>
  );
};
