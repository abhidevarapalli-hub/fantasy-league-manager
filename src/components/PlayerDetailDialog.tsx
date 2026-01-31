
import React, { useMemo } from 'react';
import { Loader2, Plane, Calendar, Clock, ChevronRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { TournamentPlayer } from '@/lib/cricket-types';
import { TournamentType, getTournamentById, SUPPORTED_TOURNAMENTS } from '@/lib/tournaments';
import { usePlayerInfo, usePlayerSchedule, useExtendedPlayer, PlayerMatchPerformance } from '@/hooks/usePlayerDetails';
import { getPlayerAvatarUrl, getPlayerTeamForTournament, TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { getTeamColors } from '@/lib/team-colors';
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-types';

interface PlayerDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    player: Player & {
        role: string;
        isInternational?: boolean;
    };
    tournamentPlayer?: TournamentPlayer | null;
    seriesId?: number | null;
    matchStats?: PlayerMatchPerformance[];
}

const calculateFantasyPoints = (stats: PlayerMatchPerformance) => {
    let points = 0;
    const rules = DEFAULT_SCORING_RULES;

    // Basic points
    points += rules.common.starting11; // Assume they started if they have stats

    // Batting
    if (stats.runs !== undefined) {
        points += stats.runs * rules.batting.runs;
        points += (stats.fours || 0) * rules.batting.four;
        points += (stats.sixes || 0) * rules.batting.six;

        // Milestones
        if (stats.runs >= 100) points += 40; // Century
        else if (stats.runs >= 50) points += 20; // Half century

        // Duck
        if (stats.runs === 0 && !stats.isNotOut) points += rules.batting.duckDismissal;
    }

    // Bowling
    if (stats.wickets !== undefined) {
        points += stats.wickets * rules.bowling.wickets;

        // Milestones
        if (stats.wickets >= 5) points += 40; // 5-fer
        else if (stats.wickets >= 4) points += 30; // 4-fer
        else if (stats.wickets >= 3) points += 20; // 3-fer

        // Economy bonus (rough estimate if overs unavailable, assume 4 overs max)
        const overs = stats.overs || 0;
        if (overs >= 2 && stats.economy) {
            if (stats.economy < 5) points += 20;
            else if (stats.economy < 6) points += 10;
        }

        // Maiden
        if (stats.maidens) points += stats.maidens * rules.bowling.maidenOver;
    }

    return points;
};

export function PlayerDetailDialog({
    open,
    onOpenChange,
    player,
    tournamentPlayer,
    seriesId,
    matchStats = [],
}: PlayerDetailDialogProps) {
    // First, try to get extended player data from our database
    // This has the cricbuzz_id and image_id we need
    const { data: extendedData, isLoading: isLoadingExtended } = useExtendedPlayer(player?.id);

    // Debug Log when component renders or props change
    React.useEffect(() => {
        if (open) {
            console.log(`[TRACE] PlayerDetailDialog OPEN for: ${player.name} (ID: ${player.id})`);
            console.log('[TRACE] TournamentPlayer prop:', tournamentPlayer);
        }
    }, [open, player, tournamentPlayer]);

    React.useEffect(() => {
        if (open && !isLoadingExtended) {
            console.log('[TRACE] extendedData from DB:', extendedData);
        }
    }, [open, isLoadingExtended, extendedData]);

    // Get the Cricbuzz ID from either:
    // 1. tournamentPlayer prop (if provided)
    // 2. Extended player data from database
    const cricbuzzId = tournamentPlayer?.id || extendedData?.cricbuzzId || null;

    if (!player) return null;

    if (open && cricbuzzId) {
        // This will trigger the usePlayerInfo hook
        console.log(`[TRACE] Resolved Cricbuzz ID: ${cricbuzzId}. Triggers usePlayerInfo...`);
    } else if (open && !isLoadingExtended && !cricbuzzId) {
        console.warn(`[TRACE] ⚠️ Could not resolve Cricbuzz ID for ${player.name}. Hook will SKIP.`);
    }

    const isNationalTeam = useMemo(() => {
        return player.team in TEAM_SHORT_TO_COUNTRY;
    }, [player]);

    const effectiveSeriesId = useMemo(() => {
        if (seriesId) return seriesId;
        if (isNationalTeam) {
            const intlTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'international');
            return intlTournament?.id || null;
        } else {
            const leagueTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'league');
            return leagueTournament?.id || null;
        }
    }, [seriesId, isNationalTeam]);

    const tournamentType = useMemo(() => {
        if (!effectiveSeriesId) return 'league';
        const tournament = getTournamentById(effectiveSeriesId);
        return tournament?.type || 'league';
    }, [effectiveSeriesId]);

    const playerTeamShort = useMemo(() => {
        return getPlayerTeamForTournament(
            player.team,
            player.isInternational,
            tournamentType,
            undefined
        );
    }, [player, tournamentType]);

    const { data: playerSchedule } = usePlayerSchedule(
        effectiveSeriesId,
        playerTeamShort
    );

    const teamColors = getTeamColors(player.team);
    const imageId = tournamentPlayer?.imageId || extendedData?.imageId;

    // Define Sections and Columns dynamically based on Role
    const sections = useMemo(() => {
        const isWK = player.role === 'Wicket Keeper';

        // Define column widths (matches tailwind classes logic)
        // w-10 = 40px, w-8 = 32px, w-12 = 48px, w-14 = 56px

        const battingCols = [
            { label: 'RUN', key: 'runs', w: 'w-10', px: 40 },
            { label: 'BALL', key: 'ballsFaced', w: 'w-10', px: 40 },
            { label: '4S', key: 'fours', w: 'w-8', px: 32 },
            { label: '6S', key: 'sixes', w: 'w-8', px: 32 },
            { label: 'SR', key: 'strikeRate', w: 'w-12', px: 48 },
        ];

        const bowlingCols = [
            { label: 'WKT', key: 'wickets', w: 'w-10', px: 40 },
            { label: 'RUN', key: 'runsConceded', w: 'w-10', px: 40 },
            { label: 'OVR', key: 'overs', w: 'w-10', px: 40 },
            { label: 'ECON', key: 'economy', w: 'w-12', px: 48 },
        ];

        // Fielding columns
        const fieldingCols = [
            { label: 'CT', key: 'catches', w: 'w-8', px: 32 },
            { label: 'RO', key: 'runOuts', w: 'w-8', px: 32 },
        ];
        if (isWK) {
            fieldingCols.push({ label: 'ST', key: 'stumpings', w: 'w-8', px: 32 });
        }

        const battingSection = { id: 'batting', label: 'BATTING', cols: battingCols, color: 'bg-emerald-500/5 text-emerald-600', width: battingCols.reduce((a, b) => a + b.px, 0) };
        const bowlingSection = { id: 'bowling', label: 'BOWLING', cols: bowlingCols, color: 'bg-rose-500/5 text-rose-600', width: bowlingCols.reduce((a, b) => a + b.px, 0) };
        const fieldingSection = { id: 'fielding', label: 'FIELDING', cols: fieldingCols, color: 'bg-amber-500/5 text-amber-600', width: fieldingCols.reduce((a, b) => a + b.px, 0) };

        // Determine Order
        if (player.role === 'Bowler') return [bowlingSection, fieldingSection, battingSection];
        if (player.role === 'All Rounder') return [battingSection, bowlingSection, fieldingSection];

        // Default (Batsman, Wicket Keeper)
        return [battingSection, fieldingSection, bowlingSection];
    }, [player.role]);

    // Combine match stats and schedule
    const unifiedMatches = useMemo(() => {
        if (!playerSchedule || playerSchedule.length === 0) return matchStats;
        return playerSchedule;
    }, [playerSchedule, matchStats]);



    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-0 bg-transparent shadow-none z-[100]">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[#0f1014] rounded-xl overflow-hidden">
                    {/* Header Background Gradient */}
                    <div className={cn("absolute inset-x-0 top-0 h-48 bg-gradient-to-b opacity-20", teamColors.bg)} />
                </div>
                <DialogDescription className="sr-only">Player details and statistics for {player.name}</DialogDescription>
                {/* Header Section */}
                <div
                    className={cn(
                        "relative p-6 flex-shrink-0 flex flex-col items-center justify-center text-center transition-colors duration-500",
                        teamColors.bg === 'bg-muted' ? "bg-muted/30" : ""
                    )}
                    style={teamColors.bg !== 'bg-muted' ? {
                        backgroundColor: teamColors.raw,
                    } : {}}
                >
                    {/* Close button is handled by DialogContent default */}

                    {/* Avatar and Info */}
                    <div className="relative mb-6">
                        <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-white/20 shadow-xl">
                            <AvatarImage
                                src={getPlayerAvatarUrl(imageId, 'de')}
                                alt={player.name}
                                className="object-cover"
                            />
                            <AvatarFallback className="text-xl font-bold bg-muted/20 text-foreground/50">
                                {player.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <Badge
                            className={cn(
                                "absolute -bottom-3 left-1/2 -translate-x-1/2 uppercase text-[10px] tracking-wider border-white/20 shadow-sm pointer-events-none whitespace-nowrap z-10",
                                teamColors.text
                            )}
                            variant="secondary"
                        >
                            {player.role}
                        </Badge>
                    </div>

                    <DialogTitle className={cn("text-xl md:text-2xl font-bold mb-1", teamColors.text)}>
                        {player.name}
                    </DialogTitle>

                    <div className={cn("text-xs md:text-sm font-medium opacity-80", teamColors.text)}>
                        {player.team}
                    </div>
                </div>

                {/* Content Section */}
                <div className="bg-card flex-1 flex flex-col min-h-0">
                    <div className="p-3 border-b flex-shrink-0 flex items-center justify-between bg-muted/5">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            Game Log
                        </h3>
                    </div>

                    <ScrollArea className="flex-1 w-full">
                        <div className="p-0">
                            <div className="min-w-max">
                                {/* Unified Grid Table */}
                                <div className="grid text-xs text-center border-b border-border/50">
                                    {/* Header Row 1 - Groups */}
                                    <div className="flex bg-muted/30 font-semibold text-muted-foreground sticky top-0 z-20 shadow-sm border-b border-border/50">
                                        <div className="w-[180px] h-8 flex items-center px-4 border-r border-border/50 text-left">MATCH</div>
                                        <div className="w-[80px] h-8 flex items-center justify-center border-r border-border/50 bg-muted/50 text-foreground">FANTASY</div>

                                        {sections.map(section => (
                                            <div
                                                key={section.id}
                                                className={cn("h-8 flex items-center justify-center border-r border-border/50 last:border-r-0", section.color)}
                                                style={{ width: `${section.width}px` }}
                                            >
                                                {section.label}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Header Row 2 - Columns */}
                                    <div className="flex bg-muted/10 font-bold border-t border-border/50 sticky top-[28px] z-10 shadow-sm">
                                        {/* Match Columns */}
                                        <div className="w-[30px] py-2 border-r border-border/50">WK</div>
                                        <div className="w-[150px] py-2 border-r border-border/50 text-left px-3">OPP</div>

                                        {/* Fantasy Columns */}
                                        <div className="w-[80px] py-2 border-r border-border/50 bg-muted/30">FPTS</div>

                                        {/* Dynamic Columns */}
                                        {sections.map(section => (
                                            <React.Fragment key={section.id}>
                                                {section.cols.map(col => (
                                                    <div
                                                        key={col.label}
                                                        className={cn(col.w, "py-2 border-r border-border/50 last:border-r-0")}
                                                    >
                                                        {col.label}
                                                    </div>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Data Rows */}
                                    {unifiedMatches.length > 0 ? unifiedMatches.map((matchItem, index) => {
                                        // Try to find detailed stats for this match if it exists in matchStats
                                        const stats = matchStats.find(s => s.matchId === matchItem.matchId) ||
                                            (matchItem as any).runs !== undefined ? matchItem : undefined;

                                        const hasStats = !!stats;
                                        const fpts = hasStats ? calculateFantasyPoints(stats as PlayerMatchPerformance) : 0;

                                        const matchDate = matchItem.matchDate;
                                        const opponentShort = matchItem.opponentShort;
                                        const isUpcoming = (matchItem as any).isUpcoming;
                                        const result = (matchItem as any).result;

                                        // Week number
                                        const weekNum = index + 1;

                                        return (
                                            <div
                                                key={matchItem.matchId || index}
                                                className={cn(
                                                    "flex hover:bg-muted/50 transition-colors border-b border-border/30",
                                                    index % 2 === 0 ? "bg-background" : "bg-muted/10", // Alternating rows
                                                    isUpcoming && "opacity-70 bg-muted/5"
                                                )}
                                            >
                                                {/* Match Info */}
                                                <div className="w-[30px] py-2 border-r border-border/50 items-center justify-center flex text-muted-foreground font-mono text-[10px]">
                                                    {weekNum}
                                                </div>
                                                <div className="w-[150px] py-2 border-r border-border/50 text-left px-3 flex flex-col justify-center">
                                                    <span className="font-semibold text-foreground flex items-center justify-between">
                                                        <span>vs {opponentShort}</span>
                                                        {isUpcoming && (
                                                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground border px-1 rounded">Upcoming</span>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {isUpcoming ? (
                                                            matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                        ) : (
                                                            result || matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Fantasy Points */}
                                                <div className="w-[80px] py-2 border-r border-border/50 bg-muted/20 font-bold text-primary flex items-center justify-center text-sm">
                                                    {hasStats ? fpts.toFixed(1) : '-'}
                                                </div>

                                                {/* Dynamic Data Columns */}
                                                {sections.map(section => (
                                                    <React.Fragment key={section.id}>
                                                        {section.cols.map(col => {
                                                            // Extract value safely
                                                            let val: string | number | undefined = '-';
                                                            if (hasStats && stats) {
                                                                val = (stats as any)[col.key];

                                                                // Formatting
                                                                if (val === undefined || val === null) val = '-';
                                                                else if (col.key === 'strikeRate' || col.key === 'economy') val = (val as number).toFixed(1);
                                                                else if (col.key === 'runs' && section.id === 'batting' && (val as number) >= 30) {
                                                                    // Highlight high runs
                                                                    return (
                                                                        <div key={col.key} className={cn(col.w, "py-2 border-r border-border/50 flex items-center justify-center")}>
                                                                            <span className="text-foreground font-semibold">{val}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                else if (col.key === 'wickets' && (val as number) >= 2) {
                                                                    // Highlight high wickets
                                                                    return (
                                                                        <div key={col.key} className={cn(col.w, "py-2 border-r border-border/50 flex items-center justify-center")}>
                                                                            <span className="text-foreground font-semibold">{val}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                else if (col.key === 'overs' && !val) {
                                                                    val = '-';
                                                                }
                                                            }

                                                            return (
                                                                <div
                                                                    key={col.key}
                                                                    className={cn(col.w, "py-2 border-r border-border/50 flex items-center justify-center text-muted-foreground")}
                                                                >
                                                                    {isUpcoming ? '' : (hasStats ? val : '-')}
                                                                </div>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        );
                                    }) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <Clock className="h-12 w-12 text-muted-foreground/20 mb-3" />
                                            <p className="text-muted-foreground font-medium">No played matches yet</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">Season has not started or player played no games</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
