/**
 * Player Detail Sheet Component
 * Displays detailed player information in a slide-out sheet
 * Inspired by Sleeper's player detail view
 */

import { useState, useMemo } from 'react';
import { Loader2, Plane, User, Calendar, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Player } from '@/lib/supabase-types';
import { TournamentPlayer } from '@/lib/cricket-types';
import { TournamentType, getTournamentById, SUPPORTED_TOURNAMENTS } from '@/lib/tournaments';
import { usePlayerInfo, usePlayerSchedule, useExtendedPlayer, PlayerMatchPerformance } from '@/hooks/usePlayerDetails';
import { getPlayerAvatarUrl, getPlayerInitials, getPlayerTeamForTournament, TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';

// Cricket role icons (copied from PlayerCard for consistency)
const CricketBatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20L8 16" />
    <rect x="7" y="4" width="5" height="14" rx="1" transform="rotate(45 9.5 11)" />
  </svg>
);

const CricketBallIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3C9 6 9 18 12 21" />
    <path d="M12 3C15 6 15 18 12 21" />
  </svg>
);

const GlovesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
    <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    <path d="M14 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v6" />
    <path d="M6 10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V8" />
    <path d="M6 10V8a2 2 0 0 1 2-2" />
    <path d="M10 14v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4" />
  </svg>
);

const AllRounderIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="8" r="5" />
    <path d="M16 5v6" />
    <path d="M4 20l4-4" />
    <rect x="6" y="10" width="3" height="8" rx="0.5" transform="rotate(45 7.5 14)" />
  </svg>
);

// Team card colors (from PlayerCard)
const teamCardColors: Record<string, string> = {
  SRH: 'from-[#FF822A]/80 to-[#FF822A]/40',
  CSK: 'from-[#FFCB05]/80 to-[#FFCB05]/40',
  KKR: 'from-[#3A225D]/80 to-[#3A225D]/40',
  RR: 'from-[#EB71A6]/80 to-[#EB71A6]/40',
  RCB: 'from-[#800000]/80 to-[#800000]/40',
  MI: 'from-[#004B91]/80 to-[#004B91]/40',
  GT: 'from-[#1B223D]/80 to-[#1B223D]/40',
  LSG: 'from-[#2ABFCB]/80 to-[#2ABFCB]/40',
  PBKS: 'from-[#B71E24]/80 to-[#B71E24]/40',
  DC: 'from-[#000080]/80 to-[#000080]/40',
};

const roleStyles: Record<string, string> = {
  'Batsman': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Bowler': 'bg-green-500/20 text-green-400 border-green-500/30',
  'All Rounder': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Wicket Keeper': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'Batsman':
      return <CricketBatIcon className="w-4 h-4" />;
    case 'Bowler':
      return <CricketBallIcon className="w-4 h-4" />;
    case 'All Rounder':
      return <AllRounderIcon className="w-4 h-4" />;
    case 'Wicket Keeper':
      return <GlovesIcon className="w-4 h-4" />;
    default:
      return <CricketBatIcon className="w-4 h-4" />;
  }
};

interface PlayerDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  /** The Cricbuzz player data with imageId */
  tournamentPlayer?: TournamentPlayer | null;
  /** The Cricbuzz series ID for fetching schedule */
  seriesId?: number | null;
  /** Mock match stats for demo (will be replaced by real data) */
  matchStats?: PlayerMatchPerformance[];
}

export function PlayerDetailSheet({
  open,
  onOpenChange,
  player,
  tournamentPlayer,
  seriesId,
  matchStats = [],
}: PlayerDetailSheetProps) {
  const [selectedTab, setSelectedTab] = useState('stats');
  
  // First, try to get extended player data from our database
  // This has the cricbuzz_id and image_id we need
  const { data: extendedData, isLoading: isLoadingExtended } = useExtendedPlayer(player?.id || null);
  
  // Get the Cricbuzz ID from either:
  // 1. tournamentPlayer prop (if provided)
  // 2. Extended player data from database
  const cricbuzzId = tournamentPlayer?.id || extendedData?.cricbuzzId || null;
  
  // Fetch extended player info from Cricbuzz when we have the ID
  // This also provides the national team (intlTeam) for overseas players
  const { data: playerInfo, isLoading: isLoadingInfo } = usePlayerInfo(cricbuzzId);
  
  // Check if player's team looks like a national team (e.g., "IND", "AUS", "ENG")
  // vs a franchise team (e.g., "MI", "CSK", "RCB")
  const isNationalTeam = useMemo(() => {
    if (!player) return false;
    // If the team is in our national teams mapping, it's an international tournament
    return player.team in TEAM_SHORT_TO_COUNTRY;
  }, [player]);
  
  // Infer series ID if not provided, based on whether this looks like an international tournament
  const effectiveSeriesId = useMemo(() => {
    // If we have a seriesId, use it
    if (seriesId) return seriesId;
    
    // Otherwise, try to infer from player's team
    if (isNationalTeam) {
      // Find the international tournament
      const intlTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'international');
      return intlTournament?.id || null;
    } else {
      // Find the league tournament
      const leagueTournament = SUPPORTED_TOURNAMENTS.find(t => t.type === 'league');
      return leagueTournament?.id || null;
    }
  }, [seriesId, isNationalTeam]);
  
  // Determine tournament type from effective seriesId
  const tournamentType: TournamentType = useMemo(() => {
    if (!effectiveSeriesId) return 'league';
    const tournament = getTournamentById(effectiveSeriesId);
    return tournament?.type || 'league';
  }, [effectiveSeriesId]);
  
  // Compute the correct team short code based on tournament type
  // For international tournaments: domestic players -> IND, overseas -> their national team
  // For league tournaments: use the franchise team
  const playerTeamShort = useMemo(() => {
    if (!player) return null;
    
    // Get the national team from player info (for overseas players)
    // playerInfo.team contains the international team name (e.g., "South Africa")
    const nationalTeam = playerInfo?.team;
    
    return getPlayerTeamForTournament(
      player.team,           // Franchise team (e.g., "MI")
      player.isInternational, // Whether player is overseas
      tournamentType,        // 'international' or 'league'
      nationalTeam           // National team from API (for overseas players)
    );
  }, [player, tournamentType, playerInfo?.team]);
  
  // Fetch player's schedule from series matches
  const { data: playerSchedule, isLoading: isLoadingSchedule } = usePlayerSchedule(
    effectiveSeriesId,
    playerTeamShort
  );

  if (!player) return null;

  const isDarkText = ['KKR', 'RCB', 'MI', 'GT', 'PBKS', 'DC'].includes(player.team);
  const headerGradient = teamCardColors[player.team] || 'from-primary/80 to-primary/40';

  // Use imageId from (in order of priority):
  // 1. tournamentPlayer prop (if provided)
  // 2. Extended player data from database
  // 3. Cricbuzz API response
  const imageId = tournamentPlayer?.imageId || extendedData?.imageId || playerInfo?.imageId;
  
  // Combined loading state
  const isLoadingPlayerData = isLoadingExtended || (cricbuzzId && isLoadingInfo);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header with gradient background */}
        <div className={cn(
          "relative bg-gradient-to-b p-6 pb-8",
          headerGradient
        )}>
            <SheetHeader className="flex-row items-start gap-4 space-y-0">
            {/* Player Avatar */}
            <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg">
              <AvatarImage 
                src={getPlayerAvatarUrl(imageId, 'de')} 
                alt={player.name}
              />
              <AvatarFallback className="text-xl bg-muted text-muted-foreground">
                {getPlayerInitials(player.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                <SheetTitle className={cn(
                  "text-xl font-bold",
                  isDarkText ? "text-white" : "text-black"
                )}>
                  {player.name}
                </SheetTitle>
                {player.isInternational && (
                  <Plane className={cn(
                    "w-4 h-4",
                    isDarkText ? "text-white/80" : "text-black/80"
                  )} />
                )}
              </div>

              {/* Role and Team */}
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "font-medium border",
                    roleStyles[player.role] || 'bg-muted/50'
                  )}
                >
                  {getRoleIcon(player.role)}
                  <span className="ml-1">{player.role}</span>
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "font-medium",
                    isDarkText 
                      ? "bg-white/20 text-white border-white/30" 
                      : "bg-black/10 text-black border-black/20"
                  )}
                >
                  {player.team}
                </Badge>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Tabs for Stats and Match Log */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="stats">Overview</TabsTrigger>
            <TabsTrigger value="matches">Match Log</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="flex-1 overflow-hidden px-4 pb-4">
            <ScrollArea className="h-full">
              {isLoadingPlayerData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (playerInfo?.bio || extendedData?.bio) ? (
                <div className="space-y-4 pr-4">
                  {/* Bio */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">About</h3>
                    <p className="text-sm leading-relaxed">{playerInfo?.bio || extendedData?.bio}</p>
                  </div>

                  {/* Additional Info */}
                  {(playerInfo?.birthPlace || extendedData?.birthPlace || playerInfo?.dateOfBirth || extendedData?.dob || playerInfo?.height || extendedData?.height) && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {(playerInfo?.dateOfBirth || extendedData?.dob) && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">Date of Birth</div>
                            <div className="text-sm font-medium">{playerInfo?.dateOfBirth || extendedData?.dob}</div>
                          </div>
                        )}
                        {(playerInfo?.birthPlace || extendedData?.birthPlace) && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">Birth Place</div>
                            <div className="text-sm font-medium">{playerInfo?.birthPlace || extendedData?.birthPlace}</div>
                          </div>
                        )}
                        {(playerInfo?.height || extendedData?.height) && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">Height</div>
                            <div className="text-sm font-medium">{playerInfo?.height || extendedData?.height}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rankings if available */}
                  {playerInfo.rankings && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Rankings</h3>
                      <div className="space-y-2">
                        {playerInfo.rankings.batting?.map((r, i) => (
                          <div key={i} className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-2">
                            <span className="text-sm">{r.type} Batting</span>
                            <span className="text-sm font-medium">#{r.rank}</span>
                          </div>
                        ))}
                        {playerInfo.rankings.bowling?.map((r, i) => (
                          <div key={i} className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-2">
                            <span className="text-sm">{r.type} Bowling</span>
                            <span className="text-sm font-medium">#{r.rank}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <User className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Player details not available
                  </p>
                  <p className="text-muted-foreground/70 text-xs mt-1">
                    Extended player info will be fetched from the API
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="matches" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {isLoadingSchedule ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (playerSchedule && playerSchedule.length > 0) || matchStats.length > 0 ? (
                <div className="px-4 pb-4">
                  {/* Past Matches with Stats */}
                  {matchStats.length > 0 && (
                    <>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <CricketBatIcon className="w-3 h-3" />
                        Completed Matches
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Match</TableHead>
                            <TableHead className="text-right">Runs</TableHead>
                            <TableHead className="text-right">Balls</TableHead>
                            <TableHead className="text-right">4s</TableHead>
                            <TableHead className="text-right">6s</TableHead>
                            <TableHead className="text-right">SR</TableHead>
                            <TableHead className="text-right">Wkts</TableHead>
                            <TableHead className="text-right">Econ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchStats.map((match, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="text-xs">vs {match.opponentShort}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {match.matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {match.runs !== undefined ? (
                                  <span className={match.runs >= 50 ? 'text-green-500 font-semibold' : ''}>
                                    {match.runs}{match.isNotOut ? '*' : ''}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {match.ballsFaced ?? '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {match.fours ?? '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {match.sixes ?? '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {match.strikeRate?.toFixed(1) ?? '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {match.wickets !== undefined ? (
                                  <span className={match.wickets >= 3 ? 'text-green-500 font-semibold' : ''}>
                                    {match.wickets}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {match.economy?.toFixed(1) ?? '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {/* Upcoming Matches from Schedule */}
                  {playerSchedule && playerSchedule.length > 0 && (
                    <div className={matchStats.length > 0 ? 'mt-6' : ''}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        Schedule
                      </h3>
                      <div className="space-y-2">
                        {playerSchedule.map((match, index) => (
                          <div 
                            key={match.matchId || index}
                            className={cn(
                              "rounded-lg border p-3 transition-all",
                              match.isUpcoming 
                                ? "bg-muted/30 border-dashed border-muted-foreground/30" 
                                : "bg-card border-border"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">
                                  vs {match.opponentShort}
                                </div>
                                {match.isUpcoming ? (
                                  <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    <Clock className="w-2.5 h-2.5 mr-1" />
                                    Upcoming
                                  </Badge>
                                ) : match.matchState === 'Live' ? (
                                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30 animate-pulse">
                                    Live
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {match.matchDate.toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                            </div>
                            
                            {/* Venue */}
                            {match.venue && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {match.venue}
                              </div>
                            )}

                            {/* Score/Result for completed matches */}
                            {!match.isUpcoming && match.result && (
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                                {match.result}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state if no schedule but has passed stats */}
                  {(!playerSchedule || playerSchedule.length === 0) && matchStats.length > 0 && (
                    <div className="mt-6 text-center py-4">
                      <p className="text-muted-foreground/70 text-xs">
                        No upcoming matches in schedule
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <CricketBatIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No match data available yet
                  </p>
                  <p className="text-muted-foreground/70 text-xs mt-1">
                    Match schedule and stats will appear here once available
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
