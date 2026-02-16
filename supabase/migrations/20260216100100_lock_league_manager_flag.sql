-- Security: Prevent privilege escalation via is_league_manager
--
-- Problem: Any authenticated user can set is_league_manager = true on their
-- own managers record (or anyone else's) because the RLS policy on managers
-- allows unrestricted updates. Even with tighter RLS, a user could still
-- self-promote on their own row.
--
-- Solution: Database triggers that enforce is_league_manager = true ONLY when
-- the user_id matches leagues.league_manager_id for the given league. This is
-- a server-side invariant that cannot be bypassed from the client.

-- =============================================================================
-- 1. BEFORE INSERT/UPDATE trigger on managers: enforce the flag
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_league_manager_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only validate when is_league_manager is being set to true
  IF NEW.is_league_manager = true THEN
    -- Verify that the league's league_manager_id matches this manager's user_id
    IF NOT EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE id = NEW.league_id
        AND league_manager_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Only the league creator can be marked as league manager';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS check_league_manager_flag ON public.managers;

CREATE TRIGGER check_league_manager_flag
  BEFORE INSERT OR UPDATE ON public.managers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_league_manager_flag();


-- =============================================================================
-- 2. AFTER UPDATE trigger on leagues: sync flag when league_manager_id changes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_league_manager_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when league_manager_id actually changed
  IF OLD.league_manager_id IS DISTINCT FROM NEW.league_manager_id THEN

    -- Demote the old league manager (if there was one)
    IF OLD.league_manager_id IS NOT NULL THEN
      UPDATE public.managers
      SET is_league_manager = false
      WHERE league_id = NEW.id
        AND user_id = OLD.league_manager_id;
    END IF;

    -- Promote the new league manager (if there is one)
    IF NEW.league_manager_id IS NOT NULL THEN
      UPDATE public.managers
      SET is_league_manager = true
      WHERE league_id = NEW.id
        AND user_id = NEW.league_manager_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS sync_league_manager_on_league_update ON public.leagues;

CREATE TRIGGER sync_league_manager_on_league_update
  AFTER UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_league_manager_flag();
