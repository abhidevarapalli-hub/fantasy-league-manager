# Auto Winner & Man of the Match Design

## Problem

50 completed matches have `stats_imported=true` but both `winner_team_id` and `man_of_match_id` are NULL. The `result` text (e.g., "India won by 29 runs") is populated, and player stats exist, but winner/MoM were never mapped to their respective columns. This happened during a batch import that set `stats_imported=true` without running winner/MoM extraction.

## Decisions

- **Winner**: Auto-detect from `result` text by parsing team name and matching against `team1/team2` fields
- **MoM**: Attempt Cricbuzz API fetch; if unavailable, leave for manual selection
- **Existing data**: Build automation first, then re-finalize the 50 broken matches through the admin UI
- **Going forward**: Live poller to set `winner_team_id` when it detects match completion

## Architecture

### 1. SQL: `auto_resolve_winner(p_match_id)` Function

New SQL function that:
- Reads `cricket_matches.result`
- Extracts winning team name via regex (handles "X won by...", "X beat Y by...")
- Case-insensitive match against `team1_name`, `team2_name`, `team1_short`, `team2_short`
- Returns matching `team1_id` or `team2_id`, or NULL for ties/no-result

### 2. SQL: Update `admin_finalize_match`

When `p_winner_team_id` is NULL (not provided), auto-call `auto_resolve_winner()` to attempt resolution. This way the admin can omit the winner and it auto-fills.

### 3. Frontend: MatchFinalization.tsx

- Auto-parse `result` text client-side to pre-select winner dropdown
- Fetch Cricbuzz scorecard API for unfinalized complete matches to extract MoM
- Show auto-detected values with "(Auto)" indicator
- Allow admin override before clicking Finalize
- Add "Finalize All" button for batch finalization when both values are auto-detected
- Show "incomplete" badge on finalized matches missing winner/MoM
- Allow re-finalize on those incomplete matches

### 4. Live Poller Fix

In `live-stats-poller/index.ts`, when match is complete:
- Parse `result` text to extract winner team name (already done as `winnerTeamName`)
- Match against `team1_name/team2_name/team1_short/team2_short` from the match record
- Set `winner_team_id` in the update payload

## Data Flow

```
Match completes → Live poller sets result + winner_team_id + MoM (from API)
               → Admin opens Match Finalization
               → UI auto-parses result → pre-fills winner
               → UI fetches Cricbuzz API → pre-fills MoM (if available)
               → Admin reviews/overrides → Finalize
               → RPC sets winner_team_id + man_of_match_id
               → Score recomputation
```

## Files to Modify

1. `supabase/migrations/<timestamp>_auto_winner_mom.sql` — new function + RPC update
2. `src/components/platform-admin/MatchFinalization.tsx` — auto-populate + re-finalize UI
3. `supabase/functions/live-stats-poller/index.ts` — winner_team_id resolution

## Not Changed

- Week finalization flow
- Scoring/points calculation
- `team_won` flag logic on `match_player_stats` (already works correctly)
