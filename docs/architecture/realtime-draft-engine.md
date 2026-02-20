# Design Document: Real-Time Fantasy Draft Engine

## 1. Overview

The goal is to provide a low-latency, resilient draft experience where picks, timer changes, and order adjustments are synchronized instantly across all participants without requiring page refreshes.

### Key Objectives

* **Zero-Lag Synchronization:** All users see the same clock and the same pick results simultaneously.
* **Server-Side Authority:** Auto-picks and timers must function even if the League Manager (LM) closes their browser.
* **Optimistic UI:** Local actions feel instant while background sync handles persistence.

---

## 2. Schema Design (PostgreSQL)

To avoid the Realtime filtering issues encountered previously, we will use a **flat, high-identity schema** optimized for the Supabase WAL (Write-Ahead Log).

### `draft_state` (One per League)

This table acts as the heartbeat of the draft.

```sql
CREATE TABLE draft_state (
  league_id UUID PRIMARY KEY REFERENCES leagues(id),
  status TEXT DEFAULT 'pre_draft', -- 'pre_draft', 'active', 'paused', 'completed'
  current_round INTEGER DEFAULT 1,
  current_position INTEGER DEFAULT 1,
  clock_duration_seconds INTEGER DEFAULT 60,
  last_pick_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  total_paused_duration_ms BIGINT DEFAULT 0,
  version INTEGER DEFAULT 0 -- For optimistic concurrency control
);
ALTER TABLE draft_state REPLICA IDENTITY FULL;

```

### `draft_order` (The Sequence)

```sql
CREATE TABLE draft_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  position INTEGER NOT NULL, -- 1 to N
  manager_id UUID REFERENCES managers(id),
  auto_draft_enabled BOOLEAN DEFAULT false,
  UNIQUE(league_id, position)
);
ALTER TABLE draft_order REPLICA IDENTITY FULL;

```

### `draft_picks` (The Results)

```sql
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL, -- Overall pick index
  manager_id UUID REFERENCES managers(id),
  player_id UUID REFERENCES master_players(id),
  is_auto_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE draft_picks REPLICA IDENTITY FULL;

```

---

## 3. Real-Time Strategy

### A. Postgres Changes (The Source of Truth)

We will subscribe to the tables using `league_id` filters. To fix the current sync issue where updates don't propagate, we MUST enable **Replica Identity FULL**. This ensures the `league_id` is present in the payload even for `UPDATE` events.

### B. Supabase Presence & Broadcast (The UX Layer)

For non-persistent events (faster than DB writes), use **Supabase Realtime Channels**:

* **Presence:** Show who is "In the War Room."
* **Broadcast:** Use for "User is typing" or "Manager X is looking at [Player Name]" alerts.

---

## 4. The Logic Engine

### Server-Authoritative Timing (Edge Functions)

Instead of relying on a client-side `useEffect` to trigger auto-picks, we move the timer logic to **Supabase Edge Functions**.

1. **On Pick:** When a pick is made, the Edge Function calculates the next drafter.
2. **Delayed Execution:** The Edge Function schedules a "Check Timer" call (using a tool like Upstash or a persistent worker) for .
3. **Auto-Draft Trigger:** If no pick has been made by the deadline, the server executes the auto-draft logic immediately.

### Pick Execution Workflow

1. **Client:** Sends `make_pick(player_id)` to a Supabase RPC function.
2. **RPC Function:** * Checks if it is the manager's turn.
* Verifies the player is available.
* Inserts into `draft_picks`.
* Updates `draft_state` (increments round/position).


3. **Realtime:** The DB change triggers an event sent to all clients.
4. **UI:** All clients update their boards instantly based on the `draft_picks` insert.

---

## 5. Frontend Implementation (Zustand)

### Store Integration

The `useGameStore` should be the central hub for the draft state.

```typescript
// Subscription Logic in Store
const subscribeToDraft = (leagueId: string) => {
  // IMPORTANT: Supabase Realtime can drop events if too many `postgres_changes` 
  // bindings are attached to a single channel. Split high-frequency domains 
  // (like the active draft) into their own dedicated channels.
  const draftChannel = supabase
    .channel(`draft-${leagueId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'draft_picks', filter: `league_id=eq.${leagueId}` },
      (payload) => {
        // Handle New Pick
        addPickToState(payload.new);
      }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'draft_state', filter: `league_id=eq.${leagueId}` },
      (payload) => {
        // Sync Clock and status (Pause/Play)
        syncLocalTimer(payload.new);
      }
    )
    .subscribe();
};

```

### Synchronized Timer Component

To ensure everyone sees the same time, the clock should not simply count down locally. It should calculate:

`timeRemaining = clock_duration_seconds - (NOW() - last_pick_at)`

This ensures that even if a user joins mid-pick, their clock is perfectly in sync with the server.

---

## 6. Advanced Features (The "Sleeper" Touch)

1. **Draft Queue:** Add a `draft_queue` table where managers can pre-rank players. The server-side auto-draft logic will check this table before taking the highest-ranked player from the pool.
2. **Trade Ticker:** Use Supabase Broadcast to send a "Manager A is proposing a trade for Pick 2.04" notification across the top of the screen.
3. **Sound Effects:** Trigger different audio cues (e.g., a "gavel" sound for picks, a "buzzer" for time running out) via the Realtime event handlers.
4. **Admin Rollback:** Create an RPC function `rollback_pick(pick_id)` that deletes the pick and reverts the `draft_state` pointers.

---

## 7. Migration Checklist

1. **Run SQL Migration:** Create tables and enable `REPLICA IDENTITY FULL`.
2. **Enable Realtime:** Add tables to the `supabase_realtime` publication.
3. **Deploy Edge Function:** Implement the auto-draft timeout manager.
4. **Refactor `useDraft` Hook:** Replace local timer logic with server-sync logic.
