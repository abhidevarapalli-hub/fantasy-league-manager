-- Migration: Real-Time Draft Engine
-- Description: Drop old draft tables, recreate with REPLICA IDENTITY FULL, add to realtime publication, and create make_draft_pick RPC.

-- 1. Rip out old tables
DROP TABLE IF EXISTS public.draft_state CASCADE;
DROP TABLE IF EXISTS public.draft_order CASCADE;
DROP TABLE IF EXISTS public.draft_picks CASCADE;

-- 2. Recreate draft_state
CREATE TABLE public.draft_state (
  league_id UUID PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pre_draft', -- 'pre_draft', 'active', 'paused', 'completed'
  current_round INTEGER DEFAULT 1,
  current_position INTEGER DEFAULT 1,
  clock_duration_seconds INTEGER DEFAULT 60,
  last_pick_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  total_paused_duration_ms BIGINT DEFAULT 0,
  version INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.draft_state REPLICA IDENTITY FULL;

-- 3. Recreate draft_order
CREATE TABLE public.draft_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  auto_draft_enabled BOOLEAN DEFAULT false,
  UNIQUE(league_id, position)
);
ALTER TABLE public.draft_order REPLICA IDENTITY FULL;

-- 4. Recreate draft_picks
CREATE TABLE public.draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.master_players(id) ON DELETE CASCADE,
  is_auto_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.draft_picks REPLICA IDENTITY FULL;

-- 5. RLS Policies
ALTER TABLE public.draft_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "draft_state_read" ON public.draft_state FOR SELECT USING (true);
CREATE POLICY "draft_order_read" ON public.draft_order FOR SELECT USING (true);
CREATE POLICY "draft_picks_read" ON public.draft_picks FOR SELECT USING (true);

CREATE POLICY "draft_state_write" ON public.draft_state FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "draft_order_write" ON public.draft_order FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "draft_picks_write" ON public.draft_picks FOR ALL USING (auth.role() = 'authenticated');

-- 6. Add to Realtime Publication
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_state;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_order;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_picks;
COMMIT;

-- 7. RPC to securely execute a draft pick and update state atomically
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
  v_pick_number := ((v_draft_state.current_round - 1) * v_manager_count) + v_draft_state.current_position;

  -- Verify it's actually this manager's turn (skip if auto-draft from system to be safe, but let's just assert)
  DECLARE
    expected_manager UUID;
  BEGIN
    SELECT manager_id INTO expected_manager FROM public.draft_order WHERE league_id = p_league_id AND position = v_draft_state.current_position;
    IF p_manager_id IS NOT NULL AND expected_manager != p_manager_id THEN
       RAISE EXCEPTION 'Not this manager turn. Expected %, got %', expected_manager, p_manager_id;
    END IF;
    -- If p_manager_id was null (e.g. system auto draft), use expected manager.
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

  -- Add to manager_roster (auto assume 'bench' or 'active' depending on limits, but simple append works for now)
  -- Actually, the client will fetch the roster later. For now, we manually insert into manager_roster for weeks 1..7
  -- Let's just create a basic entry for week 1 for now or rely on the UI to sync.
  -- Wait, the original code added to `manager_roster` via a big function or client calls. Let's do a basic insert for week=1..7 here.
  FOR w IN 1..7 LOOP
    INSERT INTO public.manager_roster (manager_id, player_id, league_id, slot_type, week, position)
    VALUES (p_manager_id, p_player_id, p_league_id, 'bench', w, (SELECT count(*) FROM manager_roster WHERE manager_id=p_manager_id and league_id=p_league_id and week=w and slot_type='bench'));
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

-- 8. RPC for the heartbeat auto-draft check
CREATE OR REPLACE FUNCTION public.check_auto_draft(p_league_id UUID) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_state public.draft_state%ROWTYPE;
  v_time_passed INTERVAL;
  v_auto_player UUID;
  v_current_manager UUID;
BEGIN
  -- Non-blocking check first
  SELECT * INTO v_draft_state FROM public.draft_state WHERE league_id = p_league_id;
  
  IF v_draft_state.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not active');
  END IF;

  v_time_passed := NOW() - v_draft_state.last_pick_at;
  
  -- If time has exceeded clock duration + 1 sec buffer
  IF EXTRACT(EPOCH FROM v_time_passed) > (v_draft_state.clock_duration_seconds + 1) THEN
     -- Time expired! Lock and auto-pick.
     
     -- Find best available player (naive heuristic: highest id for now or first available)
     SELECT p.id INTO v_auto_player
     FROM public.league_players p
     WHERE p.league_id = p_league_id 
       AND p.id NOT IN (SELECT player_id FROM public.draft_picks WHERE league_id = p_league_id)
     LIMIT 1;

     IF v_auto_player IS NOT NULL THEN
       RETURN public.execute_draft_pick(p_league_id, NULL, v_auto_player, true);
     END IF;
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'time not expired');
END;
$$;
