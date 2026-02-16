/**
 * Fantasy Scoring Rules Types
 * Extensible structure for per-league scoring customization
 */

// Common scoring rules
export interface CommonRules {
  starting11: number;
  matchWinningTeam: number;
  impactPlayer: number; // For appearing as impact player
  impactPlayerWinBonus: number; // Additional points if impact player's team wins
  manOfTheMatch: number;
}

// Batting scoring rules
export interface BattingRules {
  runs: number;
  four: number;
  six: number;
  milestones: {
    runs: number;
    points: number;
  }[];
  duckDismissal: number; // Penalty for duck
  lowScoreDismissal: number; // Penalty for <= 5 runs
  strikeRateBonuses: {
    minSR: number;
    maxSR: number;
    points: number;
    minBalls?: number;
    minRuns?: number;
  }[];
}

// Bowling scoring rules
export interface BowlingRules {
  wickets: number;
  milestones: {
    wickets: number;
    points: number;
  }[];
  dotBall: number;
  lbwOrBowledBonus: number;
  widePenalty: number;
  noBallPenalty: number;
  maidenOver: number;
  economyRateBonuses: {
    minER: number;
    maxER: number;
    points: number;
    minOvers?: number;
  }[];
}

// Fielding scoring rules
export interface FieldingRules {
  catch: number;
  stumping: number;
  runOut: number;
  multiCatchBonus: {
    count: number;
    points: number;
  };
}

// Complete scoring rules structure
export interface ScoringRules {
  common: CommonRules;
  batting: BattingRules;
  bowling: BowlingRules;
  fielding: FieldingRules;
}

// Default scoring rules - matching the user's requested values
export const DEFAULT_SCORING_RULES: ScoringRules = {
  common: {
    starting11: 5,
    matchWinningTeam: 5,
    impactPlayer: 5,
    impactPlayerWinBonus: 5,
    manOfTheMatch: 50,
  },
  batting: {
    runs: 1,
    four: 1,
    six: 2,
    milestones: [
      { runs: 25, points: 10 },
      { runs: 40, points: 15 },
      { runs: 60, points: 20 },
      { runs: 80, points: 25 },
      { runs: 100, points: 40 },
      { runs: 150, points: 80 },
    ],
    duckDismissal: -10,
    lowScoreDismissal: -5,
    strikeRateBonuses: [
      { minSR: 0, maxSR: 99.99, points: -30, minBalls: 10 },
      { minSR: 200.01, maxSR: 999.99, points: 30, minRuns: 10 },
    ],
  },
  bowling: {
    wickets: 30,
    milestones: [
      { wickets: 2, points: 10 },
      { wickets: 3, points: 20 },
      { wickets: 4, points: 30 },
      { wickets: 5, points: 40 },
      { wickets: 6, points: 60 },
    ],
    dotBall: 1,
    lbwOrBowledBonus: 5,
    widePenalty: -1,
    noBallPenalty: -5,
    maidenOver: 40,
    economyRateBonuses: [
      { minER: 0, maxER: 3.99, points: 40, minOvers: 2 },
      { minER: 10.01, maxER: 99.99, points: -15, minOvers: 2 },
    ],
  },
  fielding: {
    catch: 10,
    stumping: 20,
    runOut: 10,
    multiCatchBonus: {
      count: 2,
      points: 10,
    },
  },
};

/**
 * Sanitize scoring rules by converting empty strings to 0 recursively.
 * Used before saving to the database.
 */
export function sanitizeScoringRules(rules: ScoringRules): ScoringRules {
  const sanitize = (obj: unknown): unknown => {
    if (typeof obj !== 'object' || obj === null) return obj === '' ? 0 : obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      newObj[key] = sanitize((obj as Record<string, unknown>)[key]);
    }
    return newObj;
  };
  return sanitize(rules) as ScoringRules;
}

/**
 * Merge partial scoring rules with defaults
 * Ensures all required fields are present even if DB has partial data
 */
export function mergeScoringRules(partial?: Partial<ScoringRules> | null): ScoringRules {
  if (!partial) {
    return DEFAULT_SCORING_RULES;
  }

  // Deep merge with defaults to ensure all nested fields exist
  return {
    common: { ...DEFAULT_SCORING_RULES.common, ...partial.common },
    batting: {
      ...DEFAULT_SCORING_RULES.batting,
      ...partial.batting,
      milestones: Array.isArray(partial.batting?.milestones) ? partial.batting.milestones : DEFAULT_SCORING_RULES.batting.milestones,
      strikeRateBonuses: Array.isArray(partial.batting?.strikeRateBonuses) ? partial.batting.strikeRateBonuses : DEFAULT_SCORING_RULES.batting.strikeRateBonuses
    },
    bowling: {
      ...DEFAULT_SCORING_RULES.bowling,
      ...partial.bowling,
      milestones: Array.isArray(partial.bowling?.milestones) ? partial.bowling.milestones : DEFAULT_SCORING_RULES.bowling.milestones,
      economyRateBonuses: Array.isArray(partial.bowling?.economyRateBonuses) ? partial.bowling.economyRateBonuses : DEFAULT_SCORING_RULES.bowling.economyRateBonuses
    },
    fielding: {
      ...DEFAULT_SCORING_RULES.fielding,
      ...partial.fielding,
      multiCatchBonus: { ...DEFAULT_SCORING_RULES.fielding.multiCatchBonus, ...partial.fielding?.multiCatchBonus }
    },
  };
}
