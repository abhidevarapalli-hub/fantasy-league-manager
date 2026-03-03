# Scoring Fixes, Match Finalization & Standings Pipeline - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix scoring edge cases, deduplicate scoring logic, add super-admin match/week finalization, and implement H2H standings ranking.

**Architecture:** Database-driven pipeline using PostgreSQL RPC functions for all finalization logic. Frontend handles UI and triggers recompute via existing `recomputeLeaguePoints()` utility. Shared scoring module between frontend and edge functions.

**Tech Stack:** TypeScript, React, Supabase (PostgreSQL RPCs, Edge Functions), Tailwind CSS, shadcn/ui, Vitest

**Design Doc:** `docs/plans/2026-02-27-scoring-standings-finalization-design.md`

---

## Task 1: Add playerRole to scoring calculator (role-based duck penalty)

**Files:**
- Modify: `src/lib/fantasy-points-calculator.ts:10-35` (PlayerStats interface)
- Modify: `src/lib/fantasy-points-calculator.ts:104-152` (calculateBattingPoints)
- Test: `src/lib/fantasy-points-calculator.test.ts`

**Step 1: Write failing tests for bowler duck exemption**

Add these tests after the existing `'calculates MoM bonus correctly'` test (line 378) inside the `'Real Match Scenarios'` describe block in `src/lib/fantasy-points-calculator.test.ts`:

```typescript
    it('exempts bowlers from duck penalty', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 3,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        playerRole: 'Bowler',
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Bowler should NOT get duck penalty
      expect(result.batting.duckPenalty).toBe(0);
      // Only common points (playing XI)
      expect(result.total).toBe(5);
    });

    it('exempts bowlers from low score penalty', () => {
      const stats = createStats({
        runs: 3,
        ballsFaced: 5,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        playerRole: 'Bowler',
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      // Bowler should NOT get low score penalty
      expect(result.batting.lowScorePenalty).toBe(0);
      expect(result.batting.runs).toBe(3);
    });

    it('applies duck penalty to batsmen', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 3,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        playerRole: 'Batsman',
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      expect(result.batting.duckPenalty).toBe(-10);
    });

    it('applies duck penalty to all-rounders', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 3,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        playerRole: 'All Rounder',
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      expect(result.batting.duckPenalty).toBe(-10);
    });

    it('applies duck penalty to wicket keepers', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 3,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        playerRole: 'Wicket Keeper',
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      expect(result.batting.duckPenalty).toBe(-10);
    });

    it('applies duck penalty when playerRole is undefined (safe default)', () => {
      const stats = createStats({
        runs: 0,
        ballsFaced: 3,
        isOut: true,
        isInPlaying11: true,
        teamWon: false,
        // playerRole intentionally omitted
      });
      const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

      expect(result.batting.duckPenalty).toBe(-10);
    });
```

Also update the `createStats` helper at line 10 to include `playerRole`:

```typescript
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
  playerRole: undefined,
  ...overrides,
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/fantasy-points-calculator.test.ts`
Expected: FAIL — `playerRole` does not exist on `PlayerStats`

**Step 3: Implement the playerRole field and role-based penalty logic**

In `src/lib/fantasy-points-calculator.ts`:

Add `playerRole` to the `PlayerStats` interface (after line 34, before the closing brace):

```typescript
  // Player role context
  playerRole?: string; // 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper'
```

Modify `calculateBattingPoints` (lines 121-126) — replace the duck and low score penalty lines:

```typescript
  // Role-based penalty exemption: bowlers don't get duck/low-score penalties
  const isBowler = stats.playerRole === 'Bowler';

  // Duck penalty (0 runs and out) — exempt bowlers
  const duckPenalty = stats.runs === 0 && stats.isOut && !isBowler ? rules.duckDismissal : 0;

  // Low score penalty (1-5 runs and out, but not a duck) — exempt bowlers
  const lowScorePenalty =
    stats.runs > 0 && stats.runs <= 5 && stats.isOut && !isBowler ? rules.lowScoreDismissal : 0;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/fantasy-points-calculator.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/fantasy-points-calculator.ts src/lib/fantasy-points-calculator.test.ts
git commit -m "feat(scoring): add role-based duck penalty exemption for bowlers"
```

---

## Task 2: Update recompute utility and supabase-types for playerRole

**Files:**
- Modify: `src/lib/scoring-recompute.ts:13-37` (RecomputeRow interface)
- Modify: `src/lib/scoring-recompute.ts:73-95` (PlayerStats mapping)
- Modify: `src/lib/supabase-types.ts:240-280` (PlayerMatchStats interface)
- Modify: `src/lib/supabase-types.ts:337-371` (mapDbPlayerMatchStats)

**Step 1: Add playerRole to RecomputeRow and mapping**

In `src/lib/scoring-recompute.ts`, add to the `RecomputeRow` interface (after line 36):

```typescript
  primary_role: string | null;
```

In the PlayerStats mapping (around line 94, after the `teamWon` line), add:

```typescript
      playerRole: row.primary_role ?? undefined,
```

**Step 2: Add playerRole to PlayerMatchStats interface**

In `src/lib/supabase-types.ts`, add to the `PlayerMatchStats` interface (after `teamWon: boolean;` at line 275):

```typescript
  playerRole?: string;
```

In `calculatePointsFromMatchStats` in `src/lib/fantasy-points-calculator.ts` (line 265-286), add to the stats mapping (after `teamWon`):

```typescript
    playerRole: matchStats.playerRole,
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/fantasy-points-calculator.test.ts`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/lib/scoring-recompute.ts src/lib/supabase-types.ts src/lib/fantasy-points-calculator.ts
git commit -m "feat(scoring): wire playerRole through recompute and type system"
```

---

## Task 3: Update get_league_match_stats_for_recompute RPC to return primary_role

**Files:**
- Create: `supabase/migrations/YYYYMMDD000000_scoring_finalization_rpcs.sql`

**Note:** We will use a single migration file for all new/modified RPCs in this project. Create it now and keep adding to it through tasks 3, 8, 9, 10, and 11.

**Step 1: Create the migration file with updated recompute RPC**

Create file `supabase/migrations/20260228000000_scoring_finalization_rpcs.sql`:

```sql
-- ============================================
-- Scoring Finalization & Standings Pipeline RPCs
-- Part of: scoring-standings-finalization design
-- ============================================

-- 1. Update get_league_match_stats_for_recompute to include player role
CREATE OR REPLACE FUNCTION get_league_match_stats_for_recompute(p_league_id UUID)
RETURNS TABLE (
  score_id UUID,
  player_id UUID,
  match_id UUID,
  runs INTEGER,
  balls_faced INTEGER,
  fours INTEGER,
  sixes INTEGER,
  is_out BOOLEAN,
  overs DECIMAL,
  maidens INTEGER,
  runs_conceded INTEGER,
  wickets INTEGER,
  dots INTEGER,
  wides INTEGER,
  no_balls INTEGER,
  lbw_bowled_count INTEGER,
  catches INTEGER,
  stumpings INTEGER,
  run_outs INTEGER,
  is_in_playing_11 BOOLEAN,
  is_impact_player BOOLEAN,
  is_man_of_match BOOLEAN,
  team_won BOOLEAN,
  primary_role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lpms.id as score_id,
    lpms.player_id,
    lpms.match_id,
    mps.runs,
    mps.balls_faced,
    mps.fours,
    mps.sixes,
    mps.is_out,
    mps.overs,
    mps.maidens,
    mps.runs_conceded,
    mps.wickets,
    mps.dots,
    mps.wides,
    mps.no_balls,
    mps.lbw_bowled_count,
    mps.catches,
    mps.stumpings,
    mps.run_outs,
    mps.is_in_playing_11,
    mps.is_impact_player,
    mps.is_man_of_match,
    mps.team_won,
    mp.primary_role
  FROM league_player_match_scores lpms
  JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id
  LEFT JOIN master_players mp ON mp.id = lpms.player_id
  WHERE lpms.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Step 2: Apply migration locally**

Run: `npm run supabase:reset`
Expected: Clean reset with migration applied, no errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228000000_scoring_finalization_rpcs.sql
git commit -m "feat(db): update recompute RPC to include player primary_role"
```

---

## Task 4: Deduplicate scoring logic - create shared module

**Files:**
- Create: `supabase/functions/_shared/fantasy-points-calculator.ts`
- Create: `supabase/functions/_shared/scoring-types.ts`

**Step 1: Create the _shared directory and copy canonical files**

The shared files are copies of the frontend canonical versions, adapted for Deno (edge function runtime). The main difference: strip the `import type { PlayerMatchStats }` since edge functions don't use `supabase-types.ts`.

Create `supabase/functions/_shared/scoring-types.ts` — copy the entire contents of `src/lib/scoring-types.ts` exactly as-is (all 179 lines). No modifications needed since it has no external imports.

Create `supabase/functions/_shared/fantasy-points-calculator.ts` — copy from `src/lib/fantasy-points-calculator.ts` but change the imports:

Replace line 6-7:
```typescript
import type { ScoringRules } from './scoring-types';
import type { PlayerMatchStats } from './supabase-types';
```

With:
```typescript
import type { ScoringRules } from './scoring-types.ts';
```

And **remove** the `calculatePointsFromMatchStats` function (lines 261-289) and the `formatPointsBreakdown` function (lines 294-346) since edge functions don't use them. Only keep:
- `PlayerStats` interface
- `PointsBreakdown` interface
- `calculateCommonPoints` function
- `calculateBattingPoints` function
- `calculateBowlingPoints` function
- `calculateFieldingPoints` function
- `calculateFantasyPoints` function (the main export)

**Step 2: Add sync script to package.json**

Add to the `scripts` section of `package.json`:

```json
"sync:scoring": "cp src/lib/scoring-types.ts supabase/functions/_shared/scoring-types.ts && sed 's|./scoring-types|./scoring-types.ts|g; s|./supabase-types|./supabase-types.ts|g' src/lib/fantasy-points-calculator.ts > supabase/functions/_shared/fantasy-points-calculator.ts"
```

**Important:** The sed-based sync is a starting point. The shared copy may need manual adjustments (removing the `PlayerMatchStats` import and functions that depend on it). After running the sync, verify the shared file compiles in the Deno edge function context.

**Step 3: Commit**

```bash
git add supabase/functions/_shared/ package.json
git commit -m "feat(scoring): create shared scoring module for edge functions"
```

---

## Task 5: Remove duplicated scoring from live-stats-poller

**Files:**
- Modify: `supabase/functions/live-stats-poller/index.ts:309-397` (remove calculateFantasyPoints)
- Modify: `supabase/functions/live-stats-poller/index.ts` (add import from _shared)

**Step 1: Read the full edge function to understand the duplicate**

Read `supabase/functions/live-stats-poller/index.ts` fully. The duplicated function is at lines 309-397. It has a slightly different signature — it accepts `(stats, rules, isManOfMatch)` with some normalization.

**Step 2: Remove the inline calculateFantasyPoints**

Delete the duplicated `calculateFantasyPoints` function (lines 309-397) from `live-stats-poller/index.ts`.

Add an import at the top of the file:

```typescript
import { calculateFantasyPoints, type PlayerStats, type PointsBreakdown } from '../_shared/fantasy-points-calculator.ts';
import type { ScoringRules } from '../_shared/scoring-types.ts';
```

**Step 3: Update call sites**

Find where `calculateFantasyPoints` is called (around line 778). The existing call passes `(stats, rules, isManOfMatch)` but the shared version expects a `PlayerStats` object with `isManOfMatch` as a field. Update the call site to construct a proper `PlayerStats` object:

```typescript
const playerStats: PlayerStats = {
  runs: s.runs ?? 0,
  ballsFaced: s.balls_faced ?? 0,
  fours: s.fours ?? 0,
  sixes: s.sixes ?? 0,
  isOut: s.is_out ?? false,
  overs: s.overs ?? 0,
  maidens: s.maidens ?? 0,
  runsConceded: s.runs_conceded ?? 0,
  wickets: s.wickets ?? 0,
  dots: s.dots ?? 0,
  wides: s.wides ?? 0,
  noBalls: s.no_balls ?? 0,
  lbwBowledCount: s.lbw_bowled_count ?? 0,
  catches: s.catches ?? 0,
  stumpings: s.stumpings ?? 0,
  runOuts: s.run_outs ?? 0,
  isInPlaying11: s.is_in_playing_11 ?? false,
  isImpactPlayer: s.is_impact_player ?? false,
  isManOfMatch: s.is_man_of_match ?? false,
  teamWon: s.team_won ?? false,
  playerRole: s.primary_role ?? undefined,
};
const breakdown = calculateFantasyPoints(playerStats, normalizedRules);
```

**Note:** Check if the edge function has access to `primary_role` on the stats object. If not, you'll need to join `master_players` in the query that fetches player stats. Look at the query around lines 725-753 where `globalStatsRecords` are built.

**Step 4: Also remove any duplicated type definitions**

Remove any inline `ScoringRules`, `PointsBreakdown`, or similar type definitions that are now imported from `_shared`.

Remove `normalizeScoringRules` if it was only adapting between the two different type shapes. If it's still needed for converting DB JSONB to the typed structure, keep it but import `ScoringRules` from `_shared`.

**Step 5: Test edge function locally**

Run: `npm run supabase:functions`
Expected: Edge function serves without import errors.

**Step 6: Commit**

```bash
git add supabase/functions/live-stats-poller/index.ts
git commit -m "refactor(scoring): remove duplicated calculator from live-stats-poller, import from _shared"
```

---

## Task 6: Wire auto-recompute on scoring rule save

**Files:**
- Modify: `src/pages/LeagueRules.tsx:88-133` (handleSave function)

**Step 1: Read LeagueRules.tsx to understand the save flow**

The `handleSave` function at line 88 calls `updateScoringRules(sanitizedRules)` and shows a toast. We need to add a recompute call after the successful save.

**Step 2: Add recompute call after successful save**

Add import at the top of `src/pages/LeagueRules.tsx`:

```typescript
import { recomputeLeaguePoints } from '@/lib/scoring-recompute';
```

Modify the `handleSave` function. After `setSaving(false)` (line 121) and inside the success block (line 123-129), add the recompute:

```typescript
    if (scoringResult.success && configResult.success) {
      if (scoringResult.error) {
        toast.warning(scoringResult.error);
      } else {
        toast.success('League rules updated successfully');
        // Recompute all scores with the new rules
        try {
          toast.info('Recalculating scores with new rules...');
          const rowsUpdated = await recomputeLeaguePoints(leagueId, sanitizedRules);
          toast.success(`Scores recalculated (${rowsUpdated} records updated)`);
        } catch (recomputeError) {
          console.error('Recompute failed:', recomputeError);
          toast.error('Rules saved but score recalculation failed. Try refreshing.');
        }
      }
      setHasChanges(false);
    } else {
      toast.error('Failed to update league rules');
    }
```

**Note:** You need access to `leagueId` in this component. Check how the component gets its league context — likely from a route param or a store. Look at the existing code for how `updateScoringRules` gets the league ID.

**Step 3: Run type check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/pages/LeagueRules.tsx
git commit -m "feat(scoring): auto-recompute league points when scoring rules change"
```

---

## Task 7: Verify economy/strike rate interval form behavior

**Files:**
- Verify: `src/components/ScoringRulesForm.tsx` (interval add/remove/edit)

**Step 1: Read ScoringRulesForm.tsx**

Read the full file. Verify that:
1. Economy rate bonus rows can be added/removed
2. Strike rate bonus rows can be added/removed
3. Each row has min, max, points, and qualifier fields (minOvers, minBalls, minRuns)
4. Values are properly saved and loaded

**Step 2: Verify with browser if possible**

If the dev server is running, navigate to a league's rules page and verify:
- Adding a new economy rate tier works
- Removing a tier works
- Saving and reloading preserves the custom tiers
- The recompute fires after save (from Task 6)

**Step 3: Fix any issues found**

If the form is missing qualifier fields (minOvers, minBalls, minRuns), add them. If add/remove buttons are missing, add them. Document what was found and fixed.

**Step 4: Commit (only if changes were needed)**

```bash
git add src/components/ScoringRulesForm.tsx
git commit -m "fix(scoring): ensure interval form supports full tier customization"
```

---

## Task 8: Create admin_finalize_match RPC

**Files:**
- Modify: `supabase/migrations/20260228000000_scoring_finalization_rpcs.sql`

**Step 1: Add the admin_finalize_match RPC to the migration file**

Append to the existing migration file:

```sql
-- ============================================
-- 2. admin_finalize_match — Finalize a match with admin-confirmed MoM and winner
-- Called by super-admin from PlatformAdmin UI.
-- Only updates flags; points recalculation happens on the frontend via recomputeLeaguePoints().
-- ============================================

CREATE OR REPLACE FUNCTION admin_finalize_match(
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL,
  p_winner_team_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_mom_name TEXT;
  v_team1_id INTEGER;
  v_team2_id INTEGER;
BEGIN
  -- Look up MoM player name if provided
  IF p_man_of_match_cricbuzz_id IS NOT NULL THEN
    SELECT
      COALESCE(mp.name, mps.cricbuzz_player_id)
    INTO v_mom_name
    FROM match_player_stats mps
    LEFT JOIN master_players mp ON mp.cricbuzz_id = mps.cricbuzz_player_id
    WHERE mps.match_id = p_match_id
      AND mps.cricbuzz_player_id = p_man_of_match_cricbuzz_id
    LIMIT 1;
  END IF;

  -- Get team IDs for team_won determination
  SELECT team1_id, team2_id
  INTO v_team1_id, v_team2_id
  FROM cricket_matches
  WHERE id = p_match_id;

  -- 1. Update cricket_matches
  UPDATE cricket_matches
  SET
    state = 'Complete',
    man_of_match_id = COALESCE(p_man_of_match_cricbuzz_id, man_of_match_id),
    man_of_match_name = COALESCE(v_mom_name, man_of_match_name),
    winner_team_id = COALESCE(p_winner_team_id, winner_team_id)
  WHERE id = p_match_id;

  -- 2. Update match_player_stats: MoM flag, team_won, finalize
  UPDATE match_player_stats
  SET
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        THEN cricbuzz_player_id = p_man_of_match_cricbuzz_id
      ELSE is_man_of_match
    END,
    team_won = CASE
      WHEN p_winner_team_id IS NOT NULL THEN
        -- Determine team_won by checking which team the player belongs to
        -- Players from team1 get team_won=true if winner is team1, etc.
        -- We need to figure out which team each player is on
        -- The match_player_stats doesn't store team_id directly, but we can
        -- infer from the batting/bowling innings in the scorecard.
        -- For safety, only update if winner_team_id matches.
        CASE
          WHEN EXISTS (
            SELECT 1 FROM cricket_matches cm
            WHERE cm.id = p_match_id
              AND cm.team1_id = p_winner_team_id
          ) THEN
            -- Team1 won: players already marked with team_won from poller
            -- Just re-confirm based on current state
            team_won
          ELSE team_won
        END
      ELSE team_won
    END,
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id;

  -- 3. Finalize league_player_match_scores for ALL leagues with this match
  UPDATE league_player_match_scores
  SET
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id
    AND finalized_at IS NULL;

  -- 4. Mark league_matches as stats_imported for ALL leagues
  UPDATE league_matches
  SET
    stats_imported = true,
    stats_imported_at = COALESCE(stats_imported_at, NOW())
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_finalize_match(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_finalize_match(UUID, TEXT, INTEGER) TO service_role;
```

**Note on team_won:** The `team_won` flag is tricky to update from SQL alone because `match_player_stats` doesn't directly store the player's team ID. The poller sets this by parsing the scorecard. For the admin override case, the safest approach is: if the admin changes the winner, call `recomputeLeaguePoints()` from the frontend after the RPC — which will re-read the `team_won` flags. If the admin needs to flip `team_won` flags, that would need a more complex query joining on team names from the scorecard data. For v1, document that changing the winner requires the poller to have already set team associations correctly; the admin override mainly handles MoM and explicit finalization.

**Step 2: Apply migration**

Run: `npm run supabase:reset`
Expected: No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228000000_scoring_finalization_rpcs.sql
git commit -m "feat(db): add admin_finalize_match RPC"
```

---

## Task 9: Create check_week_finalization_ready RPC

**Files:**
- Modify: `supabase/migrations/20260228000000_scoring_finalization_rpcs.sql`

**Step 1: Append the RPC to the migration file**

```sql
-- ============================================
-- 3. check_week_finalization_ready — Check if all matches in a week are finalized
-- ============================================

CREATE OR REPLACE FUNCTION check_week_finalization_ready(
  p_league_id UUID,
  p_week INTEGER
)
RETURNS TABLE (
  total_matches INTEGER,
  finalized_matches INTEGER,
  is_ready BOOLEAN,
  unfinalized_match_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_matches,
    COUNT(*) FILTER (WHERE lm.stats_imported = true)::INTEGER as finalized_matches,
    (COUNT(*) > 0 AND COUNT(*) = COUNT(*) FILTER (WHERE lm.stats_imported = true)) as is_ready,
    ARRAY_AGG(lm.match_id) FILTER (WHERE lm.stats_imported IS NOT TRUE) as unfinalized_match_ids
  FROM league_matches lm
  WHERE lm.league_id = p_league_id
    AND lm.week = p_week;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_week_finalization_ready(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_week_finalization_ready(UUID, INTEGER) TO service_role;
```

**Step 2: Apply migration**

Run: `npm run supabase:reset`
Expected: No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228000000_scoring_finalization_rpcs.sql
git commit -m "feat(db): add check_week_finalization_ready RPC"
```

---

## Task 10: Create finalize_week RPC

**Files:**
- Modify: `supabase/migrations/20260228000000_scoring_finalization_rpcs.sql`

**Important context:** Captain/VC is stored as `is_captain BOOLEAN` and `is_vice_captain BOOLEAN` on `manager_roster` table (NOT slot_type). The `slot_type` column is 'active' or 'bench'. Week is stored as `manager_roster.week`.

**Step 1: Append the RPC to the migration file**

```sql
-- ============================================
-- 4. finalize_week — Calculate matchup scores, determine W/L, update standings
-- Captain (2x) and Vice-Captain (1.5x) multipliers applied here.
-- manager_roster uses: is_captain BOOLEAN, is_vice_captain BOOLEAN, week INTEGER
-- slot_type is 'active' or 'bench' (NOT captain/vc)
-- ============================================

CREATE OR REPLACE FUNCTION finalize_week(
  p_league_id UUID,
  p_week INTEGER
)
RETURNS void AS $$
DECLARE
  v_matchup RECORD;
  v_score1 DECIMAL;
  v_score2 DECIMAL;
  v_winner UUID;
  v_loser UUID;
  v_total_matches INTEGER;
  v_finalized_matches INTEGER;
BEGIN
  -- 1. Verify all matches are finalized
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE lm.stats_imported = true)::INTEGER
  INTO v_total_matches, v_finalized_matches
  FROM league_matches lm
  WHERE lm.league_id = p_league_id
    AND lm.week = p_week;

  IF v_total_matches = 0 THEN
    RAISE EXCEPTION 'No matches found for league % week %', p_league_id, p_week;
  END IF;

  IF v_total_matches <> v_finalized_matches THEN
    RAISE EXCEPTION 'Not all matches finalized for league % week %. % of % done.',
      p_league_id, p_week, v_finalized_matches, v_total_matches;
  END IF;

  -- 2. Calculate scores and finalize each matchup
  FOR v_matchup IN
    SELECT id, manager1_id, manager2_id
    FROM league_matchups
    WHERE league_id = p_league_id
      AND week = p_week
      AND is_finalized = false
  LOOP
    -- Skip byes
    IF v_matchup.manager2_id IS NULL THEN
      UPDATE league_matchups
      SET is_finalized = true
      WHERE id = v_matchup.id;
      CONTINUE;
    END IF;

    -- Calculate manager1 score with C/VC multipliers
    SELECT COALESCE(SUM(
      lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END
    ), 0)
    INTO v_score1
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
      AND mr.week = p_week
    WHERE lpms.league_id = p_league_id
      AND lpms.week = p_week
      AND lpms.manager_id = v_matchup.manager1_id
      AND lpms.was_in_active_roster = true;

    -- Calculate manager2 score with C/VC multipliers
    SELECT COALESCE(SUM(
      lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END
    ), 0)
    INTO v_score2
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
      AND mr.week = p_week
    WHERE lpms.league_id = p_league_id
      AND lpms.week = p_week
      AND lpms.manager_id = v_matchup.manager2_id
      AND lpms.was_in_active_roster = true;

    -- Determine winner
    IF v_score1 > v_score2 THEN
      v_winner := v_matchup.manager1_id;
      v_loser := v_matchup.manager2_id;
    ELSIF v_score2 > v_score1 THEN
      v_winner := v_matchup.manager2_id;
      v_loser := v_matchup.manager1_id;
    ELSE
      v_winner := NULL;
      v_loser := NULL;
    END IF;

    -- Update matchup
    UPDATE league_matchups
    SET
      manager1_score = v_score1,
      manager2_score = v_score2,
      winner_id = v_winner,
      is_finalized = true
    WHERE id = v_matchup.id;

    -- Update W/L records (skip ties)
    IF v_winner IS NOT NULL THEN
      UPDATE managers SET wins = wins + 1 WHERE id = v_winner;
      UPDATE managers SET losses = losses + 1 WHERE id = v_loser;
    END IF;
  END LOOP;

  -- 3. Update total points for all managers in the league
  -- Sum all active roster points across all weeks with C/VC multipliers
  UPDATE managers m
  SET points = sub.total_pts
  FROM (
    SELECT
      lpms.manager_id,
      COALESCE(SUM(
        lpms.total_points * CASE
          WHEN mr.is_captain THEN 2.0
          WHEN mr.is_vice_captain THEN 1.5
          ELSE 1.0
        END
      ), 0) as total_pts
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
      AND mr.week = lpms.week
    WHERE lpms.league_id = p_league_id
      AND lpms.was_in_active_roster = true
    GROUP BY lpms.manager_id
  ) sub
  WHERE m.id = sub.manager_id
    AND m.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finalize_week(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_week(UUID, INTEGER) TO service_role;
```

**Step 2: Apply migration**

Run: `npm run supabase:reset`
Expected: No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228000000_scoring_finalization_rpcs.sql
git commit -m "feat(db): add finalize_week RPC with C/VC multipliers and W/L tracking"
```

---

## Task 11: Update get_live_fantasy_standings RPC for H2H ranking

**Files:**
- Modify: `supabase/migrations/20260228000000_scoring_finalization_rpcs.sql`

**Step 1: Append updated standings RPC to migration file**

```sql
-- ============================================
-- 5. Update get_live_fantasy_standings to include W/L and sort by wins first
-- ============================================

CREATE OR REPLACE FUNCTION get_live_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  live_points DECIMAL,
  finalized_points DECIMAL,
  has_live_stats BOOLEAN,
  wins INTEGER,
  losses INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(lpms.total_points), 0) as total_points,
    COALESCE(SUM(CASE WHEN lpms.is_live THEN lpms.total_points ELSE 0 END), 0) as live_points,
    COALESCE(SUM(CASE WHEN NOT lpms.is_live OR lpms.is_live IS NULL THEN lpms.total_points ELSE 0 END), 0) as finalized_points,
    EXISTS(
      SELECT 1 FROM league_player_match_scores lpms2
      WHERE lpms2.manager_id = m.id
        AND lpms2.league_id = p_league_id
        AND lpms2.is_live = true
    ) as has_live_stats,
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC, COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name, m.wins, m.losses
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Also update the non-live version
CREATE OR REPLACE FUNCTION get_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  wins INTEGER,
  losses INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(lpms.total_points), 0) as total_points,
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC, COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name, m.wins, m.losses
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Step 2: Apply migration**

Run: `npm run supabase:reset`
Expected: No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228000000_scoring_finalization_rpcs.sql
git commit -m "feat(db): update standings RPCs to sort by wins then fantasy points"
```

---

## Task 12: Update frontend standings hook and component

**Files:**
- Modify: `src/hooks/useLiveFantasyPoints.ts:10-19` (LiveFantasyStanding interface)
- Modify: `src/components/StandingsTable.tsx:37-49` (sort logic)

**Step 1: Update LiveFantasyStanding type**

In `src/hooks/useLiveFantasyPoints.ts`, add `wins` and `losses` to the `LiveFantasyStanding` interface (around lines 10-19):

```typescript
export interface LiveFantasyStanding {
  manager_id: string;
  manager_name: string;
  team_name: string;
  total_points: number;
  live_points: number;
  finalized_points: number;
  has_live_stats: boolean;
  wins: number;
  losses: number;
  rank: number;
}
```

**Step 2: Update StandingsTable sort logic**

In `src/components/StandingsTable.tsx`, the sort logic at lines 37-49 currently sorts by fantasy points then wins then legacy points. Update to sort by wins first:

The component likely receives standings already sorted from the RPC, but if client-side sorting exists, update it to:

```typescript
const sortedManagers = [...managers].sort((a, b) => {
  // Primary: wins (from standings data or manager record)
  const winsA = standingsMap.get(a.id)?.wins ?? a.wins ?? 0;
  const winsB = standingsMap.get(b.id)?.wins ?? b.wins ?? 0;
  if (winsB !== winsA) return winsB - winsA;
  // Secondary: total fantasy points
  const ptsA = standingsMap.get(a.id)?.total_points ?? 0;
  const ptsB = standingsMap.get(b.id)?.total_points ?? 0;
  return ptsB - ptsA;
});
```

Also update the W/L display columns (lines 136-137) to use standings data when available instead of the legacy `manager.wins`/`manager.losses`:

```typescript
// Use standings wins/losses (updated by finalize_week) over legacy manager fields
const standing = standingsMap.get(manager.id);
const displayWins = standing?.wins ?? manager.wins ?? 0;
const displayLosses = standing?.losses ?? manager.losses ?? 0;
```

**Step 3: Run type check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/hooks/useLiveFantasyPoints.ts src/components/StandingsTable.tsx
git commit -m "feat(standings): display H2H W/L record with wins-first ranking"
```

---

## Task 13: Build MatchFinalization admin component

**Files:**
- Create: `src/components/platform-admin/MatchFinalization.tsx`
- Modify: `src/pages/PlatformAdmin.tsx:37-40` (add component)

**Step 1: Create the MatchFinalization component**

Create `src/components/platform-admin/MatchFinalization.tsx`.

This component needs to:

1. **Fetch all cricket_matches** ordered by week, then date
2. **For each match**, show: description, date, teams, state, auto-detected MoM, result
3. **For Complete matches**, show:
   - MoM dropdown (all players from `match_player_stats` for that match), pre-selected with current `man_of_match_id`
   - Winner dropdown (team1 name, team2 name, "No winner"), pre-selected from `winner_team_id`
   - "Finalize Match" button
4. **On finalize click**:
   - Call `supabase.rpc('admin_finalize_match', { p_match_id, p_man_of_match_cricbuzz_id, p_winner_team_id })`
   - Fetch all leagues with this match via `league_matches`
   - For each league, fetch `scoring_rules` and call `recomputeLeaguePoints(leagueId, rules)`
   - Show progress toasts

**UI structure (use shadcn components):**
- `Card` with `CardHeader` "Match Finalization"
- Group matches by week using `Accordion` or collapsible sections
- Each match row: use `Table` with columns: Match, Date, State, MoM, Winner, Action
- MoM column: `Select` dropdown
- Winner column: `Select` dropdown
- Action column: `Button` (Finalize / Finalized checkmark)
- Status badges: green check (finalized), yellow clock (complete not finalized), gray (upcoming/live)

**Data queries:**
```typescript
// Fetch all matches with week info
const { data: matches } = await supabase
  .from('cricket_matches')
  .select('*, league_matches!inner(league_id, week, stats_imported)')
  .order('match_date', { ascending: true });

// Fetch players for MoM dropdown (per match)
const { data: players } = await supabase
  .from('match_player_stats')
  .select('cricbuzz_player_id, player_id, is_man_of_match')
  .eq('match_id', matchId);

// Join player names
const { data: playerNames } = await supabase
  .from('master_players')
  .select('id, name, cricbuzz_id')
  .in('id', playerIds);
```

**Step 2: Add to PlatformAdmin.tsx**

In `src/pages/PlatformAdmin.tsx`, add import and component:

```typescript
import { MatchFinalization } from '@/components/platform-admin/MatchFinalization';
```

Add inside the `space-y-6` div (after line 39):

```typescript
<MatchFinalization />
```

**Step 3: Run type check and verify in browser**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors.

If dev server is running, navigate to `/platform-admin` and verify the component renders.

**Step 4: Commit**

```bash
git add src/components/platform-admin/MatchFinalization.tsx src/pages/PlatformAdmin.tsx
git commit -m "feat(admin): add match finalization panel to platform admin"
```

---

## Task 14: Build WeekFinalization admin component

**Files:**
- Create: `src/components/platform-admin/WeekFinalization.tsx`
- Modify: `src/pages/PlatformAdmin.tsx` (add component)

**Step 1: Create the WeekFinalization component**

Create `src/components/platform-admin/WeekFinalization.tsx`.

This component needs to:

1. **Fetch all leagues** the admin has access to
2. **League selector** dropdown at top
3. **For selected league**, fetch week status:
   - Get all distinct weeks from `league_matches` for this league
   - For each week, call `check_week_finalization_ready` RPC
   - Also check if `league_matchups` for that week are already finalized
4. **Display weeks table** with columns: Week, Matches (finalized/total), Status, Action
5. **Status badges:**
   - "In Progress" (gray) — not all matches finalized
   - "Ready to Finalize" (green pulsing) — all matches finalized, matchups not yet finalized
   - "Finalized" (green checkmark) — matchups already finalized
6. **"Finalize Week" button** for "Ready" weeks:
   - Opens confirmation dialog showing matchup pairs with projected scores
   - On confirm: call `supabase.rpc('finalize_week', { p_league_id, p_week })`
   - Show success toast with updated W/L

**Projected scores for confirmation dialog:**
- Fetch `league_player_match_scores` for the week + `manager_roster` for captain/VC
- Calculate each manager's total (with multipliers) client-side for preview
- Display as: "Team A (Manager 1): 245.5 pts vs Team B (Manager 2): 198.0 pts"

**Data queries:**
```typescript
// Get distinct weeks for a league
const { data: weeks } = await supabase
  .from('league_matches')
  .select('week')
  .eq('league_id', leagueId)
  .order('week');
const distinctWeeks = [...new Set(weeks?.map(w => w.week))];

// Check readiness per week
const { data: readiness } = await supabase
  .rpc('check_week_finalization_ready', { p_league_id: leagueId, p_week: weekNum });

// Check if already finalized
const { data: matchups } = await supabase
  .from('league_matchups')
  .select('is_finalized')
  .eq('league_id', leagueId)
  .eq('week', weekNum);
const allFinalized = matchups?.every(m => m.is_finalized);

// Finalize
await supabase.rpc('finalize_week', { p_league_id: leagueId, p_week: weekNum });
```

**Step 2: Add to PlatformAdmin.tsx**

```typescript
import { WeekFinalization } from '@/components/platform-admin/WeekFinalization';
```

Add after MatchFinalization in the `space-y-6` div.

**Step 3: Run type check and verify in browser**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/platform-admin/WeekFinalization.tsx src/pages/PlatformAdmin.tsx
git commit -m "feat(admin): add week finalization panel to platform admin"
```

---

## Task 15: Regenerate Supabase types and final verification

**Files:**
- Modify: `src/integrations/supabase/types.ts` (auto-generated)

**Step 1: Regenerate types**

Run: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`

**Step 2: Clean generated file**

Remove any stray debug lines from the top of the generated file (e.g., "Connecting to db ...").

**Step 3: Run full type check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors. Fix any type mismatches.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass, including the new bowler duck exemption tests.

**Step 5: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: regenerate Supabase types after migration changes"
```

---

## Task 16: End-to-end verification

**Step 1: Start the local environment**

Run: `npm run dev:full`

**Step 2: Verify scoring fixes**

- Navigate to a league's rules page
- Modify a scoring rule (e.g., change runs from 1 to 2)
- Save — verify toast shows "Recalculating scores..." then success
- Check standings reflect new scores

**Step 3: Verify match finalization**

- Navigate to `/platform-admin`
- Find a completed match in the Match Finalization panel
- Verify MoM dropdown shows players, winner dropdown shows teams
- Click "Finalize Match" — verify success toast
- Verify league scores update after recompute

**Step 4: Verify week finalization**

- In the Week Finalization panel, select a league
- Find a week where all matches are finalized
- Verify "Ready to Finalize" status
- Click "Finalize Week" — verify confirmation dialog shows matchup scores
- Confirm — verify W/L records update
- Check Standings table shows correct W/L and ranking

**Step 5: Verify standings**

- Navigate to a league's standings page
- Verify W/L columns show real data (not 0/0)
- Verify ranking is by wins first, then total points

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes for scoring and standings pipeline"
```

---

## Execution Order & Dependencies

```
Task 1 (duck penalty tests + impl)
  → Task 2 (wire playerRole through recompute + types)
    → Task 3 (update recompute RPC for primary_role)
      → Task 4 (create _shared scoring module)
        → Task 5 (remove duplicate from live-stats-poller)

Task 6 (auto-recompute on rule save) — independent, can run after Task 2

Task 7 (verify interval form) — independent, can run anytime

Task 8 (admin_finalize_match RPC) — depends on Task 3 (same migration file)
Task 9 (check_week_finalization_ready RPC) — depends on Task 8
Task 10 (finalize_week RPC) — depends on Task 9
Task 11 (update standings RPCs) — depends on Task 10

Task 12 (frontend standings update) — depends on Task 11
Task 13 (MatchFinalization UI) — depends on Task 8
Task 14 (WeekFinalization UI) — depends on Task 9 + Task 10

Task 15 (regenerate types) — depends on all DB tasks (3, 8, 9, 10, 11)
Task 16 (e2e verification) — depends on everything
```

**Parallelizable groups:**
- Group A: Tasks 1-5 (scoring fixes + dedup) — sequential
- Group B: Tasks 6-7 (recompute wiring + form verification) — independent of Group A after Task 2
- Group C: Tasks 8-11 (DB RPCs) — sequential, can start after Task 3
- Group D: Tasks 12-14 (frontend UI) — depends on Group C
- Group E: Tasks 15-16 (final verification) — after everything
