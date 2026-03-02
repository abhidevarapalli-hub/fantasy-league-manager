-- Migration: Fix enable_match_polling referencing non-existent columns
-- Root cause: Migration 20260224195201 added references to consecutive_errors,
-- circuit_state, and circuit_opened_at columns in the ON CONFLICT UPDATE clause,
-- but these columns were never added to the live_match_polling table.
-- The existing error_count and last_error columns already handle error tracking.

DROP FUNCTION IF EXISTS enable_match_polling(INTEGER, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION enable_match_polling(
  p_cricbuzz_match_id INTEGER,
  p_match_id UUID,
  p_initial_state TEXT DEFAULT 'Upcoming',
  p_auto BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_id, match_state, polling_enabled, auto_enabled)
  VALUES (p_cricbuzz_match_id, p_match_id, p_initial_state, true, true)
  ON CONFLICT (cricbuzz_match_id)
  DO UPDATE SET
    match_id = COALESCE(EXCLUDED.match_id, live_match_polling.match_id),
    polling_enabled = true,
    match_state = EXCLUDED.match_state,
    auto_enabled = CASE WHEN p_auto THEN live_match_polling.auto_enabled ELSE true END,
    error_count = 0,
    last_error = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, UUID, TEXT, BOOLEAN) TO service_role;
