import { Users, Plane, Shield } from 'lucide-react';
import { LeagueConfig } from '@/lib/roster-validation';
import { cn } from '@/lib/utils';

interface TeamConstraintsProps {
  config: LeagueConfig;
  className?: string;
}

export const TeamConstraints = ({ config, className }: TeamConstraintsProps) => {
  const totalRosterSize = config.activeSize + config.benchSize;

  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        Team Constraints
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {/* Roster Size */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Roster Size</span>
          <span className="font-semibold text-foreground">
            {config.activeSize} + {config.benchSize} bench = {totalRosterSize}
          </span>
        </div>

        {/* Teams */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            Teams
          </span>
          <span className="font-semibold text-foreground">{config.managerCount}</span>
        </div>

        {/* International Limit */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground flex items-center gap-1">
            <Plane className="w-3 h-3" />
            Int'l Players
          </span>
          <span className="font-semibold text-foreground">Max {config.maxInternational}</span>
        </div>

        {/* Wicket Keepers */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Wicket Keepers</span>
          <span className="font-semibold text-foreground">Min {config.minWks}</span>
        </div>

        {/* Batsmen */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Batsmen</span>
          <span className="font-semibold text-foreground">
            {config.minBatsmen} - {config.maxBatsmen}
          </span>
        </div>

        {/* All Rounders */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">All Rounders</span>
          <span className="font-semibold text-foreground">Min {config.minAllRounders}</span>
        </div>

        {/* Bowlers */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md">
          <span className="text-muted-foreground">Bowlers</span>
          <span className="font-semibold text-foreground">Min {config.minBowlers}</span>
        </div>

        {/* Combined Rules */}
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md col-span-2">
          <span className="text-muted-foreground">Combined Rules</span>
          <span className="font-semibold text-foreground text-[11px]">
            WK + BAT: 4-6 • BWL + AR: Min 5
          </span>
        </div>
      </div>
    </div>
  );
};
