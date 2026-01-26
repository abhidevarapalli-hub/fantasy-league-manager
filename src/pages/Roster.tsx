import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { AppLayout } from '@/components/AppLayout';
import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveRosterSlots, sortPlayersByRole, SlotRequirement } from '@/lib/roster-validation';
import { Badge } from '@/components/ui/badge';
import { Player, Manager } from '@/lib/supabase-types';

// Team colors based on IPL teams (same as draft page)
const teamColors: Record<string, string> = {
  SRH: 'bg-[#FF822A] border-[#FF822A] text-white',
  CSK: 'bg-[#FFCB05] border-[#FFCB05] text-black',
  KKR: 'bg-[#3A225D] border-[#3A225D] text-white',
  RR: 'bg-[#EB71A6] border-[#EB71A6] text-white',
  RCB: 'bg-[#800000] border-[#800000] text-white',
  MI: 'bg-[#004B91] border-[#004B91] text-white',
  GT: 'bg-[#1B223D] border-[#1B223D] text-white',
  LSG: 'bg-[#2ABFCB] border-[#2ABFCB] text-white',
  PBKS: 'bg-[#B71E24] border-[#B71E24] text-white',
  DC: 'bg-[#000080] border-[#000080] text-white',
};

const defaultCellColor = 'bg-muted/50 border-border text-muted-foreground';

const teamBadgeColors: Record<string, string> = {
  CSK: 'bg-black/20 text-black',
  MI: 'bg-white/20 text-white',
  RCB: 'bg-white/20 text-white',
  KKR: 'bg-white/20 text-white',
  DC: 'bg-white/20 text-white',
  RR: 'bg-white/20 text-white',
  PBKS: 'bg-white/20 text-white',
  SRH: 'bg-white/20 text-white',
  GT: 'bg-white/20 text-white',
  LSG: 'bg-white/20 text-white',
};

const roleAbbreviations: Record<string, string> = {
  'Bowler': 'BOWL',
  'Batsman': 'BAT',
  'Wicket Keeper': 'WK',
  'All Rounder': 'AR',
  'WK/BAT': 'WK/BAT',
  'AR/BWL': 'AR/BWL',
};

const roleIcons: Record<string, string> = {
  'Wicket Keeper': '🧤',
  'Batsman': '🏏',
  'All Rounder': '⚡',
  'Bowler': '🎯',
  'WK/BAT': '🏏',
  'AR/BWL': '⚡',
};

interface RosterCellProps {
  slot: SlotRequirement;
  isBench?: boolean;
}

const RosterCell = ({ slot, isBench }: RosterCellProps) => {
  const player = slot.player || null;
  const colorClass = player ? (teamColors[player.team] || defaultCellColor) : defaultCellColor;

  return (
    <div
      className={cn(
        "relative min-h-[80px] p-2 border rounded-lg",
        colorClass,
        !player && "border-dashed"
      )}
    >
      {/* Slot indicator for bench */}
      {isBench && (
        <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60">
          B
        </div>
      )}

      {/* International player icon */}
      {player?.isInternational && (
        <div className="absolute top-1 left-1">
          <Plane className="w-3 h-3 opacity-80" />
        </div>
      )}

      {player ? (
        <div className="pt-3 flex flex-col items-center justify-center text-center">
          <p className="font-medium text-xs truncate leading-tight w-full">
            {player.name.split(' ')[0]}
          </p>
          <p className="font-bold text-sm truncate leading-tight w-full">
            {player.name.split(' ').slice(1).join(' ')}
          </p>
          <Badge
            className={cn(
              "text-[8px] px-1 py-0 mt-1 font-semibold",
              teamBadgeColors[player.team] || 'bg-muted text-muted-foreground'
            )}
          >
            {roleAbbreviations[player.role] || player.role}
          </Badge>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full pt-2">
          <div className="text-lg opacity-50">
            {roleIcons[slot.role] || '👤'}
          </div>
          <span className="text-[9px] opacity-50 mt-1 text-center leading-tight">
            {slot.label}
          </span>
        </div>
      )}
    </div>
  );
};

const Roster = () => {
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();

  // Zustand selectors
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const currentManagerId = useGameStore(state => state.currentManagerId);

  // Get roster slots for a manager
  const getRosterSlots = (manager: Manager): { activeSlots: SlotRequirement[]; benchSlots: SlotRequirement[] } => {
    const rosterIds = manager.activeRoster || [];
    const benchIds = manager.bench || [];

    const activePlayers = rosterIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);

    const benchPlayers = benchIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);

    const activeSlots = getActiveRosterSlots(activePlayers, config);

    const sortedBench = sortPlayersByRole(benchPlayers);
    const benchSlots: SlotRequirement[] = sortedBench.map(player => ({
      role: player.role,
      label: player.role,
      filled: true,
      player,
    }));

    for (let i = benchPlayers.length; i < config.benchSize; i++) {
      benchSlots.push({
        role: 'WK/BAT',
        label: 'Reserve',
        filled: false,
      });
    }

    return { activeSlots, benchSlots };
  };

  return (
    <AppLayout title="Team Rosters" subtitle="Click on a team name to manage roster">
      <div className="px-4 py-4">
        <div className="overflow-x-auto">
          {/* Header Row */}
          <div className="grid gap-2 min-w-[640px]" style={{ gridTemplateColumns: `repeat(${managers.length}, minmax(80px, 1fr))` }}>
            {managers.map(manager => (
              <button
                key={manager.id}
                onClick={() => navigate(`/${leagueId}/team/${manager.id}`)}
                className={cn(
                  "text-center py-2 px-1 rounded-lg border transition-colors",
                  manager.id === currentManagerId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                )}
              >
                <span className="text-xs font-bold truncate block">
                  {manager.teamName}
                </span>
              </button>
            ))}
          </div>

          {/* Active Grid */}
          <div className="mt-2 space-y-1">
            {Array.from({ length: config.activeSize }, (_, rowIdx) => (
              <div
                key={rowIdx}
                className="grid gap-2 min-w-[640px]"
                style={{ gridTemplateColumns: `repeat(${managers.length}, minmax(80px, 1fr))` }}
              >
                {managers.map(manager => {
                  const { activeSlots } = getRosterSlots(manager);
                  const slot = activeSlots[rowIdx];
                  if (!slot) return null;
                  return (
                    <RosterCell
                      key={`${manager.id}-${rowIdx}`}
                      slot={slot}
                      isBench={false}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bench Section */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              Bench
            </p>
            <div className="space-y-1">
              {Array.from({ length: config.benchSize }, (_, benchIdx) => (
                <div
                  key={benchIdx}
                  className="grid gap-2 min-w-[640px]"
                  style={{ gridTemplateColumns: `repeat(${managers.length}, minmax(80px, 1fr))` }}
                >
                  {managers.map(manager => {
                    const { benchSlots } = getRosterSlots(manager);
                    const slot = benchSlots[benchIdx];
                    if (!slot) return null;
                    return (
                      <RosterCell
                        key={`${manager.id}-bench-${benchIdx}`}
                        slot={slot}
                        isBench={true}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Plane className="w-3 h-3" />
              <span>International</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">B</span>
              <span>Bench Player</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Roster;
