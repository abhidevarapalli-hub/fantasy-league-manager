-- Fix: Allow authenticated users to insert/update master_players
--
-- The league creation flow (useSeedDatabase.ts) upserts players from Cricbuzz
-- into master_players. The current policies restrict INSERT/UPDATE to service_role
-- only, which blocks the frontend. Authenticated users need write access since
-- master_players is a shared global table populated during league setup.

DROP POLICY IF EXISTS "Only service role can insert master players" ON public.master_players;
DROP POLICY IF EXISTS "Only service role can update master players" ON public.master_players;

CREATE POLICY "Authenticated users can insert master players"
  ON public.master_players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update master players"
  ON public.master_players
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
