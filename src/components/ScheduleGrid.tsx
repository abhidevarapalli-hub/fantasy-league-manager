import { Match, Manager } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { LazyPlayerAvatar } from '@/components/LazyPlayerAvatar';
import { MatchupDetail } from './MatchupDetail';
import { useState } from 'react';
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

    // Filter matches for the selected week
    const weekMatches = matches.filter(m => m.week === selectedWeek);

    // Check if this match implies the logged-in user
    const isUserMatch = (match: Match) => {
        if (!managerProfile?.id) return false;
        return match.home === managerProfile.id || match.away === managerProfile.id;
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekMatches.map((match) => {
                    const homeManager = getManager(match.home);
                    const awayManager = getManager(match.away);

                    const homeScore = match.homeScore ?? 0;
                    const awayScore = match.awayScore ?? 0;

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
                                        <span className="font-bold text-lg tabular-nums">{homeScore > 0 ? homeScore.toFixed(2) : '0.00'}</span>
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
                                        <span className="font-bold text-lg tabular-nums">{awayScore > 0 ? awayScore.toFixed(2) : '0.00'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div >

            {/* Matchup Detail Modal */}
            {
                selectedMatch && (
                    <MatchupDetail
                        open={!!selectedMatch}
                        onOpenChange={(open) => !open && setSelectedMatch(null)}
                        match={selectedMatch}
                        homeManager={getManager(selectedMatch.home)}
                        awayManager={getManager(selectedMatch.away)}
                    />
                )
            }
        </>
    );
};
