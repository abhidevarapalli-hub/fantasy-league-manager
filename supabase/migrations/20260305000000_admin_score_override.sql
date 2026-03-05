-- ============================================================
-- Migration: Admin Score Override with Attribution + W/L Cascade
-- ============================================================
-- Adds modified_by / modified_at columns to league_matchups
-- and an RPC that atomically updates scores, winner, and
-- cascades W/L changes to the managers table.
-- ============================================================

-- 1a. Attribution columns
ALTER TABLE league_matchups
  ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- 1b. RPC: admin_update_matchup_scores
CREATE OR REPLACE FUNCTION admin_update_matchup_scores(
  p_matchup_id UUID,
  p_manager1_score NUMERIC,
  p_manager2_score NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old RECORD;
  v_new_winner UUID;
BEGIN
  -- Auth check
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can update matchup scores';
  END IF;

  -- Load existing matchup
  SELECT id, manager1_id, manager2_id, manager1_score, manager2_score,
         winner_id, is_finalized
    INTO v_old
    FROM league_matchups
   WHERE id = p_matchup_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Matchup not found: %', p_matchup_id;
  END IF;

  -- Skip BYE matchups
  IF v_old.manager2_id IS NULL THEN
    RAISE EXCEPTION 'Cannot edit BYE matchup scores';
  END IF;

  -- Compute new winner
  v_new_winner := NULL;
  IF p_manager1_score > p_manager2_score THEN
    v_new_winner := v_old.manager1_id;
  ELSIF p_manager2_score > p_manager1_score THEN
    v_new_winner := v_old.manager2_id;
  END IF;
  -- Tie → v_new_winner stays NULL

  -- Cascade W/L changes if matchup was finalized and winner changed
  IF v_old.is_finalized THEN
    -- Only cascade if winner actually changed
    IF (v_old.winner_id IS DISTINCT FROM v_new_winner) THEN
      -- Reverse old result
      IF v_old.winner_id IS NOT NULL THEN
        -- Old winner loses a win
        UPDATE managers SET wins = GREATEST(wins - 1, 0)
         WHERE id = v_old.winner_id;
        -- Old loser loses a loss
        UPDATE managers SET losses = GREATEST(losses - 1, 0)
         WHERE id = CASE
           WHEN v_old.winner_id = v_old.manager1_id THEN v_old.manager2_id
           ELSE v_old.manager1_id
         END;
      END IF;
      -- If old result was a tie, reverse the tie (no W/L to undo)

      -- Apply new result
      IF v_new_winner IS NOT NULL THEN
        -- New winner gains a win
        UPDATE managers SET wins = wins + 1
         WHERE id = v_new_winner;
        -- New loser gains a loss
        UPDATE managers SET losses = losses + 1
         WHERE id = CASE
           WHEN v_new_winner = v_old.manager1_id THEN v_old.manager2_id
           ELSE v_old.manager1_id
         END;
      END IF;
      -- If new result is a tie, no W/L to add
    END IF;
  END IF;

  -- Update the matchup row
  UPDATE league_matchups
     SET manager1_score = p_manager1_score,
         manager2_score = p_manager2_score,
         winner_id      = v_new_winner,
         modified_by    = auth.uid(),
         modified_at    = NOW()
   WHERE id = p_matchup_id;
END;
$$;
