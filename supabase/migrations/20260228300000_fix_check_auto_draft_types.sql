-- Migration: Fix check_auto_draft param types
-- Description: v_current_manager_id and v_current_user_id should be UUID instead of TEXT

CREATE OR REPLACE FUNCTION public.check_auto_draft(p_league_id UUID) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_state public.draft_state%ROWTYPE;
  v_current_manager_id UUID;
  v_current_user_id UUID;
  v_threshold_seconds INTEGER;
  v_elapsed_seconds FLOAT;
  v_auto_player UUID;
  v_auto_draft_enabled BOOLEAN;
BEGIN
  -- 1. Get current draft state (no lock yet, just check)
  SELECT * INTO v_draft_state FROM public.draft_state WHERE league_id = p_league_id;
  
  IF v_draft_state.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not active');
  END IF;

  -- 2. Find who is on the clock and their auto-draft status
  SELECT d_ord.manager_id, m.user_id, d_ord.auto_draft_enabled
  INTO v_current_manager_id, v_current_user_id, v_auto_draft_enabled
  FROM public.draft_order d_ord
  LEFT JOIN public.managers m ON m.id = d_ord.manager_id
  WHERE d_ord.league_id = p_league_id 
    AND d_ord.position = v_draft_state.current_position;

  -- 3. Determine threshold
  -- If CPU (no user) or explicit auto-draft enabled, trigger quickly (e.g. 1-2s delay)
  IF v_current_manager_id IS NULL OR v_current_user_id IS NULL OR v_auto_draft_enabled = true THEN
    v_threshold_seconds := 3;
  ELSE
    v_threshold_seconds := v_draft_state.clock_duration_seconds;
  END IF;

  -- 4. Calculate elapsed time
  v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_draft_state.last_pick_at)) - (v_draft_state.total_paused_duration_ms / 1000.0);
  
  -- 5. Trigger auto-pick if time expired
  IF v_elapsed_seconds > v_threshold_seconds THEN
     -- RE-VERIFY AVAILABLE PLAYER inside the call to execute_draft_pick
     -- We pick the best available here to pass to the serialized picker
     SELECT p.id INTO v_auto_player
     FROM public.league_players p
     WHERE p.league_id = p_league_id 
       AND p.id NOT IN (SELECT player_id FROM public.draft_picks WHERE league_id = p_league_id)
     ORDER BY p.id -- Deterministic choice if multiple available
     LIMIT 1;

     IF v_auto_player IS NOT NULL THEN
       RETURN public.execute_draft_pick(p_league_id, v_current_manager_id, v_auto_player, true);
     END IF;
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'time not expired', 'elapsed', v_elapsed_seconds, 'threshold', v_threshold_seconds);
END;
$$;
