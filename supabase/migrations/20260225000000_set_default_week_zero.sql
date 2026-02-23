-- Add current_week column if it doesn't exist (it might have been added manually before)
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 0;

-- Set the default value of current_week to 0 initially
ALTER TABLE public.leagues ALTER COLUMN current_week SET DEFAULT 0;
