import { Tables } from '@/integrations/supabase/types';
import { Player, Manager, Match, Activity, PlayerTransaction } from '@/lib/supabase-types';

export const mapDbPlayer = (db: Tables<"players">): Player => ({
  id: db.id,
  name: db.name,
  team: db.team,
  role: db.role as Player["role"],
  isInternational: db.is_international ?? false,
});

export const mapDbManager = (db: Tables<"managers">): Manager => ({
  id: db.id,
  name: db.name,
  teamName: db.team_name,
  wins: db.wins,
  losses: db.losses,
  points: db.points,
  activeRoster: db.roster || [],
  bench: db.bench || [],
});

export const mapDbSchedule = (db: Tables<"schedule">): Match => ({
  id: db.id,
  week: db.week,
  home: db.home_manager_id || "",
  away: db.away_manager_id || "",
  homeScore: db.home_score ?? undefined,
  awayScore: db.away_score ?? undefined,
  completed: db.is_finalized,
});

export const mapDbTransaction = (db: Tables<"transactions">): Activity => ({
  id: db.id,
  timestamp: new Date(db.created_at),
  type: db.type as Activity["type"],
  managerId: db.manager_id || "system",
  description: db.description,
  players: (db.players as unknown as PlayerTransaction[] | null) || undefined,
  managerTeamName: db.manager_team_name || undefined,
});
