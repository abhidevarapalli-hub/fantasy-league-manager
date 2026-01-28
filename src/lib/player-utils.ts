/**
 * Player Utilities
 * 
 * Utilities for mapping Cricbuzz API data to app formats.
 */

// App role type (must match the database constraint)
export type AppRole = 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';

/**
 * Map Cricbuzz API role to app role format
 * API roles: Batsman, Bowler, WK-Batsman, Batting Allrounder, Bowling Allrounder
 */
export function mapApiRole(apiRole: string): AppRole {
  const normalizedRole = apiRole.toLowerCase().trim();
  
  if (normalizedRole.includes('wk') || normalizedRole.includes('wicket')) {
    return 'Wicket Keeper';
  }
  if (normalizedRole.includes('allrounder') || normalizedRole.includes('all-rounder')) {
    return 'All Rounder';
  }
  if (normalizedRole.includes('bowl')) {
    return 'Bowler';
  }
  if (normalizedRole.includes('bat')) {
    return 'Batsman';
  }
  
  // Default to All Rounder for unknown roles
  return 'All Rounder';
}

/**
 * Team code mappings for international teams
 */
const INTERNATIONAL_TEAM_CODES: Record<string, string> = {
  'India': 'IND',
  'Australia': 'AUS',
  'England': 'ENG',
  'South Africa': 'SA',
  'New Zealand': 'NZ',
  'Pakistan': 'PAK',
  'West Indies': 'WI',
  'Afghanistan': 'AFG',
  'Ireland': 'IRE',
  'Zimbabwe': 'ZIM',
  'Namibia': 'NAM',
  'Nepal': 'NEP',
  'Netherlands': 'NED',
  'Scotland': 'SCO',
  'Oman': 'OMN',
  'Canada': 'CAN',
  'Italy': 'ITA',
  'Bangladesh': 'BAN',
  'Sri Lanka': 'SL',
  'United Arab Emirates': 'UAE',
  'USA': 'USA',
  'Hong Kong': 'HK',
  'Papua New Guinea': 'PNG',
};

/**
 * Get 3-letter team code from full team name
 */
export function getTeamCode(teamName: string): string {
  // Check if it's an international team
  if (INTERNATIONAL_TEAM_CODES[teamName]) {
    return INTERNATIONAL_TEAM_CODES[teamName];
  }
  
  // For IPL/franchise teams, they usually already have short codes
  // or we generate a 2-3 letter code from the name
  const words = teamName.split(' ');
  if (words.length >= 2) {
    // Take first letter of first two words (e.g., "Mumbai Indians" -> "MI")
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  
  // Fallback: first 3 characters
  return teamName.substring(0, 3).toUpperCase();
}

/**
 * Check if a team is an international team (for T20 WC)
 * For international tournaments, all players are considered "international"
 * since they represent their countries.
 * 
 * For IPL, we need to check against the known international players list.
 */
export function isInternationalTeam(teamName: string): boolean {
  return teamName in INTERNATIONAL_TEAM_CODES;
}

/**
 * For T20 World Cup: All non-India players are international
 * This is used for fantasy league international player limits
 */
export function isInternationalForT20WC(teamName: string): boolean {
  return teamName !== 'India';
}

// ============================================
// Tournament-based Team Resolution
// ============================================

import { TournamentType } from './tournaments';

/**
 * Reverse mapping: Cricbuzz team short name -> full country name
 * Used to look up national teams from API responses
 */
export const TEAM_SHORT_TO_COUNTRY: Record<string, string> = {
  'IND': 'India',
  'AUS': 'Australia',
  'ENG': 'England',
  'RSA': 'South Africa',  // Cricbuzz uses RSA
  'SA': 'South Africa',
  'NZ': 'New Zealand',
  'PAK': 'Pakistan',
  'WI': 'West Indies',
  'AFG': 'Afghanistan',
  'IRE': 'Ireland',
  'ZIM': 'Zimbabwe',
  'NAM': 'Namibia',
  'NEP': 'Nepal',
  'NED': 'Netherlands',
  'SCO': 'Scotland',
  'OMAN': 'Oman',
  'OMN': 'Oman',
  'CAN': 'Canada',
  'ITA': 'Italy',
  'BAN': 'Bangladesh',
  'SL': 'Sri Lanka',
  'UAE': 'United Arab Emirates',
  'USA': 'United States of America',
  'HK': 'Hong Kong',
  'PNG': 'Papua New Guinea',
};

/**
 * Get the team short code to use for filtering matches based on tournament type.
 * 
 * For league tournaments (IPL): Use the franchise team (e.g., "MI")
 * For international tournaments (T20 WC): 
 *   - Domestic players (isInternational=false) -> "IND"
 *   - Overseas players -> Need to fetch from API (intlTeam field)
 * 
 * @param franchiseTeam - The player's IPL/franchise team (e.g., "MI", "CSK")
 * @param isInternational - Whether the player is an overseas player
 * @param tournamentType - The tournament type ('international' | 'league')
 * @param nationalTeam - The player's national team from Cricbuzz API (optional)
 * @returns The team short code to use for filtering matches
 */
export function getPlayerTeamForTournament(
  franchiseTeam: string,
  isInternational: boolean,
  tournamentType: TournamentType,
  nationalTeam?: string
): string {
  // For league tournaments (IPL), always use the franchise team
  if (tournamentType === 'league') {
    return franchiseTeam;
  }
  
  // For international tournaments (T20 WC)
  // Domestic players (not international) are Indian
  if (!isInternational) {
    return 'IND';
  }
  
  // For overseas players, use the national team if provided
  if (nationalTeam) {
    // nationalTeam might be full name or short code
    // Check if it's already a short code
    if (nationalTeam.length <= 4 && nationalTeam === nationalTeam.toUpperCase()) {
      return nationalTeam;
    }
    // Convert full name to short code
    return INTERNATIONAL_TEAM_CODES[nationalTeam] || nationalTeam;
  }
  
  // Fallback: return franchise team (won't match international matches)
  // The UI should handle this by fetching player info from API
  return franchiseTeam;
}

/**
 * Check if we need to fetch the national team from API
 * This is needed for overseas players in international tournaments
 */
export function needsNationalTeamLookup(
  isInternational: boolean,
  tournamentType: TournamentType,
  nationalTeam?: string
): boolean {
  return tournamentType === 'international' && isInternational && !nationalTeam;
}

// ============================================
// Player Image Utilities
// ============================================

/**
 * Cricbuzz image size options
 * - 'de': Default/medium size (recommended for detail view)
 * - 'det': Detail size (larger)
 * - 'thumb': Thumbnail (small)
 * - 'gthumb': Gallery thumbnail
 */
export type ImageSize = 'de' | 'det' | 'thumb' | 'gthumb';

/**
 * Get the Cricbuzz image URL for a player or team
 * @param imageId - The imageId from Cricbuzz API
 * @param size - Image size (de, det, thumb, gthumb)
 * @param quality - Image quality (high, low)
 * @returns The full image URL or null if no imageId
 * 
 * Note: Images are served from Cricbuzz CDN. For CORS issues,
 * you may need to proxy through your backend.
 */
export function getCricbuzzImageUrl(
  imageId: number | undefined,
  size: ImageSize = 'de',
  quality: 'high' | 'low' = 'high'
): string | null {
  if (!imageId) return null;
  // Cricbuzz image URL format: /img/v1/i1/c{imageId}/i.jpg
  // The 'c' prefix is required for the imageId
  // Use proxy in development to handle auth headers for images
  const baseUrl = import.meta.env.DEV
    ? '/api/cricbuzz'
    : 'https://cricbuzz-cricket.p.rapidapi.com';
  return `${baseUrl}/img/v1/i1/c${imageId}/i.jpg?p=${size}&d=${quality}`;
}

/**
 * Get player avatar URL with fallback
 * Returns a placeholder if imageId is not available
 */
export function getPlayerAvatarUrl(
  imageId: number | undefined,
  size: ImageSize = 'de'
): string {
  const url = getCricbuzzImageUrl(imageId, size);
  // Return Cricbuzz URL or a default placeholder
  return url || '/placeholder.svg';
}

/**
 * Get player initials for avatar fallback
 */
export function getPlayerInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
