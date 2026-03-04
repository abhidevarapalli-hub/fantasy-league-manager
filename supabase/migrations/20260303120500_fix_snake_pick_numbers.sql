-- Migration: Fix Snake Draft Pick Numbering
-- Description: Update execute_draft_pick to use sequential numbering (1, 2, 3...) regardless of snake direction, and backfill existing picks.

-- 1. Update the RPC function
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
  v_pos_in_round INTEGER;
BEGIN
  -- Lock draft_state for specific league
  SELECT * INTO v_draft_state 
  FROM public.draft_state 
  WHERE league_id = p_league_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft state not found for league %', p_league_id;
  END IF;

  IF v_draft_state.status != 'active' THEN
    RAISE EXCEPTION 'Draft is not active (current status: %)', v_draft_state.status;
  END IF;

  SELECT manager_count INTO v_manager_count FROM public.leagues WHERE id = p_league_id;
  
  -- SEQUENTIAL PICK NUMBER CALCULATION
  -- Round 1: Pos 1->Pick 1, Pos 8->Pick 8
  -- Round 2: Pos 8->Pick 9, Pos 1->Pick 16
  v_pos_in_round := CASE 
    WHEN MOD(v_draft_state.current_round, 2) = 1 THEN v_draft_state.current_position
    ELSE (v_manager_count - v_draft_state.current_position + 1)
  END;
  
  v_pick_number := ((v_draft_state.current_round - 1) * v_manager_count) + v_pos_in_round;

  -- Verify it's actually this manager's turn
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

  -- Add to manager_roster for weeks 1..7
  FOR w IN 1..7 LOOP
    INSERT INTO public.manager_roster (manager_id, player_id, league_id, slot_type, week, position)
    VALUES (p_manager_id, p_player_id, p_league_id, 'bench', w, (SELECT count(*) FROM manager_roster WHERE manager_id=p_manager_id and league_id=p_league_id and week=w and slot_type='bench'));
  END LOOP;

  -- Calculate next position
  v_next_round := v_draft_state.current_round;
  v_next_position := v_draft_state.current_position;
  
  IF MOD(v_draft_state.current_round, 2) = 1 THEN
    IF v_draft_state.current_position < v_manager_count THEN
      v_next_position := v_draft_state.current_position + 1;
    ELSE
      v_next_round := v_draft_state.current_round + 1;
      -- Position stays v_manager_count for next round (snake)
    END IF;
  ELSE
    IF v_draft_state.current_position > 1 THEN
      v_next_position := v_draft_state.current_position - 1;
    ELSE
      v_next_round := v_draft_state.current_round + 1;
      -- Position stays 1 for next round (snake)
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
    version = version + 100, -- Large jump to signal major fix
    updated_at = NOW()
  WHERE league_id = p_league_id;

  RETURN jsonb_build_object(
    'success', true,
    'next_round', v_next_round,
    'next_position', v_next_position,
    'status', v_new_status,
    'pick_number', v_pick_number
  );
END;
$$;

-- 2. Backfill existing picks for ALL leagues to ensure they use the sequential formula
DO $$
DECLARE
  r RECORD;
  v_manager_count INTEGER;
  v_new_pick_number INTEGER;
  v_pos_in_round INTEGER;
BEGIN
  FOR r IN SELECT id, league_id, round, manager_id FROM public.draft_picks LOOP
    -- Get manager count for this league
    SELECT manager_count INTO v_manager_count FROM public.leagues WHERE id = r.league_id;
    
    -- Find the original 'position' (column) this manager holds in this league
    -- This is the 'position' column in draft_order
    SELECT position INTO v_pos_in_round
    FROM public.draft_order 
    WHERE league_id = r.league_id AND manager_id = r.manager_id;

    -- Calculate sequential pick number
    IF MOD(r.round, 2) = 1 THEN
      v_new_pick_number := ((r.round - 1) * v_manager_count) + v_pos_in_round;
    ELSE
      v_new_pick_number := ((r.round - 1) * v_manager_count) + (v_manager_count - v_pos_in_round + 1);
    END IF;

    UPDATE public.draft_picks SET pick_number = v_new_pick_number WHERE id = r.id;
  END LOOP;
END $$;
