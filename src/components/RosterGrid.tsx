import { Manager, Player } from '@/lib/supabase-types';
import { getActiveRosterSlots, sortPlayersByRole, SlotRequirement, LeagueConfig } from '@/lib/roster-validation';
import { RosterCell } from './RosterCell';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

interface RosterGridProps {
    manager: Manager;
    config: LeagueConfig;
    players: Player[];
    onPlayerClick?: (player: Player) => void;
    compact?: boolean;
}

export const RosterGrid = ({ manager, config, players, onPlayerClick, compact = false }: RosterGridProps) => {
    // Get roster slots logic (extracted/duplicated from Roster.tsx for now, ideally shared)
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
                role: 'Any Position',
                label: 'Reserve',
                filled: false,
            });
        }

        return { activeSlots, benchSlots };
    };

    const { activeSlots, benchSlots } = getRosterSlots(manager);

    const Container = compact ? ScrollArea : "div";

    return (
        <div className={cn("flex flex-col gap-2", compact ? "h-full" : "")}>
            <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-1")}>
                {/* Active Squad */}
                {activeSlots.map((slot, index) => (
                    <RosterCell
                        key={`active-${index}`}
                        slot={slot}
                        onClick={() => slot.player && onPlayerClick?.(slot.player)}
                    />
                ))}

                {/* Bench */}
                {benchSlots.map((slot, index) => (
                    <RosterCell
                        key={`bench-${index}`}
                        slot={slot}
                        isBench
                        onClick={() => slot.player && onPlayerClick?.(slot.player)}
                    />
                ))}
            </div>
        </div>
    );
};
