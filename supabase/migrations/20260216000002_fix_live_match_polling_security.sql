-- Fix live_match_polling functions to use SECURITY DEFINER.
-- The table has RLS enabled with only a SELECT policy for authenticated users,
-- so all INSERT/UPDATE operations must go through SECURITY DEFINER functions.

-- 1. New function: upsert polling state (used by admin sync/import)
CREATE OR REPLACE FUNCTION upsert_match_polling_state(
  p_cricbuzz_match_id INTEGER,
  p_match_id UUID DEFAULT NULL,
  p_match_state TEXT DEFAULT 'Upcoming'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_id, match_state)
  VALUES (p_cricbuzz_match_id, p_match_id, p_match_state)
  ON CONFLICT (cricbuzz_match_id)
  DO UPDATE SET
    match_id = COALESCE(EXCLUDED.match_id, live_match_polling.match_id),
    match_state = EXCLUDED.match_state,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add SECURITY DEFINER to existing enable_match_polling
CREATE OR REPLACE FUNCTION enable_match_polling(
  p_cricbuzz_match_id INTEGER,
  p_initial_state TEXT DEFAULT 'Live'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_state, polling_enabled)
  VALUES (p_cricbuzz_match_id, p_initial_state, true)
  ON CONFLICT (cricbuzz_match_id)
  DO UPDATE SET
    polling_enabled = true,
    match_state = EXCLUDED.match_state,
    error_count = 0,
    last_error = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add SECURITY DEFINER to existing disable_match_polling
CREATE OR REPLACE FUNCTION disable_match_polling(
  p_cricbuzz_match_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    polling_enabled = false,
    auto_enabled = false,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. New function: re-enable auto-polling for a manually disabled match
CREATE OR REPLACE FUNCTION reenable_auto_polling(
  p_cricbuzz_match_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    auto_enabled = true,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION upsert_match_polling_state(INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_match_polling_state(INTEGER, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reenable_auto_polling(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reenable_auto_polling(INTEGER) TO service_role;
