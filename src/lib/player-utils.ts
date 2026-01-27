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
