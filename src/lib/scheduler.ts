export interface Matchup {
    round: number;
    home: string;
    away: string | null; // null means Bye
}

/**
 * Generates a round-robin schedule for a given list of manager IDs.
 * If the number of managers is odd, a dummy 'BYE' is introduced.
 * Each manager plays every other manager exactly once.
 * uses the standard "Circle Method".
 * 
 * @param managerIds Array of manager IDs
 * @returns Array of Matchup objects
 */
export const generateSchedule = (managerIds: string[]): Matchup[] => {
    if (managerIds.length < 2) return [];

    const teams = [...managerIds];

    // If odd number of teams, add 'BYE' placeholder
    if (teams.length % 2 !== 0) {
        teams.push('BYE');
    }

    const n = teams.length;
    const numRounds = n - 1;
    const matchesPerRound = n / 2;
    const schedule: Matchup[] = [];

    // Indices of teams in the rotating circle (all except index 0)
    // We keep index 0 fixed at position 0.
    // The rest rotate.
    const rotatingTeamIndices: number[] = [];
    for (let i = 1; i < n; i++) {
        rotatingTeamIndices.push(i);
    }

    for (let round = 1; round <= numRounds; round++) {
        // 1. Match fixed team (index 0) with last element of rotating array
        const fixedTeam = teams[0];
        const rotatingTeam = teams[rotatingTeamIndices[rotatingTeamIndices.length - 1]];

        // Add match involving fixed team
        if (fixedTeam !== 'BYE' && rotatingTeam !== 'BYE') {
            schedule.push({ round, home: fixedTeam, away: rotatingTeam });
        } else if (fixedTeam !== 'BYE') {
            schedule.push({ round, home: fixedTeam, away: null }); // fixed has bye
        } else {
            schedule.push({ round, home: rotatingTeam, away: null }); // rotating has bye
        }

        // 2. Match the rest of the pairs from the rotating array
        for (let i = 0; i < matchesPerRound - 1; i++) {
            const idx1 = rotatingTeamIndices[i];
            const idx2 = rotatingTeamIndices[rotatingTeamIndices.length - 2 - i];

            const team1 = teams[idx1];
            const team2 = teams[idx2];

            if (team1 !== 'BYE' && team2 !== 'BYE') {
                schedule.push({ round, home: team1, away: team2 });
            } else if (team1 !== 'BYE') {
                schedule.push({ round, home: team1, away: null });
            } else {
                schedule.push({ round, home: team2, away: null });
            }
        }

        // Rotate the indices
        // Take last element and move to front
        const last = rotatingTeamIndices.pop();
        if (last !== undefined) {
            rotatingTeamIndices.unshift(last);
        }
    }

    return schedule;
};
