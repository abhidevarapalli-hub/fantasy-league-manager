import { Match, Manager } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { LazyPlayerAvatar } from '@/components/LazyPlayerAvatar';
import { MatchupDetail } from './MatchupDetail';
import { useState, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

interface ScheduleGridProps {
    matches: Match[]; // Matches for ALL weeks
    managers: Manager[];
    selectedWeek: number;
}

export const ScheduleGrid = ({ matches, managers, selectedWeek }: ScheduleGridProps) => {
    const managerProfile = useAuthStore(state => state.managerProfile);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    const getManager = (id: string) => managers.find(m => m.id === id);

    // Check if this match implies the logged-in user
    const isUserMatch = (match: Match) => {
        if (!managerProfile?.id) return false;
        return match.home === managerProfile.id || match.away === managerProfile.id;
    };

    // Filter and sort matches for the selected week
    const weekMatches = useMemo(() => {
        const filtered = matches.filter(m => m.week === selectedWeek);
        if (!managerProfile?.id) return filtered;

        return [...filtered].sort((a, b) => {
            const aIsUser = a.home === managerProfile.id || a.away === managerProfile.id;
            const bIsUser = b.home === managerProfile.id || b.away === managerProfile.id;
            if (aIsUser && !bIsUser) return -1;
            if (!aIsUser && bIsUser) return 1;
            return 0;
        });
    }, [matches, selectedWeek, managerProfile?.id]);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekMatches.map((match) => {
                    // Logic to ensure the logged-in user is always on the left (Home) for display
                    const isAway = managerProfile?.id && match.away === managerProfile.id;

                    const displayHomeId = isAway ? match.away : match.home;
                    const displayAwayId = isAway ? match.home : match.away;
                    const displayHomeScore = isAway ? (match.awayScore ?? 0) : (match.homeScore ?? 0);
                    const displayAwayScore = isAway ? (match.homeScore ?? 0) : (match.awayScore ?? 0);

                    const homeManager = getManager(displayHomeId);
                    const awayManager = getManager(displayAwayId);

                    const userPlaying = isUserMatch(match);




                    return (
                        <Card
                            key={match.id}
                            className={cn(
                                "cursor-pointer hover:bg-muted/50 transition-colors border",
                                userPlaying ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                            )}
                            onClick={() => setSelectedMatch(match)}
                        >
                            <CardContent className="p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                                {/* Home Team (Left) */}
                                <div className="flex flex-col gap-2 overflow-hidden">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="relative shrink-0">
                                            <LazyPlayerAvatar
                                                name={homeManager?.name || 'Home'}
                                                className="w-10 h-10 border-2 border-border rounded-full"
                                            />
                                            <div className="absolute -bottom-1 -right-1 bg-background text-[10px] font-bold px-1 rounded-full border border-border shadow-sm">
                                                {homeManager?.wins}-{homeManager?.losses}
                                            </div>
                                        </div>

                                        <div className="min-w-0 overflow-hidden text-right flex-1">
                                            <div className="text-[10px] text-muted-foreground truncate">@{homeManager?.name || 'User'}</div>
                                            <div className="font-bold text-sm truncate leading-tight">{homeManager?.teamName || 'Team Name'}</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-start items-end mt-1">
                                        <span className="font-bold text-lg tabular-nums">{displayHomeScore > 0 ? displayHomeScore.toFixed(2) : '0.00'}</span>
                                    </div>
                                </div>

                                {/* VS / Status Middle */}
                                <div className="flex flex-col items-center justify-center shrink-0 px-2">
                                    <span className="text-muted-foreground font-bold text-sm opacity-50">VS</span>
                                </div>

                                {/* Away Team (Right) */}
                                <div className="flex flex-col gap-2 text-right overflow-hidden">
                                    <div className="flex items-center gap-3 flex-row-reverse">
                                        <div className="relative shrink-0">
                                            <LazyPlayerAvatar
                                                name={awayManager?.name || 'Away'}
                                                className="w-10 h-10 border-2 border-border rounded-full"
                                            />
                                            <div className="absolute -bottom-1 -left-1 bg-background text-[10px] font-bold px-1 rounded-full border border-border shadow-sm">
                                                {awayManager?.wins}-{awayManager?.losses}
                                            </div>
                                        </div>

                                        <div className="min-w-0 overflow-hidden text-left flex-1">
                                            <div className="text-[10px] text-muted-foreground truncate">@{awayManager?.name || 'User'}</div>
                                            <div className="font-bold text-sm truncate leading-tight">{awayManager?.teamName || 'Team Name'}</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-start items-end mt-1 flex-row-reverse">
                                        <span className="font-bold text-lg tabular-nums">{displayAwayScore > 0 ? displayAwayScore.toFixed(2) : '0.00'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div >

            {/* Matchup Detail Modal */}
            {
                selectedMatch && (() => {
                    const isAway = managerProfile?.id && selectedMatch.away === managerProfile.id;
                    const homeMan = getManager(isAway ? selectedMatch.away : selectedMatch.home);
                    const awayMan = getManager(isAway ? selectedMatch.home : selectedMatch.away);

                    return (
                        <MatchupDetail
                            open={!!selectedMatch}
                            onOpenChange={(open) => !open && setSelectedMatch(null)}
                            match={selectedMatch}
                            homeManager={homeMan}
                            awayManager={awayMan}
                            displaySwapped={isAway}
                        />
                    );
                })()
            }
        </>
    );
};
