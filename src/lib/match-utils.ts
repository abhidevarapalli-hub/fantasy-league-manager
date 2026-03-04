/**
 * Parse the result text from a cricket match and determine the winner team ID.
 * Handles patterns like "India won by 29 runs", "West Indies won by 35 runs"
 */
export function resolveWinnerFromResult(
  result: string | null,
  team1Name: string | null,
  team2Name: string | null,
  team1Id: number | null,
  team2Id: number | null
): number | null {
  if (!result) return null;

  const match = result.match(/^(.+?)\s+won\s+by/i);
  if (!match) return null;

  const winnerName = match[1].toLowerCase().trim();

  if (team1Name && team1Name.toLowerCase() === winnerName) return team1Id;
  if (team2Name && team2Name.toLowerCase() === winnerName) return team2Id;

  return null;
}
