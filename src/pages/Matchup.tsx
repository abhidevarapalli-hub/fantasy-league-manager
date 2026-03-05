import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useMatchupData, PlayerWithMatches } from '@/hooks/useMatchupData';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trophy, Clock, Calendar } from 'lucide-react';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { LazyPlayerAvatar } from '@/components/LazyPlayerAvatar';
import { TEAM_SHORT_TO_COUNTRY } from '@/lib/player-utils';
import { LeagueConfig, DEFAULT_LEAGUE_CONFIG } from '@/lib/roster-validation';

/* ------------------------------------------------------------------ */
/*  Helper sub-components (adapted from MatchupDetail for inline use) */
/* ------------------------------------------------------------------ */

type SlotDef = { roleLabel: string; player: PlayerWithMatches | null };

const assignToSlots = (players: PlayerWithMatches[], config: LeagueConfig = DEFAULT_LEAGUE_CONFIG): SlotDef[] => {
  const unassigned = [...players];
  const pullPlayer = (roles: string[]) => {
    const idx = unassigned.findIndex(p => roles.includes(p.player.role));
    if (idx !== -1) return unassigned.splice(idx, 1)[0] || null;
    return null;
  };
  const slots: SlotDef[] = [];
  if (config.requireWk) slots.push({ roleLabel: 'WK', player: pullPlayer(['Wicket Keeper']) });
  const batWkNeeded = Math.max(0, config.minBatWk - slots.filter(s => s.roleLabel === 'WK').length);
  for (let i = 0; i < batWkNeeded; i++) slots.push({ roleLabel: 'BAT', player: pullPlayer(['Batsman', 'Wicket Keeper']) });
  for (let i = 0; i < config.minAllRounders; i++) slots.push({ roleLabel: 'AR', player: pullPlayer(['All Rounder']) });
  for (let i = 0; i < config.minBowlers; i++) slots.push({ roleLabel: 'BWL', player: pullPlayer(['Bowler']) });
  const flexNeeded = Math.max(0, config.activeSize - slots.length);
  for (let i = 0; i < flexNeeded; i++) slots.push({ roleLabel: 'FLEX', player: unassigned.length > 0 ? unassigned.shift()! : null });
  return slots;
};

const PlayerRow = ({
  playerData,
  align,
  onClick,
}: {
  playerData: PlayerWithMatches | null | undefined;
  align: 'left' | 'right';
  onClick: (id: string) => void;
}) => {
  if (!playerData) return <div className="flex-1 min-w-0 min-h-[46px]" />;
  const { player, totalPoints, cricketMatches } = playerData;
  const isPlaying = playerData.stats.some(s => s.isLiveStats);
  const getCountry = (t: string) => TEAM_SHORT_TO_COUNTRY[t] || t;

  return (
    <div
      className={cn(
        "w-full flex items-center gap-1.5 cursor-pointer active:opacity-70 transition-all rounded-md p-1 min-h-[46px]",
        align === 'right' ? "flex-row-reverse text-right" : "flex-row text-left",
        playerData.isCaptain && (align === 'left'
          ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-[3px] border-amber-500/80"
          : "bg-gradient-to-l from-amber-500/15 via-amber-500/5 to-transparent border-r-[3px] border-amber-500/80"),
        playerData.isViceCaptain && (align === 'left'
          ? "bg-gradient-to-r from-slate-400/15 via-slate-400/5 to-transparent border-l-[3px] border-slate-400/80"
          : "bg-gradient-to-l from-slate-400/15 via-slate-400/5 to-transparent border-r-[3px] border-slate-400/80"),
        !playerData.isCaptain && !playerData.isViceCaptain && "hover:bg-muted/30"
      )}
      onClick={() => onClick(player.id)}
    >
      <div className="relative shrink-0 flex flex-col items-center gap-1">
        <div className="relative">
          <LazyPlayerAvatar
            name={player.name}
            imageId={player.imageId}
            cachedUrl={player.cachedUrl}
            className="w-8 h-8 sm:w-9 sm:h-9 border border-border/50"
          />
          {isPlaying && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-[1.5px] sm:border-2 border-background bg-green-500 animate-pulse" />
          )}
        </div>
        <span className="text-[8px] sm:hidden font-medium text-muted-foreground leading-none">
          {player.team}
        </span>
      </div>

      <div className="flex flex-col overflow-hidden min-w-0 flex-1">
        <p className="text-[10.5px] sm:text-[11px] font-bold leading-tight truncate text-foreground/90">
          {player.name.split(' ').length > 1
            ? `${player.name.charAt(0)}. ${player.name.split(' ').slice(1).join(' ')}`
            : player.name}
          {' '}<span className="hidden sm:inline text-[8.5px] sm:text-[9px] font-normal text-muted-foreground opacity-70">({player.team})</span>
        </p>
        <div className={cn(
          "flex flex-col gap-y-[1px] text-[8.5px] sm:text-[9px] text-muted-foreground mt-0.5",
          align === 'right' ? "items-end" : "items-start"
        )}>
          {cricketMatches.length > 0 ? cricketMatches.map(m => {
            const pCountry = getCountry(player.team);
            const isTeam1 = getCountry(m.team1?.name || '') === pCountry || getCountry(m.team1?.shortName || '') === pCountry;
            const opp = isTeam1 ? (m.team2?.shortName || m.team2?.name || 'Unknown') : (m.team1?.shortName || m.team1?.name || 'Unknown');
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
          }) : <span>No matches</span>}
        </div>
      </div>

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

const MatchupRowInline = ({
  homePlayer,
  awayPlayer,
  assignedRoleLabel,
  onPlayerClick,
}: {
  homePlayer?: PlayerWithMatches;
  awayPlayer?: PlayerWithMatches;
  assignedRoleLabel?: string;
  onPlayerClick: (id: string) => void;
}) => {
  let displayRoleLabel = assignedRoleLabel || 'UNSET';
  if (!assignedRoleLabel && (homePlayer || awayPlayer)) {
    const role = homePlayer?.player.role || awayPlayer?.player.role || '';
    displayRoleLabel = role === 'Batsman' ? 'BAT' : role === 'Bowler' ? 'BWL' : role === 'All Rounder' ? 'AR' : role === 'Wicket Keeper' ? 'WK' : role;
  }

  return (
    <div className="flex items-stretch justify-between py-1.5 border-b border-border/30 last:border-0 w-full overflow-hidden">
      <div className="flex-1 w-0 flex justify-start">
        <PlayerRow playerData={homePlayer} align="left" onClick={onPlayerClick} />
      </div>
      <div className="w-[44px] shrink-0 flex items-center justify-center z-10 px-0.5 sm:px-1">
        <div className={cn(
          "px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter border shadow-sm w-full text-center truncate",
          displayRoleLabel === 'BAT' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
          displayRoleLabel === 'BWL' && "bg-red-500/10 text-red-500 border-red-500/20",
          displayRoleLabel === 'AR' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
          displayRoleLabel === 'WK' && "bg-green-500/10 text-green-500 border-green-500/20",
          displayRoleLabel === 'FLEX' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
          displayRoleLabel === 'UNSET' && "bg-muted text-muted-foreground border-border",
          displayRoleLabel === 'BNCH' && "bg-muted text-muted-foreground border-border",
        )}>
          {displayRoleLabel}
        </div>
      </div>
      <div className="flex-1 w-0 flex justify-end">
        <PlayerRow playerData={awayPlayer} align="right" onClick={onPlayerClick} />
      </div>
    </div>
  );
};

const HeadToHeadSectionInline = ({
  title,
  homePlayers,
  awayPlayers,
  onPlayerClick,
  useSlots = false,
  config = DEFAULT_LEAGUE_CONFIG,
}: {
  title: string;
  homePlayers: PlayerWithMatches[];
  awayPlayers: PlayerWithMatches[];
  onPlayerClick: (id: string) => void;
  useSlots?: boolean;
  config?: LeagueConfig;
}) => {
  const rows: { home: PlayerWithMatches | null; away: PlayerWithMatches | null; label: string }[] = [];

  if (useSlots) {
    const homeSlots = assignToSlots(homePlayers, config);
    const awaySlots = assignToSlots(awayPlayers, config);
    const maxCount = Math.max(homeSlots.length, awaySlots.length);
    for (let i = 0; i < maxCount; i++) {
      rows.push({
        home: homeSlots[i]?.player || null,
        away: awaySlots[i]?.player || null,
        label: homeSlots[i]?.roleLabel || awaySlots[i]?.roleLabel || 'UNSET',
      });
    }
  } else {
    const roleOrder = ['Wicket Keeper', 'Batsman', 'All Rounder', 'Bowler'];
    const sortParams = (p: PlayerWithMatches) => roleOrder.indexOf(p.player.role);
    const sortedHome = [...homePlayers].sort((a, b) => sortParams(a) - sortParams(b));
    const sortedAway = [...awayPlayers].sort((a, b) => sortParams(a) - sortParams(b));
    const maxCount = Math.max(sortedHome.length, sortedAway.length, config.benchSize || 0);
    for (let i = 0; i < maxCount; i++) {
      rows.push({
        home: sortedHome[i] || null,
        away: sortedAway[i] || null,
        label: sortedHome[i] || sortedAway[i] ? 'BNCH' : 'UNSET',
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
          <MatchupRowInline
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

/* ------------------------------------------------------------------ */
/*  Main Matchup Page                                                  */
/* ------------------------------------------------------------------ */

const Matchup = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const currentWeek = useGameStore(state => state.currentWeek);
  const currentManagerId = useGameStore(state => state.currentManagerId);
  const players = useGameStore(state => state.players);
  const loading = useGameStore(state => state.loading);
  const leagueName = useGameStore(state => state.leagueName);
  const leagueConfig = useGameStore(state => state.config);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Find the current manager's match for the current week
  const currentMatch = useMemo(() => {
    if (!currentManagerId || !schedule.length) return null;
    const weekToUse = currentWeek === 0 ? 1 : currentWeek;
    return schedule.find(
      m => m.week === weekToUse && (m.home === currentManagerId || m.away === currentManagerId)
    ) || null;
  }, [schedule, currentWeek, currentManagerId]);

  const homeManager = useMemo(
    () => currentMatch ? managers.find(m => m.id === currentMatch.home) : undefined,
    [currentMatch, managers]
  );
  const awayManager = useMemo(
    () => currentMatch ? managers.find(m => m.id === currentMatch.away) : undefined,
    [currentMatch, managers]
  );

  const matchWeek = currentMatch ? Number(currentMatch.week) : (currentWeek === 0 ? 1 : currentWeek);

  // Fetch roster data for the week
  const fetchRosterForWeek = useGameStore(state => state.fetchRosterForWeek);
  useEffect(() => {
    if (leagueId && matchWeek > 0) {
      fetchRosterForWeek(leagueId, matchWeek);
    }
  }, [leagueId, matchWeek, fetchRosterForWeek]);

  const matchupData = useMatchupData(matchWeek, homeManager, awayManager, players, leagueId || null);

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
  const totalWeeks = useMemo(() => {
    if (!schedule.length) return 7;
    return Math.max(...schedule.map(m => m.week));
  }, [schedule]);

  if (loading) {
    return (
      <AppLayout title={leagueName || 'Matchup'}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!currentMatch) {
    return (
      <AppLayout
        title={leagueName || 'Matchup'}
        subtitle={currentWeek === 0 ? 'Pre-Season' : `Week ${currentWeek} of ${totalWeeks}`}
      >
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <Card className="max-w-sm w-full">
            <CardContent className="py-12 text-center space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-lg font-semibold">No Matchup</p>
              <p className="text-sm text-muted-foreground">
                You don't have a matchup scheduled for this week.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={leagueName || 'Matchup'}
      subtitle={`Week ${matchWeek} of ${totalWeeks}`}
    >
      <div className="px-4 py-6 space-y-6">
        {/* Score Header */}
        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 text-left">
            <p className="text-lg font-bold truncate text-foreground">
              {homeManager?.teamName || 'TBD'}
            </p>
            <p className="text-sm text-muted-foreground truncate">{homeManager?.name || '-'}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold">
                {matchupData.loading ? '-' : (
                  currentMatch.completed
                    ? (currentMatch.homeScore ?? 0).toFixed(1)
                    : (matchupData.data?.homeScore || 0).toFixed(1)
                )}
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
            {currentMatch.completed ? (
              <Trophy className="w-5 h-5 text-amber-400" />
            ) : (
              <Clock className="w-5 h-5 text-muted-foreground" />
            )}
            {currentMatch.modifiedBy && (
              <span className="text-[9px] text-amber-500/80 whitespace-nowrap">
                Admin adjusted
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 text-right">
            <p className="text-lg font-bold truncate text-foreground">
              {awayManager?.teamName || 'TBD'}
            </p>
            <p className="text-sm text-muted-foreground truncate">{awayManager?.name || '-'}</p>
            <div className="flex items-baseline gap-2 mt-1 justify-end">
              {awayManager && (
                <span className="text-xs text-muted-foreground">
                  {awayManager.wins}W - {awayManager.losses}L
                </span>
              )}
              <span className="text-3xl font-bold">
                {matchupData.loading ? '-' : (
                  currentMatch.completed
                    ? (currentMatch.awayScore ?? 0).toFixed(1)
                    : (matchupData.data?.awayScore || 0).toFixed(1)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Loading */}
        {matchupData.loading && (
          <div className="py-12 text-center text-muted-foreground">
            Loading matchup details...
          </div>
        )}

        {/* Roster Display */}
        {(!matchupData.loading || !!matchupData.data) && !matchupData.error && (
          <div className="flex flex-col gap-4">
            <HeadToHeadSectionInline
              title="Starters"
              homePlayers={homeStarters}
              awayPlayers={awayStarters}
              onPlayerClick={setSelectedPlayerId}
              useSlots={true}
              config={leagueConfig || undefined}
            />
            <HeadToHeadSectionInline
              title="Bench"
              homePlayers={homeBench}
              awayPlayers={awayBench}
              onPlayerClick={setSelectedPlayerId}
              useSlots={false}
              config={leagueConfig || undefined}
            />
          </div>
        )}
      </div>

      <PlayerDetailDialog
        player={selectedPlayer!}
        open={!!selectedPlayerId}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
        onAdd={() => setSelectedPlayerId(null)}
      />
    </AppLayout>
  );
};

export default Matchup;
