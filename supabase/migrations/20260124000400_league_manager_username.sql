-- Add league_manager_username to leagues table
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS league_manager_username TEXT;

-- Update existing leagues to set league_manager_username from profiles
UPDATE public.leagues l
SET league_manager_username = p.username
FROM public.profiles p
WHERE l.league_manager_id = p.id;

-- Ensure usernames are unique in profiles (already has UNIQUE, but let's be sure)
-- This might fail if duplicates exist, but we handles that in the UI
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;
