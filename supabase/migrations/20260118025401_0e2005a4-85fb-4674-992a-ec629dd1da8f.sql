-- Add is_international column to players table
ALTER TABLE public.players 
ADD COLUMN is_international boolean NOT NULL DEFAULT false;