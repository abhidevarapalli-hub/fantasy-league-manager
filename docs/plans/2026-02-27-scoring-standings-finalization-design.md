# Scoring Fixes, Match Finalization & Standings Pipeline

**Date:** 2026-02-27
**Status:** Approved
**Approach:** Database-Driven Pipeline (RPCs + Triggers)

## Overview

This design covers four interconnected workstreams:

1. **Scoring bug fixes** - Role-based duck penalty, verify economy/SR intervals, auto-recompute on rule change
2. **Dedup scoring logic** - Consolidate duplicated `calculateFantasyPoints` between frontend and edge function
3. **MoM & match result finalization** - Auto-detect from API + super-admin override UI
4. **Week finalization & standings pipeline** - Finalize weeks, determine matchup W/L, update standings with H2H ranking

## 1. Scoring Fixes

### 1A. Role-Based Duck Penalty

**Problem:** Bowlers (tailenders) who get out for 0 receive the full -10 duck penalty. This unfairly punishes players not expected to bat.

**Solution:**
- Add `playerRole: string` to the `PlayerStats` interface in `src/lib/fantasy-points-calculator.ts`
- In `calculateBattingPoints`, only apply `duckDismissal` and `lowScorePenalty` when `playerRole !== 'Bowler'`
- All Rounders and Wicket Keepers still receive the penalty
- The edge function joins `master_players.primary_role` when building stats
- The frontend calculator receives role from the player data it already fetches

**Files to modify:**
- `src/lib/fantasy-points-calculator.ts` - Add `playerRole` to `PlayerStats`, gate duck/low-score penalty
- `src/lib/fantasy-points-calculator.test.ts` - Add tests for bowler exemption
- `supabase/functions/_shared/fantasy-points-calculator.ts` (after dedup, see section 2)
- `supabase/functions/live-stats-poller/index.ts` - Pass player role into stats builder

**Edge case:** If `playerRole` is undefined/null, apply the penalty (safe default).

### 1B. Economy Rate and Strike Rate Defaults

**Decision:** Keep current two-tier defaults. The `ScoringRulesForm` already supports adding/removing interval rows. League managers can customize as they see fit.

**Verification needed:**
- Confirm the form correctly renders, saves, and loads custom intervals
- Confirm the recompute pipeline picks up custom intervals correctly
- No code changes unless bugs are found during verification

### 1C. Auto-Recompute on Scoring Rule Change

**Problem:** `LeagueRules.tsx` saves rules but does NOT trigger recomputation of existing scores.

**Solution:**
- After successful rule save in `LeagueRules.tsx`, call `recomputeLeaguePoints()` from `src/lib/scoring-recompute.ts`
- Show a loading state ("Recalculating scores...") during recompute
- Show success/error toast on completion
- The utility already exists and works; it just needs to be wired in

**Files to modify:**
- `src/pages/LeagueRules.tsx` - Call `recomputeLeaguePoints()` after save

## 2. Deduplicate calculateFantasyPoints

**Problem:** Scoring logic is duplicated between:
- `src/lib/fantasy-points-calculator.ts` (frontend, canonical)
- `supabase/functions/live-stats-poller/index.ts` (edge function, inline copy)

These can drift, causing score discrepancies between live polling and frontend display.

**Solution:**

### Shared module
- Create `supabase/functions/_shared/fantasy-points-calculator.ts`
- Create `supabase/functions/_shared/scoring-types.ts`
- These are copies of the canonical `src/lib/` versions

### Sync script
- Add `npm run sync:scoring` script to `package.json`
- Script copies `src/lib/fantasy-points-calculator.ts` and `src/lib/scoring-types.ts` to `supabase/functions/_shared/`
- Strips any Node/Vite-specific imports (if any)
- Add as pre-step to `supabase:functions` command

### Edge function update
- Remove inline `calculateFantasyPoints` from `live-stats-poller/index.ts`
- Replace with: `import { calculateFantasyPoints } from '../_shared/fantasy-points-calculator.ts'`
- Remove inline `ScoringRules` type, import from `'../_shared/scoring-types.ts'`
- Remove the `normalizeScoringRules` function if it's only adapting between the two copies

**Files to create:**
- `supabase/functions/_shared/fantasy-points-calculator.ts`
- `supabase/functions/_shared/scoring-types.ts`
- Sync script entry in `package.json`

**Files to modify:**
- `supabase/functions/live-stats-poller/index.ts` - Remove duplicated logic, import from shared

## 3. MoM & Match Result Finalization

### 3A. Auto-Detection (Already Working)

The poller already:
- Parses `playersOfTheMatch` from Cricbuzz scorecard
- Sets `cricket_matches.man_of_match_id` and `man_of_match_name`
- Sets `match_player_stats.is_man_of_match` flag
- Parses result string and sets `match_player_stats.team_won` flag

No changes needed to the auto-detection path.

### 3B. New RPC: `admin_finalize_match`

```sql
admin_finalize_match(
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT,
  p_winner_team_id INTEGER
) RETURNS void
```

**Steps (single transaction):**
1. Update `cricket_matches`: set `state = 'Complete'`, `man_of_match_id = p_man_of_match_cricbuzz_id`, look up `man_of_match_name` from `match_player_stats`, set `winner_team_id = p_winner_team_id`
2. Update `match_player_stats` for this match:
   - Set `is_man_of_match = (cricbuzz_player_id = p_man_of_match_cricbuzz_id)` for all rows
   - Set `team_won` based on whether player's team matches `p_winner_team_id`
   - Set `is_live = false`, `finalized_at = NOW()` on all rows where `finalized_at IS NULL`
3. For each league (via `league_matches`):
   - Set `is_live = false`, `finalized_at = NOW()` on `league_player_match_scores`
   - Mark `league_matches.stats_imported = true`, `stats_imported_at = NOW()`

**Important:** This RPC only updates flags. Points recalculation happens on the frontend (see 3C).

### 3C. Frontend Recompute After Finalization

After calling `admin_finalize_match`, the frontend:
1. Fetches all leagues that have this match (via `league_matches`)
2. Calls `recomputeLeaguePoints(leagueId, rules)` for each affected league
3. This recalculates all `league_player_match_scores` including the now-correct MoM and teamWon flags
4. Shows progress and success/error feedback

### 3D. Match Finalization UI

Add a **Match Finalization** panel to `PlatformAdmin.tsx`:

**Layout:**
- Grouped by week number
- Each match row shows: match description, date, teams, state, auto-detected MoM, result
- For `Complete` state matches:
  - MoM dropdown: lists all players from `match_player_stats` for that match, pre-selected with Cricbuzz's pick
  - Winner dropdown: lists both teams, pre-selected from `cricket_matches.winner_team_id`
  - "Finalize Match" button (disabled if already finalized, shown as "Finalized" with checkmark)
- For `Live`/`Upcoming` matches: read-only display, no finalization controls
- Status indicators: green checkmark (finalized), yellow clock (complete but not finalized), gray (upcoming/live)

**Files to create:**
- `src/components/admin/MatchFinalization.tsx`

**Files to modify:**
- `src/pages/PlatformAdmin.tsx` - Add MatchFinalization component

## 4. Week Finalization & Standings Pipeline

### 4A. New RPC: `check_week_finalization_ready`

```sql
check_week_finalization_ready(p_league_id UUID, p_week INTEGER)
RETURNS TABLE(
  total_matches INTEGER,
  finalized_matches INTEGER,
  is_ready BOOLEAN,
  unfinalized_match_ids UUID[]
)
```

**Logic:**
- Count all `league_matches` for league+week
- Count how many have `stats_imported = true`
- `is_ready = (total_matches = finalized_matches AND total_matches > 0)`
- Return IDs of unfinalized matches for the UI to show

### 4B. New RPC: `finalize_week`

```sql
finalize_week(p_league_id UUID, p_week INTEGER)
RETURNS void
```

**Steps (single transaction):**

1. **Verify readiness:** Check all matches for this league+week have `stats_imported = true`. Raise exception if not.

2. **Calculate matchup scores:** For each `league_matchups` row where `league_id = p_league_id AND week = p_week AND is_finalized = false`:

   ```sql
   -- For each manager, sum their active roster player points with C/VC multipliers
   SELECT COALESCE(SUM(
     lpms.total_points * CASE
       WHEN mr.slot_type = 'captain' THEN 2.0
       WHEN mr.slot_type = 'vice_captain' THEN 1.5
       ELSE 1.0
     END
   ), 0) AS score
   FROM league_player_match_scores lpms
   JOIN manager_roster mr ON mr.player_id = lpms.player_id
     AND mr.manager_id = lpms.manager_id
     AND mr.league_id = lpms.league_id
     AND mr.week = lpms.week
   WHERE lpms.league_id = p_league_id
     AND lpms.week = p_week
     AND lpms.manager_id = <manager_id>
     AND lpms.was_in_active_roster = true
   ```

3. **Determine winner:**
   - `manager1_score > manager2_score` -> `winner_id = manager1_id`
   - `manager2_score > manager1_score` -> `winner_id = manager2_id`
   - Equal -> `winner_id = NULL` (tie)

4. **Update `league_matchups`:**
   ```sql
   UPDATE league_matchups SET
     manager1_score = <calculated>,
     manager2_score = <calculated>,
     winner_id = <determined>,
     is_finalized = true
   WHERE league_id = p_league_id AND week = p_week;
   ```

5. **Update `managers` W/L records:** For each finalized matchup:
   - Winner: `UPDATE managers SET wins = wins + 1 WHERE id = winner_id`
   - Loser: `UPDATE managers SET losses = losses + 1 WHERE id = loser_id`
   - Tie: no change to either
   - Skip byes (`manager2_id IS NULL`)

6. **Update `managers.points`:** For each manager in the league:
   ```sql
   UPDATE managers SET points = (
     SELECT COALESCE(SUM(
       lpms.total_points * CASE
         WHEN mr.slot_type = 'captain' THEN 2.0
         WHEN mr.slot_type = 'vice_captain' THEN 1.5
         ELSE 1.0
       END
     ), 0)
     FROM league_player_match_scores lpms
     JOIN manager_roster mr ON mr.player_id = lpms.player_id
       AND mr.manager_id = lpms.manager_id
       AND mr.league_id = lpms.league_id
       AND mr.week = lpms.week
     WHERE lpms.league_id = p_league_id
       AND lpms.manager_id = managers.id
       AND lpms.was_in_active_roster = true
   )
   WHERE league_id = p_league_id;
   ```

### 4C. Captain/VC Multiplier Handling

Captain (2x) and Vice-Captain (1.5x) multipliers are applied in two places:
- **Frontend UI:** `useMatchupData` hook applies multipliers when displaying player scores. This continues unchanged so users see their C/VC getting multiplied points.
- **Finalization SQL:** `finalize_week` RPC applies the same multipliers when calculating matchup scores by joining `manager_roster.slot_type`.

The `league_player_match_scores.total_points` column stores **raw unmultiplied** points. Multipliers are always applied at aggregation time.

### 4D. Week Finalization UI

Add a **Week Finalization** section to `PlatformAdmin.tsx`:

**Layout:**
- Dropdown to select league
- Table of weeks showing: week number, match count, finalized match count, status badge
- Status badges: "In Progress" (gray), "Ready to Finalize" (green pulse), "Finalized" (green checkmark)
- "Ready to Finalize" rows have a "Finalize Week" button
- Clicking opens a confirmation dialog showing:
  - All matchup pairs for that week
  - Projected scores for each manager (calculated client-side for preview)
  - "Confirm Finalize" button
- After finalization: show updated W/L records

**Files to create:**
- `src/components/admin/WeekFinalization.tsx`

**Files to modify:**
- `src/pages/PlatformAdmin.tsx` - Add WeekFinalization component

### 4E. Standings Table Update

**Current behavior:** Sorts by fantasy points from `get_live_fantasy_standings`. W/L shows 0/0.

**New behavior:**
- Primary sort: `wins` DESC
- Secondary sort: total fantasy points DESC (tiebreaker)
- W/L columns show real data from `managers.wins`/`managers.losses`

**Changes to `get_live_fantasy_standings` RPC:**
- Include `m.wins`, `m.losses` in the SELECT
- Change ORDER BY to: `m.wins DESC, total_points DESC`
- Return wins/losses in the result set

**Files to modify:**
- Migration for `get_live_fantasy_standings` RPC update
- `src/components/StandingsTable.tsx` - Use wins/losses from standings data for sorting
- `src/hooks/useLiveFantasyPoints.ts` - Include wins/losses in the return type

## 5. Edge Cases

| Case | Handling |
|------|----------|
| Bowler gets duck out | No penalty applied (role-based exemption) |
| Not out under 5 runs | No low-score penalty (isOut check already exists) |
| MoM missing from Cricbuzz API | Super-admin selects manually from player dropdown |
| Match result ambiguous (tie/no result/DLS) | Super-admin picks winner or leaves as no-winner. No matchWinningTeam bonus for either team. |
| Manager has no active roster for a week | Score = 0, they lose the matchup |
| Bye week (odd number of managers) | `manager2_id IS NULL`. Skip during finalization, no W/L change. |
| Week not fully finalized | `check_week_finalization_ready` blocks finalization |
| Re-finalize already-finalized match | RPC is idempotent. Frontend re-runs recompute. |
| Scoring rules changed after week finalized | Standings reflect rules at finalization time. Re-finalizing weeks is out of scope for v1. |
| Captain/VC roster differs by week | `manager_roster` is week-scoped. SQL joins on correct week. |
| Tie in matchup scores | `winner_id = NULL`, neither manager's W/L changes |

## 6. Database Changes Summary

### New RPC Functions (single migration)
| Function | Purpose |
|----------|---------|
| `admin_finalize_match(p_match_id, p_man_of_match_cricbuzz_id, p_winner_team_id)` | Finalize a match with admin-confirmed MoM and winner |
| `check_week_finalization_ready(p_league_id, p_week)` | Check if all matches in a week are finalized |
| `finalize_week(p_league_id, p_week)` | Calculate matchup scores, determine W/L, update standings |

### Modified RPC Functions
| Function | Change |
|----------|--------|
| `get_live_fantasy_standings` | Add wins/losses to return, sort by wins DESC then points DESC |

### Schema Changes
None required. All needed columns already exist:
- `league_matchups.manager1_score`, `manager2_score`, `winner_id`, `is_finalized`
- `managers.wins`, `losses`, `points`
- `match_player_stats.is_man_of_match`, `team_won`

## 7. Frontend Changes Summary

| Component/File | Change |
|----------------|--------|
| `src/lib/fantasy-points-calculator.ts` | Add `playerRole` to `PlayerStats`, gate duck/low-score penalty on role |
| `src/lib/fantasy-points-calculator.test.ts` | Add bowler duck exemption tests |
| `src/lib/scoring-types.ts` | No changes |
| `src/lib/scoring-recompute.ts` | No changes (already works) |
| `src/pages/LeagueRules.tsx` | Call `recomputeLeaguePoints()` after saving rules |
| `src/pages/PlatformAdmin.tsx` | Add MatchFinalization and WeekFinalization components |
| `src/components/admin/MatchFinalization.tsx` | New: match finalization panel |
| `src/components/admin/WeekFinalization.tsx` | New: week finalization panel |
| `src/components/StandingsTable.tsx` | Sort by W/L primary, points secondary |
| `src/hooks/useLiveFantasyPoints.ts` | Include wins/losses in standings return type |
| `supabase/functions/_shared/fantasy-points-calculator.ts` | New: shared scoring logic |
| `supabase/functions/_shared/scoring-types.ts` | New: shared types |
| `supabase/functions/live-stats-poller/index.ts` | Remove duplicated scoring, import from _shared |
| `package.json` | Add `sync:scoring` script |

## 8. Out of Scope

- Playoff bracket system
- Waiver wire logic
- Automatic week finalization without admin confirmation
- Re-finalizing past weeks when scoring rules change
- Impact player detection from API
- Consolidating other duplicated logic between edge functions and frontend
