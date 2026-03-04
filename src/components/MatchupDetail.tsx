import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Manager, Match } from "@/lib/supabase-types";
import { useGameStore } from '@/store/useGameStore';
import { PlayerWithMatches, useMatchupData } from '@/hooks/useMatchupData';
// calculateFantasyPoints removed as it is now handled in the hook
import { TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { LeagueConfig, DEFAULT_LEAGUE_CONFIG } from '@/lib/roster-validation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Calendar, Trophy, Clock } from "lucide-react";
import { format } from "date-fns";
import { LazyPlayerAvatar } from "@/components/LazyPlayerAvatar";
import { PlayerDetailDialog } from "@/components/PlayerDetailDialog";

interface MatchupDetailProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: Match;
    homeManager?: Manager;
    awayManager?: Manager;
    displaySwapped?: boolean;
}

const RoleBadge = ({ role }: { role: string }) => {
    const colors = {
        'Batsman': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Bowler': 'bg-red-500/20 text-red-400 border-red-500/30',
        'All Rounder': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Wicket Keeper': 'bg-green-500/20 text-green-400 border-green-500/30',
    };

    const shortNames = {
        'Batsman': 'BAT',
        'Bowler': 'BOWL',
        'All Rounder': 'AR',
        'Wicket Keeper': 'WK',
    };

    return (
        <span className={cn(
            "px-1.5 py-0.5 text-[10px] font-bold rounded border uppercase",
            colors[role as keyof typeof colors] || 'bg-muted text-muted-foreground'
        )}>
            {shortNames[role as keyof typeof shortNames] || role}
        </span>
    );
};

const PlayerCard = ({
    playerData,
    onClick
}: {
    playerData: PlayerWithMatches;
    onClick: (playerId: string) => void;
}) => {
    const { player, cricketMatches, stats, totalPoints } = playerData;
    const isPlaying = stats.some(s => s.isLiveStats);

    return (
        <div
            className="bg-card/50 border border-border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-card/80 transition-colors"
            onClick={() => onClick(player.id)}
        >
            {/* Player Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                        <LazyPlayerAvatar
                            name={player.name}
                            imageId={player.imageId}
                            cachedUrl={player.cachedUrl}
                            className="w-10 h-10 border border-border"
                        />
                        {isPlaying && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-green-500 animate-pulse" title="Playing Now" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <RoleBadge role={player.role} />
                            <span className="text-xs font-medium text-muted-foreground truncate">
                                {player.team}
                            </span>
                        </div>
                        <p className="font-semibold text-sm truncate leading-tight">
                            {player.name}
                            {playerData.isCaptain && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/50 leading-none">C</span>
                            )}
                            {playerData.isViceCaptain && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-slate-400/30 text-slate-300 border border-slate-400/50 leading-none">VC</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">
                        {totalPoints.toFixed(1)}
                        {playerData.isCaptain && <span className="text-[10px] text-amber-400 ml-0.5">×2</span>}
                        {playerData.isViceCaptain && <span className="text-[10px] text-slate-400 ml-0.5">×1.5</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">PTS</p>
                </div>
            </div>

            {/* Cricket Matches */}
            {cricketMatches.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                    {cricketMatches.map((match, idx) => {
                        const isTeam1 = match.team1.name === player.team || match.team1.shortName === player.team;
                        const opponent = isTeam1 ? match.team2.shortName : match.team1.shortName;
                        const matchStats = stats.find(s => s.matchId === match.id);

                        return (
                            <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="text-muted-foreground">vs</span>
                                    <span className="font-medium truncate">{opponent}</span>
                                    {match.matchDate && (
                                        <span className="text-muted-foreground text-[10px]">
                                            {format(match.matchDate, 'MMM d')}
                                        </span>
                                    )}
                                </div>
                                {matchStats && (
                                    <span className="font-semibold text-primary ml-2">
                                        {matchStats.fantasyPoints?.toFixed(1) || '0.0'}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* No matches scheduled */}
            {cricketMatches.length === 0 && (
                <div className="text-center py-2 text-xs text-muted-foreground">
                    No matches this week
                </div>
            )}
        </div>
    );
};

const RosterSection = ({
    title,
    players,
    onPlayerClick
}: {
    title: string;
    players: PlayerWithMatches[];
    onPlayerClick: (playerId: string) => void;
}) => {
    if (players.length === 0) return null;

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {title}
            </h4>
            <div className="space-y-2">
                {players.map((playerData) => (
                    <PlayerCard
                        key={playerData.player.id}
                        playerData={playerData}
                        onClick={onPlayerClick}
                    />
                ))}
            </div>
        </div>
    );
};

const MatchupRow = ({
    homePlayer,
    awayPlayer,
    assignedRoleLabel,
    onPlayerClick
}: {
    homePlayer?: PlayerWithMatches;
    awayPlayer?: PlayerWithMatches;
    assignedRoleLabel?: string;
    onPlayerClick: (playerId: string) => void;
}) => {
    // Helper to render a single player side
    const renderPlayerSide = (playerData: PlayerWithMatches | null | undefined, align: 'left' | 'right') => {
        if (!playerData) return <div className="flex-1 min-w-0 min-h-[46px]" />;

        const { player, totalPoints, cricketMatches } = playerData;
        // Playing: stats indicate live tracking
        const isPlaying = playerData.stats.some(s => s.isLiveStats);
        // Completed: All matches for this player this week have a result
        const hasPlayed = cricketMatches.length > 0 && cricketMatches.every(m => !!m.result);

        return (
            <div
                className={cn(
                    "w-full flex items-center gap-1.5 cursor-pointer active:opacity-70 transition-all rounded-md p-1 min-h-[46px]",
                    align === 'right' ? "flex-row-reverse text-right" : "flex-row text-left",
                    playerData.isCaptain && (align === 'left' ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-[3px] border-amber-500/80" : "bg-gradient-to-l from-amber-500/15 via-amber-500/5 to-transparent border-r-[3px] border-amber-500/80"),
                    playerData.isViceCaptain && (align === 'left' ? "bg-gradient-to-r from-slate-400/15 via-slate-400/5 to-transparent border-l-[3px] border-slate-400/80" : "bg-gradient-to-l from-slate-400/15 via-slate-400/5 to-transparent border-r-[3px] border-slate-400/80"),
                    !playerData.isCaptain && !playerData.isViceCaptain && "hover:bg-muted/30"
                )}
                onClick={() => onPlayerClick(player.id)}
            >
                {/* Avatar */}
                <div className="relative shrink-0 flex flex-col items-center gap-1">
                    <div className="relative">
                        <LazyPlayerAvatar
                            name={player.name}
                            imageId={player.imageId}
                            cachedUrl={player.cachedUrl}
                            className="w-8 h-8 sm:w-9 sm:h-9 border border-border/50"
                        />
                        {/* Status Dot: Green Pulsing = Currently playing */}
                        {isPlaying && (
                            <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-[1.5px] sm:border-2 border-background bg-green-500 animate-pulse"
                            )} title="Playing Now" />
                        )}
                    </div>
                    {/* Country Code under image for mobile */}
                    <span className="text-[8px] sm:hidden font-medium text-muted-foreground leading-none">
                        {player.team}
                    </span>
                </div>

                {/* Info */}
                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                    <p className="text-[10.5px] sm:text-[11px] font-bold leading-tight truncate text-foreground/90">
                        {player.name.split(' ').length > 1 ? `${player.name.charAt(0)}. ${player.name.split(' ').slice(1).join(' ')}` : player.name}
                        {' '}<span className="hidden sm:inline text-[8.5px] sm:text-[9px] font-normal text-muted-foreground opacity-70">({player.team})</span>
                    </p>
                    <div className={cn(
                        "flex flex-col gap-y-[1px] text-[8.5px] sm:text-[9px] text-muted-foreground mt-0.5",
                        align === 'right' ? "items-end" : "items-start"
                    )}>
                        {cricketMatches.length > 0 ? cricketMatches.map(m => {
                            const getCountry = (t: string) => TEAM_SHORT_TO_COUNTRY[t] || t;
                            const pCountry = getCountry(player.team);
                            const isTeam1 = getCountry(m.team1?.name || '') === pCountry ||
                                getCountry(m.team1?.shortName || '') === pCountry;
                            const opp = isTeam1
                                ? (m.team2?.shortName || m.team2?.name || 'Unknown')
                                : (m.team1?.shortName || m.team1?.name || 'Unknown');

                            const matchStat = playerData.stats.find(s => s.matchId === m.id);
                            const pts = matchStat?.fantasyPoints;
                            const isMatchLive = m.matchState === 'Live';
                            return (
                                <div key={m.id} className="flex items-center gap-1 leading-none truncate max-w-full">
                                    <span>vs {opp} <span className="font-bold text-foreground/80">{pts != null ? pts.toFixed(1) : '-'}</span></span>
                                    {isMatchLive && (
                                        <span className="shrink-0 px-1 py-0.5 rounded-[2px] bg-green-500/20 text-[7px] font-black text-green-500 border border-green-500/30 uppercase tracking-tighter animate-pulse">LIVE</span>
                                    )}
                                </div>
                            );
                        }) : (
                            <span>No matches</span>
                        )}
                    </div>
                </div>

                {/* Total Points (Center) */}
                <div className="shrink-0 flex flex-col items-center justify-center min-w-[28px] sm:min-w-[32px] px-0.5 sm:px-1">
                    <span className={cn(
                        "text-[13px] sm:text-sm font-black",
                        totalPoints > 0 ? "text-primary" : "text-muted-foreground"
                    )}>
                        {(totalPoints ?? 0).toFixed(1)}
                    </span>
                    {playerData.isCaptain && <span className="text-[7px] sm:text-[8px] text-amber-500 font-bold leading-none mt-0.5">C ×2</span>}
                    {playerData.isViceCaptain && <span className="text-[7px] sm:text-[8px] text-slate-400 font-bold leading-none mt-0.5">VC ×1.5</span>}
                </div>
            </div>
        );
    };

    let displayRoleLabel = assignedRoleLabel || 'UNSET';
    if (!assignedRoleLabel && (homePlayer || awayPlayer)) {
        if (homePlayer) displayRoleLabel = homePlayer.player.role;
        else if (awayPlayer) displayRoleLabel = awayPlayer.player.role;
        displayRoleLabel = displayRoleLabel === 'Batsman' ? 'BAT' : displayRoleLabel === 'Bowler' ? 'BWL' : displayRoleLabel === 'All Rounder' ? 'AR' : displayRoleLabel === 'Wicket Keeper' ? 'WK' : displayRoleLabel;
    }

    return (
        <div className="flex items-stretch justify-between py-1.5 border-b border-border/30 last:border-0 w-full overflow-hidden">
            {/* Left: Home Player */}
            <div className="flex-1 w-0 flex justify-start">
                {renderPlayerSide(homePlayer, 'left')}
            </div>

            {/* Center: Position Badge */}
            <div className="w-[44px] shrink-0 flex items-center justify-center z-10 px-0.5 sm:px-1">
                <div className={cn(
                    "px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter border shadow-sm w-full text-center truncate",
                    displayRoleLabel === 'BAT' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                    displayRoleLabel === 'BWL' && "bg-red-500/10 text-red-500 border-red-500/20",
                    displayRoleLabel === 'AR' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                    displayRoleLabel === 'WK' && "bg-green-500/10 text-green-500 border-green-500/20",
                    displayRoleLabel === 'FLEX' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                    displayRoleLabel === 'UNSET' && "bg-muted text-muted-foreground border-border",
                    displayRoleLabel === 'BNCH' && "bg-muted text-muted-foreground border-border", // Added BNCH styling
                )}>
                    {displayRoleLabel}
                </div>
            </div>

            {/* Right: Away Player */}
            <div className="flex-1 w-0 flex justify-end">
                {renderPlayerSide(awayPlayer, 'right')}
            </div>
        </div>
    );
};

type SlotDef = { roleLabel: string; player: PlayerWithMatches | null };

const assignToSlots = (players: PlayerWithMatches[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): SlotDef[] => {
    const unassigned = [...players];

    const pullPlayer = (roles: string[]) => {
        const idx = unassigned.findIndex(p => roles.includes(p.player.role));
        if (idx !== -1) return unassigned.splice(idx, 1)[0] || null;
        return null;
    };

    const slots: SlotDef[] = [];

    // 1. Mandatory WK
    if (config.requireWk) {
        slots.push({ roleLabel: 'WK', player: pullPlayer(['Wicket Keeper']) });
    }

    // 2. Mandatory BAT/WK
    const currentBatWk = slots.filter(s => s.roleLabel === 'WK').length;
    const batWkNeeded = Math.max(0, config.minBatWk - currentBatWk);
    for (let i = 0; i < batWkNeeded; i++) {
        slots.push({ roleLabel: 'BAT', player: pullPlayer(['Batsman', 'Wicket Keeper']) });
    }

    // 3. Mandatory AR
    for (let i = 0; i < config.minAllRounders; i++) {
        slots.push({ roleLabel: 'AR', player: pullPlayer(['All Rounder']) });
    }

    // 4. Mandatory BWL
    for (let i = 0; i < config.minBowlers; i++) {
        slots.push({ roleLabel: 'BWL', player: pullPlayer(['Bowler']) });
    }

    // 5. Flex Slots
    const totalMandatoryAdded = slots.length;
    const flexNeeded = Math.max(0, config.activeSize - totalMandatoryAdded);
    for (let i = 0; i < flexNeeded; i++) {
        slots.push({ roleLabel: 'FLEX', player: unassigned.length > 0 ? unassigned.shift()! : null });
    }



    return slots;
};

const HeadToHeadSection = ({
    title,
    homePlayers,
    awayPlayers,
    onPlayerClick,
    useSlots = false,
    config = DEFAULT_LEAGUE_CONFIG
}: {
    title: string;
    homePlayers: PlayerWithMatches[];
    awayPlayers: PlayerWithMatches[];
    onPlayerClick: (playerId: string) => void;
    useSlots?: boolean;
    config?: LeagueConfig;
}) => {
    const rows: { home: PlayerWithMatches | null, away: PlayerWithMatches | null, label: string }[] = [];

    if (useSlots) {
        const homeSlots = assignToSlots(homePlayers, config);
        const awaySlots = assignToSlots(awayPlayers, config);
        const maxCount = Math.max(homeSlots.length, awaySlots.length);

        for (let i = 0; i < maxCount; i++) {
            rows.push({
                home: homeSlots[i]?.player || null,
                away: awaySlots[i]?.player || null,
                label: homeSlots[i]?.roleLabel || awaySlots[i]?.roleLabel || 'UNSET'
            });
        }
    } else {
        const roleOrder = ['Wicket Keeper', 'Batsman', 'All Rounder', 'Bowler'];
        const sortParams = (p: PlayerWithMatches) => roleOrder.indexOf(p.player.role);

        const sortedHome = [...homePlayers].sort((a, b) => sortParams(a) - sortParams(b));
        const sortedAway = [...awayPlayers].sort((a, b) => sortParams(a) - sortParams(b));

        const maxCount = Math.max(sortedHome.length, sortedAway.length, config.benchSize || 0);
        for (let i = 0; i < maxCount; i++) {
            let label = 'UNSET';
            if (sortedHome[i] || sortedAway[i]) {
                label = 'BNCH';
            }
            rows.push({
                home: sortedHome[i] || null,
                away: sortedAway[i] || null,
                label
            });
        }
    }

    if (rows.length === 0) return null;

    return (
        <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
            <div className="bg-muted-foreground/10 px-3 py-1 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">
                    {title === 'Starters' ? 'Starting Roster' : 'Bench'}
                </span>
            </div>
            <div className="px-2">
                {rows.map((row, i) => (
                    <MatchupRow
                        key={i}
                        homePlayer={row.home || undefined}
                        awayPlayer={row.away || undefined}
                        assignedRoleLabel={row.label}
                        onPlayerClick={onPlayerClick}
                    />
                ))}
            </div>
        </div>
    );
};

export function MatchupDetail({
    open,
    onOpenChange,
    match,
    homeManager,
    awayManager,
}: MatchupDetailProps) {
    const players = useGameStore(state => state.players);
    const currentLeagueId = useGameStore(state => state.currentLeagueId);
    const leagueConfig = useGameStore(state => state.config);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const navigate = useNavigate();

    const matchWeek = Number(match.week);

    const matchupData = useMatchupData(
        matchWeek,
        homeManager,
        awayManager,
        players,
        currentLeagueId
    );

    console.log('[MatchupDetail] matchupData state:', {
        loading: matchupData.loading,
        hasData: !!matchupData.data,
        error: matchupData.error,
        homeManagerId: homeManager?.id,
        awayManagerId: awayManager?.id
    });

    // Helper: sort C first, VC second, then by role
    const captainFirst = (a: PlayerWithMatches, b: PlayerWithMatches) => {
        const aP = a.isCaptain ? -2 : a.isViceCaptain ? -1 : 0;
        const bP = b.isCaptain ? -2 : b.isViceCaptain ? -1 : 0;
        return aP - bP;
    };
    const homeStarters = matchupData.data?.homeRoster.filter(r => r.isActive).sort(captainFirst) || [];
    const homeBench = matchupData.data?.homeRoster.filter(r => !r.isActive) || [];
    const awayStarters = matchupData.data?.awayRoster.filter(r => r.isActive).sort(captainFirst) || [];
    const awayBench = matchupData.data?.awayRoster.filter(r => !r.isActive) || [];

    const selectedPlayer = players.find(p => p.id === selectedPlayerId) || null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-screen h-[100dvh] max-w-none max-h-none border-0 p-0 sm:p-6 rounded-none sm:w-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:border sm:rounded-lg overflow-y-auto">
                <DialogHeader className="border-b border-border p-4 sm:px-0 sm:pt-0 sm:pb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>Week {match.week} Matchup</span>
                    </div>
                    <DialogTitle className="sr-only">Matchup Details</DialogTitle>

                    {/* Score Header */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Home Team */}
                        <div className="flex-1 text-left">
                            <p
                                className="text-lg font-bold truncate cursor-pointer hover:underline text-foreground"
                                onClick={() => {
                                    if (homeManager) {
                                        navigate(`/${currentLeagueId}/team/${homeManager.id}`);
                                        onOpenChange(false);
                                    }
                                }}
                            >
                                {homeManager?.teamName || "TBD"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{homeManager?.name || "-"}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-bold">
                                    {matchupData.loading ? "-" : (matchupData.data?.homeScore || 0).toFixed(1)}
                                </span>
                                {homeManager && (
                                    <span className="text-xs text-muted-foreground">
                                        {homeManager.wins}W - {homeManager.losses}L
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* VS Divider */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-muted-foreground font-medium text-sm">VS</span>
                            {match.completed ? (
                                <Trophy className="w-5 h-5 text-amber-400" />
                            ) : (
                                <Clock className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 text-right">
                            <p
                                className="text-lg font-bold truncate cursor-pointer hover:underline text-foreground"
                                onClick={() => {
                                    if (awayManager) {
                                        navigate(`/${currentLeagueId}/team/${awayManager.id}`);
                                        onOpenChange(false);
                                    }
                                }}
                            >
                                {awayManager?.teamName || "TBD"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{awayManager?.name || "-"}</p>
                            <div className="flex items-baseline gap-2 mt-1 justify-end">
                                {awayManager && (
                                    <span className="text-xs text-muted-foreground">
                                        {awayManager.wins}W - {awayManager.losses}L
                                    </span>
                                )}
                                <span className="text-3xl font-bold">
                                    {matchupData.loading ? "-" : (matchupData.data?.awayScore || 0).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Loading State */}
                {matchupData.loading && (
                    <div className="py-12 text-center text-muted-foreground">
                        Loading matchup details...
                    </div>
                )}

                {/* Error State */}
                {matchupData.error && (
                    <div className="py-12 text-center text-destructive">
                        {matchupData.error}
                    </div>
                )}

                {/* Roster Display */}
                {(!matchupData.loading || !!matchupData.data) && !matchupData.error && (
                    <div className="flex flex-col gap-4 p-2 sm:p-0">
                        <HeadToHeadSection
                            title="Starters"
                            homePlayers={homeStarters}
                            awayPlayers={awayStarters}
                            onPlayerClick={setSelectedPlayerId}
                            useSlots={true}
                            config={leagueConfig || undefined}
                        />

                        <HeadToHeadSection
                            title="Bench"
                            homePlayers={homeBench}
                            awayPlayers={awayBench}
                            onPlayerClick={setSelectedPlayerId}
                            useSlots={false}
                            config={leagueConfig || undefined}
                        />
                    </div>
                )}

                <PlayerDetailDialog
                    player={selectedPlayer!}
                    open={!!selectedPlayerId}
                    onOpenChange={(open) => !open && setSelectedPlayerId(null)}
                    // Provide minimal actions or at least consistent ones
                    onAdd={() => setSelectedPlayerId(null)}
                />
            </DialogContent>
        </Dialog>
    );
}
