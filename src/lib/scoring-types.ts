/**
 * Fantasy Scoring Rules Types
 * Extensible structure for per-league scoring customization
 */

// Batting scoring rules
export interface BattingRules {
  runs: number;           // Points per run scored
  // Future extensions (optional properties)
  fours?: number;         // Bonus points per boundary (4)
  sixes?: number;         // Bonus points per six
  halfCentury?: number;   // Bonus for scoring 50+
  century?: number;       // Bonus for scoring 100+
  duck?: number;          // Penalty for getting out on 0 (usually negative)
  strikeRateBonus?: {     // Bonus/penalty based on strike rate
    enabled: boolean;
    threshold: number;    // Strike rate threshold (e.g., 150)
    points: number;       // Points awarded if above threshold
  };
}

// Bowling scoring rules
export interface BowlingRules {
  wickets: number;        // Points per wicket taken
  // Future extensions (optional properties)
  maidens?: number;       // Points per maiden over
  threeWicketHaul?: number;   // Bonus for 3+ wickets
  fourWicketHaul?: number;    // Bonus for 4+ wickets
  fiveWicketHaul?: number;    // Bonus for 5+ wickets
  hatTrick?: number;          // Bonus for hat-trick
  economyBonus?: {        // Bonus/penalty based on economy rate
    enabled: boolean;
    threshold: number;    // Economy rate threshold (e.g., 6.0)
    points: number;       // Points awarded if below threshold
  };
}

// Fielding scoring rules
export interface FieldingRules {
  catches: number;        // Points per catch
  // Future extensions (optional properties)
  stumpings?: number;     // Points per stumping
  runOuts?: number;       // Points per run out (direct hit)
  runOutAssist?: number;  // Points for run out assist
}

// Complete scoring rules structure
export interface ScoringRules {
  batting: BattingRules;
  bowling: BowlingRules;
  fielding: FieldingRules;
}

// Default scoring rules - used when a league doesn't have custom rules
export const DEFAULT_SCORING_RULES: ScoringRules = {
  batting: {
    runs: 1,
  },
  bowling: {
    wickets: 25,
  },
  fielding: {
    catches: 8,
  },
};

/**
 * Merge partial scoring rules with defaults
 * Ensures all required fields are present even if DB has partial data
 */
export function mergeScoringRules(partial?: Partial<ScoringRules> | null): ScoringRules {
  if (!partial) {
    return DEFAULT_SCORING_RULES;
  }

  return {
    batting: {
      ...DEFAULT_SCORING_RULES.batting,
      ...partial.batting,
    },
    bowling: {
      ...DEFAULT_SCORING_RULES.bowling,
      ...partial.bowling,
    },
    fielding: {
      ...DEFAULT_SCORING_RULES.fielding,
      ...partial.fielding,
    },
  };
}
