import { describe, it, expect } from 'vitest';
import {
  calculateFantasyPoints,
  formatPointsBreakdown,
  type PlayerStats,
} from './fantasy-points-calculator';
import { DEFAULT_SCORING_RULES } from './scoring-types';

// Helper to create default stats with overrides
const createStats = (overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  runs: 0,
  ballsFaced: 0,
  fours: 0,
  sixes: 0,
  isOut: false,
  overs: 0,
  maidens: 0,
  runsConceded: 0,
  wickets: 0,
  dots: 0,
  wides: 0,
  noBalls: 0,
  lbwBowledCount: 0,
  catches: 0,
  stumpings: 0,
  runOuts: 0,
  isInPlaying11: true,
  isImpactPlayer: false,
  isManOfMatch: false,
  teamWon: false,
  ...overrides,
});

describe('Fantasy Points Calculator', () => {
  describe('Common Points', () => {
    it('awards playing XI points', () => {
      const stats = createStats({ isInPlaying11: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.common.starting11).toBe(5);
    });

    it('awards match winning team points', () => {
      const stats = createStats({ teamWon: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.common.matchWinningTeam).toBe(5);
    });

    it('awards man of the match points', () => {
      const stats = createStats({ isManOfMatch: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.common.manOfTheMatch).toBe(50);
    });

    it('awards impact player points', () => {
      const stats = createStats({ isImpactPlayer: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.common.impactPlayer).toBe(5);
    });

    it('awards impact player win bonus when team wins', () => {
      const stats = createStats({ isImpactPlayer: true, teamWon: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.common.impactPlayerWinBonus).toBe(5);
    });
  });

  describe('Batting Points', () => {
    it('calculates run points correctly', () => {
      const stats = createStats({ runs: 50, ballsFaced: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.runs).toBe(50);
    });

    it('calculates boundary points correctly', () => {
      const stats = createStats({ fours: 5, sixes: 3 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.fours).toBe(5); // 5 fours * 1 point
      expect(result.batting.sixes).toBe(6); // 3 sixes * 2 points
    });

    it('awards milestone bonus for 25 runs', () => {
      const stats = createStats({ runs: 25, ballsFaced: 20 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.milestoneBonus).toBe(10);
    });

    it('awards milestone bonus for 60 runs', () => {
      const stats = createStats({ runs: 60, ballsFaced: 40 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.milestoneBonus).toBe(20);
    });

    it('awards milestone bonus for 100 runs (century)', () => {
      const stats = createStats({ runs: 100, ballsFaced: 60 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.milestoneBonus).toBe(40);
    });

    it('applies duck penalty', () => {
      const stats = createStats({ runs: 0, ballsFaced: 5, isOut: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.duckPenalty).toBe(-10);
    });

    it('applies low score penalty (1-5 runs)', () => {
      const stats = createStats({ runs: 3, ballsFaced: 10, isOut: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.lowScorePenalty).toBe(-5);
    });

    it('does not apply low score penalty for not out', () => {
      const stats = createStats({ runs: 3, ballsFaced: 10, isOut: false });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.lowScorePenalty).toBe(0);
    });

    it('applies strike rate penalty for slow batting', () => {
      // SR = 50 (below 100), faced 10+ balls
      const stats = createStats({ runs: 5, ballsFaced: 10, isOut: true });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.strikeRateBonus).toBe(-30);
    });

    it('awards strike rate bonus for fast batting', () => {
      // SR = 250 (above 200), scored 10+ runs
      const stats = createStats({ runs: 25, ballsFaced: 10 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.batting.strikeRateBonus).toBe(30);
    });
  });

  describe('Bowling Points', () => {
    it('calculates wicket points correctly', () => {
      const stats = createStats({ wickets: 3, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.wickets).toBe(90); // 3 wickets * 30 points
    });

    it('awards wicket milestone bonus', () => {
      const stats = createStats({ wickets: 3, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.milestoneBonus).toBe(20); // 3-wicket bonus
    });

    it('awards 5-wicket haul bonus', () => {
      const stats = createStats({ wickets: 5, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.milestoneBonus).toBe(40);
    });

    it('calculates dot ball points', () => {
      const stats = createStats({ dots: 12, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.dots).toBe(12);
    });

    it('calculates LBW/bowled bonus', () => {
      const stats = createStats({ lbwBowledCount: 2, wickets: 2, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.lbwBowledBonus).toBe(10); // 2 * 5
    });

    it('applies wide penalty', () => {
      const stats = createStats({ wides: 3, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.widePenalty).toBe(-3);
    });

    it('applies no ball penalty', () => {
      const stats = createStats({ noBalls: 2, overs: 4, runsConceded: 30 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.noBallPenalty).toBe(-10); // 2 * -5
    });

    it('awards maiden over points', () => {
      const stats = createStats({ maidens: 1, overs: 4, runsConceded: 24 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.maidens).toBe(40);
    });

    it('awards economy rate bonus for tight bowling', () => {
      // ER = 3 (below 4), bowled 2+ overs
      const stats = createStats({ overs: 4, runsConceded: 12 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.economyBonus).toBe(40);
    });

    it('applies economy rate penalty for expensive bowling', () => {
      // ER = 12 (above 10), bowled 2+ overs
      const stats = createStats({ overs: 4, runsConceded: 48 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.bowling.economyBonus).toBe(-15);
    });
  });

  describe('Fielding Points', () => {
    it('calculates catch points correctly', () => {
      const stats = createStats({ catches: 2 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.fielding.catches).toBe(20); // 2 catches * 10
    });

    it('awards multi-catch bonus', () => {
      const stats = createStats({ catches: 2 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.fielding.multiCatchBonus).toBe(10);
    });

    it('calculates stumping points correctly', () => {
      const stats = createStats({ stumpings: 1 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.fielding.stumpings).toBe(20);
    });

    it('calculates run out points correctly', () => {
      const stats = createStats({ runOuts: 2 });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      expect(result.fielding.runOuts).toBe(20); // 2 * 10
    });
  });

  describe('Real Match Scenarios', () => {
    it('calculates points for Suryakumar Yadav (82* off 37, 9x4, 4x6, winning team)', () => {
      const stats = createStats({
        runs: 82,
        ballsFaced: 37,
        fours: 9,
        sixes: 4,
        isOut: false,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Batting: 82 runs + 9 fours + 8 sixes + 25 (80-run milestone) + 30 (SR bonus) = 154
      expect(result.batting.runs).toBe(82);
      expect(result.batting.fours).toBe(9);
      expect(result.batting.sixes).toBe(8);
      expect(result.batting.milestoneBonus).toBe(25);
      expect(result.batting.strikeRateBonus).toBe(30); // SR = 221.6

      // Common: 5 (playing) + 5 (winning) = 10
      expect(result.common.total).toBe(10);

      // Total should be around 164
      expect(result.total).toBe(164);
    });

    it('calculates points for Ishan Kishan (76 off 32, 11x4, 4x6, out, winning team)', () => {
      const stats = createStats({
        runs: 76,
        ballsFaced: 32,
        fours: 11,
        sixes: 4,
        isOut: true,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Batting: 76 runs + 11 fours + 8 sixes + 20 (60-run milestone) + 30 (SR bonus) = 145
      expect(result.batting.runs).toBe(76);
      expect(result.batting.fours).toBe(11);
      expect(result.batting.sixes).toBe(8);
      expect(result.batting.milestoneBonus).toBe(20);
      expect(result.batting.strikeRateBonus).toBe(30); // SR = 237.5

      // Common: 5 (playing) + 5 (winning) = 10
      expect(result.common.total).toBe(10);

      // Total should be around 155
      expect(result.total).toBe(155);
    });

    it('calculates points for Kuldeep Yadav (2/35 in 4 overs)', () => {
      const stats = createStats({
        wickets: 2,
        overs: 4,
        runsConceded: 35,
        dots: 10,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Bowling: 60 (2 wkts) + 10 (2-wkt milestone) + 10 (dots) = 80
      expect(result.bowling.wickets).toBe(60);
      expect(result.bowling.milestoneBonus).toBe(10);
      expect(result.bowling.dots).toBe(10);

      // Common: 5 (playing) + 5 (winning) = 10
      expect(result.common.total).toBe(10);

      // ER = 8.75 (no bonus/penalty)
      expect(result.bowling.economyBonus).toBe(0);
    });

    it('calculates points for a duck (0 off 5, out)', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 5,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Batting: 0 runs + (-10) duck penalty = -10
      expect(result.batting.duckPenalty).toBe(-10);
      expect(result.batting.total).toBe(-10);

      // Common: 5 (playing) = 5
      expect(result.common.total).toBe(5);

      // Total should be -5
      expect(result.total).toBe(-5);
    });

    it('calculates points for economical bowling (4 overs, 12 runs)', () => {
      const stats = createStats({
        overs: 4,
        runsConceded: 12,
        wickets: 1,
        dots: 18,
        maidens: 1,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Bowling: 30 (1 wkt) + 18 (dots) + 40 (maiden) + 40 (economy bonus) = 128
      expect(result.bowling.wickets).toBe(30);
      expect(result.bowling.dots).toBe(18);
      expect(result.bowling.maidens).toBe(40);
      expect(result.bowling.economyBonus).toBe(40); // ER = 3.0

      // Common: 5 (playing) + 5 (winning) = 10
      expect(result.common.total).toBe(10);
    });

    it('calculates points for expensive bowling (3 overs, 67 runs)', () => {
      const stats = createStats({
        overs: 3,
        runsConceded: 67,
        wickets: 0,
        dots: 2,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Bowling: 2 (dots) + (-15) economy penalty = -13
      expect(result.bowling.dots).toBe(2);
      expect(result.bowling.economyBonus).toBe(-15); // ER = 22.3

      // Common: 5 (playing) + 5 (winning) = 10
      expect(result.common.total).toBe(10);

      // Total = 10 + (-13) = -3
      expect(result.total).toBe(-3);
    });

    it('calculates MoM bonus correctly', () => {
      const stats = createStats({
        runs: 100,
        ballsFaced: 55,
        fours: 10,
        sixes: 5,
        isInPlaying11: true,
        teamWon: true,
        isManOfMatch: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      expect(result.common.manOfTheMatch).toBe(50);
      // Total should include the MoM bonus
      expect(result.total).toBeGreaterThan(200);
    });
  });

  describe('Format Points Breakdown', () => {
    it('formats breakdown as readable string', () => {
      const stats = createStats({
        runs: 50,
        ballsFaced: 30,
        fours: 5,
        sixes: 2,
        wickets: 1,
        overs: 2,
        runsConceded: 15,
        catches: 1,
        isInPlaying11: true,
        teamWon: true,
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);
      const formatted = formatPointsBreakdown(result);

      expect(formatted).toContain('Common:');
      expect(formatted).toContain('Batting:');
      expect(formatted).toContain('Bowling:');
      expect(formatted).toContain('Fielding:');
      expect(formatted).toContain('Total:');
    });
  });
});
