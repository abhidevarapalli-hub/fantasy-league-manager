-- Migration: Fix Auto-Draft Concurrency
-- Description: Add unique constraints to draft_picks and enhance RPCs to handle concurrent attempts gracefully.

-- 1. Add Unique Constraints to draft_picks
-- Ensure a player can only be drafted once in a league
ALTER TABLE public.draft_picks ADD CONSTRAINT draft_picks_league_player_unique UNIQUE (league_id, player_id);
-- Ensure a specific pick position (round/pick_number) can only be filled once
ALTER TABLE public.draft_picks ADD CONSTRAINT draft_picks_league_pick_unique UNIQUE (league_id, round, pick_number);

-- 2. Enhanced execute_draft_pick with defensive checks
CREATE OR REPLACE FUNCTION public.execute_draft_pick(
  p_league_id UUID,
  p_manager_id UUID,
  p_player_id UUID,
  p_is_auto_draft BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_state public.draft_state%ROWTYPE;
  v_manager_count INTEGER;
  v_next_round INTEGER;
  v_next_position INTEGER;
  v_pick_number INTEGER;
  v_new_status TEXT;
  v_config public.leagues%ROWTYPE;
  v_roster_cap INTEGER;
  v_existing_pick_id UUID;
BEGIN
  -- Lock draft_state for specific league to serialize pick processing
  SELECT * INTO v_draft_state 
  FROM public.draft_state 
  WHERE league_id = p_league_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft state not found for league %', p_league_id;
  END IF;

  IF v_draft_state.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'draft not active', 'status', v_draft_state.status);
  END IF;

  -- CALCULATE PICK NUMBER AGAIN AFTER LOCK
  SELECT manager_count INTO v_manager_count FROM public.leagues WHERE id = p_league_id;
  v_pick_number := ((v_draft_state.current_round - 1) * v_manager_count) + v_draft_state.current_position;

  -- DEFENSIVE CHECK: Has this exact pick already been made? (e.g. concurrent auto-draft)
  SELECT id INTO v_existing_pick_id 
  FROM public.draft_picks 
  WHERE league_id = p_league_id AND round = v_draft_state.current_round AND pick_number = v_pick_number;

  IF v_existing_pick_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reason', 'pick already processed', 'next_round', v_draft_state.current_round, 'next_position', v_draft_state.current_position);
  END IF;

  -- DEFENSIVE CHECK: Is this player already drafted?
  SELECT id INTO v_existing_pick_id FROM public.draft_picks WHERE league_id = p_league_id AND player_id = p_player_id;
  IF v_existing_pick_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'player already drafted');
  END IF;

  -- Determine expected manager
  DECLARE
    expected_manager UUID;
  BEGIN
    SELECT manager_id INTO expected_manager FROM public.draft_order WHERE league_id = p_league_id AND position = v_draft_state.current_position;
    IF p_manager_id IS NOT NULL AND expected_manager != p_manager_id THEN
       RAISE EXCEPTION 'Not this manager turn. Expected %, got %', expected_manager, p_manager_id;
    END IF;
    IF p_manager_id IS NULL THEN
       p_manager_id := expected_manager;
    END IF;
  END;

  -- Insert the pick
  INSERT INTO public.draft_picks (
    league_id,
    round,
    pick_number,
    manager_id,
    player_id,
    is_auto_draft
  ) VALUES (
    p_league_id,
    v_draft_state.current_round,
    v_pick_number,
    p_manager_id,
    p_player_id,
    p_is_auto_draft
  );

  -- Add to manager_roster for weeks 1..7 (Optimistically handles already-inserted error via ignore or check if needed)
  FOR w IN 1..7 LOOP
    INSERT INTO public.manager_roster (manager_id, player_id, league_id, slot_type, week, position)
    VALUES (
        p_manager_id, 
        p_player_id, 
        p_league_id, 
        'bench', 
        w, 
        (SELECT COALESCE(MAX(position), -1) + 1 FROM manager_roster WHERE manager_id=p_manager_id and league_id=p_league_id and week=w and slot_type='bench')
    )
    ON CONFLICT (player_id, league_id, week) DO NOTHING;
  END LOOP;

  v_next_round := v_draft_state.current_round;
  v_next_position := v_draft_state.current_position;
  
  IF MOD(v_draft_state.current_round, 2) = 1 THEN
    IF v_draft_state.current_position < v_manager_count THEN
      v_next_position := v_draft_state.current_position + 1;
    ELSE
      v_next_round := v_draft_state.current_round + 1;
    END IF;
  ELSE
    IF v_draft_state.current_position > 1 THEN
      v_next_position := v_draft_state.current_position - 1;
    ELSE
      v_next_round := v_draft_state.current_round + 1;
    END IF;
  END IF;

  SELECT * INTO v_config FROM public.leagues WHERE id = p_league_id;
  v_roster_cap := v_config.active_size + v_config.bench_size;

  v_new_status := v_draft_state.status;
  IF v_next_round > v_roster_cap THEN
    v_new_status := 'completed';
  END IF;

  UPDATE public.draft_state
  SET 
    current_round = v_next_round,
    current_position = v_next_position,
    last_pick_at = NOW(),
    status = v_new_status,
    total_paused_duration_ms = 0,
    version = version + 1,
    updated_at = NOW()
  WHERE league_id = p_league_id;

  RETURN jsonb_build_object(
    'success', true,
    'next_round', v_next_round,
    'next_position', v_next_position,
    'status', v_new_status
  );
END;
$$;

-- 3. Update check_auto_draft to be more resilient
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
  SELECT do.manager_id, m.user_id, do.auto_draft_enabled
  INTO v_current_manager_id, v_current_user_id, v_auto_draft_enabled
  FROM public.draft_order do
  LEFT JOIN public.managers m ON m.id = do.manager_id
  WHERE do.league_id = p_league_id 
    AND do.position = v_draft_state.current_position;

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
