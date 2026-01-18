import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BottomNav } from '@/components/BottomNav';
import { User, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTIVE_ROSTER_SIZE, BENCH_SIZE, sortPlayersByRole } from '@/lib/roster-validation';
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
};

const getCellColor = (player: Player | null): string => {
  if (!player) return defaultCellColor;
  return teamColors[player.team] || defaultCellColor;
};

interface RosterCellProps {
  player: Player | null;
  slotLabel: string;
  isBench?: boolean;
}

const RosterCell = ({ player, slotLabel, isBench }: RosterCellProps) => {
  const colorClass = getCellColor(player);
  
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
          <User className="w-6 h-6 opacity-30" />
          <span className="text-[10px] opacity-50 mt-1">{slotLabel}</span>
        </div>
      )}
    </div>
  );
};

const Roster = () => {
  const navigate = useNavigate();
  const { managers, players } = useGame();

  // Get player objects for a manager's roster
  const getManagerPlayers = (manager: Manager): { active: Player[]; bench: Player[] } => {
    const rosterIds = manager.activeRoster || [];
    const benchIds = manager.bench || [];
    
    const activeRaw = rosterIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);
    
    const benchRaw = benchIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);
    
    return {
      active: sortPlayersByRole(activeRaw),
      bench: sortPlayersByRole(benchRaw),
    };
  };

  // Create roster slots for display (11 active + 3 bench)
  const getRosterSlots = (manager: Manager): { player: Player | null; label: string; isBench: boolean }[] => {
    const { active, bench } = getManagerPlayers(manager);
    const slots: { player: Player | null; label: string; isBench: boolean }[] = [];
    
    // Active 11 slots
    for (let i = 0; i < ACTIVE_ROSTER_SIZE; i++) {
      slots.push({
        player: active[i] || null,
        label: `Active ${i + 1}`,
        isBench: false,
      });
    }
    
    // Bench slots
    for (let i = 0; i < BENCH_SIZE; i++) {
      slots.push({
        player: bench[i] || null,
        label: `Bench ${i + 1}`,
        isBench: true,
      });
    }
    
    return slots;
  };

  const totalRosterSize = ACTIVE_ROSTER_SIZE + BENCH_SIZE;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Team Rosters</h1>
          <p className="text-xs text-muted-foreground">Click on a team name to manage roster</p>
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="overflow-x-auto">
          {/* Header Row - Manager Names */}
          <div className="grid gap-2 min-w-[640px]" style={{ gridTemplateColumns: `repeat(${managers.length}, minmax(80px, 1fr))` }}>
            {managers.map(manager => (
              <button
                key={manager.id}
                onClick={() => navigate(`/team/${manager.id}`)}
                className="text-center py-2 px-1 bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/30 transition-colors"
              >
                <span className="text-xs font-bold text-primary truncate block">
                  {manager.teamName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {manager.wins}W - {manager.losses}L
                </span>
              </button>
            ))}
          </div>

          {/* Roster Grid */}
          <div className="mt-2 space-y-1">
            {Array.from({ length: totalRosterSize }, (_, rowIdx) => (
              <div 
                key={rowIdx}
                className="grid gap-2 min-w-[640px]"
                style={{ gridTemplateColumns: `repeat(${managers.length}, minmax(80px, 1fr))` }}
              >
                {managers.map(manager => {
                  const slots = getRosterSlots(manager);
                  const slot = slots[rowIdx];
                  
                  return (
                    <RosterCell
                      key={`${manager.id}-${rowIdx}`}
                      player={slot.player}
                      slotLabel={slot.label}
                      isBench={slot.isBench}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
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
      </main>

      <BottomNav />
    </div>
  );
};

export default Roster;
