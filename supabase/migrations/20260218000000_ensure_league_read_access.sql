-- Migration: Ensure authenticated users can read leagues table
-- Description: Drop existing restrictive policies and add a policy allowing read access to leagues for all authenticated users.
--              This is required for "Join League by ID" functionality where a user needs to fetch league details before joining.

-- Drop potential restrictive policies if they exist (cleanup from previous attempts)
DROP POLICY IF EXISTS "Users can only view their own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can view all leagues" ON public.leagues;
DROP POLICY IF EXISTS "Users can view leagues they are part of or own" ON public.leagues;

-- Create a comprehensive read policy
-- This allows any authenticated user to SELECT any row in the leagues table.
-- Necessary for searching/joining leagues.
CREATE POLICY "Authenticated users can view all leagues"
  ON public.leagues
  FOR SELECT
  TO authenticated
  USING (true);
