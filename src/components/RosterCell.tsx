import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getTeamColors } from '@/lib/team-colors';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPlayerAvatarUrl, getPlayerInitials } from "@/lib/player-utils";
import { SlotRequirement } from '@/lib/roster-validation';

// Role to abbreviation mapping
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
    onClick?: () => void;
}

export const RosterCell = ({ slot, isBench, onClick }: RosterCellProps) => {
    const player = slot.player || null;
    const colors = player ? getTeamColors(player.team) : null;

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative min-h-[80px] p-2 border rounded-lg transition-all overflow-hidden",
                !player && "bg-muted/50 border-border text-muted-foreground border-dashed",
                player && "cursor-pointer hover:ring-2 hover:ring-primary/50"
            )}
            style={player && colors ? {
                backgroundColor: colors.raw,
                borderColor: colors.raw,
            } : {}}
        >
            {/* Background Gradient for depth */}
            {player && colors && (
                <div className={cn("absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/20 pointer-events-none")} />
            )}

            {/* Slot indicator for bench */}
            {isBench && (
                <div className="absolute top-1 right-1 text-[10px] font-bold opacity-60 z-10">
                    B
                </div>
            )}

            {/* International player icon */}
            {player?.isInternational && (
                <div className="absolute top-1 left-1 z-10">
                    <Plane className="w-3 h-3 opacity-80" />
                </div>
            )}

            {player ? (
                <div className="pt-1 flex flex-col items-center justify-center text-center relative z-0">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 mb-1 border-2 border-white/20 shadow-sm">
                        <AvatarImage
                            src={getPlayerAvatarUrl(player.imageId, 'thumb')}
                            alt={player.name}
                            className="object-cover"
                        />
                        <AvatarFallback className="text-[10px] font-bold bg-black/20 text-white/80">
                            {getPlayerInitials(player.name)}
                        </AvatarFallback>
                    </Avatar>

                    <p className={cn(
                        "font-medium text-[10px] truncate leading-tight w-full opacity-90",
                        colors?.text
                    )}>
                        {player.name.split(' ')[0]}
                    </p>
                    <p className={cn(
                        "font-bold text-xs truncate leading-tight w-full",
                        colors?.text
                    )}>
                        {player.name.split(' ').slice(1).join(' ')}
                    </p>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[8px] px-1 py-0 mt-1 font-semibold border"
                        )}
                        style={{
                            backgroundColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                            borderColor: colors?.text === 'text-white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                            color: colors?.text === 'text-white' ? 'white' : 'black'
                        }}
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
