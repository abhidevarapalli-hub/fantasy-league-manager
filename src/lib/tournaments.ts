/**
 * Supported Tournaments Configuration
 * 
 * Hardcoded list of tournaments that can be selected when creating a league.
 * Series IDs are from the Cricbuzz RapidAPI.
 */

export type TournamentType = 'international' | 'league';

export interface Tournament {
  id: number;
  name: string;
  shortName: string;
  type: TournamentType;
  description?: string;
}

export const SUPPORTED_TOURNAMENTS: readonly Tournament[] = [
  {
    id: 11253,
    name: 'ICC Mens T20 World Cup 2026',
    shortName: 'T20 WC 2026',
    type: 'international',
    description: 'International T20 tournament featuring national teams',
  },
  {
    id: 9241,
    name: 'Indian Premier League 2026',
    shortName: 'IPL 2026',
    type: 'league',
    description: 'T20 franchise league with IPL teams',
  },
] as const;

/**
 * Get tournament by ID
 */
export function getTournamentById(id: number): Tournament | undefined {
  return SUPPORTED_TOURNAMENTS.find(t => t.id === id);
}

/**
 * Check if a tournament ID is supported
 */
export function isSupportedTournament(id: number): boolean {
  return SUPPORTED_TOURNAMENTS.some(t => t.id === id);
}

/**
 * Get default tournament (IPL)
 */
export function getDefaultTournament(): Tournament {
  return SUPPORTED_TOURNAMENTS.find(t => t.type === 'league') || SUPPORTED_TOURNAMENTS[0];
}
