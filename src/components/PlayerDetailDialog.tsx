import React, { useMemo } from 'react';
import { Plane, Clock, Plus, Minus, ArrowLeftRight } from 'lucide-react';
import { calculateFantasyPoints, PlayerStats } from '@/lib/fantasy-points-calculator';
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
import { Player, Manager } from '@/lib/supabase-types';
import { TournamentPlayer } from '@/lib/cricket-types';
import { getTournamentById, SUPPORTED_TOURNAMENTS } from '@/lib/tournaments';
import { usePlayerSchedule, useExtendedPlayer, usePlayerMatchStats, PlayerMatchPerformance } from '@/hooks/usePlayerDetails';
import { getPlayerAvatarUrl, getPlayerTeamForTournament, TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { getTeamColors } from '@/lib/team-colors';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { DraftTimer, DraftTimerProps } from '@/components/DraftTimer';
import { DraftState, DraftPick } from '@/lib/draft-types';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer';

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
    draftTimerProps?: DraftTimerProps;
    // Overrides for Mock Draft
    draftState?: DraftState;
    draftPicks?: DraftPick[];
    managers?: Manager[];
    isMyTurn?: boolean;
}

/** Stat Row Component for breakdown */
const StatRow = ({ label, value, color }: { label: string; value: number | string; color?: string }) => (
    <div className="flex justify-between items-center bg-white/[0.02] px-3 py-2 rounded-lg border border-white/5">
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{label}</span>
        <span className={cn("text-xs font-black", color || "text-white/80")}>
            {typeof value === 'number' ? (value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)) : value}
        </span>
    </div>
);

// Helper to coerce a partial scorecard to the PlayerStats format required for calculation
const getPlayerStatsForCalc = (stats: PlayerMatchPerformance | undefined | null): PlayerStats => {
    return {
        runs: stats?.runs || 0,
        ballsFaced: stats?.ballsFaced || 0,
        fours: stats?.fours || 0,
        sixes: stats?.sixes || 0,
        isOut: stats?.isNotOut !== undefined ? !stats.isNotOut : false,
        overs: stats?.overs || 0,
        maidens: stats?.maidens || 0,
        runsConceded: stats?.runsConceded || 0,
        wickets: stats?.wickets || 0,
        dots: stats?.dots || 0,
        wides: stats?.wides || 0,
        noBalls: stats?.noBalls || 0,
        lbwBowledCount: stats?.lbwBowledCount || 0,
        catches: stats?.catches || 0,
        stumpings: stats?.stumpings || 0,
        runOuts: stats?.runOuts || 0,
        isInPlaying11: stats?.isInPlaying11 ?? true,
        isImpactPlayer: stats?.isImpactPlayer ?? false,
        isManOfMatch: stats?.isManOfMatch ?? false,
        teamWon: stats?.teamWon ?? false,
    };
};

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
    draftTimerProps,
    draftState: propsDraftState,
    draftPicks: propsDraftPicks,
    managers: propsManagers,
    isMyTurn: propsIsMyTurn,
}: PlayerDetailDialogProps) {
    // First, try to get extended player data from our database
    // This has the cricbuzz_id and image_id we need
    const { data: extendedData, isLoading: isLoadingExtended } = useExtendedPlayer(player?.id);

    const cricbuzzId = tournamentPlayer?.id || extendedData?.cricbuzzId || null;

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
        const resolved = getPlayerTeamForTournament(
            player.team,
            player.isInternational,
            tournamentType,
            undefined
        );

        return resolved;
    }, [player, tournamentType]);

    const { data: playerSchedule } = usePlayerSchedule(
        effectiveSeriesId,
        playerTeamShort
    );

    const { currentLeagueId, draftState: storeDraftState, draftPicks: storeDraftPicks, scoringRules } = useGameStore();
    const draftState = propsDraftState || storeDraftState;
    const draftPicks = propsDraftPicks || storeDraftPicks;
    const { data: playerStatsMap } = usePlayerMatchStats(player?.id, currentLeagueId);

    const teamColors = getTeamColors(player?.team || 'OTHER');
    const imageId = tournamentPlayer?.imageId || extendedData?.imageId;

    const { managers: storeManagers } = useGameStore();
    const managers = propsManagers || storeManagers;

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
        if (propsIsMyTurn !== undefined) return propsIsMyTurn;
        if (!managerProfile || !draftState) return false;
        // In the draft feature, we usually have draftOrder to determine which manager is at which position
        const { draftOrder } = useGameStore.getState();
        const currentActiveManagerId = draftOrder.find(o => o.position === draftState.currentPosition)?.managerId;
        return currentActiveManagerId === managerProfile.id;
    }, [managerProfile, draftState, propsIsMyTurn]);

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
        if (!player) return [];
        const schedule = playerSchedule && playerSchedule.length > 0 ? playerSchedule : matchStats;

        // If we have a schedule, merge DB stats into it
        if (schedule && schedule.length > 0) {
            if (!playerStatsMap || playerStatsMap.size === 0) return schedule as UnifiedMatchData[];
            return schedule.map(match => {
                const dbStats = playerStatsMap.get(match.matchId);
                if (!dbStats) return match;
                return {
                    ...match,
                    ...dbStats,
                    matchId: match.matchId,
                    matchDate: match.matchDate,
                    opponent: match.opponent,
                    opponentShort: match.opponentShort,
                    venue: match.venue,
                    result: match.result,
                    isUpcoming: match.isUpcoming,
                    week: (match as UnifiedMatchData).week,
                    matchState: dbStats.matchState || match.matchState,
                    isLiveStats: dbStats.isLiveStats || false
                };
            });
        }

        // No schedule available — use DB stats as the source
        if (playerStatsMap && playerStatsMap.size > 0) {
            return Array.from(playerStatsMap.values()) as UnifiedMatchData[];
        }

        return [];
    }, [playerSchedule, matchStats, playerStatsMap, player]);

    // Local state for the selected match to show breakdown
    const [selectedMatch, setSelectedMatch] = React.useState<UnifiedMatchData | null>(null);

    // Reset selected match when dialog closes or player changes
    React.useEffect(() => {
        if (!open) {
            setSelectedMatch(null);
        }
    }, [open, player?.id]);

    const breakdownData = useMemo(() => {
        if (!selectedMatch) return null;
        // Verify we actually have stats to calculate
        const hasStats = selectedMatch.runs !== undefined || selectedMatch.wickets !== undefined;
        if (!hasStats) return null;

        // Ensure we pass a complete rules object.
        // If a specific league has different rules, they should be pulled and passed here.
        // For now, defaulting to DEFAULT_SCORING_RULES.
        return calculateFantasyPoints(getPlayerStatsForCalc(selectedMatch), scoringRules);
    }, [selectedMatch, scoringRules]);

    const isMobile = useIsMobile();

    if (!player) return null;

    const Content = (
        <div className="relative flex flex-col w-full bg-background md:bg-[#0f1014] rounded-t-2xl md:rounded-2xl overflow-hidden border border-border/50 shadow-2xl h-full max-h-[90svh] md:h-auto md:max-h-[85vh]">
            {/* Visual Close Button for Mobile Accessibility */}
            {!isMobile && (
                <button
                    onClick={() => onOpenChange && onOpenChange(false)}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-colors border border-white/20 shadow-xl"
                    aria-label="Close dialog"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            )}

            <DrawerDescription className="sr-only">Player details and statistics for {player.name}</DrawerDescription>

            {/* Header Section */}
            <div
                className={cn(
                    "relative flex flex-row items-center transition-colors duration-500 overflow-hidden flex-shrink-0 border-b border-border/10 h-32 md:h-40",
                    teamColors.bg === 'bg-muted' ? "bg-muted/30" : ""
                )}
                style={teamColors.bg !== 'bg-muted' ? {
                    backgroundColor: teamColors.raw,
                } : {}}
            >
                {/* Background subtle gradient for depth */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none z-0" />

                {/* Player Image - Horizontal Layout */}
                <div className="relative w-32 md:w-40 h-full flex-shrink-0 flex items-end justify-center z-10 transition-transform duration-300">
                    <img
                        src={getPlayerAvatarUrl(imageId, 'det')}
                        alt={player.name}
                        className="relative z-30 h-[105%] w-auto max-w-none object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] md:h-[115%]"
                    />
                </div>

                {/* Info and Metadata Grid */}
                <div className="flex-1 p-4 md:p-6 flex flex-col justify-center relative z-20">
                    <div>
                        <DialogTitle className={cn(
                            "text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-tight drop-shadow-md flex flex-col uppercase",
                            teamColors.text
                        )}>
                            {player.name.includes(' ') ? (
                                <>
                                    <span className="text-xs md:text-sm lg:text-base opacity-75 font-bold tracking-widest">{player.name.substring(0, player.name.lastIndexOf(' '))}</span>
                                    <span>{player.name.substring(player.name.lastIndexOf(' ') + 1)}</span>
                                </>
                            ) : (
                                <span>{player.name}</span>
                            )}
                        </DialogTitle>

                        <div className="flex flex-row flex-wrap items-center gap-1.5 md:gap-2 mt-1.5">
                            {/* Team Badge */}
                            <div className={cn(
                                "text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-black/30 md:bg-black/20 px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/20",
                                teamColors.text
                            )}>
                                {player.team}
                            </div>

                            {/* Role Badge */}
                            <Badge
                                className="text-[9px] md:text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-widest shadow-md pointer-events-none whitespace-nowrap bg-black/50 backdrop-blur-md border border-white/20 text-white"
                                variant="secondary"
                            >
                                {player.role}
                            </Badge>

                            {/* Ownership Badge */}
                            {owningManager ? (
                                <Badge
                                    className="text-[9px] md:text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-widest shadow-md pointer-events-none whitespace-nowrap bg-indigo-500/80 backdrop-blur-md border border-white/20 text-white"
                                    variant="secondary"
                                >
                                    {owningManager.teamName}
                                </Badge>
                            ) : (
                                <Badge
                                    className="text-[9px] md:text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-widest shadow-md pointer-events-none whitespace-nowrap bg-emerald-500/80 backdrop-blur-md border border-white/20 text-white"
                                    variant="secondary"
                                >
                                    Free Agent
                                </Badge>
                            )}
                        </div>


                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="bg-[#0f1014] flex-1 flex flex-col min-h-0 overflow-hidden relative z-30">
                {/* Section Header */}
                <div className="flex items-center px-4 md:px-6 pt-3 border-b border-white/5 flex-shrink-0">
                    {selectedMatch ? (
                        <div className="flex items-center gap-2 w-full pb-2">
                            <button
                                onClick={() => setSelectedMatch(null)}
                                className="p-1 hover:bg-white/5 rounded-md transition-colors text-white/40 hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                            </button>
                            <div className="font-bold text-[10px] md:text-xs tracking-widest text-white/80 uppercase">
                                Points Breakdown vs {selectedMatch.opponentShort}
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            <div className="pb-2 border-b-2 border-primary font-black text-[10px] md:text-xs tracking-widest text-white uppercase">
                                Game Log
                            </div>
                        </div>
                    )}
                </div>

                <ScrollArea className="flex-1 min-h-0 w-full">
                    {selectedMatch && breakdownData ? (
                        /* Points Breakdown View */
                        <div className="p-4 md:p-6 space-y-4">
                            <div className="flex items-center justify-between bg-white/[0.03] p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="text-[10px] font-bold text-white/40 tracking-widest uppercase">Total Fantasy Points</div>
                                <div className="text-3xl font-black text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]">{breakdownData.total.toFixed(1)}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Batting Breakdown */}
                                {breakdownData.batting.total !== 0 && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl overflow-hidden">
                                        <div className="bg-emerald-500/10 px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-emerald-400 flex justify-between items-center">
                                            <span>Batting</span>
                                            <span>{breakdownData.batting.total.toFixed(1)}</span>
                                        </div>
                                        <div className="p-3 space-y-2 text-[11px]">
                                            {breakdownData.batting.runs !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Runs ({selectedMatch.runs || 0})</span>
                                                    <span className="font-bold text-emerald-400">+{breakdownData.batting.runs}</span>
                                                </div>
                                            )}
                                            {breakdownData.batting.fours !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Fours ({selectedMatch.fours || 0})</span>
                                                    <span className="font-bold text-emerald-400">+{breakdownData.batting.fours}</span>
                                                </div>
                                            )}
                                            {breakdownData.batting.sixes !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Sixes ({selectedMatch.sixes || 0})</span>
                                                    <span className="font-bold text-emerald-400">+{breakdownData.batting.sixes}</span>
                                                </div>
                                            )}
                                            {breakdownData.batting.strikeRateBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">SR Bonus ({selectedMatch.strikeRate?.toFixed(1)})</span>
                                                    <span className={cn("font-bold", breakdownData.batting.strikeRateBonus > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                        {breakdownData.batting.strikeRateBonus > 0 ? "+" : ""}{breakdownData.batting.strikeRateBonus}
                                                    </span>
                                                </div>
                                            )}
                                            {breakdownData.batting.milestoneBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Milestone Bonus</span>
                                                    <span className="font-bold text-emerald-400">+{breakdownData.batting.milestoneBonus}</span>
                                                </div>
                                            )}
                                            {breakdownData.batting.duckPenalty !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Duck Penalty</span>
                                                    <span className="font-bold text-rose-400">{breakdownData.batting.duckPenalty}</span>
                                                </div>
                                            )}
                                            {breakdownData.batting.lowScorePenalty !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Run Penalty</span>
                                                    <span className="font-bold text-rose-400">{breakdownData.batting.lowScorePenalty}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Bowling Breakdown */}
                                {(selectedMatch.overs ?? 0) > 0 || (selectedMatch.wickets ?? 0) > 0 ? (
                                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl overflow-hidden">
                                        <div className="bg-rose-500/10 px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-rose-400 flex justify-between items-center">
                                            <span>Bowling</span>
                                            <span>{breakdownData.bowling.total.toFixed(1)}</span>
                                        </div>
                                        <div className="p-3 space-y-2 text-[11px]">
                                            {breakdownData.bowling.wickets !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Wickets ({selectedMatch.wickets || 0})</span>
                                                    <span className="font-bold text-rose-400">+{breakdownData.bowling.wickets}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.maidens !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Maidens ({selectedMatch.maidens || 0})</span>
                                                    <span className="font-bold text-rose-400">+{breakdownData.bowling.maidens}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.economyBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Econ Bonus ({selectedMatch.economy?.toFixed(2)})</span>
                                                    <span className={cn("font-bold", breakdownData.bowling.economyBonus > 0 ? "text-rose-400" : "text-rose-400")}>
                                                        {breakdownData.bowling.economyBonus > 0 ? "+" : ""}{breakdownData.bowling.economyBonus}
                                                    </span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.dots !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Dot Balls ({selectedMatch.dots || 0})</span>
                                                    <span className="font-bold text-rose-400">+{breakdownData.bowling.dots}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.lbwBowledBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">LBW/Bowled Bonus</span>
                                                    <span className="font-bold text-rose-400">+{breakdownData.bowling.lbwBowledBonus}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.milestoneBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Wicket Milestones</span>
                                                    <span className="font-bold text-rose-400">+{breakdownData.bowling.milestoneBonus}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.widePenalty !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Wide Penalty ({selectedMatch.wides || 0})</span>
                                                    <span className="font-bold text-rose-400">{breakdownData.bowling.widePenalty}</span>
                                                </div>
                                            )}
                                            {breakdownData.bowling.noBallPenalty !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">No Ball Penalty ({selectedMatch.noBalls || 0})</span>
                                                    <span className="font-bold text-rose-400">{breakdownData.bowling.noBallPenalty}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                {/* Fielding Breakdown */}
                                {breakdownData.fielding.total !== 0 && (
                                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl overflow-hidden">
                                        <div className="bg-amber-500/10 px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-amber-400 flex justify-between items-center">
                                            <span>Fielding</span>
                                            <span>{breakdownData.fielding.total.toFixed(1)}</span>
                                        </div>
                                        <div className="p-3 space-y-2 text-[11px]">
                                            {breakdownData.fielding.catches !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Catches ({selectedMatch.catches || 0})</span>
                                                    <span className="font-bold text-amber-400">+{breakdownData.fielding.catches}</span>
                                                </div>
                                            )}
                                            {breakdownData.fielding.runOuts !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Run Outs ({selectedMatch.runOuts || 0})</span>
                                                    <span className="font-bold text-amber-400">+{breakdownData.fielding.runOuts}</span>
                                                </div>
                                            )}
                                            {'stumpings' in breakdownData.fielding && breakdownData.fielding.stumpings !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Stumpings ({selectedMatch.stumpings || 0})</span>
                                                    <span className="font-bold text-amber-400">+{breakdownData.fielding.stumpings}</span>
                                                </div>
                                            )}
                                            {breakdownData.fielding.multiCatchBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Multi-Catch Bonus</span>
                                                    <span className="font-bold text-amber-400">+{breakdownData.fielding.multiCatchBonus}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Match Context (Common) */}
                                {(breakdownData.common.total !== 0) && (
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl overflow-hidden">
                                        <div className="bg-blue-500/10 px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-blue-400 flex justify-between items-center">
                                            <span>Match Context</span>
                                            <span>{breakdownData.common.total.toFixed(1)}</span>
                                        </div>
                                        <div className="p-3 space-y-2 text-[11px]">
                                            {breakdownData.common.starting11 !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Starting 11</span>
                                                    <span className="font-bold text-blue-400">+{breakdownData.common.starting11}</span>
                                                </div>
                                            )}
                                            {breakdownData.common.matchWinningTeam !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Winning Team Bonus</span>
                                                    <span className="font-bold text-blue-400">+{breakdownData.common.matchWinningTeam}</span>
                                                </div>
                                            )}
                                            {breakdownData.common.impactPlayer !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Impact Player Points</span>
                                                    <span className="font-bold text-blue-400">+{breakdownData.common.impactPlayer}</span>
                                                </div>
                                            )}
                                            {breakdownData.common.impactPlayerWinBonus !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Impact Win Bonus</span>
                                                    <span className="font-bold text-blue-400">+{breakdownData.common.impactPlayerWinBonus}</span>
                                                </div>
                                            )}
                                            {breakdownData.common.manOfTheMatch !== 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/40">Man of the Match</span>
                                                    <span className="font-bold text-blue-400">+{breakdownData.common.manOfTheMatch}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Existing Game Log View - More Dense */
                        <div className="p-0">
                            {/* Unified Grid Table */}
                            <div className="grid text-[10px] md:text-xs text-center border-collapse">
                                {/* Header Row 1 - Groups */}
                                <div className="flex w-full min-w-[600px] md:min-w-full bg-white/[0.02] font-black text-[9px] uppercase tracking-[0.2em] text-white/20 sticky top-0 z-20 border-b border-white/5 backdrop-blur-md">
                                    <div className="w-[90px] flex-shrink-0 h-8 flex items-center justify-center border-r border-white/5 bg-[#0f1014]">Match</div>
                                    <div className="w-[45px] flex-shrink-0 h-8 flex items-center justify-center border-r border-white/5 text-primary bg-[#0f1014]">Pts</div>

                                    {sections.map(section => (
                                        <div
                                            key={section.id}
                                            className={cn("h-8 flex items-center justify-center border-r border-white/5 last:border-r-0", section.color)}
                                            style={{ flex: `${section.width} 1 0%`, minWidth: `${section.width}px` }}
                                        >
                                            {section.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Header Row 2 - Columns */}
                                <div className="flex w-full min-w-[600px] md:min-w-full bg-[#0f1014]/80 backdrop-blur-md font-bold border-b border-white/10 sticky top-[32px] z-10 text-[8px] text-white/40 uppercase tracking-widest">
                                    <div className="w-[24px] flex-shrink-0 py-2 border-r border-white/5 flex items-center justify-center">Wk</div>
                                    <div className="w-[66px] flex-shrink-0 py-2 border-r border-white/5 text-left px-2 flex items-center">Opp</div>
                                    <div className="w-[45px] flex-shrink-0 py-2 border-r border-white/5 flex items-center justify-center">Tot</div>

                                    {sections.map(section => (
                                        <React.Fragment key={`${section.id}-cols`}>
                                            {section.cols.map(col => (
                                                <div
                                                    key={col.key}
                                                    className={cn("py-2 border-r border-white/5 last:border-r-0 flex items-center justify-center", section.color)}
                                                    style={{ flex: `${col.px} 1 0%`, minWidth: `${col.px}px` }}
                                                >
                                                    {col.label}
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Data Rows */}
                                {unifiedMatches.length > 0 ? unifiedMatches.map((matchItem, index) => {
                                    const hasStats = matchItem.runs !== undefined || matchItem.wickets !== undefined;
                                    const stats = hasStats ? matchItem : undefined;
                                    const fpts = hasStats
                                        ? (matchItem.fantasyPoints ?? calculateFantasyPoints(getPlayerStatsForCalc(stats), scoringRules).total)
                                        : 0;

                                    const opponentShort = matchItem.opponentShort;
                                    const isUpcoming = !hasStats && matchItem.isUpcoming && matchItem.matchDate > new Date() && matchItem.matchState !== 'Complete';
                                    const weekNum = matchItem.week || index + 1;

                                    return (
                                        <div
                                            key={matchItem.matchId || index}
                                            onClick={() => hasStats && setSelectedMatch(matchItem)}
                                            className={cn(
                                                "flex w-full min-w-[550px] md:min-w-full transition-colors border-b border-white/[0.03] group",
                                                stats?.isManOfMatch
                                                    ? "bg-amber-500/[0.08] border-amber-500/10"
                                                    : index % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]",
                                                isUpcoming && "opacity-30",
                                                hasStats ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-default"
                                            )}
                                        >
                                            <div className="w-[24px] flex-shrink-0 py-2.5 border-r border-white/5 items-center justify-center flex text-white/30 font-mono text-[9px]">
                                                {weekNum}
                                            </div>
                                            <div className="w-[66px] flex-shrink-0 py-2.5 border-r border-white/5 text-left px-2 flex flex-col justify-center">
                                                <span className="font-bold text-white/90 group-hover:text-white flex items-center gap-1 overflow-hidden">
                                                    <span className="truncate">{opponentShort}</span>
                                                    {(matchItem.matchState?.toLowerCase().includes('live') || matchItem.isLiveStats) && (
                                                        <span className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-rose-500 animate-pulse" />
                                                    )}
                                                </span>
                                            </div>
                                            <div className="w-[45px] flex-shrink-0 py-2.5 border-r border-white/5 font-black text-primary flex items-center justify-center text-xs">
                                                {hasStats ? fpts.toFixed(1) : (isUpcoming ? '' : '-')}
                                            </div>

                                            {sections.map(section => (
                                                <React.Fragment key={section.id}>
                                                    {section.cols.map(col => {
                                                        let val: string | number | undefined = '-';
                                                        if (hasStats && stats) {
                                                            val = (stats as unknown as Record<string, string | number | undefined>)[col.key];
                                                            if (val === undefined || val === null) val = '-';
                                                            else if (col.key === 'strikeRate' || col.key === 'economy') val = (val as number).toFixed(0);
                                                        }
                                                        return (
                                                            <div key={col.key} className="py-2.5 border-r border-white/5 flex items-center justify-center text-white/60 group-hover:text-white/80" style={{ flex: `${col.px} 1 0%`, minWidth: `${col.px}px` }}>
                                                                {val}
                                                            </div>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    );
                                }) : (
                                    <div className="p-12 text-white/20 font-medium italic flex flex-col items-center gap-3">
                                        <Clock className="w-8 h-8 opacity-20" />
                                        No matches scheduled
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            {/* Action Bar */}
            {(onAdd || onDrop || onTrade || (canDraft && onDraft) || draftTimerProps) && (
                <div className="p-4 md:p-6 bg-[#0f1014] border-t border-white/5 flex flex-col sm:flex-row gap-3 flex-shrink-0 z-40 sticky bottom-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:items-center">
                    {draftTimerProps && (
                        <div className="flex-shrink-0 w-full sm:w-auto flex justify-center sm:justify-start sm:mr-auto sm:scale-110 sm:origin-left">
                            <DraftTimer {...draftTimerProps} className="w-full sm:w-auto justify-center" />
                        </div>
                    )}
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
                    {!owningManager && onAdd && !canDraft && (draftState?.isFinalized || draftState === undefined) && (
                        <Button
                            onClick={onAdd}
                            className="flex-1 gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold h-12 md:h-14 rounded-full text-sm md:text-base shadow-lg shadow-indigo-500/20 w-full"
                        >
                            <Plus className="w-5 h-5" />
                            ADD PLAYER
                        </Button>
                    )}

                    {/* Owned by Current User Case */}
                    {owningManager && managerProfile && owningManager.id === managerProfile.id && onDrop && (draftState?.isFinalized || draftState === undefined) && (
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
                    {owningManager && managerProfile && owningManager.id !== managerProfile.id && onTrade && (draftState?.isFinalized || draftState === undefined) && (
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
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent
                    className="p-0 border-none bg-transparent h-[90svh]"
                    aria-describedby={undefined}
                >
                    <DrawerTitle className="sr-only">Player Details</DrawerTitle>
                    {Content}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-full p-0 gap-0 overflow-hidden border-0 bg-transparent shadow-none h-auto max-h-[90svh] z-[100] flex flex-col md:flex-row rounded-2xl"
                aria-describedby={undefined}
                onInteractOutside={(e) => {
                    if (onOpenChange) onOpenChange(false);
                }}
            >
                <DialogTitle className="sr-only">Player Details</DialogTitle>
                {Content}
            </DialogContent>
        </Dialog>
    );
}
