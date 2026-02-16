import { useState } from "react";
import { Manager, Match } from "@/lib/supabase-types";
import { useGameStore } from "@/store/useGameStore";
import { useMatchupData, PlayerWithMatches } from "@/hooks/useMatchupData";
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

    return (
        <div
            className="bg-card/50 border border-border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-card/80 transition-colors"
            onClick={() => onClick(player.id)}
        >
            {/* Player Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <LazyPlayerAvatar
                        name={player.name}
                        imageId={player.imageId}
                        className="w-10 h-10 border border-border"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <RoleBadge role={player.role} />
                            <span className="text-xs font-medium text-muted-foreground truncate">
                                {player.team}
                            </span>
                        </div>
                        <p className="font-semibold text-sm truncate leading-tight">{player.name}</p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">{totalPoints.toFixed(1)}</p>
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

export function MatchupDetail({
    open,
    onOpenChange,
    match,
    homeManager,
    awayManager,
}: MatchupDetailProps) {
    const players = useGameStore(state => state.players);
    const currentLeagueId = useGameStore(state => state.currentLeagueId);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const matchWeek = Number(match.week);

    const matchupData = useMatchupData(
        matchWeek,
        homeManager,
        awayManager,
        players,
        currentLeagueId
    );

    const homeStarters = matchupData.homeRoster.filter(r => r.isActive);
    const homeBench = matchupData.homeRoster.filter(r => !r.isActive);
    const awayStarters = matchupData.awayRoster.filter(r => r.isActive);
    const awayBench = matchupData.awayRoster.filter(r => !r.isActive);

    const selectedPlayer = players.find(p => p.id === selectedPlayerId) || null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b border-border pb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>Week {match.week}</span>
                    </div>
                    <DialogTitle className="sr-only">Matchup Details</DialogTitle>

                    {/* Score Header */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Home Team */}
                        <div className="flex-1 text-left">
                            <p className="text-lg font-bold truncate">{homeManager?.teamName || "TBD"}</p>
                            <p className="text-sm text-muted-foreground truncate">{homeManager?.name || "-"}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-bold">
                                    {matchupData.loading ? "-" : matchupData.homeScore.toFixed(1)}
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
                            <p className="text-lg font-bold truncate">{awayManager?.teamName || "TBD"}</p>
                            <p className="text-sm text-muted-foreground truncate">{awayManager?.name || "-"}</p>
                            <div className="flex items-baseline gap-2 mt-1 justify-end">
                                {awayManager && (
                                    <span className="text-xs text-muted-foreground">
                                        {awayManager.wins}W - {awayManager.losses}L
                                    </span>
                                )}
                                <span className="text-3xl font-bold">
                                    {matchupData.loading ? "-" : matchupData.awayScore.toFixed(1)}
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
                {!matchupData.loading && !matchupData.error && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {/* Home Team Roster */}
                        <div className="space-y-4">
                            <RosterSection
                                title="Starters"
                                players={homeStarters}
                                onPlayerClick={setSelectedPlayerId}
                            />
                            <RosterSection
                                title="Bench"
                                players={homeBench}
                                onPlayerClick={setSelectedPlayerId}
                            />
                        </div>

                        {/* Away Team Roster */}
                        <div className="space-y-4">
                            <RosterSection
                                title="Starters"
                                players={awayStarters}
                                onPlayerClick={setSelectedPlayerId}
                            />
                            <RosterSection
                                title="Bench"
                                players={awayBench}
                                onPlayerClick={setSelectedPlayerId}
                            />
                        </div>
                    </div>
                )}

                <PlayerDetailDialog
                    player={selectedPlayer}
                    open={!!selectedPlayerId}
                    onOpenChange={(open) => !open && setSelectedPlayerId(null)}
                />
            </DialogContent>
        </Dialog>
    );
}
