-- Migration: Server-side Pause/Resume RPCs
-- Description: Move pause/resume time calculations server-side to eliminate
-- client clock skew issues that corrupt the draft timer after long pauses.

-- pause_draft: Sets paused_at to NOW() (server time)
CREATE OR REPLACE FUNCTION public.pause_draft(p_league_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_state public.draft_state%ROWTYPE;
BEGIN
  SELECT * INTO v_draft_state
  FROM public.draft_state
  WHERE league_id = p_league_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'draft state not found');
  END IF;

  IF v_draft_state.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'draft is not active');
  END IF;

  UPDATE public.draft_state
  SET
    status = 'paused',
    paused_at = NOW(),
    updated_at = NOW()
  WHERE league_id = p_league_id;

  RETURN jsonb_build_object('success', true, 'paused_at', NOW());
END;
$$;

-- resume_draft: Calculates pause duration server-side using NOW() - paused_at
CREATE OR REPLACE FUNCTION public.resume_draft(p_league_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_state public.draft_state%ROWTYPE;
  v_additional_pause_ms FLOAT;
  v_new_total_paused_ms FLOAT;
BEGIN
  SELECT * INTO v_draft_state
  FROM public.draft_state
  WHERE league_id = p_league_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'draft state not found');
  END IF;

  IF v_draft_state.status != 'paused' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'draft is not paused');
  END IF;

  -- Calculate pause duration entirely server-side
  IF v_draft_state.paused_at IS NOT NULL THEN
    v_additional_pause_ms := EXTRACT(EPOCH FROM (NOW() - v_draft_state.paused_at)) * 1000;
  ELSE
    v_additional_pause_ms := 0;
  END IF;

  v_new_total_paused_ms := COALESCE(v_draft_state.total_paused_duration_ms, 0) + v_additional_pause_ms;

  UPDATE public.draft_state
  SET
    status = 'active',
    paused_at = NULL,
    total_paused_duration_ms = v_new_total_paused_ms,
    updated_at = NOW()
  WHERE league_id = p_league_id;

  RETURN jsonb_build_object(
    'success', true,
    'additional_pause_ms', v_additional_pause_ms,
    'total_paused_ms', v_new_total_paused_ms
  );
END;
$$;
