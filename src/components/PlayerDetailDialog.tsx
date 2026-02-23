import React, { useMemo } from 'react';
import { Plane, Clock, Plus, Minus, ArrowLeftRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { TournamentPlayer } from '@/lib/cricket-types';
import { getTournamentById, SUPPORTED_TOURNAMENTS } from '@/lib/tournaments';
import { usePlayerSchedule, useExtendedPlayer, usePlayerMatchStats, PlayerMatchPerformance } from '@/hooks/usePlayerDetails';
import { getPlayerAvatarUrl, getPlayerTeamForTournament, TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { getTeamColors } from '@/lib/team-colors';
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-types';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';

/** Extended player data with optional fields from DB/API */
interface ExtendedPlayer extends Player {
    dateOfBirth?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    height?: string;
}

/** Unified match data combining schedule info with match stats */
interface UnifiedMatchData extends PlayerMatchPerformance {
    week?: number;
}

interface PlayerDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    player: ExtendedPlayer;
    tournamentPlayer?: TournamentPlayer | null;
    seriesId?: number | null;
    matchStats?: PlayerMatchPerformance[];
    onAdd?: () => void;
    onDrop?: () => void;
    onTrade?: () => void;
    onDraft?: () => void;
}

import { calculateFantasyPoints } from '@/lib/scoring-utils';

export function PlayerDetailDialog({
    open,
    onOpenChange,
    player,
    tournamentPlayer,
    seriesId,
    matchStats = [],
    onAdd,
    onDrop,
    onTrade,
    onDraft,
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

    if (open && cricbuzzId) {
        // This will trigger the usePlayerInfo hook
        console.log(`[TRACE] Resolved Cricbuzz ID: ${cricbuzzId}. Triggers usePlayerInfo...`);
    } else if (open && !isLoadingExtended && !cricbuzzId && player) {
        console.warn(`[TRACE] ⚠️ Could not resolve Cricbuzz ID for ${player.name}. Hook will SKIP.`);
    }

    const isNationalTeam = useMemo(() => {
        return player ? player.team in TEAM_SHORT_TO_COUNTRY : false;
    }, [player]);

    const effectiveSeriesId = useMemo(() => {
        if (!player) return null;
        if (seriesId) return seriesId;
        if (isNationalTeam) {
            const intlTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'international');
            return intlTournament?.id || null;
        } else {
            const leagueTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'league');
            return leagueTournament?.id || null;
        }
    }, [seriesId, isNationalTeam, player]);

    const tournamentType = useMemo(() => {
        if (!effectiveSeriesId) return 'league';
        const tournament = getTournamentById(effectiveSeriesId);
        return tournament?.type || 'league';
    }, [effectiveSeriesId]);

    const playerTeamShort = useMemo(() => {
        if (!player) return undefined;
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

    const { currentLeagueId, draftState, draftPicks } = useGameStore();
    const { data: playerStatsMap } = usePlayerMatchStats(player?.id, currentLeagueId);

    const teamColors = getTeamColors(player?.team || 'OTHER');
    const imageId = tournamentPlayer?.imageId || extendedData?.imageId;

    const { managers } = useGameStore();

    const isDraftActive = useMemo(() => {
        return draftState?.isActive && !draftState?.isFinalized;
    }, [draftState]);

    const owningManager = useMemo(() => {
        if (!player) return null;

        // During an active draft, trust draftPicks as the source of truth for ownership
        if (isDraftActive) {
            const pick = draftPicks.find(p => p.playerId === player.id);
            if (pick) {
                return managers.find(m => m.id === pick.managerId) || null;
            }
            return null;
        }

        return managers.find(m => m.activeRoster?.includes(player.id) || m.bench?.includes(player.id));
    }, [managers, player, draftPicks, isDraftActive]);

    const managerProfile = useAuthStore(state => state.managerProfile);

    const isDrafted = useMemo(() => {
        if (!player) return false;
        if (isDraftActive) {
            return draftPicks.some(p => p.playerId === player.id);
        }
        return managers.some(m => m.activeRoster?.includes(player.id) || m.bench?.includes(player.id));
    }, [managers, player, draftPicks, isDraftActive]);

    const isMyTurn = useMemo(() => {
        if (!managerProfile || !draftState) return false;
        // In the draft feature, we usually have draftOrder to determine which manager is at which position
        const { draftOrder } = useGameStore.getState();
        const currentActiveManagerId = draftOrder.find(o => o.position === draftState.currentPosition)?.managerId;
        return currentActiveManagerId === managerProfile.id;
    }, [managerProfile, draftState]);

    const canDraft = useMemo(() => {
        return draftState?.isActive && !draftState?.isFinalized && isMyTurn && !isDrafted;
    }, [draftState, isMyTurn, isDrafted]);

    // Define Sections and Columns dynamically based on Role
    const sections = useMemo(() => {
        if (!player) return [];
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
    }, [player]);

    // Combine schedule with actual stats from player_match_stats DB table
    const unifiedMatches: UnifiedMatchData[] = useMemo(() => {
        const schedule = playerSchedule && playerSchedule.length > 0 ? playerSchedule : matchStats;
        if (!playerStatsMap || playerStatsMap.size === 0) return schedule as UnifiedMatchData[];

        // Merge DB stats into each schedule entry by cricbuzz_match_id
        return schedule.map(match => {
            const dbStats = playerStatsMap.get(match.matchId);
            if (!dbStats) return match;
            return { ...match, ...dbStats, matchId: match.matchId, matchDate: match.matchDate, opponent: match.opponent, opponentShort: match.opponentShort, venue: match.venue, result: match.result, isUpcoming: match.isUpcoming, week: (match as UnifiedMatchData).week };
        });
    }, [playerSchedule, matchStats, playerStatsMap]);

    if (!player) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-4xl p-0 gap-0 overflow-hidden border-0 bg-transparent shadow-none h-auto max-h-[90vh] z-[100] flex flex-col md:flex-row rounded-2xl"
                onInteractOutside={(e) => {
                    // Only prevent default if we're dealing with something specific, otherwise allow the interact outside to close it
                    if (onOpenChange) onOpenChange(false);
                }}
            >
                <div className="relative flex flex-col w-full h-full max-h-[90vh] bg-background md:bg-[#0f1014] rounded-2xl overflow-hidden border border-border/50 shadow-2xl">

                    {/* Visual Close Button for Mobile Accessibility */}
                    <button
                        onClick={() => onOpenChange && onOpenChange(false)}
                        className="md:hidden absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-colors border border-white/20 shadow-xl"
                        aria-label="Close dialog"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>

                    <DialogDescription className="sr-only">Player details and statistics for {player.name}</DialogDescription>

                    {/* Header Section */}
                    <div
                        className={cn(
                            "relative flex flex-col md:flex-row items-end md:items-stretch transition-colors duration-500 overflow-hidden flex-shrink-0 pt-14 md:pt-0 border-b border-border/10",
                            teamColors.bg === 'bg-muted' ? "bg-muted/30" : ""
                        )}
                        style={teamColors.bg !== 'bg-muted' ? {
                            backgroundColor: teamColors.raw,
                        } : {}}
                    >
                        {/* Background subtle gradient for depth */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-0" />
                        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none z-0" />

                        {/* Top Bar for Mobile (Tags) */}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30 md:hidden">
                            <div className="flex flex-col gap-1.5">
                                <Badge
                                    className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-black/50 backdrop-blur-md border border-white/20 text-white"
                                    variant="secondary"
                                >
                                    {player.role}
                                </Badge>
                                {owningManager ? (
                                    <Badge
                                        className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-indigo-500/80 backdrop-blur-md border border-indigo-300/30 text-white"
                                        variant="secondary"
                                    >
                                        {owningManager.teamName}
                                    </Badge>
                                ) : (
                                    <Badge
                                        className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-emerald-500/80 backdrop-blur-md border border-emerald-300/30 text-white"
                                        variant="secondary"
                                    >
                                        Free Agent
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Player Image - Floating Cutout Style */}
                        <div className="relative w-full md:w-64 h-[180px] md:h-[260px] flex-shrink-0 flex items-end justify-center z-10 mx-auto md:mx-0 -mb-4 md:mb-0">
                            <img
                                src={getPlayerAvatarUrl(imageId, 'det')}
                                alt={player.name}
                                className="relative z-30 h-[120%] w-auto max-w-full object-contain object-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
                            />
                            {/* Bottom fade to blend image with content below on mobile */}
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent z-40 md:hidden" />
                        </div>

                        {/* Info and Metadata Grid */}
                        <div className="flex-1 w-full p-5 md:p-8 flex flex-col justify-end md:justify-center relative z-20 md:bg-gradient-to-l from-black/40 via-black/10 to-transparent">
                            {/* Desktop Tags (Hidden on Mobile) */}
                            <div className="hidden md:flex flex-wrap items-center gap-2 mb-3">
                                <Badge
                                    className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-black/40 backdrop-blur-sm border border-white/10 text-white"
                                    variant="secondary"
                                >
                                    {player.role}
                                </Badge>
                                {owningManager ? (
                                    <Badge
                                        className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-indigo-600/80 backdrop-blur-sm border border-indigo-400/30 text-white"
                                        variant="secondary"
                                    >
                                        {owningManager.teamName}
                                    </Badge>
                                ) : (
                                    <Badge
                                        className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-md pointer-events-none whitespace-nowrap bg-emerald-600/80 backdrop-blur-sm border border-emerald-400/30 text-white"
                                        variant="secondary"
                                    >
                                        Free Agent
                                    </Badge>
                                )}
                            </div>

                            <div className="mb-4 text-center md:text-left">
                                <DialogTitle className={cn(
                                    "text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-none drop-shadow-md mb-2 flex flex-col uppercase",
                                    teamColors.text
                                )}>
                                    {/* Split name if there's a space for dramatic visual effect on desktop */}
                                    {player.name.includes(' ') ? (
                                        <>
                                            <span className="text-xl md:text-2xl lg:text-3xl opacity-90">{player.name.substring(0, player.name.lastIndexOf(' '))}</span>
                                            <span>{player.name.substring(player.name.lastIndexOf(' ') + 1)}</span>
                                        </>
                                    ) : (
                                        <span>{player.name}</span>
                                    )}
                                </DialogTitle>

                                <div className={cn(
                                    "text-xs md:text-sm font-bold uppercase tracking-[0.2em] opacity-90 flex items-center justify-center md:justify-start gap-2 bg-black/20 inline-flex px-3 py-1 rounded-full backdrop-blur-md border border-white/10",
                                    teamColors.text
                                )}>
                                    <span>{player.team}</span>
                                    {player.isInternational && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                                            <span className="flex items-center gap-1">
                                                <Plane className="w-3.5 h-3.5" />
                                                INTL
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-4 gap-2 md:gap-6 border-t border-white/10 pt-4 mt-2">
                                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5 md:mb-1">Born</span>
                                    <span className="text-xs md:text-sm font-bold text-white tracking-tight">
                                        {player.dateOfBirth || extendedData?.dob || '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5 md:mb-1">Batting</span>
                                    <span className="text-xs md:text-sm font-bold text-white tracking-tight">
                                        {player.battingStyle || extendedData?.battingStyle || '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5 md:mb-1">Bowling</span>
                                    <span className="text-xs md:text-sm font-bold text-white tracking-tight truncate w-full">
                                        {player.bowlingStyle || extendedData?.bowlingStyle || '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5 md:mb-1">Height</span>
                                    <span className="text-xs md:text-sm font-bold text-white tracking-tight">
                                        {player.height || extendedData?.height || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="bg-background flex-1 flex flex-col min-h-0 relative z-30">
                        {/* Pseudo Tabs */}
                        <div className="flex items-center px-4 md:px-6 pt-4 border-b border-border/40">
                            <div className="px-4 pb-3 border-b-2 border-primary font-bold text-xs md:text-sm tracking-wide text-foreground uppercase cursor-pointer">
                                Game Log
                            </div>
                            <div className="px-4 pb-3 text-muted-foreground font-semibold text-xs md:text-sm tracking-wide uppercase hover:text-foreground transition-colors cursor-pointer">
                                Summary
                            </div>
                        </div>

                        <ScrollArea className="flex-1 w-full bg-background/50">
                            <div className="p-0">
                                <div className="min-w-[700px] md:min-w-full pb-4">
                                    {/* Year/Filter header */}
                                    <div className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/10">
                                        2025 Regular Season
                                    </div>

                                    {/* Unified Grid Table */}
                                    <div className="grid text-xs text-center border-b border-border/50">
                                        {/* Header Row 1 - Groups */}
                                        <div className="flex w-max bg-muted/30 font-bold text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-20 shadow-sm border-b border-border/50">
                                            <div className="w-[180px] flex-shrink-0 h-8 flex items-center justify-center border-r border-border/50 bg-background/95 backdrop-blur-sm">MATCH</div>
                                            <div className="w-[80px] flex-shrink-0 h-8 flex items-center justify-center border-r border-border/50 bg-indigo-500/10 text-indigo-400">FANTASY</div>

                                            {sections.map(section => (
                                                <div
                                                    key={section.id}
                                                    className={cn("flex-shrink-0 h-8 flex items-center justify-center border-r border-border/50 last:border-r-0", section.color)}
                                                    style={{ width: `${section.width}px` }}
                                                >
                                                    {section.label}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Header Row 2 - Columns */}
                                        <div className="flex w-max bg-background/95 backdrop-blur-sm font-bold border-b border-border/50 sticky top-[32px] z-10 shadow-sm text-[10px] md:text-xs">
                                            {/* Match Columns */}
                                            <div className="w-[40px] flex-shrink-0 py-2 border-r border-border/50 text-muted-foreground flex items-center justify-center">WK</div>
                                            <div className="w-[140px] flex-shrink-0 py-2 border-r border-border/50 text-left px-3 text-muted-foreground flex items-center">OPP</div>

                                            {/* Fantasy Columns */}
                                            <div className="w-[80px] flex-shrink-0 py-2 border-r border-border/50 bg-indigo-500/5 text-foreground flex items-center justify-center">FPTS</div>

                                            {/* Dynamic Columns */}
                                            {sections.map(section => (
                                                <React.Fragment key={section.id}>
                                                    {section.cols.map(col => (
                                                        <div
                                                            key={col.label}
                                                            className="flex-shrink-0 py-2 border-r border-border/50 last:border-r-0 text-foreground flex items-center justify-center"
                                                            style={{ width: `${col.px}px` }}
                                                        >
                                                            {col.label}
                                                        </div>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* Data Rows */}
                                        {unifiedMatches.length > 0 ? unifiedMatches.map((matchItem, index) => {
                                            // Stats are merged directly into matchItem from player_match_stats
                                            const hasStats = matchItem.runs !== undefined || matchItem.wickets !== undefined;
                                            const stats = hasStats ? matchItem : undefined;

                                            // Use DB fantasy_points if available, otherwise calculate
                                            const fpts = hasStats
                                                ? (matchItem.fantasyPoints ?? calculateFantasyPoints(stats as PlayerMatchPerformance))
                                                : 0;

                                            const matchDate = matchItem.matchDate;
                                            const opponentShort = matchItem.opponentShort;
                                            // If we have stats, the match is not upcoming regardless of stale state
                                            const isUpcoming = hasStats ? false : matchItem.isUpcoming;
                                            const result = matchItem.result;

                                            // Week number
                                            const weekNum = matchItem.week || index + 1;

                                            return (
                                                <div
                                                    key={matchItem.matchId || index}
                                                    className={cn(
                                                        "flex w-max hover:bg-muted/50 transition-colors border-b border-border/30",
                                                        index % 2 === 0 ? "bg-background" : "bg-muted/10", // Alternating rows
                                                        isUpcoming && "opacity-70 bg-muted/5"
                                                    )}
                                                >
                                                    {/* Match Info */}
                                                    <div className="w-[40px] flex-shrink-0 py-2 border-r border-border/50 items-center justify-center flex text-muted-foreground font-mono text-[10px]">
                                                        {weekNum}
                                                    </div>
                                                    <div className="w-[140px] flex-shrink-0 py-2 border-r border-border/50 text-left px-3 flex flex-col justify-center">
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
                                                    <div className="w-[80px] flex-shrink-0 py-2 border-r border-border/50 bg-muted/20 font-bold text-primary flex items-center justify-center text-sm">
                                                        {hasStats ? fpts.toFixed(1) : (isUpcoming ? '' : 'DNP')}
                                                    </div>

                                                    {/* Dynamic Data Columns */}
                                                    {sections.map(section => (
                                                        <React.Fragment key={section.id}>
                                                            {section.cols.map(col => {
                                                                // Extract value safely
                                                                let val: string | number | undefined = '-';
                                                                if (hasStats && stats) {
                                                                    val = (stats as unknown as Record<string, string | number | undefined>)[col.key];

                                                                    // Formatting
                                                                    if (val === undefined || val === null) val = '-';
                                                                    else if (col.key === 'strikeRate' || col.key === 'economy') val = (val as number).toFixed(1);
                                                                    else if (col.key === 'runs' && section.id === 'batting' && (val as number) >= 30) {
                                                                        // Highlight high runs
                                                                        return (
                                                                            <div key={col.key} className="flex-shrink-0 py-2 border-r border-border/50 flex items-center justify-center" style={{ width: `${col.px}px` }}>
                                                                                <span className="text-foreground font-semibold">{val}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    else if (col.key === 'wickets' && (val as number) >= 2) {
                                                                        // Highlight high wickets
                                                                        return (
                                                                            <div key={col.key} className="flex-shrink-0 py-2 border-r border-border/50 flex items-center justify-center" style={{ width: `${col.px}px` }}>
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
                                                                        className="flex-shrink-0 py-2 border-r border-border/50 flex items-center justify-center text-muted-foreground"
                                                                        style={{ width: `${col.px}px` }}
                                                                    >
                                                                        {isUpcoming ? '' : (hasStats ? val : 'DNP')}
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

                        {/* Action Bar */}
                        {(onAdd || onDrop || onTrade || (canDraft && onDraft)) && (
                            <div className="p-4 md:p-6 bg-background/95 backdrop-blur-xl border-t border-border/20 flex flex-col sm:flex-row gap-3 flex-shrink-0 z-40 sticky bottom-0 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                                {/* Draft Case */}
                                {canDraft && onDraft && (
                                    <Button
                                        onClick={onDraft}
                                        className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 md:h-14 rounded-full text-sm md:text-base shadow-lg shadow-emerald-500/20 w-full"
                                    >
                                        <Plus className="w-5 h-5" />
                                        DRAFT PLAYER
                                    </Button>
                                )}

                                {/* Free Agent Case */}
                                {!owningManager && onAdd && !canDraft && (
                                    <Button
                                        onClick={onAdd}
                                        className="flex-1 gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold h-12 md:h-14 rounded-full text-sm md:text-base shadow-lg shadow-indigo-500/20 w-full"
                                    >
                                        <Plus className="w-5 h-5" />
                                        ADD PLAYER
                                    </Button>
                                )}

                                {/* Owned by Current User Case */}
                                {owningManager && managerProfile && owningManager.id === managerProfile.id && onDrop && (
                                    <Button
                                        onClick={onDrop}
                                        variant="destructive"
                                        className="flex-1 gap-2 font-bold h-12 md:h-14 rounded-full text-sm md:text-base shadow-lg shadow-red-500/20 w-full"
                                    >
                                        <Minus className="w-5 h-5" />
                                        DROP PLAYER
                                    </Button>
                                )}

                                {/* Owned by Someone Else Case */}
                                {owningManager && managerProfile && owningManager.id !== managerProfile.id && onTrade && (
                                    <Button
                                        onClick={onTrade}
                                        className="flex-1 gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-bold h-12 md:h-14 rounded-full text-sm md:text-base shadow-lg w-full"
                                    >
                                        <ArrowLeftRight className="w-5 h-5" />
                                        TRADE PLAYER
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
