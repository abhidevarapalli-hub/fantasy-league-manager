# Auto Winner & MoM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate winner and Man of the Match detection during match finalization, and allow re-finalization of 50 existing matches that are missing these values.

**Architecture:** Winner is auto-detected by parsing the `result` text field (e.g., "India won by 29 runs") and matching team names against `team1/team2` columns. MoM is fetched from the Cricbuzz `scard` API endpoint which returns `matchHeader.playersOfTheMatch`. Both are pre-populated in the admin UI with manual override capability. A "Re-finalize" flow lets admins fix already-finalized matches missing winner/MoM.

**Tech Stack:** PostgreSQL (SQL functions), TypeScript/React (admin UI), Cricbuzz API (MoM data), Supabase Edge Functions (live poller)

---

### Task 1: SQL Migration — auto_resolve_winner function

**Files:**
- Create: `supabase/migrations/20260304000000_auto_winner_mom.sql`

**Step 1: Write the migration**

Create a SQL function `auto_resolve_winner` that parses the `result` text and matches it to team IDs. Also update `admin_finalize_match` to auto-resolve winner when not explicitly provided.

```sql
-- auto_resolve_winner: extract winner from result text
CREATE OR REPLACE FUNCTION auto_resolve_winner(p_match_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_result TEXT;
  v_team1_name TEXT;
  v_team2_name TEXT;
  v_team1_short TEXT;
  v_team2_short TEXT;
  v_team1_id INTEGER;
  v_team2_id INTEGER;
  v_winner_name TEXT;
BEGIN
  SELECT result, team1_name, team2_name, team1_short, team2_short, team1_id, team2_id
  INTO v_result, v_team1_name, v_team2_name, v_team1_short, v_team2_short, v_team1_id, v_team2_id
  FROM cricket_matches
  WHERE id = p_match_id;

  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extract team name from "X won by..." pattern
  v_winner_name := (regexp_match(v_result, '^(.+?)\s+won\s+by', 'i'))[1];

  IF v_winner_name IS NULL THEN
    RETURN NULL; -- tie, abandoned, no result
  END IF;

  -- Match against team names (case-insensitive)
  IF lower(v_team1_name) = lower(v_winner_name)
     OR lower(v_team1_short) = lower(v_winner_name) THEN
    RETURN v_team1_id;
  ELSIF lower(v_team2_name) = lower(v_winner_name)
     OR lower(v_team2_short) = lower(v_winner_name) THEN
    RETURN v_team2_id;
  END IF;

  RETURN NULL; -- no match found
END;
$$ LANGUAGE plpgsql STABLE;
```

Also update `admin_finalize_match` to auto-resolve winner when `p_winner_team_id` is NULL:

```sql
CREATE OR REPLACE FUNCTION admin_finalize_match(
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL,
  p_winner_team_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_mom_name TEXT;
  v_actual_winner INTEGER;
BEGIN
  -- Auth check
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can finalize matches';
  END IF;

  -- Handle winner: sentinel (0 or negative) = no winner, NULL = auto-resolve
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    v_actual_winner := NULL;
  ELSIF p_winner_team_id IS NOT NULL THEN
    v_actual_winner := p_winner_team_id;
  ELSE
    -- Auto-resolve from result text
    v_actual_winner := auto_resolve_winner(p_match_id);
  END IF;

  -- Look up MoM player name if provided
  IF p_man_of_match_cricbuzz_id IS NOT NULL THEN
    SELECT COALESCE(mp.name, mps.cricbuzz_player_id)
    INTO v_mom_name
    FROM match_player_stats mps
    LEFT JOIN master_players mp ON mp.cricbuzz_id = mps.cricbuzz_player_id
    WHERE mps.match_id = p_match_id
      AND mps.cricbuzz_player_id = p_man_of_match_cricbuzz_id
    LIMIT 1;
  END IF;

  -- 1. Update cricket_matches
  UPDATE cricket_matches
  SET
    state = 'Complete',
    man_of_match_id = COALESCE(p_man_of_match_cricbuzz_id, man_of_match_id),
    man_of_match_name = COALESCE(v_mom_name, man_of_match_name),
    winner_team_id = COALESCE(v_actual_winner, winner_team_id)
  WHERE id = p_match_id;

  -- 2. Update match_player_stats: MoM flag and finalize
  UPDATE match_player_stats
  SET
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        THEN (cricbuzz_player_id = p_man_of_match_cricbuzz_id)
      ELSE is_man_of_match
    END,
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id;

  -- When no winner (sentinel), set team_won = false for all
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    UPDATE match_player_stats
    SET team_won = false
    WHERE match_id = p_match_id;
  END IF;

  -- 3. Finalize league_player_match_scores
  UPDATE league_player_match_scores
  SET
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id
    AND finalized_at IS NULL;

  -- 4. Mark league_matches as stats_imported
  UPDATE league_matches
  SET
    stats_imported = true,
    stats_imported_at = COALESCE(stats_imported_at, NOW())
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Apply locally and verify**

Run: `npm run supabase:reset`
Expected: Migration applies without errors.

Verify with:
```sql
SELECT auto_resolve_winner(id) FROM cricket_matches WHERE result LIKE '%won%' LIMIT 5;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260304000000_auto_winner_mom.sql
git commit -m "feat: add auto_resolve_winner SQL function and update admin_finalize_match"
```

---

### Task 2: Fix Live Poller — Set winner_team_id on match completion

**Files:**
- Modify: `supabase/functions/live-stats-poller/index.ts:489-549`

**Step 1: Update the match update payload to include winner_team_id**

In the section where `updatePayload` is constructed (around line 526-534), add winner resolution:

The current code at line 491-549 fetches `currentMatch` with `id, team1_short, team2_short`. We need to also fetch `team1_name, team2_name, team1_id, team2_id` and resolve the winner.

Change the select query at line 494 from:
```typescript
.select('id, team1_short, team2_short')
```
to:
```typescript
.select('id, team1_name, team2_name, team1_short, team2_short, team1_id, team2_id')
```

Then after line 530 (`...teamUpdate,`), add winner resolution:

```typescript
// Resolve winner_team_id from match status
if (isMatchComplete && winnerTeamName) {
  const t1 = currentMatch.team1_name?.toLowerCase() ?? '';
  const t2 = currentMatch.team2_name?.toLowerCase() ?? '';
  const t1s = currentMatch.team1_short?.toLowerCase() ?? '';
  const t2s = currentMatch.team2_short?.toLowerCase() ?? '';
  const winner = winnerTeamName.toLowerCase();

  if (t1 === winner || t1s === winner || t1.includes(winner) || winner.includes(t1s)) {
    updatePayload.winner_team_id = currentMatch.team1_id;
  } else if (t2 === winner || t2s === winner || t2.includes(winner) || winner.includes(t2s)) {
    updatePayload.winner_team_id = currentMatch.team2_id;
  }
}
```

Note: the `winnerTeamName` is already extracted at line 468-469 from the regex `^(\w+)\s+won`. However this only captures the first word (e.g., "India" but not "New Zealand" or "West Indies"). We need to fix the regex too.

Change line 468 from:
```typescript
const winnerMatch = scorecard.status.match(/^(\w+)\s+won/i);
```
to:
```typescript
const winnerMatch = scorecard.status.match(/^(.+?)\s+won\s+by/i);
```

This captures multi-word team names like "New Zealand", "West Indies", "South Africa".

**Step 2: Deploy and test**

Deploy the edge function:
```bash
npx supabase functions deploy live-stats-poller
```

Test with a completed match. The `winner_team_id` should now be set.

**Step 3: Commit**

```bash
git add supabase/functions/live-stats-poller/index.ts
git commit -m "fix: resolve winner_team_id in live poller when match completes"
```

---

### Task 3: Frontend — Add winner auto-detection helper

**Files:**
- Create: `src/lib/match-utils.ts`

**Step 1: Create the utility file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/match-utils.ts
git commit -m "feat: add resolveWinnerFromResult utility"
```

---

### Task 4: Frontend — Rewrite MatchFinalization with auto-detection + re-finalize

**Files:**
- Modify: `src/components/platform-admin/MatchFinalization.tsx`

This is the biggest change. The component needs to:

1. **Auto-populate winner** from `result` text using `resolveWinnerFromResult()`
2. **Auto-fetch MoM** from Cricbuzz `scard` API using `fetchScorecardDetails()`
3. **Show "Incomplete" badge** on finalized matches missing winner or MoM
4. **Allow re-finalize** for those incomplete matches
5. **Add batch "Finalize All"** button for matches with both auto-detected values

**Step 1: Add imports and helper types**

Add to the imports at the top:
```typescript
import { fetchScorecardDetails, type ScorecardResponse } from '@/integrations/cricbuzz/client';
import { resolveWinnerFromResult } from '@/lib/match-utils';
```

**Step 2: Update fetchMatches to auto-populate winner**

In `fetchMatches()`, after setting `momMap` and `winnerMap`, add auto-resolution:

```typescript
// Auto-resolve winners from result text for matches that don't have one
for (const m of matchesData || []) {
  if (!m.winner_team_id && m.result) {
    const autoWinner = resolveWinnerFromResult(
      m.result, m.team1_name, m.team2_name, m.team1_id, m.team2_id
    );
    if (autoWinner) winnerMap.set(m.id, autoWinner);
  }
}
```

**Step 3: Add MoM auto-fetch from Cricbuzz API**

Add a new function and state for tracking auto-fetched MoM:

```typescript
const [autoMoM, setAutoMoM] = useState<Map<string, { id: string; name: string }>>(new Map());
const [fetchingMoM, setFetchingMoM] = useState<Set<string>>(new Set());

const fetchMoMFromApi = useCallback(async (match: CricketMatch) => {
  if (!match.cricbuzz_match_id || fetchingMoM.has(match.id)) return;

  setFetchingMoM(prev => new Set(prev).add(match.id));

  try {
    const scorecard: ScorecardResponse = await fetchScorecardDetails(match.cricbuzz_match_id);
    const potm = scorecard.matchHeader?.playersOfTheMatch?.[0];

    if (potm) {
      setAutoMoM(prev => new Map(prev).set(match.id, {
        id: potm.id.toString(),
        name: potm.fullName || potm.name,
      }));

      // Also pre-select in the MoM dropdown
      setSelectedMoM(prev => {
        if (!prev.has(match.id)) {
          return new Map(prev).set(match.id, potm.id.toString());
        }
        return prev;
      });
    }
  } catch (error) {
    console.error(`Failed to fetch MoM for match ${match.cricbuzz_match_id}:`, error);
  } finally {
    setFetchingMoM(prev => {
      const next = new Set(prev);
      next.delete(match.id);
      return next;
    });
  }
}, [fetchingMoM]);
```

**Step 4: Add isIncomplete helper and re-finalize support**

```typescript
const isMatchIncomplete = (match: CricketMatch): boolean => {
  const lm = leagueMatches.find(l => l.match_id === match.id);
  return lm?.stats_imported === true
    && (!match.winner_team_id || !match.man_of_match_id);
};
```

Update `handleFinalizeMatch` to remove the requirement that both MoM and winner must be selected:

```typescript
const handleFinalizeMatch = async (match: CricketMatch) => {
  const momId = selectedMoM.get(match.id) || null;
  const winnerId = selectedWinner.get(match.id) ?? null;

  setFinalizingMatchId(match.id);

  try {
    const { error: rpcError } = await supabase.rpc('admin_finalize_match', {
      p_match_id: match.id,
      p_man_of_match_cricbuzz_id: momId,
      p_winner_team_id: winnerId,
    });
    // ... rest stays the same
```

**Step 5: Update getStatusBadge for incomplete state**

```typescript
const getStatusBadge = (match: CricketMatch) => {
  const lm = leagueMatches.find(l => l.match_id === match.id);
  const isFinalized = lm?.stats_imported === true;

  if (isFinalized && isMatchIncomplete(match)) {
    return (
      <Badge className="bg-orange-500">
        <AlertCircle className="w-3 h-3 mr-1" />
        Incomplete
      </Badge>
    );
  }

  if (isFinalized) {
    return (
      <Badge className="bg-green-500">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Finalized
      </Badge>
    );
  }
  // ... rest stays the same
```

**Step 6: Update table row rendering**

The key change: allow editing for both `!isFinalized` AND `isIncomplete` matches.

Change the condition for showing dropdowns from:
```typescript
isComplete && !isFinalized
```
to:
```typescript
isComplete && (!isFinalized || isIncomplete)
```

Where `isIncomplete` is:
```typescript
const isIncomplete = isMatchIncomplete(match);
```

Also update the Actions column: show "Finalize" for unfinalized matches, "Re-finalize" for incomplete matches.

```typescript
{isComplete && (!isFinalized || isIncomplete) ? (
  <Button
    size="sm"
    onClick={() => handleFinalizeMatch(match)}
    disabled={isFinalizing}
    className="h-7 text-xs"
  >
    {isFinalizing ? (
      <>
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        {isIncomplete ? 'Updating...' : 'Finalizing...'}
      </>
    ) : (
      <>
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {isIncomplete ? 'Update' : 'Finalize'}
      </>
    )}
  </Button>
) : isFinalized ? (
  // ... Done badge
```

**Step 7: Auto-fetch MoM on dropdown open for incomplete/unfinalized matches**

In the MoM dropdown `onOpenChange`, trigger API fetch:

```typescript
onOpenChange={(open) => {
  if (open) {
    if (players.length === 0) fetchMatchPlayers(match.id);
    if (!selectedMoM.has(match.id) && !autoMoM.has(match.id)) {
      fetchMoMFromApi(match);
    }
  }
}}
```

Also show the auto-detected MoM name as a hint:

```typescript
<SelectTrigger className="w-[180px] h-8 text-xs">
  <SelectValue placeholder={
    fetchingMoM.has(match.id)
      ? "Fetching from API..."
      : autoMoM.has(match.id)
      ? `${autoMoM.get(match.id)!.name} (Auto)`
      : "Select player..."
  } />
</SelectTrigger>
```

**Step 8: Add batch finalize button**

Add a button at the top of each week group to finalize all auto-detectable matches:

```typescript
const getAutoFinalizableCount = (matches: CricketMatch[]): number => {
  return matches.filter(m => {
    const isComplete = m.state === 'Complete';
    const isFin = isMatchFinalized(m.id);
    const isInc = isMatchIncomplete(m);
    const hasWinner = selectedWinner.has(m.id);
    const hasMoM = selectedMoM.has(m.id);
    return isComplete && (!isFin || isInc) && hasWinner && hasMoM;
  }).length;
};

const handleBatchFinalize = async (matches: CricketMatch[]) => {
  const finalizeable = matches.filter(m => {
    const isComplete = m.state === 'Complete';
    const isFin = isMatchFinalized(m.id);
    const isInc = isMatchIncomplete(m);
    const hasWinner = selectedWinner.has(m.id);
    const hasMoM = selectedMoM.has(m.id);
    return isComplete && (!isFin || isInc) && hasWinner && hasMoM;
  });

  for (const match of finalizeable) {
    await handleFinalizeMatch(match);
  }
};
```

In the week group header, add:

```tsx
{autoCount > 0 && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleBatchFinalize(group.matches)}
    className="h-7 text-xs"
  >
    Finalize All ({autoCount})
  </Button>
)}
```

**Step 9: Commit**

```bash
git add src/components/platform-admin/MatchFinalization.tsx
git commit -m "feat: auto-detect winner and MoM in match finalization UI"
```

---

### Task 5: Verify and deploy

**Step 1: Run type check**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

**Step 2: Test locally**

- Start dev server: `npm run dev`
- Open admin page, navigate to Match Finalization
- Verify: Complete matches show auto-populated winner dropdowns
- Verify: Incomplete (orange badge) matches are editable
- Verify: Opening MoM dropdown triggers Cricbuzz API fetch
- Verify: "Finalize All" button appears for weeks with auto-detectable matches

**Step 3: Deploy edge function**

```bash
npx supabase functions deploy live-stats-poller
```

**Step 4: Apply migration to production**

```bash
npx supabase db push
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: automated winner and MoM detection for match finalization"
```

---

### Task 6: Re-finalize existing matches via admin UI

After deployment:
1. Open admin page in production
2. Scroll through weeks — matches missing winner/MoM show "Incomplete" orange badge
3. Winner should be auto-populated from result text
4. Open MoM dropdown to trigger Cricbuzz API fetch for each match
5. Use "Finalize All" per week for matches where both are available
6. For any remaining matches without MoM from API, manually select MoM
7. Verify points are recomputed after each finalization

---

## Key Considerations

- **Winner regex**: `^(.+?)\s+won\s+by` handles multi-word names (West Indies, New Zealand, South Africa)
- **MoM API availability**: Cricbuzz `scard` endpoint may not return `playersOfTheMatch` for all historical matches — that's why manual fallback is preserved
- **Re-finalize safety**: `admin_finalize_match` uses COALESCE so it won't overwrite existing good data unless explicitly provided
- **No scoring changes**: MoM bonus (50 pts) and team win bonus (5 pts) will be correctly applied during score recomputation after re-finalization
