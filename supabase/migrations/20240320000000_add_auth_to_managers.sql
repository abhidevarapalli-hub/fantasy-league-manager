-- Add missing columns to managers table if they don't exist
DO $$ 
BEGIN
  -- Add user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='user_id') THEN
    ALTER TABLE public.managers ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;

  -- Add is_league_manager
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='is_league_manager') THEN
    ALTER TABLE public.managers ADD COLUMN is_league_manager BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Ensure Abhi is League Manager
UPDATE managers SET is_league_manager = true WHERE name = 'Abhi';

-- RLS Policies for managers
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on managers" ON managers;
CREATE POLICY "Allow public read access on managers"
  ON managers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update managers" ON managers;
CREATE POLICY "Allow authenticated users to update managers"
  ON managers FOR UPDATE
  USING (auth.role() = 'authenticated');

-- RLS Policies for players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on players" ON players;
CREATE POLICY "Allow public read access on players"
  ON players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to modify players" ON players;
CREATE POLICY "Allow authenticated users to modify players"
  ON players FOR ALL
  USING (auth.role() = 'authenticated');

-- RLS Policies for schedule
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on schedule" ON schedule;
CREATE POLICY "Allow public read access on schedule"
  ON schedule FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update schedule" ON schedule;
CREATE POLICY "Allow authenticated users to update schedule"
  ON schedule FOR UPDATE
  USING (auth.role() = 'authenticated');

-- RLS Policies for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on transactions" ON transactions;
CREATE POLICY "Allow public read access on transactions"
  ON transactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert transactions" ON transactions;
CREATE POLICY "Allow authenticated users to insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can claim an unlinked manager profile
-- This is now just a legacy policy but we'll remove it or make it wide
DROP POLICY IF EXISTS "Users can claim unlinked manager profile" ON public.managers;
