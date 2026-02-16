import { DEFAULT_SCORING_RULES } from './scoring-types';

/**
 * Interface representing the stats needed for calculation.
 * Compatible with both PlayerMatchPerformance and PlayerMatchStats.
 */
export interface CalculableStats {
    runs?: number;
    fours?: number;
    sixes?: number;
    isNotOut?: boolean;
    wickets?: number;
    overs?: number;
    economy?: number;
    maidens?: number;
    catches?: number;
    stumpings?: number;
    runOuts?: number;
    dismissalType?: string | null;
}

export const calculateFantasyPoints = (stats: CalculableStats) => {
    let points = 0;
    const rules = DEFAULT_SCORING_RULES;

    // Basic points
    // Note: We assume they started if they have stats, but we can't be 100% sure without 'isInPlaying11'
    // However, PlayerDetailDialog assumed this: "Assume they started if they have stats"
    points += rules.common.starting11;

    // Batting
    if (stats.runs !== undefined) {
        points += stats.runs * rules.batting.runs;
        points += (stats.fours || 0) * rules.batting.four;
        points += (stats.sixes || 0) * rules.batting.six;

        // Milestones
        if (stats.runs >= 100) points += 40; // Century
        else if (stats.runs >= 50) points += 20; // Half century

        // Duck
        if (stats.runs === 0 && !stats.isNotOut) points += rules.batting.duckDismissal;
    }

    // Bowling
    if (stats.wickets !== undefined) {
        points += stats.wickets * rules.bowling.wickets;

        // Milestones
        if (stats.wickets >= 5) points += 40; // 5-fer
        else if (stats.wickets >= 4) points += 30; // 4-fer
        else if (stats.wickets >= 3) points += 20; // 3-fer

        // Economy bonus
        const overs = stats.overs || 0;
        if (overs >= 2 && stats.economy) {
            if (stats.economy < 5) points += 20;
            else if (stats.economy < 6) points += 10;
        }

        // Maiden
        if (stats.maidens) points += (stats.maidens || 0) * rules.bowling.maidenOver;
    }

    // Fielding
    if (stats.catches) points += stats.catches * rules.fielding.catch;
    if (stats.stumpings) points += stats.stumpings * rules.fielding.stumping;
    if (stats.runOuts) points += stats.runOuts * rules.fielding.runOut;

    return points;
};
